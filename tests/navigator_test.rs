use rune_runtime::rune_parser::parse_rune;
use rune_runtime::apps::rune_web::parser::parse_rune_web_frontend;

#[test]
fn test_navigator_section_parsing() {
    let rune_source = r#"
@Frontend
type = rune-web
page = test

@Page/test
title = Test Page
view:
    div "Hello World"

@Navigator
url bound to activePage
"#;

    let doc = parse_rune(rune_source).expect("Failed to parse Rune source");
    let frontend = parse_rune_web_frontend(&doc, "test").expect("Failed to parse frontend");

    let nav = frontend.navigator.expect("Expected navigator definition");
    assert_eq!(nav.bind, "activePage");
    assert_eq!(nav.mode, "auto");
    assert_eq!(nav.param, "page");
    assert_eq!(nav.fragment, None);
}

#[test]
fn test_navigator_fragment_binding() {
    let source = r#"
@Page/test
title = Test Page
view:
    div "Hello"

@Navigator
url bound to activePage
mode = path
fragment = activeSection
"#;

    let doc = parse_rune(source).unwrap();
    let frontend = parse_rune_web_frontend(&doc, "test").unwrap();
    assert_eq!(frontend.navigator.unwrap().fragment.as_deref(), Some("activeSection"));

    for invalid in [
        source.replace("mode = path", "mode = hash"),
        source.replace("fragment = activeSection", "fragment = activePage"),
    ] {
        let doc = parse_rune(&invalid).unwrap();
        assert!(parse_rune_web_frontend(&doc, "test").is_err());
    }
}

#[test]
fn test_navigator_custom_options() {
    let rune_source = r#"
@Frontend
type = rune-web
page = test

@Page/test
title = Test Page
view:
    div "Hello"

@Navigator/custom
url bound to currentTab
mode = hash
param = tab
"#;

    let doc = parse_rune(rune_source).expect("Failed to parse Rune source");
    let frontend = parse_rune_web_frontend(&doc, "test").expect("Failed to parse frontend");

    let nav = frontend.navigator.expect("Expected navigator definition");
    assert_eq!(nav.bind, "currentTab");
    assert_eq!(nav.mode, "hash");
    assert_eq!(nav.param, "tab");
}
