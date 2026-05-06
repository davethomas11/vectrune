use rune_runtime::rune_parser::load_rune_document_from_path;
use serde_json::json;
use std::fs;
use std::path::Path;
use tempfile::tempdir;

#[test]
fn imports_single_rune_file_before_parsing_root() {
    let temp = tempdir().expect("tempdir");
    let root = temp.path();

    fs::write(
        root.join("shared.rune"),
        r#"@Logic/game
state:
    turn = X
"#,
    )
    .expect("write shared.rune");

    fs::write(
        root.join("app.rune"),
        r#"#!RUNE
import "shared.rune"

@App
name = Import Demo
type = REST

@Page/home
title = Home
view:
    main:
        h1 "Hello"
"#,
    )
    .expect("write app.rune");

    let doc = load_rune_document_from_path(&root.join("app.rune")).expect("load root document");

    assert!(doc.sections.iter().any(|s| s.path == vec!["Logic".to_string(), "game".to_string()]));
    assert!(doc.sections.iter().any(|s| s.path == vec!["Page".to_string(), "home".to_string()]));
}

#[test]
fn imports_directory_of_rune_files_in_sorted_order() {
    let temp = tempdir().expect("tempdir");
    let root = temp.path();
    let parts = root.join("parts");
    fs::create_dir_all(&parts).expect("create parts dir");

    fs::write(
        parts.join("a_style.rune"),
        r#"@Style/site
rules:
    body:
        color = blue
"#,
    )
    .expect("write style file");

    fs::write(
        parts.join("b_logic.rune"),
        r#"@Logic/site
state:
    turn = X
"#,
    )
    .expect("write logic file");

    fs::write(
        root.join("app.rune"),
        r#"#!RUNE
import "parts"

@App
name = Directory Import Demo
type = REST
"#,
    )
    .expect("write app.rune");

    let doc = load_rune_document_from_path(&root.join("app.rune")).expect("load root document");

    let style = doc
        .sections
        .iter()
        .find(|s| s.path == vec!["Style".to_string(), "site".to_string()])
        .expect("style section");
    let logic = doc
        .sections
        .iter()
        .find(|s| s.path == vec!["Logic".to_string(), "site".to_string()])
        .expect("logic section");

    assert_eq!(
        style.series.get("rules").unwrap()[0].to_json(),
        json!({ "body": ["color = blue"] })
    );
    assert_eq!(logic.series.get("state").unwrap()[0].to_json(), json!("turn = X"));
}

#[test]
fn root_document_overrides_imported_kv_values() {
    let temp = tempdir().expect("tempdir");
    let root = temp.path();

    fs::write(
        root.join("base.rune"),
        r#"@App
name = Imported Name
type = REST
"#,
    )
    .expect("write base.rune");

    fs::write(
        root.join("app.rune"),
        r#"#!RUNE
import "base.rune"

@App
name = Root Name
version = 1.0
"#,
    )
    .expect("write app.rune");

    let doc = load_rune_document_from_path(Path::new(&root.join("app.rune"))).expect("load root document");
    let app = doc
        .sections
        .iter()
        .find(|s| s.path == vec!["App".to_string()])
        .expect("app section");

    assert_eq!(app.kv.get("name").unwrap().as_str().unwrap(), "Root Name");
    assert_eq!(app.kv.get("type").unwrap().as_str().unwrap(), "REST");
    assert_eq!(app.kv.get("version").unwrap().to_string(), "1");
}

#[test]
fn imports_component_sections_for_rune_web_documents() {
    let temp = tempdir().expect("tempdir");
    let root = temp.path();
    let parts = root.join("parts");
    fs::create_dir_all(&parts).expect("create parts dir");

    fs::write(
        parts.join("hero.rune"),
        r#"@Component/HeroBanner
view:
    section .hero:
        h1 "Learn Vectrune"
"#,
    )
    .expect("write hero.rune");

    fs::write(
        root.join("app.rune"),
        r#"#!RUNE
import "parts"

@App
name = Import Demo
type = REST

@Frontend
type = rune-web
page = home

@Page/home
view:
    main:
        HeroBanner
"#,
    )
    .expect("write app.rune");

    let doc = load_rune_document_from_path(&root.join("app.rune")).expect("load root document");

    assert!(doc.sections.iter().any(|s| s.path == vec!["Component".to_string(), "HeroBanner".to_string()]));
    assert!(doc.sections.iter().any(|s| s.path == vec!["Page".to_string(), "home".to_string()]));
}



