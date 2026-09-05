use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub message: String,
    pub models: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetailedModelInfo {
    pub id: String,
    pub name: String,
    pub is_free: bool,
    pub context_length: Option<u64>,
    pub description: Option<String>,
}

pub struct LocalAiClient {
    base_url: String,
    api_key: Option<String>,
    client: reqwest::Client,
}

impl LocalAiClient {
    pub fn new(base_url: Option<String>, api_key: Option<String>) -> Self {
        let raw_url = base_url
            .unwrap_or_else(|| "http://localhost:1234/v1".to_string())
            .trim()
            .trim_end_matches('/')
            .to_string();

        let base_url = if raw_url.is_empty() {
            "http://localhost:1234/v1".to_string()
        } else {
            raw_url
        };

        let key = api_key.and_then(|k| {
            let trimmed = k.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        });

        Self {
            base_url,
            api_key: key,
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
        }
    }

    pub async fn check_health(&self) -> bool {
        // For Anthropic Claude, presence of API key is the primary indicator
        if self.base_url.contains("anthropic.com") {
            return self.api_key.is_some();
        }

        let is_cloud = self.base_url.starts_with("https://");
        let timeout_duration = if is_cloud {
            std::time::Duration::from_millis(2000)
        } else {
            std::time::Duration::from_millis(600)
        };

        let health_client = reqwest::Client::builder()
            .timeout(timeout_duration)
            .build()
            .unwrap_or_else(|_| self.client.clone());

        // 1. Try OpenAI compatible /models or /v1/models
        let openai_urls = if self.base_url.ends_with("/v1") || self.base_url.ends_with("/openai") {
            vec![format!("{}/models", self.base_url)]
        } else {
            vec![
                format!("{}/v1/models", self.base_url),
                format!("{}/models", self.base_url),
            ]
        };

        for url in openai_urls {
            let mut req = health_client.get(&url);
            if let Some(ref key) = self.api_key {
                req = req.header("Authorization", format!("Bearer {}", key));
            }
            if self.base_url.contains("openrouter.ai") {
                req = req
                    .header("HTTP-Referer", "https://lifeinbox.app")
                    .header("X-Title", "Life Inbox");
            }

            if let Ok(resp) = req.send().await {
                if resp.status().is_success() {
                    return true;
                }
            }
        }

        // 2. Fallback to Ollama /api/tags (local only)
        if !is_cloud {
            let ollama_base = self.base_url.trim_end_matches("/v1");
            let ollama_url = format!("{}/api/tags", ollama_base);
            if let Ok(resp) = health_client.get(&ollama_url).send().await {
                if resp.status().is_success() {
                    return true;
                }
            }
        }

        false
    }

    pub async fn list_models(&self) -> Result<Vec<String>, String> {
        // Anthropic does not have an open models listing endpoint; return standard models
        if self.base_url.contains("anthropic.com") {
            return Ok(vec![
                "claude-3-5-haiku-20241022".to_string(),
                "claude-3-5-sonnet-20241022".to_string(),
                "claude-3-opus-20240229".to_string(),
            ]);
        }

        // 1. Try OpenAI format /models
        let openai_urls = if self.base_url.ends_with("/v1") || self.base_url.ends_with("/openai") {
            vec![format!("{}/models", self.base_url)]
        } else {
            vec![
                format!("{}/v1/models", self.base_url),
                format!("{}/models", self.base_url),
            ]
        };

        for url in openai_urls {
            let mut req = self.client.get(&url);
            if let Some(ref key) = self.api_key {
                req = req.header("Authorization", format!("Bearer {}", key));
            }
            if self.base_url.contains("openrouter.ai") {
                req = req
                    .header("HTTP-Referer", "https://lifeinbox.app")
                    .header("X-Title", "Life Inbox");
            }

            if let Ok(resp) = req.send().await {
                if resp.status().is_success() {
                    if let Ok(val) = resp.json::<Value>().await {
                        if let Some(arr) = val.get("data").and_then(|d| d.as_array()) {
                            let models: Vec<String> = arr
                                .iter()
                                .filter_map(|m| {
                                    m.get("id").and_then(|id| id.as_str()).map(|s| s.to_string())
                                })
                                .collect();
                            if !models.is_empty() {
                                return Ok(models);
                            }
                        }
                    }
                }
            }
        }

        // 2. Fallback to Ollama format
        let ollama_base = self.base_url.trim_end_matches("/v1");
        let ollama_url = format!("{}/api/tags", ollama_base);
        let resp = self
            .client
            .get(&ollama_url)
            .send()
            .await
            .map_err(|e| format!("Failed to reach AI endpoint at {}: {}", self.base_url, e))?;

        if !resp.status().is_success() {
            return Err(format!("AI server returned status {}", resp.status()));
        }

        let val: Value = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse models JSON: {}", e))?;

        if let Some(arr) = val.get("models").and_then(|m| m.as_array()) {
            let models: Vec<String> = arr
                .iter()
                .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                .collect();
            return Ok(models);
        }

        Ok(vec![])
    }

    pub async fn list_detailed_models(&self, provider: Option<&str>) -> Result<Vec<DetailedModelInfo>, String> {
        let provider_id = provider.unwrap_or("");

        // 1. OpenRouter (special rich metadata parsing)
        if provider_id == "openrouter" || self.base_url.contains("openrouter.ai") {
            let mut req = self.client.get("https://openrouter.ai/api/v1/models")
                .header("HTTP-Referer", "https://lifeinbox.app")
                .header("X-Title", "Life Inbox");

            if let Some(ref key) = self.api_key {
                if !key.is_empty() {
                    req = req.header("Authorization", format!("Bearer {}", key));
                }
            }

            if let Ok(resp) = req.send().await {
                if resp.status().is_success() {
                    if let Ok(val) = resp.json::<Value>().await {
                        if let Some(arr) = val.get("data").and_then(|d| d.as_array()) {
                            let mut models: Vec<DetailedModelInfo> = arr
                                .iter()
                                .filter_map(|m| {
                                    let id = m.get("id").and_then(|i| i.as_str())?.to_string();
                                    let name = m.get("name").and_then(|n| n.as_str()).unwrap_or(&id).to_string();
                                    let context_length = m.get("context_length").and_then(|c| c.as_u64());
                                    let description = m.get("description").and_then(|d| d.as_str()).map(|s| s.to_string());

                                    let is_free_by_id = id.ends_with(":free");
                                    let is_free_by_pricing = m.get("pricing").map(|p| {
                                        let prompt_free = p.get("prompt").and_then(|pr| pr.as_str()).map(|s| s == "0" || s == "0.0").unwrap_or(false)
                                            || p.get("prompt").and_then(|pr| pr.as_f64()).map(|f| f == 0.0).unwrap_or(false);
                                        let comp_free = p.get("completion").and_then(|cp| cp.as_str()).map(|s| s == "0" || s == "0.0").unwrap_or(false)
                                            || p.get("completion").and_then(|cp| cp.as_f64()).map(|f| f == 0.0).unwrap_or(false);
                                        prompt_free && comp_free
                                    }).unwrap_or(false);

                                    let is_free = is_free_by_id || is_free_by_pricing;

                                    Some(DetailedModelInfo {
                                        id,
                                        name,
                                        is_free,
                                        context_length,
                                        description,
                                    })
                                })
                                .collect();

                            // Sort: free models first, then alphabetical by name
                            models.sort_by(|a, b| {
                                match (a.is_free, b.is_free) {
                                    (true, false) => std::cmp::Ordering::Less,
                                    (false, true) => std::cmp::Ordering::Greater,
                                    _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
                                }
                            });

                            return Ok(models);
                        }
                    }
                }
            }
        }

        // 2. Google Gemini
        if provider_id == "gemini" || self.base_url.contains("generativelanguage.googleapis.com") {
            let mut req = self.client.get("https://generativelanguage.googleapis.com/v1beta/openai/models");
            if let Some(ref key) = self.api_key {
                if !key.is_empty() {
                    req = req.header("Authorization", format!("Bearer {}", key));
                }
            }
            if let Ok(resp) = req.send().await {
                if resp.status().is_success() {
                    if let Ok(val) = resp.json::<Value>().await {
                        if let Some(arr) = val.get("data").and_then(|d| d.as_array()) {
                            let models: Vec<DetailedModelInfo> = arr
                                .iter()
                                .filter_map(|m| {
                                    let id = m.get("id").and_then(|i| i.as_str())?.to_string();
                                    Some(DetailedModelInfo {
                                        id: id.clone(),
                                        name: format!("Google {}", id),
                                        is_free: true,
                                        context_length: Some(1048576),
                                        description: Some("Google Gemini with free tier in AI Studio".to_string()),
                                    })
                                })
                                .collect();
                            if !models.is_empty() {
                                return Ok(models);
                            }
                        }
                    }
                }
            }
            return Ok(vec![
                DetailedModelInfo {
                    id: "gemini-1.5-flash".to_string(),
                    name: "Gemini 1.5 Flash".to_string(),
                    is_free: true,
                    context_length: Some(1048576),
                    description: Some("Fast and versatile multimodal model (Free Tier available)".to_string()),
                },
                DetailedModelInfo {
                    id: "gemini-2.0-flash".to_string(),
                    name: "Gemini 2.0 Flash".to_string(),
                    is_free: true,
                    context_length: Some(1048576),
                    description: Some("Next-gen high speed multimodal model (Free Tier available)".to_string()),
                },
                DetailedModelInfo {
                    id: "gemini-1.5-pro".to_string(),
                    name: "Gemini 1.5 Pro".to_string(),
                    is_free: true,
                    context_length: Some(2097152),
                    description: Some("High-intelligence model with 2M token context window".to_string()),
                },
            ]);
        }

        // 3. Anthropic Claude
        if provider_id == "anthropic" || self.base_url.contains("anthropic.com") {
            return Ok(vec![
                DetailedModelInfo {
                    id: "claude-3-7-sonnet-20250219".to_string(),
                    name: "Claude 3.7 Sonnet".to_string(),
                    is_free: false,
                    context_length: Some(200000),
                    description: Some("Hybrid reasoning & coding state-of-the-art model".to_string()),
                },
                DetailedModelInfo {
                    id: "claude-3-5-sonnet-20241022".to_string(),
                    name: "Claude 3.5 Sonnet".to_string(),
                    is_free: false,
                    context_length: Some(200000),
                    description: Some("Industry-leading intelligence and coding performance".to_string()),
                },
                DetailedModelInfo {
                    id: "claude-3-5-haiku-20241022".to_string(),
                    name: "Claude 3.5 Haiku".to_string(),
                    is_free: false,
                    context_length: Some(200000),
                    description: Some("Fast, responsive, and highly cost-effective".to_string()),
                },
                DetailedModelInfo {
                    id: "claude-3-opus-20240229".to_string(),
                    name: "Claude 3 Opus".to_string(),
                    is_free: false,
                    context_length: Some(200000),
                    description: Some("Deep reasoning on complex analysis tasks".to_string()),
                },
            ]);
        }

        // 4. OpenAI
        if provider_id == "openai" || self.base_url.contains("api.openai.com") {
            let mut req = self.client.get("https://api.openai.com/v1/models");
            if let Some(ref key) = self.api_key {
                if !key.is_empty() {
                    req = req.header("Authorization", format!("Bearer {}", key));
                }
            }
            if let Ok(resp) = req.send().await {
                if resp.status().is_success() {
                    if let Ok(val) = resp.json::<Value>().await {
                        if let Some(arr) = val.get("data").and_then(|d| d.as_array()) {
                            let mut chat_models: Vec<DetailedModelInfo> = arr
                                .iter()
                                .filter_map(|m| {
                                    let id = m.get("id").and_then(|i| i.as_str())?.to_string();
                                    if id.starts_with("gpt-") || id.starts_with("o1-") || id.starts_with("o3-") || id.starts_with("chatgpt-") {
                                        Some(DetailedModelInfo {
                                            id: id.clone(),
                                            name: id.clone(),
                                            is_free: false,
                                            context_length: Some(128000),
                                            description: None,
                                        })
                                    } else {
                                        None
                                    }
                                })
                                .collect();

                            if !chat_models.is_empty() {
                                chat_models.sort_by(|a, b| {
                                    let prio = |id: &str| -> i32 {
                                        if id == "gpt-4o-mini" { 0 }
                                        else if id == "gpt-4o" { 1 }
                                        else if id == "o3-mini" { 2 }
                                        else if id == "o1-mini" { 3 }
                                        else if id.starts_with("gpt-4") { 4 }
                                        else { 10 }
                                    };
                                    prio(&a.id).cmp(&prio(&b.id))
                                });
                                return Ok(chat_models);
                            }
                        }
                    }
                }
            }
            return Ok(vec![
                DetailedModelInfo {
                    id: "gpt-4o-mini".to_string(),
                    name: "GPT-4o Mini".to_string(),
                    is_free: false,
                    context_length: Some(128000),
                    description: Some("Fast, lightweight, highly capable flagship mini model".to_string()),
                },
                DetailedModelInfo {
                    id: "gpt-4o".to_string(),
                    name: "GPT-4o".to_string(),
                    is_free: false,
                    context_length: Some(128000),
                    description: Some("High-intelligence multimodal flagship model".to_string()),
                },
                DetailedModelInfo {
                    id: "o3-mini".to_string(),
                    name: "o3-mini".to_string(),
                    is_free: false,
                    context_length: Some(128000),
                    description: Some("Latest high-speed reasoning model".to_string()),
                },
            ]);
        }

        // 5. Local LM Studio
        if provider_id == "lmstudio" {
            let url = format!("{}/models", self.base_url.trim_end_matches('/'));
            if let Ok(resp) = self.client.get(&url).send().await {
                if resp.status().is_success() {
                    if let Ok(val) = resp.json::<Value>().await {
                        if let Some(arr) = val.get("data").and_then(|d| d.as_array()) {
                            let models: Vec<DetailedModelInfo> = arr
                                .iter()
                                .filter_map(|m| {
                                    let id = m.get("id").and_then(|i| i.as_str())?.to_string();
                                    Some(DetailedModelInfo {
                                        id: id.clone(),
                                        name: id,
                                        is_free: true,
                                        context_length: None,
                                        description: Some("Local LM Studio model".to_string()),
                                    })
                                })
                                .collect();
                            return Ok(models);
                        }
                    }
                }
            }
        }

        // 6. Local Ollama
        if provider_id == "ollama" {
            let ollama_base = self.base_url.trim_end_matches("/v1");
            let url = format!("{}/api/tags", ollama_base);
            if let Ok(resp) = self.client.get(&url).send().await {
                if resp.status().is_success() {
                    if let Ok(val) = resp.json::<Value>().await {
                        if let Some(arr) = val.get("models").and_then(|m| m.as_array()) {
                            let models: Vec<DetailedModelInfo> = arr
                                .iter()
                                .filter_map(|m| {
                                    let id = m.get("name").and_then(|n| n.as_str())?.to_string();
                                    Some(DetailedModelInfo {
                                        id: id.clone(),
                                        name: id,
                                        is_free: true,
                                        context_length: None,
                                        description: Some("Local Ollama model".to_string()),
                                    })
                                })
                                .collect();
                            return Ok(models);
                        }
                    }
                }
            }
        }

        // Default: use list_models and wrap
        let basic = self.list_models().await?;
        Ok(basic.into_iter().map(|id| DetailedModelInfo {
            id: id.clone(),
            name: id,
            is_free: false,
            context_length: None,
            description: None,
        }).collect())
    }

    pub async fn generate(&self, model: &str, prompt: &str) -> Result<String, String> {
        // 1. Anthropic Claude
        if self.base_url.contains("anthropic.com") {
            let api_key = self
                .api_key
                .as_deref()
                .ok_or_else(|| "Anthropic Claude API key is required. Please set it in Settings.".to_string())?;

            let messages_url = "https://api.anthropic.com/v1/messages";
            let payload = serde_json::json!({
                "model": model,
                "max_tokens": 2048,
                "messages": [
                    { "role": "user", "content": prompt }
                ]
            });

            let resp = self
                .client
                .post(messages_url)
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Failed to connect to Anthropic: {}", e))?;

            let status = resp.status();
            if !status.is_success() {
                let err_text = resp.text().await.unwrap_or_default();
                let err_msg = serde_json::from_str::<Value>(&err_text)
                    .ok()
                    .and_then(|v| v.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()).map(|s| s.to_string()))
                    .unwrap_or(err_text);
                return Err(format!("Anthropic API error (HTTP {}): {}", status, err_msg));
            }

            let val: Value = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

            if let Some(content) = val
                .get("content")
                .and_then(|c| c.as_array())
                .and_then(|arr| arr.get(0))
                .and_then(|item| item.get("text"))
                .and_then(|t| t.as_str())
            {
                return Ok(content.to_string());
            }

            return Err("Empty response received from Anthropic Claude".to_string());
        }

        // 2. Try OpenAI chat completions
        let chat_urls = if self.base_url.ends_with("/chat/completions") {
            vec![self.base_url.clone()]
        } else if self.base_url.ends_with("/v1") || self.base_url.ends_with("/openai") {
            vec![format!("{}/chat/completions", self.base_url)]
        } else {
            vec![
                format!("{}/v1/chat/completions", self.base_url),
                format!("{}/chat/completions", self.base_url),
            ]
        };

        for url in chat_urls {
            let payload = serde_json::json!({
                "model": model,
                "messages": [
                    { "role": "user", "content": prompt }
                ],
                "temperature": 0.7,
                "stream": false
            });

            let mut req = self.client.post(&url).json(&payload);
            if let Some(ref key) = self.api_key {
                req = req.header("Authorization", format!("Bearer {}", key));
            }
            if self.base_url.contains("openrouter.ai") {
                req = req
                    .header("HTTP-Referer", "https://lifeinbox.app")
                    .header("X-Title", "Life Inbox");
            }

            if let Ok(resp) = req.send().await {
                let status = resp.status();
                if status.is_success() {
                    if let Ok(val) = resp.json::<Value>().await {
                        if let Some(content) = val
                            .get("choices")
                            .and_then(|c| c.get(0))
                            .and_then(|c0| c0.get("message"))
                            .and_then(|m| m.get("content"))
                            .and_then(|s| s.as_str())
                        {
                            return Ok(content.to_string());
                        }
                    }
                } else if self.base_url.starts_with("https://") || self.api_key.is_some() {
                    // For cloud / authenticated providers, surface exact API error immediately
                    let err_text = resp.text().await.unwrap_or_default();
                    let err_msg = serde_json::from_str::<Value>(&err_text)
                        .ok()
                        .and_then(|v| v.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()).map(|s| s.to_string()))
                        .unwrap_or(err_text);
                    return Err(format!("AI provider error (HTTP {}): {}", status, err_msg));
                }
            }
        }

        // 3. Fallback to Ollama native /api/generate (local only)
        if !self.base_url.starts_with("https://") {
            let ollama_base = self.base_url.trim_end_matches("/v1");
            let ollama_url = format!("{}/api/generate", ollama_base);
            let payload = serde_json::json!({
                "model": model,
                "prompt": prompt,
                "stream": false
            });

            let resp = self
                .client
                .post(&ollama_url)
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("AI request failed: {}", e))?;

            if !resp.status().is_success() {
                return Err(format!("AI server returned HTTP status {}", resp.status()));
            }

            let val: Value = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse AI output: {}", e))?;

            if let Some(content) = val.get("response").and_then(|r| r.as_str()) {
                return Ok(content.to_string());
            }
        }

        Err("No valid response received from AI server. Please verify your provider settings and model name.".to_string())
    }

    pub async fn test_connection(
        &self,
        provider: Option<&str>,
        model: Option<&str>,
    ) -> Result<ConnectionTestResult, String> {
        let test_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(8))
            .build()
            .unwrap_or_else(|_| self.client.clone());

        let provider_id = provider.unwrap_or("custom");

        // 1. Anthropic
        if provider_id == "anthropic" || self.base_url.contains("anthropic.com") {
            let api_key = match self.api_key.as_deref() {
                Some(k) if !k.is_empty() => k,
                _ => {
                    return Ok(ConnectionTestResult {
                        success: false,
                        message: "Please enter an Anthropic API key to test connection.".to_string(),
                        models: vec![],
                    });
                }
            };

            let test_model = model.unwrap_or("claude-3-5-haiku-20241022");
            let payload = serde_json::json!({
                "model": test_model,
                "max_tokens": 1,
                "messages": [{ "role": "user", "content": "ping" }]
            });

            let resp = test_client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Failed to reach Anthropic: {}", e))?;

            let status = resp.status();
            if status.is_success() {
                return Ok(ConnectionTestResult {
                    success: true,
                    message: "Connected successfully to Anthropic Claude!".to_string(),
                    models: vec![
                        "claude-3-5-haiku-20241022".to_string(),
                        "claude-3-5-sonnet-20241022".to_string(),
                        "claude-3-opus-20240229".to_string(),
                    ],
                });
            } else if status == reqwest::StatusCode::UNAUTHORIZED {
                return Ok(ConnectionTestResult {
                    success: false,
                    message: "Authentication failed: Invalid Anthropic API key (HTTP 401).".to_string(),
                    models: vec![],
                });
            } else {
                let err_text = resp.text().await.unwrap_or_default();
                let err_msg = serde_json::from_str::<Value>(&err_text)
                    .ok()
                    .and_then(|v| v.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()).map(|s| s.to_string()))
                    .unwrap_or(err_text);
                return Ok(ConnectionTestResult {
                    success: false,
                    message: format!("Anthropic error (HTTP {}): {}", status, err_msg),
                    models: vec![],
                });
            }
        }

        // 2. OpenAI / Gemini / OpenRouter / Custom
        if self.base_url.starts_with("https://") || self.api_key.is_some() {
            let api_key = match self.api_key.as_deref() {
                Some(k) if !k.is_empty() => k,
                _ if self.base_url.starts_with("https://") => {
                    return Ok(ConnectionTestResult {
                        success: false,
                        message: "Please enter an API key for this cloud provider.".to_string(),
                        models: vec![],
                    });
                }
                _ => "",
            };

            // Try listing models first
            let models_url = if self.base_url.ends_with("/v1") || self.base_url.ends_with("/openai") {
                format!("{}/models", self.base_url)
            } else {
                format!("{}/v1/models", self.base_url)
            };

            let mut req = test_client.get(&models_url);
            if !api_key.is_empty() {
                req = req.header("Authorization", format!("Bearer {}", api_key));
            }
            if self.base_url.contains("openrouter.ai") {
                req = req
                    .header("HTTP-Referer", "https://lifeinbox.app")
                    .header("X-Title", "Life Inbox");
            }

            if let Ok(resp) = req.send().await {
                let status = resp.status();
                if status.is_success() {
                    if let Ok(val) = resp.json::<Value>().await {
                        let models: Vec<String> = val
                            .get("data")
                            .and_then(|d| d.as_array())
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|m| m.get("id").and_then(|id| id.as_str()).map(|s| s.to_string()))
                                    .collect()
                            })
                            .unwrap_or_default();

                        let count = models.len();
                        return Ok(ConnectionTestResult {
                            success: true,
                            message: format!("Connected successfully! {} models detected.", count),
                            models,
                        });
                    }
                } else if status == reqwest::StatusCode::UNAUTHORIZED {
                    return Ok(ConnectionTestResult {
                        success: false,
                        message: "Authentication failed: Invalid API key (HTTP 401 Unauthorized).".to_string(),
                        models: vec![],
                    });
                }
            }

            // Fallback: minimal chat completion ping
            let chat_url = if self.base_url.ends_with("/v1") || self.base_url.ends_with("/openai") {
                format!("{}/chat/completions", self.base_url)
            } else {
                format!("{}/v1/chat/completions", self.base_url)
            };

            let test_model = model.unwrap_or(if provider_id == "gemini" {
                "gemini-1.5-flash"
            } else if provider_id == "openai" {
                "gpt-4o-mini"
            } else {
                "default"
            });

            let payload = serde_json::json!({
                "model": test_model,
                "messages": [{ "role": "user", "content": "ping" }],
                "max_tokens": 1
            });

            let mut ping_req = test_client.post(&chat_url).json(&payload);
            if !api_key.is_empty() {
                ping_req = ping_req.header("Authorization", format!("Bearer {}", api_key));
            }
            if self.base_url.contains("openrouter.ai") {
                ping_req = ping_req
                    .header("HTTP-Referer", "https://lifeinbox.app")
                    .header("X-Title", "Life Inbox");
            }

            let ping_resp = ping_req
                .send()
                .await
                .map_err(|e| format!("Connection failed: {}", e))?;

            let p_status = ping_resp.status();
            if p_status.is_success() {
                return Ok(ConnectionTestResult {
                    success: true,
                    message: "Connected successfully! Provider responded.".to_string(),
                    models: vec![test_model.to_string()],
                });
            } else {
                let err_text = ping_resp.text().await.unwrap_or_default();
                let err_msg = serde_json::from_str::<Value>(&err_text)
                    .ok()
                    .and_then(|v| v.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()).map(|s| s.to_string()))
                    .unwrap_or(err_text);
                return Ok(ConnectionTestResult {
                    success: false,
                    message: format!("Connection error (HTTP {}): {}", p_status, err_msg),
                    models: vec![],
                });
            }
        }

        // 3. Local engine (LM Studio / Ollama)
        if provider_id == "lmstudio" {
            let url = format!("{}/models", self.base_url.trim_end_matches('/'));
            if let Ok(resp) = test_client.get(&url).send().await {
                if resp.status().is_success() {
                    let val = resp.json::<Value>().await.ok();
                    let models: Vec<String> = val
                        .and_then(|v| v.get("data").and_then(|d| d.as_array()).cloned())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m.get("id").and_then(|id| id.as_str()).map(|s| s.to_string()))
                                .collect()
                        })
                        .unwrap_or_default();
                    return Ok(ConnectionTestResult {
                        success: true,
                        message: format!("LM Studio is running! {} models detected.", models.len()),
                        models,
                    });
                }
            }
            return Ok(ConnectionTestResult {
                success: false,
                message: format!("Cannot reach LM Studio at {}. Make sure local server is running.", self.base_url),
                models: vec![],
            });
        }

        // Ollama
        let ollama_base = self.base_url.trim_end_matches("/v1");
        let ollama_url = format!("{}/api/tags", ollama_base);
        if let Ok(resp) = test_client.get(&ollama_url).send().await {
            if resp.status().is_success() {
                let val = resp.json::<Value>().await.ok();
                let models: Vec<String> = val
                    .and_then(|v| v.get("models").and_then(|m| m.as_array()).cloned())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();
                return Ok(ConnectionTestResult {
                    success: true,
                    message: format!("Ollama is running! {} models installed.", models.len()),
                    models,
                });
            }
        }

        Ok(ConnectionTestResult {
            success: false,
            message: format!("Cannot reach Ollama at {}. Ensure Ollama service is active.", self.base_url),
            models: vec![],
        })
    }
}

// Keep OllamaClient alias for backward compatibility
pub type OllamaClient = LocalAiClient;
