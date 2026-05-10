/// Hook Context Integration
///
/// This module provides utilities for integrating the HookRegistry into the
/// request execution context, enabling automatic hook dispatch on memory changes.

use crate::memory::{HookRegistry, MemorySignal, parse_hooks_from_document, register_hooks};
use crate::rune_ast::RuneDocument;
use crate::util::{log, LogLevel};
use std::sync::Arc;

/// Manages hook lifecycle and execution during request processing
#[allow(dead_code)]
pub struct HookContextManager {
    registry: Arc<HookRegistry>,
    initialized: bool,
}

#[allow(dead_code)]
impl HookContextManager {
    /// Create a new hook context manager
    pub fn new() -> Self {
        Self {
            registry: Arc::new(HookRegistry::new()),
            initialized: false,
        }
    }

    /// Initialize hooks from a Rune document
    pub async fn initialize_from_document(&mut self, doc: &RuneDocument) -> Result<(), Vec<String>> {
        log(LogLevel::Debug, "Initializing hooks from document");

        // Parse all @Hook declarations
        let parsed_hooks = parse_hooks_from_document(doc);

        if parsed_hooks.is_empty() {
            log(LogLevel::Debug, "No hooks defined in document");
            self.initialized = true;
            return Ok(());
        }

        log(
            LogLevel::Info,
            &format!("Found {} hook declarations", parsed_hooks.len()),
        );

        // Register hooks into the registry
        match register_hooks(&self.registry, parsed_hooks).await {
            Ok(()) => {
                self.initialized = true;
                log(LogLevel::Info, "Hooks initialized successfully");
                Ok(())
            }
            Err(e) => {
                log(
                    LogLevel::Error,
                    &format!("Failed to initialize hooks: {:?}", e),
                );
                Err(e)
            }
        }
    }

    /// Get reference to the hook registry
    pub fn registry(&self) -> Arc<HookRegistry> {
        self.registry.clone()
    }

    /// Check if hooks are initialized
    pub fn is_initialized(&self) -> bool {
        self.initialized
    }

    /// Dispatch a memory change signal to registered hooks
    pub async fn dispatch_signal(&self, signal: MemorySignal) -> Result<(), Vec<String>> {
        if !self.initialized {
            return Ok(()); // No hooks to dispatch
        }

        log(
            LogLevel::Debug,
            &format!("Dispatching signal for key: {}", signal.key),
        );

        self.registry.emit(signal).await
    }
}

impl Default for HookContextManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rune_ast::{Record, Section, Value};
    use std::collections::HashMap;

    fn create_test_document_with_hook() -> RuneDocument {
        let mut kv = HashMap::new();
        kv.insert("target".to_string(), Value::String("test_key".to_string()));
        kv.insert("observer".to_string(), Value::String("websocket".to_string()));

        let section = Section {
            path: vec!["Hook".to_string(), "test_hook".to_string()],
            kv,
            series: HashMap::new(),
            records: Vec::new(),
        };

        RuneDocument {
            sections: vec![section],
        }
    }

    #[tokio::test]
    async fn context_manager_initializes() {
        let mut manager = HookContextManager::new();
        let doc = create_test_document_with_hook();

        let result = manager.initialize_from_document(&doc).await;
        assert!(result.is_ok());
        assert!(manager.is_initialized());
    }

    #[tokio::test]
    async fn context_manager_handles_no_hooks() {
        let mut manager = HookContextManager::new();
        let doc = RuneDocument { sections: Vec::new() };

        let result = manager.initialize_from_document(&doc).await;
        assert!(result.is_ok());
        assert!(manager.is_initialized());
    }

    #[tokio::test]
    async fn context_manager_dispatches_signal() {
        let mut manager = HookContextManager::new();
        let doc = create_test_document_with_hook();

        manager.initialize_from_document(&doc).await.ok();

        let signal = MemorySignal {
            key: "test_key".to_string(),
            old_value: None,
            new_value: serde_json::json!({"value": 42}),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        let result = manager.dispatch_signal(signal).await;
        assert!(result.is_ok());
    }
}


