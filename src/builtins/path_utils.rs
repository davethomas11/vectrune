use std::path::{Path, PathBuf};

pub fn candidate_paths(filename: &str, rune_dir: &Path) -> Vec<PathBuf> {
    let provided = Path::new(filename);
    if provided.is_absolute() {
        return vec![provided.to_path_buf()];
    }

    let mut paths = Vec::new();
    paths.push(rune_dir.join(provided));

    if let Ok(cwd) = std::env::current_dir() {
        let fallback = cwd.join(provided);
        if paths.first().map(|p| p != &fallback).unwrap_or(true) {
            paths.push(fallback);
        }
    }

    paths
}

pub fn resolve_write_path(filename: &str, rune_dir: &Path) -> PathBuf {
    let provided = Path::new(filename);
    if provided.is_absolute() {
        provided.to_path_buf()
    } else {
        rune_dir.join(provided)
    }
}
