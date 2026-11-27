//! Developer tooling for existing tvOS Xcode projects.
use anyhow::{bail, ensure, Context, Result};
use clap::{Arg, ArgMatches, Command};
use std::path::{Path, PathBuf};
use std::process::Command as Process;

pub fn command() -> Command {
    let device = || {
        Arg::new("device")
            .long("device")
            .value_name("ID")
            .required(true)
            .help("Paired Apple TV device identifier from `vectrune tvos devices`")
    };
    Command::new("tvos")
        .about("Experimental tools for existing tvOS Xcode projects (macOS only)")
        .subcommand_required(true)
        .subcommand(Command::new("devices").about("List Apple devices known to Xcode"))
        .subcommand(
            Command::new("build")
                .about("Build an existing signed Xcode project for a paired Apple TV")
                .arg(
                    Arg::new("project")
                        .long("project")
                        .value_name("XCODEPROJ")
                        .required(true)
                        .help("Existing .xcodeproj directory"),
                )
                .arg(
                    Arg::new("scheme")
                        .long("scheme")
                        .value_name("NAME")
                        .required(true)
                        .help("Xcode scheme to build"),
                )
                .arg(device())
                .arg(
                    Arg::new("derived-data")
                        .long("derived-data")
                        .value_name("DIRECTORY")
                        .required(true)
                        .help("Xcode build output directory"),
                ),
        )
        .subcommand(
            Command::new("run")
                .about("Install and launch an existing signed tvOS .app on a paired Apple TV")
                .arg(
                    Arg::new("app")
                        .long("app")
                        .value_name("APP")
                        .required(true)
                        .help("Signed .app bundle to install"),
                )
                .arg(device()),
        )
}

fn required<'a>(matches: &'a ArgMatches, name: &str) -> &'a str {
    matches
        .get_one::<String>(name)
        .expect("required CLI argument")
}

fn device_id(matches: &ArgMatches) -> Result<&str> {
    let id = required(matches, "device");
    ensure!(
        !id.is_empty() && id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-'),
        "Device must be an identifier from `vectrune tvos devices`"
    );
    Ok(id)
}

fn existing_bundle(path: &str, extension: &str) -> Result<PathBuf> {
    let path = Path::new(path);
    ensure!(
        path.extension().is_some_and(|ext| ext == extension) && path.is_dir(),
        "Expected an existing .{extension} directory: {}",
        path.display()
    );
    path.canonicalize()
        .with_context(|| format!("Cannot resolve {}", path.display()))
}

fn run_process(command: &mut Process, label: &str) -> Result<()> {
    let status = command.status().with_context(|| {
        format!("Could not start {label}; install and select Xcode command-line tools")
    })?;
    ensure!(status.success(), "{label} failed with {status}");
    Ok(())
}

pub fn run(args: &ArgMatches) -> Result<()> {
    ensure!(
        cfg!(target_os = "macos"),
        "tvOS tooling requires macOS and Xcode"
    );
    match args.subcommand() {
        Some(("devices", _)) => run_process(
            Process::new("xcrun").args(["devicectl", "list", "devices"]),
            "Apple device listing",
        ),
        Some(("build", args)) => {
            let project = existing_bundle(required(args, "project"), "xcodeproj")?;
            let scheme = required(args, "scheme");
            let device = device_id(args)?;
            ensure!(!scheme.trim().is_empty(), "Scheme cannot be empty");
            let destination = format!("platform=tvOS,id={device}");
            let derived = Path::new(required(args, "derived-data"));
            ensure!(
                !derived.as_os_str().is_empty(),
                "Derived data directory cannot be empty"
            );
            run_process(
                Process::new("xcodebuild")
                    .arg("-quiet")
                    .arg("-project")
                    .arg(&project)
                    .arg("-scheme")
                    .arg(scheme)
                    .args(["-configuration", "Release", "-destination"])
                    .arg(destination)
                    .arg("-derivedDataPath")
                    .arg(derived)
                    .arg("build"),
                "tvOS Xcode build",
            )?;
            println!("Xcode build output: {}", derived.display());
            Ok(())
        }
        Some(("run", args)) => {
            let app = existing_bundle(required(args, "app"), "app")?;
            let info = app.join("Info.plist");
            ensure!(
                info.is_file(),
                "App bundle has no Info.plist: {}",
                app.display()
            );
            let device = device_id(args)?;
            let output = Process::new("plutil")
                .args(["-extract", "CFBundleIdentifier", "raw", "-o", "-", "--"])
                .arg(&info)
                .output()
                .context("Could not read the app bundle identifier with plutil")?;
            ensure!(
                output.status.success(),
                "Could not read CFBundleIdentifier from {}: {}",
                info.display(),
                String::from_utf8_lossy(&output.stderr).trim()
            );
            let bundle = std::str::from_utf8(&output.stdout)
                .context("Bundle identifier is not UTF-8")?
                .trim();
            ensure!(
                !bundle.is_empty()
                    && bundle
                        .bytes()
                        .all(|c| c.is_ascii_alphanumeric() || c == b'.' || c == b'-'),
                "App has an invalid CFBundleIdentifier"
            );
            run_process(
                Process::new("xcrun")
                    .args(["devicectl", "device", "install", "app", "--device"])
                    .arg(device)
                    .arg(&app),
                "Apple TV app installation",
            )?;
            run_process(
                Process::new("xcrun")
                    .args(["devicectl", "device", "process", "launch", "--device"])
                    .arg(device)
                    .arg(bundle),
                "Apple TV app launch",
            )
        }
        _ => bail!("A tvOS subcommand is required"),
    }
}
