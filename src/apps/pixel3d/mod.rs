//! Platform-independent pixel-3d compilation and assets.
pub mod raster;
#[cfg(feature = "pixel-desktop")]
pub mod desktop;

use crate::rune_ast::{RuneDocument, Value};
use anyhow::{ensure, Context, Result};
use serde_json::{json, Map, Value as Json};
use std::collections::HashMap;

fn text<'a>(section: &'a crate::rune_ast::Section, key: &str) -> Option<&'a str> {
    section.kv.get(key).and_then(Value::as_str)
}

fn json_value(value: &Value) -> Json {
    match value {
        Value::String(s) => serde_json::from_str(s).unwrap_or_else(|_| json!(s)),
        _ => value.to_json(),
    }
}

fn integers(value: Option<&Value>, count: usize, label: &str) -> Result<Vec<i64>> {
    let values = value.map(json_value).context(format!("Missing {label}"))?;
    let values = values
        .as_array()
        .context(format!("{label} must be a list"))?;
    ensure!(values.len() == count, "{label} needs {count} values");
    values
        .iter()
        .map(|v| {
            let n = v
                .as_f64()
                .context(format!("{label} must contain integers"))?;
            ensure!(
                n.is_finite() && n.fract() == 0.0 && n.abs() <= 16384.0,
                "Invalid {label} value"
            );
            Ok(n as i64)
        })
        .collect()
}

fn color(value: &str) -> Result<Option<u32>> {
    if value == "transparent" {
        return Ok(None);
    }
    ensure!(
        value.len() == 7 && value.starts_with('#'),
        "Expected #RRGGBB or transparent, got {value}"
    );
    Ok(Some(
        u32::from_str_radix(&value[1..], 16).context("Invalid palette color")?,
    ))
}

fn pack_color(rgb: u32) -> u32 {
    0xff000000
        | ((rgb & 0xff) << 16)
        | (rgb & 0xff00)
        | ((rgb >> 16) & 0xff)
}

/// Compile textures (@Texture), sprites (@Sprite), palettes, and map (@Map)
pub fn compile_assets(doc: &RuneDocument) -> Result<Json> {
    let mut palettes = HashMap::new();
    for section in &doc.sections {
        if section.path.first().map(String::as_str) != Some("Palette") {
            continue;
        }
        ensure!(section.path.len() == 2, "Expected @Palette/<name>");
        let colors = section
            .kv
            .get("colors")
            .context("Palette needs colors = { ... }")?;
        let colors = json_value(colors);
        let colors = colors
            .as_object()
            .context("Palette colors must be an object")?;
        ensure!(
            !colors.is_empty() && colors.len() <= 256,
            "Palette needs 1–256 colors"
        );
        let mut palette = HashMap::new();
        for (symbol, value) in colors {
            ensure!(
                symbol.chars().count() == 1 && symbol.is_ascii(),
                "Palette symbols must be single ASCII characters"
            );
            palette.insert(
                symbol.as_bytes()[0],
                color(value.as_str().context("Palette colors must be strings")?)?,
            );
        }
        palettes.insert(section.path[1].clone(), palette);
    }

    // 1. Compile Sprites (billboards / items / enemies / weapons)
    let mut sprites = Map::new();
    for section in &doc.sections {
        if section.path.first().map(String::as_str) != Some("Sprite") {
            continue;
        }
        let label = section.path.join("/");
        ensure!(section.path.len() >= 2, "Expected @Sprite/<name>[/frame]");
        let size = integers(section.kv.get("size"), 2, &format!("{label} size"))?;
        let palette_name = text(section, "palette").context(format!("{label}: missing palette"))?;
        let palette = palettes
            .get(palette_name)
            .context(format!("{label}: unknown palette {palette_name}"))?;
        let rows = section
            .series
            .get("pixels")
            .context(format!("{label}: missing pixels:"))?;
        ensure!(
            rows.len() == size[1] as usize,
            "{label}: expected {} rows, got {}",
            size[1],
            rows.len()
        );
        let mut colors = vec![Json::Null];
        let mut indices = HashMap::new();
        let mut pixels = Vec::new();
        for (row_number, row) in rows.iter().enumerate() {
            let row = json_value(row);
            let row = row
                .as_str()
                .context(format!("{label}: pixels must be quoted rows"))?;
            ensure!(
                row.is_ascii() && row.len() == size[0] as usize,
                "{label}: row {} must have {} pixels",
                row_number + 1,
                size[0]
            );
            for symbol in row.bytes() {
                let value = palette.get(&symbol).context(format!(
                    "{label}: unknown palette character {} in row {}",
                    symbol as char,
                    row_number + 1
                ))?;
                let index = match value {
                    None => 0,
                    Some(rgb) => *indices.entry(*rgb).or_insert_with(|| {
                        colors.push(json!(rgb));
                        colors.len() - 1
                    }),
                };
                pixels.push(index);
            }
        }
        let origin = if section.kv.contains_key("origin") {
            integers(section.kv.get("origin"), 2, &format!("{label} origin"))?
        } else {
            vec![size[0] / 2, size[1]]
        };
        sprites.insert(
            section.path[1..].join("/"),
            json!({"width":size[0],"height":size[1],"origin":origin,"colors":colors,"pixels":pixels}),
        );
    }

    // 2. Compile Textures (walls, floors, ceilings)
    let mut textures = Map::new();
    for section in &doc.sections {
        if section.path.first().map(String::as_str) != Some("Texture") {
            continue;
        }
        let label = section.path.join("/");
        ensure!(section.path.len() >= 2, "Expected @Texture/<name>");
        let size = integers(section.kv.get("size"), 2, &format!("{label} size"))?;
        ensure!(
            size[0] == size[1] && [8, 16, 32, 64, 128, 256].contains(&size[0]),
            "{label}: texture size must be power-of-two square (8, 16, 32, 64, 128, 256)"
        );
        let palette_name = text(section, "palette").context(format!("{label}: missing palette"))?;
        let palette = palettes
            .get(palette_name)
            .context(format!("{label}: unknown palette {palette_name}"))?;
        let rows = section
            .series
            .get("pixels")
            .context(format!("{label}: missing pixels:"))?;
        ensure!(
            rows.len() == size[1] as usize,
            "{label}: expected {} rows, got {}",
            size[1],
            rows.len()
        );
        let mut pixels = Vec::with_capacity((size[0] * size[1]) as usize);
        for (row_number, row) in rows.iter().enumerate() {
            let row = json_value(row);
            let row = row
                .as_str()
                .context(format!("{label}: pixels must be quoted rows"))?;
            ensure!(
                row.is_ascii() && row.len() == size[0] as usize,
                "{label}: row {} must have {} pixels",
                row_number + 1,
                size[0]
            );
            for symbol in row.bytes() {
                let value = palette.get(&symbol).context(format!(
                    "{label}: unknown palette character {} in row {}",
                    symbol as char,
                    row_number + 1
                ))?;
                let rgb = value.unwrap_or(0x000000);
                // Packed 0xAABBGGRR
                let packed = 0xff000000
                    | ((rgb & 0xff) << 16)
                    | (rgb & 0xff00)
                    | ((rgb >> 16) & 0xff);
                pixels.push(packed);
            }
        }
        textures.insert(
            section.path[1..].join("/"),
            json!({"width":size[0],"height":size[1],"pixels":pixels}),
        );
    }

    Ok(json!({
        "sprites": sprites,
        "textures": textures,
    }))
}

pub fn parse_map_full(
    map_section: &crate::rune_ast::Section,
    textures: &serde_json::Map<String, Json>,
) -> Result<Json> {
    let grid_rows = map_section
        .series
        .get("grid")
        .context("Map needs grid:")?;
    ensure!(!grid_rows.is_empty(), "Map grid cannot be empty");
    let map_height = grid_rows.len();
    let first_row = json_value(&grid_rows[0]);
    let map_width = first_row
        .as_str()
        .context("Map grid rows must be strings")?
        .len();

    let legend = map_section
        .kv
        .get("legend")
        .map(json_value)
        .context("Map needs legend = { ... }")?;
    let legend = legend.as_object().context("Map legend must be an object")?;

    let mut grid_flat = Vec::with_capacity(map_width * map_height);
    for (row_idx, row) in grid_rows.iter().enumerate() {
        let row_val = json_value(row);
        let row_str = row_val
            .as_str()
            .context(format!("Grid row {} must be string", row_idx + 1))?;
        ensure!(
            row_str.len() == map_width,
            "Grid row {} length mismatch with row 1",
            row_idx + 1
        );
        for ch in row_str.chars() {
            let key = ch.to_string();
            let def = legend.get(&key).unwrap_or(&Json::Null);
            if def.is_null() || def.as_object().is_some_and(|o| o.is_empty()) {
                grid_flat.push(0);
            } else if let Some(wall) = def.get("wall").and_then(Json::as_str) {
                let idx = textures
                    .keys()
                    .position(|k| k == wall)
                    .map(|i| i + 1)
                    .unwrap_or(1);
                grid_flat.push(idx);
            } else {
                grid_flat.push(1);
            }
        }
    }

    let floor_val = map_section.kv.get("floor").map(json_value).unwrap_or(json!("#222222"));
    let ceiling_val = map_section.kv.get("ceiling").map(json_value).unwrap_or(json!("#111111"));

    let floor_color = if let Some(s) = floor_val.as_str() {
        if s.starts_with('#') {
            pack_color(color(s)?.unwrap_or(0x222222))
        } else {
            pack_color(0x222222)
        }
    } else {
        pack_color(0x222222)
    };

    let ceil_color = if let Some(s) = ceiling_val.as_str() {
        if s.starts_with('#') {
            pack_color(color(s)?.unwrap_or(0x111111))
        } else {
            pack_color(0x111111)
        }
    } else {
        pack_color(0x111111)
    };

    Ok(json!({
        "width": map_width,
        "height": map_height,
        "grid": grid_flat,
        "floor": floor_color,
        "ceiling": ceil_color,
    }))
}

pub fn parse_map_simple(map_section: &crate::rune_ast::Section) -> Result<Json> {
    let grid_rows = map_section
        .series
        .get("grid")
        .context("Map needs grid:")?;
    ensure!(!grid_rows.is_empty(), "Map grid cannot be empty");
    let map_height = grid_rows.len();
    let first_row = json_value(&grid_rows[0]);
    let map_width = first_row
        .as_str()
        .context("Map grid rows must be strings")?
        .len();

    let legend = map_section
        .kv
        .get("legend")
        .map(json_value)
        .context("Map needs legend = { ... }")?;
    let legend = legend.as_object().context("Map legend must be an object")?;

    let mut grid_flat = Vec::with_capacity(map_width * map_height);
    for (row_idx, row) in grid_rows.iter().enumerate() {
        let row_val = json_value(row);
        let row_str = row_val
            .as_str()
            .context(format!("Grid row {} must be string", row_idx + 1))?;
        ensure!(
            row_str.len() == map_width,
            "Grid row {} length mismatch with row 1",
            row_idx + 1
        );
        for ch in row_str.chars() {
            let key = ch.to_string();
            let def = legend.get(&key).unwrap_or(&Json::Null);
            if def.is_null() || def.as_object().is_some_and(|o| o.is_empty()) {
                grid_flat.push(0);
            } else {
                grid_flat.push(1);
            }
        }
    }

    Ok(json!({
        "width": map_width,
        "height": map_height,
        "grid": grid_flat,
    }))
}

#[allow(dead_code)]
pub struct Game3D {
    pub title: String,
    pub width: usize,
    pub height: usize,
    pub script: String,
    pub config: Json,
}

pub fn compile(doc: &RuneDocument) -> Result<Game3D> {
    use crate::apps::rune_web::{jscodegen::JsCodegen, parser::parse_rune_web_frontend};

    let app = doc.get_section("App").context("Pixel-3D game needs @App")?;
    let scene_name = text(app, "scene").context("Pixel-3D @App needs scene = <name>")?;
    let scene = doc
        .sections
        .iter()
        .find(|s| s.path == ["Scene", scene_name])
        .context(format!("Unknown @Scene/{scene_name}"))?;

    let logic_name = text(scene, "logic").context("Scene needs logic = <name>")?;
    let map_name = text(scene, "map").context("Scene needs map = <name>")?;

    let map_section = doc
        .sections
        .iter()
        .find(|s| s.path == ["Map", map_name])
        .context(format!("Unknown @Map/{map_name}"))?;

    let resolution = integers(app.kv.get("resolution"), 2, "App resolution")?;
    let tick_rate = app.kv.get("tick_rate").map(json_value).unwrap_or(json!(30));

    let frontend =
        parse_rune_web_frontend(doc, scene_name).map_err(|e| anyhow::anyhow!(e.to_string()))?;
    let logic = frontend
        .logic_definitions
        .get(logic_name)
        .context("Unknown scene @Logic")?
        .clone();

    for action in ["start", "tick"] {
        ensure!(
            logic.actions.contains_key(action),
            "Pixel-3D logic needs action {action}"
        );
    }

    let assets_json = compile_assets(doc)?;
    let textures_map = assets_json["textures"]
        .as_object()
        .context("Missing compiled textures")?;

    let mut maps = Map::new();
    for section in &doc.sections {
        if section.path.first().map(String::as_str) == Some("Map") && section.path.len() >= 2 {
            let map_id = section.path[1..].join("/");
            if let Ok(parsed) = parse_map_full(section, textures_map) {
                maps.insert(map_id, parsed);
            }
        }
    }

    let scene_map = maps
        .get(map_name)
        .cloned()
        .unwrap_or_else(|| parse_map_full(map_section, textures_map).unwrap());

    let config = json!({
        "width": resolution[0],
        "height": resolution[1],
        "tickRate": tick_rate,
        "textures": assets_json["textures"],
        "sprites": assets_json["sprites"],
        "map": scene_map,
        "maps": maps,
        "camera": text(scene, "camera").unwrap_or("player"),
        "things": scene.kv.get("things").map(json_value).unwrap_or(json!([])),
        "weapon": scene.kv.get("weapon").map(json_value).unwrap_or(Json::Null),
        "keys": scene.kv.get("keys").map(json_value).unwrap_or(json!({
            "KeyW": "forward",
            "KeyS": "back",
            "KeyA": "strafe_left",
            "KeyD": "strafe_right",
            "ArrowLeft": "turn_left",
            "ArrowRight": "turn_right",
            "Space": "fire",
            "KeyE": "use"
        })),
        "mouseLook": scene.kv.get("mouse_look").map(json_value).unwrap_or(json!(true)),
        "hud": scene.kv.get("hud").map(json_value).unwrap_or(Json::Null),
    });

    let runtime = format!(
        "{}\n__RunePixel3DRuntime.configure({});",
        include_str!("../../../runtime/rune-web/dist/rune-pixel-3d.js"),
        config.to_string().replace('<', "\\u003c")
    );

    let script = JsCodegen::new(
        crate::apps::rune_web::ast::ViewNode::Comment("pixel-3d".into()),
        logic,
        "{}".into(),
        None,
        HashMap::new(),
        None,
        None,
        None,
        frontend.sounds,
        frontend.music,
    )
    .generate_with_runtime(&runtime)
    .replacen("__RuneWeb.boot({", "__RunePixel3DRuntime.boot({", 1);

    Ok(Game3D {
        title: text(app, "name").unwrap_or("Rune Pixel 3D").into(),
        width: resolution[0] as usize,
        height: resolution[1] as usize,
        script,
        config,
    })
}

pub async fn html(doc: &RuneDocument) -> Result<String> {
    let game = compile(doc)?;
    let title = game
        .title
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;");
    let shell = include_str!("shell.html").replace("__TITLE__", &title);
    Ok(shell.replace("/*__GAME__*/", &game.script))
}

pub async fn router(doc: &RuneDocument) -> axum::Router {
    use axum::{response::Html, routing::get};
    match html(doc).await {
        Ok(html) => axum::Router::new().route("/", get(move || async move { Html(html.clone()) })),
        Err(error) => {
            let error = error.to_string();
            axum::Router::new().fallback(move || {
                let error = error.clone();
                async move { (axum::http::StatusCode::INTERNAL_SERVER_ERROR, error) }
            })
        }
    }
}
