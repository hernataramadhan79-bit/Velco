use tauri::{Emitter, Manager};
use crate::ai::ollama::{ConnectionTestResult, DetailedModelInfo, OllamaClient};
use crate::ai::{LlmProviderConfig, RecipeOutput};
use crate::database::Database;
use serde_json::Value;

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

/// Fetches item content from the database for the given IDs.
fn fetch_item_contexts(db: &Database, item_ids: &[String]) -> Result<Vec<(String, String)>, String> {
    let conn = db
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let mut results = Vec::new();

    for id in item_ids {
        // Try content_index first for plain_text, fall back to items.content
        let plain_text: Option<String> = conn
            .query_row(
                "SELECT plain_text FROM content_index WHERE item_id = ?1",
                [id],
                |row| row.get(0),
            )
            .ok();

        let (title, content) = conn
            .query_row(
                "SELECT title, content FROM items WHERE id = ?1 AND deleted_at IS NULL",
                [id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .map_err(|e| format!("Item {} not found: {}", id, e))?;

        let text = plain_text
            .filter(|t| !t.trim().is_empty())
            .unwrap_or(content);

        results.push((title, text));
    }

    Ok(results)
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
) -> Result<RecipeOutput, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let raw_response = match provider_config {
        LlmProviderConfig::Ollama { base_url, model } => {
            let url = format!("{}/api/generate", base_url.trim_end_matches('/'));
            let payload = serde_json::json!({
                "model": model,
                "prompt": format!("{}\n\n{}", system_prompt, user_prompt),
                "stream": false,
                "format": "json"
            });

            let resp = client
                .post(&url)
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
                serde_json::json!({
                    "model": model,
                    "system": system_prompt,
                    "messages": [
                        { "role": "user", "content": user_prompt }
                    ],
                    "max_tokens": 4096,
                    "temperature": 0.3
                })
            } else {
                serde_json::json!({
                    "model": model,
                    "messages": [
                        { "role": "system", "content": system_prompt },
                        { "role": "user", "content": user_prompt }
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
    let trimmed = raw.trim();

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

    // 1. Fetch item content from database
    let db = app.state::<Database>();
    let items = fetch_item_contexts(&db, &item_ids)?;

    if items.is_empty() {
        return Err("No valid items found for the provided IDs".to_string());
    }

    // 2. Build prompts
    let system_prompt = build_recipe_system_prompt(&recipe, &custom_prompt);
    let user_prompt = build_context_prompt(&items);

    // 3. Call the LLM
    let output = call_llm(&provider_config, &system_prompt, &user_prompt).await?;

    Ok(output)
}

/// Apply the structured artifacts from a recipe output into the database.
#[tauri::command]
pub async fn apply_recipe_artifacts(
    app: tauri::AppHandle,
    target_item_id: Option<String>,
    output: RecipeOutput,
) -> Result<(), String> {
    let db = app.state::<Database>();
    let conn = db
        .conn
        .lock()
        .map_err(|e| format!("Database lock error: {}", e))?;

    let now = chrono::Utc::now().to_rfc3339();

    // 1. Insert extracted tasks
    for task in &output.extracted_tasks {
        let item_id = uuid::Uuid::new_v4().to_string();
        let task_id = uuid::Uuid::new_v4().to_string();

        // Create the item
        conn.execute(
            "INSERT INTO items (id, type, title, content, source, status, favorite, archived, created_at, updated_at) \
             VALUES (?1, 'task', ?2, ?3, 'ai_recipe', 'inbox', 0, 0, ?4, ?4)",
            rusqlite::params![item_id, task.title, task.title, now],
        )
        .map_err(|e| format!("Failed to insert task item: {}", e))?;

        // Create the task metadata
        let priority = match task.priority.as_str() {
            "low" | "medium" | "high" => task.priority.clone(),
            _ => "medium".to_string(),
        };

        conn.execute(
            "INSERT INTO tasks (id, item_id, due_date, priority, completed, completed_at) \
             VALUES (?1, ?2, ?3, ?4, 0, NULL)",
            rusqlite::params![task_id, item_id, task.due_date, priority],
        )
        .map_err(|e| format!("Failed to insert task metadata: {}", e))?;

        // Insert FTS entry
        conn.execute(
            "INSERT INTO items_fts (item_id, title, content) VALUES (?1, ?2, ?3)",
            rusqlite::params![item_id, task.title, task.title],
        )
        .map_err(|e| format!("Failed to insert FTS entry: {}", e))?;
    }

    // 2. Process tags
    for tag_name in &output.tags {
        let trimmed = tag_name.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Upsert tag
        let tag_id: String = conn
            .query_row("SELECT id FROM tags WHERE name = ?1", [trimmed], |row| {
                row.get(0)
            })
            .unwrap_or_else(|_| {
                let new_id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, '#3b82f6', ?3)",
                    rusqlite::params![new_id, trimmed, now],
                )
                .ok();
                new_id
            });

        // Assign tag to target item if specified
        if let Some(ref target_id) = target_item_id {
            conn.execute(
                "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
                rusqlite::params![target_id, tag_id],
            )
            .ok();
        }
    }

    // 3. Handle markdown content
    if let Some(ref md) = output.markdown_content {
        if !md.trim().is_empty() {
            if let Some(ref target_id) = target_item_id {
                // Append to existing item
                let existing: String = conn
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

                conn.execute(
                    "UPDATE items SET content = ?1, updated_at = ?2 WHERE id = ?3",
                    rusqlite::params![updated, now, target_id],
                )
                .map_err(|e| format!("Failed to update item content: {}", e))?;

                // Keep FTS5 in sync
                conn.execute("DELETE FROM items_fts WHERE item_id = ?1", rusqlite::params![target_id]).ok();
                conn.execute(
                    "INSERT INTO items_fts (item_id, title, content) SELECT id, title, content FROM items WHERE id = ?1",
                    rusqlite::params![target_id],
                ).ok();
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

                conn.execute(
                    "INSERT INTO items (id, type, title, content, source, status, favorite, archived, created_at, updated_at) \
                     VALUES (?1, 'note', ?2, ?3, 'ai_recipe', 'inbox', 0, 0, ?4, ?4)",
                    rusqlite::params![note_id, title, md, now],
                )
                .map_err(|e| format!("Failed to create master note: {}", e))?;

                // Insert FTS entry
                conn.execute(
                    "INSERT INTO items_fts (item_id, title, content) VALUES (?1, ?2, ?3)",
                    rusqlite::params![note_id, title, md],
                )
                .map_err(|e| format!("Failed to insert FTS entry: {}", e))?;
            }
        }
    }

    Ok(())
}

// ============================================================================
// Context Chat Commands (Interactive Conversational Workstation)
// ============================================================================

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
    // 1. Fetch item content from SQLite
    let db = app.state::<Database>();
    let items = if !item_ids.is_empty() {
        fetch_item_contexts(&db, &item_ids).unwrap_or_default()
    } else {
        vec![]
    };

    // 2. Build system prompt grounded on the staged context
    let mut system_prompt = String::from(
        "You are Velco Assistant, an intelligent, context-aware companion inside Velco Context Workstation.\n\
         Your mission is to help the user understand, cross-reference, analyze, and synthesize their stored knowledge.\n"
    );

    if !items.is_empty() {
        system_prompt.push_str("\nThe user has assembled the following staged items into their active Context Cart:\n\n");
        for (title, content) in &items {
            system_prompt.push_str(&format!("--- CONTEXT ITEM: {} ---\n{}\n---\n\n", title, content));
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

            for msg in &messages {
                ollama_messages.push(serde_json::json!({
                    "role": msg.role,
                    "content": msg.content
                }));
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
                let anthropic_messages: Vec<serde_json::Value> = messages
                    .iter()
                    .filter(|m| m.role != "system")
                    .map(|m| {
                        serde_json::json!({
                            "role": if m.role == "assistant" { "assistant" } else { "user" },
                            "content": m.content
                        })
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

                for msg in &messages {
                    openai_messages.push(serde_json::json!({
                        "role": msg.role,
                        "content": msg.content
                    }));
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

    // Emit final completion event
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
