use std::collections::HashMap;
use std::sync::Mutex;
use lazy_static::lazy_static;
use serde_json::Value;
use crate::builtins::BuiltinResult;

lazy_static! {
    static ref MEMORY: Mutex<HashMap<String, Value>> = Mutex::new(HashMap::new());
}

pub fn builtin_set_memory(args: &[String], ctx: &mut crate::builtins::Context) -> BuiltinResult {
    let key = &args[0];
    let value_str = if args.len() >= 2 {
        &args[1]
    } else {
        &args[0]
    };
    let value = match ctx.get(value_str) {
        Some(v) => v,
        None => &Value::String(value_str.into()),
    };
    set_memory(key, value.clone());
    BuiltinResult::Ok
}

pub fn builtin_get_memory(args: &[String], assign_to: Option<&str>, ctx: &mut crate::builtins::Context) -> BuiltinResult {
    if args.is_empty() {
        eprintln!("[ERROR] get-memory: missing key argument");
        return BuiltinResult::Error("missing key argument".to_string());
    }
    let key = &args[0];
    match get_memory(key) {
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

pub fn set_memory(key: &str, value: Value) {
    let mut mem = MEMORY.lock().unwrap();
    mem.insert(key.to_string(), value);
}

pub fn get_memory(key: &str) -> Option<Value> {
    let mem = MEMORY.lock().unwrap();
    mem.get(key).cloned()
}