use axum::http::{Request, StatusCode};
use axum::{Router, body::Body};
use tower::ServiceExt;
use std::fs;
use std::path::PathBuf;

use rune_runtime::rune_parser::parse_rune;
use rune_runtime::core::{AppState, extract_schemas, extract_data_sources};
use rune_runtime::apps::build_app_router;
use std::sync::Arc;

fn write_temp_users_csv(rows: &[(&str, &str, &str)]) -> PathBuf {
    let mut path = std::env::temp_dir();
    path.push(format!("rune_users_{}.csv", uuid::Uuid::new_v4()));
    let mut content = String::from("id,name,email\n");
    for (id, name, email) in rows {
        content.push_str(&format!("{},{},{}\n", id, name, email));
    }
    fs::write(&path, content).expect("write csv");
    path
}

async fn build_router_from_str(contents: &str) -> Router {
    let doc = parse_rune(contents).expect("parse_rune should succeed");
    let path = PathBuf::from("test_user_api.rune");
    let state = AppState {
        doc: Arc::new(doc.clone()),
        schemas: Arc::new(extract_schemas(&doc)),
        data_sources: Arc::new(extract_data_sources(&doc)),
        path,
    };
    build_app_router(state, false).await
}

#[tokio::test]
async fn get_users_returns_array() {
    let csv_path = write_temp_users_csv(&[("1", "Alice", "a@example.com"), ("2", "Bob", "b@example.com")]);
    let csv = csv_path.to_string_lossy();
    let script = format!(
        r#"#!RUNE

@App
name = User API
type = REST
version = 1.0

@Route/GET /users
run:
    users = csv.read "{csv}"
    respond 200 users
"#
    );

    let app = build_router_from_str(&script).await;

    let resp = app
        .oneshot(Request::builder().uri("/users").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
    let text = String::from_utf8(body_bytes.to_vec()).unwrap();
    let val: serde_json::Value = serde_json::from_str(&text).unwrap();
    assert!(val.is_array());
    assert_eq!(val.as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn get_user_by_id_not_found() {
    let csv_path = write_temp_users_csv(&[("1", "Alice", "a@example.com")]);
    let csv = csv_path.to_string_lossy();
    let script = format!(
        r#"#!RUNE

@App
name = User API
type = REST
version = 1.0

@Route/GET /users/{{id}}
run:
    users = csv.read "{csv}"
    user = users.find it.id == id
    if user == null:
        respond 404 "User not found"
    respond 200 user
"#
    );

    let app = build_router_from_str(&script).await;
    let resp = app
        .oneshot(Request::builder().uri("/users/999").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn put_user_mismatched_id_triggers_validate() {
    let csv_path = write_temp_users_csv(&[("1", "Alice", "a@example.com")]);
    let csv = csv_path.to_string_lossy();
    let script = format!(
        r#"#!RUNE

@App
name = User API
type = REST
version = 1.0

@Schema/User
id = number
name = string
email = string

@Route/PUT /users/{{id}}
run:
    parse-json
    validate body #User
    validate body.id == path.params.id "ID in body must match ID in path"
    users = csv.read "{csv}"
    index = users.find-index it.id == id
    if index == -1:
        respond 404 "User not found"
    users[index] = body
    respond 200 "OK"
"#
    );
    let app = build_router_from_str(&script).await;
    let body = serde_json::json!({"id": 2, "name": "Bob", "email": "b@example.com"}).to_string();
    let req = Request::builder()
        .method("PUT")
        .uri("/users/1")
        .header("content-type", "application/json")
        .body(Body::from(body))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn get_user_by_id_found() {
    let csv_path = write_temp_users_csv(&[("5", "Alice", "a@example.com"),("6", "Bob", "")]);
    let csv = csv_path.to_string_lossy();
    let script = format!(
        r#"#!RUNE

@App
name = User API
type = REST
version = 1.0

@Route/GET /users/{{id}}
run:
    users = csv.read "{csv}"
    user = users.find it.id == id
    if user == null:
        respond 404 "User not found"
    respond 200 user
"#
    );
    let app = build_router_from_str(&script).await;
    let resp = app
        .oneshot(Request::builder().uri("/users/5").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
    let text = String::from_utf8(body_bytes.to_vec()).unwrap();
    let val: serde_json::Value = serde_json::from_str(&text).unwrap();
    assert_eq!(val["name"], "Alice");
    assert_eq!(val["email"], "a@example.com");
}

#[tokio::test]
async fn put_user_success() {
    let csv_path = write_temp_users_csv(&[("1", "Alice", "a@example.com")]);
    let csv = csv_path.to_string_lossy();
    let script = format!(
        r#"#!RUNE

@App
name = User API
type = REST
version = 1.0

@Schema/User
id = number
name = string
email = string

@Route/PUT /users/{{id}}
run:
    parse-json
    validate body #User
    validate body.id == path.params.id "ID in body must match ID in path"
    users = csv.read "{csv}"
    index = users.find-index it.id == id
    if index == -1:
        respond 404 "User not found"
    users[index] = body
    respond 200 "OK"
"#
    );
    let app = build_router_from_str(&script).await;
    let body = serde_json::json!({"id": 1, "name": "Alice Updated", "email": "alice@new.com"}).to_string();
    let req = Request::builder()
        .method("PUT")
        .uri("/users/1")
        .header("content-type", "application/json")
        .body(Body::from(body))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
    let text = String::from_utf8(body_bytes.to_vec()).unwrap();
    assert_eq!(text, "OK");
}

#[tokio::test]
async fn post_user_success() {
    let csv_path = write_temp_users_csv(&[("1", "Alice", "a@example.com")]);
    let csv = csv_path.to_string_lossy();
    let script = format!(
        r#"#!RUNE

@App
name = User API
type = REST
version = 1.0

@Schema/User
id = number
name = string
email = string

@Route/POST /users
run:
    parse-json
    validate body #User
    users = csv.read "{csv}"
    user = users.find it.id == body.id
    if user != null:
        respond 400 "User exists already"
    log "Adding new user"
    csv.append "{csv}" body
    respond 201 "User added"
"#
    );
    let app = build_router_from_str(&script).await;
    let body = serde_json::json!({"id": 2, "name": "Bob", "email": "b@example.com"}).to_string();
    let req = Request::builder()
        .method("POST")
        .uri("/users")
        .header("content-type", "application/json")
        .body(Body::from(body))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);
    let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
    let text = String::from_utf8(body_bytes.to_vec()).unwrap();
    assert_eq!(text, "User added");
}

#[tokio::test]
async fn post_user_duplicate() {
    let csv_path = write_temp_users_csv(&[("1", "Alice", "a@example.com")]);
    let csv = csv_path.to_string_lossy();
    let script = format!(
        r#"#!RUNE

@App
name = User API
type = REST
version = 1.0

@Schema/User
id = number
name = string
email = string

@Route/POST /users
run:
    parse-json
    validate body #User
    users = csv.read "{csv}"
    user = users.find it.id == body.id
    if user != null:
        respond 400 "User exists already"
    log "Adding new user"
    csv.append "{csv}" body
    respond 201 "User added"
"#
    );
    let app = build_router_from_str(&script).await;
    let body = serde_json::json!({"id": 1, "name": "Alice", "email": "a@example.com"}).to_string();
    let req = Request::builder()
        .method("POST")
        .uri("/users")
        .header("content-type", "application/json")
        .body(Body::from(body))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
    let text = String::from_utf8(body_bytes.to_vec()).unwrap();
    assert_eq!(text, "User exists already");
}