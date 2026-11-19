use axum::{
    body::{to_bytes, Body},
    http::Request as HttpRequest,
};
use rune_runtime::{
    core::{extract_data_sources, AppState},
    rune_parser::parse_rune,
    storage::{self, Request},
};
use serde_json::{json, Value};
use std::{collections::HashMap, sync::Arc};
use tower::ServiceExt;
fn state(path: &std::path::Path, kind: &str) -> AppState {
    let doc = parse_rune(&format!("@App\ntype = {kind}\nsource = {}\n@DataSource/main\ntype = rune-db\nnative_path = {}\n@Datasource/activity\ntype = vect-event\nstore = main\n", if kind == "rune-db" {"main"} else {"activity"}, path.display())).unwrap();
    let sources = extract_data_sources(&doc);
    AppState {
        doc: Arc::new(doc),
        data_sources: Arc::new(sources),
        schemas: Arc::new(HashMap::new()),
        path: path.parent().unwrap().into(),
    }
}
#[tokio::test]
async fn json_and_messagepack_use_one_core_and_event_server_restricts_records() {
    let dir = tempfile::tempdir().unwrap();
    let app = storage::server::router(state(&dir.path().join("main.rdb"), "rune-db")).unwrap();
    let put = json!({"op":"put","collection":"notes","key":"one","value":{"count":0,"large":"x".repeat(16384)}});
    let response = app
        .clone()
        .oneshot(
            HttpRequest::post("/v1/execute")
                .header("content-type", "application/json")
                .body(Body::from(put.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let packet: Request = serde_json::from_value(
        json!({"op":"increment","collection":"notes","key":"one","path":["count"],"by":1}),
    )
    .unwrap();
    let response = app
        .clone()
        .oneshot(
            HttpRequest::post("/v1/execute")
                .header("content-type", "application/msgpack")
                .header("accept", "application/msgpack")
                .body(Body::from(rmp_serde::to_vec_named(&packet).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let bytes = to_bytes(response.into_body(), 1024).await.unwrap();
    let reply: Value = rmp_serde::from_slice(&bytes).unwrap();
    assert_eq!(reply["data"]["results"][0]["patch"]["value"], 1);
    assert!(reply["data"]["results"][0].get("value").is_none());
    let events =
        storage::server::router(state(&dir.path().join("main.rdb"), "vect-event")).unwrap();
    let response = events
        .oneshot(
            HttpRequest::post("/v1/execute")
                .body(Body::from(
                    json!({"op":"get","collection":"notes","key":"one"}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), 400);
}

#[tokio::test]
async fn standalone_server_cli_remote_adapter_and_replay_work_together() {
    let folder = tempfile::tempdir().unwrap();
    let app = storage::server::router(state(&folder.path().join("main.rdb"), "rune-db")).unwrap();
    let socket = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let endpoint = format!("http://{}", socket.local_addr().unwrap());
    let server = tokio::spawn(async move {
        axum::serve(socket, app).await.unwrap();
    });
    let exe = assert_cmd::cargo::cargo_bin!("vectrune").to_path_buf();
    let cli_endpoint = endpoint.clone();
    let output = tokio::task::spawn_blocking(move || {
        std::process::Command::new(exe)
            .args([
                "db",
                "put",
                "notes",
                "one",
                "--value",
                "{\"count\":1}",
                "--endpoint",
                &cli_endpoint,
            ])
            .output()
            .unwrap()
    })
    .await
    .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let packet =
        serde_json::from_value(json!({"op":"get","collection":"notes","key":"one"})).unwrap();
    let value = storage::provider::remote(&endpoint, None, &packet)
        .await
        .unwrap();
    assert_eq!(value["value"]["count"], 1);
    let cli_endpoint = endpoint.clone();
    let output = tokio::task::spawn_blocking(move || {
        std::process::Command::new(assert_cmd::cargo::cargo_bin!("vectrune"))
            .args([
                "db", "get-many", "notes", "missing", "one", "one", "--endpoint", &cli_endpoint,
            ])
            .output()
            .unwrap()
    })
    .await
    .unwrap();
    assert!(output.status.success(), "{}", String::from_utf8_lossy(&output.stderr));
    let many: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(many, json!([null, value, value]));
    let doc = parse_rune(&format!(
        "@Datasource/remote\ntype = rune-db\nmode = remote\nendpoint = {endpoint}"
    ))
    .unwrap();
    let provider = storage::provider::Provider::open(&doc, folder.path(), "remote").unwrap();
    let events = provider
        .request(serde_json::from_value(json!({"op":"read","stream":"$changes"})).unwrap())
        .await
        .unwrap();
    assert_eq!(events["events"].as_array().unwrap().len(), 1);
    server.abort();
}

#[tokio::test]
async fn standalone_authentication_and_conflicts_are_explicit() {
    let dir = tempfile::tempdir().unwrap();
    let original = state(&dir.path().join("main.rdb"), "rune-db");
    assert!(storage::server::validate(&original, "0.0.0.0").is_err());
    let mut doc = (*original.doc).clone();
    let env_key = format!("RUNE_STORAGE_TEST_{}", uuid::Uuid::new_v4().simple());
    std::env::set_var(&env_key, "a-long-test-token-123456");
    doc.sections[0].kv.insert(
        "token_env".into(),
        rune_runtime::rune_ast::Value::String(env_key.clone()),
    );
    let mut secured = original;
    secured.doc = Arc::new(doc);
    let app = storage::server::router(secured).unwrap();
    std::env::remove_var(&env_key);
    let packet = json!({"op":"get","collection":"x","key":"y"}).to_string();
    let denied = app
        .clone()
        .oneshot(
            HttpRequest::post("/v1/execute")
                .body(Body::from(packet.clone()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(denied.status(), 401);
    let allowed = app
        .oneshot(
            HttpRequest::post("/v1/execute")
                .header("authorization", "Bearer a-long-test-token-123456")
                .body(Body::from(packet))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(allowed.status(), 200);
}

#[tokio::test]
async fn cors_accepts_each_explicit_origin_and_rejects_other_origins() {
    let dir = tempfile::tempdir().unwrap();
    let mut state = state(&dir.path().join("cors.rdb"), "rune-db");
    let mut doc = (*state.doc).clone();
    doc.sections[0].kv.insert(
        "allow_origins".into(),
        rune_runtime::rune_ast::Value::String(
            r#"["http://127.0.0.1:3000", "http://localhost:3000"]"#.into(),
        ),
    );
    state.doc = Arc::new(doc);
    let app = storage::server::router(state).unwrap();
    for origin in [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://untrusted.example",
    ] {
        let response = app
            .clone()
            .oneshot(
                HttpRequest::builder()
                    .method("OPTIONS")
                    .uri("/v1/execute")
                    .header("origin", origin)
                    .header("access-control-request-method", "POST")
                    .header("access-control-request-headers", "content-type,accept")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        let allowed = response
            .headers()
            .get("access-control-allow-origin")
            .and_then(|h| h.to_str().ok());
        assert_eq!(
            allowed,
            if origin.contains("untrusted") {
                None
            } else {
                Some(origin)
            }
        );
    }
}

#[tokio::test]
async fn same_server_hosts_frontend_and_storage_without_exposing_database_files() {
    let dir = tempfile::tempdir().unwrap();
    let source =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("examples/data/storage/fullstack");
    for entry in std::fs::read_dir(source).unwrap() {
        let path = entry.unwrap().path();
        if path.is_file() {
            std::fs::copy(&path, dir.path().join(path.file_name().unwrap())).unwrap();
        }
    }
    let doc = rune_runtime::rune_parser::load_rune_document_from_path(
        &dir.path().join("single-server.rune"),
    )
    .unwrap();
    let state = AppState {
        data_sources: Arc::new(extract_data_sources(&doc)),
        doc: Arc::new(doc),
        schemas: Arc::new(HashMap::new()),
        path: dir.path().into(),
    };
    storage::server::validate(&state, "127.0.0.1").unwrap();
    let app = rune_runtime::apps::build_app_router(state).await;
    let response = app
        .clone()
        .oneshot(HttpRequest::get("/").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(response.status(), 200);
    let html = String::from_utf8(
        to_bytes(response.into_body(), 2 * 1024 * 1024)
            .await
            .unwrap()
            .to_vec(),
    )
    .unwrap();
    assert!(html.contains("One note. A shared source of truth."));
    assert!(html.contains(r#""endpoint":"/""#));
    assert!(!html.contains("/assets/favicon.png"));
    assert!(!html.contains(".vectrune/notes.rdb"));
    let response = app.clone().oneshot(HttpRequest::post("/v1/execute").body(Body::from(
        json!({"op":"put","collection":"notes","key":"hello","value":{"title":"Shared"}}).to_string())).unwrap()).await.unwrap();
    assert_eq!(response.status(), 200);
    for path in ["/assets/.vectrune/notes.rdb", "/assets/single-server.rune"] {
        assert_eq!(
            app.clone()
                .oneshot(HttpRequest::get(path).body(Body::empty()).unwrap())
                .await
                .unwrap()
                .status(),
            404
        );
    }
}
