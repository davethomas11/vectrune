//! Rune test support. Task-local routing keeps test-request unavailable in normal applications.
use crate::{
    builtins::{BuiltinResult, Context, LAST_EXEC_RESULT},
    core::{
        execute_steps_inner_no_fallthrough, extract_data_sources, extract_schemas, resolve_path,
        AppState,
    },
    rune_ast::RuneDocument,
};
use anyhow::{bail, Result};
use axum::{
    body::{to_bytes, Body},
    http::Request,
    Router,
};
use clap::ArgMatches;
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    path::Path,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tower::ServiceExt;

tokio::task_local! { static SESSION: TestSession; }
tokio::task_local! { static IN_REQUEST: bool; }
struct TestSession {
    router: Router,
    assertions: Arc<AtomicUsize>,
    failure: Arc<Mutex<Option<String>>>,
}

pub fn is_active() -> bool {
    SESSION.try_with(|_| ()).is_ok() && !IN_REQUEST.try_with(|active| *active).unwrap_or(false)
}

pub async fn call(
    name: &str,
    args: &[String],
    ctx: &mut Context,
    assign_to: Option<&str>,
) -> BuiltinResult {
    if !is_active() {
        return BuiltinResult::Error(format!(
            "{name} is only available inside vectrune test steps"
        ));
    }
    let session = SESSION.try_with(|s| (s.router.clone(), s.assertions.clone(), s.failure.clone()));
    let Ok((router, assertions, failure)) = session else {
        return BuiltinResult::Error(format!("{name} is only available inside vectrune test"));
    };
    let result = if name == "assert" {
        assertions.fetch_add(1, Ordering::Relaxed);
        assertion(&args.join(" "), ctx)
    } else {
        request(router, args, ctx, assign_to).await
    };
    match result {
        Ok(()) => BuiltinResult::Ok,
        Err(error) => {
            let message = error.to_string();
            *failure.lock().unwrap() = Some(message.clone());
            BuiltinResult::Error(message)
        }
    }
}

fn operand(text: &str, ctx: &Context) -> Result<Value> {
    let text = text.trim();
    if let Ok(value) = serde_json::from_str(text) {
        return Ok(value);
    }
    resolve_path(ctx, text, None)
        .ok_or_else(|| anyhow::anyhow!("Unresolved assertion operand: {text}"))
}

fn assertion(expression: &str, ctx: &Context) -> Result<()> {
    // Locate an operator outside quoted strings and indexed paths.
    let mut quoted = false;
    let mut escaped = false;
    let mut depth = 0usize;
    for (index, ch) in expression.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if ch == '\\' && quoted {
            escaped = true;
            continue;
        }
        if ch == '"' {
            quoted = !quoted;
            continue;
        }
        if quoted {
            continue;
        }
        match ch {
            '[' | '{' => depth += 1,
            ']' | '}' => depth = depth.saturating_sub(1),
            _ => {}
        }
        if depth != 0 {
            continue;
        }
        for operator in ["==", "!=", ">=", "<=", ">", "<", " contains "] {
            if expression[index..].starts_with(operator) {
                let left = operand(&expression[..index], ctx)?;
                let right = operand(&expression[index + operator.len()..], ctx)?;
                let ordering = match (&left, &right) {
                    (Value::Number(a), Value::Number(b)) => a
                        .as_f64()
                        .and_then(|a| b.as_f64().and_then(|b| a.partial_cmp(&b))),
                    (Value::String(a), Value::String(b)) => Some(a.cmp(b)),
                    _ => None,
                };
                use std::cmp::Ordering::{Equal, Greater, Less};
                let equal = left == right
                    || (left.is_number() && right.is_number() && ordering == Some(Equal));
                let passed = match operator {
                    "==" => equal,
                    "!=" => !equal,
                    ">" => ordering == Some(Greater),
                    "<" => ordering == Some(Less),
                    ">=" => matches!(ordering, Some(Greater | Equal)),
                    "<=" => matches!(ordering, Some(Less | Equal)),
                    _ => match (&left, &right) {
                        (Value::String(a), Value::String(b)) => a.contains(b),
                        (Value::Array(a), b) => a.contains(b),
                        _ => false,
                    },
                };
                anyhow::ensure!(passed, "Assertion failed: {expression}\n  actual: {left}\n  expected {operator}: {right}");
                return Ok(());
            }
        }
    }
    let value = operand(expression, ctx)?;
    anyhow::ensure!(
        value == Value::Bool(true),
        "Assertion failed: {expression}\n  expected true, got {value}"
    );
    Ok(())
}

async fn request(
    router: Router,
    args: &[String],
    ctx: &mut Context,
    assign_to: Option<&str>,
) -> Result<()> {
    anyhow::ensure!(
        args.len() == 1,
        "Usage: response = test-request requestVariable"
    );
    let spec = resolve_path(ctx, &args[0], None)
        .ok_or_else(|| anyhow::anyhow!("Unknown request variable {}", args[0]))?;
    anyhow::ensure!(spec.is_object(), "Request must be an object");
    let path = spec
        .get("path")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow::anyhow!("Request needs a string path"))?;
    anyhow::ensure!(
        path.starts_with('/') && !path.starts_with("//"),
        "test-request needs a local path starting with /"
    );
    let method = spec
        .get("method")
        .map(|v| {
            v.as_str()
                .ok_or_else(|| anyhow::anyhow!("Request method must be a string"))
        })
        .transpose()?
        .unwrap_or("GET");
    let mut builder = Request::builder().method(method).uri(path);
    if let Some(headers) = spec.get("headers") {
        let headers = headers
            .as_object()
            .ok_or_else(|| anyhow::anyhow!("Request headers must be an object"))?;
        for (key, value) in headers {
            builder = builder.header(
                key,
                value
                    .as_str()
                    .ok_or_else(|| anyhow::anyhow!("Header {key} must be a string"))?,
            );
        }
    }
    let body = match spec.get("body") {
        None => Body::empty(),
        Some(Value::String(text)) => Body::from(text.clone()),
        Some(value) => {
            if builder
                .headers_ref()
                .is_some_and(|h| !h.contains_key("content-type"))
            {
                builder = builder.header("content-type", "application/json");
            }
            Body::from(serde_json::to_vec(value)?)
        }
    };
    // Application handlers keep their normal runtime semantics. Strict unknown-command
    // checks and test-only builtins apply to the test script, not the app under test.
    let response = IN_REQUEST
        .scope(true, router.oneshot(builder.body(body)?))
        .await?;
    let status = response.status().as_u16();
    let headers = response
        .headers()
        .iter()
        .map(|(key, value)| {
            (
                key.to_string(),
                Value::String(value.to_str().unwrap_or("").to_string()),
            )
        })
        .collect::<serde_json::Map<_, _>>();
    let bytes = to_bytes(response.into_body(), 8 * 1024 * 1024).await?;
    let text = String::from_utf8_lossy(&bytes).to_string();
    let body =
        serde_json::from_slice::<Value>(&bytes).unwrap_or_else(|_| Value::String(text.clone()));
    let value = json!({"status":status,"body":body,"text":text,"headers":headers});
    if let Some(name) = assign_to {
        ctx.insert(name.to_string(), value.clone());
    }
    ctx.insert(LAST_EXEC_RESULT.to_string(), value);
    Ok(())
}

#[derive(Serialize)]
struct TestResult {
    name: String,
    file: Option<String>,
    passed: bool,
    assertions: usize,
    duration_ms: u128,
    error: Option<String>,
}

pub async fn run(path: &Path, doc: RuneDocument, args: &ArgMatches) -> Result<bool> {
    let filter = args.get_one::<String>("filter");
    let mut tests = doc
        .sections
        .iter()
        .filter(|s| s.path.first().map(String::as_str) == Some("Test"))
        .filter(|s| filter.is_none_or(|f| s.path[1..].join("/").contains(f)))
        .cloned()
        .collect::<Vec<_>>();
    tests.sort_by(|a, b| a.path.cmp(&b.path));
    let json_output = args.get_flag("json");
    if args.get_flag("list") {
        let names: Vec<_> = tests.iter().map(|s| s.path[1..].join("/")).collect();
        if json_output {
            println!(
                "{}",
                serde_json::to_string_pretty(&json!({"command":"test","tests":names}))?
            );
        } else {
            for name in names {
                println!("{name}");
            }
        }
        return Ok(true);
    }
    let entry = if !path.exists() && path.extension().is_none() {
        path.with_extension("rune")
    } else {
        path.to_path_buf()
    };
    let state = AppState {
        schemas: Arc::new(extract_schemas(&doc)),
        data_sources: Arc::new(extract_data_sources(&doc)),
        doc: Arc::new(doc),
        path: if entry.is_dir() {
            entry.canonicalize()?
        } else {
            entry.canonicalize()?.parent().unwrap().to_path_buf()
        },
    };
    let timeout = Duration::from_secs(*args.get_one::<u64>("timeout").unwrap());
    let mut results = Vec::new();
    for test in tests {
        let started = Instant::now();
        let assertions = Arc::new(AtomicUsize::new(0));
        let failure = Arc::new(Mutex::new(None));
        let execution = async {
            crate::builtins::builtin::memory::builtin_clear_memory(&[], &mut Context::new()).await;
            let router = crate::apps::build_app_router(state.clone()).await;
            SESSION
                .scope(
                    TestSession {
                        router,
                        assertions: assertions.clone(),
                        failure: failure.clone(),
                    },
                    async {
                        let mut context = Context::new();
                        let response = execute_steps_inner_no_fallthrough(
                            state.clone(),
                            test.series.get("run").unwrap(),
                            &mut context,
                        )
                        .await;
                        if let Some(error) = failure.lock().unwrap().clone() {
                            bail!("{error}");
                        }
                        if let Some((status, message)) = response {
                            bail!("Test stopped with response {status}: {message}");
                        }
                        anyhow::ensure!(
                            assertions.load(Ordering::Relaxed) > 0,
                            "Test ran no assertions"
                        );
                        Ok::<_, anyhow::Error>(())
                    },
                )
                .await
        };
        // Catch router construction panics as test failures, e.g. overlapping routes.
        use futures::FutureExt;
        let error = match std::panic::AssertUnwindSafe(tokio::time::timeout(timeout, execution))
            .catch_unwind()
            .await
        {
            Ok(Ok(Ok(()))) => None,
            Ok(Ok(Err(error))) => Some(error.to_string()),
            Ok(Err(_)) => Some(format!("Test exceeded {}s timeout", timeout.as_secs())),
            Err(_) => Some("Application or test panicked".into()),
        };
        crate::builtins::builtin::memory::builtin_clear_memory(&[], &mut Context::new()).await;
        let result = TestResult {
            name: test.path[1..].join("/"),
            file: test.source_file,
            passed: error.is_none(),
            assertions: assertions.load(Ordering::Relaxed),
            duration_ms: started.elapsed().as_millis(),
            error,
        };
        if !json_output {
            println!(
                "{} {} ({} assertions, {}ms)",
                if result.passed { "PASS" } else { "FAIL" },
                result.name,
                result.assertions,
                result.duration_ms
            );
            if let Some(error) = &result.error {
                println!("  {error}");
            }
        }
        results.push(result);
    }
    let passed = results.iter().filter(|r| r.passed).count();
    let success = !results.is_empty() && passed == results.len();
    if json_output {
        println!(
            "{}",
            serde_json::to_string_pretty(
                &json!({"command":"test","success":success,"passed":passed,"failed":results.len()-passed,"tests":results})
            )?
        );
    } else {
        println!(
            "{passed} passed, {} failed{}",
            results.len() - passed,
            if results.is_empty() {
                " (no matching @Test sections)"
            } else {
                ""
            }
        );
    }
    Ok(success)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn in_process_request_can_be_cancelled_without_a_listening_port() {
        let router = Router::new().route(
            "/slow",
            axum::routing::get(|| async { std::future::pending::<String>().await }),
        );
        let mut context = Context::new();
        context.insert("req".into(), json!({"path":"/slow"}));
        let result = tokio::time::timeout(
            Duration::from_millis(10),
            request(router, &["req".into()], &mut context, Some("res")),
        )
        .await;
        assert!(result.is_err());
        assert!(!context.contains_key("res"));
    }
}
