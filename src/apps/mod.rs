pub mod rest;
pub mod graphql;

use crate::core::{AppState, get_app_type};
use axum::Router;
use self::rest::build_rest_router;
use self::graphql::build_graphql_router;

pub async fn build_app_router(state: AppState, verbose: bool) -> Router {
    let app_type = get_app_type(&state.doc).unwrap_or_else(|| "REST".to_string());
    
    match app_type.to_uppercase().as_str() {
        "GRAPHQL" => build_graphql_router(state, verbose).await,
        _ => build_rest_router(state, verbose).await,
    }
}
