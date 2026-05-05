// src/main.rs
mod apps;
mod arithmetic;
mod builtins;
mod cli;
mod core;
mod crud_web_fe;
mod lambda_main;
mod memory;
mod rune_ast;
mod rune_parser;
mod util;

use crate::core::{extract_data_sources, extract_schemas, get_app_type};
use crate::rune_ast::{RuneDocument, Value};
use crate::rune_parser::{load_rune_document_from_path, load_rune_document_from_str_with_base};
use crate::util::{api_doc, json_to_xml, log, set_log_level, LogLevel};
use axum::serve;
use clap::{Arg, Command};
use std::convert::TryFrom;
use std::process;
use std::{env, fs};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if is_lambda_env() {
        log(
            LogLevel::Info,
            "Running in AWS Lambda environment, launching Lambda runtime...",
        );
        launch_lambda().await?;
        return Ok(());
    }

    let matches = Command::new("vectrune")
        .version(env!("CARGO_PKG_VERSION"))
        .author("David Thomas")
        .about("Vectrune: Structured data in motion.")
        .arg(
            Arg::new("SCRIPT")
                .help("Path to the .rune script, directory, or '-' to read from STDIN")
                .num_args(1..)
                .action(clap::ArgAction::Append)
                .conflicts_with("ai"),
        )
        .arg(
            Arg::new("input")
                .short('i')
                .long("input")
                .help("Input data type")
                .value_name("input_format")
                .value_parser(["json", "rune", "xml", "yaml"]),
        )
        .arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .help("Enable verbose output")
                .value_name("output_format")
                .value_parser(["text", "json", "rune", "xml", "yaml", "curl"]),
        )
        .arg(
            Arg::new("calculate")
                .long("calculate")
                .num_args(1)
                .value_name("EXPR")
                .help("Perform a calculation over data, e.g. 'avg Section.field'"),
        )
        .arg(
            Arg::new("transform")
                .long("transform")
                .num_args(1)
                .value_name("SPEC")
                .help("Transform data into a new document, e.g. '@Target key:[@Section.field]'"),
        )
        .arg(
            Arg::new("merge-with")
                .long("merge-with")
                .num_args(1)
                .value_name("MERGE_SPEC")
                .help("Merge with another document: base_file@selector"),
        )
        .arg(
            Arg::new("log-level")
                .short('l')
                .long("log-level")
                .help("Set log level (debug, info, warn, error)")
                .value_name("LEVEL")
                .value_parser(["debug", "info", "warn", "error"]),
        )
        .arg(
            Arg::new("ai")
                .long("ai")
                .num_args(1)
                .value_name("PROMPT")
                .help("Send a CLI-assistant prompt to the local Ollama instance"),
        )
        .arg(
            Arg::new("ml")
                .long("model")
                .help("Set AI model for --ai prompt (default: phi4)")
                .num_args(1)
                .value_name("MODEL")
                .default_value("phi4"),
        )
        .arg(
            Arg::new("port")
                .short('p')
                .long("port")
                .value_name("PORT")
                .help("Override App.port when running REST/GraphQL servers")
                .value_parser(clap::value_parser!(u16)),
        )
        .arg(
            Arg::new("host")
                .long("host")
                .help("Override App.host when running REST/GraphQL servers (default: 127.0.0.1)")
                .value_name("HOST")
                .num_args(1)
                .default_value("127.0.0.1"),
        )
        .subcommand(
            Command::new("lambda")
                .about("AWS Lambda tooling for VectRune")
                .subcommand_required(true)
                .subcommand(
                    Command::new("launch")
                        .about("Launch the Lambda runtime for handling AWS lambda Events")
                )
                .subcommand(
                    Command::new("package")
                        .about(
                            "Bundle the runtime, Rune sources, and config into a Lambda artifact",
                        )
                        .arg(
                            Arg::new("rune")
                                .long("rune")
                                .short('r')
                                .num_args(1)
                                .value_name("PATH")
                                .help("Rune file or directory to include (default: app.rune)"),
                        )
                        .arg(
                            Arg::new("config")
                                .long("config")
                                .num_args(1)
                                .value_name("PATH")
                                .help("Optional config file or directory to include"),
                        )
                        .arg(
                            Arg::new("binary")
                                .long("binary")
                                .num_args(1)
                                .value_name("PATH")
                                .help("Path to the Lambda-compatible VectRune binary"),
                        )
                        .arg(
                            Arg::new("mode")
                                .long("mode")
                                .num_args(1)
                                .value_name("MODE")
                                .value_parser(["zip", "container"])
                                .default_value("zip")
                                .help("Select packaging mode"),
                        )
                        .arg(
                            Arg::new("output")
                                .long("output")
                                .short('o')
                                .num_args(1)
                                .value_name("FILE")
                                .help("Output artifact path"),
                        )
                        .arg(
                            Arg::new("image-name")
                                .long("image-name")
                                .num_args(1)
                                .value_name("NAME")
                                .help("Optional container image tag metadata"),
                        ),
                ),
        )
        .subcommand(
            Command::new("sam")
                .about("AWS SAM tooling for VectRune")
                .subcommand_required(true)
                .subcommand(
                    Command::new("generate")
                        .about("Generate a SAM YAML file for a Lambda ZIP bundle")
                        .arg(
                            Arg::new("bundle")
                                .long("bundle")
                                .short('b')
                                .num_args(1)
                                .value_name("PATH")
                                .help("Lambda ZIP bundle to deploy (containing bootstrap and rune files)"),
                        )
                        .arg(
                            Arg::new("output")
                                .long("output")
                                .short('o')
                                .num_args(1)
                                .value_name("FILE")
                                .help("Output SAM YAML file"),
                        ),
                )
                .subcommand(
                    Command::new("local")
                        .about("Run local SAM testing for a Lambda ZIP bundle")
                        .arg(
                            Arg::new("bundle")
                                .long("bundle")
                                .short('b')
                                .num_args(1)
                                .value_name("PATH")
                                .help("Lambda ZIP bundle to test locally (containing bootstrap and rune files)"),
                        )
                        .arg(
                            Arg::new("sam")
                                .long("sam")
                                .short('s')
                                .num_args(1)
                                .value_name("FILE")
                                .help("SAM YAML file to use"),
                        ),
                ),
        )
        .subcommand(
            Command::new("repl")
                .about("Start the Vectrune REPL shell")
                .arg(
                    Arg::new("log-level")
                        .short('l')
                        .long("log-level")
                        .help("Set log level (debug, info, warn, error)")
                        .value_name("LEVEL")
                        .value_parser(["debug", "info", "warn", "error"]),
                )
        )
        .subcommand(
            Command::new("knowledge")
                .about("Knowledge-source tooling for docs and AI exports")
                .subcommand_required(true)
                .subcommand(
                    Command::new("export")
                        .about("Regenerate docs and AI export artifacts from knowledge/")
                        .arg(
                            Arg::new("root")
                                .long("root")
                                .num_args(1)
                                .value_name("PATH")
                                .help("Workspace root containing knowledge/, language/docs/, and documents/ai/"),
                        ),
                ),
        )
        .get_matches();

    let log_level = matches
        .get_one::<String>("log-level")
        .map(|s| s.as_str())
        .or_else(|| {
            if let Some(("repl", repl_matches)) = matches.subcommand() {
                repl_matches
                    .get_one::<String>("log-level")
                    .map(|s| s.as_str())
            } else {
                None
            }
        });

    match log_level {
        Some("debug") => set_log_level(LogLevel::Debug, false),
        Some("info") => set_log_level(LogLevel::Info, false),
        Some("warn") => set_log_level(LogLevel::Warn, false),
        Some("error") => set_log_level(LogLevel::Error, false),
        _ => set_log_level(LogLevel::Info, true),
    }

    if let Some(("lambda", lambda_matches)) = matches.subcommand() {
        match lambda_matches.subcommand() {
            Some(("package", _)) => {
                cli::handle_lambda(lambda_matches)?;
                return Ok(());
            }
            Some(("launch", _)) => launch_lambda().await?,
            _ => {
                cli::handle_lambda(lambda_matches)?;
                return Ok(());
            }
        }
    }

    if let Some(("sam", sam_matches)) = matches.subcommand() {
        match sam_matches.subcommand() {
            Some(("generate", generate_matches)) => {
                let bundle_path = generate_matches
                    .get_one::<String>("bundle")
                    .map(|s| s.as_str())
                    .unwrap_or("dist/vectrune-lambda.zip");
                let output_path = generate_matches
                    .get_one::<String>("output")
                    .map(|s| s.as_str())
                    .unwrap_or("sam.yaml");
                cli::handle_sam_generate(bundle_path, output_path)?;
                return Ok(());
            }
            Some(("local", local_matches)) => {
                let bundle_path = local_matches
                    .get_one::<String>("bundle")
                    .map(|s| s.as_str())
                    .unwrap_or("dist/vectrune-lambda.zip");
                let sam_path = local_matches
                    .get_one::<String>("sam")
                    .map(|s| s.as_str())
                    .unwrap_or("sam.yaml");
                cli::handle_sam_local(bundle_path, sam_path)?;
                return Ok(());
            }
            _ => {}
        }
    }

    if let Some(("repl", _)) = matches.subcommand() {
        crate::cli::handle_repl().await?;
        return Ok(());
    }

    if let Some(("knowledge", knowledge_matches)) = matches.subcommand() {
        cli::handle_knowledge(knowledge_matches)?;
        return Ok(());
    }

    // Use gemini-1.5-flash for free google access, but allow override for users with local models or Ollama Pro
    // Requires Google AI key set as environment variable GEMINI_API_KEY
    let model = matches.get_one::<String>("ml").map(|s| s.as_str());
    let output_format = matches.get_one::<String>("output").map(|s| s.as_str());
    let input_format = matches.get_one::<String>("input").map(|s| s.as_str());
    let calc_expr = matches.get_one::<String>("calculate").map(|s| s.as_str());
    let transform_spec = matches.get_one::<String>("transform").map(|s| s.as_str());
    let merge_spec = matches.get_one::<String>("merge-with").map(|s| s.as_str());
    let ai_prompt = matches.get_one::<String>("ai").map(|s| s.as_str());
    let port_override = matches.get_one::<u16>("port").copied();
    let host_override = matches.get_one::<String>("host").map(|s| s.as_str());

    if let Some(prompt) = ai_prompt {
        cli::handle_ai(prompt, model).await?;
        return Ok(());
    }

    let script_paths: Vec<&str> = match matches.get_many::<String>("SCRIPT") {
        Some(paths) => paths.map(|s| s.as_str()).collect(),
        None => {
            log(
                LogLevel::Error,
                "No Vectrune script provided. Pass a .rune file, directory, or '-' for STDIN.",
            );
            process::exit(1);
        }
    };

    let mut doc: Option<RuneDocument> = None;

    fn parse_content(
        path: &str,
        content: &str,
        input_format: Option<&str>,
    ) -> anyhow::Result<RuneDocument> {
        match input_format {
            Some("json") => {
                let json_value: serde_json::Value = serde_json::from_str(content)?;
                Ok(RuneDocument::from_json(&json_value))
            }
            Some("xml") => RuneDocument::from_xml(content).map_err(|e| anyhow::anyhow!(e)),
            Some("yaml") => RuneDocument::from_yaml(content).map_err(|e| anyhow::anyhow!(e)),
            _ => {
                let base_dir = std::env::current_dir()?;
                load_rune_document_from_str_with_base(content, &base_dir, path)
                    .map_err(|e| anyhow::anyhow!(e))
            }
        }
    }

    for path_str in &script_paths {
        if *path_str == "-" {
            use std::io::Read;
            let mut buf = String::new();
            std::io::stdin().read_to_string(&mut buf).unwrap_or_else(|err| {
                log(
                    LogLevel::Error,
                    &format!("Error reading script from STDIN: {}", err),
                );
                process::exit(1);
            });
            let stdin_doc = parse_content("-", &buf, input_format)?;
            if let Some(ref mut d) = doc {
                d.merge(stdin_doc);
            } else {
                doc = Some(stdin_doc);
            }
        } else {
            let path = std::path::Path::new(path_str);
            if input_format.is_none() && (path.is_dir() || path.extension().and_then(|s| s.to_str()) == Some("rune")) {
                let file_doc = load_rune_document_from_path(path).map_err(|e| anyhow::anyhow!(e))?;
                if let Some(ref mut d) = doc {
                    d.merge(file_doc);
                } else {
                    doc = Some(file_doc);
                }
            } else {
                let content = fs::read_to_string(path).unwrap_or_else(|err| {
                    log(LogLevel::Error, &format!("Error reading script {}: {}", path_str, err));
                    process::exit(1);
                });
                let file_doc = parse_content(path_str, &content, input_format)?;
                if let Some(ref mut d) = doc {
                    d.merge(file_doc);
                } else {
                    doc = Some(file_doc);
                }
            }
        }
    }

    let mut doc = doc.ok_or_else(|| anyhow::anyhow!("No documents loaded."))?;

    // Calculation mode
    if let Some(expr) = calc_expr {
        if let Err(e) = crate::cli::handle_calculate(&doc, expr) {
            log(LogLevel::Error, &format!("{}", e));
            process::exit(1);
        }
        process::exit(0);
    }

    // Transform mode
    if let Some(spec) = transform_spec {
        match crate::cli::handle_transform(&doc, spec) {
            Ok(new_doc) => {
                doc.update_from(&new_doc);
            }
            Err(e) => {
                log(LogLevel::Error, &format!("Transform error: {}", e));
                process::exit(1);
            }
        }
    }

    // Merge mode
    if let Some(spec) = merge_spec {
        match crate::cli::handle_merge(&doc, spec) {
            Ok(merged_doc) => {
                doc = merged_doc;
            }
            Err(e) => {
                log(LogLevel::Error, &format!("Merge error: {}", e));
                process::exit(1);
            }
        }
    }

    let app_type = get_app_type(&doc);
    log(
        LogLevel::Info,
        &format!("Detected App type: {:?}", app_type),
    );

    let doc_host = doc
        .get_section("App")
        .and_then(|sec| sec.kv.get("host"))
        .and_then(|val| val.as_str());
    let effective_host = host_override.or(doc_host).unwrap_or("127.0.0.1");
    let doc_port = doc
        .get_section("App")
        .and_then(|sec| sec.kv.get("port"))
        .and_then(|val| val.as_u64())
        .and_then(|v| u16::try_from(v).ok());
    let effective_port = port_override.unwrap_or(doc_port.unwrap_or(3000));

    if app_type == Some("REST".to_string()) && output_format == Some("curl") {
        // Get port from App section, default to 3000
        let port = doc
            .get_section("App")
            .and_then(|sec| sec.kv.get("port"))
            .and_then(|val| val.as_u64())
            .unwrap_or(3000);
        let host_port = format!("localhost:{}", port);
        // Generate curl commands for REST routes
        let routes = doc.get_sections("Route");
        for route in routes {
            if let Some(path) = route.path.join("/").strip_prefix("Route/").and_then(|p| {
                p.strip_prefix(&format!(
                    "{}/",
                    route.path.get(1).map(|s| s.as_str()).unwrap_or("GET")
                ))
            }) {
                let method = route.path.get(1).map(|s| s.as_str()).unwrap_or("GET");
                if method == "CRUD" {
                    // For CRUD, print for both collection and item paths
                    let collection_path = path;
                    // Dynamically build example JSON body from schema
                    let mut obj_body = String::from("{");
                    if let Some(Value::String(schema_name)) = route.kv.get("schema") {
                        // Find the schema section by path ["Schema", schema_name]
                        let schema_section = doc.sections.iter().find(|sec| {
                            sec.path.len() == 2
                                && sec.path[0] == "Schema"
                                && sec.path[1] == *schema_name
                        });
                        if let Some(schema_section) = schema_section {
                            let mut first = true;
                            for (field, typ) in &schema_section.kv {
                                if !first {
                                    obj_body.push_str(",\n");
                                } else {
                                    first = false;
                                }
                                let example = match typ.as_str().unwrap_or("") {
                                    "string" => format!("  \"{}\": \"example\"", field),
                                    "number" => format!("  \"{}\": 123", field),
                                    "bool" => format!("  \"{}\": true", field),
                                    _ => format!("  \"{}\": null", field),
                                };
                                obj_body.push_str(&example);
                            }
                        }
                    }
                    obj_body.push_str("\n}");

                    // GET collection
                    println!("curl -X GET    http://{}/{}", host_port, collection_path);
                    // POST collection (create)
                    println!("curl -X POST   http://{}/{} \\", host_port, collection_path);
                    println!("     -H 'Content-Type: application/json' \\");
                    println!("     -d '{}'", obj_body.replace("'", "\\'"));
                    // GET item
                    println!(
                        "curl -X GET    http://{}/{}/123",
                        host_port, collection_path
                    );
                    // PUT item (update)
                    println!(
                        "curl -X PUT    http://{}/{}/123 \\",
                        host_port, collection_path
                    );
                    println!("     -H 'Content-Type: application/json' \\");
                    println!("     -d '{}'", obj_body.replace("'", "\\'"));
                    // DELETE item
                    println!(
                        "curl -X DELETE http://{}/{}/123",
                        host_port, collection_path
                    );
                    continue;
                }

                let mut curl_cmd = format!("curl -X {} http://{}/{}", method, host_port, path);
                if let Some(description) = route.kv.get("description") {
                    if let Value::String(desc) = description {
                        curl_cmd.push_str(&format!("  # {}", desc));
                    }
                }
                log(LogLevel::Info, &curl_cmd);
            }
        }
        process::exit(0);
    }
    if app_type
        .as_ref()
        .map(|t| crate::apps::app_type_supported(t))
        .unwrap_or(false)
        && output_format == None
    {
        log(
            LogLevel::Info,
            &format!(
                "Starting Vectrune {} application...",
                app_type.as_deref().unwrap_or("REST")
            ),
        );
        log(LogLevel::Info, "Press Ctrl+C to stop the server.");
        log(LogLevel::Debug, &format!("Config: \n{}", api_doc(&doc)));

        let rune_dir = if script_paths.contains(&"-") {
            env::current_dir()?
        } else {
            let p = std::path::Path::new(script_paths[0]);
            if p.is_dir() {
                p.to_path_buf()
            } else {
                p.parent()
                    .map(|p| p.to_path_buf())
                    .unwrap_or_else(|| std::env::current_dir().unwrap_or_default())
            }
        };

        let schemas = std::sync::Arc::new(extract_schemas(&doc));
        let data_sources = std::sync::Arc::new(extract_data_sources(&doc));
        let app = apps::build_vectrune_router(
            std::sync::Arc::new(doc.clone()),
            schemas.clone(),
            data_sources.clone(),
            rune_dir.clone(),
        )
        .await;
        let host_address = format!("{}:{}", effective_host, effective_port);
        let listener = TcpListener::bind(host_address.clone()).await?;
        log(
            LogLevel::Info,
            &format!("Vectrune runtime listening on http://{}", host_address),
        );
        serve(listener, app).await?;
        Ok(())
    } else {
        log(LogLevel::Debug, "Parsed Vectrune script:");
        match output_format {
            Some("json") => {
                let json_output =
                    serde_json::to_string_pretty(&doc.to_json()).unwrap_or_else(|err| {
                        log(
                            LogLevel::Error,
                            &format!("Error converting to JSON: {}", err),
                        );
                        process::exit(1);
                    });
                println!("{}", json_output);
                process::exit(0);
            }
            Some("text") => {
                let text_output = format!("{}", doc);
                println!("{}", text_output);
                process::exit(0);
            }
            Some("rune") => {
                // For Vectrune output, we can just print the original script content
                println!("{}", doc);
                process::exit(0);
            }
            Some("xml") => {
                let xml_output = json_to_xml(&doc.to_json(), "root");
                println!("{}", xml_output);
                process::exit(0);
            }
            Some("yaml") => {
                let yaml_output = serde_yaml::to_string(&doc.to_json()).unwrap_or_else(|err| {
                    eprintln!("Error converting to YAML: {}", err);
                    process::exit(1);
                });
                println!("{}", yaml_output);
                process::exit(0);
            }
            _ => {}
        }

        println!("{}", doc);
        process::exit(0);
    }
}

async fn launch_lambda() -> std::io::Result<()> {
    match lambda_main::launch().await {
        Ok(_) => Ok(()),
        Err(e) => {
            log(
                LogLevel::Error,
                &format!("Error launching Lambda runtime: {}", e),
            );
            Err(std::io::Error::new(std::io::ErrorKind::Other, e))
        }
    }
}

fn is_lambda_env() -> bool {
    // Check 1: Is there a function name?
    let has_name = env::var("AWS_LAMBDA_FUNCTION_NAME").is_ok();

    // Check 2: Is the Runtime API endpoint defined?
    // (Crucial for custom runtimes like Rust)
    let has_api = env::var("AWS_LAMBDA_RUNTIME_API").is_ok();

    has_name && has_api
}
