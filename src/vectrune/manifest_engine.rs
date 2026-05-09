use anyhow::{anyhow, bail, Result};
use std::collections::HashMap;
use rust_embed::RustEmbed;

use crate::rune_ast::Value;
use super::ast::{Intent, VectruneDocument};
use super::definition::{IntentRule, LanguageDefinition};
use super::engine::{normalize, LanguageEngine};

#[derive(RustEmbed)]
#[folder = "knowledge/languages/"]
struct Asset;

#[derive(Debug, Clone)]
pub struct ManifestEngine {
    pub definition: LanguageDefinition,
}

impl ManifestEngine {
    pub fn new(definition: LanguageDefinition) -> Self {
        Self { definition }
    }

    fn matches(&self, rule: &IntentRule, normalized_body: &str) -> bool {
        // Mandatory check
        for m in &rule.mandatory {
            let m_norm = normalize(m);
            if !normalized_body.contains(&m_norm) {
                println!("DEBUG: Mandatory mismatch: '{}' not in body", m_norm);
                return false;
            }
        }

        // Optional check (at least one optional or phrase if mandatory are met)
        // If there are no optional/phrases, mandatory is enough.
        if rule.optional.is_empty() && rule.phrases.is_empty() {
            return true;
        }

        for o in &rule.optional {
            let o_norm = normalize(o);
            if normalized_body.contains(&o_norm) {
                return true;
            }
        }

        for p in &rule.phrases {
            let p_norm = normalize(p);
            if normalized_body.contains(&p_norm) {
                return true;
            }
        }

        println!("DEBUG: No optional or phrase matched for intent '{}'", rule.intent_id);
        false
    }

    fn build_intent(&self, rule: &IntentRule) -> Result<Intent> {
        match rule.intent_id.as_str() {
            "WeightTimelineSurvey" => Ok(Intent::WeightTimelineSurvey {
                title: get_string(&rule.attributes, "title")?,
                intro: get_string(&rule.attributes, "intro")?,
                birth_year_prompt: get_string(&rule.attributes, "birth_year_prompt")?,
            }),
            "Onboarding" => Ok(Intent::Onboarding {
                welcome_message: get_string(&rule.attributes, "welcome_message")?,
                steps: get_string_list(&rule.attributes, "steps")?,
                completion_message: get_string(&rule.attributes, "completion_message")?,
            }),
            "FormWizard" => Ok(Intent::FormWizard {
                title: get_string(&rule.attributes, "title")?,
                steps: get_string_list(&rule.attributes, "steps")?,
                submit_label: get_string(&rule.attributes, "submit_label")?,
            }),
            "QADialog" => Ok(Intent::QADialog {
                questions: get_string_list(&rule.attributes, "questions")?,
                completion_message: get_optional_string(&rule.attributes, "completion_message"),
            }),
            "DataCollectionFlow" => Ok(Intent::DataCollectionFlow {
                title: get_string(&rule.attributes, "title")?,
                fields: get_string_list(&rule.attributes, "fields")?,
                completion_message: get_optional_string(&rule.attributes, "completion_message"),
            }),
            other => Err(anyhow!("unsupported intent id in manifest: {}", other)),
        }
    }
}

impl LanguageEngine for ManifestEngine {
    fn parse(&self, document: &VectruneDocument) -> Result<Intent> {
        let normalized = normalize(&document.body);

        for rule in &self.definition.intents {
            if self.matches(rule, &normalized) {
                return self.build_intent(rule);
            }
        }

        bail!(
            "{} vectrune engine could not deterministically compile this request",
            self.definition.name
        )
    }
}

fn get_string(attributes: &HashMap<String, Value>, key: &str) -> Result<String> {
    match attributes.get(key) {
        Some(Value::String(s)) => Ok(s.clone()),
        Some(other) => Err(anyhow!("expected string for key `{}`, found {:?}", key, other)),
        None => Err(anyhow!("missing required attribute `{}`", key)),
    }
}

fn get_optional_string(attributes: &HashMap<String, Value>, key: &str) -> Option<String> {
    match attributes.get(key) {
        Some(Value::String(s)) => Some(s.clone()),
        _ => None,
    }
}

fn get_string_list(attributes: &HashMap<String, Value>, key: &str) -> Result<Vec<String>> {
    match attributes.get(key) {
        Some(Value::List(list)) => {
            let mut result = Vec::new();
            for item in list {
                if let Value::String(s) = item {
                    result.push(s.clone());
                } else {
                    return Err(anyhow!("expected list of strings for key `{}`, found item {:?}", key, item));
                }
            }
            Ok(result)
        }
        Some(other) => Err(anyhow!("expected list for key `{}`, found {:?}", key, other)),
        None => Err(anyhow!("missing required attribute `{}`", key)),
    }
}

pub fn load_definitions_from_rune(doc: crate::rune_ast::RuneDocument) -> Vec<LanguageDefinition> {
    let mut langs = HashMap::new();

    for section in &doc.sections {
        if section.path.len() >= 2 && section.path[0] == "Language" {
            let code = section.path[1].clone();
            let name = match section.kv.get("name") {
                Some(Value::String(s)) => s.clone(),
                _ => code.clone(),
            };
            langs.entry(code.clone()).or_insert(LanguageDefinition {
                language_code: code,
                name,
                intents: Vec::new(),
            });
        }
    }

    for section in &doc.sections {
        if section.path.len() >= 2 && section.path[0] == "Intent" {
            // We need to know which language this intent belongs to.
            // If the section path is @Intent/en/WeightTimelineSurvey, we use 'en'.
            // If it's just @Intent/WeightTimelineSurvey, we might need a better way.
            // Let's assume @Intent/<Lang>/<ID> for clarity.
            if section.path.len() >= 3 {
                let lang_code = &section.path[1];
                let intent_id = &section.path[2];

                if let Some(lang) = langs.get_mut(lang_code) {
                    let mut mandatory = Vec::new();
                    let mut optional = Vec::new();
                    let mut phrases = Vec::new();

                    if let Some(list) = section.series.get("mandatory") {
                        mandatory = list.iter().filter_map(|v| if let Value::String(s) = v { Some(s.clone()) } else { None }).collect();
                    }
                    if let Some(list) = section.series.get("optional") {
                        optional = list.iter().filter_map(|v| if let Value::String(s) = v { Some(s.clone()) } else { None }).collect();
                    }
                    if let Some(list) = section.series.get("phrases") {
                        phrases = list.iter().filter_map(|v| if let Value::String(s) = v { Some(s.clone()) } else { None }).collect();
                    }

                    lang.intents.push(IntentRule {
                        intent_id: intent_id.clone(),
                        mandatory,
                        optional,
                        phrases,
                        attributes: section.kv.clone(),
                    });
                }
            }
        }
    }

    langs.into_values().collect()
}

pub fn load_embedded_definitions() -> Vec<LanguageDefinition> {
    let mut all_defs = Vec::new();
    for file in Asset::iter() {
        if let Some(content) = Asset::get(file.as_ref()) {
            if let Ok(source) = std::str::from_utf8(content.data.as_ref()) {
                if let Ok(doc) = crate::rune_parser::parse_rune(source) {
                    all_defs.extend(load_definitions_from_rune(doc));
                }
            }
        }
    }
    all_defs
}
