use crate::execution::{run_program_with_io as run_exec_program_with_io, ExecBranch, ExecProgram, ExecStmt};
use crate::builtins::is_builtin;
use anyhow::{anyhow, bail, Context as AnyhowContext, Result};
use std::fs;
use std::io::{BufRead, Write};
use std::path::Path;

#[derive(Debug, Clone, PartialEq)]
pub enum VectStmt {
    Print { line_no: usize, text: String },
    ReadStdio { line_no: usize, var_name: String },
    /// `set <var> = <value>` — assign a literal or interpolated value.
    Set { line_no: usize, var_name: String, value: String },
    IfChain {
        line_no: usize,
        branches: Vec<VectBranch>,
        else_body: Vec<VectStmt>,
    },
    /// `while <cond>:` loop.
    While {
        line_no: usize,
        condition: String,
        body: Vec<VectStmt>,
    },
    /// Direct builtin invocation: `log "message"` or `parse-json body as var`
    Builtin {
        line_no: usize,
        name: String,
        args: Vec<String>,
        assign_to: Option<String>,
    },
    Repeat { line_no: usize, target_line: usize },
    /// `stop` or `stop "message"` — terminate execution.
    Stop { line_no: usize, message: Option<String> },
}

#[derive(Debug, Clone, PartialEq)]
pub struct VectBranch {
    pub condition: String,
    pub body: Vec<VectStmt>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VectProgram {
    pub statements: Vec<VectStmt>,
}

#[derive(Debug, Clone, PartialEq)]
struct SourceLine {
    line_no: usize,
    indent: usize,
    content: String,
}

pub fn handle_vect_file(path: &Path) -> Result<()> {
    let source = fs::read_to_string(path)
        .with_context(|| format!("failed to read vect file {}", path.display()))?;
    let program = parse_program(&source)?;
    let stdin = std::io::stdin();
    let stdout = std::io::stdout();
    let mut input = stdin.lock();
    let mut output = stdout.lock();
    run_program_with_io(&program, &mut input, &mut output)
}

pub fn parse_program(source: &str) -> Result<VectProgram> {
    let lines = collect_source_lines(source);
    let mut index = 0usize;
    let statements = parse_block(&lines, &mut index, 0, false)?;
    Ok(VectProgram { statements })
}

pub fn run_program_with_io<R: BufRead, W: Write>(
    program: &VectProgram,
    input: &mut R,
    output: &mut W,
) -> Result<()> {
    let exec_program = lower_program(program);
    run_exec_program_with_io(&exec_program, input, output)
}

pub fn lower_program(program: &VectProgram) -> ExecProgram {
    ExecProgram {
        statements: lower_block(&program.statements),
    }
}

fn lower_block(statements: &[VectStmt]) -> Vec<ExecStmt> {
    statements.iter().map(lower_stmt).collect()
}

fn lower_stmt(stmt: &VectStmt) -> ExecStmt {
    match stmt {
        VectStmt::Print { line_no, text } => ExecStmt::Print {
            line_no: *line_no,
            text: text.clone(),
        },
        VectStmt::ReadStdio { line_no, var_name } => ExecStmt::ReadInput {
            line_no: *line_no,
            var_name: var_name.clone(),
        },
        VectStmt::Set { line_no, var_name, value } => ExecStmt::Set {
            line_no: *line_no,
            var_name: var_name.clone(),
            value: value.clone(),
        },
        VectStmt::Builtin {
            line_no,
            name,
            args,
            assign_to,
        } => ExecStmt::Builtin {
            line_no: *line_no,
            name: name.clone(),
            args: args.clone(),
            assign_to: assign_to.clone(),
        },
        VectStmt::IfChain {
            line_no,
            branches,
            else_body,
        } => ExecStmt::IfChain {
            line_no: *line_no,
            branches: branches
                .iter()
                .map(|branch| ExecBranch {
                    condition: branch.condition.clone(),
                    body: lower_block(&branch.body),
                })
                .collect(),
            else_body: lower_block(else_body),
        },
        VectStmt::While { line_no, condition, body } => ExecStmt::While {
            line_no: *line_no,
            condition: condition.clone(),
            body: lower_block(body),
        },
        VectStmt::Repeat { line_no, target_line } => ExecStmt::RepeatLine {
            line_no: *line_no,
            target_line: *target_line,
        },
        VectStmt::Stop { line_no, message } => ExecStmt::Stop {
            line_no: *line_no,
            message: message.clone(),
        },
    }
}

fn collect_source_lines(source: &str) -> Vec<SourceLine> {
    source
        .lines()
        .enumerate()
        .filter_map(|(idx, raw)| {
            let trimmed_end = raw.trim_end();
            let trimmed = trimmed_end.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                return None;
            }
            Some(SourceLine {
                line_no: idx + 1,
                indent: raw.chars().take_while(|c| c.is_whitespace()).count(),
                content: trimmed.to_string(),
            })
        })
        .collect()
}

fn parse_block(
    lines: &[SourceLine],
    index: &mut usize,
    base_indent: usize,
    stop_on_else: bool,
) -> Result<Vec<VectStmt>> {
    let mut statements = Vec::new();

    while *index < lines.len() {
        let line = &lines[*index];
        if line.indent < base_indent {
            break;
        }
        if line.indent > base_indent {
            bail!(
                "unexpected indentation on line {}: `{}`",
                line.line_no,
                line.content
            );
        }
        if stop_on_else && (line.content.starts_with("else if ") || line.content == "else:") {
            break;
        }

        if let Some(stmt) = parse_stdio_write(line)? {
            statements.push(stmt);
            *index += 1;
            continue;
        }
        if let Some(stmt) = parse_stdio_read(line)? {
            statements.push(stmt);
            *index += 1;
            continue;
        }
        if let Some(stmt) = parse_set(line)? {
            statements.push(stmt);
            *index += 1;
            continue;
        }
        // Check if this line is a builtin invocation
        if let Some(stmt) = parse_builtin(line)? {
            statements.push(stmt);
            *index += 1;
            continue;
        }
        if line.content.starts_with("if ") {
            let stmt = parse_if_chain(lines, index, base_indent)?;
            statements.push(stmt);
            continue;
        }
        if line.content.starts_with("while ") {
            let stmt = parse_while(lines, index, base_indent)?;
            statements.push(stmt);
            continue;
        }
        if let Some(stmt) = parse_repeat(line)? {
            statements.push(stmt);
            *index += 1;
            continue;
        }
        if let Some(stmt) = parse_stop(line)? {
            statements.push(stmt);
            *index += 1;
            continue;
        }

        bail!("unsupported .vect syntax on line {}: `{}`", line.line_no, line.content);
    }

    Ok(statements)
}

fn parse_stdio_write(line: &SourceLine) -> Result<Option<VectStmt>> {
    if let Some(rest) = line.content.strip_prefix("stdio -> ") {
        return Ok(Some(VectStmt::Print {
            line_no: line.line_no,
            text: parse_quoted_string(rest, line.line_no)?,
        }));
    }
    if let Some(rest) = line.content.strip_prefix(".. ") {
        return Ok(Some(VectStmt::Print {
            line_no: line.line_no,
            text: parse_quoted_string(rest, line.line_no)?,
        }));
    }
    Ok(None)
}

fn parse_stdio_read(line: &SourceLine) -> Result<Option<VectStmt>> {
    if let Some((var_name, rhs)) = line.content.split_once("<-") {
        if rhs.trim() == "stdio" {
            let var_name = var_name.trim();
            if var_name.is_empty() {
                bail!("missing assignment target for stdio read on line {}", line.line_no);
            }
            return Ok(Some(VectStmt::ReadStdio {
                line_no: line.line_no,
                var_name: var_name.to_string(),
            }));
        }
    }
    Ok(None)
}

fn parse_repeat(line: &SourceLine) -> Result<Option<VectStmt>> {
    if let Some(rest) = line.content.strip_prefix("repeat from line ") {
        let target_line = rest
            .trim()
            .parse::<usize>()
            .with_context(|| format!("invalid repeat target on line {}", line.line_no))?;
        return Ok(Some(VectStmt::Repeat {
            line_no: line.line_no,
            target_line,
        }));
    }
    Ok(None)
}

fn parse_if_chain(lines: &[SourceLine], index: &mut usize, base_indent: usize) -> Result<VectStmt> {
    let first = &lines[*index];
    let (condition, body) = parse_if_or_else_if_branch(lines, index, base_indent, "if ")?;
    let mut branches = vec![VectBranch { condition, body }];
    let mut else_body = Vec::new();

    while *index < lines.len() {
        let line = &lines[*index];
        if line.indent != base_indent {
            break;
        }
        if line.content.starts_with("else if ") {
            let (condition, body) = parse_if_or_else_if_branch(lines, index, base_indent, "else if ")?;
            branches.push(VectBranch { condition, body });
            continue;
        }
        if line.content == "else:" {
            *index += 1;
            else_body = parse_expected_indented_block(lines, index, base_indent, true, line.line_no)?;
            break;
        }
        break;
    }

    Ok(VectStmt::IfChain {
        line_no: first.line_no,
        branches,
        else_body,
    })
}

fn parse_if_or_else_if_branch(
    lines: &[SourceLine],
    index: &mut usize,
    base_indent: usize,
    prefix: &str,
) -> Result<(String, Vec<VectStmt>)> {
    let line = &lines[*index];
    let condition = line
        .content
        .strip_prefix(prefix)
        .and_then(|rest| rest.strip_suffix(':'))
        .map(str::trim)
        .filter(|cond| !cond.is_empty())
        .ok_or_else(|| anyhow!("invalid conditional syntax on line {}", line.line_no))?
        .to_string();
    *index += 1;
    let body = parse_expected_indented_block(lines, index, base_indent, true, line.line_no)?;
    Ok((condition, body))
}

fn parse_expected_indented_block(
    lines: &[SourceLine],
    index: &mut usize,
    parent_indent: usize,
    stop_on_else: bool,
    line_no: usize,
) -> Result<Vec<VectStmt>> {
    let next = lines
        .get(*index)
        .ok_or_else(|| anyhow!("expected indented block after line {}", line_no))?;
    if next.indent <= parent_indent {
        bail!("expected indented block after line {}", line_no);
    }
    let child_indent = next.indent;
    parse_block(lines, index, child_indent, stop_on_else)
}

fn parse_set(line: &SourceLine) -> Result<Option<VectStmt>> {
    if let Some(rest) = line.content.strip_prefix("set ") {
        let (var_part, val_part) = rest
            .split_once('=')
            .ok_or_else(|| anyhow::anyhow!("expected `set <var> = <value>` on line {}", line.line_no))?;
        let var_name = var_part.trim().to_string();
        if var_name.is_empty() {
            anyhow::bail!("missing variable name in `set` on line {}", line.line_no);
        }
        let value = val_part.trim().to_string();
        // If the value is quoted, strip the quotes; otherwise keep as-is.
        let value = if value.starts_with('"') && value.ends_with('"') && value.len() >= 2 {
            decode_escapes(&value[1..value.len() - 1])
        } else {
            value
        };
        return Ok(Some(VectStmt::Set {
            line_no: line.line_no,
            var_name,
            value,
        }));
    }
    Ok(None)
}

#[derive(Debug, PartialEq)]
enum VectToken {
    Unquoted(String),
    Quoted(String),
}

fn tokenize_args(input: &str) -> Vec<VectToken> {
    let mut tokens = Vec::new();
    let mut chars = input.chars().peekable();

    while let Some(&ch) = chars.peek() {
        if ch.is_whitespace() {
            chars.next();
            continue;
        }

        if ch == '"' {
            chars.next(); // consume opening quote
            let mut inner = String::new();
            while let Some(c) = chars.next() {
                if c == '"' {
                    break;
                }
                if c == '\\' {
                    inner.push('\\');
                    if let Some(next) = chars.next() {
                        inner.push(next);
                    }
                } else {
                    inner.push(c);
                }
            }
            tokens.push(VectToken::Quoted(decode_escapes(&inner)));
        } else {
            let mut token = String::new();
            while let Some(&c) = chars.peek() {
                if c.is_whitespace() {
                    break;
                }
                token.push(chars.next().unwrap());
            }
            tokens.push(VectToken::Unquoted(token));
        }
    }
    tokens
}

fn parse_builtin(line: &SourceLine) -> Result<Option<VectStmt>> {
    let tokens = tokenize_args(&line.content);
    if tokens.is_empty() {
        return Ok(None);
    }

    let name = match &tokens[0] {
        VectToken::Unquoted(n) => n,
        VectToken::Quoted(_) => return Ok(None),
    };

    if !is_builtin(name) {
        return Ok(None);
    }

    let mut args = Vec::new();
    let mut assign_to = None;
    let mut i = 1;
    while i < tokens.len() {
        match &tokens[i] {
            VectToken::Unquoted(s) if s == "as" => {
                if i + 1 < tokens.len() {
                    match &tokens[i + 1] {
                        VectToken::Unquoted(var) | VectToken::Quoted(var) => {
                            assign_to = Some(var.clone());
                            break;
                        }
                    }
                } else {
                    anyhow::bail!(
                        "{}: missing variable name after 'as' on line {}",
                        name,
                        line.line_no
                    );
                }
            }
            VectToken::Unquoted(s) | VectToken::Quoted(s) => {
                args.push(s.clone());
            }
        }
        i += 1;
    }

    Ok(Some(VectStmt::Builtin {
        line_no: line.line_no,
        name: name.to_string(),
        args,
        assign_to,
    }))
}

fn parse_while(
    lines: &[SourceLine],
    index: &mut usize,
    base_indent: usize,
) -> Result<VectStmt> {
    let line = &lines[*index];
    let condition = line
        .content
        .strip_prefix("while ")
        .and_then(|rest| rest.strip_suffix(':'))
        .map(str::trim)
        .filter(|cond| !cond.is_empty())
        .ok_or_else(|| anyhow::anyhow!("invalid while syntax on line {}", line.line_no))?
        .to_string();
    let line_no = line.line_no;
    *index += 1;
    let body = parse_expected_indented_block(lines, index, base_indent, false, line_no)?;
    Ok(VectStmt::While {
        line_no,
        condition,
        body,
    })
}

fn parse_stop(line: &SourceLine) -> Result<Option<VectStmt>> {
    if line.content == "stop" {
        return Ok(Some(VectStmt::Stop {
            line_no: line.line_no,
            message: None,
        }));
    }
    if let Some(rest) = line.content.strip_prefix("stop ") {
        let message = if rest.trim().starts_with('"') {
            Some(parse_quoted_string(rest, line.line_no)?)
        } else {
            Some(rest.trim().to_string())
        };
        return Ok(Some(VectStmt::Stop {
            line_no: line.line_no,
            message,
        }));
    }
    Ok(None)
}

fn parse_quoted_string(raw: &str, line_no: usize) -> Result<String> {
    let trimmed = raw.trim();
    if !(trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2) {
        bail!("expected quoted string on line {}", line_no);
    }
    let inner = &trimmed[1..trimmed.len() - 1];
    Ok(decode_escapes(inner))
}

fn decode_escapes(input: &str) -> String {
    let mut output = String::new();
    let mut chars = input.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            if let Some(next) = chars.next() {
                match next {
                    'n' => output.push('\n'),
                    'r' => output.push('\r'),
                    't' => output.push('\t'),
                    '"' => output.push('"'),
                    '\'' => output.push('\''),
                    '\\' => output.push('\\'),
                    other => output.push(other),
                }
            } else {
                output.push('\\');
            }
        } else {
            output.push(ch);
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn parses_if_else_and_repeat_blocks() {
        let source = r#"
stdio -> "Hi"
choice <- stdio
if choice == "1":
    stdio -> "One"
else if choice == "2":
    stdio -> "Two"
else:
    stdio -> "Invalid"
    repeat from line 2
"#;

        let program = parse_program(source).expect("parse program");
        assert_eq!(program.statements.len(), 3);
        match &program.statements[2] {
            VectStmt::IfChain { branches, else_body, .. } => {
                assert_eq!(branches.len(), 2);
                assert_eq!(branches[0].condition, "choice == \"1\"");
                assert_eq!(branches[1].condition, "choice == \"2\"");
                assert!(matches!(else_body.last(), Some(VectStmt::Repeat { target_line: 2, .. })));
            }
            other => panic!("expected if chain, got {other:?}"),
        }
    }

    #[test]
    fn runs_repeat_until_valid_input() {
        let source = r#"
stdio -> "Choose"
choice <- stdio
if choice == "1":
    stdio -> "Village"
else:
    stdio -> "Invalid"
    repeat from line 2
"#;
        let program = parse_program(source).expect("parse program");
        let mut input = Cursor::new("9\n1\n");
        let mut output = Vec::new();
        run_program_with_io(&program, &mut input, &mut output).expect("run program");
        let output = String::from_utf8(output).expect("utf8 output");
        assert!(output.contains("Choose"));
        assert!(output.contains("Invalid"));
        assert!(output.contains("Village"));
    }

    #[test]
    fn lowers_to_shared_exec_program() {
        let source = r#"
stdio -> "Choose"
choice <- stdio
stdio -> "You chose {choice}."
"#;
        let program = parse_program(source).expect("parse program");
        let exec = lower_program(&program);
        assert!(matches!(exec.statements[0], ExecStmt::Print { .. }));
        assert!(matches!(exec.statements[1], ExecStmt::ReadInput { .. }));
        assert!(matches!(exec.statements[2], ExecStmt::Print { .. }));
    }

    #[test]
    fn parses_set_statement() {
        let source = r#"
set count = 0
set greeting = "Hello"
"#;
        let program = parse_program(source).expect("parse program");
        assert_eq!(program.statements.len(), 2);
        match &program.statements[0] {
            VectStmt::Set { var_name, value, .. } => {
                assert_eq!(var_name, "count");
                assert_eq!(value, "0");
            }
            other => panic!("expected Set, got {other:?}"),
        }
        match &program.statements[1] {
            VectStmt::Set { var_name, value, .. } => {
                assert_eq!(var_name, "greeting");
                assert_eq!(value, "Hello");
            }
            other => panic!("expected Set, got {other:?}"),
        }
    }

    #[test]
    fn parses_while_loop() {
        let source = r#"
set x = 0
while x < 3:
    stdio -> "tick"
"#;
        let program = parse_program(source).expect("parse program");
        assert_eq!(program.statements.len(), 2);
        match &program.statements[1] {
            VectStmt::While { condition, body, .. } => {
                assert_eq!(condition, "x < 3");
                assert_eq!(body.len(), 1);
            }
            other => panic!("expected While, got {other:?}"),
        }
    }

    #[test]
    fn parses_stop_statement() {
        let source = r#"
stop "Bye!"
"#;
        let program = parse_program(source).expect("parse program");
        match &program.statements[0] {
            VectStmt::Stop { message, .. } => {
                assert_eq!(message.as_deref(), Some("Bye!"));
            }
            other => panic!("expected Stop, got {other:?}"),
        }
    }

    #[test]
    fn stop_terminates_before_subsequent_output() {
        let source = r#"
stdio -> "Before stop"
stop "Stopped."
stdio -> "After stop"
"#;
        let program = parse_program(source).expect("parse program");
        let mut input = Cursor::new("");
        let mut output = Vec::new();
        run_program_with_io(&program, &mut input, &mut output).expect("run program");
        let out = String::from_utf8(output).expect("utf8");
        assert!(out.contains("Before stop"));
        assert!(out.contains("Stopped."));
        assert!(!out.contains("After stop"));
    }

    #[test]
    fn parses_call_builtin_statement() {
        let source = r#"log "Test message""#;
        let program = parse_program(source).expect("parse program");
        assert_eq!(program.statements.len(), 1);
        match &program.statements[0] {
            VectStmt::Builtin {
                name,
                args,
                assign_to,
                ..
            } => {
                assert_eq!(name, "log");
                assert_eq!(args.len(), 1);
                assert_eq!(args[0], "Test message");
                assert_eq!(assign_to, &None);
            }
            other => panic!("expected Builtin, got {other:?}"),
        }
    }

    #[test]
    fn parses_builtin_with_assignment() {
        let source = r#"
set body = "{\"result\":true}"
parse-json body as parsed
"#;
        let program = parse_program(source).expect("parse program");
        assert_eq!(program.statements.len(), 2);
        match &program.statements[1] {
            VectStmt::Builtin {
                name,
                args,
                assign_to,
                ..
            } => {
                assert_eq!(name, "parse-json");
                assert_eq!(args.len(), 1);
                assert_eq!(args[0], "body");
                assert_eq!(assign_to, &Some("parsed".to_string()));
            }
            other => panic!("expected Builtin, got {other:?}"),
        }
    }

    #[test]
    fn executes_log_builtin() {
        let source = r#"
log "Hello from builtin"
"#;
        let program = parse_program(source).expect("parse program");
        let mut input = Cursor::new("");
        let mut output = Vec::new();
        run_program_with_io(&program, &mut input, &mut output).expect("run program");
        let out = String::from_utf8(output).expect("utf8");
        assert!(out.contains("Hello from builtin"));
    }

    #[test]
    fn executes_parse_json_builtin() {
        let source = r#"
set body = "{\"success\":true,\"value\":42}"
parse-json body as result
stdio -> "Parsed: {result.success}"
"#;
        let program = parse_program(source).expect("parse program");
        let mut input = Cursor::new("");
        let mut output = Vec::new();
        run_program_with_io(&program, &mut input, &mut output).expect("run program");
        let out = String::from_utf8(output).expect("utf8");
        assert!(out.contains("Parsed: true"));
    }
}
