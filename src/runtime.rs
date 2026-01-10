use crate::builtins::{call_builtin, BuiltinResult, Context};
use crate::rune_ast::{RuneDocument, Section, Value};
use axum::{
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post, put},
    Router,
};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub doc: Arc<RuneDocument>,
    pub schemas: Arc<HashMap<String, Section>>, // For @Schema
}

pub fn get_app_type(doc: &RuneDocument) -> Option<String> {
    for section in &doc.sections {
        if section.path.first().map(|s| s.as_str()) == Some("App") {
            if let Some(Value::String(app_type)) = section.kv.get("type") {
                return Some(app_type.clone());
            }
        }
    }
    return None;
}

fn extract_schemas(doc: &RuneDocument) -> HashMap<String, Section> {
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

pub fn build_router(doc: RuneDocument, verbose: bool) -> Router {
    let schemas = Arc::new(extract_schemas(&doc));
    let state = AppState {
        doc: Arc::new(doc),
        schemas,
    };
    let mut router = Router::new();

    for section in &state.doc.sections {
        if section.path.first().map(|s| s.as_str()) == Some("Route") {
            if section.path.len() < 3 {
                continue;
            }
            let method = section.path.get(1).map(|s| s.as_str()).unwrap_or("GET");
            let path_template = section
                .path
                .iter()
                .skip(2)
                .map(|s| s.as_str())
                .collect::<Vec<_>>()
                .join("/");
            let path_template = format!("/{}", path_template);
            let axum_path = path_template.replace("{", ":").replace("}", "");
            let run_steps = section.series.get("run").cloned().unwrap_or_default();
            let state_clone = state.clone();

            let handler =
                move |axum::extract::Path(params): axum::extract::Path<HashMap<String, String>>,
                      body: Option<String>| {
                    let state = state_clone.clone();
                    let steps = run_steps.clone();
                    async move { execute_steps(state, steps, body, Some(params), verbose).await }
                };

            let method = method.to_uppercase();
            let route_fn = match method.as_str() {
                "GET" | "DELETE" => {
                    let handler = handler.clone();
                    match method.as_str() {
                        "GET" => get(move |params| handler(params, None)),
                        "DELETE" => delete(move |params| handler(params, None)),
                        _ => unreachable!(),
                    }
                }
                "POST" | "PUT" => {
                    let handler = handler.clone();
                    match method.as_str() {
                        "POST" => post(move |params, body| handler(params, Some(body))),
                        "PUT" => put(move |params, body| handler(params, Some(body))),
                        _ => unreachable!(),
                    }
                }
                _ => {
                    // Fallback for unsupported methods
                    continue;
                }
            };

            router = router.route(&axum_path, route_fn);
        }
    }

    router.with_state(state)
}

// Helper to resolve simple literals and dotted paths in context
fn resolve_path(ctx: &Context, ident: &str, it: Option<&serde_json::Value>) -> Option<serde_json::Value> {
    // literals
    if ident == "null" { return Some(serde_json::Value::Null); }
    if ident == "true" { return Some(serde_json::Value::Bool(true)); }
    if ident == "false" { return Some(serde_json::Value::Bool(false)); }
    if ident.starts_with('"') && ident.ends_with('"') && ident.len() >= 2 {
        return Some(serde_json::Value::String(ident[1..ident.len()-1].to_string()));
    }
    if let Ok(n) = ident.parse::<f64>() { return Some(serde_json::Value::from(n)); }

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

fn eval_condition(ctx: &Context, expr: &str, it: Option<&serde_json::Value>) -> bool {
    // very simple: support == and != with loose numeric equality
    fn loose_eq(a: &serde_json::Value, b: &serde_json::Value) -> bool {
        use serde_json::Value::*;
        if a == b { return true; }
        match (a, b) {
            (Number(na), String(sb)) => {
                if let Some(da) = na.as_f64() { return sb.parse::<f64>().ok().map(|db| db == da).unwrap_or(false); }
                false
            }
            (String(sa), Number(nb)) => {
                if let Some(db) = nb.as_f64() { return sa.parse::<f64>().ok().map(|da| da == db).unwrap_or(false); }
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

fn execute_steps_inner(
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
                        if c == '"' { in_quotes = !in_quotes; i += 1; continue; }
                        if !in_quotes && c == '=' {
                            let prev = if i > 0 { bytes[i-1] as char } else { '\0' };
                            let next = if i+1 < bytes.len() { bytes[i+1] as char } else { '\0' };
                            if prev != '=' && next != '=' { return Some(i); }
                        }
                        i += 1;
                    }
                    None
                }
                if let Some(eq_pos) = find_assignment_equals(step) {
                    let (var, cmd) = step.split_at(eq_pos);
                    let var = var.trim();
                    let cmd = cmd[1..].trim();
                    let parts: Vec<String> = cmd.split_whitespace().map(|s| s.to_string()).collect();
                    if parts.is_empty() { continue; }

                    // Special handling: array index assignment like users[index] = body
                    if let Some(bracket_pos) = var.find('[') {
                        if var.ends_with(']') {
                            let base = var[..bracket_pos].trim();
                            let index_expr = &var[bracket_pos + 1..var.len() - 1];

                            // Determine index value (from literal number or context variable)
                            let mut idx: Option<usize> = None;
                            let index_expr_trim = index_expr.trim();
                            if let Ok(n) = index_expr_trim.parse::<i64>() {
                                if n >= 0 { idx = Some(n as usize); }
                            } else if let Some(JsonValue::Number(n)) = ctx.get(index_expr_trim) {
                                if let Some(i) = n.as_i64() { if i >= 0 { idx = Some(i as usize); } }
                            }

                            // Determine RHS value if it's a simple variable/literal (single token)
                            if let Some(i) = idx {
                                if parts.len() == 1 {
                                    if let Some(value) = resolve_path(ctx, &parts[0], None) {
                                        if let Some(JsonValue::Array(_)) = ctx.get(base) {
                                            if let Some(arr) = ctx.get_mut(base).and_then(|v| v.as_array_mut()) {
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
                    if verbose { println!("[DEBUG] Executing: {} = {} {:?}", var, name, args); }
                    let res = call_builtin(name, args, ctx, state.schemas.clone(), Some(var));
                    if verbose { println!("[DEBUG] Result: {:?}", res); }
                    match res {
                        BuiltinResult::Ok => {}
                        BuiltinResult::Respond(code, msg) => { last_response = Some((code, msg)); break; }
                        BuiltinResult::Error(err) => { last_response = Some((500, err)); break; }
                    }
                } else {
                    let parts: Vec<String> = step.split_whitespace().map(|s| s.to_string()).collect();
                    if parts.is_empty() { continue; }
                    let name = &parts[0];
                    let args = &parts[1..];
                    if verbose { println!("[DEBUG] Executing: {} {:?}", name, args); }
                    let res = call_builtin(name, args, ctx, state.schemas.clone(), None);
                    match res {
                        BuiltinResult::Ok => {}
                        BuiltinResult::Respond(code, msg) => { last_response = Some((code, msg)); break; }
                        BuiltinResult::Error(err) => { last_response = Some((500, err)); break; }
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
                                if let Some(resp) = execute_steps_inner(state.clone(), nested, ctx, verbose) {
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

async fn execute_steps(
    state: AppState,
    steps: Vec<Value>,
    body: Option<String>,
    path_params: Option<HashMap<String, String>>,
    verbose: bool,
) -> impl IntoResponse {
    let mut ctx: Context = Context::new();

    // Store path params in context
    if let Some(params) = path_params {
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

    let last_response = execute_steps_inner(state.clone(), &steps, &mut ctx, verbose);

    if let Some((code, msg)) = last_response {
        (StatusCode::from_u16(code).unwrap_or(StatusCode::OK), msg)
    } else {
        (StatusCode::OK, "OK".to_string())
    }
}
