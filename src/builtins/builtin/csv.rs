use crate::builtins::path_utils::{candidate_paths, resolve_write_path};
use crate::builtins::{BuiltinResult, Context};
use crate::core::AppState;
use csv::{ReaderBuilder, WriterBuilder};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::fs::OpenOptions;

pub fn builtin_csv_read(
    args: &[String],
    context: &mut Context,
    assign_to: Option<&str>,
    app_state: &AppState,
) -> BuiltinResult {
    if args.is_empty() {
        eprintln!("[ERROR] csv.read: missing filename");
        return BuiltinResult::Error("missing filename".to_string());
    }
    let filename = &args[0];
    let mut errors = Vec::new();
    let mut reader_opt = None;

    for path in candidate_paths(filename, &app_state.path) {
        match ReaderBuilder::new().from_path(&path) {
            Ok(reader) => {
                reader_opt = Some(reader);
                break;
            }
            Err(e) => errors.push(format!("{} ({})", path.display(), e)),
        }
    }

    let mut rdr = match reader_opt {
        Some(r) => r,
        None => {
            eprintln!(
                "[WARN] csv.read: unable to open {} via any candidate -> {}",
                filename,
                errors.join(", ")
            );
            if let Some(var_name) = assign_to {
                context.insert(var_name.to_string(), JsonValue::Array(Vec::new()));
            }
            return BuiltinResult::Ok;
        }
    };

    let mut records = Vec::new();
    for result in rdr.deserialize::<HashMap<String, String>>() {
        match result {
            Ok(rec) => records.push(JsonValue::Object(
                rec.into_iter()
                    .map(|(k, v)| (k, JsonValue::String(v)))
                    .collect(),
            )),
            Err(e) => eprintln!("[ERROR] csv.read: {}", e),
        }
    }
    if let Some(var_name) = assign_to {
        context.insert(var_name.to_string(), JsonValue::Array(records));
    }
    BuiltinResult::Ok
}

pub fn builtin_csv_write(args: &[String], ctx: &Context, app_state: &AppState) -> BuiltinResult {
    if args.len() < 2 {
        eprintln!("[ERROR] csv.write: missing arguments");
        return BuiltinResult::Ok;
    }
    let filename = &args[0];
    let var = &args[1];
    let arr = match ctx.get(var) {
        Some(JsonValue::Array(arr)) => arr,
        _ => {
            eprintln!("[ERROR] csv.write: variable not found or not array");
            return BuiltinResult::Error("variable not found or not array".to_string());
        }
    };

    let target_path = resolve_write_path(filename, &app_state.path);
    let mut wtr = match WriterBuilder::new().from_path(&target_path) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("[ERROR] csv.write ({}): {}", target_path.display(), e);
            return BuiltinResult::Error(e.to_string());
        }
    };

    let mut index = 0;
    for item in arr {
        if let Some(obj) = item.as_object() {
            if index == 0 {
                let headers: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
                if let Err(e) = wtr.write_record(&headers) {
                    eprintln!("[ERROR] csv.write: {}", e);
                    return BuiltinResult::Error(e.to_string());
                }
            }
            let headers: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
            let values: Vec<&str> = headers
                .iter()
                .map(|&k| obj[k].as_str().unwrap_or(""))
                .collect();
            if let Err(e) = wtr.write_record(&values) {
                eprintln!("[ERROR] csv.write: {}", e);
                return BuiltinResult::Error(e.to_string());
            }
        }
        index += 1;
    }
    if let Err(e) = wtr.flush() {
        eprintln!("[ERROR] csv.write: {}", e);
        return BuiltinResult::Error(e.to_string());
    }
    BuiltinResult::Ok
}

pub fn builtin_csv_append(args: &[String], ctx: &Context, app_state: &AppState) -> BuiltinResult {
    if args.len() < 2 {
        eprintln!("[ERROR] csv.append: missing arguments");
        return BuiltinResult::Error("missing arguments".to_string());
    }
    let filename = &args[0];
    let var = &args[1];
    let obj = match ctx.get(var) {
        Some(JsonValue::Object(obj)) => obj,
        _ => {
            eprintln!("[ERROR] csv.append: variable not found or not object");
            return BuiltinResult::Error("variable not found or not object".to_string());
        }
    };

    let target_path = resolve_write_path(filename, &app_state.path);
    let file_exists = target_path.exists();
    let file = match OpenOptions::new()
        .append(true)
        .create(true)
        .open(&target_path)
    {
        Ok(f) => f,
        Err(e) => {
            eprintln!("[ERROR] csv.append ({}): {}", target_path.display(), e);
            return BuiltinResult::Error(e.to_string());
        }
    };
    let mut wtr = WriterBuilder::new().has_headers(false).from_writer(file);

    if !file_exists {
        let headers: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
        if let Err(e) = wtr.write_record(&headers) {
            eprintln!("[ERROR] csv.append: {}", e);
            return BuiltinResult::Error(e.to_string());
        }
    }

    let values: Vec<String> = obj
        .values()
        .map(|v| {
            if let Some(s) = v.as_str() {
                s.to_string()
            } else if let Some(n) = v.as_f64() {
                n.to_string()
            } else if let Some(b) = v.as_bool() {
                b.to_string()
            } else {
                "null".to_string()
            }
        })
        .collect();
    if let Err(e) = wtr.write_record(&values) {
        eprintln!("[ERROR] csv.append: {}", e);
        return BuiltinResult::Error(e.to_string());
    }
    if let Err(e) = wtr.flush() {
        eprintln!("[ERROR] csv.append: {}", e);
        return BuiltinResult::Error(e.to_string());
    }
    BuiltinResult::Ok
}
