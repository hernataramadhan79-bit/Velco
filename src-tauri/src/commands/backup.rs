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

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportBackupResult {
    pub imported: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

#[tauri::command]
pub fn import_backup(
    db: State<'_, Database>,
    json_data: String,
) -> Result<ImportBackupResult, String> {
    // Batasi ukuran backup 200MB agar tidak OOM
    if json_data.len() > 200 * 1024 * 1024 {
        return Err("Backup too large (max 200MB)".to_string());
    }
    let payload: FullBackupPayload =
        serde_json::from_str(&json_data).map_err(|e| format!("Invalid backup JSON: {}", e))?;
    if payload.items.len() > 20_000 {
        return Err("Backup contains too many items (max 20000)".to_string());
    }

    let mut conn = db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut errors: Vec<String> = Vec::new();

    for tag in &payload.tags {
        if let Err(e) = tx.execute(
            "INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![tag.id, tag.name, tag.color, tag.created_at],
        ) {
            errors.push(format!("tag {}: {}", tag.id, e));
        }
    }

    let mut imported = 0usize;
    let mut failed = 0usize;
    for item in &payload.items {
        // pinned disamakan dengan favorite (konsisten dengan update_item yang sync keduanya).
        // trashed tidak disimpan terpisah — trash direpresentasikan via deleted_at.
        let res: Result<(), rusqlite::Error> = (|| {
            tx.execute(
                r#"
                INSERT OR REPLACE INTO items (id, type, title, content, source, status, favorite, pinned, archived, created_at, updated_at, deleted_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8, ?9, ?10, ?11)
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
            )?;

            // Restore task
            if let Some(task) = &item.task {
                let task_id = uuid::Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT OR REPLACE INTO tasks (id, item_id, due_date, priority, completed, completed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        task_id,
                        item.id,
                        task.due_date,
                        task.priority,
                        if task.completed { 1 } else { 0 },
                        task.completed_at
                    ],
                )?;
            }

            // Restore link
            if let Some(link) = &item.link {
                let link_id = uuid::Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT OR REPLACE INTO links (id, item_id, url, domain, page_title, preview_image) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        link_id,
                        item.id,
                        link.url,
                        link.domain,
                        link.page_title,
                        link.preview_image
                    ],
                )?;
            }

            // Restore attachments (sanitasi nama file)
            for att in &item.attachments {
                let safe_name =
                    crate::filesystem::StorageManager::sanitize_file_name(&att.file_name);
                tx.execute(
                    "INSERT OR REPLACE INTO attachments (id, item_id, file_name, file_path, mime_type, file_size, checksum, created_at, data_url) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        att.id,
                        item.id,
                        safe_name,
                        att.file_path,
                        att.mime_type,
                        att.file_size,
                        att.checksum,
                        att.created_at,
                        att.data_url
                    ],
                )?;
            }

            // Restore item tags
            for tag in &item.tags {
                tx.execute(
                    "INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
                    params![tag.id, tag.name, tag.color, item.created_at],
                )?;
                tx.execute(
                    "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
                    params![item.id, tag.id],
                )?;
            }

            // Restore AI metadata
            if let Some(ai) = &item.ai_metadata {
                let suggested_json =
                    ai.suggested_tags.as_ref().map(|v| serde_json::to_string(v).unwrap_or_default());
                tx.execute(
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
                )?;
            }

            // NOTE: FTS dijaga trigger items_ai/ad/au — tidak perlu DELETE+INSERT manual.
            // Baris ini sengaja dihapus untuk mencegah duplikat index.
            Ok(())
        })();
        match res {
            Ok(_) => imported += 1,
            Err(e) => {
                failed += 1;
                errors.push(format!("item {}: {}", item.id, e));
                if errors.len() > 100 {
                    errors.push("... truncated, too many errors".to_string());
                    break;
                }
            }
        }
    }

    // Jika semua item gagal dan ada item, rollback agar tidak setengah jalan tanpa jejak.
    if !payload.items.is_empty() && imported == 0 {
        let _ = tx.rollback();
        return Err(format!(
            "Import failed for all {} items. First error: {}",
            payload.items.len(),
            errors.first().cloned().unwrap_or_default()
        ));
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(ImportBackupResult {
        imported,
        failed,
        errors,
    })
}
