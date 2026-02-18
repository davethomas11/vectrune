use crate::core::{execute_steps, extract_auth_configs, jwt_auth, AppState};
use crate::crud_web_fe::create_web_fe_handler;
use crate::rune_ast::Value;
use axum::{
    http::Request,
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post, put},
    Router,
};
use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use chrono::Utc;
use jsonwebtoken::{EncodingKey, Header};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tower_http::services::ServeDir;

pub async fn build_rest_router(state: AppState, verbose: bool) -> Router {
    // Initialize Memory from @Memory sections
    crate::core::initialize_memory_from_doc(&state.doc);

    let doc = state.doc.clone();
    let auth_configs = Arc::new(extract_auth_configs(&doc));
    let mut router = Router::with_state(Router::new(), state.clone());

    // If @App section has a "run" kv, execute its steps once
    if let Some(app_section) = state
        .doc
        .sections
        .iter()
        .find(|s| s.path.first().map(|p| p.as_str()) == Some("App"))
    {
        if let Some(run_steps) = app_section.series.get("run") {
            let _ = execute_steps(state.clone(), run_steps.clone(), None, None, verbose).await;
        }
    }

    // Serve static files
    router = router.nest_service("/assets", ServeDir::new(state.path.clone()));

    for section in &state.doc.sections {
        if section.path.first().map(|s| s.as_str()) == Some("Frontend") {
            if let Some(Value::String(frontend_type)) = section.kv.get("type") {
                if frontend_type == "web" {
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
                        let state_clone = state.clone();
                        let name = section
                            .kv
                            .get("name")
                            .map(|v| v.to_string())
                            .unwrap_or_default();
                        router = router.route(
                            wpath,
                            get(move || create_web_fe_handler(state_clone.clone(), name)),
                        );
                    }
                }
            }
        }

        if section.path.first().map(|s| s.as_str()) == Some("Route") {
            if section.path.len() < 3 {
                continue;
            }
            let method = section
                .path
                .get(1)
                .map(|s| s.as_str())
                .unwrap_or("GET")
                .to_uppercase();
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
                                    let secret = secret.clone();
                                    route =
                                        route.layer(axum::middleware::from_fn(move |req, next| {
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

            let handler = create_handler(state_clone.clone(), run_steps.clone(), verbose);
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
                _ => continue,
            };

            let new_router = Router::new();
            let mut route = new_router.route(&axum_path, route_fn);
            if let Some(auth_name) = section.kv.get("auth").and_then(|v| v.as_str()) {
                if let Some(auth_section) = auth_configs.get(auth_name) {
                    if let Some(Value::String(secret)) = auth_section.kv.get("secret") {
                        let secret = secret.clone();
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

fn add_token_endpoints(
    mut router: Router,
    auth_configs: &HashMap<String, crate::rune_ast::Section>,
) -> Router {
    for (_auth_name, auth_section) in auth_configs.iter() {
        if let Some(Value::String(token_endpoint)) = auth_section.kv.get("token_endpoint") {
            let secret = auth_section
                .kv
                .get("secret")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let credentials = auth_section.kv.get("token_credentials");
            let token_expiry = auth_section
                .kv
                .get("token_expiry")
                .and_then(|v| v.as_i64())
                .unwrap_or(3600);

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
                        async move { token_handler(req, secret, creds, token_expiry).await }
                    }
                }),
            );
        }
    }
    router
}

async fn token_handler(
    req: Request<axum::body::Body>,
    secret: String,
    creds: Option<Value>,
    token_expiry: i64,
) -> impl IntoResponse {
    if let Some(Value::Map(ref map)) = creds {
        let expected_user = map.get("username").and_then(|v| v.as_str()).unwrap_or("");
        let expected_pass = map.get("password").and_then(|v| v.as_str()).unwrap_or("");
        let auth_header = req
            .headers()
            .get("Authorization")
            .and_then(|v| v.to_str().ok());
        if let Some(auth_header) = auth_header {
            if let Some(basic) = auth_header.strip_prefix("Basic ") {
                if let Ok(decoded) = BASE64.decode(basic) {
                    if let Ok(decoded_str) = std::str::from_utf8(&decoded) {
                        let mut parts = decoded_str.splitn(2, ':');
                        let user = parts.next().unwrap_or("");
                        let pass = parts.next().unwrap_or("");
                        if user != expected_user || pass != expected_pass {
                            return (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string())
                                .into_response();
                        }
                    } else {
                        return (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string())
                            .into_response();
                    }
                } else {
                    return (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string())
                        .into_response();
                }
            } else {
                return (StatusCode::UNAUTHORIZED, "Missing Basic Auth".to_string())
                    .into_response();
            }
        } else {
            return (StatusCode::UNAUTHORIZED, "Missing Basic Auth".to_string()).into_response();
        }
    }
    let claims = json!({
        "exp": Utc::now().timestamp() + token_expiry,
        "iat": Utc::now().timestamp(),
    });
    let token = jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .unwrap();
    (StatusCode::OK, token).into_response()
}
