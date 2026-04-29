use axum::extract::ws::Message;
use rune_runtime::apps::rest::ws::{WsConnection, WS_REGISTRY};
use rune_runtime::builtins::Context;
use rune_runtime::core::{execute_steps_inner, resolve_path, AppState};
use rune_runtime::rune_ast::{RuneDocument, Value};
use serde_json::json;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::timeout;
use uuid::Uuid;

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

#[tokio::test]
async fn websocket_id_builtin_assigns_connection_id_from_context() {
    let mut ctx = Context::new();
    ctx.insert("ws_id".to_string(), json!("player-1"));

    let steps = [Value::String("id = ws.id".to_string())];

    let _ = execute_steps_inner(app_state(), &steps, &mut ctx).await;

    assert_eq!(ctx.get("id"), Some(&json!("player-1")));
}

#[tokio::test]
async fn websocket_broadcast_command_with_path_argument_is_not_treated_as_arithmetic() {
    let path = "/ws".to_string();
    let conn_id = Uuid::new_v4();
    let (tx, mut rx) = mpsc::unbounded_channel();

    {
        let mut registry = WS_REGISTRY.lock().unwrap();
        registry.clear();
        registry
            .entry(path.clone())
            .or_default()
            .insert(conn_id, WsConnection { tx });
    }

    let mut ctx = Context::new();
    ctx.insert(
        "state".to_string(),
        json!({
            "players": {
                "player-1": { "x": 10, "y": 10, "score": 0 }
            },
            "food": { "x": 15, "y": 15 }
        }),
    );

    let steps = [Value::String("ws.broadcast /ws state".to_string())];

    let _ = execute_steps_inner(app_state(), &steps, &mut ctx).await;

    let msg = timeout(Duration::from_millis(200), rx.recv())
        .await
        .expect("expected ws.broadcast to send a websocket message")
        .expect("expected websocket message in channel");

    match msg {
        Message::Text(text) => {
            assert_eq!(text.to_string(), json!(ctx.get("state").unwrap()).to_string());
        }
        other => panic!("expected websocket text message, got {other:?}"),
    }

    WS_REGISTRY.lock().unwrap().clear();
}



