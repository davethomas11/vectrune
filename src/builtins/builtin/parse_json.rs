use crate::builtins::{BuiltinResult, Context};
use serde_json::Value as JsonValue;

pub fn builtin_parse_json(ctx: &mut Context) -> BuiltinResult {
    if let Some(JsonValue::String(s)) = ctx.get("body") {
        match serde_json::from_str::<JsonValue>(s) {
            Ok(v) => {
                ctx.insert("body".to_string(), v);
            }
            Err(e) => {
                eprintln!("[ERROR] parse-json: {}", e);
                return BuiltinResult::Error(format!("parse-json error: {}", e));
            }
        }
    }
    BuiltinResult::Ok
}