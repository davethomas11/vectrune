/// Hook System Parser and Integration
///
/// Parses @Hook declarations from Rune documents and integrates with the
/// memory hooks registry for declarative reactivity.

#[allow(dead_code)]

use crate::memory::hooks::{HookConfig, HookRegistry, ReactivityProvider};
use crate::rune_ast::{RuneDocument, Section};
use crate::util::{log, LogLevel};
use std::collections::HashMap;

/// Represents a parsed @Hook declaration
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ParsedHook {
    pub id: String,
    pub target_key: String,
    pub observers: Vec<String>,
    pub observer_type: ReactivityProvider,
    pub observer_config: HashMap<String, String>, // e.g., webhook_url, channel
    pub custom_logic: Option<Vec<String>>,        // Rune code to execute
}

/// Extract all @Hook sections from a Rune document
#[allow(dead_code)]
pub fn parse_hooks_from_document(doc: &RuneDocument) -> Vec<ParsedHook> {
    let mut hooks = Vec::new();

    // Get all sections with path starting with "Hook"
    for section in &doc.sections {
        if section.path.is_empty() {
            continue;
        }

        if section.path[0] == "Hook" {
            if let Ok(parsed_hook) = parse_hook_section(section) {
                let target_key = parsed_hook.target_key.clone();
                let id = parsed_hook.id.clone();
                hooks.push(parsed_hook);
                log(
                    LogLevel::Debug,
                    &format!("Parsed hook: {} (target: {})", id, target_key),
                );
            }
        }
    }

    hooks
}

/// Parse a single @Hook section into a ParsedHook
#[allow(dead_code)]
fn parse_hook_section(section: &Section) -> Result<ParsedHook, String> {
    // Extract hook ID from path (e.g., ["Hook", "game_state_sync"] → "game_state_sync")
    let id = section
        .path
        .get(1)
        .cloned()
        .ok_or_else(|| "Hook declaration missing ID".to_string())?;

    // Extract target key (required)
    let target_key = section
        .kv
        .get("target")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("Hook '{}': missing required 'target' field", id))?
        .to_string();

    // Extract observer type (defaults to "websocket")
    let observer_type_str = section
        .kv
        .get("observer")
        .and_then(|v| v.as_str())
        .unwrap_or("websocket");
    let observer_type = ReactivityProvider::from_str(observer_type_str);

    // Extract optional fields based on observer type
    let mut observer_config = HashMap::new();

    if let ReactivityProvider::WebSocket = observer_type {
        if let Some(channel) = section.kv.get("channel").and_then(|v| v.as_str()) {
            observer_config.insert("channel".to_string(), channel.to_string());
        }
        if let Some(endpoint) = section.kv.get("endpoint").and_then(|v| v.as_str()) {
            observer_config.insert("endpoint".to_string(), endpoint.to_string());
        }
    }

    if let ReactivityProvider::Poll = observer_type {
        if let Some(url) = section.kv.get("webhook_url").and_then(|v| v.as_str()) {
            observer_config.insert("webhook_url".to_string(), url.to_string());
        }
    }

    // Extract custom logic from "run" section (optional)
    let custom_logic = section
        .series
        .get("run")
        .map(|values| values.iter().filter_map(|v| v.as_str()).map(|s| s.to_string()).collect());

    // Default observers vec - will be populated by the registry
    let observers = vec![format!("hook_{}", id)];

    Ok(ParsedHook {
        id,
        target_key,
        observers,
        observer_type,
        observer_config,
        custom_logic,
    })
}

/// Register parsed hooks into the hook registry
#[allow(dead_code)]
pub async fn register_hooks(
    registry: &HookRegistry,
    hooks: Vec<ParsedHook>,
) -> Result<(), Vec<String>> {
    let mut errors = Vec::new();

    for hook in hooks {
        // Create observer based on type
        let observer_id = format!("hook_{}", hook.id);

        // Register the appropriate observer based on type
        match hook.observer_type {
            ReactivityProvider::WebSocket => {
                use crate::memory::hooks::WebSocketObserver;
                use std::sync::Arc;

                let endpoint = hook
                    .observer_config
                    .get("endpoint")
                    .cloned()
                    .unwrap_or_else(|| "/ws".to_string());
                let channel = hook.observer_config.get("channel").cloned();

                let observer = Arc::new(WebSocketObserver::new(endpoint, channel));
                registry.register_observer(observer_id.clone(), observer).await;

                log(
                    LogLevel::Info,
                    &format!(
                        "Registered WebSocket observer '{}' for hook '{}'",
                        observer_id, hook.id
                    ),
                );
            }

            ReactivityProvider::Poll => {
                use crate::memory::hooks::WebhookObserver;
                use std::sync::Arc;

                let url = match hook.observer_config.get("webhook_url") {
                    Some(u) => u.clone(),
                    None => {
                        errors.push(format!(
                            "Hook '{}': Poll mode requires 'webhook_url'",
                            hook.id
                        ));
                        continue;
                    }
                };

                let observer = Arc::new(WebhookObserver::new(url, "POST".to_string()));
                registry.register_observer(observer_id.clone(), observer).await;

                log(
                    LogLevel::Info,
                    &format!(
                        "Registered Webhook observer '{}' for hook '{}'",
                        observer_id, hook.id
                    ),
                );
            }

            ReactivityProvider::SSE => {
                use crate::memory::hooks::SSEObserver;
                use std::sync::Arc;

                let topic = hook
                    .observer_config
                    .get("channel")
                    .cloned()
                    .unwrap_or_else(|| "events".to_string());

                let observer = Arc::new(SSEObserver::new(topic));
                registry.register_observer(observer_id.clone(), observer).await;

                log(
                    LogLevel::Info,
                    &format!(
                        "Registered SSE observer '{}' for hook '{}'",
                        observer_id, hook.id
                    ),
                );
            }

            ReactivityProvider::None => {
                log(
                    LogLevel::Warn,
                    &format!(
                        "Hook '{}' has reactivity=none; no observer registered",
                        hook.id
                    ),
                );
            }
        }

        // Register the hook config
        let config = HookConfig {
            id: hook.id.clone(),
            target_key: hook.target_key,
            observers: hook.observers,
            custom_logic: hook.custom_logic.map(|lines| lines.join("\n")),
        };

        registry.register_hook(config).await;
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rune_ast::{Record, Section, Value};

    fn create_test_hook_section() -> Section {
        let mut kv = HashMap::new();
        kv.insert("target".to_string(), Value::String("game_state".to_string()));
        kv.insert("observer".to_string(), Value::String("websocket".to_string()));
        kv.insert("channel".to_string(), Value::String("game".to_string()));

        let mut run_logic = Vec::new();
        run_logic.push(Value::String(
            "ws.broadcast /ws {\"state\": new_value}".to_string(),
        ));

        let mut series = HashMap::new();
        series.insert("run".to_string(), run_logic);

        Section {
            path: vec!["Hook".to_string(), "game_sync".to_string()],
            kv,
            series,
            records: Vec::new(),
            source_file: None,
        }
    }

    #[test]
    fn parse_hook_section_extracts_fields() {
        let section = create_test_hook_section();
        let parsed = parse_hook_section(&section).unwrap();

        assert_eq!(parsed.id, "game_sync");
        assert_eq!(parsed.target_key, "game_state");
        assert_eq!(parsed.observer_type, ReactivityProvider::WebSocket);
        assert_eq!(
            parsed.observer_config.get("channel").map(|s| s.as_str()),
            Some("game")
        );
        assert!(parsed.custom_logic.is_some());
    }

    #[test]
    fn parse_hook_section_missing_target() {
        let mut section = create_test_hook_section();
        section.kv.remove("target");

        let result = parse_hook_section(&section);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_hooks_from_document() {
        let mut doc = RuneDocument { sections: Vec::new() };
        doc.sections.push(create_test_hook_section());

        let hooks = parse_hooks_from_document(&doc);
        assert_eq!(hooks.len(), 1);
        assert_eq!(hooks[0].id, "game_sync");
    }

    #[tokio::test]
    async fn register_hooks_creates_observers() {
        let registry = HookRegistry::new();

        let mut kv = HashMap::new();
        kv.insert("target".to_string(), Value::String("test_key".to_string()));
        kv.insert("observer".to_string(), Value::String("websocket".to_string()));

        let section = Section {
            path: vec!["Hook".to_string(), "test_hook".to_string()],
            kv,
            series: HashMap::new(),
            records: Vec::new(),
            source_file: None,
        };

        let parsed_hook = parse_hook_section(&section).unwrap();
        let result = register_hooks(&registry, vec![parsed_hook]).await;

        assert!(result.is_ok());
    }
}




