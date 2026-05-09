use anyhow::{anyhow, bail, Context, Result};
use std::fs;
use std::path::Path;

use crate::execution::{ExecProgram, ExecStmt};
use crate::rune_parser::load_rune_document_from_path;

use super::ast::{Intent, VectruneDocument};
use super::english::EnglishEngine;
use super::french::FrenchEngine;
use super::engine::LanguageEngine;
use super::manifest_engine::{load_definitions_from_rune, ManifestEngine};

pub fn load_document_from_path(path: &Path) -> Result<VectruneDocument> {
    let source = fs::read_to_string(path)
        .with_context(|| format!("failed to read vectrune file {}", path.display()))?;
    parse_document(&source)
}

pub fn parse_document(source: &str) -> Result<VectruneDocument> {
    let mut language = "en".to_string();
    let mut body_lines = Vec::new();
    let mut header_consumed = false;

    for raw in source.lines() {
        let trimmed = raw.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if !header_consumed {
            if let Some(rest) = trimmed.strip_prefix("language:") {
                language = rest.trim().to_string();
                header_consumed = true;
                continue;
            }
            header_consumed = true;
        }
        body_lines.push(trimmed.to_string());
    }

    if body_lines.is_empty() {
        bail!("vectrune file does not contain any executable natural-language request text");
    }

    Ok(VectruneDocument {
        language,
        body: body_lines.join(" "),
    })
}

pub fn compile_document(document: &VectruneDocument) -> Result<ExecProgram> {
    let engine = select_engine(&document.language)?;
    let intent = engine.parse(document)?;
    Ok(lower_intent(intent))
}

fn select_engine(language: &str) -> Result<Box<dyn LanguageEngine>> {
    let lang_id = language.trim().to_lowercase();
    
    // 1. Try to load from User Overrides (local directory)
    let manifest_path = Path::new("knowledge/languages");
    if manifest_path.exists() {
        if let Ok(doc) = load_rune_document_from_path(manifest_path) {
            let definitions = load_definitions_from_rune(doc);
            for def in definitions {
                if def.language_code == lang_id {
                    return Ok(Box::new(ManifestEngine::new(def)));
                }
            }
        }
    }

    // 2. Try to load from Embedded Assets (Baked-in fallback)
    let embedded_definitions = super::manifest_engine::load_embedded_definitions();
    for def in embedded_definitions {
        if def.language_code == lang_id {
            return Ok(Box::new(ManifestEngine::new(def)));
        }
    }

    // 3. Last resort: Hardcoded engines
    match lang_id.as_str() {
        "en" | "en_us" | "english" => Ok(Box::new(EnglishEngine)),
        "fr" | "fr_fr" | "french" | "français" => Ok(Box::new(FrenchEngine)),
        other => Err(anyhow!(
            "no vectrune language engine is registered for `{}`",
            other
        )),
    }
}

fn lower_intent(intent: Intent) -> ExecProgram {
    match intent {
        Intent::WeightTimelineSurvey {
            title,
            intro,
            birth_year_prompt,
        } => ExecProgram {
            statements: vec![
                ExecStmt::Print {
                    line_no: 1,
                    text: intro,
                },
                ExecStmt::Print {
                    line_no: 2,
                    text: birth_year_prompt,
                },
                ExecStmt::ReadInput {
                    line_no: 3,
                    var_name: "birth_year".to_string(),
                },
                ExecStmt::CollectWeightTimeline {
                    line_no: 4,
                    birth_year_var: "birth_year".to_string(),
                    target_var: "weight_timeline".to_string(),
                },
                ExecStmt::RenderWeightGraph {
                    line_no: 5,
                    series_var: "weight_timeline".to_string(),
                    title,
                },
            ],
        },
        Intent::Onboarding {
            welcome_message,
            steps,
            completion_message,
        } => {
            let mut statements = vec![ExecStmt::Print {
                line_no: 1,
                text: welcome_message,
            }];

            for (i, step) in steps.into_iter().enumerate() {
                let line_offset = 2 + (i * 2);
                statements.push(ExecStmt::Print {
                    line_no: line_offset,
                    text: step,
                });
                statements.push(ExecStmt::ReadInput {
                    line_no: line_offset + 1,
                    var_name: format!("step_{}", i),
                });
            }

            statements.push(ExecStmt::Print {
                line_no: 1000, // Just a placeholder for the end
                text: completion_message,
            });

            ExecProgram { statements }
        }
        Intent::FormWizard {
            title,
            steps,
            submit_label,
        } => {
            let mut statements = vec![ExecStmt::Print {
                line_no: 1,
                text: title,
            }];

            for (i, step) in steps.into_iter().enumerate() {
                let line_offset = 2 + (i * 2);
                statements.push(ExecStmt::Print {
                    line_no: line_offset,
                    text: step,
                });
                statements.push(ExecStmt::ReadInput {
                    line_no: line_offset + 1,
                    var_name: format!("form_field_{}", i),
                });
            }

            statements.push(ExecStmt::Print {
                line_no: 1000,
                text: format!("Submitting via: {}", submit_label),
            });

            ExecProgram { statements }
        }
        Intent::QADialog {
            questions,
            completion_message,
        } => {
            let mut statements = Vec::new();

            for (i, question) in questions.into_iter().enumerate() {
                let line_offset = 1 + (i * 2);
                statements.push(ExecStmt::Print {
                    line_no: line_offset,
                    text: question,
                });
                statements.push(ExecStmt::ReadInput {
                    line_no: line_offset + 1,
                    var_name: format!("answer_{}", i),
                });
            }

            if let Some(msg) = completion_message {
                statements.push(ExecStmt::Print {
                    line_no: 1000,
                    text: msg,
                });
            }

            ExecProgram { statements }
        }
        Intent::DataCollectionFlow {
            title,
            fields,
            completion_message,
        } => {
            let mut statements = vec![ExecStmt::Print {
                line_no: 1,
                text: title,
            }];

            for (i, field) in fields.into_iter().enumerate() {
                let line_offset = 2 + (i * 2);
                statements.push(ExecStmt::Print {
                    line_no: line_offset,
                    text: format!("Please provide {}:", field),
                });
                statements.push(ExecStmt::ReadInput {
                    line_no: line_offset + 1,
                    var_name: field,
                });
            }

            if let Some(msg) = completion_message {
                statements.push(ExecStmt::Print {
                    line_no: 1000,
                    text: msg,
                });
            }

            ExecProgram { statements }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_default_english_document_without_header() {
        let doc = parse_document("Ask the user for their birth year and graph their weight over time.")
            .expect("parse document");
        assert_eq!(doc.language, "en");
        assert!(doc.body.contains("birth year"));
    }

    #[test]
    fn compiles_weight_timeline_intent() {
        let doc = parse_document(
            "language: en\nAsk the user for their birth year and weight through out their life time then graph their weight over time.",
        )
        .expect("parse document");
        let program = compile_document(&doc).expect("compile document");
        assert!(matches!(program.statements[0], ExecStmt::Print { .. }));
        assert!(matches!(program.statements[2], ExecStmt::ReadInput { .. }));
        assert!(matches!(program.statements[3], ExecStmt::CollectWeightTimeline { .. }));
        assert!(matches!(program.statements[4], ExecStmt::RenderWeightGraph { .. }));
    }

    #[test]
    fn compiles_french_weight_timeline_intent() {
        let doc = parse_document(
            "language: fr\nDemandez à l'utilisateur son année de naissance et son poids tout au long de sa vie, puis tracez le graphique de son poids au fil du temps.",
        )
        .expect("parse document");
        let program = compile_document(&doc).expect("compile document");
        assert_eq!(doc.language, "fr");
        assert!(matches!(program.statements[0], ExecStmt::Print { .. }));
        if let ExecStmt::Print { text, .. } = &program.statements[0] {
            assert!(text.contains("Construisons ensemble"));
        }
    }

    #[test]
    fn compiles_onboarding_intent() {
        let doc = parse_document("Create an onboarding flow with some steps.")
            .expect("parse document");
        let program = compile_document(&doc).expect("compile document");
        assert!(matches!(program.statements[0], ExecStmt::Print { .. }));
        if let ExecStmt::Print { text, .. } = &program.statements[0] {
            assert!(text.contains("Welcome to Vectrune"));
        }
    }
}

