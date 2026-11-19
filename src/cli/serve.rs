//! Supervise independent HTTP applications in one process.
use crate::{
    apps,
    core::{extract_data_sources, extract_schemas, get_app_type, AppState},
    rune_parser::load_rune_document_from_path,
    util::{log, LogLevel},
};
use anyhow::{ensure, Context, Result};
use std::{path::PathBuf, sync::Arc, time::Duration};

pub async fn run(
    paths: &[PathBuf],
    port: Option<u16>,
    host: Option<&str>,
    watch: bool,
) -> Result<()> {
    let watcher = if watch {
        let names: Vec<_> = paths
            .iter()
            .map(|p| p.to_str().context("app path must be UTF-8"))
            .collect::<Result<_>>()?;
        Some(super::start_file_watcher(names)?)
    } else {
        None
    };
    loop {
        // Bind every listener before starting any app. A failed configuration or
        // occupied port must not leave a partially running group.
        let mut prepared = Vec::new();
        for (index, path) in paths.iter().enumerate() {
            ensure!(
                path.is_dir() || path.extension().is_some_and(|v| v == "rune"),
                "--secondary-app requires Rune HTTP applications: {}",
                path.display()
            );
            let doc = load_rune_document_from_path(path).map_err(anyhow::Error::msg)?;
            let kind = get_app_type(&doc).context("each application requires @App type")?;
            ensure!(
                apps::app_type_supported(&kind),
                "unsupported application type: {kind}"
            );
            let app = doc.get_section("App").context("@App required")?;
            let configured_host = app
                .kv
                .get("host")
                .and_then(|v| v.as_str())
                .unwrap_or("127.0.0.1");
            let address_host = if index == 0 {
                host.unwrap_or(configured_host)
            } else {
                configured_host
            }
            .to_owned();
            let configured_port = match app.kv.get("port") {
                Some(value) => {
                    u16::try_from(value.as_u64().context("app port must be an integer")?)
                        .context("app port exceeds 65535")?
                }
                None => 3000,
            };
            let address_port = if index == 0 {
                port.unwrap_or(configured_port)
            } else {
                configured_port
            };
            let address = format!("{address_host}:{address_port}");
            let state = AppState {
                schemas: Arc::new(extract_schemas(&doc)),
                data_sources: Arc::new(extract_data_sources(&doc)),
                doc: Arc::new(doc),
                path: if path.is_dir() {
                    path.clone()
                } else {
                    path.parent().unwrap_or(std::path::Path::new(".")).into()
                },
            };
            if kind.eq_ignore_ascii_case("rune-db") || kind.eq_ignore_ascii_case("vect-event") {
                crate::storage::server::validate(&state, &address_host)?;
            }
            let listener = tokio::net::TcpListener::bind(&address)
                .await
                .with_context(|| format!("cannot bind {} at {address}", path.display()))?;
            prepared.push((path.clone(), listener, state));
        }
        let (shutdown, _) = tokio::sync::broadcast::channel::<()>(1);
        let mut servers = tokio::task::JoinSet::new();
        for (path, listener, state) in prepared {
            let router = apps::build_app_router(state).await;
            log(
                LogLevel::Info,
                &format!(
                    "{} listening on http://{}",
                    path.display(),
                    listener.local_addr()?
                ),
            );
            let mut stop = shutdown.subscribe();
            servers.spawn(async move {
                axum::serve(listener, router)
                    .with_graceful_shutdown(async move {
                        let _ = stop.recv().await;
                    })
                    .await
            });
        }
        let (restart, result) = tokio::select! {
            result = servers.join_next() => (false, match result {
                Some(Err(error)) => Err(error.into()),
                Some(Ok(Err(error))) => Err(error.into()),
                _ => Err(anyhow::anyhow!("an application server stopped unexpectedly")),
            }),
            result = tokio::signal::ctrl_c() => (false, result.context("cannot listen for Ctrl-C")),
            _ = async {
                let rx = watcher.as_ref().unwrap();
                loop {
                    if rx.try_recv().is_ok() { break; }
                    tokio::time::sleep(Duration::from_millis(200)).await;
                }
            }, if watcher.is_some() => (true, Ok(())),
        };
        let _ = shutdown.send(());
        // Bound shutdown even if a client leaves a request open.
        let _ = tokio::time::timeout(Duration::from_secs(2), async {
            while servers.join_next().await.is_some() {}
        })
        .await;
        servers.abort_all();
        while servers.join_next().await.is_some() {}
        result?;
        if !restart {
            return Ok(());
        }
        log(
            LogLevel::Info,
            "File change detected. Restarting application group...",
        );
        if let Some(rx) = &watcher {
            while rx.try_recv().is_ok() {}
        }
    }
}
