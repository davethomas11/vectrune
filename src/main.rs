// src/main.rs
mod builtins;
mod cli;
mod rune_ast;
mod rune_parser;
mod runtime;
mod util;

use crate::rune_ast::{RuneDocument, Value};
use crate::rune_parser::parse_rune;
use crate::runtime::{build_router, get_app_type};
use crate::util::{api_doc, json_to_xml};
use axum::serve;
use clap::{Arg, Command};
use std::fs;
use std::process;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let matches = Command::new("vectrune")
        .version("0.1.0")
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
        .get_matches();

    let script_path = matches.get_one::<String>("SCRIPT").unwrap();
    let output_format = matches.get_one::<String>("output").map(|s| s.as_str());
    let input_format = matches.get_one::<String>("input").map(|s| s.as_str());
    let is_verbose = matches.get_flag("verbose");
    let calc_expr = matches.get_one::<String>("calculate").map(|s| s.as_str());
    let transform_spec = matches.get_one::<String>("transform").map(|s| s.as_str());

    let script_content = if script_path == "-" {
        use std::io::Read;
        let mut buf = String::new();
        std::io::stdin()
            .read_to_string(&mut buf)
            .unwrap_or_else(|err| {
                eprintln!("Error reading script from STDIN: {}", err);
                process::exit(1);
            });
        buf
    } else {
        fs::read_to_string(script_path).unwrap_or_else(|err| {
            eprintln!("Error reading script: {}", err);
            process::exit(1);
        })
    };

    let mut doc: RuneDocument = match input_format {
        Some("json") => {
            // Convert JSON input to Rune format
            let json_value: serde_json::Value = serde_json::from_str(&script_content).unwrap_or_else(|err| {
                eprintln!("Error parsing JSON input: {}", err);
                process::exit(1);
            });
            RuneDocument::from_json(&json_value)
        }
        Some("xml") => {
            // Convert XML input to Rune format
            // Here you would implement conversion from XML to Rune script format
            eprintln!("XML input format is not yet implemented.");
            process::exit(1);
        }
        Some("yaml") => {
            // Convert YAML input to Rune format
            let yaml_value: serde_yaml::Value = serde_yaml::from_str(&script_content).unwrap_or_else(|err| {
                eprintln!("Error parsing YAML input: {}", err);
                process::exit(1);
            });
            // Here you would implement conversion from YAML to Rune script format
            eprintln!("YAML input format is not yet implemented.");
            process::exit(1);
        }
        _ => {
            match parse_rune(&script_content) {
                Ok(doc) => doc,
                Err(err) => {
                    eprintln!("Error parsing Vectrune script: {}", err);
                    process::exit(1);
                }
            }
        }
    };

    // Calculation mode
    if let Some(expr) = calc_expr {
        if let Err(e) = crate::cli::handle_calculate(&doc, expr) {
            eprintln!("{}", e);
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
                eprintln!("Transform error: {}", e);
                process::exit(1);
            }
        }
    }

    let app_type = get_app_type(&doc);
    if is_verbose {
        println!("Detected App type: {:?}", app_type);
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
                println!("{}", curl_cmd);
            }
        }
        process::exit(0);
    }
    if app_type == Some("REST".to_string()) && output_format == None {
        println!("Starting Vectrune REST application...");
        println!("Press Ctrl+C to stop the server.");
        if is_verbose {
            println!("Config: \n{}", api_doc(&doc));
        }
        let app = build_router(doc.clone(), is_verbose);
        let port = doc
            .get_section("App")
            .and_then(|sec| sec.kv.get("port"))
            .and_then(|val| val.as_u64())
            .unwrap_or(3000);
        let host_address = format!("127.0.0.1:{}", port);
        let listener = TcpListener::bind(host_address.clone()).await?;
        println!("Vectrune runtime listening on http://{}", host_address);
        serve(listener, app).await?;
        Ok(())
    } else {
        if is_verbose {
            println!("Parsed Vectrune script:");
        }
        match output_format {
            Some("json") => {
                let json_output =
                    serde_json::to_string_pretty(&doc.to_json()).unwrap_or_else(|err| {
                        eprintln!("Error converting to JSON: {}", err);
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
