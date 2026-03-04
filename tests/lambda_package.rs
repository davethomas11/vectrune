use assert_cmd::Command;
use std::fs::File;
use std::io::Read;
use std::path::PathBuf;
use tempfile::tempdir;
use zip::ZipArchive;

#[test]
fn lambda_package_creates_zip_bundle() -> Result<(), Box<dyn std::error::Error>> {
    let temp = tempdir()?;
    let output_zip = temp.path().join("lambda_bundle.zip");
    let vectrune_bin = assert_cmd::cargo::cargo_bin!("vectrune");
    let rune_path = PathBuf::from("examples/book_graphql.rune");

    let mut cmd = Command::new(&vectrune_bin);
    cmd.arg("lambda")
        .arg("package")
        .arg("--rune")
        .arg(rune_path.to_str().unwrap())
        .arg("--binary")
        .arg(vectrune_bin.to_str().unwrap())
        .arg("--mode")
        .arg("zip")
        .arg("--output")
        .arg(output_zip.to_str().unwrap());
    cmd.assert().success();

    assert!(
        output_zip.exists(),
        "expected zip output at {:?}",
        output_zip
    );

    let file = File::open(&output_zip)?;
    let mut archive = ZipArchive::new(file)?;
    archive.by_name("bootstrap")?;
    archive.by_name("rune/book_graphql.rune")?;

    let mut manifest = archive.by_name("manifest.json")?;
    let mut manifest_contents = String::new();
    manifest.read_to_string(&mut manifest_contents)?;
    assert!(manifest_contents.contains("\"mode\": \"zip\""));
    assert!(manifest_contents.contains("book_graphql.rune"));

    Ok(())
}
