use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;

#[async_trait]
pub trait MemoryBackend: Send + Sync {
    async fn get(&self, key: &str) -> Option<serde_json::Value>;
    async fn set(&self, key: &str, value: serde_json::Value);
    async fn delete(&self, key: &str);
    async fn clear(&self);
}

pub type MemoryBackendRef = Arc<dyn MemoryBackend + Send + Sync>;

pub struct InMemoryBackend {
    store: tokio::sync::RwLock<HashMap<String, serde_json::Value>>,
}

impl InMemoryBackend {
    pub fn new() -> Self {
        Self {
            store: tokio::sync::RwLock::new(HashMap::new()),
        }
    }
}

#[async_trait]
impl MemoryBackend for InMemoryBackend {
    async fn get(&self, key: &str) -> Option<serde_json::Value> {
        let store = self.store.read().await;
        store.get(key).cloned()
    }
    async fn set(&self, key: &str, value: serde_json::Value) {
        let mut store = self.store.write().await;
        store.insert(key.to_string(), value);
    }
    async fn delete(&self, key: &str) {
        let mut store = self.store.write().await;
        store.remove(key);
    }
    async fn clear(&self) {
        let mut store = self.store.write().await;
        store.clear();
    }
}

/// Selects and initializes the memory backend based on env/config.
pub async fn init_memory_backend() -> MemoryBackendRef {
    let backend = std::env::var("VECTRUNE_MEMORY_BACKEND").unwrap_or_else(|_| "memory".to_string());
    match backend.as_str() {
        "memory" => Arc::new(InMemoryBackend::new()),
        // Future: add "dynamodb", "s3", "redis" here
        other => {
            panic!("Unsupported memory backend: {}", other);
        }
    }
}
