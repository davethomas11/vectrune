use anyhow::{bail, Result};

use super::ast::{Intent, VectruneDocument};
use super::engine::{normalize, LanguageEngine};

#[derive(Debug, Default, Clone, Copy)]
pub struct FrenchEngine;

impl LanguageEngine for FrenchEngine {
    fn parse(&self, document: &VectruneDocument) -> Result<Intent> {
        let normalized = normalize(&document.body);

        // "Demandez à l'utilisateur son année de naissance et tracez le graphique de son poids au fil du temps."
        if normalized.contains("année de naissance")
            && normalized.contains("poids")
            && (normalized.contains("graphique") || normalized.contains("tracer"))
            && (normalized.contains("au fil du temps") || normalized.contains("tout au long de sa vie"))
        {
            return Ok(Intent::WeightTimelineSurvey {
                title: "Poids au fil du temps".to_string(),
                intro: "Construisons ensemble une chronologie de votre poids.".to_string(),
                birth_year_prompt: "En quelle année êtes-vous né ?".to_string(),
            });
        }

        if normalized.contains("accueil") || (normalized.contains("bienvenue") && normalized.contains("étapes")) {
            return Ok(Intent::Onboarding {
                welcome_message: "Bienvenue sur Vectrune !".to_string(),
                steps: vec![
                    "Quel est votre nom ?".to_string(),
                    "Quel est votre rôle ?".to_string(),
                ],
                completion_message: "Vous êtes prêt !".to_string(),
            });
        }

        bail!(
            "le moteur vectrune français n'a pas pu compiler cette requête de manière déterministe en code vect exécutable"
        )
    }
}
