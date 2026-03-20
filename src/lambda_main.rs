//! Lambda entrypoint for Vectrune
//! Handles AWS Lambda events and invokes the Vectrune runtime

use lambda_runtime::{run, service_fn, Error};
pub mod aws_lambda;
use aws_lambda::handler::execution_event;
use aws_lambda::cold_start;

pub async fn launch() -> Result<(), Error> {
    let rune_path = std::env::var("RUNE_FILE").unwrap_or_else(|_| "rune/app.rune".to_string());
    cold_start(&rune_path).await;
    run(service_fn(execution_event)).await
}
