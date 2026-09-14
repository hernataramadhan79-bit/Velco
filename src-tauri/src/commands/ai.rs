use base64::Engine;
use parking_lot::Mutex;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::LazyLock;
use tauri::Manager;
use tokio_util::sync::CancellationToken;

use crate::ai::ollama::{ConnectionTestResult, DetailedModelInfo, LocalAiClient};
use crate::ai::providers::{
    resolve_provider, ChatMessagePayload, ExtractedImage,
};
use crate::ai::usage::{
    check_rate_limit, estimate_tokens, query_ai_usage_summary, record_ai_usage, AiUsageSummary,
};
use crate::ai::{LlmProviderConfig, RecipeOutput};
use crate::database::Database;
use crate::filesystem::StorageManager;

// ============================================================================
// Existing AI commands (backward-compatible for Settings UI)
// ============================================================================

#[tauri::command]
pub async fn check_ollama_status(
    base_url: Option<String>,
    api_key: Option<String>,
) -> Result<bool, String> {
    let client = LocalAiClient::new(base_url, api_key);
    Ok(client.check_health().await)
}

#[tauri::command]
pub async fn list_ollama_models(
    base_url: Option<String>,
    api_key: Option<String>,
) -> Result<Vec<String>, String> {
    let client = LocalAiClient::new(base_url, api_key);
    client.list_models().await
}

#[tauri::command]
pub async fn list_ai_models_detailed(
    base_url: Option<String>,
    api_key: Option<String>,
    provider: Option<String>,
) -> Result<Vec<DetailedModelInfo>, String> {
    let client = LocalAiClient::new(base_url, api_key);
    client.list_detailed_models(provider.as_deref()).await
}

#[tauri::command]
pub async fn generate_ai_completion(
    base_url: Option<String>,
    model: String,
    prompt: String,
    api_key: Option<String>,
) -> Result<String, String> {
    let client = LocalAiClient::new(base_url, api_key);
    client.generate(&model, &prompt).await
}

#[tauri::command]
pub async fn test_ai_connection(
    app: tauri::AppHandle,
    base_url: Option<String>,
    api_key: Option<String>,
    provider: Option<String>,
    model: Option<String>,
) -> Result<ConnectionTestResult, String> {
    let resolved_key = api_key.filter(|k| !k.is_empty()).or_else(|| {
        let ai_state = app.state::<crate::ai::state::AiState>();
        provider.as_deref().and_then(|p| ai_state.get_api_key(p))
    });
    let client = LocalAiClient::new(base_url, resolved_key);
    client
        .test_connection(provider.as_deref(), model.as_deref())
        .await
}

#[tauri::command]
pub fn set_ai_credential(
    app: tauri::AppHandle,
    provider: String,
    api_key: String,
) -> Result<(), String> {
    let ai_state = app.state::<crate::ai::state::AiState>();
    ai_state.set_api_key(&provider, &api_key)
}

#[tauri::command]
pub fn get_ai_credential(
    app: tauri::AppHandle,
    provider: String,
) -> Result<Option<String>, String> {
    let ai_state = app.state::<crate::ai::state::AiState>();
    Ok(ai_state.get_api_key(&provider))
}

#[tauri::command]
pub fn delete_ai_credential(
    app: tauri::AppHandle,
    provider: String,
) -> Result<(), String> {
    let ai_state = app.state::<crate::ai::state::AiState>();
    ai_state.clear_api_key(&provider)
}

// ── Cloud AI Consent & Usage Commands ───────────────────────

#[tauri::command]
pub fn grant_cloud_consent(app: tauri::AppHandle, provider: String) -> Result<String, String> {
    let ai_state = app.state::<crate::ai::state::AiState>();
    Ok(ai_state.grant_consent(&provider))
}

#[tauri::command]
pub fn revoke_cloud_consent(app: tauri::AppHandle) -> Result<(), String> {
    let ai_state = app.state::<crate::ai::state::AiState>();
    ai_state.revoke_consent();
    Ok(())
}

#[tauri::command]
pub fn get_cloud_consent(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let ai_state = app.state::<crate::ai::state::AiState>();
    Ok(ai_state.get_current_consent())
}

#[tauri::command]
pub fn get_ai_usage_summary(app: tauri::AppHandle) -> Result<AiUsageSummary, String> {
    let db = app.state::<Database>();
    query_ai_usage_summary(&db)
}

// ============================================================================
// Context Recipe & Chat Implementation
// ============================================================================

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

pub fn extract_text_from_file_bytes(bytes: &[u8], ext: &str, mime_type: &str) -> Option<String> {
    if bytes.is_empty() {
        return None;
    }

    if ext == "docx" || mime_type.contains("wordprocessingml") {
        return crate::commands::items::extract_docx_text(bytes);
    }

    if ext == "xlsx" || mime_type.contains("spreadsheetml") {
        return crate::commands::items::extract_xlsx_text(bytes);
    }

    let is_text_type = matches!(
        ext,
        "txt" | "md" | "markdown" | "json" | "csv" | "tsv" | "xml" | "yaml" | "yml"
            | "log" | "sql" | "html" | "css" | "scss" | "js" | "jsx" | "ts" | "tsx"
            | "py" | "rs" | "go" | "c" | "cpp" | "h" | "hpp" | "java" | "sh" | "bat"
            | "ps1" | "env" | "ini" | "conf" | "properties" | "toml" | "diff" | "patch"
    ) || mime_type.starts_with("text/") || mime_type.contains("json") || mime_type.contains("xml") || mime_type.contains("javascript");

    if is_text_type && bytes.len() <= 10 * 1024 * 1024 {
        let s = String::from_utf8_lossy(bytes);
        return Some(s.chars().take(80_000).collect());
    }

    if ext == "pdf" || mime_type == "application/pdf" {
        return extract_pdf_heuristic(bytes);
    }

    None
}

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

#[derive(Debug, Clone, Default)]
pub struct ContextFetchResult {
    pub items: Vec<(String, String)>,
    pub images: Vec<ExtractedImage>,
}

pub fn is_image_file_type(mime: &str, ext: &str) -> bool {
    mime.starts_with("image/")
        || matches!(
            ext,
            "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "svg"
        )
}

pub fn normalize_image_mime(mime: &str, ext: &str) -> String {
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

pub fn extract_image_base64(
    data_url: Option<&str>,
    storage: &StorageManager,
    file_path: &str,
) -> Option<String> {
    if let Some(data) = data_url {
        let trimmed = data.trim();
        if trimmed.starts_with("data:image/") {
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

    if !file_path.is_empty() {
        if let Ok(resolved) = storage.resolve_attachment_path(file_path) {
            if let Ok(bytes) = std::fs::read(&resolved) {
                if bytes.len() <= 20 * 1024 * 1024 {
                    return Some(base64::engine::general_purpose::STANDARD.encode(&bytes));
                }
            }
        }
    }

    None
}

pub fn fetch_item_contexts(
    db: &Database,
    storage: &StorageManager,
    item_ids: &[String],
) -> Result<ContextFetchResult, String> {
    let conn = db.read_pool.get().map_err(|e| e.to_string())?;
    let mut result = ContextFetchResult::default();

    for id in item_ids {
        let row_opt = conn
            .query_row(
                "SELECT title, content, type FROM items WHERE id = ?1 AND deleted_at IS NULL",
                [id],
                |row| {
                    Ok((
                        row.get::<_, String>(0).unwrap_or_default(),
                        row.get::<_, String>(1).unwrap_or_default(),
                        row.get::<_, String>(2).unwrap_or_default(),
                    ))
                },
            )
            .ok();

        if let Some((title, mut content, _item_type)) = row_opt {
            let mut attached_texts = Vec::new();
            let mut item_images = Vec::new();

            if let Ok(mut stmt) = conn.prepare(
                "SELECT file_name, file_path, mime_type, file_size, data_url FROM attachments WHERE item_id = ?1",
            ) {
                if let Ok(att_rows) = stmt.query_map([id], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, Option<String>>(4).ok().flatten(),
                    ))
                }) {
                    for att_res in att_rows.flatten() {
                        let (file_name, file_path, mime_type, _file_size, data_url) = att_res;
                        let ext = std::path::Path::new(&file_name)
                            .extension()
                            .and_then(|e| e.to_str())
                            .unwrap_or("")
                            .to_lowercase();

                        if is_image_file_type(&mime_type, &ext) {
                            if let Some(b64) =
                                extract_image_base64(data_url.as_deref(), storage, &file_path)
                            {
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
                        } else if let Ok(resolved_path) = storage.resolve_attachment_path(&file_path) {
                            if let Ok(bytes) = std::fs::read(&resolved_path) {
                                if let Some(extracted) =
                                    extract_text_from_file_bytes(&bytes, &ext, &mime_type)
                                {
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
        }
    }

    Ok(result)
}

fn build_context_prompt(items: &[(String, String)]) -> String {
    let mut prompt = String::from("Context source items:\n\n");
    for (title, content) in items {
        prompt.push_str(&format!("--- ITEM: {} ---\n{}\n---\n\n", title, content));
    }
    prompt
}

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
                // Ignore other unescaped control chars
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
    out
}

pub fn parse_recipe_output(raw_response: &str) -> Result<RecipeOutput, String> {
    let cleaned = raw_response.trim();

    let json_candidate = if let Some(start) = cleaned.find("```json") {
        let after_fence = &cleaned[start + 7..];
        if let Some(end) = after_fence.find("```") {
            after_fence[..end].trim()
        } else {
            after_fence.trim()
        }
    } else if let Some(start) = cleaned.find('{') {
        if let Some(end) = cleaned.rfind('}') {
            &cleaned[start..=end]
        } else {
            cleaned
        }
    } else {
        cleaned
    };

    if let Ok(output) = serde_json::from_str::<RecipeOutput>(json_candidate) {
        return Ok(output);
    }

    let sanitized = sanitize_json_control_chars(json_candidate);
    if let Ok(output) = serde_json::from_str::<RecipeOutput>(&sanitized) {
        return Ok(output);
    }

    if let Ok(val) = serde_json::from_str::<Value>(&sanitized) {
        let summary = val.get("summary").and_then(|v| v.as_str()).map(|s| s.to_string());
        let tags: Vec<String> = val
            .get("tags")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| item.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        let extracted_tasks: Vec<crate::ai::ExtractedTaskPayload> = val
            .get("extracted_tasks")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|t| {
                        let title = t.get("title").and_then(|s| s.as_str())?.to_string();
                        let priority = t
                            .get("priority")
                            .and_then(|s| s.as_str())
                            .unwrap_or("medium")
                            .to_string();
                        let due_date = t.get("due_date").and_then(|s| s.as_str()).map(|s| s.to_string());
                        Some(crate::ai::ExtractedTaskPayload {
                            title,
                            priority,
                            due_date,
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        let markdown_content = val
            .get("markdown_content")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        return Ok(RecipeOutput {
            summary,
            tags,
            extracted_tasks,
            markdown_content,
        });
    }

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

    let db = app.state::<Database>();
    let storage = app.state::<StorageManager>();
    let context_data = fetch_item_contexts(&db, &storage, &item_ids)?;

    if context_data.items.is_empty() && context_data.images.is_empty() {
        return Err("No valid items found for the provided IDs".to_string());
    }

    let system_prompt = build_recipe_system_prompt(&recipe, &custom_prompt);
    let user_prompt = build_context_prompt(&context_data.items);

    let client = app.state::<reqwest::Client>().inner();
    let ai_state = app.state::<crate::ai::state::AiState>();
    let mut resolved_config = provider_config;

    if let LlmProviderConfig::OpenAiCompatible {
        ref base_url,
        ref mut api_key,
        ..
    } = resolved_config
    {
        if api_key.trim().is_empty() {
            let provider_id = if base_url.contains("anthropic") {
                "anthropic"
            } else if base_url.contains("openai") {
                "openai"
            } else if base_url.contains("openrouter") {
                "openrouter"
            } else if base_url.contains("gemini") || base_url.contains("generativelanguage") {
                "gemini"
            } else {
                "custom"
            };
            if let Some(key) = ai_state.get_api_key(provider_id) {
                *api_key = key;
            }
        }
    }

    let provider = resolve_provider(&resolved_config);

    if provider.is_cloud() {
        check_rate_limit(provider.id())?;
    }

    let token_in = estimate_tokens(&system_prompt) + estimate_tokens(&user_prompt);

    let raw_response = provider
        .completion(client, &system_prompt, &user_prompt, &context_data.images)
        .await?;

    if provider.is_cloud() {
        let token_out = estimate_tokens(&raw_response);
        let _ = record_ai_usage(&db, provider.id(), provider.model(), token_in, token_out);
    }

    parse_recipe_output(&raw_response)
}

#[tauri::command]
pub async fn apply_recipe_artifacts(
    app: tauri::AppHandle,
    target_item_id: Option<String>,
    output: RecipeOutput,
) -> Result<(), String> {
    if output.extracted_tasks.len() > 100 {
        return Err("Too many extracted tasks (max 100)".to_string());
    }
    if output.tags.len() > 50 {
        return Err("Too many tags (max 50)".to_string());
    }

    tokio::task::spawn_blocking(move || {
        let db = app.state::<Database>();
        let mut conn = db.write_conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();

        let tx = conn.transaction().map_err(|e| e.to_string())?;

        let mut applied_tag_ids: Vec<String> = Vec::new();
        for tag_name in &output.tags {
            let clean_name = tag_name.trim();
            if clean_name.is_empty() || clean_name.len() > 50 {
                continue;
            }

            let existing_id: Option<String> = tx
                .query_row(
                    "SELECT id FROM tags WHERE LOWER(name) = LOWER(?1)",
                    [clean_name],
                    |row| row.get(0),
                )
                .ok();

            let tag_id = match existing_id {
                Some(id) => id,
                None => {
                    let new_id = uuid::Uuid::new_v4().to_string();
                    let _ = tx.execute(
                        "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, '#3b82f6', ?3)",
                        rusqlite::params![new_id, clean_name, now],
                    );
                    new_id
                }
            };

            if !applied_tag_ids.contains(&tag_id) {
                applied_tag_ids.push(tag_id);
            }
        }

        if let Some(target_id) = &target_item_id {
            for tag_id in &applied_tag_ids {
                let _ = tx.execute(
                    "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
                    rusqlite::params![target_id, tag_id],
                );
            }

            if let Some(summary) = &output.summary {
                let _ = tx.execute(
                    "INSERT OR REPLACE INTO ai_metadata (id, item_id, provider, model, summary, classification, confidence, suggested_tags, processed_at) \
                     VALUES (?1, ?2, 'velco-forge', 'recipe', ?3, 'summary', 1.0, ?4, ?5)",
                    rusqlite::params![
                        uuid::Uuid::new_v4().to_string(),
                        target_id,
                        summary,
                        serde_json::to_string(&output.tags).unwrap_or_default(),
                        now
                    ],
                );
            }
        }

        for task_payload in &output.extracted_tasks {
            let task_title = task_payload.title.trim();
            if task_title.is_empty() {
                continue;
            }

            let item_id = uuid::Uuid::new_v4().to_string();
            let safe_title: String = task_title.chars().take(500).collect();

            let _ = tx.execute(
                "INSERT INTO items (id, type, title, content, source, status, favorite, archived, created_at, updated_at, deleted_at) \
                 VALUES (?1, 'task', ?2, '', 'ai_extraction', 'inbox', 0, 0, ?3, ?3, NULL)",
                rusqlite::params![item_id, safe_title, now],
            );

            let priority = match task_payload.priority.as_str() {
                "low" | "medium" | "high" => task_payload.priority.clone(),
                _ => "medium".to_string(),
            };

            let _ = tx.execute(
                "INSERT INTO tasks (id, item_id, due_date, priority, completed, completed_at) \
                 VALUES (?1, ?2, ?3, ?4, 0, NULL)",
                rusqlite::params![
                    uuid::Uuid::new_v4().to_string(),
                    item_id,
                    task_payload.due_date,
                    priority
                ],
            );

            for tag_id in &applied_tag_ids {
                let _ = tx.execute(
                    "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
                    rusqlite::params![item_id, tag_id],
                );
            }
        }

        tx.commit().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task execution failed: {}", e))?
}

// ── Active Chat Request Registry for Cancellation ───────────

static ACTIVE_CHATS: LazyLock<Mutex<HashMap<String, CancellationToken>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn register_chat_token(request_id: &str) -> CancellationToken {
    let token = CancellationToken::new();
    let mut map = ACTIVE_CHATS.lock();
    map.insert(request_id.to_string(), token.clone());
    token
}

fn unregister_chat_token(request_id: &str) {
    let mut map = ACTIVE_CHATS.lock();
    map.remove(request_id);
}

#[tauri::command]
pub fn cancel_chat(request_id: String) -> Result<(), String> {
    let map = ACTIVE_CHATS.lock();
    if let Some(token) = map.get(&request_id) {
        token.cancel();
        Ok(())
    } else {
        Err(format!("No active chat found with request_id {}", request_id))
    }
}

#[tauri::command]
pub async fn execute_context_chat(
    app: tauri::AppHandle,
    request_id: String,
    messages: Vec<ChatMessagePayload>,
    item_ids: Vec<String>,
    provider_config: LlmProviderConfig,
) -> Result<String, String> {
    let db = app.state::<Database>();
    let storage = app.state::<StorageManager>();
    let context_data = if !item_ids.is_empty() {
        fetch_item_contexts(&db, &storage, &item_ids).unwrap_or_default()
    } else {
        ContextFetchResult::default()
    };

    let mut system_prompt = String::from(
        "You are Velco Assistant, an intelligent, context-aware companion inside Velco Context Workstation.\n\
         Your mission is to help the user understand, cross-reference, analyze, and synthesize their stored knowledge.\n",
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

    let client = app.state::<reqwest::Client>().inner();
    let ai_state = app.state::<crate::ai::state::AiState>();
    let mut resolved_config = provider_config;

    if let LlmProviderConfig::OpenAiCompatible {
        ref base_url,
        ref mut api_key,
        ..
    } = resolved_config
    {
        if api_key.trim().is_empty() {
            let provider_id = if base_url.contains("anthropic") {
                "anthropic"
            } else if base_url.contains("openai") {
                "openai"
            } else if base_url.contains("openrouter") {
                "openrouter"
            } else if base_url.contains("gemini") || base_url.contains("generativelanguage") {
                "gemini"
            } else {
                "custom"
            };
            if let Some(key) = ai_state.get_api_key(provider_id) {
                *api_key = key;
            }
        }
    }

    let provider = resolve_provider(&resolved_config);

    if provider.is_cloud() {
        check_rate_limit(provider.id())?;
    }

    let cancel_token = register_chat_token(&request_id);

    let token_in = estimate_tokens(&system_prompt)
        + messages
            .iter()
            .map(|m| estimate_tokens(&m.content))
            .sum::<usize>();

    let res = provider
        .stream_chat(
            client,
            &system_prompt,
            &messages,
            &context_data.images,
            &app,
            &request_id,
            &cancel_token,
        )
        .await;

    unregister_chat_token(&request_id);

    if let Ok(ref full_text) = res {
        if provider.is_cloud() {
            let token_out = estimate_tokens(full_text);
            let _ = record_ai_usage(&db, provider.id(), provider.model(), token_in, token_out);
        }
    }

    res
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_image_type_detection_and_normalization() {
        assert!(is_image_file_type("image/png", "png"));
        assert!(is_image_file_type("application/octet-stream", "jpg"));
        assert!(!is_image_file_type("application/pdf", "pdf"));

        assert_eq!(normalize_image_mime("application/octet-stream", "png"), "image/png");
        assert_eq!(normalize_image_mime("application/octet-stream", "webp"), "image/webp");
    }

    #[test]
    fn test_extract_image_base64_from_data_url() {
        let storage = StorageManager::new(None);
        let data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        let b64 = extract_image_base64(Some(data_url), &storage, "");
        assert!(b64.is_some());
        assert_eq!(
            b64.unwrap(),
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        );
    }

    #[test]
    fn test_parse_recipe_output_markdown_fence() {
        let raw = "```json\n{\n  \"summary\": \"Test summary\",\n  \"tags\": [\"alpha\", \"beta\"],\n  \"extracted_tasks\": [],\n  \"markdown_content\": \"# Markdown Content\"\n}\n```";
        let output = parse_recipe_output(raw).expect("parsing failed");
        assert_eq!(output.summary.as_deref(), Some("Test summary"));
        assert_eq!(output.tags, vec!["alpha", "beta"]);
        assert_eq!(output.markdown_content.as_deref(), Some("# Markdown Content"));
    }
}
