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
    }

    Ok(count)
}
