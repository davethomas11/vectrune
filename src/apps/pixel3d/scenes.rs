//! Declarative cameras and noninteractive presentation scenes.
use super::*;

fn section<'a>(doc: &'a RuneDocument, kind: &str, name: &str) -> Result<&'a crate::rune_ast::Section> {
    doc.sections.iter().find(|s| s.path == [kind, name]).with_context(|| format!("Unknown @{kind}/{name}"))
}

fn perspective(doc: &RuneDocument, scene: &crate::rune_ast::Section) -> Result<f64> {
    let Some(name) = text(scene, "perspective") else { return Ok(66.0); };
    let p = section(doc, "Perspective", name)?;
    let fov = p.kv.get("fov").map(json_value).and_then(|v| v.as_f64()).context("Perspective needs numeric fov")?;
    ensure!(fov.is_finite() && (20.0..=120.0).contains(&fov), "Perspective fov must be between 20 and 120 degrees");
    Ok(fov)
}

fn camera(doc: &RuneDocument, name: &str) -> Result<Json> {
    let c = section(doc, "Camera", name)?;
    let duration = c.kv.get("duration").map(json_value).and_then(|v| v.as_f64()).context("Camera needs numeric duration in seconds")?;
    ensure!(duration.is_finite() && duration > 0.0, "Camera duration must be positive");
    let looping = c.kv.get("loop").map(json_value).unwrap_or(json!(true));
    ensure!(looping.is_boolean(), "Camera loop must be boolean");
    let points = c.kv.get("points").map(json_value).context("Camera needs points")?;
    let list = points.as_array().context("Camera points must be an array")?;
    ensure!((2..=128).contains(&list.len()), "Camera needs 2 through 128 points");
    for p in list {
        for field in ["x", "y", "angle"] {
            ensure!(p[field].as_f64().is_some_and(f64::is_finite), "Camera point needs finite {field}");
        }
        for (field, default, min, max) in [("height", 0.5, 0.05, 256.0), ("pitch", 0.0, -85.0, 85.0)] {
            let n = match p.get(field) { Some(v) => v.as_f64().context(format!("Camera point {field} must be numeric"))?, None => default };
            ensure!(n.is_finite() && (min..=max).contains(&n), "Camera point {field} must be between {min} and {max}");
        }
    }
    Ok(json!({"duration":duration,"loop":looping,"points":points}))
}

pub(super) fn compile(doc: &RuneDocument, scene: &crate::rune_ast::Section, config: &mut Json) -> Result<()> {
    config["fov"] = json!(perspective(doc, scene)?);
    if let Some(paths) = tether_paths(scene)? {
        config["tethers"] = paths;
    }
    if let Some(name) = text(scene, "camera") {
        if doc.sections.iter().any(|s| s.path == ["Camera", name]) {
            config["cameraTrack"] = camera(doc, name)?;
        }
    }
    let Some(name) = text(scene, "title_scene") else { return Ok(()); };
    let title = section(doc, "Scene", name)?;
    ensure!(!title.kv.contains_key("title_scene"), "Title scenes cannot nest title_scene");
    let map_name = text(title, "map").context("Title Scene needs map")?;
    let mut map = config["maps"][map_name].clone();
    ensure!(map.is_object(), "Unknown title Scene map {map_name}");
    if let Some(sky) = title.kv.get("sky") {
        let mut map_section = section(doc, "Map", map_name)?.clone();
        map_section.kv.remove("ceiling");
        map_section.kv.insert("sky".into(), sky.clone());
        map = parse_map_full(&map_section, config["textures"].as_object().unwrap())?;
    }
    let track = camera(doc, text(title, "camera").context("Title Scene needs an @Camera")?)?;
    let fov = perspective(doc, title)?;
    if let Some(things) = title.kv.get("things") {
        ensure!(json_value(things).as_array().is_some_and(|a| a.iter().all(Json::is_string)), "Title Scene things must be state path strings");
    }
    let heading = text(title, "heading").context("Title Scene needs heading")?;
    let subtitle = text(title, "subtitle").unwrap_or("");
    let prompt = text(title, "prompt").unwrap_or("PRESS ENTER TO BEGIN");
    ensure!(heading.len() <= 24 && subtitle.len() <= 72 && prompt.len() <= 72, "Title Scene text is too long");
    config["titleScene"] = json!({"map":map,"camera":track,"fov":fov,
        "heading":heading,"subtitle":subtitle,"prompt":prompt,
        "things":title.kv.get("things").map(json_value).unwrap_or_else(|| config["things"].clone())});
    if let Some(paths) = tether_paths(title)? {
        config["titleScene"]["tethers"] = paths;
    }
    Ok(())
}

fn tether_paths(scene: &crate::rune_ast::Section) -> Result<Option<Json>> {
    let Some(value) = scene.kv.get("tethers") else { return Ok(None); };
    let paths = json_value(value);
    ensure!(
        paths.as_array().is_some_and(|paths| paths.len() <= 32 && paths.iter().all(|path| {
            path.as_str().is_some_and(|s| s.split('.').all(|part| {
                !part.is_empty() && part.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_')
            }))
        })),
        "Scene tethers must be an array of up to 32 state paths"
    );
    Ok(Some(paths))
}
