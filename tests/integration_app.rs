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
    build_app_router(state).await
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

#[tokio::test]
async fn rune_web_frontend_mounts_under_rest_app_type() {
    let app_rune = r#"#!RUNE

@App
name = Tic Tac Toe
type = REST

@Frontend
type = rune-web
path = %ROOT%
page = tic-tac-toe

@Page/tic-tac-toe
title = Tic Tac Toe
view:
    main:
        h1 "Tic Tac Toe"
"#;

    let app = build_router_from_str(app_rune).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("expected response body bytes");
    let body = String::from_utf8(body_bytes.to_vec()).expect("expected utf-8 body");

    // Check that the rendered HTML contains expected elements
    assert!(body.contains("Tic Tac Toe"), "Expected title in HTML");
    assert!(body.contains("<main>"), "Expected main element to be rendered");
    assert!(body.contains("<h1>Tic Tac Toe</h1>"), "Expected h1 with text content");
    assert!(body.contains("<title>Tic Tac Toe</title>"), "Expected page title");
}

#[tokio::test]
async fn debug_rune_web_output() {
    let app_rune = r#"#!RUNE

@App
name = Tic Tac Toe
type = REST

@Frontend
type = rune-web
path = %ROOT%
page = tic-tac-toe

@Page/tic-tac-toe
title = Tic Tac Toe
view:
    main:
        h1 "Tic Tac Toe"
"#;

    let app = build_router_from_str(app_rune).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("expected response body bytes");
    let body = String::from_utf8(body_bytes.to_vec()).expect("expected utf-8 body");
    println!("=== HTML OUTPUT ===\n{}\n=== END HTML ===", body);
}

#[tokio::test]
async fn rune_web_renders_initial_interpolated_content_and_runtime_bootstrap() {
    let app_rune = r#"#!RUNE

@App
name = Tic Tac Toe
type = REST

@Frontend
type = rune-web
path = %ROOT%
page = tic-tac-toe

@Page/tic-tac-toe
title = Tic Tac Toe
logic = game
view:
    main .screen:
        p .status "{status_text}"
        div .scoreboard:
            span .score <- ["X {score.X}", "O {score.O}", "Draws {score.draws}"]
        div .board:
            button .cell data-index=index click=play(index) "{cell}" <- (cell, index) in board
        button .reset click=reset "Play Again"

@Logic/game
state:
    board = ["X", "", "O"]
    turn = X
    winner = ""
    score = { "X": 1, "O": 2, "draws": 3 }
derive:
    status_text from winner:
        "" then "Turn: {turn}"
        X then "Winner: X"
action play(index):
    board.[index] = turn
action reset:
    board = ["", "", ""]
    turn = X
    winner = ""
"#;

    let app = build_router_from_str(app_rune).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("expected response body bytes");
    let body = String::from_utf8(body_bytes.to_vec()).expect("expected utf-8 body");

    assert!(body.contains(r#"<p class="status">Turn: X</p>"#));
    assert!(body.contains("X 1"));
    assert!(body.contains("O 2"));
    assert!(body.contains("Draws 3"));
    assert!(body.matches("class=\"cell\"").count() == 3);
    assert!(body.contains(r#"data-on-click="play(index)""#));
    assert!(body.contains(r#"data-on-click="reset""#));
    assert!(body.contains("data-rune-scope="));
    assert!(body.contains("window.runeWebApp = app"));
    assert!(body.contains("app.render();"));
    assert!(body.contains(r#""reset":{"params":[],"steps":["#));
}

