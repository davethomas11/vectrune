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
fn split_path_parts(ident: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current_part = String::new();
    let mut in_bracket = false;

    for c in ident.chars() {
        if c == '[' {
            if !current_part.is_empty() {
                parts.push(current_part.clone());
                current_part.clear();
            }
            in_bracket = true;
        } else if c == ']' {
            parts.push(format!("[{}]", current_part.trim()));
            current_part.clear();
            in_bracket = false;
        } else if c == '.' && !in_bracket {
            if !current_part.is_empty() {
                parts.push(current_part.clone());
                current_part.clear();
            }
        } else {
            current_part.push(c);
        }
    }

    if !current_part.is_empty() {
        parts.push(current_part);
    }

    parts
}

fn json_value_to_lookup_key(value: &serde_json::Value) -> String {
    value
        .as_str()
        .map(ToString::to_string)
        .unwrap_or_else(|| value.to_string())
}

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

    let parts = split_path_parts(ident);
    if parts.is_empty() {
        return None;
    }

    let mut current: Option<serde_json::Value> = None;
    let mut start_index = 0usize;

    for prefix_len in (1..=parts.len()).rev() {
        let prefix = parts[..prefix_len].join(".");
        if prefix == "it" {
            current = it.cloned();
            start_index = prefix_len;
            break;
        }
        if let Some(val) = ctx.get(&prefix) {
            current = Some(val.clone());
            start_index = prefix_len;
            break;
        }
    }

    if current.is_none() {
        let first = &parts[0];
        if first == "it" {
            current = it.cloned();
            start_index = 1;
        } else if let Some(serde_json::Value::Object(map)) = ctx.get("path.params") {
            if let Some(v) = map.get(first) {
                current = Some(v.clone());
                start_index = 1;
            }
        }
    }

    if start_index >= parts.len() {
        return current;
    }

    for key in parts.iter().skip(start_index) {
        if key.starts_with('[') && key.ends_with(']') {
            let inner_expr = &key[1..key.len() - 1];
            // Resolve the inner expression (could be a variable or a literal)
            let resolved_key = resolve_path(ctx, inner_expr, it)?;
            let key_str = json_value_to_lookup_key(&resolved_key);

            match current.take() {
                Some(serde_json::Value::Object(m)) => current = m.get(&key_str).cloned(),
                Some(serde_json::Value::Array(a)) => {
                    if let Ok(idx) = key_str.parse::<usize>() {
                        current = a.get(idx).cloned();
                    } else {
                        return None;
                    }
                }
                _ => return None,
            }
        } else {
            match current.take() {
                Some(serde_json::Value::Object(m)) => current = m.get(key).cloned(),
                _ => return None,
            }
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
                log(LogLevel::Debug, &format!("execute_steps_inner: processing step='{}'", step_str));
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
                        &format!("Handling plain cmd - step: '{}'", step_str),
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

pub fn mutate_path(
    ctx: &mut Context,
    ident: &str,
    new_val: serde_json::Value,
) -> bool {
    let raw_parts = split_path_parts(ident);
    let mut parts = Vec::with_capacity(raw_parts.len());

    for part in raw_parts {
        if part.starts_with('[') && part.ends_with(']') {
            let inner_expr = &part[1..part.len() - 1];
            let resolved_key = resolve_path(ctx, inner_expr, None)
                .map(|v| json_value_to_lookup_key(&v))
                .unwrap_or_else(|| inner_expr.trim_matches('"').to_string());
            parts.push(resolved_key);
        } else {
            parts.push(part);
        }
    }

    if parts.is_empty() {
        return false;
    }

    let first = parts[0].clone();
    if parts.len() == 1 {
        ctx.insert(first, new_val);
        return true;
    }

    // Traverse to the parent of the last part
    let mut current = if let Some(val) = ctx.get_mut(&first) {
        val
    } else {
        return false;
    };

    for j in 1..parts.len() - 1 {
        let key = &parts[j];
        match current {
            serde_json::Value::Object(m) => {
                if !m.contains_key(key) {
                    return false;
                }
                current = m.get_mut(key).unwrap();
            }
            serde_json::Value::Array(a) => {
                if let Ok(idx) = key.parse::<usize>() {
                    if idx >= a.len() {
                        return false;
                    }
                    current = &mut a[idx];
                } else {
                    return false;
                }
            }
            _ => return false,
        }
    }

    // Apply the final part
    let last_key = &parts[parts.len() - 1];
    match current {
        serde_json::Value::Object(m) => {
            m.insert(last_key.clone(), new_val);
            true
        }
        serde_json::Value::Array(a) => {
            if let Ok(idx) = last_key.parse::<usize>() {
                if idx < a.len() {
                    a[idx] = new_val;
                    true
                } else if idx == a.len() {
                    a.push(new_val);
                    true
                } else {
                    false
                }
            } else {
                false
            }
        }
        _ => false,
    }
}

fn is_purely_arithmetic_expression(expr: &str) -> bool {
    !expr.is_empty()
        && expr
            .chars()
            .all(|c| c.is_ascii_digit() || c == '.' || c.is_whitespace() || "+-*/()".contains(c))
}

fn json_value_as_f64(value: &serde_json::Value) -> Option<f64> {
    match value {
        serde_json::Value::Number(n) => n.as_f64(),
        serde_json::Value::String(s) => s.parse::<f64>().ok(),
        serde_json::Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
        _ => None,
    }
}

fn is_bare_identifier_operand(operand: &str) -> bool {
    !operand.is_empty()
        && !operand.chars().any(char::is_whitespace)
        && operand
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.'))
}

fn find_top_level_arithmetic_operator(expr: &str) -> Option<(usize, char)> {
    let mut depth = 0usize;
    let mut prev_non_ws: Option<char> = None;

    for (idx, ch) in expr.char_indices() {
        match ch {
            '(' => depth += 1,
            ')' => depth = depth.saturating_sub(1),
            '+' | '-' | '*' | '/' if depth == 0 => {
                let next_non_ws = expr[idx + ch.len_utf8()..]
                    .chars()
                    .find(|c| !c.is_whitespace());
                let is_unary_sign = matches!(ch, '+' | '-')
                    && prev_non_ws.map(|c| "+-*/(".contains(c)).unwrap_or(true);
                let is_hyphenated_identifier = ch == '-'
                    && prev_non_ws
                        .map(|c| c.is_ascii_alphabetic() || c == '_')
                        .unwrap_or(false)
                    && next_non_ws
                        .map(|c| c.is_ascii_alphabetic() || c == '_')
                        .unwrap_or(false);
                if !is_unary_sign && !is_hyphenated_identifier {
                    return Some((idx, ch));
                }
            }
            _ => {}
        }

        if !ch.is_whitespace() {
            prev_non_ws = Some(ch);
        }
    }

    None
}

async fn resolve_numeric_operand(
    state: &AppState,
    ctx: &mut Context,
    operand: &str,
    temp_label: &str,
) -> Option<f64> {
    let operand = operand.trim();
    if operand.is_empty() {
        return None;
    }

    if let Ok(n) = operand.parse::<f64>() {
        return Some(n);
    }

    if let Some(value) = resolve_path(ctx, operand, None) {
        if let Some(n) = json_value_as_f64(&value) {
            return Some(n);
        }
    }

    if is_purely_arithmetic_expression(operand) {
        return eval_arithmetic(operand).ok();
    }

    if is_bare_identifier_operand(operand) {
        return None;
    }

    let parts: Vec<String> = operand.split_whitespace().map(|s| s.to_string()).collect();
    if parts.is_empty() {
        return None;
    }

    let temp_var = format!("___arith_operand_{}_{}___", temp_label, ctx.len());
    let res = call_builtin(&parts[0], &parts[1..], ctx, state, Some(temp_var.as_str())).await;
    match res {
        BuiltinResult::Ok => {
            let numeric = ctx.get(&temp_var).and_then(json_value_as_f64);
            ctx.remove(&temp_var);
            numeric
        }
        BuiltinResult::Respond(_, _) | BuiltinResult::Error(_) => {
            ctx.remove(&temp_var);
            None
        }
    }
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
        mutate_path(ctx, var, serde_json::Value::Object(map));
        return None;
    }

    // 2. Arithmetic: var = x + y
    if let Some(result) = try_execute_arithmetic(state, ctx, var, cmd).await {
        mutate_path(ctx, var, result);
        return None;
    }

    // 3. Nested or Path Assignment
    if var.contains('.') || var.contains('[') {
        // Resolve the RHS
        if let Some(val) = resolve_path(ctx, cmd, None) {
             if mutate_path(ctx, var, val) {
                 return None;
             }
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

    for pair in split_outside_quotes(content, ',') {
        let pair = pair.trim();
        if pair.is_empty() {
            continue;
        }

        if let Some(colon_pos) = find_char_outside_quotes(pair, ':') {
            let (key, val_expr) = pair.split_at(colon_pos);
            let key = key
                .trim()
                .trim_start_matches('{')
                .trim()
                .trim_matches('"');
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
            if prev != '=' && next != '=' && prev != '!' && next != '>' && prev != '<' {
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

fn split_outside_quotes<'a>(s: &'a str, delimiter: char) -> Vec<&'a str> {
    let mut parts = Vec::new();
    let mut start = 0usize;
    let mut in_quotes = false;

    for (i, c) in s.char_indices() {
        if c == '"' {
            in_quotes = !in_quotes;
        }
        if c == delimiter && !in_quotes {
            parts.push(&s[start..i]);
            start = i + c.len_utf8();
        }
    }

    parts.push(&s[start..]);
    parts
}

async fn try_execute_arithmetic(
    state: &AppState,
    ctx: &mut Context,
    var: &str,
    cmd: &str,
) -> Option<serde_json::Value> {
    let mut resolved_cmd = String::new();
    for token in cmd.split_whitespace() {
        // If the token is a math operator or a literal number, keep it
        if ["+", "-", "*", "/", "(", ")"].contains(&token)
            || token.parse::<f64>().is_ok()
            || token.chars().all(|c| c == '(' || c == ')')
        {
            resolved_cmd.push_str(token);
        } else {
            // Try to resolve from context
            if let Some(val) = resolve_path(ctx, token, None) {
                if let Some(n) = val.as_f64() {
                    resolved_cmd.push_str(&n.to_string());
                } else if let Some(n) = val.as_i64() {
                    resolved_cmd.push_str(&n.to_string());
                } else {
                    resolved_cmd.push_str(token);
                }
            } else {
                resolved_cmd.push_str(token);
            }
        }
        resolved_cmd.push(' ');
    }
    let resolved_cmd = resolved_cmd.trim();
    log(LogLevel::Debug, &format!("try_execute_arithmetic: var={}, resolved_cmd='{}'", var, resolved_cmd));

    if is_purely_arithmetic_expression(resolved_cmd) {
        log(LogLevel::Debug, "try_execute_arithmetic: evaluating purely arithmetic expression via eval_arithmetic");
        return if let Ok(result) = eval_arithmetic(resolved_cmd) {
            let val = if can_cast_to_i64(result) {
                serde_json::Value::from(result as i64)
            } else {
                serde_json::Value::from(result)
            };
            ctx.insert(var.to_string(), val.clone());
            Some(val)
        } else {
            log(LogLevel::Debug, "try_execute_arithmetic: eval_arithmetic failed");
            None
        };
    }

    let (op_pos, op) = find_top_level_arithmetic_operator(resolved_cmd)?;
    let (left_str, right_str) = resolved_cmd.split_at(op_pos);
    let left_str = left_str.trim();
    let right_str = right_str[op.len_utf8()..].trim();

    let left_val = resolve_numeric_operand(state, ctx, left_str, "left").await;
    let right_val = resolve_numeric_operand(state, ctx, right_str, "right").await;

    log(LogLevel::Debug, &format!("try_execute_arithmetic: left_val={:?}, right_val={:?}", left_val, right_val));

    // Perform Math
    if let (Some(l_f), Some(r_f)) = (left_val, right_val) {
        let result = match op {
            '+' => l_f + r_f,
            '-' => l_f - r_f,
            '*' => l_f * r_f,
            '/' => l_f / r_f,
            _ => 0.0,
        };

        let val = if can_cast_to_i64(result) {
            serde_json::Value::from(result as i64)
        } else {
            serde_json::Value::from(result)
        };
        ctx.insert(var.to_string(), val.clone());
        return Some(val);
    }

    None
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

    // Case 1: Assignment
    if let Some(eq_pos) = step.find('=') {
        let lhs = step[..eq_pos].trim();
        if let Some(val) = ctx.get(lhs) {
            Some((200, format!("{}", val)))
        } else {
            None
        }
    } else {
        // Case 2: Builtin result
        if let Some(result) = get_last_builtin_result(ctx) {
            Some((200, format!("{}", result)))
        } else {
            // Case 3: Variable
            let var = step.trim();
            if let Some(val) = ctx.get(var) {
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

    let last_response = execute_steps_inner(state.clone(), &steps, &mut ctx).await;

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
