//! Lambda entrypoint for Vectrune
//! Handles AWS Lambda events and invokes the Vectrune runtime

use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use serde_json::{json, Value};
use std::sync::Arc;
use rune_runtime::core::{extract_schemas, extract_data_sources, AppState};
use rune_runtime::rune_ast::RuneDocument;
use rune_runtime::rune_parser::parse_rune;
use tokio::sync::OnceCell;
use std::fs;
use axum::{body::Body, http::{Request, Method, HeaderMap, HeaderValue, Uri}, Router};
use tower::ServiceExt;
use crate::apps::build_app_router;
mod lambda_handler;
use lambda_handler::{lambda_handler, RUNE_DOC, ROUTER};

#[tokio::main]
async fn main() -> Result<(), Error> {
    let rune_path = std::env::var("RUNE_FILE").unwrap_or_else(|_| "rune/app.rune".to_string());
    let script_content = fs::read_to_string(&rune_path)
        .map_err(|e| Error::from(format!("Failed to read rune file: {}", e)))?;
    let doc_result = match parse_rune(&script_content) {
        Ok(doc) => Ok(Arc::new(doc)),
        Err(e) => Err(format!("Failed to parse rune file: {:?}", e)),
    };
    let router = if let Ok(ref doc_arc) = doc_result {
        let schemas = Arc::new(extract_schemas(doc_arc));
        let data_sources = Arc::new(extract_data_sources(doc_arc));
        let path = std::env::current_dir().unwrap();
        Some(crate::apps::build_vectrune_router(
            doc_arc.clone(),
            schemas,
            data_sources,
            path,
            false,
        ).await)
    } else {
        None
    };
    RUNE_DOC.set(doc_result).ok();
    ROUTER.set(router).ok();
    run(service_fn(lambda_handler)).await
}
