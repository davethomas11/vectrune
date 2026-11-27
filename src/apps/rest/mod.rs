pub mod ws;
pub mod swagger;

use crate::apps::rune_web::build_rune_web_router;
use crate::core::{execute_steps, extract_auth_configs, jwt_auth, AppState};
use crate::crud_web_fe::create_web_fe_handler;
use crate::rune_ast::Value;
use axum::{
    extract::{FromRequest, Query, RawQuery},
    http::{header, HeaderMap, HeaderValue, Method},
    http::Request,
    http::StatusCode,
    response::{Html, IntoResponse, Response},
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

#[derive(Clone)]
struct NotFound {
    state: AppState,
    custom: Option<(Vec<Value>, Option<String>)>,
    enabled: bool,
    config_error: Option<String>,
    name: String,
    routes: Vec<(String, String)>,
}

impl NotFound {
    fn new(state: AppState) -> Self {
        let app = state.doc.get_section("App");
        let enabled = !matches!(
            app.and_then(|s| s.kv.get("not_found_page")),
            Some(Value::Bool(false))
        );
        let mut config_error = match app.and_then(|s| s.kv.get("not_found_page")) {
            Some(Value::Bool(_)) | None => None,
            Some(_) => Some("@App not_found_page must be a boolean".to_string()),
        };
        let name = app
            .and_then(|s| s.kv.get("name"))
            .and_then(Value::as_str)
            .unwrap_or("Vectrune")
            .to_string();
        let custom = state.doc.get_section("NotFound").map(|section| {
            if section
                .kv
                .get("content_type")
                .is_some_and(|v| v.as_str().is_none())
            {
                config_error = Some("@NotFound content_type must be a string".to_string());
            }
            (
                section.series.get("run").cloned().unwrap_or_default(),
                section.kv.get("content_type").and_then(Value::as_str).map(str::to_string),
            )
        });
        let mut routes = Vec::new();
        for section in &state.doc.sections {
            if section.path.first().map(String::as_str) != Some("Route") || section.path.len() < 3 {
                continue;
            }
            let method = section.path[1].to_uppercase();
            let path = format!("/{}", section.path[2..].join("/"));
            match method.as_str() {
                "CRUD" => {
                    for method in ["GET", "POST", "PUT", "DELETE"] {
                        routes.push((method.to_string(), path.clone()));
                        routes.push((method.to_string(), format!("{path}/{{id}}")));
                    }
                }
                "GET" | "POST" | "PUT" | "DELETE" => routes.push((method, path)),
                _ => {}
            }
        }
        routes.sort();
        routes.dedup();
        Self { state, custom, enabled, config_error, name, routes }
    }

    async fn respond(self, request: Request<axum::body::Body>) -> Response {
        if let Some(error) = self.config_error {
            return (StatusCode::INTERNAL_SERVER_ERROR, error).into_response();
        }
        if let Some((steps, content_type)) = self.custom {
            if steps.is_empty() {
                return (StatusCode::INTERNAL_SERVER_ERROR, "@NotFound requires a run block")
                    .into_response();
            }
            let content_type = match content_type {
                Some(value) => match HeaderValue::from_str(&value) {
                    Ok(value) => Some(value),
                    Err(_) => {
                        return (StatusCode::INTERNAL_SERVER_ERROR, "Invalid @NotFound content_type")
                            .into_response();
                    }
                },
                None => None,
            };
            let is_head = request.method() == Method::HEAD;
            let pretty = has_pretty(request.uri().query());
            let body = match String::from_request(request, &()).await {
                Ok(body) => body,
                Err(rejection) => return rejection.into_response(),
            };
            let (status, body) = execute_steps(self.state, steps, Some(body), None).await;
            let body = if content_type.as_ref().is_none_or(|value| {
                value.to_str().is_ok_and(|value| {
                    let media = value.split(';').next().unwrap_or("").trim();
                    media.eq_ignore_ascii_case("text/plain")
                        || media.eq_ignore_ascii_case("application/json")
                        || media.to_ascii_lowercase().ends_with("+json")
                })
            }) {
                pretty_json(body, pretty)
            } else {
                body
            };
            let mut response = (status, body).into_response();
            if let Some(content_type) = content_type {
                response.headers_mut().insert(header::CONTENT_TYPE, content_type);
            }
            if is_head {
                *response.body_mut() = axum::body::Body::empty();
            }
            return response;
        }
        if !self.enabled {
            return StatusCode::NOT_FOUND.into_response();
        }
        let wants_html = accepts_html(request.headers());
        let mut response = if wants_html {
            let escape = crate::apps::rune_web::html_escape;
            let route_list = if self.routes.is_empty() {
                "<p>No routes declared.</p>".to_string()
            } else {
                let items = self.routes.iter()
                    .map(|(method, path)| {
                        let label = format!("{} {}", escape(method), escape(path));
                        if method == "GET" && safe_route_link(path) {
                            format!("<li><a href=\"{}\"><code>{label}</code></a></li>", escape(path))
                        } else {
                            format!("<li><code>{label}</code></li>")
                        }
                    })
                    .collect::<String>();
                format!("<ul>{items}</ul>")
            };
            let html = format!(r#"<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found | {name}</title><style>
*{{box-sizing:border-box}}body{{margin:0;background:#0b1020;color:#e9edf8;font:16px/1.6 system-ui,sans-serif}}
main{{max-width:760px;margin:8vh auto;padding:32px}}.brand{{color:#a5b4fc;font-weight:700;letter-spacing:.12em}}
.card{{background:#151d32;border:1px solid #303c59;border-radius:20px;padding:32px;box-shadow:0 20px 60px #0004}}
h1{{font-size:clamp(2rem,6vw,3rem);line-height:1.15;margin:.3em 0}}p{{color:#bdc9df}}
ul{{list-style:none;padding:0;display:grid;gap:8px}}li{{background:#0b1020;border-radius:8px;padding:10px 14px;overflow-wrap:anywhere}}code{{color:#c7d2fe}}a{{color:#c7d2fe;text-decoration:underline}}a:hover code{{color:#fff}}
</style></head><body><main><div class="brand">VECTRUNE</div><div class="card">
<p>404 &mdash; {name}</p><h1>Page not found</h1><p>No route matched <code>{path}</code>.</p>
<h2>Possible routes</h2>{route_list}</div></main></body></html>"#,
                name = escape(&self.name), path = escape(request.uri().path()));
            let mut response = (StatusCode::NOT_FOUND, Html(html)).into_response();
            if request.method() == Method::HEAD {
                *response.body_mut() = axum::body::Body::empty();
            }
            response
        } else {
            StatusCode::NOT_FOUND.into_response()
        };
        response.headers_mut().insert(header::VARY, HeaderValue::from_static("Accept"));
        response
    }
}

fn safe_route_link(path: &str) -> bool {
    path.starts_with('/') && !path.starts_with("//")
        && path.bytes().all(|c| c.is_ascii_alphanumeric() || b"/-._~".contains(&c))
        && !path.split('/').any(|segment| matches!(segment, "." | ".."))
}

fn has_pretty(query: Option<&str>) -> bool {
    query.is_some_and(|query| {
        Query::<HashMap<String, String>>::try_from_uri(
            &format!("/?{query}").parse().expect("query came from a valid URI")
        ).is_ok_and(|Query(params)| params.contains_key("pretty"))
    })
}

fn pretty_json(body: String, pretty: bool) -> String {
    if !pretty {
        return body;
    }
    let mut deserializer = serde_json::Deserializer::from_str(&body);
    if serde::Deserialize::deserialize(&mut deserializer)
        .and_then(|_: serde::de::IgnoredAny| deserializer.end()).is_err()
    {
        return body;
    }

    let mut result = String::with_capacity(body.len());
    let mut chars = body.chars().peekable();
    let mut indent = 0usize;
    let mut in_string = false;
    let mut escaped = false;
    while let Some(c) = chars.next() {
        if in_string {
            result.push(c);
            if escaped {
                escaped = false;
            } else if c == '\\' {
                escaped = true;
            } else if c == '"' {
                in_string = false;
            }
            continue;
        }
        match c {
            '"' => { in_string = true; result.push(c); }
            '{' | '[' => {
                result.push(c);
                while chars.peek().is_some_and(|c| c.is_ascii_whitespace()) { chars.next(); }
                if !matches!((c, chars.peek()), ('{', Some('}')) | ('[', Some(']'))) {
                    indent += 1;
                    result.push('\n');
                    result.push_str(&"  ".repeat(indent));
                } else {
                    result.push(chars.next().expect("matching closing delimiter"));
                }
            }
            '}' | ']' => {
                indent -= 1;
                result.push('\n');
                result.push_str(&"  ".repeat(indent));
                result.push(c);
            }
            ',' => {
                result.push_str(",\n");
                result.push_str(&"  ".repeat(indent));
            }
            ':' => result.push_str(": "),
            c if c.is_ascii_whitespace() => {}
            _ => result.push(c),
        }
    }
    result
}

fn accepts_html(headers: &HeaderMap) -> bool {
    headers.get_all(header::ACCEPT).iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        .any(|item| {
            let mut parts = item.trim().split(';');
            if !parts.next().is_some_and(|media| media.trim().eq_ignore_ascii_case("text/html")) {
                return false;
            }
            let mut quality = 1.0_f32;
            for part in parts {
                if let Some((key, value)) = part.trim().split_once('=') {
                    if key.trim().eq_ignore_ascii_case("q") {
                        quality = value.trim().parse::<f32>().unwrap_or(-1.0);
                    }
                }
            }
            quality > 0.0 && quality <= 1.0
        })
}

#[cfg(test)]
mod formatting_tests {
    use super::{pretty_json, safe_route_link};

    #[test]
    fn pretty_json_preserves_json_tokens_and_rejects_non_json() {
        let body = r#"{"number":123456789012345678901234567890,"escaped":"a \"b\"","empty":[]}"#.to_string();
        let formatted = pretty_json(body.clone(), true);
        assert!(formatted.contains("123456789012345678901234567890"));
        assert!(formatted.contains(r#""escaped": "a \"b\"""#));
        assert!(formatted.contains(r#""empty": []"#));
        assert_eq!(pretty_json(body.clone(), false), body);
        assert_eq!(pretty_json("not json".into(), true), "not json");
        assert_eq!(pretty_json("{bad}".into(), true), "{bad}");
        assert_eq!(pretty_json("[{}, [1,2], null]".into(), true), "[\n  {},\n  [\n    1,\n    2\n  ],\n  null\n]");
    }

    #[test]
    fn route_links_only_allow_safe_concrete_paths() {
        for path in ["/", "/health", "/users/user-1"] {
            assert!(safe_route_link(path), "{path}");
        }
        for path in ["//evil.example", "/users/{id}", "/foo?x=1", "/%2f%2fevil", "/foo\"bar", "/../admin", "javascript:alert"] {
            assert!(!safe_route_link(path), "{path}");
        }
    }
}

pub async fn build_rest_router(state: AppState) -> Router {
    // Initialize Memory from @Memory sections
    crate::core::initialize_memory_from_doc(&state.doc, &state.path).await;

    let doc = state.doc.clone();
    let auth_configs = Arc::new(extract_auth_configs(&doc));
    let mut router = Router::with_state(Router::new(), state.clone());
    let not_found = NotFound::new(state.clone());
    let mut root_static = false;

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
        let openapi_json = Arc::new(swagger::generate_openapi_json(&state.doc));
        let openapi_json_clone = openapi_json.clone();
        router = router.route(
            "/openapi.json",
            get(move |RawQuery(query): RawQuery| {
                let json = openapi_json_clone.clone();
                async move { (axum::http::StatusCode::OK, pretty_json(json.to_string(), has_pretty(query.as_deref()))) }
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
                        root_static = true;
                        if not_found.enabled || not_found.custom.is_some() || not_found.config_error.is_some() {
                            let handler = not_found.clone();
                            let fallback = Router::new().fallback(move |request| handler.clone().respond(request));
                            router = router.fallback_service(service.fallback(fallback));
                        } else {
                            router = router.fallback_service(service);
                        }
                    } else {
                        router = router.nest_service(wpath, service);
                    }
                } else if matches!(frontend_type.as_str(), "rune-web" | "rune-mobile-web") {
                    router = router.merge(build_rune_web_router(state.clone()).await);
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
                            "GET" => get(move |params, query| handler(params, None, query)),
                            "POST" => post(move |params, query, body| handler(params, Some(body), query)),
                            "PUT" => put(move |params, query, body| handler(params, Some(body), query)),
                            "DELETE" => delete(move |params, query| handler(params, None, query)),
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
                        "GET" => get(move |params, query| handler(params, None, query)),
                        "DELETE" => delete(move |params, query| handler(params, None, query)),
                        _ => unreachable!(),
                    }
                }
                "POST" | "PUT" => {
                    let handler = handler.clone();
                    match method.as_str() {
                        "POST" => post(move |params, query, body| handler(params, Some(body), query)),
                        "PUT" => put(move |params, query, body| handler(params, Some(body), query)),
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

    if !root_static && (not_found.enabled || not_found.custom.is_some() || not_found.config_error.is_some()) {
        router = router.fallback(move |request| not_found.clone().respond(request));
    }
    add_token_endpoints(router, &auth_configs)
}

fn create_handler(
    state: AppState,
    steps: Vec<Value>,
) -> impl Fn(
    axum::extract::Path<HashMap<String, String>>,
    Option<String>,
    RawQuery,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = (StatusCode, String)> + Send>>
       + Clone {
    move |axum::extract::Path(params): axum::extract::Path<HashMap<String, String>>,
          body: Option<String>,
          RawQuery(query): RawQuery| {
        let state = state.clone();
        let steps = steps.clone();
        Box::pin(async move {
            let (status, body) = execute_steps(state, steps, body, Some(params)).await;
            (status, pretty_json(body, has_pretty(query.as_deref())))
        })
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
