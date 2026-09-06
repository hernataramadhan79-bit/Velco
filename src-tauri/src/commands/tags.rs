use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::database::Database;

#[derive(Debug, Serialize, Deserialize)]
pub struct TagRecord {
    pub id: String,
    pub name: String,
    pub color: String,
    pub created_at: String,
}

#[tauri::command]
pub fn get_tags(db: State<'_, Database>) -> Result<Vec<TagRecord>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, color, created_at FROM tags ORDER BY name ASC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(TagRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tags = Vec::new();
    for t in rows {
        tags.push(t.map_err(|e| e.to_string())?);
    }
    Ok(tags)
}

#[tauri::command]
pub fn create_tag(db: State<'_, Database>, name: String, color: String) -> Result<TagRecord, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Tag name cannot be empty".to_string());
    }

    // Return existing tag if name already exists (case-insensitive)
    let existing: Result<TagRecord, rusqlite::Error> = conn.query_row(
        "SELECT id, name, color, created_at FROM tags WHERE LOWER(name) = LOWER(?1)",
        params![trimmed_name],
        |row| {
            Ok(TagRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
            })
        },
    );

    if let Ok(tag) = existing {
        return Ok(tag);
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, trimmed_name, color, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(TagRecord {
        id,
        name: trimmed_name.to_string(),
        color,
        created_at: now,
    })
}

#[tauri::command]
pub fn assign_tag(db: State<'_, Database>, item_id: String, tag_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
        params![item_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_tag(db: State<'_, Database>, item_id: String, tag_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM item_tags WHERE item_id = ?1 AND tag_id = ?2",
        params![item_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_tag(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM item_tags WHERE tag_id = ?1", params![id]).ok();
    conn.execute("DELETE FROM tags WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
