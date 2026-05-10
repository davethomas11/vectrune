/// Reactive memory backend wrapper that broadcasts updates via WebSocket.
use crate::memory::MemoryBackend;
use async_trait::async_trait;
use serde_json::{json, Value as JsonValue};
use std::sync::Arc;

/// Configuration for reactive memory behavior
#[derive(Clone, Debug)]
#[allow(dead_code)]
pub struct ReactiveMemoryConfig {
    pub ws_path: String,
    pub broadcast_mode: BroadcastMode,
}

#[derive(Clone, Debug)]
#[allow(dead_code)]
pub enum BroadcastMode {
    All,
    Prefixes(Vec<String>),
    OptIn(Vec<String>),
}

impl Default for ReactiveMemoryConfig {
    fn default() -> Self {
        Self {
            ws_path: "/ws".to_string(),
            broadcast_mode: BroadcastMode::All,
        }
    }
}

#[allow(dead_code)]
pub struct ReactiveMemoryBackend {
    inner: Arc<dyn MemoryBackend + Send + Sync>,
    config: ReactiveMemoryConfig,
}

#[allow(dead_code)]
impl ReactiveMemoryBackend {
    pub fn new(inner: Arc<dyn MemoryBackend + Send + Sync>, config: ReactiveMemoryConfig) -> Self {
        Self { inner, config }
    }
    fn should_broadcast(&self, key: &str) -> bool {
        match &self.config.broadcast_mode {
            BroadcastMode::All => true,
            BroadcastMode::Prefixes(prefixes) => prefixes.iter().any(|p| key.starts_with(p)),
            BroadcastMode::OptIn(keys) => keys.iter().any(|k| k == key),
        }
    }
    fn broadcast_update(&self, key: &str, value: &JsonValue) {
        if !self.should_broadcast(key) {
            return;
        }
        let msg = json!({"type": "memory_update", "key": key, "value": value, "timestamp": chrono::Utc::now().to_rfc3339()});
        crate::apps::rest::ws::broadcast(&self.config.ws_path, msg.to_string());
    }
}
#[async_trait]
impl MemoryBackend for ReactiveMemoryBackend {
    async fn get(&self, key: &str) -> Option<JsonValue> {
        self.inner.get(key).await
    }
    async fn set(&self, key: &str, value: JsonValue) {
        self.inner.set(key, value.clone()).await;
        self.broadcast_update(key, &value);
    }
    async fn delete(&self, key: &str) {
        self.inner.delete(key).await;
        self.broadcast_update(key, &JsonValue::Null);
    }
    async fn clear(&self) {
        self.inner.clear().await;
    }
}
pub fn make_reactive(backend: Arc<dyn MemoryBackend + Send + Sync>) -> Arc<ReactiveMemoryBackend> {
    Arc::new(ReactiveMemoryBackend::new(backend, ReactiveMemoryConfig::default()))
}
pub fn make_reactive_with_config(backend: Arc<dyn MemoryBackend + Send + Sync>, config: ReactiveMemoryConfig) -> Arc<ReactiveMemoryBackend> {
    Arc::new(ReactiveMemoryBackend::new(backend, config))
}
