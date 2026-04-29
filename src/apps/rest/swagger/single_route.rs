use serde_json::json;
use std::collections::HashSet;
use regex::Regex;

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
    operation.insert(
        "responses".to_string(),
        json!({
            "200": { "description": "OK" }
        }),
    );

    add_path_parameters(&mut operation, axum_path);

    // Add request body for POST and PUT
    if method == "post" || method == "put" {
        add_expect_request_body(&mut operation, section, components_schemas);
    }

    path_item.insert(method.to_string(), serde_json::Value::Object(operation));
}

pub fn add_path_parameters(
    operation: &mut serde_json::Map<String, serde_json::Value>,
    path: &str,
) {
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

