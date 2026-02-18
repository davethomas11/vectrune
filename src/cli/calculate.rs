use crate::rune_ast::{RuneDocument, Value};

pub fn handle_calculate(doc: &RuneDocument, expr: &str) -> Result<(), String> {
    match calculate_to_string(doc, expr) {
        Ok(s) => {
            println!("{}", s);
            Ok(())
        }
        Err(e) => Err(e),
    }
}

pub fn calculate_to_string(doc: &RuneDocument, expr: &str) -> Result<String, String> {
    // Supported:
    //  - avg Section.field
    //  - sum Section.field
    //  - min Section.field
    //  - max Section.field
    //  - count Section
    //  - count Section.field
    let parts: Vec<&str> = expr.split_whitespace().collect();
    if parts.len() != 2 {
        return Err(
            "Unsupported calculate expression. Examples: 'avg Section.field', 'count Section'"
                .to_string(),
        );
    }
    let func = parts[0].to_lowercase();
    let target = parts[1];

    match func.as_str() {
        "avg" | "sum" | "min" | "max" => {
            let (section, field) = target.split_once('.').ok_or("Expected Section.field")?;
            let mut nums: Vec<f64> = Vec::new();
            for sec in doc.get_sections(section) {
                for rec in &sec.records {
                    if let Some(val) = rec.kv.get(field) {
                        let num = match val {
                            Value::Number(n) => Some(*n),
                            Value::String(s) => s.parse::<f64>().ok(),
                            _ => None,
                        };
                        if let Some(n) = num {
                            nums.push(n);
                        }
                    }
                }
            }
            if nums.is_empty() {
                return Err(format!("No numeric values found for {}.{}", section, field));
            }
            match func.as_str() {
                "avg" => {
                    let sum: f64 = nums.iter().sum();
                    let avg = sum / (nums.len() as f64);
                    Ok((avg.round() as i64).to_string())
                }
                "sum" => {
                    let sum: f64 = nums.iter().sum();
                    // print integer if it's an integer value, else print as float trimmed
                    if (sum.fract()).abs() < f64::EPSILON {
                        Ok((sum as i64).to_string())
                    } else {
                        Ok(sum.to_string())
                    }
                }
                "min" => {
                    if let Some(min) = nums.iter().cloned().reduce(f64::min) {
                        if (min.fract()).abs() < f64::EPSILON {
                            Ok((min as i64).to_string())
                        } else {
                            Ok(min.to_string())
                        }
                    } else {
                        Err("No values".to_string())
                    }
                }
                "max" => {
                    if let Some(max) = nums.iter().cloned().reduce(f64::max) {
                        if (max.fract()).abs() < f64::EPSILON {
                            Ok((max as i64).to_string())
                        } else {
                            Ok(max.to_string())
                        }
                    } else {
                        Err("No values".to_string())
                    }
                }
                _ => unreachable!(),
            }
        }
        "count" => {
            if let Some((section, field)) = target.split_once('.') {
                // count records with non-null field
                let mut cnt = 0usize;
                for sec in doc.get_sections(section) {
                    for rec in &sec.records {
                        if rec.kv.get(field).is_some() {
                            cnt += 1;
                        }
                    }
                }
                Ok(cnt.to_string())
            } else {
                // count records in section
                let mut cnt = 0usize;
                for sec in doc.get_sections(target) {
                    cnt += sec.records.len();
                }
                Ok(cnt.to_string())
            }
        }
        _ => Err("Supported functions: avg, sum, min, max, count".to_string()),
    }
}
