use serde_json::json;
use super::single_route::add_expect_request_body;

pub fn add_crud_routes(
    paths: &mut serde_json::Map<String, serde_json::Value>,
    axum_path: &str,
    description: &str,
    section: &crate::rune_ast::Section,
    components_schemas: &serde_json::Map<String, serde_json::Value>,
) {
    for m in &["get", "post", "put", "delete"] {
        for &with_id in &[false, true] {
            let path = if with_id {
                format!("{}/{{id}}", axum_path)
            } else {
                axum_path.to_string()
            };

            let path_item = paths
                .entry(path.clone())
                .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()))
                .as_object_mut()
                .unwrap();

            let mut operation = serde_json::Map::new();
            operation.insert(
                "summary".to_string(),
                json!(format!("{} {}", m.to_uppercase(), path)),
            );
            operation.insert("description".to_string(), json!(description));
            operation.insert(
                "responses".to_string(),
                json!({
                    "200": { "description": "OK" }
                }),
            );

            if with_id {
                operation.insert(
                    "parameters".to_string(),
                    json!([
                        {
                            "name": "id",
                            "in": "path",
                            "required": true,
                            "schema": { "type": "string" }
                        }
                    ]),
                );
            }

            // Add request body for POST and PUT
            if *m == "post" || *m == "put" {
                add_expect_request_body(&mut operation, section, components_schemas);
            }

            path_item.insert(m.to_string(), serde_json::Value::Object(operation));
        }
    }
}

