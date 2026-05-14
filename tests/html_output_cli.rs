use assert_cmd::Command;
use std::fs;
use std::path::Path;
use tempfile::tempdir;

fn vectrune_cmd() -> Command {
    Command::new(assert_cmd::cargo::cargo_bin!("vectrune"))
}

fn write_file(path: &Path, content: &str) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("parent directories should be created");
    }
    fs::write(path, content).expect("file should be written");
}

#[test]
fn html_output_renders_root_mounted_rune_web_page() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let script = manifest_dir.join("examples/i18n_demo.rune");

    let assert = vectrune_cmd()
        .current_dir(manifest_dir)
        .arg(script)
        .arg("-o")
        .arg("html")
        .assert()
        .success();

    let stdout = String::from_utf8_lossy(&assert.get_output().stdout);
    assert!(stdout.contains("<!DOCTYPE html>"));
    assert!(stdout.contains("Vectrune i18n Demo"));
    assert!(stdout.contains("Welcome to Vectrune"));
}

#[test]
fn html_output_rejects_non_matching_rune_web_path() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let script = manifest_dir.join("examples/i18n_demo.rune");

    let assert = vectrune_cmd()
        .current_dir(manifest_dir)
        .arg(script)
        .arg("-o")
        .arg("html")
        .arg("--path")
        .arg("/docs")
        .assert()
        .failure();

    let stderr = String::from_utf8_lossy(&assert.get_output().stderr);
    assert!(stderr.contains("Requested path '/docs' is not mounted by @Frontend path '/'"));
}

#[test]
fn html_output_renders_non_root_mounted_rune_web_page() {
    let temp = tempdir().expect("tempdir");
    let rune_path = temp.path().join("app.rune");
    write_file(
        &rune_path,
        r#"#!RUNE

@App
name = Rune Web Mount Test
type = REST

@Frontend
type = rune-web
path = /app
page = home

@Page/home
title = Mounted Page
view:
    div:
        h1 "Hello from mounted rune-web"
"#,
    );

    let assert = vectrune_cmd()
        .current_dir(temp.path())
        .arg(&rune_path)
        .arg("-o")
        .arg("html")
        .arg("--path")
        .arg("/app")
        .assert()
        .success();

    let stdout = String::from_utf8_lossy(&assert.get_output().stdout);
    assert!(stdout.contains("<!DOCTYPE html>"));
    assert!(stdout.contains("Mounted Page"));
    assert!(stdout.contains("Hello from mounted rune-web"));
}

#[test]
fn html_output_renders_static_html_for_nested_path() {
    let temp = tempdir().expect("tempdir");
    let rune_path = temp.path().join("app.rune");
    write_file(
        &rune_path,
        r#"#!RUNE

@App
type = REST

@Frontend
type = static
path = /site
src = public
"#,
    );
    write_file(
        &temp.path().join("public/index.html"),
        "<html><body>Root static page</body></html>",
    );
    write_file(
        &temp.path().join("public/docs/index.html"),
        "<html><body>Nested docs page</body></html>",
    );
    write_file(&temp.path().join("public/app.js"), "console.log('asset');");

    let assert = vectrune_cmd()
        .current_dir(temp.path())
        .arg(&rune_path)
        .arg("-o")
        .arg("html")
        .arg("--path")
        .arg("/site/docs")
        .assert()
        .success();

    let stdout = String::from_utf8_lossy(&assert.get_output().stdout);
    assert!(stdout.contains("Nested docs page"));
}

#[test]
fn html_output_rejects_non_html_static_asset_paths() {
    let temp = tempdir().expect("tempdir");
    let rune_path = temp.path().join("app.rune");
    write_file(
        &rune_path,
        r#"#!RUNE

@App
type = REST

@Frontend
type = static
path = /site
src = public
"#,
    );
    write_file(&temp.path().join("public/app.js"), "console.log('asset');");

    let assert = vectrune_cmd()
        .current_dir(temp.path())
        .arg(&rune_path)
        .arg("-o")
        .arg("html")
        .arg("--path")
        .arg("/site/app.js")
        .assert()
        .failure();

    let stderr = String::from_utf8_lossy(&assert.get_output().stderr);
    assert!(stderr.contains("Resolved path '/site/app.js' is not an HTML file"));
}

#[test]
fn html_output_requires_supported_frontend_type() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let script = manifest_dir.join("examples/book_graphql.rune");

    let assert = vectrune_cmd()
        .current_dir(manifest_dir)
        .arg(script)
        .arg("-o")
        .arg("html")
        .assert()
        .failure();

    let stderr = String::from_utf8_lossy(&assert.get_output().stderr);
    assert!(
        stderr.contains("-o html requires @Frontend type = rune-web or @Frontend type = static")
    );
}


