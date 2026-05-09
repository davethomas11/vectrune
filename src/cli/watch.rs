use notify::Watcher;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;
use crate::util::{log, LogLevel};

/// Start watching for file changes and return a receiver channel
pub fn start_file_watcher(script_paths: Vec<&str>) -> anyhow::Result<mpsc::Receiver<()>> {
    let (tx, rx) = mpsc::channel();

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            match event.kind {
                notify::EventKind::Modify(_) | notify::EventKind::Create(_) => {
                    if event.paths.iter().any(|p| {
                        p.extension()
                            .and_then(|ext| ext.to_str())
                            .map(|ext| ext == "rune" || ext == "json" || ext == "yaml" || ext == "vect" || ext == "vectrune")
                            .unwrap_or(false)
                    }) {
                        // Debounce a bit
                        let _ = tx.send(());
                    }
                }
                _ => {}
            }
        }
    })?;

    // Watch the directory or file
    for path_str in &script_paths {
        if *path_str != "-" {
            let path = PathBuf::from(path_str);
            let watch_path = if path.is_dir() {
                path
            } else {
                path.parent()
                    .unwrap_or_else(|| std::path::Path::new("."))
                    .to_path_buf()
            };
            watcher.watch(&watch_path, notify::RecursiveMode::Recursive)?;
            log(
                LogLevel::Info,
                &format!("Watching {} for changes...", watch_path.display()),
            );
        }
    }

    // Keep watcher alive by returning it or storing it (in this case, we move it to a thread that just keeps it alive)
    std::thread::spawn(move || {
        let _keep_alive = watcher;
        loop {
            std::thread::sleep(Duration::from_secs(10));
        }
    });

    Ok(rx)
}










