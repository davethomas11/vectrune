use std::path::Path;
use std::process::Command;

fn run_npm(dir: &Path, args: &[&str]) -> std::io::Result<std::process::ExitStatus> {
    if cfg!(target_os = "windows") {
        Command::new("cmd").arg("/C").arg("npm").args(args).current_dir(dir).status()
    } else {
        Command::new("npm").args(args).current_dir(dir).status()
    }
}

fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let runtime_dir = Path::new(&manifest_dir).join("runtime").join("rune-web");

    println!("cargo:rerun-if-changed=runtime/rune-web/src");
    println!("cargo:rerun-if-changed=runtime/rune-web/package.json");
    println!("cargo:rerun-if-changed=runtime/rune-web/build.mjs");

    // Only try to build if npm exists and the directory exists
    if runtime_dir.exists() {
        // Run npm install if node_modules is missing
        if !runtime_dir.join("node_modules").exists() {
            let status = run_npm(&runtime_dir, &["install"]);
            if let Ok(status) = status {
                if !status.success() {
                    println!("cargo:warning=Failed to run npm install in rune-web runtime");
                }
            }
        }

        // Run npm run build
        let status = run_npm(&runtime_dir, &["run", "build"]);
        match status {
            Ok(status) => {
                if !status.success() {
                    println!("cargo:warning=Failed to build rune-web runtime. TS compilation might have failed.");
                }
            }
            Err(e) => {
                println!("cargo:warning=Failed to invoke npm for rune-web runtime: {}", e);
            }
        }
    }
}
