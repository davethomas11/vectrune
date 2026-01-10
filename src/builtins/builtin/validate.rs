use std::collections::HashMap;
use std::sync::Arc;

use crate::builtins::{BuiltinResult, Context};
use crate::rune_ast::Section;
use serde_json::Value as JsonValue;

pub fn builtin_validate(
    args: &[String],
    ctx: &Context,
    schemas: &Arc<HashMap<String, Section>>,
) -> BuiltinResult {
    if args.is_empty() {
        eprintln!("[ERROR] validate: missing arguments");
        return BuiltinResult::Error("missing arguments".to_string());
    }

    // Branch 1: Schema validation form -> validate body #Schema
    if args.len() >= 2 && args[1].starts_with('#') {
        let var = &args[0];
        let schema_name = args[1].trim_start_matches('#');
        let value = ctx.get(var);
        let schema = schemas.get(schema_name);
        if let (Some(val), Some(schema_section)) = (value, schema) {
            for (field, typ) in &schema_section.kv {
                if let Some(field_val) = val.get(field.clone()) {
                    let type_ok = match (typ.as_str(), field_val) {
                        (Some("string"), JsonValue::String(_)) => true,
                        (Some("number"), JsonValue::Number(_)) => true,
                        (Some("bool"), JsonValue::Bool(_)) => true,
                        _ => false,
                    };
                    if !type_ok {
                        return BuiltinResult::Respond(400, format!("Field `{}` type mismatch", field));
                    }
                } else {
                    return BuiltinResult::Respond(400, format!("Missing field `{}`", field));
                }
            }
            return BuiltinResult::Ok;
        } else {
            return BuiltinResult::Respond(400, "Validation failed".to_string());
        }
    }

    // Branch 2: Expression validation -> validate <left> <op> <right> "message"
    // Helpers
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
    fn resolve_path(ctx: &Context, ident: &str) -> Option<JsonValue> {
        if let Some(lit) = parse_literal_or_number(ident) { return Some(lit); }
        // Support dotted paths and special handling for path.params.*
        let mut parts = ident.split('.');
        let first = parts.next().unwrap_or("");
        let mut current: Option<JsonValue> = None;

        if first == "path" {
            if let Some(second) = parts.next() {
                if second == "params" {
                    if let Some(JsonValue::Object(map)) = ctx.get("path.params") {
                        current = Some(JsonValue::Object(map.clone()));
                    }
                } else if let Some(val) = ctx.get(&format!("path.{}", second)) {
                    current = Some(val.clone());
                }
            }
        } else if let Some(val) = ctx.get(first) {
            current = Some(val.clone());
        } else if let Some(JsonValue::Object(map)) = ctx.get("path.params") {
            // allow referencing param directly by name, e.g., `id`
            if let Some(v) = map.get(first) { current = Some(v.clone()); }
        }

        for key in parts {
            match current.take() {
                Some(JsonValue::Object(m)) => current = m.get(key).cloned(),
                _ => return None,
            }
        }
        current
    }

    // Expect at least 4 args: left, op, right, message
    if args.len() >= 4 {
        let left = args[0].as_str();
        let mut op = args[1].as_str().to_string();
        let mut right_index = 2usize;
        // Handle accidental split of '==' into '=' '='
        if op == "=" && args.len() >= 5 && args[2] == "=" {
            op = "==".to_string();
            right_index = 3;
        }
        let right = args[right_index].as_str();
        // Message may already be a single consolidated arg (quotes removed upstream)
        let msg = args[(right_index+1)..].join(" ");
        let lv = resolve_path(ctx, left).unwrap_or(JsonValue::Null);
        let rv = resolve_path(ctx, right).unwrap_or(JsonValue::Null);
        // Loose numeric equality for number <-> numeric string
        fn loose_eq(a: &JsonValue, b: &JsonValue) -> bool {
            if a == b { return true; }
            match (a, b) {
                (JsonValue::Number(na), JsonValue::String(sb)) => {
                    if let Some(da) = na.as_f64() { return sb.parse::<f64>().ok().map(|db| db == da).unwrap_or(false); }
                    false
                }
                (JsonValue::String(sa), JsonValue::Number(nb)) => {
                    if let Some(db) = nb.as_f64() { return sa.parse::<f64>().ok().map(|da| da == db).unwrap_or(false); }
                    false
                }
                _ => false,
            }
        }
        let ok = match op.as_str() {
            "==" => loose_eq(&lv, &rv),
            "!=" => !loose_eq(&lv, &rv),
            _ => false,
        };
        if ok { BuiltinResult::Ok } else { BuiltinResult::Respond(400, msg) }
    } else {
        eprintln!("[ERROR] validate: invalid expression arguments");
        BuiltinResult::Error("invalid expression arguments".to_string())
    }
}