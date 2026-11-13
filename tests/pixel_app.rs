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
    assert!(!html.contains("coolAudioPunch"));
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

#[test]
fn monster_music_uses_existing_declarative_sound_and_music_definitions() {
    let doc =
        load_rune_document_from_path(Path::new("examples/monster_city/monster_city.rune")).unwrap();
    let frontend =
        rune_runtime::apps::rune_web::parser::parse_rune_web_frontend(&doc, "city").unwrap();
    let music = &frontend.music["monster_city"];
    assert_eq!(music.tempo, 116.0);
    assert!(music.loop_track);
    assert!(music.lead.as_deref().unwrap().contains("E4:8"));
    assert!(music.drums.as_deref().unwrap().contains("kick"));
    let rifle = &frontend.sounds["monster_rifle"];
    assert_eq!(rifle.freq_start, Some(1100.0));
    assert_eq!(rifle.freq_end, Some(420.0));
    assert_eq!(frontend.sounds["monster_victory"].sequence.len(), 4);
}

#[test]
fn native_quickjs_can_run_the_musical_game_without_browser_audio_apis() {
    let doc =
        load_rune_document_from_path(Path::new("examples/monster_city/monster_city.rune")).unwrap();
    let game = pixel::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(2);
    runtime.set_interrupt_handler(Some(Box::new(move || {
        std::time::Instant::now() >= deadline
    })));
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(),_>(game.script.as_str()).unwrap();
        ctx.eval::<(),_>("__RunePixel.start(); __RunePixel.step({smash:true}); __RunePixel.paused=true; __RunePixel.paused=false;").unwrap();
        assert_eq!(ctx.eval::<String,_>("__RunePixel.app.state.status").unwrap(),"playing");
        let frame: rquickjs::TypedArray<u32> = ctx.eval("__RunePixel.frame()").unwrap();
        assert_eq!(frame.len(),384*216);
    });
}

#[test]
#[ignore = "reports native QuickJS frame timings for manual performance comparisons"]
fn native_pixel_frame_benchmark() {
    let doc =
        load_rune_document_from_path(Path::new("examples/monster_city/monster_city.rune")).unwrap();
    let game = pixel::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        ctx.eval::<(), _>("__RunePixel.app.state.profile.level=12; __RunePixel.app.state.profile.seed=42; __RunePixel.start()")
            .unwrap();
        let mut simulation = Vec::new();
        let mut rendering = Vec::new();
        for i in 0..240 {
            let now = std::time::Instant::now();
            ctx.eval::<(), _>(
                "__RunePixel.app.state.health=100; __RunePixel.step({right:true,smash:true})",
            )
            .unwrap();
            simulation.push(now.elapsed().as_secs_f64() * 1000.0);
            let now = std::time::Instant::now();
            ctx.eval::<(), _>("__RunePixel.frame()").unwrap();
            if i >= 20 {
                rendering.push(now.elapsed().as_secs_f64() * 1000.0);
            }
        }
        for (name, mut values) in [("simulation", simulation), ("render", rendering)] {
            values.sort_by(f64::total_cmp);
            println!(
                "Native {name}: mean {:.2} ms, p95 {:.2} ms, max {:.2} ms",
                values.iter().sum::<f64>() / values.len() as f64,
                values[values.len() * 95 / 100],
                values.last().unwrap()
            );
        }
    });
}

#[test]
fn every_catalog_monster_has_renderable_idle_step_and_punch_frames() {
    let doc =
        load_rune_document_from_path(Path::new("examples/monster_city/monster_city.rune")).unwrap();
    let frontend =
        rune_runtime::apps::rune_web::parser::parse_rune_web_frontend(&doc, "city").unwrap();
    let catalog: serde_json::Value =
        serde_json::from_str(&frontend.logic_definitions["monster"].state["skins"]).unwrap();
    let catalog = catalog.as_array().unwrap();
    let moves: serde_json::Value =
        serde_json::from_str(&frontend.logic_definitions["monster"].state["special_defs"]).unwrap();
    let moves = moves.as_array().unwrap();
    assert_eq!(moves.len(), 17);
    let names: std::collections::HashSet<_> =
        moves.iter().map(|m| m["name"].as_str().unwrap()).collect();
    assert_eq!(names.len(), 17);
    for skin in catalog {
        let selected: Vec<_> = moves.iter().filter(|m| m["skin"] == skin["id"]).collect();
        assert_eq!(selected.len(), 1);
        assert!(selected[0]["cost"]
            .as_u64()
            .is_some_and(|n| n > 0 && n <= 100));
    }

    assert_eq!(catalog.len(), 17);
    let assets = pixel::assets(&doc).unwrap();
    let game = pixel::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    let context = rquickjs::Context::full(&runtime).unwrap();
    let mut silhouettes = std::collections::HashSet::new();
    context.with(|ctx| {
        ctx.eval::<(),_>(game.script.as_str()).unwrap();
        for skin in catalog {
            let id=skin["id"].as_str().unwrap();
            assert!(assets["animations"][format!("{id}/walk")].is_object());
            let mask:Vec<bool>=assets["sprites"][format!("{id}/idle")]["pixels"].as_array().unwrap().iter().map(|p|p.as_u64().unwrap()!=0).collect();
            silhouettes.insert(mask);
            for pose in ["idle","step","punch"] {
                assert!(assets["sprites"][format!("{id}/{pose}")].is_object());
                ctx.eval::<(),_>(format!("__RunePixel.app.state.menu=null; __RunePixel.app.state.monster.sprite='{id}/{pose}'; __RunePixel.frame()")).unwrap();
            }
        }
    });
    // The original three share a silhouette; the fourteen additions are new shapes.
    assert_eq!(silhouettes.len(), 15);
}
