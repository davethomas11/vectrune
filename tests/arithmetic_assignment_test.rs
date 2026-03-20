use rune_runtime::builtins::{Context};
use rune_runtime::core::execute_steps_inner;
use rune_runtime::core::AppState;
use rune_runtime::rune_ast;
use rune_runtime::rune_ast::Value;

#[tokio::test]
async fn test_arithmetic_assignment() {
    let app_state = AppState {
        doc: std::sync::Arc::new(rune_ast::RuneDocument { sections: vec![] }),
        schemas: std::sync::Arc::new(std::collections::HashMap::new()),
        data_sources: std::sync::Arc::new(std::collections::HashMap::new()),
        path: std::path::PathBuf::new(),
    };
    let mut ctx = Context::new();
    let steps = [Value::String("j = 1 + 1".to_string())];

    let result = execute_steps_inner(app_state, &steps, &mut ctx).await;
    assert_eq!(result, Some((200, "2".to_string())));
    let j_val = ctx.get("j").unwrap();
    // Should be either integer or float 2
    match j_val {
        serde_json::Value::Number(n) => {
            assert!(n.as_i64() == Some(2) || n.as_f64() == Some(2.0));
        }
        _ => panic!("j is not a number: {:?}", j_val),
    }
}
