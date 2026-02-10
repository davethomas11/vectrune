use crate::builtins::{call_builtin, BuiltinResult, Context};
use crate::rune_ast::{RuneDocument, Section, Value};
use async_recursion::async_recursion;
use axum::{
    http::StatusCode,
};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use axum::{middleware::Next, response::Response, http::Request};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use crate::util::{log, LogLevel};

#[derive(Clone)]
pub struct AppState {
    pub doc: Arc<RuneDocument>,
    pub schemas: Arc<HashMap<String, Section>>, // For @Schema
    pub data_sources: Arc<HashMap<String, Section>>, // For @Datasource
    pub path: PathBuf,               // Path to the rune document
}

pub fn get_app_type(doc: &RuneDocument) -> Option<String> {
    for section in &doc.sections {
        if section.path.first().map(|s| s.as_str()) == Some("App") {
            if let Some(Value::String(app_type)) = section.kv.get("type") {
                return Some(app_type.clone());
            }
        }
    }
    None
}

pub fn extract_schemas(doc: &RuneDocument) -> HashMap<String, Section> {
    let mut schemas = HashMap::new();
    for section in &doc.sections {
        if section.path.first().map(|s| s.as_str()) == Some("Schema") {
            if let Some(name) = section.path.get(1) {
                schemas.insert(name.clone(), section.clone());
            }
        }
    }
    schemas
}

pub fn extract_data_sources(doc: &RuneDocument) -> HashMap<String, Section> {
    let mut data_sources = HashMap::new();
    for section in &doc.sections {
        if section.path.first().map(|s| s.as_str()) == Some("DataSource") {
            if let Some(name) = section.path.get(1) {
                data_sources.insert(name.clone(), section.clone());
            }
        }
    }
    data_sources
}

pub fn extract_auth_configs(doc: &RuneDocument) -> HashMap<String, Section> {
    let mut auths = HashMap::new();
    for section in &doc.sections {
        if section.path.first().map(|s| s.as_str()) == Some("Authentication") {
            if let Some(name) = section.path.get(1) {
                auths.insert(name.clone(), section.clone());
            }
        }
    }
    auths
}

// Helper to resolve simple literals and dotted paths in context
pub fn resolve_path(
    ctx: &Context,
    ident: &str,
    it: Option<&serde_json::Value>,
) -> Option<serde_json::Value> {
    // literals
    if ident == "null" {
        return Some(serde_json::Value::Null);
    }
    if ident == "true" {
        return Some(serde_json::Value::Bool(true));
    }
    if ident == "false" {
        return Some(serde_json::Value::Bool(false));
    }
    if ident.starts_with('"') && ident.ends_with('"') && ident.len() >= 2 {
        return Some(serde_json::Value::String(
            ident[1..ident.len() - 1].to_string(),
        ));
    }
    if let Ok(n) = ident.parse::<f64>() {
        return Some(serde_json::Value::from(n));
    }

    let mut parts = ident.split('.');
    let first = parts.next().unwrap_or("");
    let mut current: Option<serde_json::Value> = None;
    if first == "it" {
        current = it.cloned();
    } else if let Some(val) = ctx.get(first) {
        current = Some(val.clone());
    } else if let Some(serde_json::Value::Object(map)) = ctx.get("path.params") {
        if let Some(v) = map.get(first) {
            current = Some(v.clone());
        }
    }
    for key in parts {
        match current.take() {
            Some(serde_json::Value::Object(m)) => current = m.get(key).cloned(),
            Some(_) | None => return None,
        }
    }
    current
}

pub fn eval_condition(ctx: &Context, expr: &str, it: Option<&serde_json::Value>) -> bool {
    // very simple: support == and != with loose numeric equality
    fn loose_eq(a: &serde_json::Value, b: &serde_json::Value) -> bool {
        use serde_json::Value::*;
        if a == b {
            return true;
        }
        match (a, b) {
            (Number(na), String(sb)) => {
                if let Some(da) = na.as_f64() {
                    return sb.parse::<f64>().ok().map(|db| db == da).unwrap_or(false);
                }
                false
            }
            (String(sa), Number(nb)) => {
                if let Some(db) = nb.as_f64() {
                    return sa.parse::<f64>().ok().map(|da| da == db).unwrap_or(false);
                }
                false
            }
            _ => false,
        }
    }

    if let Some(pos) = expr.find("==") {
        let (l, r) = expr.split_at(pos);
        let lv = resolve_path(ctx, l.trim(), it).unwrap_or(serde_json::Value::Null);
        let rv = resolve_path(ctx, r[2..].trim(), it).unwrap_or(serde_json::Value::Null);
        return loose_eq(&lv, &rv);
    }
    if let Some(pos) = expr.find("!=") {
        let (l, r) = expr.split_at(pos);
        let lv = resolve_path(ctx, l.trim(), it).unwrap_or(serde_json::Value::Null);
        let rv = resolve_path(ctx, r[2..].trim(), it).unwrap_or(serde_json::Value::Null);
        return !loose_eq(&lv, &rv);
    }
    false
}

#[async_recursion]
pub async fn execute_steps_inner(
    state: AppState,
    steps: &[Value],
    ctx: &mut Context,
    verbose: bool,
) -> Option<(u16, String)> {
    let mut last_response: Option<(u16, String)> = None;
    for step in steps {
        match step {
            Value::String(s) => {
                let step = s.trim();
                // Find an assignment '=' that is not part of '==' or '!=' and not inside quotes
                fn find_assignment_equals(s: &str) -> Option<usize> {
                    let bytes = s.as_bytes();
                    let mut i = 0;
                    let mut in_quotes = false;
                    while i < bytes.len() {
                        let c = bytes[i] as char;
                        if c == '"' {
                            in_quotes = !in_quotes;
                            i += 1;
                            continue;
                        }
                        if !in_quotes && c == '=' {
                            let prev = if i > 0 { bytes[i - 1] as char } else { '\0' };
                            let next = if i + 1 < bytes.len() {
                                bytes[i + 1] as char
                            } else {
                                '\0'
                            };
                            if prev != '=' && next != '=' {
                                return Some(i);
                            }
                        }
                        i += 1;
                    }
                    None
                }
                if let Some(eq_pos) = find_assignment_equals(step) {
                    log(LogLevel::Debug, &format!("Assignment step: '{}', eq_pos: {}", step, eq_pos));
                    let (var, cmd) = step.split_at(eq_pos);
                    let var = var.trim();
                    let cmd = cmd[1..].trim();
                    // Handle object construction assignment: new_book = { ... }
                    if cmd.starts_with('{') {
                        // Remove surrounding braces and normalize whitespace
                        let mut obj_str = cmd.trim();
                        if obj_str.starts_with('{') && obj_str.ends_with('}') {
                            obj_str = &obj_str[1..obj_str.len()-1];
                        }
                        // Split by comma, parse key-value pairs
                        let mut map = serde_json::Map::new();
                        for pair in obj_str.split(',') {
                            let pair = pair.trim();
                            if pair.is_empty() { continue; }
                            // Find the first colon not inside quotes
                            let mut colon_pos = None;
                            let mut in_quotes = false;
                            for (i, c) in pair.chars().enumerate() {
                                if c == '"' {
                                    in_quotes = !in_quotes;
                                }
                                if c == ':' && !in_quotes {
                                    colon_pos = Some(i);
                                    break;
                                }
                            }
                            if let Some(colon_pos) = colon_pos {
                                let (key, value_expr) = pair.split_at(colon_pos);
                                let key = key.trim();
                                let value_expr = value_expr[1..].trim();
                                // Remove leading '{' from key if present
                                let key = key.trim_start_matches('{').trim();
                                // Resolve value from context
                                if let Some(val) = resolve_path(ctx, value_expr, None) {
                                    // If the value is a string that parses as a number, use number
                                    if let serde_json::Value::String(ref s) = val {
                                        if let Ok(n) = s.parse::<i64>() {
                                            map.insert(key.to_string(), serde_json::Value::Number(n.into()));
                                            continue;
                                        }
                                        if let Ok(n) = s.parse::<f64>() {
                                            map.insert(key.to_string(), serde_json::Value::Number(serde_json::Number::from_f64(n).unwrap()));
                                            continue;
                                        }
                                    }
                                    map.insert(key.to_string(), val);
                                } else {
                                    map.insert(key.to_string(), serde_json::Value::Null);
                                }
                            }
                        }
                        ctx.insert(var.to_string(), serde_json::Value::Object(map));
                        log(LogLevel::Debug, &format!("Assigned object to '{}': {:?}", var, ctx.get(var)));
                        continue;
                    }

                    // --- New: Handle arithmetic expressions on builtins/variables ---
                    // Try to match pattern: <builtin/var> <args> <op> <number>
                    let arith_ops = ["+", "-", "*", "/"];
                    let mut op_found = None;
                    let mut op_pos = 0;
                    for op in arith_ops.iter() {
                        if let Some(pos) = cmd.find(&format!(" {} ", op)) {
                            op_found = Some(*op);
                            op_pos = pos;
                            break;
                        }
                    }
                    if let Some(op) = op_found {
                        // Split into left and right of operator
                        let (left, right) = cmd.split_at(op_pos);
                        let left = left.trim();
                        let right = right[op.len()+1..].trim(); // skip operator and space
                        log(LogLevel::Debug, &format!("Arithmetic left: '{}', right: '{}'", left, right));
                        // Evaluate left (could be builtin, method, or variable)
                        let left_parts: Vec<String> = left.split_whitespace().map(|s| s.to_string()).collect();
                        let mut left_val = None;

                        // Try builtin first
                        let left_name = &left_parts[0];
                        let left_args = &left_parts[1..];
                        let res = call_builtin(left_name, left_args, ctx, &state, Some(&var.to_string())).await;
                        if let BuiltinResult::Ok = res {
                            if let Some(val) = ctx.get(&var.to_string()) {
                                left_val = Some(val.clone());
                            }
                        } else {
                            // Try resolve_path for variable
                            left_val = resolve_path(ctx, left_name, None);
                        }
                        log(LogLevel::Debug, &format!("Arithmetic left_val: {:?}", left_val));

                        // Evaluate right (should be a number or variable)
                        let mut right_val = None;
                        if let Ok(n) = right.parse::<f64>() {
                            right_val = Some(JsonValue::from(n));
                        } else if let Some(val) = resolve_path(ctx, right, None) {
                            right_val = Some(val);
                        }
                        log(LogLevel::Debug, &format!("Arithmetic right_val: {:?}", right_val));

                        // Apply arithmetic
                            // fallback for integer numbers
                        if let (Some(JsonValue::Number(l)), Some(JsonValue::Number(r))) = (left_val.clone(), right_val.clone()) {
                            let l_f64 = l.as_f64().unwrap();
                            let r_f64 = r.as_f64().unwrap();
                            let result = match op {
                                "+" => l_f64 + r_f64,
                                "-" => l_f64 - r_f64,
                                "*" => l_f64 * r_f64,
                                "/" => l_f64 / r_f64,
                                _ => 0.0,
                            };
                            log(LogLevel::Debug, &format!("Arithmetic result: {}", result));
                            if can_cast_to_i64(result) {
                                ctx.insert(var.to_string(), JsonValue::from(result as i64));
                            } else {
                            ctx.insert(var.to_string(), JsonValue::from(result));
                            }
                            continue;
                        }
                        // If not numbers, fallback to original logic
                    }

                    let parts: Vec<String> =
                        cmd.split_whitespace().map(|s| s.to_string()).collect();
                    log(LogLevel::Debug, &format!("Assignment var: '{}', cmd: '{}', parts: {:?}", var, cmd, parts));

                    // Special handling: array index assignment like users[index] = body
                    if let Some(bracket_pos) = var.find('[') {
                        if var.ends_with(']') {
                            let base = var[..bracket_pos].trim();
                            let index_expr = &var[bracket_pos + 1..var.len() - 1];

                            // Determine index value (from literal number or context variable)
                            let mut idx: Option<usize> = None;
                            let index_expr_trim = index_expr.trim();
                            if let Ok(n) = index_expr_trim.parse::<i64>() {
                                if n >= 0 {
                                    idx = Some(n as usize);
                                }
                            } else if let Some(JsonValue::Number(n)) = ctx.get(index_expr_trim) {
                                if let Some(i) = n.as_i64() {
                                    if i >= 0 {
                                        idx = Some(i as usize);
                                    }
                                }
                            }

                            // Determine RHS value if it's a simple variable/literal (single token)
                            if let Some(i) = idx {
                                if parts.len() == 1 {
                                    if let Some(value) = resolve_path(ctx, &parts[0], None) {
                                        if let Some(JsonValue::Array(_)) = ctx.get(base) {
                                            if let Some(arr) =
                                                ctx.get_mut(base).and_then(|v| v.as_array_mut())
                                            {
                                                if i < arr.len() {
                                                    arr[i] = value;
                                                    // Completed this assignment
                                                    continue;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            // If we couldn't handle the special case, fall through to builtin assignment
                        }
                    }

                    let name = &parts[0];
                    let args = &parts[1..];
                    if verbose {
                        log(LogLevel::Debug, &format!("Executing: {} = {} {:?}", var, name, args));
                    }
                    let res = call_builtin(name, args, ctx, &state, Some(var)).await;
                    if verbose {
                        log(LogLevel::Debug, &format!("Result: {:?}", res));
                    }
                    match res {
                        BuiltinResult::Ok => {}
                        BuiltinResult::Respond(code, msg) => {
                            last_response = Some((code, msg));
                            break;
                        }
                        BuiltinResult::Error(err) => {
                            last_response = Some((500, err));
                            break;
                        }
                    }
                } else {
                    if verbose {
                        log(LogLevel::Debug, &format!("Step content: {}", step));
                    }
                    let parts: Vec<String> =
                        step.split_whitespace().map(|s| s.to_string()).collect();
                    if parts.is_empty() {
                        continue;
                    }
                    let name = &parts[0];
                    let args = &parts[1..];
                    if verbose {
                        log(LogLevel::Debug, &format!("Executing: {} {:?}", name, args));
                    }
                    let res = call_builtin(name, args, ctx, &state, None).await;
                    if verbose {
                        log(LogLevel::Debug, &format!("Builtin Result: {:?}", res));
                    }
                    match res {
                        BuiltinResult::Ok => {}
                        BuiltinResult::Respond(code, msg) => {
                            last_response = Some((code, msg));
                            break;
                        }
                        BuiltinResult::Error(err) => {
                            last_response = Some((500, err));
                            break;
                        }
                    }
                }
            }
            Value::Map(m) => {
                if m.len() == 1 {
                    let (k, v) = m.iter().next().unwrap();
                    if let Some(cond) = k.strip_prefix("if ") {
                        if let Value::List(nested) = v {
                            let ok = eval_condition(ctx, cond, None);
                            if ok {
                                if let Some(resp) =
                                    execute_steps_inner(state.clone(), nested, ctx, verbose).await
                                {
                                    last_response = Some(resp);
                                    break;
                                }
                            }
                            continue;
                        }
                    }
                }
                // Unknown map step, ignore for now
            }
            _ => {}
        }
    }
    last_response
}

fn can_cast_to_i64(n: f64) -> bool {
    n.fract() == 0.0 && n >= i64::MIN as f64 && n <= i64::MAX as f64
}

pub async fn execute_steps(
    state: AppState,
    steps: Vec<Value>,
    body: Option<String>,
    path_params: Option<HashMap<String, String>>,
    verbose: bool,
) -> (StatusCode, String) {
    let mut ctx: Context = Context::new();

    // Store path params in context
    if let Some(params) = path_params {
        // FLAT version for direct access e.g. "id" instead of "path.params.id"
        for (k, v) in &params {
            ctx.insert(k.clone(), JsonValue::String(v.clone()));
        }
        ctx.insert(
            "path.params".to_string(),
            JsonValue::Object(
                params
                    .into_iter()
                    .map(|(k, v)| (k, JsonValue::String(v)))
                    .collect(),
            ),
        );
    }
    // Store body in context
    if let Some(body_str) = &body {
        ctx.insert("body".to_string(), body_str.clone().into());
    }

    if verbose {
        log(LogLevel::Debug, &format!("Executing steps: {:?}", steps));
    }

    let last_response = execute_steps_inner(state.clone(), &steps, &mut ctx, verbose).await;
    if verbose {
        log(LogLevel::Debug, &format!("Last response: {:?}", last_response));
    }

    if let Some((code, msg)) = last_response {
        (StatusCode::from_u16(code).unwrap_or(StatusCode::OK), msg)
    } else {
        (StatusCode::OK, "OK".to_string())
    }
}

pub async fn jwt_auth(
    req: Request<axum::body::Body>,
    next: Next,
    secret: String,
) -> Result<Response, StatusCode> {
    let headers = req.headers();
    if let Some(auth_header) = headers.get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                let validation = Validation::new(Algorithm::HS256);
                if decode::<serde_json::Value>(
                    token,
                    &DecodingKey::from_secret(secret.as_bytes()),
                    &validation,
                ).is_ok() {
                    return Ok(next.run(req).await);
                }
            }
        }
    }
    Err(StatusCode::UNAUTHORIZED)
}

pub fn initialize_memory_from_doc(doc: &RuneDocument) {
    for section in &doc.sections {
        if section.path.len() >= 2 && section.path[0] == "Memory" {
            let key = &section.path[1];
            let memory_data = if !section.records.is_empty() {
                serde_json::to_value(&section.records.iter().map(|r| &r.kv).collect::<Vec<_>>())
                    .unwrap_or(serde_json::Value::Null)
            } else if !section.kv.is_empty() {
                serde_json::to_value(&section.kv).unwrap_or(serde_json::Value::Null)
            } else if let Some(first_series) = section.series.values().next() {
                serde_json::to_value(first_series).unwrap_or(serde_json::Value::Null)
            } else {
                serde_json::Value::Null
            };
            log(LogLevel::Debug, &format!("Setting Memory for {}: {:?}", key, memory_data));
            crate::builtins::builtin::memory::set_memory(key, memory_data);
        }
    }
}
