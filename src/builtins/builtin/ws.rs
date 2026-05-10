use crate::builtins::{BuiltinResult, Context};
use crate::apps::rest::ws::{broadcast, send_to};
use serde_json::Value as JsonValue;
use crate::util::{LogLevel, log};

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

// This function will take args like ["{", "key1", ":", "value1", ",", "key2", ":", "value2", "}"]
// and parse it into a JSON string like {"key1": "value1", "key2": "value2"}.
// It will also evaluate any variables in the args by looking them up in ctx, and if not found,
// use the literal string. It will also support quoted strings to allow for spaces in values,
// like ["{", "key1", ":", "\"value with spaces\"", "}"] -> {"key1": "value with spaces"}
fn parse_args_to_message(args: &[String], ctx: &Context) -> String {
    let mut msg = String::new();
    for part in args {
        if part == "{" || part == "}" || part == "[" || part == "]" || part == ":" || part == "," {
            msg.push_str(part);
            continue;
        }
        // Return part if wrapped in quotes
        if (part.starts_with('"') && part.ends_with('"')) || (part.starts_with('\'') && part.ends_with('\'')) {
            msg.push_str(&part[1..part.len()-1]);
            continue;
        }
        // Otherwise, look up in ctx or use literal
        if let Some(val) = ctx.get(part) {
            if val.is_string() {
                msg.push_str(val.as_str().unwrap());
            } else {
                msg.push_str(&val.to_string());
            }
        } else {
            msg.push_str(part);
        }
    }
    msg
}

pub async fn builtin_ws_send(args: &[String], ctx: &Context) -> BuiltinResult {
    if args.len() < 3 {
        return BuiltinResult::Error("ws.send requires <path> <ws_id> <message>".to_string());
    }
    log(LogLevel::Debug, &format!("ws.send called with args: {:?}", args));

    let path = &args[0];
    let ws_id = ctx
        .get(&args[1])
        .and_then(|v| v.as_str())
        .unwrap_or(&args[1]);

    let msg_content = parse_args_to_message(&args[2..], ctx);

    send_to(path, ws_id, msg_content);
    BuiltinResult::Ok
}

pub async fn builtin_ws_broadcast(args: &[String], ctx: &Context) -> BuiltinResult {
    log(LogLevel::Debug, &format!("ws.broadcast called with args: {:?}", args));
    if args.len() < 2 {
        return BuiltinResult::Error("ws.broadcast requires <path> <message>".to_string());
    }
    let path = &args[0];
    let msg_content = parse_args_to_message(&args[1..], ctx);
    log(LogLevel::Debug, &format!("ws.broadcast being called with path: {}, message: {}", path, msg_content));

    broadcast(path, msg_content);
    BuiltinResult::Ok
}
