use crate::builtins::{BuiltinResult, Context, LAST_EXEC_RESULT};
use crate::core::resolve_path;
use crate::util::{LogLevel, log};
use regex::Regex;

fn json_value_to_log_string(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}

fn expand_log_message(message: &str, ctx: &Context) -> String {
    let placeholder_regex = Regex::new(r"\{([^{}]+)\}").unwrap();

    placeholder_regex
        .replace_all(message, |captures: &regex::Captures| {
            let whole = captures.get(0).map(|m| m.as_str()).unwrap_or_default();
            let ident = captures.get(1).map(|m| m.as_str().trim()).unwrap_or_default();

            resolve_path(ctx, ident, None)
                .map(|value| json_value_to_log_string(&value))
                .unwrap_or_else(|| whole.to_string())
        })
        .into_owned()
}

pub fn builtin_log(args: &[String], ctx: &mut Context) -> BuiltinResult {
    let message = expand_log_message(&args.join(" "), ctx);
    log(LogLevel::Info, &message);
    ctx.insert(LAST_EXEC_RESULT.to_string(), message.clone().into());
    BuiltinResult::Ok
}

#[cfg(test)]
#[path = "logger_tests.rs"]
mod tests;

