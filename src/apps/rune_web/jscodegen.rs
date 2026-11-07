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
    navigator: Option<super::ast::NavigatorDefinition>,
}

impl JsCodegen {
    /// Create a new code generator from a page tree, logic definition, and i18n JSON.
    pub fn new(
        page: ViewNode,
        logic: LogicDefinition,
        i18n_json: String,
        ws_endpoint: Option<String>,
        memory_seed: HashMap<String, serde_json::Value>,
        navigator: Option<super::ast::NavigatorDefinition>,
    ) -> Self {
        JsCodegen { page, logic, i18n_json, ws_endpoint, memory_seed, navigator }
    }

    /// Generate complete JavaScript application code.
    pub fn generate(&self) -> String {
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
            .unwrap_or_else(|_| "{}".to_string())
            .replace('<', "\\u003c");
        let i18n_json = &self.i18n_json;

        let state_json = self.generate_state_json();
        let ws_endpoint = if let Some(endpoint) = &self.ws_endpoint {
            format!("'{}'", endpoint)
        } else {
            "null".to_string()
        };
        let timer_json = match &self.logic.timer {
            Some(t) => format!("'{}'", t),
            None => "null".to_string(),
        };
        let keys_json = serde_json::to_string(&self.logic.keys)
            .unwrap_or_else(|_| "{}".to_string());
        let navigator_json = serde_json::to_string(&self.navigator)
            .unwrap_or_else(|_| "null".to_string());
        let emitters_json = self.generate_emitters_json();

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
  wsEndpoint: {ws_endpoint},
  timer: {timer_json},
  keys: {keys_json},
  navigator: {navigator_json},
  emitters: {emitters_json}
}});
"#,
            include_str!("../../../runtime/rune-web/dist/rune-runtime.js")
        )
    }

    fn generate_state_json(&self) -> String {
        let mut normalized = serde_json::Map::new();
        let mut evaluated_locals: HashMap<String, serde_json::Value> = HashMap::new();
        for (key, val) in &self.logic.locals {
            evaluated_locals.insert(key.clone(), self.parse_value_with_locals(val, &evaluated_locals));
        }
        for (key, val) in &self.logic.state {
            if Self::emitter_config_src(val).is_some() {
                // Emitters start as an empty particle list; their settings go to `emitters`.
                normalized.insert(key.clone(), serde_json::Value::Array(vec![]));
                continue;
            }
            normalized.insert(key.clone(), self.parse_value_with_locals(val, &evaluated_locals));
        }
        for (key, val) in &self.memory_seed {
            normalized.insert(key.clone(), val.clone());
        }
        serde_json::Value::Object(normalized).to_string()
    }

    /// If a state value is `emitter` or `emitter { ... }`, return the config source
    /// (`"{}"` when omitted). Otherwise `None`.
    fn emitter_config_src(val: &str) -> Option<String> {
        let trimmed = val.trim();
        let rest = trimmed.strip_prefix("emitter")?;
        let rest = rest.trim();
        if rest.is_empty() {
            return Some("{}".to_string());
        }
        if rest.starts_with('{') {
            return Some(rest.to_string());
        }
        None
    }

    /// Collect particle emitter settings declared in state as `name = emitter { ... }`.
    fn generate_emitters_json(&self) -> String {
        let mut emitters = serde_json::Map::new();
        let empty_locals: HashMap<String, serde_json::Value> = HashMap::new();
        for (key, val) in &self.logic.state {
            if let Some(src) = Self::emitter_config_src(val) {
                let cfg = self.parse_value_with_locals(&src, &empty_locals);
                let cfg = if cfg.is_object() { cfg } else { serde_json::json!({}) };
                emitters.insert(key.clone(), cfg);
            }
        }
        serde_json::Value::Object(emitters).to_string()
    }

    pub fn parse_value(&self, val: &str) -> serde_json::Value {
        self.parse_value_with_locals(val, &HashMap::new())
    }

    pub fn parse_value_with_locals(&self, val: &str, locals: &HashMap<String, serde_json::Value>) -> serde_json::Value {
        let trimmed = val.trim();
        if trimmed.starts_with('[') {
            if let Some(arr) = self.parse_relaxed_array_with_locals(trimmed, locals) {
                return arr;
            }
        }
        if let Some(res) = parse_var_with_object(trimmed, locals) {
            return res;
        }
        if let Some(local_val) = locals.get(trimmed) {
            return local_val.clone();
        }
        if let Some(grid) = parse_grid_generator(trimmed) {
            return grid;
        }
        if let Some(gen) = parse_1d_generator(trimmed) {
            return gen;
        }
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
            return value;
        }
        if trimmed.starts_with('{') && trimmed.ends_with('}') {
            let vars = HashMap::new();
            if let Some(obj) = parse_relaxed_object(trimmed, &vars) {
                return serde_json::Value::Object(obj);
            }
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
            return num_to_json(number);
        }
        serde_json::Value::String(normalize_literal(trimmed))
    }

    fn parse_relaxed_array_with_locals(&self, s: &str, locals: &HashMap<String, serde_json::Value>) -> Option<serde_json::Value> {
        let trimmed = s.trim();
        if !trimmed.starts_with('[') {
            return None;
        }

        let mut depth = 0;
        let mut close_idx = None;
        let mut in_quote = None;

        for (idx, c) in trimmed.char_indices() {
            if let Some(q) = in_quote {
                if c == q {
                    in_quote = None;
                }
                continue;
            }
            match c {
                '"' | '\'' => in_quote = Some(c),
                '[' => depth += 1,
                ']' => {
                    depth -= 1;
                    if depth == 0 {
                        close_idx = Some(idx);
                        break;
                    }
                }
                _ => {}
            }
        }

        let close_idx = close_idx?;
        let inner = trimmed[1..close_idx].trim();
        let after = trimmed[close_idx + 1..].trim();

        let mut items = Vec::new();
        if !inner.is_empty() {
            let parts = split_top_level(inner, ',');
            for part in parts {
                let part_trimmed = part.trim();
                if part_trimmed.is_empty() {
                    continue;
                }
                if let Some(var_res) = parse_var_with_object(part_trimmed, locals) {
                    if let serde_json::Value::Array(gen_items) = var_res {
                        items.extend(gen_items);
                    } else {
                        items.push(var_res);
                    }
                } else if let Some(serde_json::Value::Array(gen_items)) = parse_1d_generator(part_trimmed) {
                    items.extend(gen_items);
                } else if let Some(serde_json::Value::Array(grid_items)) = parse_grid_generator(part_trimmed) {
                    items.extend(grid_items);
                } else if let Some(local_val) = locals.get(part_trimmed) {
                    if let serde_json::Value::Array(local_items) = local_val {
                        items.extend(local_items.clone());
                    } else {
                        items.push(local_val.clone());
                    }
                } else {
                    items.push(self.parse_value_with_locals(part_trimmed, locals));
                }
            }
        }

        // Handle array post-modifier `all { ... }` or `with { ... }`
        if after.starts_with("all") || after.starts_with("with") {
            let mod_body = if let Some(stripped) = after.strip_prefix("all") {
                stripped.trim()
            } else if let Some(stripped) = after.strip_prefix("with") {
                stripped.trim()
            } else {
                ""
            };
            if mod_body.starts_with('{') && mod_body.ends_with('}') {
                let empty_vars = HashMap::new();
                if let Some(mod_map) = parse_relaxed_object(mod_body, &empty_vars) {
                    for item in &mut items {
                        if let Some(obj) = item.as_object_mut() {
                            for (k, v) in &mod_map {
                                obj.insert(k.clone(), v.clone());
                            }
                        }
                    }
                }
            }
        }

        Some(serde_json::Value::Array(items))
    }
}

fn parse_var_with_object(s: &str, locals: &HashMap<String, serde_json::Value>) -> Option<serde_json::Value> {
    let trimmed = s.trim();
    let with_idx = trimmed.find(" with")?;
    let var_part = trimmed[..with_idx].trim();
    let with_part = trimmed[with_idx + 5..].trim();
    if !with_part.starts_with('{') || !with_part.ends_with('}') {
        return None;
    }

    let local_val = locals.get(var_part).or_else(|| {
        locals.iter().find_map(|(k, v)| {
            if k.starts_with(var_part) || var_part.starts_with(k) {
                Some(v)
            } else {
                None
            }
        })
    })?;

    let empty_vars = HashMap::new();
    let with_map = parse_relaxed_object(with_part, &empty_vars)?;

    match local_val {
        serde_json::Value::Array(items) => {
            let mut updated_items = Vec::new();
            for item in items {
                let mut item_obj = item.as_object().cloned().unwrap_or_default();
                for (k, v) in &with_map {
                    item_obj.insert(k.clone(), v.clone());
                }
                updated_items.push(serde_json::Value::Object(item_obj));
            }
            Some(serde_json::Value::Array(updated_items))
        }
        serde_json::Value::Object(obj) => {
            let mut updated_obj = obj.clone();
            for (k, v) in with_map {
                updated_obj.insert(k, v);
            }
            Some(serde_json::Value::Object(updated_obj))
        }
        _ => None,
    }
}

fn split_top_level(s: &str, delimiter: char) -> Vec<&str> {
    let mut parts = Vec::new();
    let mut depth_paren = 0;
    let mut depth_brace = 0;
    let mut depth_bracket = 0;
    let mut in_quote = None;
    let mut start = 0;
    let chars: Vec<(usize, char)> = s.char_indices().collect();

    for i in 0..chars.len() {
        let (idx, c) = chars[i];
        if let Some(q) = in_quote {
            if c == q {
                in_quote = None;
            }
            continue;
        }
        match c {
            '"' | '\'' => in_quote = Some(c),
            '(' => depth_paren += 1,
            ')' if depth_paren > 0 => depth_paren -= 1,
            '{' => depth_brace += 1,
            '}' if depth_brace > 0 => depth_brace -= 1,
            '[' => depth_bracket += 1,
            ']' if depth_bracket > 0 => depth_bracket -= 1,
            _ => {
                if c == delimiter && depth_paren == 0 && depth_brace == 0 && depth_bracket == 0 {
                    parts.push(s[start..idx].trim());
                    let next_start = if i + 1 < chars.len() { chars[i + 1].0 } else { s.len() };
                    start = next_start;
                }
            }
        }
    }
    if start < s.len() {
        let tail = s[start..].trim();
        if !tail.is_empty() {
            parts.push(tail);
        }
    }
    parts
}

fn num_to_json(n: f64) -> serde_json::Value {
    if n.fract() == 0.0 && n >= (i64::MIN as f64) && n <= (i64::MAX as f64) {
        serde_json::Value::Number((n as i64).into())
    } else {
        serde_json::Number::from_f64(n)
            .map(serde_json::Value::Number)
            .unwrap_or(serde_json::Value::Null)
    }
}

fn eval_simple_math(expr: &str, vars: &HashMap<&str, f64>) -> Option<f64> {
    let trimmed = expr.trim();
    if let Some((left, right)) = trimmed.rsplit_once('+') {
        let l = eval_simple_math(left, vars)?;
        let r = eval_simple_math(right, vars)?;
        return Some(l + r);
    }
    if let Some((left, right)) = trimmed.rsplit_once('-') {
        if !left.trim().is_empty() {
            let l = eval_simple_math(left, vars)?;
            let r = eval_simple_math(right, vars)?;
            return Some(l - r);
        }
    }
    if let Some((left, right)) = trimmed.rsplit_once('*') {
        let l = eval_simple_math(left, vars)?;
        let r = eval_simple_math(right, vars)?;
        return Some(l * r);
    }
    if let Some((left, right)) = trimmed.rsplit_once('/') {
        let l = eval_simple_math(left, vars)?;
        let r = eval_simple_math(right, vars)?;
        if r != 0.0 {
            return Some(l / r);
        }
    }
    if let Some(&v) = vars.get(trimmed) {
        return Some(v);
    }
    trimmed.parse::<f64>().ok()
}

fn eval_value_with_vars(val_str: &str, vars: &HashMap<&str, f64>) -> serde_json::Value {
    let trimmed = val_str.trim();
    if trimmed == "true" {
        return serde_json::Value::Bool(true);
    }
    if trimmed == "false" {
        return serde_json::Value::Bool(false);
    }
    if trimmed == "null" {
        return serde_json::Value::Null;
    }
    if (trimmed.starts_with('"') && trimmed.ends_with('"'))
        || (trimmed.starts_with('\'') && trimmed.ends_with('\''))
    {
        return serde_json::Value::String(trimmed[1..trimmed.len() - 1].to_string());
    }
    if let Some(&num) = vars.get(trimmed) {
        return num_to_json(num);
    }
    if let Some(computed) = eval_simple_math(trimmed, vars) {
        return num_to_json(computed);
    }
    if let Ok(num) = trimmed.parse::<f64>() {
        return num_to_json(num);
    }
    serde_json::Value::String(trimmed.to_string())
}

fn parse_relaxed_object(s: &str, vars: &HashMap<&str, f64>) -> Option<serde_json::Map<String, serde_json::Value>> {
    let trimmed = s.trim();
    if !trimmed.starts_with('{') || !trimmed.ends_with('}') {
        return None;
    }
    let inner = trimmed[1..trimmed.len() - 1].trim();
    let mut map = serde_json::Map::new();
    if inner.is_empty() {
        return Some(map);
    }
    for item in split_top_level(inner, ',') {
        let item_trimmed = item.trim();
        if item_trimmed.is_empty() {
            continue;
        }
        if let Some((k, v)) = item_trimmed.split_once(':') {
            let key = k.trim().trim_matches('"').trim_matches('\'').to_string();
            let val = eval_value_with_vars(v, vars);
            map.insert(key, val);
        }
    }
    Some(map)
}

fn parse_1d_generator(s: &str) -> Option<serde_json::Value> {
    let trimmed = s.trim();
    if !trimmed.starts_with('{') {
        return None;
    }

    // Find closing brace of template
    let mut depth = 0;
    let mut close_idx = None;
    let mut in_quote = None;

    for (idx, c) in trimmed.char_indices() {
        if let Some(q) = in_quote {
            if c == q {
                in_quote = None;
            }
            continue;
        }
        match c {
            '"' | '\'' => in_quote = Some(c),
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    close_idx = Some(idx);
                    break;
                }
            }
            _ => {}
        }
    }

    let close_idx = close_idx?;
    let template_str = &trimmed[..=close_idx];
    let after = trimmed[close_idx + 1..].trim();

    if !after.starts_with('*') {
        return None;
    }

    let after_mult = after[1..].trim();
    let count_end = after_mult
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(after_mult.len());
    let count: usize = after_mult[..count_end].parse().ok()?;
    let mut rest = after_mult[count_end..].trim();

    let mut inc_props: Vec<String> = Vec::new();
    let mut step: f64 = 0.0;

    if rest.starts_with("inc ") {
        rest = rest[4..].trim();
        let by_idx = rest.find(" by ")?;
        let props_str = rest[..by_idx].trim();
        let after_by = rest[by_idx + 4..].trim();

        let clean_props = if props_str.starts_with('(') && props_str.ends_with(')') {
            &props_str[1..props_str.len() - 1]
        } else {
            props_str
        };
        for p in clean_props.split(',') {
            let p_trim = p.trim().trim_matches('"').trim_matches('\'');
            if !p_trim.is_empty() {
                inc_props.push(p_trim.to_string());
            }
        }

        if let Some(with_pos) = after_by.find(" with") {
            step = after_by[..with_pos].trim().parse().ok()?;
            rest = after_by[with_pos..].trim();
        } else {
            step = after_by.trim().parse().ok()?;
            rest = "";
        }
    }

    let with_str = if rest.starts_with("with") {
        let with_body = rest[4..].trim();
        if with_body.starts_with('{') && with_body.ends_with('}') {
            Some(with_body)
        } else {
            None
        }
    } else {
        None
    };

    let mut items = Vec::new();
    for i in 0..count {
        let mut vars = HashMap::new();
        vars.insert("i", i as f64);

        let mut obj = parse_relaxed_object(template_str, &vars)?;

        for prop in &inc_props {
            if let Some(val) = obj.get(prop) {
                if let Some(num) = val.as_f64() {
                    let new_num = num + (i as f64) * step;
                    obj.insert(prop.clone(), num_to_json(new_num));
                }
            }
        }

        if let Some(w_str) = with_str {
            let with_map = parse_relaxed_object(w_str, &vars)?;
            for (k, v) in with_map {
                obj.insert(k, v);
            }
        }

        items.push(serde_json::Value::Object(obj));
    }

    Some(serde_json::Value::Array(items))
}

fn parse_grid_generator(s: &str) -> Option<serde_json::Value> {
    let trimmed = s.trim();
    if !trimmed.starts_with("grid ") {
        return None;
    }
    let after = trimmed[5..].trim();

    let x_idx = after.find(" x ")?;
    let cols: usize = after[..x_idx].trim().parse().ok()?;
    let after = after[x_idx + 3..].trim();

    let rows_end = after
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(after.len());
    let rows: usize = after[..rows_end].parse().ok()?;
    let after = after[rows_end..].trim();

    let origin_kw_len = if after.starts_with("at ") {
        3
    } else if after.starts_with("from ") {
        5
    } else {
        return None;
    };
    let after = after[origin_kw_len..].trim();

    if !after.starts_with('(') {
        return None;
    }
    let close_paren = after.find(')')?;
    let origin_str = &after[1..close_paren];
    let (x0_str, y0_str) = origin_str.split_once(',')?;
    let x0: f64 = x0_str.trim().parse().ok()?;
    let y0: f64 = y0_str.trim().parse().ok()?;
    let after = after[close_paren + 1..].trim();

    let after = after.strip_prefix("step")?.trim();
    if !after.starts_with('(') {
        return None;
    }
    let close_paren2 = after.find(')')?;
    let step_str = &after[1..close_paren2];
    let (dx_str, dy_str) = step_str.split_once(',')?;
    let dx: f64 = dx_str.trim().parse().ok()?;
    let dy: f64 = dy_str.trim().parse().ok()?;
    let after = after[close_paren2 + 1..].trim();

    let with_str = if after.starts_with("with") {
        let with_body = after.strip_prefix("with")?.trim();
        if with_body.starts_with('{') && with_body.ends_with('}') {
            Some(with_body)
        } else {
            None
        }
    } else {
        None
    };

    let mut items = Vec::new();
    for r in 0..rows {
        for c in 0..cols {
            let i = r * cols + c;
            let x = x0 + (c as f64) * dx;
            let y = y0 + (r as f64) * dy;

            let mut vars = HashMap::new();
            vars.insert("col", c as f64);
            vars.insert("row", r as f64);
            vars.insert("r", r as f64);
            vars.insert("c", c as f64);
            vars.insert("i", i as f64);

            let mut obj = serde_json::Map::new();
            obj.insert("x".to_string(), num_to_json(x));
            obj.insert("y".to_string(), num_to_json(y));
            obj.insert("start_x".to_string(), num_to_json(x));
            obj.insert("start_y".to_string(), num_to_json(y));
            obj.insert("col".to_string(), num_to_json(c as f64));
            obj.insert("row".to_string(), num_to_json(r as f64));

            if let Some(w_str) = with_str {
                let with_map = parse_relaxed_object(w_str, &vars)?;
                for (k, v) in with_map {
                    obj.insert(k, v);
                }
            }

            items.push(serde_json::Value::Object(obj));
        }
    }

    Some(serde_json::Value::Array(items))
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
            locals: HashMap::new(),
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
            timer: None,
            keys: HashMap::new(),
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

        let gen = JsCodegen::new(page, logic, "{}".to_string(), None, HashMap::new(), None);
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
            locals: HashMap::new(),
            derived: HashMap::new(),
            helpers: HashMap::new(),
            actions: HashMap::new(),
            timer: None,
            keys: HashMap::new(),
        };
        let gen = JsCodegen::new(ViewNode::Text("hi".to_string()), logic, "{}".to_string(), None, HashMap::new(), None);
        assert_eq!(gen.parse_value("\"hello\""), serde_json::Value::String("hello".to_string()));
        assert_eq!(gen.parse_value("42"), serde_json::json!(42));
        assert_eq!(gen.parse_value("true"), serde_json::json!(true));
        assert_eq!(gen.parse_value("[1,2,3]"), serde_json::json!([1, 2, 3]));
    }

    #[test]
    fn parses_1d_generator_and_relaxed_arrays() {
        let logic = LogicDefinition {
            state: HashMap::new(),
            locals: HashMap::new(),
            derived: HashMap::new(),
            helpers: HashMap::new(),
            actions: HashMap::new(),
            timer: None,
            keys: HashMap::new(),
        };
        let gen = JsCodegen::new(ViewNode::Text("hi".to_string()), logic, "{}".to_string(), None, HashMap::new(), None);
        
        // 1D Generator standalone
        let val1 = gen.parse_value("{ \"x\": 50, \"start_x\": 50 } * 3 inc (x, start_x) by 65 with { \"y\": 40, \"type\": 1, \"alive\": true }");
        let arr1 = val1.as_array().expect("Must be an array");
        assert_eq!(arr1.len(), 3);
        assert_eq!(arr1[0]["x"], 50);
        assert_eq!(arr1[0]["start_x"], 50);
        assert_eq!(arr1[0]["y"], 40);
        assert_eq!(arr1[0]["type"], 1);
        assert_eq!(arr1[0]["alive"], true);

        assert_eq!(arr1[1]["x"], 115);
        assert_eq!(arr1[1]["start_x"], 115);
        assert_eq!(arr1[2]["x"], 180);
        assert_eq!(arr1[2]["start_x"], 180);

        // Nested inside array:
        let val2 = gen.parse_value("[ { x: 10 } * 2 inc x by 5 with { active: true }, { x: 100 } ]");
        let arr2 = val2.as_array().expect("Must be an array");
        assert_eq!(arr2.len(), 3);
        assert_eq!(arr2[0]["x"], 10);
        assert_eq!(arr2[0]["active"], true);
        assert_eq!(arr2[1]["x"], 15);
        assert_eq!(arr2[1]["active"], true);
        assert_eq!(arr2[2]["x"], 100);

        // 2D Grid generator
        let val3 = gen.parse_value("grid 3 x 2 at (10, 20) step (5, 15) with { type: row + 1, active: true }");
        let arr3 = val3.as_array().expect("Must be an array");
        assert_eq!(arr3.len(), 6);
        // Row 0
        assert_eq!(arr3[0]["x"], 10);
        assert_eq!(arr3[0]["y"], 20);
        assert_eq!(arr3[0]["type"], 1);
        assert_eq!(arr3[1]["x"], 15);
        assert_eq!(arr3[1]["y"], 20);
        assert_eq!(arr3[2]["x"], 20);
        assert_eq!(arr3[2]["y"], 20);
        // Row 1
        assert_eq!(arr3[3]["x"], 10);
        assert_eq!(arr3[3]["y"], 35);
        assert_eq!(arr3[3]["type"], 2);
        assert_eq!(arr3[4]["x"], 15);
        assert_eq!(arr3[4]["y"], 35);
        assert_eq!(arr3[5]["x"], 20);
        assert_eq!(arr3[5]["y"], 35);
    }

    #[test]
    fn parses_local_templates_and_array_all_modifier() {
        let logic = LogicDefinition {
            state: HashMap::from([(
                "aliens".to_string(),
                r#"[
                    alien with { "y": 40, "start_y": 40, "type": 1 },
                    alien with { "y": 80, "start_y": 80, "type": 2 },
                    alien with { "y": 120, "start_y": 120, "type": 3 }
                ] all { "alive": true }"#.to_string(),
            )]),
            locals: HashMap::from([(
                "alien_batch".to_string(),
                r#"{ "x": 50, "start_x": 50 } * 6 inc (x, start_x) by 65"#.to_string(),
            )]),
            derived: HashMap::new(),
            helpers: HashMap::new(),
            actions: HashMap::new(),
            timer: None,
            keys: HashMap::new(),
        };
        let gen = JsCodegen::new(ViewNode::Text("hi".to_string()), logic, "{}".to_string(), None, HashMap::new(), None);
        let state_json_str = gen.generate_state_json();
        let state_val: serde_json::Value = serde_json::from_str(&state_json_str).expect("Valid JSON");
        
        // Assert alien_batch is NOT in stateJson (it's local)
        assert!(state_val.get("alien_batch").is_none());

        // Assert aliens has exactly 18 items
        let aliens = state_val.get("aliens").expect("aliens exists").as_array().expect("aliens is array");
        assert_eq!(aliens.len(), 18);

        // Row 1
        assert_eq!(aliens[0]["x"], 50);
        assert_eq!(aliens[0]["start_x"], 50);
        assert_eq!(aliens[0]["y"], 40);
        assert_eq!(aliens[0]["start_y"], 40);
        assert_eq!(aliens[0]["type"], 1);
        assert_eq!(aliens[0]["alive"], true);

        assert_eq!(aliens[5]["x"], 375);
        assert_eq!(aliens[5]["start_x"], 375);
        assert_eq!(aliens[5]["y"], 40);
        assert_eq!(aliens[5]["start_y"], 40);
        assert_eq!(aliens[5]["type"], 1);
        assert_eq!(aliens[5]["alive"], true);

        // Row 2
        assert_eq!(aliens[6]["x"], 50);
        assert_eq!(aliens[6]["y"], 80);
        assert_eq!(aliens[6]["type"], 2);
        assert_eq!(aliens[6]["alive"], true);

        // Row 3
        assert_eq!(aliens[12]["x"], 50);
        assert_eq!(aliens[12]["y"], 120);
        assert_eq!(aliens[12]["type"], 3);
        assert_eq!(aliens[12]["alive"], true);
    }

    #[test]
    fn embedded_source_cannot_close_the_bootstrap_script() {
        let logic = LogicDefinition {
            state: HashMap::new(),
            locals: HashMap::new(),
            derived: HashMap::new(),
            helpers: HashMap::new(),
            actions: HashMap::new(),
            timer: None,
            keys: HashMap::new(),
        };
        let source = "</script><p>source code</p>";
        let generator = JsCodegen::new(ViewNode::Text(source.into()), logic, "{}".into(), None, HashMap::new(), None);
        let generated = generator.generate();
        assert!(!generated.contains(source));
        assert!(generated.contains(r"\u003c/script>"));
    }

    #[test]
    fn emitter_state_codegen() {
        let mut state = HashMap::new();
        state.insert(
            "sparks".to_string(),
            r#"emitter { "life": 14, "friction": 0.92, "size": [3, 5] }"#.to_string(),
        );
        let logic = LogicDefinition {
            state,
            locals: HashMap::new(),
            derived: HashMap::new(),
            helpers: HashMap::new(),
            actions: HashMap::new(),
            timer: None,
            keys: HashMap::new(),
        };
        let generator = JsCodegen::new(ViewNode::Text("test".into()), logic, "{}".into(), None, HashMap::new(), None);
        let generated = generator.generate();
        assert!(generated.contains(r#""sparks":[]"#) || generated.contains(r#""sparks": []"#));
        assert!(generated.contains(r#""sparks":{"friction":0.92,"life":14,"size":[3,5]}"#));
    }

    #[test]
    fn test_space_invaders_parse() {
        let doc = crate::rune_parser::load_rune_document_from_path(std::path::Path::new("examples/space_invaders/space_invaders.rune")).unwrap();
        let frontend = crate::apps::rune_web::parser::parse_rune_web_frontend(&doc, "space-invaders").unwrap();
        let logic = frontend.logic_definitions.get("invaders").unwrap();
        assert!(logic.state.contains_key("aliens"));
    }

    #[test]
    fn test_vectworms_parse() {
        let doc = crate::rune_parser::load_rune_document_from_path(std::path::Path::new("examples/vectworms/vectworms.rune")).unwrap();
        let frontend = crate::apps::rune_web::parser::parse_rune_web_frontend(&doc, "vectworms").unwrap();
        let logic = frontend.logic_definitions.get("vectworms").unwrap().clone();
        assert!(logic.state.contains_key("mushrooms"));
        assert!(logic.state.contains_key("worms"));

        let generator = JsCodegen::new(ViewNode::Text("test".into()), logic, "{}".into(), None, HashMap::new(), None);
        let state_val: serde_json::Value = serde_json::from_str(&generator.generate_state_json()).unwrap();
        let worms = state_val.get("worms").unwrap().as_array().unwrap();
        assert_eq!(worms.len(), 10);
        assert_eq!(worms[0]["id"], 0);
        assert_eq!(worms[0]["is_head"], true);
        assert_eq!(worms[0]["x"], 220);
        assert_eq!(worms[1]["id"], 1);
        assert_eq!(worms[1]["is_head"], false);
        assert_eq!(worms[1]["x"], 200);
        assert_eq!(worms[9]["id"], 9);
        assert_eq!(worms[9]["x"], 40);
        let mushrooms = state_val.get("mushrooms").unwrap().as_array().unwrap();
        assert_eq!(mushrooms.len(), 30);
        assert_eq!(mushrooms[0]["hp"], 3);
        assert_eq!(mushrooms[0]["alive"], true);
    }
}
