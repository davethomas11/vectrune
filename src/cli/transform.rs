use crate::rune_ast::{RuneDocument, Value};

pub fn handle_transform(doc: &RuneDocument, spec: &str) -> Result<RuneDocument, String> {
    let s = transform_to_string(doc, spec)?;
    let new_doc = RuneDocument::from_str(&s)
        .map_err(|e| format!("Failed to parse transformed Rune document: {}", e))?;
    Ok(new_doc)
}

pub fn transform_to_string(doc: &RuneDocument, spec: &str) -> Result<String, String> {
    // Syntax examples:
    //  @Target key:[@Section.field]
    //  @Target names:[@Skateboarder.name|unique|sort]
    //  @Target ages:[@Skateboarder.age|sort:desc]
    //  @Target pro_names:[@Skateboarder.name=="Tony Hawk"|unique]
    //  Multiple keys: @Target names:[@S.name] ages:[@S.age|sort]

    let spec = spec.trim();
    if !spec.starts_with('@') {
        return Err("Transform spec must start with '@'".to_string());
    }

    // Split target and the rest of key specs
    let mut parts = spec.splitn(2, ' ');
    let target = parts.next().unwrap();
    let rest = parts
        .next()
        .ok_or("Missing key specifications after target section")?;
    let target_section = target.trim_start_matches('@').trim();

    // Tokenize key specs by spaces, but keep brackets content intact by scanning
    let mut i = 0usize;
    let bytes = rest.as_bytes();
    let mut tokens: Vec<&str> = Vec::new();
    let mut start = 0usize;
    let mut bracket_level = 0i32;
    while i < bytes.len() {
        let c = bytes[i] as char;
        match c {
            '[' => {
                bracket_level += 1;
                i += 1;
            }
            ']' => {
                bracket_level -= 1;
                i += 1;
            }
            ' ' if bracket_level == 0 => {
                if start < i {
                    tokens.push(&rest[start..i]);
                }
                i += 1;
                while i < bytes.len() && bytes[i] as char == ' ' {
                    i += 1;
                }
                start = i;
            }
            _ => i += 1,
        }
    }
    if start < bytes.len() {
        tokens.push(&rest[start..]);
    }

    if tokens.is_empty() {
        return Err(
            "Expected at least one key specification like key:[@Section.field]".to_string(),
        );
    }

    // Each token should be key:[...]
    let mut output: Vec<(String, Vec<String>)> = Vec::new();
    for tok in tokens {
        let (key, list_part) = tok
            .split_once(':')
            .ok_or("Missing ':' after key in transform spec")?;
        let key = key.trim().to_string();
        let list_part = list_part.trim();
        if !list_part.starts_with('[') || !list_part.ends_with(']') {
            return Err("List spec must be in [ ... ]".to_string());
        }
        let inner = &list_part[1..list_part.len() - 1];
        let values = evaluate_list_spec(doc, inner.trim())?;
        output.push((key, values));
    }

    // Build resulting Rune document string
    let mut out = String::new();
    out.push_str("#!RUNE\n");
    out.push_str(&format!("@{}\n", target_section));
    for (key, values) in output {
        out.push_str(&format!("{}:\n", key));
        for v in values {
            out.push_str(&format!("  {}\n", v));
        }
    }

    Ok(out)
}

fn evaluate_list_spec(doc: &RuneDocument, inner: &str) -> Result<Vec<String>, String> {
    // inner format: @Section.field[==literal][|modifier[:arg]]...
    if !inner.starts_with('@') {
        return Err("List selector must start with '@'".to_string());
    }
    // split on '|' to separate selector and modifiers
    let mut parts = inner.split('|');
    let selector = parts.next().unwrap().trim();
    let modifiers: Vec<&str> = parts.map(|s| s.trim()).filter(|s| !s.is_empty()).collect();

    // Handle optional equality filter inside selector: @Section.field==literal
    let (section, field, filter): (&str, &str, Option<Literal>) =
        if let Some((lhs, rhs)) = selector.split_once("==") {
            let (section, field) = lhs
                .trim_start_matches('@')
                .split_once('.')
                .ok_or("Selector must be @Section.field")?;
            let lit = parse_literal(rhs.trim())?;
            (section.trim(), field.trim(), Some(lit))
        } else {
            let (section, field) = selector
                .trim_start_matches('@')
                .split_once('.')
                .ok_or("Selector must be @Section.field")?;
            (section.trim(), field.trim(), None)
        };

    // Collect values
    let mut values: Vec<String> = Vec::new();
    for sec in doc.get_sections(section) {
        for rec in &sec.records {
            // Apply filter if any
            if let Some(ref lit) = filter {
                if let Some(v) = rec.kv.get(field) {
                    if !literal_matches_value(lit, v) {
                        continue;
                    }
                } else {
                    continue;
                }
            }
            if let Some(val) = rec.kv.get(field) {
                match val {
                    Value::String(s) => values.push(s.clone()),
                    Value::Number(n) => values.push(format!("{}", n)),
                    Value::Bool(b) => values.push(format!("{}", b)),
                    _ => {}
                }
            }
        }
    }

    // Apply modifiers
    for m in modifiers {
        if m.eq_ignore_ascii_case("unique") || m.eq_ignore_ascii_case("distinct") {
            values = unique_stable(values);
        } else if m.starts_with("sort") {
            let desc = m.to_ascii_lowercase().starts_with("sort:desc");
            values = sort_maybe_numeric(values, desc);
        }
    }

    Ok(values)
}

#[derive(Debug)]
enum Literal {
    S(String),
    N(f64),
    B(bool),
}

fn parse_literal(s: &str) -> Result<Literal, String> {
    let s = s.trim();
    if s.eq_ignore_ascii_case("true") {
        return Ok(Literal::B(true));
    }
    if s.eq_ignore_ascii_case("false") {
        return Ok(Literal::B(false));
    }
    if let Ok(n) = s.parse::<f64>() {
        return Ok(Literal::N(n));
    }
    // quoted string
    if (s.starts_with('"') && s.ends_with('"') && s.len() >= 2)
        || (s.starts_with('\'') && s.ends_with('\'') && s.len() >= 2)
    {
        let trimmed = &s[1..s.len() - 1];
        return Ok(Literal::S(trimmed.to_string()));
    }
    // fallback: raw string
    Ok(Literal::S(s.to_string()))
}

fn literal_matches_value(lit: &Literal, v: &Value) -> bool {
    match (lit, v) {
        (Literal::S(ls), Value::String(rs)) => ls == rs,
        (Literal::N(ln), Value::Number(rn)) => (*ln - rn).abs() < f64::EPSILON,
        (Literal::B(lb), Value::Bool(rb)) => lb == rb,
        (Literal::S(ls), Value::Number(rn)) => ls
            .parse::<f64>()
            .map(|n| (n - rn).abs() < f64::EPSILON)
            .unwrap_or(false),
        (Literal::S(ls), Value::Bool(rb)) => {
            if ls.eq_ignore_ascii_case("true") {
                *rb
            } else if ls.eq_ignore_ascii_case("false") {
                !*rb
            } else {
                false
            }
        }
        _ => false,
    }
}

fn unique_stable(mut v: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    v.retain(|s| seen.insert(s.clone()));
    v
}

fn sort_maybe_numeric(mut v: Vec<String>, desc: bool) -> Vec<String> {
    // If all values parse as numbers, sort numerically; else lexicographically
    let all_numeric = v.iter().all(|s| s.parse::<f64>().is_ok());
    if all_numeric {
        v.sort_by(|a, b| {
            let fa = a.parse::<f64>().unwrap();
            let fb = b.parse::<f64>().unwrap();
            fa.partial_cmp(&fb).unwrap()
        });
    } else {
        v.sort();
    }
    if desc {
        v.reverse();
    }
    v
}
