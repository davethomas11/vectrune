use axum::http::{Request, StatusCode};
use axum::Router;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Arc;
use tower::ServiceExt;

use rune_runtime::apps::build_app_router;
use rune_runtime::core::{extract_data_sources, extract_schemas, AppState};
use rune_runtime::rune_parser::parse_rune;
use rune_runtime::util::{set_log_level, LogLevel};

async fn build_router_from_file(path: &str) -> Router {
    let contents = std::fs::read_to_string(path).expect("read rune file");
    let doc = parse_rune(&contents).expect("parse_rune should succeed");
    let path_buf = PathBuf::from(path);
    let state = AppState {
        doc: Arc::new(doc.clone()),
        schemas: Arc::new(extract_schemas(&doc)),
        data_sources: Arc::new(extract_data_sources(&doc)),
        path: path_buf,
    };
    build_app_router(state, true).await
}

#[tokio::test]
async fn test_book_graphql_queries() {
    let app = build_router_from_file("examples/book_graphql.rune").await;

    // 1. Query all books
    let query = r#"{"query": "{ books { id title author_id published_year } }"}"#;
    let req = Request::builder()
        .method("POST")
        .uri("/graphql")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(query))
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let text = String::from_utf8(body_bytes.to_vec()).unwrap();
    let json: Value = serde_json::from_str(&text).unwrap();

    let books = &json["data"]["books"];
    println!("GraphQL books query response: {:#?}", json);
    let books = books.as_array().expect("books should be an array");
    assert_eq!(books.len(), 2);
    assert_eq!(books[0]["title"], "The Rust Programming Language");

    // 2. Query a single book
    let query = r#"{"query": "{ book(id: 1) { title } }"}"#;
    let req = Request::builder()
        .method("POST")
        .uri("/graphql")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(query))
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let text = String::from_utf8(body_bytes.to_vec()).unwrap();
    let json: Value = serde_json::from_str(&text).unwrap();
    let book = &json["data"]["book"];
    println!("GraphQL book(id: 1) query response: {:#?}", json);
    assert_eq!(book["title"], "The Rust Programming Language");
}

#[tokio::test]
async fn test_book_graphql_mutation() {
    set_log_level(LogLevel::Debug);

    let app = build_router_from_file("examples/book_graphql.rune").await;

    let mutation = r#"{"query": "mutation { addBook(title: \"New Book\", author_id: 1, published_year: 2023) { id title } }"}"#;
    let req = Request::builder()
        .method("POST")
        .uri("/graphql")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(mutation))
        .unwrap();

    let resp = app.clone().oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
        .await
        .unwrap();
    let text = String::from_utf8(body_bytes.to_vec()).unwrap();
    let json: Value = serde_json::from_str(&text).unwrap();
    println!("GraphQL addBook mutation response: {:#?}", json);
    assert_eq!(json["data"]["addBook"]["title"], "New Book");
    assert_eq!(json["data"]["addBook"]["id"], 3);
}
