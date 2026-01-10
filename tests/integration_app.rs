use axum::http::{Request, StatusCode};
use axum::Router;
use tower::ServiceExt; // for `oneshot`

use rune_runtime::rune_parser::parse_rune;
use rune_runtime::runtime::build_router;

fn build_router_from_str(contents: &str) -> Router {
    let doc = parse_rune(contents).expect("parse_rune should succeed");
    build_router(doc, false)
}

#[tokio::test]
async fn health_route_returns_ok() {
    let app_rune = r#"#!RUNE

@App
name = Example API
type = REST
version = 1.0

@Route/GET /health
run:
    log "Health check"
    respond 200 "OK"
"#;

    let app = build_router_from_str(app_rune);

    let response = app
        .oneshot(Request::builder().uri("/health").body(axum::body::Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}
