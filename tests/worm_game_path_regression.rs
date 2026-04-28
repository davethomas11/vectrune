use rune_runtime::builtins::Context;
use rune_runtime::core::{execute_steps_inner, resolve_path, AppState};
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
async fn worm_game_join_creates_player_using_variable_backed_bracket_path() {
    let mut ctx = Context::new();
    ctx.insert(
        "state".to_string(),
        json!({
            "players": {},
            "food": { "x": 15, "y": 15 }
        }),
    );
    ctx.insert("id".to_string(), json!("player-1"));

    let steps = [Value::String(
        "state.players.[id] = { \"x\": 10, \"y\": 10, \"color\": \"hsl(120, 70%, 50%)\", \"score\": 0 }"
            .to_string(),
    )];

    let _ = execute_steps_inner(app_state(), &steps, &mut ctx).await;
    assert_eq!(
        resolve_path(&ctx, "state.players.[id].x", None).and_then(|v| v.as_f64()),
        Some(10.0)
    );
    assert_eq!(
        resolve_path(&ctx, "state.players.[id].y", None).and_then(|v| v.as_f64()),
        Some(10.0)
    );
    assert_eq!(
        resolve_path(&ctx, "state.players.[id].score", None).and_then(|v| v.as_f64()),
        Some(0.0)
    );
    assert_eq!(
        resolve_path(&ctx, "state.players.[id].color", None).and_then(|v| v.as_str().map(str::to_string)),
        Some("hsl(120, 70%, 50%)".to_string())
    );
}

#[tokio::test]
async fn worm_game_move_updates_only_targeted_player() {
    let mut ctx = Context::new();
    ctx.insert(
        "state".to_string(),
        json!({
            "players": {
                "player-1": { "x": 10, "y": 10, "score": 0 },
                "player-2": { "x": 3, "y": 4, "score": 9 }
            },
            "food": { "x": 15, "y": 15 }
        }),
    );
    ctx.insert("id".to_string(), json!("player-1"));
    ctx.insert("event".to_string(), json!({ "x": 15, "y": 16 }));

    let steps = [
        Value::String("state.players.[id].x = event.x".to_string()),
        Value::String("state.players.[id].y = event.y".to_string()),
    ];

    let _ = execute_steps_inner(app_state(), &steps, &mut ctx).await;
    assert_eq!(
        resolve_path(&ctx, "state.players.[id].x", None),
        Some(json!(15))
    );
    assert_eq!(
        resolve_path(&ctx, "state.players.[id].y", None),
        Some(json!(16))
    );
    assert_eq!(
        resolve_path(&ctx, "state.players.[\"player-2\"].x", None),
        Some(json!(3))
    );
    assert_eq!(
        resolve_path(&ctx, "state.players.[\"player-2\"].y", None),
        Some(json!(4))
    );
}

#[tokio::test]
async fn worm_game_collision_flow_updates_nested_paths_and_arithmetic() {
    let mut ctx = Context::new();
    ctx.insert(
        "state".to_string(),
        json!({
            "players": {
                "player-1": { "x": 10, "y": 10, "score": 0 }
            },
            "food": { "x": 15, "y": 16 }
        }),
    );
    ctx.insert("id".to_string(), json!("player-1"));
    ctx.insert("event".to_string(), json!({ "x": 15, "y": 16 }));

    let steps = vec![Value::Map(HashMap::from([(
        "if state.players.[id] != null".to_string(),
        Value::List(vec![
            Value::String("state.players.[id].x = event.x".to_string()),
            Value::String("state.players.[id].y = event.y".to_string()),
            Value::Map(HashMap::from([(
                "if state.players.[id].x == state.food.x".to_string(),
                Value::List(vec![Value::Map(HashMap::from([(
                    "if state.players.[id].y == state.food.y".to_string(),
                    Value::List(vec![
                        Value::String(
                            "state.players.[id].score = state.players.[id].score + 1".to_string(),
                        ),
                        Value::String("state.food.x = state.food.x + 3".to_string()),
                    ]),
                )]))]),
            )])),
        ]),
    )]))];

    let _ = execute_steps_inner(app_state(), &steps, &mut ctx).await;
    assert_eq!(
        resolve_path(&ctx, "state.players.[id].score", None),
        Some(json!(1))
    );
    assert_eq!(resolve_path(&ctx, "state.food.x", None), Some(json!(18)));
    assert_eq!(
        resolve_path(&ctx, "state.players.[id].x", None),
        Some(json!(15))
    );
    assert_eq!(
        resolve_path(&ctx, "state.players.[id].y", None),
        Some(json!(16))
    );
}



