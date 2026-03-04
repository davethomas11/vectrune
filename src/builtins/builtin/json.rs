use crate::builtins::path_utils::candidate_paths;
use crate::builtins::{BuiltinResult, Context};
use crate::core::AppState;
use serde_json::Value as JsonValue;
use std::fs;

pub fn builtin_json_read(
    args: &[String],
    ctx: &mut Context,
    assign_to: Option<&str>,
    app_state: &AppState,
) -> BuiltinResult {
    if args.is_empty() {
        eprintln!("[ERROR] json.read: missing filename");
        return BuiltinResult::Error("missing filename".to_string());
    }
    let target = if let Some(var) = assign_to {
        var
    } else {
        eprintln!("[ERROR] json.read: missing assignment target");
        return BuiltinResult::Error("missing assignment target".to_string());
    };

    let filename = &args[0];
    let candidates = candidate_paths(filename, &app_state.path);
    let mut errors = Vec::new();

    for path in candidates {
        match fs::read_to_string(&path) {
            Ok(contents) => match serde_json::from_str::<JsonValue>(&contents) {
                Ok(json) => {
                    ctx.insert(target.to_string(), json);
                    return BuiltinResult::Ok;
                }
                Err(e) => {
                    eprintln!(
                        "[ERROR] json.read: failed to parse {}: {}",
                        path.display(),
                        e
                    );
                    return BuiltinResult::Error(format!("json.read parse error: {}", e));
                }
            },
            Err(e) => {
                errors.push(format!("{} ({})", path.display(), e));
            }
        }
    }

    if errors.is_empty() {
        errors.push(format!("{} (no readable path)", filename));
    }

    eprintln!(
        "[ERROR] json.read: unable to read {} -> {}",
        filename,
        errors.join(", ")
    );
    BuiltinResult::Error(format!("json.read unable to read {}", filename))
}
