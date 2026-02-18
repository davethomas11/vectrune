pub mod graphql;
pub mod rest;

use self::graphql::build_graphql_router;
use self::rest::build_rest_router;
use crate::core::{get_app_type, AppState};
use axum::Router;

pub async fn build_app_router(state: AppState, verbose: bool) -> Router {
    let app_type = get_app_type(&state.doc).unwrap_or_else(|| "REST".to_string());

    match app_type.to_uppercase().as_str() {
        "GRAPHQL" => build_graphql_router(state, verbose).await,
        _ => build_rest_router(state, verbose).await,
    }
}
