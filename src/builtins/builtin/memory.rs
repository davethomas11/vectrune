use crate::builtins::{BuiltinResult, LAST_EXEC_RESULT};
use crate::memory::{MemoryBackendRef, init_memory_backend};
use serde_json::Value;
use tokio::sync::OnceCell;
use crate::util::{log, LogLevel};

static MEMORY_BACKEND: OnceCell<MemoryBackendRef> = OnceCell::const_new();

async fn get_backend() -> &'static MemoryBackendRef {
    MEMORY_BACKEND.get_or_init(|| async {
        init_memory_backend().await
    }).await
}

pub async fn builtin_clear_memory(_args: &[String], _ctx: &mut crate::builtins::Context) -> BuiltinResult {
    let backend = get_backend().await;
    backend.clear().await;
    BuiltinResult::Ok
}

pub async fn builtin_del_memory(_args: &[String], _ctx: &mut crate::builtins::Context) -> BuiltinResult {
    if _args.is_empty() {
        log(LogLevel::Error, "del-memory: missing key argument");
        return BuiltinResult::Error("missing key argument".to_string());
    }
    let backend = get_backend().await;
    backend.delete(&_args[0]).await;
    BuiltinResult::Ok
}

pub async fn builtin_set_memory(args: &[String], ctx: &mut crate::builtins::Context) -> BuiltinResult {
    if args.is_empty() {
        log(LogLevel::Error, "set-memory: missing key argument");
        return BuiltinResult::Error("missing key argument".to_string());
    }
    let key = &args[0];
    let value_str = if args.len() >= 2 { &args[1] } else { &args[0] };
    let value = match ctx.get(value_str) {
        Some(v) => v,
        None => &Value::String(value_str.into()),
    };
    let backend = get_backend().await;
    backend.set(key, value.clone()).await;
    ctx.insert(LAST_EXEC_RESULT.to_string(), value.clone());
    BuiltinResult::Ok
}

pub async fn builtin_get_memory(
    args: &[String],
    assign_to: Option<&str>,
    ctx: &mut crate::builtins::Context,
) -> BuiltinResult {
    if args.is_empty() {
        log(LogLevel::Error, "get-memory: missing key argument");
        return BuiltinResult::Error("missing key argument".to_string());
    }
    let key = &args[0];
    let backend = get_backend().await;
    match backend.get(key).await {
        Some(value) => {
            if let Some(var_name) = assign_to {
                ctx.insert(var_name.to_string(), value.clone());
            }
            ctx.insert(LAST_EXEC_RESULT.to_string(), value.clone());
            BuiltinResult::Ok
        }
        None => {
            log(LogLevel::Warn, "get-memory: key not found");
            BuiltinResult::Ok
        }
    }
}

pub async fn set_memory(key: &str, value: Value) {
    let backend = get_backend().await;
    backend.set(key, value).await;
}
