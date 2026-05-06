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
    assert!(!body.contains("{name}"), "Expected no unresolved template placeholders");
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
    assert!(!body.contains("%i18n."), "Expected no unresolved %i18n. placeholders");
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

    assert!(body.contains("i18nData"), "Expected i18nData constant in JS output");
    assert!(body.contains("\"home\""), "Expected translation key in JS output");
    assert!(body.contains("i18n: i18nData"), "Expected i18n merged into app.state");
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
    assert!(body.contains("function expandPercentI18n(value)"), "Expected client i18n expansion helper in generated JS");
    assert!(body.contains("return expandPercentI18n(decodeEscapes(String(template || '')))"), "Expected interpolate() to expand %i18n placeholders before rerender interpolation");
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

