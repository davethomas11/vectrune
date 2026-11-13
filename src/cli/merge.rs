use crate::rune_ast::RuneDocument;
use crate::rune_parser::load_rune_document_from_path;
use serde_json::Value as JsonValue;
use std::fs;
use std::path::Path;

#[derive(Debug, PartialEq)]
enum SelectorStep {
    Key(String),
    Group(Vec<String>),
    Wildcard,
    Merge {
        key_field: Option<String>,
        target: Option<String>,
        value_field: String,
        source_path: String,
    },
}

pub fn handle_merge(input_doc: &RuneDocument, spec: &str) -> Result<RuneDocument, String> {
    let (base_file, selector) = spec
        .split_once('@')
        .ok_or_else(|| "Merge spec must be in format base_file@selector".to_string())?;
    if base_file.is_empty() {
        return Err("Merge spec is missing the base file path".to_string());
    }

    let extension = Path::new(base_file)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let mut base_json = match extension.as_str() {
        "yaml" | "yml" => {
            let content = read_base(base_file)?;
            let yaml: serde_yaml::Value = serde_yaml::from_str(&content)
                .map_err(|e| format!("Failed to parse base YAML: {}", e))?;
            serde_json::to_value(yaml)
                .map_err(|e| format!("Failed to convert base YAML to JSON: {}", e))?
        }
        "json" => {
            let content = read_base(base_file)?;
            serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse base JSON: {}", e))?
        }
        "xml" => {
            let content = read_base(base_file)?;
            RuneDocument::from_xml(&content)?.to_json()
        }
        _ => load_rune_document_from_path(Path::new(base_file))
            .map_err(|e| format!("Failed to load base Rune document: {}", e))?
            .to_json(),
    };
    apply_merge(&mut base_json, &input_doc.to_json(), selector)?;
    Ok(RuneDocument::from_json(&base_json))
}

fn read_base(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("Failed to read base file {}: {}", path, e))
}

fn apply_merge(base: &mut JsonValue, input: &JsonValue, selector: &str) -> Result<(), String> {
    let steps = parse_selector(selector)?;
    if !matches!(steps.last(), Some(SelectorStep::Merge { .. })) {
        return Err("Merge selector must end with a merge instruction".to_string());
    }
    if steps[..steps.len() - 1]
        .iter()
        .any(|step| matches!(step, SelectorStep::Merge { .. }))
    {
        return Err(
            "Merge selector may contain only one merge instruction, at the end".to_string(),
        );
    }

    let Some(SelectorStep::Merge { source_path, .. }) = steps.last() else {
        return Err("Merge selector must end with a merge instruction".to_string());
    };
    let source = resolve_source(input, source_path).ok_or_else(|| {
        format!(
            "Merge source '{}' was not found in the input document",
            source_path
        )
    })?;

    let mut updates = 0;
    visit_selector(base, &steps, 0, source, selector, &mut updates)?;
    if updates == 0 {
        return Err(format!("Merge selector matched no targets: '{}'", selector));
    }
    Ok(())
}

fn parse_selector(selector: &str) -> Result<Vec<SelectorStep>, String> {
    if selector.trim().is_empty() {
        return Err("Merge selector cannot be empty".to_string());
    }

    let mut parts = Vec::new();
    let mut depth = 0usize;
    let mut start = 0usize;
    for (index, ch) in selector.char_indices() {
        match ch {
            '(' => {
                depth += 1;
                if depth > 1 {
                    return Err("Merge selector does not allow nested parentheses".to_string());
                }
            }
            ')' => {
                if depth == 0 {
                    return Err("Malformed merge selector: unmatched ')'".to_string());
                }
                depth -= 1;
            }
            '.' if depth == 0 => {
                parts.push(selector[start..index].trim());
                start = index + ch.len_utf8();
            }
            _ => {}
        }
    }
    if depth != 0 {
        return Err("Malformed merge selector: unclosed '('".to_string());
    }
    parts.push(selector[start..].trim());

    let mut steps = Vec::with_capacity(parts.len());
    for part in parts {
        if part.is_empty() {
            return Err("Malformed merge selector: empty path segment".to_string());
        }
        if part.starts_with("[]") && part.chars().all(|ch| ch == '[' || ch == ']') {
            if part.len() % 2 != 0 || !part.as_bytes().chunks(2).all(|pair| pair == b"[]") {
                return Err(format!("Malformed wildcard selector segment '{}'", part));
            }
            steps.extend((0..part.len() / 2).map(|_| SelectorStep::Wildcard));
        } else if part.starts_with('(') || part.ends_with(')') {
            if !(part.starts_with('(') && part.ends_with(')')) {
                return Err(format!("Malformed selector segment '{}'", part));
            }
            let inner = part[1..part.len() - 1].trim();
            if inner.is_empty() {
                return Err("Malformed merge selector: empty parentheses".to_string());
            }
            if inner.contains(" from ") {
                steps.push(parse_merge_instruction(inner)?);
            } else if inner.contains('|') {
                let options: Vec<String> = inner
                    .split('|')
                    .map(str::trim)
                    .map(str::to_string)
                    .collect();
                if options.iter().any(String::is_empty) {
                    return Err(format!("Malformed selector grouping '{}'", inner));
                }
                steps.push(SelectorStep::Group(options));
            } else {
                return Err(format!(
                    "Unrecognized selector expression '{}'; expected a grouping or merge instruction",
                    inner
                ));
            }
        } else {
            steps.push(SelectorStep::Key(part.to_string()));
        }
    }
    Ok(steps)
}

fn parse_merge_instruction(inner: &str) -> Result<SelectorStep, String> {
    let (destination, source_path) = inner
        .split_once(" from ")
        .ok_or_else(|| "Invalid merge instruction: expected 'from <source>'".to_string())?;
    let source_path = source_path.trim();
    if source_path.is_empty() || source_path.contains(" from ") {
        return Err("Invalid merge instruction: source path cannot be empty".to_string());
    }

    if let Some((key_match, value_field)) = destination.split_once(" on ") {
        let (key_field, target) = key_match.split_once('=').ok_or_else(|| {
            "Invalid merge instruction: expected KEY_FIELD=TARGET before 'on'".to_string()
        })?;
        let key_field = key_field.trim();
        let target = target.trim();
        let value_field = value_field.trim();
        if key_field.is_empty() || target.is_empty() || value_field.is_empty() {
            return Err(
                "Invalid merge instruction: field names and target must not be empty".to_string(),
            );
        }
        Ok(SelectorStep::Merge {
            key_field: Some(key_field.to_string()),
            target: Some(target.to_string()),
            value_field: value_field.to_string(),
            source_path: source_path.to_string(),
        })
    } else {
        let value_field = destination.trim();
        if value_field.is_empty() {
            return Err("Invalid merge instruction: destination field cannot be empty".to_string());
        }
        Ok(SelectorStep::Merge {
            key_field: None,
            target: None,
            value_field: value_field.to_string(),
            source_path: source_path.to_string(),
        })
    }
}

fn resolve_source<'a>(input: &'a JsonValue, source_path: &str) -> Option<&'a JsonValue> {
    let mut value = input;
    for segment in source_path.split('.') {
        if segment.is_empty() {
            return None;
        }
        value = value.as_object()?.get(segment)?;
    }
    Some(value)
}

fn visit_selector(
    current: &mut JsonValue,
    steps: &[SelectorStep],
    index: usize,
    source: &JsonValue,
    selector: &str,
    updates: &mut usize,
) -> Result<(), String> {
    match &steps[index] {
        SelectorStep::Key(key) => {
            if let Some(next) = current
                .as_object_mut()
                .and_then(|object| object.get_mut(key))
            {
                visit_selector(next, steps, index + 1, source, selector, updates)?;
            }
        }
        SelectorStep::Group(options) => {
            if let Some(object) = current.as_object_mut() {
                for key in options {
                    if let Some(next) = object.get_mut(key) {
                        visit_selector(next, steps, index + 1, source, selector, updates)?;
                    }
                }
            }
        }
        SelectorStep::Wildcard => match current {
            JsonValue::Array(items) => {
                for item in items {
                    visit_selector(item, steps, index + 1, source, selector, updates)?;
                }
            }
            JsonValue::Object(object) => {
                for item in object.values_mut() {
                    visit_selector(item, steps, index + 1, source, selector, updates)?;
                }
            }
            _ => {}
        },
        SelectorStep::Merge {
            key_field,
            target,
            value_field,
            ..
        } => {
            if let Some(object) = current.as_object_mut() {
                let is_target = match (key_field, target) {
                    (Some(key_field), Some(target)) => object
                        .get(key_field)
                        .and_then(selector_scalar)
                        .is_some_and(|value| value == *target),
                    (None, None) => true,
                    _ => false,
                };
                if is_target {
                    if let Some(existing) = object.get(value_field) {
                        if json_kind(existing) != json_kind(source) {
                            return Err(format!(
                                "Merge type conflict at selector '{}': destination '{}' is {}, but source is {}",
                                selector,
                                value_field,
                                json_kind(existing),
                                json_kind(source)
                            ));
                        }
                    }
                    object.insert(value_field.clone(), source.clone());
                    *updates += 1;
                }
            }
        }
    }
    Ok(())
}

fn selector_scalar(value: &JsonValue) -> Option<String> {
    match value {
        JsonValue::String(value) => Some(value.clone()),
        JsonValue::Number(value) => Some(value.to_string()),
        JsonValue::Bool(value) => Some(value.to_string()),
        JsonValue::Null | JsonValue::Array(_) | JsonValue::Object(_) => None,
    }
}

fn json_kind(value: &JsonValue) -> &'static str {
    match value {
        JsonValue::Null => "null",
        JsonValue::Bool(_) => "boolean",
        JsonValue::Number(_) => "number",
        JsonValue::String(_) => "string",
        JsonValue::Array(_) => "array",
        JsonValue::Object(_) => "object",
    }
}
