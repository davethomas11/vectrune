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

#[test]
fn fixtures_share_context_and_teardown_runs_after_failure() {
    let dir = tempfile::tempdir().unwrap();
    let entry = dir.path().join("suite.rune");
    fs::write(
        &entry,
        r#"@App
type = REST
@TestSuite
setup:
    state = { phase: "suite" }
teardown:
    cleaned = get-memory cleaned
    assert cleaned == "yes"
@TestFixture/User
setup:
    assert state.phase == "suite"
    alice = { name: "Alice" }
teardown:
    assert state.phase == "test-cleaned"
    set-memory cleaned "yes"
@Test/Failure
fixtures = [User]
setup:
    assert alice.name == "Alice"
run:
    assert false
teardown:
    state.phase = "test-cleaned"
"#,
    )
    .unwrap();
    let report = json(cli().arg("test").arg(&entry).arg("--json"), false);
    assert_eq!(report["schema_version"], 1);
    let test = &report["tests"][0];
    assert_eq!(test["assertions"], 5, "{report}");
    assert!(
        !test["error"].as_str().unwrap().contains("teardown"),
        "{report}"
    );
    assert_eq!(test["location"]["line"], 21, "{report}");
    assert_eq!(test["location"]["column"], 5);
    assert_eq!(test["location"]["source"], "    assert false");
}

#[test]
fn startup_and_teardown_failures_cannot_pass_tests() {
    let dir = tempfile::tempdir().unwrap();
    let entry = dir.path().join("suite.rune");
    fs::write(
        &entry,
        "@App\ntype = REST\nrun:\n    typoo-startup\n@Test/A\nrun:\n    assert true\n",
    )
    .unwrap();
    let report = json(cli().arg("test").arg(&entry).arg("--json"), false);
    assert!(
        report["tests"][0]["error"]
            .as_str()
            .unwrap()
            .contains("Unknown builtin"),
        "{report}"
    );
    assert_eq!(report["tests"][0]["location"]["line"], 4);
    fs::write(
        &entry,
        "@Test/A\nrun:\n    assert true\nteardown:\n    assert false\n",
    )
    .unwrap();
    let report = json(cli().arg("test").arg(&entry).arg("--json"), false);
    assert!(
        report["tests"][0]["error"]
            .as_str()
            .unwrap()
            .contains("teardown"),
        "{report}"
    );
    assert_eq!(report["tests"][0]["location"]["line"], 5);
    fs::write(
        &entry,
        "@Memory\nsource = missing.json\n@Test/A\nrun:\n    assert true\n",
    )
    .unwrap();
    let report = json(cli().arg("test").arg(&entry).arg("--json"), false);
    assert!(
        report["tests"][0]["error"]
            .as_str()
            .unwrap()
            .contains("Memory source"),
        "{report}"
    );
}

#[test]
fn linter_suggests_commands_at_the_statement_location() {
    let dir = tempfile::tempdir().unwrap();
    let entry = dir.path().join("suite.rune");
    fs::write(&entry, "@Route/GET /health\nrun:\n    repond 200 OK\n").unwrap();
    let report = json(
        cli()
            .arg("check")
            .arg(&entry)
            .args(["--deny-warnings", "--json"]),
        false,
    );
    let diagnostic = &report["diagnostics"][0];
    assert_eq!(diagnostic["code"], "unknown-command");
    assert_eq!(diagnostic["location"]["line"], 3);
    assert_eq!(diagnostic["suggestion"], "Did you mean `respond`?");
}

#[test]
fn formatting_is_idempotent_import_aware_and_preserves_opaque_blocks() {
    let dir = tempfile::tempdir().unwrap();
    let entry = dir.path().join("suite.rune");
    let imported = dir.path().join("data.rune");
    fs::write(&imported, "@Schema / User\nname=string\n").unwrap();
    let opaque = "@Component/Whitespace\nview:\n  pre:\n    code \"a  b\\n  c\"  \n@Style/main\ncss:\n  .x:\n    color = red  \n@Raw\nsource >\n    first  \n      second\n\n";
    fs::write(
        &entry,
        format!("import \"data.rune\"\n@Test / A\nrun:\n  assert true\n{opaque}"),
    )
    .unwrap();
    let before = fs::read_to_string(&entry).unwrap();
    let report = json(
        cli().arg("fmt").arg(&entry).args(["--check", "--json"]),
        false,
    );
    assert_eq!(report["schema_version"], 1);
    assert_eq!(fs::read_to_string(&entry).unwrap(), before);
    json(cli().arg("fmt").arg(&entry).arg("--json"), true);
    let formatted = fs::read_to_string(&entry).unwrap();
    assert!(
        formatted.contains("@Test/A\nrun:\n    assert true\n"),
        "{formatted}"
    );
    assert!(formatted.ends_with(opaque), "{formatted}");
    assert_eq!(
        fs::read_to_string(imported).unwrap(),
        "@Schema/User\nname = string\n"
    );
    let report = json(
        cli().arg("fmt").arg(&entry).args(["--check", "--json"]),
        true,
    );
    assert_eq!(report["changed"], serde_json::json!([]));
    let crlf = formatted.replace('\n', "\r\n");
    fs::write(&entry, &crlf).unwrap();
    json(
        cli().arg("fmt").arg(&entry).args(["--check", "--json"]),
        true,
    );
    assert_eq!(fs::read_to_string(&entry).unwrap(), crlf);
}

#[cfg(unix)]
#[test]
fn watch_recovers_from_failed_assertions_missing_imports_and_atomic_saves() {
    use std::{
        io::{BufRead, BufReader},
        process::{Command as Process, Stdio},
        sync::mpsc,
        time::Duration,
    };
    struct Guard(std::process::Child);
    impl Drop for Guard {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }
    fn next_run(receiver: &mpsc::Receiver<String>, success: bool) {
        loop {
            let line = receiver
                .recv_timeout(Duration::from_secs(15))
                .expect("watch report");
            let report: Value = serde_json::from_str(&line).expect("JSON Lines watch report");
            assert_eq!(report["schema_version"], 1);
            if report["event"] == "watching" {
                assert_eq!(report["success"], success, "{report}");
                return;
            }
        }
    }
    let dir = tempfile::tempdir().unwrap();
    let project = dir.path().join("project");
    fs::create_dir(&project).unwrap();
    let shared = dir.path().join("shared.rune");
    fs::write(&shared, "@Test/Shared\nrun:\n    assert true\n").unwrap();
    let entry = project.join("api.test.rune");
    fs::write(&entry, "import \"../shared.rune\"\n").unwrap();
    let mut child = Guard(
        Process::new(assert_cmd::cargo::cargo_bin!("vectrune"))
            .arg("test")
            .arg(&entry)
            .args(["--watch", "--json"])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .unwrap(),
    );
    let stdout = child.0.stdout.take().unwrap();
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            if tx.send(line.unwrap()).is_err() {
                break;
            }
        }
    });
    next_run(&rx, true);
    let replacement = dir.path().join("save.tmp");
    fs::write(&replacement, "@Test/Shared\nrun:\n    assert false\n").unwrap();
    fs::rename(&replacement, &shared).unwrap();
    next_run(&rx, false);
    fs::write(&entry, "import \"../new.rune\"\n").unwrap();
    next_run(&rx, false);
    fs::write(
        dir.path().join("new.rune"),
        "@Test/New\nrun:\n    assert true\n",
    )
    .unwrap();
    next_run(&rx, true);
    let status = Process::new("kill")
        .args(["-INT", &child.0.id().to_string()])
        .status()
        .unwrap();
    assert!(status.success());
    assert!(child.0.wait().unwrap().success());
}
