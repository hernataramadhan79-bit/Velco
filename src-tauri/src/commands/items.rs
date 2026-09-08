use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use base64::Engine;

use crate::database::Database;
use crate::filesystem::StorageManager;

/// Tag ringkas untuk list view
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagMinimal {
    pub id: String,
    pub name: String,
    pub color: String,
}

/// Item ringkas untuk list view — hanya 120 char pertama content
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ItemSummary {
    pub id: String,
    pub r#type: String,
    pub title: String,
    pub excerpt: String, // 120 char pertama content
    pub pinned: bool,
    pub archived: bool,
    pub trashed: bool,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<TagMinimal>,
    pub task: Option<TaskSubRecord>,
    pub link: Option<LinkSubRecord>,
    pub attachments_count: i64,
    pub thumbnail_url: Option<String>,
}

/// Hasil pencarian dengan snippet dan ranking BM25
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub item: ItemSummary,
    pub snippet: String,
    pub rank: f64,
}

/// Respon pratinjau konten berkas lengkap (teks, pdf, docx, gambar, audio/video)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FilePreviewContent {
    pub attachment_id: String,
    pub item_id: String,
    pub file_name: String,
    pub mime_type: String,
    pub file_size: i64,
    pub data_url: Option<String>,
    pub text_content: Option<String>,
    pub preview_type: String, // "image" | "pdf" | "text" | "code" | "markdown" | "csv" | "docx" | "xlsx" | "audio" | "video" | "unsupported"
    pub language: Option<String>,
    pub line_count: Option<usize>,
    pub char_count: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttachmentSubRecord {
    pub id: String,
    pub file_name: String,
    pub file_path: String,
    pub mime_type: String,
    pub file_size: i64,
    pub checksum: String,
    pub created_at: String,
    pub data_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagSubRecord {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskSubRecord {
    pub due_date: Option<String>,
    pub priority: String,
    pub completed: bool,
    pub completed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LinkSubRecord {
    pub url: String,
    pub domain: String,
    pub page_title: String,
    pub preview_image: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiMetadataSubRecord {
    pub id: String,
    pub item_id: String,
    pub provider: String,
    pub model: String,
    pub summary: Option<String>,
    pub classification: Option<String>,
    pub confidence: Option<f64>,
    pub suggested_tags: Option<Vec<String>>,
    pub processed_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ItemRecord {
    pub id: String,
    pub r#type: String,
    pub title: String,
    pub content: String,
    pub source: String,
    pub status: String,
    pub favorite: bool,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    pub tags: Vec<TagSubRecord>,
    pub task: Option<TaskSubRecord>,
    pub link: Option<LinkSubRecord>,
    pub attachments: Vec<AttachmentSubRecord>,
    pub ai_metadata: Option<AiMetadataSubRecord>,
}

#[derive(Debug, Deserialize)]
pub struct CreateItemPayload {
    pub id: Option<String>,
    pub r#type: String,
    pub title: String,
    pub content: Option<String>,
    pub source: Option<String>,
    pub task: Option<TaskSubRecord>,
    pub link: Option<LinkSubRecord>,
    pub attachments: Option<Vec<AttachmentSubRecord>>,
    pub tag_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateItemPayload {
    pub id: String,
    pub title: Option<String>,
    pub content: Option<String>,
    pub favorite: Option<bool>,
    pub archived: Option<bool>,
    pub status: Option<String>,
    pub task: Option<TaskSubRecord>,
    pub tag_ids: Option<Vec<String>>,
    pub ai_metadata: Option<AiMetadataSubRecord>,
}

pub fn fetch_item_by_id(conn: &rusqlite::Connection, id: &str) -> Result<ItemRecord, String> {
    let mut item = conn
        .query_row(
            "SELECT id, type, title, content, source, status, favorite, archived, created_at, updated_at, deleted_at FROM items WHERE id = ?1",
            params![id],
            |row| {
                let favorite: i64 = row.get(6)?;
                let archived: i64 = row.get(7)?;

                Ok(ItemRecord {
                    id: row.get(0)?,
                    r#type: row.get(1)?,
                    title: row.get(2)?,
                    content: row.get(3)?,
                    source: row.get(4)?,
                    status: row.get(5)?,
                    favorite: favorite != 0,
                    archived: archived != 0,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                    deleted_at: row.get(10)?,
                    tags: vec![],
                    task: None,
                    link: None,
                    attachments: vec![],
                    ai_metadata: None,
                })
            },
        )
        .map_err(|e| format!("Item {} not found: {}", id, e))?;

    // Fetch task
    if item.r#type == "task" {
        let task_res = conn.query_row(
            "SELECT due_date, priority, completed, completed_at FROM tasks WHERE item_id = ?1",
            params![item.id],
            |row| {
                let completed: i64 = row.get(2).unwrap_or(0);
                Ok(TaskSubRecord {
                    due_date: row.get(0).ok(),
                    priority: row.get(1).unwrap_or_else(|_| "medium".to_string()),
                    completed: completed != 0,
                    completed_at: row.get(3).ok(),
                })
            },
        );
        item.task = task_res.ok();
    }

    // Fetch link
    if item.r#type == "link" {
        let link_res = conn.query_row(
            "SELECT url, domain, page_title, preview_image FROM links WHERE item_id = ?1",
            params![item.id],
            |row| {
                Ok(LinkSubRecord {
                    url: row.get(0).unwrap_or_default(),
                    domain: row.get(1).unwrap_or_default(),
                    page_title: row.get(2).unwrap_or_default(),
                    preview_image: row.get(3).ok(),
                })
            },
        );
        item.link = link_res.ok();
    }

    // Fetch attachments
    if let Ok(mut att_stmt) = conn.prepare(
        "SELECT id, file_name, file_path, mime_type, file_size, checksum, created_at, data_url FROM attachments WHERE item_id = ?1"
    ) {
        if let Ok(att_rows) = att_stmt.query_map(params![item.id], |row| {
            Ok(AttachmentSubRecord {
                id: row.get(0)?,
                file_name: row.get(1)?,
                file_path: row.get(2)?,
                mime_type: row.get(3)?,
                file_size: row.get(4)?,
                checksum: row.get(5)?,
                created_at: row.get(6)?,
                data_url: row.get(7).ok(),
            })
        }) {
            item.attachments = att_rows.filter_map(|r| r.ok()).collect();
        }
    }

    // Fetch tags
    if let Ok(mut tag_stmt) = conn.prepare(
        "SELECT t.id, t.name, t.color FROM tags t JOIN item_tags it ON t.id = it.tag_id WHERE it.item_id = ?1"
    ) {
        if let Ok(tag_rows) = tag_stmt.query_map(params![item.id], |row| {
            Ok(TagSubRecord {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            })
        }) {
            item.tags = tag_rows.filter_map(|r| r.ok()).collect();
        }
    }

    // Fetch AI Metadata
    let ai_res = conn.query_row(
        "SELECT id, provider, model, summary, classification, confidence, suggested_tags, processed_at FROM ai_metadata WHERE item_id = ?1",
        params![item.id],
        |row| {
            let suggested_json: Option<String> = row.get(6).ok();
            let suggested_tags: Option<Vec<String>> = suggested_json.and_then(|s| serde_json::from_str(&s).ok());
            Ok(AiMetadataSubRecord {
                id: row.get(0)?,
                item_id: item.id.clone(),
                provider: row.get(1)?,
                model: row.get(2)?,
                summary: row.get(3).ok(),
                classification: row.get(4).ok(),
                confidence: row.get(5).ok(),
                suggested_tags,
                processed_at: row.get(7)?,
            })
        },
    );
    item.ai_metadata = ai_res.ok();

    Ok(item)
}

#[tauri::command]
pub fn get_item(db: State<'_, Database>, id: String) -> Result<ItemRecord, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    fetch_item_by_id(&conn, &id)
}

/// Ambil daftar item ringkas (ItemSummary) dengan tags via JSON aggregation — 1 round-trip
#[tauri::command]
pub fn get_items_summary(
    db: State<'_, Database>,
    filter_type: Option<String>,
    include_trash: Option<bool>,
    include_archived: Option<bool>,
) -> Result<Vec<ItemSummary>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let show_trash = include_trash.unwrap_or(false);
    let show_archived = include_archived.unwrap_or(false);

    let where_clause = if show_trash {
        "i.deleted_at IS NOT NULL".to_string()
    } else if show_archived {
        "i.deleted_at IS NULL AND i.archived = 1".to_string()
    } else {
        "i.deleted_at IS NULL AND i.archived = 0".to_string()
    };

    let type_filter = if let Some(ref t) = filter_type {
        if t == "file" || t == "files" {
            " AND (i.type = 'file' OR i.type = 'image' OR EXISTS (SELECT 1 FROM attachments a WHERE a.item_id = i.id))".to_string()
        } else {
            format!(" AND i.type = '{}'", t.replace("'", "''"))
        }
    } else {
        String::new()
    };

    let sql = format!(
        r#"
        SELECT
            i.id,
            COALESCE(i.type, 'note'),
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
                SELECT json_object('due_date', tk.due_date, 'priority', tk.priority, 'completed', tk.completed, 'completed_at', tk.completed_at)
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
                (SELECT att.data_url FROM attachments att WHERE att.item_id = i.id AND att.mime_type LIKE 'image/%' AND att.data_url IS NOT NULL LIMIT 1),
                (SELECT lk.preview_image FROM links lk WHERE lk.item_id = i.id)
            ) as thumbnail_url
        FROM items i
        WHERE {}{}
        ORDER BY i.created_at DESC
        "#,
        where_clause, type_filter
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        let pinned_val: i64 = row.get(4)?;
        let archived_val: i64 = row.get(5)?;
        let trashed_val: i64 = row.get(6)?;
        let tags_json: String = row.get(9).unwrap_or_else(|_| "[]".to_string());
        let task_json: Option<String> = row.get(10).ok();
        let link_json: Option<String> = row.get(11).ok();
        let attachments_count: i64 = row.get(12).unwrap_or(0);
        let thumbnail_url: Option<String> = row.get(13).ok();

        let tags: Vec<TagMinimal> = serde_json::from_str(&tags_json).unwrap_or_default();
        let task: Option<TaskSubRecord> = task_json.and_then(|s| serde_json::from_str(&s).ok());
        let link: Option<LinkSubRecord> = link_json.and_then(|s| serde_json::from_str(&s).ok());

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
    }).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

/// Ambil detail penuh item (full content) — dipanggil saat item diklik
#[tauri::command]
pub fn get_item_detail(db: State<'_, Database>, id: String) -> Result<ItemRecord, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    fetch_item_by_id(&conn, &id)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ItemCountsRecord {
    pub inbox: i64,
    pub tasks: i64,
    pub notes: i64,
    pub files: i64,
    pub links: i64,
    pub archive: i64,
    pub trash: i64,
}

#[tauri::command]
pub fn get_item_counts(db: State<'_, Database>) -> Result<ItemCountsRecord, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let inbox: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM items WHERE deleted_at IS NULL AND archived = 0 AND status = 'inbox'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let tasks: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM items WHERE deleted_at IS NULL AND archived = 0 AND type = 'task'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let notes: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM items WHERE deleted_at IS NULL AND archived = 0 AND type = 'note'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let files: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM items WHERE deleted_at IS NULL AND archived = 0 AND (type = 'file' OR type = 'image' OR EXISTS (SELECT 1 FROM attachments a WHERE a.item_id = items.id))",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let links: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM items WHERE deleted_at IS NULL AND archived = 0 AND type = 'link'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let archive: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM items WHERE deleted_at IS NULL AND archived = 1",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let trash: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM items WHERE deleted_at IS NOT NULL",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok(ItemCountsRecord {
        inbox,
        tasks,
        notes,
        files,
        links,
        archive,
        trash,
    })
}

#[tauri::command]
pub fn get_items(
    db: State<'_, Database>,
    filter_type: Option<String>,
    include_trash: Option<bool>,
    include_archived: Option<bool>,
) -> Result<Vec<ItemRecord>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let show_trash = include_trash.unwrap_or(false);
    let show_archived = include_archived.unwrap_or(false);
    let mut sql = "SELECT id, type, title, content, source, status, favorite, archived, created_at, updated_at, deleted_at FROM items WHERE ".to_string();

    if show_trash && show_archived {
        sql.push_str("1=1");
    } else if show_trash {
        sql.push_str("deleted_at IS NOT NULL");
    } else if show_archived {
        sql.push_str("deleted_at IS NULL AND archived = 1");
    } else {
        sql.push_str("deleted_at IS NULL AND archived = 0");
    }

    let mut query_params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref t) = filter_type {
        if t == "file" || t == "files" {
            sql.push_str(" AND (type = 'file' OR type = 'image' OR EXISTS (SELECT 1 FROM attachments a WHERE a.item_id = items.id))");
        } else {
            sql.push_str(" AND type = ?");
            query_params.push(Box::new(t.clone()));
        }
    }

    sql.push_str(" ORDER BY created_at DESC");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = query_params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            let id: String = row.get(0)?;
            let favorite: i64 = row.get(6)?;
            let archived: i64 = row.get(7)?;

            Ok(ItemRecord {
                id,
                r#type: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                source: row.get(4)?,
                status: row.get(5)?,
                favorite: favorite != 0,
                archived: archived != 0,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                deleted_at: row.get(10)?,
                tags: vec![],
                task: None,
                link: None,
                attachments: vec![],
                ai_metadata: None,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for item_res in rows {
        let mut item = item_res.map_err(|e| e.to_string())?;

        // Fetch task if task
        if item.r#type == "task" {
            let task_res = conn.query_row(
                "SELECT due_date, priority, completed, completed_at FROM tasks WHERE item_id = ?1",
                params![item.id],
                |row| {
                    let completed: i64 = row.get(2).unwrap_or(0);
                    Ok(TaskSubRecord {
                        due_date: row.get(0).ok(),
                        priority: row.get(1).unwrap_or_else(|_| "medium".to_string()),
                        completed: completed != 0,
                        completed_at: row.get(3).ok(),
                    })
                },
            );
            item.task = task_res.ok();
        }

        // Fetch link if link
        if item.r#type == "link" {
            let link_res = conn.query_row(
                "SELECT url, domain, page_title, preview_image FROM links WHERE item_id = ?1",
                params![item.id],
                |row| {
                    Ok(LinkSubRecord {
                        url: row.get(0).unwrap_or_default(),
                        domain: row.get(1).unwrap_or_default(),
                        page_title: row.get(2).unwrap_or_default(),
                        preview_image: row.get(3).ok(),
                    })
                },
            );
            item.link = link_res.ok();
        }

        // Fetch attachments
        if let Ok(mut att_stmt) = conn.prepare(
            "SELECT id, file_name, file_path, mime_type, file_size, checksum, created_at, data_url FROM attachments WHERE item_id = ?1"
        ) {
            if let Ok(att_rows) = att_stmt.query_map(params![item.id], |row| {
                Ok(AttachmentSubRecord {
                    id: row.get(0)?,
                    file_name: row.get(1)?,
                    file_path: row.get(2)?,
                    mime_type: row.get(3)?,
                    file_size: row.get(4)?,
                    checksum: row.get(5)?,
                    created_at: row.get(6)?,
                    data_url: row.get(7).ok(),
                })
            }) {
                item.attachments = att_rows.filter_map(|r| r.ok()).collect();
            }
        }

        // Fetch tags
        if let Ok(mut tag_stmt) = conn.prepare(
            "SELECT t.id, t.name, t.color FROM tags t JOIN item_tags it ON t.id = it.tag_id WHERE it.item_id = ?1"
        ) {
            if let Ok(tag_rows) = tag_stmt.query_map(params![item.id], |row| {
                Ok(TagSubRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                })
            }) {
                item.tags = tag_rows.filter_map(|r| r.ok()).collect();
            }
        }

        // Fetch AI metadata
        let ai_res = conn.query_row(
            "SELECT id, provider, model, summary, classification, confidence, suggested_tags, processed_at FROM ai_metadata WHERE item_id = ?1",
            params![item.id],
            |row| {
                let suggested_json: Option<String> = row.get(6).ok();
                let suggested_tags: Option<Vec<String>> = suggested_json.and_then(|s| serde_json::from_str(&s).ok());
                Ok(AiMetadataSubRecord {
                    id: row.get(0)?,
                    item_id: item.id.clone(),
                    provider: row.get(1)?,
                    model: row.get(2)?,
                    summary: row.get(3).ok(),
                    classification: row.get(4).ok(),
                    confidence: row.get(5).ok(),
                    suggested_tags,
                    processed_at: row.get(7)?,
                })
            },
        );
        item.ai_metadata = ai_res.ok();

        items.push(item);
    }

    Ok(items)
}

#[tauri::command]
pub fn create_item(
    db: State<'_, Database>,
    storage: State<'_, StorageManager>,
    payload: CreateItemPayload,
) -> Result<ItemRecord, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id = payload.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let now = chrono::Utc::now().to_rfc3339();
    let content = payload.content.unwrap_or_default();
    let source = payload.source.unwrap_or_else(|| "direct".to_string());

    conn.execute(
        "INSERT INTO items (id, type, title, content, source, status, favorite, archived, created_at, updated_at, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, 'inbox', 0, 0, ?6, ?7, NULL)",
        params![id, payload.r#type, payload.title, content, source, now, now],
    ).map_err(|e| e.to_string())?;


    if let Some(task) = &payload.task {
        conn.execute(
            "INSERT INTO tasks (id, item_id, due_date, priority, completed, completed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![uuid::Uuid::new_v4().to_string(), id, task.due_date, task.priority, if task.completed { 1 } else { 0 }, task.completed_at],
        ).map_err(|e| e.to_string())?;
    }

    if let Some(link) = &payload.link {
        conn.execute(
            "INSERT INTO links (id, item_id, url, domain, page_title, preview_image) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![uuid::Uuid::new_v4().to_string(), id, link.url, link.domain, link.page_title, link.preview_image],
        ).map_err(|e| e.to_string())?;
    }

    // Save attachments
    let mut saved_attachments = Vec::new();
    if let Some(attachments) = &payload.attachments {
        for att in attachments {
            let att_id = if att.id.is_empty() { uuid::Uuid::new_v4().to_string() } else { att.id.clone() };
            let created_at = if att.created_at.is_empty() { now.clone() } else { att.created_at.clone() };

            let mut file_path = att.file_path.clone();
            let mut checksum = att.checksum.clone();
            let mut file_size = att.file_size;

            // If data_url contains base64 data, decode and save to attachments folder on disk
            if let Some(ref data_url) = att.data_url {
                if let Some(comma_pos) = data_url.find(',') {
                    let b64_str = &data_url[comma_pos + 1..];
                    if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64_str) {
                        if let Ok((target_path, computed_hash, written_size)) = storage.save_attachment(&att.file_name, &bytes) {
                            file_path = target_path.to_string_lossy().to_string();
                            checksum = computed_hash;
                            file_size = written_size as i64;
                        }
                    }
                }
            }

            conn.execute(
                "INSERT INTO attachments (id, item_id, file_name, file_path, mime_type, file_size, checksum, created_at, data_url) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![att_id, id, att.file_name, file_path, att.mime_type, file_size, checksum, created_at, att.data_url],
            ).map_err(|e| e.to_string())?;

            saved_attachments.push(AttachmentSubRecord {
                id: att_id,
                file_name: att.file_name.clone(),
                file_path,
                mime_type: att.mime_type.clone(),
                file_size,
                checksum,
                created_at,
                data_url: att.data_url.clone(),
            });
        }
    }

    // Save tags if provided
    let mut saved_tags = Vec::new();
    if let Some(tag_ids) = &payload.tag_ids {
        for tag_id in tag_ids {
            conn.execute(
                "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
                params![id, tag_id],
            ).ok();

            if let Ok(t) = conn.query_row(
                "SELECT id, name, color FROM tags WHERE id = ?1",
                params![tag_id],
                |r| Ok(TagSubRecord { id: r.get(0)?, name: r.get(1)?, color: r.get(2)? }),
            ) {
                saved_tags.push(t);
            }
        }
    }

    Ok(ItemRecord {
        id,
        r#type: payload.r#type,
        title: payload.title,
        content,
        source,
        status: "inbox".to_string(),
        favorite: false,
        archived: false,
        created_at: now.clone(),
        updated_at: now,
        deleted_at: None,
        tags: saved_tags,
        task: payload.task,
        link: payload.link,
        attachments: saved_attachments,
        ai_metadata: None,
    })
}

#[tauri::command]
pub fn update_item(db: State<'_, Database>, payload: UpdateItemPayload) -> Result<ItemRecord, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();

    // Check if item exists
    let exists: bool = conn
        .query_row("SELECT 1 FROM items WHERE id = ?1", params![payload.id], |_| Ok(true))
        .unwrap_or(false);

    if !exists {
        return Err(format!("Item {} not found", payload.id));
    }

    if let Some(title) = &payload.title {
        conn.execute("UPDATE items SET title = ?1, updated_at = ?2 WHERE id = ?3", params![title, now, payload.id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(content) = &payload.content {
        conn.execute("UPDATE items SET content = ?1, updated_at = ?2 WHERE id = ?3", params![content, now, payload.id])
            .map_err(|e| e.to_string())?;
    }
    if let Some(favorite) = payload.favorite {
        conn.execute(
            "UPDATE items SET favorite = ?1, pinned = ?1, updated_at = ?2 WHERE id = ?3",
            params![if favorite { 1 } else { 0 }, now, payload.id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(archived) = payload.archived {
        conn.execute(
            "UPDATE items SET archived = ?1, updated_at = ?2 WHERE id = ?3",
            params![if archived { 1 } else { 0 }, now, payload.id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(status) = &payload.status {
        conn.execute("UPDATE items SET status = ?1, updated_at = ?2 WHERE id = ?3", params![status, now, payload.id])
            .map_err(|e| e.to_string())?;
    }


    // Update task
    if let Some(task) = &payload.task {
        conn.execute(
            "INSERT INTO tasks (id, item_id, due_date, priority, completed, completed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(item_id) DO UPDATE SET
                due_date = excluded.due_date,
                priority = excluded.priority,
                completed = excluded.completed,
                completed_at = excluded.completed_at",
            params![
                uuid::Uuid::new_v4().to_string(),
                payload.id,
                task.due_date,
                task.priority,
                if task.completed { 1 } else { 0 },
                task.completed_at
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    // Update tags
    if let Some(tag_ids) = &payload.tag_ids {
        conn.execute("DELETE FROM item_tags WHERE item_id = ?1", params![payload.id])
            .map_err(|e| e.to_string())?;
        for tag_id in tag_ids {
            conn.execute(
                "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
                params![payload.id, tag_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    // Update AI Metadata
    if let Some(ai) = &payload.ai_metadata {
        let suggested_tags_json = ai
            .suggested_tags
            .as_ref()
            .map(|tags| serde_json::to_string(tags).unwrap_or_default());

        conn.execute(
            "INSERT INTO ai_metadata (id, item_id, provider, model, summary, classification, confidence, suggested_tags, processed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(item_id) DO UPDATE SET
                provider = excluded.provider,
                model = excluded.model,
                summary = COALESCE(excluded.summary, ai_metadata.summary),
                classification = COALESCE(excluded.classification, ai_metadata.classification),
                confidence = COALESCE(excluded.confidence, ai_metadata.confidence),
                suggested_tags = COALESCE(excluded.suggested_tags, ai_metadata.suggested_tags),
                processed_at = excluded.processed_at",
            params![
                ai.id,
                payload.id,
                ai.provider,
                ai.model,
                ai.summary,
                ai.classification,
                ai.confidence,
                suggested_tags_json,
                ai.processed_at
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.execute("UPDATE items SET updated_at = ?1 WHERE id = ?2", params![now, payload.id]).ok();

    fetch_item_by_id(&conn, &payload.id)
}

#[tauri::command]
pub fn trash_item(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE items SET deleted_at = ?1, updated_at = ?2 WHERE id = ?3",
        params![now, now, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn restore_item(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE items SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_item_permanent(db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Delete attachment files on disk if they exist
    if let Ok(mut stmt) = conn.prepare("SELECT file_path FROM attachments WHERE item_id = ?1") {
        if let Ok(rows) = stmt.query_map(params![id], |row| row.get::<_, String>(0)) {
            for path in rows.flatten() {
                let p = std::path::Path::new(&path);
                if p.is_file() {
                    let _ = std::fs::remove_file(p);
                }
            }
        }
    }

    conn.execute("DELETE FROM items WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn empty_trash(db: State<'_, Database>) -> Result<usize, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Delete attachment files on disk for all deleted items
    if let Ok(mut stmt) = conn.prepare("SELECT a.file_path FROM attachments a JOIN items i ON a.item_id = i.id WHERE i.deleted_at IS NOT NULL") {
        if let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(0)) {
            for path in rows.flatten() {
                let p = std::path::Path::new(&path);
                if p.is_file() {
                    let _ = std::fs::remove_file(p);
                }
            }
        }
    }

    let count = conn
        .execute("DELETE FROM items WHERE deleted_at IS NOT NULL", [])
        .map_err(|e| e.to_string())?;
    Ok(count)
}

#[tauri::command]
pub fn import_files_from_paths(
    db: State<'_, Database>,
    storage: State<'_, StorageManager>,
    paths: Vec<String>,
) -> Result<Vec<ItemRecord>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut imported_items = Vec::new();
    let now = chrono::Utc::now().to_rfc3339();

    for path_str in paths {
        let path = std::path::Path::new(&path_str);
        if !path.exists() || !path.is_file() {
            continue;
        }

        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unnamed_file")
            .to_string();

        let file_bytes = match std::fs::read(path) {
            Ok(bytes) => bytes,
            Err(e) => {
                eprintln!("Failed to read file {}: {}", path_str, e);
                continue;
            }
        };
        let file_size = file_bytes.len() as i64;

        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let (mime_type, item_type) = match extension.as_str() {
            "png" => ("image/png", "image"),
            "jpg" | "jpeg" => ("image/jpeg", "image"),
            "gif" => ("image/gif", "image"),
            "webp" => ("image/webp", "image"),
            "svg" => ("image/svg+xml", "image"),
            "bmp" => ("image/bmp", "image"),
            "pdf" => ("application/pdf", "file"),
            "txt" | "log" => ("text/plain", "file"),
            "md" | "markdown" => ("text/markdown", "file"),
            "json" => ("application/json", "file"),
            "csv" => ("text/csv", "file"),
            "zip" | "tar" | "gz" | "7z" | "rar" => ("application/zip", "file"),
            "mp3" | "wav" | "ogg" | "m4a" | "flac" => ("audio/mpeg", "file"),
            "mp4" | "mkv" | "mov" | "webm" | "avi" => ("video/mp4", "file"),
            "doc" | "docx" => ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "file"),
            "xls" | "xlsx" => ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "file"),
            "ppt" | "pptx" => ("application/vnd.openxmlformats-officedocument.presentationml.presentation", "file"),
            _ => ("application/octet-stream", "file"),
        };

        // Save copy to Velco attachments directory
        let (saved_path, checksum, _) = storage
            .save_attachment(&file_name, &file_bytes)
            .map_err(|e| format!("Failed to save attachment {}: {}", file_name, e))?;

        // Data URL generation: images up to 5MB, PDF up to 15MB
        let data_url = if (item_type == "image" && file_size <= 5 * 1024 * 1024)
            || (extension == "pdf" && file_size <= 15 * 1024 * 1024)
        {
            let b64 = base64::engine::general_purpose::STANDARD.encode(&file_bytes);
            Some(format!("data:{};base64,{}", mime_type, b64))
        } else {
            None
        };

        // Content summary & preview: direct text extraction for text & docx files
        let mut content = format!(
            "File: {}\nSize: {:.1} KB\nType: {}\nPath: {}",
            file_name,
            file_size as f64 / 1024.0,
            mime_type,
            path_str
        );

        if matches!(
            extension.as_str(),
            "txt" | "md" | "json" | "csv" | "log" | "rs" | "ts" | "js" | "html" | "css" | "xml" | "yaml" | "yml" | "sql" | "py" | "sh" | "bat" | "env" | "ini"
        ) && file_size <= 5 * 1024 * 1024
        {
            if let Ok(text) = String::from_utf8(file_bytes.clone()) {
                content = text;
            }
        } else if extension == "docx" && file_size <= 15 * 1024 * 1024 {
            if let Some(text) = extract_docx_text(&file_bytes) {
                content = text;
            }
        } else if extension == "xlsx" && file_size <= 15 * 1024 * 1024 {
            if let Some(text) = extract_xlsx_text(&file_bytes) {
                content = text;
            }
        }

        let item_id = uuid::Uuid::new_v4().to_string();
        let att_id = uuid::Uuid::new_v4().to_string();
        let relative_file_path = format!(
            "attachments/{}",
            saved_path.file_name().and_then(|n| n.to_str()).unwrap_or(&file_name)
        );

        // Insert into items table
        conn.execute(
            "INSERT INTO items (id, type, title, content, source, status, favorite, archived, created_at, updated_at, deleted_at) VALUES (?1, ?2, ?3, ?4, 'drag_drop', 'inbox', 0, 0, ?5, ?6, NULL)",
            params![item_id, item_type, file_name, content, now, now],
        ).map_err(|e| e.to_string())?;

        // Insert into FTS5
        conn.execute(
            "INSERT INTO items_fts (item_id, title, content) VALUES (?1, ?2, ?3)",
            params![item_id, file_name, content],
        ).ok();

        // Insert into attachments table
        conn.execute(
            "INSERT INTO attachments (id, item_id, file_name, file_path, mime_type, file_size, checksum, created_at, data_url) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![att_id, item_id, file_name, relative_file_path, mime_type, file_size, checksum, now, data_url],
        ).map_err(|e| e.to_string())?;

        let created_record = fetch_item_by_id(&conn, &item_id)?;
        imported_items.push(created_record);
    }

    Ok(imported_items)
}

/// Helper: ekstrak teks dari file .docx (OpenXML) tanpa dependensi runtime eksternal
pub fn extract_docx_text(bytes: &[u8]) -> Option<String> {
    use std::io::Cursor;
    let cursor = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor).ok()?;
    let mut file = archive.by_name("word/document.xml").ok()?;
    let mut xml = String::new();
    std::io::Read::read_to_string(&mut file, &mut xml).ok()?;

    let mut result = String::new();
    let mut in_tag = false;
    let mut tag_name = String::new();
    let mut is_text_node = false;
    let mut chars = xml.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '<' {
            in_tag = true;
            tag_name.clear();
            while let Some(&next_c) = chars.peek() {
                if next_c == '>' || next_c.is_whitespace() {
                    break;
                }
                tag_name.push(chars.next().unwrap());
            }
            if tag_name == "w:p" || tag_name == "/w:p" {
                if !result.ends_with('\n') && !result.is_empty() {
                    result.push('\n');
                }
            }
            is_text_node = tag_name == "w:t" || tag_name.starts_with("w:t ");
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag && is_text_node {
            result.push(c);
        }
    }

    let trimmed = result.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

/// Helper: ekstrak teks dari file .xlsx (Excel)
pub fn extract_xlsx_text(bytes: &[u8]) -> Option<String> {
    use std::io::Cursor;
    let cursor = Cursor::new(bytes);
    let mut archive = zip::ZipArchive::new(cursor).ok()?;
    let mut file = archive.by_name("xl/sharedStrings.xml").ok()?;
    let mut xml = String::new();
    std::io::Read::read_to_string(&mut file, &mut xml).ok()?;

    let mut result = String::new();
    let mut in_t = false;
    let mut tag = String::new();
    let mut chars = xml.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '<' {
            tag.clear();
            while let Some(&next_c) = chars.peek() {
                if next_c == '>' || next_c.is_whitespace() {
                    break;
                }
                tag.push(chars.next().unwrap());
            }
            in_t = tag == "t";
            if tag == "/si" {
                result.push('\n');
            }
        } else if c == '>' {
            // tag ended
        } else if in_t {
            result.push(c);
        }
    }
    let trimmed = result.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

/// Ambil pratinjau konten berkas lengkap (teks, pdf, docx, xlsx, gambar, audio/video)
#[tauri::command]
pub fn get_attachment_preview(
    db: State<'_, Database>,
    storage: State<'_, StorageManager>,
    attachment_id: String,
) -> Result<FilePreviewContent, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Query lampiran dari DB
    let query_res = conn.query_row(
        "SELECT id, item_id, file_name, file_path, mime_type, file_size, data_url FROM attachments WHERE id = ?1",
        params![attachment_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, Option<String>>(6)?,
            ))
        },
    );

    let (id, item_id, file_name, file_path, mime_type, file_size, db_data_url) = match query_res {
        Ok(t) => t,
        Err(_) => {
            // Jika ID tidak ditemukan di attachments, mungkin ID adalah item_id
            let alt_res = conn.query_row(
                "SELECT id, item_id, file_name, file_path, mime_type, file_size, data_url FROM attachments WHERE item_id = ?1 LIMIT 1",
                params![attachment_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, i64>(5)?,
                        row.get::<_, Option<String>>(6)?,
                    ))
                },
            );

            match alt_res {
                Ok(t) => t,
                Err(_) => {
                    // Fallback jika tidak ada lampiran sama sekali di tabel attachments
                    let item_res = conn.query_row(
                        "SELECT id, title, content, type FROM items WHERE id = ?1",
                        params![attachment_id],
                        |row| {
                            Ok((
                                row.get::<_, String>(0)?,
                                row.get::<_, String>(1)?,
                                row.get::<_, String>(2)?,
                                row.get::<_, String>(3)?,
                            ))
                        },
                    ).map_err(|e| format!("Attachment or item not found: {}", e))?;

                    let (it_id, it_title, it_content, it_type) = item_res;
                    let ext = std::path::Path::new(&it_title)
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_lowercase();

                    let preview_type = match ext.as_str() {
                        "md" | "markdown" => "markdown",
                        "json" => "json",
                        "csv" => "csv",
                        "js" | "ts" | "jsx" | "tsx" | "py" | "rs" | "html" | "css" | "sql" => "code",
                        _ => if it_type == "note" || !it_content.is_empty() { "text" } else { "unsupported" },
                    };

                    let line_count = Some(it_content.lines().count());
                    let char_count = Some(it_content.chars().count());

                    return Ok(FilePreviewContent {
                        attachment_id: it_id.clone(),
                        item_id: it_id,
                        file_name: it_title,
                        mime_type: "text/plain".to_string(),
                        file_size: it_content.len() as i64,
                        data_url: None,
                        text_content: Some(it_content),
                        preview_type: preview_type.to_string(),
                        language: if ext.is_empty() { None } else { Some(ext) },
                        line_count,
                        char_count,
                    });
                }
            }
        }
    };

    let extension = std::path::Path::new(&file_name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // 1. Cek apakah berkas ada di disk
    let candidate_paths = [
        std::path::PathBuf::from(&file_path),
        storage.attachments_dir().join(&file_path),
        storage.attachments_dir().join(&file_name),
    ];

    let mut found_bytes: Option<Vec<u8>> = None;
    for p in &candidate_paths {
        if p.is_file() {
            if let Ok(bytes) = std::fs::read(p) {
                found_bytes = Some(bytes);
                break;
            }
        }
    }

    // Jika belum ketemu di path langsung, scan folder attachments untuk UUID prefix
    if found_bytes.is_none() {
        if let Ok(entries) = std::fs::read_dir(storage.attachments_dir()) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    let fname = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    if fname.ends_with(&format!("_{}", file_name)) || fname == file_name {
                        if let Ok(bytes) = std::fs::read(&p) {
                            found_bytes = Some(bytes);
                            break;
                        }
                    }
                }
            }
        }
    }

    // Klasifikasi tipe pratinjau
    let is_pdf = mime_type == "application/pdf" || extension == "pdf";
    let is_image = mime_type.starts_with("image/") || matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp");
    let is_docx = extension == "docx" || mime_type.contains("wordprocessingml");
    let is_xlsx = extension == "xlsx" || mime_type.contains("spreadsheetml");
    let is_markdown = matches!(extension.as_str(), "md" | "markdown");
    let is_json = extension == "json" || mime_type == "application/json";
    let is_csv = matches!(extension.as_str(), "csv" | "tsv");
    let is_code = matches!(extension.as_str(), "js" | "jsx" | "ts" | "tsx" | "py" | "rs" | "go" | "java" | "c" | "cpp" | "h" | "hpp" | "html" | "css" | "scss" | "xml" | "yaml" | "yml" | "toml" | "ini" | "env" | "sql" | "sh" | "bash" | "bat" | "ps1");
    let is_text = mime_type.starts_with("text/") || matches!(extension.as_str(), "txt" | "log" | "diff" | "patch" | "conf" | "properties");
    let is_audio = mime_type.starts_with("audio/") || matches!(extension.as_str(), "mp3" | "wav" | "ogg" | "m4a" | "flac");
    let is_video = mime_type.starts_with("video/") || matches!(extension.as_str(), "mp4" | "mkv" | "mov" | "webm");

    let mut data_url = db_data_url;
    let mut text_content: Option<String> = None;
    let preview_type;

    if is_pdf {
        preview_type = "pdf".to_string();
        if data_url.is_none() {
            if let Some(bytes) = &found_bytes {
                if bytes.len() <= 30 * 1024 * 1024 {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
                    let url = format!("data:application/pdf;base64,{}", b64);
                    // Cache kembali ke DB jika <= 10MB
                    if bytes.len() <= 10 * 1024 * 1024 {
                        let _ = conn.execute(
                            "UPDATE attachments SET data_url = ?1 WHERE id = ?2",
                            params![url, id],
                        );
                    }
                    data_url = Some(url);
                }
            }
        }
    } else if is_docx {
        preview_type = "docx".to_string();
        if let Some(bytes) = &found_bytes {
            text_content = extract_docx_text(bytes);
        }
    } else if is_xlsx {
        preview_type = "xlsx".to_string();
        if let Some(bytes) = &found_bytes {
            text_content = extract_xlsx_text(bytes);
        }
    } else if is_markdown || is_json || is_csv || is_code || is_text {
        preview_type = if is_markdown {
            "markdown".to_string()
        } else if is_json {
            "json".to_string()
        } else if is_csv {
            "csv".to_string()
        } else if is_code {
            "code".to_string()
        } else {
            "text".to_string()
        };

        if let Some(bytes) = &found_bytes {
            if bytes.len() <= 10 * 1024 * 1024 {
                text_content = Some(String::from_utf8_lossy(bytes).to_string());
            }
        } else if let Some(ref d_url) = data_url {
            // Coba decode base64 dari data URL jika ada
            if let Some(comma_pos) = d_url.find(',') {
                let b64 = &d_url[comma_pos + 1..];
                if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64) {
                    text_content = Some(String::from_utf8_lossy(&bytes).to_string());
                }
            }
        }

        // Jika masih belum ada text_content, ambil dari content tabel items
        if text_content.is_none() {
            if let Ok(raw_content) = conn.query_row(
                "SELECT content FROM items WHERE id = ?1",
                params![item_id],
                |r| r.get::<_, String>(0),
            ) {
                if !raw_content.trim().is_empty() {
                    text_content = Some(raw_content);
                }
            }
        }
    } else if is_image {
        preview_type = "image".to_string();
        if data_url.is_none() {
            if let Some(bytes) = &found_bytes {
                if bytes.len() <= 15 * 1024 * 1024 {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
                    let url = format!("data:{};base64,{}", mime_type, b64);
                    data_url = Some(url);
                }
            }
        }
    } else if is_audio || is_video {
        preview_type = if is_audio { "audio".to_string() } else { "video".to_string() };
        if data_url.is_none() {
            if let Some(bytes) = &found_bytes {
                if bytes.len() <= 25 * 1024 * 1024 {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
                    let url = format!("data:{};base64,{}", mime_type, b64);
                    data_url = Some(url);
                }
            }
        }
    } else {
        preview_type = "unsupported".to_string();
    }

    let line_count = text_content.as_ref().map(|s| s.lines().count());
    let char_count = text_content.as_ref().map(|s| s.chars().count());
    let language = if extension.is_empty() { None } else { Some(extension) };

    Ok(FilePreviewContent {
        attachment_id: id,
        item_id,
        file_name,
        mime_type,
        file_size,
        data_url,
        text_content,
        preview_type,
        language,
        line_count,
        char_count,
    })
}
