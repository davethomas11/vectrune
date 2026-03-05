use crate::builtins::BuiltinResult;
use crate::memory::{MemoryBackendRef, init_memory_backend};
use serde_json::Value;
use tokio::sync::OnceCell;

static MEMORY_BACKEND: OnceCell<MemoryBackendRef> = OnceCell::const_new();

async fn get_backend() -> &'static MemoryBackendRef {
    MEMORY_BACKEND.get_or_init(|| async {
        init_memory_backend().await
    }).await
}

pub async fn builtin_set_memory(args: &[String], ctx: &mut crate::builtins::Context) -> BuiltinResult {
    let key = &args[0];
    let value_str = if args.len() >= 2 { &args[1] } else { &args[0] };
    let value = match ctx.get(value_str) {
        Some(v) => v,
        None => &Value::String(value_str.into()),
    };
    let backend = get_backend().await;
    backend.set(key, value.clone()).await;
    BuiltinResult::Ok
}

pub async fn builtin_get_memory(
    args: &[String],
    assign_to: Option<&str>,
    ctx: &mut crate::builtins::Context,
) -> BuiltinResult {
    if args.is_empty() {
        eprintln!("[ERROR] get-memory: missing key argument");
        return BuiltinResult::Error("missing key argument".to_string());
    }
    let key = &args[0];
    let backend = get_backend().await;
    match backend.get(key).await {
        Some(value) => {
            if let Some(var_name) = assign_to {
                ctx.insert(var_name.to_string(), value);
            }
            BuiltinResult::Ok
        }
        None => {
            eprintln!("[WARN] get-memory: key '{}' not found", key);
            BuiltinResult::Ok
        }
    }
}

pub async fn set_memory(key: &str, value: Value) {
    let backend = get_backend().await;
    backend.set(key, value).await;
}

pub async fn get_memory(key: &str) -> Option<Value> {
    let backend = get_backend().await;
    backend.get(key).await
}
