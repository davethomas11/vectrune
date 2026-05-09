use anyhow::Result;

use super::ast::{Intent, VectruneDocument};

pub trait LanguageEngine {
    fn parse(&self, document: &VectruneDocument) -> Result<Intent>;
}

pub fn normalize(input: &str) -> String {
    input
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}


