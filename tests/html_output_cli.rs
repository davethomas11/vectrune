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
fn html_output_localized_routes_render_the_destination_before_javascript() {
    let temp = tempdir().unwrap();
    let path = temp.path().join("app.rune");
    write_file(&path, r#"
@Frontend
type = rune-web
path = %ROOT%
page = index
locale = en_us
locale_paths = { "fr": "/fr/" }

@SEO
title = Default title

@SEO/lesson
title = %i18n.Copy.lesson%

@Navigator
url bound to activePage
mode = path

@Page/index
logic = app
view:
    main:
        match activePage:
            "home" -> Home
            "lesson" -> Lesson
            _ -> Missing

@Component/Home
view:
    h1 "{i18n.Copy.home}"

@Component/Lesson
view:
    h1 "{i18n.Copy.lesson}"

@Component/Missing
view:
    h1 "Missing"

@Logic/app
state:
    activePage = "home"

@I18N/en_us
Copy {
    home = "Welcome"
    lesson = "English lesson"
}


@I18N/fr
Copy {
    home = "Bienvenue"
    lesson = "Leçon française"
}
"#);
    for (request, heading) in [("/", "Welcome"), ("/fr/", "Bienvenue"), ("/fr/lesson", "Leçon française"), ("/lesson", "English lesson"), ("/fr/missing", "Missing")] {
        let result = vectrune_cmd().arg(&path).args(["-o", "html", "--path", request]).assert().success();
        let html = String::from_utf8_lossy(&result.get_output().stdout);
        assert!(html.contains(&format!("<h1>{}</h1>", heading)), "Missing SSR heading for {request}");
        if request.ends_with("/lesson") { assert!(html.contains(&format!("<title>{}</title>", heading))); }
        if request.starts_with("/fr/") { assert!(html.contains("lang=\"fr\"")); }
    }
}

#[test]
fn static_route_export_includes_home_for_navigation_from_deep_links() {
    let temp = tempdir().unwrap();
    let path = temp.path().join("app.rune");
    write_file(&path, r#"
@Frontend
type = rune-web
path = %ROOT%
page = index

@Navigator
url bound to activePage
mode = path

@Optimizer
dynamic_xhr = on

@Page/index
state:
    activePage = "home"
view:
    main:
        match activePage:
            "home" -> h1 "Welcome home"
            "lesson" -> h1 "A lesson"
"#);
    let chunks = temp.path().join("chunks");
    vectrune_cmd().arg(&path).args(["-o", "html", "--path", "/lesson", "--chunks-dir"])
        .arg(&chunks).assert().success();
    assert!(fs::read_to_string(chunks.join("home.json")).unwrap().contains("Welcome home"));
    assert!(chunks.join("lesson.json").is_file());
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


