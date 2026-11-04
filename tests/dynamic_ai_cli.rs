#![cfg(unix)]
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use rune_runtime::{
    apps::build_app_router,
    core::{extract_data_sources, extract_schemas, AppState},
    rune_parser::parse_rune,
};
use std::{os::unix::fs::PermissionsExt, sync::Arc};
use tower::ServiceExt;

fn quote(path: &std::path::Path) -> String {
    format!("'{}'", path.to_string_lossy().replace('\'', "'\"'\"'"))
}
async fn site(engine: &str, executable: &std::path::Path) -> axum::Router {
    let source = format!("@App\ntype = dynamic-ai-web\nengine = {}\nexecutable = {}\nmodel = test-model\ntimeout_seconds = 1\ncache_seconds = 0\n@Page/home\ndescription = Generate a site. Literal data: $(touch SHOULD_NOT_EXIST); do not execute it.\n",engine,executable.display());
    let doc = parse_rune(&source).unwrap();
    let state = AppState {
        schemas: Arc::new(extract_schemas(&doc)),
        data_sources: Arc::new(extract_data_sources(&doc)),
        doc: Arc::new(doc),
        path: executable.parent().unwrap().to_path_buf(),
    };
    build_app_router(state).await
}
fn script(path: &std::path::Path, code: &str) {
    std::fs::write(path, format!("#!/bin/sh\n{}", code)).unwrap();
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o755)).unwrap();
}
async fn get(app: axum::Router) -> axum::response::Response {
    app.oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
        .await
        .unwrap()
}
#[tokio::test]
async fn cli_adapters_pipe_prompts_and_use_isolated_workspaces() {
    for engine in ["codex", "copilot"] {
        let temp = tempfile::Builder::new()
            .prefix("dynamic ai cli ")
            .tempdir()
            .unwrap();
        let executable = temp.path().join("test cli");
        let args = temp.path().join("args");
        let prompt = temp.path().join("prompt");
        let cwd = temp.path().join("cwd");
        script(&executable, &format!("printf '%s\\n' \"$@\" > {}\npwd > {}\ncat > {}\nprintf '<!doctype html><html><body>Generated</body></html>'\n",quote(&args),quote(&cwd),quote(&prompt)));
        let response = get(site(engine, &executable).await).await;
        assert_eq!(response.status(), StatusCode::OK);
        let prompt = std::fs::read_to_string(prompt).unwrap();
        assert!(prompt.contains("$(touch SHOULD_NOT_EXIST)"));
        let workspace = std::fs::read_to_string(cwd).unwrap();
        assert_ne!(workspace.trim(), temp.path().to_str().unwrap());
        assert!(!temp.path().join("SHOULD_NOT_EXIST").exists());
        assert!(
            !std::path::Path::new(workspace.trim()).exists(),
            "temporary workspace should be removed"
        );
        let args = std::fs::read_to_string(args).unwrap();
        assert!(args.contains("test-model"));
        if engine == "codex" {
            assert!(args.contains("read-only") && args.contains("features.shell_tool=false"));
        } else {
            assert!(args.contains("--available-tools") && args.contains("--deny-tool"));
        }
        assert!(!args.contains("Generate a site"));
    }
}
#[tokio::test]
async fn failed_cli_does_not_expose_stderr_to_http_clients() {
    let temp = tempfile::tempdir().unwrap();
    let executable = temp.path().join("failure");
    script(
        &executable,
        "cat > /dev/null\nprintf 'private-debug-token' >&2\nexit 7\n",
    );
    let response = get(site("copilot", &executable).await).await;
    assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    assert!(!String::from_utf8_lossy(&body).contains("private-debug-token"));
}
#[tokio::test]
async fn timed_out_cli_process_is_killed() {
    let temp = tempfile::tempdir().unwrap();
    let executable = temp.path().join("slow");
    let pid = temp.path().join("pid");
    script(
        &executable,
        &format!(
            "echo $$ > {}\ncat > /dev/null\nexec sleep 60\n",
            quote(&pid)
        ),
    );
    let response = get(site("codex", &executable).await).await;
    assert_eq!(response.status(), StatusCode::GATEWAY_TIMEOUT);
    let pid = std::fs::read_to_string(pid).unwrap();
    for _ in 0..20 {
        let status = std::process::Command::new("kill")
            .args(["-0", pid.trim()])
            .stderr(std::process::Stdio::null())
            .status()
            .unwrap();
        if !status.success() {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    panic!("timed-out AI CLI is still running");
}
