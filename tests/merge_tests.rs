use rune_runtime::cli::handle_merge;
use rune_runtime::rune_ast::RuneDocument;
use rune_runtime::rune_parser::parse_rune;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

struct TempFile {
    path: PathBuf,
}

impl TempFile {
    fn new(path: &str, content: &str) -> Self {
        fs::write(path, content).unwrap();
        Self {
            path: PathBuf::from(path),
        }
    }

    fn path_str(&self) -> &str {
        self.path.to_str().unwrap()
    }
}

impl Drop for TempFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

#[test]
fn test_merge_cli_yaml() {
    let base_yaml = "
environment:
  preview:
    - name: url
      value: preview.com
    - name: allowedIps
      value: []
";
    let input_yaml = "
Ips:
  - 1.1.1.1
  - 2.2.2.2
";

    let base = TempFile::new("test_base.yaml", base_yaml);
    let input = TempFile::new("test_input.yaml", input_yaml);

    let output = Command::new("cargo")
        .args(&[
            "run",
            "--",
            "-i",
            "yaml",
            input.path_str(),
            "--merge-with",
            &format!(
                "{}@environment.preview.[].(name=allowedIps on value from Ips)",
                base.path_str()
            ),
            "-o",
            "yaml",
        ])
        .output()
        .expect("failed to execute process");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("1.1.1.1"));
    assert!(stdout.contains("2.2.2.2"));
    assert!(stdout.contains("allowedIps"));
}

#[ignore]
#[test]
fn test_merge_cli_rune() {
    let base_rune = "
#!RUNE
@Roles
admin:
  perms: []
";
    let input_rune = "
#!RUNE
@Data
new_perms:
  - read
  - write
";

    let base = TempFile::new("test_base.rune", base_rune);
    let input = TempFile::new("test_input.rune", input_rune);

    // Test simple merge without instruction first
    let output = Command::new("cargo")
        .args(&[
            "run",
            "--",
            input.path_str(),
            "--merge-with",
            &format!("{}@Roles", base.path_str()),
            "-o",
            "json",
        ])
        .output()
        .expect("failed to execute process");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("new_perms"));
}

#[ignore]
#[test]
fn test_merge_cli_json_to_yaml() {
    let base_yaml = "
api:
  key: old
";
    let input_json = "{\"new_key\": \"secret\"}";

    let base = TempFile::new("test_base_kv.yaml", base_yaml);
    let input = TempFile::new("test_input.json", input_json);

    let output = Command::new("cargo")
        .args(&[
            "run",
            "--",
            "-i",
            "json",
            input.path_str(),
            "--merge-with",
            &format!("{}@api", base.path_str()),
            "-o",
            "yaml",
        ])
        .output()
        .expect("failed to execute process");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("new_key: secret"));
}

fn merge_from_json(base_content: &str, selector: &str, input: Value) -> Result<Value, String> {
    let base = tempfile::Builder::new().suffix(".json").tempfile().unwrap();
    fs::write(base.path(), base_content).unwrap();
    let input = RuneDocument::from_json(&input);
    handle_merge(&input, &format!("{}@{}", base.path().display(), selector))
        .map(|document| document.to_json())
}

#[test]
fn merge_traverses_deeply_nested_arrays_of_arrays() {
    let merged = merge_from_json(
        r#"{"a":{"b":{"c":{"d":{"e":[[[{"id":"target","items":[]}]]]}}}}}"#,
        "a.b.c.d.e.[][][].(id=target on items from payload)",
        json!({"payload": ["x", "y"]}),
    )
    .unwrap();
    assert_eq!(
        merged["a"]["b"]["c"]["d"]["e"][0][0][0]["items"],
        json!(["x", "y"])
    );
}

#[test]
fn merge_updates_matching_items_and_skips_partial_matches() {
    let merged = merge_from_json(
        r#"{"env":{"preview":[{"name":"ips","value":[]}],"prod":[{"name":"other","value":[]}]}}"#,
        "env.(preview|prod).[].(name=ips on value from ips)",
        json!({"ips": ["1.2.3.4"]}),
    )
    .unwrap();
    assert_eq!(merged["env"]["preview"][0]["value"], json!(["1.2.3.4"]));
    assert_eq!(merged["env"]["prod"][0]["value"], json!([]));
}

#[test]
fn merge_reports_destination_type_conflicts() {
    let error = merge_from_json(
        r#"{"config":{"keys":"wrong-type"}}"#,
        "config.(keys from keys)",
        json!({"keys": ["one"]}),
    )
    .unwrap_err();
    assert!(error.contains("type conflict"));
    assert!(error.contains("destination 'keys' is string"));
    assert!(error.contains("source is array"));
}

#[test]
fn merge_accepts_empty_sources_and_rejects_missing_sources() {
    let merged = merge_from_json(
        r#"{"config":{"keys":["old"]}}"#,
        "config.(keys from keys)",
        json!({"keys": []}),
    )
    .unwrap();
    assert_eq!(merged["config"]["keys"], json!([]));

    let error = merge_from_json(
        r#"{"config":{"keys":[]}}"#,
        "config.(keys from keys)",
        json!({}),
    )
    .unwrap_err();
    assert!(error.contains("source 'keys' was not found"));
}

#[test]
fn merge_returns_errors_for_malformed_selectors_and_no_matches() {
    for selector in [
        "config..(keys from keys)",
        "config.(keys from keys",
        "config.(keys= on value from keys)",
        "config.(unknown)",
    ] {
        assert!(
            merge_from_json(r#"{"config":{"keys":[]}}"#, selector, json!({"keys": []})).is_err(),
            "accepted malformed selector {}",
            selector
        );
    }

    let error = merge_from_json(
        r#"{"config":{"keys":[]}}"#,
        "missing.(keys from keys)",
        json!({"keys": []}),
    )
    .unwrap_err();
    assert!(error.contains("matched no targets"));
}

#[test]
fn merge_handles_ten_thousand_values_and_targets() {
    let mut entries: Vec<_> = (0..10_000)
        .map(|index| json!({"name": format!("entry-{index}"), "values": []}))
        .collect();
    entries[9_999]["name"] = json!("selected");
    let values: Vec<_> = (0..10_000).map(|value| json!(value)).collect();
    let input = json!({"values": values});
    let merged = merge_from_json(
        &json!({"config": {"entries": entries}}).to_string(),
        "config.entries.[].(name=selected on values from values)",
        input,
    )
    .unwrap();
    assert_eq!(
        merged["config"]["entries"][9_999]["values"]
            .as_array()
            .unwrap()
            .len(),
        10_000
    );
}

#[test]
fn merge_reads_json_yaml_xml_and_rune_base_documents() {
    let input = RuneDocument::from_json(&json!({"config": {"keys": ["new"]}}));
    for (suffix, content) in [
        (".json", r#"{"config":{"keys":[]}}"#),
        (".yaml", "config:\n  keys: []\n"),
        (
            ".xml",
            "<root><config><placeholder>old</placeholder></config><extra>preserve</extra></root>",
        ),
    ] {
        let base = tempfile::Builder::new().suffix(suffix).tempfile().unwrap();
        fs::write(base.path(), content).unwrap();
        let merged = handle_merge(
            &input,
            &format!("{}@config.(keys from config.keys)", base.path().display()),
        )
        .unwrap_or_else(|error| panic!("failed to merge {} base: {}", suffix, error));
        assert_eq!(
            merged.to_json()["config"]["keys"],
            json!(["new"]),
            "{suffix}"
        );
    }

    let base = tempfile::Builder::new().suffix(".rune").tempfile().unwrap();
    fs::write(base.path(), "#!RUNE\n@config\nkeys:\n  - old\n").unwrap();
    let merged = handle_merge(
        &input,
        &format!("{}@config.(keys from config.keys)", base.path().display()),
    )
    .unwrap();
    assert_eq!(merged.to_json()["config"]["keys"], json!(["new"]));
}

#[test]
fn merge_reads_source_values_from_json_yaml_xml_and_rune() {
    let inputs = [
        (
            RuneDocument::from_json(&json!({"payload": ["new", "second"]})),
            "payload",
        ),
        (
            RuneDocument::from_yaml("payload:\n  - new\n  - second\n").unwrap(),
            "payload",
        ),
        (
            parse_rune("#!RUNE\n@payload\nitems:\n  - new\n  - second\n").unwrap(),
            "payload.items",
        ),
        (
            RuneDocument::from_xml(
                "<root><payload><item>new</item><item>second</item></payload><extra>yes</extra></root>",
            )
            .unwrap(),
            "payload.item",
        ),
    ];

    for (input, source_path) in inputs {
        let base = tempfile::Builder::new().suffix(".json").tempfile().unwrap();
        fs::write(base.path(), r#"{"config":{"keys":[]}}"#).unwrap();
        let merged = handle_merge(
            &input,
            &format!(
                "{}@config.(keys from {})",
                base.path().display(),
                source_path
            ),
        )
        .unwrap();
        assert_eq!(merged.to_json()["config"]["keys"], json!(["new", "second"]));
    }
}

#[test]
fn merge_populates_empty_base_and_preserves_empty_json_objects() {
    let base = tempfile::Builder::new().suffix(".json").tempfile().unwrap();
    fs::write(base.path(), "{}").unwrap();
    let input = RuneDocument::from_json(&json!({"settings": {"enabled": true}}));
    let merged = handle_merge(
        &input,
        &format!("{}@(settings from settings)", base.path().display()),
    )
    .unwrap();
    assert_eq!(merged.to_json(), json!({"settings": {"enabled": true}}));

    let document = RuneDocument::from_json(&json!({
        "root_value": "kept",
        "nested": {"empty": {}, "items": [{"value": 1.0}]}
    }));
    assert_eq!(
        document.to_json(),
        json!({"root_value": "kept", "nested": {"empty": {}, "items": [{"value": 1.0}]}})
    );
}

#[test]
fn xml_conversion_preserves_repeated_elements_attributes_and_text() {
    let document = RuneDocument::from_xml(
        "<root><items><item>one &amp; two</item><item>three</item></items><extra key=\"value\">text</extra></root>",
    )
    .unwrap();
    let json = document.to_json();

    assert_eq!(json["items"]["item"], json!(["one & two", "three"]));
    assert_eq!(json["extra"]["@key"], "value");
    assert_eq!(json["extra"]["$text"], "text");
}
