//! Conservative, semantics-checked Rune formatting. View/style/raw blocks stay verbatim.
use anyhow::{Context, Result};
use clap::ArgMatches;
use std::path::Path;

pub fn format_source(
    source: &str,
    line_width: usize,
) -> Result<String, crate::rune_parser::ParseError> {
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
    let mut lines = source.lines().map(str::to_string).peekable();
    while let Some(mut line) = lines.next() {
        if logic && line.starts_with(char::is_whitespace) && !raw {
            line = crate::rune_parser::collect_logic_continuation(line, &mut lines)?;
        }
        let line = line.as_str();
        let control_expression = if logic && line.starts_with(char::is_whitespace) {
            format_control_expression(line, line_width, newline)
        } else {
            None
        };
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
                    if value.starts_with('{') || value.starts_with('[') {
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
                        match serde_json::from_str::<Literal>(&value) {
                            Ok(literal) if literal.is_wrappable() => {
                                output.push_str(&format_literal(
                                    &literal,
                                    0,
                                    prefix_width,
                                    line_width,
                                    newline,
                                ));
                            }
                            _ => output.push_str(&value),
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
        } else if let Some(formatted) = control_expression {
            output.push_str(&formatted);
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
    Ok(output)
}

fn format_control_expression(line: &str, width: usize, newline: &str) -> Option<String> {
    let indent = line.chars().take_while(|c| c.is_whitespace()).count();
    let text = line.trim();
    if text.starts_with('#') {
        return None;
    }
    let is_if = text.starts_with("if ") && text.ends_with(':');
    let mut compact = compact_expression(text);
    if is_if && !compact.starts_with("if ") {
        compact.insert(2, ' ');
    }
    if indent + compact.chars().count() <= width {
        return None;
    }
    let tokens = crate::rune_parser::expression_tokens(&compact);
    let assignment = tokens
        .iter()
        .position(|token| matches!(*token, "=" | "+=" | "-=" | "*=" | "/="));
    if !is_if && assignment.is_none() {
        return None;
    }
    let mut depth = 0i32;
    let mut pending = 0usize;
    let mut breaks = Vec::new();
    for (index, token) in tokens.iter().enumerate() {
        match *token {
            "(" | "[" | "{" => depth += 1,
            ")" | "]" | "}" => depth -= 1,
            "?" if depth == 0 && !is_if && assignment.is_some_and(|eq| index > eq) => {
                pending += 1;
                breaks.push(*token);
            }
            ":" if depth == 0 && pending > 0 => {
                pending -= 1;
                breaks.push(*token);
            }
            "||" | "&&" if depth == 0 && is_if => breaks.push(*token),
            _ => {}
        }
    }
    if breaks.is_empty() {
        let eq = assignment?;
        let op = tokens[eq];
        let end = op.as_ptr() as usize - compact.as_ptr() as usize + op.len();
        let rhs = compact[end..].trim();
        if rhs.is_empty() || indent + 4 + rhs.chars().count() > width || is_if {
            return None;
        }
        return Some(format!(
            "{}{}{}{}{}",
            " ".repeat(indent),
            &compact[..end],
            newline,
            " ".repeat(indent + 4),
            rhs
        ));
    }
    let mut result = " ".repeat(indent);
    let mut start = 0;
    for token in breaks {
        let offset = token.as_ptr() as usize - compact.as_ptr() as usize;
        result.push_str(compact[start..offset].trim());
        result.push_str(newline);
        result.push_str(&" ".repeat(indent + 4));
        start = offset;
    }
    result.push_str(compact[start..].trim());
    Some(result)
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
            Value::Map(items) => {
                let old = std::mem::take(items);
                for (key, mut value) in old {
                    normalize(&mut value);
                    let normalized_key = if key.starts_with("if ") {
                        serde_json::to_string(&crate::rune_parser::expression_tokens(&key)).unwrap()
                    } else {
                        key
                    };
                    items.insert(normalized_key, value);
                }
            }
            _ => {}
        }
    }
    // Key-value arrays are stored as source text; compare their JSON, not their whitespace.
    fn canonical_array(value: &mut crate::rune_ast::Value) {
        if let crate::rune_ast::Value::String(text) = value {
            if text.trim_start().starts_with('[') {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(text) {
                    *text = json.to_string();
                }
            }
        }
    }
    for section in &mut doc.sections {
        section.kv.values_mut().for_each(canonical_array);
        for record in &mut section.records {
            record.kv.values_mut().for_each(canonical_array);
        }
        if section.path.first().is_some_and(|part| part == "Logic") {
            for items in section.series.values_mut() {
                items.iter_mut().for_each(normalize);
            }
        }
    }
}

/// JSON that remembers key order, so formatting never reorders a document's fields.
enum Literal {
    Object(Vec<(String, Literal)>),
    Array(Vec<Literal>),
    Scalar(serde_json::Value),
}

impl Literal {
    /// Objects always wrap; arrays wrap only when they hold objects or arrays,
    /// so long lists of plain values stay on one line.
    fn is_wrappable(&self) -> bool {
        match self {
            Literal::Object(_) => true,
            Literal::Array(items) => items
                .iter()
                .any(|item| matches!(item, Literal::Object(_) | Literal::Array(_))),
            Literal::Scalar(_) => false,
        }
    }

    fn compact(&self) -> String {
        match self {
            Literal::Object(fields) => format!(
                "{{{}}}",
                fields
                    .iter()
                    .map(|(key, value)| format!(
                        "{}:{}",
                        serde_json::to_string(key).unwrap(),
                        value.compact()
                    ))
                    .collect::<Vec<_>>()
                    .join(",")
            ),
            Literal::Array(items) => format!(
                "[{}]",
                items.iter().map(Literal::compact).collect::<Vec<_>>().join(",")
            ),
            Literal::Scalar(value) => serde_json::to_string(value).expect("JSON values are serializable"),
        }
    }
}

impl<'de> serde::Deserialize<'de> for Literal {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct Visitor;
        impl<'de> serde::de::Visitor<'de> for Visitor {
            type Value = Literal;
            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("a JSON value")
            }
            fn visit_bool<E>(self, value: bool) -> Result<Literal, E> {
                Ok(Literal::Scalar(value.into()))
            }
            fn visit_i64<E>(self, value: i64) -> Result<Literal, E> {
                Ok(Literal::Scalar(value.into()))
            }
            fn visit_u64<E>(self, value: u64) -> Result<Literal, E> {
                Ok(Literal::Scalar(value.into()))
            }
            fn visit_f64<E: serde::de::Error>(self, value: f64) -> Result<Literal, E> {
                serde_json::Number::from_f64(value)
                    .map(|number| Literal::Scalar(number.into()))
                    .ok_or_else(|| E::custom("number is not finite"))
            }
            fn visit_str<E>(self, value: &str) -> Result<Literal, E> {
                Ok(Literal::Scalar(value.into()))
            }
            fn visit_unit<E>(self) -> Result<Literal, E> {
                Ok(Literal::Scalar(serde_json::Value::Null))
            }
            fn visit_seq<A: serde::de::SeqAccess<'de>>(self, mut seq: A) -> Result<Literal, A::Error> {
                let mut items = Vec::new();
                while let Some(item) = seq.next_element()? {
                    items.push(item);
                }
                Ok(Literal::Array(items))
            }
            fn visit_map<A: serde::de::MapAccess<'de>>(self, mut map: A) -> Result<Literal, A::Error> {
                let mut fields = Vec::new();
                while let Some(entry) = map.next_entry()? {
                    fields.push(entry);
                }
                Ok(Literal::Object(fields))
            }
        }
        deserializer.deserialize_any(Visitor)
    }
}

fn format_literal(
    value: &Literal,
    indent: usize,
    prefix_width: usize,
    line_width: usize,
    newline: &str,
) -> String {
    let compact = value.compact();
    if prefix_width + compact.chars().count() + 1 <= line_width {
        return compact;
    }
    let (open, close, entries): (_, _, Vec<_>) = match value {
        Literal::Object(fields) => (
            '{',
            '}',
            fields
                .iter()
                .map(|(key, value)| (format!("{}: ", serde_json::to_string(key).unwrap()), value))
                .collect(),
        ),
        Literal::Array(items) => (
            '[',
            ']',
            items.iter().map(|value| (String::new(), value)).collect(),
        ),
        Literal::Scalar(_) => return compact,
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
    use super::{format_source, normalize_logic_layout};

    #[test]
    fn example_logic_can_be_formatted_without_changing_its_parse() {
        for (name, source) in [
            ("aquarium", include_str!("../../examples/games/idle_aquarium/logic.rune")),
            ("traffic", include_str!("../../examples/games/dog_walker/traffic.rune")),
            ("marble", include_str!("../../examples/games/marble_run/logic.rune")),
            ("neon", include_str!("../../examples/games/neon_circuit/logic.rune")),
            ("crypt", include_str!("../../examples/games/rune_crypt/ux.rune")),
            ("starfall", include_str!("../../examples/games/starfall/hydroponics.rune")),
        ] {
            let formatted = format_source(source, 100).unwrap();
            let mut before = crate::rune_parser::parse_rune(source).unwrap();
            let mut after = crate::rune_parser::parse_rune(&formatted).unwrap();
            normalize_logic_layout(&mut before);
            normalize_logic_layout(&mut after);
            for (original, formatted_section) in before.sections.iter().zip(&after.sections) {
                for (key, items) in &original.series {
                    assert_eq!(
                        serde_json::to_value(items).unwrap(),
                        serde_json::to_value(&formatted_section.series[key]).unwrap(),
                        "{name}: series {key}"
                    );
                }
            }
            assert_eq!(format_source(&formatted, 100).unwrap(), formatted, "{name}");
        }
    }

    #[test]
    fn logic_comments_are_not_formatted_as_assignments() {
        let source = "@Logic/game\nstate:\n    # a long explanation = this is only a comment\n    x = 1\n";
        assert_eq!(format_source(source, 35).unwrap(), source);
    }

    #[test]
    fn multiline_conditions_preserve_crlf_and_are_idempotent() {
        let source = "@Logic/game\r\naction update:\r\n    if !ready || waiting || complete:\r\n        value = ready ? 123456 : 654321\r\n";
        let formatted = format_source(source, 30).unwrap();
        assert!(formatted.contains("    if !ready\r\n        || waiting"));
        assert!(formatted.contains("\r\n            ? 123456"));
        assert!(!formatted.replace("\r\n", "").contains('\n'));
        assert_eq!(format_source(&formatted, 30).unwrap(), formatted);
    }

    #[test]
    fn logic_layout_preserves_numbers_strings_and_indexing_tokens() {
        let source = concat!(
            "@Logic/game\nstate:\n",
            "    data = {\"tiny\":1e-3,\"negative\":-0.25,\"index\":items[2],\"literal\":\"braces { and \\\"quotes\\\"\"}\n",
        );
        let formatted = format_source(source, 45).unwrap();
        assert!(formatted.contains("1e-3"));
        assert!(formatted.contains("items[2]"));
        assert_eq!(
            crate::rune_parser::expression_tokens(source),
            crate::rune_parser::expression_tokens(&formatted)
        );
        assert_eq!(format_source(&formatted, 45).unwrap(), formatted);
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
        let formatted = format_source(source, 20).unwrap();
        assert!(formatted.starts_with("@Data\nvalue = {\n    \"label\": "));
        assert!(formatted.contains("This single string is deliberately longer than the line width"));
        assert!(formatted.contains("    data = {\n        \"x\": 1,"));
        assert!(formatted.contains(
            "    call update {\"jump\":true,\"notice\":\"keep command argument spacing\"}\n"
        ));
        assert_eq!(formatted.split("@Raw").nth(1), source.split("@Raw").nth(1));
        assert_eq!(format_source(&formatted, 20).unwrap(), formatted);
    }

    #[test]
    fn arrays_of_objects_wrap_in_order_and_scalar_lists_stay_inline() {
        let source = concat!(
            "@TV/game\n",
            "modes = [{\"id\":\"tank\",\"label\":\"TANK\",\"bounds\":{\"origin\":[1,2]}},{\"id\":\"friends\"}]\n",
            "names = [\"alpha\",\"beta\",\"gamma\",\"delta\",\"epsilon\",\"zeta\",\"eta\",\"theta\"]\n",
        );
        let formatted = format_source(source, 40).unwrap();
        assert!(formatted.starts_with(
            "@TV/game\nmodes = [\n    {\n        \"id\": \"tank\",\n        \"label\": \"TANK\","
        ));
        assert!(formatted.contains("    },\n    {\"id\":\"friends\"}\n]\n"));
        assert!(formatted.contains("names = [\"alpha\",\"beta\""));
        assert_eq!(format_source(&formatted, 40).unwrap(), formatted);
        let parse = |text: &str| crate::rune_parser::parse_rune(text).unwrap();
        let section = |text: &str| parse(text).sections[0].kv["modes"].to_json();
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(section(source).as_str().unwrap()).unwrap(),
            serde_json::from_str::<serde_json::Value>(section(&formatted).as_str().unwrap()).unwrap()
        );
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
        let base = file.parent().unwrap();
        let loader = if crate::rune_parser::is_test_source(&file) {
            crate::rune_parser::load_rune_test_document_from_str_with_base
        } else {
            crate::rune_parser::load_rune_document_from_str_with_base
        };
        let mut before = loader(&source, base, &file.to_string_lossy())?;
        let formatted = format_source(&source, line_width)?;
        if source == formatted {
            continue;
        }
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
