use crate::builtins::{call_builtin, BuiltinResult, Context, LAST_EXEC_RESULT};
use crate::rune_ast::{RuneDocument, Section, Value};
use crate::rune_parser::ParsedLine;
use crate::util::{log, LogLevel};
use async_recursion::async_recursion;
use axum::http::StatusCode;
use axum::{http::Request, middleware::Next, response::Response};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use regex::Regex;
use crate::arithmetic::eval_arithmetic;

#[derive(Clone)]
pub struct AppState {
    pub doc: Arc<RuneDocument>,
    pub schemas: Arc<HashMap<String, Section>>, // For @Schema
    pub data_sources: Arc<HashMap<String, Section>>, // For @Datasource
    pub path: PathBuf,                          // Path to the rune document
}

#[derive(Default, Debug)]
pub struct ExecutionContext {
    pub vars: HashMap<String, serde_json::Value>,
    pub memory: HashMap<String, serde_json::Value>,
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
) -> Option<(u16, String)> {
    for step in steps {
        match step {
            Value::String(s) => {
                let step_str = s.trim();
                if let Some(eq_pos) = find_assignment_equals(step_str) {
                    let (var, cmd) = step_str.split_at(eq_pos);
                    let var = var.trim();
                    let cmd = cmd[1..].trim();
                    log(
                        LogLevel::Debug,
                        &format!("Handling assignment - var: '{}', cmd: '{}'", var, cmd),
                    );
                    if let Some(resp) = handle_assignment(&state, ctx, var, cmd).await {
                        return Some(resp);
                    }
                } else {
                    log(
                        LogLevel::Debug,
                        &format!("Handling plain cmd - step: '{}'", step),
                    );
                    if let Some(resp) = handle_plain_command(&state, ctx, step_str).await {
                        return Some(resp);
                    }
                }
            }
            Value::Map(m) => {
                log(
                    LogLevel::Debug,
                    &format!("Handling conditional block - block: {:#?}", m),
                );
                if let Some(resp) = handle_conditional_block(&state, m, ctx).await {
                    return Some(resp);
                }
            }
            _ => {}
        }
    }

    resolve_last_response(steps, ctx)
}

/// Dispatches different types of assignments (Object, Arithmetic, Array, or Builtin)
async fn handle_assignment(
    state: &AppState,
    ctx: &mut Context,
    var: &str,
    cmd: &str,
) -> Option<(u16, String)> {
    // 1. Object Construction: var = { ... }
    if cmd.starts_with('{') {
        let map = parse_object_literal(ctx, cmd);
        ctx.insert(var.to_string(), serde_json::Value::Object(map));
        return None;
    }

    // 2. Arithmetic: var = x + y
    if let Some(result) = try_execute_arithmetic(state, ctx, var, cmd).await {
        ctx.insert(var.to_string(), result);
        return None;
    }

    // 3. Array Index Assignment: users[0] = val
    if var.contains('[') && var.ends_with(']') {
        if try_handle_array_assignment(ctx, var, cmd) {
            return None;
        }
    }

    // 4. Default: Builtin Function Assignment
    let parts: Vec<String> = cmd.split_whitespace().map(|s| s.to_string()).collect();
    if parts.is_empty() {
        return None;
    }

    let res = call_builtin(&parts[0], &parts[1..], ctx, state, Some(&var.to_string())).await;
    handle_builtin_result(res)
}

/// Handles commands without assignments (e.g., "log hello")
async fn handle_plain_command(
    state: &AppState,
    ctx: &mut Context,
    step: &str,
) -> Option<(u16, String)> {
    let parts: Vec<String> = step.split_whitespace().map(|s| s.to_string()).collect();
    if parts.is_empty() {
        return None;
    }

    if !step.starts_with("func") {
        if let Some(_) = try_execute_arithmetic(state, ctx, LAST_EXEC_RESULT, step).await {
            return None;
        }
    }

    let res = call_builtin(&parts[0], &parts[1..], ctx, state, None).await;
    handle_builtin_result(res)
}

/// Parses the "key: value" syntax inside curly braces
fn parse_object_literal(
    ctx: &mut Context,
    cmd: &str,
) -> serde_json::Map<String, serde_json::Value> {
    let mut map = serde_json::Map::new();
    let content = cmd.trim_matches(|c| c == '{' || c == '}');

    for pair in content.split(',') {
        let pair = pair.trim();
        if pair.is_empty() {
            continue;
        }

        if let Some(colon_pos) = find_char_outside_quotes(pair, ':') {
            let (key, val_expr) = pair.split_at(colon_pos);
            let key = key.trim().trim_start_matches('{').trim();
            let val_expr = val_expr[1..].trim();

            let mut value = resolve_path(ctx, val_expr, None).unwrap_or(serde_json::Value::Null);

            // Try to normalize numeric strings to actual JSON numbers
            if let serde_json::Value::String(ref s) = value {
                if let Ok(n) = s.parse::<i64>() {
                    value = serde_json::Value::Number(n.into());
                } else if let Ok(n) = s.parse::<f64>() {
                    if let Some(num) = serde_json::Number::from_f64(n) {
                        value = serde_json::Value::Number(num);
                    }
                }
            }
            map.insert(key.to_string(), value);
        }
    }
    map
}

/// Handles the logic for "if" blocks in the steps
async fn handle_conditional_block(
    state: &AppState,
    map: &HashMap<String, Value>,
    ctx: &mut Context,
) -> Option<(u16, String)> {
    if map.len() == 1 {
        let (k, v) = map.iter().next()?;
        if let Some(cond) = k.strip_prefix("if ") {
            if let Value::List(nested) = v {
                if eval_condition(ctx, cond, None) {
                    return execute_steps_inner(state.clone(), nested, ctx).await;
                }
            }
        }
    }
    None
}

/// Helper to convert BuiltinResult to the standard return tuple
fn handle_builtin_result(res: BuiltinResult) -> Option<(u16, String)> {
    match res {
        BuiltinResult::Ok => None,
        BuiltinResult::Respond(code, msg) => Some((code, msg)),
        BuiltinResult::Error(err) => Some((500, err)),
    }
}

// --- Utility Helpers (Simplified logic from original) ---

fn find_assignment_equals(s: &str) -> Option<usize> {
    let mut in_quotes = false;
    let bytes = s.as_bytes();
    for i in 0..bytes.len() {
        let c = bytes[i] as char;
        if c == '"' {
            in_quotes = !in_quotes;
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
    }
    None
}

fn find_char_outside_quotes(s: &str, target: char) -> Option<usize> {
    let mut in_quotes = false;
    for (i, c) in s.chars().enumerate() {
        if c == '"' {
            in_quotes = !in_quotes;
        }
        if c == target && !in_quotes {
            return Some(i);
        }
    }
    None
}

async fn try_execute_arithmetic(
    state: &AppState,
    ctx: &mut Context,
    var: &str,
    cmd: &str,
) -> Option<serde_json::Value> {
    let arith_ops = ["+", "-", "*", "/", "(", ")", " "];
    let mut resolved_cmd = String::new();
    for token in cmd.split_whitespace() {
        // If the token is a math operator or a literal number, keep it
        if arith_ops.contains(&token)
            || token.parse::<f64>().is_ok()
            || token.chars().all(|c| c == '(' || c == ')')
        {
            log(LogLevel::Debug, &format!("Is math token: '{}'", token));
            resolved_cmd.push_str(token);
        } else {
            // Try to resolve from context
            if let Some(val) = ctx.get(token) {
                // Strip wrapping quotes "" if value is wrapped
                if let JsonValue::String(s) = val {
                    let stripped = if s.starts_with('"') && s.ends_with('"') && s.len() >= 2 {
                        &s[1..s.len() - 1]
                    } else {
                        s.as_str()
                    };

                    let re = Regex::new(r"\d+\.?\d*").unwrap();
                    if re.is_match(stripped) {
                        resolved_cmd.push_str(stripped);
                    } else {
                        log(LogLevel::Debug, &format!("Is not numeric string token: '{}'", token));
                        resolved_cmd.push_str(token);
                    }
                } else {
                    if let Some(n) = val.as_f64() {
                        log(LogLevel::Debug, &format!("Is ctx token: '{}'", token));
                        resolved_cmd.push_str(&n.to_string());
                    } else if let Some(n) = val.as_i64() {
                        log(LogLevel::Debug, &format!("Is ctx token: '{}'", token));
                        resolved_cmd.push_str(&n.to_string());
                    } else {
                        // Not a number, put original token back (or handle error)
                        log(LogLevel::Debug, &format!("Is not ctx token: '{}' '{}'", token, val));
                        resolved_cmd.push_str(token);
                    }
                }
            } else {
                // Not in context, keep as is
                resolved_cmd.push_str(token);
            }
        }
        resolved_cmd.push(' ');
    }
    let resolved_cmd = resolved_cmd.trim();
    log(
        LogLevel::Debug,
        &format!("Resolved arithmetic command: '{}'", resolved_cmd),
    );

    if let Ok(val) = resolved_cmd.parse::<f64>() {
        return Some(val.into());
    }

    let mut op_found = None;
    let mut op_pos = 0;

    for op in arith_ops.iter() {
        if let Some(pos) = cmd.find(&format!(" {} ", op)) {
            log(
                LogLevel::Debug,
                &format!("Found arithmetic operator '{}' in cmd '{}'", op, cmd),
            );
            op_found = Some(*op);
            op_pos = pos;
            break;
        }
    }

    if op_found.is_none() {
        return None;
    }

    // If cmd is all numeric with math signs, parse directly
    if resolved_cmd
        .chars()
        .all(|c| c.is_digit(10) || c == '.' || arith_ops.contains(&c.to_string().as_str()))
    {
        log(LogLevel::Debug, "Command is arithmetic only.");
        return if let Ok(result) = eval_arithmetic(resolved_cmd) {
            if can_cast_to_i64(result) {
                log(LogLevel::Debug, "Can cast to i64.");
                ctx.insert(var.to_string(), serde_json::Value::from(result as i64));
                log(
                    LogLevel::Debug,
                    &format!("Can cast to i64 for var '{}' with result {}.", var, result),
                );
                Some(serde_json::Value::from(result as i64))
            } else {
                ctx.insert(var.to_string(), serde_json::Value::from(result));
                Some(serde_json::Value::from(result))
            }
        } else {
            None
        };
    }

    let op = op_found?;
    let (left_str, right_str) = resolved_cmd.split_at(op_pos);
    let left_str = left_str.trim();
    let right_str = right_str[op.len() + 1..].trim(); // Skip op and space

    // Evaluate Left: Try builtin first, then resolve_path
    let mut left_val = None;
    let left_parts: Vec<String> = left_str.split_whitespace().map(|s| s.to_string()).collect();

    if !left_parts.is_empty() {
        let res = call_builtin(
            &left_parts[0],
            &left_parts[1..],
            ctx,
            state,
            Some(&var.to_string()),
        )
            .await;
        if let BuiltinResult::Ok = res {
            left_val = ctx.get(var).cloned();
        } else {
            left_val = resolve_path(ctx, &left_parts[0], None);
        }
    }

    // Evaluate Right: Try numeric literal first, then resolve_path
    let right_val = if let Ok(n) = right_str.parse::<f64>() {
        Some(serde_json::Value::from(n))
    } else {
        resolve_path(ctx, right_str, None)
    };

    // Perform Math
    if let (Some(serde_json::Value::Number(l)), Some(serde_json::Value::Number(r))) =
        (left_val, right_val)
    {
        let l_f = l.as_f64()?;
        let r_f = r.as_f64()?;

        let result = match op {
            "+" => l_f + r_f,
            "-" => l_f - r_f,
            "*" => l_f * r_f,
            "/" => l_f / r_f,
            _ => 0.0,
        };

        return if can_cast_to_i64(result) {
            Some(serde_json::Value::from(result as i64))
        } else {
            Some(serde_json::Value::from(result))
        };
    }

    None
}

fn try_handle_array_assignment(ctx: &mut Context, var_expr: &str, cmd_rhs: &str) -> bool {
    let bracket_pos = match var_expr.find('[') {
        Some(pos) => pos,
        None => return false,
    };

    let base_name = var_expr[..bracket_pos].trim();
    let index_expr = var_expr[bracket_pos + 1..var_expr.len() - 1].trim();

    // 1. Resolve the Index
    let idx: usize = if let Ok(n) = index_expr.parse::<i64>() {
        if n < 0 {
            return false;
        }
        n as usize
    } else if let Some(serde_json::Value::Number(n)) = ctx.get(index_expr) {
        match n.as_i64() {
            Some(i) if i >= 0 => i as usize,
            _ => return false,
        }
    } else {
        return false;
    };

    // 2. Resolve the RHS Value (The value being assigned)
    // In your original logic, this only handles single-token RHS
    let parts: Vec<&str> = cmd_rhs.split_whitespace().collect();
    if parts.len() != 1 {
        return false;
    }

    if let Some(val_to_assign) = resolve_path(ctx, parts[0], None) {
        // 3. Perform the mutation if the base is an array
        if let Some(arr) = ctx.get_mut(base_name).and_then(|v| v.as_array_mut()) {
            if idx < arr.len() {
                arr[idx] = val_to_assign;
                return true;
            }
        }
    }

    false
}

fn can_cast_to_i64(n: f64) -> bool {
    n.fract() == 0.0 && n >= i64::MIN as f64 && n <= i64::MAX as f64
}

/// Check last step for a response
pub fn resolve_last_response(steps: &[Value], ctx: &mut Context) -> Option<(u16, String)> {
    let step = steps.last();
    if step.is_none() {
        return None;
    }
    let step = step.unwrap().as_str().unwrap().trim();

    log(
        LogLevel::Debug,
        &format!("Resolving last response for step: '{}'", step),
    );

    // Case 1: Assignment
    if let Some(eq_pos) = step.find('=') {
        let lhs = step[..eq_pos].trim();
        if let Some(val) = ctx.get(lhs) {
            log(
                LogLevel::Debug,
                &format!("Resolving last response for lhs: {}", val),
            );
            Some((200, format!("{}", val)))
        } else {
            log(
                LogLevel::Debug,
                &format!("Didn't resolve last response for lhs: {}", lhs),
            );
            None
        }
    } else {
        // Case 2: Builtin result
        if let Some(result) = get_last_builtin_result(ctx) {
            log(
                LogLevel::Debug,
                &format!("Resolving last response for result: {}", result),
            );
            Some((200, format!("{}", result)))
        } else {
            // Case 3: Variable
            let var = step.trim();
            if let Some(val) = ctx.get(var) {
                log(
                    LogLevel::Debug,
                    &format!("Resolving last response for variable '{}': {}", var, val),
                );
                Some((200, format!("{}", val)))
            } else {
                None
            }
        }
    }
}

// Helper to get last builtin result from context
fn get_last_builtin_result(ctx: &Context) -> Option<String> {
    ctx.get(LAST_EXEC_RESULT)
        .and_then(|v| v.into())
        .map(|s| s.to_string())
}

pub async fn execute_steps(
    state: AppState,
    steps: Vec<Value>,
    body: Option<String>,
    path_params: Option<HashMap<String, String>>,
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

    log(LogLevel::Debug, &format!("Executing steps: {:?}", steps));

    let last_response = execute_steps_inner(state.clone(), &steps, &mut ctx).await;

    log(
        LogLevel::Debug,
        &format!("Last response: {:?}", last_response),
    );

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
                )
                    .is_ok()
                {
                    return Ok(next.run(req).await);
                }
            }
        }
    }
    Err(StatusCode::UNAUTHORIZED)
}

pub async fn initialize_memory_from_doc(doc: &RuneDocument, path: &PathBuf) {
    for section in &doc.sections {
        if section.path.len() >= 1 && section.path[0] == "Memory" {
            // Check for source param
            if let Some(Value::String(source_path)) = section.kv.get("source") {
                if source_path.ends_with(".json") {
                    // Try current directory first
                    let mut file_path = std::path::PathBuf::from(source_path);
                    if !file_path.exists() {
                        // If not found, try using the provided path argument
                        file_path = path.join(source_path);
                    }
                    match std::fs::read_to_string(&file_path) {
                        Ok(data) => {
                            match serde_json::from_str::<serde_json::Value>(&data) {
                                Ok(json) => {
                                    if let Some(obj) = json.as_object() {
                                        log(
                                            LogLevel::Info,
                                            &format!("Loaded memory from {}", file_path.display()),
                                        );
                                        for (k, v) in obj.iter() {
                                            log(LogLevel::Debug, &format!("Setting Memory from file - key: {}, value: {:?}", k, v));
                                            crate::builtins::builtin::memory::set_memory(
                                                k,
                                                v.clone(),
                                            )
                                                .await;
                                        }
                                        continue;
                                    } else {
                                        log(
                                            LogLevel::Error,
                                            &format!(
                                                "Memory source {} must be a JSON object",
                                                file_path.display()
                                            ),
                                        );
                                        continue;
                                    }
                                }
                                Err(e) => {
                                    log(
                                        LogLevel::Error,
                                        &format!(
                                            "Failed to parse JSON from {}: {}",
                                            file_path.display(),
                                            e
                                        ),
                                    );
                                    continue;
                                }
                            }
                        }
                        Err(e) => {
                            log(
                                LogLevel::Error,
                                &format!(
                                    "Failed to read memory source {}: {}",
                                    file_path.display(),
                                    e
                                ),
                            );
                            continue;
                        }
                    }
                }
            }

            // Fallback to existing logic
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
            log(
                LogLevel::Debug,
                &format!("Setting Memory for {}: {:?}", key, memory_data),
            );
            crate::builtins::builtin::memory::set_memory(key, memory_data).await;
        }
    }
}

pub async fn execute_line(
    ctx: &mut ExecutionContext,
    parsed: &ParsedLine,
) -> anyhow::Result<serde_json::Value> {
    // Convert ParsedLine back to a string representation
    let line_str = match parsed {
        ParsedLine::Assignment { var, expr } => format!("{} = {}", var, expr),
        ParsedLine::Builtin { name, args } => {
            let args_str = args.join(" ");
            format!("{} {}", name, args_str)
        }
        ParsedLine::Object { var, fields } => {
            let fields_str = fields
                .iter()
                .map(|(k, v)| format!("{}: {}", k, v))
                .collect::<Vec<_>>()
                .join(", ");
            format!("{} = {{ {} }}", var, fields_str)
        }
        ParsedLine::Comment => String::from("#"),
        ParsedLine::Raw(line) => line.clone(),
    };

    // Convert ExecutionContext to Context
    let steps = [Value::String(line_str.clone())];
    // Create a Context and copy vars/memory
    let mut core_ctx = crate::builtins::Context::new();
    for (k, v) in ctx.vars.iter() {
        core_ctx.insert(k.clone(), v.clone());
    }
    for (k, v) in ctx.memory.iter() {
        core_ctx.insert(k.clone(), v.clone());
    }

    // Dummy AppState (not used in REPL)
    let app_state = AppState {
        doc: Arc::new(RuneDocument { sections: vec![] }),
        schemas: Arc::new(HashMap::new()),
        data_sources: Arc::new(HashMap::new()),
        path: PathBuf::new(),
    };

    // Call execute_steps_inner directly (since execute_steps expects HTTP context)
    let result = execute_steps_inner(app_state, &steps, &mut core_ctx).await;

    // Update ExecutionContext from core_ctx
    ctx.vars.clear();
    ctx.memory.clear();
    for (k, v) in core_ctx.iter() {
        if k == LAST_EXEC_RESULT {
            continue;
        }
        // Heuristic: keys that start with "memory." go to memory, else to vars
        if k.starts_with("memory.") {
            ctx.memory.insert(k.clone(), v.clone());
        } else {
            ctx.vars.insert(k.clone(), v.clone());
        }
    }

    // Return the last response or Null
    if let Some((_code, msg)) = result {
        Ok(serde_json::Value::String(msg))
    } else {
        Ok(serde_json::Value::Null)
    }
}
