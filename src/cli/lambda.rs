use crate::util::{log, LogLevel};
use anyhow::{bail, Context, Result};
use chrono::Utc;
use clap::ArgMatches;
use serde::Serialize;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::FileOptions;

const ZIP_SIZE_LIMIT_BYTES: u64 = 50 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PackageMode {
    Zip,
    Container,
}

#[derive(Debug, Clone)]
struct PackageConfig {
    rune_path: PathBuf,
    config_path: Option<PathBuf>,
    binary_path: PathBuf,
    output_path: PathBuf,
    mode: PackageMode,
    image_name: Option<String>,
}

#[derive(Serialize)]
struct LambdaManifest {
    version: String,
    mode: String,
    generated_at: String,
    rune_source: String,
    config_source: Option<String>,
    binary_source: String,
    image_name: Option<String>,
    files: Vec<String>,
}

pub fn handle_lambda(matches: &ArgMatches) -> Result<()> {
    match matches.subcommand() {
        Some(("package", args)) => {
            let rune_path = PathBuf::from(
                args.get_one::<String>("rune")
                    .map(|s| s.as_str())
                    .unwrap_or("app.rune"),
            );
            let config_path = args.get_one::<String>("config").map(|p| PathBuf::from(p));
            let binary_path = args
                .get_one::<String>("binary")
                .map(|p| PathBuf::from(p))
                .unwrap_or(std::env::current_exe().context("Unable to locate running binary")?);
            let image_name = args.get_one::<String>("image-name").cloned();

            let mode = match args.get_one::<String>("mode").map(|s| s.as_str()) {
                Some("container") => PackageMode::Container,
                _ => PackageMode::Zip,
            };

            let output_path = args
                .get_one::<String>("output")
                .map(|p| PathBuf::from(p))
                .unwrap_or_else(|| match mode {
                    PackageMode::Zip => PathBuf::from("dist/vectrune-lambda.zip"),
                    PackageMode::Container => {
                        PathBuf::from("dist/vectrune-lambda-container.tar.gz")
                    }
                });

            let config = PackageConfig {
                rune_path,
                config_path,
                binary_path,
                output_path,
                mode,
                image_name,
            };

            package_lambda(config)?;
            Ok(())
        }
        _ => {
            bail!("Unsupported lambda command. Try 'vectrune lambda package --help'.");
        }
    }
}

fn package_lambda(config: PackageConfig) -> Result<()> {
    package_lambda_with_limit(config, ZIP_SIZE_LIMIT_BYTES)
}

fn package_lambda_with_limit(config: PackageConfig, size_limit: u64) -> Result<()> {
    ensure_exists(&config.rune_path, "Rune source")?;
    if let Some(ref cfg) = config.config_path {
        ensure_exists(cfg, "Config path")?;
    }
    ensure_exists(&config.binary_path, "Binary path")?;

    let temp_dir = tempfile::tempdir().context("Unable to create temporary workspace")?;
    let staging_root = temp_dir.path().join("bundle");
    fs::create_dir_all(&staging_root).context("Failed to create staging directory")?;

    let mut tracked_files: Vec<String> = Vec::new();
    let mut total_size = 0u64;

    stage_binary(
        &config.binary_path,
        &staging_root,
        &mut tracked_files,
        &mut total_size,
        size_limit,
    )?;

    copy_source(
        &config.rune_path,
        &staging_root,
        Path::new("rune"),
        &mut tracked_files,
        &mut total_size,
        size_limit,
    )?;

    if let Some(ref cfg_path) = config.config_path {
        copy_source(
            cfg_path,
            &staging_root,
            Path::new("config"),
            &mut tracked_files,
            &mut total_size,
            size_limit,
        )?;
    }

    tracked_files.sort();
    let manifest = LambdaManifest {
        version: env!("CARGO_PKG_VERSION").to_string(),
        mode: match config.mode {
            PackageMode::Zip => "zip".to_string(),
            PackageMode::Container => "container".to_string(),
        },
        generated_at: Utc::now().to_rfc3339(),
        rune_source: config.rune_path.display().to_string(),
        config_source: config.config_path.as_ref().map(|p| p.display().to_string()),
        binary_source: config.binary_path.display().to_string(),
        image_name: config.image_name.clone(),
        files: tracked_files.clone(),
    };

    let manifest_path = staging_root.join("manifest.json");
    let manifest_json =
        serde_json::to_string_pretty(&manifest).context("Failed to serialize manifest metadata")?;
    fs::write(&manifest_path, manifest_json).context("Unable to write manifest.json")?;
    total_size += fs::metadata(&manifest_path)?.len();
    enforce_size(total_size, size_limit)?;

    match config.mode {
        PackageMode::Zip => {
            create_zip_archive(&staging_root, &config.output_path)?;
            log(
                LogLevel::Info,
                &format!("Created Lambda zip at {}", config.output_path.display()),
            );
        }
        PackageMode::Container => {
            create_container_context(&staging_root, temp_dir.path(), &config.output_path)?;
            log(
                LogLevel::Info,
                &format!(
                    "Prepared Lambda container context at {}",
                    config.output_path.display()
                ),
            );
        }
    }

    Ok(())
}

fn ensure_exists(path: &Path, label: &str) -> Result<()> {
    if !path.exists() {
        bail!("{} '{}' not found", label, path.display());
    }
    Ok(())
}

fn stage_binary(
    binary_path: &Path,
    staging_root: &Path,
    files: &mut Vec<String>,
    total_size: &mut u64,
    size_limit: u64,
) -> Result<()> {
    let dest = staging_root.join("bootstrap");
    fs::create_dir_all(dest.parent().unwrap())?;
    fs::copy(binary_path, &dest)
        .with_context(|| format!("Failed to copy binary from {}", binary_path.display()))?;
    let metadata = fs::metadata(binary_path)?;
    *total_size += metadata.len();
    enforce_size(*total_size, size_limit)?;
    set_executable(&dest)?;
    files.push("bootstrap".to_string());
    Ok(())
}

#[cfg(unix)]
fn set_executable(path: &Path) -> Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let mut perms = fs::metadata(path)?.permissions();
    perms.set_mode(0o755);
    fs::set_permissions(path, perms)?;
    Ok(())
}

#[cfg(not(unix))]
fn set_executable(_path: &Path) -> Result<()> {
    Ok(())
}

fn copy_source(
    source: &Path,
    staging_root: &Path,
    prefix: &Path,
    files: &mut Vec<String>,
    total_size: &mut u64,
    size_limit: u64,
) -> Result<()> {
    if source.is_file() {
        let filename = source
            .file_name()
            .ok_or_else(|| anyhow::anyhow!("Invalid file name"))?;
        let target_rel = prefix.join(filename);
        let dest = staging_root.join(&target_rel);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(source, &dest).with_context(|| format!("Failed to copy {}", source.display()))?;
        *total_size += fs::metadata(source)?.len();
        enforce_size(*total_size, size_limit)?;
        files.push(to_manifest_path(&target_rel));
        return Ok(());
    }

    if source.is_dir() {
        for entry in WalkDir::new(source) {
            let entry = entry?;
            let path = entry.path();
            if entry.file_type().is_dir() {
                continue;
            }
            let relative = path.strip_prefix(source).unwrap();
            let target_rel = prefix.join(relative);
            let dest = staging_root.join(&target_rel);
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(path, &dest).with_context(|| format!("Failed to copy {}", path.display()))?;
            *total_size += fs::metadata(path)?.len();
            enforce_size(*total_size, size_limit)?;
            files.push(to_manifest_path(&target_rel));
        }
        return Ok(());
    }

    bail!("Unsupported source: {}", source.display());
}

fn to_manifest_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn enforce_size(current: u64, limit: u64) -> Result<()> {
    if current > limit {
        bail!(
            "Packaged contents exceed {} bytes (limit for Lambda zip). Consider container mode.",
            limit
        );
    }
    Ok(())
}

fn create_zip_archive(staging_root: &Path, output_path: &Path) -> Result<()> {
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let file = fs::File::create(output_path)
        .with_context(|| format!("Unable to create {}", output_path.display()))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    for entry in WalkDir::new(staging_root)
        .into_iter()
        .filter_map(Result::ok)
    {
        let path = entry.path();
        if path == staging_root {
            continue;
        }
        let relative = path.strip_prefix(staging_root).unwrap();
        let name = to_manifest_path(relative);
        if entry.file_type().is_dir() {
            let dir_name = if name.ends_with('/') {
                name
            } else {
                format!("{}/", name)
            };
            zip.add_directory(dir_name, options.clone())?;
            continue;
        }
        let mut f = fs::File::open(path)?;
        let mut buffer = Vec::new();
        f.read_to_end(&mut buffer)?;
        let perms = if name == "bootstrap" { 0o755 } else { 0o644 };
        zip.start_file(name, options.clone().unix_permissions(perms))?;
        zip.write_all(&buffer)?;
    }

    zip.finish()?;
    Ok(())
}

fn create_container_context(
    staging_root: &Path,
    temp_root: &Path,
    output_path: &Path,
) -> Result<()> {
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let context_dir = temp_root.join("container_ctx");
    if context_dir.exists() {
        fs::remove_dir_all(&context_dir)?;
    }
    fs::create_dir_all(&context_dir)?;
    let bundle_dest = context_dir.join("bundle");
    copy_directory(staging_root, &bundle_dest)?;

    let dockerfile = context_dir.join("Dockerfile");
    fs::write(
        &dockerfile,
        "FROM public.ecr.aws/lambda/provided:al2023\nCOPY bundle/bootstrap /var/runtime/bootstrap\nCOPY bundle/ /var/task/\nWORKDIR /var/task\nENTRYPOINT [\"/var/runtime/bootstrap\"]\n",
    )?;

    create_tarball(&context_dir, output_path)?;
    Ok(())
}

fn copy_directory(src: &Path, dest: &Path) -> Result<()> {
    for entry in WalkDir::new(src) {
        let entry = entry?;
        let path = entry.path();
        let relative = path.strip_prefix(src).unwrap();
        if relative.as_os_str().is_empty() {
            continue;
        }
        let target = dest.join(relative);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&target)?;
        } else {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(path, &target)?;
        }
    }
    Ok(())
}

fn create_tarball(context_dir: &Path, output_path: &Path) -> Result<()> {
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use tar::Builder;

    let file = fs::File::create(output_path)
        .with_context(|| format!("Unable to create {}", output_path.display()))?;
    let encoder = GzEncoder::new(file, Compression::default());
    let mut builder = Builder::new(encoder);
    builder.append_dir_all(".", context_dir)?;
    let encoder = builder.into_inner()?;
    encoder.finish()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn packages_zip_bundle_with_manifest() {
        let temp = tempfile::tempdir().unwrap();
        let rune_path = temp.path().join("app.rune");
        fs::write(&rune_path, "@App\n").unwrap();
        let binary_path = temp.path().join("vectrune");
        fs::write(&binary_path, b"fake-binary").unwrap();
        let output_path = temp.path().join("bundle.zip");

        let config = PackageConfig {
            rune_path,
            config_path: None,
            binary_path,
            output_path: output_path.clone(),
            mode: PackageMode::Zip,
            image_name: None,
        };

        package_lambda_with_limit(config, 1024 * 1024).unwrap();
        assert!(output_path.exists());

        let file = fs::File::open(&output_path).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        let mut bootstrap = archive.by_name("bootstrap").unwrap();
        let mut data = Vec::new();
        bootstrap.read_to_end(&mut data).unwrap();
        assert_eq!(data, b"fake-binary");
        drop(bootstrap);
        archive.by_name("manifest.json").unwrap();
        archive.by_name("rune/app.rune").unwrap();
    }

    #[test]
    fn fails_when_bundle_exceeds_limit() {
        let temp = tempfile::tempdir().unwrap();
        let rune_path = temp.path().join("app.rune");
        fs::write(&rune_path, vec![b'a'; 2048]).unwrap();
        let binary_path = temp.path().join("vectrune");
        fs::write(&binary_path, vec![b'b'; 2048]).unwrap();
        let output_path = temp.path().join("bundle.zip");

        let config = PackageConfig {
            rune_path,
            config_path: None,
            binary_path,
            output_path,
            mode: PackageMode::Zip,
            image_name: None,
        };

        let err = package_lambda_with_limit(config, 1024).unwrap_err();
        assert!(err.to_string().contains("exceed"));
    }

    #[test]
    fn creates_container_tarball() {
        let temp = tempfile::tempdir().unwrap();
        let rune_path = temp.path().join("app.rune");
        fs::write(&rune_path, "@App\n").unwrap();
        let binary_path = temp.path().join("vectrune");
        fs::write(&binary_path, b"fake-binary").unwrap();
        let output_path = temp.path().join("context.tar.gz");

        let config = PackageConfig {
            rune_path,
            config_path: None,
            binary_path,
            output_path: output_path.clone(),
            mode: PackageMode::Container,
            image_name: Some("vectrune/lambda:test".to_string()),
        };

        package_lambda_with_limit(config, 1024 * 1024).unwrap();
        assert!(output_path.exists());

        let file = fs::File::open(&output_path).unwrap();
        let gz = flate2::read::GzDecoder::new(file);
        let mut archive = tar::Archive::new(gz);
        let mut found = false;
        for entry in archive.entries().unwrap() {
            let entry = entry.unwrap();
            let path = entry.path().unwrap();
            if path == std::path::Path::new("bundle/bootstrap") {
                found = true;
                break;
            }
        }
        assert!(found, "bundle/bootstrap missing from container tarball");
    }
}
