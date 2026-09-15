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

pub struct OpenAiCompatibleProvider {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

impl OpenAiCompatibleProvider {
    pub fn new(base_url: String, api_key: String, model: String) -> Self {
        Self { base_url, api_key, model }
    }

    fn chat_url(&self) -> String {
        let b = self.base_url.trim_end_matches('/');
        if b.ends_with("/v1") || b.ends_with("/openai") {
            format!("{}/chat/completions", b)
        } else if b.ends_with("/chat/completions") {
            b.to_string()
        } else {
            format!("{}/v1/chat/completions", b)
        }
    }

    fn provider_name(&self) -> &str {
        let b = self.base_url.to_lowercase();
        if b.contains("openrouter.ai") {
            "openrouter"
        } else if b.contains("groq.com") {
            "groq"
        } else if b.contains("deepseek.com") {
            "deepseek"
        } else if b.contains("openai.com") {
            "openai"
        } else {
            "openai-compatible"
        }
    }
}

impl AiProvider for OpenAiCompatibleProvider {
    fn id(&self) -> &str {
        self.provider_name()
    }

    fn is_cloud(&self) -> bool {
        self.base_url.starts_with("https://")
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
            let chat_url = self.chat_url();

            let user_content = if images.is_empty() {
                serde_json::json!(user_prompt)
            } else {
                let mut parts = vec![serde_json::json!({
                    "type": "text",
                    "text": user_prompt
                })];
                for img in images {
                    parts.push(serde_json::json!({
                        "type": "image_url",
                        "image_url": {
                            "url": format!("data:{};base64,{}", img.mime_type, img.base64)
                        }
                    }));
                }
                serde_json::json!(parts)
            };

            let payload = serde_json::json!({
                "model": self.model,
                "messages": [
                    { "role": "system", "content": system_prompt },
                    { "role": "user", "content": user_content }
                ],
                "temperature": 0.3,
                "stream": false
            });

            let mut req = client.post(&chat_url).json(&payload);

            if !self.api_key.is_empty() {
                req = req.header("Authorization", format!("Bearer {}", self.api_key));
            }
            if self.base_url.contains("openrouter.ai") {
                req = req
                    .header("HTTP-Referer", "https://velco.app")
                    .header("X-Title", "Velco");
            }

            let resp = req.send().await.map_err(|e| format!("AI request failed: {}", e))?;

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
                return Err(format!("AI provider error (HTTP {}): {}", status, err_msg));
            }

            let val: Value = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse AI response: {}", e))?;

            val.get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c0| c0.get("message"))
                .and_then(|m| m.get("content"))
                .and_then(|s| s.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "Empty response from AI provider".to_string())
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
            let chat_url = self.chat_url();

            let mut openai_messages = vec![serde_json::json!({
                "role": "system",
                "content": system_prompt
            })];

            let last_user_idx = messages.iter().rposition(|m| m.role == "user");

            for (idx, msg) in messages.iter().enumerate() {
                if Some(idx) == last_user_idx && !images.is_empty() {
                    let mut parts = vec![serde_json::json!({
                        "type": "text",
                        "text": msg.content
                    })];
                    for img in images {
                        parts.push(serde_json::json!({
                            "type": "image_url",
                            "image_url": {
                                "url": format!("data:{};base64,{}", img.mime_type, img.base64)
                            }
                        }));
                    }
                    openai_messages.push(serde_json::json!({
                        "role": msg.role,
                        "content": parts
                    }));
                } else {
                    openai_messages.push(serde_json::json!({
                        "role": msg.role,
                        "content": msg.content
                    }));
                }
            }

            let payload = serde_json::json!({
                "model": self.model,
                "messages": openai_messages,
                "temperature": 0.7,
                "stream": true
            });

            let mut req = client.post(&chat_url).json(&payload);

            if !self.api_key.is_empty() {
                req = req.header("Authorization", format!("Bearer {}", self.api_key));
            }
            if self.base_url.contains("openrouter.ai") {
                req = req
                    .header("HTTP-Referer", "https://velco.app")
                    .header("X-Title", "Velco");
            }

            let mut resp = req.send().await.map_err(|e| {
                let err = format!("AI request failed: {}", e);
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
                let err = format!("AI provider error (HTTP {}): {}", status, err_msg);
                let _ = app.emit_to("main", "velco://ai-chat-error", ChatChunkPayload {
                    request_id: request_id.to_string(),
                    delta: String::new(),
                    done: true,
                    error: Some(err.clone()),
                });
                return Err(err);
            }

            let mut full_text = String::new();
            let mut raw_buffer: Vec<u8> = Vec::new();
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
                        let err = format!("Error reading AI stream: {}", e);
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

                raw_buffer.extend_from_slice(&chunk);

                while let Some(pos) = raw_buffer.iter().position(|&b| b == b'\n') {
                    let line_bytes: Vec<u8> = raw_buffer.drain(..=pos).collect();
                    if let Ok(line_str) = std::str::from_utf8(&line_bytes) {
                        let line = line_str.trim();
                        if line.is_empty() || line.starts_with(':') {
                            continue;
                        }
                        if let Some(data_str) = line.strip_prefix("data:") {
                            let data_str = data_str.trim();
                            if data_str == "[DONE]" {
                                continue;
                            }
                            if let Ok(val) = serde_json::from_str::<Value>(data_str) {
                                if let Some(token) = val
                                    .get("choices")
                                    .and_then(|c| c.get(0))
                                    .and_then(|c0| c0.get("delta"))
                                    .and_then(|d| d.get("content"))
                                    .and_then(|c| c.as_str())
                                {
                                    full_text.push_str(token);
                                    chunk_buffer.push_str(token);
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

            if !raw_buffer.is_empty() {
                if let Ok(line_str) = std::str::from_utf8(&raw_buffer) {
                    let line = line_str.trim();
                    if let Some(data_str) = line.strip_prefix("data:") {
                        let data_str = data_str.trim();
                        if data_str != "[DONE]" {
                            if let Ok(val) = serde_json::from_str::<Value>(data_str) {
                                if let Some(token) = val
                                    .get("choices")
                                    .and_then(|c| c.get(0))
                                    .and_then(|c0| c0.get("delta"))
                                    .and_then(|d| d.get("content"))
                                    .and_then(|c| c.as_str())
                                {
                                    full_text.push_str(token);
                                    chunk_buffer.push_str(token);
                                }
                            }
                        }
                    }
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
