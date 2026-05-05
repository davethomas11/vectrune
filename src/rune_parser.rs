use crate::rune_ast::{json_to_ast_value, Record, RuneDocument, Section, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(thiserror::Error, Debug)]
pub enum ParseError {
    #[error("No current section for line: {0}")]
    NoSection(String),
    #[error("General parse error: {0}")]
    General(String),
}

#[derive(thiserror::Error, Debug)]
pub enum LoadError {
    #[error("Failed to read Rune path {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("Failed to parse Rune content from {path}: {source}")]
    Parse {
        path: String,
        #[source]
        source: ParseError,
    },
    #[error("Invalid import declaration in {path}: {message}")]
    InvalidImport { path: String, message: String },
    #[error("Import cycle detected while loading {path}")]
    ImportCycle { path: String },
}

pub fn load_rune_document_from_path(path: &Path) -> Result<RuneDocument, LoadError> {
    let mut visiting = HashSet::new();
    let mut loaded = HashSet::new();
    load_rune_document_from_path_inner(path, &mut visiting, &mut loaded)
}

pub fn load_rune_document_from_str_with_base(
    content: &str,
    base_dir: &Path,
    source_name: &str,
) -> Result<RuneDocument, LoadError> {
    let mut visiting = HashSet::new();
    let mut loaded = HashSet::new();
    load_rune_document_from_content_inner(content, base_dir, source_name, &mut visiting, &mut loaded)
}

fn load_rune_document_from_path_inner(
    path: &Path,
    visiting: &mut HashSet<PathBuf>,
    loaded: &mut HashSet<PathBuf>,
) -> Result<RuneDocument, LoadError> {
    let canonical = canonicalize_for_tracking(path)?;

    if loaded.contains(&canonical) {
        return Ok(RuneDocument { sections: Vec::new() });
    }
    if !visiting.insert(canonical.clone()) {
        return Err(LoadError::ImportCycle {
            path: canonical.display().to_string(),
        });
    }

    let result = if canonical.is_dir() {
        let mut entries = fs::read_dir(&canonical)
            .map_err(|source| LoadError::Io {
                path: canonical.display().to_string(),
                source,
            })?
            .filter_map(|entry| entry.ok().map(|entry| entry.path()))
            .filter(|entry| entry.extension().and_then(|ext| ext.to_str()) == Some("rune"))
            .collect::<Vec<_>>();
        entries.sort();

        let mut doc = RuneDocument { sections: Vec::new() };
        for entry in entries {
            let imported = load_rune_document_from_path_inner(&entry, visiting, loaded)?;
            doc.merge(imported);
        }
        Ok(doc)
    } else {
        let content = fs::read_to_string(&canonical).map_err(|source| LoadError::Io {
            path: canonical.display().to_string(),
            source,
        })?;
        let base_dir = canonical.parent().unwrap_or_else(|| Path::new("."));
        load_rune_document_from_content_inner(
            &content,
            base_dir,
            &canonical.display().to_string(),
            visiting,
            loaded,
        )
    };

    visiting.remove(&canonical);
    if result.is_ok() {
        loaded.insert(canonical);
    }
    result
}

fn load_rune_document_from_content_inner(
    content: &str,
    base_dir: &Path,
    source_name: &str,
    visiting: &mut HashSet<PathBuf>,
    loaded: &mut HashSet<PathBuf>,
) -> Result<RuneDocument, LoadError> {
    let (imports, stripped_content) = extract_imports(content, source_name)?;

    let mut doc = RuneDocument { sections: Vec::new() };
    for import_path in imports {
        let resolved = base_dir.join(import_path);
        let imported = load_rune_document_from_path_inner(&resolved, visiting, loaded)?;
        doc.merge(imported);
    }

    let current = parse_rune(&stripped_content).map_err(|source| LoadError::Parse {
        path: source_name.to_string(),
        source,
    })?;
    doc.merge(current);
    Ok(doc)
}

fn extract_imports(content: &str, source_name: &str) -> Result<(Vec<String>, String), LoadError> {
    let mut imports = Vec::new();
    let mut stripped_lines = Vec::new();
    let mut imports_allowed = true;

    for line in content.lines() {
        let trimmed = line.trim();
        let is_top_level = !line.starts_with(' ') && !line.starts_with('\t');

        if is_top_level && trimmed.starts_with("import ") {
            if !imports_allowed {
                return Err(LoadError::InvalidImport {
                    path: source_name.to_string(),
                    message: "import declarations must appear before sections and other top-level content".to_string(),
                });
            }
            imports.push(parse_import_path(trimmed, source_name)?);
            continue;
        }

        stripped_lines.push(line.to_string());

        if is_top_level && !trimmed.is_empty() && !trimmed.starts_with('#') {
            imports_allowed = false;
        }
    }

    Ok((imports, stripped_lines.join("\n")))
}

fn parse_import_path(line: &str, source_name: &str) -> Result<String, LoadError> {
    let rest = line["import ".len()..].trim();
    if rest.len() >= 2 && rest.starts_with('"') && rest.ends_with('"') {
        return Ok(rest[1..rest.len() - 1].to_string());
    }

    Err(LoadError::InvalidImport {
        path: source_name.to_string(),
        message: format!("expected import \"path\" but found `{}`", line),
    })
}

fn canonicalize_for_tracking(path: &Path) -> Result<PathBuf, LoadError> {
    path.canonicalize().map_err(|source| LoadError::Io {
        path: path.display().to_string(),
        source,
    })
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
            // Also check that '{' is not inside quotes
            if line.contains('{') {
                let eq_idx = line.find('=');
                let brace_idx = line.rfind('{').filter(|&idx| !is_char_in_quotes(line, idx));
                let is_map_block = brace_idx
                    .map(|idx| eq_idx.is_none() || eq_idx.unwrap() > idx)
                    .unwrap_or(false);

                if is_map_block {
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
                }
            }

            // Multiline key: must be at end of line or followed only by whitespace
            // to avoid matching comparison operators like "if x > 1"
            if let Some(idx) = line.find('>') {
                let after_brace = &line[idx + 1..];
                if after_brace.trim().is_empty() {
                    let key = line[..idx].trim().to_string();
                    multiline_key = Some(key);
                    multiline_buf.clear();
                    continue;
                }
            }

            // Determine if this line starts a new nested block (ends with : or starts with if/else)
            let trimmed_line = line.trim_start();
            let starts_block = trimmed_line.ends_with(':') || (trimmed_line.starts_with("if ") && !trimmed_line.contains('='));
            let indent = raw.chars().take_while(|c| c.is_whitespace()).count();

            // A block start is a NEW series only if it's not indented within an active series
            // If there's an active series and this line is more indented, it's an ITEM in that series
            let is_series_declaration = if starts_block && !series_stack.is_empty() {
                // Check if this indentation is deeper than the current series level
                let current_series_indent = series_stack.last().map(|(ind, _)| *ind).unwrap_or(0);
                indent <= current_series_indent
            } else if starts_block {
                true
            } else {
                false
            };

            if is_series_declaration {
                // Start or continue a (possibly nested) series list
                let key = if trimmed_line.ends_with(':') {
                    trimmed_line[..trimmed_line.len() - 1].trim().to_string()
                } else {
                    trimmed_line.trim().to_string()
                };

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
                if is_object_assignment_line(line) {
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
                            let mut assignment = line.trim().to_string();
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

                // Check if this indented line is itself a block starter (e.g., "if" statement)
                let trimmed_indented = line.trim_start();
                let is_indented_block_start = trimmed_indented.ends_with(':') || (trimmed_indented.starts_with("if ") && !trimmed_indented.contains('='));

                if is_indented_block_start {
                    // This is a nested block starter within the current series
                    // Pop stack until we find a parent with smaller indent
                    while let Some((parent_indent, _)) = series_stack.last() {
                        if item_indent <= *parent_indent {
                            series_stack.pop();
                        } else {
                            break;
                        }
                    }

                    if let Some((_, path)) = series_stack.last().cloned() {
                        let key = if trimmed_indented.ends_with(':') {
                            trimmed_indented[..trimmed_indented.len() - 1].trim().to_string()
                        } else {
                            trimmed_indented.trim().to_string()
                        };

                        // Find the parent list
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

                        if let Some(parent_list) = maybe_list {
                            // Push a new map with the nested key -> empty list
                            let mut nested = HashMap::new();
                            nested.insert(key.clone(), Value::List(Vec::new()));
                            parent_list.push(Value::Map(nested));

                            // Extend path and push to stack
                            let mut new_path = path.clone();
                            new_path.push(key);
                            series_stack.push((item_indent, new_path));
                        }
                    }
                    continue;
                }

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
                        if is_object_assignment_line(line) {
                            let mut assignment = line.trim().to_string();
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
                let mut value_raw = parts.next().unwrap().trim().to_string();

                // Handle multiline or inline object literal { ... }
                if looks_like_object_literal_start(&value_raw) {
                    let mut assignment = value_raw;
                    while !assignment.trim_end().ends_with('}') {
                        if let Some(next_line) = lines.next() {
                            assignment.push_str("\n");
                            assignment.push_str(next_line.trim_end());
                        } else {
                            break;
                        }
                    }
                    value_raw = assignment;
                }

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
                } else if looks_like_object_literal_start(&value_raw) && value_raw.trim_end().ends_with('}') {
                    // Simple JSON object parsing for KV
                    match serde_json::from_str::<serde_json::Value>(&value_raw) {
                        Ok(v) => json_to_ast_value(&v),
                        Err(_) => Value::String(value_raw),
                    }
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

#[derive(Debug)]
pub enum ParsedLine {
    Assignment { var: String, expr: String },
    Builtin { name: String, args: Vec<String> },
    Object { var: String, fields: Vec<(String, String)> },
    Comment,
    Raw(String),
}

pub fn parse_rune_line(line: &str) -> Result<ParsedLine, ParseError> {
    let line = line.trim();
    if line.is_empty() {
        return Err(ParseError::General("Empty line".to_string()));
    }
    if line.starts_with('#') {
        return Ok(ParsedLine::Comment);
    }
    // Assignment: var = expr
    if let Some(eq_pos) = line.find('=') {
        // Ignore '==' or '!='
        let is_assignment = !line.contains("==") && !line.contains("!=");
        if is_assignment {
            let var = line[..eq_pos].trim().to_string();
            let expr = line[eq_pos + 1..].trim().to_string();
            // Object construction: var = { ... }
            if expr.starts_with('{') && expr.ends_with('}') {
                // Parse fields
                let fields_str = &expr[1..expr.len() - 1];
                let fields: Vec<(String, String)> = fields_str
                    .split(',')
                    .filter_map(|f| {
                        let parts: Vec<_> = f.split(':').collect();
                        if parts.len() == 2 {
                            Some((parts[0].trim().to_string(), parts[1].trim().to_string()))
                        } else {
                            None
                        }
                    })
                    .collect();
                return Ok(ParsedLine::Object { var, fields });
            }
            return Ok(ParsedLine::Assignment { var, expr });
        }
    }
    // Builtin: memory.get ... or similar
    let parts: Vec<_> = line.split_whitespace().collect();
    if !parts.is_empty() && parts[0].contains('.') {
        let name = parts[0].to_string();
        let args = parts[1..].iter().map(|s| s.to_string()).collect();
        return Ok(ParsedLine::Builtin { name, args });
    }
    // Raw line
    Ok(ParsedLine::Raw(line.to_string()))
}

fn is_char_in_quotes(s: &str, target_idx: usize) -> bool {
    let mut in_quotes = false;
    for (i, ch) in s.chars().enumerate() {
        if i >= target_idx {
            break;
        }
        if ch == '"' {
            in_quotes = !in_quotes;
        }
    }
    in_quotes
}

fn looks_like_object_literal_start(value_raw: &str) -> bool {
    let trimmed = value_raw.trim_start();
    if !trimmed.starts_with('{') {
        return false;
    }

    let rest = trimmed[1..].trim_start();
    rest.is_empty() || rest.starts_with('"') || rest.starts_with('}')
}

fn is_object_assignment_line(line: &str) -> bool {
    line.find('=')
        .map(|eq_idx| looks_like_object_literal_start(&line[eq_idx + 1..]))
        .unwrap_or(false)
}

