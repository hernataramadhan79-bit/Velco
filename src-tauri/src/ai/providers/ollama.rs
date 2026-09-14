use serde_json::Value;
use tauri::Emitter;
use tokio_util::sync::CancellationToken;

use super::{AiProvider, BoxFuture, ChatMessagePayload, ExtractedImage};

#[derive(Debug, Clone, serde::Serialize)]
struct ChatChunkPayload {
    pub request_id: String,
    pub delta: String,
    pub done: bool,
    pub error: Option<String>,
}

pub struct OllamaProvider {
    pub base_url: String,
    pub model: String,
}

impl OllamaProvider {
    pub fn new(base_url: String, model: String) -> Self {
        Self { base_url, model }
    }
}

impl AiProvider for OllamaProvider {
    fn id(&self) -> &str {
        "ollama"
    }

    fn is_cloud(&self) -> bool {
        false
    }

    fn model(&self) -> &str {
        &self.model
    }

    fn completion<'a>(
        &'a self,
        client: &'a reqwest::Client,
        system_prompt: &'a str,
        user_prompt: &'a str,
        _images: &'a [ExtractedImage],
    ) -> BoxFuture<'a, Result<String, String>> {
        Box::pin(async move {
            let generate_url = format!("{}/api/generate", self.base_url.trim_end_matches('/'));

            let payload = serde_json::json!({
                "model": self.model,
                "prompt": user_prompt,
                "system": system_prompt,
                "format": "json",
                "stream": false
            });

            let resp = client
                .post(&generate_url)
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Ollama request failed: {}", e))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let err_text = resp.text().await.unwrap_or_default();
                return Err(format!("Ollama error (HTTP {}): {}", status, err_text));
            }

            let val: Value = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

            val.get("response")
                .and_then(|r| r.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "Empty response from Ollama".to_string())
        })
    }

    fn stream_chat<'a>(
        &'a self,
        client: &'a reqwest::Client,
        system_prompt: &'a str,
        messages: &'a [ChatMessagePayload],
        _images: &'a [ExtractedImage],
        app: &'a tauri::AppHandle,
        request_id: &'a str,
        cancel_token: &'a CancellationToken,
    ) -> BoxFuture<'a, Result<String, String>> {
        Box::pin(async move {
            let chat_url = format!("{}/api/chat", self.base_url.trim_end_matches('/'));

            let mut ollama_messages = vec![serde_json::json!({
                "role": "system",
                "content": system_prompt
            })];

            for msg in messages {
                ollama_messages.push(serde_json::json!({
                    "role": msg.role,
                    "content": msg.content
                }));
            }

            let payload = serde_json::json!({
                "model": self.model,
                "messages": ollama_messages,
                "stream": true
            });

            let mut resp = client
                .post(&chat_url)
                .json(&payload)
                .send()
                .await
                .map_err(|e| {
                    let err = format!("Ollama request failed: {}", e);
                    let _ = app.emit_to("main", "velco://ai-chat-error", ChatChunkPayload {
                        request_id: request_id.to_string(),
                        delta: String::new(),
                        done: true,
                        error: Some(err.clone()),
                    });
                    err
                })?;

            if !resp.status().is_success() {
                let status = resp.status();
                let err_text = resp.text().await.unwrap_or_default();
                let err = format!("Ollama error (HTTP {}): {}", status, err_text);
                let _ = app.emit_to("main", "velco://ai-chat-error", ChatChunkPayload {
                    request_id: request_id.to_string(),
                    delta: String::new(),
                    done: true,
                    error: Some(err.clone()),
                });
                return Err(err);
            }

            let mut full_text = String::new();
            let mut chunk_buffer = String::new();
            let mut last_emit = std::time::Instant::now();
            loop {
                if cancel_token.is_cancelled() {
                    let _ = app.emit_to("main", "velco://ai-chat-done", ChatChunkPayload {
                        request_id: request_id.to_string(),
                        delta: full_text.clone(),
                        done: true,
                        error: None,
                    });
                    return Ok(full_text);
                }

                let chunk_opt = match resp.chunk().await {
                    Ok(c) => c,
                    Err(e) => {
                        let err = format!("Error reading Ollama stream: {}", e);
                        let _ = app.emit_to("main", "velco://ai-chat-error", ChatChunkPayload {
                            request_id: request_id.to_string(),
                            delta: String::new(),
                            done: true,
                            error: Some(err.clone()),
                        });
                        return Err(err);
                    }
                };

                let chunk = match chunk_opt {
                    Some(c) => c,
                    None => break,
                };

                let text = String::from_utf8_lossy(&chunk);
                for line in text.lines() {
                    let line = line.trim();
                    if line.is_empty() {
                        continue;
                    }
                    if let Ok(val) = serde_json::from_str::<Value>(line) {
                        if let Some(content) = val
                            .get("message")
                            .and_then(|m| m.get("content"))
                            .and_then(|c| c.as_str())
                        {
                            full_text.push_str(content);
                            chunk_buffer.push_str(content);
                        }
                    }
                }

                if !chunk_buffer.is_empty() && (last_emit.elapsed() >= std::time::Duration::from_millis(32) || chunk_buffer.len() >= 64) {
                    let _ = app.emit_to("main", "velco://ai-chat-token", ChatChunkPayload {
                        request_id: request_id.to_string(),
                        delta: chunk_buffer.clone(),
                        done: false,
                        error: None,
                    });
                    chunk_buffer.clear();
                    last_emit = std::time::Instant::now();
                }
            }

            if !chunk_buffer.is_empty() {
                let _ = app.emit_to("main", "velco://ai-chat-token", ChatChunkPayload {
                    request_id: request_id.to_string(),
                    delta: chunk_buffer,
                    done: false,
                    error: None,
                });
            }

            let _ = app.emit_to("main", "velco://ai-chat-done", ChatChunkPayload {
                request_id: request_id.to_string(),
                delta: full_text.clone(),
                done: true,
                error: None,
            });

            Ok(full_text)
        })
    }
}
