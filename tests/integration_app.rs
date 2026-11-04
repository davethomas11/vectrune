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

    assert!(body.contains("Bonjour"), "Expected French translation to be active");
    assert!(!body.contains("Hello"), "Expected English translation NOT to be active");
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
