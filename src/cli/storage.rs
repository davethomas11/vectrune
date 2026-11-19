use crate::storage::{
    provider::{remote, Provider},
    Request, Store,
};
use anyhow::{Context, Result};
use clap::{Arg, ArgGroup, ArgMatches, Command};
use serde_json::Value;
use std::{
    io::{self, Write},
    path::Path,
};

fn connection(command: Command) -> Command {
    command
        .arg(
            Arg::new("file")
                .long("file")
                .value_name("DB_FILE")
                .help("Open an embedded database directly; cannot share an open server file"),
        )
        .arg(
            Arg::new("endpoint")
                .long("endpoint")
                .value_name("URL")
                .help("Connect to a storage server"),
        )
        .arg(
            Arg::new("config")
                .long("config")
                .requires("source")
                .value_name("RUNE_FILE")
                .help("Load a named datasource from Rune configuration"),
        )
        .arg(
            Arg::new("source")
                .long("source")
                .requires("config")
                .value_name("NAME"),
        )
        .arg(
            Arg::new("token-env")
                .long("token-env")
                .requires("endpoint")
                .value_name("ENV_VAR")
                .help("Environment variable containing the server bearer token"),
        )
        .group(
            ArgGroup::new("connection")
                .args(["file", "endpoint", "config"])
                .required(true),
        )
}
fn required(name: &'static str) -> Arg {
    Arg::new(name).required(true)
}
fn value() -> Arg {
    Arg::new("value")
        .long("value")
        .required(true)
        .help("JSON value (or array of mutation packets for batch)")
}
pub fn commands() -> Vec<Command> {
    let db = Command::new("db")
        .about("Query and mutate Rune DB locally or over the network")
        .subcommand_required(true)
        .subcommand(connection(
            Command::new("get")
                .arg(required("collection"))
                .arg(required("key")),
        ))
        .subcommand(connection(
            Command::new("get-many")
                .about("Read multiple records in one snapshot, in input order")
                .arg(required("collection"))
                .arg(required("keys").num_args(1..=256)),
        ))
        .subcommand(connection(
            Command::new("put")
                .arg(required("collection"))
                .arg(required("key"))
                .arg(value())
                .arg(
                    Arg::new("expected")
                        .long("expected")
                        .help("Required current revision, or 0 for create-only"),
                ),
        ))
        .subcommand(connection(
            Command::new("delete")
                .arg(required("collection"))
                .arg(required("key"))
                .arg(Arg::new("expected").long("expected")),
        ))
        .subcommand(connection(
            Command::new("increment")
                .about("Apply an atomic numeric mutation without retrieving the document")
                .arg(required("collection"))
                .arg(required("key"))
                .arg(
                    Arg::new("path")
                        .long("path")
                        .default_value("[]")
                        .help("JSON array of fields, indexes or {field,equals} selectors"),
                )
                .arg(Arg::new("by").long("by").required(true))
                .arg(Arg::new("expected").long("expected")),
        ))
        .subcommand(connection(
            Command::new("scan")
                .alias("query")
                .about("Read an ordered, bounded prefix page; no SQL or property filters")
                .arg(required("collection"))
                .arg(Arg::new("prefix").long("prefix").default_value(""))
                .arg(Arg::new("after").long("after"))
                .arg(
                    Arg::new("limit")
                        .long("limit")
                        .default_value("100")
                        .value_parser(clap::value_parser!(usize)),
                ),
        ))
        .subcommand(connection(
            Command::new("batch")
                .about("Atomically execute 1..256 put/delete/increment/append packets")
                .arg(value()),
        ));
    let events = Command::new("events")
        .about("Append, replay or follow durable Vect Event streams")
        .subcommand_required(true)
        .subcommand(connection(
            Command::new("append")
                .arg(required("stream"))
                .arg(required("kind"))
                .arg(value()),
        ))
        .subcommands(["read", "tail"].map(|name| {
            connection(
                Command::new(name)
                    .arg(required("stream"))
                    .arg(Arg::new("after").long("after").default_value("0"))
                    .arg(
                        Arg::new("limit")
                            .long("limit")
                            .default_value("100")
                            .value_parser(clap::value_parser!(usize)),
                    ),
            )
        }));
    vec![db, events]
}
pub async fn run(kind: &str, args: &ArgMatches) -> Result<()> {
    let (op, args) = args.subcommand().context("operation required")?;
    let string = |name: &str| args.get_one::<String>(name).cloned().unwrap_or_default();
    let json_value = |name| -> Result<Value> { Ok(serde_json::from_str(&string(name))?) };
    let optional = |name: &str| args.get_one::<String>(name).cloned();
    let mut request = match (kind, op) {
        ("db", "get") => Request::Get {
            collection: string("collection"),
            key: string("key"),
        },
        ("db", "get-many") => Request::GetMany {
            collection: string("collection"),
            keys: args.get_many::<String>("keys").unwrap().cloned().collect(),
        },
        ("db", "put") => Request::Put {
            collection: string("collection"),
            key: string("key"),
            value: json_value("value")?,
            expected: optional("expected"),
        },
        ("db", "delete") => Request::Delete {
            collection: string("collection"),
            key: string("key"),
            expected: optional("expected"),
        },
        ("db", "increment") => Request::Increment {
            collection: string("collection"),
            key: string("key"),
            path: serde_json::from_str(&string("path"))?,
            by: json_value("by")?,
            expected: optional("expected"),
        },
        ("db", "scan") => Request::Scan {
            collection: string("collection"),
            prefix: string("prefix"),
            after: optional("after"),
            limit: *args.get_one::<usize>("limit").unwrap(),
        },
        ("db", "batch") => Request::Batch {
            operations: serde_json::from_str(&string("value"))?,
        },
        ("events", "append") => Request::Append {
            stream: string("stream"),
            kind: string("kind"),
            value: json_value("value")?,
        },
        _ => Request::Read {
            stream: string("stream"),
            after: string("after"),
            limit: *args.get_one::<usize>("limit").unwrap(),
            wait_ms: if op == "tail" { 30000 } else { 0 },
        },
    };
    let provider = if let Some(file) = args.get_one::<String>("file") {
        Some(Provider {
            connection: crate::storage::provider::Connection::Local(Store::open(Path::new(file))?),
            events_only: kind == "events",
        })
    } else if let Some(config) = args.get_one::<String>("config") {
        let config = Path::new(config).canonicalize()?;
        let doc = crate::rune_parser::load_rune_document_from_path(&config)?;
        Some(Provider::open(
            &doc,
            config.parent().unwrap(),
            args.get_one::<String>("source")
                .context("--config requires --source")?,
        )?)
    } else {
        None
    };
    let token = args
        .get_one::<String>("token-env")
        .map(|name| std::env::var(name).context("token environment variable missing"))
        .transpose()?;
    loop {
        let reply = async {
            if let Some(provider) = &provider {
                provider.request(request.clone()).await
            } else {
                remote(
                    args.get_one::<String>("endpoint").unwrap(),
                    token.as_deref(),
                    &request,
                )
                .await
            }
        };
        let result = if op == "tail" {
            tokio::select! { result = reply => result?, _ = tokio::signal::ctrl_c() => return Ok(()) }
        } else {
            reply.await?
        };
        if op != "tail" {
            println!("{}", serde_json::to_string(&result)?);
            return Ok(());
        }
        for event in result["events"]
            .as_array()
            .context("invalid stream response")?
        {
            println!("{}", serde_json::to_string(event)?);
        }
        io::stdout().flush()?;
        if let Request::Read { after, .. } = &mut request {
            *after = result["next"]
                .as_str()
                .context("invalid stream cursor")?
                .into();
        }
    }
}
