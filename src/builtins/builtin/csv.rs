use crate::builtins::path_utils::{candidate_paths, resolve_write_path};
use crate::builtins::{BuiltinResult, Context, LAST_EXEC_RESULT};
use crate::core::AppState;
use csv::{ReaderBuilder, WriterBuilder};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::fs::OpenOptions;
use crate::util::{LogLevel, log};

pub fn builtin_csv_read(
    args: &[String],
    context: &mut Context,
    assign_to: Option<&str>,
    app_state: &AppState,
) -> BuiltinResult {
    if args.is_empty() {
        log(LogLevel::Error, "csv.read: missing filename");
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
            log(LogLevel::Warn, &format!("csv.read: unable to open {} via any candidate -> {}", filename, errors.join(", ")));
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
            Err(e) => log(LogLevel::Warn, &format!("csv.read: {}", e)),
        }
    }
    if let Some(var_name) = assign_to {
        context.insert(var_name.to_string(), JsonValue::Array(records.clone()));
    }
    context.insert(LAST_EXEC_RESULT.to_string(), JsonValue::Array(records.clone()));
    BuiltinResult::Ok
}

pub fn builtin_csv_write(args: &[String], ctx: &mut Context, app_state: &AppState) -> BuiltinResult {
    if args.len() < 2 {
        log(LogLevel::Error, "csv.write: missing filename");
        return BuiltinResult::Ok;
    }
    let filename = &args[0];
    let var = &args[1];
    let arr = match ctx.get(var) {
        Some(JsonValue::Array(arr)) => arr,
        _ => {
            log(LogLevel::Error, "csv.write: variable not found or not array");
            return BuiltinResult::Error("variable not found or not array".to_string());
        }
    };

    let target_path = resolve_write_path(filename, &app_state.path);
    let mut wtr = match WriterBuilder::new().from_path(&target_path) {
        Ok(w) => w,
        Err(e) => {
            log(LogLevel::Error, "csv.write: unable to open write");
            return BuiltinResult::Error(e.to_string());
        }
    };

    let mut index = 0;
    for item in arr {
        if let Some(obj) = item.as_object() {
            if index == 0 {
                let headers: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
                if let Err(e) = wtr.write_record(&headers) {
                    log(LogLevel::Error, "csv.write: error writing headers");
                    return BuiltinResult::Error(e.to_string());
                }
            }
            let headers: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
            let values: Vec<&str> = headers
                .iter()
                .map(|&k| obj[k].as_str().unwrap_or(""))
                .collect();
            if let Err(e) = wtr.write_record(&values) {
                log(LogLevel::Error, "csv.write: error writing record");
                return BuiltinResult::Error(e.to_string());
            }
        }
        index += 1;
    }
    if let Err(e) = wtr.flush() {
        log(LogLevel::Error, "csv.write: unable to flush records");
        return BuiltinResult::Error(e.to_string());
    }
    ctx.insert(LAST_EXEC_RESULT.to_string(), arr.clone().into());
    BuiltinResult::Ok
}

pub fn builtin_csv_append(args: &[String], ctx: &mut Context, app_state: &AppState) -> BuiltinResult {
    if args.len() < 2 {
        log(LogLevel::Error, "csv.append: missing filename");
        return BuiltinResult::Error("missing arguments".to_string());
    }
    let filename = &args[0];
    let var = &args[1];
    let obj = match ctx.get(var) {
        Some(JsonValue::Object(obj)) => obj,
        _ => {
            log(LogLevel::Error, "csv.append: variable not found or not object");
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
            log(LogLevel::Error, "csv.append: unable to open file");
            return BuiltinResult::Error(e.to_string());
        }
    };
    let mut wtr = WriterBuilder::new().has_headers(false).from_writer(file);

    if !file_exists {
        let headers: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
        if let Err(e) = wtr.write_record(&headers) {
            log(LogLevel::Error, "csv.append: error writing headers");
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
        log(LogLevel::Error, "csv.append: error writing record");
        return BuiltinResult::Error(e.to_string());
    }
    if let Err(e) = wtr.flush() {
        log(LogLevel::Error, "csv.append: unable to flush records");
        return BuiltinResult::Error(e.to_string());
    }

    let obj_value = JsonValue::Object(obj.clone());
    ctx.insert(LAST_EXEC_RESULT.to_string(), obj_value.clone());
    BuiltinResult::Ok
}
