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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupStatus {
    pub last_backup_timestamp: Option<String>,
    pub days_since_last_backup: Option<u64>,
}

#[tauri::command]
pub fn export_backup(db: State<'_, Database>) -> Result<String, String> {
    let items = crate::commands::items::get_items(db.clone(), None, Some(true), Some(true), None, None)?;
    let tags = crate::commands::tags::get_tags(db.clone())?;

    let now = chrono::Utc::now().to_rfc3339();
    let payload = FullBackupPayload {
        version: "1.0.0".to_string(),
        timestamp: now.clone(),
        items,
        tags,
    };

    // Update last_backup_timestamp in settings table
    if let Ok(conn) = db.write_conn.lock() {
        let _ = conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_backup_timestamp', ?1)",
            params![now],
        );
    }

    serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_backup_status(db: State<'_, Database>) -> Result<BackupStatus, String> {
    let conn = db.read_pool.get().map_err(|e| e.to_string())?;
    let ts: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'last_backup_timestamp'",
            [],
            |r| r.get(0),
        )
        .ok();

    let days = ts.as_deref().and_then(|t| {
        let parsed = chrono::DateTime::parse_from_rfc3339(t).ok()?;
        let diff = chrono::Utc::now().signed_duration_since(parsed.with_timezone(&chrono::Utc));
        Some(diff.num_days().max(0) as u64)
    });

    Ok(BackupStatus {
        last_backup_timestamp: ts,
        days_since_last_backup: days,
    })
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ImportBackupResult {
    pub imported: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

/// Core import function operating directly on a connection, allowing direct unit testing.
pub fn process_import_backup_data(
    conn: &mut rusqlite::Connection,
    json_data: &str,
) -> Result<ImportBackupResult, String> {
    // Batasi ukuran backup 200MB agar tidak OOM
    if json_data.len() > 200 * 1024 * 1024 {
        return Err("Backup too large (max 200MB)".to_string());
    }
    let payload: FullBackupPayload =
        serde_json::from_str(json_data).map_err(|e| format!("Invalid backup JSON: {}", e))?;
    if payload.items.len() > 20_000 {
        return Err("Backup contains too many items (max 20000)".to_string());
    }

    let mut errors: Vec<String> = Vec::new();
    let mut imported = 0usize;
    let mut failed = 0usize;

    // Tags in single transaction
    {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        for tag in &payload.tags {
            if let Err(e) = tx.execute(
                "INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
                params![tag.id, tag.name, tag.color, tag.created_at],
            ) {
                errors.push(format!("tag {}: {}", tag.id, e));
            }
        }
        tx.commit().map_err(|e| e.to_string())?;
    }

    // Chunk items into batches of 100
    for chunk in payload.items.chunks(100) {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        for item in chunk {
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

                Ok(())
            })();

            match res {
                Ok(_) => imported += 1,
                Err(e) => {
                    failed += 1;
                    errors.push(format!("item {}: {}", item.id, e));
                }
            }
        }
        tx.commit().map_err(|e| e.to_string())?;
    }

    if !payload.items.is_empty() && imported == 0 {
        return Err(format!(
            "Import failed for all {} items. First error: {}",
            payload.items.len(),
            errors.first().cloned().unwrap_or_default()
        ));
    }

    if errors.len() > 100 {
        errors.truncate(100);
        errors.push("... truncated, too many errors".to_string());
    }

    Ok(ImportBackupResult {
        imported,
        failed,
        errors,
    })
}

#[tauri::command]
pub async fn import_backup(
    app: tauri::AppHandle,
    json_data: String,
) -> Result<ImportBackupResult, String> {
    tokio::task::spawn_blocking(move || {
        use tauri::Manager;
        let db = app.state::<Database>();
        let mut conn = db.write_conn.lock().map_err(|e| e.to_string())?;
        process_import_backup_data(&mut conn, &json_data)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::schema::run_migrations;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("failed to open in-memory db");
        run_migrations(&conn).expect("migrations failed");
        conn
    }

    #[test]
    fn test_import_malformed_json_rejected() {
        let mut conn = setup_test_db();
        let malformed = "{ invalid: json, not properly formatted";
        let res = process_import_backup_data(&mut conn, malformed);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Invalid backup JSON"));
    }

    #[test]
    fn test_import_too_many_items_rejected() {
        let mut conn = setup_test_db();
        let mut items = Vec::new();
        for i in 0..20_001 {
            items.push(ItemRecord {
                id: format!("item-{}", i),
                r#type: "note".to_string(),
                title: format!("Title {}", i),
                content: "content".to_string(),
                source: "direct".to_string(),
                status: "inbox".to_string(),
                favorite: false,
                archived: false,
                created_at: "2026-01-01T00:00:00Z".to_string(),
                updated_at: "2026-01-01T00:00:00Z".to_string(),
                deleted_at: None,
                tags: vec![],
                task: None,
                link: None,
                attachments: vec![],
                ai_metadata: None,
            });
        }
        let payload = FullBackupPayload {
            version: "1.0.0".to_string(),
            timestamp: "2026-01-01T00:00:00Z".to_string(),
            items,
            tags: vec![],
        };
        let json = serde_json::to_string(&payload).expect("serialization failed");
        let res = process_import_backup_data(&mut conn, &json);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("max 20000"));
    }

    #[test]
    fn test_import_valid_backup_success() {
        let mut conn = setup_test_db();
        let item = ItemRecord {
            id: "test-note-1".to_string(),
            r#type: "note".to_string(),
            title: "Backup Test Note".to_string(),
            content: "Testing backup import successfully".to_string(),
            source: "direct".to_string(),
            status: "inbox".to_string(),
            favorite: true,
            archived: false,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
            deleted_at: None,
            tags: vec![],
            task: None,
            link: None,
            attachments: vec![],
            ai_metadata: None,
        };
        let payload = FullBackupPayload {
            version: "1.0.0".to_string(),
            timestamp: "2026-01-01T00:00:00Z".to_string(),
            items: vec![item],
            tags: vec![],
        };
        let json = serde_json::to_string(&payload).expect("serialization failed");
        let res = process_import_backup_data(&mut conn, &json);
        assert!(res.is_ok());
        let result = res.unwrap();
        assert_eq!(result.imported, 1);
        assert_eq!(result.failed, 0);

        // Verify row exists in items table
        let title: String = conn
            .query_row("SELECT title FROM items WHERE id = 'test-note-1'", [], |r| r.get(0))
            .expect("query failed");
        assert_eq!(title, "Backup Test Note");
    }
}
