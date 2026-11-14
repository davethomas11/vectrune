//! Read-only project diagnostics and entry points for developer commands.
use crate::rune_ast::RuneDocument;
use crate::rune_parser::{
    load_rune_test_document_from_path, load_rune_test_document_from_str_with_base,
};
use anyhow::{Context, Result};
use clap::{Arg, ArgAction, ArgMatches, Command};
use serde::Serialize;
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
};

pub fn commands() -> Vec<Command> {
    ["doctor", "check", "test", "fmt"].into_iter().map(|name| {
        let command = Command::new(name).about(match name {
            "doctor" => "Diagnose executable, project, and local port configuration",
            "check" => "Check Rune imports, routes, references, and frontend without running the app",
            "fmt" => "Format Rune documents while preserving views, styles, and embedded source",
            _ => "Run native and Rune-Web logic @Test sections without opening a port",
        }).arg(Arg::new("project").value_name("PATH").help(if name == "test" { "Rune entry file or project directory (default: current directory)" } else { "Rune entry file or project directory (default: app.rune, then current directory)" }))
          .arg(Arg::new("json").long("json").action(ArgAction::SetTrue).help("Emit a JSON report"));
        if name == "fmt" {
            command.arg(Arg::new("check").long("check").action(ArgAction::SetTrue).help("Fail if formatting changes are needed; do not write files"))
        } else if name == "check" {
            command.arg(Arg::new("deny-warnings").long("deny-warnings").action(ArgAction::SetTrue).help("Treat linter warnings as failures"))
        } else if name == "test" {
            command.arg(Arg::new("watch").long("watch").action(ArgAction::SetTrue).conflicts_with("list").help("Rerun tests after source and fixture changes; Ctrl-C exits"))
                .arg(Arg::new("type").long("type").default_value("all").value_parser(["native", "logic", "all"]).help("Select native HTTP tests, JavaScript logic tests, or both"))
                .arg(Arg::new("filter").long("filter").value_name("NAME").help("Only run test names containing NAME"))
                .arg(Arg::new("list").long("list").action(ArgAction::SetTrue).help("List matching tests without running startup or test code"))
                .arg(Arg::new("timeout").long("timeout").default_value("10").value_parser(clap::value_parser!(u64).range(1..)).help("Timeout in seconds per test, including application startup"))
        } else { command }
    }).collect()
}

pub fn project_path(args: &ArgMatches) -> PathBuf {
    args.get_one::<String>("project")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            if Path::new("app.rune").is_file() {
                "app.rune".into()
            } else {
                ".".into()
            }
        })
}

/// A directory is one Rune project, with the same import de-duplication as an entry file.
/// Exclude generated/dependency trees, and never follow directory symlinks.
pub fn load_project(path: &Path) -> Result<RuneDocument> {
    if !path.is_dir() {
        return Ok(load_rune_test_document_from_path(path)?);
    }
    let base = path.canonicalize()?;
    let files = discover_files(path)?;
    let imports = files
        .iter()
        .map(|file| format!("import \"{}\"\n", file.display()))
        .collect::<String>();
    Ok(load_rune_test_document_from_str_with_base(
        &imports,
        &base,
        "<project discovery>",
    )?)
}

pub fn discover_files(path: &Path) -> Result<Vec<PathBuf>> {
    if !path.is_dir() {
        return Ok(vec![if !path.exists() && path.extension().is_none() {
            path.with_extension("rune")
        } else {
            path.to_path_buf()
        }]);
    }
    let base = path.canonicalize()?;
    let mut files = Vec::new();
    for entry in walkdir::WalkDir::new(&base)
        .into_iter()
        .filter_entry(|entry| {
            entry.depth() == 0
                || !entry.file_type().is_dir()
                || !matches!(
                    entry.file_name().to_str(),
                    Some("target" | "node_modules" | ".git" | ".venv" | "_site" | "dist" | "build")
                )
        })
    {
        let entry = entry?;
        if entry.file_type().is_file()
            && entry.path().extension().and_then(|v| v.to_str()) == Some("rune")
        {
            files.push(entry.into_path());
        }
    }
    files.sort();
    anyhow::ensure!(
        !files.is_empty(),
        "No .rune files found in {}",
        path.display()
    );
    Ok(files)
}

pub fn project_files(path: &Path) -> Result<Vec<PathBuf>> {
    let mut files = std::collections::BTreeSet::new();
    for entry in discover_files(path)? {
        files.extend(crate::rune_parser::load_rune_test_source_paths(&entry)?);
    }
    Ok(files.into_iter().collect())
}

#[derive(Debug, Serialize)]
pub struct Diagnostic {
    pub severity: &'static str,
    pub code: &'static str,
    pub file: Option<String>,
    pub section: String,
    pub message: String,
    pub location: Option<super::diagnostics::SourceLocation>,
    pub suggestion: Option<String>,
}

pub fn check(doc: &RuneDocument) -> Vec<Diagnostic> {
    let mut diagnostics = Vec::new();
    let mut routes = HashSet::new();
    for section in &doc.sections {
        let kind = section.path.first().map(String::as_str).unwrap_or("");
        let mut report = |severity, code, message: String| {
            diagnostics.push(Diagnostic {
                severity,
                code,
                file: section.source_file.clone(),
                section: format!("@{}", section.path.join("/")),
                message,
                location: super::diagnostics::locate(
                    section.source_file.as_deref(),
                    &section.path.join("/"),
                    None,
                ),
                suggestion: None,
            })
        };
        if kind == "App" {
            if let Some(value) = section.kv.get("type").and_then(|v| v.as_str()) {
                if !["REST", "GRAPHQL", "STATIC", "DYNAMIC-AI-WEB", "PIXEL", "PIXEL-3D"]
                    .contains(&value.to_uppercase().as_str())
                {
                    report(
                        "error",
                        "app-type",
                        format!("Unsupported application type {value}"),
                    );
                }
            }
        }
        if kind == "Route" {
            for (key, target) in [("data_source", "DataSource"), ("schema", "Schema")] {
                if let Some(reference) = section.kv.get(key).and_then(|v| v.as_str()) {
                    let reference = reference.trim_start_matches('#');
                    if !doc.sections.iter().any(|s| s.path == [target, reference]) {
                        report(
                            "error",
                            "route-reference",
                            format!("Unknown @{target}/{reference}"),
                        );
                    }
                }
            }
            if section.path.len() < 3 {
                report("error", "route-path", "Expected @Route/METHOD /path".into());
            } else {
                let method = section.path[1].to_uppercase();
                if !["GET", "POST", "PUT", "DELETE", "CRUD"].contains(&method.as_str()) {
                    report(
                        "error",
                        "route-method",
                        format!("{method} is not supported by the native REST router"),
                    );
                }
                let path = section.path[2..].join("/");
                // Parameter names do not distinguish routes in Axum.
                let shape = path
                    .split('/')
                    .map(|part| if part.starts_with('{') { "{}" } else { part })
                    .collect::<Vec<_>>()
                    .join("/");
                let methods: &[&str] = if method == "CRUD" {
                    &["GET", "POST", "PUT", "DELETE"]
                } else {
                    &[&method]
                };
                for method in methods {
                    let shapes = if section.path[1].eq_ignore_ascii_case("CRUD") {
                        vec![shape.clone(), format!("{shape}/{{}}")]
                    } else {
                        vec![shape.clone()]
                    };
                    for shape in shapes {
                        if !routes.insert((method.to_string(), shape)) {
                            report(
                                "error",
                                "route-conflict",
                                format!("Conflicting {method} /{path} route"),
                            );
                        }
                    }
                }
                if path.contains(':') || path.split('/').any(|part| part.starts_with('*')) {
                    report(
                        "error",
                        "route-syntax",
                        "Use Axum path parameters {id} or {*path}".into(),
                    );
                }
            }
            if let Some(auth) = section.kv.get("auth").and_then(|v| v.as_str()) {
                if !doc
                    .sections
                    .iter()
                    .any(|s| s.path == ["Authentication", auth])
                {
                    report(
                        "error",
                        "auth-reference",
                        format!("Unknown @Authentication/{auth}"),
                    );
                }
            }
        }
        if matches!(kind, "Test" | "TestSuite" | "TestFixture") {
            let engine = super::testing::test_type(section);
            if section.kv.get("type").is_some_and(|v| v.as_str().is_none()) {
                report("error", "test-type", "Test type must be native or logic".into());
            } else if !matches!(engine, "native" | "logic") {
                report("error", "test-type", format!("Unsupported test type: {engine}; expected native or logic (browser tests are not implemented yet)"));
            }
        }
        if kind == "Test" && section.series.get("run").is_none_or(Vec::is_empty) {
            report(
                "error",
                "test-empty",
                "Test needs a non-empty run: block".into(),
            );
        }
        if kind == "Test" && (section.path.len() < 2 || section.path[1..].join("/").is_empty()) {
            report("error", "test-name", "Expected @Test/<name>".into());
        }
        if kind == "Test" {
            match super::testing::fixture_names(section) {
                Ok(names) => {
                    for name in names {
                        if !doc
                            .sections
                            .iter()
                            .any(|s| s.path == ["TestFixture", &name])
                        {
                            report(
                                "error",
                                "test-fixture",
                                format!("Unknown @TestFixture/{name}"),
                            );
                        }
                    }
                }
                Err(error) => report("error", "test-fixture", error.to_string()),
            }
        }
        if kind == "Schema" {
            for (field, value) in &section.kv {
                if !matches!(value.as_str(), Some("string" | "number" | "bool")) {
                    report("warning", "schema-type", format!("{field}: {value} is not a type supported by native validate (string, number, bool)"));
                }
            }
        }
        for steps in section.series.values() {
            check_steps(steps, doc, &mut report);
        }
    }
    if let Some(frontend) = doc.sections.iter().find(|s| {
        s.path.first().map(String::as_str) == Some("Frontend")
            && s.kv.get("type").and_then(|v| v.as_str()) == Some("rune-web")
    }) {
        let page = frontend
            .kv
            .get("page")
            .and_then(|v| v.as_str())
            .unwrap_or("index");
        if let Err(error) = crate::apps::rune_web::parser::parse_rune_web_frontend(doc, page) {
            diagnostics.push(Diagnostic {
                severity: "error",
                code: "frontend",
                file: frontend.source_file.clone(),
                section: "@Frontend".into(),
                message: error.to_string(),
                location: super::diagnostics::locate(
                    frontend.source_file.as_deref(),
                    "Frontend",
                    None,
                ),
                suggestion: None,
            });
        }
    }
    if crate::core::get_app_type(doc).is_some_and(|t| t.eq_ignore_ascii_case("pixel")) {
        if let Err(error) = crate::apps::pixel::compile(doc) {
            diagnostics.push(Diagnostic { severity: "error", code: "pixel", file: None, section: "@App".into(), message: error.to_string(), location: None, suggestion: None });
        }
    }
    if crate::core::get_app_type(doc).is_some_and(|t| t.eq_ignore_ascii_case("pixel-3d")) {
        if let Err(error) = crate::apps::pixel3d::compile(doc) {
            diagnostics.push(Diagnostic { severity: "error", code: "pixel-3d", file: None, section: "@App".into(), message: error.to_string(), location: None, suggestion: None });
        }
    }
    if !crate::core::get_app_type(doc).is_some_and(|t| t.eq_ignore_ascii_case("pixel") || t.eq_ignore_ascii_case("pixel-3d"))
        && doc.sections.iter().any(|s| s.path.first().map(String::as_str) == Some("Sprite")) {
        if let Err(error) = crate::apps::pixel::assets(doc) {
            diagnostics.push(Diagnostic { severity: "error", code: "pixel", file: None, section: "@Sprite".into(), message: error.to_string(), location: None, suggestion: None });
        }
    }
    diagnostics.extend(command_diagnostics(doc));
    for diagnostic in &mut diagnostics {
        if diagnostic.suggestion.is_none() {
            diagnostic.suggestion = match diagnostic.code {
                "schema-reference" | "route-reference" | "auth-reference" => Some(
                    "Declare or import the referenced section; names are case-sensitive".into(),
                ),
                "route-method" => {
                    Some("Use GET, POST, PUT, DELETE, or CRUD with the native REST router".into())
                }
                "schema-type" => Some("Use string, number, or bool with native validate".into()),
                _ => None,
            };
        }
    }
    diagnostics.sort_by(|a, b| {
        (&a.file, &a.section, a.code, &a.message).cmp(&(&b.file, &b.section, b.code, &b.message))
    });
    diagnostics
}

fn check_steps(
    steps: &[crate::rune_ast::Value],
    doc: &RuneDocument,
    report: &mut impl FnMut(&'static str, &'static str, String),
) {
    use crate::rune_ast::Value;
    for step in steps {
        match step {
            Value::String(line) => {
                let words: Vec<_> = line.split_whitespace().collect();
                // Only schema arguments to validate, never strings containing a hash.
                if words.first() == Some(&"validate") {
                    if let Some(schema) = words.get(2).and_then(|s| s.strip_prefix('#')) {
                        if !doc.sections.iter().any(|s| s.path == ["Schema", schema]) {
                            report(
                                "error",
                                "schema-reference",
                                format!("Unknown @Schema/{schema}"),
                            );
                        }
                    }
                }
            }
            Value::Map(map) => {
                for value in map.values() {
                    if let Value::List(nested) = value {
                        check_steps(nested, doc, report);
                    }
                }
            }
            _ => {}
        }
    }
}

pub async fn run(name: &str, args: &ArgMatches) -> Result<bool> {
    match dispatch(name, args).await {
        Ok(success) => Ok(success),
        Err(error) if args.get_flag("json") => {
            super::diagnostics::emit(
                serde_json::json!({"command":name,"success":false,"error":error.to_string()}),
            )?;
            Ok(false)
        }
        Err(error) => Err(error),
    }
}

async fn dispatch(name: &str, args: &ArgMatches) -> Result<bool> {
    let path = if name == "test" && args.get_one::<String>("project").is_none() {
        PathBuf::from(".")
    } else {
        project_path(args)
    };
    if name == "fmt" {
        return super::formatting::run(&path, args);
    }
    if name == "test" && args.get_flag("watch") {
        return super::test_watch::run(&path, args).await;
    }
    run_once(name, args, &path).await
}

pub async fn run_once(name: &str, args: &ArgMatches, path: &Path) -> Result<bool> {
    let json = args.get_flag("json");
    if name == "doctor" {
        return doctor(args, &path, json);
    }
    let doc = match load_project(&path) {
        Ok(doc) => doc,
        Err(error) => {
            let diagnostics = vec![Diagnostic {
                severity: "error",
                code: "load",
                file: Some(path.display().to_string()),
                section: String::new(),
                message: error.to_string(),
                location: None,
                suggestion: Some("Check the import path relative to the importing file".into()),
            }];
            print_check(name, &path, &diagnostics, json, false)?;
            return Ok(false);
        }
    };
    let diagnostics = check(&doc);
    if name == "check" || diagnostics.iter().any(|d| d.severity == "error") {
        let deny_warnings = name == "check" && args.get_flag("deny-warnings");
        return print_check(name, &path, &diagnostics, json, deny_warnings);
    }
    super::testing::run(&path, doc, args).await
}

fn print_check(
    command: &str,
    path: &Path,
    diagnostics: &[Diagnostic],
    json: bool,
    deny_warnings: bool,
) -> Result<bool> {
    let success = !diagnostics
        .iter()
        .any(|d| d.severity == "error" || deny_warnings && d.severity == "warning");
    if json {
        super::diagnostics::emit(
            serde_json::json!({"command":command, "path":path, "success":success, "diagnostics":diagnostics}),
        )?;
    } else {
        for d in diagnostics {
            if let Some(location) = &d.location {
                println!("{}", super::diagnostics::render(location));
            }
            println!(
                "{}[{}] {} {}: {}",
                d.severity,
                d.code,
                d.file.as_deref().unwrap_or(""),
                d.section,
                d.message
            );
            if let Some(suggestion) = &d.suggestion {
                println!("  help: {suggestion}");
            }
        }
        println!(
            "{} {} ({} diagnostics)",
            if success { "PASS" } else { "FAIL" },
            path.display(),
            diagnostics.len()
        );
    }
    Ok(success)
}

fn doctor(args: &ArgMatches, path: &Path, json: bool) -> Result<bool> {
    let executable = std::env::current_exe().context("locate running executable")?;
    let mut notes = Vec::new();
    let mut success = true;
    let mut project = None;
    // With no project argument, inspect only a conventional entry, not an entire home directory.
    if args.get_one::<String>("project").is_some() || Path::new("app.rune").is_file() {
        project = Some(path.display().to_string());
        match load_project(path) {
            Err(error) => {
                success = false;
                notes.push(format!("ERROR: {error}"));
            }
            Ok(doc) => {
                for d in check(&doc) {
                    success &= d.severity != "error";
                    notes.push(format!(
                        "{}[{}] {}: {}",
                        d.severity, d.code, d.section, d.message
                    ));
                }
                notes.push(format!(
                    "Loaded {} sections; imports resolved",
                    doc.sections.len()
                ));
                if let Some(port) = doc.get_section("App").and_then(|s| s.kv.get("port")) {
                    let value = port
                        .as_str()
                        .map(str::to_string)
                        .unwrap_or_else(|| port.to_string());
                    match value.parse::<u16>() {
                        Ok(port) => {
                            match std::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, port))
                            {
                                Ok(_) => notes.push(format!("Local port {port} is available")),
                                Err(error) if error.kind() == std::io::ErrorKind::AddrInUse => {
                                    notes.push(format!(
                                    "WARNING: Local port {port} is in use; use --port <free-port>"
                                ))
                                }
                                Err(error) => notes.push(format!(
                                    "WARNING: Could not probe local port {port}: {error}"
                                )),
                            }
                        }
                        Err(_) => {
                            success = false;
                            notes.push(format!("ERROR: Invalid @App port {value}"));
                        }
                    }
                }
            }
        }
    } else {
        notes.push(
            "No app.rune in current directory; pass a project path for project checks".into(),
        );
    }
    let path_executables: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths)
                .map(|p| {
                    p.join(if cfg!(windows) {
                        "vectrune.exe"
                    } else {
                        "vectrune"
                    })
                })
                .filter(|p| p.is_file())
                .collect()
        })
        .unwrap_or_default();
    if let Some(first) = path_executables.first() {
        if first.canonicalize().ok() != executable.canonicalize().ok() {
            notes.push(format!("WARNING: PATH selects {}; it differs from this executable. Check vectrune --version before building", first.display()));
        }
    }
    if json {
        super::diagnostics::emit(
            serde_json::json!({"command":"doctor", "version":env!("CARGO_PKG_VERSION"), "executable":executable, "platform":format!("{}-{}", std::env::consts::OS,std::env::consts::ARCH), "project":project,"path_executables":path_executables,"success":success,"notes":notes}),
        )?;
    } else {
        println!(
            "Vectrune {} · {}-{}\nExecutable: {}",
            env!("CARGO_PKG_VERSION"),
            std::env::consts::OS,
            std::env::consts::ARCH,
            executable.display()
        );
        for note in notes {
            println!("{note}");
        }
        println!(
            "{}",
            if success {
                "Doctor checks passed"
            } else {
                "Doctor found project errors"
            }
        );
    }
    Ok(success)
}

fn command_diagnostics(doc: &RuneDocument) -> Vec<Diagnostic> {
    fn strings<'a>(values: &'a [crate::rune_ast::Value], output: &mut Vec<&'a str>) {
        for value in values {
            match value {
                crate::rune_ast::Value::String(line) => output.push(line),
                crate::rune_ast::Value::Map(map) => {
                    for value in map.values() {
                        if let crate::rune_ast::Value::List(values) = value {
                            strings(values, output);
                        }
                    }
                }
                _ => {}
            }
        }
    }
    let mut known = HashSet::new();
    let mut lines = Vec::new();
    for section in &doc.sections {
        if !matches!(
            section.path.first().map(String::as_str),
            Some("App" | "Route" | "Test" | "TestSuite" | "TestFixture" | "GraphQL")
        ) {
            continue;
        }
        for values in section.series.values() {
            strings(values, &mut lines);
        }
    }
    for line in &lines {
        if let Some(index) = crate::core::find_assignment_equals(line) {
            let name = &line[..index];
            known.insert(name.trim().to_string());
        }
        if let Some(name) = line
            .strip_prefix("func ")
            .and_then(|s| s.split_whitespace().next())
        {
            known.insert(name.to_string());
        }
    }
    let candidates = [
        "respond",
        "parse-json",
        "validate",
        "log",
        "test-request",
        "assert",
        "set-memory",
        "get-memory",
        "clear-memory",
        "del-memory",
        "return",
        "append",
        "to-string",
        "to-number",
        "to-bool",
        "load-rune",
        "now",
        "func",
        "csv.read",
        "csv.write",
        "json.read",
    ];
    let mut diagnostics = Vec::new();
    for section in &doc.sections {
        if !matches!(
            section.path.first().map(String::as_str),
            Some("App" | "Route" | "Test" | "TestSuite" | "TestFixture" | "GraphQL")
        ) {
            continue;
        }
        if matches!(
            section.path.first().map(String::as_str),
            Some("Test" | "TestSuite" | "TestFixture")
        ) && super::testing::test_type(section) == "logic"
        {
            continue;
        }
        let mut lines = Vec::new();
        for values in section.series.values() {
            strings(values, &mut lines);
        }
        for line in lines {
            let command = crate::core::find_assignment_equals(line)
                .map(|index| &line[index + 1..])
                .unwrap_or(line)
                .trim();
            let name = command.split_whitespace().next().unwrap_or("");
            if !name
                .chars()
                .next()
                .is_some_and(|ch| ch.is_alphabetic() || ch == '_')
                || name.ends_with(':')
                || name.is_empty()
                || name.starts_with(['#', '"', '{', '[', '$'])
                || name.parse::<f64>().is_ok()
                || matches!(name, "true" | "false" | "null" | "assert" | "test-request")
                || known.contains(name)
                || crate::builtins::is_builtin(name)
            {
                continue;
            }
            // Dynamic collection methods and expressions cannot be classified statically yet.
            if name.contains('.')
                || command.split_whitespace().any(|w| {
                    matches!(
                        w,
                        "+" | "-" | "*" | "/" | "==" | "!=" | ">" | "<" | ">=" | "<="
                    )
                })
            {
                continue;
            }
            let suggestion = candidates
                .iter()
                .map(|candidate| (distance(name, candidate), candidate))
                .min_by_key(|(distance, _)| *distance)
                .filter(|(distance, _)| *distance <= 3)
                .map(|(_, candidate)| format!("Did you mean `{candidate}`?"));
            // Warn only about command-shaped statements, not a single unresolved expression.
            if command.split_whitespace().count() < 2 && suggestion.is_none() {
                continue;
            }
            diagnostics.push(Diagnostic {
                severity: "warning",
                code: "unknown-command",
                file: section.source_file.clone(),
                section: format!("@{}", section.path.join("/")),
                message: format!("Unrecognized command `{name}`"),
                location: super::diagnostics::locate(
                    section.source_file.as_deref(),
                    &section.path.join("/"),
                    Some(line),
                ),
                suggestion,
            });
        }
    }
    diagnostics
}

fn distance(left: &str, right: &str) -> usize {
    let right = right.chars().collect::<Vec<_>>();
    let mut row = (0..=right.len()).collect::<Vec<_>>();
    for (i, a) in left.chars().enumerate() {
        let mut previous = row[0];
        row[0] = i + 1;
        for (j, b) in right.iter().enumerate() {
            let old = row[j + 1];
            row[j + 1] = (row[j + 1] + 1)
                .min(row[j] + 1)
                .min(previous + usize::from(a != *b));
            previous = old;
        }
    }
    row[right.len()]
}
