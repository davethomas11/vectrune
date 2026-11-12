//! Content-based watching also works on network filesystems and with editor atomic saves.
use anyhow::Result;
use clap::ArgMatches;
use std::{
    collections::{BTreeMap, HashSet},
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    time::Duration,
};

fn ignored(entry: &walkdir::DirEntry) -> bool {
    entry.depth() > 0
        && entry.file_type().is_dir()
        && matches!(
            entry.file_name().to_str(),
            Some("target" | "node_modules" | ".git" | ".venv" | "_site" | "dist" | "build")
        )
}

fn inputs(path: &Path, seen: &mut HashSet<PathBuf>) {
    if path.is_dir() {
        let directory = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        if !seen.insert(directory) {
            return;
        }
        for entry in walkdir::WalkDir::new(path)
            .into_iter()
            .filter_entry(|e| !ignored(e))
            .filter_map(Result::ok)
        {
            if entry.file_type().is_file()
                && matches!(
                    entry.path().extension().and_then(|s| s.to_str()),
                    Some("rune" | "json" | "yaml" | "yml" | "csv")
                )
            {
                inputs(entry.path(), seen);
            }
        }
        return;
    }
    let path = if !path.exists() && path.extension().is_none() {
        path.with_extension("rune")
    } else {
        path.to_path_buf()
    };
    let path = path.canonicalize().unwrap_or(path);
    if !seen.insert(path.clone()) {
        return;
    }
    if path.extension().and_then(|s| s.to_str()) == Some("rune") {
        if let Ok(source) = std::fs::read_to_string(&path) {
            for line in source.lines() {
                if let Some(import) = line.trim().strip_prefix("import ") {
                    let import = import.trim();
                    if import.starts_with('"') && import.ends_with('"') {
                        inputs(
                            &path
                                .parent()
                                .unwrap_or(Path::new("."))
                                .join(&import[1..import.len() - 1]),
                            seen,
                        );
                    }
                }
            }
        }
    }
}

pub fn snapshot(path: &Path) -> BTreeMap<PathBuf, Option<u64>> {
    let mut files = HashSet::new();
    // Watch sibling fixtures when the entry is a file as well as its external imports.
    inputs(
        if path.is_dir() {
            path
        } else {
            path.parent()
                .filter(|p| !p.as_os_str().is_empty())
                .unwrap_or(Path::new("."))
        },
        &mut files,
    );
    inputs(path, &mut files);
    if let Ok(doc) = super::developer::load_project(path) {
        for section in &doc.sections {
            if section.path.first().map(String::as_str) == Some("Memory") {
                if let Some(source) = section.kv.get("source").and_then(|v| v.as_str()) {
                    let source = PathBuf::from(source);
                    let base = if path.is_dir() {
                        path
                    } else {
                        path.parent().unwrap_or(Path::new("."))
                    };
                    files.insert(if source.exists() {
                        source
                    } else {
                        base.join(source)
                    });
                }
            }
        }
    }
    files
        .into_iter()
        .map(|file| {
            let hash = std::fs::read(&file).ok().map(|content| {
                let mut hasher = std::collections::hash_map::DefaultHasher::new();
                content.hash(&mut hasher);
                hasher.finish()
            });
            (file, hash)
        })
        .collect()
}

pub async fn run(path: &Path, args: &ArgMatches) -> Result<bool> {
    let json = args.get_flag("json");
    if json {
        super::diagnostics::set_json_lines();
    }
    let mut previous = snapshot(path);
    let mut success;
    loop {
        success = tokio::select! {
            result = super::developer::run_once("test", args, path) => match result {
                Ok(success) => success,
                Err(error) => {
                    if json { super::diagnostics::emit(serde_json::json!({"command":"test","success":false,"error":error.to_string()}))?; }
                    else { eprintln!("{error:#}"); }
                    false
                }
            },
            signal = tokio::signal::ctrl_c() => { signal?; return Ok(false); }
        };
        if json {
            super::diagnostics::emit(
                serde_json::json!({"command":"test","event":"watching","success":success}),
            )?;
        } else {
            println!("Watching source and fixtures. Edit a file to rerun; Ctrl-C exits.");
        }
        // Keep the pre-run snapshot so edits made during a run trigger another run.
        loop {
            tokio::select! {
                signal = tokio::signal::ctrl_c() => { signal?; return Ok(success); }
                _ = tokio::time::sleep(Duration::from_millis(200)) => {}
            }
            let current = snapshot(path);
            if current != previous {
                // Wait until a burst of edits settles, without delaying Ctrl-C.
                previous = current;
                tokio::select! {
                    signal = tokio::signal::ctrl_c() => { signal?; return Ok(success); }
                    _ = tokio::time::sleep(Duration::from_millis(200)) => {}
                }
                let current = snapshot(path);
                if current != previous {
                    previous = current;
                    continue;
                }
                break;
            }
        }
    }
}
