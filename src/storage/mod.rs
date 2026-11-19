//! Small persistent document and event core. All hosts execute the same packets.
mod backend;
pub mod provider;
pub mod server;
use anyhow::{bail, ensure, Context, Result};
use backend::Database;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{ops::Bound, path::Path, sync::Arc};
use tokio::sync::{Notify, Semaphore};

pub const MAX_PACKET: usize = 8 * 1024 * 1024;
pub const MAX_PAGE: usize = 4 * 1024 * 1024;
pub const MAX_VALUE: usize = 1024 * 1024;
pub const MAX_OPS: usize = 256;
pub const CHANGES: &str = "$changes";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Get {
        collection: String,
        key: String,
    },
    Scan {
        collection: String,
        #[serde(default)]
        prefix: String,
        #[serde(default)]
        after: Option<String>,
        #[serde(default = "page_size")]
        limit: usize,
    },
    Put {
        collection: String,
        key: String,
        value: Value,
        #[serde(default)]
        expected: Option<String>,
    },
    Delete {
        collection: String,
        key: String,
        #[serde(default)]
        expected: Option<String>,
    },
    Increment {
        collection: String,
        key: String,
        #[serde(default)]
        path: Vec<Segment>,
        by: Value,
        #[serde(default)]
        expected: Option<String>,
    },
    Append {
        stream: String,
        kind: String,
        value: Value,
    },
    Read {
        stream: String,
        #[serde(default = "zero")]
        after: String,
        #[serde(default = "page_size")]
        limit: usize,
        #[serde(default)]
        wait_ms: u64,
    },
    Batch {
        operations: Vec<Request>,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Segment {
    Field(String),
    Index(usize),
    Find { field: String, equals: Value },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Record {
    pub key: String,
    pub value: Value,
    pub revision: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Event {
    pub stream: String,
    pub sequence: String,
    pub commit: String,
    pub kind: String,
    pub value: Value,
}
fn page_size() -> usize {
    100
}
fn zero() -> String {
    "0".into()
}
fn encode<T: Serialize>(v: &T) -> Result<Vec<u8>> {
    Ok(rmp_serde::to_vec_named(v)?)
}
fn decode<T: serde::de::DeserializeOwned>(b: &[u8]) -> Result<T> {
    Ok(rmp_serde::from_slice(b)?)
}
fn name(s: &str) -> Result<()> {
    ensure!(
        !s.is_empty() && s.len() <= 256 && !s.contains('\0'),
        "invalid name (1..256 UTF-8 bytes required)"
    );
    Ok(())
}
fn record_key(collection: &str, key: &str) -> Result<Vec<u8>> {
    name(collection)?;
    ensure!(key.len() <= 4096, "key exceeds 4096 bytes");
    Ok([
        &[b'R'][..],
        &(collection.len() as u32).to_be_bytes(),
        collection.as_bytes(),
        key.as_bytes(),
    ]
    .concat())
}
fn stream_key(tag: u8, stream: &str) -> Result<Vec<u8>> {
    name(stream)?;
    Ok([
        &[tag][..],
        &(stream.len() as u32).to_be_bytes(),
        stream.as_bytes(),
    ]
    .concat())
}
fn position(s: &str) -> Result<u64> {
    ensure!(
        !s.is_empty() && s.bytes().all(|c| c.is_ascii_digit()),
        "invalid cursor"
    );
    s.parse().context("invalid cursor")
}
fn numeric_add(a: &Value, b: &Value) -> Result<Value> {
    if let (Some(a), Some(b)) = (a.as_i64(), b.as_i64()) {
        return Ok(json!(a.checked_add(b).context("integer overflow")?));
    }
    if let (Some(a), Some(b)) = (a.as_u64(), b.as_u64()) {
        return Ok(json!(a.checked_add(b).context("integer overflow")?));
    }
    let integer = |v: &Value| v.as_i64().is_some() || v.as_u64().is_some();
    ensure!(
        !(integer(a) && integer(b)),
        "incompatible signed/unsigned integer ranges"
    );
    for value in [a, b] {
        ensure!(
            !integer(value)
                || value
                    .as_f64()
                    .is_some_and(|v| v.abs() <= 9_007_199_254_740_991.0),
            "fractional increment exceeds exact integer precision"
        );
    }
    let v = a.as_f64().context("increment target must be numeric")?
        + b.as_f64().context("increment must be numeric")?;
    ensure!(v.is_finite(), "numeric overflow");
    Ok(json!(v))
}
fn target<'a>(mut value: &'a mut Value, path: &[Segment]) -> Result<&'a mut Value> {
    for segment in path {
        value = match segment {
            Segment::Field(k) => value.as_object_mut().and_then(|v| v.get_mut(k)),
            Segment::Index(i) => value.as_array_mut().and_then(|v| v.get_mut(*i)),
            Segment::Find { field, equals } => value
                .as_array_mut()
                .and_then(|v| v.iter_mut().find(|v| v.get(field) == Some(equals))),
        }
        .context("mutation target not found")?;
    }
    Ok(value)
}

pub struct Store {
    db: Database,
    pub changed: Notify,
    pub permits: Arc<Semaphore>,
}
impl Store {
    pub fn open(path: &Path) -> Result<Arc<Self>> {
        if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
            std::fs::create_dir_all(parent)?;
        }
        let db = Database::open(path)?;
        {
            let tx = db.begin_write()?;
            {
                let mut table = tx.open_table()?;
                let version = table.get(&b"format"[..])?.map(|v| v.value().to_vec());
                match version {
                    Some(v) => ensure!(v == b"1", "unsupported database format"),
                    None => {
                        table.insert(&b"format"[..], &b"1"[..])?;
                    }
                }
            }
            tx.commit()?;
        }
        Ok(Arc::new(Self {
            db,
            changed: Notify::new(),
            permits: Arc::new(Semaphore::new(8)),
        }))
    }

    pub fn execute(&self, request: &Request) -> Result<Value> {
        ensure!(encode(request)?.len() <= MAX_PACKET, "packet exceeds 8 MiB");
        match request {
            Request::Get { collection, key } => {
                let tx = self.db.begin_read()?;
                let table = tx.open_table()?;
                let value = table.get(record_key(collection, key)?.as_slice())?;
                Ok(match value {
                    Some(v) => serde_json::to_value(decode::<Record>(v.value())?)?,
                    None => Value::Null,
                })
            }
            Request::Scan {
                collection,
                prefix,
                after,
                limit,
            } => {
                ensure!((1..=1000).contains(limit), "limit must be 1..1000");
                let base = record_key(collection, "")?;
                let seek = record_key(collection, after.as_deref().unwrap_or(prefix))?;
                if let Some(after) = after {
                    ensure!(
                        after.starts_with(prefix),
                        "scan cursor does not match prefix"
                    );
                }
                let tx = self.db.begin_read()?;
                let table = tx.open_table()?;
                let start = if after.is_some() {
                    Bound::Excluded(seek.as_slice())
                } else {
                    Bound::Included(seek.as_slice())
                };
                let mut items = Vec::new();
                let mut bytes = 0;
                let mut more = false;
                let full_prefix = record_key(collection, prefix)?;
                for (key, value) in table.range(start, &full_prefix, limit + 1)? {
                    if !key.value().starts_with(&base) {
                        break;
                    }
                    let record: Record = decode(value.value())?;
                    if !record.key.starts_with(prefix) {
                        break;
                    }
                    if items.len() == *limit
                        || (!items.is_empty() && bytes + value.value().len() > MAX_PAGE)
                    {
                        more = true;
                        break;
                    }
                    bytes += value.value().len();
                    items.push(record);
                }
                let next = if more {
                    items.last().map(|v| v.key.clone())
                } else {
                    None
                };
                Ok(json!({"items": items, "next": next}))
            }
            Request::Read {
                stream,
                after,
                limit,
                wait_ms,
            } => {
                ensure!((1..=1000).contains(limit), "limit must be 1..1000");
                ensure!(*wait_ms <= 30000, "wait_ms exceeds 30000");
                let prefix = stream_key(b'E', stream)?;
                let mut seek = prefix.clone();
                seek.extend(position(after)?.to_be_bytes());
                let tx = self.db.begin_read()?;
                let table = tx.open_table()?;
                let mut items = Vec::new();
                let mut bytes = 0;
                for (key, value) in
                    table.range(Bound::Excluded(seek.as_slice()), &prefix, limit + 1)?
                {
                    if !key.value().starts_with(&prefix) {
                        break;
                    }
                    if items.len() == *limit
                        || (!items.is_empty() && bytes + value.value().len() > MAX_PAGE)
                    {
                        break;
                    }
                    bytes += value.value().len();
                    items.push(decode::<Event>(value.value())?);
                }
                let next = items
                    .last()
                    .map(|v| v.sequence.clone())
                    .unwrap_or_else(|| after.clone());
                Ok(json!({"events": items, "next": next}))
            }
            _ => self.write(request),
        }
    }

    fn write(&self, request: &Request) -> Result<Value> {
        let operations = match request {
            Request::Batch { operations } => operations.as_slice(),
            _ => std::slice::from_ref(request),
        };
        ensure!(
            !operations.is_empty() && operations.len() <= MAX_OPS,
            "batch requires 1..256 mutations"
        );
        let tx = self.db.begin_write()?;
        let mut results = Vec::new();
        let commit;
        {
            let mut table = tx.open_table()?;
            let old = table
                .get(&b"commit"[..])?
                .map(|v| decode::<u64>(v.value()))
                .transpose()?
                .unwrap_or(0);
            commit = old.checked_add(1).context("commit counter exhausted")?;
            for op in operations {
                let (collection, key, value, expected, kind) = match op {
                    Request::Put {
                        collection,
                        key,
                        value,
                        expected,
                    } => (collection, key, Some(value), expected, "put"),
                    Request::Delete {
                        collection,
                        key,
                        expected,
                    } => (collection, key, None, expected, "delete"),
                    Request::Increment {
                        collection,
                        key,
                        expected,
                        ..
                    } => (collection, key, None, expected, "increment"),
                    Request::Append {
                        stream,
                        kind,
                        value,
                    } => {
                        ensure!(stream != CHANGES, "$changes is reserved");
                        name(kind)?;
                        ensure!(encode(value)?.len() <= MAX_VALUE, "value exceeds 1 MiB");
                        results.push(serde_json::to_value(append(
                            &mut table,
                            stream,
                            kind,
                            value.clone(),
                            commit,
                        )?)?);
                        continue;
                    }
                    _ => bail!("batch accepts only put, delete, increment and append"),
                };
                let raw_key = record_key(collection, key)?;
                let current = table
                    .get(raw_key.as_slice())?
                    .map(|v| decode::<Record>(v.value()))
                    .transpose()?;
                if let Some(expected) = expected {
                    let revision = current.as_ref().map(|v| v.revision.as_str()).unwrap_or("0");
                    ensure!(
                        revision == expected,
                        "conflict: expected revision {expected}, found {revision}"
                    );
                }
                let mut changed_value = value.cloned();
                let mut patch = Value::Null;
                if let Request::Increment { path, by, .. } = op {
                    ensure!(path.len() <= 32, "mutation path exceeds 32 segments");
                    let mut record = current.clone().context("mutation record not found")?;
                    let field = target(&mut record.value, path)?;
                    *field = numeric_add(field, by)?;
                    patch = json!({"path": path, "by": by, "value": field});
                    changed_value = Some(record.value);
                }
                let result = if let Some(value) = changed_value {
                    ensure!(encode(&value)?.len() <= MAX_VALUE, "value exceeds 1 MiB");
                    let record = Record {
                        key: key.clone(),
                        value,
                        revision: commit.to_string(),
                    };
                    table.insert(raw_key.as_slice(), encode(&record)?.as_slice())?;
                    if kind == "increment" {
                        json!({"key": key, "revision": commit.to_string(), "patch": patch})
                    } else {
                        serde_json::to_value(record)?
                    }
                } else {
                    table.remove(raw_key.as_slice())?;
                    json!({"key": key, "deleted": current.is_some(), "revision": commit.to_string()})
                };
                let change = if kind == "increment" {
                    json!({"collection": collection, "key": key, "revision": commit.to_string(), "patch": patch})
                } else {
                    json!({"collection": collection, "key": key, "record": result})
                };
                append(&mut table, CHANGES, kind, change, commit)?;
                results.push(result);
            }
            table.insert(&b"commit"[..], encode(&commit)?.as_slice())?;
        }
        let reply = json!({"commit": commit.to_string(), "results": results});
        ensure!(
            serde_json::to_vec(&reply)?.len() <= MAX_PACKET - 256,
            "commit response exceeds 8 MiB"
        );
        tx.commit()?;
        self.changed.notify_waiters();
        Ok(reply)
    }
}

fn append(
    table: &mut backend::Table<'_>,
    stream: &str,
    kind: &str,
    value: Value,
    commit: u64,
) -> Result<Event> {
    let meta = stream_key(b'S', stream)?;
    let old = table
        .get(meta.as_slice())?
        .map(|v| decode::<u64>(v.value()))
        .transpose()?
        .unwrap_or(0);
    let sequence = old.checked_add(1).context("stream counter exhausted")?;
    let mut key = stream_key(b'E', stream)?;
    key.extend(sequence.to_be_bytes());
    let event = Event {
        stream: stream.into(),
        sequence: sequence.to_string(),
        commit: commit.to_string(),
        kind: kind.into(),
        value,
    };
    table.insert(key.as_slice(), encode(&event)?.as_slice())?;
    table.insert(meta.as_slice(), encode(&sequence)?.as_slice())?;
    Ok(event)
}

pub async fn execute(store: Arc<Store>, request: Request) -> Result<Value> {
    let once = |request: Request| {
        let store = store.clone();
        async move {
            let permit = store
                .permits
                .clone()
                .try_acquire_owned()
                .context("busy: storage concurrency limit reached")?;
            tokio::task::spawn_blocking(move || {
                let _permit = permit;
                store.execute(&request)
            })
            .await?
        }
    };
    let wait = match request {
        Request::Read { wait_ms, .. } => wait_ms.min(30000),
        _ => 0,
    };
    let deadline = tokio::time::Instant::now() + std::time::Duration::from_millis(wait);
    loop {
        // Register before reading, so a commit between the read and await is retained.
        let notified = store.changed.notified();
        tokio::pin!(notified);
        notified.as_mut().enable();
        let result = once(request.clone()).await?;
        if wait == 0
            || result["events"].as_array().is_none_or(|v| !v.is_empty())
            || tokio::time::Instant::now() >= deadline
        {
            return Ok(result);
        }
        let _ = tokio::time::timeout_at(deadline, notified).await;
    }
}
