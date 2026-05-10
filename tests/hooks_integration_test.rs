/// Integration Tests for Memory Hooks System
///
/// Tests cover:
/// - Hook registration and initialization
/// - Signal dispatch to multiple observers
/// - CLI commands (list, validate, debug, info)
/// - Error handling and edge cases

#[cfg(test)]
mod memory_hooks_integration_tests {
    use rune_runtime::memory::{
        HookRegistry, HookConfig, MemorySignal, MemoryObserver, WebSocketObserver,
        WebhookObserver, SSEObserver, LocalObserver, ReactivityProvider,
        parse_hooks_from_document, register_hooks, HookContextManager,
    };
    use rune_runtime::rune_ast::{RuneDocument, Section, Value};
    use std::collections::HashMap;
    use std::sync::Arc;

    // ==================== Helpers ====================

    fn create_hook_section(id: &str, target: &str, observer_type: &str) -> Section {
        let mut kv = HashMap::new();
        kv.insert("target".to_string(), Value::String(target.to_string()));
        kv.insert("observer".to_string(), Value::String(observer_type.to_string()));

        if observer_type == "websocket" {
            kv.insert("channel".to_string(), Value::String("test".to_string()));
        }

        Section {
            path: vec!["Hook".to_string(), id.to_string()],
            kv,
            series: HashMap::new(),
            records: Vec::new(),
        }
    }

    fn create_document_with_hooks(hooks: Vec<Section>) -> RuneDocument {
        RuneDocument { sections: hooks }
    }

    // ==================== Hook Registry Tests ====================

    #[tokio::test]
    async fn test_registry_empty_initialization() {
        let registry = HookRegistry::new();
        let subs = registry.get_subscriptions().await;
        assert_eq!(subs.len(), 0);
    }

    #[tokio::test]
    async fn test_registry_registers_observer() {
        let registry = HookRegistry::new();
        let observer = Arc::new(WebSocketObserver::new("/ws".to_string(), None));

        registry.register_observer("ws1".to_string(), observer).await;

        // Verify it's registered by checking hook dispatch
        let config = HookConfig {
            id: "hook1".to_string(),
            target_key: "test_key".to_string(),
            observers: vec!["ws1".to_string()],
            custom_logic: None,
        };

        registry.register_hook(config).await;
        let subs = registry.get_subscriptions().await;
        assert!(subs.contains_key("test_key"));
    }

    #[tokio::test]
    async fn test_registry_emits_signal() {
        let registry = HookRegistry::new();
        let observer = Arc::new(WebSocketObserver::new("/ws".to_string(), None));
        registry.register_observer("ws1".to_string(), observer).await;

        let config = HookConfig {
            id: "hook1".to_string(),
            target_key: "game_state".to_string(),
            observers: vec!["ws1".to_string()],
            custom_logic: None,
        };
        registry.register_hook(config).await;

        let signal = MemorySignal {
            key: "game_state".to_string(),
            old_value: None,
            new_value: serde_json::json!({"round": 1}),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        let result = registry.emit(signal).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_registry_multiple_observers_same_key() {
        let registry = HookRegistry::new();

        let ws_observer = Arc::new(WebSocketObserver::new("/ws".to_string(), None));
        let webhook_observer = Arc::new(WebhookObserver::new(
            "http://example.com".to_string(),
            "POST".to_string(),
        ));

        registry.register_observer("ws1".to_string(), ws_observer).await;
        registry
            .register_observer("webhook1".to_string(), webhook_observer)
            .await;

        let config = HookConfig {
            id: "hook1".to_string(),
            target_key: "score".to_string(),
            observers: vec!["ws1".to_string(), "webhook1".to_string()],
            custom_logic: None,
        };
        registry.register_hook(config).await;

        let signal = MemorySignal {
            key: "score".to_string(),
            old_value: Some(serde_json::json!(100)),
            new_value: serde_json::json!(150),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        let result = registry.emit(signal).await;
        assert!(result.is_ok());

        let subs = registry.get_subscriptions().await;
        assert_eq!(subs.get("score").map(|v| v.len()), Some(2));
    }

    #[tokio::test]
    async fn test_registry_ignores_unknown_key() {
        let registry = HookRegistry::new();

        let signal = MemorySignal {
            key: "unknown_key".to_string(),
            old_value: None,
            new_value: serde_json::json!({}),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        let result = registry.emit(signal).await;
        assert!(result.is_ok()); // Should succeed but do nothing
    }

    // ==================== Hook Parser Tests ====================

    #[test]
    fn test_parser_extracts_single_hook() {
        let section = create_hook_section("game_sync", "game_state", "websocket");
        let doc = create_document_with_hooks(vec![section]);

        let hooks = parse_hooks_from_document(&doc);
        assert_eq!(hooks.len(), 1);
        assert_eq!(hooks[0].id, "game_sync");
        assert_eq!(hooks[0].target_key, "game_state");
    }

    #[test]
    fn test_parser_extracts_multiple_hooks() {
        let section1 = create_hook_section("hook1", "key1", "websocket");
        let section2 = create_hook_section("hook2", "key2", "poll");
        let doc = create_document_with_hooks(vec![section1, section2]);

        let hooks = parse_hooks_from_document(&doc);
        assert_eq!(hooks.len(), 2);
    }

    #[test]
    fn test_parser_extracts_observer_type() {
        let section = create_hook_section("test", "key", "poll");
        let doc = create_document_with_hooks(vec![section]);

        let hooks = parse_hooks_from_document(&doc);
        assert_eq!(hooks[0].observer_type, ReactivityProvider::Poll);
    }

    #[test]
    fn test_parser_ignores_non_hook_sections() {
        let mut sections = Vec::new();

        // Add a hook
        sections.push(create_hook_section("hook1", "key", "websocket"));

        // Add a non-hook section
        let mut kv = HashMap::new();
        kv.insert("name".to_string(), Value::String("app".to_string()));
        sections.push(Section {
            path: vec!["App".to_string()],
            kv,
            series: HashMap::new(),
            records: Vec::new(),
        });

        let doc = RuneDocument { sections };
        let hooks = parse_hooks_from_document(&doc);

        // Should only find the hook, not the App section
        assert_eq!(hooks.len(), 1);
        assert_eq!(hooks[0].id, "hook1");
    }

    // ==================== HookContextManager Tests ====================

    #[tokio::test]
    async fn test_context_manager_initializes() {
        let mut manager = HookContextManager::new();
        assert!(!manager.is_initialized());

        let section = create_hook_section("test", "key", "websocket");
        let doc = create_document_with_hooks(vec![section]);

        let result = manager.initialize_from_document(&doc).await;
        assert!(result.is_ok());
        assert!(manager.is_initialized());
    }

    #[tokio::test]
    async fn test_context_manager_handles_empty_document() {
        let mut manager = HookContextManager::new();
        let doc = RuneDocument { sections: Vec::new() };

        let result = manager.initialize_from_document(&doc).await;
        assert!(result.is_ok());
        assert!(manager.is_initialized());
    }

    #[tokio::test]
    async fn test_context_manager_dispatches_signal() {
        let mut manager = HookContextManager::new();
        let section = create_hook_section("test", "key", "websocket");
        let doc = create_document_with_hooks(vec![section]);

        manager.initialize_from_document(&doc).await.ok();

        let signal = MemorySignal {
            key: "key".to_string(),
            old_value: None,
            new_value: serde_json::json!({}),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        let result = manager.dispatch_signal(signal).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_context_manager_signal_includes_old_value() {
        let mut manager = HookContextManager::new();

        let section = create_hook_section("test", "score", "websocket");
        let doc = create_document_with_hooks(vec![section]);

        manager.initialize_from_document(&doc).await.ok();

        let signal = MemorySignal {
            key: "score".to_string(),
            old_value: Some(serde_json::json!(100)),
            new_value: serde_json::json!(150),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        let result = manager.dispatch_signal(signal).await;
        assert!(result.is_ok());
    }

    // ==================== Observer Type Tests ====================

    #[test]
    fn test_reactivity_provider_from_str() {
        assert_eq!(
            ReactivityProvider::from_str("websocket"),
            ReactivityProvider::WebSocket
        );
        assert_eq!(ReactivityProvider::from_str("poll"), ReactivityProvider::Poll);
        assert_eq!(ReactivityProvider::from_str("sse"), ReactivityProvider::SSE);
        assert_eq!(ReactivityProvider::from_str("none"), ReactivityProvider::None);
        assert_eq!(ReactivityProvider::from_str("invalid"), ReactivityProvider::None);
    }

    // ==================== Signal Tests ====================

    #[test]
    fn test_memory_signal_creation() {
        let signal = MemorySignal {
            key: "test".to_string(),
            old_value: Some(serde_json::json!(1)),
            new_value: serde_json::json!(2),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        assert_eq!(signal.key, "test");
        assert!(signal.old_value.is_some());
        assert!(signal.new_value.is_number());
    }

    #[test]
    fn test_memory_signal_with_null_old_value() {
        let signal = MemorySignal {
            key: "new_key".to_string(),
            old_value: None,
            new_value: serde_json::json!({"created": true}),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        assert_eq!(signal.key, "new_key");
        assert!(signal.old_value.is_none());
    }

    // ==================== Edge Cases ====================

    #[tokio::test]
    async fn test_registry_handles_no_observers_for_key() {
        let registry = HookRegistry::new();

        let signal = MemorySignal {
            key: "orphan_key".to_string(),
            old_value: None,
            new_value: serde_json::json!({}),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        let result = registry.emit(signal).await;
        assert!(result.is_ok()); // Should be OK, just no observers
    }

    #[tokio::test]
    async fn test_parser_with_multiple_same_targets() {
        let section1 = create_hook_section("hook1", "game_state", "websocket");
        let section2 = create_hook_section("hook2", "game_state", "poll");
        let doc = create_document_with_hooks(vec![section1, section2]);

        let hooks = parse_hooks_from_document(&doc);
        assert_eq!(hooks.len(), 2);

        // Both should target same key but with different observers
        let targets: Vec<_> = hooks.iter().map(|h| h.target_key.clone()).collect();
        assert_eq!(targets, vec!["game_state", "game_state"]);
    }

    #[test]
    fn test_hook_config_storage() {
        let config = HookConfig {
            id: "test_hook".to_string(),
            target_key: "test_key".to_string(),
            observers: vec!["obs1".to_string(), "obs2".to_string()],
            custom_logic: Some("log 'test'".to_string()),
        };

        assert_eq!(config.id, "test_hook");
        assert_eq!(config.observers.len(), 2);
        assert!(config.custom_logic.is_some());
    }
}

#[cfg(test)]
mod cli_commands_tests {
    use rune_runtime::cli::cmd_hooks;

    #[tokio::test]
    async fn test_cmd_hooks_missing_subcommand() {
        let result = cmd_hooks(&vec![]).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_cmd_hooks_invalid_subcommand() {
        let result = cmd_hooks(&vec!["--invalid".to_string()]).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_cmd_hooks_list_missing_file() {
        let result = cmd_hooks(&vec!["--list".to_string()]).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_cmd_hooks_validate_missing_file() {
        let result = cmd_hooks(&vec!["--validate".to_string()]).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_cmd_hooks_debug_missing_file() {
        let result = cmd_hooks(&vec!["--debug".to_string()]).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_cmd_hooks_debug_missing_hook_id() {
        let result = cmd_hooks(&vec!["--debug".to_string(), "file.rune".to_string()]).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_cmd_hooks_info_missing_file() {
        let result = cmd_hooks(&vec!["--info".to_string()]).await;
        assert!(result.is_err());
    }
}



