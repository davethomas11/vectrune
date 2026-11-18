use regex::Regex;
use serde_json::json;
use std::collections::{BTreeSet, HashSet};

pub fn add_single_route(
    paths: &mut serde_json::Map<String, serde_json::Value>,
    method: &str,
    axum_path: &str,
    description: &str,
    section: &crate::rune_ast::Section,
    components_schemas: &serde_json::Map<String, serde_json::Value>,
) {
    let path_item = paths
        .entry(axum_path.to_string())
        .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()))
        .as_object_mut()
        .unwrap();

    let mut operation = serde_json::Map::new();
    operation.insert(
        "summary".to_string(),
        json!(format!("{} {}", method.to_uppercase(), axum_path)),
    );
    operation.insert("description".to_string(), json!(description));
    operation.insert("responses".to_string(), route_responses(section));

    add_path_parameters(&mut operation, axum_path);

    // Add request body for POST and PUT
    if method == "post" || method == "put" {
        add_expect_request_body(&mut operation, section, components_schemas);
    }

    path_item.insert(method.to_string(), serde_json::Value::Object(operation));
}

pub fn response_definitions(statuses: impl IntoIterator<Item = u16>) -> serde_json::Value {
    let responses: serde_json::Map<String, serde_json::Value> = statuses
        .into_iter()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .map(|status| {
            let mut response = serde_json::Map::new();
            response.insert(
                "description".to_string(),
                json!(format!("Response returned by the route (HTTP {}).", status)),
            );
            if status != 204 && status != 304 && !(100..200).contains(&status) {
                response.insert(
                    "content".to_string(),
                    json!({
                        "text/plain": {
                            "schema": { "type": "string" }
                        }
                    }),
                );
            }
            (status.to_string(), serde_json::Value::Object(response))
        })
        .collect();
    serde_json::Value::Object(responses)
}

fn route_responses(section: &crate::rune_ast::Section) -> serde_json::Value {
    let mut statuses = BTreeSet::new();
    let mut has_unconditional_response = false;
    for step in section.series.get("run").into_iter().flatten() {
        collect_responses(step, false, &mut statuses, &mut has_unconditional_response);
    }

    // The executor turns builtin failures into HTTP 500. Validation can return
    // 400, while a run series without an unconditional response falls through
    // to the normal HTTP 200 result.
    statuses.insert(500);
    if !has_unconditional_response {
        statuses.insert(200);
    }
    response_definitions(statuses)
}

fn collect_responses(
    step: &crate::rune_ast::Value,
    conditional: bool,
    statuses: &mut BTreeSet<u16>,
    has_unconditional_response: &mut bool,
) {
    use crate::rune_ast::Value;

    match step {
        Value::String(statement) => {
            let statement = statement.trim();
            let command = crate::core::find_assignment_equals(statement)
                .map(|index| statement[index + 1..].trim())
                .unwrap_or(statement);
            let mut parts = command.split_whitespace();
            match parts.next() {
                Some("respond") => {
                    let status = parts
                        .next()
                        .and_then(|value| value.parse().ok())
                        .unwrap_or(200);
                    let status = axum::http::StatusCode::from_u16(status)
                        .map(|status| status.as_u16())
                        .unwrap_or(200);
                    statuses.insert(status);
                    if !conditional {
                        *has_unconditional_response = true;
                    }
                }
                Some("validate") => {
                    statuses.insert(400);
                }
                _ => {}
            }
        }
        Value::List(items) => {
            for item in items {
                collect_responses(item, conditional, statuses, has_unconditional_response);
            }
        }
        Value::Map(fields) => {
            for value in fields.values() {
                collect_responses(value, true, statuses, has_unconditional_response);
            }
        }
        _ => {}
    }
}

pub fn add_path_parameters(operation: &mut serde_json::Map<String, serde_json::Value>, path: &str) {
    let param_regex = Regex::new(r"\{([a-zA-Z_]\w*)\}").unwrap();
    let mut params = Vec::new();
    let mut found_params = HashSet::new();

    for cap in param_regex.captures_iter(path) {
        if let Some(param_name) = cap.get(1) {
            let name = param_name.as_str();
            if found_params.insert(name.to_string()) {
                params.push(json!({
                    "name": name,
                    "in": "path",
                    "required": true,
                    "schema": { "type": "string" }
                }));
            }
        }
    }

    if !params.is_empty() {
        operation.insert("parameters".to_string(), serde_json::Value::Array(params));
    }
}

pub fn add_expect_request_body(
    operation: &mut serde_json::Map<String, serde_json::Value>,
    section: &crate::rune_ast::Section,
    components: &serde_json::Map<String, serde_json::Value>,
) {
    let Some(expect) = section.kv.get("expect").and_then(|v| v.as_str()) else {
        return;
    };

    if !components.contains_key(expect) {
        return;
    }

    operation.insert(
        "requestBody".to_string(),
        json!({
            "required": true,
            "content": {
                "application/json": {
                    "schema": {
                        "$ref": format!("#/components/schemas/{}", expect)
                    }
                }
            }
        }),
    );
}
