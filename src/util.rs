use crate::rune_ast;
use crate::rune_ast::RuneDocument;
use serde_json::Value;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Once;

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

pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

static mut LOG_LEVEL: Option<AtomicUsize> = None;
static INIT: Once = Once::new();

fn log_level_to_usize(level: &LogLevel) -> usize {
    match level {
        LogLevel::Debug => 0,
        LogLevel::Info => 1,
        LogLevel::Warn => 2,
        LogLevel::Error => 3,
    }
}

fn get_log_level() -> LogLevel {
    unsafe {
        INIT.call_once(|| {
            LOG_LEVEL = Some(AtomicUsize::new(log_level_to_usize(&LogLevel::Info)));
        });
        match LOG_LEVEL.as_ref().unwrap().load(Ordering::Relaxed) {
            0 => LogLevel::Debug,
            1 => LogLevel::Info,
            2 => LogLevel::Warn,
            3 => LogLevel::Error,
            _ => LogLevel::Info,
        }
    }
}

pub fn set_log_level(level: LogLevel) {
    unsafe {
        INIT.call_once(|| {
            LOG_LEVEL = Some(AtomicUsize::new(log_level_to_usize(&level)));
        });
        LOG_LEVEL.as_ref().unwrap().store(log_level_to_usize(&level), Ordering::Relaxed);
    }
}

pub fn log(level: LogLevel, msg: &str) {
    if log_level_to_usize(&level) < log_level_to_usize(&get_log_level()) {
        return;
    }
    let prefix = match level {
        LogLevel::Debug => "[DEBUG]",
        LogLevel::Info => "[INFO]",
        LogLevel::Warn => "[WARN]",
        LogLevel::Error => "[ERROR]",
    };
    println!("{} {}", prefix, msg);
}
