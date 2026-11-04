use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use rune_runtime::{
    apps::build_app_router,
    core::{extract_data_sources, extract_schemas, AppState},
    rune_parser::parse_rune,
};
use serde_json::{json, Value};
use std::sync::Arc;
use tower::ServiceExt;

async fn report_app() -> axum::Router {
    let doc = parse_rune(include_str!("../examples/sales_report.rune")).unwrap();
    let state = AppState {
        schemas: Arc::new(extract_schemas(&doc)),
        data_sources: Arc::new(extract_data_sources(&doc)),
        doc: Arc::new(doc),
        path: std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("examples"),
    };
    build_app_router(state).await
}

#[tokio::test]
async fn csv_totals_averages_and_counts_work_through_native_routes() {
    let app = report_app().await;
    for (path, expected) in [
        (
            "/report",
            json!([{"group":"West","count":2,"sum":150.0},{"group":"East","count":2,"sum":100.0},{"group":"South","count":1,"sum":30.0}]),
        ),
        (
            "/averages",
            json!([{"group":"West","count":2,"avg":75.0},{"group":"East","count":2,"avg":50.0},{"group":"South","count":1,"avg":30.0}]),
        ),
        (
            "/counts",
            json!([{"group":"West","count":2},{"group":"East","count":2},{"group":"South","count":1}]),
        ),
    ] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK, "{path}");
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let actual: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(actual, expected, "{path}");
    }
}

#[tokio::test]
async fn accepts_json_requests_and_stops_on_invalid_values() {
    let app = report_app().await;
    for (body, status, expected) in [
        (
            r#"[{"region":"Online","amount":20},{"region":"Online","amount":5}]"#,
            StatusCode::OK,
            "",
        ),
        (
            r#"[{"region":"Online","amount":"bad"}]"#,
            StatusCode::INTERNAL_SERVER_ERROR,
            "must be a finite number",
        ),
        (
            r#"{"region":"Online"}"#,
            StatusCode::INTERNAL_SERVER_ERROR,
            "source must be a list",
        ),
    ] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/report")
                    .header("content-type", "application/json")
                    .body(Body::from(body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), status);
        let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let text = String::from_utf8(bytes.to_vec()).unwrap();
        if status == StatusCode::OK {
            assert_eq!(
                serde_json::from_str::<Value>(&text).unwrap(),
                json!([{"group":"Online","count":2,"sum":25.0}])
            );
        } else {
            assert!(text.contains(expected), "{text}");
        }
    }
}
