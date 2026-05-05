use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
};
use crate::core::{execute_steps, AppState};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use once_cell::sync::Lazy;
use std::sync::Mutex;
use uuid::Uuid;
use futures::{SinkExt, StreamExt};

pub struct WsConnection {
    pub tx: mpsc::UnboundedSender<Message>,
}

pub type WsRegistry = Arc<Mutex<HashMap<String, HashMap<Uuid, WsConnection>>>>;

pub static WS_REGISTRY: Lazy<WsRegistry> = Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    state: AppState,
    path: String,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state, path))
}

async fn handle_socket(socket: WebSocket, state: AppState, path: String) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel();
    let conn_id = Uuid::new_v4();

    // Register connection
    {
        let mut registry = WS_REGISTRY.lock().unwrap();
        registry.entry(path.clone()).or_default().insert(conn_id, WsConnection { tx });
    }

    // Spawn a task to send messages to the socket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if let Err(_) = sender.send(msg).await {
                break;
            }
        }
    });

    // Handle on_connect
    let normalized_path = path.trim_start_matches('/');
    if let Some(ws_section) = state.doc.sections.iter().find(|s| {
        s.path.len() >= 2 && s.path[0] == "Websocket" && s.path[1] == normalized_path
    }) {
        if let Some(steps) = ws_section.series.get("on_connect") {
            let mut params = HashMap::new();
            params.insert("ws_id".to_string(), conn_id.to_string());
            execute_steps(state.clone(), steps.clone(), None, Some(params)).await;
        }
    }

    // Receive messages
    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            handle_message(text.to_string(), conn_id, &state, normalized_path).await;
        }
    }

    // Handle on_disconnect
    if let Some(ws_section) = state.doc.sections.iter().find(|s| {
        s.path.len() >= 2 && s.path[0] == "Websocket" && s.path[1] == normalized_path
    }) {
        if let Some(steps) = ws_section.series.get("on_disconnect") {
            let mut params = HashMap::new();
            params.insert("ws_id".to_string(), conn_id.to_string());
            execute_steps(state.clone(), steps.clone(), None, Some(params)).await;
        }
    }

    // Unregister connection
    {
        let mut registry = WS_REGISTRY.lock().unwrap();
        if let Some(clients) = registry.get_mut(&path) {
            clients.remove(&conn_id);
        }
    }
    send_task.abort();
}

async fn handle_message(text: String, conn_id: Uuid, state: &AppState, path: &str) {
    let json: serde_json::Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(_) => {
            // If not JSON, maybe just run a generic on_message handler
            run_generic_on_message(text, conn_id, state, path).await;
            return;
        }
    };

    let event_type = json.get("type").and_then(|v| v.as_str());
    if let Some(t) = event_type {
        // Try to find @Event /ws /t
        // Note: path already includes the leading /, but we need to normalize both for comparison
        let normalized_event = t.trim_start_matches('/');
        let normalized_path = path.trim_start_matches('/');
        let event_path = vec!["Event".to_string(), normalized_path.to_string(), normalized_event.to_string()];
        if let Some(event_section) = state.doc.sections.iter().find(|s| s.path == event_path) {
            if let Some(steps) = event_section.series.get("run") {
                let mut params = HashMap::new();
                params.insert("ws_id".to_string(), conn_id.to_string());
                // Flatten the JSON body into context for easier access
                if let serde_json::Value::Object(obj) = &json {
                    for (k, v) in obj {
                        params.insert(k.clone(), v.to_string());
                    }
                }
                execute_steps(state.clone(), steps.clone(), Some(text), Some(params)).await;
                return;
            }
        }
    }

    run_generic_on_message(text, conn_id, state, path).await;
}

async fn run_generic_on_message(text: String, conn_id: Uuid, state: &AppState, path: &str) {
     // path is already normalized (no leading /), so we can compare directly
     if let Some(ws_section) = state.doc.sections.iter().find(|s| s.path.len() >= 2 && s.path[0] == "Websocket" && s.path[1] == path) {
        if let Some(steps) = ws_section.series.get("on_message") {
            let mut params = HashMap::new();
            params.insert("ws_id".to_string(), conn_id.to_string());
            execute_steps(state.clone(), steps.clone(), Some(text), Some(params)).await;
        }
    }
}

pub fn broadcast(path: &str, msg: String) {
    let registry = WS_REGISTRY.lock().unwrap();
    if let Some(clients) = registry.get(path) {
        for conn in clients.values() {
            let _ = conn.tx.send(Message::Text(msg.clone().into()));
        }
    }
}

pub fn send_to(path: &str, conn_id: &str, msg: String) {
    let registry = WS_REGISTRY.lock().unwrap();
    if let Some(clients) = registry.get(path) {
        if let Ok(uuid) = Uuid::parse_str(conn_id) {
            if let Some(conn) = clients.get(&uuid) {
                let _ = conn.tx.send(Message::Text(msg.into()));
            }
        }
    }
}
