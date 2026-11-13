//! Platform-independent pixel assets and game compilation.
use crate::rune_ast::{RuneDocument, Value};
use anyhow::{ensure, Context, Result};
use serde_json::{json, Map, Value as Json};
use std::collections::HashMap;

#[cfg(feature = "pixel-desktop")]
pub mod desktop;

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

/// Validate sprites and compile palette characters to compact indexed pixels.
pub fn assets(doc: &RuneDocument) -> Result<Json> {
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
    let mut sprites = Map::new();
    for section in &doc.sections {
        if section.path.first().map(String::as_str) != Some("Sprite") {
            continue;
        }
        let label = section.path.join("/");
        ensure!(section.path.len() >= 2, "Expected @Sprite/<name>[/frame]");
        let size = integers(section.kv.get("size"), 2, &format!("{label} size"))?;
        ensure!(
            size.iter().all(|n| (1..=256).contains(n)),
            "{label}: sprite size must be 1–256 pixels"
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
            vec![0, 0]
        };
        sprites.insert(section.path[1..].join("/"), json!({"width":size[0],"height":size[1],"origin":origin,"colors":colors,"pixels":pixels}));
    }
    ensure!(!sprites.is_empty(), "Pixel game needs at least one @Sprite");
    let mut animations = Map::new();
    for section in &doc.sections {
        if section.path.first().map(String::as_str) != Some("Animation") {
            continue;
        }
        ensure!(section.path.len() >= 2, "Expected @Animation/<name>");
        let frames = json_value(section.kv.get("frames").context("Animation needs frames")?);
        let frames_list = frames
            .as_array()
            .context("Animation frames must be a list")?;
        ensure!(
            !frames_list.is_empty(),
            "Animation needs at least one frame"
        );
        for frame in frames_list {
            ensure!(
                frame.as_str().is_some_and(|f| sprites.contains_key(f)),
                "Unknown animation frame {frame}"
            );
        }
        let fps = section.kv.get("fps").map(json_value).unwrap_or(json!(8));
        ensure!(
            fps.as_f64().is_some_and(|f| f > 0.0 && f <= 60.0),
            "Animation fps must be 1–60"
        );
        animations.insert(
            section.path[1..].join("/"),
            json!({"frames":frames,"fps":fps}),
        );
    }
    Ok(json!({"sprites":sprites,"animations":animations}))
}

pub struct Game {
    pub title: String,
    pub width: usize,
    pub height: usize,
    pub script: String,
}

pub fn compile(doc: &RuneDocument) -> Result<Game> {
    use crate::apps::rune_web::{jscodegen::JsCodegen, parser::parse_rune_web_frontend};
    let app = doc.get_section("App").context("Pixel game needs @App")?;
    let scene_name = text(app, "scene").context("Pixel @App needs scene = <name>")?;
    let scene = doc
        .sections
        .iter()
        .find(|s| s.path == ["Scene", scene_name])
        .context(format!("Unknown @Scene/{scene_name}"))?;
    let logic_name = text(scene, "logic").context("Scene needs logic = <name>")?;
    let resolution = integers(app.kv.get("resolution"), 2, "App resolution")?;
    ensure!(
        resolution.iter().all(|n| (32..=1024).contains(n)),
        "Pixel resolution must be 32–1024 per axis"
    );
    let tick_rate = app.kv.get("tick_rate").map(json_value).unwrap_or(json!(30));
    ensure!(
        tick_rate
            .as_f64()
            .is_some_and(|n| (1.0..=60.0).contains(&n) && n.fract() == 0.0),
        "tick_rate must be 1–60"
    );
    let frontend =
        parse_rune_web_frontend(doc, scene_name).map_err(|e| anyhow::anyhow!(e.to_string()))?;
    let logic = frontend
        .logic_definitions
        .get(logic_name)
        .context("Unknown scene @Logic")?
        .clone();
    ensure!(
        logic.timer.is_none(),
        "Pixel scenes own the game clock; remove @Logic timer"
    );
    for action in ["start", "tick"] {
        ensure!(
            logic.actions.contains_key(action),
            "Pixel logic needs action {action}"
        );
    }
    let mut config = assets(doc)?;
    config["width"] = json!(resolution[0]);
    config["height"] = json!(resolution[1]);
    config["tickRate"] = tick_rate;
    config["layers"] = scene.kv.get("layers").map(json_value).unwrap_or(json!([]));
    ensure!(
        config["layers"]
            .as_array()
            .is_some_and(|a| !a.is_empty() && a.iter().all(Json::is_string)),
        "Scene layers must be a non-empty list of state paths"
    );
    config["hud"] = scene.kv.get("hud").map(json_value).unwrap_or(Json::Null);
    config["overlays"] = scene
        .kv
        .get("overlays")
        .map(json_value)
        .unwrap_or(json!({}));
    config["keys"] = scene.kv.get("keys").map(json_value).unwrap_or(json!({"ArrowLeft":"left","ArrowRight":"right","KeyA":"left","KeyD":"right","Space":"smash"}));
    ensure!(
        config["keys"]
            .as_object()
            .is_some_and(|map| map.values().all(Json::is_string)),
        "Scene keys must map keyboard codes to input names"
    );
    config["background"] = json!(color(text(scene, "background").unwrap_or("#10162b"))?
        .context("Scene background cannot be transparent")?);
    config["rects"] = scene.kv.get("rects").map(json_value).unwrap_or(json!([]));
    let rects = config["rects"]
        .as_array()
        .context("Scene rects must be a list")?;
    for rect in rects {
        for key in ["x", "y", "width", "height"] {
            ensure!(
                rect[key].as_f64().is_some_and(|n| n.is_finite()),
                "Scene rectangle needs numeric {key}"
            );
        }
        ensure!(
            rect["width"].as_f64().unwrap() >= 0.0 && rect["height"].as_f64().unwrap() >= 0.0,
            "Scene rectangle size cannot be negative"
        );
        ensure!(
            color(
                rect["color"]
                    .as_str()
                    .context("Scene rectangle needs a color")?
            )?
            .is_some(),
            "Scene rectangle color cannot be transparent"
        );
    }
    ensure!(
        config["overlays"]
            .as_object()
            .is_some_and(|m| m.values().all(Json::is_string)),
        "Scene overlays must map status names to text"
    );
    if !config["hud"].is_null() {
        for key in ["title", "score", "health"] {
            ensure!(config["hud"][key].is_string(), "Scene hud needs {key}");
        }
        ensure!(
            config["hud"]["max_health"]
                .as_f64()
                .is_some_and(|n| n > 0.0),
            "Scene hud needs positive max_health"
        );
    }
    let runtime = format!(
        "{}\n__RunePixelRuntime.configure({});",
        include_str!("../../../runtime/rune-web/dist/rune-pixel.js"),
        config.to_string().replace('<', "\\u003c")
    );
    let script = JsCodegen::new(
        crate::apps::rune_web::ast::ViewNode::Comment("pixel".into()),
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
    .replacen("__RuneWeb.boot({", "__RunePixelRuntime.boot({", 1);
    Ok(Game {
        title: text(app, "name").unwrap_or("Rune Pixel").into(),
        width: resolution[0] as usize,
        height: resolution[1] as usize,
        script,
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
                        el["tag"] == "canvas" && el["attrs"].get("data-rune-pixel").is_some()
                    }) as usize;
                    own + map.values().map(count_canvases).sum::<usize>()
                }
                Json::Array(nodes) => nodes.iter().map(count_canvases).sum(),
                _ => 0,
            }
        }
        ensure!(
            count_canvases(&serde_json::to_value(&page.view_tree)?) == 1,
            "Pixel shell must contain one canvas data-rune-pixel=true"
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
    let shell = include_str!("shell.html")
        .replace("__TITLE__", &title)
        .replace(
            "data-rune-pixel tabindex",
            &format!(
                "data-rune-pixel width=\"{}\" height=\"{}\" tabindex",
                game.width, game.height
            ),
        );
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
