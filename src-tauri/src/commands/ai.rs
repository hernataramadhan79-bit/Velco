use tauri::{Emitter, Manager};
use crate::ai::ollama::{ConnectionTestResult, DetailedModelInfo, OllamaClient};
use crate::ai::{LlmProviderConfig, RecipeOutput};
use crate::database::Database;
use crate::filesystem::StorageManager;
use serde_json::Value;
use base64::Engine;

// ============================================================================
// Existing AI commands (backward-compatible for Settings UI)
// ============================================================================

#[tauri::command]
pub async fn check_ollama_status(
    base_url: Option<String>,
    api_key: Option<String>,
) -> Result<bool, String> {
    let client = OllamaClient::new(base_url, api_key);
    Ok(client.check_health().await)
}

#[tauri::command]
pub async fn list_ollama_models(
    base_url: Option<String>,
    api_key: Option<String>,
) -> Result<Vec<String>, String> {
    let client = OllamaClient::new(base_url, api_key);
    client.list_models().await
}

#[tauri::command]
pub async fn list_ai_models_detailed(
    base_url: Option<String>,
    api_key: Option<String>,
    provider: Option<String>,
) -> Result<Vec<DetailedModelInfo>, String> {
    let client = OllamaClient::new(base_url, api_key);
    client.list_detailed_models(provider.as_deref()).await
}

#[tauri::command]
pub async fn generate_ai_completion(
    base_url: Option<String>,
    model: String,
    prompt: String,
    api_key: Option<String>,
) -> Result<String, String> {
    let client = OllamaClient::new(base_url, api_key);
    client.generate(&model, &prompt).await
}

#[tauri::command]
pub async fn test_ai_connection(
    base_url: Option<String>,
    api_key: Option<String>,
    provider: Option<String>,
    model: Option<String>,
) -> Result<ConnectionTestResult, String> {
    let client = OllamaClient::new(base_url, api_key);
    client
        .test_connection(provider.as_deref(), model.as_deref())
        .await
}

// ============================================================================
// New Context Recipe Commands
// ============================================================================

/// Builds the system prompt that instructs the LLM to output structured JSON.
fn build_recipe_system_prompt(recipe: &str, custom_prompt: &Option<String>) -> String {
    let recipe_instruction = match recipe {
        "synthesize" => {
            "You are a context synthesis engine. Analyze all the provided items, find connections, contradictions, and patterns. \
             Produce a comprehensive markdown synthesis that cross-examines the sources. \
             Set `markdown_content` to the synthesized document. \
             Extract any actionable items into `extracted_tasks`. \
             Suggest relevant `tags` for categorization. \
             Write a brief `summary` of the overall synthesis."
        }
        "extract_tasks" => {
            "You are a task extraction engine. Carefully read all the provided items and extract every actionable task, \
             to-do, follow-up, or commitment mentioned. Each task should have a clear `title`, a `priority` (low/medium/high), \
             and an optional `due_date` in ISO 8601 format if mentioned. \
             Set `extracted_tasks` to the list. Set `summary` to a brief overview of what was found. \
             `tags` should contain relevant categories. `markdown_content` can be null."
        }
        "triage" => {
            "You are a triage and categorization engine. Analyze all provided items and: \
             1) Suggest relevant `tags` for each item and overall. \
             2) Write a brief `summary` of the collection. \
             3) If any items contain actionable tasks, extract them into `extracted_tasks`. \
             4) `markdown_content` can contain a brief triage report if useful."
        }
        "custom" => {
            "You are a versatile AI assistant. Follow the user's custom instruction precisely. \
             Structure your output according to the JSON schema provided."
        }
        _ => {
            "You are a helpful AI assistant. Analyze the provided items and produce structured output."
        }
    };

    let custom_part = match custom_prompt {
        Some(p) if !p.trim().is_empty() => format!("\n\nAdditional user instruction: {}", p),
        _ => String::new(),
    };

    format!(
        "{}{}\n\n\
         You MUST respond with ONLY valid JSON matching this exact schema:\n\
         {{\n\
           \"summary\": \"string or null\",\n\
           \"tags\": [\"string\", ...],\n\
           \"extracted_tasks\": [\n\
             {{ \"title\": \"string\", \"priority\": \"low|medium|high\", \"due_date\": \"ISO8601 or null\" }}\n\
           ],\n\
           \"markdown_content\": \"string or null\"\n\
         }}\n\n\
         Important: All newlines inside strings must be escaped as \\n. Do NOT include any text before or after the JSON. Output ONLY the JSON object.",
        recipe_instruction, custom_part
    )
}

/// Helper: Extracts readable plain text from raw file bytes based on file extension and MIME type.
fn extract_text_from_file_bytes(bytes: &[u8], ext: &str, mime_type: &str) -> Option<String> {
    if bytes.is_empty() {
        return None;
    }

    // 1. DOCX
    if ext == "docx" || mime_type.contains("wordprocessingml") {
        return crate::commands::items::extract_docx_text(bytes);
    }

    // 2. XLSX
    if ext == "xlsx" || mime_type.contains("spreadsheetml") {
        return crate::commands::items::extract_xlsx_text(bytes);
    }

    // 3. Text, Markdown, Code, JSON, CSV, Config, Logs, etc.
    let is_text_type = matches!(
        ext,
        "txt" | "md" | "markdown" | "json" | "csv" | "tsv" | "xml" | "yaml" | "yml"
            | "log" | "sql" | "html" | "css" | "scss" | "js" | "jsx" | "ts" | "tsx"
            | "py" | "rs" | "go" | "c" | "cpp" | "h" | "hpp" | "java" | "sh" | "bat"
            | "ps1" | "env" | "ini" | "conf" | "properties" | "toml" | "diff" | "patch"
    ) || mime_type.starts_with("text/") || mime_type.contains("json") || mime_type.contains("xml") || mime_type.contains("javascript");

    if is_text_type {
        if bytes.len() <= 10 * 1024 * 1024 {
            let s = String::from_utf8_lossy(bytes);
            return Some(s.chars().take(80_000).collect());
        }
    }

    // 4. PDF heuristic text stream extraction
    if ext == "pdf" || mime_type == "application/pdf" {
        return extract_pdf_heuristic(bytes);
    }

    None
}

/// Extract printable strings from PDF stream objects
fn extract_pdf_heuristic(bytes: &[u8]) -> Option<String> {
    let raw = String::from_utf8_lossy(bytes);
    let mut extracted = String::new();

    let mut in_parentheses = false;
    let mut current_buf = String::new();
    let mut is_escaped = false;

    for ch in raw.chars() {
        if in_parentheses {
            if is_escaped {
                current_buf.push(ch);
                is_escaped = false;
            } else if ch == '\\' {
                is_escaped = true;
            } else if ch == ')' {
                in_parentheses = false;
                if current_buf.len() >= 2 && current_buf.chars().any(|c| c.is_alphabetic()) {
                    extracted.push_str(&current_buf);
                    extracted.push(' ');
                }
                current_buf.clear();
            } else if ch.is_ascii_graphic() || ch == ' ' {
                current_buf.push(ch);
            }
        } else if ch == '(' {
            in_parentheses = true;
            current_buf.clear();
        }

        if extracted.len() > 60_000 {
            break;
        }
    }

    let trimmed = extracted.trim();
    if trimmed.len() > 20 {
        Some(trimmed.to_string())
    } else {
        None
    }
}

#[derive(Debug, Clone)]
pub struct ExtractedImage {
    pub file_name: String,
    pub mime_type: String,
    pub base64: String,
}

#[derive(Debug, Clone, Default)]
pub struct ContextFetchResult {
    pub items: Vec<(String, String)>,
    pub images: Vec<ExtractedImage>,
}

fn is_image_file_type(mime: &str, ext: &str) -> bool {
    mime.starts_with("image/")
        || matches!(
            ext,
            "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "svg"
        )
}

fn normalize_image_mime(mime: &str, ext: &str) -> String {
    if ext == "png" {
        "image/png".to_string()
    } else if ext == "jpg" || ext == "jpeg" {
        "image/jpeg".to_string()
    } else if ext == "webp" {
        "image/webp".to_string()
    } else if ext == "gif" {
        "image/gif".to_string()
    } else if ext == "svg" {
        "image/svg+xml".to_string()
    } else if ext == "bmp" {
        "image/bmp".to_string()
    } else if mime.starts_with("image/") {
        mime.to_string()
    } else {
        "image/jpeg".to_string()
    }
}

fn extract_image_base64(
    data_url: Option<&str>,
    storage: &StorageManager,
    file_path: &str,
    safe_name: &str,
) -> Option<String> {
    // 1. Dari data_url jika ada di SQLite
    if let Some(url) = data_url {
        let trimmed = url.trim();
        if trimmed.starts_with("data:") {
            if let Some((_, b64)) = trimmed.split_once(',') {
                let clean_b64 = b64.trim();
                if !clean_b64.is_empty() {
                    return Some(clean_b64.to_string());
                }
            }
        } else if trimmed.len() > 100 && !trimmed.contains(' ') && !trimmed.starts_with("http") {
            return Some(trimmed.to_string());
        }
    }

    // 2. Dari file fisik di disk via storage manager
    if let Some(p) = storage.resolve_attachment_path(file_path, safe_name) {
        if let Ok(meta) = std::fs::metadata(&p) {
            // Batas 20MB per gambar agar aman dari OOM
            if meta.len() <= 20 * 1024 * 1024 && p.is_file() {
                if let Ok(bytes) = std::fs::read(&p) {
                    return Some(base64::engine::general_purpose::STANDARD.encode(&bytes));
                }
            }
        }
    }

    None
}

/// Fetches item content and any attached file contents (including multimodal images) from database/storage.
fn fetch_item_contexts(
    db: &Database,
    storage: &StorageManager,
    item_ids: &[String],
) -> Result<ContextFetchResult, String> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let mut result = ContextFetchResult::default();

    for id in item_ids {
        // 1. Cek tabel items
        let item_opt = conn
            .query_row(
                "SELECT id, title, content, type FROM items WHERE id = ?1 AND deleted_at IS NULL",
                [id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                },
            )
            .ok();

        if let Some((item_id, title, mut content, item_type)) = item_opt {
            // Check content_index for plain_text
            let plain_text: Option<String> = conn
                .query_row(
                    "SELECT plain_text FROM content_index WHERE item_id = ?1",
                    [&item_id],
                    |row| row.get(0),
                )
                .ok()
                .filter(|t: &String| !t.trim().is_empty());

            if let Some(pt) = plain_text {
                content = pt;
            }

            // Fetch any attachments associated with this item
            let att_rows: Vec<(String, String, String, String, i64, Option<String>)> = if let Ok(mut att_stmt) = conn.prepare(
                "SELECT id, file_name, file_path, mime_type, file_size, data_url FROM attachments WHERE item_id = ?1"
            ) {
                att_stmt
                    .query_map([&item_id], |r| {
                        Ok((
                            r.get(0)?,
                            r.get(1)?,
                            r.get(2)?,
                            r.get(3)?,
                            r.get(4)?,
                            r.get(5).ok(),
                        ))
                    })
                    .map(|rows| rows.filter_map(|r| r.ok()).collect())
                    .unwrap_or_default()
            } else {
                Vec::new()
            };

            let mut attached_texts = Vec::new();
            let mut item_images = Vec::new();

            for (_att_id, file_name, file_path, mime_type, _file_size, data_url) in att_rows {
                let safe_name = StorageManager::sanitize_file_name(&file_name);
                let ext = std::path::Path::new(&file_name)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                if is_image_file_type(&mime_type, &ext) {
                    if let Some(b64) = extract_image_base64(data_url.as_deref(), storage, &file_path, &safe_name) {
                        let norm_mime = normalize_image_mime(&mime_type, &ext);
                        item_images.push(ExtractedImage {
                            file_name: file_name.clone(),
                            mime_type: norm_mime.clone(),
                            base64: b64,
                        });
                        attached_texts.push(format!(
                            "--- ATTACHED IMAGE: {} ({}) ---\n[Image data attached for multimodal visual inspection]",
                            file_name, norm_mime
                        ));
                    }
                } else if let Some(resolved_path) = storage.resolve_attachment_path(&file_path, &safe_name) {
                    if let Ok(bytes) = std::fs::read(&resolved_path) {
                        if let Some(extracted) = extract_text_from_file_bytes(&bytes, &ext, &mime_type) {
                            if !extracted.trim().is_empty() {
                                attached_texts.push(format!(
                                    "--- ATTACHED FILE: {} ---\n{}",
                                    file_name,
                                    extracted.chars().take(80_000).collect::<String>()
                                ));
                            }
                        }
                    }
                }
            }

            // Fallback untuk item bertipe image yang menyimpan data di content
            if item_type == "image" && item_images.is_empty() {
                let trimmed = content.trim();
                if trimmed.starts_with("data:") {
                    if let Some((head, b64)) = trimmed.split_once(',') {
                        let norm_mime = if head.contains("png") {
                            "image/png"
                        } else if head.contains("webp") {
                            "image/webp"
                        } else if head.contains("gif") {
                            "image/gif"
                        } else {
                            "image/jpeg"
                        };
                        item_images.push(ExtractedImage {
                            file_name: title.clone(),
                            mime_type: norm_mime.to_string(),
                            base64: b64.trim().to_string(),
                        });
                        attached_texts.push(format!(
                            "--- IMAGE: {} ({}) ---\n[Image data attached for multimodal visual inspection]",
                            title, norm_mime
                        ));
                    }
                }
            }

            result.images.extend(item_images);

            if !attached_texts.is_empty() {
                let attachments_str = attached_texts.join("\n\n");
                if content.trim().is_empty() || content.starts_with("File: ") {
                    content = attachments_str;
                } else {
                    content = format!("{}\n\n{}", content, attachments_str);
                }
            }

            result.items.push((title, content));
        } else {
            // 2. Try finding as a direct attachment ID in attachments table
            let att_opt = conn
                .query_row(
                    "SELECT a.item_id, a.file_name, a.file_path, a.mime_type, a.file_size, a.data_url, COALESCE(i.title, a.file_name) \
                     FROM attachments a LEFT JOIN items i ON a.item_id = i.id WHERE a.id = ?1",
                    [id],
                    |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                            row.get::<_, String>(3)?,
                            row.get::<_, i64>(4)?,
                            row.get::<_, Option<String>>(5).ok().flatten(),
                            row.get::<_, String>(6)?,
                        ))
                    },
                )
                .ok();

            if let Some((_item_id, file_name, file_path, mime_type, _file_size, data_url, title)) = att_opt {
                let safe_name = StorageManager::sanitize_file_name(&file_name);
                let ext = std::path::Path::new(&file_name)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                let mut content = format!("Attached File: {}", file_name);

                if is_image_file_type(&mime_type, &ext) {
                    if let Some(b64) = extract_image_base64(data_url.as_deref(), storage, &file_path, &safe_name) {
                        let norm_mime = normalize_image_mime(&mime_type, &ext);
                        result.images.push(ExtractedImage {
                            file_name: file_name.clone(),
                            mime_type: norm_mime.clone(),
                            base64: b64,
                        });
                        content = format!(
                            "--- ATTACHED IMAGE FILE: {} ({}) ---\n[Image data attached for multimodal visual inspection]",
                            file_name, norm_mime
                        );
                    }
                } else if let Some(resolved_path) = storage.resolve_attachment_path(&file_path, &safe_name) {
                    if let Ok(bytes) = std::fs::read(&resolved_path) {
                        if let Some(extracted) = extract_text_from_file_bytes(&bytes, &ext, &mime_type) {
                            if !extracted.trim().is_empty() {
                                content = format!(
                                    "--- ATTACHED FILE CONTENT: {} ---\n{}",
                                    file_name,
                                    extracted.chars().take(80_000).collect::<String>()
                                );
                            }
                        }
                    }
                }
                result.items.push((title, content));
            }
        }
    }

    Ok(result)
}

/// Builds the user prompt with all staged item contexts.
fn build_context_prompt(items: &[(String, String)]) -> String {
    let mut prompt = String::from("Context source items:\n\n");
    for (title, content) in items {
        prompt.push_str(&format!("--- ITEM: {} ---\n{}\n---\n\n", title, content));
    }
    prompt
}

/// Calls the LLM via reqwest and parses the JSON response.
async fn call_llm(
    provider_config: &LlmProviderConfig,
    system_prompt: &str,
    user_prompt: &str,
    images: &[ExtractedImage],
) -> Result<RecipeOutput, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let raw_response = match provider_config {
        LlmProviderConfig::Ollama { base_url, model } => {
            let ollama_client = crate::ai::ollama::LocalAiClient::new(Some(base_url.clone()), None);
            let target_model = ollama_client.resolve_local_model(model).await;
            let url = format!("{}/api/generate", base_url.trim_end_matches('/'));
            let mut payload = serde_json::json!({
                "model": target_model,
                "prompt": format!("{}\n\n{}", system_prompt, user_prompt),
                "stream": false,
                "format": "json"
            });
            if !images.is_empty() {
                let img_payload: Vec<&str> = images.iter().map(|img| img.base64.as_str()).collect();
                payload["images"] = serde_json::json!(img_payload);
            }

            let resp = client
                .post(&url)
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Ollama request failed: {}", e))?;

            if !resp.status().is_success() {
                let status = resp.status();
                let err_text = resp.text().await.unwrap_or_default();
                if status == reqwest::StatusCode::NOT_FOUND {
                    let installed = ollama_client.list_models().await.unwrap_or_default();
                    if !installed.is_empty() {
                        return Err(format!(
                            "Ollama error: Model '{}' not found. Installed models: [{}]. Please select one in Settings or run 'ollama pull {}'.",
                            target_model,
                            installed.join(", "),
                            target_model
                        ));
                    }
                }
                return Err(format!("Ollama error (HTTP {}): {}", status, err_text));
            }

            let val: Value = resp
                .json()
                .await
                .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

            val.get("response")
                .and_then(|r| r.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| "Empty response from Ollama".to_string())?
        }
        LlmProviderConfig::OpenAiCompatible {
            base_url,
            api_key,
            model,
        } => {
            let is_anthropic = base_url.contains("anthropic.com");

            let chat_url = if is_anthropic {
                "https://api.anthropic.com/v1/messages".to_string()
            } else if base_url.ends_with("/v1") || base_url.ends_with("/openai") {
                format!("{}/chat/completions", base_url)
            } else if base_url.ends_with("/chat/completions") {
                base_url.clone()
            } else {
                format!("{}/v1/chat/completions", base_url)
            };

            let payload = if is_anthropic {
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

                serde_json::json!({
                    "model": model,
                    "system": system_prompt,
                    "messages": [
                        { "role": "user", "content": user_content }
                    ],
                    "max_tokens": 4096,
                    "temperature": 0.3
                })
            } else {
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

                serde_json::json!({
                    "model": model,
                    "messages": [
                        { "role": "system", "content": system_prompt },
                        { "role": "user", "content": user_content }
                    ],
                    "temperature": 0.3,
                    "stream": false
                })
            };

            let mut req = client.post(&chat_url).json(&payload);

            if !api_key.is_empty() {
                if is_anthropic {
                    req = req
                        .header("x-api-key", api_key)
                        .header("anthropic-version", "2023-06-01")
                        .header("content-type", "application/json");
                } else {
                    req = req.header("Authorization", format!("Bearer {}", api_key));
                }
            }

            if base_url.contains("openrouter.ai") {
                req = req
                    .header("HTTP-Referer", "https://velco.app")
                    .header("X-Title", "Velco");
            }

            let resp = req
                .send()
                .await
                .map_err(|e| format!("AI request failed: {}", e))?;

            if !resp.status().is_success() {
                let status = resp.status();
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

            // Handle Anthropic response format
            if is_anthropic {
                val.get("content")
                    .and_then(|c| c.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|item| item.get("text"))
                    .and_then(|t| t.as_str())
                    .map(|s| s.to_string())
                    .ok_or_else(|| "Empty response from Anthropic".to_string())?
            } else {
                // OpenAI-compatible format
                val.get("choices")
                    .and_then(|c| c.get(0))
                    .and_then(|c0| c0.get("message"))
                    .and_then(|m| m.get("content"))
                    .and_then(|s| s.as_str())
                    .map(|s| s.to_string())
                    .ok_or_else(|| "Empty response from AI provider".to_string())?
            }
        }
    };

    parse_recipe_output(&raw_response)
}

/// Sanitizes a JSON string by escaping unescaped control characters (\u0000 to \u001F,
/// such as literal newlines and tabs) that appear inside string literals.
fn sanitize_json_control_chars(json: &str) -> String {
    let mut out = String::with_capacity(json.len() + 128);
    let mut in_string = false;
    let mut is_escaped = false;

    for ch in json.chars() {
        if in_string {
            if is_escaped {
                out.push(ch);
                is_escaped = false;
            } else if ch == '\\' {
                out.push(ch);
                is_escaped = true;
            } else if ch == '"' {
                out.push(ch);
                in_string = false;
            } else if ch == '\n' {
                out.push_str("\\n");
            } else if ch == '\r' {
                out.push_str("\\r");
            } else if ch == '\t' {
                out.push_str("\\t");
            } else if (ch as u32) < 0x20 {
                use std::fmt::Write;
                let _ = write!(out, "\\u{:04x}", ch as u32);
            } else {
                out.push(ch);
            }
        } else {
            if ch == '"' {
                in_string = true;
            }
            out.push(ch);
        }
    }

    if in_string {
        out.push('"');
    }

    out
}

/// Extracts JSON content from raw LLM output, unwrapping markdown fences and stripping chatter.
fn extract_json_from_response(raw: &str) -> String {
    let clean_raw = crate::ai::ollama::strip_think_tags(raw);
    let trimmed = clean_raw.trim();

    // 1. Unwrap markdown code blocks (```json ... ``` or ``` ... ```)
    let unwrapped = if let Some(start) = trimmed.find("```json") {
        let after = &trimmed[start + 7..];
        if let Some(end) = after.rfind("```") {
            after[..end].trim()
        } else {
            after.trim()
        }
    } else if let Some(start) = trimmed.find("```") {
        let after = &trimmed[start + 3..];
        if let Some(end) = after.rfind("```") {
            after[..end].trim()
        } else {
            after.trim()
        }
    } else {
        trimmed
    };

    // 2. Find outermost JSON object bounds: first '{' and last '}'
    if let (Some(first_brace), Some(last_brace)) = (unwrapped.find('{'), unwrapped.rfind('}')) {
        if first_brace < last_brace {
            return unwrapped[first_brace..=last_brace].trim().to_string();
        }
    }

    unwrapped.to_string()
}

/// Resiliently parses AI output into RecipeOutput.
fn parse_recipe_output(raw_response: &str) -> Result<RecipeOutput, String> {
    let extracted = extract_json_from_response(raw_response);
    let sanitized = sanitize_json_control_chars(&extracted);

    // 1. Try direct typed parse
    if let Ok(output) = serde_json::from_str::<RecipeOutput>(&sanitized) {
        return Ok(output);
    }

    // 2. Try parsing into generic serde_json::Value as resilient fallback
    if let Ok(val) = serde_json::from_str::<Value>(&sanitized) {
        if let Some(obj) = val.as_object() {
            let summary = obj.get("summary").and_then(|v| {
                if let Some(s) = v.as_str() {
                    Some(s.to_string())
                } else if v.is_null() {
                    None
                } else {
                    Some(v.to_string())
                }
            });

            let markdown_content = obj.get("markdown_content").and_then(|v| {
                if let Some(s) = v.as_str() {
                    Some(s.to_string())
                } else if v.is_null() {
                    None
                } else {
                    Some(v.to_string())
                }
            });

            let tags = obj
                .get("tags")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|t| t.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();

            let extracted_tasks = obj
                .get("extracted_tasks")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|item| {
                            let title = item.get("title").and_then(|t| t.as_str())?.to_string();
                            let priority = item
                                .get("priority")
                                .and_then(|p| p.as_str())
                                .unwrap_or("medium")
                                .to_string();
                            let due_date = item
                                .get("due_date")
                                .and_then(|d| d.as_str())
                                .map(|s| s.to_string());
                            Some(crate::ai::ExtractedTaskPayload {
                                title,
                                priority,
                                due_date,
                            })
                        })
                        .collect()
                })
                .unwrap_or_default();

            return Ok(RecipeOutput {
                summary,
                tags,
                extracted_tasks,
                markdown_content,
            });
        }
    }

    // 3. Ultimate graceful fallback: If all JSON parsing fails but text exists,
    // wrap into RecipeOutput as markdown_content so user content is never dropped!
    if !raw_response.trim().is_empty() {
        return Ok(RecipeOutput {
            summary: Some("Synthesis Generated".to_string()),
            tags: vec![],
            extracted_tasks: vec![],
            markdown_content: Some(raw_response.trim().to_string()),
        });
    }

    Err(format!(
        "Failed to parse AI output. Raw response: {}",
        &raw_response[..raw_response.len().min(500)]
    ))
}

/// Execute a structured AI recipe against staged context items.
#[tauri::command]
pub async fn execute_context_recipe(
    app: tauri::AppHandle,
    item_ids: Vec<String>,
    recipe: String,
    custom_prompt: Option<String>,
    provider_config: LlmProviderConfig,
) -> Result<RecipeOutput, String> {
    if item_ids.is_empty() {
        return Err("No items provided for recipe execution".to_string());
    }

    // 1. Fetch item content from database and file storage
    let db = app.state::<Database>();
    let storage = app.state::<StorageManager>();
    let context_data = fetch_item_contexts(&db, &storage, &item_ids)?;

    if context_data.items.is_empty() && context_data.images.is_empty() {
        return Err("No valid items found for the provided IDs".to_string());
    }

    // 2. Build prompts
    let system_prompt = build_recipe_system_prompt(&recipe, &custom_prompt);
    let user_prompt = build_context_prompt(&context_data.items);

    // 3. Call the LLM
    let output = call_llm(&provider_config, &system_prompt, &user_prompt, &context_data.images).await?;

    Ok(output)
}

/// Apply the structured artifacts from a recipe output into the database.
/// NOTE: dijalankan via `spawn_blocking` agar `std::Mutex` tidak memblokir executor Tokio.
/// FTS dijaga trigger otomatis — tidak ada INSERT manual ke items_fts.
#[tauri::command]
pub async fn apply_recipe_artifacts(
    app: tauri::AppHandle,
    target_item_id: Option<String>,
    output: RecipeOutput,
) -> Result<(), String> {
    // Validasi + cap di luar blocking task (cepat, tanpa lock)
    if output.extracted_tasks.len() > 100 {
        return Err("Too many extracted tasks (max 100)".to_string());
    }
    if output.tags.len() > 30 {
        return Err("Too many tags (max 30)".to_string());
    }
    let md_capped: Option<String> = output
        .markdown_content
        .clone()
        .map(|m| m.chars().take(500_000).collect());

    let output_owned = crate::ai::RecipeOutput {
        extracted_tasks: output
            .extracted_tasks
            .into_iter()
            .take(100)
            .map(|t| crate::ai::ExtractedTaskPayload {
                title: t.title.chars().take(500).collect(),
                priority: t.priority,
                due_date: t.due_date,
            })
            .collect(),
        tags: output.tags.into_iter().take(30).collect(),
        summary: output.summary.map(|s| s.chars().take(2000).collect()),
        markdown_content: md_capped,
    };

    // Pindahkan AppHandle ke blocking thread; state DB diakses di sana.
    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        apply_recipe_artifacts_blocking(&app2, target_item_id, output_owned)
    })
    .await
    .map_err(|e| format!("Artifact task panicked: {}", e))?
}

fn apply_recipe_artifacts_blocking(
    app: &tauri::AppHandle,
    target_item_id: Option<String>,
    output: crate::ai::RecipeOutput,
) -> Result<(), String> {
    use tauri::Manager;
    let db = app.state::<crate::database::Database>();
    let mut conn = db
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();

    // 1. Insert extracted tasks (atomic via transaction)
    for task in &output.extracted_tasks {
        let title: String = task.title.chars().take(500).collect();
        if title.trim().is_empty() {
            continue;
        }
        let item_id = uuid::Uuid::new_v4().to_string();
        let task_id = uuid::Uuid::new_v4().to_string();

        // Create the item
        tx.execute(
            "INSERT INTO items (id, type, title, content, source, status, favorite, archived, created_at, updated_at) \
             VALUES (?1, 'task', ?2, ?3, 'ai_recipe', 'inbox', 0, 0, ?4, ?4)",
            rusqlite::params![item_id, title, title, now],
        )
        .map_err(|e| format!("Failed to insert task item: {}", e))?;

        // Create the task metadata
        let priority = match task.priority.as_str() {
            "low" | "medium" | "high" => task.priority.clone(),
            _ => "medium".to_string(),
        };

        tx.execute(
            "INSERT INTO tasks (id, item_id, due_date, priority, completed, completed_at) \
             VALUES (?1, ?2, ?3, ?4, 0, NULL)",
            rusqlite::params![task_id, item_id, task.due_date, priority],
        )
        .map_err(|e| format!("Failed to insert task metadata: {}", e))?;
        // FTS otomatis via trigger items_ai — tanpa insert manual.
    }

    // 2. Process tags
    for tag_name in &output.tags {
        let trimmed = tag_name.trim().chars().take(100).collect::<String>();
        if trimmed.is_empty() {
            continue;
        }

        // Upsert tag
        let tag_id: String = match tx.query_row(
            "SELECT id FROM tags WHERE name = ?1",
            [&trimmed],
            |row| row.get(0),
        ) {
            Ok(id) => id,
            Err(_) => {
                let new_id = uuid::Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, '#3b82f6', ?3)",
                    rusqlite::params![new_id, trimmed, now],
                )
                .map_err(|e| format!("Failed to insert tag: {}", e))?;
                new_id
            }
        };

        // Assign tag to target item if specified
        if let Some(ref target_id) = target_item_id {
            tx.execute(
                "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
                rusqlite::params![target_id, tag_id],
            )
            .map_err(|e| format!("Failed to assign tag: {}", e))?;
        }
    }

    // 3. Handle markdown content (trigger items_au otomatis sinkron FTS saat UPDATE/INSERT)
    if let Some(ref md) = output.markdown_content {
        if !md.trim().is_empty() {
            if let Some(ref target_id) = target_item_id {
                // Append to existing item
                let existing: String = tx
                    .query_row(
                        "SELECT content FROM items WHERE id = ?1",
                        [target_id],
                        |row| row.get(0),
                    )
                    .unwrap_or_default();

                let updated = if existing.trim().is_empty() {
                    md.clone()
                } else {
                    format!("{}\n\n---\n\n## AI Synthesis\n\n{}", existing, md)
                };

                tx.execute(
                    "UPDATE items SET content = ?1, updated_at = ?2 WHERE id = ?3",
                    rusqlite::params![updated, now, target_id],
                )
                .map_err(|e| format!("Failed to update item content: {}", e))?;
            } else {
                // Create a new master note
                let note_id = uuid::Uuid::new_v4().to_string();
                let title = output
                    .summary
                    .as_deref()
                    .unwrap_or("AI Synthesis")
                    .chars()
                    .take(100)
                    .collect::<String>();

                tx.execute(
                    "INSERT INTO items (id, type, title, content, source, status, favorite, archived, created_at, updated_at) \
                     VALUES (?1, 'note', ?2, ?3, 'ai_recipe', 'inbox', 0, 0, ?4, ?4)",
                    rusqlite::params![note_id, title, md, now],
                )
                .map_err(|e| format!("Failed to create master note: {}", e))?;
            }
        }
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit artifacts: {}", e))?;
    Ok(())
}

// ============================================================================
// Context Chat Commands (Interactive Conversational Workstation)
// ============================================================================

/// Registry request chat yang dibatalkan user via `cancel_chat`.
/// Dicek di tiap iterasi streaming agar backend berhenti emit + hemat VRAM/CPU.
static CANCELLED_CHAT_REQUESTS: std::sync::OnceLock<std::sync::Mutex<std::collections::HashSet<String>>> =
    std::sync::OnceLock::new();

fn cancelled_requests() -> &'static std::sync::Mutex<std::collections::HashSet<String>> {
    CANCELLED_CHAT_REQUESTS.get_or_init(|| std::sync::Mutex::new(std::collections::HashSet::new()))
}

fn is_chat_cancelled(request_id: &str) -> bool {
    cancelled_requests()
        .lock()
        .map(|s| s.contains(request_id))
        .unwrap_or(false)
}

/// Batalkan chat yang sedang streaming. Dipanggil dari `chatStore.stopGenerating`.
/// Backend akan berhenti emit chunk untuk request_id ini dan mengembalikan Ok parsial.
#[tauri::command]
pub fn cancel_chat(request_id: String) -> Result<(), String> {
    if request_id.trim().is_empty() {
        return Err("request_id cannot be empty".to_string());
    }
    if let Ok(mut set) = cancelled_requests().lock() {
        set.insert(request_id);
        // Batasi ukuran set agar tidak tumbuh tanpa batas (LRU sederhana)
        if set.len() > 100 {
            if let Some(old) = set.iter().next().cloned() {
                set.remove(&old);
            }
        }
    }
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChatMessagePayload {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ChatChunkEvent {
    pub request_id: String,
    pub delta: String,
    pub done: bool,
    pub error: Option<String>,
}

/// Execute a conversational chat query against staged context items, streaming chunks via Tauri events.
#[tauri::command]
pub async fn execute_context_chat(
    app: tauri::AppHandle,
    request_id: String,
    messages: Vec<ChatMessagePayload>,
    item_ids: Vec<String>,
    provider_config: LlmProviderConfig,
) -> Result<String, String> {
    // 1. Fetch item and attached file contents from SQLite and file storage
    let db = app.state::<Database>();
    let storage = app.state::<StorageManager>();
    let context_data = if !item_ids.is_empty() {
        fetch_item_contexts(&db, &storage, &item_ids).unwrap_or_default()
    } else {
        ContextFetchResult::default()
    };

    // 2. Build system prompt grounded on the staged context
    let mut system_prompt = String::from(
        "You are Velco Assistant, an intelligent, context-aware companion inside Velco Context Workstation.\n\
         Your mission is to help the user understand, cross-reference, analyze, and synthesize their stored knowledge.\n"
    );

    if !context_data.items.is_empty() || !context_data.images.is_empty() {
        system_prompt.push_str("\nThe user has assembled the following staged items into their active Context Cart:\n\n");
        for (title, content) in &context_data.items {
            system_prompt.push_str(&format!("--- CONTEXT ITEM: {} ---\n{}\n---\n\n", title, content));
        }
        if !context_data.images.is_empty() {
            system_prompt.push_str(&format!(
                "\nNote: {} image(s) from the context items have been attached to the chat for direct visual inspection.\n",
                context_data.images.len()
            ));
        }
        system_prompt.push_str(
            "Guidelines:\n\
             1. Ground your answers primarily on the context items above whenever relevant.\n\
             2. If comparing or citing sources, refer to items by their title.\n\
             3. Highlight actionable items, follow-ups, and key takeaways clearly.\n\
             4. Format with clean GitHub-flavored Markdown (headings, bullet points, code blocks).\n\
             5. If the context does not contain enough information to answer, state so honestly while offering helpful general reasoning.\n"
        );
    } else {
        system_prompt.push_str(
            "Currently, no specific items are staged in the Context Cart. Answer generally, and remind the user they can stage notes, tasks, files, or links from their feed into the Context Cart to ground the conversation.\n"
        );
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut full_text = String::new();

    match provider_config {
        LlmProviderConfig::Ollama { base_url, model } => {
            let chat_url = format!("{}/api/chat", base_url.trim_end_matches('/'));

            let mut ollama_messages = vec![serde_json::json!({
                "role": "system",
                "content": system_prompt
            })];

            let last_user_idx = messages.iter().rposition(|m| m.role == "user");

            for (idx, msg) in messages.iter().enumerate() {
                if Some(idx) == last_user_idx && !context_data.images.is_empty() {
                    let imgs_b64: Vec<&str> = context_data.images.iter().map(|img| img.base64.as_str()).collect();
                    ollama_messages.push(serde_json::json!({
                        "role": msg.role,
                        "content": msg.content,
                        "images": imgs_b64
                    }));
                } else {
                    ollama_messages.push(serde_json::json!({
                        "role": msg.role,
                        "content": msg.content
                    }));
                }
            }

            let payload = serde_json::json!({
                "model": model,
                "messages": ollama_messages,
                "stream": true
            });

            let mut resp = client
                .post(&chat_url)
                .json(&payload)
                .send()
                .await
                .map_err(|e| {
                    let err = format!("Ollama connection error: {}", e);
                    let _ = app.emit(
                        "ai-chat-chunk",
                        ChatChunkEvent {
                            request_id: request_id.clone(),
                            delta: String::new(),
                            done: true,
                            error: Some(err.clone()),
                        },
                    );
                    err
                })?;

            if !resp.status().is_success() {
                let status = resp.status();
                let err_text = resp.text().await.unwrap_or_default();
                let err_msg = format!("Ollama returned HTTP {}: {}", status, err_text);
                let _ = app.emit(
                    "ai-chat-chunk",
                    ChatChunkEvent {
                        request_id: request_id.clone(),
                        delta: String::new(),
                        done: true,
                        error: Some(err_msg.clone()),
                    },
                );
                return Err(err_msg);
            }

            let mut line_buffer = String::new();
            while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
                // Hormati pembatalan user — berhenti segera tanpa emit lanjutan.
                if is_chat_cancelled(&request_id) {
                    break;
                }
                let chunk_str = String::from_utf8_lossy(&chunk);
                line_buffer.push_str(&chunk_str);

                while let Some(pos) = line_buffer.find('\n') {
                    let line = line_buffer[..pos].trim().to_string();
                    line_buffer = line_buffer[pos + 1..].to_string();

                    if line.is_empty() {
                        continue;
                    }

                    if let Ok(val) = serde_json::from_str::<Value>(&line) {
                        if let Some(content) = val
                            .get("message")
                            .and_then(|m| m.get("content"))
                            .and_then(|c| c.as_str())
                        {
                            if !content.is_empty() {
                                full_text.push_str(content);
                                let _ = app.emit(
                                    "ai-chat-chunk",
                                    ChatChunkEvent {
                                        request_id: request_id.clone(),
                                        delta: content.to_string(),
                                        done: false,
                                        error: None,
                                    },
                                );
                            }
                        }

                        if val.get("done").and_then(|d| d.as_bool()).unwrap_or(false) {
                            break;
                        }
                    }
                }
            }
        }
        LlmProviderConfig::OpenAiCompatible {
            base_url,
            api_key,
            model,
        } => {
            let is_anthropic = base_url.contains("anthropic.com");

            let chat_url = if is_anthropic {
                "https://api.anthropic.com/v1/messages".to_string()
            } else if base_url.ends_with("/v1") || base_url.ends_with("/openai") {
                format!("{}/chat/completions", base_url)
            } else if base_url.ends_with("/chat/completions") {
                base_url.clone()
            } else {
                format!("{}/v1/chat/completions", base_url)
            };

            let payload = if is_anthropic {
                let last_user_idx = messages.iter().rposition(|m| m.role == "user" || (m.role != "assistant" && m.role != "system"));

                let anthropic_messages: Vec<serde_json::Value> = messages
                    .iter()
                    .enumerate()
                    .filter(|(_, m)| m.role != "system")
                    .map(|(idx, m)| {
                        let role = if m.role == "assistant" { "assistant" } else { "user" };
                        if Some(idx) == last_user_idx && !context_data.images.is_empty() {
                            let mut parts = Vec::new();
                            for img in &context_data.images {
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

                serde_json::json!({
                    "model": model,
                    "system": system_prompt,
                    "messages": anthropic_messages,
                    "max_tokens": 4096,
                    "stream": true
                })
            } else {
                let mut openai_messages = vec![serde_json::json!({
                    "role": "system",
                    "content": system_prompt
                })];

                let last_user_idx = messages.iter().rposition(|m| m.role == "user");

                for (idx, msg) in messages.iter().enumerate() {
                    if Some(idx) == last_user_idx && !context_data.images.is_empty() {
                        let mut parts = vec![serde_json::json!({
                            "type": "text",
                            "text": msg.content
                        })];
                        for img in &context_data.images {
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

                serde_json::json!({
                    "model": model,
                    "messages": openai_messages,
                    "temperature": 0.7,
                    "stream": true
                })
            };

            let mut req = client.post(&chat_url).json(&payload);

            if !api_key.is_empty() {
                if is_anthropic {
                    req = req
                        .header("x-api-key", &api_key)
                        .header("anthropic-version", "2023-06-01")
                        .header("content-type", "application/json");
                } else {
                    req = req.header("Authorization", format!("Bearer {}", api_key));
                }
            }

            if base_url.contains("openrouter.ai") {
                req = req
                    .header("HTTP-Referer", "https://velco.app")
                    .header("X-Title", "Velco");
            }

            let mut resp = req.send().await.map_err(|e| {
                let err = format!("AI request failed: {}", e);
                let _ = app.emit(
                    "ai-chat-chunk",
                    ChatChunkEvent {
                        request_id: request_id.clone(),
                        delta: String::new(),
                        done: true,
                        error: Some(err.clone()),
                    },
                );
                err
            })?;

            if !resp.status().is_success() {
                let status = resp.status();
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
                let full_err = format!("AI provider error (HTTP {}): {}", status, err_msg);
                let _ = app.emit(
                    "ai-chat-chunk",
                    ChatChunkEvent {
                        request_id: request_id.clone(),
                        delta: String::new(),
                        done: true,
                        error: Some(full_err.clone()),
                    },
                );
                return Err(full_err);
            }

            let mut line_buffer = String::new();
            while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
                if is_chat_cancelled(&request_id) {
                    break;
                }
                let chunk_str = String::from_utf8_lossy(&chunk);
                line_buffer.push_str(&chunk_str);

                while let Some(pos) = line_buffer.find('\n') {
                    let line = line_buffer[..pos].trim().to_string();
                    line_buffer = line_buffer[pos + 1..].to_string();

                    if line.is_empty() {
                        continue;
                    }

                    if let Some(data) = line.strip_prefix("data: ") {
                        let data = data.trim();
                        if data == "[DONE]" {
                            break;
                        }

                        if let Ok(val) = serde_json::from_str::<Value>(data) {
                            // Standard OpenAI format: choices[0].delta.content
                            if let Some(content) = val
                                .get("choices")
                                .and_then(|c| c.get(0))
                                .and_then(|c0| c0.get("delta"))
                                .and_then(|d| d.get("content"))
                                .and_then(|s| s.as_str())
                            {
                                if !content.is_empty() {
                                    full_text.push_str(content);
                                    let _ = app.emit(
                                        "ai-chat-chunk",
                                        ChatChunkEvent {
                                            request_id: request_id.clone(),
                                            delta: content.to_string(),
                                            done: false,
                                            error: None,
                                        },
                                    );
                                }
                            }
                            // Anthropic format: content_block_delta -> delta.text
                            else if let Some(content) = val
                                .get("delta")
                                .and_then(|d| d.get("text"))
                                .and_then(|s| s.as_str())
                            {
                                if !content.is_empty() {
                                    full_text.push_str(content);
                                    let _ = app.emit(
                                        "ai-chat-chunk",
                                        ChatChunkEvent {
                                            request_id: request_id.clone(),
                                            delta: content.to_string(),
                                            done: false,
                                            error: None,
                                        },
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Bersihkan registry cancel + emit final completion event
    if let Ok(mut set) = cancelled_requests().lock() {
        set.remove(&request_id);
    }
    let _ = app.emit(
        "ai-chat-chunk",
        ChatChunkEvent {
            request_id,
            delta: String::new(),
            done: true,
            error: None,
        },
    );

    Ok(full_text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::filesystem::StorageManager;
    use crate::database::Database;

    #[test]
    fn test_image_type_detection_and_normalization() {
        assert!(is_image_file_type("image/png", "png"));
        assert!(is_image_file_type("image/jpeg", "jpg"));
        assert!(is_image_file_type("application/octet-stream", "png"));
        assert!(is_image_file_type("", "webp"));
        assert!(!is_image_file_type("text/plain", "txt"));

        assert_eq!(normalize_image_mime("application/octet-stream", "png"), "image/png");
        assert_eq!(normalize_image_mime("image/jpeg", "jpg"), "image/jpeg");
        assert_eq!(normalize_image_mime("image/webp", "webp"), "image/webp");
    }

    #[test]
    fn test_extract_image_base64_from_data_url() {
        let temp_dir = std::env::temp_dir().join(format!("velco_test_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let storage = StorageManager::new(Some(temp_dir.clone()));
        let sample_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
        let data_url = format!("data:image/png;base64,{}", sample_b64);

        let extracted = extract_image_base64(Some(&data_url), &storage, "", "test.png");
        assert_eq!(extracted, Some(sample_b64.to_string()));
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_extract_image_base64_from_storage_file() {
        let temp_dir = std::env::temp_dir().join(format!("velco_test_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let storage = StorageManager::new(Some(temp_dir.clone()));
        let raw_bytes = b"fake image bytes for testing";
        let (saved_path, _, _) = storage.save_attachment("test_photo.jpg", raw_bytes).unwrap();
        let file_path = saved_path.to_string_lossy().to_string();

        let extracted = extract_image_base64(None, &storage, &file_path, "test_photo.jpg");
        assert!(extracted.is_some());
        let decoded = base64::engine::general_purpose::STANDARD.decode(extracted.unwrap()).unwrap();
        assert_eq!(decoded, raw_bytes);
        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_fetch_item_contexts_with_image_attachment() {
        let temp_dir = std::env::temp_dir().join(format!("velco_test_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&temp_dir);
        let storage = StorageManager::new(Some(temp_dir.clone()));
        let db_path = temp_dir.join("test.db");
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        crate::database::schema::run_migrations(&conn).unwrap();
        let db = Database { conn: std::sync::Mutex::new(conn) };

        let item_id = "test-item-123";
        let att_id = "test-att-456";
        let sample_b64 = "AQIDBA==";
        let data_url = format!("data:image/png;base64,{}", sample_b64);

        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO items (id, type, title, content, source, status, favorite, archived, created_at, updated_at) \
                 VALUES (?1, 'image', 'Screenshot Diagram', '', 'upload', 'inbox', 0, 0, '2026-09-10', '2026-09-10')",
                rusqlite::params![item_id],
            ).unwrap();

            conn.execute(
                "INSERT INTO attachments (id, item_id, file_name, file_path, mime_type, file_size, checksum, created_at, data_url) \
                 VALUES (?1, ?2, 'diagram.png', '', 'image/png', 100, 'local', '2026-09-10', ?3)",
                rusqlite::params![att_id, item_id, data_url],
            ).unwrap();
        }

        let res = fetch_item_contexts(&db, &storage, &[item_id.to_string()]).unwrap();
        assert_eq!(res.images.len(), 1);
        assert_eq!(res.images[0].file_name, "diagram.png");
        assert_eq!(res.images[0].mime_type, "image/png");
        assert_eq!(res.images[0].base64, sample_b64);
        assert_eq!(res.items.len(), 1);
        assert!(res.items[0].1.contains("ATTACHED IMAGE: diagram.png"));
        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}

