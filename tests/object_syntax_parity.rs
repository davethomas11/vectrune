use rune_runtime::{
    apps::rune_web::render_html_for_path,
    builtins::Context,
    core::{execute_steps_inner, AppState},
    rune_parser::parse_rune,
};
use serde_json::Value;
use std::{collections::HashMap, io::Cursor, sync::Arc};

#[tokio::test]
async fn vectraiders_html_bootstraps_all_three_alien_rows() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("examples/games/space_invaders/space_invaders.rune");
    let document = rune_runtime::rune_parser::load_rune_document_from_path(&path).unwrap();
    let html = render_html_for_path(&document, "/").await.unwrap();
    let state = html.lines().find_map(|line| line.strip_prefix("  stateJson: "))
        .unwrap().trim_end_matches(',');
    let state: Value = serde_json::from_str(state).unwrap();
    let aliens = state["aliens"].as_array().unwrap();
    assert_eq!(aliens.len(), 18);
    assert!(state.get("alien_batch").is_none());
    for (index, alien) in aliens.iter().enumerate() {
        let row = index / 6 + 1;
        let x = 50 + (index % 6) * 65;
        assert_eq!(*alien, serde_json::json!({
            "x": x, "start_x": x, "y": row * 40, "start_y": row * 40,
            "type": row, "alive": true,
        }));
    }
}

fn fixtures(name: &str) -> Vec<Value> {
    serde_json::from_str(match name {
        "expressions" => include_str!("conformance/objects.json"),
        _ => include_str!("conformance/object_programs.json"),
    })
    .unwrap()
}

fn assert_value(actual: &Value, expected: &Value, category: &str) {
    match (actual, expected) {
        (Value::Number(a), Value::Number(b)) => assert_eq!(a.as_f64(), b.as_f64(), "{category}"),
        (Value::Array(a), Value::Array(b)) => {
            assert_eq!(a.len(), b.len(), "{category}");
            for (a, b) in a.iter().zip(b) {
                assert_value(a, b, category);
            }
        }
        (Value::Object(a), Value::Object(b)) => {
            assert_eq!(a.len(), b.len(), "{category}: {actual} vs {expected}");
            for (k, b) in b {
                assert_value(
                    a.get(k)
                        .unwrap_or_else(|| panic!("{category}: missing {k}")),
                    b,
                    category,
                );
            }
        }
        _ => assert_eq!(actual, expected, "{category}"),
    }
}

#[tokio::test]
async fn object_expressions_match_vect_web_and_backend() {
    for fixture in fixtures("expressions") {
        let category = fixture["category"].as_str().unwrap();
        let expression = fixture["expr"].as_str().unwrap();
        let context = fixture["context"].as_object().unwrap();
        let mut ctx: Context = context.clone().into_iter().collect();
        let document = parse_rune(&format!(
            "@Route/GET /test\nrun:\n    result = {expression}\n    respond 200 result\n"
        ))
        .unwrap();
        let steps = document.sections[0].series["run"].clone();
        let state = AppState {
            doc: Arc::new(document),
            schemas: Arc::new(HashMap::new()),
            data_sources: Arc::new(HashMap::new()),
            path: Default::default(),
        };
        let response = execute_steps_inner(state, &steps, &mut ctx).await.unwrap();
        assert_eq!(response.0, 200, "{category}: {}", response.1);
        let actual: Value = serde_json::from_str(&response.1).unwrap();
        assert_value(&actual, &fixture["expected"], category);

        let bindings = context
            .iter()
            .map(|(k, v)| format!("{k} = {v}\n"))
            .collect::<String>();
        let source =
            format!("{bindings}result = {expression}\nstdio -> \"{{json.stringify(result)}}\"\n");
        assert_vect(&source, &fixture["expected"], category);
    }
}

fn assert_vect(source: &str, expected: &Value, category: &str) {
    let program = rune_runtime::cli::vect::parse_program(source).unwrap();
    let mut output = Vec::new();
    rune_runtime::cli::vect::run_program_with_io(&program, &mut Cursor::new(""), &mut output)
        .unwrap_or_else(|e| panic!("{category}: {e:#}"));
    let result: Value = serde_json::from_slice(&output).unwrap();
    assert_value(&result, expected, category);
}

#[tokio::test]
async fn object_programs_match_vect_web_and_backend() {
    for fixture in fixtures("programs") {
        let category = fixture["category"].as_str().unwrap();
        let statements = fixture["statements"]
            .as_array()
            .unwrap()
            .iter()
            .map(|s| s.as_str().unwrap())
            .collect::<Vec<_>>()
            .join("\n");
        assert_vect(
            &format!("{statements}\nstdio -> \"{{json.stringify(result)}}\"\n"),
            &fixture["expected"],
            category,
        );
        let indented = statements
            .lines()
            .map(|s| format!("    {s}\n"))
            .collect::<String>();
        let document = parse_rune(&format!(
            "@Route/GET /test\nrun:\n{indented}    respond 200 result\n"
        ))
        .unwrap();
        let steps = document.sections[0].series["run"].clone();
        let state = AppState {
            doc: Arc::new(document),
            schemas: Arc::new(HashMap::new()),
            data_sources: Arc::new(HashMap::new()),
            path: Default::default(),
        };
        let response = execute_steps_inner(state, &steps, &mut Context::new())
            .await
            .unwrap();
        assert_eq!(response.0, 200, "{category}: {}", response.1);
        assert_value(
            &serde_json::from_str::<Value>(&response.1).unwrap(),
            &fixture["expected"],
            category,
        );
    }
}

#[test]
fn rejects_invalid_generators_and_members() {
    assert!(!rune_runtime::object_syntax::is_structured(
        "log \"text with [] brackets\""
    ));
    for expression in [
        "{x: 1} * -1",
        "{x: 1} * 1.5",
        "{x: 1} * \"2\"",
        "{x: 1} * 2 inc x by \"1\"",
        "{x: 1} * 1000001",
        "grid 1000000 x 2 at (0, 0) step (1, 1)",
        "{} with []",
        "{constructor: 1}",
        "{x: 1} * 2 garbage",
        "{\"quoted\"}",
    ] {
        assert!(
            rune_runtime::object_syntax::evaluate(expression, &|_| None).is_err(),
            "{expression}"
        );
    }
}

#[test]
fn preserves_native_json_integer_precision() {
    let value =
        rune_runtime::object_syntax::evaluate("{ id: 9007199254740993 }", &|_| None).unwrap();
    assert_eq!(value["id"].as_u64(), Some(9_007_199_254_740_993));
}

#[test]
fn runnable_vect_example_demonstrates_copies_and_nested_updates() {
    let source = include_str!("../examples/language/objects/objects.vect");
    let program = rune_runtime::cli::vect::parse_program(source).unwrap();
    let mut output = Vec::new();
    rune_runtime::cli::vect::run_program_with_io(&program, &mut Cursor::new(""), &mut output)
        .unwrap();
    let result: Value = serde_json::from_slice(&output).unwrap();
    assert_eq!(
        result["profile"],
        serde_json::json!({"name": "Workshop", "copies": 6})
    );
    assert_eq!(result["actors"].as_array().unwrap().len(), 6);
    assert_eq!(result["selected"]["stats"]["hp"], 2);
    assert_eq!(result["actors"][4]["stats"]["hp"], 3);
    assert_eq!(result["original"][1]["stats"]["hp"], 3);
    assert_eq!(result["slots"].as_array().unwrap().len(), 4);
    assert_eq!(result["orders"][0]["items"][1]["qty"], 7);
}

#[tokio::test]
async fn local_and_compound_assignments_preserve_read_only_values() {
    for statement in ["limit += 1", "local limit = 3", "let limit = 4"] {
        let document = parse_rune(&format!(
            "@Values\nlimit = 2\n@Route/GET /test\nrun:\n    {statement}\n"
        ))
        .unwrap();
        let steps = document.sections[1].series["run"].clone();
        let state = AppState {
            doc: Arc::new(document),
            schemas: Arc::new(HashMap::new()),
            data_sources: Arc::new(HashMap::new()),
            path: Default::default(),
        };
        let mut context = Context::new();
        let response = execute_steps_inner(state, &steps, &mut context)
            .await
            .unwrap();
        assert_eq!(response.0, 500, "{statement}");
        assert!(response.1.contains("read-only"));
        assert_eq!(context["limit"].as_f64(), Some(2.0));
    }
}
