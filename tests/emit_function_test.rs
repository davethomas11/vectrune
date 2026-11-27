use rune_runtime::apps::rune_web::render_html_for_path;
use rune_runtime::rune_parser::{load_rune_document_from_path, parse_rune};
use std::path::Path;

#[tokio::test]
async fn websocket_emit_is_injected_into_the_examples_existing_logic() {
    let doc = load_rune_document_from_path(Path::new(
        "examples/rune-web/reactivity-contract-rune-web.rune",
    )).unwrap();
    let html = render_html_for_path(&doc, "/").await.unwrap();
    assert!(html.contains("\"increaseScore\""));
    assert!(html.contains("\"emit\""));
    assert!(html.contains("window.__runeWebEmit(event_name, payload)"));
    assert!(html.contains("wsEndpoint: '/ws'"));
}

#[tokio::test]
async fn websocket_emit_preserves_user_actions_and_defaults_the_endpoint() {
    let doc = parse_rune(r#"
@Frontend
type = rune-web
path = %ROOT%
page = demo
reactivity = websocket
@Page/demo
logic = demo
view:
    button click="emit()" "Click"
@Logic/demo
action emit():
    log "custom handler"
"#).unwrap();
    let html = render_html_for_path(&doc, "/").await.unwrap();
    assert!(html.contains("custom handler"));
    assert!(html.contains("wsEndpoint: '/ws'"));
    assert!(!html.contains("\"Statement\":\"window.__runeWebEmit(event_name, payload)\""));
}
