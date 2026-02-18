// src/builtins.rs

use crate::rune_parser::parse_rune;
use serde_json::Value as JsonValue;
use std::collections::HashMap;

pub mod builtin {
    pub mod commands;
    pub mod csv;
    pub mod data_source;
    pub mod log;
    pub mod memory;
    pub mod mysql;
    pub mod parse_json;
    pub mod postgres;
    pub mod respond;
    pub mod validate;
}

use crate::builtins::builtin::commands::builtin_append;
use crate::builtins::builtin::memory::{builtin_get_memory, builtin_set_memory};
use crate::core::AppState;
use crate::util::{json_to_xml, log, LogLevel};
use builtin::csv::{builtin_csv_append, builtin_csv_read, builtin_csv_write};
use builtin::data_source::builtin_data_source;
use builtin::log::builtin_log;
use builtin::parse_json::builtin_parse_json;
use builtin::respond::builtin_respond;
use builtin::validate::builtin_validate;

pub type Context = HashMap<String, JsonValue>;

#[derive(Debug)]
pub enum BuiltinResult {
    Ok,
    Respond(u16, String),
    Error(String),
}

// --- Builtin function declarations ---
pub fn builtin_load_rune(
    args: &[String],
    ctx: &mut Context,
    assign_to: Option<&str>,
    app_state: &AppState,
) -> BuiltinResult {
    use std::fs;
    if args.is_empty() {
        eprintln!("[ERROR] load-rune: missing filename");
        return BuiltinResult::Error("missing filename".to_string());
    }
    let filename = app_state.path.join(&args[0]);
    match fs::read_to_string(filename) {
        Ok(content) => {
            let rune_doc = match parse_rune(&content) {
                Ok(doc) => doc,
                Err(e) => {
                    return BuiltinResult::Error(format!("load-rune parse error: {}", e));
                }
            };
            if let Some(var_name) = assign_to {
                if args.len() >= 3 && &args[1] == "as" {
                    let output_type = &args[2];
                    if output_type == "xml" {
                        let xml_output = json_to_xml(&rune_doc.to_json(), "root");
                        ctx.insert(var_name.to_string(), JsonValue::String(xml_output));
                    } else {
                        return BuiltinResult::Respond(
                            400,
                            format!("load-rune: unsupported output type {}", output_type),
                        );
                    }
                } else {
                    ctx.insert(var_name.to_string(), rune_doc.to_json());
                }
            }
            BuiltinResult::Ok
        }
        Err(e) => {
            eprintln!("[ERROR] load-rune: {}", e);
            BuiltinResult::Error(format!("load-rune error: {}", e))
        }
    }
}

// --- Main dispatcher ---
pub async fn call_builtin(
    name: &str,
    args: &[String],
    ctx: &mut Context,
    app_state: &AppState,
    assign_to: Option<&str>,
) -> BuiltinResult {
    // Preprocess args: combine quoted strings and remove surrounding quotes
    let mut processed_args = Vec::new();
    let mut in_quotes = false;
    let mut current = String::new();

    for arg in args {
        if in_quotes {
            current.push(' ');
            current.push_str(arg);
            if arg.ends_with('"') && !arg.ends_with("\\\"") {
                in_quotes = false;
                // Remove surrounding quotes
                let trimmed = current.trim();
                if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2 {
                    processed_args.push(trimmed[1..trimmed.len() - 1].to_string());
                } else {
                    processed_args.push(current.clone());
                }
                current.clear();
            }
        } else if arg.starts_with('"') && !arg.ends_with('"') {
            in_quotes = true;
            current = arg.clone();
        } else if arg.starts_with('"') && arg.ends_with('"') && arg.len() >= 2 {
            // Remove surrounding quotes
            processed_args.push(arg[1..arg.len() - 1].to_string());
        } else {
            processed_args.push(arg.clone());
        }
    }
    if in_quotes && !current.is_empty() {
        // Unclosed quote, push as is
        processed_args.push(current);
    }
    let args = &processed_args;

    // Handle method-style calls like "users.find", "users.find-index", "users.remove"
    if let Some(dot_pos) = name.find('.') {
        let target = &name[..dot_pos];
        let method = &name[dot_pos + 1..];

        // Helper: resolve a simple comparison like "it.id == id" or "it.id != id"
        fn parse_comparison(expr_parts: &[String]) -> Option<(String, String, String)> {
            let joined = expr_parts.join(" ");
            if let Some(pos) = joined.find("==") {
                let (l, r) = joined.split_at(pos);
                return Some((
                    l.trim().to_string(),
                    "==".to_string(),
                    r[2..].trim().to_string(),
                ));
            }
            if let Some(pos) = joined.find("!=") {
                let (l, r) = joined.split_at(pos);
                return Some((
                    l.trim().to_string(),
                    "!=".to_string(),
                    r[2..].trim().to_string(),
                ));
            }
            None
        }

        fn parse_literal_or_number(s: &str) -> Option<JsonValue> {
            if s == "null" {
                return Some(JsonValue::Null);
            }
            if s == "true" {
                return Some(JsonValue::Bool(true));
            }
            if s == "false" {
                return Some(JsonValue::Bool(false));
            }
            if s.starts_with('"') && s.ends_with('"') && s.len() >= 2 {
                return Some(JsonValue::String(s[1..s.len() - 1].to_string()));
            }
            if let Ok(n) = s.parse::<f64>() {
                return Some(JsonValue::from(n));
            }
            None
        }

        fn resolve_path(ctx: &Context, it: Option<&JsonValue>, ident: &str) -> Option<JsonValue> {
            // Quoted/number/bool/null literal
            if let Some(lit) = parse_literal_or_number(ident) {
                return Some(lit);
            }
            // Dot path starting from `it`
            let mut parts = ident.split('.');
            let first = parts.next().unwrap_or("");
            let mut current: Option<JsonValue> = None;
            if first == "it" {
                current = it.cloned();
            } else if let Some(val) = ctx.get(first) {
                current = Some(val.clone());
            } else if let Some(JsonValue::Object(map)) = ctx.get("path.params") {
                if let Some(v) = map.get(first) {
                    current = Some(v.clone());
                }
            }
            for key in parts {
                match current.take() {
                    Some(JsonValue::Object(m)) => current = m.get(key).cloned(),
                    Some(_) | None => return None,
                }
            }
            current
        }

        fn eval_cmp(
            ctx: &Context,
            it: Option<&JsonValue>,
            left: &str,
            op: &str,
            right: &str,
        ) -> bool {
            let lv = resolve_path(ctx, it, left).unwrap_or(JsonValue::Null);
            let rv = resolve_path(ctx, it, right).unwrap_or(JsonValue::Null);

            // Helper to compare with light coercion between common types (e.g., "1" == 1)
            fn loose_eq(a: &JsonValue, b: &JsonValue) -> bool {
                // Fast path
                if a == b {
                    return true;
                }

                // Number <-> String numeric
                match (a, b) {
                    (JsonValue::Number(na), JsonValue::String(bs)) => {
                        if let Ok(parsed) = bs.parse::<f64>() {
                            if let Some(af) = na.as_f64() {
                                return af == parsed;
                            }
                        }
                        false
                    }
                    (JsonValue::String(as_), JsonValue::Number(nb)) => {
                        if let Ok(parsed) = as_.parse::<f64>() {
                            if let Some(bf) = nb.as_f64() {
                                return parsed == bf;
                            }
                        }
                        false
                    }
                    // Bool <-> String boolean
                    (JsonValue::Bool(ab), JsonValue::String(bs)) => {
                        if bs.eq_ignore_ascii_case("true") {
                            return *ab == true;
                        }
                        if bs.eq_ignore_ascii_case("false") {
                            return *ab == false;
                        }
                        false
                    }
                    (JsonValue::String(as_), JsonValue::Bool(bb)) => {
                        if as_.eq_ignore_ascii_case("true") {
                            return *bb == true;
                        }
                        if as_.eq_ignore_ascii_case("false") {
                            return *bb == false;
                        }
                        false
                    }
                    // Number <-> Bool (treat true=1, false=0)
                    (JsonValue::Number(n), JsonValue::Bool(b)) => {
                        if let Some(f) = n.as_f64() {
                            return (if *b { 1.0 } else { 0.0 }) == f;
                        }
                        false
                    }
                    (JsonValue::Bool(b), JsonValue::Number(n)) => {
                        if let Some(f) = n.as_f64() {
                            return (if *b { 1.0 } else { 0.0 }) == f;
                        }
                        false
                    }
                    // String numeric <-> String numeric (compare numerically to avoid "01" vs "1")
                    (JsonValue::String(as_), JsonValue::String(bs)) => {
                        if let (Ok(af), Ok(bf)) = (as_.parse::<f64>(), bs.parse::<f64>()) {
                            return af == bf;
                        }
                        false
                    }
                    _ => false,
                }
            }

            match op {
                "==" => loose_eq(&lv, &rv),
                "!=" => !loose_eq(&lv, &rv),
                _ => false,
            }
        }

        match method {
            "find" => {
                let arr = match ctx.get(target) {
                    Some(JsonValue::Array(a)) => a.clone(),
                    _ => Vec::new(),
                };
                let cmp = parse_comparison(args).or_else(|| {
                    // Fallback: if args already consolidated as a single string condition
                    if args.len() == 1 {
                        let s = &args[0];
                        if let Some(p) = s.find("==") {
                            return Some((
                                s[..p].trim().to_string(),
                                "==".to_string(),
                                s[p + 2..].trim().to_string(),
                            ));
                        }
                        if let Some(p) = s.find("!=") {
                            return Some((
                                s[..p].trim().to_string(),
                                "!=".to_string(),
                                s[p + 2..].trim().to_string(),
                            ));
                        }
                    }
                    None
                });
                if let Some((l, op, r)) = cmp {
                    let mut found: Option<JsonValue> = None;
                    for item in arr.iter() {
                        if eval_cmp(ctx, Some(item), &l, &op, &r) {
                            found = Some(item.clone());
                            break;
                        }
                    }
                    if let Some(var) = assign_to {
                        ctx.insert(var.to_string(), found.unwrap_or(JsonValue::Null));
                    }
                }
                return BuiltinResult::Ok;
            }
            "find-index" => {
                let arr = match ctx.get(target) {
                    Some(JsonValue::Array(a)) => a.clone(),
                    _ => Vec::new(),
                };
                let cmp = parse_comparison(args);
                let mut idx: i64 = -1;
                if let Some((l, op, r)) = cmp {
                    for (i, item) in arr.iter().enumerate() {
                        if eval_cmp(ctx, Some(item), &l, &op, &r) {
                            idx = i as i64;
                            break;
                        }
                    }
                }
                if let Some(var) = assign_to {
                    ctx.insert(var.to_string(), JsonValue::from(idx));
                }
                return BuiltinResult::Ok;
            }
            "max" => {
                let arr = match ctx.get(target) {
                    Some(JsonValue::Array(a)) => a.clone(),
                    _ => Vec::new(),
                };
                let mut max_val: f64 = f64::NEG_INFINITY;
                // Support both ["it", "id"] and ["it.id"]
                let field = if !args.is_empty() {
                    if args[0] == "it" {
                        args.get(1).map(|s| s.trim_start_matches('.'))
                    } else if args[0].starts_with("it.") {
                        Some(args[0].trim_start_matches("it."))
                    } else {
                        None
                    }
                } else {
                    None
                };

                for item in arr {
                    let val = if let Some(f) = field {
                        item.get(f).and_then(|v| v.as_f64()).unwrap_or(0.0)
                    } else {
                        item.as_f64().unwrap_or(0.0)
                    };
                    if val > max_val {
                        max_val = val;
                    }
                }
                let result = if max_val == f64::NEG_INFINITY {
                    0.0
                } else {
                    max_val
                };
                if let Some(var) = assign_to {
                    ctx.insert(var.to_string(), JsonValue::from(result));
                }
                return BuiltinResult::Ok;
            }
            "remove" => {
                if args.is_empty() {
                    return BuiltinResult::Error("remove: missing index".to_string());
                }
                let index_val = args[0].as_str();
                // Resolve index from context or parse number
                let idx = if let Some(JsonValue::Number(n)) = ctx.get(index_val) {
                    n.as_i64().unwrap_or(-1)
                } else if let Ok(n) = index_val.parse::<i64>() {
                    n
                } else {
                    -1
                };
                if let Some(JsonValue::Array(_)) = ctx.get(target) {
                    if let Some(arr) = ctx.get_mut(target).and_then(|v| v.as_array_mut()) {
                        if idx >= 0 {
                            let i = idx as usize;
                            if i < arr.len() {
                                arr.remove(i);
                            }
                        }
                    }
                }
                return BuiltinResult::Ok;
            }
            _ => {}
        }
    }

    match name {
        "log" => builtin_log(args),
        "respond" => builtin_respond(args, ctx),
        "parse-json" => builtin_parse_json(args, ctx, assign_to),
        "validate" => builtin_validate(args, ctx, &app_state.schemas),
        "csv.read" => builtin_csv_read(args, ctx, assign_to),
        "csv.write" => builtin_csv_write(args, ctx),
        "csv.append" => builtin_csv_append(args, ctx),
        "datasource" => builtin_data_source(args, ctx, &app_state, assign_to).await,
        "load-rune" => builtin_load_rune(args, ctx, assign_to, app_state),
        "set-memory" | "memory.set" => builtin_set_memory(args, ctx),
        "get-memory" | "memory.get" => builtin_get_memory(args, assign_to, ctx),
        "append" | "memory.append" => builtin_append(args, assign_to, ctx),
        "return" => {
            if args.is_empty() {
                eprintln!("[ERROR] return: missing value");
                BuiltinResult::Error("missing value".to_string())
            } else {
                if args.len() >= 3 && &args[1] == "as" {
                    let output_type = &args[2];
                    if output_type == "xml" {
                        let val = ctx
                            .get(args[0].as_str())
                            .map_or("".to_string(), |v| json_to_xml(v, "root"));
                        return BuiltinResult::Respond(200, val);
                    } else {
                        return BuiltinResult::Respond(
                            400,
                            format!("return: unsupported output type {}", output_type),
                        );
                    }
                }

                let val = ctx.get(args[0].as_str());
                match val {
                    Some(v) => {
                        if v.is_object() || v.is_array() {
                            BuiltinResult::Respond(
                                200,
                                serde_json::to_string(v).unwrap_or_default(),
                            )
                        } else {
                            BuiltinResult::Respond(200, v.to_string())
                        }
                    }
                    None => BuiltinResult::Respond(200, "".to_string()),
                }
            }
        }
        "#" => {
            // Comment, do nothing
            log(LogLevel::Debug, &format!("[COMMENT] {}", args.join(" ")));
            BuiltinResult::Ok
        }
        _ => {
            log(LogLevel::Error, &format!("unknown builtin: {}", name));
            BuiltinResult::Ok
        }
    }
}
