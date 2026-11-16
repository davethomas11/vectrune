//! Platform-independent pixel-3d compilation and assets.
pub mod raster;
pub mod model;
pub mod hud;
mod scenes;
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

fn texture_runs(source: &str, width: usize, label: &str) -> Result<Vec<u8>> {
    let mut row = Vec::with_capacity(width);
    for token in source.split_whitespace() {
        let (symbol, count) = if let Some((symbol, count)) = token.split_once('*') {
            let count = count.parse::<usize>().context(format!("{label}: invalid run count"))?;
            (symbol, count)
        } else {
            (token, 1)
        };
        ensure!(symbol.len() == 1 && symbol.is_ascii(), "{label}: runs need single ASCII palette symbols");
        ensure!(count > 0 && count <= width - row.len(), "{label}: run exceeds row width or has zero count");
        row.extend(std::iter::repeat_n(symbol.as_bytes()[0], count));
    }
    ensure!(row.len() == width, "{label}: expanded row must have {width} pixels, got {}", row.len());
    Ok(row)
}

fn texture_rows(section: &crate::rune_ast::Section, width: usize, height: usize, label: &str) -> Result<Vec<Vec<u8>>> {
    let patterns = section.kv.get("patterns").map(json_value).unwrap_or(json!({}));
    let patterns = patterns.as_object().context(format!("{label}: patterns must be an object"))?;
    let patterns: HashMap<String, Vec<u8>> = patterns.iter().map(|(name, value)| {
        ensure!(!name.is_empty(), "{label}: pattern names cannot be empty");
        let value = value.as_str().context(format!("{label}: pattern {name} must be a run string"))?;
        Ok((name.clone(), texture_runs(value, width, &format!("{label} pattern {name}"))?))
    }).collect::<Result<_>>()?;
    let entries = section.series.get("pixels").context(format!("{label}: missing pixels:"))?;
    let mut rows = Vec::with_capacity(height);
    for (index, entry) in entries.iter().enumerate() {
        let entry = json_value(entry);
        let (row, repeat) = if let Some(row) = entry.as_str() {
            (row.as_bytes().to_vec(), 1)
        } else {
            let obj = entry.as_object().context(format!("{label}: row {} must be a string or row object", index + 1))?;
            ensure!(obj.keys().all(|k| ["row", "runs", "pattern", "repeat"].contains(&k.as_str())),
                "{label}: unknown compressed row property");
            ensure!(["row", "runs", "pattern"].iter().filter(|k| obj.contains_key(**k)).count() == 1,
                "{label}: row object needs exactly one of row, runs or pattern");
            let repeat = obj.get("repeat").map(|n| n.as_f64().context(format!("{label}: repeat must be numeric")))
                .transpose()?.unwrap_or(1.0);
            ensure!(repeat.is_finite() && repeat.fract() == 0.0 && repeat >= 1.0 && repeat <= height as f64,
                "{label}: repeat must be an integer from 1 to {height}");
            let row = if let Some(value) = obj.get("row") {
                value.as_str().context(format!("{label}: row must be a string"))?.as_bytes().to_vec()
            } else if let Some(value) = obj.get("runs") {
                texture_runs(value.as_str().context(format!("{label}: runs must be a string"))?, width, label)?
            } else {
                let name = obj["pattern"].as_str().context(format!("{label}: pattern must be a name"))?;
                patterns.get(name).context(format!("{label}: unknown row pattern {name}"))?.clone()
            };
            (row, repeat as usize)
        };
        ensure!(row.is_ascii() && row.len() == width, "{label}: row {} must have {width} ASCII pixels", index + 1);
        ensure!(rows.len() + repeat <= height, "{label}: expanded rows exceed texture height {height}");
        rows.extend(std::iter::repeat_n(row, repeat));
    }
    ensure!(rows.len() == height, "{label}: expected {height} expanded rows, got {}", rows.len());
    Ok(rows)
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
        let rows = texture_rows(section, size[0] as usize, size[1] as usize, &label)?;
        let mut pixels = Vec::with_capacity((size[0] * size[1]) as usize);
        for (row_number, row) in rows.iter().enumerate() {
            for symbol in row {
                let value = palette.get(symbol).context(format!(
                    "{label}: unknown palette character {} in row {}",
                    *symbol as char,
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

    let mut models = Map::new();
    for section in &doc.sections {
        if section.path.first().map(String::as_str) != Some("Model") {
            continue;
        }
        let label = section.path.join("/");
        ensure!(section.path.len() >= 2, "Expected @Model/<name>");
        let palette_name = text(section, "palette").context(format!("{label}: missing palette"))?;
        let palette = palettes.get(palette_name).context(format!("{label}: unknown palette {palette_name}"))?;
        let unit = section.kv.get("unit").map(json_value).unwrap_or(json!(0.125));
        let unit = unit.as_f64().context(format!("{label}: unit must be numeric"))?;
        ensure!(unit.is_finite() && unit > 0.0 && unit <= 1.0, "{label}: unit must be greater than 0 and at most 1 world tile");
        let blocks = section.series.get("blocks").context(format!("{label}: missing blocks:"))?;
        ensure!(!blocks.is_empty() && blocks.len() <= 256, "{label}: needs 1-256 blocks");
        let mut compiled = Vec::new();
        for block in blocks {
            let block = json_value(block);
            let object = block.as_object().context(format!("{label}: each block must be an object"))?;
            ensure!(object.keys().all(|k| ["from", "size", "color"].contains(&k.as_str())), "{label}: unknown block property");
            let triple = |key: &str, positive: bool| -> Result<Vec<f64>> {
                let list = block[key].as_array().context(format!("{label}: block {key} needs three integers"))?;
                ensure!(list.len() == 3, "{label}: block {key} needs three integers");
                list.iter().map(|v| {
                    let n = v.as_f64().context(format!("{label}: block {key} must contain integers"))?;
                    ensure!(n.is_finite() && n.fract() == 0.0 && n.abs() <= 32.0 && (!positive || n > 0.0), "{label}: block {key} must contain {}integers within 32 units", if positive { "positive " } else { "" });
                    Ok(n * unit)
                }).collect()
            };
            let from = triple("from", false)?;
            let size = triple("size", true)?;
            let symbol = block["color"].as_str().context(format!("{label}: block color needs a palette symbol"))?;
            ensure!(symbol.len() == 1 && symbol.is_ascii(), "{label}: block color needs one ASCII palette symbol");
            let rgb = palette.get(&symbol.as_bytes()[0]).context(format!("{label}: unknown palette symbol {symbol}"))?
                .context(format!("{label}: blocks cannot be transparent"))?;
            compiled.push(json!({"from":from,"size":size,"color":pack_color(rgb)}));
        }
        models.insert(section.path[1..].join("/"), json!({"blocks":compiled}));
    }

    Ok(json!({
        "sprites": sprites,
        "textures": textures,
        "models": models,
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

    let surface = |key: &str, default: u32| -> Result<Json> {
        let Some(value) = map_section.kv.get(key) else { return Ok(json!(pack_color(default))); };
        let value = json_value(value);
        let name = value.as_str().context(format!("Map {key} must be #RRGGBB or a texture name"))?;
        if name.starts_with('#') {
            Ok(json!(pack_color(color(name)?.context("Map surfaces must be opaque")?)))
        } else {
            textures.get(name).cloned().context(format!("Map {key}: unknown texture {name}"))
        }
    };
    let floor = surface("floor", 0x222222)?;
    let ceiling = surface("ceiling", 0x111111)?;
    let ceiling_height = map_section.kv.get("ceiling_height")
        .map(|value| json_value(value).as_f64().context("Map ceiling_height must be numeric"))
        .transpose()?.unwrap_or(1.0);
    ensure!(ceiling_height.is_finite() && ceiling_height > 0.5 && ceiling_height <= 16.0,
        "Map ceiling_height must be greater than 0.5 and at most 16 tiles");
    let sky = if let Some(value) = map_section.kv.get("sky") {
        ensure!(!map_section.kv.contains_key("ceiling"), "Map sky and ceiling are mutually exclusive");
        let value = json_value(value);
        let obj = value.as_object().context("Map sky must be an object")?;
        ensure!(obj.keys().all(|k| ["seed", "zenith", "horizon", "cloud", "speed"].contains(&k.as_str())), "Unknown Map sky property");
        let seed = obj.get("seed").and_then(Json::as_f64).context("Map sky needs an unsigned integer seed")?;
        ensure!(seed.is_finite() && seed.fract() == 0.0 && (0.0..=u32::MAX as f64).contains(&seed), "Map sky seed must be an unsigned 32-bit integer");
        let seed = seed as u32;
        let sky_color = |key: &str| -> Result<u32> {
            let s = obj.get(key).and_then(Json::as_str).context(format!("Map sky needs {key} = #RRGGBB"))?;
            Ok(pack_color(color(s)?.context("Sky colors must be opaque")?))
        };
        let speed = obj.get("speed").map(|v| v.as_f64().context("Sky speed must be numeric")).transpose()?.unwrap_or(0.25);
        ensure!(speed.is_finite() && (0.0..=10.0).contains(&speed), "Sky speed must be between 0 and 10");
        json!({"seed":seed,"zenith":sky_color("zenith")?,"horizon":sky_color("horizon")?,"cloud":sky_color("cloud")?,"speed":speed})
    } else { Json::Null };

    let spawn = parse_spawn(map_section, &grid_flat, map_width, map_height)?;
    Ok(json!({
        "spawn": spawn,
        "width": map_width,
        "height": map_height,
        "grid": grid_flat,
        "floor": floor,
        "ceiling": ceiling,
        "ceilingHeight": ceiling_height,
        "sky": sky,
    }))
}

fn parse_spawn(section: &crate::rune_ast::Section, grid: &[usize], width: usize, height: usize) -> Result<Option<Json>> {
    let Some(value) = section.kv.get("spawn") else { return Ok(None); };
    let value = json_value(value);
    let x = value.get("x").and_then(Json::as_f64).context("Map spawn needs numeric x")?;
    let y = value.get("y").and_then(Json::as_f64).context("Map spawn needs numeric y")?;
    let angle = value.get("angle").map(|v| v.as_f64().context("Map spawn angle must be numeric")).transpose()?.unwrap_or(0.0);
    ensure!(x.is_finite() && y.is_finite() && angle.is_finite(), "Map spawn must be finite");
    ensure!(x >= 0.0 && y >= 0.0 && x < width as f64 && y < height as f64, "Map spawn is outside the grid");
    ensure!(grid[y.floor() as usize * width + x.floor() as usize] == 0, "Map spawn must be on walkable floor");
    Ok(Some(json!({"x":x,"y":y,"angle":angle})))
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

    let spawn = parse_spawn(map_section, &grid_flat, map_width, map_height)?;
    Ok(json!({
        "spawn": spawn,
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
            let parsed = parse_map_full(section, textures_map)
                .with_context(|| format!("Invalid @Map/{map_id}"))?;
            maps.insert(map_id, parsed);
        }
    }

    let scene_map = maps
        .get(map_name)
        .cloned()
        .unwrap_or_else(|| parse_map_full(map_section, textures_map).unwrap());

    let mut config = json!({
        "width": resolution[0],
        "height": resolution[1],
        "tickRate": tick_rate,
        "textures": assets_json["textures"],
        "sprites": assets_json["sprites"],
        "models": assets_json["models"],
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
    if let Some(field) = text(scene, "ui") {
        ensure!(logic.state.contains_key(field), "Scene ui references unknown state {field}");
        config["ui"] = json!(field);
    }
    if let Some(value) = scene.kv.get("world") {
        let field = value
            .as_str()
            .context("Scene world must name a voxel state field")?;
        ensure!(
            logic.state.contains_key(field),
            "Scene world references unknown state {field}"
        );
        config["world"] = json!(field);
    }
    if let Some(value) = scene.kv.get("pause_ui") {
        let value = json_value(value);
        let field = value.as_str().context("Scene pause_ui must name a state field")?;
        ensure!(logic.state.contains_key(field), "Scene pause_ui references unknown state {field}");
        config["pauseUi"] = json!(field);
    }
    if let Some(value) = scene.kv.get("restart_action") {
        let value = json_value(value);
        let action = value.as_str().context("Scene restart_action must name an action")?;
        ensure!(logic.actions.contains_key(action), "Scene restart_action references unknown action {action}");
        config["restartAction"] = json!(action);
    }
    if let Some(value) = scene.kv.get("click_to_start") {
        let value = json_value(value);
        ensure!(value.is_boolean(), "Scene click_to_start must be boolean");
        config["clickToStart"] = value;
    }
    if let Some(value) = scene.kv.get("persistence") {
        let save = json_value(value);
        let key = save["key"].as_str().context("Scene persistence needs key")?;
        let state = save["state"].as_str().context("Scene persistence needs state")?;
        ensure!(!key.is_empty() && key.len() <= 64 && key.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_'), "Persistence key must contain 1-64 letters, digits, hyphens or underscores");
        ensure!(logic.state.contains_key(state), "Scene persistence references unknown state {state}");
        config["persistence"] = save;
    }
    if let Some(value) = scene.kv.get("presentation") {
        let presentation = json_value(value);
        for key in ["title", "subtitle", "objective", "victory", "defeat"] {
            ensure!(presentation[key].is_string(), "Scene presentation needs {key}");
        }
        ensure!(presentation["instructions"].as_array().is_some_and(|lines| lines.len() <= 5 && lines.iter().all(Json::is_string)), "Scene presentation instructions needs up to five strings");
        config["presentation"] = presentation;
    }

    if let Some(profile) = crate::apps::game_controls::compile(doc, scene)? {
        crate::apps::game_controls::validate_actions(&profile, |name| logic.actions.contains_key(name))?;
        config["keys"] = json!(profile["keys"].as_object().unwrap().iter().filter_map(|(code, binding)| {
            binding.as_str().or_else(|| binding["input"].as_str()).map(|name| (code.clone(), json!(name)))
        }).collect::<Map<String, Json>>());
        config["commands"] = json!(profile["commands"].as_object().unwrap().iter().filter(|(_, action)| action.as_str().is_some_and(|s| !s.starts_with("host."))).map(|(key, action)| (key.clone(), action.clone())).collect::<Map<String, Json>>());
        config["controls"] = profile;
    }
    scenes::compile(doc, scene, &mut config)?;

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
    if let Some(shell) = doc.get_section("App").and_then(|s| text(s, "shell")) {
        let frontend = crate::apps::rune_web::parser::parse_rune_web_frontend(doc, shell)
            .map_err(|e| anyhow::anyhow!(e.to_string()))?;
        let page = frontend
            .page_views
            .get(shell)
            .context(format!("Unknown shell @Page/{shell}"))?;
        fn count_canvases(node: &Json) -> usize {
            match node {
                Json::Object(map) => {
                    let own = map.get("Element").is_some_and(|el| {
                        el["tag"] == "canvas" && el["attrs"].get("data-rune-pixel-3d").is_some()
                    }) as usize;
                    own + map.values().map(count_canvases).sum::<usize>()
                }
                Json::Array(nodes) => nodes.iter().map(count_canvases).sum(),
                _ => 0,
            }
        }
        ensure!(
            count_canvases(&serde_json::to_value(&page.view_tree)?) == 1,
            "Pixel-3D shell must contain one canvas data-rune-pixel-3d=true"
        );
        let mut shell_doc = doc.clone();
        shell_doc
            .sections
            .retain(|s| s.path.first().map(String::as_str) != Some("Frontend"));
        shell_doc.sections.push(crate::rune_ast::Section {
            path: vec!["Frontend".into()],
            kv: HashMap::from([
                ("type".into(), Value::String("rune-web".into())),
                ("page".into(), Value::String(shell.into())),
                ("path".into(), Value::String("/".into())),
            ]),
            series: HashMap::new(),
            records: vec![],
            source_file: None,
        });
        let html = crate::apps::rune_web::render_html_for_path(&shell_doc, "/").await?;
        return Ok(html.replace(
            "</body>",
            &format!("<script>{}</script></body>", game.script),
        ));
    }

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
