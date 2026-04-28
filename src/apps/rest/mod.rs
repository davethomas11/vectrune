pub mod ws;

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
use crate::apps::rest::ws::ws_handler;

pub async fn build_rest_router(state: AppState) -> Router {
    // Initialize Memory from @Memory sections
    crate::core::initialize_memory_from_doc(&state.doc, &state.path).await;

    let doc = state.doc.clone();
    let auth_configs = Arc::new(extract_auth_configs(&doc));
    let mut router = Router::with_state(Router::new(), state.clone());

    // If @App section has a "run" kv, execute its steps once
    let mut swagger_enabled = false;
    if let Some(app_section) = state
        .doc
        .sections
        .iter()
        .find(|s| s.path.first().map(|p| p.as_str()) == Some("App"))
    {
        if let Some(run_steps) = app_section.series.get("run") {
            let _ = execute_steps(state.clone(), run_steps.clone(), None, None).await;
        }
        if let Some(Value::Bool(true)) = app_section.kv.get("swagger") {
            swagger_enabled = true;
        }
    }

    if swagger_enabled {
        let openapi_json = Arc::new(generate_openapi_json(&state.doc));
        let openapi_json_clone = openapi_json.clone();
        router = router.route(
            "/openapi.json",
            get(move || {
                let json = openapi_json_clone.clone();
                async move { (axum::http::StatusCode::OK, json.to_string()) }
            }),
        );
        router = router.route(
            "/swagger-ui",
            get(move || async {
                axum::response::Html(format!(
                    r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Swagger UI</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" >
    <style>
        html {{ box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }}
        *, *:before, *:after {{ box-sizing: inherit; }}
        body {{ margin:0; background: #fafafa; }}
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" charset="UTF-8"> </script>
    <script>
        window.onload = function() {{
            const ui = SwaggerUIBundle({{
                url: "/openapi.json",
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                ],
            }});
            window.ui = ui;
        }};
    </script>
</body>
</html>"#
                ))
            }),
        );
    }

    // Serve static files
    router = router.nest_service("/assets", ServeDir::new(state.path.clone()));

    for section in &state.doc.sections {
        if section.path.first().map(|s| s.as_str()) == Some("Websocket") {
            let path_raw = section.path.get(1).map(|s| s.as_str()).unwrap_or("/ws");
            let path = if path_raw.starts_with('/') {
                path_raw.to_string()
            } else {
                format!("/{}", path_raw)
            };
            let state_clone = state.clone();
            let p = path.clone();
            router = router.route(&path, get(move |ws| ws_handler(ws, state_clone, p)));
            continue;
        }

        if section.path.first().map(|s| s.as_str()) == Some("Frontend") {
            if let Some(Value::String(frontend_type)) = section.kv.get("type") {
                let fe_path = section
                    .kv
                    .get("path")
                    .and_then(|v| v.as_str())
                    .unwrap_or("/");
                let wpath = if fe_path == "%ROOT%" { "/" } else { fe_path };

                if frontend_type == "web" {
                    let layout = section
                        .kv
                        .get("layout")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    if layout == "crud_powered" {
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
                } else if frontend_type == "static" {
                    let local_path = section
                        .kv
                        .get("src")
                        .and_then(|v| v.as_str())
                        .unwrap_or(".");
                    let full_local_path = state.path.join(local_path);
                    crate::util::log(crate::util::LogLevel::Info, &format!("Serving static files from: {:?}", full_local_path));
                    
                    let service = ServeDir::new(full_local_path).append_index_html_on_directories(true);
                    if wpath == "/" {
                        router = router.fallback_service(service);
                    } else {
                        router = router.nest_service(wpath, service);
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
                            create_handler(state_clone.clone(), run_steps.clone());
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

            let handler = create_handler(state_clone.clone(), run_steps.clone());
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
) -> impl Fn(
    axum::extract::Path<HashMap<String, String>>,
    Option<String>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = (StatusCode, String)> + Send>>
       + Clone {
    move |axum::extract::Path(params): axum::extract::Path<HashMap<String, String>>,
          body: Option<String>| {
        let state = state.clone();
        let steps = steps.clone();
        Box::pin(async move { execute_steps(state, steps, body, Some(params)).await })
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

fn rune_schema_field_type(field_type: &str) -> serde_json::Value {
    match field_type {
        "number" => json!({ "type": "number" }),
        "bool" => json!({ "type": "boolean" }),
        "string" => json!({ "type": "string" }),
        other => json!({ "$ref": format!("#/components/schemas/{}", other) }),
    }
}

fn build_openapi_components(
    doc: &crate::rune_ast::RuneDocument,
) -> serde_json::Map<String, serde_json::Value> {
    let mut schemas = serde_json::Map::new();

    for section in &doc.sections {
        if section.path.first().map(|s| s.as_str()) != Some("Schema") {
            continue;
        }

        let Some(schema_name) = section.path.get(1) else {
            continue;
        };

        let mut properties = serde_json::Map::new();
        let mut required = Vec::new();

        for (field_name, field_type) in &section.kv {
            if let Some(field_type) = field_type.as_str() {
                properties.insert(field_name.clone(), rune_schema_field_type(field_type));
                required.push(field_name.clone());
            }
        }

        schemas.insert(
            schema_name.clone(),
            json!({
                "type": "object",
                "properties": properties,
                "required": required
            }),
        );
    }

    schemas
}

fn add_expect_request_body(
    operation: &mut serde_json::Map<String, serde_json::Value>,
    section: &crate::rune_ast::Section,
    components: &serde_json::Map<String, serde_json::Value>,
) {
    let Some(expect) = section.kv.get("expect").and_then(|v| v.as_str()) else {
        return;
    };

    if !components.contains_key(expect) {
        return;
    }

    operation.insert(
        "requestBody".to_string(),
        json!({
            "required": true,
            "content": {
                "application/json": {
                    "schema": {
                        "$ref": format!("#/components/schemas/{}", expect)
                    }
                }
            }
        }),
    );
}

fn generate_openapi_json(doc: &crate::rune_ast::RuneDocument) -> String {
    let mut paths = serde_json::Map::new();
    let components_schemas = build_openapi_components(doc);

    for section in &doc.sections {
        if section.path.first().map(|s| s.as_str()) == Some("Route") {
            if section.path.len() < 3 {
                continue;
            }
            let method = section
                .path
                .get(1)
                .map(|s| s.as_str())
                .unwrap_or("GET")
                .to_lowercase();
            let path_template = section
                .path
                .iter()
                .skip(2)
                .map(|s| s.as_str())
                .collect::<Vec<_>>()
                .join("/");
            let axum_path = format!("/{}", path_template);

            let description = section
                .kv
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if method == "crud" {
                for m in &["get", "post", "put", "delete"] {
                    for &with_id in &[false, true] {
                        let path = if with_id {
                            format!("{}/{{id}}", axum_path)
                        } else {
                            axum_path.clone()
                        };

                        let path_item = paths
                            .entry(path.clone())
                            .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()))
                            .as_object_mut()
                            .unwrap();

                        let mut operation = serde_json::Map::new();
                        operation.insert(
                            "summary".to_string(),
                            json!(format!("{} {}", m.to_uppercase(), path)),
                        );
                        operation.insert("description".to_string(), json!(description));
                        operation.insert("responses".to_string(), json!({
                            "200": { "description": "OK" }
                        }));

                        if with_id {
                            operation.insert("parameters".to_string(), json!([
                                {
                                    "name": "id",
                                    "in": "path",
                                    "required": true,
                                    "schema": { "type": "string" }
                                }
                            ]));
                        }

                        path_item.insert(m.to_string(), serde_json::Value::Object(operation));
                    }
                }
                continue;
            }

            let path_item = paths
                .entry(axum_path.clone())
                .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()))
                .as_object_mut()
                .unwrap();

            let mut operation = serde_json::Map::new();
            operation.insert(
                "summary".to_string(),
                json!(format!("{} {}", method.to_uppercase(), axum_path)),
            );
            operation.insert("description".to_string(), json!(description));
            operation.insert("responses".to_string(), json!({
                "200": { "description": "OK" }
            }));
            add_expect_request_body(&mut operation, section, &components_schemas);

            path_item.insert(method, serde_json::Value::Object(operation));
        }
    }

    let openapi = json!({
        "openapi": "3.0.0",
        "info": {
            "title": "Vectrune API",
            "version": "1.0.0"
        },
        "paths": paths,
        "components": {
            "schemas": components_schemas
        }
    });

    serde_json::to_string_pretty(&openapi).unwrap()
}
