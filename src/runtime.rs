use super::crud_web_fe::create_web_fe_handler;
use crate::builtins::{call_builtin, BuiltinResult, Context};
use crate::rune_ast::{RuneDocument, Section, Value};
use async_recursion::async_recursion;
use axum::{
    http::StatusCode,
    routing::{delete, get, post, put},
    Router,
    response::IntoResponse
};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::services::ServeDir;
use axum::{middleware::Next, response::Response, http::Request};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde_json::json;
use chrono::Utc;
use jsonwebtoken::{EncodingKey, Header};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;


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

fn extract_data_sources(doc: &RuneDocument) -> HashMap<String, Section> {
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

fn extract_auth_configs(doc: &RuneDocument) -> HashMap<String, Section> {
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

pub async fn build_router(doc: RuneDocument, rune_dir: PathBuf, verbose: bool) -> Router {
    let schemas = Arc::new(extract_schemas(&doc));
    let data_sources = Arc::new(extract_data_sources(&doc));
    let auth_configs = Arc::new(extract_auth_configs(&doc));
    let state = AppState {
        doc: Arc::new(doc),
        schemas,
        data_sources,
        path: rune_dir.clone()
    };
    let mut router = Router::with_state(Router::new(), state.clone());

    // If @App section has a "run" kv, execute its steps once
    if let Some(app_section) = state.doc.sections.iter().find(|s| s.path.first().map(|p| p.as_str()) == Some("App")) {
        if let Some(run_steps) = app_section.series.get("run") {
            let _ = execute_steps(state.clone(), run_steps.clone(), None, None, verbose).await;
        }
    }

    // Serve static files from the directory containing the rune document, mounted at /assets

    router = router.nest_service("/assets", ServeDir::new(rune_dir.clone()));

    for section in &state.doc.sections {
        if section.path.first().map(|s| s.as_str()) == Some("Frontend") {
            if let Some(Value::String(frontend_type)) = section.kv.get("type") {
                if frontend_type == "web" {
                    println!("[INFO] Mounting web frontend: {:?} {:?}", section.path, section.kv);
                    // Create a route for web frontend
                    let fe_path = section
                        .kv
                        .get("path")
                        .and_then(|v| v.as_str())
                        .unwrap_or("/");
                    let layout = section
                        .kv
                        .get("layout")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    if layout == "crud_powered" {
                        let wpath = if fe_path == "%ROOT%" { "/" } else { fe_path };
                        // Handler from crud_web_fe
                        let state_clone = state.clone();
                        let name = section.kv.get("name").unwrap().to_string();
                        router = router.route(
                            wpath,
                            get(move || create_web_fe_handler(state_clone.clone(), name)),
                        );

                        println!("[INFO] Web Frontend (CRUD Powered) mounted at {}\n", wpath);
                    }
                }
            }
        }

        if section.path.first().map(|s| s.as_str()) == Some("Route") {
            if section.path.len() < 3 {
                continue;
            }
            let method = section.path.get(1).map(|s| s.as_str()).unwrap_or("GET");
            let method = method.to_uppercase();
            let path_template = section
                .path
                .iter()
                .skip(2)
                .map(|s| s.as_str())
                .collect::<Vec<_>>()
                .join("/");
            let axum_path = format!("/{}", path_template);
            let default_step = vec![Value::String("respond 200 OK".to_string())];

            let state_clone = state.clone();
            let run_steps = section.series.get("run").cloned().unwrap_or(default_step);
            let handler = create_handler(state_clone.clone(), run_steps.clone(), verbose);

            if method == "CRUD" {
                for m in &["GET", "POST", "PUT", "DELETE"] {
                    for &with_id in &[false, true] {
                        let path = if with_id {
                            format!("{}/{}", axum_path, "{id}")
                        } else {
                            axum_path.clone()
                        };
                        let run_steps =
                            crate::builtins::builtin::data_source::get_data_source_commands(
                                m,
                                section.clone(),
                                &state.schemas,
                                &state.data_sources,
                                with_id,
                            );
                        let handler =
                            create_handler(state_clone.clone(), run_steps.clone(), verbose);
                        let route_fn = match *m {
                            "GET" => get(move |params| handler(params, None)),
                            "POST" => post(move |params, body| handler(params, Some(body))),
                            "PUT" => put(move |params, body| handler(params, Some(body))),
                            "DELETE" => delete(move |params| handler(params, None)),
                            _ => unreachable!(),
                        };
                        let new_router = Router::new();
                        let mut route = new_router.route(&path, route_fn);
                        if let Some(auth_name) = section.kv.get("auth").and_then(|v| v.as_str()) {
                            if let Some(auth_section) = auth_configs.get(auth_name) {
                                if let Some(Value::String(secret)) = auth_section.kv.get("secret") {
                                    let secret = secret.clone(); // clone here
                                    route = route.layer(axum::middleware::from_fn(move |req, next| {
                                        jwt_auth(req, next, secret.clone())
                                    }));
                                }
                            }
                        }
                        router = router.merge(route);
                    }
                }
                continue;
            }

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
                    if verbose {
                        eprintln!("[WARN] Unsupported HTTP method: {}", method);
                    }
                    // Fallback for unsupported methods
                    continue;
                }
            };

            let new_router = Router::new();
            let mut route = new_router.route(&axum_path, route_fn);
            if let Some(auth_name) = section.kv.get("auth").and_then(|v| v.as_str()) {
                if let Some(auth_section) = auth_configs.get(auth_name) {
                    if let Some(Value::String(secret)) = auth_section.kv.get("secret") {
                        let secret = secret.clone(); // clone here
                        route = route.layer(axum::middleware::from_fn(move |req, next| {
                            jwt_auth(req, next, secret.clone())
                        }));
                    }
                }
            }
            router = router.merge(route);
        }
    }


    add_token_endpoints(router, &auth_configs)
}

async fn token_handler(
    req: Request<axum::body::Body>,
    secret: String,
    creds: Option<Value>,
    token_expiry: i64,
) -> impl IntoResponse {
    // Parse Basic Auth if credentials are set
    if let Some(Value::Map(ref map)) = creds {
        let expected_user = map.get("username").and_then(|v| v.as_str()).unwrap_or("");
        let expected_pass = map.get("password").and_then(|v| v.as_str()).unwrap_or("");
        let auth_header = req.headers().get("Authorization").and_then(|v| v.to_str().ok());
        if let Some(auth_header) = auth_header {
            if let Some(basic) = auth_header.strip_prefix("Basic ") {
                if let Ok(decoded) = BASE64.decode(basic) {
                    if let Ok(decoded_str) = std::str::from_utf8(&decoded) {
                        let mut parts = decoded_str.splitn(2, ':');
                        let user = parts.next().unwrap_or("");
                        let pass = parts.next().unwrap_or("");
                        if user != expected_user || pass != expected_pass {
                            return (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()).into_response();
                        }
                    } else {
                        return (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()).into_response();
                    }
                } else {
                    return (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()).into_response();
                }
            } else {
                return (StatusCode::UNAUTHORIZED, "Missing Basic Auth".to_string()).into_response();
            }
        } else {
            return (StatusCode::UNAUTHORIZED, "Missing Basic Auth".to_string()).into_response();
        }
    }
    // Create JWT
    let claims = json!({
        "exp": Utc::now().timestamp() + token_expiry,
        "iat": Utc::now().timestamp(),
    });
    let token = jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    ).unwrap();
    (StatusCode::OK, token).into_response()
}

fn add_token_endpoints(
    mut router: Router,
    auth_configs: &HashMap<String, Section>,
) -> Router {
    for (_auth_name, auth_section) in auth_configs.iter() {
        if let Some(Value::String(token_endpoint)) = auth_section.kv.get("token_endpoint") {
            let secret = auth_section.kv.get("secret").and_then(|v| v.as_str()).unwrap_or("");
            let credentials = auth_section.kv.get("token_credentials");
            let token_expiry = auth_section.kv.get("token_expiry").and_then(|v| v.as_i64()).unwrap_or(3600);

            let endpoint = token_endpoint.clone();
            let secret = secret.to_string();
            let creds = credentials.cloned();

            router = router.route(
                &endpoint,
                post({
                    let secret = secret.clone();
                    let creds = creds.clone();
                    move |req: axum::http::Request<axum::body::Body>| {
                        let secret = secret.clone();
                        let creds = creds.clone();
                        async move {
                            token_handler(req, secret, creds, token_expiry).await
                        }
                    }
                }),
            );
        }
    }
    router
}


fn create_handler(
    state: AppState,
    steps: Vec<Value>,
    verbose: bool,
) -> impl Fn(
    axum::extract::Path<HashMap<String, String>>,
    Option<String>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = (StatusCode, String)> + Send>>
       + Clone {
    move |axum::extract::Path(params): axum::extract::Path<HashMap<String, String>>,
          body: Option<String>| {
        let state = state.clone();
        let steps = steps.clone();
        Box::pin(async move { execute_steps(state, steps, body, Some(params), verbose).await })
    }
}

// Helper to resolve simple literals and dotted paths in context
fn resolve_path(
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

fn eval_condition(ctx: &Context, expr: &str, it: Option<&serde_json::Value>) -> bool {
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
async fn execute_steps_inner(
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
                    let (var, cmd) = step.split_at(eq_pos);
                    let var = var.trim();
                    let cmd = cmd[1..].trim();
                    let parts: Vec<String> =
                        cmd.split_whitespace().map(|s| s.to_string()).collect();
                    if parts.is_empty() {
                        continue;
                    }

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
                        println!("[DEBUG] Executing: {} = {} {:?}", var, name, args);
                    }
                    let res = call_builtin(name, args, ctx, &state, Some(var)).await;
                    if verbose {
                        println!("[DEBUG] Result: {:?}", res);
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
                    let parts: Vec<String> =
                        step.split_whitespace().map(|s| s.to_string()).collect();
                    if parts.is_empty() {
                        continue;
                    }
                    let name = &parts[0];
                    let args = &parts[1..];
                    if verbose {
                        println!("[DEBUG] Executing: {} {:?}", name, args);
                    }
                    let res = call_builtin(name, args, ctx, &state, None).await;
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

async fn execute_steps(
    state: AppState,
    steps: Vec<Value>,
    body: Option<String>,
    path_params: Option<HashMap<String, String>>,
    verbose: bool,
) -> (StatusCode, String) {
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

    let last_response = execute_steps_inner(state.clone(), &steps, &mut ctx, verbose).await;

    if let Some((code, msg)) = last_response {
        (StatusCode::from_u16(code).unwrap_or(StatusCode::OK), msg)
    } else {
        (StatusCode::OK, "OK".to_string())
    }
}

async fn jwt_auth(
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