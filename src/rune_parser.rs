use crate::rune_ast::{Record, RuneDocument, Section, Value};
use std::collections::HashMap;

#[derive(thiserror::Error, Debug)]
pub enum ParseError {
    #[error("No current section for line: {0}")]
    NoSection(String),
    #[error("General parse error: {0}")]
    General(String),
}

fn parse_map_block<I: Iterator<Item = String>>(lines: &mut I) -> HashMap<String, Value> {
    let mut map = HashMap::new();
    while let Some(line) = lines.next() {
        let trimmed = line.trim();
        if trimmed == "}" {
            break;
        }
        if trimmed.contains('=') {
            let mut parts = trimmed.splitn(2, '=');
            let key = parts.next().unwrap().trim().to_string();
            let value_raw = parts.next().unwrap().trim();
            let value =
                if value_raw.starts_with('$') && value_raw.ends_with('$') && value_raw.len() > 2 {
                    let var_name = &value_raw[1..value_raw.len() - 1];
                    match std::env::var(var_name) {
                        Ok(val) => Value::String(val),
                        Err(_) => Value::String(String::new()),
                    }
                } else {
                    Value::String(value_raw.trim_matches('"').to_string())
                };
            map.insert(key, value);
        }
    }
    map
}

pub fn parse_rune(input: &str) -> Result<RuneDocument, ParseError> {
    let mut sections: Vec<Section> = Vec::new();
    let mut current_section: Option<Section> = None;
    // Stack to manage nested series based on indentation.
    // Each entry tracks the indent level of the `key:` line and a path to the list location.
    // The path is represented as a vector of keys from the top-level series key to nested keys.
    let mut series_stack: Vec<(usize, Vec<String>)> = Vec::new();
    let mut current_records: Vec<Record> = Vec::new();
    let mut multiline_key: Option<String> = None;
    let mut multiline_buf: Vec<String> = Vec::new();

    let mut lines = input.lines().map(|l| l.to_string()).peekable();

    while let Some(raw) = lines.next() {
        let line = raw.trim_end();

        if line.is_empty() {
            if let Some(key) = multiline_key.take() {
                if let Some(sec) = current_section.as_mut() {
                    sec.kv.insert(key, Value::String(multiline_buf.join("\n")));
                }
                multiline_buf.clear();
            }
            continue;
        }

        if line.starts_with("#") {
            continue;
        }

        if line.starts_with("@") {
            if let Some(mut sec) = current_section.take() {
                if !current_records.is_empty() {
                    sec.records = current_records.clone();
                    current_records.clear();
                }
                sections.push(sec);
            }

            let path_str = &line[1..];
            let path: Vec<String> = path_str.split('/').map(|s| s.trim().to_string()).collect();

            current_section = Some(Section {
                path,
                kv: HashMap::new(),
                series: HashMap::new(),
                records: Vec::new(),
            });
            series_stack.clear();
            multiline_key = None;
            multiline_buf.clear();
            continue;
        }

        if let Some(key) = multiline_key.as_ref() {
            if line.trim().is_empty() {
                let key = key.clone();
                if let Some(sec) = current_section.as_mut() {
                    sec.kv.insert(key, Value::String(multiline_buf.join("\n")));
                }
                multiline_key = None;
                multiline_buf.clear();
            } else {
                multiline_buf.push(line.trim_start().to_string());
            }
            continue;
        }

        if let Some(sec) = current_section.as_mut() {
            // Map block parsing: allowed anywhere, but only if '=' is NOT before '{'
            if line.contains('{') {
                let eq_idx = line.find('=');
                let brace_idx = line.find('{');
                if brace_idx.is_some() && (eq_idx.is_none() || eq_idx.unwrap() > brace_idx.unwrap())
                {
                    let key = line[..brace_idx.unwrap()].trim().to_string();
                    // Collect map block lines
                    let mut map_lines = Vec::new();
                    while let Some(map_line) = lines.next() {
                        let trimmed = map_line.trim();
                        if trimmed == "}" {
                            break;
                        }
                        map_lines.push(map_line);
                    }
                    let mut map_iter = map_lines.into_iter();
                    let map = parse_map_block(&mut map_iter);
                    sec.kv.insert(key, Value::Map(map));
                    continue;
                } else if brace_idx.is_some()
                    && eq_idx.is_some()
                    && eq_idx.unwrap() < brace_idx.unwrap()
                {
                    // Handle object assignment (e.g., foo = { ... })
                    let mut assignment = line.to_string();
                    while !assignment.trim_end().ends_with('}') {
                        if let Some(next_line) = lines.next() {
                            assignment.push_str(next_line.trim_end());
                        } else {
                            break;
                        }
                    }
                    // Clean up whitespace and newlines
                    let cleaned = assignment
                        .lines()
                        .map(|l| l.trim())
                        .filter(|l| !l.is_empty())
                        .collect::<Vec<_>>()
                        .join(" ");
                    // Add as a string to the current series if inside a series
                    if !series_stack.is_empty() {
                        if let Some((_, path)) = series_stack.last().cloned() {
                            let mut maybe_list: Option<&mut Vec<Value>> = None;
                            {
                                let top_key = &path[0];
                                if let Some(list) = sec.series.get_mut(top_key) {
                                    let mut current_list: *mut Vec<Value> = list as *mut _;
                                    for nested_key in path.iter().skip(1) {
                                        unsafe {
                                            if let Some(Value::Map(m)) = (*current_list).last_mut()
                                            {
                                                if let Some(Value::List(inner)) =
                                                    m.get_mut(nested_key)
                                                {
                                                    current_list = inner as *mut _;
                                                }
                                            }
                                        }
                                    }
                                    unsafe {
                                        maybe_list = Some(&mut *current_list);
                                    }
                                }
                            }
                            if let Some(list) = maybe_list {
                                list.push(Value::String(cleaned));
                            }
                        }
                    } else {
                        // Otherwise, add as a string to section kv
                        sec.kv
                            .insert("statement".to_string(), Value::String(cleaned));
                    }
                    continue;
                }
            }

            if let Some(idx) = line.find('>') {
                let key = line[..idx].trim().to_string();
                multiline_key = Some(key);
                multiline_buf.clear();
                continue;
            }

            if line.ends_with(':') {
                // Start or continue a (possibly nested) series list
                let key = line[..line.len() - 1].trim().to_string();
                let indent = raw.chars().take_while(|c| c.is_whitespace()).count();

                // Pop stack until we find a parent with smaller indent
                while let Some((parent_indent, _)) = series_stack.last() {
                    if indent <= *parent_indent {
                        series_stack.pop();
                    } else {
                        break;
                    }
                }

                if series_stack.is_empty() {
                    // Top-level series
                    sec.series.entry(key.clone()).or_insert_with(Vec::new);
                    series_stack.push((indent, vec![key]));
                } else {
                    // Nested series under the current list's last element as a map
                    let path = series_stack.last().unwrap().1.clone();

                    // Find the parent list by traversing the path
                    let mut maybe_list: Option<&mut Vec<Value>> = None;
                    // SAFETY: borrow checker dance using a scoped block
                    {
                        // Start at top-level list
                        let top_key = &path[0];
                        if let Some(list) = sec.series.get_mut(top_key) {
                            // Traverse nested keys by looking at last map in the list
                            let mut current_list: *mut Vec<Value> = list as *mut _;
                            for nested_key in path.iter().skip(1) {
                                unsafe {
                                    if let Some(Value::Map(m)) = (*current_list).last_mut() {
                                        if let Some(Value::List(inner)) = m.get_mut(nested_key) {
                                            current_list = inner as *mut _;
                                        } else {
                                            // Structure missing; create it
                                            let mut new_map = HashMap::new();
                                            new_map.insert(
                                                nested_key.clone(),
                                                Value::List(Vec::new()),
                                            );
                                            (*current_list).push(Value::Map(new_map));
                                            if let Some(Value::Map(m2)) = (*current_list).last_mut()
                                            {
                                                if let Some(Value::List(inner2)) =
                                                    m2.get_mut(nested_key)
                                                {
                                                    current_list = inner2 as *mut _;
                                                }
                                            }
                                        }
                                    } else {
                                        // No last element, create one
                                        let mut new_map = HashMap::new();
                                        new_map.insert(nested_key.clone(), Value::List(Vec::new()));
                                        (*current_list).push(Value::Map(new_map));
                                        if let Some(Value::Map(m2)) = (*current_list).last_mut() {
                                            if let Some(Value::List(inner2)) =
                                                m2.get_mut(nested_key)
                                            {
                                                current_list = inner2 as *mut _;
                                            }
                                        }
                                    }
                                }
                            }
                            unsafe {
                                maybe_list = Some(&mut *current_list);
                            }
                        }
                    }

                    if let Some(parent_list) = maybe_list {
                        // Push a new map with the nested key -> empty list
                        let mut nested = HashMap::new();
                        nested.insert(key.clone(), Value::List(Vec::new()));
                        parent_list.push(Value::Map(nested));

                        // Extend path with this new key and push to stack
                        let mut new_path = path.clone();
                        new_path.push(key);
                        series_stack.push((indent, new_path));
                    } else {
                        // If we cannot find parent list, fall back to creating a top-level series
                        sec.series.entry(key.clone()).or_insert_with(Vec::new);
                        series_stack.push((indent, vec![key]));
                    }
                }
                // Handle object assignment in series right after series start
                if line.contains('=') && line.contains('{') {
                    if let Some((_, path)) = series_stack.last().cloned() {
                        let mut maybe_list: Option<&mut Vec<Value>> = None;
                        {
                            let top_key = &path[0];
                            if let Some(list) = sec.series.get_mut(top_key) {
                                let mut current_list: *mut Vec<Value> = list as *mut _;
                                for nested_key in path.iter().skip(1) {
                                    unsafe {
                                        if let Some(Value::Map(m)) = (*current_list).last_mut() {
                                            if let Some(Value::List(inner)) = m.get_mut(nested_key)
                                            {
                                                current_list = inner as *mut _;
                                            }
                                        }
                                    }
                                }
                                unsafe {
                                    maybe_list = Some(&mut *current_list);
                                }
                            }
                        }
                        if let Some(list) = maybe_list {
                            let mut assignment = line.to_string();
                            while !assignment.trim_end().ends_with('}') {
                                if let Some(next_line) = lines.next() {
                                    assignment.push_str("\n");
                                    assignment.push_str(next_line.trim_end());
                                } else {
                                    break;
                                }
                            }
                            list.push(Value::String(assignment));
                        }
                    }
                }
                continue;
            }

            // Handle list items for the current (potentially nested) series
            if line.starts_with(' ') || line.starts_with('\t') || line.starts_with('-') {
                // Determine the indentation of this item line (based on raw to preserve spaces/tabs)
                let item_indent = raw.chars().take_while(|c| c.is_whitespace()).count();

                // If indentation decreased or returned to a parent level, move up the stack
                while let Some((parent_indent, _)) = series_stack.last() {
                    if item_indent <= *parent_indent {
                        series_stack.pop();
                    } else {
                        break;
                    }
                }

                if let Some((_, path)) = series_stack.last().cloned() {
                    // Compute the target list
                    let mut maybe_list: Option<&mut Vec<Value>> = None;
                    {
                        let top_key = &path[0];
                        if let Some(list) = sec.series.get_mut(top_key) {
                            let mut current_list: *mut Vec<Value> = list as *mut _;
                            for nested_key in path.iter().skip(1) {
                                unsafe {
                                    if let Some(Value::Map(m)) = (*current_list).last_mut() {
                                        if let Some(Value::List(inner)) = m.get_mut(nested_key) {
                                            current_list = inner as *mut _;
                                        }
                                    }
                                }
                            }
                            unsafe {
                                maybe_list = Some(&mut *current_list);
                            }
                        }
                    }

                    if let Some(list) = maybe_list {
                        // Robust handling: object assignment at any point in series
                        if line.contains('=') && line.contains('{') {
                            let mut assignment = line.to_string();
                            while !assignment.trim_end().ends_with('}') {
                                if let Some(next_line) = lines.next() {
                                    assignment.push_str("\n");
                                    assignment.push_str(next_line.trim_end());
                                } else {
                                    break;
                                }
                            }
                            list.push(Value::String(assignment));
                            continue;
                        }
                        let item_text = if line.starts_with('-') {
                            line[1..].trim().to_string()
                        } else {
                            line.trim().to_string()
                        };
                        list.push(Value::String(item_text));
                        continue;
                    }
                }
            } else {
                // Any other content ends the current series nesting
                series_stack.clear();
            }

            if line.starts_with('+') {
                let rec = Record { kv: HashMap::new() };
                current_records.push(rec);
            }

            if line.contains('=') {
                // Remove '+' from start if present
                let pline = if line.starts_with('+') {
                    line[1..].trim_start()
                } else {
                    line
                };
                let mut parts = pline.splitn(2, '=');
                let key = parts.next().unwrap().trim().to_string();
                let value_raw = parts.next().unwrap().trim();

                let value = if value_raw.starts_with('(') && value_raw.ends_with(')') {
                    let inner = &value_raw[1..value_raw.len() - 1];
                    let items: Vec<Value> = inner
                        .split_whitespace()
                        .map(|s| {
                            if s.starts_with('$') && s.ends_with('$') && s.len() > 2 {
                                let var_name = &s[1..s.len() - 1];
                                match std::env::var(var_name) {
                                    Ok(val) => Value::String(val),
                                    Err(_) => Value::String(String::new()),
                                }
                            } else {
                                Value::String(s.to_string())
                            }
                        })
                        .collect();
                    Value::List(items)
                } else if value_raw == "true" {
                    Value::Bool(true)
                } else if value_raw == "false" {
                    Value::Bool(false)
                } else if let Ok(n) = value_raw.parse::<f64>() {
                    Value::Number(n)
                } else {
                    // Check for $VAR$ syntax for env var substitution
                    if value_raw.starts_with('$') && value_raw.ends_with('$') && value_raw.len() > 2
                    {
                        let var_name = &value_raw[1..value_raw.len() - 1];
                        match std::env::var(var_name) {
                            Ok(val) => Value::String(val),
                            Err(_) => Value::String(String::new()),
                        }
                    } else {
                        Value::String(value_raw.trim_matches('"').to_string())
                    }
                };

                if let Some(last) = current_records.last_mut() {
                    last.kv.insert(key, value);
                } else {
                    sec.kv.insert(key, value);
                }
                continue;
            }

            if line.contains('=') && line.contains('{') {
                // Handle object assignment as a single statement
                let mut assignment = line.to_string();
                while !assignment.trim_end().ends_with('}') {
                    if let Some(next_line) = lines.next() {
                        assignment.push_str("\n");
                        assignment.push_str(next_line.trim_end());
                    } else {
                        break;
                    }
                }
                // Add the full assignment as a string
                if let Some(last) = current_records.last_mut() {
                    last.kv
                        .insert("statement".to_string(), Value::String(assignment));
                } else {
                    sec.kv
                        .insert("statement".to_string(), Value::String(assignment));
                }
                continue;
            }

            return Err(ParseError::General(format!("Unrecognized line: {}", line)));
        } else {
            return Err(ParseError::NoSection(line.to_string()));
        }
    }

    if let Some(mut sec) = current_section.take() {
        if !current_records.is_empty() {
            sec.records = current_records;
        }
        sections.push(sec);
    }

    Ok(RuneDocument { sections })
}
