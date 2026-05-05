/// Rune-Web: A frontend authoring system integrated with Vectrune.
///
/// This module implements support for the `@Frontend type = rune-web` mode,
/// which allows declarative HTML, CSS, and client logic to be authored
/// directly in `.rune` files alongside server-side code.
///
/// The rune-web frontend mode normalizes parsed `@Page`, `@Style`, and `@Logic`
/// sections into a clean internal model for rendering and code generation.
///
/// # Module Layout
///
/// - `ast.rs`: Internal data structures for pages, styles, and logic
/// - `parser.rs`: Parsing and normalization of frontend sections
/// - `css.rs`: CSS compilation and token/preset expansion
/// - `jscodegen.rs`: JavaScript code generation for client-side logic
/// - `mod.rs` (this file): Router building and main entry point

pub mod ast;
pub mod parser;
pub mod css;
pub mod jscodegen;

use crate::core::AppState;
use crate::util::{log, LogLevel};
use axum::{response::Html, routing::get, Router};
use serde_json::{Map as JsonMap, Number as JsonNumber, Value as JsonValue};

/// Build a mountable rune-web frontend router.
///
/// This is called from frontend handling when `@Frontend type = rune-web` is detected.
/// It extracts `@Page/<name>`, `@Style/<name>`, and `@Logic/<name>` sections,
/// normalizes them, and mounts a basic HTML response at the configured frontend path.
pub async fn build_rune_web_router(state: AppState) -> Router {
    log(LogLevel::Info, "Building Rune-Web frontend mount...");

    let frontend_section = state
        .doc
        .sections
        .iter()
        .find(|s| s.path.first().map(|p| p.as_str()) == Some("Frontend"));

    let page_name = frontend_section
        .and_then(|s| s.kv.get("page"))
        .and_then(|v| v.as_str())
        .unwrap_or("index");

    let mount_path_raw = frontend_section
        .and_then(|s| s.kv.get("path"))
        .and_then(|v| v.as_str())
        .unwrap_or("/");
    let mount_path = if mount_path_raw == "%ROOT%" {
        "/"
    } else {
        mount_path_raw
    };

    log(
        LogLevel::Info,
        &format!(
            "Rune-Web: loading page '{}' at mount path '{}'",
            page_name, mount_path
        ),
    );

    match parser::parse_rune_web_frontend(&state.doc, page_name) {
        Ok(frontend) => {
            log(
                LogLevel::Info,
                &format!(
                    "Rune-Web: parsed {} page, {} styles, {} logic blocks",
                    if frontend.page_views.is_empty() { "0" } else { "1" },
                    frontend.style_definitions.len(),
                    frontend.logic_definitions.len()
                ),
            );

            let html = render_frontend_shell(&frontend, page_name);
            Router::new().route(mount_path, get(move || {
                let html = html.clone();
                async move { Html(html) }
            }))
        }
        Err(e) => {
            log(
                LogLevel::Warn,
                &format!("Rune-Web: parse error: {}", e),
            );
            Router::new()
        }
    }
}

fn render_frontend_shell(frontend: &ast::RuneWebFrontend, page_name: &str) -> String {
    let page = frontend.page_views.get(page_name);
    let title = page
        .map(|page| page.title.as_str())
        .filter(|title| !title.is_empty())
        .unwrap_or("Vectrune Rune-Web");

    let logic = page
        .and_then(|p| p.logic_ref.as_ref())
        .and_then(|logic_name| frontend.logic_definitions.get(logic_name));
    let runtime_data = build_runtime_data(logic);
    let locals = JsonMap::new();

    let page_html = page
        .map(|p| render_view_node(&p.view_tree, &runtime_data, &locals))
        .unwrap_or_else(|| String::from("<p>Page not found</p>"));

    let style_html = render_styles(frontend, page.and_then(|p| p.style_ref.clone()));
    let logic_html = render_logic(page, logic.cloned());

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{}</title>
    {}
</head>
<body>
    <div id="app">{}</div>
    {}
</body>
</html>"#,
        title, style_html, page_html, logic_html
    )
}

fn render_view_node(node: &ast::ViewNode, data: &JsonMap<String, JsonValue>, locals: &JsonMap<String, JsonValue>) -> String {
    match node {
        ast::ViewNode::Element {
            tag,
            classes,
            id,
            attrs,
            events,
            text,
            for_each,
            children,
        } => {
            if let Some(for_each) = for_each {
                let collection = resolve_expression_value(&for_each.collection, data, locals)
                    .unwrap_or(JsonValue::Array(Vec::new()));
                if let JsonValue::Array(items) = collection {
                    return items
                        .iter()
                        .enumerate()
                        .map(|(index, item)| {
                            let mut child_locals = locals.clone();
                            child_locals.insert(for_each.item_name.clone(), item.clone());
                            if let Some(index_name) = &for_each.index_name {
                                child_locals.insert(index_name.clone(), JsonValue::Number(JsonNumber::from(index)));
                            }
                            render_element_node(
                                tag,
                                classes,
                                id,
                                attrs,
                                events,
                                text,
                                children,
                                data,
                                &child_locals,
                            )
                        })
                        .collect::<Vec<_>>()
                        .join("");
                }
                return String::new();
            }

            render_element_node(tag, classes, id, attrs, events, text, children, data, locals)
        }
        ast::ViewNode::Loop {
            item_name,
            index_name,
            collection,
            body,
        } => {
            let collection = resolve_expression_value(collection, data, locals)
                .unwrap_or(JsonValue::Array(Vec::new()));
            if let JsonValue::Array(items) = collection {
                items
                    .iter()
                    .enumerate()
                    .map(|(index, item)| {
                        let mut child_locals = locals.clone();
                        child_locals.insert(item_name.clone(), item.clone());
                        if let Some(index_name) = index_name {
                            child_locals.insert(index_name.clone(), JsonValue::Number(JsonNumber::from(index)));
                        }
                        body.iter()
                            .map(|child| render_view_node(child, data, &child_locals))
                            .collect::<Vec<_>>()
                            .join("")
                    })
                    .collect::<Vec<_>>()
                    .join("")
            } else {
                String::new()
            }
        }
        ast::ViewNode::Conditional { condition, body } => {
            if evaluate_condition(condition, data, locals) {
                body.iter()
                    .map(|child| render_view_node(child, data, locals))
                    .collect::<Vec<_>>()
                    .join("")
            } else {
                String::new()
            }
        }
        ast::ViewNode::Text(s) => html_escape(&interpolate_template(s, data, locals)),
    }
}

fn render_element_node(
    tag: &str,
    classes: &[String],
    id: &Option<String>,
    attrs: &std::collections::HashMap<String, String>,
    events: &std::collections::HashMap<String, String>,
    text: &Option<String>,
    children: &[ast::ViewNode],
    data: &JsonMap<String, JsonValue>,
    locals: &JsonMap<String, JsonValue>,
) -> String {
    let mut elem = format!("<{}", tag);

    if let Some(id_val) = id {
        elem.push_str(&format!(r#" id="{}""#, html_escape(&interpolate_template(id_val, data, locals))));
    }

    if !classes.is_empty() {
        elem.push_str(&format!(r#" class="{}""#, classes.join(" ")));
    }

    for (key, value) in attrs {
        elem.push_str(&format!(
            r#" {}="{}""#,
            key,
            html_escape(&interpolate_template(value, data, locals))
        ));
    }

    if !locals.is_empty() {
        if let Ok(scope_json) = serde_json::to_string(locals) {
            elem.push_str(&format!(r#" data-rune-scope="{}""#, html_escape(&scope_json)));
        }
    }

    for (event, handler) in events {
        elem.push_str(&format!(
            r#" data-on-{}="{}""#,
            event,
            html_escape(handler)
        ));
    }

    elem.push('>');

    if let Some(text_content) = text {
        elem.push_str(&html_escape(&interpolate_template(text_content, data, locals)));
    }

    for child in children {
        elem.push_str(&render_view_node(child, data, locals));
    }

    elem.push_str(&format!("</{}>", tag));
    elem
}

fn build_runtime_data(logic: Option<&ast::LogicDefinition>) -> JsonMap<String, JsonValue> {
    let mut data = JsonMap::new();

    if let Some(logic) = logic {
        for (key, value) in &logic.state {
            data.insert(key.clone(), parse_runtime_literal(value));
        }
        apply_derived_values(&mut data, &logic.derived);
    }

    data
}

fn apply_derived_values(
    data: &mut JsonMap<String, JsonValue>,
    derived: &std::collections::HashMap<String, ast::DerivedDefinition>,
) {
    for (name, definition) in derived {
        let source_value = resolve_expression_value(&definition.source, data, &JsonMap::new())
            .unwrap_or(JsonValue::Null);
        let source_key = value_to_string(&source_value);

        let mut resolved = JsonValue::Null;
        for case in &definition.cases {
            let matcher = normalize_literal(&case.matcher);
            if matcher == "_" || matcher == source_key {
                resolved = JsonValue::String(interpolate_template(
                    &normalize_literal(&case.value),
                    data,
                    &JsonMap::new(),
                ));
                break;
            }
        }

        data.insert(name.clone(), resolved);
    }
}

fn normalize_literal(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.len() >= 2
        && ((trimmed.starts_with('"') && trimmed.ends_with('"'))
            || (trimmed.starts_with('\'') && trimmed.ends_with('\'')))
    {
        trimmed[1..trimmed.len() - 1].to_string()
    } else {
        trimmed.to_string()
    }
}

fn interpolate_template(template: &str, data: &JsonMap<String, JsonValue>, locals: &JsonMap<String, JsonValue>) -> String {
    let mut rendered = String::new();
    let mut chars = template.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '{' {
            let mut expr = String::new();
            let mut found_end = false;
            while let Some(next) = chars.next() {
                if next == '}' {
                    found_end = true;
                    break;
                }
                expr.push(next);
            }

            if found_end {
                if let Some(value) = resolve_expression_value(&expr, data, locals) {
                    let resolved = value_to_string(&value);
                    if resolved.contains('{') && resolved.contains('}') {
                        rendered.push_str(&interpolate_template(&resolved, data, locals));
                    } else {
                        rendered.push_str(&resolved);
                    }
                }
            } else {
                rendered.push('{');
                rendered.push_str(&expr);
            }
        } else {
            rendered.push(ch);
        }
    }

    rendered
}

fn resolve_expression_value(
    expr: &str,
    data: &JsonMap<String, JsonValue>,
    locals: &JsonMap<String, JsonValue>,
) -> Option<JsonValue> {
    let trimmed = expr.trim();
    if trimmed.is_empty() {
        return None;
    }

    if trimmed.starts_with('[') || trimmed.starts_with('{') {
        if let Ok(value) = serde_json::from_str::<JsonValue>(trimmed) {
            return Some(value);
        }
    }

    if trimmed == "true" {
        return Some(JsonValue::Bool(true));
    }
    if trimmed == "false" {
        return Some(JsonValue::Bool(false));
    }
    if trimmed == "null" {
        return Some(JsonValue::Null);
    }
    if let Ok(number) = trimmed.parse::<f64>() {
        return JsonNumber::from_f64(number).map(JsonValue::Number);
    }
    if trimmed.len() >= 2
        && ((trimmed.starts_with('"') && trimmed.ends_with('"'))
            || (trimmed.starts_with('\'') && trimmed.ends_with('\'')))
    {
        return Some(JsonValue::String(normalize_literal(trimmed)));
    }

    resolve_path_value(trimmed, data, locals).or_else(|| Some(JsonValue::String(trimmed.to_string())))
}

fn resolve_path_value(
    expr: &str,
    data: &JsonMap<String, JsonValue>,
    locals: &JsonMap<String, JsonValue>,
) -> Option<JsonValue> {
    let segments = split_path_segments(expr);
    if segments.is_empty() {
        return None;
    }

    let mut current = locals
        .get(&segments[0])
        .cloned()
        .or_else(|| data.get(&segments[0]).cloned())?;

    for segment in segments.iter().skip(1) {
        let resolved_key = locals
            .get(segment)
            .cloned()
            .or_else(|| data.get(segment).cloned())
            .unwrap_or_else(|| JsonValue::String(segment.clone()));
        current = match current {
            JsonValue::Object(map) => map.get(&value_to_string(&resolved_key)).cloned()?,
            JsonValue::Array(list) => {
                let index = value_to_string(&resolved_key).parse::<usize>().ok()?;
                list.get(index).cloned()?
            }
            _ => return None,
        };
    }

    Some(current)
}

fn split_path_segments(expr: &str) -> Vec<String> {
    let mut segments = Vec::new();
    let mut current = String::new();
    let mut in_brackets = false;

    for ch in expr.chars() {
        match ch {
            '.' if !in_brackets => {
                if !current.is_empty() {
                    segments.push(current.clone());
                    current.clear();
                }
            }
            '[' => {
                if !current.is_empty() {
                    segments.push(current.clone());
                    current.clear();
                }
                in_brackets = true;
            }
            ']' => {
                if !current.is_empty() {
                    segments.push(current.clone());
                    current.clear();
                }
                in_brackets = false;
            }
            _ => current.push(ch),
        }
    }

    if !current.is_empty() {
        segments.push(current);
    }

    segments.into_iter().map(|segment| segment.trim().to_string()).filter(|segment| !segment.is_empty()).collect()
}

fn evaluate_condition(condition: &str, data: &JsonMap<String, JsonValue>, locals: &JsonMap<String, JsonValue>) -> bool {
    let trimmed = condition.trim();
    if let Some((left, right)) = trimmed.split_once(" or ") {
        return evaluate_condition(left, data, locals) || evaluate_condition(right, data, locals);
    }
    if let Some((left, right)) = trimmed.split_once(" and ") {
        return evaluate_condition(left, data, locals) && evaluate_condition(right, data, locals);
    }
    if let Some((left, right)) = trimmed.split_once(" != ") {
        return resolve_expression_value(left, data, locals) != resolve_expression_value(right, data, locals);
    }
    if let Some((left, right)) = trimmed.split_once(" == ") {
        return resolve_expression_value(left, data, locals) == resolve_expression_value(right, data, locals);
    }

    match resolve_expression_value(trimmed, data, locals) {
        Some(JsonValue::Bool(value)) => value,
        Some(JsonValue::Null) | None => false,
        Some(JsonValue::String(value)) => !value.is_empty(),
        Some(JsonValue::Array(value)) => !value.is_empty(),
        Some(JsonValue::Object(value)) => !value.is_empty(),
        Some(JsonValue::Number(value)) => value.as_f64().unwrap_or(0.0) != 0.0,
    }
}

fn parse_runtime_literal(input: &str) -> JsonValue {
    let trimmed = input.trim();
    if trimmed.starts_with('[') || trimmed.starts_with('{') {
        if let Ok(value) = serde_json::from_str::<JsonValue>(trimmed) {
            return value;
        }
    }
    if trimmed == "true" {
        return JsonValue::Bool(true);
    }
    if trimmed == "false" {
        return JsonValue::Bool(false);
    }
    if let Ok(number) = trimmed.parse::<f64>() {
        if let Some(number) = JsonNumber::from_f64(number) {
            return JsonValue::Number(number);
        }
    }
    JsonValue::String(normalize_literal(trimmed))
}

fn value_to_string(value: &JsonValue) -> String {
    match value {
        JsonValue::Null => String::new(),
        JsonValue::Bool(value) => value.to_string(),
        JsonValue::Number(value) => value.to_string(),
        JsonValue::String(value) => value.clone(),
        JsonValue::Array(_) | JsonValue::Object(_) => serde_json::to_string(value).unwrap_or_default(),
    }
}

fn html_escape(s: &str) -> String {
    s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#39;")
}

/// Render inline CSS from the page's style definition.
/// Uses the CSS compiler to resolve tokens, presets, and inheritance.
fn render_styles(frontend: &ast::RuneWebFrontend, style_ref: Option<String>) -> String {
    let style_def = style_ref.and_then(|ref_name| frontend.style_definitions.get(&ref_name));

    if let Some(style) = style_def {
        let mut compiler = css::CssCompiler::new(style);
        let compiled_css = compiler.compile(&style.rules);
        format!("<style>\n{}</style>", compiled_css)
    } else {
        String::new()
    }
}

/// Render JavaScript setup for client-side logic.
/// Uses the JavaScript code generator to create functional handler code.
fn render_logic(page: Option<&ast::PageDefinition>, logic: Option<ast::LogicDefinition>) -> String {
    match (page, logic) {
        (Some(page), Some(logic)) => {
            let codegen = jscodegen::JsCodegen::new(page.view_tree.clone(), logic);
            let js_code = codegen.generate();
            format!("<script>\n{}</script>", js_code)
        }
        _ => String::new(),
    }
}

