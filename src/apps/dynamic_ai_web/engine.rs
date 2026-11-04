//! Generation-only adapters. HTTP input is never interpreted as a shell command.
use async_trait::async_trait;
use reqwest::Client;
use serde_json::json;
use std::{process::Stdio, sync::Arc};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWriteExt},
    process::Command,
};

use super::Config;

pub const MAX_OUTPUT_BYTES: usize = 1024 * 1024;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OutputKind {
    Html,
    Json,
}

#[derive(Debug)]
pub struct EngineError(pub String);

#[async_trait]
pub trait AiEngine: Send + Sync {
    async fn generate(&self, prompt: &str, output: OutputKind) -> Result<String, EngineError>;
}

pub(super) fn create(config: &Config) -> Result<Arc<dyn AiEngine>, String> {
    match config.engine.as_str() {
        "ollama" => {
            let endpoint = config.endpoint.clone().unwrap_or_else(|| {
                std::env::var("VECTRUNE_OLLAMA_URL")
                    .unwrap_or_else(|_| "http://127.0.0.1:11434/api/generate".into())
            });
            let url = reqwest::Url::parse(&endpoint).map_err(|_| "invalid Ollama endpoint")?;
            if !matches!(url.scheme(), "http" | "https") {
                return Err("Ollama endpoint must use HTTP or HTTPS".into());
            }
            let client = Client::builder()
                .connect_timeout(std::time::Duration::from_secs(5))
                .build()
                .map_err(|_| "could not create Ollama client")?;
            Ok(Arc::new(Ollama {
                endpoint,
                client,
                model: config.model.clone().unwrap_or_else(|| "phi4".into()),
            }))
        }
        "codex" | "copilot" => Ok(Arc::new(Cli {
            engine: config.engine.clone(),
            executable: config
                .executable
                .clone()
                .unwrap_or_else(|| config.engine.clone()),
            model: config.model.clone(),
        })),
        _ => Err("engine must be ollama, codex, or copilot".into()),
    }
}

struct Ollama {
    endpoint: String,
    model: String,
    client: Client,
}

#[async_trait]
impl AiEngine for Ollama {
    async fn generate(&self, prompt: &str, output: OutputKind) -> Result<String, EngineError> {
        let mut payload = json!({
            "model": self.model, "prompt": prompt, "stream": false,
            "options": { "num_predict": 8192 },
        });
        if output == OutputKind::Json {
            payload["format"] = json!("json");
        }
        let mut response = self
            .client
            .post(&self.endpoint)
            .json(&payload)
            .send()
            .await
            .map_err(|_| {
                EngineError(
                    "Could not reach Ollama. Check the service and configured model.".into(),
                )
            })?;
        if !response.status().is_success() {
            return Err(EngineError(format!(
                "Ollama returned HTTP {}. Check its model and service logs.",
                response.status().as_u16()
            )));
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| EngineError("Could not read Ollama response.".into()))?
        {
            if bytes.len() + chunk.len() > MAX_OUTPUT_BYTES * 2 {
                return Err(EngineError(
                    "Ollama response exceeded the size limit.".into(),
                ));
            }
            bytes.extend_from_slice(&chunk);
        }
        let value: serde_json::Value = serde_json::from_slice(&bytes)
            .map_err(|_| EngineError("Ollama returned an invalid generation response.".into()))?;
        let text = value
            .get("response")
            .and_then(|value| value.as_str())
            .ok_or_else(|| EngineError("Ollama response did not contain generated text.".into()))?;
        if text.len() > MAX_OUTPUT_BYTES {
            return Err(EngineError(
                "Generated response exceeded the size limit.".into(),
            ));
        }
        Ok(text.to_owned())
    }
}

struct Cli {
    engine: String,
    executable: String,
    model: Option<String>,
}

fn arguments(engine: &str, model: Option<&str>) -> Vec<String> {
    let mut args: Vec<String> = if engine == "codex" {
        [
            "exec",
            "--ignore-user-config",
            "--skip-git-repo-check",
            "--ephemeral",
            "--color",
            "never",
            "--sandbox",
            "read-only",
            "-c",
            "approval_policy=\"never\"",
            "-c",
            "project_doc_max_bytes=0",
            "-c",
            "web_search=\"disabled\"",
            "-c",
            "features.shell_tool=false",
            "-c",
            "features.view_image=false",
            "-c",
            "features.multi_agent=false",
            "-c",
            "features.hooks=false",
            "-c",
            "features.plugins=false",
            "-c",
            "features.remote_plugin=false",
            "-c",
            "features.skill_search=false",
            "-c",
            "features.skill_mcp_dependency_install=false",
        ]
        .into_iter()
        .map(String::from)
        .collect()
    } else {
        [
            "--silent",
            "--no-color",
            "--no-auto-update",
            "--no-ask-user",
            "--no-custom-instructions",
            "--disable-builtin-mcps",
            "--deny-tool",
            "shell,write,read,url,memory",
        ]
        .into_iter()
        .map(String::from)
        .collect()
    };
    if let Some(model) = model {
        args.extend(["--model".into(), model.into()]);
    }
    if engine == "codex" {
        args.push("-".into());
    } else {
        args.push("--available-tools".into());
    }
    args
}

async fn read_bounded(
    reader: impl AsyncRead + Unpin,
    limit: usize,
) -> Result<Vec<u8>, EngineError> {
    let mut data = Vec::new();
    reader
        .take(limit as u64 + 1)
        .read_to_end(&mut data)
        .await
        .map_err(|_| EngineError("Could not read AI CLI output.".into()))?;
    if data.len() > limit {
        return Err(EngineError("AI CLI output exceeded the size limit.".into()));
    }
    Ok(data)
}

#[async_trait]
impl AiEngine for Cli {
    async fn generate(&self, prompt: &str, _output: OutputKind) -> Result<String, EngineError> {
        // Use an empty, private workspace, never the source project. Existing CLI
        // authentication remains available; no shell or permission-bypass flags.
        let workspace = tempfile::tempdir()
            .map_err(|_| EngineError("Could not create generation workspace.".into()))?;
        let mut command = Command::new(&self.executable);
        command
            .args(arguments(&self.engine, self.model.as_deref()))
            .current_dir(workspace.path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        let mut child = command.spawn().map_err(|_| {
            EngineError(format!(
                "Could not start {}. Install and authenticate its CLI first.",
                self.engine
            ))
        })?;
        let mut stdin = child.stdin.take().unwrap();
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        let write = async {
            stdin
                .write_all(prompt.as_bytes())
                .await
                .map_err(|_| EngineError("Could not send prompt to AI CLI.".into()))?;
            drop(stdin);
            Ok(())
        };
        let wait = async {
            child
                .wait()
                .await
                .map_err(|_| EngineError("Could not wait for AI CLI.".into()))
        };
        let (_, stdout, _, status) = tokio::try_join!(
            write,
            read_bounded(stdout, MAX_OUTPUT_BYTES),
            read_bounded(stderr, 64 * 1024),
            wait
        )?;
        if !status.success() {
            return Err(EngineError(format!(
                "{} generation failed. Check CLI authentication and supported options.",
                self.engine
            )));
        }
        String::from_utf8(stdout)
            .map_err(|_| EngineError("AI CLI returned non-UTF-8 output.".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cli_arguments_never_grant_tools_or_shell_interpolation() {
        let codex = arguments("codex", Some("a model; echo unsafe"));
        assert!(codex.contains(&"read-only".into()));
        assert!(codex.contains(&"features.shell_tool=false".into()));
        assert!(codex.contains(&"features.hooks=false".into()));
        assert!(codex.contains(&"features.multi_agent=false".into()));
        assert!(codex.contains(&"a model; echo unsafe".into()));
        assert_eq!(codex.last().unwrap(), "-");
        let copilot = arguments("copilot", None);
        assert_eq!(copilot.last().unwrap(), "--available-tools");
        assert!(copilot.contains(&"--disable-builtin-mcps".into()));
        for argument in codex.iter().chain(copilot.iter()) {
            assert!(!argument.contains("dangerously"));
            assert!(!argument.contains("allow-all"));
        }
    }
    #[tokio::test]
    async fn output_reads_are_bounded() {
        assert!(read_bounded(&b"12345"[..], 4).await.is_err());
        assert_eq!(read_bounded(&b"1234"[..], 4).await.unwrap(), b"1234");
    }
}
