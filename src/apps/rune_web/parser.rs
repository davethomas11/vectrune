/// Parsing and normalization of Rune-Web frontend sections.
///
/// This module extracts `@Page`, `@Style`, and `@Logic` sections from a RuneDocument
/// and converts them into the normalized internal AST defined in `ast.rs`.

use crate::rune_ast::{RuneDocument, Value};
use std::collections::HashMap;

use super::ast::*;

/// Parse error type for frontend parsing.
#[derive(Debug)]
pub struct ParseError(pub String);

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Parse a Rune-Web frontend from a RuneDocument.
///
/// Prerequisites:
/// - The document must have `@Frontend type = rune-web` defined
/// - A default page must be specified in `@Frontend page = <name>`
///
/// Returns a normalized `RuneWebFrontend` AST.
pub fn parse_rune_web_frontend(
    doc: &RuneDocument,
    default_page_name: &str,
) -> Result<RuneWebFrontend, ParseError> {
    let mut page_views = HashMap::new();
    let mut style_definitions = HashMap::new();
    let mut logic_definitions = HashMap::new();

    // Extract @Page sections
    for section in &doc.sections {
        if section.path.len() == 2 && section.path[0] == "Page" {
            let page_name = &section.path[1];
            let page_def = parse_page_section(section)?;
            page_views.insert(page_name.clone(), page_def);
        }
    }

    // Extract @Style sections
    for section in &doc.sections {
        if section.path.len() == 2 && section.path[0] == "Style" {
            let style_name = &section.path[1];
            let style_def = parse_style_section(section)?;
            style_definitions.insert(style_name.clone(), style_def);
        }
    }

    // Extract @Logic sections
    for section in &doc.sections {
        if section.path.len() == 2 && section.path[0] == "Logic" {
            let logic_name = &section.path[1];
            let logic_def = parse_logic_section(section)?;
            logic_definitions.insert(logic_name.clone(), logic_def);
        }
    }

    if page_views.is_empty() {
        return Err(ParseError(format!(
            "No @Page sections found; expected at least @Page/{}",
            default_page_name
        )));
    }

    Ok(RuneWebFrontend {
        page_views,
        style_definitions,
        logic_definitions,
    })
}

/// Parse a `@Page/<name>` section.
fn parse_page_section(section: &crate::rune_ast::Section) -> Result<PageDefinition, ParseError> {
    let title = section
        .kv
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled")
        .to_string();

    let style_ref = section
        .kv
        .get("style")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let logic_ref = section
        .kv
        .get("logic")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Parse the view tree from the "view:" series
    let view_tree = if let Some(view_items) = section.series.get("view") {
        parse_view_nodes(view_items)?
    } else {
        return Err(ParseError(
            "Page section missing 'view:' block".to_string(),
        ));
    };

    Ok(PageDefinition {
        title,
        style_ref,
        logic_ref,
        view_tree,
    })
}

/// Parse view nodes from a series list.
fn parse_view_nodes(items: &[Value]) -> Result<ViewNode, ParseError> {
    let children = extract_view_nodes(items)?;

    // If there's only one top-level child, return it directly
    if children.len() == 1 {
        Ok(children.into_iter().next().unwrap())
    } else {
        // Otherwise wrap in a div
        Ok(ViewNode::Element {
            tag: "div".to_string(),
            classes: vec![],
            id: None,
            attrs: HashMap::new(),
            events: HashMap::new(),
            text: None,
            for_each: None,
            children,
        })
    }
}

/// Extract a list of view nodes from a series.
fn extract_view_nodes(items: &[Value]) -> Result<Vec<ViewNode>, ParseError> {
    let mut nodes = Vec::new();
    for item in items {
        match item {
            Value::String(s) => {
                let trimmed = s.trim();
                if trimmed.is_empty() {
                    continue;
                }

                // Skip control structure markers - they're handled as map keys
                if trimmed.starts_with("each ") || trimmed.starts_with("if ") {
                    continue;
                }

                // Try to parse as an element first
                if let Ok(node) = try_parse_element_from_string(trimmed) {
                    nodes.push(node);
                } else {
                    // Fall back to text node
                    nodes.push(ViewNode::Text(s.clone()));
                }
            }
            Value::Map(map) => {
                // Process each key-value pair in the map
                for (key, values) in map {
                    nodes.push(parse_view_element_or_control(key, values)?);
                }
            }
            _ => {}
        }
    }
    Ok(nodes)
}

/// Try to parse an element from a string like "h1 "text content"" or "main .screen .active"
fn try_parse_element_from_string(s: &str) -> Result<ViewNode, ParseError> {
    let (element_source, for_each) = split_inline_loop_clause(s)?;
    let parts = tokenize_element_line(&element_source);
    if parts.is_empty() {
        return Err(ParseError("Empty element string".to_string()));
    }

    let (tag, classes, id, attrs, events, mut text_content) = extract_element_parts(&parts)?;

    if text_content.is_none() {
        if let Some(for_each) = &for_each {
            if looks_like_literal_collection(&for_each.collection) {
                text_content = Some(format!("{{{}}}", for_each.item_name));
            }
        }
    }

    Ok(ViewNode::Element {
        tag,
        classes,
        id,
        attrs,
        events,
        text: text_content,
        for_each,
        children: Vec::new(),
    })
}

/// Tokenize an element line into parts, handling quoted strings
fn tokenize_element_line(s: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut escape_next = false;

    for ch in s.chars() {
        if escape_next {
            current.push(ch);
            escape_next = false;
        } else if ch == '\\' {
            escape_next = true;
        } else if ch == '"' {
            in_quotes = !in_quotes;
            current.push(ch);
        } else if ch.is_whitespace() && !in_quotes {
            if !current.is_empty() {
                tokens.push(current.clone());
                current.clear();
            }
        } else {
            current.push(ch);
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

/// Extract element parts from tokenized parts
fn extract_element_parts(
    parts: &[String],
) -> Result<(String, Vec<String>, Option<String>, HashMap<String, String>, HashMap<String, String>, Option<String>), ParseError> {
    if parts.is_empty() {
        return Err(ParseError("No parts to parse".to_string()));
    }

    let tag = parts[0].clone();
    let mut classes = Vec::new();
    let mut id = None;
    let mut attrs = HashMap::new();
    let mut events = HashMap::new();
    let mut text_content = None;

    for part in &parts[1..] {
        if part.starts_with('"') && part.ends_with('"') {
            // Quoted text content
            text_content = Some(part[1..part.len() - 1].to_string());
        } else if part.starts_with('.') {
            // Class name
            classes.push(part[1..].to_string());
        } else if part.starts_with('#') {
            // ID
            id = Some(part[1..].to_string());
        } else if part.contains('=') {
            // Attribute or event
            if let Some(eq_idx) = part.find('=') {
                let name = &part[..eq_idx];
                let value = &part[eq_idx + 1..];

                // Remove quotes from value if present
                let value_unquoted = if (value.starts_with('"') && value.ends_with('"'))
                    || (value.starts_with('\'') && value.ends_with('\''))
                {
                    &value[1..value.len() - 1]
                } else {
                    value
                };

                if name.starts_with("on") || name == "click" || name == "change" {
                    events.insert(name.to_string(), value_unquoted.to_string());
                } else {
                    attrs.insert(name.to_string(), value_unquoted.to_string());
                }
            }
        }
    }

    Ok((tag, classes, id, attrs, events, text_content))
}

/// Parse a single view element or control structure from a key-value pair.
fn parse_view_element_or_control(
    key: &str,
    values: &Value,
) -> Result<ViewNode, ParseError> {
    let trimmed = key.trim();

    // Check for control structures first
    if trimmed.starts_with("each ") {
        return parse_loop_structure(trimmed, values);
    }
    if trimmed.starts_with("if ") {
        return parse_conditional_structure(trimmed, values);
    }

    // Otherwise parse as element
    let (tag, classes, id, attrs, events, for_each) = parse_element_signature(trimmed)?;
    let children = extract_view_content(values)?;

    // Only set text if there are no children and value is a simple string
    let mut text = if children.is_empty() {
        extract_first_string_value(values)
    } else {
        None
    };

    if text.is_none() {
        if let Some(for_each) = &for_each {
            if looks_like_literal_collection(&for_each.collection) {
                text = Some(format!("{{{}}}", for_each.item_name));
            }
        }
    }

    Ok(ViewNode::Element {
        tag,
        classes,
        id,
        attrs,
        events,
        text,
        for_each,
        children,
    })
}

/// Parse element signature like "main .screen #app data-foo=bar event=handler"
fn parse_element_signature(
    sig: &str,
) -> Result<(
    String,
    Vec<String>,
    Option<String>,
    HashMap<String, String>,
    HashMap<String, String>,
    Option<ForEachDefinition>,
), ParseError> {
    let (element_source, for_each) = split_inline_loop_clause(sig)?;
    let parts = tokenize_element_line(&element_source);
    let (tag, classes, id, attrs, events, _text) = extract_element_parts(&parts)?;
    Ok((tag, classes, id, attrs, events, for_each))
}

fn split_inline_loop_clause(s: &str) -> Result<(String, Option<ForEachDefinition>), ParseError> {
    let mut in_quotes = false;
    let chars: Vec<char> = s.chars().collect();

    for i in 0..chars.len().saturating_sub(1) {
        match chars[i] {
            '"' => in_quotes = !in_quotes,
            '<' if !in_quotes && chars[i + 1] == '-' => {
                let left = s[..i].trim().to_string();
                let right = s[i + 2..].trim();
                return Ok((left, Some(parse_inline_loop_binding(right)?)));
            }
            _ => {}
        }
    }

    Ok((s.trim().to_string(), None))
}

fn parse_inline_loop_binding(sig: &str) -> Result<ForEachDefinition, ParseError> {
    let trimmed = sig.trim();
    if trimmed.starts_with('(') {
        if let Some(in_pos) = trimmed.find(" in ") {
            let vars_part = trimmed[..in_pos].trim();
            let collection = trimmed[in_pos + 4..].trim().to_string();
            let vars_part = vars_part.trim_start_matches('(').trim_end_matches(')');
            let parts: Vec<String> = vars_part
                .split(',')
                .map(|p| p.trim().to_string())
                .filter(|p| !p.is_empty())
                .collect();

            if parts.is_empty() {
                return Err(ParseError("Inline loop missing iterator variables".to_string()));
            }

            return Ok(ForEachDefinition {
                item_name: parts[0].clone(),
                index_name: parts.get(1).cloned(),
                collection,
            });
        }

        return Err(ParseError(format!(
            "Invalid inline loop syntax: {}",
            trimmed
        )));
    }

    Ok(ForEachDefinition {
        item_name: "item".to_string(),
        index_name: Some("index".to_string()),
        collection: trimmed.to_string(),
    })
}

fn looks_like_literal_collection(expr: &str) -> bool {
    let trimmed = expr.trim();
    trimmed.starts_with('[') && trimmed.ends_with(']')
}

/// Extract view nodes from a Value (usually a list of values under a map key).
fn extract_view_content(value: &Value) -> Result<Vec<ViewNode>, ParseError> {
    match value {
        Value::List(items) => extract_view_nodes(items),
        Value::Map(map) => {
            let mut nodes = Vec::new();
            for (key, val) in map {
                nodes.push(parse_view_element_or_control(key, val)?);
            }
            Ok(nodes)
        }
        _ => Ok(Vec::new()),
    }
}

/// Extract the first string value from a Value.
fn extract_first_string_value(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => Some(s.clone()),
        Value::List(items) => {
            for item in items {
                if let Value::String(s) = item {
                    return Some(s.clone());
                }
            }
            None
        }
        _ => None,
    }
}

/// Parse a loop structure: "each item, index in collection"
fn parse_loop_structure(sig: &str, values: &Value) -> Result<ViewNode, ParseError> {
    let rest = if sig.starts_with("each ") {
        &sig[5..]
    } else {
        sig
    };

    // Expected format: "each item, index in collection" or "each item in collection"
    if let Some(in_pos) = rest.find(" in ") {
        let vars_part = &rest[..in_pos].trim();
        let collection = rest[in_pos + 4..].trim().to_string();

        // Parse variable names
        let parts: Vec<&str> = vars_part.split(',').map(|p| p.trim()).collect();
        if parts.is_empty() {
            return Err(ParseError("Loop missing variable names".to_string()));
        }
        let item_name = parts[0].to_string();
        let index_name = if parts.len() > 1 {
            Some(parts[1].to_string())
        } else {
            None
        };

        let body = extract_view_content(values)?;

        Ok(ViewNode::Loop {
            item_name,
            index_name,
            collection,
            body,
        })
    } else {
        Err(ParseError("Invalid loop syntax".to_string()))
    }
}

/// Parse a conditional structure: "if condition"
fn parse_conditional_structure(sig: &str, values: &Value) -> Result<ViewNode, ParseError> {
    let rest = if sig.starts_with("if ") {
        &sig[3..]
    } else {
        sig
    };

    let condition = rest.trim().to_string();
    let body = extract_view_content(values)?;

    Ok(ViewNode::Conditional { condition, body })
}

/// Parse a `@Style/<name>` section.
fn parse_style_section(section: &crate::rune_ast::Section) -> Result<StyleDefinition, ParseError> {
    let mut tokens = HashMap::new();
    let mut presets = HashMap::new();
    let mut rules = HashMap::new();

    // Parse tokens from the "tokens:" series
    if let Some(token_items) = section.series.get("tokens") {
        for item in token_items {
            if let Value::String(s) = item {
                if let Some((key, val)) = parse_kv_string(s) {
                    tokens.insert(key, val);
                }
            }
        }
    }

    // Parse presets from the "presets:" series
    if let Some(preset_items) = section.series.get("presets") {
        for item in preset_items {
            if let Value::Map(map) = item {
                for (preset_name, preset_body) in map {
                    let mut preset_props = HashMap::new();
                    if let Value::List(body_items) = preset_body {
                        for body_item in body_items {
                            if let Value::String(s) = body_item {
                                if let Some((k, v)) = parse_kv_string(s) {
                                    preset_props.insert(k, v);
                                }
                            }
                        }
                    }
                    presets.insert(preset_name.clone(), preset_props);
                }
            }
        }
    }

    // Parse rules from the "rules:" series
    if let Some(rule_items) = section.series.get("rules") {
        for item in rule_items {
            if let Value::Map(map) = item {
                for (selector, rule_body) in map {
                    let mut rule_props = HashMap::new();
                    if let Value::List(body_items) = rule_body {
                        for body_item in body_items {
                            if let Value::String(s) = body_item {
                                if let Some((k, v)) = parse_kv_string(s) {
                                    rule_props.insert(k, v);
                                }
                            }
                        }
                    }
                    rules.insert(selector.clone(), rule_props);
                }
            }
        }
    }

    Ok(StyleDefinition {
        tokens,
        presets,
        rules,
    })
}

/// Parse a `@Logic/<name>` section.
fn parse_logic_section(section: &crate::rune_ast::Section) -> Result<LogicDefinition, ParseError> {
    let mut state = HashMap::new();
    let mut derived = HashMap::new();
    let mut helpers = HashMap::new();
    let mut actions = HashMap::new();

    // Parse state from the "state:" series
    if let Some(state_items) = section.series.get("state") {
        for item in state_items {
            if let Value::String(s) = item {
                if let Some((key, val)) = parse_kv_string(s) {
                    state.insert(key, val);
                }
            }
        }
    }

    // Parse derived values from the "derive:" series
    if let Some(derive_items) = section.series.get("derive") {
        for item in derive_items {
            match item {
                Value::Map(map) => {
                    for (signature, body) in map {
                        let (name, def) = parse_derived_definition(signature, body)?;
                        derived.insert(name, def);
                    }
                }
                Value::String(s) => {
                    if let Some((key, val)) = parse_kv_string(s) {
                        derived.insert(
                            key,
                            DerivedDefinition {
                                source: String::new(),
                                cases: vec![DerivedCase {
                                    matcher: "_".to_string(),
                                    value: val,
                                }],
                            },
                        );
                    }
                }
                _ => {}
            }
        }
    }

    // Parse helper functions from "func <name>(...)" series
    for (series_key, helper_items) in &section.series {
        if series_key.starts_with("func ") {
            if let Some((helper_name, params)) = parse_callable_signature(series_key, "func ") {
                let body = helper_items
                    .iter()
                    .filter_map(|item| match item {
                        Value::String(s) => Some(s.clone()),
                        _ => None,
                    })
                    .collect();

                helpers.insert(helper_name, HelperDefinition { params, body });
            }
        }
    }

    // Parse actions from "action <name>(...)" series
    for (series_key, action_items) in &section.series {
        if series_key.starts_with("action ") {
            if let Some((action_name, params)) = parse_action_signature(series_key) {
                let steps = parse_action_steps(action_items)?;

                actions.insert(
                    action_name,
                    ActionDefinition { params, steps },
                );
            }
        }
    }

    Ok(LogicDefinition {
        state,
        derived,
        helpers,
        actions,
    })
}

fn parse_derived_definition(
    signature: &str,
    body: &Value,
) -> Result<(String, DerivedDefinition), ParseError> {
    let trimmed = signature.trim();
    let (name, source) = if let Some(from_pos) = trimmed.find(" from ") {
        (
            trimmed[..from_pos].trim().to_string(),
            trimmed[from_pos + 6..].trim().to_string(),
        )
    } else {
        return Err(ParseError(format!(
            "Invalid derive signature: {}",
            signature
        )));
    };

    let mut cases = Vec::new();
    if let Value::List(items) = body {
        for item in items {
            if let Value::String(line) = item {
                if let Some((matcher, value)) = parse_then_clause(line) {
                    cases.push(DerivedCase { matcher, value });
                }
            }
        }
    }

    Ok((name, DerivedDefinition { source, cases }))
}

fn parse_then_clause(s: &str) -> Option<(String, String)> {
    let parts: Vec<_> = s.splitn(2, " then ").collect();
    if parts.len() != 2 {
        return None;
    }

    Some((parts[0].trim().to_string(), parts[1].trim().to_string()))
}

fn parse_action_steps(items: &[Value]) -> Result<Vec<ActionStep>, ParseError> {
    let mut steps = Vec::new();

    for item in items {
        match item {
            Value::String(s) => steps.push(ActionStep::Statement(s.clone())),
            Value::Map(map) => {
                for (key, value) in map {
                    let trimmed = key.trim();
                    let condition = trimmed.strip_prefix("if ").unwrap_or(trimmed).trim();
                    let nested_steps = match value {
                        Value::List(nested) => parse_action_steps(nested)?,
                        _ => Vec::new(),
                    };
                    steps.push(ActionStep::Conditional {
                        condition: condition.to_string(),
                        steps: nested_steps,
                    });
                }
            }
            _ => {}
        }
    }

    Ok(steps)
}

/// Parse a key-value string like "key = value"
fn parse_kv_string(s: &str) -> Option<(String, String)> {
    let s = s.trim();
    let parts: Vec<_> = s.splitn(2, '=').collect();
    if parts.len() == 2 {
        Some((
            parts[0].trim().to_string(),
            parts[1].trim().to_string(),
        ))
    } else {
        None
    }
}

/// Parse an action signature like "action play(index)" to extract name and params.
fn parse_action_signature(sig: &str) -> Option<(String, Vec<String>)> {
    if let Some(parsed) = parse_callable_signature(sig, "action ") {
        return Some(parsed);
    }

    if !sig.starts_with("action ") {
        return None;
    }

    let rest = sig[7..].trim();
    if rest.is_empty() {
        None
    } else {
        Some((rest.to_string(), Vec::new()))
    }
}

fn parse_callable_signature(sig: &str, prefix: &str) -> Option<(String, Vec<String>)> {
    if !sig.starts_with(prefix) {
        return None;
    }

    let rest = &sig[prefix.len()..].trim();
    if let Some(paren_idx) = rest.find('(') {
        let name = rest[..paren_idx].trim().to_string();
        let params_str = rest[paren_idx + 1..]
            .trim_end_matches(')')
            .trim();

        let params = params_str.split(',')
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty())
            .collect();

        Some((name, params))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rune_parser::parse_rune;

    #[test]
    fn parses_inline_element_loop_binding() {
        let doc = parse_rune(
            r#"#!RUNE

@Page/demo
view:
    div:
        button .cell data-index=index click=play(index) "{cell}" <- (cell, index) in board
"#,
        )
        .expect("expected parse to succeed");

        let frontend = parse_rune_web_frontend(&doc, "demo").expect("expected frontend parse");
        let page = frontend.page_views.get("demo").expect("page should exist");

        match &page.view_tree {
            ViewNode::Element { children, .. } => match &children[0] {
                ViewNode::Element { for_each, text, .. } => {
                    let binding = for_each.as_ref().expect("expected loop binding");
                    assert_eq!(binding.item_name, "cell");
                    assert_eq!(binding.index_name.as_deref(), Some("index"));
                    assert_eq!(binding.collection, "board");
                    assert_eq!(text.as_deref(), Some("{cell}"));
                }
                _ => panic!("expected child element"),
            },
            _ => panic!("expected root element"),
        }
    }

    #[test]
    fn parses_derive_blocks_and_nested_action_steps() {
        let doc = parse_rune(
            r#"#!RUNE

@Logic/game
state:
    winner = ""
    turn = X
func win(board, player):
    return board.[0] == player or board.[1] == player
derive:
    status_text from winner:
        "" then "Turn: {turn}"
        X then "Winner: X"
action play(index):
    stop when winner != ""
    win board turn:
        turn = X
"#,
        )
        .expect("expected parse to succeed");

        let section = doc
            .sections
            .iter()
            .find(|section| section.path == vec!["Logic".to_string(), "game".to_string()])
            .expect("logic section should exist");
        let logic = parse_logic_section(section).expect("logic should parse");
        let derived = logic
            .derived
            .get("status_text")
            .expect("derived value should exist");
        let helper = logic.helpers.get("win").expect("helper should exist");

        assert_eq!(derived.source, "winner");
        assert_eq!(derived.cases.len(), 2);
        assert_eq!(helper.params, vec!["board", "player"]);
        assert_eq!(helper.body[0], "return board.[0] == player or board.[1] == player");

        let action = logic.actions.get("play").expect("action should exist");
        assert!(matches!(action.steps[0], ActionStep::Statement(_)));
        assert!(matches!(action.steps[1], ActionStep::Conditional { .. }));
    }

    #[test]
    fn parses_zero_arg_actions_with_and_without_parentheses() {
        let doc = parse_rune(
            r#"#!RUNE

@Logic/game
action reset:
    winner = ""
action replay():
    winner = X
"#,
        )
        .expect("expected parse to succeed");

        let section = doc
            .sections
            .iter()
            .find(|section| section.path == vec!["Logic".to_string(), "game".to_string()])
            .expect("logic section should exist");
        let logic = parse_logic_section(section).expect("logic should parse");

        let reset = logic.actions.get("reset").expect("reset action should exist");
        let replay = logic.actions.get("replay").expect("replay action should exist");

        assert!(reset.params.is_empty());
        assert!(replay.params.is_empty());
        assert_eq!(reset.steps.len(), 1);
        assert_eq!(replay.steps.len(), 1);
    }
}



