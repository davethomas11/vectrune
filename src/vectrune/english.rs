use anyhow::{bail, Result};

use super::ast::{Intent, VectruneDocument};
use super::engine::{normalize, LanguageEngine};

#[derive(Debug, Default, Clone, Copy)]
pub struct EnglishEngine;

impl LanguageEngine for EnglishEngine {
    fn parse(&self, document: &VectruneDocument) -> Result<Intent> {
        let normalized = normalize(&document.body);

        if normalized.contains("birth year")
            && normalized.contains("weight")
            && (normalized.contains("graph") || normalized.contains("plot"))
            && (normalized.contains("over time") || normalized.contains("through out their life time") || normalized.contains("throughout their lifetime"))
        {
            return Ok(Intent::WeightTimelineSurvey {
                title: "Weight over time".to_string(),
                intro: "Let's build a weight timeline together.".to_string(),
                birth_year_prompt: "What year were you born?".to_string(),
            });
        }

        if normalized.contains("onboarding") || (normalized.contains("welcome") && normalized.contains("steps")) {
            return Ok(Intent::Onboarding {
                welcome_message: "Welcome to Vectrune!".to_string(),
                steps: vec![
                    "What is your name?".to_string(),
                    "What is your role?".to_string(),
                ],
                completion_message: "You're all set!".to_string(),
            });
        }

        if normalized.contains("form") || normalized.contains("wizard") {
            return Ok(Intent::FormWizard {
                title: "Data Entry Form".to_string(),
                steps: vec![
                    "Enter your first name:".to_string(),
                    "Enter your last name:".to_string(),
                ],
                submit_label: "Submit".to_string(),
            });
        }

        if normalized.contains("qa") || normalized.contains("questions") || normalized.contains("dialog") {
            return Ok(Intent::QADialog {
                questions: vec![
                    "What is your favorite color?".to_string(),
                    "Where do you live?".to_string(),
                ],
                completion_message: Some("Thank you for your answers.".to_string()),
            });
        }

        if normalized.contains("data") || normalized.contains("collection") || normalized.contains("flow") {
            return Ok(Intent::DataCollectionFlow {
                title: "User Data Collection".to_string(),
                fields: vec!["email".to_string(), "phone".to_string()],
                completion_message: Some("Data saved successfully.".to_string()),
            });
        }

        bail!(
            "english vectrune engine could not deterministically compile this request into executable vect code"
        )
    }
}


