//! Developer tooling for Pixel-3D games on Apple TV.
use super::tvos_config::{self, TvConfig};
use super::tvos_icon;
use super::tvos_tools as tools;
use crate::apps::pixel3d::{self, tv};
use crate::rune_parser::load_rune_document_from_path;
use anyhow::{bail, ensure, Context, Result};
use clap::{Arg, ArgAction, ArgMatches, Command};
use std::io::BufRead;
use std::path::{Path, PathBuf};
use std::process::{Command as Process, Stdio};
use std::time::{Duration, Instant, SystemTime};

const HOST_SOURCE: &str = include_str!("../../native/tvos/host/RuneTVHost.swift");
const INFO_PLIST: &str = include_str!("../../native/tvos/template/Info.plist");
const PROJECT_TEMPLATE: &str = include_str!("../../native/tvos/template/project.pbxproj");
const MIN_TVOS: &str = "17.0";
const RUNTIME_LIBRARY: &str = "libvectrune_tvos_runtime.a";
const RUNTIME_SLICES: [(&str, &str); 2] = [
    ("aarch64-apple-tvos", "appletvos"),
    ("aarch64-apple-tvos-sim", "appletvsimulator"),
];
const DEFAULT_BUILD_DIR: &str = "build/tvos";
const DEFAULT_RUNTIME_SOURCE: &str = "native/tvos/runtime";
const SAVES_PATH: &str = "Library/Caches/RuneSaves";

fn text_arg(name: &'static str, value: &'static str, help: &'static str) -> Arg {
    Arg::new(name).long(name).value_name(value).help(help)
}

/// Options shared by every command that reads `tvos.toml`.
fn project_args(command: Command) -> Command {
    command
        .arg(text_arg("config", "FILE", "Settings file (default: tvos.toml beside the game or in the current directory)"))
        .arg(text_arg("name", "NAME", "App and scheme name (default: the game file name)"))
        .arg(text_arg("bundle-id", "ID", "Bundle identifier (default: dev.vectrune.games.<name>)"))
        .arg(text_arg("team", "TEAMID", "Apple development team ID used for signing"))
        .arg(text_arg("device", "NAME|ID", "Paired Apple TV name or identifier (default: the only paired Apple TV)"))
        .arg(text_arg("build-dir", "DIRECTORY", "Generated project and build output (default: build/tvos)"))
        .arg(text_arg("runtime-libs", "DIRECTORY", "Prebuilt output of `tvos build-runtime`"))
        .arg(text_arg("runtime-source", "DIRECTORY", "Rune TV runtime crate used to build libraries (default: native/tvos/runtime)"))
        .arg(text_arg("icon", "IMAGE", "Image used for the app icon and top shelf"))
}

fn game_arg() -> Arg {
    Arg::new("game")
        .value_name("GAME.rune")
        .help("Pixel-3D game (default: `game` in tvos.toml)")
}

pub fn command() -> Command {
    let device = || {
        Arg::new("device")
            .long("device")
            .value_name("NAME|ID")
            .help("Paired Apple TV name or identifier from `vectrune tvos devices` (default: tvos.toml, then the only paired Apple TV)")
    };
    Command::new("tvos")
        .about("Experimental Apple TV tools: check, bundle, deploy and debug Pixel-3D games, build and run tvOS Xcode projects (macOS only)")
        .subcommand_required(true)
        .subcommand(
            Command::new("init")
                .about("Write a tvos.toml with this game's Apple TV settings")
                .arg(game_arg())
                .arg(Arg::new("force").long("force").action(ArgAction::SetTrue).help("Replace an existing tvos.toml")),
        )
        .subcommand(
            Command::new("doctor")
                .about("Check Xcode, Rust targets, signing and Apple TV pairing")
                .arg(text_arg("config", "FILE", "Settings file to validate")),
        )
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
                        .default_value(DEFAULT_RUNTIME_SOURCE)
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
            Command::new("icon")
                .about("Generate the tvOS app icon and top shelf asset catalog from an image")
                .arg(Arg::new("image").value_name("IMAGE").help("PNG or JPEG art (default: a placeholder tile)"))
                .arg(
                    Arg::new("output")
                        .long("output")
                        .short('o')
                        .value_name("DIRECTORY")
                        .default_value("Assets.xcassets")
                        .help("Asset catalog directory to create or replace"),
                ),
        )
        .subcommand(
            project_args(
                Command::new("bundle")
                    .about("Generate an Xcode project that wraps a Pixel-3D game for Apple TV")
                    .arg(game_arg()),
            )
            .arg(
                Arg::new("output")
                    .long("output")
                    .short('o')
                    .value_name("DIRECTORY")
                    .help("Project directory to create or refresh (default: <build-dir>/project)"),
            ),
        )
        .subcommand(
            project_args(
                Command::new("deploy")
                    .about("Check, bundle, build, install and launch a game on a paired Apple TV")
                    .arg(game_arg()),
            ),
        )
        .subcommand(
            project_args(
                Command::new("watch")
                    .about("Redeploy to the Apple TV whenever the game's .rune files change")
                    .arg(game_arg()),
            ),
        )
        .subcommand(
            project_args(
                Command::new("package")
                    .about("Archive and export the game for App Store Connect or TestFlight")
                    .arg(game_arg()),
            ),
        )
        .subcommand(
            project_args(
                Command::new("logs")
                    .about("Relaunch the installed game and stream its console output")
                    .arg(game_arg()),
            ),
        )
        .subcommand(
            project_args(
                Command::new("stats")
                    .about("Relaunch the installed game and report frame rate and memory")
                    .arg(game_arg())
                    .arg(
                        Arg::new("seconds")
                            .long("seconds")
                            .value_name("N")
                            .default_value("20")
                            .value_parser(clap::value_parser!(u64).range(6..=600))
                            .help("How long to measure (at least 6, since stats arrive every 3 seconds)"),
                    ),
            ),
        )
        .subcommand(
            project_args(
                Command::new("pull-saves")
                    .about("Copy the game's saved progress from the Apple TV")
                    .arg(game_arg())
                    .arg(
                        Arg::new("output")
                            .long("output")
                            .short('o')
                            .value_name("DIRECTORY")
                            .default_value("saves")
                            .help("Directory that receives the RuneSaves folder"),
                    ),
            ),
        )
        .subcommand(
            project_args(
                Command::new("reset-saves")
                    .about("Delete the game's saved progress on the Apple TV and relaunch it")
                    .arg(game_arg()),
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

fn opt<'a>(matches: &'a ArgMatches, name: &str) -> Option<&'a String> {
    matches.try_get_one::<String>(name).ok().flatten()
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

/// Names and identifiers only; this keeps device text out of shell-like and destination syntax.
fn device_choice(args: &ArgMatches, config: &TvConfig) -> Result<String> {
    let requested = opt(args, "device").cloned().or_else(|| config.device.clone());
    if let Some(value) = &requested {
        ensure!(
            !value.is_empty()
                && value.chars().all(|c| c.is_alphanumeric() || matches!(c, '-' | ' ' | '_' | '.' | '\'' | '’')),
            "Device must be a name or identifier from `vectrune tvos devices`"
        );
    }
    tools::resolve_device(requested.as_deref())
}

fn compile_game(path: &Path) -> Result<(pixel3d::Game3D, tv::SupportReport)> {
    let doc = load_rune_document_from_path(path)
        .map_err(|e| anyhow::anyhow!("Cannot load {}: {e}", path.display()))?;
    let game = pixel3d::compile(&doc).with_context(|| format!("{} is not a valid Pixel-3D game", path.display()))?;
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

fn validate_name(name: &str) -> Result<()> {
    ensure!(
        name.len() <= 40
            && name.starts_with(|c: char| c.is_ascii_alphabetic())
            && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-'),
        "App name must start with a letter and use only ASCII letters, digits, '-' and '_' (got {name:?}); pass --name"
    );
    Ok(())
}

fn validate_bundle_id(id: &str) -> Result<()> {
    let valid = id.contains('.')
        && id.split('.').all(|part| {
            !part.is_empty()
                && part.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
                && !part.starts_with('-')
        });
    ensure!(valid, "Bundle identifier must be dotted ASCII segments like com.example.game (got {id:?})");
    Ok(())
}

fn validate_team(team: &str) -> Result<()> {
    ensure!(
        team.len() == 10 && team.bytes().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()),
        "Team must be a 10-character Apple team ID"
    );
    Ok(())
}

/// Command-line options layered over `tvos.toml`.
struct Settings {
    config: TvConfig,
    game: Option<PathBuf>,
    name: Option<String>,
    bundle_id: Option<String>,
    team: Option<String>,
    build_dir: PathBuf,
    runtime_source: PathBuf,
    runtime_libs: Option<PathBuf>,
    icon: Option<PathBuf>,
}

impl Settings {
    fn load(args: &ArgMatches) -> Result<Self> {
        let game = opt(args, "game").map(PathBuf::from);
        let config = tvos_config::load(opt(args, "config").map(String::as_str), game.as_deref())?;
        let path = |flag: &str, fallback: &Option<PathBuf>| opt(args, flag).map(PathBuf::from).or_else(|| fallback.clone());
        Ok(Self {
            game: game.or_else(|| config.game.clone()),
            name: opt(args, "name").cloned().or_else(|| config.name.clone()),
            bundle_id: opt(args, "bundle-id").cloned().or_else(|| config.bundle_id.clone()),
            team: opt(args, "team").cloned().or_else(|| config.team.clone()),
            build_dir: path("build-dir", &config.build_dir).unwrap_or_else(|| PathBuf::from(DEFAULT_BUILD_DIR)),
            runtime_source: path("runtime-source", &config.runtime_source)
                .unwrap_or_else(|| PathBuf::from(DEFAULT_RUNTIME_SOURCE)),
            runtime_libs: path("runtime-libs", &config.runtime_libs),
            icon: path("icon", &config.icon),
            config,
        })
    }

    fn game(&self) -> Result<&Path> {
        self.game
            .as_deref()
            .context("Pass GAME.rune or set `game` in tvos.toml (create one with `vectrune tvos init`)")
    }

    fn name(&self) -> Result<String> {
        let name = match &self.name {
            Some(name) => name.clone(),
            None => self
                .game()?
                .file_stem()
                .and_then(|stem| stem.to_str())
                .unwrap_or_default()
                .to_string(),
        };
        validate_name(&name)?;
        Ok(name)
    }

    fn bundle_id(&self) -> Result<String> {
        let id = match &self.bundle_id {
            Some(id) => id.clone(),
            None => format!(
                "dev.vectrune.games.{}",
                self.name()?.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_lowercase()
            ),
        };
        validate_bundle_id(&id)?;
        Ok(id)
    }

    fn team(&self) -> Result<Option<&str>> {
        if let Some(team) = &self.team {
            validate_team(team)?;
        }
        Ok(self.team.as_deref())
    }

    /// The configured team, or the only team in the keychain.
    fn signing_team(&self) -> Result<String> {
        if let Some(team) = self.team()? {
            return Ok(team.to_string());
        }
        let mut teams: Vec<String> = tools::signing_teams().into_iter().map(|(_, team)| team).collect();
        teams.sort();
        teams.dedup();
        match teams.as_slice() {
            [only] => {
                println!("Using signing team {only} from the keychain (set `team` in tvos.toml to pin it)");
                Ok(only.clone())
            }
            [] => bail!("No Apple development signing identity found; sign in to Xcode, or pass --team"),
            many => bail!("Several signing teams found ({}); pass --team or set `team` in tvos.toml", many.join(", ")),
        }
    }

    fn project_dir(&self) -> PathBuf {
        self.build_dir.join("project")
    }

    fn derived_dir(&self) -> PathBuf {
        self.build_dir.join("derived")
    }

    fn app_path(&self, name: &str) -> PathBuf {
        self.derived_dir().join("Build/Products/Release-appletvos").join(format!("{name}.app"))
    }

    fn device(&self, args: &ArgMatches) -> Result<String> {
        device_choice(args, &self.config)
    }
}

fn runtime_ready(libs: &Path) -> bool {
    RUNTIME_SLICES.iter().all(|(_, slice)| libs.join(slice).join(RUNTIME_LIBRARY).is_file())
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

/// Writes only when the content differs, so unchanged files keep their modification time for Xcode.
fn write_if_changed(path: &Path, contents: impl AsRef<[u8]>) -> Result<()> {
    let contents = contents.as_ref();
    if std::fs::read(path).map(|old| old == contents).unwrap_or(false) {
        return Ok(());
    }
    std::fs::write(path, contents).with_context(|| format!("Cannot write {}", path.display()))
}

fn copy_runtime(libs: &Path, output: &Path) -> Result<()> {
    for (_, slice) in RUNTIME_SLICES {
        let from = libs.join(slice).join(RUNTIME_LIBRARY);
        ensure!(from.is_file(), "Missing runtime library {}", from.display());
        let destination = output.join(slice);
        std::fs::create_dir_all(&destination)?;
        write_if_changed(&destination.join(RUNTIME_LIBRARY), std::fs::read(&from)?)?;
    }
    Ok(())
}

/// Reuses `--runtime-libs` or a cache in the build directory, building it once when missing.
fn ensure_runtime(settings: &Settings) -> Result<PathBuf> {
    let libs = settings.runtime_libs.clone().unwrap_or_else(|| settings.build_dir.join("runtime"));
    if !runtime_ready(&libs) {
        println!("Building the Rune TV runtime (first run only)...");
        build_runtime(&settings.runtime_source, &libs)?;
    }
    Ok(libs)
}

enum RuntimeSource<'a> {
    Libraries(&'a Path),
    Build(&'a Path),
}

struct ProjectSpec<'a> {
    game: &'a Path,
    name: &'a str,
    bundle_id: &'a str,
    team: Option<&'a str>,
    icon: Option<&'a Path>,
}

fn team_setting(team: Option<&str>) -> String {
    team.map(|team| format!("\n\t\t\t\tDEVELOPMENT_TEAM = {team};")).unwrap_or_default()
}

fn write_project(spec: &ProjectSpec, output: &Path, runtime: RuntimeSource) -> Result<PathBuf> {
    let (game, report) = compile_game(spec.game)?;
    if !report.unsupported.is_empty() {
        print_report(&report);
        bail!("{} uses features the Apple TV runtime does not support; run `vectrune tvos check` for details", spec.game.display());
    }
    let runtime_dir = output.join("Runtime");
    match runtime {
        RuntimeSource::Libraries(libs) => copy_runtime(libs, &runtime_dir)?,
        RuntimeSource::Build(source) => build_runtime(source, &runtime_dir)?,
    }
    let project = output.join(format!("{}.xcodeproj", spec.name));
    for directory in [output.join("Sources"), output.join("Resources"), project.clone()] {
        std::fs::create_dir_all(&directory)?;
    }
    write_if_changed(&output.join("Sources/RuneTVHost.swift"), HOST_SOURCE)?;
    write_if_changed(&output.join("Resources/game.js"), &game.script)?;
    write_if_changed(&output.join("Info.plist"), INFO_PLIST.replace("{{NAME}}", spec.name))?;
    tvos_icon::write_assets(spec.icon, &output.join("Assets.xcassets"))?;
    write_if_changed(
        &project.join("project.pbxproj"),
        PROJECT_TEMPLATE
            .replace("{{NAME}}", spec.name)
            .replace("{{BUNDLE_ID}}", spec.bundle_id)
            .replace("{{TEAM_SETTING}}", &team_setting(spec.team)),
    )?;
    print_report(&report);
    Ok(project)
}

fn xcode(extra: &[&str], project: &Path, scheme: &str, destination: &str, derived: &Path, label: &str) -> Result<()> {
    run_process(
        Process::new("xcodebuild")
            .arg("-quiet")
            .arg("-allowProvisioningUpdates")
            .arg("-project")
            .arg(project)
            .arg("-scheme")
            .arg(scheme)
            .args(["-configuration", "Release", "-destination"])
            .arg(destination)
            .arg("-derivedDataPath")
            .arg(derived)
            .args(extra)
            .arg("build"),
        label,
    )
}

fn devicectl(args: &[&str]) -> Process {
    let mut command = Process::new("xcrun");
    command.arg("devicectl").args(args);
    command
}

fn install_app(device: &str, app: &Path) -> Result<()> {
    run_process(
        devicectl(&["device", "install", "app", "--device"]).arg(device).arg(app),
        "Apple TV app installation",
    )
}

fn launch_app(device: &str, bundle: &str, terminate_existing: bool) -> Result<()> {
    let mut command = devicectl(&["device", "process", "launch"]);
    if terminate_existing {
        command.arg("--terminate-existing");
    }
    run_process(command.arg("--device").arg(device).arg(bundle), "Apple TV app launch")
        .context("If the Apple TV is asleep, wake it and run the command again")
}

fn deploy(settings: &Settings, args: &ArgMatches) -> Result<()> {
    let game = settings.game()?;
    let (name, id) = (settings.name()?, settings.bundle_id()?);
    let device = settings.device(args)?;
    let team = settings.signing_team()?;
    println!("[1/4] Preparing {name} for {device}");
    let libs = ensure_runtime(settings)?;
    let spec = ProjectSpec { game, name: &name, bundle_id: &id, team: Some(&team), icon: settings.icon.as_deref() };
    let project = write_project(&spec, &settings.project_dir(), RuntimeSource::Libraries(&libs))?;
    println!("[2/4] Building with Xcode");
    let destination = format!("platform=tvOS,id={device}");
    xcode(&[], &project, &name, &destination, &settings.derived_dir(), "tvOS Xcode build")?;
    let app = settings.app_path(&name);
    ensure!(app.is_dir(), "Build finished but {} was not produced", app.display());
    println!("[3/4] Installing");
    install_app(&device, &app)?;
    println!("[4/4] Launching {id}");
    launch_app(&device, &id, true)
}

fn fingerprint(root: &Path, config: Option<&Path>, icon: Option<&Path>) -> Vec<(PathBuf, SystemTime, u64)> {
    fn walk(dir: &Path, found: &mut Vec<(PathBuf, SystemTime, u64)>, depth: usize) {
        let Ok(entries) = std::fs::read_dir(dir) else { return };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(meta) = entry.metadata() else { continue };
            if meta.is_dir() {
                let skip = entry.file_name().to_str().is_some_and(|n| n.starts_with('.') || matches!(n, "target" | "build" | "node_modules"));
                if !skip && depth < 6 {
                    walk(&path, found, depth + 1);
                }
            } else if path.extension().is_some_and(|ext| ext == "rune") {
                found.push((path, meta.modified().unwrap_or(SystemTime::UNIX_EPOCH), meta.len()));
            }
        }
    }
    let mut found = Vec::new();
    walk(root, &mut found, 0);
    for extra in config.into_iter().chain(icon) {
        if let Ok(meta) = std::fs::metadata(extra) {
            found.push((extra.to_path_buf(), meta.modified().unwrap_or(SystemTime::UNIX_EPOCH), meta.len()));
        }
    }
    found.sort();
    found
}

fn watch(settings: &Settings, args: &ArgMatches) -> Result<()> {
    let game = settings.game()?.to_path_buf();
    let root = game.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(Path::new(".")).to_path_buf();
    let mut seen = fingerprint(&root, settings.config.path.as_deref(), settings.icon.as_deref());
    println!("Watching {} (Ctrl-C to stop)", root.display());
    if let Err(error) = deploy(settings, args) {
        eprintln!("Deploy failed: {error:#}");
    }
    loop {
        std::thread::sleep(Duration::from_millis(700));
        let now = fingerprint(&root, settings.config.path.as_deref(), settings.icon.as_deref());
        if now == seen {
            continue;
        }
        // Let editors finish writing before building.
        std::thread::sleep(Duration::from_millis(400));
        seen = fingerprint(&root, settings.config.path.as_deref(), settings.icon.as_deref());
        println!("\nChange detected; redeploying...");
        match deploy(settings, args) {
            Ok(()) => println!("Deployed; watching for changes."),
            Err(error) => eprintln!("Deploy failed: {error:#}"),
        }
    }
}

fn package(settings: &Settings) -> Result<()> {
    let game = settings.game()?;
    let (name, id) = (settings.name()?, settings.bundle_id()?);
    let team = settings.signing_team()?;
    let libs = ensure_runtime(settings)?;
    let spec = ProjectSpec { game, name: &name, bundle_id: &id, team: Some(&team), icon: settings.icon.as_deref() };
    let project = write_project(&spec, &settings.project_dir(), RuntimeSource::Libraries(&libs))?;
    let archive = settings.build_dir.join(format!("{name}.xcarchive"));
    let export = settings.build_dir.join("export");
    let options = settings.build_dir.join("ExportOptions.plist");
    std::fs::write(
        &options,
        format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\">\n<dict>\n\t<key>method</key>\n\t<string>app-store-connect</string>\n\t<key>teamID</key>\n\t<string>{team}</string>\n\t<key>signingStyle</key>\n\t<string>automatic</string>\n</dict>\n</plist>\n"
        ),
    )?;
    println!("[1/2] Archiving {name}");
    run_process(
        Process::new("xcodebuild")
            .arg("-quiet")
            .arg("-allowProvisioningUpdates")
            .arg("-project")
            .arg(&project)
            .arg("-scheme")
            .arg(&name)
            .args(["-configuration", "Release", "-destination", "generic/platform=tvOS", "-derivedDataPath"])
            .arg(settings.derived_dir())
            .arg("-archivePath")
            .arg(&archive)
            .arg("archive"),
        "tvOS archive",
    )?;
    println!("[2/2] Exporting for App Store Connect");
    run_process(
        Process::new("xcodebuild")
            .arg("-quiet")
            .arg("-allowProvisioningUpdates")
            .arg("-exportArchive")
            .arg("-archivePath")
            .arg(&archive)
            .arg("-exportPath")
            .arg(&export)
            .arg("-exportOptionsPlist")
            .arg(&options),
        "tvOS archive export",
    )
    .with_context(|| {
        format!(
            "The archive is at {}. Export needs an App Store Connect app record for {id} and an Apple Distribution profile; create them in App Store Connect, or export from Xcode Organizer",
            archive.display()
        )
    })?;
    println!("Archive: {}\nExport:  {}", archive.display(), export.display());
    println!("Upload the exported build with Xcode Organizer or Transporter. App Store submissions also need an App Store Connect record for {id}.");
    Ok(())
}

fn logs(settings: &Settings, args: &ArgMatches) -> Result<()> {
    let device = settings.device(args)?;
    let id = settings.bundle_id()?;
    println!("Streaming {id} (Ctrl-C to stop)");
    run_process(
        devicectl(&["device", "process", "launch", "--console", "--terminate-existing", "--device"]).arg(&device).arg(&id),
        "Apple TV console",
    )
}

fn stats(settings: &Settings, args: &ArgMatches) -> Result<()> {
    let device = settings.device(args)?;
    let id = settings.bundle_id()?;
    let seconds = *args.get_one::<u64>("seconds").expect("defaulted");
    let mut child = devicectl(&["device", "process", "launch", "--console", "--terminate-existing", "--device"])
        .arg(&device)
        .arg(&id)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("Could not start devicectl; install and select Xcode")?;
    let (sender, receiver) = std::sync::mpsc::channel();
    for stream in [child.stdout.take().map(|s| Box::new(s) as Box<dyn std::io::Read + Send>), child.stderr.take().map(|s| Box::new(s) as Box<dyn std::io::Read + Send>)]
        .into_iter()
        .flatten()
    {
        let sender = sender.clone();
        std::thread::spawn(move || {
            for line in std::io::BufReader::new(stream).lines().map_while(Result::ok) {
                if sender.send(line).is_err() {
                    break;
                }
            }
        });
    }
    drop(sender);
    println!("Measuring {id} for {seconds}s...");
    let deadline = Instant::now() + Duration::from_secs(seconds);
    let mut samples = Vec::new();
    while let Some(wait) = deadline.checked_duration_since(Instant::now()) {
        match receiver.recv_timeout(wait) {
            Ok(line) => {
                if let Some(sample) = tools::parse_stats(&line) {
                    println!(
                        "  {:>5.1} fps   simulation {:>4.1} ms   render {:>5.1} ms   memory {:>4.0} MB",
                        sample.fps, sample.simulation_ms, sample.native_ms, sample.memory_mb
                    );
                    samples.push(sample);
                }
            }
            Err(_) => break,
        }
    }
    let _ = child.kill();
    let _ = child.wait();
    ensure!(
        !samples.is_empty(),
        "No stats received; rebuild with `vectrune tvos deploy` so the host reports them"
    );
    let count = samples.len() as f64;
    let average = samples.iter().map(|s| s.fps).sum::<f64>() / count;
    let lowest = samples.iter().map(|s| s.fps).fold(f64::MAX, f64::min);
    let memory = samples.iter().map(|s| s.memory_mb).fold(0.0, f64::max);
    println!("Average {average:.1} fps, lowest {lowest:.1} fps, peak memory {memory:.0} MB over {} samples", samples.len());
    Ok(())
}

fn pull_saves(settings: &Settings, args: &ArgMatches) -> Result<()> {
    let device = settings.device(args)?;
    let id = settings.bundle_id()?;
    let output = Path::new(required(args, "output"));
    std::fs::create_dir_all(output)?;
    run_process(
        devicectl(&["device", "copy", "from", "--device"])
            .arg(&device)
            .args(["--domain-type", "appDataContainer", "--domain-identifier"])
            .arg(&id)
            .args(["--source", SAVES_PATH, "--destination"])
            .arg(output),
        "Saved progress download",
    )?;
    println!("Saves copied to {}", output.display());
    Ok(())
}

fn reset_saves(settings: &Settings, args: &ArgMatches) -> Result<()> {
    let device = settings.device(args)?;
    let id = settings.bundle_id()?;
    let environment = serde_json::json!({ "RUNE_TV_RESET_SAVES": "1" }).to_string();
    run_process(
        devicectl(&["device", "process", "launch", "--terminate-existing", "--environment-variables"])
            .arg(environment)
            .arg("--device")
            .arg(&device)
            .arg(&id),
        "Saved progress reset",
    )?;
    println!("Saved progress deleted for {id}; the game restarted with a fresh save.");
    Ok(())
}

struct Check {
    label: String,
    ok: bool,
    detail: String,
}

fn doctor(args: &ArgMatches) -> Result<()> {
    let mut checks: Vec<Check> = Vec::new();
    let mut add = |label: &str, ok: bool, detail: String| checks.push(Check { label: label.to_string(), ok, detail });
    add("macOS", cfg!(target_os = "macos"), "tvOS builds need macOS and Xcode".into());
    let xcode = tools::first_line("xcodebuild", &["-version"]);
    add("Xcode", xcode.is_some(), xcode.unwrap_or_else(|| "install Xcode and run `xcode-select -s` to select it".into()));
    let devicectl_ok = Process::new("xcrun").args(["devicectl", "--version"]).output().is_ok_and(|o| o.status.success());
    add("devicectl", devicectl_ok, "ships with Xcode 15 and later".into());
    let cargo = tools::first_line("cargo", &["--version"]);
    add("Rust (cargo)", cargo.is_some(), cargo.unwrap_or_else(|| "install Rust from https://rustup.rs".into()));
    for (target, _) in RUNTIME_SLICES {
        let installed = tools::rust_target_installed(target);
        add(&format!("Rust target {target}"), installed, if installed { "installed".into() } else { format!("rustup target add {target}") });
    }
    let teams = tools::signing_teams();
    let detail = if teams.is_empty() {
        "sign in to Xcode > Settings > Accounts to create a development certificate".to_string()
    } else {
        teams.iter().map(|(identity, team)| format!("{team} ({identity})")).collect::<Vec<_>>().join("; ")
    };
    add("Signing identity", !teams.is_empty(), detail);
    match tools::list_devices() {
        Ok(devices) => {
            let paired: Vec<_> = devices.iter().filter(|d| d.physical && d.paired).collect();
            let detail = if paired.is_empty() {
                "pair an Apple TV in Xcode > Window > Devices and Simulators".to_string()
            } else {
                paired.iter().map(|d| format!("{} ({})", d.name, d.model)).collect::<Vec<_>>().join("; ")
            };
            add("Paired Apple TV", !paired.is_empty(), detail);
        }
        Err(error) => add("Paired Apple TV", false, format!("{error:#}")),
    }
    let source = Path::new(DEFAULT_RUNTIME_SOURCE);
    add("Runtime source", source.join("Cargo.toml").is_file(), format!("{} (use --runtime-source outside a Vectrune checkout)", source.display()));
    match tvos_config::load(opt(args, "config").map(String::as_str), None) {
        Ok(config) => match &config.path {
            Some(path) => add("tvos.toml", true, path.display().to_string()),
            None => add("tvos.toml", true, "none found; run `vectrune tvos init` to create one (optional)".into()),
        },
        Err(error) => add("tvos.toml", false, format!("{error:#}")),
    }
    let mut failed = 0;
    for check in &checks {
        let status = if check.ok { "ok     " } else { "MISSING" };
        println!("{status} {:<30} {}", check.label, check.detail);
        failed += usize::from(!check.ok && check.label != "tvos.toml");
    }
    ensure!(failed == 0, "{failed} setup issue(s) found");
    println!("Ready: `vectrune tvos deploy GAME.rune` builds and launches a game on your Apple TV.");
    Ok(())
}

fn init(args: &ArgMatches) -> Result<()> {
    let file = Path::new(tvos_config::FILE_NAME);
    ensure!(
        args.get_flag("force") || !file.exists(),
        "{} already exists; pass --force to replace it",
        file.display()
    );
    let game = match opt(args, "game") {
        Some(game) => PathBuf::from(game),
        None => {
            let mut found: Vec<PathBuf> = std::fs::read_dir(".")?
                .flatten()
                .map(|e| e.path())
                .filter(|p| p.extension().is_some_and(|e| e == "rune"))
                .collect();
            found.sort();
            ensure!(found.len() == 1, "Pass the game file: `vectrune tvos init GAME.rune` (found {} .rune files here)", found.len());
            found.remove(0)
        }
    };
    ensure!(game.is_file(), "Game not found: {}", game.display());
    let (_, report) = compile_game(&game)?;
    let name: String = game
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Game")
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    validate_name(&name)?;
    let mut text = format!(
        "# Apple TV settings for `vectrune tvos`; command-line flags override these.\ngame = {game:?}\nname = {name:?}\nbundle_id = \"dev.vectrune.games.{}\"\n",
        name.to_lowercase().chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>()
    );
    let mut teams: Vec<String> = Vec::new();
    let mut device = None;
    if cfg!(target_os = "macos") {
        teams = tools::signing_teams().into_iter().map(|(_, t)| t).collect();
        teams.sort();
        teams.dedup();
        if let Ok(devices) = tools::list_devices() {
            let paired: Vec<_> = devices.into_iter().filter(|d| d.physical && d.paired).collect();
            if let [only] = paired.as_slice() {
                device = Some(only.name.clone());
            }
        }
    }
    match teams.as_slice() {
        [only] => text.push_str(&format!("team = {only:?}\n")),
        _ => text.push_str("# team = \"ABCDE12345\"   # Apple development team ID\n"),
    }
    match device {
        Some(name) => text.push_str(&format!("device = {name:?}\n")),
        None => text.push_str("# device = \"Living Room\"   # paired Apple TV name\n"),
    }
    text.push_str("# icon = \"icon.png\"\n# build_dir = \"build/tvos\"\n");
    std::fs::write(file, text)?;
    println!("Wrote {}", file.display());
    print_report(&report);
    println!("Next: `vectrune tvos doctor`, then `vectrune tvos deploy`.");
    Ok(())
}

pub fn run(args: &ArgMatches) -> Result<()> {
    match args.subcommand() {
        Some(("check", args)) => {
            let game = required(args, "game");
            let (_, report) = compile_game(Path::new(game))?;
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
        Some(("init", args)) => return init(args),
        Some(("icon", args)) => {
            let output = Path::new(required(args, "output"));
            tvos_icon::write_assets(opt(args, "image").map(Path::new), output)?;
            println!("Wrote {}; `vectrune tvos bundle --icon` does this automatically.", output.display());
            return Ok(());
        }
        _ => {}
    }
    ensure!(
        cfg!(target_os = "macos"),
        "tvOS tooling requires macOS and Xcode"
    );
    match args.subcommand() {
        Some(("doctor", args)) => doctor(args),
        Some(("build-runtime", args)) => {
            let output = Path::new(required(args, "output"));
            build_runtime(Path::new(required(args, "source")), output)?;
            println!("Runtime libraries written to {}", output.display());
            Ok(())
        }
        Some(("bundle", args)) => {
            let settings = Settings::load(args)?;
            let game = settings.game()?;
            let (name, id) = (settings.name()?, settings.bundle_id()?);
            let team = settings.team()?;
            let output = opt(args, "output").map(PathBuf::from).unwrap_or_else(|| settings.project_dir());
            let spec = ProjectSpec { game, name: &name, bundle_id: &id, team, icon: settings.icon.as_deref() };
            let runtime = match &settings.runtime_libs {
                Some(libs) => RuntimeSource::Libraries(libs),
                None => RuntimeSource::Build(&settings.runtime_source),
            };
            let project = write_project(&spec, &output, runtime)?;
            println!("Created {}", project.display());
            println!("Next: vectrune tvos deploy {}   (or build it yourself with `vectrune tvos build`)", game.display());
            if team.is_none() {
                println!("Set a development team in Xcode or pass --team before building for a device.");
            }
            Ok(())
        }
        Some(("deploy", args)) => deploy(&Settings::load(args)?, args),
        Some(("watch", args)) => watch(&Settings::load(args)?, args),
        Some(("package", args)) => package(&Settings::load(args)?),
        Some(("logs", args)) => logs(&Settings::load(args)?, args),
        Some(("stats", args)) => stats(&Settings::load(args)?, args),
        Some(("pull-saves", args)) => pull_saves(&Settings::load(args)?, args),
        Some(("reset-saves", args)) => reset_saves(&Settings::load(args)?, args),
        Some(("devices", _)) => run_process(
            Process::new("xcrun").args(["devicectl", "list", "devices"]),
            "Apple device listing",
        ),
        Some(("build", args)) => {
            let project = existing_bundle(required(args, "project"), "xcodeproj")?;
            let scheme = required(args, "scheme");
            ensure!(!scheme.trim().is_empty(), "Scheme cannot be empty");
            let device = device_choice(args, &tvos_config::load(None, None)?)?;
            let derived = Path::new(required(args, "derived-data"));
            ensure!(
                !derived.as_os_str().is_empty(),
                "Derived data directory cannot be empty"
            );
            let destination = format!("platform=tvOS,id={device}");
            xcode(&[], &project, scheme, &destination, derived, "tvOS Xcode build")?;
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
            let device = device_choice(args, &tvos_config::load(None, None)?)?;
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
            install_app(&device, &app)?;
            launch_app(&device, bundle, false)
        }
        _ => bail!("A tvOS subcommand is required"),
    }
}
