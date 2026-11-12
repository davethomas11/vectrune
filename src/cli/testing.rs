//! Rune test support. Task-local routing keeps test-request unavailable in normal applications.
use crate::{
    builtins::{BuiltinResult, Context, LAST_EXEC_RESULT},
    core::{
        execute_steps_inner_no_fallthrough, extract_data_sources, extract_schemas, resolve_path,
        AppState,
    },
    rune_ast::{RuneDocument, Section},
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
tokio::task_local! { static TRACE_SOURCE: (Option<String>, String); }
tokio::task_local! { static STARTUP: bool; }
struct TestSession {
    router: Router,
    assertions: Arc<AtomicUsize>,
    failure: Arc<Mutex<Option<String>>>,
    location: Arc<Mutex<Option<super::diagnostics::SourceLocation>>>,
}

pub fn is_active() -> bool {
    SESSION.try_with(|_| ()).is_ok() && !IN_REQUEST.try_with(|active| *active).unwrap_or(false)
}

pub fn strict_commands() -> bool {
    is_active() || STARTUP.try_with(|active| *active).unwrap_or(false)
}

pub fn trace_step(step: &str) {
    if !is_active() {
        return;
    }
    let _ = TRACE_SOURCE.try_with(|(file, section)| {
        if let Some(location) = super::diagnostics::locate(file.as_deref(), section, Some(step)) {
            let _ = SESSION.try_with(|session| *session.location.lock().unwrap() = Some(location));
        }
    });
}

pub fn record_error(message: &str) {
    if is_active() {
        let _ = SESSION.try_with(|session| {
            session
                .failure
                .lock()
                .unwrap()
                .get_or_insert_with(|| message.to_string());
        });
    }
}

async fn phase(
    state: &AppState,
    section: &Section,
    key: &str,
    context: &mut Context,
) -> Result<()> {
    let Some(steps) = section.series.get(key) else {
        return Ok(());
    };
    let response = TRACE_SOURCE
        .scope(
            (section.source_file.clone(), section.path.join("/")),
            execute_steps_inner_no_fallthrough(state.clone(), steps, context),
        )
        .await;
    if let Some(error) = SESSION.with(|session| session.failure.lock().unwrap().take()) {
        bail!("{error}");
    }
    if let Some((status, _)) = &response {
        if section.path.first().map(String::as_str) == Some("App") && *status < 400 {
            return Ok(());
        }
    }
    if let Some((status, message)) = response {
        bail!(
            "{} {key} stopped with response {status}: {message}",
            section.path.join("/")
        );
    }
    Ok(())
}

fn outcome(
    result: std::result::Result<
        std::result::Result<Result<()>, tokio::time::error::Elapsed>,
        Box<dyn std::any::Any + Send>,
    >,
) -> Option<String> {
    match result {
        Ok(Ok(Ok(()))) => None,
        Ok(Ok(Err(error))) => Some(error.to_string()),
        Ok(Err(_)) => Some("Test exceeded its timeout".into()),
        Err(payload) => {
            let message = payload
                .downcast_ref::<String>()
                .map(String::as_str)
                .or_else(|| payload.downcast_ref::<&str>().copied())
                .unwrap_or("unknown panic");
            Some(format!("Application or test panicked: {message}"))
        }
    }
}

pub async fn call(
    name: &str,
    args: &[String],
    ctx: &mut Context,
    assign_to: Option<&str>,
) -> BuiltinResult {
    if !is_active() || STARTUP.try_with(|active| *active).unwrap_or(false) {
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

pub(super) fn assertion(expression: &str, ctx: &Context) -> Result<()> {
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
pub(super) struct TestResult {
    pub(super) name: String,
    pub(super) file: Option<String>,
    pub(super) passed: bool,
    pub(super) assertions: usize,
    pub(super) duration_ms: u128,
    pub(super) error: Option<String>,
    pub(super) location: Option<super::diagnostics::SourceLocation>,
}

pub async fn run(path: &Path, doc: RuneDocument, args: &ArgMatches) -> Result<bool> {
    let filter = args.get_one::<String>("filter");
    let engine = args
        .get_one::<String>("type")
        .map(String::as_str)
        .unwrap_or("all");
    let mut tests = doc
        .sections
        .iter()
        .filter(|s| s.path.first().map(String::as_str) == Some("Test"))
        .filter(|s| engine == "all" || test_type(s) == engine)
        .filter(|s| filter.is_none_or(|f| s.path[1..].join("/").contains(f)))
        .cloned()
        .collect::<Vec<_>>();
    tests.sort_by(|a, b| a.path.cmp(&b.path));
    let json_output = args.get_flag("json");
    if args.get_flag("list") {
        let names: Vec<_> = tests.iter().map(|s| s.path[1..].join("/")).collect();
        if json_output {
            super::diagnostics::emit(
                json!({"command":"test","success":true,"listed":true,"tests":names}),
            )?;
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
        if test_type(&test) == "logic" {
            let result = {
                let doc = state.doc.clone();
                let test = test.clone();
                tokio::task::spawn_blocking(move || super::logic_testing::run(&doc, &test, timeout))
                    .await?
            };
            report_result(&result, json_output);
            results.push(result);
            continue;
        }
        let assertions = Arc::new(AtomicUsize::new(0));
        let failure = Arc::new(Mutex::new(None));
        let location = Arc::new(Mutex::new(None));
        use futures::FutureExt;
        let mut test_assertions = 0;
        let execution = async {
            crate::builtins::builtin::memory::builtin_clear_memory(&[], &mut Context::new()).await;
            validate_memory_sources(&state)?;
            // Run startup explicitly so an ignored HTTP-style startup error cannot pass a test.
            let mut construction_doc = (*state.doc).clone();
            for section in &mut construction_doc.sections {
                if section.path.first().map(String::as_str) == Some("App") {
                    section.series.remove("run");
                }
            }
            let mut construction_state = state.clone();
            construction_state.doc = Arc::new(construction_doc);
            let router =
                tokio::time::timeout(timeout, crate::apps::build_app_router(construction_state))
                    .await
                    .map_err(|_| anyhow::anyhow!("Application startup exceeded its timeout"))?;
            SESSION
                .scope(
                    TestSession {
                        router,
                        assertions: assertions.clone(),
                        failure: failure.clone(),
                        location: location.clone(),
                    },
                    async {
                        let mut context = Context::new();
                        let mut cleanup: Vec<Section> = Vec::new();
                        let main = async {
                            if crate::core::get_app_type(&state.doc)
                                .is_none_or(|kind| kind.eq_ignore_ascii_case("REST"))
                            {
                                if let Some(app) = state
                                    .doc
                                    .sections
                                    .iter()
                                    .find(|s| s.path.first().map(String::as_str) == Some("App"))
                                {
                                    STARTUP
                                        .scope(true, phase(&state, app, "run", &mut Context::new()))
                                        .await?;
                                }
                            }
                            if let Some(suite) = state
                                .doc
                                .sections
                                .iter()
                                .find(|s| s.path == ["TestSuite"] && test_type(s) == "native")
                            {
                                cleanup.push(suite.clone());
                                phase(&state, suite, "setup", &mut context).await?;
                            }
                            for name in fixture_names(&test)? {
                                let fixture = state
                                    .doc
                                    .sections
                                    .iter()
                                    .find(|s| s.path == ["TestFixture", &name])
                                    .ok_or_else(|| {
                                        anyhow::anyhow!("Unknown @TestFixture/{name}")
                                    })?;
                                anyhow::ensure!(
                                    test_type(fixture) == "native",
                                    "Native tests require native fixtures"
                                );
                                cleanup.push(fixture.clone());
                                phase(&state, fixture, "setup", &mut context).await?;
                            }
                            cleanup.push(test.clone());
                            phase(&state, &test, "setup", &mut context).await?;
                            let before = assertions.load(Ordering::Relaxed);
                            let result = phase(&state, &test, "run", &mut context).await;
                            test_assertions = assertions.load(Ordering::Relaxed) - before;
                            result?;
                            anyhow::ensure!(test_assertions > 0, "Test ran no assertions");
                            Ok::<_, anyhow::Error>(())
                        };
                        let remaining = timeout.saturating_sub(started.elapsed());
                        let mut errors = Vec::new();
                        if let Some(error) = outcome(
                            std::panic::AssertUnwindSafe(tokio::time::timeout(remaining, main))
                                .catch_unwind()
                                .await,
                        ) {
                            errors.push(error);
                        }
                        let primary_location = if errors.is_empty() {
                            None
                        } else {
                            location.lock().unwrap().clone()
                        };
                        // Cleanup gets a separate bounded budget and runs after assertion/setup failure or timeout.
                        let teardown = async {
                            for section in cleanup.iter().rev() {
                                let result = std::panic::AssertUnwindSafe(phase(
                                    &state,
                                    section,
                                    "teardown",
                                    &mut context,
                                ))
                                .catch_unwind()
                                .await;
                                match result {
                                    Ok(Err(error)) => errors.push(format!("teardown: {error}")),
                                    Err(_) => errors.push("teardown panicked".into()),
                                    _ => {}
                                }
                            }
                        };
                        if tokio::time::timeout(timeout, teardown).await.is_err() {
                            errors.push("Teardown exceeded its timeout".into());
                        }
                        if !errors.is_empty() {
                            if primary_location.is_some() {
                                *location.lock().unwrap() = primary_location;
                            }
                            bail!("{}", errors.join("\n"));
                        }
                        Ok(())
                    },
                )
                .await
        };
        // Include construction in the timeout, while allowing bounded cleanup after execution.
        let error = outcome(
            std::panic::AssertUnwindSafe(tokio::time::timeout(
                timeout.saturating_mul(3),
                execution,
            ))
            .catch_unwind()
            .await,
        );
        let _ = std::panic::AssertUnwindSafe(
            crate::builtins::builtin::memory::builtin_clear_memory(&[], &mut Context::new()),
        )
        .catch_unwind()
        .await;
        let result = TestResult {
            name: test.path[1..].join("/"),
            file: test.source_file,
            passed: error.is_none(),
            assertions: assertions.load(Ordering::Relaxed),
            duration_ms: started.elapsed().as_millis(),
            error,
            location: location.lock().unwrap().clone(),
        };
        report_result(&result, json_output);
        results.push(result);
    }
    let passed = results.iter().filter(|r| r.passed).count();
    let success = !results.is_empty() && passed == results.len();
    if json_output {
        super::diagnostics::emit(
            json!({"command":"test","success":success,"passed":passed,"failed":results.len()-passed,"tests":results}),
        )?;
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

pub fn fixture_names(test: &Section) -> Result<Vec<String>> {
    let names = match test.kv.get("fixtures") {
        None => Vec::new(),
        Some(crate::rune_ast::Value::List(names)) => names
            .iter()
            .map(|name| {
                name.as_str()
                    .map(str::to_string)
                    .ok_or_else(|| anyhow::anyhow!("fixtures must contain names"))
            })
            .collect::<Result<Vec<_>>>()?,
        Some(crate::rune_ast::Value::String(list))
            if list.starts_with('[') && list.ends_with(']') =>
        {
            let inner = list[1..list.len() - 1].trim();
            if inner.is_empty() {
                Vec::new()
            } else {
                inner
                    .split(',')
                    .map(|name| name.trim().trim_matches('"').to_string())
                    .collect()
            }
        }
        _ => bail!("fixtures must be a list, e.g. fixtures = [User]"),
    };
    let mut unique = std::collections::HashSet::new();
    for name in &names {
        anyhow::ensure!(
            !name.is_empty()
                && name
                    .chars()
                    .all(|ch| ch.is_alphanumeric() || matches!(ch, '_' | '-' | '/')),
            "Invalid fixture name {name:?}"
        );
        anyhow::ensure!(unique.insert(name), "Duplicate fixture {name}");
    }
    Ok(names)
}

fn validate_memory_sources(state: &AppState) -> Result<()> {
    for section in &state.doc.sections {
        if section.path.first().map(String::as_str) != Some("Memory") {
            continue;
        }
        if let Some(source) = section.kv.get("source").and_then(|v| v.as_str()) {
            if source.ends_with(".json") {
                let path = if Path::new(source).exists() {
                    source.into()
                } else {
                    state.path.join(source)
                };
                let data: Value = serde_json::from_slice(
                    &std::fs::read(&path)
                        .map_err(|e| anyhow::anyhow!("Memory source {}: {e}", path.display()))?,
                )?;
                anyhow::ensure!(
                    data.is_object(),
                    "Memory source {} must be a JSON object",
                    path.display()
                );
            }
        }
    }
    Ok(())
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

pub(super) fn test_type(section: &Section) -> &str {
    section
        .kv
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("native")
}

fn report_result(result: &TestResult, json_output: bool) {
    if !json_output {
        println!(
            "{} {} ({} assertions, {}ms)",
            if result.passed { "PASS" } else { "FAIL" },
            result.name,
            result.assertions,
            result.duration_ms
        );
        if let Some(location) = &result.location {
            if !result.passed {
                println!("{}", super::diagnostics::render(location));
            }
        }
        if let Some(error) = &result.error {
            println!("  {error}");
        }
    }
}
