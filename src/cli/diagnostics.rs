//! Source locations for developer reports. Locations use one-based Unicode columns.
use serde::Serialize;
use std::path::Path;

#[derive(Clone, Debug, Serialize)]
pub struct SourceLocation {
    pub file: String,
    pub line: usize,
    pub column: usize,
    pub source: String,
}

pub fn locate(
    file: Option<&str>,
    section: &str,
    statement: Option<&str>,
) -> Option<SourceLocation> {
    let file = file?;
    let source = std::fs::read_to_string(file).ok()?;
    let wanted = section.trim_start_matches('@');
    let mut inside = false;
    let mut header = None;
    for (index, line) in source.lines().enumerate() {
        if let Some(path) = line.strip_prefix('@') {
            inside = path.split('/').map(str::trim).collect::<Vec<_>>().join("/") == wanted;
            if inside {
                header = Some((index, line));
            }
        }
        if inside && statement.is_some_and(|s| line.trim() == s.trim()) {
            return Some(location(file, index, line));
        }
    }
    header.map(|(index, line)| location(file, index, line))
}

fn location(file: &str, index: usize, line: &str) -> SourceLocation {
    SourceLocation {
        file: file.into(),
        line: index + 1,
        column: line.chars().take_while(|c| c.is_whitespace()).count() + 1,
        source: line.into(),
    }
}

pub fn render(location: &SourceLocation) -> String {
    format!(
        "{}:{}:{}\n  {}\n  {}^",
        Path::new(&location.file).display(),
        location.line,
        location.column,
        location.source,
        " ".repeat(location.column - 1)
    )
}

static JSON_LINES: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
pub fn set_json_lines() {
    JSON_LINES.store(true, std::sync::atomic::Ordering::Relaxed);
}

pub fn emit(mut report: serde_json::Value) -> anyhow::Result<()> {
    report["schema_version"] = 1.into();
    if JSON_LINES.load(std::sync::atomic::Ordering::Relaxed) {
        if report.get("event").is_none() {
            report["event"] = "run".into();
        }
        println!("{}", serde_json::to_string(&report)?);
    } else {
        println!("{}", serde_json::to_string_pretty(&report)?);
    }
    Ok(())
}
