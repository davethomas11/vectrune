use serde_json::json;

pub fn build_openapi_components(
    doc: &crate::rune_ast::RuneDocument,
) -> serde_json::Map<String, serde_json::Value> {
    let mut schemas = serde_json::Map::new();

    for section in &doc.sections {
        if section.path.first().map(|s| s.as_str()) != Some("Schema") {
            continue;
        }

        let Some(schema_name) = section.path.get(1) else {
            continue;
        };

        let mut properties = serde_json::Map::new();
        let mut required = Vec::new();

        for (field_name, field_type) in &section.kv {
            if let Some(field_type) = field_type.as_str() {
                properties.insert(field_name.clone(), rune_schema_field_type(field_type));
                required.push(field_name.clone());
            }
        }

        schemas.insert(
            schema_name.clone(),
            json!({
                "type": "object",
                "properties": properties,
                "required": required
            }),
        );
    }

    schemas
}

fn rune_schema_field_type(field_type: &str) -> serde_json::Value {
    match field_type {
        "number" => json!({ "type": "number" }),
        "bool" => json!({ "type": "boolean" }),
        "string" => json!({ "type": "string" }),
        other => json!({ "$ref": format!("#/components/schemas/{}", other) }),
    }
}

