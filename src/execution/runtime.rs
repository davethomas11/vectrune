use crate::builtins::Context;
use crate::core::{eval_condition, resolve_path};
use anyhow::{anyhow, bail, Result};
use serde_json::json;
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::io::{BufRead, Write};

/// Sentinel used to signal `stop` termination through the call stack without
/// treating it as an error.
#[allow(dead_code)]
struct StopSignal(Option<String>);

use super::ir::{ExecProgram, ExecStmt};

#[derive(Debug, Clone, PartialEq)]
enum ControlFlow {
    Continue,
    RepeatLine(usize),
    Stop(Option<String>),
}

pub fn run_program_with_io<R: BufRead, W: Write>(
    program: &ExecProgram,
    input: &mut R,
    output: &mut W,
) -> Result<()> {
    let mut ctx: Context = HashMap::new();
    run_program_with_context(program, &mut ctx, input, output)
}

// Async wrapper kept for wasm compatibility (used by src/wasm.rs)
#[allow(dead_code)]
pub async fn run_program_with_io_async<R: BufRead, W: Write>(
    program: &ExecProgram,
    input: &mut R,
    output: &mut W,
    _app_state: &crate::core::AppState,
) -> Result<()> {
    run_program_with_io(program, input, output)
}

pub fn run_program_with_context<R: BufRead, W: Write>(
    program: &ExecProgram,
    ctx: &mut Context,
    input: &mut R,
    output: &mut W,
) -> Result<()> {
    let mut pc = 0usize;
    let mut steps = 0usize;
    let max_steps = 10_000usize;

    while pc < program.statements.len() {
        steps += 1;
        if steps > max_steps {
            bail!("execution exceeded {} steps", max_steps);
        }

        match execute_stmt(&program.statements[pc], ctx, input, output)? {
            ControlFlow::Continue => pc += 1,
            ControlFlow::RepeatLine(target_line) => {
                pc = find_statement_index_for_line(&program.statements, target_line).ok_or_else(|| {
                    anyhow!("repeat target line {} does not resolve to a top-level statement", target_line)
                })?;
            }
            ControlFlow::Stop(msg) => {
                if let Some(msg) = msg {
                    writeln!(output, "{}", msg)?;
                    output.flush()?;
                }
                return Ok(());
            }
        }
    }

    Ok(())
}

fn execute_stmt<R: BufRead, W: Write>(
    stmt: &ExecStmt,
    ctx: &mut Context,
    input: &mut R,
    output: &mut W,
) -> Result<ControlFlow> {
    match stmt {
        ExecStmt::Print { text, .. } => {
            writeln!(output, "{}", interpolate_text(text, ctx))?;
            output.flush()?;
            Ok(ControlFlow::Continue)
        }
        ExecStmt::ReadInput { var_name, .. } => {
            let mut buffer = String::new();
            let bytes = input.read_line(&mut buffer)?;
            if bytes == 0 {
                bail!("stdio input ended unexpectedly while reading `{}`", var_name);
            }
            let value = buffer.trim_end_matches(['\r', '\n']).to_string();
            ctx.insert(var_name.clone(), JsonValue::String(value));
            Ok(ControlFlow::Continue)
        }
        ExecStmt::Set { var_name, value, .. } => {
            let resolved = interpolate_text(value, ctx);
            let json_val = if let Ok(n) = resolved.parse::<i64>() {
                JsonValue::Number(n.into())
            } else if let Ok(f) = resolved.parse::<f64>() {
                JsonValue::Number(serde_json::Number::from_f64(f).unwrap_or(0.into()))
            } else if resolved == "true" {
                JsonValue::Bool(true)
            } else if resolved == "false" {
                JsonValue::Bool(false)
            } else {
                JsonValue::String(resolved)
            };
            ctx.insert(var_name.clone(), json_val);
            Ok(ControlFlow::Continue)
        }
        ExecStmt::IfChain {
            branches,
            else_body,
            ..
        } => {
            for branch in branches {
                if eval_condition(ctx, &branch.condition, None) {
                    return execute_block(branch.body.as_slice(), ctx, input, output);
                }
            }
            execute_block(else_body.as_slice(), ctx, input, output)
        }
        ExecStmt::RepeatLine { target_line, .. } => Ok(ControlFlow::RepeatLine(*target_line)),
        ExecStmt::While {
            condition, body, ..
        } => {
            let mut loop_steps = 0usize;
            let max_loop_steps = 10_000usize;
            while eval_condition(ctx, condition, None) {
                loop_steps += 1;
                if loop_steps > max_loop_steps {
                    bail!("while loop exceeded {} iterations", max_loop_steps);
                }
                match execute_block(body.as_slice(), ctx, input, output)? {
                    ControlFlow::Continue => {}
                    flow => return Ok(flow),
                }
            }
            Ok(ControlFlow::Continue)
        }
        ExecStmt::Stop { message, .. } => Ok(ControlFlow::Stop(message.clone())),
        ExecStmt::Builtin {
            name,
            args,
            assign_to,
            ..
        } => {
            // For now, handle builtins with simple inline implementations
            // In the future, these could call the real async builtins via a runtime bridge
            match name.as_str() {
                "log" => {
                    let message = if args.is_empty() {
                        String::new()
                    } else {
                        interpolate_text(&args.join(" "), ctx)
                    };
                    writeln!(output, "{}", message)?;
                    output.flush()?;
                    if let Some(var) = assign_to {
                        ctx.insert(var.clone(), JsonValue::String(message));
                    }
                    Ok(ControlFlow::Continue)
                }
                "parse-json" => {
                    let source_var = if args.is_empty() { "body" } else { &args[0] };
                    let target_var = assign_to.as_deref().unwrap_or(source_var);
                    if let Some(JsonValue::String(json_str)) = ctx.get(source_var) {
                        match serde_json::from_str::<JsonValue>(json_str) {
                            Ok(parsed) => {
                                ctx.insert(target_var.to_string(), parsed);
                                Ok(ControlFlow::Continue)
                            }
                            Err(e) => {
                                let err_msg = format!("parse-json error: {}", e);
                                writeln!(output, "[ERROR] {}", err_msg)?;
                                output.flush()?;
                                bail!(err_msg)
                            }
                        }
                    } else {
                        bail!("parse-json: source variable `{}` not found or not a string", source_var)
                    }
                }
                "is-set" => {
                    let var_name = if args.is_empty() {
                        bail!("is-set: missing variable name")
                    } else {
                        &args[0]
                    };
                    let target_var = assign_to.as_deref().unwrap_or("___result___");
                    let exists = ctx.get(var_name).is_some();
                    ctx.insert(target_var.to_string(), JsonValue::Bool(exists));
                    Ok(ControlFlow::Continue)
                }
                "delete" => {
                    if args.is_empty() {
                        bail!("delete: missing variable name")
                    }
                    ctx.remove(&args[0]);
                    Ok(ControlFlow::Continue)
                }
                other => {
                    bail!("builtin `{}` not yet implemented in .vect standalone execution", other)
                }
            }
        }
        ExecStmt::CollectWeightTimeline {
            birth_year_var,
            target_var,
            ..
        } => {
            collect_weight_timeline(ctx, input, output, birth_year_var, target_var)?;
            Ok(ControlFlow::Continue)
        }
        ExecStmt::RenderWeightGraph {
            series_var, title, ..
        } => {
            render_weight_graph(ctx, output, series_var, title)?;
            Ok(ControlFlow::Continue)
        }
    }
}

fn execute_block<R: BufRead, W: Write>(
    statements: &[ExecStmt],
    ctx: &mut Context,
    input: &mut R,
    output: &mut W,
) -> Result<ControlFlow> {
    for stmt in statements {
        let flow = execute_stmt(stmt, ctx, input, output)?;
        if flow != ControlFlow::Continue {
            return Ok(flow);
        }
    }
    Ok(ControlFlow::Continue)
}

fn collect_weight_timeline<R: BufRead, W: Write>(
    ctx: &mut Context,
    input: &mut R,
    output: &mut W,
    birth_year_var: &str,
    target_var: &str,
) -> Result<()> {
    let birth_year = ctx
        .get(birth_year_var)
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<i64>().ok())
        .ok_or_else(|| anyhow!("birth year variable `{}` must be a numeric string", birth_year_var))?;

    writeln!(output, "Enter weight data points as age=weight. Press Enter on a blank line when you're done.")?;
    output.flush()?;

    let mut points = Vec::new();
    loop {
        writeln!(output, "Data point:")?;
        output.flush()?;
        let mut buffer = String::new();
        let bytes = input.read_line(&mut buffer)?;
        if bytes == 0 {
            break;
        }

        let line = buffer.trim();
        if line.is_empty() || line.eq_ignore_ascii_case("done") {
            break;
        }

        let (age_raw, weight_raw) = line
            .split_once('=')
            .or_else(|| line.split_once(','))
            .ok_or_else(|| anyhow!("expected weight point in age=weight or age,weight format"))?;

        let age = age_raw.trim().parse::<i64>()?;
        let weight = weight_raw.trim().parse::<f64>()?;
        points.push(json!({
            "age": age,
            "year": birth_year + age,
            "weight": weight
        }));
    }

    ctx.insert(target_var.to_string(), JsonValue::Array(points));
    Ok(())
}

fn render_weight_graph<W: Write>(
    ctx: &Context,
    output: &mut W,
    series_var: &str,
    title: &str,
) -> Result<()> {
    let title = interpolate_text(title, ctx);
    writeln!(output, "{}", title)?;
    writeln!(output, "{}", "-".repeat(title.len().max(12)))?;

    let series = ctx
        .get(series_var)
        .and_then(|v| v.as_array())
        .ok_or_else(|| anyhow!("weight series variable `{}` must be an array", series_var))?;

    if series.is_empty() {
        writeln!(output, "No weight data to graph.")?;
        return Ok(());
    }

    let max_weight = series
        .iter()
        .filter_map(|point| point.get("weight").and_then(|v| v.as_f64()))
        .fold(0.0f64, f64::max);

    for point in series {
        let age = point.get("age").and_then(|v| v.as_i64()).unwrap_or_default();
        let year = point.get("year").and_then(|v| v.as_i64()).unwrap_or_default();
        let weight = point.get("weight").and_then(|v| v.as_f64()).unwrap_or_default();
        let bar_len = if max_weight <= 0.0 {
            0usize
        } else {
            ((weight / max_weight) * 30.0).round().max(1.0) as usize
        };
        writeln!(
            output,
            "Age {:>3} ({}) | {} {:.1}",
            age,
            year,
            "#".repeat(bar_len),
            weight
        )?;
    }

    Ok(())
}

fn find_statement_index_for_line(statements: &[ExecStmt], target_line: usize) -> Option<usize> {
    statements
        .iter()
        .position(|stmt| stmt_line_no(stmt) >= target_line)
}

fn stmt_line_no(stmt: &ExecStmt) -> usize {
    match stmt {
        ExecStmt::Print { line_no, .. }
        | ExecStmt::ReadInput { line_no, .. }
        | ExecStmt::Set { line_no, .. }
        | ExecStmt::Builtin { line_no, .. }
        | ExecStmt::RepeatLine { line_no, .. }
        | ExecStmt::While { line_no, .. }
        | ExecStmt::Stop { line_no, .. }
        | ExecStmt::IfChain { line_no, .. }
        | ExecStmt::CollectWeightTimeline { line_no, .. }
        | ExecStmt::RenderWeightGraph { line_no, .. } => *line_no,
    }
}

fn interpolate_text(template: &str, ctx: &Context) -> String {
    let mut output = String::new();
    let mut chars = template.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch != '{' {
            output.push(ch);
            continue;
        }

        let mut expr = String::new();
        let mut closed = false;
        for next in chars.by_ref() {
            if next == '}' {
                closed = true;
                break;
            }
            expr.push(next);
        }

        if !closed {
            output.push('{');
            output.push_str(&expr);
            break;
        }

        let expr = expr.trim();
        if expr.is_empty() {
            output.push_str("{}");
            continue;
        }

        if let Some(value) = resolve_path(ctx, expr, None) {
            output.push_str(&json_value_to_string(&value));
        } else {
            output.push('{');
            output.push_str(expr);
            output.push('}');
        }
    }

    output
}

fn json_value_to_string(value: &JsonValue) -> String {
    match value {
        JsonValue::Null => String::new(),
        JsonValue::Bool(v) => v.to_string(),
        JsonValue::Number(v) => v.to_string(),
        JsonValue::String(v) => v.clone(),
        JsonValue::Array(_) | JsonValue::Object(_) => serde_json::to_string(value).unwrap_or_default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::execution::ir::{ExecBranch, ExecStmt};
    use std::io::Cursor;

    #[test]
    fn interpolates_print_output_from_context_variables() {
        let program = ExecProgram {
            statements: vec![
                ExecStmt::ReadInput {
                    line_no: 1,
                    var_name: "choice".to_string(),
                },
                ExecStmt::Print {
                    line_no: 2,
                    text: "You chose {choice}.".to_string(),
                },
            ],
        };
        let mut input = Cursor::new("2\n");
        let mut output = Vec::new();
        run_program_with_io(&program, &mut input, &mut output).expect("run program");
        let output = String::from_utf8(output).expect("utf8 output");
        assert!(output.contains("You chose 2."));
    }

    #[test]
    fn supports_repeat_line_control_flow() {
        let program = ExecProgram {
            statements: vec![
                ExecStmt::Print {
                    line_no: 1,
                    text: "Choose".to_string(),
                },
                ExecStmt::ReadInput {
                    line_no: 2,
                    var_name: "choice".to_string(),
                },
                ExecStmt::IfChain {
                    line_no: 3,
                    branches: vec![ExecBranch {
                        condition: "choice == \"1\"".to_string(),
                        body: vec![ExecStmt::Print {
                            line_no: 4,
                            text: "Village".to_string(),
                        }],
                    }],
                    else_body: vec![
                        ExecStmt::Print {
                            line_no: 5,
                            text: "Invalid".to_string(),
                        },
                        ExecStmt::RepeatLine {
                            line_no: 6,
                            target_line: 2,
                        },
                    ],
                },
            ],
        };

        let mut input = Cursor::new("9\n1\n");
        let mut output = Vec::new();
        run_program_with_io(&program, &mut input, &mut output).expect("run program");
        let output = String::from_utf8(output).expect("utf8 output");
        assert!(output.contains("Choose"));
        assert!(output.contains("Invalid"));
        assert!(output.contains("Village"));
    }
}



