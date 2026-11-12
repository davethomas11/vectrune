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
pub mod optimizer;

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

            let mut mounts = vec![(mount_path.to_string(), default_locale)];
            if let Some(crate::rune_ast::Value::Map(paths)) = frontend_section.and_then(|s| s.kv.get("locale_paths")) {
                for (locale, path) in paths {
                    if let Some(path) = path.as_str() {
                        if path.starts_with('/') && !path.contains(['?', '#', '{', '}'])
                            && path != mount_path && frontend.i18n_sections.contains_key(locale)
                        {
                            mounts.push((path.to_string(), Some(locale.clone())));
                        }
                    }
                }
            }
            // Stable ordering makes duplicate path configuration deterministic.
            mounts.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)));
            mounts.dedup_by(|a, b| a.0 == b.0);
            let mut router = Router::new();
            for (path, default_locale) in mounts {
                let frontend = frontend.clone();
                let page_name = page_name.clone();
                let ws_endpoint = ws_endpoint.clone();
                router = router.route(&path, get(move |Query(params): Query<HashMap<String, String>>| {
                    let frontend = frontend.clone();
                    let page_name = page_name.clone();
                    let default_locale = default_locale.clone();
                    let ws_endpoint = ws_endpoint.clone();
                    async move {
                        let request_locale = params
                            .get("locale")
                            .map(String::as_str)
                            .filter(|locale| frontend.i18n_sections.contains_key(*locale));
                        let target_route = params.get("page").map(String::as_str);
                        let html = render_page_html(
                            &frontend,
                            &page_name,
                            request_locale,
                            default_locale.as_deref(),
                            ws_endpoint,
                            target_route,
                        ).await;
                        Html(html)
                    }
                }));
            }
            router
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

    let path_locale = frontend_section.kv.get("locale_paths").and_then(|value| {
        if let crate::rune_ast::Value::Map(paths) = value {
            paths.iter().find_map(|(locale, path)| {
                path.as_str().filter(|path| canonicalize_path(path) == canonicalize_path(request_path))
                    .map(|_| locale.as_str())
            })
        } else { None }
    });
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

    let trimmed_route = request_path.trim_matches('/').to_lowercase();
    let is_subpath_or_route = canonicalize_path(request_path) == canonicalize_path(mount_path)
        || path_locale.is_some()
        || ((mount_path == "/" || normalize_request_path(request_path).starts_with(mount_path))
            && (frontend.navigator.is_some()
                || frontend.page_views.contains_key(&trimmed_route)
                || frontend.seo.as_ref().map_or(false, |s| s.routes.contains_key(&trimmed_route))));

    if !is_subpath_or_route {
        return Err(anyhow::anyhow!(
            "Requested path '{}' is not mounted by @Frontend path '{}'",
            normalize_request_path(request_path),
            mount_path
        ));
    }

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

    let target_route = {
        let trimmed = request_path.trim_matches('/');
        if trimmed.is_empty() || trimmed == "es" || trimmed == "fr" {
            None
        } else {
            Some(trimmed)
        }
    };

    Ok(
        render_page_html(
            &frontend,
            page_name,
            path_locale,
            active_locale.as_deref(),
            ws_endpoint,
            target_route,
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
    target_route: Option<&str>,
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
        target_route,
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

fn render_frontend_shell(
    frontend: &ast::RuneWebFrontend,
    page_name: &str,
    active_locale: Option<&str>,
    ws_endpoint: Option<String>,
    pre_fetched_memory: &JsonMap<String, JsonValue>,
    target_route: Option<&str>,
) -> String {
    let page = frontend.page_views.get(page_name);

    let logic = page
        .and_then(|p| p.logic_ref.as_ref())
        .and_then(|logic_name| frontend.logic_definitions.get(logic_name));
    let mut runtime_data = build_runtime_data(logic);

    // Merge pre-fetched memory values so MemoryBinding nodes resolve on SSR
    for (key, value) in pre_fetched_memory {
        runtime_data.insert(key.clone(), value.clone());
    }

    // Resolve initial active route for SEO
    let initial_seo_route = target_route
        .map(|r| r.trim_matches('/').to_lowercase())
        .filter(|r| !r.is_empty())
        .or_else(|| {
            frontend.navigator.as_ref().and_then(|nav| {
                runtime_data.get(&nav.bind).and_then(|v| v.as_str()).map(|s| s.to_string())
            })
        });

    let default_seo = frontend.seo.as_ref();
    let route_seo = initial_seo_route.as_deref().and_then(|r| {
        default_seo.and_then(|s| s.routes.get(r))
    });

    let title_str = route_seo
        .and_then(|r| r.title.as_deref())
        .or_else(|| default_seo.and_then(|s| s.title.as_deref()))
        .or_else(|| page.map(|page| page.title.as_str()).filter(|title| !title.is_empty()))
        .unwrap_or("Vectrune");
    let title = html_escape(title_str);

    let description_str = route_seo
        .and_then(|r| r.description.as_deref())
        .or_else(|| default_seo.and_then(|s| s.description.as_deref()))
        .or_else(|| page.and_then(|p| p.description.as_deref()))
        .unwrap_or("Vectrune — Declarative Full-Stack Language and Reactive Web Framework");
    let description = html_escape(description_str);

    let image_str = route_seo
        .and_then(|r| r.image.as_deref())
        .or_else(|| default_seo.and_then(|s| s.image.as_deref()))
        .unwrap_or("/assets/rune-logo.png");
    let image = html_escape(image_str);

    // Resolve active locale: explicit `locale = xx` on @Frontend, else first defined.
    let resolved_locale = active_locale
        .and_then(|l| frontend.i18n_sections.get(l).map(|s| (l.to_string(), s)))
        .or_else(|| {
            let mut keys: Vec<&String> = frontend.i18n_sections.keys().collect();
            keys.sort();
            keys.first().and_then(|k| frontend.i18n_sections.get(*k).map(|s| ((*k).clone(), s)))
        });

    let document_language = resolved_locale.as_ref()
        .map(|(locale, _)| locale.replace('_', "-"))
        .unwrap_or_else(|| "en".to_string());
    let document_language = html_escape(&document_language);

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

    let optimized = if let (Some(opt), Some(p)) = (&frontend.optimizer, page) {
        let bound_var = frontend.navigator.as_ref().map(|n| n.bind.as_str());
        let opt_res = optimizer::extract_route_chunks(&p.view_tree, initial_seo_route.as_deref(), opt, bound_var);
        Some(opt_res)
    } else {
        None
    };

    let page_tree = optimized.as_ref().map(|o| &o.view_tree).or_else(|| page.map(|p| &p.view_tree));

    let page_html = page_tree
        .map(|tree| render_view_node(tree, &runtime_data, &locals))
        .unwrap_or_else(|| String::from("<p>Page not found</p>"));

    let style_html = render_styles(frontend, page.and_then(|p| p.style_ref.clone()));
    let logic_html = render_logic(
        page_tree,
        logic.cloned(),
        &i18n_json,
        ws_endpoint,
        pre_fetched_memory,
        frontend.navigator.clone(),
        frontend.seo.clone(),
        frontend.optimizer.clone(),
        frontend.sounds.clone(),
        frontend.music.clone(),
    );

    format!(
        r#"<!DOCTYPE html>
<html lang="{document_language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <meta name="description" content="{description}">

    <!-- OpenGraph / Social Media Link Previews -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:image" content="{image}">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{description}">
    <meta name="twitter:image" content="{image}">

    <!-- Favicon & Touch Icons -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon.png">
    <link rel="apple-touch-icon" href="/assets/favicon.png">

    {style_html}
</head>
<body>
    <div id="app">{page_html}</div>
    {logic_html}
</body>
</html>"#,
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
        ast::ViewNode::Match { expression, cases } => {
            let expr_val = resolve_expression_value(expression, data, locals)
                .unwrap_or(serde_json::Value::Null);
            let expr_str = value_to_string(&expr_val);
            let mut matched_html = String::new();
            for case in cases {
                let matcher = normalize_literal(&case.matcher);
                if matcher == "_" || matcher == expr_str {
                    matched_html = case.body.iter()
                        .map(|child| render_view_node(child, data, locals))
                        .collect::<Vec<_>>()
                        .join("");
                    break;
                }
            }
            matched_html
        }
        ast::ViewNode::Text(s) => html_escape(&interpolate_template(s, data, locals)),
        ast::ViewNode::Comment(s) => format!("<!-- {} -->", interpolate_template(s, data, locals)),
        ast::ViewNode::ComponentScope { props, body } => {
            // Merge component props into data so they are available for interpolation
            // but do NOT appear in data-rune-scope (which is reserved for loop locals).
            let mut child_data = data.clone();
            for (key, value) in props {
                let val_trimmed = value.trim();
                let prop_val = if val_trimmed.starts_with('{') && val_trimmed.ends_with('}') {
                    let expression = &val_trimmed[1..val_trimmed.len() - 1];
                    if expression.contains(" == ") || expression.contains(" != ") || expression.contains(" >= ") || expression.contains(" <= ") || expression.contains(" > ") || expression.contains(" < ") {
                        JsonValue::Bool(evaluate_condition(expression, data, locals))
                    } else {
                        resolve_expression_value(expression, data, locals).unwrap_or(JsonValue::Null)
                    }
                } else if val_trimmed.starts_with('"') || val_trimmed.starts_with('[') {
                    if let Ok(val) = serde_json::from_str::<JsonValue>(val_trimmed) {
                        val
                    } else {
                        JsonValue::String(val_trimmed.to_string())
                    }
                } else if val_trimmed == "true" {
                    JsonValue::Bool(true)
                } else if val_trimmed == "false" {
                    JsonValue::Bool(false)
                } else if let Ok(num) = val_trimmed.parse::<f64>() {
                    serde_json::Number::from_f64(num).map(JsonValue::Number).unwrap_or(JsonValue::Null)
                } else {
                    JsonValue::String(val_trimmed.to_string())
                };
                child_data.insert(key.clone(), prop_val);
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
        ast::ViewNode::LazyRoute { route, chunk_url, fallback } => {
            if !fallback.is_empty() {
                fallback.iter()
                    .map(|child| render_view_node(child, data, locals))
                    .collect::<Vec<_>>()
                    .join("")
            } else {
                format!(r#"<div class="rune-lazy-placeholder" data-route="{}" data-chunk="{}"></div>"#, html_escape(route), html_escape(chunk_url))
            }
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
            html_escape(&interpolate_template(handler, data, locals))
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
        ast::ViewNode::Match { cases, .. } => {
            for case in cases {
                for child in &case.body {
                    collect_memory_keys_inner(child, keys);
                }
            }
        }
        ast::ViewNode::ComponentScope { body, .. } => {
            collect_memory_keys_inner(body, keys);
        }
        ast::ViewNode::Text(_) | ast::ViewNode::Comment(_) | ast::ViewNode::LazyRoute { .. } => {}
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

    if trimmed.starts_with('"') {
        if let Ok(JsonValue::String(literal)) = serde_json::from_str::<JsonValue>(trimmed) {
            return Some(JsonValue::String(literal));
        }
    }

    if let Some((left, right)) = trimmed.split_once(" ?? ") {
        if let Some(l_val) = resolve_expression_value(left, data, locals) {
            let mut is_fallback = false;
            if let Some(s) = l_val.as_str() {
                if s == left.trim() && resolve_path_value(left.trim(), data, locals).is_none() {
                    is_fallback = true;
                }
            }
            if !l_val.is_null() && value_to_string(&l_val) != "" && !is_fallback {
                return Some(l_val);
            }
        }
        return resolve_expression_value(right, data, locals);
    }

    if let Some((left, right)) = trimmed.split_once(" ? ") {
        if let Some((true_branch, false_branch)) = right.split_once(" : ") {
            if evaluate_condition(left, data, locals) {
                return resolve_expression_value(true_branch, data, locals);
            } else {
                return resolve_expression_value(false_branch, data, locals);
            }
        }
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
    let mut trimmed = condition.trim();
    while trimmed.starts_with('(') && trimmed.ends_with(')') {
        trimmed = trimmed[1..trimmed.len() - 1].trim();
    }
    if let Some(negated) = trimmed.strip_prefix('!') {
        return !evaluate_condition(negated, data, locals);
    }
    if let Some((left, right)) = trimmed.split_once(" or ") {
        return evaluate_condition(left, data, locals) || evaluate_condition(right, data, locals);
    }
    if let Some((left, right)) = trimmed.split_once(" || ") {
        return evaluate_condition(left, data, locals) || evaluate_condition(right, data, locals);
    }
    if let Some((left, right)) = trimmed.split_once(" and ") {
        return evaluate_condition(left, data, locals) && evaluate_condition(right, data, locals);
    }
    if let Some((left, right)) = trimmed.split_once(" && ") {
        return evaluate_condition(left, data, locals) && evaluate_condition(right, data, locals);
    }
    if let Some((left, right)) = trimmed.split_once(" != ") {
        return resolve_expression_value(left, data, locals) != resolve_expression_value(right, data, locals);
    }
    if let Some((left, right)) = trimmed.split_once(" == ") {
        return resolve_expression_value(left, data, locals) == resolve_expression_value(right, data, locals);
    }
    if let Some((left, right)) = trimmed.split_once(" >= ") {
        let lv = resolve_expression_value(left, data, locals).and_then(|v| v.as_f64()).unwrap_or(0.0);
        let rv = resolve_expression_value(right, data, locals).and_then(|v| v.as_f64()).unwrap_or(0.0);
        return lv >= rv;
    }
    if let Some((left, right)) = trimmed.split_once(" <= ") {
        let lv = resolve_expression_value(left, data, locals).and_then(|v| v.as_f64()).unwrap_or(0.0);
        let rv = resolve_expression_value(right, data, locals).and_then(|v| v.as_f64()).unwrap_or(0.0);
        return lv <= rv;
    }
    if let Some((left, right)) = trimmed.split_once(" > ") {
        let lv = resolve_expression_value(left, data, locals).and_then(|v| v.as_f64()).unwrap_or(0.0);
        let rv = resolve_expression_value(right, data, locals).and_then(|v| v.as_f64()).unwrap_or(0.0);
        return lv > rv;
    }
    if let Some((left, right)) = trimmed.split_once(" < ") {
        let lv = resolve_expression_value(left, data, locals).and_then(|v| v.as_f64()).unwrap_or(0.0);
        let rv = resolve_expression_value(right, data, locals).and_then(|v| v.as_f64()).unwrap_or(0.0);
        return lv < rv;
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
fn render_logic(
    view_tree: Option<&ast::ViewNode>,
    logic: Option<ast::LogicDefinition>,
    i18n_json: &str,
    ws_endpoint: Option<String>,
    pre_fetched_memory: &JsonMap<String, JsonValue>,
    navigator: Option<ast::NavigatorDefinition>,
    seo: Option<ast::SeoDefinition>,
    optimizer: Option<ast::OptimizerDefinition>,
    sounds: std::collections::HashMap<String, ast::SoundDefinition>,
    music: std::collections::HashMap<String, ast::MusicDefinition>,
) -> String {
    match (view_tree, logic) {
        (Some(tree), Some(logic)) => {
            let memory_seed: std::collections::HashMap<String, serde_json::Value> =
                pre_fetched_memory.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
            let codegen = jscodegen::JsCodegen::new(
                tree.clone(),
                logic,
                i18n_json.to_string(),
                ws_endpoint,
                memory_seed,
                navigator,
                seo,
                optimizer,
                sounds,
                music,
            );
            let js_code = codegen.generate();
            format!("<script>\n{}</script>", js_code)
        }
        _ => String::new(),
    }
}

/// Export pre-split route chunks to static JSON files for `@Optimizer dynamic_xhr = on/auto`.
pub fn export_optimizer_chunks(
    doc: &crate::rune_ast::RuneDocument,
    page_name: &str,
    out_dir: &std::path::Path,
) -> anyhow::Result<usize> {
    let frontend = parser::parse_rune_web_frontend(doc, page_name)
        .map_err(|e| anyhow::anyhow!("Rune-Web parse error: {}", e))?;
    let optimizer = match &frontend.optimizer {
        Some(opt) if opt.is_active() => opt,
        _ => return Ok(0),
    };
    let page = frontend.page_views.get(page_name)
        .ok_or_else(|| anyhow::anyhow!("Page '{}' not found", page_name))?;

    let bound_var = frontend.navigator.as_ref().map(|n| n.bind.as_str());
    // Prune with active_route = None so all named route branches are extracted as chunks
    let opt_res = optimizer::extract_route_chunks(&page.view_tree, None, optimizer, bound_var);

    std::fs::create_dir_all(out_dir)?;
    let mut count = 0;
    for (route, chunk_body) in opt_res.chunks {
        let chunk_json = serde_json::to_string_pretty(&chunk_body)?;
        let dest = out_dir.join(format!("{}.json", route));
        std::fs::write(&dest, chunk_json)?;
        count += 1;
    }
    Ok(count)
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
        locals: HashMap::new(),
        derived: HashMap::new(),
        helpers: HashMap::new(),
        actions,
        timer: None,
        keys: HashMap::new(),
    }
}
