/// Memory Hook System — Signal/Observer Pattern for Reactive Bindings
///
/// This module implements a pluggable reactivity system that decouples memory changes
/// from transport mechanisms. Instead of hard-coding WebSocket broadcasts inside set-memory,
/// we use declarative @Hook definitions that bind memory changes to configurable actions.
///
/// Architecture:
/// - MemoryObserver trait: Different reaction strategies (WebSocket, HTTP, Poll, Local)
/// - HookRegistry: Maintains subscriptions of memory keys to observer actions
/// - MemorySignal: Internal event emitted when memory changes
/// - HookContext: Runtime context passed to hook handlers

use serde_json::{json, Value as JsonValue};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Represents a change to a memory value
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct MemorySignal {
    pub key: String,
    pub old_value: Option<JsonValue>,
    pub new_value: JsonValue,
    pub timestamp: String,
}

/// Trait for different observers/reactions to memory changes
#[async_trait::async_trait]
#[allow(dead_code)]
pub trait MemoryObserver: Send + Sync {
    /// Called when a memory key changes
    /// Returns Ok(()) if the action succeeded, Err(msg) otherwise
    async fn on_change(&self, signal: &MemorySignal) -> Result<(), String>;

    /// Pretty name for logging/debugging
    fn name(&self) -> &str;
}

/// WebSocket broadcast observer — updates all connected clients
#[allow(dead_code)]
pub struct WebSocketObserver {
    ws_path: String,
    channel: Option<String>,
}

#[allow(dead_code)]
impl WebSocketObserver {
    pub fn new(ws_path: String, channel: Option<String>) -> Self {
        Self { ws_path, channel }
    }
}

#[async_trait::async_trait]
impl MemoryObserver for WebSocketObserver {
    async fn on_change(&self, signal: &MemorySignal) -> Result<(), String> {
        let msg = json!({
            "type": "memory_update",
            "key": signal.key,
            "old_value": signal.old_value,
            "value": signal.new_value,
            "channel": self.channel,
            "timestamp": signal.timestamp,
        });

        // Use the existing ws::broadcast function
        crate::apps::rest::ws::broadcast(&self.ws_path, msg.to_string());
        Ok(())
    }

    fn name(&self) -> &str {
        "websocket"
    }
}

/// HTTP webhook observer — sends updates to an external endpoint
#[allow(dead_code)]
pub struct WebhookObserver {
    url: String,
    #[allow(dead_code)]
    method: String, // GET, POST, PUT
}

#[allow(dead_code)]
impl WebhookObserver {
    pub fn new(url: String, method: String) -> Self {
        Self { url, method }
    }
}

#[async_trait::async_trait]
impl MemoryObserver for WebhookObserver {
    async fn on_change(&self, signal: &MemorySignal) -> Result<(), String> {
        let payload = json!({
            "key": signal.key,
            "old_value": signal.old_value,
            "value": signal.new_value,
            "timestamp": signal.timestamp,
        });

        // Would integrate with reqwest here for actual HTTP calls
        // For now, just log the intent
        crate::util::log(
            crate::util::LogLevel::Info,
            &format!("Webhook observer would call {} with payload: {}", self.url, payload),
        );

        Ok(())
    }

    fn name(&self) -> &str {
        "webhook"
    }
}

/// Server-Sent Events observer — for polling/streaming clients
#[allow(dead_code)]
pub struct SSEObserver {
    topic: String,
}

#[allow(dead_code)]
impl SSEObserver {
    pub fn new(topic: String) -> Self {
        Self { topic }
    }
}

#[async_trait::async_trait]
impl MemoryObserver for SSEObserver {
    async fn on_change(&self, signal: &MemorySignal) -> Result<(), String> {
        // In a real implementation, this would queue events for SSE clients
        // For now, just demonstrate the interface
        crate::util::log(
            crate::util::LogLevel::Info,
            &format!("SSE would publish to topic '{}': {}", self.topic, signal.key),
        );

        Ok(())
    }

    fn name(&self) -> &str {
        "sse"
    }
}

/// Local observer — updates browser-side WASM state directly (no network)
#[allow(dead_code)]
pub struct LocalObserver {
    component_id: String,
}

#[allow(dead_code)]
impl LocalObserver {
    pub fn new(component_id: String) -> Self {
        Self { component_id }
    }
}

#[async_trait::async_trait]
impl MemoryObserver for LocalObserver {
    async fn on_change(&self, signal: &MemorySignal) -> Result<(), String> {
        // In a WASM environment, this would update browser memory directly
        crate::util::log(
            crate::util::LogLevel::Debug,
            &format!(
                "Local observer: component '{}' would update with key '{}'",
                self.component_id, signal.key
            ),
        );

        Ok(())
    }

    fn name(&self) -> &str {
        "local"
    }
}

/// Configuration for a memory hook binding
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct HookConfig {
    pub id: String,
    pub target_key: String,
    pub observers: Vec<String>, // Observer IDs to trigger
    pub custom_logic: Option<String>, // Custom Rune logic to execute
}

/// Registry that manages memory change observers
#[allow(dead_code)]
pub struct HookRegistry {
    // key → Vec<observer_id>
    subscriptions: Arc<RwLock<HashMap<String, Vec<String>>>>,
    // observer_id → Arc<dyn MemoryObserver>
    observers: Arc<RwLock<HashMap<String, Arc<dyn MemoryObserver>>>>,
    // hook_id → HookConfig
    hooks: Arc<RwLock<HashMap<String, HookConfig>>>,
}

#[allow(dead_code)]
impl HookRegistry {
    pub fn new() -> Self {
        Self {
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
            observers: Arc::new(RwLock::new(HashMap::new())),
            hooks: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a new observer (e.g., WebSocket, HTTP webhook, SSE)
    pub async fn register_observer(&self, id: String, observer: Arc<dyn MemoryObserver>) {
        let mut observers = self.observers.write().await;
        observers.insert(id, observer);
    }

    /// Register a hook that binds a memory key to observers
    pub async fn register_hook(&self, config: HookConfig) {
        let mut subscriptions = self.subscriptions.write().await;
        let mut hooks = self.hooks.write().await;

        subscriptions
            .entry(config.target_key.clone())
            .or_insert_with(Vec::new)
            .extend(config.observers.clone());

        let hook_id = config.id.clone();
        hooks.insert(hook_id, config);
    }

    /// Emit a memory change signal, triggering all registered observers
    pub async fn emit(&self, signal: MemorySignal) -> Result<(), Vec<String>> {
        let subscriptions = self.subscriptions.read().await;
        let observers = self.observers.read().await;

        if let Some(observer_ids) = subscriptions.get(&signal.key) {
            let mut errors = Vec::new();

            for observer_id in observer_ids {
                if let Some(observer) = observers.get(observer_id) {
                    match observer.on_change(&signal).await {
                        Ok(()) => {
                            crate::util::log(
                                crate::util::LogLevel::Debug,
                                &format!(
                                    "Observer '{}' handled change to key '{}'",
                                    observer.name(),
                                    signal.key
                                ),
                            );
                        }
                        Err(e) => {
                            errors.push(format!(
                                "Observer '{}' failed for key '{}': {}",
                                observer.name(),
                                signal.key,
                                e
                            ));
                        }
                    }
                }
            }

            if errors.is_empty() {
                Ok(())
            } else {
                Err(errors)
            }
        } else {
            Ok(()) // No observers for this key
        }
    }

    /// Get all subscriptions for debugging
    pub async fn get_subscriptions(&self) -> HashMap<String, Vec<String>> {
        self.subscriptions.read().await.clone()
    }

    /// Get hook configuration by ID
    pub async fn get_hook(&self, id: &str) -> Option<HookConfig> {
        self.hooks.read().await.get(id).cloned()
    }
}

/// Reactivity provider type
#[derive(Clone, Debug, PartialEq, Eq)]
#[allow(dead_code)]
pub enum ReactivityProvider {
    WebSocket,
    Poll,
    SSE,
    None,
}

#[allow(dead_code)]
impl ReactivityProvider {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "websocket" => ReactivityProvider::WebSocket,
            "poll" => ReactivityProvider::Poll,
            "sse" => ReactivityProvider::SSE,
            "none" => ReactivityProvider::None,
            _ => ReactivityProvider::None,
        }
    }
}

/// Configuration for the entire reactivity system
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct ReactivityConfig {
    pub provider: ReactivityProvider,
    pub endpoint: String,
    pub default_channel: Option<String>,
    pub enable_local_sync: bool,
}

impl Default for ReactivityConfig {
    fn default() -> Self {
        Self {
            provider: ReactivityProvider::WebSocket,
            endpoint: "/ws".to_string(),
            default_channel: None,
            enable_local_sync: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn hook_registry_registers_and_emits() {
        let registry = HookRegistry::new();

        // Register a WebSocket observer
        let ws_observer =
            Arc::new(WebSocketObserver::new("/ws".to_string(), Some("game".to_string())));
        registry.register_observer("ws1".to_string(), ws_observer).await;

        // Register a hook that binds game_state to the observer
        let hook = HookConfig {
            id: "hook1".to_string(),
            target_key: "game_state".to_string(),
            observers: vec!["ws1".to_string()],
            custom_logic: None,
        };
        registry.register_hook(hook).await;

        // Emit a signal
        let signal = MemorySignal {
            key: "game_state".to_string(),
            old_value: Some(json!({"round": 1})),
            new_value: json!({"round": 2}),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        let result = registry.emit(signal).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn multiple_observers_on_same_key() {
        let registry = HookRegistry::new();

        let ws_observer =
            Arc::new(WebSocketObserver::new("/ws".to_string(), Some("game".to_string())));
        let webhook_observer =
            Arc::new(WebhookObserver::new("http://example.com".to_string(), "POST".to_string()));

        registry.register_observer("ws1".to_string(), ws_observer).await;
        registry
            .register_observer("webhook1".to_string(), webhook_observer)
            .await;

        let hook = HookConfig {
            id: "hook1".to_string(),
            target_key: "score".to_string(),
            observers: vec!["ws1".to_string(), "webhook1".to_string()],
            custom_logic: None,
        };
        registry.register_hook(hook).await;

        let signal = MemorySignal {
            key: "score".to_string(),
            old_value: Some(json!(100)),
            new_value: json!(150),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        let result = registry.emit(signal).await;
        assert!(result.is_ok());

        let subs = registry.get_subscriptions().await;
        assert_eq!(subs.get("score").map(|v| v.len()), Some(2));
    }

    #[test]
    fn reactivity_provider_from_string() {
        assert_eq!(
            ReactivityProvider::from_str("websocket"),
            ReactivityProvider::WebSocket
        );
        assert_eq!(ReactivityProvider::from_str("poll"), ReactivityProvider::Poll);
        assert_eq!(ReactivityProvider::from_str("sse"), ReactivityProvider::SSE);
        assert_eq!(ReactivityProvider::from_str("none"), ReactivityProvider::None);
        assert_eq!(ReactivityProvider::from_str("invalid"), ReactivityProvider::None);
    }
}




