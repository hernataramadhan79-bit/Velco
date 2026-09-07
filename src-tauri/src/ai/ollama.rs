use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub message: String,
    pub models: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DetailedModelInfo {
    pub id: String,
    pub name: String,
    pub is_free: bool,
    pub context_length: Option<u64>,
    pub description: Option<String>,
}

pub fn strip_think_tags(text: &str) -> String {
    let mut result = text.to_string();
    loop {
        let lower = result.to_lowercase();
        if let Some(start) = lower.find("<think>") {
            if let Some(end) = lower[start..].find("</think>") {
                let full_end = start + end + 8;
                result.replace_range(start..full_end, "");
            } else {
                result.truncate(start);
                break;
            }
        } else {
            break;
        }
    }
    result.trim().to_string()
}

pub struct LocalAiClient {
    base_url: String,
    api_key: Option<String>,
    client: reqwest::Client,
}

impl LocalAiClient {
    pub fn new(base_url: Option<String>, api_key: Option<String>) -> Self {
        let raw_url = base_url
            .unwrap_or_else(|| "http://localhost:11434".to_string())
            .trim()
            .trim_end_matches('/')
            .to_string();

        let base_url = if raw_url.is_empty() {
            "http://localhost:11434".to_string()
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
            std::time::Duration::from_millis(3000)
        } else {
            // Local timeout: 2500ms allows Windows dual-stack IPv6/IPv4 fallback without false negatives
            std::time::Duration::from_millis(2500)
        };

        let health_client = reqwest::Client::builder()
            .timeout(timeout_duration)
            .build()
            .unwrap_or_else(|_| self.client.clone());

        let is_ollama_port = self.base_url.contains("11434") || (!is_cloud && !self.base_url.ends_with("/v1"));

        let mut candidate_urls = Vec::new();

        // 1. If Ollama or default local port, probe native Ollama tags/version endpoints first
        if is_ollama_port {
            let ollama_base = self.base_url.trim_end_matches("/v1");
            candidate_urls.push(format!("{}/api/tags", ollama_base));
            candidate_urls.push(format!("{}/api/version", ollama_base));
            if ollama_base.contains("localhost") {
                let alt = ollama_base.replace("localhost", "127.0.0.1");
                candidate_urls.push(format!("{}/api/tags", alt));
                candidate_urls.push(format!("{}/api/version", alt));
            }
        }

        // 2. Probe OpenAI compatible /models or /v1/models (LM Studio, OpenRouter, etc.)
        if self.base_url.ends_with("/v1") || self.base_url.ends_with("/openai") {
            candidate_urls.push(format!("{}/models", self.base_url));
            if self.base_url.contains("localhost") {
                candidate_urls.push(format!("{}/models", self.base_url.replace("localhost", "127.0.0.1")));
            }
        } else {
            candidate_urls.push(format!("{}/v1/models", self.base_url));
            candidate_urls.push(format!("{}/models", self.base_url));
            if self.base_url.contains("localhost") {
                candidate_urls.push(format!("{}/v1/models", self.base_url.replace("localhost", "127.0.0.1")));
            }
        }

        // 3. Ollama fallback if not already checked
        if !is_cloud && !is_ollama_port {
            let ollama_base = self.base_url.trim_end_matches("/v1");
            candidate_urls.push(format!("{}/api/tags", ollama_base));
            if ollama_base.contains("localhost") {
                candidate_urls.push(format!("{}/api/tags", ollama_base.replace("localhost", "127.0.0.1")));
            }
        }

        for url in candidate_urls {
            let mut req = health_client.get(&url);
            if let Some(ref key) = self.api_key {
                req = req.header("Authorization", format!("Bearer {}", key));
            }
            if self.base_url.contains("openrouter.ai") {
                req = req
                    .header("HTTP-Referer", "https://velco.app")
                    .header("X-Title", "Velco");
            }

            if let Ok(resp) = req.send().await {
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

        let is_cloud = self.base_url.starts_with("https://");
        let is_ollama_port = self.base_url.contains("11434") || (!is_cloud && !self.base_url.ends_with("/v1"));

        // 1. For Ollama endpoints, try native /api/tags first
        if is_ollama_port {
            let ollama_base = self.base_url.trim_end_matches("/v1");
            let mut tags_urls = vec![format!("{}/api/tags", ollama_base)];
            if ollama_base.contains("localhost") {
                tags_urls.push(format!("{}/api/tags", ollama_base.replace("localhost", "127.0.0.1")));
            }

            for url in tags_urls {
                if let Ok(resp) = self.client.get(&url).send().await {
                    if resp.status().is_success() {
                        if let Ok(val) = resp.json::<Value>().await {
                            if let Some(arr) = val.get("models").and_then(|m| m.as_array()) {
                                let models: Vec<String> = arr
                                    .iter()
                                    .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
                                    .collect();
                                if !models.is_empty() {
                                    return Ok(models);
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. Try OpenAI format /models
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
                    .header("HTTP-Referer", "https://velco.app")
                    .header("X-Title", "Velco");
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

        // 3. Fallback to Ollama format
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

    /// Intelligently resolves local model names against installed models.
    /// Handles tag differences (e.g. "llama3" -> "llama3:latest" or "llama3.2:latest"),
    /// family prefix matches, or seamlessly adopts the single installed model.
    pub async fn resolve_local_model(&self, requested_model: &str) -> String {
        let is_cloud = self.base_url.starts_with("https://");
        if is_cloud || requested_model.trim().is_empty() {
            return requested_model.to_string();
        }

        let installed = match self.list_models().await {
            Ok(models) if !models.is_empty() => models,
            _ => return requested_model.to_string(),
        };

        // 1. Exact match
        if installed.iter().any(|m| m == requested_model) {
            return requested_model.to_string();
        }

        // 2. Base name match without tag (e.g. "llama3" matches "llama3:latest" or "llama3:8b")
        let req_base = requested_model.split(':').next().unwrap_or(requested_model);
        for inst in &installed {
            let inst_base = inst.split(':').next().unwrap_or(inst);
            if req_base.eq_ignore_ascii_case(inst_base) {
                return inst.clone();
            }
        }

        // 3. Substring / family match (e.g. "qwen2.5" matches "qwen2.5-coder:7b" or "qwen2.5:7b")
        for inst in &installed {
            if inst.to_lowercase().contains(&req_base.to_lowercase()) {
                return inst.clone();
            }
        }

        // 4. If only 1 model is installed locally, seamlessly adopt it
        if installed.len() == 1 {
            return installed[0].clone();
        }

        requested_model.to_string()
    }

    pub async fn list_detailed_models(&self, provider: Option<&str>) -> Result<Vec<DetailedModelInfo>, String> {
        let provider_id = provider.unwrap_or("");

        // 1. OpenRouter (special rich metadata parsing)
        if provider_id == "openrouter" || self.base_url.contains("openrouter.ai") {
            let mut req = self.client.get("https://openrouter.ai/api/v1/models")
                .header("HTTP-Referer", "https://velco.app")
                .header("X-Title", "Velco");

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

                                    let is_free_by_id = id.ends_with(":free") || id.contains(":free");
                                    let is_free_by_pricing = m.get("pricing").map(|p| {
                                        let prompt_free = p.get("prompt")
                                            .and_then(|pr| pr.as_str().and_then(|s| s.parse::<f64>().ok()).or_else(|| pr.as_f64()))
                                            .map(|val| val == 0.0)
                                            .unwrap_or(false);
                                        let comp_free = p.get("completion")
                                            .and_then(|cp| cp.as_str().and_then(|s| s.parse::<f64>().ok()).or_else(|| cp.as_f64()))
                                            .map(|val| val == 0.0)
                                            .unwrap_or(false);
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

                            if !models.is_empty() {
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

            // Fallback: curated list of top free OpenRouter models
            return Ok(vec![
                DetailedModelInfo {
                    id: "google/gemini-2.0-flash-exp:free".to_string(),
                    name: "Google: Gemini 2.0 Flash Exp (free)".to_string(),
                    is_free: true,
                    context_length: Some(1048576),
                    description: Some("Multimodal, high speed, 1M token context window".to_string()),
                },
                DetailedModelInfo {
                    id: "meta-llama/llama-3.3-70b-instruct:free".to_string(),
                    name: "Meta: Llama 3.3 70B Instruct (free)".to_string(),
                    is_free: true,
                    context_length: Some(131072),
                    description: Some("Flagship 70B open weights model with 128k context".to_string()),
                },
                DetailedModelInfo {
                    id: "deepseek/deepseek-r1:free".to_string(),
                    name: "DeepSeek: DeepSeek R1 (free)".to_string(),
                    is_free: true,
                    context_length: Some(64000),
                    description: Some("State-of-the-art open reasoning model".to_string()),
                },
                DetailedModelInfo {
                    id: "deepseek/deepseek-chat:free".to_string(),
                    name: "DeepSeek: DeepSeek V3 (free)".to_string(),
                    is_free: true,
                    context_length: Some(64000),
                    description: Some("Flagship general purpose chat model".to_string()),
                },
                DetailedModelInfo {
                    id: "qwen/qwen-2.5-coder-32b-instruct:free".to_string(),
                    name: "Qwen: Qwen 2.5 Coder 32B (free)".to_string(),
                    is_free: true,
                    context_length: Some(32768),
                    description: Some("Top open-source code reasoning model".to_string()),
                },
                DetailedModelInfo {
                    id: "mistralai/mistral-7b-instruct:free".to_string(),
                    name: "Mistral: Mistral 7B Instruct (free)".to_string(),
                    is_free: true,
                    context_length: Some(32768),
                    description: Some("Fast, efficient general instruction model".to_string()),
                },
            ]);
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
        let is_json_request = prompt.contains("JSON") || prompt.contains("json");
        let is_cloud = self.base_url.starts_with("https://");

        // Resolve model for local providers (handling tag mismatches or installed alternatives)
        let target_model = if !is_cloud {
            self.resolve_local_model(model).await
        } else {
            model.to_string()
        };

        // 1. Anthropic Claude
        if self.base_url.contains("anthropic.com") {
            let api_key = self
                .api_key
                .as_deref()
                .ok_or_else(|| "Anthropic Claude API key is required. Please set it in Settings.".to_string())?;

            let messages_url = "https://api.anthropic.com/v1/messages";
            let payload = serde_json::json!({
                "model": target_model,
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
                .and_then(|arr| arr.first())
                .and_then(|item| item.get("text"))
                .and_then(|t| t.as_str())
            {
                return Ok(strip_think_tags(content));
            }

            return Err("Empty response received from Anthropic Claude".to_string());
        }

        // 2. Try OpenAI chat completions (OpenAI, Gemini, OpenRouter, LM Studio, etc.)
        let mut chat_urls = if self.base_url.ends_with("/chat/completions") {
            vec![self.base_url.clone()]
        } else if self.base_url.ends_with("/v1") || self.base_url.ends_with("/openai") {
            vec![format!("{}/chat/completions", self.base_url)]
        } else {
            vec![
                format!("{}/v1/chat/completions", self.base_url),
                format!("{}/chat/completions", self.base_url),
            ]
        };

        if !is_cloud && self.base_url.contains("localhost") {
            chat_urls.push(format!("{}/v1/chat/completions", self.base_url.replace("localhost", "127.0.0.1")));
        }

        for url in chat_urls {
            let mut payload = serde_json::json!({
                "model": target_model,
                "messages": [
                    { "role": "user", "content": prompt }
                ],
                "temperature": 0.2,
                "stream": false
            });

            if is_json_request && !self.base_url.contains("anthropic.com") {
                payload["response_format"] = serde_json::json!({ "type": "json_object" });
            }

            let mut req = self.client.post(&url).json(&payload);
            if let Some(ref key) = self.api_key {
                req = req.header("Authorization", format!("Bearer {}", key));
            }
            if self.base_url.contains("openrouter.ai") {
                req = req
                    .header("HTTP-Referer", "https://velco.app")
                    .header("X-Title", "Velco");
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
                            return Ok(strip_think_tags(content));
                        }
                    }
                } else if is_cloud || self.api_key.is_some() {
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
        if !is_cloud {
            let ollama_base = self.base_url.trim_end_matches("/v1");
            let mut ollama_urls = vec![format!("{}/api/generate", ollama_base)];
            if ollama_base.contains("localhost") {
                ollama_urls.push(format!("{}/api/generate", ollama_base.replace("localhost", "127.0.0.1")));
            }

            for ollama_url in ollama_urls {
                let mut payload = serde_json::json!({
                    "model": target_model,
                    "prompt": prompt,
                    "stream": false
                });

                if is_json_request {
                    payload["format"] = serde_json::json!("json");
                }

                if let Ok(resp) = self.client.post(&ollama_url).json(&payload).send().await {
                    let status = resp.status();
                    if status.is_success() {
                        let val: Value = resp
                            .json()
                            .await
                            .map_err(|e| format!("Failed to parse AI output: {}", e))?;

                        if let Some(content) = val.get("response").and_then(|r| r.as_str()) {
                            return Ok(strip_think_tags(content));
                        }
                    } else if status == reqwest::StatusCode::NOT_FOUND {
                        let err_text = resp.text().await.unwrap_or_default();
                        let installed = self.list_models().await.unwrap_or_default();
                        if !installed.is_empty() {
                            return Err(format!(
                                "Model '{}' not found in local Ollama. Installed models: [{}]. Please select one in Settings or run 'ollama pull {}'.",
                                target_model,
                                installed.join(", "),
                                target_model
                            ));
                        }
                        return Err(format!("Ollama error (HTTP 404): {}. Please ensure the model is pulled.", err_text));
                    } else {
                        let err_text = resp.text().await.unwrap_or_default();
                        return Err(format!("Ollama server returned HTTP status {}: {}", status, err_text));
                    }
                }
            }
        }

        Err("No valid response received from AI server. Please verify your provider settings, ensure local server is running, and verify model name.".to_string())
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
                _ if provider_id == "openrouter" => {
                    // OpenRouter model catalog is public and works without an API key
                    ""
                }
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
                    .header("HTTP-Referer", "https://velco.app")
                    .header("X-Title", "Velco");
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
                    .header("HTTP-Referer", "https://velco.app")
                    .header("X-Title", "Velco");
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
            let mut urls = vec![format!("{}/models", self.base_url.trim_end_matches('/'))];
            if self.base_url.contains("localhost") {
                urls.push(format!("{}/models", self.base_url.trim_end_matches('/').replace("localhost", "127.0.0.1")));
            }

            for url in urls {
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
            }

            return Ok(ConnectionTestResult {
                success: false,
                message: format!("Cannot reach LM Studio at {}. Make sure local server is running.", self.base_url),
                models: vec![],
            });
        }

        // Ollama
        let ollama_base = self.base_url.trim_end_matches("/v1");
        let mut ollama_urls = vec![format!("{}/api/tags", ollama_base)];
        if ollama_base.contains("localhost") {
            ollama_urls.push(format!("{}/api/tags", ollama_base.replace("localhost", "127.0.0.1")));
        }

        for ollama_url in ollama_urls {
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
