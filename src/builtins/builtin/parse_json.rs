use crate::builtins::{BuiltinResult, Context};
use serde_json::Value as JsonValue;

pub fn builtin_parse_json(
    args: &[String],
    ctx: &mut Context,
    assign_to: Option<&str>,
) -> BuiltinResult {
    let value = if args.is_empty() { "body" } else { &args[0] };

    let target = if let Some(var_name) = assign_to {
        var_name
    } else {
        "body"
    };

    if let Some(JsonValue::String(s)) = ctx.get(value) {
        match serde_json::from_str::<JsonValue>(s) {
            Ok(v) => {
                ctx.insert(target.into(), v);
            }
            Err(e) => {
                eprintln!("[ERROR] parse-json: {}", e);
                return BuiltinResult::Error(format!("parse-json error: {}", e));
            }
        }
    }
    BuiltinResult::Ok
}
