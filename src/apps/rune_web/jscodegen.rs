/// JavaScript code generation for Rune-Web client-side logic.
///
/// This module emits a compact browser runtime that can:
/// - bootstrap state from `@Logic`
/// - render a serialized `@Page` AST into `#app`
/// - interpolate `{path}` templates against state, derived values, and loop locals
/// - dispatch `data-on-*` events with evaluated arguments
/// - execute a small interpreted subset of action steps

use super::ast::{LogicDefinition, ViewNode};
use std::collections::HashMap;

/// JavaScript code generator from a page + logic definition.
pub struct JsCodegen {
    page: ViewNode,
    logic: LogicDefinition,
    i18n_json: String,
    ws_endpoint: Option<String>,
    /// Memory values pre-fetched at request time, seeded into initial JS state.
    memory_seed: HashMap<String, serde_json::Value>,
}

impl JsCodegen {
    /// Create a new code generator from a page tree, logic definition, and i18n JSON.
    pub fn new(page: ViewNode, logic: LogicDefinition, i18n_json: String, ws_endpoint: Option<String>, memory_seed: HashMap<String, serde_json::Value>) -> Self {
        JsCodegen { page, logic, i18n_json, ws_endpoint, memory_seed }
    }

    /// Generate complete JavaScript application code.
    pub fn generate(&self) -> String {
        let state_json = self.generate_state_json();
        
        let mut normalized_derived = HashMap::new();
        for (name, def) in &self.logic.derived {
            let mut normalized_cases = Vec::new();
            for case in &def.cases {
                normalized_cases.push(serde_json::json!({
                    "matcher": case.matcher,
                    "value": case.value // Keep as string for evaluateExpression
                }));
            }
            normalized_derived.insert(name.clone(), serde_json::json!({
                "source": def.source,
                "cases": normalized_cases
            }));
        }
        let derived_json = serde_json::to_string(&normalized_derived)
            .unwrap_or_else(|_| "{}".to_string());

        let helper_json = serde_json::to_string(&self.logic.helpers)
            .unwrap_or_else(|_| "{}".to_string());
        let actions_json = serde_json::to_string(&self.logic.actions)
            .unwrap_or_else(|_| "{}".to_string());
        let page_json = serde_json::to_string(&self.page)
            .unwrap_or_else(|_| "{}".to_string());
        let i18n_json = &self.i18n_json;

        let state_json = self.generate_state_json();
        let ws_endpoint = if let Some(endpoint) = &self.ws_endpoint {
            format!("'{}'", endpoint)
        } else {
            "null".to_string()
        };

        format!(
            r#"
{}
__RuneWeb.boot({{
  pageTree: {page_json},
  derivedDefinitions: {derived_json},
  helperDefinitions: {helper_json},
  actionDefinitions: {actions_json},
  i18nData: {i18n_json},
  stateJson: {state_json},
  wsEndpoint: {ws_endpoint}
}});
"#,
            include_str!("../../../runtime/rune-web/dist/rune-runtime.js")
        )
    }

    fn generate_state_json(&self) -> String {
        let mut normalized = serde_json::Map::new();
        for (key, val) in &self.logic.state {
            normalized.insert(key.clone(), self.parse_value(val));
        }
        for (key, val) in &self.memory_seed {
            normalized.insert(key.clone(), val.clone());
        }
        serde_json::Value::Object(normalized).to_string()
    }

    fn parse_value(&self, val: &str) -> serde_json::Value {
        let trimmed = val.trim();
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
            return value;
        }
        if trimmed == "true" {
            return serde_json::Value::Bool(true);
        }
        if trimmed == "false" {
            return serde_json::Value::Bool(false);
        }
        if trimmed == "null" {
            return serde_json::Value::Null;
        }
        if let Ok(number) = trimmed.parse::<f64>() {
            if let Some(number) = serde_json::Number::from_f64(number) {
                return serde_json::Value::Number(number);
            }
        }
        serde_json::Value::String(normalize_literal(trimmed))
    }
}

fn normalize_literal(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() >= 2
        && ((trimmed.starts_with('"') && trimmed.ends_with('"'))
            || (trimmed.starts_with('\'') && trimmed.ends_with('\'')))
    {
        trimmed[1..trimmed.len() - 1].to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::apps::rune_web::ast::{
        ActionDefinition, ActionStep, DerivedCase, DerivedDefinition, HelperDefinition,
    };
    use std::collections::HashMap;

    #[test]
    fn generates_page_bootstrap_and_runtime_hooks() {
        let logic = LogicDefinition {
            state: [("count".to_string(), "0".to_string())]
                .iter()
                .cloned()
                .collect(),
            derived: HashMap::from([(
                "label".to_string(),
                DerivedDefinition {
                    source: "count".to_string(),
                    cases: vec![DerivedCase {
                        matcher: "_".to_string(),
                        value: "Value: {count}".to_string(),
                    }],
                },
            )]),
            helpers: HashMap::from([(
                "is_even".to_string(),
                HelperDefinition {
                    params: vec!["value".to_string()],
                    body: vec!["return value == 0".to_string()],
                },
            )]),
            actions: HashMap::from([(
                "increment".to_string(),
                ActionDefinition {
                    params: vec![],
                    steps: vec![ActionStep::Statement("count = count + 1".to_string())],
                },
            )]),
        };
        let page = ViewNode::Element {
            tag: "main".to_string(),
            classes: vec![],
            id: None,
            attrs: HashMap::new(),
            events: HashMap::new(),
            text: None,
            for_each: None,
            children: vec![ViewNode::Element {
                tag: "p".to_string(),
                classes: vec![],
                id: None,
                attrs: HashMap::new(),
                events: HashMap::new(),
                text: Some("{label}".to_string()),
                for_each: None,
                children: vec![],
            }],
        };

        let gen = JsCodegen::new(page, logic, "{}".to_string(), None, HashMap::new());
        let code = gen.generate();
        assert!(code.contains("__RuneWeb.boot({"));
        assert!(code.contains("pageTree:"));
        assert!(code.contains("helperDefinitions:"));
        assert!(code.contains("actionDefinitions:"));
    }

    #[test]
    fn parses_value_literals_to_json() {
        let logic = LogicDefinition {
            state: HashMap::new(),
            derived: HashMap::new(),
            helpers: HashMap::new(),
            actions: HashMap::new(),
        };
        let gen = JsCodegen::new(ViewNode::Text("hi".to_string()), logic, "{}".to_string(), None, HashMap::new());
        assert_eq!(gen.parse_value("\"hello\""), serde_json::Value::String("hello".to_string()));
        assert_eq!(gen.parse_value("42"), serde_json::json!(42));
        assert_eq!(gen.parse_value("true"), serde_json::json!(true));
        assert_eq!(gen.parse_value("[1,2,3]"), serde_json::json!([1, 2, 3]));
    }
}
