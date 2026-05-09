#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use crate::rune_parser::load_rune_document_from_str_with_base;
#[cfg(target_arch = "wasm32")]
use crate::core::AppState;
#[cfg(target_arch = "wasm32")]
use std::collections::HashMap;
#[cfg(target_arch = "wasm32")]
use std::path::PathBuf;
#[cfg(target_arch = "wasm32")]
use std::sync::Arc;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn run_rune_wasm(source: &str, input_data: &str) -> Result<String, JsValue> {
    let base_dir = PathBuf::from(".");
    let doc = load_rune_document_from_str_with_base(source, &base_dir, "sandbox.rune")
        .map_err(|e| JsValue::from_str(&format!("Parse error: {}", e)))?;

    let app_state = AppState {
        doc: Arc::new(doc.clone()),
        schemas: Arc::new(HashMap::new()),
        data_sources: Arc::new(HashMap::new()),
        path: PathBuf::from("."),
    };

    let mut ctx = HashMap::new();
    // Pre-populate context with input if it's JSON
    if !input_data.is_empty() {
        if let Ok(json_input) = serde_json::from_str::<serde_json::Value>(input_data) {
            ctx.insert("input".to_string(), json_input);
        }
    }

    let mut output_str = String::new();

    if let Some(app_section) = doc.get_section("App") {
        if let Some(steps) = app_section.series.get("run") {
            match crate::core::execute_steps_inner(app_state, steps, &mut ctx).await {
                Some((_code, msg)) => {
                    output_str.push_str(&msg);
                }
                None => {
                    output_str.push_str("Execution finished (no response).");
                }
            }
        } else {
            output_str.push_str("No 'run:' block found in @App section.");
        }
    } else {
        output_str.push_str("No @App section found.");
    }

    Ok(output_str)
}
