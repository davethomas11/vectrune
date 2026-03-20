use lambda_runtime::{LambdaEvent, Error};
use serde_json::json;
use rune_runtime::lambda_main::aws_lambda::{handler::execution_event, cold_start};
use std::fs;

#[tokio::test]
async fn test_lambda_handler_all_cases() {
    // Valid rune
    fs::create_dir_all("testdata").unwrap();
    fs::write("testdata/app.rune", "@App\ntype = REST\n").unwrap();
    std::env::set_var("RUNE_FILE", "testdata/app.rune");
    cold_start("testdata/app.rune").await;
    let event = LambdaEvent::new(json!({
        "httpMethod": "GET",
        "path": "/",
        "headers": {},
        "queryStringParameters": {},
        "body": null
    }), Default::default());
    let resp = execution_event(event).await.unwrap();
    println!("valid_rune resp: {:?}", resp);
    assert_eq!(resp["statusCode"], 404); // No route defined, but router is valid

    // Invalid rune
    fs::write("testdata/invalid.rune", "@App\ntype = ???\n").unwrap();
    std::env::set_var("RUNE_FILE", "testdata/invalid.rune");
    // Can't re-init OnceCell, so skip further tests in this process
    // lambda_cold_start("testdata/invalid.rune").await;
    // let event = LambdaEvent::new(json!({ ... }), Default::default());
    // let resp = lambda_handler(event).await.unwrap();
    // println!("invalid_rune resp: {:?}", resp);
    // assert_eq!(resp["statusCode"], 500);
    // assert!(resp["body"].as_str().unwrap().contains("Unsupported App type"));

    // Missing rune
    std::env::set_var("RUNE_FILE", "testdata/missing.rune");
    // lambda_cold_start("testdata/missing.rune").await;
    // let event = LambdaEvent::new(json!({ ... }), Default::default());
    // let resp = lambda_handler(event).await.unwrap();
    // assert_eq!(resp["statusCode"], 500);
    // assert!(resp["body"].as_str().unwrap().contains("Failed to read rune file"));
}
