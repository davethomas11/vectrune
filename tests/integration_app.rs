use axum::http::{Request, StatusCode};
use axum::Router;
use std::path::PathBuf;
use tower::ServiceExt; // for `oneshot`

use rune_runtime::apps::build_app_router;
use rune_runtime::core::{extract_data_sources, extract_schemas, AppState};
use rune_runtime::rune_parser::parse_rune;
use std::sync::Arc;

async fn build_router_from_str(contents: &str) -> Router {
    let doc = parse_rune(contents).expect("parse_rune should succeed");
    let path = PathBuf::from("test_app.rune");
    let state = AppState {
        doc: Arc::new(doc),
        schemas: Arc::new(extract_schemas(&parse_rune("").unwrap())),
        data_sources: Arc::new(extract_data_sources(&parse_rune("").unwrap())),
        path,
    };
    build_app_router(state, false).await
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

    let app = build_router_from_str(app_rune).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}
