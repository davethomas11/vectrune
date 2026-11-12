use assert_cmd::Command;
use serde_json::Value;
use std::fs;

fn cli() -> Command {
    assert_cmd::cargo::cargo_bin_cmd!("vectrune")
}
fn json(command: &mut Command, success: bool) -> Value {
    let output = command.output().unwrap();
    assert_eq!(
        output.status.success(),
        success,
        "stdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    serde_json::from_slice(&output.stdout).expect("stdout must be a single JSON document")
}

const APP: &str = r#"@App
name = Test API
type = REST
@Route/POST /echo
run:
    data = parse-json body
    respond 201 data
@Route/GET /text
run:
    respond 200 "héllo, world"
@Route/GET /legacy
run:
    unknown-legacy-command
    respond 200 "OK"
"#;

#[test]
fn tests_real_routes_nested_objects_and_strict_assertions() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("app.rune"), APP).unwrap();
    let suite = dir.path().join("suite.rune");
    fs::write(&suite, r#"import "app.rune"
@Test/echo
run:
    req = { method: "POST", path: "/echo", headers: { "x-numeric": "123" }, body: { name: "Alice, = <3", role: "admin", tags: ["a", "b"], code: "007" } }
    res = test-request req
    assert res.status == 201
    assert res.body.name == "Alice, = <3"
    assert res.body.tags[0] == "a"
    assert res.body.role contains "min"
    assert res.body.code == "007"
@Test/text
run:
    req = { path: "/text" }
    res = test-request req
    assert res.status >= 200
    assert res.text == "héllo, world"
    assert res.headers["content-type"] contains "text/plain"
    legacy = { path: "/legacy" }
    legacyRes = test-request legacy
    assert legacyRes.status == 200
@Test/missing
run:
    assert missing == alsoMissing
@Test/failure
run:
    assert 1 == 2
@Test/unknown
run:
    typoo-command
    assert true
@Test/empty_assertions
run:
    value = 3
"#).unwrap();
    let report = json(
        cli()
            .args(["test"])
            .arg(&suite)
            .args(["--filter", "echo", "--json"]),
        true,
    );
    assert_eq!(report["passed"], 1);
    assert_eq!(report["tests"][0]["assertions"], 5);
    let report = json(
        cli()
            .arg("test")
            .arg(&suite)
            .args(["--filter", "text", "--json"]),
        true,
    );
    assert_eq!(report["tests"][0]["assertions"], 4);
    let report = json(
        cli()
            .args(["--log-level", "info", "test"])
            .arg(&suite)
            .arg("--json"),
        false,
    );
    assert_eq!(report["passed"], 2);
    assert_eq!(report["failed"], 4);
    let errors = report["tests"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|t| t["error"].as_str())
        .collect::<Vec<_>>()
        .join("\n");
    assert!(errors.contains("Unresolved assertion operand"), "{errors}");
    assert!(errors.contains("actual: 1"), "{errors}");
    assert!(errors.contains("no assertions"), "{errors}");
    assert!(
        errors.contains("Unknown builtin: typoo-command"),
        "{errors}"
    );
}

#[test]
fn discovery_imports_and_read_only_listing() {
    let dir = tempfile::tempdir().unwrap();
    fs::create_dir(dir.path().join("node_modules")).unwrap();
    fs::write(
        dir.path().join("node_modules/broken.rune"),
        "import \"absent\"",
    )
    .unwrap();
    fs::write(dir.path().join("app.rune"), APP).unwrap();
    fs::write(
        dir.path().join("suite.rune"),
        "import \"app.rune\"\n@Test/example\nrun:\n    assert true\n",
    )
    .unwrap();
    let report = json(
        cli().arg("test").arg(dir.path()).args(["--list", "--json"]),
        true,
    );
    assert_eq!(report["tests"], serde_json::json!(["example"]));
    json(cli().arg("test").arg(dir.path()).arg("--json"), true);
    json(cli().current_dir(dir.path()).args(["test", "--json"]), true);
    json(cli().arg("check").arg(dir.path()).arg("--json"), true);
    // List and check do not execute startup; doctor likewise only inspects the project.
    fs::write(
        dir.path().join("startup.rune"),
        "@App\nrun:\n    csv.write should-not-exist.csv []\n",
    )
    .unwrap();
    json(
        cli().arg("test").arg(dir.path()).args(["--list", "--json"]),
        true,
    );
    json(cli().arg("doctor").arg(dir.path()).arg("--json"), true);
    assert!(!dir.path().join("should-not-exist.csv").exists());
}

#[test]
fn check_reports_missing_imports_references_and_unsupported_routes() {
    let dir = tempfile::tempdir().unwrap();
    let entry = dir.path().join("app.rune");
    fs::write(&entry, "import \"missing.rune\"").unwrap();
    let report = json(cli().arg("check").arg(&entry).arg("--json"), false);
    assert_eq!(report["diagnostics"][0]["code"], "load");
    fs::write(&entry, "@Route/PATCH /users/{id}\nauth = missing\nrun:\n    validate body #Unknown\n@Route/GET /users/{id}\n@Route/GET /users/{name}\n").unwrap();
    let report = json(cli().arg("check").arg(&entry).arg("--json"), false);
    let codes = report["diagnostics"]
        .as_array()
        .unwrap()
        .iter()
        .map(|d| d["code"].as_str().unwrap())
        .collect::<Vec<_>>();
    for code in [
        "route-method",
        "auth-reference",
        "schema-reference",
        "route-conflict",
    ] {
        assert!(codes.contains(&code), "{codes:?}");
    }
    json(cli().arg("doctor").arg(&entry).arg("--json"), false);
}

#[test]
fn failure_does_not_leak_memory_and_no_matches_is_a_failure() {
    let dir = tempfile::tempdir().unwrap();
    let entry = dir.path().join("app.rune");
    fs::write(
        &entry,
        r#"@App
type = REST
@Memory
value = "initial"
@Route/GET /value
run:
    result = get-memory value
    respond 200 result
@Test/a_mutates
run:
    set-memory value "changed"
    assert false
@Test/b_clean
run:
    req = { path: "/value" }
    res = test-request req
    assert res.body == "initial"
"#,
    )
    .unwrap();
    let report = json(cli().arg("test").arg(&entry).arg("--json"), false);
    assert_eq!(report["passed"], 1, "{report}");
    assert_eq!(report["tests"][1]["passed"], true, "{report}");
    let report = json(
        cli()
            .arg("test")
            .arg(&entry)
            .args(["--filter", "nonexistent", "--json"]),
        false,
    );
    assert_eq!(report["tests"], serde_json::json!([]));
}

#[test]
fn frontend_props_and_schema_warnings_are_linted() {
    let dir = tempfile::tempdir().unwrap();
    let entry = dir.path().join("app.rune");
    fs::write(&entry, "@Schema/User\nname = strng\n").unwrap();
    let report = json(cli().arg("check").arg(&entry).arg("--json"), true);
    assert_eq!(report["diagnostics"][0]["severity"], "warning");
    json(
        cli()
            .arg("check")
            .arg(&entry)
            .args(["--deny-warnings", "--json"]),
        false,
    );
    fs::write(
        &entry,
        r#"@Frontend
type = rune-web
page = home
@Component/Alert
props: [message]
view:
    p "{message}"
@Page/home
view:
    Alert
"#,
    )
    .unwrap();
    let report = json(cli().arg("check").arg(&entry).arg("--json"), false);
    assert_eq!(report["diagnostics"][0]["code"], "frontend");
    assert!(report["diagnostics"][0]["message"]
        .as_str()
        .unwrap()
        .contains("message"));
}

#[test]
fn doctor_reports_the_running_binary_and_invalid_tests_fail_preflight() {
    let dir = tempfile::tempdir().unwrap();
    let entry = dir.path().join("app.rune");
    fs::write(&entry, APP).unwrap();
    let report = json(cli().arg("doctor").arg(&entry).arg("--json"), true);
    assert!(report["executable"].as_str().unwrap().contains("vectrune"));
    assert_eq!(report["version"], env!("CARGO_PKG_VERSION"));
    let report = json(cli().arg("test").arg(&entry).arg("--json"), false);
    assert_eq!(report["tests"], serde_json::json!([]));
    fs::write(&entry, "@Test\nrun:\n    assert true\n").unwrap();
    let report = json(cli().arg("test").arg(&entry).arg("--json"), false);
    assert_eq!(report["command"], "test");
    assert_eq!(report["diagnostics"][0]["code"], "test-name");
}
