//! File-backed save storage exposed to Rune as `__runeStoreGet/Set/Remove`.
use rquickjs::{Ctx, Function};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const MAX_VALUE_BYTES: usize = 1024 * 1024;
const MAX_KEY_BYTES: usize = 120;

static DIRECTORY: Mutex<Option<PathBuf>> = Mutex::new(None);

pub fn set_directory(path: PathBuf) -> std::io::Result<()> {
    std::fs::create_dir_all(&path)?;
    *DIRECTORY.lock().unwrap() = Some(path);
    Ok(())
}

fn directory() -> Option<PathBuf> {
    DIRECTORY.lock().unwrap().clone()
}

fn file(dir: &Path, key: &str) -> Option<PathBuf> {
    if key.is_empty() || key.len() > MAX_KEY_BYTES {
        return None;
    }
    let name: String = key.bytes().map(|b| format!("{b:02x}")).collect();
    Some(dir.join(format!("{name}.save")))
}

fn read(dir: &Path, key: &str) -> Option<String> {
    std::fs::read_to_string(file(dir, key)?).ok()
}

fn write(dir: &Path, key: &str, value: &str) -> bool {
    let Some(path) = file(dir, key) else { return false };
    if value.len() > MAX_VALUE_BYTES {
        return false;
    }
    let temporary = path.with_extension("tmp");
    std::fs::write(&temporary, value).is_ok() && std::fs::rename(&temporary, &path).is_ok()
}

fn remove(dir: &Path, key: &str) {
    if let Some(path) = file(dir, key) {
        let _ = std::fs::remove_file(path);
    }
}

/// Without a configured directory, games fall back to session-only storage.
pub fn install(ctx: &Ctx<'_>) -> rquickjs::Result<()> {
    let Some(dir) = directory() else { return Ok(()) };
    let globals = ctx.globals();
    let get_dir = dir.clone();
    globals.set(
        "__runeStoreGet",
        Function::new(ctx.clone(), move |key: String| read(&get_dir, &key)),
    )?;
    let set_dir = dir.clone();
    globals.set(
        "__runeStoreSet",
        Function::new(ctx.clone(), move |key: String, value: String| {
            write(&set_dir, &key, &value)
        }),
    )?;
    globals.set(
        "__runeStoreRemove",
        Function::new(ctx.clone(), move |key: String| remove(&dir, &key)),
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saves_round_trip_and_reject_unsafe_keys_and_large_values() {
        let dir = std::env::temp_dir().join(format!("rune-tv-storage-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        assert!(write(&dir, "glowtide-aquarium-v1", "{\"pearls\":3}"));
        assert_eq!(read(&dir, "glowtide-aquarium-v1").as_deref(), Some("{\"pearls\":3}"));
        assert!(write(&dir, "glowtide-aquarium-v1", "{}"));
        assert_eq!(read(&dir, "glowtide-aquarium-v1").as_deref(), Some("{}"));
        assert!(!write(&dir, "../escape", &"x".repeat(MAX_VALUE_BYTES + 1)));
        assert!(write(&dir, "../escape", "ok"));
        assert!(!dir.parent().unwrap().join("escape.save").exists());
        assert!(!write(&dir, &"k".repeat(MAX_KEY_BYTES + 1), "x"));
        remove(&dir, "glowtide-aquarium-v1");
        assert_eq!(read(&dir, "glowtide-aquarium-v1"), None);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
