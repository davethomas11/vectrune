use std::process::Command;
use std::path::Path;

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
            let status = Command::new("cmd")
                .args(&["/C", "npm", "install"])
                .current_dir(&runtime_dir)
                .status();
            
            if let Ok(status) = status {
                if !status.success() {
                    println!("cargo:warning=Failed to run npm install in rune-web runtime");
                }
            }
        }

        // Run npm run build
        let status = Command::new("cmd")
            .args(&["/C", "npm", "run", "build"])
            .current_dir(&runtime_dir)
            .status();

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
