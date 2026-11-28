use crate::apps::rune_web::ast::LogicDefinition;
use crate::rune_ast::{RuneDocument, Section, Value};
use anyhow::{ensure, Context, Result};
use serde_json::{json, Map, Value as Json};
use std::collections::HashSet;

fn value(value: &Value) -> Json {
    match value {
        Value::String(s) => serde_json::from_str(s).unwrap_or_else(|_| json!(s)),
        _ => value.to_json(),
    }
}

fn fields(object: &Map<String, Json>, allowed: &[&str], label: &str) -> Result<()> {
    for key in object.keys() {
        ensure!(allowed.contains(&key.as_str()), "Unknown {label} field: {key}");
    }
    Ok(())
}

fn name(value: &Json, label: &str) -> Result<String> {
    let name = value.as_str().with_context(|| format!("{label} must be a name"))?;
    ensure!(
        !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'),
        "{label} must contain only letters, digits and underscores"
    );
    Ok(name.to_string())
}

fn state_path(value: &Json, logic: &LogicDefinition, label: &str) -> Result<()> {
    let path = value.as_str().with_context(|| format!("{label} must be a state path"))?;
    let parts: Vec<_> = path.split('.').collect();
    ensure!(!parts.is_empty() && parts.iter().all(|part|
        !part.is_empty() && part.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')),
        "{label} must be a dotted state path");
    ensure!(logic.state.contains_key(parts[0]), "{label} references unknown state {}", parts[0]);
    Ok(())
}

fn label(value: &Json, what: &str) -> Result<()> {
    ensure!(value.as_str().is_some_and(|s| !s.trim().is_empty() && s.len() <= 24 && s.is_ascii()),
        "{what} must be 1–24 ASCII characters");
    Ok(())
}

fn vector(value: &Json, what: &str, positive: bool) -> Result<()> {
    let items = value.as_array().with_context(|| format!("{what} must contain three numbers"))?;
    ensure!(items.len() == 3 && items.iter().all(|item| item.as_f64().is_some_and(|n|
        n.is_finite() && n.abs() <= 4096.0 && (!positive || n >= 0.0))),
        "{what} must contain three bounded {}numbers", if positive { "nonnegative " } else { "" });
    Ok(())
}

pub fn compile(doc: &RuneDocument, scene: &Section, logic: &LogicDefinition) -> Result<Option<Json>> {
    let Some(tv) = scene.kv.get("tv") else { return Ok(None) };
    let tv = tv.as_str().context("Scene tv must name an @TV section")?;
    let sections: Vec<_> = doc.sections.iter().filter(|s| s.path == ["TV", tv]).collect();
    ensure!(sections.len() == 1, "Scene tv needs exactly one @TV/{tv}");
    let section = sections[0];
    ensure!(section.series.is_empty() && section.records.is_empty(), "@TV/{tv} accepts only key-value fields");
    for key in section.kv.keys() {
        ensure!(["initial_focus", "wrap", "summary", "modes", "hide_after", "audio_gain", "master_volume", "volume_control", "resolution"].contains(&key.as_str()),
            "Unknown @TV/{tv} field: {key}");
    }
    let mut profile = json!({"wrap": true, "summary": [], "modes": []});
    for (key, v) in &section.kv { profile[key] = value(v); }
    if let Some(resolution) = profile.get("resolution") {
        ensure!(*resolution == json!([640, 400]) || *resolution == json!([720, 405]),
            "TV resolution must be [640,400] or [720,405]");
    }
    ensure!(profile["wrap"].is_boolean(), "TV wrap must be boolean");
    if let Some(timeout) = profile.get("hide_after") {
        ensure!(timeout.as_f64().is_some_and(|seconds| (1.0..=60.0).contains(&seconds)),
            "TV hide_after must be 1–60 seconds");
    }
    if let Some(gain) = profile.get("audio_gain") {
        ensure!(gain.as_f64().is_some_and(|gain| (0.0..=4.0).contains(&gain)),
            "TV audio_gain must be 0–4");
    }
    if let Some(volume) = profile.get("master_volume") {
        ensure!(volume.as_f64().is_some_and(|value| (0.0..=4.0).contains(&value)),
            "TV master_volume must be 0–4");
    }
    ensure!(!(profile.get("audio_gain").is_some() && profile.get("master_volume").is_some()),
        "TV audio_gain and master_volume cannot both be set");
    if let Some(control) = profile.get("volume_control") {
        ensure!(control.is_boolean(), "TV volume_control must be boolean");
    }
    if let Some(initial) = profile.get("initial_focus") {
        name(initial, "TV initial_focus")?;
    }
    let summary = profile["summary"].as_array().context("TV summary must be a list")?;
    ensure!(summary.len() <= 3, "TV summary supports up to three items");
    for item in summary {
        let item = item.as_object().context("TV summary item must be an object")?;
        fields(item, &["path", "label"], "TV summary")?;
        state_path(item.get("path").unwrap_or(&Json::Null), logic, "TV summary path")?;
        label(item.get("label").unwrap_or(&Json::Null), "TV summary label")?;
    }
    let modes = profile["modes"].as_array().context("TV modes must be a list")?;
    ensure!(modes.len() <= 2, "TV supports up to two modes");
    let mut ids = HashSet::new();
    for mode in modes {
        let mode = mode.as_object().context("TV mode must be an object")?;
        fields(mode, &["id", "label", "kind", "action", "groups", "targets", "bounds"], "TV mode")?;
        let id = name(mode.get("id").unwrap_or(&Json::Null), "TV mode id")?;
        ensure!(id != "volume" || profile["volume_control"] != true,
            "TV mode id volume is reserved when volume_control is enabled");
        ensure!(ids.insert(id), "Duplicate TV mode id");
        label(mode.get("label").unwrap_or(&Json::Null), "TV mode label")?;
        let action = name(mode.get("action").unwrap_or(&Json::Null), "TV mode action")?;
        ensure!(logic.actions.contains_key(&action), "TV mode references unknown action {action}");
        match mode.get("kind").and_then(Json::as_str) {
            Some("action") => {
                ensure!(!mode.contains_key("groups") && !mode.contains_key("targets"),
                    "TV action mode cannot have groups or targets");
                if let Some(bounds) = mode.get("bounds") {
                    let bounds = bounds.as_object().context("TV bounds must be an object")?;
                    fields(bounds, &["origin", "extent", "scale"], "TV bounds")?;
                    vector(bounds.get("origin").unwrap_or(&Json::Null), "TV bounds origin", false)?;
                    vector(bounds.get("extent").unwrap_or(&Json::Null), "TV bounds extent", true)?;
                    if let Some(scale) = bounds.get("scale") { state_path(scale, logic, "TV bounds scale")?; }
                }
            }
            Some("cycle") => {
                ensure!(!mode.contains_key("bounds"), "TV cycle mode cannot have bounds");
                let groups = mode.get("groups").and_then(Json::as_array).context("TV cycle needs groups")?;
                ensure!(!groups.is_empty() && groups.len() <= 8, "TV cycle needs 1–8 groups");
                for group in groups { state_path(group, logic, "TV cycle group")?; }
                state_path(mode.get("targets").unwrap_or(&Json::Null), logic, "TV cycle targets")?;
            }
            _ => anyhow::bail!("TV mode kind must be action or cycle"),
        }
    }
    Ok(Some(profile))
}

/// Result of checking a compiled game against the Apple TV runtime's supported features.
#[derive(Debug, Default, PartialEq)]
pub struct SupportReport {
    pub unsupported: Vec<String>,
    pub warnings: Vec<String>,
}

fn present(config: &Json, key: &str) -> bool {
    match config.get(key) {
        None | Some(Json::Null) => false,
        Some(Json::Object(map)) => !map.is_empty(),
        Some(Json::Array(items)) => !items.is_empty(),
        Some(_) => true,
    }
}

/// Static checks only. The native runtime still rejects dynamic features such as
/// tethers and camera poses when a scene first uses them.
pub fn support_report(config: &Json) -> SupportReport {
    let mut report = SupportReport::default();
    if !present(config, "world") {
        report.unsupported.push("needs a voxel world (`world = <name>` on @Scene); flat grid maps are not supported".into());
    }
    if present(config, "weapon") {
        report.unsupported.push("viewmodel weapons are not supported".into());
    }
    if present(config, "titleScene") {
        report.unsupported.push("title scenes are not supported".into());
    }
    if present(config, "sprites") {
        report.unsupported.push("sprites are not supported; use block models".into());
    }
    if present(config, "sideMaps") {
        report.unsupported.push("side-map backdrops are not supported".into());
    }
    if !present(config, "tv") {
        report.warnings.push(
            "no @TV section: the Siri Remote can only reach HUD buttons; add `tv = <name>` to @Scene to declare focus, summary and modes"
                .into(),
        );
    }
    if !present(config, "persistence") {
        report.warnings.push("no `persistence` on @Scene: progress will not be saved between launches".into());
    }
    report
}
