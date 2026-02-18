use std::fs;
use std::path::PathBuf;
use std::process::Command;

struct TempFile {
    path: PathBuf,
}

impl TempFile {
    fn new(path: &str, content: &str) -> Self {
        fs::write(path, content).unwrap();
        Self {
            path: PathBuf::from(path),
        }
    }

    fn path_str(&self) -> &str {
        self.path.to_str().unwrap()
    }
}

impl Drop for TempFile {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

#[test]
fn test_merge_cli_yaml() {
    let base_yaml = "
environment:
  preview:
    - name: url
      value: preview.com
    - name: allowedIps
      value: []
";
    let input_yaml = "
Ips:
  - 1.1.1.1
  - 2.2.2.2
";

    let base = TempFile::new("test_base.yaml", base_yaml);
    let input = TempFile::new("test_input.yaml", input_yaml);

    let output = Command::new("cargo")
        .args(&[
            "run",
            "--",
            "-i",
            "yaml",
            input.path_str(),
            "--merge-with",
            &format!(
                "{}@environment.preview.[].(name=allowedIps on value from Ips)",
                base.path_str()
            ),
            "-o",
            "yaml",
        ])
        .output()
        .expect("failed to execute process");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("1.1.1.1"));
    assert!(stdout.contains("2.2.2.2"));
    assert!(stdout.contains("allowedIps"));
}

#[ignore]
#[test]
fn test_merge_cli_rune() {
    let base_rune = "
#!RUNE
@Roles
admin:
  perms: []
";
    let input_rune = "
#!RUNE
@Data
new_perms:
  - read
  - write
";

    let base = TempFile::new("test_base.rune", base_rune);
    let input = TempFile::new("test_input.rune", input_rune);

    // Test simple merge without instruction first
    let output = Command::new("cargo")
        .args(&[
            "run",
            "--",
            input.path_str(),
            "--merge-with",
            &format!("{}@Roles", base.path_str()),
            "-o",
            "json",
        ])
        .output()
        .expect("failed to execute process");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("new_perms"));
}

#[ignore]
#[test]
fn test_merge_cli_json_to_yaml() {
    let base_yaml = "
api:
  key: old
";
    let input_json = "{\"new_key\": \"secret\"}";

    let base = TempFile::new("test_base_kv.yaml", base_yaml);
    let input = TempFile::new("test_input.json", input_json);

    let output = Command::new("cargo")
        .args(&[
            "run",
            "--",
            "-i",
            "json",
            input.path_str(),
            "--merge-with",
            &format!("{}@api", base.path_str()),
            "-o",
            "yaml",
        ])
        .output()
        .expect("failed to execute process");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("new_key: secret"));
}
