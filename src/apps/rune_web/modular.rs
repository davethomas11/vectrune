use super::ast::{HelperDefinition, LogicDefinition};
use super::parser::{parse_logic_section, ParseError};
use crate::rune_ast::{RuneDocument, Section};
use std::collections::HashMap;

fn setting(section: &Section, name: &str) -> Result<serde_json::Value, ParseError> {
    match section.kv.get(name) {
        None => Ok(serde_json::Value::Null),
        Some(value) => {
            let json = value.to_json();
            if let Some(text) = json.as_str() {
                serde_json::from_str(text).map_err(|_| {
                    ParseError(format!(
                        "{} in @{} must be JSON",
                        name,
                        section.path.join("/")
                    ))
                })
            } else {
                Ok(json)
            }
        }
    }
}

fn identifier(name: &str) -> bool {
    !name.is_empty()
        && !matches!(
            name,
            "__proto__" | "constructor" | "prototype" | "self" | "id" | "__type"
        )
        && name
            .chars()
            .enumerate()
            .all(|(i, c)| c == '_' || c.is_ascii_alphabetic() || (i > 0 && c.is_ascii_digit()))
}

fn names(section: &Section, key: &str) -> Result<Vec<String>, ParseError> {
    let value = setting(section, key)?;
    if value.is_null() {
        return Ok(vec![]);
    }
    let list = value
        .as_array()
        .ok_or_else(|| ParseError(format!("{key} must be a list of names")))?;
    list.iter()
        .map(|v| {
            v.as_str()
                .filter(|s| identifier(s))
                .map(str::to_owned)
                .ok_or_else(|| ParseError(format!("Invalid name in {key}")))
        })
        .collect()
}

pub(super) fn attach(
    doc: &RuneDocument,
    logics: &mut HashMap<String, LogicDefinition>,
) -> Result<(), ParseError> {
    let mut definitions = HashMap::new();
    for section in &doc.sections {
        if section.path.len() == 2 && matches!(section.path[0].as_str(), "Module" | "Type") {
            if !identifier(&section.path[1]) {
                return Err(ParseError(
                    "Module and Type names must be identifiers".into(),
                ));
            }
            if definitions
                .insert((section.path[0].clone(), section.path[1].clone()), section)
                .is_some()
            {
                return Err(ParseError(format!("Duplicate @{}", section.path.join("/"))));
            }
        }
    }
    for section in &doc.sections {
        if section.path.len() != 2 || section.path[0] != "Logic" {
            continue;
        }
        let Some(logic) = logics.get_mut(&section.path[1]) else {
            continue;
        };
        let modules = setting(section, "modules")?;
        if !modules.is_null() {
            let aliases = modules
                .as_object()
                .ok_or_else(|| ParseError("modules must map aliases to @Module names".into()))?;
            for (alias, target) in aliases {
                if !identifier(alias) || logic.state.contains_key(alias) {
                    return Err(ParseError(format!(
                        "Invalid or conflicting module alias: {alias}"
                    )));
                }
                let target = target
                    .as_str()
                    .ok_or_else(|| ParseError("Module targets must be names".into()))?;
                let module = definitions
                    .get(&("Module".into(), target.into()))
                    .ok_or_else(|| ParseError(format!("Unknown @Module/{target}")))?;
                let parsed = parse_logic_section(module)?;
                validate_definition(module, &parsed)?;
                if parsed.actions.is_empty() && parsed.helpers.is_empty() {
                    return Err(ParseError(
                        "Module must define at least one action or func".into(),
                    ));
                }
                let exports = names(module, "exports")?;
                check_exports(&parsed, &exports)?;
                let state = parsed
                    .state
                    .iter()
                    .map(|(key, value)| {
                        format!("{}:{}", serde_json::to_string(key).unwrap(), value)
                    })
                    .collect::<Vec<_>>()
                    .join(",");
                logic.state.insert(alias.clone(), format!("{{{state}}}"));
                for (name, mut action) in parsed.actions {
                    action.scope = Some(alias.clone());
                    action.private = !exports.contains(&name);
                    let qualified = format!("{alias}.{name}");
                    if logic.actions.insert(qualified.clone(), action).is_some() {
                        return Err(ParseError(format!("Conflicting action: {qualified}")));
                    }
                }
                for (name, mut helper) in parsed.helpers {
                    helper.scope = Some(alias.clone());
                    helper.private = !exports.contains(&name);
                    let qualified = format!("{alias}.{name}");
                    if logic.helpers.insert(qualified.clone(), helper).is_some() {
                        return Err(ParseError(format!("Conflicting helper: {qualified}")));
                    }
                }
            }
        }
        let type_names = names(section, "types")?;
        for name in &type_names {
            let definition = definitions
                .get(&("Type".into(), name.clone()))
                .ok_or_else(|| ParseError(format!("Unknown @Type/{name}")))?;
            let parsed = parse_logic_section(definition)?;
            validate_definition(definition, &parsed)?;
            if logic.helpers.contains_key(name) || logic.state.contains_key(name) {
                return Err(ParseError(format!("Conflicting type: {name}")));
            }
            let calls = regex::Regex::new(r"([A-Za-z_]\w*)\s*\(").unwrap();
            for value in logic.state.values().chain(logic.locals.values()) {
                let mut outside = String::new();
                let mut quote = None;
                let mut escaped = false;
                for ch in value.chars() {
                    if escaped {
                        escaped = false;
                        outside.push(' ');
                    } else if quote.is_some() {
                        if ch == '\\' {
                            escaped = true;
                        } else if Some(ch) == quote {
                            quote = None;
                        }
                        outside.push(' ');
                    } else if ch == '"' || ch == '\'' {
                        quote = Some(ch);
                        outside.push(' ');
                    } else {
                        outside.push(ch);
                    }
                }
                if calls
                    .captures_iter(&outside)
                    .any(|call| type_names.iter().any(|name| name == &call[1]))
                {
                    return Err(ParseError(
                        "Construct Type instances in actions, not initial state or locals".into(),
                    ));
                }
            }
            logic.helpers.insert(
                name.clone(),
                HelperDefinition {
                    params: vec!["id".into(), "fields".into()],
                    entity: Some(parsed.state),
                    ..Default::default()
                },
            );
            for (method, mut action) in parsed.actions {
                action.scope = Some(format!("@{name}"));
                if logic
                    .actions
                    .insert(format!("{name}.{method}"), action)
                    .is_some()
                {
                    return Err(ParseError(format!(
                        "Conflicting type method: {name}.{method}"
                    )));
                }
            }
            if !parsed.helpers.is_empty() {
                return Err(ParseError(
                    "Type func helpers are not supported; use actions or modules".into(),
                ));
            }
        }
    }
    Ok(())
}

fn validate_definition(section: &Section, parsed: &LogicDefinition) -> Result<(), ParseError> {
    if !parsed.derived.is_empty()
        || !parsed.locals.is_empty()
        || parsed.timer.is_some()
        || !parsed.keys.is_empty()
        || section.kv.contains_key("modules")
        || section.kv.contains_key("types")
    {
        return Err(ParseError(
            "Module/Type supports state, actions and module funcs; schedule calls from @Logic"
                .into(),
        ));
    }
    if parsed
        .state
        .keys()
        .chain(parsed.actions.keys())
        .chain(parsed.helpers.keys())
        .any(|name| !identifier(name))
    {
        return Err(ParseError(
            "Module/Type members must be identifiers and cannot use reserved names".into(),
        ));
    }
    if parsed
        .state
        .keys()
        .any(|name| parsed.actions.contains_key(name) || parsed.helpers.contains_key(name))
        || parsed
            .actions
            .keys()
            .any(|name| parsed.helpers.contains_key(name))
    {
        return Err(ParseError(
            "Module/Type fields and callable members must have distinct names".into(),
        ));
    }
    Ok(())
}

fn check_exports(parsed: &LogicDefinition, exports: &[String]) -> Result<(), ParseError> {
    for name in exports {
        if !parsed.actions.contains_key(name) && !parsed.helpers.contains_key(name) {
            return Err(ParseError(format!("Unknown module export: {name}")));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::apps::rune_web::parser::parse_rune_web_frontend;
    use crate::rune_parser::parse_rune;

    #[test]
    fn attaches_scopes_exports_and_entity_defaults() {
        let doc = parse_rune(include_str!(
            "../../../examples/rune-web/modules/modules.rune"
        ))
        .unwrap();
        let frontend = parse_rune_web_frontend(&doc, "home").unwrap();
        let logic = &frontend.logic_definitions["companions"];
        assert_eq!(
            logic.actions["wallet.earn"].scope.as_deref(),
            Some("wallet")
        );
        assert!(!logic.actions["wallet.earn"].private);
        assert!(logic.actions["wallet.purchased"].private);
        assert_eq!(
            logic.actions["Companion.feed"].scope.as_deref(),
            Some("@Companion")
        );
        assert_eq!(
            logic.helpers["Life"].entity.as_ref().unwrap()["starvation"],
            "1800"
        );
    }

    #[test]
    fn rejects_missing_definitions_exports_and_alias_collisions() {
        let source = include_str!("../../../examples/rune-web/modules/modules.rune");
        for (from, to, error) in [
            (
                "\"wallet\":\"Wallet\"",
                "\"wallet\":\"Missing\"",
                "Unknown @Module",
            ),
            ("\"balance\"]", "\"missing\"]", "Unknown module export"),
            (
                "\"Life\",\"Companion\"",
                "\"Missing\",\"Companion\"",
                "Unknown @Type",
            ),
            (
                "\"wallet\":\"Wallet\"",
                "\"pet\":\"Wallet\"",
                "conflicting module alias",
            ),
        ] {
            let doc = parse_rune(&source.replace(from, to)).unwrap();
            let result = parse_rune_web_frontend(&doc, "home");
            assert!(result.unwrap_err().to_string().contains(error));
        }
    }

    #[test]
    fn rejects_initial_constructors_reserved_members_and_ambiguous_fields() {
        let source = include_str!("../../../examples/rune-web/modules/modules.rune");
        for (from, to, error) in [
            (
                "pet = null",
                "pet = Companion(\"crab-1\")",
                "Construct Type",
            ),
            ("age = 0", "id = 0", "reserved names"),
            ("pearls = 30", "earn = 30", "distinct names"),
            (
                "@Module/Wallet",
                "@Module/Wallet\n\n@Module/Wallet",
                "Duplicate @Module",
            ),
        ] {
            let doc = parse_rune(&source.replace(from, to)).unwrap();
            assert!(parse_rune_web_frontend(&doc, "home")
                .unwrap_err()
                .to_string()
                .contains(error));
        }
        let quoted = source.replace("pet = null", "pet = \"Companion(id)\"");
        assert!(parse_rune_web_frontend(&parse_rune(&quoted).unwrap(), "home").is_ok());
    }
}
