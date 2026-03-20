pub mod graphql;
pub mod rest;

use self::graphql::build_graphql_router;
use self::rest::build_rest_router;
use crate::core::{get_app_type, AppState};
use crate::rune_ast::RuneDocument;
use axum::Router;
use std::path::PathBuf;
use std::sync::Arc;

use axum::routing::get_service;
use tower_http::services::ServeDir;

pub async fn build_app_router(state: AppState) -> Router {
    let app_type = get_app_type(&state.doc).unwrap_or_else(|| "REST".to_string());

    match app_type.to_uppercase().as_str() {
        "GRAPHQL" => build_graphql_router(state).await,
        "REST" => build_rest_router(state).await,
        "STATIC" => build_static_router(state).await,
        other => {
            use axum::{routing::any};
            let other_owned = other.to_string();
            Router::new().route(
                "/{*path}",
                any(move || {
                    let other = other_owned.clone();
                    async move {
                        (
                            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                            format!(
                                "Unsupported App type: {}. Only REST, GRAPHQL, and STATIC are supported.",
                                other
                            ),
                        )
                    }
                }),
            )
        }
    }
}

pub async fn build_static_router(state: AppState) -> Router {
    // Determine static root from App section or default to current dir
    let root = state
        .doc
        .get_section("App")
        .and_then(|sec| sec.kv.get("root"))
        .and_then(|v| v.as_str())
        .map(|s| PathBuf::from(s))
        .unwrap_or_else(|| state.path.clone());
    Router::new().fallback_service(
        get_service(ServeDir::new(root).append_index_html_on_directories(true))
    )
}

pub async fn build_vectrune_router(
    doc: Arc<RuneDocument>,
    schemas: Arc<std::collections::HashMap<String, crate::rune_ast::Section>>,
    data_sources: Arc<std::collections::HashMap<String, crate::rune_ast::Section>>,
    path: PathBuf
) -> Router {
    let state = AppState {
        doc,
        schemas,
        data_sources,
        path,
    };
    build_app_router(state).await
}

/// Returns true if the app type is supported for server launch
pub fn app_type_supported(app_type: &str) -> bool {
    matches!(app_type.to_uppercase().as_str(), "REST" | "GRAPHQL" | "STATIC")
}
