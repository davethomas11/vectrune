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
use crate::builtins::builtin::memory::get_memory_value;
use axum::{extract::Query, response::Html, routing::get, Router};
use serde_json::{Map as JsonMap, Number as JsonNumber, Value as JsonValue};
use std::collections::HashMap;

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

    let active_locale = frontend_section
        .and_then(|s| s.kv.get("locale"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let mount_path_raw = frontend_section
        .and_then(|s| s.kv.get("path"))
        .and_then(|v| v.as_str())
        .unwrap_or("/");
    let mount_path = normalize_mount_path(mount_path_raw);

    log(
        LogLevel::Info,
        &format!(
            "Rune-Web: loading page '{}' at mount path '{}'",
            page_name, mount_path
        ),
    );

    // Extract reactivity settings from Frontend section
    let reactivity_mode = frontend_section
        .and_then(|s| s.kv.get("reactivity"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let ws_endpoint = frontend_section
        .and_then(|s| s.kv.get("endpoint"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    match parser::parse_rune_web_frontend(&state.doc, page_name) {
        Ok(mut frontend) => {
            log(
                LogLevel::Info,
                &format!(
                    "Rune-Web: parsed {} page, {} styles, {} logic blocks",
                    if frontend.page_views.is_empty() { "0" } else { "1" },
                    frontend.style_definitions.len(),
                    frontend.logic_definitions.len()
                ),
            );

            // Auto-inject logic for websocket reactivity if not already present
            if reactivity_mode.as_deref() == Some("websocket") {
                if let Some(page_def) = frontend.page_views.get(page_name) {
                    if page_def.logic_ref.is_none() {
                        // Create a default logic block for websocket support
                        let resolved_endpoint = ws_endpoint.as_ref().map(|s| s.as_str()).unwrap_or("/ws");
                        let auto_logic = create_websocket_logic_block(resolved_endpoint);
                        frontend.logic_definitions.insert("_auto_websocket".to_string(), auto_logic);

                        // Update page reference to point to auto-generated logic
                        if let Some(page_def) = frontend.page_views.get_mut(page_name) {
                            page_def.logic_ref = Some("_auto_websocket".to_string());
                        }
                    }
                }
            }

            let frontend = frontend.clone();
            let page_name = page_name.to_string();
            let default_locale = active_locale.clone();
            let ws_endpoint = ws_endpoint.clone();

            Router::new().route(mount_path, get(move |Query(params): Query<HashMap<String, String>>| {
                let frontend = frontend.clone();
                let page_name = page_name.clone();
                let default_locale = default_locale.clone();
                let ws_endpoint = ws_endpoint.clone();
                async move {
                    let request_locale = params
                        .get("locale")
                        .map(String::as_str)
                        .filter(|locale| frontend.i18n_sections.contains_key(*locale));
                    let html = render_page_html(
                        &frontend,
                        &page_name,
                        request_locale,
                        default_locale.as_deref(),
                        ws_endpoint,
                    ).await;
                    Html(html)
                }
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

pub async fn render_html_for_path(
    doc: &crate::rune_ast::RuneDocument,
    request_path: &str,
) -> anyhow::Result<String> {
    let frontend_section = doc
        .sections
        .iter()
        .find(|s| s.path.first().map(|p| p.as_str()) == Some("Frontend"))
        .ok_or_else(|| anyhow::anyhow!("-o html requires an @Frontend section"))?;

    let frontend_type = frontend_section
        .kv
        .get("type")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("@Frontend type is required for -o html"))?;

    if frontend_type != "rune-web" {
        return Err(anyhow::anyhow!(
            "-o html expected @Frontend type = rune-web but found '{}'",
            frontend_type
        ));
    }

    let page_name = frontend_section
        .kv
        .get("page")
        .and_then(|v| v.as_str())
        .unwrap_or("index");

    let active_locale = frontend_section
        .kv
        .get("locale")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let mount_path = normalize_mount_path(
        frontend_section
            .kv
            .get("path")
            .and_then(|v| v.as_str())
            .unwrap_or("/"),
    );

    if canonicalize_path(request_path) != canonicalize_path(mount_path) {
        return Err(anyhow::anyhow!(
            "Requested path '{}' is not mounted by @Frontend path '{}'",
            normalize_request_path(request_path),
            mount_path
        ));
    }

    let reactivity_mode = frontend_section
        .kv
        .get("reactivity")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let ws_endpoint = frontend_section
        .kv
        .get("endpoint")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let mut frontend = parser::parse_rune_web_frontend(doc, page_name)
        .map_err(|e| anyhow::anyhow!("Rune-Web parse error: {}", e))?;

    if reactivity_mode.as_deref() == Some("websocket") {
        if let Some(page_def) = frontend.page_views.get(page_name) {
            if page_def.logic_ref.is_none() {
                let resolved_endpoint = ws_endpoint.as_deref().unwrap_or("/ws");
                let auto_logic = create_websocket_logic_block(resolved_endpoint);
                frontend
                    .logic_definitions
                    .insert("_auto_websocket".to_string(), auto_logic);

                if let Some(page_def) = frontend.page_views.get_mut(page_name) {
                    page_def.logic_ref = Some("_auto_websocket".to_string());
                }
            }
        }
    }

    Ok(
        render_page_html(
            &frontend,
            page_name,
            None,
            active_locale.as_deref(),
            ws_endpoint,
        )
        .await,
    )
}

async fn render_page_html(
    frontend: &ast::RuneWebFrontend,
    page_name: &str,
    request_locale: Option<&str>,
    default_locale: Option<&str>,
    ws_endpoint: Option<String>,
) -> String {
    let memory_keys = frontend
        .page_views
        .get(page_name)
        .map(|p| collect_memory_keys(&p.view_tree))
        .unwrap_or_default();
    let mut pre_fetched_memory: JsonMap<String, JsonValue> = JsonMap::new();
    for key in memory_keys {
        if let Some(value) = get_memory_value(&key).await {
            pre_fetched_memory.insert(key, value);
        }
    }

    render_frontend_shell(
        frontend,
        page_name,
        request_locale.or(default_locale),
        ws_endpoint,
        &pre_fetched_memory,
    )
}

fn normalize_mount_path(path: &str) -> &str {
    if path == "%ROOT%" {
        "/"
    } else {
        path
    }
}

fn normalize_request_path(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        "/".to_string()
    } else if trimmed.starts_with('/') {
        trimmed.to_string()
    } else {
        format!("/{}", trimmed)
    }
}

fn canonicalize_path(path: &str) -> String {
    let normalized = normalize_request_path(path);
    if normalized.len() > 1 {
        normalized.trim_end_matches('/').to_string()
    } else {
        normalized
    }
}

fn render_frontend_shell(frontend: &ast::RuneWebFrontend, page_name: &str, active_locale: Option<&str>, ws_endpoint: Option<String>, pre_fetched_memory: &JsonMap<String, JsonValue>) -> String {
    let page = frontend.page_views.get(page_name);
    let title = page
        .map(|page| page.title.as_str())
        .filter(|title| !title.is_empty())
        .unwrap_or("Vectrune Rune-Web");

    let logic = page
        .and_then(|p| p.logic_ref.as_ref())
        .and_then(|logic_name| frontend.logic_definitions.get(logic_name));
    let mut runtime_data = build_runtime_data(logic);

    // Merge pre-fetched memory values so MemoryBinding nodes resolve on SSR
    for (key, value) in pre_fetched_memory {
        runtime_data.insert(key.clone(), value.clone());
    }

    // Resolve active locale: explicit `locale = xx` on @Frontend, else first defined.
    let resolved_locale = active_locale
        .and_then(|l| frontend.i18n_sections.get(l).map(|s| (l.to_string(), s)))
        .or_else(|| {
            let mut keys: Vec<&String> = frontend.i18n_sections.keys().collect();
            keys.sort();
            keys.first().and_then(|k| frontend.i18n_sections.get(*k).map(|s| ((*k).clone(), s)))
        });

    // Inject the active locale's translations as runtime_data["i18n"]
    let i18n_json = if let Some((_, i18n)) = resolved_locale {
        let mut i18n_obj = serde_json::Map::new();
        for (group_name, entries) in &i18n.groups {
            let mut group_obj = serde_json::Map::new();
            for (key, val) in entries {
                group_obj.insert(key.clone(), JsonValue::String(val.clone()));
            }
            i18n_obj.insert(group_name.clone(), JsonValue::Object(group_obj));
        }
        let i18n_value = JsonValue::Object(i18n_obj);
        let json_str = serde_json::to_string(&i18n_value).unwrap_or_else(|_| "{}".to_string());
        runtime_data.insert("i18n".to_string(), i18n_value);
        json_str
    } else {
        "{}".to_string()
    };

    let locals = JsonMap::new();

    let page_html = page
        .map(|p| render_view_node(&p.view_tree, &runtime_data, &locals))
        .unwrap_or_else(|| String::from("<p>Page not found</p>"));

    let style_html = render_styles(frontend, page.and_then(|p| p.style_ref.clone()));
    let logic_html = render_logic(page, logic.cloned(), &i18n_json, ws_endpoint, pre_fetched_memory);

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
        ast::ViewNode::Comment(s) => format!("<!-- {} -->", interpolate_template(s, data, locals)),
        ast::ViewNode::ComponentScope { props, body } => {
            // Merge component props into data so they are available for interpolation
            // but do NOT appear in data-rune-scope (which is reserved for loop locals).
            let mut child_data = data.clone();
            for (key, value) in props {
                child_data.insert(
                    key.clone(),
                    serde_json::Value::String(
                        interpolate_template(value, data, locals),
                    ),
                );
            }
            render_view_node(body, &child_data, locals)
        }
        ast::ViewNode::MemoryBinding { var, key, body } => {
            // SSR: memory may not be populated yet; look it up from data if present.
            let mem_value = data.get(key.as_str()).cloned().unwrap_or(JsonValue::Null);
            let mut child_locals = locals.clone();
            child_locals.insert(var.clone(), mem_value);
            body.iter()
                .map(|child| render_view_node(child, data, &child_locals))
                .collect::<Vec<_>>()
                .join("")
        }
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
        let rendered_classes: Vec<String> = classes
            .iter()
            .map(|c| interpolate_template(c, data, locals))
            .filter(|c| !c.is_empty())
            .collect();
        if !rendered_classes.is_empty() {
            elem.push_str(&format!(r#" class="{}""#, rendered_classes.join(" ")));
        }
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

/// Walk the view tree and collect all memory keys referenced by MemoryBinding nodes.
fn collect_memory_keys(node: &ast::ViewNode) -> Vec<String> {
    let mut keys = Vec::new();
    collect_memory_keys_inner(node, &mut keys);
    keys
}

fn collect_memory_keys_inner(node: &ast::ViewNode, keys: &mut Vec<String>) {
    match node {
        ast::ViewNode::MemoryBinding { key, body, .. } => {
            keys.push(key.clone());
            for child in body {
                collect_memory_keys_inner(child, keys);
            }
        }
        ast::ViewNode::Element { children, .. } => {
            for child in children {
                collect_memory_keys_inner(child, keys);
            }
        }
        ast::ViewNode::Loop { body, .. } => {
            for child in body {
                collect_memory_keys_inner(child, keys);
            }
        }
        ast::ViewNode::Conditional { body, .. } => {
            for child in body {
                collect_memory_keys_inner(child, keys);
            }
        }
        ast::ViewNode::ComponentScope { body, .. } => {
            collect_memory_keys_inner(body, keys);
        }
        ast::ViewNode::Text(_) | ast::ViewNode::Comment(_) => {}
    }
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

/// Expand `%i18n.Group.key%` shorthand to `{i18n.Group.key}` before template interpolation.
fn expand_percent_i18n(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '%' {
            // Collect until closing %
            let mut inner = String::new();
            let mut closed = false;
            for c in chars.by_ref() {
                if c == '%' {
                    closed = true;
                    break;
                }
                inner.push(c);
            }
            if closed && inner.starts_with("i18n.") {
                output.push('{');
                output.push_str(&inner);
                output.push('}');
            } else {
                // Not a recognized %...% token — pass through verbatim
                output.push('%');
                output.push_str(&inner);
                if closed {
                    output.push('%');
                }
            }
        } else {
            output.push(ch);
        }
    }
    output
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
    const LITERAL_OPEN_BRACE: &str = "\u{E000}";
    const LITERAL_CLOSE_BRACE: &str = "\u{E001}";

    // Pre-pass: rewrite %i18n.Group.key% → {i18n.Group.key}
    let template = expand_percent_i18n(template);

    let mut rendered = String::new();
    let mut chars = template.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\\' {
            if let Some(next) = chars.next() {
                match next {
                    'n' => rendered.push('\n'),
                    'r' => rendered.push('\r'),
                    't' => rendered.push('\t'),
                    '"' => rendered.push('"'),
                    '\'' => rendered.push('\''),
                    '\\' => rendered.push('\\'),
                    '{' => rendered.push_str(LITERAL_OPEN_BRACE),
                    '}' => rendered.push_str(LITERAL_CLOSE_BRACE),
                    other => rendered.push(other),
                }
            } else {
                rendered.push('\\');
            }
        } else if ch == '{' {
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
        .replace(LITERAL_OPEN_BRACE, "{")
        .replace(LITERAL_CLOSE_BRACE, "}")
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
fn render_logic(page: Option<&ast::PageDefinition>, logic: Option<ast::LogicDefinition>, i18n_json: &str, ws_endpoint: Option<String>, pre_fetched_memory: &JsonMap<String, JsonValue>) -> String {
    match (page, logic) {
        (Some(page), Some(logic)) => {
            let memory_seed: std::collections::HashMap<String, serde_json::Value> =
                pre_fetched_memory.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
            let codegen = jscodegen::JsCodegen::new(page.view_tree.clone(), logic, i18n_json.to_string(), ws_endpoint, memory_seed);
            let js_code = codegen.generate();
            format!("<script>\n{}</script>", js_code)
        }
        _ => String::new(),
    }
}

fn create_websocket_logic_block(_ws_endpoint: &str) -> ast::LogicDefinition {
    use std::collections::HashMap;

    // Create a minimal logic block with emit action support
    let mut actions = HashMap::new();

    // Add a built-in emit action
    actions.insert(
        "emit".to_string(),
        ast::ActionDefinition {
            params: vec!["event_name".to_string(), "payload".to_string()],
            steps: vec![
                // This will be handled in the JavaScript runtime
                ast::ActionStep::Statement("window.__runeWebEmit(event_name, payload)".to_string()),
            ],
        },
    );

    ast::LogicDefinition {
        state: HashMap::new(),
        derived: HashMap::new(),
        helpers: HashMap::new(),
        actions,
    }
}
