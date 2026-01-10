use crate::rune_ast;
use crate::rune_ast::RuneDocument;
use serde_json::Value;

pub fn json_to_xml(value: &Value, root: &str) -> String {
    fn escape_xml(s: &str) -> String {
        s.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&apos;")
    }

    fn helper(value: &Value, root: &str, indent: usize) -> String {
        let indent_str = "  ".repeat(indent);
        let root = escape_xml(root);
        match value {
            Value::Object(map) => {
                let mut xml = format!("{}<{}>\n", indent_str, root);
                for (k, v) in map {
                    xml.push_str(&helper(v, k, indent + 1));
                }
                xml.push_str(&format!("{}</{}>\n", indent_str, root));
                xml
            }
            Value::Array(arr) => {
                let mut xml = String::new();
                for v in arr {
                    xml.push_str(&helper(v, &root, indent));
                }
                xml
            }
            Value::String(s) => format!("{}<{}>{}</{}>\n", indent_str, root, escape_xml(s), root),
            Value::Number(n) => format!("{}<{}>{}</{}>\n", indent_str, root, n, root),
            Value::Bool(b) => format!("{}<{}>{}</{}>\n", indent_str, root, b, root),
            Value::Null => format!("{}<{}/>\n", indent_str, root),
        }
    }
    helper(value, root, 0)
}

pub fn api_doc(doc: &RuneDocument) -> String {
    let routes = doc.get_sections("Route");
    let mut api_description = String::new();
    for route in routes {
        if let Some(path) = route.path.join("/").strip_prefix("Route/").and_then(|p| {
            p.strip_prefix(&format!(
                "{}/",
                route.path.get(1).map(|s| s.as_str()).unwrap_or("GET")
            ))
        }) {
            let method = route.path.get(1).map(|s| s.as_str()).unwrap_or("GET");
            let description = match route.kv.get("description") {
                Some(rune_ast::Value::String(d)) => d.clone(),
                _ => "".to_string(),
            };
            api_description.push_str(&format!("{} {}\n", method, path));
            if !description.is_empty() {
                api_description.push_str(&format!("  Description: {}\n", description));
            }
            api_description.push_str("\n");
        }
    }
    return api_description;
}
