use anyhow::{bail, Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use indicatif::{ProgressBar, ProgressStyle};

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

pub async fn handle_ai(prompt: &str, model: Option<&str>) -> Result<()> {
    let model = match model {
        Some(m) if !m.is_empty() => m.to_string(),
        _ => std::env::var("VECTRUNE_AI_MODEL").unwrap_or_else(|_| DEFAULT_MODEL.to_string()),
    };
    let client = Client::builder().timeout(Duration::from_secs(30)).build()?;

    let system_instruction = "You are a CLI command shortcut assistant. Respond ONLY with JSON. Format: {\"command\":\"<cli>\"}.";

    let pb = ProgressBar::new_spinner();
    pb.enable_steady_tick(Duration::from_millis(120));
    pb.set_style(
        ProgressStyle::with_template("{spinner:.cyan} {msg}")
            .unwrap()
            .tick_strings(&["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]),
    );
    pb.set_message("Vectrune is thinking...");

    if model.to_lowercase().contains("gemini") {
        let api_key = std::env::var("GEMINI_API_KEY")
            .context("GEMINI_API_KEY environment variable not set")?;

        // Google uses a URL format like: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model, api_key
        );

        let payload = GeminiRequest {
            contents: vec![
                Content {
                    role: "user".to_string(),
                    parts: vec![Part { text: format!("{}\n\nRequest: {}", system_instruction, prompt) }],
                }
            ],
            generation_config: Some(GenerationConfig {
                response_mime_type: "application/json".to_string(),
            }),
        };

        let res = client.post(&url).json(&payload).send().await?;

        // 1. Grab the status code now (it's a simple value that can be copied)
        let status = res.status();

        if !status.is_success() {
            // 2. Consume the response to get the text (this moves 'res')
            let error_text = res.text().await.unwrap_or_else(|_| "Unknown error".into());

            pb.abandon();
            // 3. Use the 'status' variable we saved earlier
            bail!("Gemini API Error ({}): {}", status, error_text);
        }

        // If successful, parse the body (this also moves 'res')
        let gemini_res: GeminiResponse = res.json().await
            .context("Failed to parse successful Gemini response")?;

        if let Some(candidate) = gemini_res.candidates.first() {
            if let Some(part) = candidate.content.parts.first() {
                emit_json_reply(part.text.trim());
            }
        }
    } else {
        let endpoint = std::env::var("VECTRUNE_OLLAMA_URL").unwrap_or_else(|_| DEFAULT_ENDPOINT.to_string());
        let payload = OllamaRequest {
            model,
            prompt: format!(
                "{}\nUser request: {}\nRemember: keep answers short and respond with JSON only.",
                system_instruction,
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
    }

    pb.finish_and_clear();

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

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<Content>,
    generation_config: Option<GenerationConfig>,
}

#[derive(Serialize, Deserialize)]
struct Content {
    role: String,
    parts: Vec<Part>,
}

#[derive(Serialize, Deserialize)]
struct Part {
    text: String,
}

#[derive(Serialize)]
struct GenerationConfig {
    response_mime_type: String, // "application/json"
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Vec<Candidate>,
}

#[derive(Deserialize)]
struct Candidate {
    content: Content,
}