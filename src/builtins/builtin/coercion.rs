// src/builtins/builtin/coercion.rs
// Type coercion, UUID generation, and timestamp utilities for Vectrune.

use crate::builtins::{BuiltinResult, Context};
use crate::core::resolve_path;
use serde_json::Value as JsonValue;

pub fn builtin_to_number(
    args: &[String],
    assign_to: Option<&str>,
    ctx: &mut Context,
) -> BuiltinResult {
    let input = if let Some(arg) = args.first() {
        if let Some(v) = resolve_path(ctx, arg, None) {
            match v {
                JsonValue::Number(n) => Some(n),
                JsonValue::String(s) => s
                    .trim()
                    .parse::<f64>()
                    .ok()
                    .and_then(serde_json::Number::from_f64),
                JsonValue::Bool(b) => Some((if b { 1 } else { 0 }).into()),
                _ => None,
            }
        } else {
            arg.trim()
                .parse::<f64>()
                .ok()
                .and_then(serde_json::Number::from_f64)
        }
    } else {
        None
    };

    let result = input.map(JsonValue::Number).unwrap_or(JsonValue::Null);
    if let Some(target) = assign_to {
        ctx.insert(target.to_string(), result);
    }
    BuiltinResult::Ok
}

pub fn builtin_to_string(
    args: &[String],
    assign_to: Option<&str>,
    ctx: &mut Context,
) -> BuiltinResult {
    let s = if let Some(arg) = args.first() {
        if let Some(v) = resolve_path(ctx, arg, None) {
            match v {
                JsonValue::String(s) => s,
                other => other.to_string(),
            }
        } else {
            arg.trim_matches('"').to_string()
        }
    } else {
        String::new()
    };
    if let Some(target) = assign_to {
        ctx.insert(target.to_string(), JsonValue::String(s));
    }
    BuiltinResult::Ok
}

pub fn builtin_to_bool(
    args: &[String],
    assign_to: Option<&str>,
    ctx: &mut Context,
) -> BuiltinResult {
    let b = if let Some(arg) = args.first() {
        if let Some(v) = resolve_path(ctx, arg, None) {
            match v {
                JsonValue::Bool(b) => b,
                JsonValue::Number(n) => n.as_f64().map_or(false, |num| num != 0.0),
                JsonValue::String(s) => s.eq_ignore_ascii_case("true") || s == "1",
                JsonValue::Null => false,
                _ => true,
            }
        } else {
            arg.eq_ignore_ascii_case("true") || arg == "1"
        }
    } else {
        false
    };
    if let Some(target) = assign_to {
        ctx.insert(target.to_string(), JsonValue::Bool(b));
    }
    BuiltinResult::Ok
}

pub fn builtin_uuid_v4(
    _args: &[String],
    assign_to: Option<&str>,
    ctx: &mut Context,
) -> BuiltinResult {
    let new_uuid = uuid::Uuid::new_v4().to_string();
    if let Some(target) = assign_to {
        ctx.insert(target.to_string(), JsonValue::String(new_uuid));
    }
    BuiltinResult::Ok
}

pub fn builtin_now(
    args: &[String],
    assign_to: Option<&str>,
    ctx: &mut Context,
) -> BuiltinResult {
    let format = args.first().map(|s| s.trim_matches('"').to_lowercase());
    let result = match format.as_deref() {
        Some("millis") => JsonValue::Number(chrono::Utc::now().timestamp_millis().into()),
        Some("unix") | Some("seconds") => {
            JsonValue::Number(chrono::Utc::now().timestamp().into())
        }
        _ => JsonValue::String(chrono::Utc::now().to_rfc3339()),
    };
    if let Some(target) = assign_to {
        ctx.insert(target.to_string(), result);
    }
    BuiltinResult::Ok
}
