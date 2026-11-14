use rune_runtime::{
    apps::pixel3d::{
        self,
        raster::{Camera3D, MapData, Rasterizer3D, RenderState, Sprite, Texture, Thing3D, ViewmodelWeapon},
    },
    rune_parser::{load_rune_document_from_path, parse_rune},
};
use std::{collections::HashMap, path::Path};

const ASSETS_3D: &str = r##"@Palette/base
colors = {".":"transparent","w":"#ffffff","k":"#111111","r":"#ff0000"}

@Texture/wall
palette = base
size = [8, 8]
pixels:
    "wwwwwwww"
    "w......w"
    "w......w"
    "w......w"
    "w......w"
    "w......w"
    "w......w"
    "wwwwwwww"

@Sprite/medkit
palette = base
size = [8, 8]
origin = [4, 8]
pixels:
    "..rrrr.."
    ".rrrrrr."
    "rrrrrrrr"
    "rrwwwwrr"
    "rrwwwwrr"
    "rrrrrrrr"
    ".rrrrrr."
    "..rrrr.."
"##;

#[test]
fn compiles_3d_textures_and_sprites() {
    let doc = parse_rune(ASSETS_3D).unwrap();
    let assets = pixel3d::compile_assets(&doc).unwrap();

    // Verify texture compiled
    let textures = assets["textures"].as_object().unwrap();
    assert!(textures.contains_key("wall"));
    assert_eq!(textures["wall"]["width"], 8);
    assert_eq!(textures["wall"]["height"], 8);
    let tex_pixels = textures["wall"]["pixels"].as_array().unwrap();
    assert_eq!(tex_pixels.len(), 64);
    // White is 0xFFFFFFFF
    assert_eq!(tex_pixels[0], 0xffffffffu32);

    // Verify sprite compiled
    let sprites = assets["sprites"].as_object().unwrap();
    assert!(sprites.contains_key("medkit"));
    assert_eq!(sprites["medkit"]["width"], 8);
    assert_eq!(sprites["medkit"]["height"], 8);
    assert_eq!(sprites["medkit"]["origin"], serde_json::json!([4, 8]));
}

#[test]
fn rejects_non_power_of_two_textures() {
    let bad = ASSETS_3D.replacen("size = [8, 8]", "size = [10, 10]", 1);
    let doc = parse_rune(&bad).unwrap();
    let err = pixel3d::compile_assets(&doc).unwrap_err().to_string();
    assert!(err.contains("power-of-two square"), "{err}");
}

#[tokio::test]
async fn compiles_vect_breach_game_and_html() {
    let doc = load_rune_document_from_path(Path::new("examples/vect_breach/vect_breach.rune")).unwrap();
    let game = pixel3d::compile(&doc).unwrap();

    assert_eq!(game.title, "Vect Breach");
    assert_eq!(game.width, 320);
    assert_eq!(game.height, 200);
    assert!(game.script.contains("__RunePixel3DRuntime.configure("));
    assert!(game.script.contains("__RunePixel3DRuntime.boot({"));

    // Verify HTML export
    let html = pixel3d::html(&doc).await.unwrap();
    assert!(html.contains("<!doctype html>"));
    assert!(html.contains("<title>Vect Breach — Rune Pixel 3D</title>"));
    assert!(html.contains("data-rune-pixel-3d"));
    assert!(html.contains("__RunePixel3DRuntime.boot({"));
}

#[test]
fn native_rasterizer_renders_scene() {
    let width = 320;
    let height = 200;

    let texture = Texture {
        width: 8,
        height: 8,
        pixels: vec![0xffaaaaaa; 64],
    };

    let mut sprites = HashMap::new();
    sprites.insert(
        "item".to_string(),
        Sprite {
            width: 8,
            height: 8,
            origin: vec![4, 8],
            colors: vec![None, Some(0x00ff00)],
            pixels: vec![1; 64],
        },
    );
    sprites.insert(
        "gun".to_string(),
        Sprite {
            width: 16,
            height: 16,
            origin: vec![8, 16],
            colors: vec![None, Some(0x888888)],
            pixels: vec![1; 256],
        },
    );

    let map = MapData {
        width: 4,
        height: 4,
        grid: vec![
            1, 1, 1, 1,
            1, 0, 0, 1,
            1, 0, 0, 1,
            1, 1, 1, 1,
        ],
        floor: 0xff222222,
        ceiling: 0xff111111,
    };

    let mut rasterizer = Rasterizer3D::new(width, height, 66.0, vec![texture], sprites, map);
    let state = RenderState {
        camera: Camera3D {
            x: 1.5,
            y: 1.5,
            angle: 0.0,
        },
        things: vec![Thing3D {
            x: 2.5,
            y: 1.5,
            sprite: "item".to_string(),
            scale: Some(1.0),
            visible: Some(true),
        }],
        weapon: Some(ViewmodelWeapon {
            sprite: "gun".to_string(),
            bob: Some(0.0),
            x: Some(0.0),
            y: Some(0.0),
        }),
        flash: 0.0,
        status: Some("playing".to_string()),
        health: 100,
        ammo: 24,
        score: 0,
        kills: 0,
        level: Some(1),
        level_map: Some("e1m1".to_string()),
        level_title: Some("SECTOR 01".to_string()),
        story_title: None,
        story_body: None,
        message: None,
        switch_activated: Some(false),
    };

    let mut frame = vec![0u8; width * height * 4];
    rasterizer.render(&state, &mut frame);

    // Frame should not be all black
    let non_zero = frame.iter().any(|&b| b != 0);
    assert!(non_zero, "Rasterizer should have produced rendered pixels");

    // HUD bar covers y=0..9, verify HUD bar background at (x=0, y=0)
    let p0 = u32::from_ne_bytes([frame[0], frame[1], frame[2], frame[3]]);
    assert_eq!(p0, 0xff0a0c0e);

    // Pixel at center of screen is a rendered wall pixel
    let mid_idx = (100 * width + 160) * 4;
    let p_mid = u32::from_ne_bytes([frame[mid_idx], frame[mid_idx + 1], frame[mid_idx + 2], frame[mid_idx + 3]]);
    assert_ne!(p_mid, 0);
}
