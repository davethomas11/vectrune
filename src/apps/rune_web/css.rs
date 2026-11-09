/// CSS compilation for Rune-Web styles.
///
/// This module handles:
/// - Token substitution: resolve `{color}` references to token values
/// - Preset inheritance: flatten nested preset references via `use = (preset-name)`
/// - Property validation and vendor prefix generation
/// - Circular reference detection and warning

use super::ast::{ResponsiveStyleRule, StyleDefinition};
use std::collections::HashMap;

/// CSS compilation context that tracks tokens, presets, and resolves references.
pub struct CssCompiler {
    tokens: HashMap<String, String>,
    presets: HashMap<String, HashMap<String, String>>,
    preset_chain: Vec<String>, // For cycle detection during resolution
    responsive: Vec<ResponsiveStyleRule>,
    fullscreen: HashMap<String, HashMap<String, String>>,
}

impl CssCompiler {
    /// Create a new CSS compiler from a style definition.
    pub fn new(style: &StyleDefinition) -> Self {
        CssCompiler {
            tokens: style.tokens.clone(),
            presets: style.presets.clone(),
            preset_chain: Vec::new(),
            responsive: style.responsive.clone(),
            fullscreen: style.fullscreen.clone(),
        }
    }

    /// Resolve a token reference like `{token-name}` or `{token-name / 25%}` to its CSS variable form.
    pub fn resolve_token(&self, token_ref: &str) -> String {
        if token_ref.starts_with('{') && token_ref.ends_with('}') {
            let inner = token_ref[1..token_ref.len() - 1].trim();
            if let Some((name, alpha)) = inner.split_once('/') {
                let name = name.trim();
                let alpha = alpha.trim();
                let percentage = if alpha.ends_with('%') {
                    alpha.to_string()
                } else if let Ok(val) = alpha.parse::<f64>() {
                    format!("{}%", (val * 100.0).round())
                } else {
                    alpha.to_string()
                };
                return format!("color-mix(in srgb, var(--{}) {}, transparent)", name, percentage);
            }
            format!("var(--{})", inner)
        } else {
            token_ref.to_string()
        }
    }

    fn expand_property_value(&self, val: &str) -> String {
        let expanded = if val.starts_with('(') && val.ends_with(')') {
            val.to_string()
        } else {
            self.expand_tokens_in_string(val)
        };
        self.expand_alpha_calls(&expanded)
    }

    fn expand_alpha_calls(&self, input: &str) -> String {
        let mut result = input.to_string();
        while let Some(start) = result.find("alpha(") {
            let rest = &result[start + 6..];
            let mut depth = 1;
            let mut end_idx = None;
            for (i, c) in rest.char_indices() {
                if c == '(' {
                    depth += 1;
                } else if c == ')' {
                    depth -= 1;
                    if depth == 0 {
                        end_idx = Some(i);
                        break;
                    }
                }
            }
            if let Some(end) = end_idx {
                let args = &rest[..end];
                if let Some((color, opacity)) = args.split_once(',') {
                    let color = color.trim();
                    let opacity = opacity.trim();
                    let pct = if opacity.ends_with('%') {
                        opacity.to_string()
                    } else if let Ok(val) = opacity.parse::<f64>() {
                        format!("{}%", (val * 100.0).round() as i64)
                    } else {
                        opacity.to_string()
                    };
                    let replacement = format!("color-mix(in srgb, {} {}, transparent)", color, pct);
                    result.replace_range(start..start + 6 + end + 1, &replacement);
                    continue;
                }
            }
            break;
        }
        result
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
            "round" | "radius" => vec![("border-radius".to_string(), expanded)],
            "font" => vec![("font-family".to_string(), expanded)],
            "weight" => vec![("font-weight".to_string(), expanded)],
            "text-size" => vec![("font-size".to_string(), expanded)],
            "size" => self.expand_size_value(&expanded),
            "stack" => self.expand_stack_value(&expanded),
            "inline" => self.expand_inline_value(&expanded),
            "center" => self.expand_center_value(&expanded),
            "abs" => self.expand_position_shorthand("absolute", &expanded),
            "fixed" => self.expand_position_shorthand("fixed", &expanded),
            "glow" => vec![("box-shadow".to_string(), self.expand_glow_value(&expanded, false))],
            "text-glow" => vec![("text-shadow".to_string(), self.expand_glow_value(&expanded, true))],
            "aspect" => vec![("aspect-ratio".to_string(), expanded)],
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

    fn expand_size_value(&self, value: &str) -> Vec<(String, String)> {
        let trimmed = value.trim();
        if let Some((w, h)) = trimmed.split_once(' ') {
            vec![
                ("width".to_string(), w.trim().to_string()),
                ("height".to_string(), h.trim().to_string()),
            ]
        } else {
            vec![
                ("width".to_string(), trimmed.to_string()),
                ("height".to_string(), trimmed.to_string()),
            ]
        }
    }

    fn expand_center_value(&self, value: &str) -> Vec<(String, String)> {
        let mut decls = vec![("display".to_string(), "flex".to_string())];
        match value.trim() {
            "x" => {
                decls.push(("justify-content".to_string(), "center".to_string()));
            }
            "y" => {
                decls.push(("align-items".to_string(), "center".to_string()));
            }
            _ => {
                decls.push(("align-items".to_string(), "center".to_string()));
                decls.push(("justify-content".to_string(), "center".to_string()));
            }
        }
        decls
    }

    fn expand_position_shorthand(&self, position_type: &str, value: &str) -> Vec<(String, String)> {
        let mut decls = vec![("position".to_string(), position_type.to_string())];
        let trimmed = value.trim();
        match trimmed {
            "true" | "yes" | "" => {}
            "inset" | "full" => {
                decls.push(("inset".to_string(), "0".to_string()));
            }
            "center" => {
                decls.push(("top".to_string(), "50%".to_string()));
                decls.push(("left".to_string(), "50%".to_string()));
                decls.push(("transform".to_string(), "translate(-50%, -50%)".to_string()));
            }
            other => {
                let parts: Vec<&str> = other.split_whitespace().collect();
                match parts.len() {
                    1 => {
                        decls.push(("inset".to_string(), parts[0].to_string()));
                    }
                    2 => {
                        decls.push(("top".to_string(), parts[0].to_string()));
                        decls.push(("left".to_string(), parts[1].to_string()));
                    }
                    4 => {
                        decls.push(("top".to_string(), parts[0].to_string()));
                        decls.push(("right".to_string(), parts[1].to_string()));
                        decls.push(("bottom".to_string(), parts[2].to_string()));
                        decls.push(("left".to_string(), parts[3].to_string()));
                    }
                    _ => {}
                }
            }
        }
        decls
    }

    fn expand_glow_value(&self, value: &str, is_text: bool) -> String {
        let trimmed = value.trim();
        if trimmed == "none" {
            return "none".to_string();
        }
        let is_inset = trimmed.starts_with("inset ");
        let without_inset = if is_inset {
            trimmed["inset ".len()..].trim()
        } else {
            trimmed
        };

        let (color, rest_sizes) = if without_inset.starts_with("color-mix(")
            || without_inset.starts_with("var(")
            || without_inset.starts_with("rgba(")
            || without_inset.starts_with("rgb(")
            || without_inset.starts_with("hsl(")
        {
            let mut depth = 0;
            let mut close_idx = None;
            for (i, c) in without_inset.char_indices() {
                if c == '(' {
                    depth += 1;
                } else if c == ')' {
                    depth -= 1;
                    if depth == 0 {
                        close_idx = Some(i);
                        break;
                    }
                }
            }
            if let Some(close) = close_idx {
                (without_inset[..=close].trim(), without_inset[close + 1..].trim())
            } else if let Some(space_idx) = without_inset.find(' ') {
                (without_inset[..space_idx].trim(), without_inset[space_idx + 1..].trim())
            } else {
                (without_inset, "")
            }
        } else if let Some((first, rest)) = without_inset.split_once(' ') {
            (first.trim(), rest.trim())
        } else {
            (without_inset, "")
        };

        let sizes: Vec<&str> = rest_sizes.split_whitespace().collect();
        if sizes.is_empty() {
            if is_text {
                return format!("0 0 10px {}", color);
            } else if is_inset {
                return format!("inset 0 0 10px {}", color);
            } else {
                return format!("0 0 10px {}", color);
            }
        }

        let mut shadows = Vec::new();
        for size in sizes {
            if is_text {
                shadows.push(format!("0 0 {} {}", size, color));
            } else if is_inset {
                shadows.push(format!("inset 0 0 {} {}", size, color));
            } else {
                shadows.push(format!("0 0 {} {}", size, color));
            }
        }
        shadows.join(", ")
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
                let unparenthesized = val.trim_matches(|c| c == '(' || c == ')');
                for parent_preset in unparenthesized.split(',') {
                    let parent_preset = parent_preset.trim();
                    if parent_preset.is_empty() {
                        continue;
                    }
                    let parent_props = self.flatten_preset(parent_preset)?;
                    for (pk, pv) in parent_props {
                        result.insert(pk, pv);
                    }
                }
            } else {
                result.insert(key, self.expand_property_value(&val));
            }
        }

        self.preset_chain.pop();
        Ok(result)
    }

    /// Combine parent and child selectors with support for `&`, pseudo-classes `:`, and descendant selectors.
    pub fn combine_selectors(parent: &str, child: &str) -> String {
        if parent.is_empty() {
            return child.to_string();
        }
        let parents: Vec<&str> = parent
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        let children: Vec<&str> = child
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        let mut results = Vec::new();

        for p in &parents {
            for c in &children {
                if c.starts_with('&') {
                    results.push(format!("{}{}", p, &c[1..]));
                } else if c.starts_with(':') {
                    results.push(format!("{}{}", p, c));
                } else {
                    results.push(format!("{} {}", p, c));
                }
            }
        }

        results.join(", ")
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

        self.compile_rules(&mut css, "", rules);

        // Preserve source order so later breakpoint overrides win the cascade.
        for responsive in self.responsive.clone() {
            css.push_str(&format!("@media {} {{\n", responsive.condition));
            self.compile_rules(&mut css, "", &responsive.rules);
            css.push_str("}\n");
        }

        if !self.fullscreen.is_empty() {
            let fullscreen_rules = self.fullscreen.clone();
            let mut fs_scoped_rules = HashMap::new();
            for (selector, props) in &fullscreen_rules {
                let s = selector.trim();
                let scoped_key = if s == "body" || s == ":root" || s == "html" {
                    ":fullscreen, :-webkit-full-screen, [data-fullscreen=\"true\"], .fullscreen".to_string()
                } else {
                    format!(":fullscreen {s}, :fullscreen{s}, :-webkit-full-screen {s}, :-webkit-full-screen{s}, [data-fullscreen=\"true\"] {s}, [data-fullscreen=\"true\"]{s}, .fullscreen {s}")
                };
                fs_scoped_rules.insert(scoped_key, props.clone());
            }
            self.compile_rules(&mut css, "", &fs_scoped_rules);

            css.push_str("@media (display-mode: fullscreen) {\n");
            self.compile_rules(&mut css, "", &fullscreen_rules);
            css.push_str("}\n");
        }

        css
    }

    fn compile_rules(&mut self, css: &mut String, parent_selector: &str, rules: &HashMap<String, HashMap<String, String>>) {
        let mut selector_to_props: HashMap<String, Vec<(String, String)>> = HashMap::new();
        let mut selector_to_nested: HashMap<String, HashMap<String, HashMap<String, String>>> = HashMap::new();
        let mut ordered_selectors: Vec<String> = Vec::new();

        for (selector, props) in rules {
            let full_selector = Self::combine_selectors(parent_selector, selector);

            if !ordered_selectors.contains(&full_selector) {
                ordered_selectors.push(full_selector.clone());
            }

            let props_entry = selector_to_props.entry(full_selector.clone()).or_insert_with(Vec::new);
            let nested_entry = selector_to_nested.entry(full_selector.clone()).or_insert_with(HashMap::new);

            for (key, val) in props {
                if key == "use" {
                    let unparenthesized = val.trim_matches(|c| c == '(' || c == ')');
                    for preset_name in unparenthesized.split(',') {
                        let preset_name = preset_name.trim();
                        if preset_name.is_empty() {
                            continue;
                        }
                        match self.flatten_preset(preset_name) {
                            Ok(preset_props) => {
                                for (pk, pv) in preset_props {
                                    props_entry.extend(self.normalize_declarations(&pk, &pv));
                                }
                            }
                            Err(e) => css.push_str(&format!("/* Error: {} */\n", e)),
                        }
                    }
                } else if key.starts_with("nested:") {
                    let nested_selector = &key[7..];
                    if let Ok(nested_body) = serde_json::from_str::<HashMap<String, String>>(val) {
                        if nested_selector.starts_with('#') {
                            let property_name = &nested_selector[1..];
                            for (sub_selector, sub_val) in nested_body {
                                if sub_selector == "_" {
                                    props_entry.extend(self.normalize_declarations(property_name, &sub_val));
                                } else {
                                    let target_selector = if sub_selector.starts_with('.') || sub_selector.starts_with('#') || sub_selector.starts_with(':') {
                                        format!("&{}", sub_selector)
                                    } else {
                                        sub_selector.clone()
                                    };
                                    let sub_entry = nested_entry.entry(target_selector).or_insert_with(HashMap::new);
                                    sub_entry.insert(property_name.to_string(), sub_val);
                                }
                            }
                        } else {
                            let sub_entry = nested_entry.entry(nested_selector.to_string()).or_insert_with(HashMap::new);
                            for (nk, nv) in nested_body {
                                sub_entry.insert(nk, nv);
                            }
                        }
                    }
                } else {
                    props_entry.extend(self.normalize_declarations(key, val));
                }
            }
        }

        // Output rules and recurse on nested
        for selector in ordered_selectors {
            if let Some(resolved_props) = selector_to_props.get(&selector) {
                if !resolved_props.is_empty() {
                    css.push_str(&format!("{} {{\n", selector));
                    for (key, val) in resolved_props {
                        css.push_str(&format!("  {}: {};\n", key, val));
                    }
                    css.push_str("}\n");
                }
            }

            if let Some(nested) = selector_to_nested.get(&selector) {
                if !nested.is_empty() {
                    self.compile_rules(css, &selector, nested);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn responsive_styles_preserve_cascade_order_and_support_presets_and_tokens() {
        let document = crate::rune_parser::parse_rune(r#"
@Page/demo
view:
    div .card "Responsive example"

@Style/responsive
tokens:
    panel = #ffffff
presets:
    compact:
        padding = 1rem
rules:
    .card:
        padding = 2rem
responsive:
    (max-width: 1000px):
        .card:
            use = (compact)
            background = {panel}
            &:hover:
                color = {panel}
    (max-width: 640px):
        .card:
            padding = 0.5rem
"#).expect("valid Rune styles");
        let frontend = super::super::parser::parse_rune_web_frontend(&document, "demo")
            .expect("valid frontend");
        let style = &frontend.style_definitions["responsive"];
        assert_eq!(style.responsive.len(), 2);

        let css = CssCompiler::new(style).compile(&style.rules);
        let base = css.find("padding: 2rem;").unwrap();
        let tablet = css.find("@media (max-width: 1000px) {\n").unwrap();
        let phone = css.find("@media (max-width: 640px) {\n").unwrap();
        assert!(base < tablet && tablet < phone);
        let tablet_css = &css[tablet..phone];
        assert!(tablet_css.contains("padding: 1rem;"));
        assert!(tablet_css.contains("background: var(--panel);"));
        assert!(tablet_css.contains(".card:hover {\n  color: var(--panel);\n}"));
        assert!(tablet_css.ends_with("}\n}\n"));
        assert!(css[phone..].contains("padding: 0.5rem;"));
        assert!(css.ends_with("}\n}\n"));
    }

    #[test]
    fn test_token_substitution() {
        let style = StyleDefinition {
            responsive: Vec::new(),
            tokens: [("color-primary".to_string(), "#ff0000".to_string())]
                .iter()
                .cloned()
                .collect(),
            presets: HashMap::new(),
            rules: HashMap::new(),
            fullscreen: HashMap::new(),
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
            responsive: Vec::new(),
            tokens: HashMap::new(),
            presets: presets.clone(),
            rules: HashMap::new(),
            fullscreen: HashMap::new(),
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
            responsive: Vec::new(),
            tokens: HashMap::new(),
            presets,
            rules: HashMap::new(),
            fullscreen: HashMap::new(),
        };

        let mut compiler = CssCompiler::new(&style);
        let result = compiler.flatten_preset("a");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Circular"));
    }

    #[test]
    fn test_compound_token_expansion_and_alias_declarations() {
        let style = StyleDefinition {
            responsive: Vec::new(),
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
            fullscreen: HashMap::new(),
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
            responsive: Vec::new(),
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
            fullscreen: HashMap::new(),
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

    #[test]
    fn test_multi_presets_and_new_shorthands() {
        let style = StyleDefinition {
            responsive: Vec::new(),
            tokens: [
                ("neon".to_string(), "#00ff88".to_string()),
                ("pink".to_string(), "#ff2a85".to_string()),
            ]
            .into_iter()
            .collect(),
            presets: [
                (
                    "entity".to_string(),
                    [("abs".to_string(), "true".to_string())].into_iter().collect(),
                ),
                (
                    "centered".to_string(),
                    [("center".to_string(), "xy".to_string())].into_iter().collect(),
                ),
            ]
            .into_iter()
            .collect(),
            rules: [
                (
                    ".player".to_string(),
                    [
                        ("use".to_string(), "entity, centered".to_string()),
                        ("size".to_string(), "32px 48px".to_string()),
                        ("glow".to_string(), "{neon} 15px".to_string()),
                        ("bg".to_string(), "{neon / 25%}".to_string()),
                    ]
                    .into_iter()
                    .collect(),
                ),
                (
                    ".title".to_string(),
                    [
                        ("text-glow".to_string(), "{pink} 10px 20px".to_string()),
                        ("aspect".to_string(), "16 / 9".to_string()),
                        ("color".to_string(), "alpha({pink}, 0.5)".to_string()),
                    ]
                    .into_iter()
                    .collect(),
                ),
            ]
            .into_iter()
            .collect(),
            fullscreen: HashMap::new(),
        };

        let mut compiler = CssCompiler::new(&style);
        let css = compiler.compile(&style.rules);

        assert!(css.contains("position: absolute;"));
        assert!(css.contains("display: flex;"));
        assert!(css.contains("align-items: center;"));
        assert!(css.contains("justify-content: center;"));
        assert!(css.contains("width: 32px;"));
        assert!(css.contains("height: 48px;"));
        assert!(css.contains("box-shadow: 0 0 15px var(--neon);"));
        assert!(css.contains("background: color-mix(in srgb, var(--neon) 25%, transparent);"));
        assert!(css.contains("text-shadow: 0 0 10px var(--pink), 0 0 20px var(--pink);"));
        assert!(css.contains("aspect-ratio: 16 / 9;"));
        assert!(css.contains("color: color-mix(in srgb, var(--pink) 50%, transparent);"));
    }

    #[test]
    fn test_pseudo_and_modifier_nesting_in_document() {
        let doc = crate::rune_parser::parse_rune(r#"
@Page/buttons
view:
    div .btn "Click"

@Style/buttons
tokens:
    accent = #ff2a85
rules:
    .btn:
        size = 120px 40px
        center = true
        &:hover:
            glow = {accent} 10px
        :active:
            glow = none
"#).expect("parsed doc");

        let frontend = super::super::parser::parse_rune_web_frontend(&doc, "buttons").expect("parsed frontend");
        let style = &frontend.style_definitions["buttons"];
        let mut compiler = CssCompiler::new(style);
        let css = compiler.compile(&style.rules);

        assert!(css.contains(".btn {\n"));
        assert!(css.contains("width: 120px;"));
        assert!(css.contains("height: 40px;"));
        assert!(css.contains(".btn:hover {\n"));
        assert!(css.contains("box-shadow: 0 0 10px var(--accent);"));
        assert!(css.contains(".btn:active {\n"));
        assert!(css.contains("box-shadow: none;"));
    }

    #[test]
    fn test_fullscreen_style_section_compilation() {
        let doc = crate::rune_parser::parse_rune(r#"
@Page/studio
view:
    div .studio-cabinet "Studio"

@Style/studio
tokens:
    neon = #00e5ff
rules:
    .studio-cabinet:
        max-width = 960px
fullscreen:
    .studio-cabinet:
        max-width = 100vw
        height = 100vh
"#).expect("parsed doc");

        let frontend = super::super::parser::parse_rune_web_frontend(&doc, "studio").expect("parsed frontend");
        let style = &frontend.style_definitions["studio"];
        let mut compiler = CssCompiler::new(style);
        let css = compiler.compile(&style.rules);

        assert!(css.contains(":fullscreen .studio-cabinet"));
        assert!(css.contains("[data-fullscreen=\"true\"] .studio-cabinet"));
        assert!(css.contains("@media (display-mode: fullscreen)"));
        assert!(css.contains("max-width: 100vw;"));
        assert!(css.contains("height: 100vh;"));
    }
}




