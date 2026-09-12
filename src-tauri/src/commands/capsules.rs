use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};

use crate::commands::items::ItemSummary;
use crate::database::Database;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CapsuleRecord {
    pub id: String,
    pub name: String,
    pub description: String,
    pub role: String,
    pub encryption_key: String,
    pub created_at: String,
    pub updated_at: String,
    pub item_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CapsuleExportItem {
    pub id: String,
    pub r#type: String,
    pub title: String,
    pub content: String,
    pub excerpt: String,
    pub pinned: bool,
    pub archived: bool,
    pub trashed: bool,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<crate::commands::items::TagMinimal>,
    pub priority: Option<String>,
    pub due_date: Option<String>,
    pub completed: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CapsuleExportBundle {
    pub capsule: CapsuleRecord,
    pub items: Vec<CapsuleExportItem>,
    pub exported_at: String,
    pub version: String,
}

#[derive(Debug, Deserialize)]
pub struct ImportBundleInput {
    pub capsule: CapsuleRecord,
    #[serde(default)]
    pub items: Vec<ImportItemPayload>,
}

#[derive(Debug, Deserialize)]
pub struct ImportItemPayload {
    pub id: Option<String>,
    pub r#type: String,
    pub title: String,
    pub content: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub completed: Option<bool>,
}

fn map_capsule_row(row: &rusqlite::Row) -> rusqlite::Result<CapsuleRecord> {
    Ok(CapsuleRecord {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        role: row.get(3)?,
        encryption_key: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
        item_count: row.get(7).unwrap_or(0),
    })
}

#[tauri::command]
pub fn get_capsules(db: State<'_, Database>) -> Result<Vec<CapsuleRecord>, String> {
    let conn = db.read_pool.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            r#"
            SELECT c.id, c.name, c.description, c.role, c.encryption_key, c.created_at, c.updated_at,
                   (SELECT COUNT(*) FROM capsule_items ci 
                    JOIN items i ON ci.item_id = i.id 
                    WHERE ci.capsule_id = c.id AND i.deleted_at IS NULL) as item_count
            FROM capsules c
            ORDER BY c.updated_at DESC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], map_capsule_row)
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn create_capsule(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    name: String,
    description: Option<String>,
    role: Option<String>,
    encryption_key: Option<String>,
) -> Result<CapsuleRecord, String> {
    let conn = db.write_conn.lock().map_err(|e| e.to_string())?;
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("Capsule name cannot be empty".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    let desc = description.unwrap_or_default().trim().to_string();
    let cap_role = role.unwrap_or_else(|| "Host".to_string());
    let key = encryption_key.unwrap_or_else(|| {
        format!("vctx_live_{}", &uuid::Uuid::new_v4().to_string().replace('-', "")[..16])
    });
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        r#"
        INSERT INTO capsules (id, name, description, role, encryption_key, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
        params![id, trimmed_name, desc, cap_role, key, now, now],
    )
    .map_err(|e| e.to_string())?;

    let _ = app.emit("velco://capsules-changed", ());

    Ok(CapsuleRecord {
        id,
        name: trimmed_name.to_string(),
        description: desc,
        role: cap_role,
        encryption_key: key,
        created_at: now.clone(),
        updated_at: now,
        item_count: 0,
    })
}

#[tauri::command]
pub fn update_capsule(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    id: String,
    name: Option<String>,
    description: Option<String>,
) -> Result<CapsuleRecord, String> {
    let conn = db.write_conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    if let Some(ref n) = name {
        if n.trim().is_empty() {
            return Err("Capsule name cannot be empty".to_string());
        }
    }

    let mut updates = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(n) = name {
        updates.push(format!("name = ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(n.trim().to_string()));
    }
    if let Some(d) = description {
        updates.push(format!("description = ?{}", params_vec.len() + 1));
        params_vec.push(Box::new(d.trim().to_string()));
    }

    if updates.is_empty() {
        return Err("No updates provided".to_string());
    }

    updates.push(format!("updated_at = ?{}", params_vec.len() + 1));
    params_vec.push(Box::new(now));

    let where_param_idx = params_vec.len() + 1;
    params_vec.push(Box::new(id.clone()));

    let sql = format!(
        "UPDATE capsules SET {} WHERE id = ?{}",
        updates.join(", "),
        where_param_idx
    );

    let params_slice: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_slice.as_slice()).map_err(|e| e.to_string())?;

    let record = conn.query_row(
        r#"
        SELECT c.id, c.name, c.description, c.role, c.encryption_key, c.created_at, c.updated_at,
               (SELECT COUNT(*) FROM capsule_items ci 
                JOIN items i ON ci.item_id = i.id 
                WHERE ci.capsule_id = c.id AND i.deleted_at IS NULL) as item_count
        FROM capsules c WHERE c.id = ?1
        "#,
        params![id],
        map_capsule_row,
    ).map_err(|e| e.to_string())?;

    let _ = app.emit("velco://capsules-changed", ());

    Ok(record)
}

#[tauri::command]
pub fn delete_capsule(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    id: String,
) -> Result<(), String> {
    let conn = db.write_conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM capsule_items WHERE capsule_id = ?1", params![id]).ok();
    conn.execute("DELETE FROM capsules WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    let _ = app.emit("velco://capsules-changed", ());
    Ok(())
}

#[tauri::command]
pub fn add_item_to_capsule(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    capsule_id: String,
    item_id: String,
) -> Result<(), String> {
    let conn = db.write_conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        r#"
        INSERT OR IGNORE INTO capsule_items (capsule_id, item_id, added_at)
        VALUES (?1, ?2, ?3)
        "#,
        params![capsule_id, item_id, now],
    )
    .map_err(|e| e.to_string())?;

    let _ = conn.execute(
        "UPDATE capsules SET updated_at = ?1 WHERE id = ?2",
        params![now, capsule_id],
    );

    let _ = app.emit("velco://capsules-changed", ());
    Ok(())
}

#[tauri::command]
pub fn remove_item_from_capsule(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    capsule_id: String,
    item_id: String,
) -> Result<(), String> {
    let conn = db.write_conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "DELETE FROM capsule_items WHERE capsule_id = ?1 AND item_id = ?2",
        params![capsule_id, item_id],
    )
    .map_err(|e| e.to_string())?;

    let _ = conn.execute(
        "UPDATE capsules SET updated_at = ?1 WHERE id = ?2",
        params![now, capsule_id],
    );

    let _ = app.emit("velco://capsules-changed", ());
    Ok(())
}

#[tauri::command]
pub fn get_capsule_items(
    db: State<'_, Database>,
    capsule_id: String,
) -> Result<Vec<ItemSummary>, String> {
    let conn = db.read_pool.get().map_err(|e| e.to_string())?;

    let sql = r#"
        SELECT
            i.id,
            COALESCE(CASE WHEN i.type = 'text' THEN 'note' ELSE i.type END, 'note'),
            COALESCE(i.title, ''),
            COALESCE(SUBSTR(i.content, 1, 120), '') as excerpt,
            CASE WHEN (i.pinned = 1 OR i.favorite = 1) THEN 1 ELSE 0 END as pinned,
            COALESCE(i.archived, 0) as archived,
            CASE WHEN i.deleted_at IS NOT NULL THEN 1 ELSE 0 END as trashed,
            COALESCE(i.created_at, '') as created_at,
            COALESCE(i.updated_at, '') as updated_at,
            COALESCE(
                (
                    SELECT json_group_array(
                        json_object('id', t.id, 'name', t.name, 'color', t.color)
                    )
                    FROM tags t
                    JOIN item_tags it ON t.id = it.tag_id
                    WHERE it.item_id = i.id
                ),
                '[]'
            ) as tags_json,
            (
                SELECT json_object('due_date', tk.due_date, 'priority', tk.priority, 'completed', CASE WHEN tk.completed = 1 THEN json('true') ELSE json('false') END, 'completed_at', tk.completed_at)
                FROM tasks tk WHERE tk.item_id = i.id
            ) as task_json,
            (
                SELECT json_object('url', lk.url, 'domain', lk.domain, 'page_title', lk.page_title, 'preview_image', lk.preview_image)
                FROM links lk WHERE lk.item_id = i.id
            ) as link_json,
            (
                SELECT COUNT(*) FROM attachments att WHERE att.item_id = i.id
            ) as attachments_count,
            COALESCE(
                (
                    SELECT att.data_url FROM attachments att 
                    WHERE att.item_id = i.id 
                      AND (
                          att.mime_type LIKE 'image/%' 
                          OR att.file_name LIKE '%.png' 
                          OR att.file_name LIKE '%.jpg' 
                          OR att.file_name LIKE '%.jpeg' 
                          OR att.file_name LIKE '%.webp' 
                          OR att.file_name LIKE '%.gif'
                          OR att.file_name LIKE '%.svg'
                          OR att.file_name LIKE '%.bmp'
                      )
                      AND att.data_url IS NOT NULL 
                      AND att.data_url != ''
                    LIMIT 1
                ),
                (SELECT lk.preview_image FROM links lk WHERE lk.item_id = i.id)
            ) as thumbnail_url
        FROM items i
        JOIN capsule_items ci ON ci.item_id = i.id
        WHERE ci.capsule_id = ?1 AND i.deleted_at IS NULL
        ORDER BY i.updated_at DESC, i.created_at DESC
    "#;

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![capsule_id], |row| {
            let pinned_val: i64 = row.get(4)?;
            let archived_val: i64 = row.get(5)?;
            let trashed_val: i64 = row.get(6)?;
            let tags_json: String = row.get(9).unwrap_or_else(|_| "[]".to_string());
            let task_json: Option<String> = row.get(10).ok();
            let link_json: Option<String> = row.get(11).ok();
            let attachments_count: i64 = row.get(12).unwrap_or(0);
            let thumbnail_url: Option<String> = row.get(13).ok();

            let tags: Vec<crate::commands::items::TagMinimal> =
                serde_json::from_str(&tags_json).unwrap_or_default();
            let task: Option<crate::commands::items::TaskSubRecord> = task_json
                .and_then(|j| serde_json::from_str(&j).ok());
            let link: Option<crate::commands::items::LinkSubRecord> = link_json
                .and_then(|j| serde_json::from_str(&j).ok());

            Ok(ItemSummary {
                id: row.get(0)?,
                r#type: row.get(1)?,
                title: row.get(2)?,
                excerpt: row.get(3)?,
                pinned: pinned_val != 0,
                archived: archived_val != 0,
                trashed: trashed_val != 0,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                tags,
                task,
                link,
                attachments_count,
                thumbnail_url,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn export_capsule(
    db: State<'_, Database>,
    capsule_id: String,
) -> Result<CapsuleExportBundle, String> {
    let conn = db.read_pool.get().map_err(|e| e.to_string())?;
    let capsule = conn.query_row(
        r#"
        SELECT c.id, c.name, c.description, c.role, c.encryption_key, c.created_at, c.updated_at,
               (SELECT COUNT(*) FROM capsule_items ci 
                JOIN items i ON ci.item_id = i.id 
                WHERE ci.capsule_id = c.id AND i.deleted_at IS NULL) as item_count
        FROM capsules c WHERE c.id = ?1
        "#,
        params![capsule_id],
        map_capsule_row,
    ).map_err(|e| e.to_string())?;

    let sql = r#"
        SELECT
            i.id,
            COALESCE(CASE WHEN i.type = 'text' THEN 'note' ELSE i.type END, 'note') as item_type,
            COALESCE(i.title, '') as title,
            COALESCE(i.content, '') as content,
            COALESCE(SUBSTR(i.content, 1, 120), '') as excerpt,
            CASE WHEN (i.pinned = 1 OR i.favorite = 1) THEN 1 ELSE 0 END as pinned,
            COALESCE(i.archived, 0) as archived,
            CASE WHEN i.deleted_at IS NOT NULL THEN 1 ELSE 0 END as trashed,
            COALESCE(i.created_at, '') as created_at,
            COALESCE(i.updated_at, '') as updated_at,
            COALESCE(
                (
                    SELECT json_group_array(
                        json_object('id', t.id, 'name', t.name, 'color', t.color)
                    )
                    FROM tags t
                    JOIN item_tags it ON t.id = it.tag_id
                    WHERE it.item_id = i.id
                ),
                '[]'
            ) as tags_json,
            tk.priority,
            tk.due_date,
            tk.completed
        FROM items i
        JOIN capsule_items ci ON ci.item_id = i.id
        LEFT JOIN tasks tk ON tk.item_id = i.id
        WHERE ci.capsule_id = ?1 AND i.deleted_at IS NULL
        ORDER BY i.updated_at DESC, i.created_at DESC
    "#;

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![capsule_id], |row| {
        let pinned_val: i64 = row.get(5)?;
        let archived_val: i64 = row.get(6)?;
        let trashed_val: i64 = row.get(7)?;
        let tags_json: String = row.get(10).unwrap_or_else(|_| "[]".to_string());
        let completed_val: Option<i64> = row.get(13).ok();

        let tags: Vec<crate::commands::items::TagMinimal> =
            serde_json::from_str(&tags_json).unwrap_or_default();

        Ok(CapsuleExportItem {
            id: row.get(0)?,
            r#type: row.get(1)?,
            title: row.get(2)?,
            content: row.get(3)?,
            excerpt: row.get(4)?,
            pinned: pinned_val != 0,
            archived: archived_val != 0,
            trashed: trashed_val != 0,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
            tags,
            priority: row.get(11).ok(),
            due_date: row.get(12).ok(),
            completed: completed_val.map(|v| v != 0),
        })
    }).map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r.map_err(|e| e.to_string())?);
    }

    Ok(CapsuleExportBundle {
        capsule,
        items,
        exported_at: chrono::Utc::now().to_rfc3339(),
        version: "1.0.0".to_string(),
    })
}

#[tauri::command]
pub fn import_capsule(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    bundle_json: String,
) -> Result<CapsuleRecord, String> {
    let bundle: ImportBundleInput = serde_json::from_str(&bundle_json)
        .map_err(|e| format!("Invalid bundle format: {}", e))?;

    let conn = db.write_conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    let cap_id = uuid::Uuid::new_v4().to_string();
    let name = format!("{} (Imported)", bundle.capsule.name.trim());
    let desc = bundle.capsule.description;
    let role = "Member".to_string();
    let key = if bundle.capsule.encryption_key.is_empty() {
        format!("vctx_live_{}", &uuid::Uuid::new_v4().to_string().replace('-', "")[..16])
    } else {
        bundle.capsule.encryption_key
    };

    conn.execute(
        r#"
        INSERT INTO capsules (id, name, description, role, encryption_key, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "#,
        params![cap_id, name, desc, role, key, now, now],
    ).map_err(|e| e.to_string())?;

    for item in bundle.items {
        let item_id = item.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let item_type = if item.r#type == "text" { "note" } else { &item.r#type };
        let content = item.content.unwrap_or_default();

        let _ = conn.execute(
            r#"
            INSERT OR IGNORE INTO items (id, type, title, content, source, status, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, 'bridge', 'inbox', ?5, ?5)
            "#,
            params![item_id, item_type, item.title, content, now],
        );

        if item_type == "task" {
            let task_id = uuid::Uuid::new_v4().to_string();
            let priority = item.priority.unwrap_or_else(|| "medium".to_string());
            let completed = if item.completed.unwrap_or(false) { 1 } else { 0 };
            let _ = conn.execute(
                r#"
                INSERT OR IGNORE INTO tasks (id, item_id, due_date, priority, completed, notified)
                VALUES (?1, ?2, ?3, ?4, ?5, 0)
                "#,
                params![task_id, item_id, item.due_date, priority, completed],
            );
        }

        let _ = conn.execute(
            r#"
            INSERT OR IGNORE INTO capsule_items (capsule_id, item_id, added_at)
            VALUES (?1, ?2, ?3)
            "#,
            params![cap_id, item_id, now],
        );
    }

    let _ = app.emit("velco://items-changed", ());
    let _ = app.emit("velco://capsules-changed", ());

    let record = conn.query_row(
        r#"
        SELECT c.id, c.name, c.description, c.role, c.encryption_key, c.created_at, c.updated_at,
               (SELECT COUNT(*) FROM capsule_items ci 
                JOIN items i ON ci.item_id = i.id 
                WHERE ci.capsule_id = c.id AND i.deleted_at IS NULL) as item_count
        FROM capsules c WHERE c.id = ?1
        "#,
        params![cap_id],
        map_capsule_row,
    ).map_err(|e| e.to_string())?;

    Ok(record)
}
