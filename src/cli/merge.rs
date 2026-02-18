use crate::rune_ast::{RuneDocument, Value};
use serde_json;
use std::fs;

pub fn handle_merge(input_doc: &RuneDocument, spec: &str) -> Result<RuneDocument, String> {
    // spec format: base_file@selector
    let (base_file, selector) = spec
        .split_once('@')
        .ok_or_else(|| "Merge spec must be in format base_file@selector".to_string())?;

    let base_content = fs::read_to_string(base_file)
        .map_err(|e| format!("Failed to read base file {}: {}", base_file, e))?;

    let mut base_doc = if base_file.ends_with(".yaml") || base_file.ends_with(".yml") {
        RuneDocument::from_yaml(&base_content)?
    } else if base_file.ends_with(".json") {
        let json_val: serde_json::Value = serde_json::from_str(&base_content)
            .map_err(|e| format!("Failed to parse base JSON: {}", e))?;
        RuneDocument::from_json(&json_val)
    } else {
        RuneDocument::from_str(&base_content)?
    };

    apply_merge(&mut base_doc, input_doc, selector)?;

    Ok(base_doc)
}

fn apply_merge(
    base_doc: &mut RuneDocument,
    input_doc: &RuneDocument,
    selector: &str,
) -> Result<(), String> {
    // Selector format: envrionment.(preview|prod).[].(name=allowedIps on value from Ips)
    // This is quite complex. Let's break it down.

    // For now, let's implement a simplified version that handles the specific case in the issue.
    // We'll need to parse the selector parts.

    let parts: Vec<&str> = selector.split('.').collect();

    // We'll use a recursive approach to find and update matching sections/values.
    update_at_path(base_doc, input_doc, &parts, 0, Vec::new())
}

fn update_at_path(
    base_doc: &mut RuneDocument,
    input_doc: &RuneDocument,
    parts: &[&str],
    part_idx: usize,
    current_path: Vec<String>,
) -> Result<(), String> {
    if part_idx >= parts.len() {
        return Ok(());
    }

    let part = parts[part_idx];

    if part.starts_with('(') && part.ends_with(')') {
        let inner = &part[1..part.len() - 1];
        if inner.contains('|') {
            // (preview|prod)
            let options: Vec<&str> = inner.split('|').collect();
            for opt in options {
                let mut next_path = current_path.clone();
                next_path.push(opt.to_string());

                // If next_path exists as a section, recurse.
                // Otherwise, it might be a series in a parent section.
                update_at_path(base_doc, input_doc, parts, part_idx + 1, next_path)?;
            }
        } else if inner.contains(" on ") && inner.contains(" from ") {
            // (name=allowedIps on value from Ips)
            // General form: (KEY_FIELD=TARGET_VALUE on VAL_FIELD from SOURCE_KEY)

            let (target_part, rest) = inner
                .split_once(" on ")
                .ok_or("Invalid merge instruction syntax: missing 'on'")?;
            let (val_field, source_key) = rest
                .split_once(" from ")
                .ok_or("Invalid merge instruction syntax: missing 'from'")?;

            let val_field = val_field.trim();
            let source_key = source_key.trim();

            let (key_field, target_val) = if let Some((k, v)) = target_part.split_once('=') {
                (k.trim(), Some(v.trim()))
            } else {
                (target_part.trim(), None)
            };

            // Perform the actual update here.
            // Find sections in base_doc matching current_path.
            let mut matches_found = false;

            // Find source values from input_doc
            let mut source_values = Vec::new();
            for input_section in &input_doc.sections {
                if let Some(vals) = input_section.series.get(source_key) {
                    source_values.extend(vals.clone());
                }
                if let Some(val) = input_section.kv.get(source_key) {
                    source_values.push(val.clone());
                }
            }

            if !source_values.is_empty() {
                for section in &mut base_doc.sections {
                    if section.path == current_path {
                        matches_found = true;
                        if let Some(t_val) = target_val {
                            // KEY_FIELD=TARGET_VALUE
                            // If we're not in a list-of-objects, we just use the TARGET_VALUE as the key
                            section
                                .series
                                .insert(t_val.to_string(), source_values.clone());
                        } else {
                            section
                                .series
                                .insert(key_field.to_string(), source_values.clone());
                        }
                    }
                }

                // New logic to handle list of key_field/val_field objects if they are in a series
                for section in &mut base_doc.sections {
                    let is_exact_match = section.path == current_path;
                    let is_parent_match = section.path.len() > 0
                        && section.path[..section.path.len() - 1] == current_path;
                    let is_series_match = if current_path.len() > 0 {
                        let parent_path = &current_path[..current_path.len() - 1];
                        let last_part = &current_path[current_path.len() - 1];
                        section.path == parent_path && section.series.contains_key(last_part)
                    } else {
                        false
                    };

                    if is_exact_match || is_parent_match || is_series_match {
                        // Look through all series for the target
                        for (series_name, series) in &mut section.series {
                            if is_series_match {
                                let last_part = &current_path[current_path.len() - 1];
                                if series_name != last_part {
                                    continue;
                                }
                            }

                            for val in series {
                                if let Value::Map(map) = val {
                                    if let Some(Value::String(n)) = map.get(key_field) {
                                        if let Some(t_val) = target_val {
                                            if n == t_val {
                                                map.insert(
                                                    val_field.to_string(),
                                                    Value::List(source_values.clone()),
                                                );
                                                matches_found = true;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Also check records
                        for record in &mut section.records {
                            if let Some(Value::String(n)) = record.kv.get(key_field) {
                                if let Some(t_val) = target_val {
                                    if n == t_val {
                                        record.kv.insert(
                                            val_field.to_string(),
                                            Value::List(source_values.clone()),
                                        );
                                        matches_found = true;
                                    }
                                }
                            }
                        }
                    }

                    // NEW: If section.path is exactly current_path, also check if it contains the fields directly
                    if section.path == current_path {
                        if let Some(t_val) = target_val {
                            // Look for a key that matches t_val
                            if section.kv.contains_key(t_val) {
                                section
                                    .kv
                                    .insert(t_val.to_string(), Value::List(source_values.clone()));
                                matches_found = true;
                            }
                            if section.series.contains_key(t_val) {
                                section
                                    .series
                                    .insert(t_val.to_string(), source_values.clone());
                                matches_found = true;
                            }
                        }
                    }
                }
            }

            if !matches_found {
                // If the section doesn't exist, it might be a key in a parent section.
                let mut source_values = Vec::new();
                for input_section in &input_doc.sections {
                    if let Some(vals) = input_section.series.get(source_key) {
                        source_values.extend(vals.clone());
                    }
                    if let Some(val) = input_section.kv.get(source_key) {
                        source_values.push(val.clone());
                    }
                }

                if !source_values.is_empty() {
                    let key_to_update = if let Some(t_val) = target_val {
                        t_val
                    } else {
                        key_field
                    };

                    for section in &mut base_doc.sections {
                        if section.path == current_path {
                            section
                                .series
                                .insert(key_to_update.to_string(), source_values.clone());
                        }
                    }
                }
            }
        }
    } else if part == "[]" {
        // Match all keys at the current level of path
        let mut sub_paths = Vec::new();
        for section in &base_doc.sections {
            if section.path.len() > current_path.len()
                && section.path[..current_path.len()] == current_path
            {
                sub_paths.push(section.path[current_path.len()].clone());
            }
        }

        // NEW: Also check series in current sections for potential "keys" (like in the case of 'preview' being a series)
        for section in &base_doc.sections {
            if section.path == current_path {
                for series_name in section.series.keys() {
                    sub_paths.push(series_name.clone());
                }
            }
        }

        sub_paths.sort();
        sub_paths.dedup();

        if sub_paths.is_empty() {
            // Maybe it's a leaf section, and we are looking for keys inside it?
            // If part_idx + 1 is the merge instruction, it will be handled by the next call.
            update_at_path(base_doc, input_doc, parts, part_idx + 1, current_path)?;
        } else {
            for sub in sub_paths {
                let mut next_path = current_path.clone();
                next_path.push(sub);
                update_at_path(base_doc, input_doc, parts, part_idx + 1, next_path)?;
            }
        }
    } else {
        // Constant path part
        let mut next_path = current_path;
        next_path.push(part.to_string());
        update_at_path(base_doc, input_doc, parts, part_idx + 1, next_path)?;
    }

    Ok(())
}
