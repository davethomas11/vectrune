use std::collections::HashMap;
use crate::rune_ast::Value;

#[derive(Debug, Clone)]
pub struct LanguageDefinition {
    pub language_code: String,
    pub name: String,
    pub intents: Vec<IntentRule>,
}

#[derive(Debug, Clone)]
pub struct IntentRule {
    pub intent_id: String,
    pub mandatory: Vec<String>,
    pub optional: Vec<String>,
    pub phrases: Vec<String>,
    pub attributes: HashMap<String, Value>,
}
