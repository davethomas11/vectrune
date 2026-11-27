use assert_cmd::Command;

fn cli() -> Command {
    Command::new(assert_cmd::cargo::cargo_bin!("vectrune"))
}

#[test]
fn tvos_help_describes_existing_projects_and_required_arguments() {
    let output = cli()
        .args(["tvos", "--help"])
        .assert()
        .success()
        .get_output()
        .stdout
        .clone();
    let help = String::from_utf8(output).unwrap();
    assert!(help.contains("existing tvOS Xcode projects"));
    assert!(help.contains("devices") && help.contains("build") && help.contains("run"));
    for args in [vec!["tvos", "build"], vec!["tvos", "run"], vec!["tvos"]] {
        cli().args(args).assert().failure();
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use std::{fs, os::unix::fs::PermissionsExt, path::Path};
    use tempfile::tempdir;

    fn tool(directory: &Path, name: &str, body: &str) {
        let path = directory.join(name);
        fs::write(&path, format!("#!/bin/sh\n{body}\n")).unwrap();
        fs::set_permissions(path, fs::Permissions::from_mode(0o755)).unwrap();
    }

    #[test]
    fn build_and_launch_use_arguments_without_shell_interpolation() {
        let temp = tempdir().unwrap();
        let tools = temp.path().join("tools");
        fs::create_dir(&tools).unwrap();
        let log = temp.path().join("calls");
        let body = "printf '%s\\n' \"$0\" \"$@\" '---' >> \"$TV_TEST_LOG\"";
        tool(&tools, "xcodebuild", body);
        tool(&tools, "xcrun", body);
        tool(&tools, "plutil", "printf 'com.example.test\\n'");
        let project = temp.path().join("project space.xcodeproj");
        let app = temp.path().join("game space.app");
        let derived = temp.path().join("derived space");
        fs::create_dir(&project).unwrap();
        fs::create_dir(&app).unwrap();
        fs::write(app.join("Info.plist"), "test").unwrap();
        let device = "1234-ABCD";
        let mut build = cli();
        build
            .env("PATH", &tools)
            .env("TV_TEST_LOG", &log)
            .args(["tvos", "build", "--project"])
            .arg(&project)
            .args(["--scheme", "A scheme", "--device", device, "--derived-data"])
            .arg(&derived)
            .assert()
            .success();
        let mut run = cli();
        run.env("PATH", &tools)
            .env("TV_TEST_LOG", &log)
            .args(["tvos", "run", "--app"])
            .arg(&app)
            .args(["--device", device])
            .assert()
            .success();
        let calls = fs::read_to_string(&log).unwrap();
        assert!(calls.contains(&format!(
            "-project\n{}\n-scheme\nA scheme\n",
            project.canonicalize().unwrap().display()
        )));
        assert!(calls.contains(&format!(
            "platform=tvOS,id={device}\n-derivedDataPath\n{}\nbuild\n",
            derived.display()
        )));
        assert!(calls.contains(&format!(
            "install\napp\n--device\n{device}\n{}\n",
            app.canonicalize().unwrap().display()
        )));
        assert!(calls.contains("process\nlaunch\n--device\n1234-ABCD\ncom.example.test\n"));
    }

    #[test]
    fn invalid_bundle_device_and_failed_install_stop_before_launch() {
        let temp = tempdir().unwrap();
        let tools = temp.path().join("tools");
        fs::create_dir(&tools).unwrap();
        let app = temp.path().join("game.app");
        fs::create_dir(&app).unwrap();
        fs::write(app.join("Info.plist"), "test").unwrap();
        let log = temp.path().join("calls");
        tool(&tools, "plutil", "printf 'com.example.test\\n'");
        tool(
            &tools,
            "xcrun",
            "printf '%s\\n' \"$@\" >> \"$TV_TEST_LOG\"; exit 1",
        );
        cli()
            .env("PATH", &tools)
            .env("TV_TEST_LOG", &log)
            .args(["tvos", "run", "--app"])
            .arg(&app)
            .args(["--device", "1234,platform=other"])
            .assert()
            .failure();
        assert!(!log.exists());
        cli()
            .env("PATH", &tools)
            .env("TV_TEST_LOG", &log)
            .args(["tvos", "run", "--app"])
            .arg(&app)
            .args(["--device", "1234"])
            .assert()
            .failure();
        assert!(!fs::read_to_string(&log).unwrap().contains("launch"));
        tool(&tools, "plutil", "printf 'not a bundle\\n'");
        fs::remove_file(&log).unwrap();
        cli()
            .env("PATH", &tools)
            .env("TV_TEST_LOG", &log)
            .args(["tvos", "run", "--app"])
            .arg(&app)
            .args(["--device", "1234"])
            .assert()
            .failure();
        assert!(!log.exists());
    }

    #[test]
    fn device_listing_and_build_errors_are_reported() {
        let temp = tempdir().unwrap();
        let tools = temp.path().join("tools");
        fs::create_dir(&tools).unwrap();
        let project = temp.path().join("game.xcodeproj");
        fs::create_dir(&project).unwrap();
        tool(&tools, "xcrun", "printf 'paired devices\\n'");
        tool(&tools, "xcodebuild", "exit 7");
        let output = cli()
            .env("PATH", &tools)
            .args(["tvos", "devices"])
            .assert()
            .success()
            .get_output()
            .stdout
            .clone();
        assert!(String::from_utf8_lossy(&output).contains("paired devices"));
        let output = cli()
            .env("PATH", &tools)
            .args(["tvos", "build", "--project"])
            .arg(&project)
            .args(["--scheme", "Game", "--device", "1234", "--derived-data"])
            .arg(temp.path().join("build"))
            .assert()
            .failure()
            .get_output()
            .stderr
            .clone();
        assert!(String::from_utf8_lossy(&output).contains("tvOS Xcode build failed"));
        cli()
            .env("PATH", &tools)
            .args(["tvos", "build", "--project"])
            .arg(temp.path().join("missing.xcodeproj"))
            .args(["--scheme", "Game", "--device", "1234", "--derived-data"])
            .arg(temp.path().join("build"))
            .assert()
            .failure();
    }
}

#[cfg(not(target_os = "macos"))]
#[test]
fn tvos_tools_fail_explicitly_off_macos() {
    let output = cli()
        .args(["tvos", "devices"])
        .assert()
        .failure()
        .get_output()
        .stderr
        .clone();
    assert!(String::from_utf8_lossy(&output).contains("requires macOS"));
}
