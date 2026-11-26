//! Build-time Rune-Web compilation followed by a Capacitor platform build.
//! Templates are embedded so an installed vectrune binary needs no source checkout.
use anyhow::{bail, ensure, Context, Result};
use std::fs;
use std::path::Path;
use std::process::Command;

#[path = "mobile_web_templates.rs"]
mod templates;

const MARKER: &str = ".rune-mobile-web-project";
const IDE_MARKER: &str = ".rune-mobile-web-ide";

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Build,
    Prepare,
    Export,
}

pub async fn build(source: &Path, target: &str, output: Option<&Path>, mode: Mode) -> Result<()> {
    ensure!(
        matches!(target, "android" | "ios"),
        "Unsupported mobile platform: {target}"
    );
    let source = source
        .canonicalize()
        .with_context(|| format!("Cannot read Rune source {}", source.display()))?;
    let doc = crate::rune_parser::load_rune_document_from_path(&source)?;
    let frontend = doc
        .get_section("Frontend")
        .context("--build requires @Frontend type = rune-mobile-web")?;
    ensure!(frontend.kv.get("type").and_then(|value| value.as_str()) == Some("rune-mobile-web"),
        "--build requires @Frontend type = rune-mobile-web; rune-mobile is reserved for the future native runtime");
    let route = frontend
        .kv
        .get("path")
        .and_then(|value| value.as_str())
        .unwrap_or("/");
    let route = if route == "%ROOT%" { "/" } else { route };
    let html = crate::apps::rune_web::render_html_for_path(&doc, route).await?;
    let html = html.replace(
        "initial-scale=1.0\"",
        "initial-scale=1.0, viewport-fit=cover\"",
    );
    let base = if source.is_dir() {
        source.as_path()
    } else {
        source.parent().unwrap()
    };
    let output = output
        .map(Path::to_path_buf)
        .unwrap_or_else(|| base.join(".vectrune/rune-mobile-web"));
    ensure!(!output.join(IDE_MARKER).exists(),
        "Refusing to replace an editable IDE export at {}; choose a new --build-dir to preserve native edits and signing settings", output.display());
    if mode == Mode::Export && output.exists() && fs::read_dir(&output)?.next().is_some() {
        bail!("Refusing to replace an existing IDE project at {}; choose a new --build-dir to preserve native edits and signing settings", output.display());
    }
    if mode == Mode::Build && target == "ios" {
        ensure!(
            cfg!(target_os = "macos"),
            "iOS builds require macOS with Xcode 26+; use --export ios or --prepare-only to export elsewhere"
        );
    }
    prepare_project(&output, &html)?;
    let output = output.canonicalize()?;
    println!("Prepared Rune Mobile Web project: {}", output.display());
    if mode != Mode::Build {
        let instructions = ide_instructions(target);
        fs::write(output.join("MOBILE_IDE.md"), &instructions)?;
        if mode == Mode::Export {
            fs::write(
                output.join(IDE_MARKER),
                "Editable IDE project; do not regenerate native templates.\n",
            )?;
        }
        println!(
            "IDE setup instructions: {}\n{instructions}",
            output.join("MOBILE_IDE.md").display()
        );
        return Ok(());
    }

    // These commands receive separate arguments, never Rune text interpolated into a shell.
    let mut npm = if cfg!(windows) {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "npm"]);
        cmd
    } else {
        Command::new("npm")
    };
    run(
        npm.args(["ci", "--include=dev"]).current_dir(&output),
        "npm ci (Node.js 22+ and npm are required)",
    )?;
    run(
        Command::new("node")
            .args(["node_modules/@capacitor/cli/bin/capacitor", "sync", target])
            .current_dir(&output),
        "Capacitor sync",
    )?;

    let artifact = if target == "android" {
        let android = output.join("android");
        let mut gradle = if cfg!(windows) {
            let mut cmd = Command::new("cmd");
            cmd.args(["/C", "gradlew.bat"]);
            cmd
        } else {
            let mut cmd = Command::new("sh");
            cmd.arg("./gradlew");
            cmd
        };
        run(
            gradle.arg("assembleDebug").current_dir(&android),
            "Android build (JDK 21 and Android SDK 36 are required)",
        )?;
        android.join("app/build/outputs/apk/debug/app-debug.apk")
    } else {
        run(
            Command::new("xcodebuild")
                .args([
                    "-project",
                    "ios/App/App.xcodeproj",
                    "-scheme",
                    "App",
                    "-configuration",
                    "Debug",
                    "-sdk",
                    "iphonesimulator",
                    "-destination",
                    "generic/platform=iOS Simulator",
                    "-derivedDataPath",
                    "build/ios",
                    "CODE_SIGNING_ALLOWED=NO",
                    "build",
                ])
                .current_dir(&output),
            "iOS Simulator build (Xcode 26+ is required)",
        )?;
        output.join("build/ios/Build/Products/Debug-iphonesimulator/App.app")
    };
    ensure!(
        artifact.exists(),
        "Build command succeeded but the expected artifact is missing: {}",
        artifact.display()
    );
    println!(
        "Built {}: {}",
        if target == "android" {
            "debug APK"
        } else {
            "unsigned iOS Simulator app"
        },
        artifact.display()
    );
    Ok(())
}

fn ide_instructions(target: &str) -> String {
    let (ide, project, signing) = if target == "android" {
        (
            "Android Studio",
            "android/",
            "In Android Studio, set your application ID in app/build.gradle, then use Build > Generate Signed App Bundle or APK to select/create a keystore and produce a signed AAB or APK.\nhttps://developer.android.com/studio/publish/app-signing",
        )
    } else {
        (
            "Xcode (on macOS)",
            "ios/App/App.xcodeproj",
            "In Xcode, select the App target, set your bundle identifier and development team under Signing & Capabilities, then build for a device or use Product > Archive for distribution.\nhttps://developer.apple.com/documentation/xcode/preparing-your-app-for-distribution",
        )
    };
    format!(
        r#"# Finish in {ide}

From this exported directory, install Node.js 22+ and run:

```sh
npm ci --include=dev
npx cap sync {target}
npx cap open {target}
```

IDE project: {project}

{signing}

The native IDE and platform SDKs are required on the machine that builds/signs
the app. This export does not contain signing credentials.

Keep the entire exported directory together, including package.json,
package-lock.json, capacitor.config.json and www/. The native projects depend
on these files and installed Node packages.

Treat this export as your editable native project. Generation commands refuse
to replace this export. To update Rune UI without replacing native settings,
export HTML with vectrune <source> -o html into www/index.html, then run
npx cap sync {target}. Keep viewport-fit=cover in the viewport meta tag when
updating HTML for safe areas.
"#
    )
}

fn prepare_project(output: &Path, html: &str) -> Result<()> {
    if output.exists() && !output.join(MARKER).is_file() && fs::read_dir(output)?.next().is_some() {
        bail!(
            "Refusing to overwrite non-generated directory {}; choose an empty --build-dir",
            output.display()
        );
    }
    fs::create_dir_all(output)?;
    fs::write(
        output.join(MARKER),
        "Generated by vectrune --build; template files are replaced on each build.\n",
    )?;
    for (relative, data) in templates::FILES {
        let destination = output.join(relative);
        fs::create_dir_all(destination.parent().unwrap())?;
        fs::write(destination, data)?;
    }
    // The development shell's build script needs a checkout. Generated projects
    // already contain compiled HTML and should only expose native tooling commands.
    let package_path = output.join("package.json");
    let mut package: serde_json::Value = serde_json::from_slice(&fs::read(&package_path)?)?;
    package["scripts"] = serde_json::json!({
        "sync": "cap sync",
        "android": "cap open android",
        "ios": "cap open ios"
    });
    fs::write(package_path, serde_json::to_vec_pretty(&package)?)?;
    fs::create_dir_all(output.join("www"))?;
    fs::write(output.join("www/index.html"), html)?;
    Ok(())
}

fn run(command: &mut Command, description: &str) -> Result<()> {
    let status = command
        .status()
        .with_context(|| format!("Cannot start {description}"))?;
    ensure!(
        status.success(),
        "{description} failed ({status}); see tool output above"
    );
    Ok(())
}
