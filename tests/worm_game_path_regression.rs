use axum::extract::ws::Message;
use rune_runtime::apps::rest::ws::{WsConnection, WS_REGISTRY};
use rune_runtime::builtins::Context;
use rune_runtime::core::{execute_steps_inner, resolve_path, AppState};
use rune_runtime::rune_ast::{RuneDocument, Value};
use serde_json::json;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::timeout;
use uuid::Uuid;

static WS_TEST_MUTEX: Mutex<()> = Mutex::new(());

fn app_state() -> AppState {
    AppState {
        doc: Arc::new(RuneDocument { sections: vec![] }),
        schemas: Arc::new(HashMap::new()),
        data_sources: Arc::new(HashMap::new()),
        path: PathBuf::new(),
    }
}

fn worm_game_app_state() -> AppState {
    AppState {
        doc: Arc::new(RuneDocument { sections: vec![] }),
        schemas: Arc::new(HashMap::new()),
        data_sources: Arc::new(HashMap::new()),
        path: std::env::current_dir()
            .expect("current_dir should be available")
            .join("examples")
            .join("worm_game"),
    }
}

#[tokio::test]
async fn worm_game_join_creates_player_using_variable_backed_bracket_path() {
    let mut ctx = Context::new();
    ctx.insert(
        "state".to_string(),
        json!({
            "players": {},
            "food": { "x": 15, "y": 15 },
            "next_color_index": 0
        }),
    );
    ctx.insert("id".to_string(), json!("player-1"));

    let steps = [Value::String(
        "state.players.[id] = { \"x\": 10, \"y\": 10, \"color\": \"#39CCCC\", \"score\": 0, \"size\": 1 }"
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
        resolve_path(&ctx, "state.players.[id].size", None).and_then(|v| v.as_f64()),
        Some(1.0)
    );
    assert_eq!(
        resolve_path(&ctx, "state.players.[id].color", None).and_then(|v| v.as_str().map(str::to_string)),
        Some("#39CCCC".to_string())
    );
}

#[tokio::test]
async fn worm_game_join_color_rotation_wraps_after_ten_players() {
    let mut ctx = Context::new();
    ctx.insert(
        "state".to_string(),
        json!({
            "players": {},
            "food": { "x": 15, "y": 15 },
            "next_color_index": 9
        }),
    );
    ctx.insert("id".to_string(), json!("player-10"));

    let steps = vec![
        Value::String(
            "state.players.[id] = { \"x\": 10, \"y\": 10, \"color\": \"#39CCCC\", \"score\": 0, \"size\": 1 }"
                .to_string(),
        ),
        Value::Map(HashMap::from([(
            "if state.next_color_index == 9".to_string(),
            Value::List(vec![Value::String(
                "state.players.[id].color = \"#F012BE\"".to_string(),
            )]),
        )])),
        Value::String("state.next_color_index = state.next_color_index + 1".to_string()),
        Value::Map(HashMap::from([(
            "if state.next_color_index > 9".to_string(),
            Value::List(vec![Value::String("state.next_color_index = 0".to_string())]),
        )])),
    ];

    let _ = execute_steps_inner(app_state(), &steps, &mut ctx).await;

    assert_eq!(
        resolve_path(&ctx, "state.players.[id].color", None),
        Some(json!("#F012BE"))
    );
    assert_eq!(resolve_path(&ctx, "state.next_color_index", None), Some(json!(0)));
}

#[tokio::test]
async fn worm_game_palette_can_be_loaded_from_json_file() {
    let mut ctx = Context::new();
    ctx.insert(
        "state".to_string(),
        json!({
            "next_color_index": 4,
            "players": { "player-1": { "color": "" } }
        }),
    );
    ctx.insert("id".to_string(), json!("player-1"));

    let steps = [
        Value::String("worm_colors = json.read worm_colors.json".to_string()),
        Value::String(
            "state.players.[id].color = worm_colors.[state.next_color_index]".to_string(),
        ),
    ];

    let _ = execute_steps_inner(worm_game_app_state(), &steps, &mut ctx).await;

    assert_eq!(
        resolve_path(&ctx, "state.players.[id].color", None),
        Some(json!("#FF4136"))
    );
}

#[tokio::test]
async fn delete_builtin_removes_from_context() {
    let mut ctx = Context::new();
    ctx.insert("player_id".to_string(), json!("player-1"));
    ctx.insert(
        "state".to_string(),
        json!({
            "players": {
                "player-1": { "x": 10, "y": 10, "score": 0, "size": 1 }
            }
        }),
    );

    let steps = [
        Value::String("state.players.[player_id] = {}".to_string()),
        Value::String("delete state.players.[player_id]".to_string()),
    ];

    let _ = execute_steps_inner(app_state(), &steps, &mut ctx).await;

    assert_eq!(resolve_path(&ctx, "state.players.[player_id]", None), None);
}

#[tokio::test]
async fn is_set_builtin_detects_presence_in_context() {
    let mut ctx = Context::new();
    ctx.insert(
        "state".to_string(),
        json!({
            "players": {
                "player-1": { "x": 10, "y": 10 }
            }
        }),
    );
    ctx.insert("id".to_string(), json!("player-1"));

    let steps = [
        Value::String("exists = is-set state.players.[id]".to_string()),
        Value::String("missing = is-set nonexistent_var".to_string()),
    ];

    let _ = execute_steps_inner(app_state(), &steps, &mut ctx).await;

    assert_eq!(ctx.get("exists"), Some(&json!(true)));
    assert_eq!(ctx.get("missing"), Some(&json!(false)));
}

#[tokio::test]
async fn worm_game_on_disconnect_removes_player_when_exists() {
    let mut ctx = Context::new();
    ctx.insert("ws_id".to_string(), json!("player-1"));
    ctx.insert(
        "state".to_string(),
        json!({
            "players": {
                "player-1": { "x": 10, "y": 10, "score": 0, "size": 1 }
            },
            "food": { "x": 15, "y": 15 }
        }),
    );

    let steps = vec![
        Value::String("id = ws.id".to_string()),
        Value::String("state = get-memory game_state".to_string()),
        Value::String("player_exists = is-set state.players.[id]".to_string()),
        Value::Map(HashMap::from([(
            "if player_exists == true".to_string(),
            Value::List(vec![Value::String(
                "delete state.players.[id]".to_string(),
            )]),
        )])),
    ];

    let _ = execute_steps_inner(app_state(), &steps, &mut ctx).await;

    assert_eq!(resolve_path(&ctx, "state.players.[id]", None), None);
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
                "player-1": { "x": 10, "y": 10, "score": 0, "size": 1 }
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
                        Value::String("next_size = state.players.[id].size + 1".to_string()),
                        Value::Map(HashMap::from([(
                            "if next_size > 10".to_string(),
                            Value::List(vec![Value::String("next_size = 10".to_string())]),
                        )])),
                        Value::String("state.players.[id].size = next_size".to_string()),
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
    assert_eq!(resolve_path(&ctx, "state.players.[id].size", None), Some(json!(2)));
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
async fn worm_game_growth_caps_at_ten_segments() {
    let mut ctx = Context::new();
    ctx.insert(
        "state".to_string(),
        json!({
            "players": {
                "player-1": { "x": 10, "y": 10, "score": 9, "size": 10 }
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
                        Value::String("next_size = state.players.[id].size + 1".to_string()),
                        Value::Map(HashMap::from([(
                            "if next_size > 10".to_string(),
                            Value::List(vec![Value::String("next_size = 10".to_string())]),
                        )])),
                        Value::String("state.players.[id].size = next_size".to_string()),
                    ]),
                )]))]),
            )])),
        ]),
    )]))];

    let _ = execute_steps_inner(app_state(), &steps, &mut ctx).await;

    assert_eq!(resolve_path(&ctx, "state.players.[id].size", None), Some(json!(10)));
    assert_eq!(resolve_path(&ctx, "state.players.[id].score", None), Some(json!(10)));
}

#[tokio::test]
async fn worm_game_move_with_non_matching_collision_branch_does_not_panic_and_continues() {
    let mut ctx = Context::new();
    ctx.insert(
        "state".to_string(),
        json!({
            "players": {
                "player-1": { "x": 10, "y": 10, "score": 0 }
            },
            "food": { "x": 30, "y": 30 }
        }),
    );
    ctx.insert("id".to_string(), json!("player-1"));
    ctx.insert("event".to_string(), json!({ "x": 11, "y": 10 }));

    let steps = vec![
        Value::Map(HashMap::from([(
            "if state.players.[id] != null".to_string(),
            Value::List(vec![
                Value::String("state.players.[id].x = event.x".to_string()),
                Value::String("state.players.[id].y = event.y".to_string()),
                Value::Map(HashMap::from([(
                    "if state.players.[id].x == state.food.x".to_string(),
                    Value::List(vec![Value::Map(HashMap::from([(
                        "if state.players.[id].y == state.food.y".to_string(),
                        Value::List(vec![Value::String(
                            "state.players.[id].score = state.players.[id].score + 1".to_string(),
                        )]),
                    )]))]),
                )])),
            ]),
        )])),
        Value::String("move_processed = 1".to_string()),
    ];

    let last_response = execute_steps_inner(app_state(), &steps, &mut ctx).await;

    assert_eq!(last_response, Some((200, "1".to_string())));
    assert_eq!(resolve_path(&ctx, "state.players.[id].x", None), Some(json!(11)));
    assert_eq!(resolve_path(&ctx, "state.players.[id].y", None), Some(json!(10)));
    assert_eq!(resolve_path(&ctx, "state.players.[id].score", None), Some(json!(0)));
    assert_eq!(ctx.get("move_processed"), Some(&json!(1)));
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
async fn websocket_send_command_resolves_target_id_from_context_variable() {
    let _guard = WS_TEST_MUTEX.lock().unwrap();
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
    ctx.insert("id".to_string(), json!(conn_id.to_string()));
    ctx.insert(
        "session".to_string(),
        json!({
            "type": "self",
            "id": conn_id.to_string()
        }),
    );

    let steps = [Value::String("ws.send /ws id session".to_string())];

    let _ = execute_steps_inner(app_state(), &steps, &mut ctx).await;

    let msg = timeout(Duration::from_millis(200), rx.recv())
        .await
        .expect("expected ws.send to send a websocket message")
        .expect("expected websocket message in channel");

    match msg {
        Message::Text(text) => {
            assert_eq!(
                text.to_string(),
                json!({ "type": "self", "id": conn_id.to_string() }).to_string()
            );
        }
        other => panic!("expected websocket text message, got {other:?}"),
    }

    WS_REGISTRY.lock().unwrap().clear();
}

#[tokio::test]
async fn websocket_broadcast_command_with_path_argument_is_not_treated_as_arithmetic() {
    let _guard = WS_TEST_MUTEX.lock().unwrap();
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

#[tokio::test]
async fn steps_after_if_block_continue_executing() {
    // Regression: when an if-condition is true and its body executes,
    // steps that follow the if block in the outer series must still run.
    use rune_runtime::rune_parser::parse_rune;

    let rune_code = r#"@Event /ws /test
run:
    x = 5
    if x == 5:
        x = 99
    after_if = 42
"#;
    let doc = parse_rune(rune_code).expect("parse");
    let section = doc.sections.get(0).unwrap();
    let steps = section.series.get("run").expect("run series").clone();

    let state = app_state();
    let mut ctx: Context = HashMap::new();

    execute_steps_inner(state, &steps, &mut ctx).await;

    assert_eq!(
        ctx.get("after_if").and_then(|v| v.as_f64()),
        Some(42.0),
        "step after if-block must execute even when the condition was true"
    );
    assert_eq!(
        ctx.get("x").and_then(|v| v.as_f64()),
        Some(99.0),
        "x should have been updated by the if body"
    );
}




