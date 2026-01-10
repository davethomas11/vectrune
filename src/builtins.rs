// src/builtins.rs

use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::sync::Arc;
use crate::rune_ast::Section;

mod builtin {
    pub mod log;
    pub mod respond;
    pub mod parse_json;
    pub mod validate;
    pub mod csv;
}

use builtin::log::builtin_log;
use builtin::respond::builtin_respond;
use builtin::parse_json::builtin_parse_json;
use builtin::validate::builtin_validate;
use builtin::csv::{builtin_csv_read, builtin_csv_write, builtin_csv_append};

pub type Context = HashMap<String, JsonValue>;

#[derive(Debug)]
pub enum BuiltinResult {
    Ok,
    Respond(u16, String),
    Error(String),
}

// --- Builtin function declarations ---



// --- Main dispatcher ---
pub fn call_builtin(
    name: &str,
    args: &[String],
    ctx: &mut Context,
    schemas: Arc<HashMap<String, Section>>,
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
                    processed_args.push(trimmed[1..trimmed.len()-1].to_string());
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
            processed_args.push(arg[1..arg.len()-1].to_string());
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
                return Some((l.trim().to_string(), "==".to_string(), r[2..].trim().to_string()));
            }
            if let Some(pos) = joined.find("!=") {
                let (l, r) = joined.split_at(pos);
                return Some((l.trim().to_string(), "!=".to_string(), r[2..].trim().to_string()));
            }
            None
        }

        fn parse_literal_or_number(s: &str) -> Option<JsonValue> {
            if s == "null" { return Some(JsonValue::Null); }
            if s == "true" { return Some(JsonValue::Bool(true)); }
            if s == "false" { return Some(JsonValue::Bool(false)); }
            if s.starts_with('"') && s.ends_with('"') && s.len() >= 2 {
                return Some(JsonValue::String(s[1..s.len()-1].to_string()));
            }
            if let Ok(n) = s.parse::<f64>() { return Some(JsonValue::from(n)); }
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

        fn eval_cmp(ctx: &Context, it: Option<&JsonValue>, left: &str, op: &str, right: &str) -> bool {
            let lv = resolve_path(ctx, it, left).unwrap_or(JsonValue::Null);
            let rv = resolve_path(ctx, it, right).unwrap_or(JsonValue::Null);

            // Helper to compare with light coercion between common types (e.g., "1" == 1)
            fn loose_eq(a: &JsonValue, b: &JsonValue) -> bool {
                // Fast path
                if a == b { return true; }

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
                        if bs.eq_ignore_ascii_case("true") { return *ab == true; }
                        if bs.eq_ignore_ascii_case("false") { return *ab == false; }
                        false
                    }
                    (JsonValue::String(as_), JsonValue::Bool(bb)) => {
                        if as_.eq_ignore_ascii_case("true") { return *bb == true; }
                        if as_.eq_ignore_ascii_case("false") { return *bb == false; }
                        false
                    }
                    // Number <-> Bool (treat true=1, false=0)
                    (JsonValue::Number(n), JsonValue::Bool(b)) => {
                        if let Some(f) = n.as_f64() { return (if *b {1.0} else {0.0}) == f; }
                        false
                    }
                    (JsonValue::Bool(b), JsonValue::Number(n)) => {
                        if let Some(f) = n.as_f64() { return (if *b {1.0} else {0.0}) == f; }
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
                let arr = match ctx.get(target) { Some(JsonValue::Array(a)) => a.clone(), _ => Vec::new() };
                let cmp = parse_comparison(args).or_else(|| {
                    // Fallback: if args already consolidated as a single string condition
                    if args.len() == 1 {
                        let s = &args[0];
                        if let Some(p) = s.find("==") {
                            return Some((s[..p].trim().to_string(), "==".to_string(), s[p+2..].trim().to_string()));
                        }
                        if let Some(p) = s.find("!=") {
                            return Some((s[..p].trim().to_string(), "!=".to_string(), s[p+2..].trim().to_string()));
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
                let arr = match ctx.get(target) { Some(JsonValue::Array(a)) => a.clone(), _ => Vec::new() };
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
            "remove" => {
                if args.is_empty() { return BuiltinResult::Error("remove: missing index".to_string()); }
                let index_val = args[0].as_str();
                // Resolve index from context or parse number
                let idx = if let Some(JsonValue::Number(n)) = ctx.get(index_val) {
                    n.as_i64().unwrap_or(-1)
                } else if let Ok(n) = index_val.parse::<i64>() { n } else { -1 };
                if let Some(JsonValue::Array(_)) = ctx.get(target) {
                    if let Some(arr) = ctx.get_mut(target).and_then(|v| v.as_array_mut()) {
                        if idx >= 0 {
                            let i = idx as usize;
                            if i < arr.len() { arr.remove(i); }
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
        "parse-json" => builtin_parse_json(ctx),
        "validate" => builtin_validate(args, ctx, &schemas),
        "csv.read" => builtin_csv_read(args, ctx, assign_to),
        "csv.write" => builtin_csv_write(args, ctx),
        "csv.append" => builtin_csv_append(args, ctx),
        _ => {
            eprintln!("[WARN] unknown builtin: {}", name);
            BuiltinResult::Ok
        }
    }
}
