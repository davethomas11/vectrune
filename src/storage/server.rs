use super::{
    provider::{field, Provider},
    Request, MAX_PACKET,
};
use crate::{core::AppState, rune_ast::Value};
use anyhow::{ensure, Context, Result};
use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use serde_json::json;
use std::sync::Arc;

struct Server {
    provider: Provider,
    token: Option<String>,
}
fn allowed_origins(state: &AppState) -> Result<Option<Vec<axum::http::HeaderValue>>> {
    let app = state.doc.get_section("App").context("@App required")?;
    let single = app.kv.get("allow_origin");
    let multiple = app.kv.get("allow_origins");
    ensure!(
        single.is_none() || multiple.is_none(),
        "use allow_origin or allow_origins, not both"
    );
    let values = match (single, multiple) {
        (Some(value), _) => vec![value
            .as_str()
            .context("CORS origins must be strings")?
            .to_owned()],
        (_, Some(Value::List(values))) => {
            ensure!(!values.is_empty(), "allow_origins must not be empty");
            values
                .iter()
                .map(|v| {
                    v.as_str()
                        .map(str::to_owned)
                        .context("CORS origins must be strings")
                })
                .collect::<Result<Vec<_>>>()?
        }
        (_, Some(Value::String(value))) => {
            let values: Vec<String> = serde_json::from_str(value)
                .context("allow_origins requires a JSON array of exact HTTP(S) origins")?;
            ensure!(!values.is_empty(), "allow_origins must not be empty");
            values
        }
        (_, Some(_)) => anyhow::bail!("allow_origins requires a list of exact HTTP(S) origins"),
        _ => return Ok(None),
    };
    let mut origins = Vec::new();
    for origin in values {
        let url = reqwest::Url::parse(&origin)?;
        ensure!(
            matches!(url.scheme(), "http" | "https")
                && url.host_str().is_some()
                && url.path() == "/"
                && url.query().is_none()
                && url.fragment().is_none()
                && url.username().is_empty()
                && url.password().is_none(),
            "CORS requires exact HTTP(S) origins"
        );
        origins.push(url.origin().ascii_serialization().parse()?);
    }
    Ok(Some(origins))
}
fn settings(state: &AppState) -> Result<Server> {
    let app = state.doc.get_section("App").context("@App required")?;
    let name = field(app, "source").context("storage server requires source = <datasource>")?;
    let provider = Provider::from_state(state, name)?;
    ensure!(
        matches!(provider.connection, super::provider::Connection::Local(_)),
        "standalone server source must be embedded"
    );
    ensure!(
        provider.events_only
            == field(app, "type").is_some_and(|v| v.eq_ignore_ascii_case("vect-event")),
        "App type and datasource type must match"
    );
    let token = field(app, "token_env")
        .map(|key| std::env::var(key).context("server token environment variable is missing"))
        .transpose()?;
    ensure!(
        token.as_ref().is_none_or(|t| t.len() >= 16),
        "server token must contain at least 16 bytes"
    );
    Ok(Server { provider, token })
}
pub fn validate(state: &AppState, host: &str) -> Result<()> {
    let settings = settings(state)?;
    allowed_origins(state)?;
    let local = host == "localhost"
        || host
            .parse::<std::net::IpAddr>()
            .is_ok_and(|ip| ip.is_loopback());
    ensure!(local || settings.token.is_some(), "non-loopback storage servers require token_env authentication (use HTTPS at a reverse proxy)");
    Ok(())
}
pub fn router(state: AppState) -> Result<Router> {
    let mut router = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/v1/execute", post(handle))
        .layer(DefaultBodyLimit::max(MAX_PACKET))
        .with_state(Arc::new(settings(&state)?));
    if let Some(origins) = allowed_origins(&state)? {
        router = router.layer(
            tower_http::cors::CorsLayer::new()
                .allow_origin(origins)
                .allow_methods([axum::http::Method::POST, axum::http::Method::GET])
                .allow_headers([
                    axum::http::header::CONTENT_TYPE,
                    axum::http::header::ACCEPT,
                    axum::http::header::AUTHORIZATION,
                ]),
        );
    }
    Ok(router)
}
async fn handle(State(server): State<Arc<Server>>, headers: HeaderMap, body: Bytes) -> Response {
    let packed = headers
        .get("content-type")
        .and_then(|h| h.to_str().ok())
        .is_some_and(|v| v == "application/msgpack");
    let encode_packed =
        headers.get("accept").and_then(|h| h.to_str().ok()) == Some("application/msgpack");
    let result: Result<serde_json::Value> = async {
        if let Some(token) = &server.token {
            let provided = headers
                .get("authorization")
                .and_then(|h| h.to_str().ok())
                .and_then(|h| h.strip_prefix("Bearer "))
                .unwrap_or("");
            // Compare all token bytes before deciding, avoiding early-prefix comparison.
            let mismatch = provided.len() ^ token.len();
            let mismatch = token.bytes().enumerate().fold(mismatch, |a, (i, b)| {
                a | (b ^ provided.as_bytes().get(i).copied().unwrap_or(0)) as usize
            });
            ensure!(mismatch == 0, "unauthorized");
        }
        let request: Request = if packed {
            rmp_serde::from_slice(&body).context("invalid MessagePack packet")?
        } else {
            serde_json::from_slice(&body).context("invalid JSON packet")?
        };
        server.provider.request(request).await
    }
    .await;
    let (status, reply) = match result {
        Ok(value) => (StatusCode::OK, json!({"ok": true, "data": value})),
        Err(error) => {
            let message = error.to_string();
            let (status, code) = if message == "unauthorized" {
                (StatusCode::UNAUTHORIZED, "unauthorized")
            } else if message.starts_with("conflict:") {
                (StatusCode::CONFLICT, "conflict")
            } else if message.starts_with("busy:") {
                (StatusCode::TOO_MANY_REQUESTS, "busy")
            } else {
                (StatusCode::BAD_REQUEST, "storage_error")
            };
            (
                status,
                json!({"ok": false, "error": {"code": code, "message": message}}),
            )
        }
    };
    let (mime, bytes) = if encode_packed {
        (
            "application/msgpack",
            rmp_serde::to_vec_named(&reply).expect("response"),
        )
    } else {
        (
            "application/json",
            serde_json::to_vec(&reply).expect("response"),
        )
    };
    if bytes.len() > MAX_PACKET {
        return (
            StatusCode::PAYLOAD_TOO_LARGE,
            "storage response exceeds 8 MiB",
        )
            .into_response();
    }
    (status, [("content-type", mime)], bytes).into_response()
}
