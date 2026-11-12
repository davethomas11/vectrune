//! Conservative, semantics-checked Rune formatting. View/style/raw blocks stay verbatim.
use anyhow::{Context, Result};
use clap::ArgMatches;
use std::path::Path;

pub fn format_source(source: &str) -> String {
    let newline = if source
        .find('\n')
        .is_some_and(|index| index > 0 && source.as_bytes()[index - 1] == b'\r')
    {
        "\r\n"
    } else {
        "\n"
    };
    let mut output = String::new();
    let mut run_block = false;
    let mut levels = Vec::new();
    let mut raw = false;
    for line in source.lines() {
        if line.starts_with('@') {
            raw = false;
            run_block = false;
            output.push('@');
            output.push_str(
                &line[1..]
                    .split('/')
                    .map(str::trim)
                    .collect::<Vec<_>>()
                    .join("/"),
            );
        } else if raw {
            output.push_str(line);
            if line.is_empty() {
                raw = false;
            }
        } else if line.trim().is_empty() {
            output.push_str(line);
        } else if !line.starts_with(char::is_whitespace) {
            let trimmed = line.trim_end();
            run_block = matches!(trimmed, "run:" | "setup:" | "teardown:");
            levels.clear();
            raw = trimmed.ends_with('>');
            if !trimmed.starts_with('#') {
                if let Some(index) = assignment(trimmed) {
                    output.push_str(trimmed[..index].trim());
                    output.push_str(" = ");
                    output.push_str(trimmed[index + 1..].trim());
                } else {
                    output.push_str(trimmed);
                }
            } else {
                output.push_str(line);
            }
        } else if run_block {
            let indent = line.chars().take_while(|c| c.is_whitespace()).count();
            while levels.last().is_some_and(|last| *last > indent) {
                levels.pop();
            }
            if levels.last() != Some(&indent) {
                levels.push(indent);
            }
            output.push_str(&"    ".repeat(levels.len()));
            output.push_str(line.trim_start());
        } else {
            // Rune-Web, CSS, object blocks, and embedded source retain their exact contents.
            output.push_str(line);
        }
        output.push_str(newline);
    }
    output
}

fn assignment(line: &str) -> Option<usize> {
    let mut quoted = false;
    let mut escaped = false;
    for (i, ch) in line.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if quoted && ch == '\\' {
            escaped = true;
            continue;
        }
        if ch == '"' {
            quoted = !quoted;
        }
        if !quoted && ch == '=' {
            return Some(i);
        }
    }
    None
}

pub fn run(path: &Path, args: &ArgMatches) -> Result<bool> {
    let files = super::developer::project_files(path)?;
    let mut changes = Vec::new();
    // Prepare and validate every result before writing any file.
    for file in files {
        let source = std::fs::read_to_string(&file)?;
        let formatted = format_source(&source);
        if source == formatted {
            continue;
        }
        let base = file.parent().unwrap();
        let loader = if crate::rune_parser::is_test_source(&file) {
            crate::rune_parser::load_rune_test_document_from_str_with_base
        } else {
            crate::rune_parser::load_rune_document_from_str_with_base
        };
        let before = loader(&source, base, &file.to_string_lossy())?;
        let after = loader(&formatted, base, &file.to_string_lossy())?;
        anyhow::ensure!(
            serde_json::to_value(before)? == serde_json::to_value(after)?,
            "Refusing to change meaning while formatting {}",
            file.display()
        );
        changes.push((file, formatted));
    }
    let check = args.get_flag("check");
    if !check {
        for (file, formatted) in &changes {
            std::fs::write(file, formatted).with_context(|| format!("write {}", file.display()))?;
        }
    }
    let paths = changes.iter().map(|(file, _)| file).collect::<Vec<_>>();
    let success = !check || paths.is_empty();
    if args.get_flag("json") {
        super::diagnostics::emit(
            serde_json::json!({"command":"fmt","success":success,"check":check,"changed":paths}),
        )?;
    } else {
        for path in paths {
            println!(
                "{} {}",
                if check { "Would format" } else { "Formatted" },
                path.display()
            );
        }
        println!(
            "{}",
            if success {
                "Formatting check passed"
            } else {
                "Run vectrune fmt to apply formatting"
            }
        );
    }
    Ok(success)
}
