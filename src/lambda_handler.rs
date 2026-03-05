use lambda_runtime::{Error, LambdaEvent};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::OnceCell;
use axum::{body::Body, http::{Request, Method, HeaderMap, HeaderValue, Uri}, Router};
use tower::ServiceExt;
use crate::core::{extract_schemas, extract_data_sources};
use crate::rune_ast::RuneDocument;
use crate::rune_parser::parse_rune;

pub static RUNE_DOC: OnceCell<Result<Arc<RuneDocument>, String>> = OnceCell::const_new();
pub static ROUTER: OnceCell<Option<Router>> = OnceCell::const_new();

pub mod lambda_handler {
    use super::*;

    pub async fn lambda_handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
        let (event, _context) = event.into_parts();
        let doc_result = RUNE_DOC.get().expect("Rune doc not loaded");
        let router_opt = ROUTER.get().expect("Router not loaded");
        if let Err(ref err_msg) = doc_result {
            return Ok(json!({
                "statusCode": 500,
                "headers": { "Content-Type": "application/json" },
                "body": format!("Vectrune Lambda failed to start: {}", err_msg)
            }));
        }
        let router = match router_opt {
            Some(r) => r,
            None => {
                return Ok(json!({
                    "statusCode": 500,
                    "headers": { "Content-Type": "application/json" },
                    "body": "Vectrune Lambda failed to start: router unavailable"
                }));
            }
        };
        let method = event["httpMethod"].as_str().unwrap_or("GET").to_uppercase();
        let path = event["path"].as_str().unwrap_or("/");
        let query = event["queryStringParameters"].as_object().map(|q| {
            q.iter()
                .filter_map(|(k, v)| v.as_str().map(|v| format!("{}={}", k, v)))
                .collect::<Vec<_>>()
                .join("&")
        });
        let uri = if let Some(q) = &query {
            format!("{}?{}", path, q)
        } else {
            path.to_string()
        };
        let uri: Uri = uri.parse().unwrap_or_else(|_| Uri::from_static("/"));
        let mut req_builder = Request::builder()
            .method(Method::from_bytes(method.as_bytes()).unwrap_or(Method::GET))
            .uri(uri);
        if let Some(hdrs) = event["headers"].as_object() {
            for (k, v) in hdrs {
                if let Some(s) = v.as_str() {
                    req_builder = req_builder.header(
                        k,
                        s,
                    );
                }
            }
        }
        let body = event["body"].as_str().map(|s| Body::from(s.to_owned())).unwrap_or_else(|| Body::empty());
        let req = req_builder.body(body).unwrap();
        let resp = router.clone().oneshot(req).await.unwrap();
        let status_code = resp.status().as_u16();
        let headers = resp.headers().iter().map(|(k, v)| (k.to_string(), serde_json::Value::String(v.to_str().unwrap_or("").to_string()))).collect::<serde_json::Map<_, _>>();
        let bytes = axum::body::to_bytes(resp.into_body(), 1024 * 1024).await.unwrap_or_default();
        let body = String::from_utf8(bytes.to_vec()).unwrap_or_default();
        Ok(json!({
            "statusCode": status_code,
            "headers": headers,
            "body": body
        }))
    }
}

pub async fn lambda_cold_start(rune_path: &str) {
    use std::fs;
    use std::sync::Arc;
    use crate::core::{extract_schemas, extract_data_sources};
    use crate::rune_parser::parse_rune;
    let script_content = match fs::read_to_string(rune_path) {
        Ok(content) => content,
        Err(e) => {
            let _ = RUNE_DOC.set(Err(format!("Failed to read rune file: {}", e)));
            let _ = ROUTER.set(None);
            return;
        }
    };
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
    let _ = RUNE_DOC.set(doc_result);
    let _ = ROUTER.set(router);
}
