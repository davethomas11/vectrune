use crate::builtins::{BuiltinResult, Context};
use crate::apps::rest::ws::{broadcast, send_to};
use serde_json::Value as JsonValue;

pub async fn builtin_ws_id(ctx: &mut Context, assign_to: Option<&str>) -> BuiltinResult {
    if let Some(var) = assign_to {
        if let Some(ws_id) = ctx.get("ws_id").and_then(|v| v.as_str()) {
            ctx.insert(var.to_string(), JsonValue::String(ws_id.to_string()));
        } else {
            ctx.insert(var.to_string(), JsonValue::Null);
        }
    }
    BuiltinResult::Ok
}

pub async fn builtin_ws_send(args: &[String], ctx: &Context) -> BuiltinResult {
    if args.len() < 3 {
        return BuiltinResult::Error("ws.send requires <path> <ws_id> <message>".to_string());
    }
    let path = &args[0];
    let ws_id = &args[1];
    let msg = &args[2];

    // If msg is a variable in ctx, use its value
    let msg_content = if let Some(val) = ctx.get(msg) {
        if val.is_string() {
            val.as_str().unwrap().to_string()
        } else {
            val.to_string()
        }
    } else {
        msg.clone()
    };

    send_to(path, ws_id, msg_content);
    BuiltinResult::Ok
}

pub async fn builtin_ws_broadcast(args: &[String], ctx: &Context) -> BuiltinResult {
    if args.len() < 2 {
        return BuiltinResult::Error("ws.broadcast requires <path> <message>".to_string());
    }
    let path = &args[0];
    let msg = &args[1];

    let msg_content = if let Some(val) = ctx.get(msg) {
        if val.is_string() {
            val.as_str().unwrap().to_string()
        } else {
            val.to_string()
        }
    } else {
        msg.clone()
    };

    broadcast(path, msg_content);
    BuiltinResult::Ok
}
