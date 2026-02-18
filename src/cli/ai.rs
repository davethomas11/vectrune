use anyhow::{bail, Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

const DEFAULT_MODEL: &str = "phi4";
const DEFAULT_ENDPOINT: &str = "http://127.0.0.1:11434/api/generate";

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Deserialize)]
struct OllamaResponse {
    response: String,
    #[serde(default)]
    done: bool,
}

pub async fn handle_ai(prompt: &str) -> Result<()> {
    let model = match std::env::var("VECTRUNE_AI_MODEL") {
        Ok(val) if !val.trim().is_empty() => val,
        _ => DEFAULT_MODEL.to_string(),
    };
    let endpoint =
        std::env::var("VECTRUNE_OLLAMA_URL").unwrap_or_else(|_| DEFAULT_ENDPOINT.to_string());
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .context("failed to build HTTP client")?;

    let system_prompt = "You are a CLI command shortcut assistant. Respond ONLY with JSON. Format: {\"command\":\"<cli>\"}. If no CLI applies, respond {\"error\":\"<reason>\"}. Do not add explanations.";

    let payload = OllamaRequest {
        model,
        prompt: format!(
            "{}\nUser request: {}\nRemember: keep answers short and respond with JSON only.",
            system_prompt,
            prompt.trim()
        ),
        stream: false,
    };

    let response = client
        .post(&endpoint)
        .json(&payload)
        .send()
        .await
        .context("failed to reach Ollama. Is it running?")?;

    if !response.status().is_success() {
        bail!(
            "Ollama returned status {}. Body: {}",
            response.status(),
            response.text().await.unwrap_or_default()
        );
    }

    let ollama: OllamaResponse = response
        .json()
        .await
        .context("invalid response from Ollama")?;
    emit_json_reply(ollama.response.trim());
    Ok(())
}

fn emit_json_reply(reply: &str) {
    if let Ok(value) = serde_json::from_str::<Value>(reply) {
        if value.is_object() {
            println!("{}", reply);
            return;
        }
    }

    //strip markdown
    let clean_reply = reply
        .replace("```json", "")
        .replace("```", "")
        .replace("`", "")
        .replace("*", "")
        .replace("_", "")
        .replace("~", "");

    //Get command from JSON if possible
    if let Ok(value) = serde_json::from_str::<Value>(&clean_reply) {
        if let Some(command) = value.get("command").and_then(|v| v.as_str()) {
            println!("{}", command);
            return;
        }
    }

    let fallback = if reply.is_empty() {
        "{\"error\":\"AI did not provide a CLI command\"}".to_string()
    } else {
        format!(
            "{}",
            clean_reply
        )
    };
    println!("{}", fallback);
}
