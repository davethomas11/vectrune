use super::{execute, Request, Store, MAX_PACKET};
use crate::{
    core::AppState,
    rune_ast::{RuneDocument, Section},
};
use anyhow::{ensure, Context, Result};
use once_cell::sync::Lazy;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

static STORES: Lazy<Mutex<HashMap<PathBuf, Arc<Store>>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(40))
        .build()
        .expect("HTTP client")
});

pub fn field<'a>(section: &'a Section, name: &str) -> Option<&'a str> {
    section.kv.get(name).and_then(|v| v.as_str())
}
pub fn source<'a>(doc: &'a RuneDocument, name: &str) -> Result<&'a Section> {
    let mut sources = doc.sections.iter().filter(|s| {
        s.path.len() == 2
            && matches!(s.path[0].as_str(), "DataSource" | "Datasource")
            && s.path[1] == name
    });
    let source = sources
        .next()
        .with_context(|| format!("unknown datasource: {name}"))?;
    ensure!(
        sources.next().is_none(),
        "duplicate datasource name across section spellings: {name}"
    );
    Ok(source)
}
#[derive(Clone)]
pub enum Connection {
    Local(Arc<Store>),
    Remote {
        endpoint: String,
        token: Option<String>,
    },
}
#[derive(Clone)]
pub struct Provider {
    pub connection: Connection,
    pub events_only: bool,
}
impl Provider {
    pub fn open(doc: &RuneDocument, root: &Path, name: &str) -> Result<Self> {
        fn open(
            doc: &RuneDocument,
            root: &Path,
            name: &str,
            seen: &mut HashSet<String>,
        ) -> Result<Provider> {
            ensure!(seen.insert(name.into()), "datasource cycle at {name}");
            let section = source(doc, name)?;
            let kind = field(section, "type").unwrap_or("");
            ensure!(
                matches!(kind, "rune-db" | "vect-event"),
                "unsupported storage provider: {kind}"
            );
            let events_only = kind == "vect-event";
            let mode = field(section, "mode").unwrap_or("embedded");
            if mode == "remote" {
                let endpoint =
                    field(section, "endpoint").context("remote datasource requires endpoint")?;
                let url = reqwest::Url::parse(endpoint)?;
                ensure!(
                    matches!(url.scheme(), "http" | "https")
                        && url.host_str().is_some()
                        && url.username().is_empty()
                        && url.password().is_none()
                        && url.query().is_none()
                        && url.fragment().is_none(),
                    "endpoint must be an HTTP(S) URL without credentials, query or fragment"
                );
                let token = field(section, "token_env")
                    .map(|key| {
                        std::env::var(key)
                            .context("datasource token environment variable is missing")
                    })
                    .transpose()?;
                return Ok(Provider {
                    connection: Connection::Remote {
                        endpoint: endpoint.trim_end_matches('/').into(),
                        token,
                    },
                    events_only,
                });
            }
            ensure!(mode == "embedded", "mode must be embedded or remote");
            if events_only {
                let store = field(section, "store")
                    .context("vect-event requires store = <rune-db datasource>")?;
                let mut provider = open(doc, root, store, seen)?;
                ensure!(
                    !provider.events_only,
                    "vect-event store must be a rune-db datasource"
                );
                provider.events_only = true;
                return Ok(provider);
            }
            let database = field(section, "database").unwrap_or(name);
            ensure!(
                !database.is_empty()
                    && database.len() <= 128
                    && database
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || "_-".contains(c)),
                "database name must contain only letters, numbers, _ or -"
            );
            let base = section
                .source_file
                .as_deref()
                .map(Path::new)
                .and_then(Path::parent)
                .filter(|p| !p.as_os_str().is_empty())
                .unwrap_or(root);
            let file = field(section, "native_path")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from(format!(".vectrune/data/{database}.rdb")));
            let file = if file.is_absolute() {
                file
            } else {
                base.join(file)
            };
            let parent = file.parent().context("database path requires a parent")?;
            std::fs::create_dir_all(parent)?;
            let file = parent
                .canonicalize()?
                .join(file.file_name().context("database filename required")?);
            let mut stores = STORES
                .lock()
                .map_err(|_| anyhow::anyhow!("storage registry poisoned"))?;
            if let Some(store) = stores.get(&file) {
                return Ok(Provider {
                    connection: Connection::Local(store.clone()),
                    events_only,
                });
            }
            ensure!(stores.len() < 64, "host limit of 64 open databases reached");
            let store = Store::open(&file).with_context(|| {
                format!(
                    "cannot open {}; if a server owns it, use a remote datasource",
                    file.display()
                )
            })?;
            stores.insert(file, store.clone());
            Ok(Provider {
                connection: Connection::Local(store),
                events_only,
            })
        }
        open(doc, root, name, &mut HashSet::new())
    }
    pub fn from_state(state: &AppState, name: &str) -> Result<Self> {
        Self::open(&state.doc, &state.path, name)
    }
    pub async fn request(&self, request: Request) -> Result<Value> {
        fn events_only(request: &Request) -> bool {
            match request {
                Request::Append { .. } | Request::Read { .. } => true,
                Request::Batch { operations } => operations.iter().all(events_only),
                _ => false,
            }
        }
        ensure!(
            !self.events_only || events_only(&request),
            "vect-event accepts append/read/tail and append-only batches"
        );
        match &self.connection {
            Connection::Local(store) => execute(store.clone(), request).await,
            Connection::Remote { endpoint, token } => {
                remote(endpoint, token.as_deref(), &request).await
            }
        }
    }
}

pub async fn remote(endpoint: &str, token: Option<&str>, request: &Request) -> Result<Value> {
    let url = reqwest::Url::parse(endpoint)?;
    ensure!(matches!(url.scheme(), "http" | "https") && url.host_str().is_some() && url.username().is_empty() && url.password().is_none() && url.query().is_none() && url.fragment().is_none(), "endpoint must be an HTTP(S) URL without credentials, query or fragment");
    let packet = rmp_serde::to_vec_named(request)?;
    ensure!(packet.len() <= MAX_PACKET, "packet exceeds 8 MiB");
    let mut call = CLIENT
        .post(format!("{}/v1/execute", endpoint.trim_end_matches('/')))
        .header("content-type", "application/msgpack")
        .header("accept", "application/msgpack")
        .body(packet);
    if let Some(token) = token {
        call = call.bearer_auth(token);
    }
    let mut response = call.send().await.context("storage server request failed")?;
    let status = response.status();
    let msgpack = response
        .headers()
        .get("content-type")
        .and_then(|h| h.to_str().ok())
        .is_some_and(|s| s.starts_with("application/msgpack"));
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        ensure!(
            bytes.len() + chunk.len() <= MAX_PACKET,
            "storage response exceeds 8 MiB"
        );
        bytes.extend_from_slice(&chunk);
    }
    let reply: Value = if msgpack {
        rmp_serde::from_slice(&bytes)?
    } else {
        serde_json::from_slice(&bytes)?
    };
    ensure!(
        status.is_success() && reply["ok"] == true,
        "{}",
        reply["error"]["message"]
            .as_str()
            .unwrap_or("storage request failed")
    );
    Ok(reply["data"].clone())
}
