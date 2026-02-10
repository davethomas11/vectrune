use crate::builtins::{BuiltinResult, Context};
use serde_json::Value as JsonValue;

pub fn builtin_append(
    args: &[String],
    assign_to: Option<&str>,
    ctx: &mut Context,
) -> BuiltinResult {
    if args.len() < 2 {
        eprintln!("[ERROR] append: missing arguments");
        return BuiltinResult::Error("missing arguments".to_string());
    }
    let var_name = &args[0];
    let value_str = &args[1];
    let value = match ctx.get(value_str) {
        Some(v) => v.clone(),
        None => JsonValue::String(value_str.into()),
    };
    // Save a copy of the value to be appended, to avoid accidental overwrite
    let appended_value = value.clone();
    let mut target = ctx.get(var_name);
    if var_name.contains('.') {
        let parts: Vec<&str> = var_name.split('.').collect();
        target = ctx.get(parts[0]);
        for key in &parts[1..] {
            if let Some(JsonValue::Object(map)) = target {
                target = map.get(*key);
            } else {
                target = None;
                eprintln!("[ERROR] append: variable '{}' is not an object. Parts: {:#?}, Key with issue: {}", var_name, parts, key);
                break;
            }
        }
    }

    match target {
        Some(JsonValue::Array(arr)) => {
            let mut new_arr = arr.clone();
            if var_name.contains('.') {
                let parts: Vec<&str> = var_name.split('.').collect();
                if let Some(JsonValue::Object(mut map)) = ctx.get(parts[0]).cloned() {
                    let mut current_map = &mut map;
                    for key in &parts[1..parts.len()-1] {
                        current_map = match current_map.get_mut(*key) {
                            Some(JsonValue::Object(inner_map)) => inner_map,
                            _ => {
                                eprintln!("[ERROR] append: variable '{}' is not an object at key '{}'", var_name, key);
                                return BuiltinResult::Error(format!("variable '{}' is not an object at key '{}'", var_name, key));
                            }
                        };
                    }
                    let last_key = parts.last().unwrap();
                    if let Some(JsonValue::Array(arr)) = current_map.get_mut(*last_key) {
                        arr.push(value.clone());
                    } else {
                        eprintln!("[ERROR] append: variable '{}' is not an array at key '{}'", var_name, last_key);
                        return BuiltinResult::Error(format!("variable '{}' is not an array at key '{}'", var_name, last_key));
                    }
                    ctx.insert(parts[0].to_string(), JsonValue::Object(map));
                }
            } else {
                new_arr.push(appended_value);
                ctx.insert(var_name.into(), JsonValue::Array(new_arr));
            }
            // If this is a memory-backed variable, update global memory as well
            if let Some(mem_mod) = var_name.strip_prefix("memory.") {
                crate::builtins::builtin::memory::set_memory(mem_mod, ctx.get(var_name).unwrap().clone());
            }
        }
        Some(_) => {
            eprintln!("[ERROR] append: variable '{}' is not an array", var_name);
            return BuiltinResult::Error(format!("variable '{}' is not an array", var_name));
        }
        None => {
            eprintln!("[ERROR] append: variable '{}' not found", var_name);
            return BuiltinResult::Error(format!("variable '{}' not found", var_name));
        }
    }
    if let Some(target) = assign_to {
        if let Some(val) = ctx.get(var_name) {
            ctx.insert(target.to_string(), val.clone());
        }
    }
    BuiltinResult::Ok
}
