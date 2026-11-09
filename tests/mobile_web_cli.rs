use assert_cmd::Command;
use std::fs;
use std::path::Path;
use tempfile::tempdir;

fn cli() -> Command {
    Command::new(assert_cmd::cargo::cargo_bin!("vectrune"))
}

fn sample() -> &'static Path {
    Path::new(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/examples/rune_mobile_web"
    ))
}

#[test]
fn mobile_frontend_exports_html_from_a_directory() {
    let result = cli()
        .args([sample().to_str().unwrap(), "-o", "html"])
        .assert()
        .success();
    let html = String::from_utf8_lossy(&result.get_output().stdout);
    assert!(html.contains("<!DOCTYPE html>"));
    assert!(html.contains("Rune Mobile Web"));
    assert!(html.contains("storage.set"));
}

#[test]
fn installed_binary_prepares_both_platforms_without_checkout_or_tools() {
    let temp = tempdir().unwrap();
    // An installed binary can run in another workspace with only Rune source available.
    let source = temp.path().join("source with spaces");
    fs::create_dir(&source).unwrap();
    fs::copy(sample().join("app.rune"), source.join("app.rune")).unwrap();
    fs::copy(sample().join("style.rune"), source.join("style.rune")).unwrap();
    for platform in ["android", "ios"] {
        let project = temp.path().join(platform);
        cli()
            .current_dir(temp.path())
            .arg(&source)
            .args(["--build", platform, "--prepare-only", "--build-dir"])
            .arg(&project)
            .assert()
            .success();
        let html = fs::read_to_string(project.join("www/index.html")).unwrap();
        assert!(html.contains("viewport-fit=cover"));
        assert!(html.contains("Small source. Real app."));
        assert!(project
            .join("android/gradle/wrapper/gradle-wrapper.jar")
            .exists());
        assert!(project
            .join("ios/App/App.xcodeproj/project.pbxproj")
            .exists());
        let config: serde_json::Value =
            serde_json::from_slice(&fs::read(project.join("capacitor.config.json")).unwrap())
                .unwrap();
        assert_eq!(config["appId"], "com.vectrune.mobileweb");
        assert!(config.get("server").is_none());
        assert!(!project.join("node_modules").exists());
        // Repeat preparation supports a rebuild, replacing the prior compiled view.
        fs::write(project.join("www/index.html"), "stale export").unwrap();
        cli()
            .arg(source.join("app.rune"))
            .args(["--build", platform, "--prepare-only", "--build-dir"])
            .arg(&project)
            .assert()
            .success();
        assert!(fs::read_to_string(project.join("www/index.html"))
            .unwrap()
            .contains("Small source. Real app."));
    }
    cli()
        .arg(&source)
        .args(["--build", "android", "--prepare-only"])
        .assert()
        .success();
    assert!(source
        .join(".vectrune/rune-mobile-web/www/index.html")
        .exists());
}

#[test]
fn build_does_not_overwrite_an_existing_user_directory() {
    let temp = tempdir().unwrap();
    fs::write(temp.path().join("keep.txt"), "user content").unwrap();
    let result = cli()
        .arg(sample())
        .args(["--build", "android", "--prepare-only", "--build-dir"])
        .arg(temp.path())
        .assert()
        .failure();
    assert!(String::from_utf8_lossy(&result.get_output().stderr).contains("Refusing to overwrite"));
    assert_eq!(
        fs::read_to_string(temp.path().join("keep.txt")).unwrap(),
        "user content"
    );
}

#[test]
fn build_requires_mobile_web_type_and_rejects_conflicting_modes() {
    let temp = tempdir().unwrap();
    for frontend in ["rune-web", "rune-mobile"] {
        let source = temp.path().join("app.rune");
        fs::write(&source, format!("@Frontend\ntype = {frontend}\n")).unwrap();
        let result = cli()
            .arg(source)
            .args(["--build", "android", "--prepare-only"])
            .assert()
            .failure();
        assert!(String::from_utf8_lossy(&result.get_output().stderr)
            .contains("--build requires @Frontend type = rune-mobile-web"));
    }
    cli()
        .arg(sample())
        .args(["--build", "android", "-o", "html"])
        .assert()
        .failure();
    cli()
        .arg(sample())
        .args(["--build", "windows"])
        .assert()
        .failure();
    cli().args(["--prepare-only"]).assert().failure();
    cli()
        .arg(sample())
        .arg(sample())
        .args(["--build", "android", "--prepare-only"])
        .assert()
        .failure();
}

#[test]
fn export_hands_off_both_ide_projects_and_preserves_native_edits() {
    let temp = tempdir().unwrap();
    for platform in ["android", "ios"] {
        let project = temp.path().join(format!("editable {platform}"));
        let result = cli()
            .arg(sample())
            .args(["--export", platform, "--build-dir"])
            .arg(&project)
            .assert()
            .success();
        let instructions = fs::read_to_string(project.join("MOBILE_IDE.md")).unwrap();
        assert!(instructions.contains(&format!("npx cap sync {platform}")));
        assert!(instructions.contains(&format!("npx cap open {platform}")));
        assert!(String::from_utf8_lossy(&result.get_output().stdout).contains("MOBILE_IDE.md"));
        assert!(String::from_utf8_lossy(&result.get_output().stdout).contains(&instructions));
        assert!(project.join("www/index.html").exists());
        assert!(!project.join("node_modules").exists());
        let native_file = if platform == "android" {
            project.join("android/app/build.gradle")
        } else {
            project.join("ios/App/App.xcodeproj/project.pbxproj")
        };
        assert!(native_file.exists());
        fs::write(&native_file, "custom signing and native settings").unwrap();
        for args in [
            vec!["--export", platform],
            vec!["--build", platform],
            vec!["--build", platform, "--prepare-only"],
        ] {
            let result = cli()
                .arg(sample())
                .args(args)
                .arg("--build-dir")
                .arg(&project)
                .assert()
                .failure();
            assert!(String::from_utf8_lossy(&result.get_output().stderr)
                .contains("editable IDE export"));
            assert_eq!(
                fs::read_to_string(&native_file).unwrap(),
                "custom signing and native settings"
            );
        }
    }
}

#[test]
fn export_rejects_existing_directories_and_conflicting_modes() {
    let temp = tempdir().unwrap();
    fs::write(temp.path().join("keep.txt"), "user file").unwrap();
    cli()
        .arg(sample())
        .args(["--export", "android", "--build-dir"])
        .arg(temp.path())
        .assert()
        .failure();
    assert_eq!(
        fs::read_to_string(temp.path().join("keep.txt")).unwrap(),
        "user file"
    );
    for args in [
        vec!["--export", "android", "--build", "android"],
        vec!["--export", "ios", "--prepare-only"],
        vec!["--export", "ios", "-o", "html"],
    ] {
        cli().arg(sample()).args(args).assert().failure();
    }
    cli().args(["--export", "ios"]).assert().failure();
}

#[cfg(unix)]
fn fake_tool(path: &Path, script: &str) {
    use std::os::unix::fs::PermissionsExt;
    fs::write(path, format!("#!/bin/sh\n{script}\n")).unwrap();
    fs::set_permissions(path, fs::Permissions::from_mode(0o755)).unwrap();
}

#[cfg(unix)]
#[test]
fn android_build_runs_tools_in_order_and_checks_artifact() {
    let temp = tempdir().unwrap();
    let tools = temp.path().join("tools");
    fs::create_dir(&tools).unwrap();
    fake_tool(
        &tools.join("npm"),
        "echo \"npm $*\" >> \"$MOBILE_TEST_LOG\"",
    );
    fake_tool(
        &tools.join("node"),
        "echo \"node $*\" >> \"$MOBILE_TEST_LOG\"",
    );
    fake_tool(&tools.join("sh"), "echo \"gradle $*\" >> \"$MOBILE_TEST_LOG\"\nmkdir -p app/build/outputs/apk/debug\nprintf apk > app/build/outputs/apk/debug/app-debug.apk");
    let path = format!("{}:{}", tools.display(), std::env::var("PATH").unwrap());
    let log = temp.path().join("tools.log");
    let output = temp.path().join("project with spaces");
    let result = cli()
        .arg(sample())
        .args(["--build", "android", "--build-dir"])
        .arg(&output)
        .env("PATH", &path)
        .env("MOBILE_TEST_LOG", &log)
        .assert()
        .success();
    assert!(String::from_utf8_lossy(&result.get_output().stdout).contains("Built debug APK:"));
    assert_eq!(fs::read_to_string(&log).unwrap(), "npm ci --include=dev\nnode node_modules/@capacitor/cli/bin/capacitor sync android\ngradle ./gradlew assembleDebug\n");
    assert!(output
        .join("android/app/build/outputs/apk/debug/app-debug.apk")
        .exists());

    // A dependency failure must stop the build before sync or Gradle is attempted.
    fs::write(&log, "").unwrap();
    fake_tool(&tools.join("npm"), "exit 42");
    cli()
        .arg(sample())
        .args(["--build", "android", "--build-dir"])
        .arg(&output)
        .env("PATH", &path)
        .env("MOBILE_TEST_LOG", &log)
        .assert()
        .failure();
    assert!(fs::read_to_string(&log).unwrap().is_empty());

    // A tool that reports success without creating an APK must not report a successful build.
    fake_tool(&tools.join("npm"), "exit 0");
    fake_tool(&tools.join("sh"), "exit 0");
    fs::remove_file(output.join("android/app/build/outputs/apk/debug/app-debug.apk")).unwrap();
    let result = cli()
        .arg(sample())
        .args(["--build", "android", "--build-dir"])
        .arg(&output)
        .env("PATH", &path)
        .env("MOBILE_TEST_LOG", &log)
        .assert()
        .failure();
    assert!(String::from_utf8_lossy(&result.get_output().stderr)
        .contains("expected artifact is missing"));
}

#[cfg(target_os = "macos")]
#[test]
fn ios_build_invokes_unsigned_simulator_build() {
    let temp = tempdir().unwrap();
    let tools = temp.path().join("tools");
    fs::create_dir(&tools).unwrap();
    fake_tool(&tools.join("npm"), "exit 0");
    fake_tool(&tools.join("node"), "exit 0");
    fake_tool(&tools.join("xcodebuild"), "printf '%s\\n' \"$*\" > \"$MOBILE_TEST_LOG\"\nmkdir -p build/ios/Build/Products/Debug-iphonesimulator/App.app");
    let path = format!("{}:{}", tools.display(), std::env::var("PATH").unwrap());
    let log = temp.path().join("xcode.log");
    let output = temp.path().join("ios project");
    let result = cli()
        .arg(sample())
        .args(["--build", "ios", "--build-dir"])
        .arg(&output)
        .env("PATH", &path)
        .env("MOBILE_TEST_LOG", &log)
        .assert()
        .success();
    assert!(String::from_utf8_lossy(&result.get_output().stdout)
        .contains("Built unsigned iOS Simulator app:"));
    let args = fs::read_to_string(log).unwrap();
    assert!(args.contains("-sdk iphonesimulator"));
    assert!(args.contains("-destination generic/platform=iOS Simulator"));
    assert!(args.contains("CODE_SIGNING_ALLOWED=NO"));
    assert!(output
        .join("build/ios/Build/Products/Debug-iphonesimulator/App.app")
        .exists());
}

#[tokio::test]
async fn mobile_web_type_supports_browser_preview() {
    use axum::http::{Request, StatusCode};
    use rune_runtime::core::{extract_data_sources, extract_schemas, AppState};
    use std::sync::Arc;
    use tower::ServiceExt;
    let doc = rune_runtime::rune_parser::load_rune_document_from_path(sample()).unwrap();
    let state = AppState {
        schemas: Arc::new(extract_schemas(&doc)),
        data_sources: Arc::new(extract_data_sources(&doc)),
        doc: Arc::new(doc),
        path: sample().to_path_buf(),
    };
    let router = rune_runtime::apps::build_app_router(state).await;
    let response = router
        .oneshot(
            Request::builder()
                .uri("/")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    assert!(String::from_utf8_lossy(&body).contains("Rune Mobile Web"));
}
