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

#[test]
fn texture_patterns_and_runs_expand_losslessly_and_reject_invalid_rows() {
    let prefix = "@Palette/base\ncolors = {\"k\":\"#111111\",\"w\":\"#ffffff\"}\n@Texture/wall\npalette = base\nsize = [8,8]\n";
    let compressed = format!("{prefix}patterns = {{\"stripe\":\"k*2 w*4 k*2\"}}\npixels:\n    {{\"pattern\":\"stripe\",\"repeat\":3}}\n    {{\"runs\":\"w*8\",\"repeat\":2}}\n    {{\"row\":\"kkwwwwkk\",\"repeat\":3}}\n");
    let literal = format!("{prefix}pixels:\n    \"kkwwwwkk\"\n    \"kkwwwwkk\"\n    \"kkwwwwkk\"\n    \"wwwwwwww\"\n    \"wwwwwwww\"\n    \"kkwwwwkk\"\n    \"kkwwwwkk\"\n    \"kkwwwwkk\"\n");
    let compile = |source: &str| pixel3d::compile_assets(&parse_rune(source).unwrap());
    assert_eq!(compile(&compressed).unwrap(), compile(&literal).unwrap());
    let small = prefix.replace("[8,8]", "[256,256]");
    let repeated = format!("{small}pixels:\n    {{\"runs\":\"k*128 w*128\",\"repeat\":256}}\n");
    let row = format!("{}{}", "k".repeat(128), "w".repeat(128));
    let expanded = format!("{small}pixels:\n{}", format!("    \"{row}\"\n").repeat(256));
    assert!(repeated.len() * 100 < expanded.len(), "Repetitive source should compress below 1% of literal source");
    assert_eq!(compile(&repeated).unwrap(), compile(&expanded).unwrap());
    for row in [
        "{\"runs\":\"k*8\",\"repeat\":8}",
        "{\"runs\":\"k k k k k k k k\",\"repeat\":8}",
    ] {
        assert_eq!(compile(&format!("{prefix}pixels:\n    {row}\n")).unwrap()["textures"]["wall"]["pixels"].as_array().unwrap().len(), 64);
    }
    for invalid in [
        compressed.replace("\"stripe\",\"repeat\":3", "\"missing\",\"repeat\":3"),
        compressed.replace("k*2 w*4 k*2", "k*0 w*8"),
        compressed.replace("k*2 w*4 k*2", "k*9999999999999999999999999"),
        compressed.replace("k*2 w*4 k*2", "kk*4"),
        compressed.replace("k*2 w*4 k*2", "k*7"),
        compressed.replace("k*2 w*4 k*2", "k*9"),
        compressed.replace("k*2 w*4 k*2", "z*8"),
        compressed.replace("\"repeat\":3", "\"repeat\":0"),
        compressed.replace("\"repeat\":3", "\"repeat\":1.5"),
        compressed.replace("\"repeat\":3", "\"repeat\":9"),
        compressed.replace("\"repeat\":3", "\"repeat\":\"3\""),
        compressed.replace("\"row\":\"kkwwwwkk\"", "\"row\":\"short\""),
        compressed.replace("\"row\":\"kkwwwwkk\"", "\"row\":\"kkkkkkkk\",\"runs\":\"k*8\""),
        compressed.replace("\"row\":\"kkwwwwkk\"", "\"typo\":\"kkwwwwkk\""),
        compressed.replace("\"row\":\"kkwwwwkk\"", "\"row\":8"),
        compressed.replace("\"repeat\":3", "\"repeat\":2"),
        compressed.replace("\"repeat\":3", "\"repeat\":4"),
    ] {
        assert!(compile(&invalid).is_err(), "Accepted invalid compressed texture: {invalid}");
    }
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

#[tokio::test]
async fn compiles_rune_crypt_with_textured_interiors_and_generated_sky() {
    let doc = load_rune_document_from_path(Path::new("examples/rune_crypt/rune_crypt.rune")).unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    assert_eq!(game.title, "Rune Crypt");
    assert_eq!(game.config["maps"]["courtyard"]["sky"]["seed"], 731);
    assert_eq!(game.config["maps"]["crypt_a"]["floor"]["width"], 32);
    assert_eq!(game.config["maps"]["crypt_a"]["ceiling"]["width"], 32);
    let textures = game.config["textures"].as_object().unwrap();
    for name in ["stone/wall", "stone/pillar", "stone/moss_wall", "stone/cracked", "stone/ossuary", "rune/wall", "rune/seal"] {
        let size = if name == "stone/pillar" { 64 } else { 32 };
        assert_eq!(textures[name]["width"], size);
        assert_eq!(textures[name]["height"], size);
        assert_eq!(textures[name]["pixels"].as_array().unwrap().len(), size * size);
    }
    for name in ["stone/floor", "stone/moss", "stone/ceiling", "rune/floor", "rune/ceiling"] {
        assert_eq!(textures[name]["width"], 32);
        assert_eq!(textures[name]["height"], 32);
        assert_eq!(textures[name]["pixels"].as_array().unwrap().len(), 1024);
        assert!(textures[name]["pixels"].as_array().unwrap().iter().map(|value| value.as_u64().unwrap()).collect::<std::collections::HashSet<_>>().len() >= 4);
    }
    for name in ["weapon/sword", "weapon/swing", "weapon/cast"] {
        assert_eq!(game.config["sprites"][name]["width"], 24);
        assert_eq!(game.config["sprites"][name]["height"], 24);
    }
    let walls: std::collections::HashSet<String> = ["stone/wall", "stone/pillar", "stone/moss_wall", "stone/cracked", "stone/ossuary", "rune/wall", "rune/seal"]
        .into_iter().map(|name| textures[name]["pixels"].to_string()).collect();
    assert_eq!(walls.len(), 7, "Wall varieties must have distinct pixels");
    assert_eq!(game.config["persistence"]["state"], "legacy");
    assert_eq!(game.config["presentation"]["title"], "RUNE CRYPT");
    assert_eq!(game.config["ui"], "ui");
    assert_eq!(game.config["pauseUi"], "pause_ui");
    assert_eq!(game.config["restartAction"], "return_to_title");
    assert_eq!(game.config["clickToStart"], false);
    for (map, height) in [("courtyard", 1.0), ("crypt_a", 1.5), ("crypt_b", 1.5),
        ("ossuary", 2.0), ("approach", 2.5), ("vault", 3.0)] {
        assert_eq!(game.config["maps"][map]["ceilingHeight"], height);
    }
    for name in ["enemy/skeleton", "enemy/skeleton_warn", "enemy/wraith", "enemy/wraith_warn",
        "enemy/warden", "enemy/warden_warn", "loot/shard", "loot/potion", "world/chest_open",
        "world/shrine_spent", "world/trap_active", "world/heart"] {
        assert!(!game.config["models"][name]["blocks"].as_array().unwrap().is_empty());
    }
    assert_eq!(game.config["models"]["world/stairs"]["blocks"].as_array().unwrap().len(), 4);
    for map in game.config["maps"].as_object().unwrap().values() {
        serde_json::from_value::<MapData>(map.clone()).unwrap();
    }
    let html = pixel3d::html(&doc).await.unwrap();
    assert!(html.contains("Classes, upgrades and what survives a run"));
    assert!(html.contains("data-pixel-args"));
    assert!(html.contains("data-pixel-selected"));
    assert!(html.contains("data-pixel-action"));
    assert!(html.contains("data-pixel-paused"));
    assert!(html.contains("data-pixel-restart"));
    assert!(!html.contains("A classic first-person retro shooter"));
}

#[test]
fn pause_and_restart_bindings_reject_invalid_scene_configuration() {
    use rune_runtime::rune_ast::Value;
    let doc = load_rune_document_from_path(Path::new("examples/rune_crypt/rune_crypt.rune")).unwrap();
    for (field, value, error) in [
        ("pause_ui", Value::String("missing".into()), "unknown state"),
        ("pause_ui", Value::Number(42.0), "must name a state field"),
        ("restart_action", Value::String("missing".into()), "unknown action"),
        ("restart_action", Value::Bool(true), "must name an action"),
        ("click_to_start", Value::String("maybe".into()), "must be boolean"),
    ] {
        let mut invalid = doc.clone();
        let scene = invalid.sections.iter_mut().find(|section| section.path == ["Scene", "crypt"]).unwrap();
        scene.kv.insert(field.into(), value);
        assert!(pixel3d::compile(&invalid).err().unwrap().to_string().contains(error), "{field}");
    }
}

#[test]
fn map_surfaces_reject_unknown_textures_and_invalid_sky() {
    let source = format!("{ASSETS_3D}\n@Map/test\nfloor = wall\nceiling = wall\nlegend = {{\"#\":{{\"wall\":\"wall\"}},\".\":{{}}}}\ngrid:\n    \"###\"\n    \"#.#\"\n    \"###\"\n");
    let parse = |source: &str| {
        let doc = parse_rune(source).unwrap();
        let assets = pixel3d::compile_assets(&doc).unwrap();
        pixel3d::parse_map_full(doc.sections.iter().find(|s| s.path == ["Map", "test"]).unwrap(), assets["textures"].as_object().unwrap())
    };
    assert_eq!(parse(&source).unwrap()["floor"]["width"], 8);
    assert_eq!(parse(&source).unwrap()["ceilingHeight"], 1.0);
    assert_eq!(parse(&format!("{source}\nceiling_height = 3")).unwrap()["ceilingHeight"], 3.0);
    for value in ["0", "0.5", "-1", "17", "\"high\""] {
        assert!(parse(&format!("{source}\nceiling_height = {value}")).unwrap_err().to_string().contains("ceiling_height"));
    }
    assert!(parse(&source.replace("floor = wall", "floor = missing")).unwrap_err().to_string().contains("unknown texture"));
    let sky = "sky = {\"seed\":731,\"zenith\":\"#202c55\",\"horizon\":\"#bd8b83\",\"cloud\":\"#c0bdcf\",\"speed\":0.35}";
    assert!(parse(&source.replace("ceiling = wall", sky)).unwrap()["sky"].is_object());
    assert!(parse(&source.replace("ceiling = wall", &format!("ceiling = wall\n{sky}"))).is_err());
    assert!(parse(&source.replace("ceiling = wall", &sky.replace("0.35", "-1"))).is_err());
    assert!(parse(&source.replace("ceiling = wall", &sky.replace("731", "1.5"))).is_err());
}

#[test]
fn native_tall_rooms_raise_walls_and_model_clipping_without_moving_the_floor() {
    use pixel3d::model::{Block, BlockModel};
    let map = MapData {
        ceiling_height: 1.0, width: 8, height: 8,
        grid: (0..64).map(|i| usize::from(i < 8 || i >= 56 || i % 8 == 0 || i % 8 == 7)).collect(),
        floor: pixel3d::raster::Surface::Color(0xff111111),
        ceiling: pixel3d::raster::Surface::Color(0xff333333), sky: None,
    };
    let texture = Texture { width: 8, height: 8,
        pixels: (0..64).map(|i| 0xff000010 + (i / 8) as u32).collect() };
    let mut rc = Rasterizer3D::new(320, 200, 66.0, vec![texture], HashMap::new(), map);
    let mut state: RenderState = serde_json::from_value(serde_json::json!({
        "camera":{"x":1.5,"y":1.5,"angle":0},"status":"playing"
    })).unwrap();
    let mut output = vec![0; 320 * 200 * 4];
    rc.render(&state, &mut output);
    let low = rc.buffer.clone();
    let depth = rc.z_buffer.clone();
    assert_eq!(low[59 * 320 + 160], 0xff333333);
    rc.map.ceiling_height = 3.0;
    rc.render(&state, &mut output);
    assert_eq!(rc.buffer[59 * 320 + 160], 0xff000012);
    assert_eq!(rc.z_buffer, depth);
    assert_eq!(&rc.buffer[100 * 320..], &low[100 * 320..]);
    rc.models.insert("high".into(), BlockModel { blocks: vec![Block {
        from: [-0.5, -0.5, 1.0], size: [1.0, 1.0, 0.4], color: 0xff804020,
    }] });
    state.things = vec![serde_json::from_value(serde_json::json!({"x":4.5,"y":1.5,"model":"high"})).unwrap()];
    rc.render(&state, &mut output);
    assert_eq!(rc.buffer[59 * 320 + 160], 0xff663319);
    assert_eq!(rc.pixel_depth[59 * 320 + 160], 2.5);
    rc.map.ceiling_height = 1.0;
    rc.render(&state, &mut output);
    assert_eq!(rc.buffer[59 * 320 + 160], 0xff333333);
    state.things.clear();
    rc.textures.clear();
    let ceiling_pixels: Vec<u32> = (0..64).map(|i| 0xff000000 + i).collect();
    rc.map.ceiling = pixel3d::raster::Surface::Texture(Texture {
        width: 8, height: 8, pixels: ceiling_pixels.clone(),
    });
    rc.map.ceiling_height = 3.0;
    rc.render(&state, &mut output);
    let distance = 2.5 * 200.0 / 40.5;
    let expected = ceiling_pixels[4 * 8 + (((1.5_f64 + distance) * 8.0).floor() as usize & 7)];
    assert_eq!(rc.buffer[59 * 320 + 160], expected);
    rc.map.ceiling_height = 1.0;
    rc.render(&state, &mut output);
    assert_ne!(rc.buffer[59 * 320 + 160], expected);
}

#[test]
#[cfg(feature = "pixel-desktop")]
fn rune_crypt_native_logic_restores_training_and_exports_environment_state() {
    let doc = load_rune_document_from_path(Path::new("examples/rune_crypt/rune_crypt.rune")).unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let saves = tempfile::tempdir().unwrap();
    for session in 0..2 {
        let runtime = rquickjs::Runtime::new().unwrap();
        let context = rquickjs::Context::full(&runtime).unwrap();
        rune_runtime::apps::pixel::persistence::install(&context, saves.path().to_path_buf()).unwrap();
        context.with(|ctx| {
            ctx.eval::<(), _>(game.script.as_str()).unwrap();
            if session == 0 {
                ctx.eval::<(), _>("__RunePixel3D.start(); __RunePixel3D.app.state.legacy.shards = 10; __RunePixel3D.app.state.status = 'gameover'; __RunePixel3D.invoke('train');").unwrap();
            } else {
                assert_eq!(ctx.eval::<i32, _>("__RunePixel3D.app.state.legacy.rank").unwrap(), 1);
                assert_eq!(ctx.eval::<i32, _>("__RunePixel3D.app.state.legacy.shards").unwrap(), 5);
                let title_json: String = ctx.eval("JSON.stringify(__RunePixel3D.renderState())").unwrap();
                let title: RenderState = serde_json::from_str(&title_json).unwrap();
                assert_eq!(title.ui.as_ref().unwrap().heading.as_deref(), Some("RUNE CRYPT"));
                assert_eq!(title.weapon.as_ref().unwrap().sprite, "");
                assert_eq!(ctx.eval::<String, _>("__RunePixel3D.app.state.music_track").unwrap(), "crypt_title");
                ctx.eval::<(), _>("__RunePixel3D.start(); __RunePixel3D.step({});").unwrap();
                let json: String = ctx.eval("JSON.stringify(__RunePixel3D.renderState())").unwrap();
                let state: RenderState = serde_json::from_str(&json).unwrap();
                assert_eq!(state.health, 110);
                assert_eq!(state.level_map.as_deref(), Some("courtyard"));
                assert!(state.hud_text.as_deref().unwrap().contains("HP 110/110"));
                assert_eq!(state.presentation.as_ref().unwrap().title, "RUNE CRYPT");
                ctx.eval::<(), _>("__RunePixel3D.paused = true;").unwrap();
                let paused_json: String = ctx.eval("JSON.stringify(__RunePixel3D.renderState())").unwrap();
                let paused: RenderState = serde_json::from_str(&paused_json).unwrap();
                assert!(paused.paused);
                assert_eq!(paused.ui.as_ref().unwrap().heading.as_deref(), Some("PAUSED"));
                ctx.eval::<(), _>("__RunePixel3D.paused = false;").unwrap();
                assert_eq!(state.ui.as_ref().unwrap().meters[0].value, 110.0);
                assert!(state.ui.as_ref().unwrap().prompt.contains("WASD"));
                assert_eq!(state.time, 1.0 / 30.0);
                let map: MapData = serde_json::from_value(game.config["map"].clone()).unwrap();
                let textures: std::collections::BTreeMap<String, Texture> = serde_json::from_value(game.config["textures"].clone()).unwrap();
                let sprites = serde_json::from_value(game.config["sprites"].clone()).unwrap();
                let mut rasterizer = Rasterizer3D::new(320, 200, 66.0, textures.into_values().collect(), sprites, map);
                rasterizer.models = serde_json::from_value(game.config["models"].clone()).unwrap();
                let mut output = vec![0; 320 * 200 * 4];
                rasterizer.render(&state, &mut output);
                assert!(rasterizer.buffer.iter().all(|p| p >> 24 == 255));
                assert_eq!(rasterizer.buffer[11 * 320 + 6], 0xffacd67e);
                let frame = rasterizer.buffer.clone();
                ctx.eval::<(), _>("__RunePixel3D.paused = true; __RunePixel3D.invoke('refresh_ui');").unwrap();
                let json: String = ctx.eval("JSON.stringify(__RunePixel3D.renderState())").unwrap();
                let paused: RenderState = serde_json::from_str(&json).unwrap();
                assert!(paused.paused);
                rasterizer.render(&paused, &mut output);
                assert_ne!(rasterizer.buffer, frame);
                rasterizer.render(&title, &mut output);
                assert!(rasterizer.buffer[44 * 320..59 * 320].iter().any(|&pixel| pixel == 0xff8ad5f2));
                ctx.eval::<(), _>("const s=__RunePixel3D.app.state;s.player.x=s.shrine_pos.x;s.player.y=s.shrine_pos.y;__RunePixel3D.invoke('refresh_ui');__RunePixel3D.invoke('select_three');").unwrap();
                let json: String = ctx.eval("JSON.stringify(__RunePixel3D.renderState())").unwrap();
                let shrine: RenderState = serde_json::from_str(&json).unwrap();
                assert_eq!(ctx.eval::<i32, _>("__RunePixel3D.app.state.ui.panel.selected").unwrap(), 2);
                assert_eq!(shrine.ui.as_ref().unwrap().heading.as_deref(), Some("PAUSED"));
                assert!(shrine.paused);
                rasterizer.render(&shrine, &mut output);
                assert_ne!(rasterizer.buffer, frame);
                ctx.eval::<(), _>("__RunePixel3D.controls.event({device:'keyboard',code:'KeyT',value:true});").unwrap();
                assert_eq!(ctx.eval::<String, _>("__RunePixel3D.app.state.status").unwrap(), "title");
                assert!(!ctx.eval::<bool, _>("__RunePixel3D.paused").unwrap());
                assert_eq!(ctx.eval::<i32, _>("__RunePixel3D.app.state.legacy.shards").unwrap(), 5);
            }
        });
    }
}

#[test]
fn compiles_block_models_and_rejects_invalid_geometry() {
    let source = format!("{ASSETS_3D}\n@Model/stairs\npalette = base\nunit = 0.25\nblocks:\n    {{\"from\":[-2,-2,0],\"size\":[4,1,1],\"color\":\"w\"}}\n    {{\"from\":[-2,-1,0],\"size\":[4,1,2],\"color\":\"k\"}}\n");
    let compile = |s: &str| pixel3d::compile_assets(&parse_rune(s).unwrap());
    let assets = compile(&source).unwrap();
    let blocks = &assets["models"]["stairs"]["blocks"];
    assert_eq!(blocks[0]["from"], serde_json::json!([-0.5, -0.5, 0.0]));
    assert_eq!(blocks[1]["size"], serde_json::json!([1.0, 0.25, 0.5]));
    assert_eq!(blocks[0]["color"], 0xffffffffu32);
    for invalid in [
        source.replace("unit = 0.25", "unit = 0"),
        source.replace("unit = 0.25", "unit = 2"),
        source.replace("[4,1,1]", "[4,0,1]"),
        source.replace("[4,1,1]", "[4,1.5,1]"),
        source.replace("[-2,-2,0]", "[-2,-2]"),
        source.replace("[-2,-2,0]", "[-33,-2,0]"),
        source.replace("\"color\":\"w\"", "\"color\":\".\""),
        source.replace("\"color\":\"w\"", "\"color\":\"?\""),
        source.replace("palette = base\nunit", "palette = missing\nunit"),
    ] {
        assert!(compile(&invalid).is_err(), "accepted invalid model: {invalid}");
    }
}

#[test]
fn native_block_model_depth_rotation_and_inside_camera() {
    use pixel3d::model::{Block, BlockModel, render_model};
    let model = BlockModel { blocks: vec![Block { from: [-0.5, -0.5, 0.0], size: [1.0, 1.0, 1.0], color: 0xff804020 }] };
    let mut instance = Thing3D {
        dissolve: None,
        x: 2.0, y: 0.0, z: None, angle: None, scale: None,
        model: Some("cube".into()), sprite: String::new(), visible: Some(true),
    };
    let camera = Camera3D { x: 0.0, y: 0.0, angle: 0.0 };
    let mut buffer = vec![0; 64 * 48];
    let mut depth = vec![f64::INFINITY; 64 * 48];
    let fov = 33.0_f64.to_radians().tan();
    render_model(&model, &instance, &camera, [1.0, 0.0], fov, 64, 48, &mut buffer, &mut depth);
    assert_eq!(depth[24 * 64 + 32], 1.5);
    assert_eq!(buffer[24 * 64 + 32], 0xff663319);
    let baseline = buffer.clone();
    depth.fill(1.0);
    buffer.fill(0);
    render_model(&model, &instance, &camera, [1.0, 0.0], fov, 64, 48, &mut buffer, &mut depth);
    assert!(buffer.iter().all(|p| *p == 0));
    instance.angle = Some(90.0);
    depth.fill(f64::INFINITY);
    render_model(&model, &instance, &camera, [1.0, 0.0], fov, 64, 48, &mut buffer, &mut depth);
    assert_eq!(buffer[24 * 64 + 32], 0xff532914);
    assert_ne!(buffer, baseline);
    instance.x = -2.0;
    depth.fill(f64::INFINITY);
    buffer.fill(0);
    render_model(&model, &instance, &camera, [1.0, 0.0], fov, 64, 48, &mut buffer, &mut depth);
    assert!(buffer.iter().all(|p| *p == 0));
    instance.x = 0.0;
    render_model(&model, &instance, &camera, [1.0, 0.0], fov, 64, 48, &mut buffer, &mut depth);
    assert_eq!(depth[24 * 64 + 32], 0.5);
    assert!(buffer.iter().all(|p| *p != 0));
    instance.x = 2.0;
    instance.angle = None;
    instance.scale = Some(2.0);
    depth.fill(f64::INFINITY);
    buffer.fill(0);
    render_model(&model, &instance, &camera, [1.0, 0.0], fov, 64, 48, &mut buffer, &mut depth);
    assert_eq!(depth[24 * 64 + 32], 1.0);
    instance.scale = None;
    instance.z = Some(1.0);
    depth.fill(f64::INFINITY);
    buffer.fill(0);
    render_model(&model, &instance, &camera, [1.0, 0.0], fov, 64, 48, &mut buffer, &mut depth);
    assert_eq!(buffer[24 * 64 + 32], 0);
    assert_eq!(buffer[10 * 64 + 32], 0xff804020);
}

#[test]
fn native_models_occlude_only_the_covered_sprite_pixels() {
    use pixel3d::model::{Block, BlockModel};
    let map = MapData {
        ceiling_height: 1.0,
        width: 8, height: 8,
        grid: (0..64).map(|i| usize::from(i < 8 || i >= 56 || i % 8 == 0 || i % 8 == 7)).collect(),
        floor: pixel3d::raster::Surface::Color(0xff111111),
        ceiling: pixel3d::raster::Surface::Color(0xff333333), sky: None,
    };
    let sprites = HashMap::from([("foe".into(), Sprite {
        width: 2, height: 2, origin: vec![1, 2],
        colors: vec![None, Some(0xff0000)], pixels: vec![1; 4],
    })]);
    let mut rc = Rasterizer3D::new(64, 48, 66.0,
        vec![Texture { width: 8, height: 8, pixels: vec![0xff222222; 64] }], sprites, map);
    rc.models.insert("step".into(), BlockModel { blocks: vec![Block {
        from: [-0.5, -0.5, 0.0], size: [1.0, 1.0, 0.5], color: 0xff804020,
    }] });
    let mut state: RenderState = serde_json::from_value(serde_json::json!({
        "camera":{"x":1.5,"y":1.5,"angle":0},
        "things":[{"x":3.5,"y":1.5,"model":"step"},{"x":4.5,"y":1.5,"sprite":"foe"}]
    })).unwrap();
    let mut output = vec![0; 64 * 48 * 4];
    rc.render(&state, &mut output);
    assert_eq!(rc.buffer[20 * 64 + 32], 0xff0000ff);
    assert_eq!(rc.buffer[30 * 64 + 32], 0xff663319);
    assert_eq!(rc.pixel_depth[30 * 64 + 32], 1.5);
    assert_eq!(rc.z_buffer[32], 5.5);
    let frame = output.clone();
    state.things.reverse();
    rc.render(&state, &mut output);
    assert_eq!(frame, output);
    state.things[0].x = 2.5;
    rc.render(&state, &mut output);
    assert_eq!(rc.buffer[30 * 64 + 32], 0xff0000ff);
    state.things.clear();
    rc.render(&state, &mut output);
    let walls = output.clone();
    state.things.push(serde_json::from_value(serde_json::json!({"x":8.5,"y":1.5,"model":"step"})).unwrap());
    rc.render(&state, &mut output);
    assert_eq!(walls, output);
}

#[test]
fn native_models_dissolve_without_occluding_the_background() {
    use rune_runtime::apps::pixel3d::model::{Block, BlockModel, render_model};
    let model = BlockModel { blocks: vec![Block {
        from: [-0.5, -0.5, 0.0], size: [1.0, 1.0, 1.0], color: 0xff804020,
    }] };
    let camera = Camera3D { x: 0.0, y: 0.0, angle: 0.0 };
    let render = |dissolve| {
        let instance: Thing3D = serde_json::from_value(serde_json::json!({"x":2,"y":0,"dissolve":dissolve})).unwrap();
        let mut buffer = vec![0xff112233; 64 * 48];
        let mut depth = vec![f64::INFINITY; 64 * 48];
        render_model(&model, &instance, &camera, [1.0, 0.0], 33.0_f64.to_radians().tan(),
            64, 48, &mut buffer, &mut depth);
        (buffer, depth)
    };
    let solid = render(0.0);
    let half = render(0.5);
    let almost = render(0.8);
    assert_eq!(half, render(0.5));
    let count = |frame: &(Vec<u32>, Vec<f64>)| frame.1.iter().filter(|d| d.is_finite()).count();
    let ratio = count(&half) as f64 / count(&solid) as f64;
    assert!((0.4..0.6).contains(&ratio));
    assert!(count(&almost) < count(&half));
    for (index, depth) in half.1.iter().enumerate() {
        if !depth.is_finite() { assert_eq!(half.0[index], 0xff112233); }
        if almost.1[index].is_finite() { assert!(depth.is_finite()); }
    }
    assert_eq!(count(&render(1.0)), 0);
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
        ceiling_height: 1.0,
        width: 4,
        height: 4,
        grid: vec![
            1, 1, 1, 1,
            1, 0, 0, 1,
            1, 0, 0, 1,
            1, 1, 1, 1,
        ],
        floor: pixel3d::raster::Surface::Color(0xff222222),
        ceiling: pixel3d::raster::Surface::Color(0xff111111),
        sky: None,
    };

    let mut rasterizer = Rasterizer3D::new(width, height, 66.0, vec![texture], sprites, map);
    let state = RenderState {
        ui: None,
        paused: false,
        time: 0.0,
        presentation: None,
        hud_text: None,
        camera: Camera3D {
            x: 1.5,
            y: 1.5,
            angle: 0.0,
        },
        things: vec![Thing3D {
            dissolve: None,
            model: None,
            z: None,
            angle: None,
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
        wall_overrides: vec![],
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

    // Native surfaces are projected in world space, not screen-space wallpaper.
    let flat_map = rasterizer.map.clone();
    rasterizer.map.floor = pixel3d::raster::Surface::Texture(Texture {
        width: 8, height: 8, pixels: (0..64).map(|i| 0xff000000 | i).collect(),
    });
    rasterizer.map.ceiling = pixel3d::raster::Surface::Texture(Texture {
        width: 8, height: 8, pixels: vec![0xff8899aa; 64],
    });
    let mut surface_state = state.clone();
    surface_state.things.clear();
    surface_state.weapon = None;
    rasterizer.render(&surface_state, &mut frame);
    assert_eq!(rasterizer.buffer[199 * width + 160], 0xff000024);
    assert_eq!(rasterizer.buffer[10 * width + 160], 0xff8899aa);
    assert!(rasterizer.buffer.iter().all(|p| p >> 24 == 255));
    rasterizer.map.sky = Some(pixel3d::raster::Sky {
        seed: 731, zenith: 0xff552c20, horizon: 0xff838bbd, cloud: 0xffcfbdc0, speed: 0.35,
    });
    rasterizer.render(&surface_state, &mut frame);
    let sky_frame = frame.clone();
    let sky_depth = rasterizer.z_buffer.clone();
    surface_state.time = 12.0;
    rasterizer.render(&surface_state, &mut frame);
    assert_ne!(frame, sky_frame);
    assert_eq!(rasterizer.z_buffer, sky_depth);
    let sky = rasterizer.map.sky.as_ref().unwrap();
    assert_eq!(pixel3d::raster::sky_pixel(sky, 0.0, 0.0, 0.0), sky.horizon);
    assert_eq!(pixel3d::raster::sky_pixel(sky, -std::f64::consts::PI, 0.7, 3.0), pixel3d::raster::sky_pixel(sky, std::f64::consts::PI, 0.7, 3.0));
    assert_eq!([0.0, 0.3, 0.7, 1.5].map(|a| pixel3d::raster::sky_pixel(sky, a, 0.7, 3.0)), [0xff634951, 0xff786067, 0xff80686e, 0xff634951]);
    rasterizer.set_map(flat_map);

    // Native presentation uses the same per-tile animated texture indices as web.
    rasterizer.textures.push(Texture { width: 8, height: 8, pixels: vec![0xff00ff00; 64] });
    let mut wall_state = state.clone();
    wall_state.things.clear();
    wall_state.weapon = None;
    rasterizer.render(&wall_state, &mut frame);
    let original = frame.clone();
    let original_depth = rasterizer.z_buffer.clone();
    wall_state.wall_overrides.push(pixel3d::raster::WallOverride { x: 3, y: 1, texture: 1 });
    rasterizer.render(&wall_state, &mut frame);
    assert_eq!(&frame[mid_idx..mid_idx + 4], &0xff00ff00u32.to_ne_bytes());
    assert_eq!(rasterizer.z_buffer, original_depth);
    wall_state.wall_overrides[0].texture = 99;
    rasterizer.render(&wall_state, &mut frame);
    assert_eq!(frame, original, "Unknown overrides fall back to the base wall");

}

#[test]
fn all_breach_maps_connect_spawn_to_every_floor_and_objective() {
    use std::collections::{HashSet, VecDeque};
    let doc = load_rune_document_from_path(Path::new("examples/vect_breach/vect_breach.rune")).unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let textures = game.config["textures"].as_object().unwrap();
    let objectives: Vec<_> = ["wall/switch", "wall/exit"].iter()
        .map(|name| textures.keys().position(|key| key == name).unwrap() + 1).collect();
    for (name, map) in game.config["maps"].as_object().unwrap() {
        let w = map["width"].as_u64().unwrap() as usize;
        let h = map["height"].as_u64().unwrap() as usize;
        let grid = map["grid"].as_array().unwrap();
        let x = map["spawn"]["x"].as_f64().unwrap().floor() as usize;
        let y = map["spawn"]["y"].as_f64().unwrap().floor() as usize;
        let start = y * w + x;
        let mut visited = HashSet::from([start]);
        let mut queue = VecDeque::from([start]);
        let neighbors = |i: usize| {
            [(i % w).checked_sub(1).map(|x| i / w * w + x),
             (i % w + 1 < w).then_some(i + 1),
             i.checked_sub(w), (i / w + 1 < h).then_some(i + w)]
        };
        while let Some(i) = queue.pop_front() {
            for n in neighbors(i).into_iter().flatten() {
                if grid[n] == 0 && visited.insert(n) { queue.push_back(n); }
            }
        }
        assert_eq!(visited.len(), grid.iter().filter(|v| **v == 0).count(), "{name}: disconnected floor");
        for objective in &objectives {
            let targets: Vec<_> = grid.iter().enumerate().filter(|(_, v)| **v == *objective).map(|(i, _)| i).collect();
            assert_eq!(targets.len(), 1, "{name}: needs one terminal and one elevator");
            assert!(neighbors(targets[0]).into_iter().flatten().any(|n| visited.contains(&n)), "{name}: unreachable objective");
        }
    }
}

#[test]
fn rejects_breach_spawns_inside_walls_or_outside_the_map() {
    let source = std::fs::read_to_string("examples/vect_breach/map.rune").unwrap();
    for spawn in [r#"{"x":0.5,"y":0.5,"angle":0}"#, r#"{"x":99,"y":1.5,"angle":0}"#] {
        let source = source.replacen(r#"{"x":1.5,"y":1.5,"angle":0}"#, spawn, 1);
        let doc = parse_rune(&source).unwrap();
        let map = doc.sections.iter().find(|s| s.path == ["Map", "e1m1"]).unwrap();
        assert!(pixel3d::parse_map_simple(map).is_err());
    }
}

#[tokio::test]
async fn compiles_compact_breach_shell_and_validates_its_canvas() {
    let doc = load_rune_document_from_path(Path::new("examples/vect_breach/site_shell.rune")).unwrap();
    let html = pixel3d::html(&doc).await.unwrap();
    assert!(html.contains("THREE SECTORS. ONE WAY OUT."));
    assert!(html.contains("__RunePixel3DRuntime.boot({"));
    assert!(html.contains("data-rune-pixel-3d"));
    assert!(!html.contains("/*__GAME__*/"));
    let mut invalid = doc.clone();
    let page = invalid.sections.iter_mut().find(|s| s.path == ["Page", "site_breach"]).unwrap();
    page.series.insert("view".into(), vec![rune_runtime::rune_ast::Value::String("div No canvas".into())]);
    assert!(pixel3d::html(&invalid).await.is_err());
}
