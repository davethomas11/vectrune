//! Group records into deterministic, non-mutating reports.

use crate::builtins::{BuiltinResult, Context, LAST_EXEC_RESULT};
use crate::core::resolve_path;
use serde_json::{json, Value};
use std::collections::HashMap;

const USAGE: &str = "summarize: expected <records> by <group-path> [sum|avg|min|max <value-path>]";

#[derive(Hash, Eq, PartialEq)]
enum GroupKey {
    Null,
    Bool(bool),
    Number(String),
    Text(String),
}

fn group_key(value: &Value) -> Option<GroupKey> {
    match value {
        Value::Null => Some(GroupKey::Null),
        Value::Bool(value) => Some(GroupKey::Bool(*value)),
        Value::String(value) => Some(GroupKey::Text(value.clone())),
        Value::Number(value) => {
            // Normalize 1 and 1.0 (and signed zero), without rounding integer IDs.
            let key = if let Some(value) = value.as_i64() {
                value.to_string()
            } else if let Some(value) = value.as_u64() {
                value.to_string()
            } else {
                let value = value.as_f64()?;
                if value == 0.0 {
                    "0".into()
                } else {
                    value.to_string()
                }
            };
            Some(GroupKey::Number(key))
        }
        _ => None,
    }
}

fn valid_path(path: &str) -> bool {
    !path.is_empty() && path.split('.').all(|part| !part.is_empty())
}

fn field<'a>(row: &'a Value, path: &str) -> Option<&'a Value> {
    path.split('.')
        .try_fold(row, |value, key| value.as_object()?.get(key))
}

fn numeric(value: Option<&Value>) -> Result<Option<f64>, ()> {
    let value = match value {
        None | Some(Value::Null) => return Ok(None),
        Some(Value::String(text)) if text.trim().is_empty() => return Ok(None),
        Some(Value::String(text)) => text.trim().parse::<f64>().map_err(|_| ())?,
        Some(Value::Number(value)) => value.as_f64().ok_or(())?,
        _ => return Err(()),
    };
    if value.is_finite() {
        Ok(Some(value))
    } else {
        Err(())
    }
}

struct Group {
    value: Value,
    count: u64,
    numeric_count: u64,
    total: f64,
    min: Option<f64>,
    max: Option<f64>,
}

/// Missing group fields join the null group; absent numeric values are ignored.
/// Group order follows first occurrence, and source records are never changed.
pub fn summarize(
    records: &Value,
    group_path: &str,
    metric: Option<(&str, &str)>,
) -> Result<Value, String> {
    if !valid_path(group_path)
        || metric.is_some_and(|(name, path)| {
            !matches!(name, "sum" | "avg" | "min" | "max") || !valid_path(path)
        })
    {
        return Err(USAGE.into());
    }
    let rows = records
        .as_array()
        .ok_or("summarize: source must be a list of records")?;
    let mut indexes = HashMap::new();
    let mut groups: Vec<Group> = Vec::new();
    for (index, row) in rows.iter().enumerate() {
        if !row.is_object() {
            return Err(format!("summarize: row {} must be a record", index + 1));
        }
        let value = field(row, group_path).unwrap_or(&Value::Null);
        let key = group_key(value).ok_or_else(|| {
            format!(
                "summarize: row {} group field '{}' must be a scalar",
                index + 1,
                group_path
            )
        })?;
        let position = *indexes.entry(key).or_insert_with(|| {
            groups.push(Group {
                value: value.clone(),
                count: 0,
                numeric_count: 0,
                total: 0.0,
                min: None,
                max: None,
            });
            groups.len() - 1
        });
        let group = &mut groups[position];
        group.count += 1;
        if let Some((operation, path)) = metric {
            let number = numeric(field(row, path)).map_err(|_| {
                format!(
                    "summarize: row {} field '{}' must be a finite number or numeric string",
                    index + 1,
                    path
                )
            })?;
            if let Some(number) = number {
                group.numeric_count += 1;
                group.min = Some(group.min.map_or(number, |value| value.min(number)));
                group.max = Some(group.max.map_or(number, |value| value.max(number)));
                if matches!(operation, "sum" | "avg") {
                    group.total += number;
                    if !group.total.is_finite() {
                        return Err(format!(
                            "summarize: {} overflow for field '{}'",
                            operation, path
                        ));
                    }
                }
            }
        }
    }
    let result = groups
        .into_iter()
        .map(|group| {
            let mut result = json!({ "group": group.value, "count": group.count });
            if let Some((operation, _)) = metric {
                result[operation] = match operation {
                    "sum" => json!(group.total),
                    "avg" if group.numeric_count > 0 => {
                        json!(group.total / group.numeric_count as f64)
                    }
                    "min" => json!(group.min),
                    "max" => json!(group.max),
                    _ => Value::Null,
                };
            }
            result
        })
        .collect();
    Ok(Value::Array(result))
}

pub fn builtin_summarize(
    args: &[String],
    ctx: &mut Context,
    assign_to: Option<&str>,
) -> BuiltinResult {
    if !matches!(args.len(), 3 | 5) || args[1] != "by" {
        return BuiltinResult::Error(USAGE.into());
    }
    let source = match resolve_path(ctx, &args[0], None) {
        Some(source) => source,
        None => {
            return BuiltinResult::Error(format!("summarize: source '{}' was not found", args[0]))
        }
    };
    let metric = if args.len() == 5 {
        Some((args[3].as_str(), args[4].as_str()))
    } else {
        None
    };
    match summarize(&source, &args[2], metric) {
        Ok(value) => {
            if let Some(target) = assign_to {
                ctx.insert(target.into(), value.clone());
            }
            ctx.insert(LAST_EXEC_RESULT.into(), value);
            BuiltinResult::Ok
        }
        Err(message) => BuiltinResult::Error(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shared_native_and_browser_fixtures() {
        let fixtures: Value =
            serde_json::from_str(include_str!("../../../tests/fixtures/summarize.json")).unwrap();
        for fixture in fixtures.as_array().unwrap() {
            let rows = &fixture["rows"];
            let original = rows.clone();
            let metric = fixture["operation"]
                .as_str()
                .map(|operation| (operation, fixture["value"].as_str().unwrap()));
            let result = summarize(rows, fixture["group"].as_str().unwrap(), metric);
            if let Some(error) = fixture["error"].as_str() {
                assert_eq!(result.unwrap_err(), error, "{}", fixture["name"]);
            } else {
                assert_eq!(result.unwrap(), fixture["expected"], "{}", fixture["name"]);
            }
            assert_eq!(rows, &original, "source changed: {}", fixture["name"]);
        }
    }

    #[test]
    fn errors_do_not_overwrite_previous_results() {
        let mut ctx = Context::from([
            ("rows".into(), json!([{"region": "A", "amount": "invalid"}])),
            ("report".into(), json!("previous report")),
            (LAST_EXEC_RESULT.into(), json!("previous result")),
        ]);
        let original = ctx.clone();
        let args = ["rows", "by", "region", "sum", "amount"].map(String::from);
        assert!(matches!(
            builtin_summarize(&args, &mut ctx, Some("report")),
            BuiltinResult::Error(_)
        ));
        assert_eq!(ctx, original);
    }

    #[test]
    fn validates_argument_shape_and_missing_source() {
        for args in [
            vec![],
            vec!["rows", "region"],
            vec!["rows", "with", "region"],
            vec!["rows", "by", "region", "sum"],
        ] {
            let args: Vec<String> = args.into_iter().map(String::from).collect();
            assert!(
                matches!(builtin_summarize(&args, &mut Context::new(), None), BuiltinResult::Error(message) if message == USAGE)
            );
        }
        let args = ["missing", "by", "region"].map(String::from);
        assert!(
            matches!(builtin_summarize(&args, &mut Context::new(), None), BuiltinResult::Error(message) if message == "summarize: source 'missing' was not found")
        );
    }

    #[test]
    fn resolves_nested_sources_and_sets_last_result() {
        let source = json!({"orders": [{"region": "A"}, {"region": "A"}]});
        let mut ctx = Context::from([("body".into(), source.clone())]);
        let args = ["body.orders", "by", "region"].map(String::from);
        assert!(matches!(
            builtin_summarize(&args, &mut ctx, Some("report")),
            BuiltinResult::Ok
        ));
        assert_eq!(ctx["report"], json!([{"group": "A", "count": 2}]));
        assert_eq!(ctx["report"], ctx[LAST_EXEC_RESULT]);
        assert_eq!(ctx["body"], source);
    }
}
