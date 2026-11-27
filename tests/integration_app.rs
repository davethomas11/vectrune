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
    let schemas = Arc::new(extract_schemas(&doc));
    let data_sources = Arc::new(extract_data_sources(&doc));
    let state = AppState {
        doc: Arc::new(doc),
        schemas,
        data_sources,
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
async fn respond_interpolates_context_and_pretty_json() {
    let app = build_router_from_str(include_str!("../examples/beginner/app.rune")).await;
    let response = app.oneshot(Request::builder()
        .method("POST")
        .uri("/echo")
        .body(axum::body::Body::from(r#"{"name":"Ada","scores":[1,2]}"#))
        .unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(String::from_utf8(body.to_vec()).unwrap(),
        "Echoed: {\n  \"name\": \"Ada\",\n  \"scores\": [\n    1,\n    2\n  ]\n}");

    let app = build_router_from_str(r#"#!RUNE
@App
type = REST
@Route/POST /users/{id}
run:
    data = parse-json
    respond 201 "User {id}: {data.name} {data.items.[0]} {unknown} \{id\}"
@Route/POST /raw
run:
    parse-json
    respond 200 body
"#).await;
    let response = app.clone().oneshot(Request::builder().method("POST").uri("/users/42")
        .body(axum::body::Body::from(r#"{"name":"Ada","items":["first"]}"#)).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(&body[..], b"User 42: Ada first {unknown} {id}");
    let response = app.oneshot(Request::builder().method("POST").uri("/raw")
        .body(axum::body::Body::from(r#"{"message":"{id}"}"#)).unwrap()).await.unwrap();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(&body[..], br#"{"message":"{id}"}"#);
}

#[tokio::test]
async fn rest_not_found_negotiation_and_route_boundaries() {
    let app = build_router_from_str(r#"#!RUNE
@App
name = Example & Friends
type = REST

@Route/GET /health
run:
    respond 404 "explicit response"

@Route/POST /write
run:
    respond 201 "saved"

@Route/GET /users/{id}
run:
    respond 200 "user"

@Route/GET /private
auth = Secret
run:
    respond 200 "private"

@Route/CRUD /records
schema = Record
data_source = Records
"#).await;

    for (accept, html) in [
        (None, false),
        (Some("*/*"), false),
        (Some("application/json"), false),
        (Some("text/html;q=0, */*;q=1"), false),
        (Some("text/html;q=invalid"), false),
        (Some("text/html;q=1.5"), false),
        (Some("application/json, text/html;q=0.5"), true),
        (Some("TEXT/HTML;Q=1"), true),
    ] {
        let mut builder = Request::builder().uri("/missing");
        if let Some(accept) = accept {
            builder = builder.header("accept", accept);
        }
        let response = app.clone().oneshot(builder.body(axum::body::Body::empty()).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_eq!(response.headers().get("vary").unwrap(), "Accept");
        assert_eq!(response.headers().get("content-type").is_some_and(|v| v.to_str().unwrap().starts_with("text/html")), html);
        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        if html {
            let body = String::from_utf8(body.to_vec()).unwrap();
            assert!(body.contains("VECTRUNE"));
            assert!(body.contains("Example &amp; Friends"));
            assert!(body.contains("GET /users/{id}"));
            assert!(body.contains("GET /private"));
            assert!(body.contains("POST /records"));
            assert!(body.contains("DELETE /records/{id}"));
            assert!(body.contains(r#"<a href="/health"><code>GET /health</code></a>"#));
            assert!(!body.contains(r#"href="/users/{id}""#));
            assert!(!body.contains(r#"href="/write""#));
            assert!(!body.contains(r#"href="/records/{id}""#));
            assert!(body.contains("/missing"));
        } else {
            assert!(body.is_empty());
        }
    }

    let response = app.clone().oneshot(Request::builder().uri("/health").header("accept", "text/html").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert_eq!(&axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap()[..], b"explicit response");
    let response = app.clone().oneshot(Request::builder().method("POST").uri("/health").header("accept", "text/html").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
    let response = app.oneshot(Request::builder().method("HEAD").uri("/missing").header("accept", "text/html").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap().is_empty());
}

#[tokio::test]
async fn rest_pretty_query_formats_json_without_changing_other_responses() {
    let app = build_router_from_str(r#"#!RUNE
@App
type = REST
swagger = true
@Route/POST /echo
run:
    parse-json
    respond 201 body
@Route/GET /text
run:
    respond 404 "Not found"
@Route/PUT /echo
run:
    parse-json
    respond 202 body
@Route/GET /data
run:
    result = { name: "Ada" }
    respond 200 result
@Route/DELETE /data
run:
    result = { name: "Ada" }
    respond 200 result
@NotFound
run:
    parse-json
    respond 404 body
"#).await;
    let json = r#"{"nested":[{"name":"Ada"},2],"empty":{}}"#;
    let mut compact = None;
    for (query, pretty) in [
        ("", false), ("?other=1", false), ("?pretty=1", true),
        ("?pretty=0&other=1", true), ("?pretty=", true), ("?pretty", true),
        ("?p%72etty=yes", true), ("?pretty=first&pretty=second", true), ("?notpretty=1", false),
    ] {
        let response = app.clone().oneshot(Request::builder().method("POST").uri(format!("/echo{query}"))
            .body(axum::body::Body::from(json)).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::CREATED);
        assert_eq!(response.headers()["content-type"], "text/plain; charset=utf-8");
        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body = String::from_utf8(bytes.to_vec()).unwrap();
        assert_eq!(serde_json::from_str::<serde_json::Value>(&body).unwrap(), serde_json::from_str::<serde_json::Value>(json).unwrap());
        assert_eq!(body.contains('\n'), pretty, "{query}: {body}");
        if query.is_empty() { compact = Some(body.clone()); }
        if !pretty { assert_eq!(Some(&body), compact.as_ref()); }
    }
    let response = app.clone().oneshot(Request::builder().uri("/text?pretty=1").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert_eq!(&axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap()[..], b"Not found");
    for (method, path, status, body) in [
        ("GET", "/data", StatusCode::OK, ""),
        ("DELETE", "/data", StatusCode::OK, ""),
        ("PUT", "/echo", StatusCode::ACCEPTED, json),
    ] {
        let response = app.clone().oneshot(Request::builder().method(method).uri(format!("{path}?pretty=1")).body(axum::body::Body::from(body)).unwrap()).await.unwrap();
        assert_eq!(response.status(), status);
        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert!(body.contains(&b'\n'));
        assert!(serde_json::from_slice::<serde_json::Value>(&body).is_ok());
    }
    let response = app.clone().oneshot(Request::builder().uri("/openapi.json?pretty=1").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert!(body.contains(&b'\n'));
    assert!(serde_json::from_slice::<serde_json::Value>(&body).is_ok());
    let response = app.oneshot(Request::builder().method("POST").uri("/missing?pretty=1").body(axum::body::Body::from(json)).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert!(body.contains(&b'\n'));
    assert_eq!(serde_json::from_slice::<serde_json::Value>(&body).unwrap(), serde_json::from_str::<serde_json::Value>(json).unwrap());

    let app = build_router_from_str("#!RUNE\n@App\ntype = REST\n@NotFound\ncontent_type = text/html\nrun:\n    respond 404 \"[1,2]\"\n").await;
    let response = app.oneshot(Request::builder().uri("/missing?pretty=1").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(&axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap()[..], b"[1,2]");
}

#[tokio::test]
async fn rest_not_found_escapes_app_and_route_names() {
    let app = build_router_from_str("#!RUNE\n@App\ntype = REST\nname = <script>alert</script>\n@Route/GET /foo&bar\nrun:\n    respond 200 \"ok\"\n").await;
    let response = app.oneshot(Request::builder().uri("/missing&value").header("accept", "text/html").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let html = String::from_utf8(body.to_vec()).unwrap();
    assert!(html.contains("&lt;script&gt;alert&lt;/script&gt;"), "{html}");
    assert!(html.contains("GET /foo&amp;bar"));
    assert!(html.contains("/missing&amp;value"));
    assert!(!html.contains("<script>"));
}

#[tokio::test]
async fn rest_not_found_can_be_disabled_or_overridden() {
    let disabled = build_router_from_str("#!RUNE\n@App\ntype = REST\nnot_found_page = false\n").await;
    let response = disabled.oneshot(Request::builder().uri("/missing").header("accept", "text/html").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap().is_empty());

    let custom = build_router_from_str(r#"#!RUNE
@App
type = REST
not_found_page = false

@NotFound
content_type = text/html; charset=utf-8
run:
    respond 404 "<h1>Custom</h1>"
"#).await;
    for accept in ["application/json", "text/html", "*/*"] {
        let response = custom.clone().oneshot(Request::builder().uri("/missing").header("accept", accept).body(axum::body::Body::empty()).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_eq!(response.headers()["content-type"], "text/html; charset=utf-8");
        assert_eq!(&axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap()[..], b"<h1>Custom</h1>");
    }
    let response = custom.oneshot(Request::builder().method("HEAD").uri("/missing").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap().is_empty());
    let echo = build_router_from_str("#!RUNE\n@App\ntype = REST\n@NotFound\nrun:\n    respond 410 body\n").await;
    let response = echo.oneshot(Request::builder().method("POST").uri("/missing").body(axum::body::Body::from("request body")).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::GONE);
    assert_eq!(&axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap()[..], br#""request body""#);
    let bad_config = build_router_from_str("#!RUNE\n@App\ntype = REST\nnot_found_page = maybe\n").await;
    let response = bad_config.oneshot(Request::builder().uri("/missing").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    for source in [
        "#!RUNE\n@App\ntype = REST\n@NotFound\ncontent_type = false\nrun:\n    respond 404 \"missing\"\n",
        "#!RUNE\n@App\ntype = REST\n@NotFound\ncontent_type = text/html\n",
    ] {
        let response = build_router_from_str(source).await.oneshot(Request::builder().uri("/missing").body(axum::body::Body::empty()).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }
}

#[tokio::test]
async fn rest_not_found_keeps_swagger_and_assets_routes() {
    let app = build_router_from_str("#!RUNE\n@App\ntype = REST\nswagger = true\n").await;
    for path in ["/swagger-ui", "/openapi.json"] {
        let response = app.clone().oneshot(Request::builder().uri(path).header("accept", "text/html").body(axum::body::Body::empty()).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
    let response = app.oneshot(Request::builder().uri("/assets/missing").header("accept", "text/html").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(response.headers().get("content-type").is_none());
}

#[tokio::test]
async fn rest_not_found_example_and_rune_web_frontend() {
    let app = build_router_from_str(include_str!("../examples/beginner/not_found.rune")).await;
    let response = app.clone().oneshot(Request::builder().uri("/health").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let response = app.oneshot(Request::builder().uri("/missing").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(response.headers()["content-type"].to_str().unwrap().starts_with("text/html"));

    let app = build_router_from_str(r#"#!RUNE
@App
type = REST
@Frontend
type = rune-web
path = /
page = home
@Page/home
view:
    main:
        h1 "Hello"
"#).await;
    let response = app.clone().oneshot(Request::builder().uri("/").header("accept", "text/html").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let response = app.oneshot(Request::builder().uri("/missing").header("accept", "text/html").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(response.headers()["content-type"].to_str().unwrap().starts_with("text/html"));
}

#[tokio::test]
async fn rest_static_frontend_preserves_files_and_uses_fallback_on_missing_files() {
    let directory = tempfile::tempdir().unwrap();
    std::fs::write(directory.path().join("index.html"), "static index").unwrap();
    std::fs::write(directory.path().join("data.json"), r#"{"n":[1,2]}"#).unwrap();
    let doc = parse_rune("#!RUNE\n@App\ntype = REST\n@Frontend\ntype = static\nsrc = .\n").unwrap();
    let app = build_app_router(AppState {
        schemas: Arc::new(extract_schemas(&doc)),
        data_sources: Arc::new(extract_data_sources(&doc)),
        doc: Arc::new(doc),
        path: directory.path().to_path_buf(),
    }).await;
    let response = app.clone().oneshot(Request::builder().uri("/").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(&axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap()[..], b"static index");
    let response = app.clone().oneshot(Request::builder().uri("/data.json?pretty=1").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(&axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap()[..], br#"{"n":[1,2]}"#);
    let response = app.clone().oneshot(Request::builder().uri("/missing").header("accept", "text/html").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(response.headers()["content-type"].to_str().unwrap().starts_with("text/html"));
    let response = app.oneshot(Request::builder().uri("/assets/missing").header("accept", "text/html").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert!(response.headers().get("content-type").is_none());

    let doc = parse_rune("#!RUNE\n@App\ntype = REST\n@Frontend\ntype = static\nsrc = .\n@NotFound\nrun:\n    respond 410 \"custom\"\n").unwrap();
    let app = build_app_router(AppState {
        schemas: Arc::new(extract_schemas(&doc)),
        data_sources: Arc::new(extract_data_sources(&doc)),
        doc: Arc::new(doc),
        path: directory.path().to_path_buf(),
    }).await;
    let response = app.oneshot(Request::builder().uri("/missing").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::GONE);
}

#[tokio::test]
async fn rest_route_executes_match_and_switch_statements() {
    let app_rune = r#"#!RUNE

@App
name = Match Test API
type = REST

@Route/GET/match-test
run:
    status = "active"
    match status:
        "inactive":
            respond 400 "Inactive"
        "active":
            respond 200 "Active OK"
        else:
            respond 404 "Not Found"

@Route/GET/switch-fallback
run:
    code = "unknown"
    switch code:
        "alpha", "beta":
            respond 200 "Greek"
        default:
            respond 202 "Default Fallback"
"#;

    let app = build_router_from_str(app_rune).await;

    let response1 = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/match-test")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response1.status(), StatusCode::OK);
    let body1 = axum::body::to_bytes(response1.into_body(), usize::MAX).await.unwrap();
    assert_eq!(String::from_utf8_lossy(&body1), "Active OK");

    let response2 = app
        .oneshot(
            Request::builder()
                .uri("/switch-fallback")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response2.status(), StatusCode::ACCEPTED);
    let body2 = axum::body::to_bytes(response2.into_body(), usize::MAX).await.unwrap();
    assert_eq!(String::from_utf8_lossy(&body2), "Default Fallback");
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
    assert!(body.contains("__RuneWeb.boot("));
    assert!(body.contains(r#""reset":{"params":[],"steps":["#));
}

#[tokio::test]
async fn rune_web_decodes_escaped_text_sequences_in_page_content() {
    let app_rune = r#"#!RUNE

@App
name = Teaching Demo
type = REST

@Frontend
type = rune-web
path = %ROOT%
page = home

@Page/home
title = Teaching Demo
view:
    main:
        pre:
            code .language-rune "line 1\nline 2 \"quoted\" \{literal\}"
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

    assert!(body.contains("line 1\nline 2 &quot;quoted&quot; {literal}"));
    assert!(!body.contains(r#"\{literal\}"#));
}

#[tokio::test]
async fn rune_web_renders_component_sections_inside_page_views() {
    let app_rune = r#"#!RUNE

@App
name = Component Demo
type = REST

@Frontend
type = rune-web
path = %ROOT%
page = home

@Component/HeroBanner
view:
    section .hero:
        h1 "Learn Vectrune"
        p "Reusable hero copy"

@Page/home
title = Component Demo
view:
    main:
        HeroBanner
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

    assert!(body.contains(r#"<section class="hero"><h1>Learn Vectrune</h1><p>Reusable hero copy</p></section>"#));
    assert!(!body.contains("<HeroBanner"));
}

#[tokio::test]
async fn rune_web_component_props_are_injected_as_template_locals() {
    let app_rune = r#"#!RUNE

@App
name = Props Demo
type = REST

@Frontend
type = rune-web
path = %ROOT%
page = home

@Component/Greeting
view:
    div .greeting:
        h2 "{name}"
        p "Welcome to {place}"

@Page/home
title = Props Demo
view:
    main:
        Greeting name="Vectrune" place="the teaching site"
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

    assert!(body.contains(">Vectrune</h2>"), "Expected prop 'name' interpolated");
    assert!(body.contains("Welcome to the teaching site"), "Expected prop 'place' interpolated");
    // Bootstrap scripts retain the template AST for later client renders.
    let server_html = body.split("<script").next().unwrap();
    assert!(!server_html.contains("{name}"), "Expected no unresolved placeholders in server HTML");
    assert!(!body.contains("<Greeting"), "Expected component tag not rendered literally");
}

#[tokio::test]
async fn rune_web_i18n_resolves_translations_in_ssr_output() {
    let app_rune = r#"#!RUNE

@App
name = I18N Test App
type = REST

@Frontend
type = rune-web
path = %ROOT%
page = home

@I18N/en_us
Nav {
    home = "Home"
    about = "About Us"
}
Hero {
    headline = "Welcome to Vectrune"
}

@Page/home
title = I18N Test
view:
    div:
        h1 "%i18n.Hero.headline%"
        a "%i18n.Nav.home%"
        a "%i18n.Nav.about%"
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

    assert!(body.contains("Welcome to Vectrune"), "Expected headline translation");
    assert!(body.contains("Home"), "Expected nav home translation");
    assert!(body.contains("About Us"), "Expected nav about translation");
    // Inspect rendered HTML, not the template AST in the bootstrap script.
    let server_html = body.split("<script").next().unwrap();
    assert!(!server_html.contains("%i18n."), "Expected translations resolved in server HTML");
}

#[tokio::test]
async fn rune_web_i18n_active_locale_selected_by_frontend_kv() {
    let app_rune = r#"#!RUNE

@App
name = I18N Locale Test
type = REST

@Frontend
type = rune-web
path = %ROOT%
page = home
locale = fr_fr

@I18N/en_us
Greet {
    hello = "Hello"
}

@I18N/fr_fr
Greet {
    hello = "Bonjour"
}

@Page/home
title = Locale Test
view:
    p "%i18n.Greet.hello%"
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

    assert!(body.contains("<p>Bonjour</p>"), "Expected French translation in page markup");
    assert!(!body.contains("<p>Hello</p>"), "Expected English translation NOT to be active");
}

#[tokio::test]
async fn rune_web_i18n_injects_translations_into_js_runtime() {
    let app_rune = r#"#!RUNE

@App
name = I18N JS Test
type = REST

@Frontend
type = rune-web
path = %ROOT%
page = home

@I18N/en_us
Nav {
    home = "Home"
}

@Logic/main
state:
    count = 0

@Page/home
title = JS I18N Test
logic = main
view:
    div:
        span "{count}"

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

    assert!(body.contains("i18nData: {"), "Expected i18nData property in JS output");
    assert!(body.contains("\"home\""), "Expected translation key in JS output");
}

#[tokio::test]
async fn rune_web_i18n_pages_with_logic_ship_client_i18n_expansion_for_rerenders() {
    let app_rune = r#"#!RUNE

@App
name = I18N Logic Rerender Test
type = REST

@Frontend
type = rune-web
path = %ROOT%
page = home
locale = en_us

@I18N/en_us
Header {
    title = "Translated Title"
}

@Logic/main
state:
    count = 0

@Page/home
title = I18N Logic Test
logic = main
view:
    main:
        h1 "%i18n.Header.title%"
        p "{count}"
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

    assert!(body.contains("<h1>Translated Title</h1>"), "Expected SSR translation to be present in app HTML");
    assert!(body.contains("__RuneWeb.boot("), "Expected TS runtime to be injected for rerendering");
}

#[tokio::test]
async fn rune_web_i18n_query_param_overrides_frontend_default_locale() {
    let app_rune = r#"#!RUNE

@App
name = I18N Query Locale Test
type = REST

@Frontend
type = rune-web
path = %ROOT%
page = home
locale = en_us

@I18N/en_us
Header {
    title = "English Title"
}

@I18N/fr
Header {
    title = "Titre Français"
}

@Page/home
title = I18N Query Test
view:
    h1 "%i18n.Header.title%"
"#;

    let app = build_router_from_str(app_rune).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/?locale=fr")
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

    assert!(body.contains("Titre Français"), "Expected query locale to override frontend default locale");
    assert!(!body.contains("English Title"), "Expected default locale translation not to render when query override is present");
}


#[tokio::test]
async fn rune_web_locale_paths_work_for_local_hosting_and_html_export() {
    let source = r#"@App
name = Locale Routes
type = REST
@Frontend
type = rune-web
page = home
path = %ROOT%
locale = en_us
locale_paths = { "es": "/es/", "fr": "/fr/" }
@I18N/en_us
Common {
    hello = "Hello"
}
@I18N/es
Common {
    hello = "Hola"
}
@I18N/fr
Common {
    hello = "Bonjour"
}
@Page/home
view:
    h1 "%i18n.Common.hello%"
"#;
    let app = build_router_from_str(source).await;
    for (path, text, lang) in [("/", "Hello", "en-us"), ("/es/", "Hola", "es"), ("/fr/", "Bonjour", "fr"), ("/es/?locale=fr", "Bonjour", "fr"), ("/fr/?locale=missing", "Bonjour", "fr")] {
        let response = app.clone().oneshot(Request::builder().uri(path).body(axum::body::Body::empty()).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{path}");
        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body = String::from_utf8(body.to_vec()).unwrap();
        assert!(body.contains(&format!("<h1>{text}</h1>")), "{path}");
        assert!(body.contains(&format!("<html lang=\"{lang}\">")), "{path}");
    }
    let response = app.oneshot(Request::builder().uri("/missing/").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let doc = parse_rune(source).unwrap();
    let html = rune_runtime::apps::rune_web::render_html_for_path(&doc, "/es/").await.unwrap();
    assert!(html.contains("<h1>Hola</h1>"));
    assert!(html.contains("<html lang=\"es\">"));
}

#[tokio::test]
async fn teaching_application_syntax_examples_run_on_native_routers() {
    let rest = include_str!("../teaching_website/content/applications/rest.rune");
    let response = build_router_from_str(rest).await.oneshot(Request::builder().uri("/hello").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let data: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(data["message"], "Hello from Rune");

    let graphql = include_str!("../teaching_website/content/applications/graphql.rune");
    let app = build_router_from_str(graphql).await;
    for (query, field, expected) in [("{ greeting { message } }", "greeting", "Hello from Rune"), ("mutation { greet(message: \"Native test\") { message } }", "greet", "Native test")] {
        let response = app.clone().oneshot(Request::builder().method("POST").uri("/graphql").header("content-type", "application/json").body(axum::body::Body::from(serde_json::json!({"query":query}).to_string())).unwrap()).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let data: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(data["data"][field]["message"], expected, "{data}");
    }

    let directory = tempfile::tempdir().unwrap();
    std::fs::write(directory.path().join("index.html"), "<h1>Static sample</h1>").unwrap();
    let source = include_str!("../teaching_website/content/applications/static.rune").replace("root = public", &format!("root = {}", directory.path().display()));
    let response = build_router_from_str(&source).await.oneshot(Request::builder().uri("/").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert_eq!(body.as_ref(), b"<h1>Static sample</h1>");

    let source = include_str!("../teaching_website/content/applications/rune-web.rune");
    let doc = parse_rune(source).unwrap();
    let html = rune_runtime::apps::rune_web::render_html_for_path(&doc, "/").await.unwrap();
    assert!(html.contains("Count: 0"));
    assert!(html.contains("data-on-click=\"increment()\""));

    let source = include_str!("../teaching_website/content/applications/websocket.rune");
    let response = build_router_from_str(source).await.oneshot(Request::builder().uri("/chat").body(axum::body::Body::empty()).unwrap()).await.unwrap();
    // A plain HTTP request reaches the socket route but cannot upgrade.
    assert_ne!(response.status(), StatusCode::NOT_FOUND);
    assert_ne!(response.status(), StatusCode::OK);
}
