use async_trait::async_trait;
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    Json, Router,
};
use rune_runtime::{
    apps::{
        app_type_supported, build_app_router,
        dynamic_ai_web::{
            engine::{AiEngine, EngineError, OutputKind},
            router_with_engine,
        },
    },
    core::{extract_data_sources, extract_schemas, AppState},
    rune_ast::RuneDocument,
    rune_parser::parse_rune,
};
use serde_json::{json, Value};
use std::{
    collections::VecDeque,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::sync::{Mutex, Notify};
use tower::ServiceExt;

const HTML: &str = "<!doctype html><html><body><h1>Generated cafe</h1></body></html>";
const SITE: &str = r#"@App
name = Cafe AI
type = dynamic-ai-web
engine = ollama
model = test-model
cache_seconds = 60
max_concurrent = 1
private_token = not-for-the-model
@Site
title = Tiny Cafe
description = A friendly neighborhood cafe
@Data/Menu
+ name = Tea
  price = 3
@Page/home
path = /
description = Responsive cafe homepage showing our menu
@Page/about
path = /about
description = Our story
@Route/POST /api/recommend/{category}
description = Recommend one item from Data/Menu using the request preferences
response = json
"#;

struct Fake {
    replies: Mutex<VecDeque<String>>,
    prompts: Mutex<Vec<(String, OutputKind)>>,
    calls: AtomicUsize,
}
impl Fake {
    fn new(replies: &[&str]) -> Arc<Self> {
        Arc::new(Self {
            replies: Mutex::new(replies.iter().map(|value| (*value).into()).collect()),
            prompts: Mutex::new(Vec::new()),
            calls: AtomicUsize::new(0),
        })
    }
}
#[async_trait]
impl AiEngine for Fake {
    async fn generate(&self, prompt: &str, output: OutputKind) -> Result<String, EngineError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.prompts.lock().await.push((prompt.into(), output));
        self.replies
            .lock()
            .await
            .pop_front()
            .ok_or_else(|| EngineError("Engine offline".into()))
    }
}
fn app(source: &str, engine: Arc<dyn AiEngine>) -> Router {
    router_with_engine(&parse_rune(source).unwrap(), engine).unwrap()
}
async fn request(app: Router, method: &str, path: &str, body: &str) -> axum::response::Response {
    app.oneshot(
        Request::builder()
            .method(method)
            .uri(path)
            .header("content-type", "application/json")
            .body(Body::from(body.to_owned()))
            .unwrap(),
    )
    .await
    .unwrap()
}
async fn text(response: axum::response::Response) -> String {
    String::from_utf8(
        to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap()
            .to_vec(),
    )
    .unwrap()
}

#[tokio::test]
async fn pages_generate_html_and_apis_get_json_request_context() {
    assert!(app_type_supported("dynamic-ai-web"));
    assert!(app_type_supported("DYNAMIC-AI-WEB"));
    let engine = Fake::new(&[HTML, "```json\n{\"item\":\"Tea\"}\n```"]);
    let router = app(SITE, engine.clone());
    let page = request(router.clone(), "GET", "/", "").await;
    assert_eq!(page.status(), StatusCode::OK);
    assert!(page.headers()["content-type"]
        .to_str()
        .unwrap()
        .starts_with("text/html"));
    assert!(page.headers()["content-security-policy"]
        .to_str()
        .unwrap()
        .contains("connect-src 'self'"));
    assert_eq!(page.headers()["x-vectrune-ai-engine"], "ollama");
    assert_eq!(text(page).await, HTML);
    let response = router
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/recommend/drinks?budget=5")
                .header("authorization", "Bearer never-forward-this")
                .header("cookie", "secret-cookie")
                .body(Body::from(r#"{"preference":"vegan"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()["content-type"], "application/json");
    assert_eq!(response.headers()["x-vectrune-ai-cache"], "disabled");
    assert_eq!(
        serde_json::from_str::<Value>(&text(response).await).unwrap(),
        json!({"item":"Tea"})
    );
    let prompts = engine.prompts.lock().await;
    assert_eq!(prompts[0].1, OutputKind::Html);
    assert_eq!(prompts[1].1, OutputKind::Json);
    for (prompt, _) in prompts.iter() {
        assert!(prompt.contains("Tiny Cafe") && prompt.contains("Tea"));
        assert!(!prompt.contains("not-for-the-model"));
        assert!(!prompt.contains("never-forward-this") && !prompt.contains("secret-cookie"));
    }
    assert!(prompts[1].0.contains("\"category\":\"drinks\""));
    assert!(prompts[1].0.contains("budget=5") && prompts[1].0.contains("vegan"));
}

#[tokio::test]
async fn page_cache_is_keyed_by_url_and_body_and_does_not_cache_apis() {
    let engine = Fake::new(&[HTML, HTML, HTML, "{}", "{}"]);
    let router = app(SITE, engine.clone());
    let first = request(router.clone(), "GET", "/", "").await;
    assert_eq!(first.headers()["x-vectrune-ai-cache"], "miss");
    let hit = request(router.clone(), "GET", "/", "").await;
    assert_eq!(hit.headers()["x-vectrune-ai-cache"], "hit");
    assert_eq!(engine.calls.load(Ordering::SeqCst), 1);
    assert_eq!(
        request(router.clone(), "GET", "/?q=tea", "")
            .await
            .headers()["x-vectrune-ai-cache"],
        "miss"
    );
    assert_eq!(
        request(router.clone(), "GET", "/", "{\"different\":true}")
            .await
            .headers()["x-vectrune-ai-cache"],
        "miss"
    );
    for _ in 0..2 {
        assert_eq!(
            request(router.clone(), "POST", "/api/recommend/tea", "{}")
                .await
                .status(),
            StatusCode::OK
        );
    }
    assert_eq!(engine.calls.load(Ordering::SeqCst), 5);
}

#[tokio::test]
async fn caching_can_be_disabled_and_entries_are_bounded() {
    let engine = Fake::new(&[HTML, HTML, HTML]);
    let router = app(
        &SITE.replace("cache_seconds = 60", "cache_seconds = 0"),
        engine.clone(),
    );
    for _ in 0..2 {
        assert_eq!(
            request(router.clone(), "GET", "/", "").await.headers()["x-vectrune-ai-cache"],
            "disabled"
        );
    }
    assert_eq!(engine.calls.load(Ordering::SeqCst), 2);
    let engine = Fake::new(&[HTML, HTML, HTML]);
    let router = app(
        &SITE.replace(
            "cache_seconds = 60",
            "cache_seconds = 60\ncache_entries = 1",
        ),
        engine.clone(),
    );
    for path in ["/", "/about", "/"] {
        assert_eq!(
            request(router.clone(), "GET", path, "").await.headers()["x-vectrune-ai-cache"],
            "miss"
        );
    }
    assert_eq!(engine.calls.load(Ordering::SeqCst), 3);
}

#[tokio::test]
async fn expired_pages_regenerate() {
    let engine = Fake::new(&[HTML, HTML]);
    let router = app(
        &SITE.replace("cache_seconds = 60", "cache_seconds = 1"),
        engine.clone(),
    );
    request(router.clone(), "GET", "/", "").await;
    tokio::time::sleep(Duration::from_millis(1050)).await;
    assert_eq!(
        request(router, "GET", "/", "").await.headers()["x-vectrune-ai-cache"],
        "miss"
    );
    assert_eq!(engine.calls.load(Ordering::SeqCst), 2);
}

#[tokio::test]
async fn head_unknown_routes_and_bad_input_do_not_invoke_ai() {
    let engine = Fake::new(&[]);
    let router = app(SITE, engine.clone());
    for (method, path, body, status) in [
        ("HEAD", "/", "", StatusCode::OK),
        ("GET", "/missing", "", StatusCode::NOT_FOUND),
        ("POST", "/", "", StatusCode::METHOD_NOT_ALLOWED),
        (
            "POST",
            "/api/recommend/tea",
            "{broken",
            StatusCode::BAD_REQUEST,
        ),
    ] {
        assert_eq!(
            request(router.clone(), method, path, body).await.status(),
            status
        );
    }
    assert_eq!(
        request(router, "POST", "/api/recommend/tea", &"x".repeat(65537))
            .await
            .status(),
        StatusCode::PAYLOAD_TOO_LARGE
    );
    assert_eq!(engine.calls.load(Ordering::SeqCst), 0);
}

#[tokio::test]
async fn invalid_outputs_and_engine_errors_return_errors_and_are_not_cached() {
    let engine = Fake::new(&["Sure! <html>bad</html>", HTML, "not-json"]);
    let router = app(SITE, engine.clone());
    assert_eq!(
        request(router.clone(), "GET", "/", "").await.status(),
        StatusCode::BAD_GATEWAY
    );
    assert_eq!(
        request(router.clone(), "GET", "/", "").await.status(),
        StatusCode::OK
    );
    assert_eq!(
        request(router.clone(), "POST", "/api/recommend/tea", "{}")
            .await
            .status(),
        StatusCode::BAD_GATEWAY
    );
    assert_eq!(
        request(router, "GET", "/about", "").await.status(),
        StatusCode::BAD_GATEWAY
    );
    let engine = Fake::new(&[&"a".repeat(1024 * 1024 + 1)]);
    assert_eq!(
        request(app(SITE, engine), "GET", "/", "").await.status(),
        StatusCode::BAD_GATEWAY
    );
    let engine = Fake::new(&[&format!("```html\n{}\n```", HTML)]);
    assert_eq!(
        text(request(app(SITE, engine), "GET", "/", "").await).await,
        HTML
    );
}

struct Blocked {
    entered: Notify,
    release: Notify,
}
#[async_trait]
impl AiEngine for Blocked {
    async fn generate(&self, _: &str, _: OutputKind) -> Result<String, EngineError> {
        self.entered.notify_one();
        self.release.notified().await;
        Ok(HTML.into())
    }
}
#[tokio::test]
async fn concurrency_is_bounded_without_queueing_http_requests() {
    let engine = Arc::new(Blocked {
        entered: Notify::new(),
        release: Notify::new(),
    });
    let router = app(SITE, engine.clone());
    let first = tokio::spawn(request(router.clone(), "GET", "/", ""));
    engine.entered.notified().await;
    let busy = request(router, "GET", "/about", "").await;
    assert_eq!(busy.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(busy.headers()["retry-after"], "1");
    engine.release.notify_one();
    assert_eq!(first.await.unwrap().status(), StatusCode::OK);
}
struct SlowFirst {
    calls: AtomicUsize,
}
#[async_trait]
impl AiEngine for SlowFirst {
    async fn generate(&self, _: &str, _: OutputKind) -> Result<String, EngineError> {
        if self.calls.fetch_add(1, Ordering::SeqCst) == 0 {
            tokio::time::sleep(Duration::from_secs(60)).await;
        }
        Ok(HTML.into())
    }
}
#[tokio::test]
async fn timeout_releases_the_generation_slot() {
    let engine = Arc::new(SlowFirst {
        calls: AtomicUsize::new(0),
    });
    let router = app(
        &SITE.replace(
            "cache_seconds = 60",
            "cache_seconds = 0\ntimeout_seconds = 1",
        ),
        engine,
    );
    assert_eq!(
        request(router.clone(), "GET", "/", "").await.status(),
        StatusCode::GATEWAY_TIMEOUT
    );
    assert_eq!(
        request(router, "GET", "/", "").await.status(),
        StatusCode::OK
    );
}

#[test]
fn invalid_config_and_route_patterns_return_errors_instead_of_panicking() {
    for source in [
        SITE.replace("engine = ollama", "engine = unknown"),
        SITE.replace("max_concurrent = 1", "max_concurrent = 0"),
        SITE.replace("cache_seconds = 60", "cache_seconds = -1"),
        SITE.replace("path = /about", "path = /"),
        SITE.replace("path = /about", "path = /{*anything}"),
        SITE.replace("path = /about", "path = /bad/{name}-{id}"),
        SITE.replace("response = json", "response = html"),
        SITE.replace("response = json", "run:\n    respond 200 hi"),
        format!(
            "{}\n@Route/GET /api/recommend/{{different}}/more\ndescription = conflicting parameter",
            SITE
        ),
    ] {
        assert!(
            router_with_engine(&parse_rune(&source).unwrap(), Fake::new(&[])).is_err(),
            "{source}"
        );
    }
}

fn state(doc: RuneDocument) -> AppState {
    AppState {
        schemas: Arc::new(extract_schemas(&doc)),
        data_sources: Arc::new(extract_data_sources(&doc)),
        doc: Arc::new(doc),
        path: std::env::temp_dir(),
    }
}
#[tokio::test]
async fn native_dispatch_reports_bad_config_cleanly() {
    let router = build_app_router(state(
        parse_rune(&SITE.replace("engine = ollama", "engine = broken")).unwrap(),
    ))
    .await;
    let response = request(router, "GET", "/", "").await;
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    assert!(text(response).await.contains("invalid_ai_site"));
}

#[tokio::test]
async fn real_ollama_adapter_uses_the_generate_protocol() {
    let captured = Arc::new(Mutex::new(Vec::new()));
    let log = captured.clone();
    let backend = Router::new().route(
        "/api/generate",
        axum::routing::post(move |Json(payload): Json<Value>| {
            let log = log.clone();
            async move {
                let output = if payload.get("format") == Some(&json!("json")) {
                    "{\"item\":\"Tea\"}"
                } else {
                    HTML
                };
                log.lock().await.push(payload);
                Json(json!({"response":output,"done":true}))
            }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        axum::serve(listener, backend).await.unwrap();
    });
    let source = SITE.replace(
        "engine = ollama",
        &format!("engine = ollama\nendpoint = http://{address}/api/generate"),
    );
    let router = build_app_router(state(parse_rune(&source).unwrap())).await;
    assert_eq!(
        request(router.clone(), "GET", "/", "").await.status(),
        StatusCode::OK
    );
    let response = request(router, "POST", "/api/recommend/tea", "{}").await;
    assert_eq!(response.status(), StatusCode::OK);
    let payloads = captured.lock().await;
    assert_eq!(payloads.len(), 2);
    assert_eq!(payloads[0]["model"], "test-model");
    assert_eq!(payloads[0]["stream"], false);
    assert!(payloads[0].get("format").is_none());
    assert_eq!(payloads[1]["format"], "json");
    task.abort();
}
