//! Developer tooling for Pixel-3D games on Apple TV.
use crate::apps::pixel3d::{self, tv};
use crate::rune_parser::load_rune_document_from_path;
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
        .about("Experimental Apple TV tools: check and bundle Pixel-3D games, build and run existing tvOS Xcode projects (macOS only)")
        .subcommand_required(true)
        .subcommand(
            Command::new("check")
                .about("Report whether a Pixel-3D game can run in the Apple TV runtime")
                .arg(Arg::new("game").value_name("GAME.rune").required(true)),
        )
        .subcommand(
            Command::new("build-runtime")
                .about("Build the Apple TV runtime libraries for device and simulator")
                .arg(
                    Arg::new("source")
                        .long("source")
                        .value_name("DIRECTORY")
                        .default_value("native/tvos/runtime")
                        .help("Rune TV runtime crate from a Vectrune checkout"),
                )
                .arg(
                    Arg::new("output")
                        .long("output")
                        .short('o')
                        .value_name("DIRECTORY")
                        .required(true)
                        .help("Receives appletvos/ and appletvsimulator/ libraries"),
                ),
        )
        .subcommand(
            Command::new("bundle")
                .about("Generate an Xcode project that wraps a Pixel-3D game for Apple TV")
                .arg(Arg::new("game").value_name("GAME.rune").required(true))
                .arg(
                    Arg::new("output")
                        .long("output")
                        .short('o')
                        .value_name("DIRECTORY")
                        .required(true)
                        .help("Project directory to create or refresh"),
                )
                .arg(
                    Arg::new("name")
                        .long("name")
                        .value_name("NAME")
                        .help("App and scheme name (default: the game file name)"),
                )
                .arg(
                    Arg::new("bundle-id")
                        .long("bundle-id")
                        .value_name("ID")
                        .help("Bundle identifier (default: dev.vectrune.games.<name>)"),
                )
                .arg(
                    Arg::new("team")
                        .long("team")
                        .value_name("TEAMID")
                        .help("Apple development team ID used for signing"),
                )
                .arg(
                    Arg::new("runtime-libs")
                        .long("runtime-libs")
                        .value_name("DIRECTORY")
                        .help("Output of `tvos build-runtime`; built from --runtime-source when omitted"),
                )
                .arg(
                    Arg::new("runtime-source")
                        .long("runtime-source")
                        .value_name("DIRECTORY")
                        .default_value("native/tvos/runtime")
                        .help("Rune TV runtime crate used when --runtime-libs is omitted"),
                ),
        )
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

const HOST_SOURCE: &str = include_str!("../../native/tvos/host/RuneTVHost.swift");
const INFO_PLIST: &str = include_str!("../../native/tvos/template/Info.plist");
const PROJECT_TEMPLATE: &str = include_str!("../../native/tvos/template/project.pbxproj");
const MIN_TVOS: &str = "17.0";
const RUNTIME_LIBRARY: &str = "libvectrune_tvos_runtime.a";
const RUNTIME_SLICES: [(&str, &str); 2] = [
    ("aarch64-apple-tvos", "appletvos"),
    ("aarch64-apple-tvos-sim", "appletvsimulator"),
];

fn compile_game(path: &str) -> Result<(pixel3d::Game3D, tv::SupportReport)> {
    let doc = load_rune_document_from_path(Path::new(path))
        .map_err(|e| anyhow::anyhow!("Cannot load {path}: {e}"))?;
    let game = pixel3d::compile(&doc).with_context(|| format!("{path} is not a valid Pixel-3D game"))?;
    let report = tv::support_report(&game.config);
    Ok((game, report))
}

fn print_report(report: &tv::SupportReport) {
    for item in &report.unsupported {
        println!("  unsupported: {item}");
    }
    for item in &report.warnings {
        println!("  note: {item}");
    }
}

fn app_name(args: &ArgMatches, game: &str) -> Result<String> {
    let name = match args.get_one::<String>("name") {
        Some(name) => name.clone(),
        None => Path::new(game)
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or_default()
            .to_string(),
    };
    ensure!(
        name.len() <= 40
            && name.starts_with(|c: char| c.is_ascii_alphabetic())
            && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-'),
        "App name must start with a letter and use only ASCII letters, digits, '-' and '_' (got {name:?}); pass --name"
    );
    Ok(name)
}

fn bundle_id(args: &ArgMatches, name: &str) -> Result<String> {
    let id = match args.get_one::<String>("bundle-id") {
        Some(id) => id.clone(),
        None => format!(
            "dev.vectrune.games.{}",
            name.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_lowercase()
        ),
    };
    let valid = id.contains('.')
        && id.split('.').all(|part| {
            !part.is_empty()
                && part.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
                && !part.starts_with('-')
        });
    ensure!(valid, "Bundle identifier must be dotted ASCII segments like com.example.game (got {id:?})");
    Ok(id)
}

fn team_setting(args: &ArgMatches) -> Result<String> {
    match args.get_one::<String>("team") {
        None => Ok(String::new()),
        Some(team) => {
            ensure!(
                team.len() == 10 && team.bytes().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()),
                "Team must be a 10-character Apple team ID"
            );
            Ok(format!("\n\t\t\t\tDEVELOPMENT_TEAM = {team};"))
        }
    }
}

fn build_runtime(source: &Path, output: &Path) -> Result<()> {
    let manifest = source.join("Cargo.toml");
    ensure!(
        manifest.is_file(),
        "Rune TV runtime crate not found at {}; run from a Vectrune checkout or pass --source/--runtime-libs",
        source.display()
    );
    for (target, slice) in RUNTIME_SLICES {
        run_process(
            Process::new("cargo")
                .args(["build", "--release", "--target", target, "--manifest-path"])
                .arg(&manifest)
                .env("TVOS_DEPLOYMENT_TARGET", MIN_TVOS),
            &format!("Rune TV runtime build for {target} (install it with `rustup target add {target}`)"),
        )?;
        let built = source.join("target").join(target).join("release").join(RUNTIME_LIBRARY);
        let destination = output.join(slice);
        std::fs::create_dir_all(&destination)?;
        std::fs::copy(&built, destination.join(RUNTIME_LIBRARY))
            .with_context(|| format!("Cannot copy {}", built.display()))?;
    }
    Ok(())
}

fn copy_runtime(libs: &Path, output: &Path) -> Result<()> {
    for (_, slice) in RUNTIME_SLICES {
        let from = libs.join(slice).join(RUNTIME_LIBRARY);
        ensure!(from.is_file(), "Missing runtime library {}", from.display());
        let destination = output.join(slice);
        std::fs::create_dir_all(&destination)?;
        std::fs::copy(&from, destination.join(RUNTIME_LIBRARY))?;
    }
    Ok(())
}

pub fn run(args: &ArgMatches) -> Result<()> {
    if let Some(("check", args)) = args.subcommand() {
        let game = required(args, "game");
        let (_, report) = compile_game(game)?;
        if report.unsupported.is_empty() {
            println!("{game}: supported by the Apple TV runtime");
            print_report(&report);
            println!("  Dynamic features (tethers, camera poses) are still checked when the scene runs.");
            return Ok(());
        }
        println!("{game}: not supported by the Apple TV runtime");
        print_report(&report);
        bail!("Game uses features the Apple TV runtime does not support");
    }
    ensure!(
        cfg!(target_os = "macos"),
        "tvOS tooling requires macOS and Xcode"
    );
    match args.subcommand() {
        Some(("build-runtime", args)) => {
            let output = Path::new(required(args, "output"));
            build_runtime(Path::new(required(args, "source")), output)?;
            println!("Runtime libraries written to {}", output.display());
            Ok(())
        }
        Some(("bundle", args)) => {
            let game_path = required(args, "game");
            let (game, report) = compile_game(game_path)?;
            if !report.unsupported.is_empty() {
                print_report(&report);
                bail!("{game_path} uses features the Apple TV runtime does not support; run `vectrune tvos check` for details");
            }
            let name = app_name(args, game_path)?;
            let id = bundle_id(args, &name)?;
            let team = team_setting(args)?;
            let output = Path::new(required(args, "output"));
            let runtime = output.join("Runtime");
            match args.get_one::<String>("runtime-libs") {
                Some(libs) => copy_runtime(Path::new(libs), &runtime)?,
                None => build_runtime(Path::new(required(args, "runtime-source")), &runtime)?,
            }
            let project = output.join(format!("{name}.xcodeproj"));
            for directory in [output.join("Sources"), output.join("Resources"), project.clone()] {
                std::fs::create_dir_all(&directory)?;
            }
            std::fs::write(output.join("Sources/RuneTVHost.swift"), HOST_SOURCE)?;
            std::fs::write(output.join("Resources/game.js"), &game.script)?;
            std::fs::write(output.join("Info.plist"), INFO_PLIST.replace("{{NAME}}", &name))?;
            std::fs::write(
                project.join("project.pbxproj"),
                PROJECT_TEMPLATE
                    .replace("{{NAME}}", &name)
                    .replace("{{BUNDLE_ID}}", &id)
                    .replace("{{TEAM_SETTING}}", &team),
            )?;
            print_report(&report);
            println!("Created {}", project.display());
            println!(
                "Next: vectrune tvos build --project {} --scheme {name} --device ID --derived-data ./build/tvos",
                project.display()
            );
            if team.is_empty() {
                println!("Set a development team in Xcode or pass --team before building for a device.");
            }
            Ok(())
        }
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
