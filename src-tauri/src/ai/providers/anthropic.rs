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

pub struct AnthropicProvider {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

impl AnthropicProvider {
    pub fn new(base_url: String, api_key: String, model: String) -> Self {
        Self { base_url, api_key, model }
    }
}

impl AiProvider for AnthropicProvider {
    fn id(&self) -> &str {
        "anthropic"
    }

    fn is_cloud(&self) -> bool {
        true
    }

    fn model(&self) -> &str {
        &self.model
    }

    fn completion<'a>(
        &'a self,
        client: &'a reqwest::Client,
        system_prompt: &'a str,
        user_prompt: &'a str,
        images: &'a [ExtractedImage],
    ) -> BoxFuture<'a, Result<String, String>> {
        Box::pin(async move {
            let chat_url = "https://api.anthropic.com/v1/messages";

            let user_content = if images.is_empty() {
                serde_json::json!(user_prompt)
            } else {
                let mut parts = Vec::new();
                for img in images {
                    parts.push(serde_json::json!({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": img.mime_type,
                            "data": img.base64
                        }
                    }));
                }
                parts.push(serde_json::json!({
                    "type": "text",
                    "text": user_prompt
                }));
                serde_json::json!(parts)
            };

            let payload = serde_json::json!({
                "model": self.model,
                "system": system_prompt,
                "messages": [
                    { "role": "user", "content": user_content }
                ],
                "max_tokens": 4096,
                "temperature": 0.3
            });

            let mut req = client.post(chat_url).json(&payload);

            if !self.api_key.is_empty() {
                req = req
                    .header("x-api-key", &self.api_key)
                    .header("anthropic-version", "2023-06-01")
                    .header("content-type", "application/json");
            }

            let resp = req.send().await.map_err(|e| format!("Anthropic request failed: {}", e))?;

            if !resp.status().is_success() {
                let status = resp.status();
                if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                    crate::ai::usage::record_429(self.id());
                }
                let err_text = resp.text().await.unwrap_or_default();
                let err_msg = serde_json::from_str::<Value>(&err_text)
                    .ok()
                    .and_then(|v| {
                        v.get("error")
                            .and_then(|e| e.get("message"))
                            .and_then(|m| m.as_str())
                            .map(|s| s.to_string())
                    })
                    .unwrap_or(err_text);
                return Err(format!("Anthropic API error (HTTP {}): {}", status, err_msg));
            }

            let val: Value = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

            val.get("content")
                .and_then(|c| c.as_array())
                .and_then(|arr| arr.first())
                .and_then(|item| item.get("text"))
                .and_then(|t| t.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "Empty response from Anthropic".to_string())
        })
    }

    fn stream_chat<'a>(
        &'a self,
        client: &'a reqwest::Client,
        system_prompt: &'a str,
        messages: &'a [ChatMessagePayload],
        images: &'a [ExtractedImage],
        app: &'a tauri::AppHandle,
        request_id: &'a str,
        cancel_token: &'a CancellationToken,
    ) -> BoxFuture<'a, Result<String, String>> {
        Box::pin(async move {
            let chat_url = "https://api.anthropic.com/v1/messages";

            let last_user_idx = messages.iter().rposition(|m| m.role == "user" || (m.role != "assistant" && m.role != "system"));

            let anthropic_messages: Vec<serde_json::Value> = messages
                .iter()
                .enumerate()
                .filter(|(_, m)| m.role != "system")
                .map(|(idx, m)| {
                    let role = if m.role == "assistant" { "assistant" } else { "user" };
                    if Some(idx) == last_user_idx && !images.is_empty() {
                        let mut parts = Vec::new();
                        for img in images {
                            parts.push(serde_json::json!({
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": img.mime_type,
                                    "data": img.base64
                                }
                            }));
                        }
                        parts.push(serde_json::json!({
                            "type": "text",
                            "text": m.content
                        }));
                        serde_json::json!({
                            "role": role,
                            "content": parts
                        })
                    } else {
                        serde_json::json!({
                            "role": role,
                            "content": m.content
                        })
                    }
                })
                .collect();

            let payload = serde_json::json!({
                "model": self.model,
                "system": system_prompt,
                "messages": anthropic_messages,
                "max_tokens": 4096,
                "stream": true
            });

            let mut req = client.post(chat_url).json(&payload);

            if !self.api_key.is_empty() {
                req = req
                    .header("x-api-key", &self.api_key)
                    .header("anthropic-version", "2023-06-01")
                    .header("content-type", "application/json");
            }

            let mut resp = req.send().await.map_err(|e| {
                let err = format!("Anthropic request failed: {}", e);
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
                if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                    crate::ai::usage::record_429(self.id());
                }
                let err_text = resp.text().await.unwrap_or_default();
                let err_msg = serde_json::from_str::<Value>(&err_text)
                    .ok()
                    .and_then(|v| {
                        v.get("error")
                            .and_then(|e| e.get("message"))
                            .and_then(|m| m.as_str())
                            .map(|s| s.to_string())
                    })
                    .unwrap_or(err_text);
                let err = format!("Anthropic API error (HTTP {}): {}", status, err_msg);
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
                        let err = format!("Error reading Anthropic stream: {}", e);
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
                    if let Some(data_str) = line.strip_prefix("data:") {
                        let data_str = data_str.trim();
                        if let Ok(val) = serde_json::from_str::<Value>(data_str) {
                            if let Some(event_type) = val.get("type").and_then(|t| t.as_str()) {
                                if event_type == "content_block_delta" {
                                    if let Some(token) = val
                                        .get("delta")
                                        .and_then(|d| d.get("text"))
                                        .and_then(|t| t.as_str())
                                    {
                                        full_text.push_str(token);
                                        chunk_buffer.push_str(token);
                                    }
                                }
                            }
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
