//! Conservative, semantics-checked Rune formatting. View/style/raw blocks stay verbatim.
use anyhow::{Context, Result};
use clap::ArgMatches;
use std::path::Path;

pub fn format_source(source: &str, line_width: usize) -> String {
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
    let mut lines = source.lines().peekable();
    while let Some(line) = lines.next() {
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
                    let mut value = trimmed[index + 1..].trim().to_string();
                    if value.starts_with('{') {
                        while serde_json::from_str::<serde_json::Value>(&value)
                            .is_err_and(|error| error.is_eof())
                        {
                            let Some(next) = lines.peek().filter(|line| !line.starts_with('@'))
                            else {
                                break;
                            };
                            value.push_str(newline);
                            value.push_str(next.trim_end());
                            lines.next();
                        }
                    }
                    let prefix_width = trimmed[..index].trim().chars().count() + 3;
                    if value.contains('\n') || prefix_width + value.chars().count() > line_width {
                        if let Ok(value @ serde_json::Value::Object(_)) =
                            serde_json::from_str::<serde_json::Value>(&value)
                        {
                            output.push_str(&format_literal(
                                &value,
                                0,
                                prefix_width,
                                line_width,
                                newline,
                            ));
                        } else {
                            output.push_str(&value);
                        }
                    } else {
                        output.push_str(&value);
                    }
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

fn format_literal(
    value: &serde_json::Value,
    indent: usize,
    prefix_width: usize,
    line_width: usize,
    newline: &str,
) -> String {
    let compact = serde_json::to_string(value).expect("JSON values are serializable");
    if prefix_width + compact.chars().count() + 1 <= line_width {
        return compact;
    }
    let (open, close, entries): (_, _, Vec<_>) = match value {
        serde_json::Value::Object(fields) => (
            '{',
            '}',
            fields
                .iter()
                .map(|(key, value)| (format!("{}: ", serde_json::to_string(key).unwrap()), value))
                .collect(),
        ),
        serde_json::Value::Array(items) => (
            '[',
            ']',
            items.iter().map(|value| (String::new(), value)).collect(),
        ),
        _ => return compact,
    };
    if entries.is_empty() {
        return compact;
    }
    let mut output = open.to_string();
    output.push_str(newline);
    for (index, (prefix, value)) in entries.iter().enumerate() {
        output.push_str(&" ".repeat(indent + 4));
        output.push_str(prefix);
        output.push_str(&format_literal(
            value,
            indent + 4,
            indent + 4 + prefix.chars().count(),
            line_width,
            newline,
        ));
        if index + 1 < entries.len() {
            output.push(',');
        }
        output.push_str(newline);
    }
    output.push_str(&" ".repeat(indent));
    output.push(close);
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

#[cfg(test)]
mod tests {
    use super::format_source;

    #[test]
    fn width_is_a_target_and_executable_and_opaque_source_stay_intact() {
        let source = concat!(
            "@Data\n",
            "value = {\"label\":\"This single string is deliberately longer than the line width\"}\n",
            "@Logic/game\n",
            "state:\n",
            "    data = {\"x\":1,\"y\":2,\"label\":\"keep this expression intact\"}\n",
            "action tick:\n",
            "    data = {\"x\":1,\"y\":2,\"label\":\"keep this expression intact\"}\n",
            "@Raw\n",
            "source >\n",
            "    data = {\"x\":1,\"y\":2,\"label\":\"keep this embedded source intact\"}\n",
            "\n",
        );
        let formatted = format_source(source, 20);
        assert!(formatted.starts_with("@Data\nvalue = {\n    \"label\": "));
        assert!(formatted.contains("This single string is deliberately longer than the line width"));
        assert_eq!(
            formatted.split("@Logic").nth(1),
            source.split("@Logic").nth(1)
        );
        assert_eq!(format_source(&formatted, 20), formatted);
    }
}

pub fn run(path: &Path, args: &ArgMatches) -> Result<bool> {
    let line_width = usize::try_from(*args.get_one::<u64>("line-width").unwrap())
        .context("line width exceeds this platform's supported size")?;
    let files = super::developer::project_files(path)?;
    let mut changes = Vec::new();
    // Prepare and validate every result before writing any file.
    for file in files {
        let source = std::fs::read_to_string(&file)?;
        let formatted = format_source(&source, line_width);
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
