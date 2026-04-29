pub mod crud;
pub mod single_route;
pub mod schema;

use serde_json::json;

pub fn generate_openapi_json(doc: &crate::rune_ast::RuneDocument) -> String {
    let mut paths = serde_json::Map::new();
    let components_schemas = schema::build_openapi_components(doc);

    for section in &doc.sections {
        if section.path.first().map(|s| s.as_str()) == Some("Route") {
            if section.path.len() < 3 {
                continue;
            }
            let method = section
                .path
                .get(1)
                .map(|s| s.as_str())
                .unwrap_or("GET")
                .to_lowercase();
            let path_template = section
                .path
                .iter()
                .skip(2)
                .map(|s| s.as_str())
                .collect::<Vec<_>>()
                .join("/");
            let axum_path = format!("/{}", path_template);

            let description = section
                .kv
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if method == "crud" {
                crud::add_crud_routes(&mut paths, &axum_path, description, section, &components_schemas);
                continue;
            }

            single_route::add_single_route(&mut paths, &method, &axum_path, description, section, &components_schemas);
        }
    }

    let openapi = json!({
        "openapi": "3.0.0",
        "info": {
            "title": "Vectrune API",
            "version": "1.0.0"
        },
        "paths": paths,
        "components": {
            "schemas": components_schemas
        }
    });

    serde_json::to_string_pretty(&openapi).unwrap()
}

