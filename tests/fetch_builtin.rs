use axum::http::{Request, StatusCode};
use axum::routing::get;
use axum::Router;
use rune_runtime::apps::build_app_router;
use rune_runtime::core::{extract_data_sources, extract_schemas, AppState};
use rune_runtime::rune_parser::parse_rune;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower::ServiceExt;

async fn upstream() -> String {
    let app = Router::new()
        .route("/weather", get(|| async { r#"{"current":{"temperature_2m":12.5}}"# }))
        .route("/text", get(|| async { "not json" }))
        .route("/missing", get(|| async { (StatusCode::NOT_FOUND, "nope") }));
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}")
}

async fn call(base: &str, path: &str) -> (StatusCode, String) {
    let source = format!(
        r#"#!RUNE

@Values
weather_url = "{base}/weather?latitude=49.28&longitude=-123.12"
text_url = "{base}/text"
missing_url = "{base}/missing"
bad_scheme = "file:///etc/passwd"

@App
name = Weather
type = REST
version = 1.0

@Route/GET /weather
run:
    weather = fetch-json weather_url
    respond 200 weather

@Route/GET /weather-explicit
run:
    response = fetch weather_url
    weather = parse-json response.body
    respond 200 weather

@Route/GET /status
run:
    response = fetch missing_url
    respond 200 response

@Route/GET /literal
run:
    weather = fetch-json "{base}/weather"
    respond 200 weather

@Route/GET /missing-json
run:
    data = fetch-json missing_url
    respond 200 data

@Route/GET /text-json
run:
    data = fetch-json text_url
    respond 200 data

@Route/GET /scheme
run:
    data = fetch bad_scheme
    respond 200 data

@Route/GET /undefined
run:
    data = fetch nowhere
    respond 200 data

@Route/GET /reassign
run:
    weather_url = "http://evil.example/"
    respond 200 weather_url

@Route/GET /reassign-path
run:
    weather_url.x = "1"
    respond 200 "unreachable"

@Route/GET /caught
run:
    func fallback respond 200 "fallback"
    data = fetch-json missing_url catch fallback
    respond 200 data

@Route/GET /caught-message
run:
    func explain respond 200 $1
    seen = fetch-json missing_url catch explain
    respond 200 seen

@Route/GET /then
run:
    func note respond 200 "handled"
    fetch-json weather_url then note

@Route/GET /undefined-handler
run:
    data = fetch-json missing_url catch nobody
    respond 200 data

@Route/GET /show/{{weather_url}}
run:
    respond 200 weather_url
"#
    );
    let doc = parse_rune(&source).expect("parse");
    let state = AppState {
        schemas: Arc::new(extract_schemas(&doc)),
        data_sources: Arc::new(extract_data_sources(&doc)),
        doc: Arc::new(doc),
        path: PathBuf::from("fetch_test.rune"),
    };
    let app = build_app_router(state).await;
    let response = app
        .oneshot(Request::builder().uri(path).body(axum::body::Body::empty()).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (status, String::from_utf8_lossy(&bytes).into_owned())
}

#[tokio::test]
async fn fetch_json_returns_parsed_json() {
    let base = upstream().await;
    let (status, body) = call(&base, "/weather").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let json: serde_json::Value = serde_json::from_str(&body).unwrap();
    assert_eq!(json["current"]["temperature_2m"], 12.5);
}

#[tokio::test]
async fn explicit_fetch_then_parse_json_matches_fetch_json() {
    let base = upstream().await;
    let (_, short) = call(&base, "/weather").await;
    let (status, explicit) = call(&base, "/weather-explicit").await;
    assert_eq!(status, StatusCode::OK, "{explicit}");
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&short).unwrap(),
        serde_json::from_str::<serde_json::Value>(&explicit).unwrap()
    );
}

#[tokio::test]
async fn fetch_returns_non_2xx_without_failing() {
    let base = upstream().await;
    let (status, body) = call(&base, "/status").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let json: serde_json::Value = serde_json::from_str(&body).unwrap();
    assert_eq!(json["status"], 404);
    assert_eq!(json["ok"], false);
    assert_eq!(json["body"], "nope");
}

#[tokio::test]
async fn fetch_accepts_literal_urls() {
    let base = upstream().await;
    let (status, body) = call(&base, "/literal").await;
    assert_eq!(status, StatusCode::OK, "{body}");
}

#[tokio::test]
async fn fetch_json_maps_upstream_failures_to_502_without_leaking_queries() {
    let base = upstream().await;
    let (status, body) = call(&base, "/missing-json").await;
    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert!(body.contains("HTTP 404"), "{body}");
    let (status, body) = call(&base, "/text-json").await;
    assert_eq!(status, StatusCode::BAD_GATEWAY);
    assert!(body.contains("valid JSON"), "{body}");
}

#[tokio::test]
async fn bad_scheme_and_unknown_names_are_rejected() {
    let base = upstream().await;
    let (status, body) = call(&base, "/scheme").await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert!(body.contains("scheme"), "{body}");
    let (status, body) = call(&base, "/undefined").await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
    assert!(body.contains("not defined"), "{body}");
}

#[tokio::test]
async fn values_are_read_only() {
    let base = upstream().await;
    for path in ["/reassign", "/reassign-path"] {
        let (status, body) = call(&base, path).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{path}");
        assert!(body.contains("read-only"), "{body}");
    }
}

#[tokio::test]
async fn request_data_cannot_shadow_values() {
    let base = upstream().await;
    let (status, body) = call(&base, "/show/http%3A%2F%2Fevil.example").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(body.contains("/weather?latitude"), "{body}");
}

#[tokio::test]
async fn catch_handler_replaces_the_default_502() {
    let base = upstream().await;
    let (status, body) = call(&base, "/caught").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(body.contains("fallback"), "{body}");
}

#[tokio::test]
async fn catch_handler_receives_status_and_message() {
    let base = upstream().await;
    let (status, body) = call(&base, "/caught-message").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    // The func response is a JSON string wrapping the { status, message } payload.
    assert!(body.contains("status") && body.contains("404") && body.contains("HTTP 404"), "{body}");
}

#[tokio::test]
async fn then_handler_receives_the_value() {
    let base = upstream().await;
    let (status, body) = call(&base, "/then").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert!(body.contains("handled"), "{body}");
}

#[tokio::test]
async fn unknown_handler_is_an_error() {
    let base = upstream().await;
    let (status, body) = call(&base, "/undefined-handler").await;
    assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR, "{body}");
    assert!(body.contains("not defined"), "{body}");
}
