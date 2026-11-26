use crate::{
    apps::rune_web::{ast::MusicDefinition, parser::parse_music_section},
    rune_ast::RuneDocument,
};
use anyhow::{ensure, Context, Result};
use std::collections::HashMap;

pub(super) fn compile(doc: &RuneDocument) -> Result<HashMap<String, MusicDefinition>> {
    let mut music = HashMap::new();
    for section in doc
        .sections
        .iter()
        .filter(|s| s.path.first().map(String::as_str) == Some("AsciiMusic"))
    {
        ensure!(section.path.len() == 2, "Expected @AsciiMusic/<name>");
        for key in section.kv.keys().chain(section.series.keys()) {
            ensure!(
                !matches!(
                    key.as_str(),
                    "effects"
                        | "track_effects"
                        | "reverb"
                        | "delay"
                        | "filter"
                        | "crush"
                        | "drive"
                        | "chorus"
                        | "sections"
                        | "arrangement"
                ),
                "AsciiMusic does not support effects or arrangements: {key}"
            );
        }
        for (key, value) in &section.kv {
            if !matches!(
                key.as_str(),
                "tempo"
                    | "bpm"
                    | "volume"
                    | "bars"
                    | "measures"
                    | "loop"
                    | "loop_track"
                    | "instruments"
            ) {
                ensure!(
                    value.as_str().is_some(),
                    "AsciiMusic {key} must be a string"
                );
            }
        }
        for (key, values) in &section.series {
            ensure!(
                values.iter().all(|value| value.as_str().is_some()),
                "AsciiMusic {key} must contain note strings"
            );
        }
        for aliases in [["tempo", "bpm"], ["volume", "volume"], ["bars", "measures"]] {
            if let Some(value) = section
                .kv
                .get(aliases[0])
                .or_else(|| section.kv.get(aliases[1]))
            {
                let value = super::value_json(value);
                let value = value
                    .as_f64()
                    .with_context(|| format!("AsciiMusic {} must be numeric", aliases[0]))?;
                let valid = match aliases[0] {
                    "tempo" => (21.0..=399.0).contains(&value),
                    "volume" => (0.0..=0.5).contains(&value),
                    _ => value.fract() == 0.0 && (1.0..=64.0).contains(&value),
                };
                ensure!(valid, "Invalid AsciiMusic {}", aliases[0]);
            }
        }
        for key in ["loop", "loop_track"] {
            if let Some(value) = section.kv.get(key) {
                ensure!(
                    super::value_json(value).is_boolean(),
                    "AsciiMusic {key} must be boolean"
                );
            }
        }
        let definition =
            parse_music_section(section).map_err(|e| anyhow::anyhow!(e.to_string()))?;
        ensure!(
            matches!(
                definition.music_type.as_str(),
                "8bit" | "chiptune" | "synth"
            ),
            "Unknown AsciiMusic type"
        );
        ensure!(
            definition
                .time_signature
                .as_deref()
                .is_none_or(|s| matches!(s, "4/4" | "3/4")),
            "AsciiMusic meter must be 4/4 or 3/4"
        );
        ensure!(
            definition.tracks.len() <= 5,
            "AsciiMusic supports at most eight channels"
        );
        let serialized = serde_json::to_string(&definition)?;
        ensure!(
            serialized.len() <= 64 * 1024,
            "AsciiMusic score exceeds 64 KiB"
        );
        let name = section.path[1].to_lowercase();
        ensure!(
            music.insert(name, definition).is_none(),
            "Duplicate ASCII music"
        );
        ensure!(
            music.len() <= 32,
            "At most 32 AsciiMusic scores may be declared"
        );
    }
    Ok(music)
}
