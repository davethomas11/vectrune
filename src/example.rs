mod rune_ast;
mod rune_parser;
mod runtime;
mod builtins;

use crate::rune_parser::parse_rune;
use crate::runtime::build_router;
use std::fs;
use axum::serve;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let rune = fs::read_to_string("examples/app.rune")?;
    let doc = parse_rune(&rune)?;
    let app = build_router(doc);

    let listener = TcpListener::bind("127.0.0.1:3000").await?;
    println!("RUNE runtime listening on http://127.0.0.1:3000");

    serve(listener, app).await?;
    Ok(())
}
