use serde_json::Value;
use std::fs;

const APP: &str = r#"@Page/demo
logic = demo
view:
    main "Demo"
@Logic/demo
state:
    count = 1
action increment(delta):
    count += delta
action save:
    storage.set("count", count)
action spin:
    delay 5000ms
"#;

fn run(tests: &str, engine: &str, success: bool) -> Value {
    let options = if engine.is_empty() {
        vec![]
    } else {
        vec!["--type", engine]
    };
    run_options(tests, &options, success)
}

fn run_options(tests: &str, options: &[&str], success: bool) -> Value {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("logic.test.rune");
    fs::write(&path, format!("{APP}\n{tests}")).unwrap();
    let mut command = assert_cmd::cargo::cargo_bin_cmd!("vectrune");
    command.args(["test", path.to_str().unwrap(), "--timeout", "1", "--json"]);
    command.args(options);
    let output = command.output().unwrap();
    assert_eq!(
        output.status.success(),
        success,
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&output.stdout).expect("single JSON report")
}

#[test]
fn default_command_runs_both_engines_and_resets_state_and_storage() {
    let report = run(
        r#"
@Test/A
type = logic
page = demo
setup:
    invoke increment 2
run:
    assert state.count == 3
    invoke save
    assert mock.storage.count == 3
teardown:
    invoke increment 1
    assert state.count == 4
@Test/B
type = logic
page = demo
run:
    assert state.count == 1
    assert mock.storage == {}
@Test/Native
run:
    assert true
"#,
        "",
        true,
    );
    assert_eq!(report["passed"], 3);
    assert_eq!(report["tests"][0]["assertions"], 2);
}

#[test]
fn reports_assertions_unknown_actions_steps_and_cleanup_failures() {
    let report = run(
        r#"
@Test/Assertion
type = logic
page = demo
run:
    assert state.count == 99
teardown:
    assert state.count == 50
@Test/UnknownAction
type = logic
page = demo
run:
    invoke typo
    assert true
@Test/UnknownStep
type = logic
page = demo
run:
    typoo
    assert true
@Test/NoAssertion
type = logic
page = demo
setup:
    assert true
run:
    invoke increment 2
"#,
        "logic",
        false,
    );
    assert_eq!(report["failed"], 4);
    let tests = report["tests"].as_array().unwrap();
    for (name, error) in [
        ("Assertion", "Teardown:"),
        ("UnknownAction", "Unknown Rune-Web action: typo"),
        ("UnknownStep", "Unsupported logic test step"),
        ("NoAssertion", "at least one assertion"),
    ] {
        let test = tests.iter().find(|test| test["name"] == name).unwrap();
        assert!(test["error"].as_str().unwrap().contains(error), "{test}");
        assert!(test["location"]["line"].is_number());
    }
}

#[test]
fn interrupts_blocking_javascript_and_runs_the_next_test() {
    let report = run(
        r#"
@Test/A_Timeout
type = logic
page = demo
run:
    invoke spin
    assert true
teardown:
    invoke increment 1
    assert state.count == 2
@Test/B_Next
type = logic
page = demo
run:
    assert state.count == 1
"#,
        "logic",
        false,
    );
    assert_eq!(report["passed"], 1);
    assert_eq!(report["failed"], 1);
    assert!(report["tests"][0]["error"]
        .as_str()
        .unwrap()
        .contains("timeout"));
    assert!(!report["tests"][0]["error"]
        .as_str()
        .unwrap()
        .contains("Teardown"));
    assert!(report["tests"][0]["duration_ms"].as_u64().unwrap() < 4000);
}

#[test]
fn rejects_unsupported_engine_instead_of_running_it_as_native() {
    let report = run(
        "@Test/JS\ntype = browser\nrun:\n    assert true\n",
        "all",
        false,
    );
    assert!(report["diagnostics"]
        .as_array()
        .unwrap()
        .iter()
        .any(|d| d["code"] == "test-type"));
}

#[test]
fn engine_selection_listing_and_name_filters_work_together() {
    let tests = r#"
@Test/JS
type = logic
page = demo
run:
    invoke increment 1
    assert state.count == 2
@Test/HTTP
run:
    assert true
"#;
    for engine in ["native", "logic"] {
        let report = run(tests, engine, true);
        assert_eq!(report["passed"], 1);
        assert_eq!(
            report["tests"][0]["name"],
            if engine == "native" { "HTTP" } else { "JS" }
        );
    }
    let report = run_options(tests, &["--list"], true);
    assert_eq!(report["tests"], serde_json::json!(["HTTP", "JS"]));
    let report = run_options(
        tests,
        &["--list", "--type", "logic", "--filter", "JS"],
        true,
    );
    assert_eq!(report["tests"], serde_json::json!(["JS"]));
    let report = run_options(tests, &["--filter", "JS"], true);
    assert_eq!(report["passed"], 1);
    assert_eq!(report["tests"][0]["name"], "JS");
}
