use rune_runtime::rune_parser::parse_rune;
use std::fs;

const SINGLE: &str = r#"@Logic/demo
state:
    counter = 2
    status = "ready"
    result = 0
action update:
    result = counter > 1 ? 5 : 0
    if counter == 2 || status == "ready":
        result = counter > 1 ? 22 : 0
    counter = 3
action reset:
    counter = 0
    status = "disabled"
"#;

const MULTILINE: &str = r#"@Logic/demo
state:
    counter =
        2
    status = "ready"
    result = 0
action update:
    result = counter > 1
        ? 5
        : 0
    if counter == 2
        || status == "ready":
        result =
            counter > 1
            ? 22
            : 0
    counter = 3
action reset:
    counter = 0
    status = "disabled"
"#;

const TRAILING: &str = r#"@Logic/demo
state:
    counter =
        2
    status = "ready"
    result = 0
action update:
    result = counter > 1 ?
        5 :
        0
    if counter == 2 ||
        status == "ready":
        result = counter > 1 ?
            22 :
            0
    counter = 3
action reset:
    counter = 0
    status = "disabled"
"#;

#[test]
fn indented_continuations_remain_single_statements_and_blocks() {
    let before = parse_rune(SINGLE).unwrap();
    let after = parse_rune(MULTILINE).unwrap();
    assert_eq!(before.to_json(), after.to_json());
    assert_eq!(before.to_json(), parse_rune(TRAILING).unwrap().to_json());
}

#[test]
fn incomplete_assignments_and_conditions_report_missing_indentation() {
    for source in [
        "@Logic/demo\naction update:\n    x =\n    y = 2\n",
        "@Logic/demo\naction update:\n    if x ||\n    y:\n        x = 1\n",
        "@Logic/demo\naction update:\n    x =\n",
        "@Logic/demo\naction update:\n    x = true\n    ? 1\n    : 2\n",
        "@Logic/demo\naction update:\n    x = true\n        ? 1\n    y = 2\n",
        "@Logic/demo\naction update:\n    x = true ? 1 :\n    y = 2\n",
        "@Logic/demo\naction update:\n    x =\n        # comment\n        1\n",
    ] {
        let error = parse_rune(source).unwrap_err().to_string();
        assert!(error.contains("Expected an indented"), "{error}");
    }
}

#[test]
fn check_reports_continuation_source_and_original_line_after_imports() {
    let dir = tempfile::tempdir().unwrap();
    let entry = dir.path().join("entry.rune");
    let imported = dir.path().join("bad.rune");
    fs::write(&entry, "import \"bad.rune\"\n@App\ntype = REST\n").unwrap();
    fs::write(
        &imported,
        "import \"empty.rune\"\n@Logic/demo\naction update:\n    x =\n    y = 2\n",
    )
    .unwrap();
    fs::write(dir.path().join("empty.rune"), "# empty\n").unwrap();
    let output = assert_cmd::cargo::cargo_bin_cmd!("vectrune")
        .args(["check", entry.to_str().unwrap(), "--json"])
        .output()
        .unwrap();
    assert!(!output.status.success());
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    let message = report["diagnostics"][0]["message"].as_str().unwrap();
    assert!(message.contains("bad.rune"), "{message}");
    assert!(message.contains("line 4"), "{message}");
    assert!(message.contains("indented continuation"), "{message}");
    let output = assert_cmd::cargo::cargo_bin_cmd!("vectrune")
        .args(["fmt", entry.to_str().unwrap(), "--check", "--json"])
        .output()
        .unwrap();
    assert!(!output.status.success());
    let report: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert!(report["error"].as_str().unwrap().contains("line 4"));
}

#[test]
fn raw_multiline_content_is_not_interpreted_as_logic() {
    let source = "@Logic/demo\nstate:\n    x = 1\nsource >\n    x =\n    y\n\n";
    let doc = parse_rune(source).unwrap().to_json();
    assert_eq!(doc["Logic"]["demo"]["source"], "x =\ny");
}

#[test]
fn nested_conditions_and_quoted_operators_do_not_change_structure() {
    let single = r#"@Logic/demo
action update:
    label = flag ? "a ? : ||" : "b }"
    if flag && (other || last):
        if second || third:
            label = "inside"
        label = "after"
    label = "outside"
"#;
    let wrapped = r#"@Logic/demo
action update:
    label = flag
        ? "a ? : ||"
        : "b }"
    if flag
        && (other || last):
        if second
            || third:
            label = "inside"
        label = "after"
    label = "outside"
"#;
    assert_eq!(
        parse_rune(single).unwrap().to_json(),
        parse_rune(wrapped).unwrap().to_json()
    );
}

#[test]
fn operators_can_begin_or_end_a_continuation_line() {
    let single = r#"@Logic/demo
action update:
    value = ready ? 10 : 20
    if one || two && three:
        value = 30
    if ready ? one : two:
        value = 40
"#;
    let trailing = r#"@Logic/demo
action update:
    value = ready ?
        10 :
        20
    if one ||
        two &&
        three:
        value = 30
    if ready ?
        one :
        two:
        value = 40
"#;
    assert_eq!(
        parse_rune(single).unwrap().to_json(),
        parse_rune(trailing).unwrap().to_json()
    );
}

#[test]
fn assignment_continuations_support_balanced_collections_and_calls() {
    let single = r#"@Logic/demo
state:
    items = [{"text":"} ? ||","value":2}]
action update:
    result = max(1, 2)
"#;
    let wrapped = r#"@Logic/demo
state:
    items =
        [
            {"text":"} ? ||","value":2}
        ]
action update:
    result =
        max(
            1, 2
        )
"#;
    let before = parse_rune(single).unwrap().to_json();
    let after = parse_rune(wrapped).unwrap().to_json();
    let values = |doc: &serde_json::Value| {
        let value = doc["Logic"]["demo"]["state"][0].as_str().unwrap();
        serde_json::from_str::<serde_json::Value>(value.split_once('=').unwrap().1).unwrap()
    };
    assert_eq!(values(&before), values(&after));
    let statement = |doc: &serde_json::Value| {
        doc["Logic"]["demo"]["action update"][0]
            .as_str()
            .unwrap()
            .chars()
            .filter(|ch| !ch.is_whitespace())
            .collect::<String>()
    };
    assert_eq!(statement(&before), statement(&after));
}

#[test]
fn formatting_and_execution_preserve_multiline_logic() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("logic.test.rune");
    for source in [MULTILINE, TRAILING] {
        let app = format!(
        "@Page/demo\nlogic = demo\nview:\n    main \"Demo\"\n{source}\n\
         @Test/continuation\ntype = logic\npage = demo\nrun:\n    assert state.counter == 2\n    invoke update\n    assert state.counter == 3\n    assert state.result == 22\n\
         @Test/false_branch\ntype = logic\npage = demo\nrun:\n    invoke reset\n    invoke update\n    assert state.result == 0\n"
        );
        fs::write(&path, app).unwrap();
        let run = || {
            assert_cmd::cargo::cargo_bin_cmd!("vectrune")
                .args(["test", path.to_str().unwrap(), "--type", "logic", "--json"])
                .assert()
                .success();
        };
        run();
        assert_cmd::cargo::cargo_bin_cmd!("vectrune")
            .args(["fmt", path.to_str().unwrap(), "--line-width", "30"])
            .assert()
            .success();
        let formatted = fs::read_to_string(&path).unwrap();
        assert!(formatted.contains("\n        || "), "{formatted}");
        assert!(formatted.contains("\n        ? "), "{formatted}");
        assert_cmd::cargo::cargo_bin_cmd!("vectrune")
            .args([
                "fmt",
                path.to_str().unwrap(),
                "--line-width",
                "30",
                "--check",
            ])
            .assert()
            .success();
        run();
    }
}
