use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::items::ItemRecord;
use crate::commands::tags::TagRecord;
use crate::database::Database;

#[derive(Debug, Serialize, Deserialize)]
pub struct FullBackupPayload {
    pub version: String,
    pub timestamp: String,
    pub items: Vec<ItemRecord>,
    pub tags: Vec<TagRecord>,
}

#[tauri::command]
pub fn export_backup(db: State<'_, Database>) -> Result<String, String> {
    let items = crate::commands::items::get_items(db.clone(), None, Some(true), Some(true))?;
    let tags = crate::commands::tags::get_tags(db)?;

    let payload = FullBackupPayload {
        version: "1.0.0".to_string(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        items,
        tags,
    };

    serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_backup(db: State<'_, Database>, json_data: String) -> Result<usize, String> {
    let payload: FullBackupPayload =
        serde_json::from_str(&json_data).map_err(|e| format!("Invalid backup JSON: {}", e))?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    for tag in payload.tags {
        conn.execute(
            "INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![tag.id, tag.name, tag.color, tag.created_at],
        )
        .ok();
    }

    let count = payload.items.len();
    for item in payload.items {
        conn.execute(
            r#"
            INSERT OR REPLACE INTO items (id, type, title, content, source, status, favorite, archived, created_at, updated_at, deleted_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
            params![
                item.id,
                item.r#type,
                item.title,
                item.content,
                item.source,
                item.status,
                if item.favorite { 1 } else { 0 },
                if item.archived { 1 } else { 0 },
                item.created_at,
                item.updated_at,
                item.deleted_at
            ],
        ).ok();

        // Restore task
        if let Some(task) = item.task {
            let task_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT OR REPLACE INTO tasks (id, item_id, due_date, priority, completed, completed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    task_id,
                    item.id,
                    task.due_date,
                    task.priority,
                    if task.completed { 1 } else { 0 },
                    task.completed_at
                ],
            ).ok();
        }

        // Restore link
        if let Some(link) = item.link {
            let link_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT OR REPLACE INTO links (id, item_id, url, domain, page_title, preview_image) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    link_id,
                    item.id,
                    link.url,
                    link.domain,
                    link.page_title,
                    link.preview_image
                ],
            ).ok();
        }

        // Restore attachments
        for att in item.attachments {
            conn.execute(
                "INSERT OR REPLACE INTO attachments (id, item_id, file_name, file_path, mime_type, file_size, checksum, created_at, data_url) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    att.id,
                    item.id,
                    att.file_name,
                    att.file_path,
                    att.mime_type,
                    att.file_size,
                    att.checksum,
                    att.created_at,
                    att.data_url
                ],
            ).ok();
        }

        // Restore item tags
        for tag in item.tags {
            conn.execute(
                "INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
                params![tag.id, tag.name, tag.color, item.created_at],
            ).ok();
            conn.execute(
                "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
                params![item.id, tag.id],
            ).ok();
        }

        // Restore AI metadata
        if let Some(ai) = item.ai_metadata {
            let suggested_json = ai.suggested_tags.map(|v| serde_json::to_string(&v).unwrap_or_default());
            conn.execute(
                "INSERT OR REPLACE INTO ai_metadata (id, item_id, provider, model, summary, classification, confidence, suggested_tags, processed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    ai.id,
                    item.id,
                    ai.provider,
                    ai.model,
                    ai.summary,
                    ai.classification,
                    ai.confidence,
                    suggested_json,
                    ai.processed_at
                ],
            ).ok();
        }

        // Restore FTS5 index
        conn.execute("DELETE FROM items_fts WHERE item_id = ?1", params![item.id]).ok();
        if item.deleted_at.is_none() {
            conn.execute(
                "INSERT INTO items_fts (item_id, title, content) VALUES (?1, ?2, ?3)",
                params![item.id, item.title, item.content],
            ).ok();
        }
    }

    Ok(count)
}
