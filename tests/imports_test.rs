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

    assert!(doc
        .sections
        .iter()
        .any(|s| s.path == vec!["Logic".to_string(), "game".to_string()]));
    assert!(doc
        .sections
        .iter()
        .any(|s| s.path == vec!["Page".to_string(), "home".to_string()]));
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
    assert_eq!(
        logic.series.get("state").unwrap()[0].to_json(),
        json!("turn = X")
    );
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

    let doc = load_rune_document_from_path(Path::new(&root.join("app.rune")))
        .expect("load root document");
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

    assert!(doc
        .sections
        .iter()
        .any(|s| s.path == vec!["Component".to_string(), "HeroBanner".to_string()]));
    assert!(doc
        .sections
        .iter()
        .any(|s| s.path == vec!["Page".to_string(), "home".to_string()]));
}

#[test]
fn application_directory_imports_and_source_lists_exclude_tests_recursively() {
    use rune_runtime::rune_parser::load_rune_source_paths;
    let temp = tempdir().unwrap();
    let root = temp.path();
    fs::create_dir_all(root.join("parts/nested")).unwrap();
    fs::write(
        root.join("app.rune"),
        "import \"parts\"\n@App\nname = Production\n",
    )
    .unwrap();
    fs::write(
        root.join("parts/model.rune"),
        "@Schema/User\nname = string\n",
    )
    .unwrap();
    // An invalid test must not prevent production loading, even in nested directories.
    fs::write(
        root.join("parts/nested/broken.test.rune"),
        "import \"does-not-exist\"\n",
    )
    .unwrap();
    fs::write(
        root.join("parts/override.TEST.rune"),
        "@App\nname = Leaked Test\n@Route/GET /test-only\n",
    )
    .unwrap();
    let doc = load_rune_document_from_path(&root.join("app.rune")).unwrap();
    assert_eq!(
        doc.get_section("App").unwrap().kv["name"].as_str(),
        Some("Production")
    );
    assert_eq!(doc.sections.len(), 2);
    let paths = load_rune_source_paths(&root.join("app.rune")).unwrap();
    assert_eq!(paths.len(), 2);
    assert!(paths
        .iter()
        .all(|path| !rune_runtime::rune_parser::is_test_source(path)));
    let doc = load_rune_document_from_path(root).unwrap();
    assert_eq!(doc.sections.len(), 2);
}

#[test]
fn application_files_cannot_import_test_files_even_when_already_loaded_by_tests() {
    use rune_runtime::rune_parser::{load_rune_test_document_from_path, LoadError};
    let temp = tempdir().unwrap();
    let root = temp.path();
    fs::write(
        root.join("helper.test.rune"),
        "@TestFixture/User\nsetup:\n    assert true\n",
    )
    .unwrap();
    fs::write(root.join("app.rune"), "import \"helper.test.rune\"\n@App\n").unwrap();
    assert!(matches!(
        load_rune_document_from_path(&root.join("app.rune")),
        Err(LoadError::TestImport { .. })
    ));
    assert!(matches!(
        load_rune_document_from_path(&root.join("helper.test.rune")),
        Err(LoadError::TestImport { .. })
    ));
    fs::write(
        root.join("suite.test.rune"),
        "import \"helper.test.rune\"\nimport \"app.rune\"\n@Test/Main\nrun:\n    assert true\n",
    )
    .unwrap();
    assert!(matches!(
        load_rune_test_document_from_path(&root.join("suite.test.rune")),
        Err(LoadError::TestImport { .. })
    ));
}

#[test]
fn test_entries_can_import_application_directories_and_explicit_test_helpers() {
    use rune_runtime::rune_parser::{
        load_rune_test_document_from_path, load_rune_test_source_paths,
    };
    let temp = tempdir().unwrap();
    let root = temp.path();
    fs::write(root.join("app.rune"), "@App\nname = Production\n").unwrap();
    fs::write(
        root.join("helper.test.rune"),
        "@TestFixture/User\nsetup:\n    user = { name: \"Alice\" }\n",
    )
    .unwrap();
    // Importing the application directory excludes the test entry itself, avoiding a cycle.
    fs::write(
        root.join("suite.test.rune"),
        "import \".\"\nimport \"helper.test.rune\"\n@Test/Main\nrun:\n    assert true\n",
    )
    .unwrap();
    let doc = load_rune_test_document_from_path(&root.join("suite.test.rune")).unwrap();
    assert!(doc.get_section("App").is_some());
    assert!(doc
        .sections
        .iter()
        .any(|s| s.path == ["TestFixture", "User"]));
    assert!(doc.sections.iter().any(|s| s.path == ["Test", "Main"]));
    assert_eq!(
        load_rune_test_source_paths(&root.join("suite.test.rune"))
            .unwrap()
            .len(),
        3
    );
}

#[cfg(unix)]
#[test]
fn test_file_aliases_cannot_bypass_application_import_rules() {
    use rune_runtime::rune_parser::LoadError;
    let temp = tempdir().unwrap();
    let root = temp.path();
    fs::create_dir(root.join("parts")).unwrap();
    fs::write(root.join("hidden.test.rune"), "@Route/GET /test-only\n").unwrap();
    std::os::unix::fs::symlink(root.join("hidden.test.rune"), root.join("parts/alias.rune"))
        .unwrap();
    fs::write(root.join("app.rune"), "import \"parts\"\n@App\n").unwrap();
    let doc = load_rune_document_from_path(&root.join("app.rune")).unwrap();
    assert_eq!(doc.sections.len(), 1);
    fs::write(root.join("app.rune"), "import \"parts/alias.rune\"\n@App\n").unwrap();
    assert!(matches!(
        load_rune_document_from_path(&root.join("app.rune")),
        Err(LoadError::TestImport { .. })
    ));
}
