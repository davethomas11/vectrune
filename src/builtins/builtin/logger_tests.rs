use super::expand_log_message;
use crate::builtins::Context;
use serde_json::json;

#[test]
fn expands_flat_and_nested_placeholders() {
    let mut ctx = Context::new();
    ctx.insert("id".to_string(), json!(42));
    ctx.insert("body".to_string(), json!({ "name": "Alice" }));

    assert_eq!(
        expand_log_message("Fetching user with ID: {id} ({body.name})", &ctx),
        "Fetching user with ID: 42 (Alice)"
    );
}

#[test]
fn expands_path_params_and_bracket_paths() {
    let mut ctx = Context::new();
    ctx.insert("id".to_string(), json!("player-1"));
    ctx.insert("path.params".to_string(), json!({ "id": "player-1" }));
    ctx.insert(
        "state".to_string(),
        json!({
            "players": {
                "player-1": { "score": 9 }
            }
        }),
    );

    assert_eq!(
        expand_log_message("{path.params.id} -> {state.players.[id].score}", &ctx),
        "player-1 -> 9"
    );
}

#[test]
fn leaves_unknown_placeholders_unchanged() {
    let ctx = Context::new();

    assert_eq!(
        expand_log_message("Fetching user with ID: {id}", &ctx),
        "Fetching user with ID: {id}"
    );
}

