//! Synchronous Rune-Web tests in an isolated embedded QuickJS runtime.
use super::{
    diagnostics,
    testing::{self, TestResult},
};
use crate::{
    apps::rune_web::{jscodegen::JsCodegen, parser::parse_rune_web_frontend},
    builtins::Context,
    rune_ast::{RuneDocument, Section},
};
use anyhow::{anyhow, bail, ensure, Context as _, Result};
use rquickjs::{CaughtError, Ctx, Runtime};
use serde_json::Value;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

fn eval<T>(ctx: &Ctx<'_>, source: impl Into<Vec<u8>>) -> Result<T>
where
    for<'js> T: rquickjs::FromJs<'js>,
{
    ctx.eval(source)
        .map_err(|error| anyhow!(CaughtError::from_error(ctx, error).to_string()))
}

fn source(doc: &RuneDocument, test: &Section) -> Result<String> {
    let page_name = test
        .kv
        .get("page")
        .and_then(|v| v.as_str())
        .or_else(|| test.kv.get("logic").and_then(|v| v.as_str()))
        .context("Logic test needs page = <page name>")?;
    let frontend = parse_rune_web_frontend(doc, page_name).map_err(|e| anyhow!(e.to_string()))?;
    let page = frontend
        .page_views
        .get(page_name)
        .context("Unknown logic test page")?;
    let logic_name = test
        .kv
        .get("logic")
        .and_then(|v| v.as_str())
        .or(page.logic_ref.as_deref())
        .context("Page has no @Logic reference")?;
    let logic = frontend
        .logic_definitions
        .get(logic_name)
        .context("Unknown @Logic reference")?
        .clone();
    ensure!(
        logic.timer.is_none(),
        "Automatic timers are not supported by the logic prototype yet"
    );
    let mut script = JsCodegen::new(
        page.view_tree.clone(),
        logic,
        "{}".into(),
        None,
        HashMap::new(),
        None,
        None,
        None,
        frontend.sounds,
        frontend.music,
    )
    .generate_logic_test();

    // If testing a pixel-3d scene or document with @Map, inject spatial map for slide() collision
    let scene_map = doc
        .sections
        .iter()
        .find(|s| s.path.first().map(String::as_str) == Some("Scene") && s.path.get(1) == Some(&page_name.to_string()))
        .and_then(|s| s.kv.get("map"))
        .and_then(|v| v.as_str());

    let target_map = scene_map.or_else(|| {
        doc.sections
            .iter()
            .find(|s| s.path.first().map(String::as_str) == Some("Map"))
            .and_then(|s| s.path.get(1).map(String::as_str))
    });

    if let Some(map_name) = target_map {
        if let Some(map_section) = doc.sections.iter().find(|s| s.path == ["Map", map_name]) {
            if let Ok(map_json) = crate::apps::pixel3d::parse_map_simple(map_section) {
                script.push_str(&format!("\nglobalThis.__RuneSpatialMap = {};\n", map_json));
            }
        }
    }

    Ok(script)
}

fn phase(ctx: &Ctx<'_>, test: &Section, key: &str, result: &mut TestResult) -> Result<()> {
    for step in test.series.get(key).into_iter().flatten() {
        let step = step
            .as_str()
            .context("Logic test steps must be strings")?
            .trim();
        result.location = diagnostics::locate(
            test.source_file.as_deref(),
            &test.path.join("/"),
            Some(step),
        );
        if let Some(expression) = step.strip_prefix("assert ") {
            let snapshot: String = eval(ctx, "__RuneWeb.snapshot()")?;
            let snapshot: HashMap<String, Value> = serde_json::from_str(&snapshot)?;
            let context: Context = snapshot.into_iter().collect();
            if key == "run" {
                result.assertions += 1;
            }
            testing::assertion(expression, &context)?;
        } else if let Some(call) = step.strip_prefix("invoke ") {
            let (name, arguments) = call.split_once(char::is_whitespace).unwrap_or((call, ""));
            ensure!(!name.is_empty(), "invoke needs an action name");
            let args = if arguments.trim().is_empty() {
                Vec::new()
            } else {
                let value: Value = serde_json::from_str(arguments)
                    .context("invoke arguments must be a JSON value or array of arguments")?;
                match value {
                    Value::Array(values) => values,
                    value => vec![value],
                }
            };
            eval::<()>(
                ctx,
                format!(
                    "__RuneWeb.invoke({}, {})",
                    serde_json::to_string(name)?,
                    serde_json::to_string(&args)?
                ),
            )?;
        } else {
            bail!("Unsupported logic test step: {step}; expected invoke or assert");
        }
    }
    Ok(())
}

pub(super) fn run(doc: &RuneDocument, test: &Section, timeout: Duration) -> TestResult {
    let started = Instant::now();
    let mut result = TestResult {
        name: test.path[1..].join("/"),
        file: test.source_file.clone(),
        passed: false,
        assertions: 0,
        duration_ms: 0,
        error: None,
        location: None,
    };
    let execution = (|| -> Result<()> {
        ensure!(testing::fixture_names(test)?.is_empty(), "Shared fixtures are not supported by the logic prototype; use setup:/teardown: on the test");
        ensure!(
            !doc.sections
                .iter()
                .any(|s| s.path.first().map(String::as_str) == Some("TestSuite")
                    && testing::test_type(s) == "logic"),
            "Logic @TestSuite hooks are not supported by the prototype"
        );
        let source = source(doc, test)?;
        let runtime = Runtime::new().map_err(|e| anyhow!(e.to_string()))?;
        runtime.set_memory_limit(64 * 1024 * 1024);
        runtime.set_max_stack_size(512 * 1024);
        let deadline = Arc::new(Mutex::new(started + timeout));
        let interrupt_deadline = deadline.clone();
        runtime.set_interrupt_handler(Some(Box::new(move || {
            Instant::now() >= *interrupt_deadline.lock().unwrap()
        })));
        let context = rquickjs::Context::full(&runtime).map_err(|e| anyhow!(e.to_string()))?;
        context.with(|ctx| -> Result<()> {
            eval::<()>(&ctx, source)?;
            let mut errors = Vec::new();
            let main = phase(&ctx, test, "setup", &mut result)
                .and_then(|_| phase(&ctx, test, "run", &mut result))
                .and_then(|_| {
                    ensure!(
                        result.assertions > 0,
                        "Test run: must execute at least one assertion"
                    );
                    Ok(())
                });
            if let Err(error) = main {
                errors.push(if Instant::now() >= *deadline.lock().unwrap() {
                    "Logic test exceeded its timeout (QuickJS interrupted execution)".to_string()
                } else {
                    error.to_string()
                });
            }
            // Cleanup gets a fresh bounded budget even after an assertion or action fails.
            *deadline.lock().unwrap() = Instant::now() + timeout;
            let main_location = result.location.clone();
            if let Err(error) = phase(&ctx, test, "teardown", &mut result) {
                errors.push(format!("Teardown: {error}"));
            }
            if !errors.is_empty() {
                result.location = main_location;
            }
            ensure!(errors.is_empty(), "{}", errors.join("\n"));
            Ok(())
        })?;
        ensure!(
            !runtime.is_job_pending(),
            "Asynchronous jobs are not supported by the synchronous logic prototype"
        );
        Ok(())
    })();
    result.error = execution.err().map(|e| e.to_string());
    result.passed = result.error.is_none();
    result.duration_ms = started.elapsed().as_millis();
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interrupts_runaway_javascript() {
        let runtime = Runtime::new().unwrap();
        let deadline = Instant::now() + Duration::from_millis(25);
        runtime.set_interrupt_handler(Some(Box::new(move || Instant::now() >= deadline)));
        let context = rquickjs::Context::full(&runtime).unwrap();
        context.with(|ctx| {
            assert!(eval::<()>(&ctx, "while (true) {}")
                .unwrap_err()
                .to_string()
                .contains("interrupt"))
        });
        assert!(deadline.elapsed() < Duration::from_secs(2));
    }
}
