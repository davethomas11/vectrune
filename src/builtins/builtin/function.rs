use serde_json::Value;
use crate::core::AppState;
use crate::builtins::{Context, LAST_EXEC_RESULT};
use crate::builtins::BuiltinResult;
use crate::core::execute_steps_inner;
use crate::util::{log, LogLevel};

pub async fn builtin_func(args: &[String], ctx: &mut Context) -> BuiltinResult {
    // First arg is function name, rest are steps
    if args.is_empty() {
        return BuiltinResult::Error("Function name required".to_string());
    }
    let name = &args[0];
    // Join all args after the name into a single string, then split by ';'
    let steps_str = args[1..].join(" ");
    let mut steps: Vec<serde_json::Value> = Vec::new();
    for step in steps_str.split(';') {
        let step = step.trim();
        if !step.is_empty() {
            steps.push(serde_json::Value::String(step.to_string()));
        }
    }
    log(LogLevel::Debug, &format!("Defining function '{}', steps: {:#?}", name, steps.clone()));
    ctx.insert(
        format!("func:{}", name),
        serde_json::Value::Array(steps.clone()),
    );
    ctx.insert(LAST_EXEC_RESULT.to_string(), serde_json::Value::String(format!("Function '{}': {:#?}", name, steps)));
    BuiltinResult::Ok
}

pub async fn invoke_func(appstate: &AppState, name: &str, ctx: &mut Context, args: &[String], assign_to: Option<&str>) -> BuiltinResult {
    // Optionally support argument substitution: $1, $2, ...
    let mut local_ctx = ctx.clone();
    for (i, arg) in args.iter().enumerate() {
        log(LogLevel::Debug, &format!("Defining function '{}', arguments: {:#?}, value: {}", name, i + 1, arg));
        local_ctx.insert(format!("${}", i + 1), arg.clone().into());
    }

    let function_data = ctx.get(&format!("func:{}", name));
    if let Some(serde_json::Value::Array(steps_json)) = function_data {
        // Convert steps_json to Vec<Value>
        let steps: Vec<crate::rune_ast::Value> = steps_json.iter().filter_map(|v| {
            if let serde_json::Value::String(s) = v {
                Some(crate::rune_ast::Value::String(s.clone()))
            } else {
                None
            }
        }).collect();
        let result = execute_steps_inner(appstate.clone(), &steps, &mut local_ctx).await;
        for (k, v) in local_ctx.iter() {
            if !k.starts_with('$') {
                ctx.insert(k.clone(), v.clone());
            }
        }
        if let Some((_, resp)) = result {
            ctx.insert(LAST_EXEC_RESULT.to_string(), Value::String(resp.clone()));
            if let Some(target) = assign_to {
                ctx.insert(target.to_string(), Value::String(resp));
            }
            return BuiltinResult::Ok
        }
        BuiltinResult::Ok
    } else {
        BuiltinResult::Error(format!("Function '{}' not found or invalid", name))
    }
}