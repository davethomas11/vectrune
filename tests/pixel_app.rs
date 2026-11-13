use rune_runtime::{
    apps::pixel,
    rune_parser::{load_rune_document_from_path, parse_rune},
};
use std::path::Path;

const ASSET: &str = r##"@Palette/demo
colors = {".":"transparent","g":"#80b95e"}
@Sprite/demo
palette = demo
size = [2, 2]
pixels:
    ".g"
    "gg"
@Animation/blink
frames = ["demo"]
fps = 8
"##;

#[test]
fn compiles_palettes_transparency_and_animation_references() {
    let assets = pixel::assets(&parse_rune(ASSET).unwrap()).unwrap();
    assert_eq!(
        assets["sprites"]["demo"]["pixels"],
        serde_json::json!([0, 1, 1, 1])
    );
    assert_eq!(
        assets["sprites"]["demo"]["colors"],
        serde_json::json!([null, 0x80b95e])
    );
    assert_eq!(
        assets["animations"]["blink"]["frames"],
        serde_json::json!(["demo"])
    );
}

#[test]
fn rejects_bad_rows_palettes_dimensions_and_missing_frames() {
    for (source, expected) in [
        (ASSET.replace("\".g\"", "\".gg\""), "row 1"),
        (
            ASSET.replace("\".g\"", "\".x\""),
            "unknown palette character",
        ),
        (
            ASSET.replace("palette = demo", "palette = typo"),
            "unknown palette",
        ),
        (ASSET.replace("[2, 2]", "[2.5, 2]"), "Invalid"),
        (ASSET.replace("#80b95e", "#oopsxx"), "Invalid palette color"),
        (
            ASSET.replace("frames = [\"demo\"]", "frames = [\"missing\"]"),
            "Unknown animation frame",
        ),
    ] {
        let error = pixel::assets(&parse_rune(&source).unwrap())
            .unwrap_err()
            .to_string();
        assert!(error.contains(expected), "{error}");
    }
}

#[tokio::test]
async fn exports_self_contained_game_and_excludes_test_helpers() {
    let doc =
        load_rune_document_from_path(Path::new("examples/monster_city/monster_city.rune")).unwrap();
    let html = pixel::html(&doc).await.unwrap();
    assert!(html.starts_with("<!doctype html>"));
    assert!(html.contains("__RunePixelRuntime.boot"));
    assert!(html.contains("data-rune-pixel"));
    assert!(!html.contains("lineUpLastBuilding"));
    assert!(!html.contains("readyPunch"));
    assert!(!html.contains("<script src="));
}

#[tokio::test]
async fn custom_shell_uses_normal_rune_web_components_and_separate_runtime() {
    let doc =
        load_rune_document_from_path(Path::new("examples/monster_city/custom_shell.rune")).unwrap();
    let html = pixel::html(&doc).await.unwrap();
    assert!(html.contains("Toggle instructions"));
    assert!(html.contains("__RuneWeb.boot"));
    assert!(html.contains("__RunePixelRuntime.boot"));
    let mut invalid = doc.clone();
    let page = invalid
        .sections
        .iter_mut()
        .find(|s| s.path == ["Page", "arcade"])
        .unwrap();
    page.series.insert(
        "view".into(),
        vec![rune_runtime::rune_ast::Value::String(
            "main \"Missing game canvas\"".into(),
        )],
    );
    assert!(pixel::html(&invalid)
        .await
        .unwrap_err()
        .to_string()
        .contains("one canvas"));
}

#[test]
fn validates_clock_resolution_and_logic_contract() {
    let doc =
        load_rune_document_from_path(Path::new("examples/monster_city/monster_city.rune")).unwrap();
    let mut invalid = doc.clone();
    invalid
        .sections
        .iter_mut()
        .find(|s| s.path == ["App"])
        .unwrap()
        .kv
        .insert(
            "resolution".into(),
            rune_runtime::rune_ast::Value::String("[999999,216]".into()),
        );
    assert!(pixel::compile(&invalid)
        .err()
        .unwrap()
        .to_string()
        .contains("resolution"));
    let mut invalid = doc.clone();
    invalid
        .sections
        .iter_mut()
        .find(|s| s.path == ["Scene", "city"])
        .unwrap()
        .kv
        .insert(
            "logic".into(),
            rune_runtime::rune_ast::Value::String("missing".into()),
        );
    assert!(pixel::compile(&invalid)
        .err()
        .unwrap()
        .to_string()
        .contains("@Logic"));
}
