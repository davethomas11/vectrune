// src/main.rs
mod builtins;
mod rune_ast;
mod rune_parser;
mod runtime;
mod util;

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
        .about("VectRune script executor")
        .arg(
            Arg::new("SCRIPT")
                .help("Path to the .rune script")
                .required(true)
                .index(1),
        )
        .arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .help("Enable verbose output")
                .value_name("format")
                .value_parser(["text", "json", "rune", "xml", "yaml"]),
        )
        .arg(
            Arg::new("verbose")
                .short('v')
                .long("verbose")
                .help("Enable verbose output")
                .action(clap::ArgAction::SetTrue),
        )
        .get_matches();

    let script_path = matches.get_one::<String>("SCRIPT").unwrap();
    let output_format = matches.get_one::<String>("output").map(|s| s.as_str());
    let is_verbose = matches.get_flag("verbose");

    let script_content = fs::read_to_string(script_path).unwrap_or_else(|err| {
        eprintln!("Error reading script: {}", err);
        process::exit(1);
    });

    let doc = match parse_rune(&script_content) {
        Ok(doc) => doc,
        Err(err) => {
            eprintln!("Error parsing RUNE script: {}", err);
            process::exit(1);
        }
    };

    let app_type = get_app_type(&doc);
    println!("Detected App type: {:?}", app_type);

    if app_type == Some("REST".to_string()) && output_format == None {
        println!("Starting RUNE REST application...");
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
        println!("RUNE runtime listening on http://{}", host_address);
        serve(listener, app).await?;
        Ok(())
    } else {
        println!("Parsed RUNE script:");
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
                // For RUNE output, we can just print the original script content
                println!("{}", script_content);
                process::exit(0);
            }
            Some("xml") => {
                let xml_output = json_to_xml(&doc.to_json(), "root");
                println!("{}", xml_output);
                process::exit(0);
            }
            Some("yaml") => {
                let yaml_output =
                    serde_yaml::to_string(&doc.to_json()).unwrap_or_else(|err| {
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
