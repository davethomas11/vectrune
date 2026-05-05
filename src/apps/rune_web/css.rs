/// CSS compilation for Rune-Web styles.
///
/// This module handles:
/// - Token substitution: resolve `{color}` references to token values
/// - Preset inheritance: flatten nested preset references via `use = (preset-name)`
/// - Property validation and vendor prefix generation
/// - Circular reference detection and warning

use super::ast::StyleDefinition;
use std::collections::HashMap;

/// CSS compilation context that tracks tokens, presets, and resolves references.
pub struct CssCompiler {
    tokens: HashMap<String, String>,
    presets: HashMap<String, HashMap<String, String>>,
    preset_chain: Vec<String>, // For cycle detection during resolution
}

impl CssCompiler {
    /// Create a new CSS compiler from a style definition.
    pub fn new(style: &StyleDefinition) -> Self {
        CssCompiler {
            tokens: style.tokens.clone(),
            presets: style.presets.clone(),
            preset_chain: Vec::new(),
        }
    }

    /// Resolve a token reference like `{token-name}` to its CSS variable form.
    pub fn resolve_token(&self, token_ref: &str) -> String {
        if token_ref.starts_with('{') && token_ref.ends_with('}') {
            let token_name = &token_ref[1..token_ref.len() - 1];
            format!("var(--{})", token_name.trim())
        } else {
            token_ref.to_string()
        }
    }

    fn expand_property_value(&self, val: &str) -> String {
        if val.starts_with('(') && val.ends_with(')') {
            val.to_string()
        } else {
            self.expand_tokens_in_string(val)
        }
    }

    fn expand_tokens_in_string(&self, input: &str) -> String {
        let mut result = String::new();
        let mut chars = input.chars().peekable();

        while let Some(ch) = chars.next() {
            if ch == '{' {
                let mut token_name = String::new();
                let mut found_end = false;
                while let Some(next) = chars.next() {
                    if next == '}' {
                        found_end = true;
                        break;
                    }
                    token_name.push(next);
                }

                if found_end {
                    result.push_str(&self.resolve_token(&format!("{{{}}}", token_name)));
                } else {
                    result.push('{');
                    result.push_str(&token_name);
                }
            } else {
                result.push(ch);
            }
        }

        result
    }

    fn normalize_declarations(&self, prop: &str, val: &str) -> Vec<(String, String)> {
        let expanded = self.expand_property_value(val);
        match prop {
            "bg" => vec![("background".to_string(), expanded)],
            "pad" => vec![("padding".to_string(), expanded)],
            "round" => vec![("border-radius".to_string(), expanded)],
            "font" => vec![("font-family".to_string(), expanded)],
            "weight" => vec![("font-weight".to_string(), expanded)],
            "text-size" => vec![("font-size".to_string(), expanded)],
            "size" => vec![
                ("width".to_string(), expanded.clone()),
                ("height".to_string(), expanded),
            ],
            "stack" => self.expand_stack_value(&expanded),
            "inline" => self.expand_inline_value(&expanded),
            "columns" => vec![(
                "grid-template-columns".to_string(),
                self.expand_columns_value(&expanded),
            )],
            "wrap" => vec![(
                "flex-wrap".to_string(),
                match expanded.trim() {
                    "yes" => "wrap".to_string(),
                    "no" => "nowrap".to_string(),
                    other => other.to_string(),
                },
            )],
            _ => vec![(prop.to_string(), expanded)],
        }
    }

    fn expand_stack_value(&self, value: &str) -> Vec<(String, String)> {
        let mut declarations = vec![
            ("display".to_string(), "flex".to_string()),
            ("flex-direction".to_string(), "column".to_string()),
        ];

        match value.trim() {
            "center" => {
                declarations.push(("align-items".to_string(), "center".to_string()));
                declarations.push(("justify-content".to_string(), "center".to_string()));
            }
            other => {
                declarations.push(("align-items".to_string(), other.to_string()));
            }
        }

        declarations
    }

    fn expand_inline_value(&self, value: &str) -> Vec<(String, String)> {
        let mut declarations = vec![
            ("display".to_string(), "flex".to_string()),
            ("align-items".to_string(), "center".to_string()),
        ];

        match value.trim() {
            "center" => declarations.push(("justify-content".to_string(), "center".to_string())),
            other => declarations.push(("justify-content".to_string(), other.to_string())),
        }

        declarations
    }

    fn expand_columns_value(&self, value: &str) -> String {
        let trimmed = value.trim();
        if let Some((count, size)) = trimmed.split_once(" x ") {
            format!("repeat({}, {})", count.trim(), size.trim())
        } else {
            trimmed.to_string()
        }
    }

    /// Flatten a preset by resolving its properties and any nested preset references.
    pub fn flatten_preset(&mut self, preset_name: &str) -> Result<HashMap<String, String>, String> {
        if self.preset_chain.contains(&preset_name.to_string()) {
            return Err(format!(
                "Circular preset reference detected: {}",
                self.preset_chain.join(" -> ")
            ));
        }

        let preset = self
            .presets
            .get(preset_name)
            .cloned()
            .ok_or_else(|| format!("Preset not found: {}", preset_name))?;

        self.preset_chain.push(preset_name.to_string());

        let mut result = HashMap::new();
        for (key, val) in preset {
            if key == "use" {
                let parent_preset = val.trim_matches(|c| c == '(' || c == ')').trim();
                let parent_props = self.flatten_preset(parent_preset)?;
                for (pk, pv) in parent_props {
                    result.insert(pk, pv);
                }
            } else {
                result.insert(key, self.expand_property_value(&val));
            }
        }

        self.preset_chain.pop();
        Ok(result)
    }

    /// Generate complete CSS text including tokens, presets, and rules.
    pub fn compile(&mut self, rules: &HashMap<String, HashMap<String, String>>) -> String {
        let mut css = String::new();

        if !self.tokens.is_empty() {
            css.push_str(":root {\n");
            for (key, val) in &self.tokens {
                css.push_str(&format!("  --{}: {};\n", key, val));
            }
            css.push_str("}\n");
        }

        for (selector, props) in rules {
            let mut resolved_props: Vec<(String, String)> = Vec::new();

            for (key, val) in props {
                if key == "use" {
                    let preset_name = val.trim_matches(|c| c == '(' || c == ')').trim();
                    match self.flatten_preset(preset_name) {
                        Ok(preset_props) => {
                            for (pk, pv) in preset_props {
                                resolved_props.extend(self.normalize_declarations(&pk, &pv));
                            }
                        }
                        Err(e) => css.push_str(&format!("/* Error: {} */\n", e)),
                    }
                } else {
                    resolved_props.extend(self.normalize_declarations(key, val));
                }
            }

            css.push_str(&format!("{} {{\n", selector));
            for (key, val) in resolved_props {
                css.push_str(&format!("  {}: {};\n", key, val));
            }
            css.push_str("}\n");
        }

        css
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_substitution() {
        let style = StyleDefinition {
            tokens: [("color-primary".to_string(), "#ff0000".to_string())]
                .iter()
                .cloned()
                .collect(),
            presets: HashMap::new(),
            rules: HashMap::new(),
        };

        let compiler = CssCompiler::new(&style);
        assert_eq!(compiler.resolve_token("{color-primary}"), "var(--color-primary)");
        assert_eq!(
            compiler.resolve_token("{undefined}"),
            "var(--undefined)"
        );
    }

    #[test]
    fn test_preset_flattening() {
        let mut presets = HashMap::new();
        presets.insert(
            "base".to_string(),
            [("padding".to_string(), "10px".to_string())]
                .iter()
                .cloned()
                .collect(),
        );

        presets.insert(
            "derived".to_string(),
            [("use".to_string(), "(base)".to_string()),
             ("color".to_string(), "blue".to_string())]
                .iter()
                .cloned()
                .collect(),
        );

        let style = StyleDefinition {
            tokens: HashMap::new(),
            presets: presets.clone(),
            rules: HashMap::new(),
        };

        let mut compiler = CssCompiler::new(&style);
        let flattened = compiler.flatten_preset("derived").unwrap();
        assert_eq!(flattened.get("padding"), Some(&"10px".to_string()));
        assert_eq!(flattened.get("color"), Some(&"blue".to_string()));
    }

    #[test]
    fn test_circular_preset_detection() {
        let mut presets = HashMap::new();
        presets.insert(
            "a".to_string(),
            [("use".to_string(), "(b)".to_string())]
                .iter()
                .cloned()
                .collect(),
        );
        presets.insert(
            "b".to_string(),
            [("use".to_string(), "(a)".to_string())]
                .iter()
                .cloned()
                .collect(),
        );

        let style = StyleDefinition {
            tokens: HashMap::new(),
            presets,
            rules: HashMap::new(),
        };

        let mut compiler = CssCompiler::new(&style);
        let result = compiler.flatten_preset("a");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Circular"));
    }

    #[test]
    fn test_compound_token_expansion_and_alias_declarations() {
        let style = StyleDefinition {
            tokens: [
                ("cell-size".to_string(), "96px".to_string()),
                ("page-bg".to_string(), "#0f172a".to_string()),
            ]
            .iter()
            .cloned()
            .collect(),
            presets: HashMap::new(),
            rules: HashMap::from([
                (
                    ".board".to_string(),
                    HashMap::from([
                        ("display".to_string(), "grid".to_string()),
                        ("columns".to_string(), "3 x {cell-size}".to_string()),
                    ]),
                ),
                (
                    "body".to_string(),
                    HashMap::from([
                        ("bg".to_string(), "{page-bg}".to_string()),
                        ("font".to_string(), "system-ui".to_string()),
                    ]),
                ),
            ]),
        };

        let mut compiler = CssCompiler::new(&style);
        let css = compiler.compile(&style.rules);

        assert!(css.contains("background: var(--page-bg);"));
        assert!(css.contains("font-family: system-ui;"));
        assert!(css.contains("grid-template-columns: repeat(3, var(--cell-size));"));
    }

    #[test]
    fn test_layout_shorthand_normalization() {
        let style = StyleDefinition {
            tokens: HashMap::new(),
            presets: HashMap::new(),
            rules: HashMap::from([
                (
                    ".screen".to_string(),
                    HashMap::from([("stack".to_string(), "center".to_string())]),
                ),
                (
                    ".scoreboard".to_string(),
                    HashMap::from([
                        ("inline".to_string(), "center".to_string()),
                        ("wrap".to_string(), "yes".to_string()),
                    ]),
                ),
                (
                    ".cell".to_string(),
                    HashMap::from([("size".to_string(), "96px".to_string())]),
                ),
            ]),
        };

        let mut compiler = CssCompiler::new(&style);
        let css = compiler.compile(&style.rules);

        assert!(css.contains("flex-direction: column;"));
        assert!(css.contains("align-items: center;"));
        assert!(css.contains("justify-content: center;"));
        assert!(css.contains("flex-wrap: wrap;"));
        assert!(css.contains("width: 96px;"));
        assert!(css.contains("height: 96px;"));
    }
}




