//! Additive, device-independent game controls. Legacy scenes emit no profile.
use crate::rune_ast::{RuneDocument, Section, Value};
use anyhow::{bail, ensure, Context, Result};
use serde_json::{json, Map, Value as Json};

fn value(v: &Value) -> Json {
    match v {
        Value::String(s) => serde_json::from_str(s).unwrap_or_else(|_| json!(s)),
        _ => v.to_json(),
    }
}
fn mapping(section: &Section, key: &str) -> Result<Map<String, Json>> {
    let mut result = Map::new();
    if let Some(v) = section.kv.get(key) {
        result = value(v)
            .as_object()
            .context(format!("Controls {key} must be an object"))?
            .clone();
    }
    if let Some(rows) = section.series.get(key) {
        for row in rows {
            let row = row.as_str().context("Controls mappings must be text")?;
            let (code, target) = row
                .split_once("->")
                .context(format!("Expected {key}: code -> input"))?;
            let code = code.trim();
            let target = target.trim();
            ensure!(
                !code.is_empty() && !target.is_empty(),
                "Empty controls mapping"
            );
            result.insert(
                code.into(),
                serde_json::from_str(target).unwrap_or_else(|_| json!(target)),
            );
        }
    }
    Ok(result)
}
fn input(v: &Json) -> bool {
    v.as_str()
        .is_some_and(|s| !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'))
}
fn fields(v: &Json, allowed: &[&str], label: &str) -> Result<()> {
    let object = v
        .as_object()
        .context(format!("{label} must be an object"))?;
    for key in object.keys() {
        ensure!(
            allowed.contains(&key.as_str()),
            "Unknown {label} field: {key}"
        );
    }
    Ok(())
}
fn visibility(v: &Json) -> Result<()> {
    if let Some(path) = v.get("visible") {
        ensure!(path.as_str().is_some_and(|s| s.split('.').all(|part| input(&json!(part)))),
            "Touch visible must name a boolean state path");
    }
    Ok(())
}
fn number(v: &Json, key: &str, min: f64, max: f64) -> Result<()> {
    if let Some(n) = v.get(key) {
        ensure!(
            n.as_f64()
                .is_some_and(|n| n.is_finite() && n >= min && n <= max),
            "Controls {key} must be {min}–{max}"
        );
    }
    Ok(())
}
fn validate(profile: &Json) -> Result<()> {
    ensure!(
        profile["keys"]["Escape"].is_null() && profile["commands"]["Escape"].is_null(),
        "Escape is reserved for the presentation host"
    );

    for device in ["keys", "mouse", "gamepad"] {
        for (code, binding) in profile[device].as_object().unwrap() {
            ensure!(!code.is_empty(), "Empty controls code");
            if device == "mouse" {
                ensure!(
                    [
                        "Left", "Middle", "Right", "Back", "Forward", "MoveX", "MoveY", "WheelX",
                        "WheelY"
                    ]
                    .contains(&code.as_str()),
                    "Unknown mouse control: {code}"
                );
            }
            if device == "gamepad" {
                let suffix = code
                    .strip_prefix("Button")
                    .or_else(|| code.strip_prefix("Axis"))
                    .context(format!("Unknown gamepad control: {code}"))?;
                let digits = suffix
                    .strip_suffix('+')
                    .or_else(|| suffix.strip_suffix('-'))
                    .unwrap_or(suffix);
                ensure!(
                    !digits.is_empty()
                        && digits.chars().all(|c| c.is_ascii_digit())
                        && digits.parse::<usize>().is_ok_and(|n| n < 128)
                        && (!code.starts_with("Button") || digits == suffix),
                    "Invalid gamepad control: {code}"
                );
            }
            if binding.is_null() {
                continue;
            }
            if binding.is_string() {
                ensure!(input(binding), "Invalid input name for {code}");
                continue;
            }
            fields(
                binding,
                &[
                    "input",
                    "command",
                    "mode",
                    "scale",
                    "invert",
                    "deadzone",
                    "threshold",
                ],
                "binding",
            )?;
            ensure!(
                input(&binding["input"])
                    ^ binding["command"].as_str().is_some_and(|s| !s.is_empty()),
                "Binding {code} needs exactly one input or command"
            );
            if let Some(mode) = binding.get("mode") {
                ensure!(
                    matches!(mode.as_str(), Some("button" | "value" | "delta" | "rate")),
                    "Unknown controls mode for {code}"
                );
            }
            if let Some(invert) = binding.get("invert") {
                ensure!(invert.is_boolean(), "Controls invert must be boolean");
            }
            number(binding, "scale", -100000., 100000.)?;
            number(binding, "deadzone", 0., 0.99)?;
            number(binding, "threshold", 0., 1.)?;
        }
    }
    let commands = profile["commands"].as_object().unwrap().values().chain(
        ["keys", "mouse", "gamepad"].iter().flat_map(|device| {
            profile[device]
                .as_object()
                .unwrap()
                .values()
                .filter_map(|v| v.get("command"))
        }),
    );
    for command in commands {
        ensure!(
            command.is_null() || command.as_str().is_some_and(|s| !s.is_empty()),
            "Controls commands must name actions or host commands"
        );
        if let Some(s) = command.as_str().filter(|s| s.starts_with("host.")) {
            ensure!(
                [
                    "host.start",
                    "host.advance",
                    "host.pause",
                    "host.mute",
                    "host.fullscreen"
                ]
                .contains(&s),
                "Unknown host command: {s}"
            );
        }
    }
    if let Some(touch) = profile.get("touch").filter(|v| !v.is_null()) {
        fields(touch, &["enabled", "joystick", "look", "buttons", "visible"], "touch")?;
        visibility(touch)?;
        if let Some(enabled) = touch.get("enabled") {
            ensure!(enabled.is_boolean(), "Touch enabled must be boolean");
        }
        if let Some(stick) = touch.get("joystick") {
            fields(
                stick,
                &[
                    "x", "y", "left", "right", "up", "down", "deadzone", "size", "anchor", "visible",
                ],
                "joystick",
            )?;
            visibility(stick)?;
            for key in ["x", "y", "left", "right", "up", "down"] {
                if let Some(v) = stick.get(key) {
                    ensure!(input(v), "Invalid joystick {key} input");
                }
            }
            ensure!(
                ["x", "y", "left", "right", "up", "down"]
                    .iter()
                    .any(|key| stick.get(key).is_some()),
                "Joystick needs input mappings"
            );
            number(stick, "deadzone", 0., 0.99)?;
            number(stick, "size", 44., 200.)?;
            if let Some(anchor) = stick.get("anchor") {
                ensure!(
                    matches!(anchor.as_str(), Some("bottom-left" | "bottom-right")),
                    "Joystick anchor must be bottom-left or bottom-right"
                );
            }
        }
        if let Some(look) = touch.get("look") {
            fields(look, &["x", "y", "sensitivity"], "touch look")?;
            ensure!(input(&look["x"]), "Touch look needs an x input");
            if let Some(y) = look.get("y") {
                ensure!(input(y), "Touch look y must name an input");
            }
            number(look, "sensitivity", -100., 100.)?;
        }
        if let Some(buttons) = touch.get("buttons") {
            let buttons = buttons.as_array().context("Touch buttons must be a list")?;
            let mut ids = std::collections::HashSet::new();
            for button in buttons {
                fields(
                    button,
                    &[
                        "id",
                        "input",
                        "command",
                        "label",
                        "aria_label",
                        "anchor",
                        "offset",
                        "size",
                        "drag_x",
                        "visible",
                    ],
                    "touch button",
                )?;
                visibility(button)?;
                ensure!(
                    input(&button["id"]) && ids.insert(button["id"].as_str().unwrap()),
                    "Touch button needs a unique id"
                );
                ensure!(
                    input(&button["input"])
                        ^ button["command"].as_str().is_some_and(|s| !s.is_empty()),
                    "Touch button needs exactly one input or command"
                );
                ensure!(
                    button["label"].as_str().is_some_and(|s| !s.is_empty()),
                    "Touch button needs a label"
                );
                if let Some(label) = button.get("aria_label") {
                    ensure!(label.is_string(), "Touch aria_label must be text");
                }
                if let Some(v) = button.get("drag_x") {
                    ensure!(input(v), "Invalid touch drag input");
                }
                if let Some(anchor) = button.get("anchor") {
                    ensure!(
                        matches!(
                            anchor.as_str(),
                            Some("bottom-left" | "bottom-right" | "top-left" | "top-right")
                        ),
                        "Invalid touch button anchor"
                    );
                }
                number(button, "size", 44., 200.)?;
                if let Some(offset) = button.get("offset") {
                    ensure!(
                        offset.as_array().is_some_and(|a| a.len() == 2
                            && a.iter()
                                .all(|n| n.as_f64().is_some_and(|n| (0.0..=2048.0).contains(&n)))),
                        "Touch offset must be [horizontal, vertical] pixels"
                    );
                }
            }
        }
    }
    if let Some(buttons) = profile["touch"]["buttons"].as_array() {
        for button in buttons {
            if let Some(command) = button["command"]
                .as_str()
                .filter(|s| s.starts_with("host."))
            {
                ensure!(
                    [
                        "host.start",
                        "host.advance",
                        "host.pause",
                        "host.mute",
                        "host.fullscreen"
                    ]
                    .contains(&command),
                    "Unknown touch host command: {command}"
                );
            }
        }
    }
    let mut channels = std::collections::HashMap::new();
    let mut channel = |name: &str, numeric: bool| -> Result<()> {
        if let Some(previous) = channels.insert(name.to_owned(), numeric) {
            ensure!(previous == numeric, "Input {name} mixes boolean and numeric bindings; use distinct inputs or explicit modes");
        }
        Ok(())
    };
    for device in ["keys", "mouse", "gamepad"] {
        for (code, binding) in profile[device].as_object().unwrap() {
            let Some(name) = binding.as_str().or_else(|| binding["input"].as_str()) else {
                continue;
            };
            let default_numeric = device == "mouse"
                && (code.starts_with("Move") || code.starts_with("Wheel"))
                || device == "gamepad" && code.starts_with("Axis") && !code.ends_with(['+', '-']);
            let numeric = binding["mode"]
                .as_str()
                .map(|s| s != "button")
                .unwrap_or(default_numeric);
            channel(name, numeric)?;
        }
    }
    if let Some(stick) = profile["touch"].get("joystick") {
        for key in ["x", "y", "left", "right", "up", "down"] {
            if let Some(name) = stick[key].as_str() {
                channel(name, key == "x" || key == "y")?;
            }
        }
    }
    for key in ["x", "y"] {
        if let Some(name) = profile["touch"]["look"][key].as_str() {
            channel(name, true)?;
        }
    }
    if let Some(buttons) = profile["touch"]["buttons"].as_array() {
        for button in buttons {
            if let Some(name) = button["input"].as_str() {
                channel(name, false)?;
            }
            if let Some(name) = button["drag_x"].as_str() {
                channel(name, true)?;
            }
        }
    }
    Ok(())
}
fn resolve(doc: &RuneDocument, name: &str, stack: &mut Vec<String>) -> Result<Json> {
    ensure!(
        !stack.iter().any(|s| s == name),
        "Controls inheritance cycle: {} -> {name}",
        stack.join(" -> ")
    );
    ensure!(stack.len() < 64, "Controls inheritance exceeds 64 profiles");
    stack.push(name.into());
    let section = doc
        .sections
        .iter()
        .find(|s| s.path == ["Controls", name])
        .context(format!("Unknown @Controls/{name}"))?;
    for key in section.kv.keys().chain(section.series.keys()) {
        ensure!(
            ["extends", "keys", "commands", "mouse", "gamepad", "touch"].contains(&key.as_str()),
            "Unknown @Controls/{name} field: {key}"
        );
    }
    ensure!(
        !section.series.contains_key("touch") && !section.series.contains_key("extends"),
        "Controls touch and extends use = assignments"
    );
    let mut result = if let Some(parent) = section.kv.get("extends") {
        resolve(
            doc,
            parent
                .as_str()
                .context("Controls extends needs a profile name")?,
            stack,
        )?
    } else {
        json!({"version":1,"keys":{},"commands":{},"mouse":{},"gamepad":{}})
    };
    for key in ["keys", "commands", "mouse", "gamepad"] {
        result[key]
            .as_object_mut()
            .unwrap()
            .extend(mapping(section, key)?);
    }
    if let Some(touch) = section.kv.get("touch") {
        result["touch"] = value(touch);
    }
    result["name"] = json!(name);
    stack.pop();
    Ok(result)
}

pub fn compile(doc: &RuneDocument, scene: &Section) -> Result<Option<Json>> {
    let Some(name) = scene.kv.get("controls") else {
        return Ok(None);
    };
    let name = name
        .as_str()
        .context("Scene controls must name an @Controls profile")?;
    let mut profile = resolve(doc, name, &mut vec![])?;
    // Preserve scene mappings while allowing a profile to override or explicitly unbind them.
    for key in ["keys", "commands"] {
        let mut base = mapping(scene, key)?;
        base.extend(profile[key].as_object().unwrap().clone());
        profile[key] = json!(base);
    }
    validate(&profile).with_context(|| format!("Invalid @Controls/{name}"))?;
    Ok(Some(profile))
}

pub fn validate_actions(profile: &Json, actions: impl Fn(&str) -> bool) -> Result<()> {
    let commands = profile["commands"].as_object().unwrap().values().chain(
        ["keys", "mouse", "gamepad"].iter().flat_map(|device| {
            profile[device]
                .as_object()
                .unwrap()
                .values()
                .filter_map(|v| v.get("command"))
        }),
    );
    let touch_commands = profile["touch"]["buttons"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|button| button.get("command"));
    for action in commands.chain(touch_commands).filter_map(Json::as_str) {
        if action == "host.advance" {
            ensure!(
                actions("advance"),
                "host.advance needs a game action named advance"
            );
        }
        if !action.starts_with("host.") && !actions(action) {
            bail!("Controls command names unknown action: {action}");
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn doc(source: &str) -> RuneDocument {
        crate::rune_parser::parse_rune(source).unwrap()
    }
    #[test]
    fn legacy_and_inheritance() {
        let d = doc("@Scene/game\nkeys = {\"Space\":\"fire\"}\n@Controls/base\nkeys:\n    KeyW -> forward\nmouse:\n    Left -> fire\n@Controls/custom\nextends = base\nkeys:\n    KeyW -> null\n    KeyZ -> forward\n");
        assert!(compile(&d, &d.sections[0]).unwrap().is_none());
        let mut scene = d.sections[0].clone();
        scene
            .kv
            .insert("controls".into(), Value::String("custom".into()));
        let p = compile(&d, &scene).unwrap().unwrap();
        assert_eq!(p["keys"]["Space"], "fire");
        assert_eq!(p["keys"]["KeyZ"], "forward");
        assert!(p["keys"]["KeyW"].is_null());
        assert_eq!(p["mouse"]["Left"], "fire");
    }
    #[test]
    fn bad_profiles_fail_early() {
        for body in [
            "extends = test",
            r#"mouse = {"Typo":"fire"}"#,
            r#"gamepad = {"Axis0":{"input":"move_x","deadzone":1}}"#,
            r#"keys = {"KeyA":{"input":"left","mode":"typo"}}"#,
            r#"touch = {"buttons":[{"id":"fire","input":"fire","label":"Fire","size":12}]}"#,
            "keys = {\"KeyW\":\"move_y\"}\ngamepad = {\"Axis1\":\"move_y\"}",
            r#"keys = {"KeyP":{"input":"fire","command":"host.pause"}}"#,
            r#"keys = {"Escape":"fire"}"#,
            "touch:\n    look -> look_x",
        ] {
            let d = doc(&format!(
                "@Scene/game\ncontrols = test\n@Controls/test\n{body}\n"
            ));
            assert!(compile(&d, &d.sections[0]).is_err(), "{body}");
        }
    }
    #[test]
    fn touch_visibility_accepts_state_paths_and_rejects_non_paths() {
        let source = "@Scene/game\ncontrols = test\n@Controls/test\ntouch = {\"visible\":\"touch.ready\",\"joystick\":{\"x\":\"move_x\",\"visible\":\"exploring\"},\"buttons\":[{\"id\":\"guard\",\"input\":\"guard\",\"label\":\"Guard\",\"visible\":\"enemy_turn\"}]}\n";
        let d = doc(source);
        let profile = compile(&d, &d.sections[0]).unwrap().unwrap();
        assert_eq!(profile["touch"]["visible"], "touch.ready");
        assert_eq!(profile["touch"]["joystick"]["visible"], "exploring");
        assert_eq!(profile["touch"]["buttons"][0]["visible"], "enemy_turn");
        for invalid in ["true", "\"\"", "\"touch..ready\"", "\"a + b\""] {
            for path in ["\"touch.ready\"", "\"exploring\"", "\"enemy_turn\""] {
                let d = doc(&source.replace(path, invalid));
                assert!(compile(&d, &d.sections[0]).is_err());
            }
        }
    }

    #[test]
    fn touch_vertical_look_is_optional_and_numeric() {
        let source = "@Scene/game\ncontrols = test\n@Controls/test\ntouch = {\"look\":{\"x\":\"look_x\",\"y\":\"look_y\",\"sensitivity\":1}}\n";
        let d = doc(source);
        assert_eq!(
            compile(&d, &d.sections[0]).unwrap().unwrap()["touch"]["look"]["y"],
            "look_y"
        );
        for body in [
            source.replace("\"y\":\"look_y\"", "\"y\":false"),
            format!("{source}keys = {{\"KeyY\":\"look_y\"}}\n"),
        ] {
            let d = doc(&body);
            assert!(compile(&d, &d.sections[0]).is_err());
        }
    }
}
