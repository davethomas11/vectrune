// src/main.rs
mod builtins;
mod cli;
mod crud_web_fe;
mod rune_ast;
mod rune_parser;
mod core;
mod apps;
mod util;

use crate::rune_ast::{RuneDocument, Value};
use crate::rune_parser::parse_rune;
use crate::core::{AppState, get_app_type, extract_schemas, extract_data_sources};
use crate::apps::build_app_router;
use crate::util::{api_doc, json_to_xml, set_log_level, LogLevel, log};
use axum::serve;
use clap::{Arg, Command};
use std::fs;
use std::process;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let matches = Command::new("vectrune")
        .version(env!("CARGO_PKG_VERSION"))
        .author("David Thomas")
        .about("Vectrune: Structured data in motion.")
        .arg(
            Arg::new("SCRIPT")
                .help("Path to the .rune script, or '-' to read from STDIN")
                .required(true)
                .index(1),
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
            Arg::new("verbose")
                .short('v')
                .long("verbose")
                .help("Enable verbose output")
                .action(clap::ArgAction::SetTrue),
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
        .get_matches();

    let script_path = matches.get_one::<String>("SCRIPT").unwrap();
    let output_format = matches.get_one::<String>("output").map(|s| s.as_str());
    let input_format = matches.get_one::<String>("input").map(|s| s.as_str());
    let is_verbose = matches.get_flag("verbose");
    let calc_expr = matches.get_one::<String>("calculate").map(|s| s.as_str());
    let transform_spec = matches.get_one::<String>("transform").map(|s| s.as_str());
    let merge_spec = matches.get_one::<String>("merge-with").map(|s| s.as_str());

    let log_level = matches.get_one::<String>("log-level").map(|s| s.as_str());
    match log_level {
        Some("debug") => set_log_level(LogLevel::Debug),
        Some("info") => set_log_level(LogLevel::Info),
        Some("warn") => set_log_level(LogLevel::Warn),
        Some("error") => set_log_level(LogLevel::Error),
        _ => set_log_level(LogLevel::Info),
    }

    let script_content = if script_path == "-" {
        use std::io::Read;
        let mut buf = String::new();
        std::io::stdin()
            .read_to_string(&mut buf)
            .unwrap_or_else(|err| {
                log(LogLevel::Error, &format!("Error reading script from STDIN: {}", err));
                process::exit(1);
            });
        buf
    } else {
        fs::read_to_string(script_path).unwrap_or_else(|err| {
            log(LogLevel::Error, &format!("Error reading script: {}", err));
            process::exit(1);
        })
    };

    let mut doc: RuneDocument = match input_format {
        Some("json") => {
            // Convert JSON input to Rune format
            let json_value: serde_json::Value = serde_json::from_str(&script_content).unwrap_or_else(|err| {
                log(LogLevel::Error, &format!("Error parsing JSON input: {}", err));
                process::exit(1);
            });
            RuneDocument::from_json(&json_value)
        }
        Some("xml") => {
            match RuneDocument::from_xml(&script_content) {
                Ok(doc) => doc,
                Err(err) => {
                    log(LogLevel::Error, &format!("Error parsing XML input: {}", err));
                    process::exit(1);
                }
            }
        }
        Some("yaml") => {
            match RuneDocument::from_yaml(&script_content) {
                Ok(doc) => doc,
                Err(err) => {
                    log(LogLevel::Error, &format!("Error parsing YAML input: {}", err));
                    process::exit(1);
                }
            }
        }
        _ => {
            match parse_rune(&script_content) {
                Ok(doc) => doc,
                Err(err) => {
                    log(LogLevel::Error, &format!("Error parsing Vectrune script: {}", err));
                    process::exit(1);
                }
            }
        }
    };

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
    if is_verbose {
        log(LogLevel::Info, &format!("Detected App type: {:?}", app_type));
    }

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
                            sec.path.len() == 2 && sec.path[0] == "Schema" && sec.path[1] == *schema_name
                        });
                        if let Some(schema_section) = schema_section {
                            let mut first = true;
                            for (field, typ) in &schema_section.kv {
                                if !first { obj_body.push_str(",\n"); } else { first = false; }
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
                    println!("curl -X GET    http://{}/{}/123", host_port, collection_path);
                    // PUT item (update)
                    println!("curl -X PUT    http://{}/{}/123 \\", host_port, collection_path);
                    println!("     -H 'Content-Type: application/json' \\");
                    println!("     -d '{}'", obj_body.replace("'", "\\'"));
                    // DELETE item
                    println!("curl -X DELETE http://{}/{}/123", host_port, collection_path);
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
    if (app_type == Some("REST".to_string()) || app_type == Some("Graphql".to_string())) && output_format == None {
        log(LogLevel::Info, &format!("Starting Vectrune {} application...", app_type.as_deref().unwrap_or("REST")));
        log(LogLevel::Info, "Press Ctrl+C to stop the server.");
        if is_verbose {
            log(LogLevel::Debug, &format!("Config: \n{}", api_doc(&doc)));
        }
        let rune_dir = if script_path == "-" {
            std::env::current_dir().unwrap()
        } else {
            std::path::Path::new(script_path)
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| std::env::current_dir().unwrap())
        };

        let schemas = std::sync::Arc::new(extract_schemas(&doc));
        let data_sources = std::sync::Arc::new(extract_data_sources(&doc));
        let state = AppState {
            doc: std::sync::Arc::new(doc.clone()),
            schemas,
            data_sources,
            path: rune_dir.clone()
        };

        let app = build_app_router(state.clone(), is_verbose).await;
        let port = doc
            .get_section("App")
            .and_then(|sec| sec.kv.get("port"))
            .and_then(|val| val.as_u64())
            .unwrap_or(3000);
        let host_address = format!("127.0.0.1:{}", port);
        let listener = TcpListener::bind(host_address.clone()).await?;
        log(LogLevel::Info, &format!("Vectrune runtime listening on http://{}", host_address));
        serve(listener, app).await?;
        Ok(())
    } else {
        if is_verbose {
            log(LogLevel::Debug, "Parsed Vectrune script:");
        }
        match output_format {
            Some("json") => {
                let json_output =
                    serde_json::to_string_pretty(&doc.to_json()).unwrap_or_else(|err| {
                        log(LogLevel::Error, &format!("Error converting to JSON: {}", err));
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
