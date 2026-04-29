use crate::builtins::{BuiltinResult, Context};
use crate::core::{resolve_path, split_path_parts};
use serde_json::Value as JsonValue;

pub fn builtin_delete(args: &[String], ctx: &mut Context) -> BuiltinResult {
    if args.is_empty() {
        return BuiltinResult::Error("delete: missing variable name".to_string());
    }
    let var_name = &args[0];

    if var_name.contains('.') || var_name.contains('[') {
        delete_path(ctx, var_name);
    } else {
        ctx.remove(var_name);
    }

    BuiltinResult::Ok
}

fn delete_path(ctx: &mut Context, ident: &str) {
    let raw_parts = split_path_parts(ident);
    let mut parts = Vec::with_capacity(raw_parts.len());

    for part in raw_parts {
        if part.starts_with('[') && part.ends_with(']') {
            let inner_expr = &part[1..part.len() - 1];
            parts.push(format!("[{}]", inner_expr));
        } else {
            parts.push(part);
        }
    }

    if parts.is_empty() {
        return;
    }

    let first = parts[0].clone();
    if parts.len() == 1 {
        ctx.remove(&first);
        return;
    }

    if let Some(root) = ctx.get_mut(&first) {
        let mut current: *mut JsonValue = root as *mut _;

        for j in 1..parts.len() - 1 {
            let key = &parts[j];
            unsafe {
                if key.starts_with('[') && key.ends_with(']') {
                    if let serde_json::Value::Object(m) = &mut *current {
                        let inner = &key[1..key.len() - 1];
                        let resolved_key = resolve_path(ctx, inner, None)
                            .and_then(|v| v.as_str().map(|s| s.to_string()))
                            .unwrap_or_else(|| inner.trim_matches('"').to_string());
                        if !m.contains_key(&resolved_key) {
                            return;
                        }
                        current = m.get_mut(&resolved_key).unwrap() as *mut _;
                    } else {
                        return;
                    }
                } else if let serde_json::Value::Object(m) = &mut *current {
                    if !m.contains_key(key) {
                        return;
                    }
                    current = m.get_mut(key).unwrap() as *mut _;
                } else {
                    return;
                }
            }
        }

        let last_key = &parts[parts.len() - 1];
        unsafe {
            if last_key.starts_with('[') && last_key.ends_with(']') {
                if let serde_json::Value::Object(m) = &mut *current {
                    let inner = &last_key[1..last_key.len() - 1];
                    let resolved_key = resolve_path(ctx, inner, None)
                        .and_then(|v| v.as_str().map(|s| s.to_string()))
                        .unwrap_or_else(|| inner.trim_matches('"').to_string());
                    m.remove(&resolved_key);
                }
            } else if let serde_json::Value::Object(m) = &mut *current {
                m.remove(last_key);
            }
        }
    }
}

pub fn builtin_is_set(args: &[String], ctx: &mut Context, assign_to: Option<&str>) -> BuiltinResult {
    if args.is_empty() {
        return BuiltinResult::Error("is-set: missing variable name".to_string());
    }
    let var_name = &args[0];

    let is_exists = if var_name.contains('.') || var_name.contains('[') {
        resolve_path(ctx, var_name, None).is_some()
    } else {
        ctx.contains_key(var_name)
    };

    if let Some(target) = assign_to {
        ctx.insert(target.to_string(), JsonValue::Bool(is_exists));
    }

    BuiltinResult::Ok
}








