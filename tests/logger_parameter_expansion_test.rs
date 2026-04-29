use rune_runtime::builtins::{Context, LAST_EXEC_RESULT};
use rune_runtime::core::{execute_steps_inner, AppState};
use rune_runtime::rune_ast::{RuneDocument, Value};
use serde_json::json;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

fn app_state() -> AppState {
    AppState {
        doc: Arc::new(RuneDocument { sections: vec![] }),
        schemas: Arc::new(HashMap::new()),
        data_sources: Arc::new(HashMap::new()),
        path: PathBuf::new(),
    }
}

#[tokio::test]
async fn log_expands_path_param_placeholders() {
    let mut ctx = Context::new();
    ctx.insert("id".to_string(), json!(123));
    ctx.insert("path.params".to_string(), json!({ "id": 123 }));

    let steps = [Value::String("log \"Fetching user with ID: {id}\"".to_string())];

    let _ = execute_steps_inner(app_state(), &steps, &mut ctx).await;

    assert_eq!(
        ctx.get(LAST_EXEC_RESULT),
        Some(&json!("Fetching user with ID: 123"))
    );
}

#[tokio::test]
async fn log_expands_nested_context_placeholders() {
    let mut ctx = Context::new();
    ctx.insert("id".to_string(), json!("player-1"));
    ctx.insert(
        "state".to_string(),
        json!({
            "players": {
                "player-1": { "x": 15, "y": 16, "score": 4 }
            }
        }),
    );

    let steps = [Value::String(
        "log \"Player {id} moved to {state.players.[id].x},{state.players.[id].y} score={state.players.[id].score}\""
            .to_string(),
    )];

    let _ = execute_steps_inner(app_state(), &steps, &mut ctx).await;

    assert_eq!(
        ctx.get(LAST_EXEC_RESULT),
        Some(&json!("Player player-1 moved to 15,16 score=4"))
    );
}


