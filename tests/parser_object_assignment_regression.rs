use rune_runtime::rune_ast::Value;
use rune_runtime::rune_parser::parse_rune;
use serde_json::json;

fn first_section(input: &str) -> rune_runtime::rune_ast::Section {
    parse_rune(input)
        .expect("parse_rune should succeed")
        .sections
        .into_iter()
        .next()
        .expect("expected one section")
}

#[test]
fn parses_empty_inline_object_assignment_as_map() {
    let section = first_section(
        r#"@Config
state = {}
"#,
    );

    let value = section.kv.get("state").expect("expected state key");
    match value {
        Value::Map(map) => assert!(map.is_empty(), "expected empty map"),
        other => panic!("expected map value, got {other:?}"),
    }
}

#[test]
fn parses_single_line_inline_object_assignment_as_map() {
    let section = first_section(
        r#"@Config
player = { "l": 1, "name": "worm" }
"#,
    );

    let value = section.kv.get("player").expect("expected player key");
    assert_eq!(value.to_json(), json!({ "l": 1.0, "name": "worm" }));
}

#[test]
fn parses_nested_inline_object_assignment_as_map() {
    let section = first_section(
        r#"@Config
player = { "position": { "x": 10, "y": 12 }, "alive": true }
"#,
    );

    let value = section.kv.get("player").expect("expected player key");
    assert_eq!(
        value.to_json(),
        json!({ "position": { "x": 10.0, "y": 12.0 }, "alive": true })
    );
}

#[test]
fn parses_multiline_object_assignment_as_map() {
    let section = first_section(
        r#"@Config
player = {
  "position": { "x": 10, "y": 12 },
  "alive": true,
  "name": "worm"
}
"#,
    );

    let value = section.kv.get("player").expect("expected player key");
    assert_eq!(
        value.to_json(),
        json!({
            "position": { "x": 10.0, "y": 12.0 },
            "alive": true,
            "name": "worm"
        })
    );
}

#[test]
fn preserves_settings_block_maps() {
    let section = first_section(
        r#"@App
settings {
  mode = game
  difficulty = medium
}
"#,
    );

    let settings = section.kv.get("settings").expect("expected settings map");
    assert_eq!(
        settings.to_json(),
        json!({ "mode": "game", "difficulty": "medium" })
    );
}

#[test]
fn preserves_block_maps_and_series_object_assignments() {
    let section = first_section(
        r#"@Route/POST /join
meta {
  mode = game
}
run:
    state.players.[id] = { "x": 10, "score": 0 }
"#,
    );

    let meta = section.kv.get("meta").expect("expected meta map");
    assert_eq!(meta.to_json(), json!({ "mode": "game" }));

    let run = section.series.get("run").expect("expected run series");
    match run.first() {
        Some(Value::String(step)) => {
            assert_eq!(
                step.trim_start(),
                "state.players.[id] = { \"x\": 10, \"score\": 0 }"
            )
        }
        other => panic!("expected raw run step string, got {other:?}"),
    }
}


