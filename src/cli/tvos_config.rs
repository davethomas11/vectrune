//! `tvos.toml` project settings shared by the Apple TV commands.
use anyhow::{ensure, Context, Result};
use serde::Deserialize;
use std::path::{Path, PathBuf};

pub const FILE_NAME: &str = "tvos.toml";

#[derive(Debug, Default, Deserialize)]
#[serde(deny_unknown_fields)]
struct RawConfig {
    game: Option<String>,
    name: Option<String>,
    bundle_id: Option<String>,
    team: Option<String>,
    device: Option<String>,
    build_dir: Option<String>,
    runtime_source: Option<String>,
    runtime_libs: Option<String>,
    icon: Option<String>,
}

/// Settings from `tvos.toml`; relative paths are resolved against the file's directory.
#[derive(Debug, Default)]
pub struct TvConfig {
    pub path: Option<PathBuf>,
    pub game: Option<PathBuf>,
    pub name: Option<String>,
    pub bundle_id: Option<String>,
    pub team: Option<String>,
    pub device: Option<String>,
    pub build_dir: Option<PathBuf>,
    pub runtime_source: Option<PathBuf>,
    pub runtime_libs: Option<PathBuf>,
    pub icon: Option<PathBuf>,
}

pub fn parse(text: &str, base: &Path) -> Result<TvConfig> {
    let raw: RawConfig = toml::from_str(text).context("Invalid tvos.toml")?;
    let path = |value: Option<String>| value.map(|v| base.join(v));
    Ok(TvConfig {
        path: None,
        game: path(raw.game),
        name: raw.name,
        bundle_id: raw.bundle_id,
        team: raw.team,
        device: raw.device,
        build_dir: path(raw.build_dir),
        runtime_source: path(raw.runtime_source),
        runtime_libs: path(raw.runtime_libs),
        icon: path(raw.icon),
    })
}

fn load_file(file: &Path) -> Result<TvConfig> {
    let text = std::fs::read_to_string(file).with_context(|| format!("Cannot read {}", file.display()))?;
    let base = file.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(Path::new("."));
    let mut config = parse(&text, base).with_context(|| format!("In {}", file.display()))?;
    config.path = Some(file.to_path_buf());
    Ok(config)
}

/// Uses `explicit` when given, otherwise `tvos.toml` beside the game, then in the working directory.
pub fn load(explicit: Option<&str>, game: Option<&Path>) -> Result<TvConfig> {
    if let Some(explicit) = explicit {
        let file = Path::new(explicit);
        ensure!(file.is_file(), "Config file not found: {explicit}");
        return load_file(file);
    }
    let beside_game = game.and_then(Path::parent).map(|dir| dir.join(FILE_NAME));
    for candidate in beside_game.into_iter().chain([PathBuf::from(FILE_NAME)]) {
        if candidate.is_file() {
            return load_file(&candidate);
        }
    }
    Ok(TvConfig::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paths_are_relative_to_the_config_and_unknown_keys_fail() {
        let config = parse("game = \"a.rune\"\nteam = \"ABCDE12345\"\nbuild_dir = \"out\"\n", Path::new("/g")).unwrap();
        assert_eq!(config.game.unwrap(), Path::new("/g/a.rune"));
        assert_eq!(config.build_dir.unwrap(), Path::new("/g/out"));
        assert_eq!(config.team.as_deref(), Some("ABCDE12345"));
        assert!(parse("gam = \"a.rune\"", Path::new(".")).is_err());
    }
}
