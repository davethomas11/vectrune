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
    let mut logic = false;
    let mut lines = source.lines().peekable();
    while let Some(line) = lines.next() {
        if line.starts_with('@') {
            logic = line[1..]
                .split('/')
                .next()
                .is_some_and(|part| part.trim() == "Logic");
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
        } else if logic
            && !line.trim_start().starts_with('#')
            && !line.trim_start().starts_with("call ")
            && !line.trim_end().ends_with(':')
            && (line.contains('{')
                || assignment(line)
                    .is_some_and(|index| line[index + 1..].trim_start().starts_with('['))
                || crate::rune_parser::expression_depth(line) > 0)
        {
            let indent = line.len() - line.trim_start().len();
            let mut expression = line.trim().to_string();
            while crate::rune_parser::expression_depth(&expression) > 0 {
                if lines.peek().is_none_or(|next| next.starts_with('@')) {
                    break;
                }
                expression.push(' ');
                expression.push_str(lines.next().unwrap().trim());
            }
            output.push_str(&" ".repeat(indent));
            output.push_str(&format_expression(
                &expression,
                indent,
                indent,
                line_width,
                newline,
            ));
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

fn compact_expression(source: &str) -> String {
    let tokens = crate::rune_parser::expression_tokens(source);
    let mut result = String::new();
    let mut previous_word = false;
    let mut previous = "";
    for token in tokens {
        let word = token.starts_with(|c: char| {
            c.is_alphanumeric() || matches!(c, '_' | '$' | '"' | '\'' | '`')
        });
        if word && previous_word && !result.ends_with(' ') {
            result.push(' ');
        }
        let unary = matches!(token, "+" | "-")
            && (previous.is_empty()
                || matches!(
                    previous,
                    "(" | "[" | "{" | "," | ":" | "=" | "?" | "+" | "-" | "*" | "/"
                ));
        if matches!(
            token,
            "=" | "=="
                | "!="
                | "<="
                | ">="
                | "<"
                | ">"
                | "&&"
                | "||"
                | "?"
                | "+"
                | "-"
                | "*"
                | "/"
                | "%"
        ) && !unary
        {
            if !result.is_empty() && !result.ends_with(' ') {
                result.push(' ');
            }
            result.push_str(token);
            result.push(' ');
        } else {
            result.push_str(token);
            if token == "," || token == ":" {
                result.push(' ');
            }
        }
        previous_word = word;
        previous = token;
    }
    result.trim_end().to_string()
}

fn format_expression(
    source: &str,
    indent: usize,
    prefix: usize,
    width: usize,
    newline: &str,
) -> String {
    let compact = compact_expression(source);
    if prefix + compact.chars().count() <= width {
        return compact;
    }
    let tokens = crate::rune_parser::expression_tokens(&compact);
    let offset = |token: &str| token.as_ptr() as usize - compact.as_ptr() as usize;
    let Some(open) = tokens.iter().enumerate().position(|(i, token)| {
        matches!(*token, "{" | "(")
            || (*token == "["
                && (i == 0
                    || !tokens[i - 1].ends_with(|ch: char| {
                        ch.is_alphanumeric() || matches!(ch, '_' | ']' | ')')
                    })))
    }) else {
        return compact;
    };
    let start = offset(tokens[open]);
    let mut depth = 0;
    let mut entries = Vec::new();
    let mut entry = start + 1;
    let mut close = None;
    for token in &tokens[open..] {
        match *token {
            "{" | "[" | "(" => depth += 1,
            "}" | "]" | ")" => {
                depth -= 1;
                if depth == 0 {
                    entries.push(compact[entry..offset(token)].trim());
                    close = Some(offset(token));
                    break;
                }
            }
            "," if depth == 1 => {
                entries.push(compact[entry..offset(token)].trim());
                entry = offset(token) + 1;
            }
            _ => {}
        }
    }
    let Some(close) = close else {
        return compact;
    };
    if entries.iter().all(|entry| entry.is_empty()) {
        return compact;
    }
    if entries.len() == 1
        && tokens[open] == "("
        && !format_expression(entries[0], indent + 4, indent + 4, width, newline).contains('\n')
    {
        return compact;
    }
    let mut result = compact[..start + 1].to_string();
    result.push_str(newline);
    for (index, entry) in entries.iter().enumerate() {
        result.push_str(&" ".repeat(indent + 4));
        result.push_str(&format_expression(
            entry,
            indent + 4,
            indent + 4,
            width,
            newline,
        ));
        if index + 1 < entries.len() {
            result.push(',');
        }
        result.push_str(newline);
    }
    result.push_str(&" ".repeat(indent));
    result.push_str(&compact[close..]);
    result
}

fn normalize_logic_layout(doc: &mut crate::rune_ast::RuneDocument) {
    fn normalize(value: &mut crate::rune_ast::Value) {
        use crate::rune_ast::Value;
        match value {
            Value::String(source) => {
                *source =
                    serde_json::to_string(&crate::rune_parser::expression_tokens(source)).unwrap()
            }
            Value::List(items) => items.iter_mut().for_each(normalize),
            Value::Map(items) => items.values_mut().for_each(normalize),
            _ => {}
        }
    }
    for section in &mut doc.sections {
        if section.path.first().is_some_and(|part| part == "Logic") {
            for items in section.series.values_mut() {
                items.iter_mut().for_each(normalize);
            }
        }
    }
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
    fn logic_layout_preserves_numbers_strings_and_indexing_tokens() {
        let source = concat!(
            "@Logic/game\nstate:\n",
            "    data = {\"tiny\":1e-3,\"negative\":-0.25,\"index\":items[2],\"literal\":\"braces { and \\\"quotes\\\"\"}\n",
        );
        let formatted = format_source(source, 45);
        assert!(formatted.contains("1e-3"));
        assert!(formatted.contains("items[2]"));
        assert_eq!(
            crate::rune_parser::expression_tokens(source),
            crate::rune_parser::expression_tokens(&formatted)
        );
        assert_eq!(format_source(&formatted, 45), formatted);
    }

    #[test]
    fn width_is_a_target_and_opaque_source_stays_intact() {
        let source = concat!(
            "@Data\n",
            "value = {\"label\":\"This single string is deliberately longer than the line width\"}\n",
            "@Logic/game\n",
            "state:\n",
            "    data = {\"x\":1,\"y\":2,\"label\":\"keep this expression intact\"}\n",
            "action tick:\n",
            "    data = {\"x\":1,\"y\":2,\"label\":\"keep this expression intact\"}\n",
            "    call update {\"jump\":true,\"notice\":\"keep command argument spacing\"}\n",
            "@Raw\n",
            "source >\n",
            "    data = {\"x\":1,\"y\":2,\"label\":\"keep this embedded source intact\"}\n",
            "\n",
        );
        let formatted = format_source(source, 20);
        assert!(formatted.starts_with("@Data\nvalue = {\n    \"label\": "));
        assert!(formatted.contains("This single string is deliberately longer than the line width"));
        assert!(formatted.contains("    data = {\n        \"x\": 1,"));
        assert!(formatted.contains(
            "    call update {\"jump\":true,\"notice\":\"keep command argument spacing\"}\n"
        ));
        assert_eq!(formatted.split("@Raw").nth(1), source.split("@Raw").nth(1));
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
        let mut before = loader(&source, base, &file.to_string_lossy())?;
        let mut after = loader(&formatted, base, &file.to_string_lossy())?;
        normalize_logic_layout(&mut before);
        normalize_logic_layout(&mut after);
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
