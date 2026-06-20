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
    let mut component_definitions = HashMap::new();
    let mut style_definitions = HashMap::new();
    let mut logic_definitions = HashMap::new();
    let mut i18n_sections = HashMap::new();

    // Extract @Page sections
    for section in &doc.sections {
        if section.path.len() == 2 && section.path[0] == "Page" {
            let page_name = &section.path[1];
            let page_def = parse_page_section(section)?;
            page_views.insert(page_name.clone(), page_def);
        }
    }

    // Extract @Component sections
    for section in &doc.sections {
        if section.path.len() == 2 && section.path[0] == "Component" {
            let component_name = &section.path[1];
            let component_def = parse_component_section(section)?;
            component_definitions.insert(component_name.clone(), component_def);
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

    // Extract @I18N sections
    for section in &doc.sections {
        if section.path.len() == 2 && section.path[0] == "I18N" {
            let locale = &section.path[1];
            let i18n_def = parse_i18n_section(section);
            i18n_sections.insert(locale.clone(), i18n_def);
        }
    }

    if page_views.is_empty() {
        return Err(ParseError(format!(
            "No @Page sections found; expected at least @Page/{}",
            default_page_name
        )));
    }

    let mut resolved_components = HashMap::new();
    let component_names: Vec<String> = component_definitions.keys().cloned().collect();
    for component_name in component_names {
        let resolved_view = resolve_component_tree(
            &component_name,
            &component_definitions,
            &mut resolved_components,
            &mut Vec::new(),
        )?;
        resolved_components.insert(component_name.clone(), ComponentDefinition {
            props: component_definitions.get(&component_name).and_then(|c| c.props.clone()),
            view_tree: resolved_view,
        });
    }

    for (page_name, page_def) in page_views.iter_mut() {
        let page_path = format!("@Page/{}", page_name);
        page_def.view_tree = expand_component_refs_in_node(
            &page_def.view_tree,
            &component_definitions,
            &mut resolved_components,
            &mut vec![page_path],
        )?;
    }

    Ok(RuneWebFrontend {
        page_views,
        component_definitions: resolved_components,
        style_definitions,
        logic_definitions,
        i18n_sections,
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

/// Parse a `@Component/<name>` section.
fn parse_component_section(
    section: &crate::rune_ast::Section,
) -> Result<ComponentDefinition, ParseError> {
    // Parse optional `props: [name, other?, ...]` declaration.
    let props = if let Some(Value::List(items)) = section.kv.get("props") {
        let declarations: Vec<PropDeclaration> = items
            .iter()
            .filter_map(|v| {
                if let Value::String(s) = v {
                    let s = s.trim();
                    if s.is_empty() {
                        return None;
                    }
                    let (name, required) = if s.ends_with('?') {
                        (s[..s.len() - 1].to_string(), false)
                    } else {
                        (s.to_string(), true)
                    };
                    Some(PropDeclaration { name, required })
                } else {
                    None
                }
            })
            .collect();
        Some(declarations)
    } else {
        None
    };

    let view_tree = if let Some(view_items) = section.series.get("view") {
        parse_view_nodes(view_items)?
    } else {
        return Err(ParseError(
            "Component section missing 'view:' block".to_string(),
        ));
    };

    Ok(ComponentDefinition { props, view_tree })
}

fn resolve_component_tree(
    component_name: &str,
    component_definitions: &HashMap<String, ComponentDefinition>,
    resolved_components: &mut HashMap<String, ComponentDefinition>,
    stack: &mut Vec<String>,
) -> Result<ViewNode, ParseError> {
    if let Some(component) = resolved_components.get(component_name) {
        return Ok(component.view_tree.clone());
    }

    if stack.iter().any(|name| name == component_name) {
        let mut cycle = stack.clone();
        cycle.push(component_name.to_string());
        return Err(ParseError(format!(
            "Recursive component reference detected: {}",
            cycle.join(" -> ")
        )));
    }

    let component = component_definitions.get(component_name).ok_or_else(|| {
        ParseError(format!("Unknown component reference: {}", component_name))
    })?;

    stack.push(component_name.to_string());
    let expanded = expand_component_refs_in_node(
        &component.view_tree,
        component_definitions,
        resolved_components,
        stack,
    )?;
    stack.pop();

    Ok(expanded)
}

fn expand_component_refs_in_node(
    node: &ViewNode,
    component_definitions: &HashMap<String, ComponentDefinition>,
    resolved_components: &mut HashMap<String, ComponentDefinition>,
    stack: &mut Vec<String>,
) -> Result<ViewNode, ParseError> {
    match node {
        ViewNode::Element {
            tag,
            classes,
            id,
            attrs,
            events,
            text,
            for_each,
            children,
        } => {
            if component_definitions.contains_key(tag) {
                if !classes.is_empty()
                    || id.is_some()
                    || !events.is_empty()
                    || text.is_some()
                    || !children.is_empty()
                {
                    return Err(ParseError(format!(
                        "Component invocation '{}' does not yet support classes, ids, events, text, or child content (use props instead)",
                        tag
                    )));
                }

                // Validate required props if the component declares a props list.
                if let Some(declared_props) = component_definitions
                    .get(tag)
                    .and_then(|c| c.props.as_ref())
                {
                    let mut missing: Vec<&str> = Vec::new();
                    for decl in declared_props {
                        if decl.required && !attrs.contains_key(&decl.name) {
                            missing.push(&decl.name);
                        }
                    }
                    if !missing.is_empty() {
                        return Err(ParseError(format!(
                            "Component '{}' is missing required prop(s): {}. Declare optional props with a trailing '?' in the component's `props:` list.",
                            tag,
                            missing.join(", ")
                        )));
                    }
                }

                let component_tree = resolve_component_tree(
                    tag,
                    component_definitions,
                    resolved_components,
                    stack,
                )?;

                // Wrap with ComponentScope if any props were passed
                let scoped_tree = if attrs.is_empty() {
                    component_tree
                } else {
                    ViewNode::ComponentScope {
                        props: attrs.clone(),
                        body: Box::new(component_tree),
                    }
                };

                if let Some(for_each) = for_each {
                    return Ok(ViewNode::Loop {
                        item_name: for_each.item_name.clone(),
                        index_name: for_each.index_name.clone(),
                        collection: for_each.collection.clone(),
                        body: vec![scoped_tree],
                    });
                }

                return Ok(scoped_tree);
            }

            let mut expanded_children = Vec::new();
            for child in children {
                expanded_children.push(expand_component_refs_in_node(
                    child,
                    component_definitions,
                    resolved_components,
                    stack,
                )?);
            }

            Ok(ViewNode::Element {
                tag: tag.clone(),
                classes: classes.clone(),
                id: id.clone(),
                attrs: attrs.clone(),
                events: events.clone(),
                text: text.clone(),
                for_each: for_each.clone(),
                children: expanded_children,
            })
        }
        ViewNode::Loop {
            item_name,
            index_name,
            collection,
            body,
        } => {
            let mut expanded_body = Vec::new();
            for child in body {
                expanded_body.push(expand_component_refs_in_node(
                    child,
                    component_definitions,
                    resolved_components,
                    stack,
                )?);
            }

            Ok(ViewNode::Loop {
                item_name: item_name.clone(),
                index_name: index_name.clone(),
                collection: collection.clone(),
                body: expanded_body,
            })
        }
        ViewNode::Conditional { condition, body } => {
            let mut expanded_body = Vec::new();
            for child in body {
                expanded_body.push(expand_component_refs_in_node(
                    child,
                    component_definitions,
                    resolved_components,
                    stack,
                )?);
            }

            Ok(ViewNode::Conditional {
                condition: condition.clone(),
                body: expanded_body,
            })
        }
        ViewNode::Comment(text) => Ok(ViewNode::Comment(text.clone())),
        ViewNode::Text(text) => Ok(ViewNode::Text(text.clone())),
        ViewNode::ComponentScope { props, body } => {
            let expanded_body = expand_component_refs_in_node(
                body,
                component_definitions,
                resolved_components,
                stack,
            )?;
            Ok(ViewNode::ComponentScope {
                props: props.clone(),
                body: Box::new(expanded_body),
            })
        }
        ViewNode::MemoryBinding { var, key, body } => {
            let mut expanded_body = Vec::new();
            for child in body {
                expanded_body.push(expand_component_refs_in_node(
                    child,
                    component_definitions,
                    resolved_components,
                    stack,
                )?);
            }
            Ok(ViewNode::MemoryBinding {
                var: var.clone(),
                key: key.clone(),
                body: expanded_body,
            })
        }
    }
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
    extract_view_nodes_from(items, 0)
}

fn extract_view_nodes_from(items: &[Value], start: usize) -> Result<Vec<ViewNode>, ParseError> {
    let mut nodes = Vec::new();
    let mut i = start;
    while i < items.len() {
        let item = &items[i];
        match item {
            Value::String(s) => {
                let trimmed = s.trim();
                if trimmed.is_empty() {
                    i += 1;
                    continue;
                }

                // Skip comments - they start with #
                if trimmed.starts_with('#') {
                    let comment_text = trimmed[1..].trim().to_string();
                    nodes.push(ViewNode::Comment(comment_text));
                    i += 1;
                    continue;
                }

                // Skip control structure markers - they're handled as map keys
                if trimmed.starts_with("each ")
                    || trimmed.starts_with("for ")
                    || trimmed.starts_with("if ")
                {
                    i += 1;
                    continue;
                }

                // Detect `var = get-memory key` bindings
                if let Some(binding) = try_parse_memory_binding(trimmed) {
                    // Everything after this binding becomes its body
                    let body = extract_view_nodes_from(items, i + 1)?;
                    nodes.push(ViewNode::MemoryBinding {
                        var: binding.0,
                        key: binding.1,
                        body,
                    });
                    // Memory binding consumes all remaining siblings
                    return Ok(nodes);
                }

                // If the line is a bare quoted string, treat it as a text node directly
                if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2 {
                    let inner = &trimmed[1..trimmed.len() - 1];
                    nodes.push(ViewNode::Text(inner.to_string()));
                // Try to parse as an element
                } else if let Ok(node) = try_parse_element_from_string(trimmed) {
                    nodes.push(node);
                } else {
                    // Fall back to text node
                    nodes.push(ViewNode::Text(s.clone()));
                }
                i += 1;
            }
            Value::Map(map) => {
                // Process each key-value pair in the map
                for (key, values) in map {
                    nodes.push(parse_view_element_or_control(key, values)?);
                }
                i += 1;
            }
            _ => {
                i += 1;
            }
        }
    }
    Ok(nodes)
}

/// If `s` matches `<var> = get-memory <key>`, returns `Some((var, key))`.
fn try_parse_memory_binding(s: &str) -> Option<(String, String)> {
    // Split on " = get-memory " or " = memory.get "
    for sep in &[" = get-memory ", " = memory.get "] {
        if let Some(pos) = s.find(sep) {
            let var = s[..pos].trim().to_string();
            let key = s[pos + sep.len()..].trim().to_string();
            if !var.is_empty() && !key.is_empty() && !var.contains(' ') {
                return Some((var, key));
            }
        }
    }
    None
}

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
    let mut brace_depth = 0;
    let mut escape_next = false;

    for ch in s.chars() {
        if escape_next {
            current.push('\\');
            current.push(ch);
            escape_next = false;
        } else if ch == '\\' {
            escape_next = true;
        } else if ch == '"' {
            in_quotes = !in_quotes;
            current.push(ch);
        } else if ch == '{' && !in_quotes {
            brace_depth += 1;
            current.push(ch);
        } else if ch == '}' && !in_quotes {
            brace_depth -= 1;
            current.push(ch);
        } else if ch.is_whitespace() && !in_quotes && brace_depth <= 0 {
            if !current.is_empty() {
                tokens.push(current.clone());
                current.clear();
            }
        } else {
            current.push(ch);
        }
    }
    if escape_next {
        current.push('\\');
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
                    // Strip "on_" or "on" prefix for event names
                    let event_name = if name.starts_with("on_") {
                        name[3..].to_string()
                    } else if name.starts_with("on") && name.len() > 2 && !name[2..].starts_with('_') {
                        // Handle onClicke style (camelCase without underscore)
                        name[2..].to_string()
                    } else {
                        name.to_string()
                    };
                    events.insert(event_name, value_unquoted.to_string());
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
    if trimmed.starts_with("each ") || trimmed.starts_with("for ") {
        return parse_loop_structure(trimmed, values);
    }
    if trimmed.starts_with("if ") {
        return parse_conditional_structure(trimmed, values);
    }

    // Otherwise parse as element
    let (tag, mut classes, id, mut attrs, mut events, for_each) = parse_element_signature(trimmed)?;
    
    // Support indented attributes at the beginning of the body
    let (body_attrs, body_events, remaining_values) = extract_indented_attributes(values)?;
    attrs.extend(body_attrs);
    events.extend(body_events);

    let children = extract_view_content(&remaining_values)?;

    // Only set text if there are no children and value is a simple string
    let mut text = if children.is_empty() {
        extract_first_string_value(&remaining_values)
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

/// Parse a loop structure: "each item in collection" or "for item, index in collection"
fn parse_loop_structure(sig: &str, values: &Value) -> Result<ViewNode, ParseError> {
    let rest = if sig.starts_with("each ") {
        &sig[5..]
    } else if sig.starts_with("for ") {
        &sig[4..]
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
                    let props = parse_style_properties(rule_body)?;
                    rules.insert(selector.clone(), props);
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

/// Helper to recursively parse style properties from a Value (String or Map).
fn parse_style_properties(body: &Value) -> Result<HashMap<String, String>, ParseError> {
    let mut props = HashMap::new();
    if let Value::List(items) = body {
        for item in items {
            match item {
                Value::String(s) => {
                    if let Some((k, v)) = parse_kv_string(s) {
                        props.insert(k, v);
                    }
                }
                Value::Map(map) => {
                    for (nested_selector, nested_body) in map {
                        // Store nested rules as special properties for the CSS compiler to flatten
                        // We use a prefix or a structured key if needed, but for now we can
                        // just pass the map as a JSON string or similar, or flatten later.
                        // Actually, let's keep it simple: the AST currently only supports String values.
                        // We'll update the AST to support nested structures.
                        let nested_props = parse_style_properties(nested_body)?;
                        let nested_json = serde_json::to_string(&nested_props)
                            .unwrap_or_else(|_| "{}".to_string());
                        props.insert(format!("nested:{}", nested_selector), nested_json);
                    }
                }
                _ => {}
            }
        }
    }
    Ok(props)
}

/// Parse a `@Logic/<name>` section.
fn parse_logic_section(section: &crate::rune_ast::Section) -> Result<LogicDefinition, ParseError> {
    let mut state = HashMap::new();
    let mut derived = HashMap::new();
    let mut helpers = HashMap::new();
    let mut actions = HashMap::new();

    // Parse state from the "state:" series
    if let Some(state_items) = section.series.get("state") {
        // Group consecutive items by key until we hit the next key=value pair
        let mut i = 0;
        while i < state_items.len() {
            match &state_items[i] {
                Value::String(s) => {
                    let trimmed = s.trim();
                    // Check if this line starts a key = value assignment
                    if let Some(eq_idx) = trimmed.find('=') {
                        let key = trimmed[..eq_idx].trim().to_string();
                        let val_start = trimmed[eq_idx + 1..].trim();

                        // Collect all lines until the next key assignment or end
                        let mut value_lines = vec![val_start.to_string()];
                        i += 1;

                        while i < state_items.len() {
                            match &state_items[i] {
                                Value::String(next_s) => {
                                    let next_trimmed = next_s.trim();
                                    // Stop if we hit another key = value
                                    if next_trimmed.contains('=') && !next_trimmed.starts_with('{') && !next_trimmed.starts_with('[') {
                                        break;
                                    }
                                    value_lines.push(next_s.clone());
                                    i += 1;
                                }
                                _ => {
                                    i += 1;
                                }
                            }
                        }

                        let full_value = value_lines.join("\n");
                        state.insert(key, full_value);
                        continue;
                    }
                    i += 1;
                }
                _ => {
                    i += 1;
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
                    if trimmed.starts_with("if ") {
                        let condition = trimmed.strip_prefix("if ").unwrap_or(trimmed).trim();
                        let nested_steps = match value {
                            Value::List(nested) => parse_action_steps(nested)?,
                            _ => Vec::new(),
                        };
                        steps.push(ActionStep::Conditional {
                            condition: condition.to_string(),
                            steps: nested_steps,
                        });
                    } else if trimmed.starts_with("for ") {
                        let loop_sig = trimmed.strip_prefix("for ").unwrap_or(trimmed).trim();
                        if let Some(in_pos) = loop_sig.find(" in ") {
                            let vars_part = &loop_sig[..in_pos].trim();
                            let collection = loop_sig[in_pos + 4..].trim().to_string();

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

                            let nested_steps = match value {
                                Value::List(nested) => parse_action_steps(nested)?,
                                _ => Vec::new(),
                            };

                            steps.push(ActionStep::ForLoop {
                                item_name,
                                index_name,
                                collection,
                                steps: nested_steps,
                            });
                        } else {
                            return Err(ParseError(format!("Invalid for loop signature in action: {}", key)));
                        }
                    } else {
                        // Default to conditional for helper calls or bare conditions
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
        let key = parts[0].trim().to_string();
        let mut value = parts[1].trim().to_string();

        // Remove surrounding quotes from value if present
        if (value.starts_with('"') && value.ends_with('"')) ||
           (value.starts_with('\'') && value.ends_with('\'')) {
            value = value[1..value.len() - 1].to_string();
        }

        Some((key, value))
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

    #[test]
    fn preserves_escaped_sequences_in_view_text_tokens() {
        let doc = parse_rune(
            r#"#!RUNE

@Page/demo
view:
    pre:
        code .language-rune "line 1\nline 2 \"quoted\" \{literal\}"
"#,
        )
        .expect("expected parse to succeed");

        let frontend = parse_rune_web_frontend(&doc, "demo").expect("expected frontend parse");
        let page = frontend.page_views.get("demo").expect("page should exist");

        match &page.view_tree {
            ViewNode::Element { tag, children, .. } => {
                assert_eq!(tag, "pre");
                match &children[0] {
                    ViewNode::Element { tag, text, .. } => {
                        assert_eq!(tag, "code");
                        assert_eq!(
                            text.as_deref(),
                            Some("line 1\\nline 2 \\\"quoted\\\" \\{literal\\}")
                        );
                    }
                    _ => panic!("expected code element"),
                }
            }
            _ => panic!("expected root element"),
        }
    }

    #[test]
    fn expands_component_references_inside_pages() {
        let doc = parse_rune(
            r#"#!RUNE

@Component/HeroBanner
view:
    section .hero:
        h1 "Learn Vectrune"

@Page/home
view:
    main:
        HeroBanner
"#,
        )
        .expect("expected parse to succeed");

        let frontend = parse_rune_web_frontend(&doc, "home").expect("expected frontend parse");
        let page = frontend.page_views.get("home").expect("page should exist");

        match &page.view_tree {
            ViewNode::Element { children, .. } => match &children[0] {
                ViewNode::Element { tag, classes, children, .. } => {
                    assert_eq!(tag, "section");
                    assert_eq!(classes, &vec!["hero".to_string()]);
                    assert!(matches!(children[0], ViewNode::Element { .. }));
                }
                _ => panic!("expected expanded component element"),
            },
            _ => panic!("expected root element"),
        }
    }

    #[test]
    fn expands_component_references_with_inline_loop_bindings() {
        let doc = parse_rune(
            r#"#!RUNE

@Component/ScoreBadge
view:
    span .score "{cell}"

@Page/home
view:
    div:
        ScoreBadge <- (cell, index) in board
"#,
        )
        .expect("expected parse to succeed");

        let frontend = parse_rune_web_frontend(&doc, "home").expect("expected frontend parse");
        let page = frontend.page_views.get("home").expect("page should exist");

        match &page.view_tree {
            ViewNode::Element { children, .. } => match &children[0] {
                ViewNode::Loop { item_name, index_name, collection, body } => {
                    assert_eq!(item_name, "cell");
                    assert_eq!(index_name.as_deref(), Some("index"));
                    assert_eq!(collection, "board");
                    match &body[0] {
                        ViewNode::Element { tag, text, .. } => {
                            assert_eq!(tag, "span");
                            assert_eq!(text.as_deref(), Some("{cell}"));
                        }
                        _ => panic!("expected expanded component body"),
                    }
                }
                _ => panic!("expected loop produced from component invocation"),
            },
            _ => panic!("expected root element"),
        }
    }

    #[test]
    fn rejects_recursive_component_references() {
        let doc = parse_rune(
            r#"#!RUNE

@Component/A
view:
    B

@Component/B
view:
    A

@Page/home
view:
    A
"#,
        )
        .expect("expected parse to succeed");

        let err = parse_rune_web_frontend(&doc, "home").expect_err("expected recursive component error");
        assert!(err.to_string().contains("Recursive component reference detected"));
    }

    #[test]
    fn expands_component_with_props_into_component_scope_node() {
        let doc = parse_rune(
            r#"#!RUNE

@Component/HeroBanner
view:
    section .hero:
        h1 "{title}"

@Page/home
view:
    main:
        HeroBanner title="Learn Vectrune"
"#,
        )
        .expect("expected parse to succeed");

        let frontend = parse_rune_web_frontend(&doc, "home").expect("expected frontend parse");
        let page = frontend.page_views.get("home").expect("page should exist");

        // main > ComponentScope > section.hero > h1
        match &page.view_tree {
            ViewNode::Element { children, .. } => match &children[0] {
                ViewNode::ComponentScope { props, body } => {
                    assert_eq!(props.get("title").map(|s| s.as_str()), Some("Learn Vectrune"));
                    match body.as_ref() {
                        ViewNode::Element { tag, classes, .. } => {
                            assert_eq!(tag, "section");
                            assert_eq!(classes, &vec!["hero".to_string()]);
                        }
                        _ => panic!("expected section element inside ComponentScope"),
                    }
                }
                _ => panic!("expected ComponentScope from component invocation with props"),
            },
            _ => panic!("expected root main element"),
        }
    }

    #[test]
    fn component_without_props_expands_directly_without_scope_wrapper() {
        let doc = parse_rune(
            r#"#!RUNE

@Component/Footer
view:
    footer .site-footer:
        p "bottom"

@Page/home
view:
    main:
        Footer
"#,
        )
        .expect("expected parse to succeed");

        let frontend = parse_rune_web_frontend(&doc, "home").expect("expected frontend parse");
        let page = frontend.page_views.get("home").expect("page should exist");

        match &page.view_tree {
            ViewNode::Element { children, .. } => match &children[0] {
                ViewNode::Element { tag, .. } => assert_eq!(tag, "footer"),
                _ => panic!("expected footer element — no scope wrapper for zero-prop component"),
            },
            _ => panic!("expected root main element"),
        }
    }

    #[test]
    fn parses_props_declaration_as_required_and_optional() {
        let doc = parse_rune(
            r#"#!RUNE

@Component/Card
props: [title, subtitle?]
view:
    div .card:
        h2 "{title}"
        p "{subtitle}"

@Page/home
view:
    main:
        Card title="Hello"
"#,
        )
        .expect("expected parse to succeed");

        let frontend = parse_rune_web_frontend(&doc, "home").expect("expected frontend parse");

        // Component definition should carry the declared props
        let card = frontend.component_definitions.get("Card").expect("Card should exist");
        let props = card.props.as_ref().expect("Card should have declared props");
        assert_eq!(props.len(), 2);
        let title_prop = props.iter().find(|p| p.name == "title").expect("title prop");
        let subtitle_prop = props.iter().find(|p| p.name == "subtitle").expect("subtitle prop");
        assert!(title_prop.required, "title should be required");
        assert!(!subtitle_prop.required, "subtitle should be optional");

        // Page should have rendered — optional prop omitted without error
        let page = frontend.page_views.get("home").expect("page should exist");
        match &page.view_tree {
            ViewNode::Element { children, .. } => {
                // ComponentScope wraps the expanded tree because title was passed
                assert!(
                    matches!(children[0], ViewNode::ComponentScope { .. }),
                    "expected ComponentScope node"
                );
            }
            _ => panic!("expected root element"),
        }
    }

    #[test]
    fn errors_when_required_prop_is_missing() {
        let doc = parse_rune(
            r#"#!RUNE

@Component/Alert
props: [message, level?]
view:
    div .alert:
        p "{message}"

@Page/home
view:
    main:
        Alert
"#,
        )
        .expect("expected parse to succeed");

        let err = parse_rune_web_frontend(&doc, "home")
            .expect_err("expected missing required prop error");
        let msg = err.to_string();
        assert!(
            msg.contains("missing required prop") && msg.contains("message"),
            "error should mention the missing prop name, got: {}",
            msg
        );
    }

    #[test]
    fn no_props_declaration_skips_prop_validation() {
        // Without a props: declaration, any or no attrs are accepted
        let doc = parse_rune(
            r#"#!RUNE

@Component/Badge
view:
    span .badge "{label}"

@Page/home
view:
    main:
        Badge
"#,
        )
        .expect("expected parse to succeed");

        parse_rune_web_frontend(&doc, "home").expect("no props declaration should allow any invocation");
    }

    #[test]
    fn all_optional_props_declaration_never_errors() {
        let doc = parse_rune(
            r#"#!RUNE

@Component/Tooltip
props: [text?, placement?]
view:
    div .tooltip:
        span "{text}"

@Page/home
view:
    main:
        Tooltip
"#,
        )
        .expect("expected parse to succeed");

        parse_rune_web_frontend(&doc, "home")
            .expect("all-optional props should not error when none are passed");
    }

    #[test]
    fn parses_for_block_with_single_loop_variable() {
        let doc = parse_rune(
            r#"#!RUNE

@Page/home
view:
    div .list:
        for ticket in tickets:
            TicketCard ticket={ticket}
"#,
        )
        .expect("expected parse to succeed");

        let frontend = parse_rune_web_frontend(&doc, "home").expect("expected frontend parse");
        let page = frontend.page_views.get("home").expect("page should exist");

        match &page.view_tree {
            ViewNode::Element { children, .. } => match &children[0] {
                ViewNode::Loop {
                    item_name,
                    index_name,
                    collection,
                    body,
                } => {
                    assert_eq!(item_name, "ticket");
                    assert_eq!(index_name, &None);
                    assert_eq!(collection, "tickets");
                    assert_eq!(body.len(), 1);
                }
                _ => panic!("expected loop inside div body"),
            },
            _ => panic!("expected root element"),
        }
    }

    #[test]
    fn parses_for_block_with_two_loop_variables() {
        let doc = parse_rune(
            r#"#!RUNE

@Page/home
view:
    div .board:
        for ticket, index in board.backlog:
            TicketCard ticket={ticket} data-index={index}
"#,
        )
        .expect("expected parse to succeed");

        let frontend = parse_rune_web_frontend(&doc, "home").expect("expected frontend parse");
        let page = frontend.page_views.get("home").expect("page should exist");

        match &page.view_tree {
            ViewNode::Element { children, .. } => match &children[0] {
                ViewNode::Loop {
                    item_name,
                    index_name,
                    collection,
                    body,
                } => {
                    assert_eq!(item_name, "ticket");
                    assert_eq!(index_name.as_deref(), Some("index"));
                    assert_eq!(collection, "board.backlog");
                    assert_eq!(body.len(), 1);
                }
                _ => panic!("expected loop inside div body"),
            },
            _ => panic!("expected root element"),
        }
    }
}

/// Parse an `@I18N/<locale>` section into an [`I18nSection`].
///
/// Each `Value::Map` entry in `section.kv` is treated as a named translation group:
/// ```text
/// @I18N/en_us
/// Nav {
///     home = "Home"
///     about = "About"
/// }
/// ```
fn parse_i18n_section(section: &crate::rune_ast::Section) -> I18nSection {
    let mut groups = HashMap::new();

    for (group_name, value) in &section.kv {
        if let Value::Map(entries) = value {
            let mut translations = HashMap::new();
            for (key, val) in entries {
                if let Some(s) = val.as_str() {
                    translations.insert(key.clone(), s.to_string());
                }
            }
            groups.insert(group_name.clone(), translations);
        }
    }

    I18nSection { groups }
}

fn is_event_attribute(name: &str) -> bool {
    let name = name.trim();
    name.starts_with("on") || name == "click" || name == "change" || name == "input"
}

fn is_valid_attr_name(name: &str) -> bool {
    let name = name.trim();
    !name.is_empty() && !name.contains(' ') && !name.contains('"') && !name.contains('\'') && !name.contains('{') && !name.contains('}')
}

/// Extract indented attributes from the beginning of a body.
/// Returns (attrs, events, remaining_values).
fn extract_indented_attributes(value: &Value) -> Result<(HashMap<String, String>, HashMap<String, String>, Value), ParseError> {
    let mut attrs = HashMap::new();
    let mut events = HashMap::new();
    let mut remaining = Vec::new();
    let mut still_parsing_attrs = true;

    if let Value::List(items) = value {
        for item in items {
            if still_parsing_attrs {
                if let Value::String(s) = item {
                    if let Some((k, v)) = parse_kv_string(s) {
                        if is_valid_attr_name(&k) {
                            if is_event_attribute(&k) {
                                events.insert(k, v);
                            } else {
                                attrs.insert(k, v);
                            }
                            continue;
                        }
                    }
                }
                still_parsing_attrs = false;
            }
            remaining.push(item.clone());
        }
    }

    Ok((attrs, events, Value::List(remaining)))
}