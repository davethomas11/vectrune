//! Immutable page snapshots, published atomically so a key always replays one result.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{self, Read, Write},
    path::PathBuf,
};
use tokio::sync::Mutex;

pub(super) fn digest(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}

#[derive(Serialize, Deserialize)]
pub(super) struct Snapshot {
    pub key: String,
    pub identity: String,
    pub engine: String,
    pub html: String,
}

pub(super) struct GenerationStore {
    directory: PathBuf,
    limit: usize,
    writes: Mutex<()>,
}

impl GenerationStore {
    pub fn new(directory: PathBuf, limit: usize) -> Self {
        Self {
            directory,
            limit,
            writes: Mutex::new(()),
        }
    }
    fn path(&self, key: &str, identity: &str) -> PathBuf {
        self.directory.join(format!(
            "{}.snapshot",
            digest(&serde_json::json!([key, identity]).to_string())
        ))
    }
    pub async fn get(&self, key: &str, identity: &str) -> Result<Option<Snapshot>, String> {
        let path = self.path(key, identity);
        let key = key.to_owned();
        let identity = identity.to_owned();
        tokio::task::spawn_blocking(move || read(path, &key, &identity))
            .await
            .map_err(|_| "Could not read saved generation".to_string())?
            .map_err(|_| "Could not read saved generation".into())
    }
    /// Concurrent creators return the first published snapshot, never overwrite it.
    pub async fn save(&self, snapshot: Snapshot) -> Result<(Snapshot, bool), String> {
        let _write = self.writes.lock().await;
        let path = self.path(&snapshot.key, &snapshot.identity);
        let directory = self.directory.clone();
        let limit = self.limit;
        tokio::task::spawn_blocking(move || -> Result<(Snapshot, bool), String> {
            let failed = || "Could not save generation".to_string();
            if let Some(existing) = read(path.clone(), &snapshot.key, &snapshot.identity).map_err(|_| failed())? {
                return Ok((existing, false));
            }
            fs::create_dir_all(&directory).map_err(|_| failed())?;
            let entries = fs::read_dir(&directory).map_err(|_| failed())?
                .collect::<Result<Vec<_>, _>>().map_err(|_| failed())?;
            if entries.iter().filter(|entry| entry.path().extension().is_some_and(|ext| ext == "snapshot")).count() >= limit {
                return Err("Saved generation limit reached; remove old snapshots or raise generation_limit".into());
            }
            let mut temp = tempfile::NamedTempFile::new_in(&directory).map_err(|_| failed())?;
            serde_json::to_writer(&mut temp, &snapshot).map_err(|_| failed())?;
            temp.flush().map_err(|_| failed())?;
            temp.as_file().sync_all().map_err(|_| failed())?;
            match temp.persist_noclobber(&path) {
                Ok(_) => Ok((snapshot, true)),
                Err(error) if error.error.kind() == io::ErrorKind::AlreadyExists => {
                    read(path, &snapshot.key, &snapshot.identity).map_err(|_| failed())?
                        .map(|existing| (existing, false)).ok_or_else(failed)
                }
                Err(_) => Err(failed()),
            }
        }).await.map_err(|_| "Could not save generation".to_string())?
    }
}

fn read(path: PathBuf, key: &str, identity: &str) -> io::Result<Option<Snapshot>> {
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error),
    };
    let mut bytes = Vec::new();
    // JSON escapes can expand HTML, so bound the envelope separately.
    const MAX_SNAPSHOT: u64 = 8 * 1024 * 1024;
    file.take(MAX_SNAPSHOT + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > MAX_SNAPSHOT {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Snapshot too large",
        ));
    }
    let snapshot: Snapshot = serde_json::from_slice(&bytes)?;
    if snapshot.key != key
        || snapshot.identity != identity
        || snapshot.html.len() > super::engine::MAX_OUTPUT_BYTES
        || !matches!(snapshot.engine.as_str(), "ollama" | "codex" | "copilot")
        || super::clean_output(&snapshot.html, super::OutputKind::Html).is_err()
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "Invalid snapshot",
        ));
    }
    Ok(Some(snapshot))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn atomic_publication_keeps_the_first_snapshot_across_store_instances() {
        let directory = tempfile::tempdir().unwrap();
        let a = GenerationStore::new(directory.path().into(), 10);
        let b = GenerationStore::new(directory.path().into(), 10);
        let snapshot = |text| Snapshot {
            key: "stable".into(),
            identity: "same-page".into(),
            engine: "ollama".into(),
            html: format!("<!doctype html><html><body>{text}</body></html>"),
        };
        let (a, b) = tokio::join!(a.save(snapshot("A")), b.save(snapshot("B")));
        let (a, a_created) = a.unwrap();
        let (b, b_created) = b.unwrap();
        assert_eq!(a.html, b.html);
        assert_ne!(a_created, b_created);
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }
}
