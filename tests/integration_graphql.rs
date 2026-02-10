use axum::http::{Request, StatusCode};
use axum::Router;
use tower::ServiceExt;
use std::path::PathBuf;
use std::sync::Arc;

use rune_runtime::rune_parser::parse_rune;
use rune_runtime::core::{AppState, extract_schemas, extract_data_sources};
use rune_runtime::apps::build_app_router;

async fn build_router_from_str(contents: &str) -> Router {
    let doc = parse_rune(contents).expect("parse_rune should succeed");
    let path = PathBuf::from("test_graphql.rune");
    let state = AppState {
        doc: Arc::new(doc.clone()),
        schemas: Arc::new(extract_schemas(&doc)),
        data_sources: Arc::new(extract_data_sources(&doc)),
        path,
    };
    build_app_router(state, false).await
}

#[tokio::test]
async fn graphql_health_query() {
    let script = r#"#!RUNE
@App
type = Graphql
"#;
    let app = build_router_from_str(script).await;
    
    let req = Request::builder()
        .method("POST")
        .uri("/graphql")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(r#"{"query": "{ health }"}"#))
        .unwrap();
        
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    
    let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
    let text = String::from_utf8(body_bytes.to_vec()).unwrap();
    assert!(text.contains(r#"{"data":{"health":"OK"}}"#));
}

#[tokio::test]
async fn graphql_execute_query() {
    let script = r#"#!RUNE
@App
type = Graphql
"#;
    let app = build_router_from_str(script).await;
    
    let query = r#"{"query": "{ execute(steps: [\"log testing\", \"respond 200 success\"]) }"}"#;
    let req = Request::builder()
        .method("POST")
        .uri("/graphql")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(query))
        .unwrap();
        
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    
    let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
    let text = String::from_utf8(body_bytes.to_vec()).unwrap();
    assert!(text.contains(r#"{"data":{"execute":"success"}}"#));
}
