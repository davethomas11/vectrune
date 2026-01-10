use crate::builtins::{BuiltinResult, Context};

pub fn builtin_respond(args: &[String], ctx: &Context) -> BuiltinResult {
    let status: u16 = args.get(0).and_then(|s| s.parse().ok()).unwrap_or(200);
    let msg = if args.len() > 1 {
        if let Some(val) = ctx.get(&args[1]) {
            val.to_string()
        } else {
            args[1..].join(" ")
        }
    } else {
        "OK".to_string()
    };
    BuiltinResult::Respond(status, msg)
}