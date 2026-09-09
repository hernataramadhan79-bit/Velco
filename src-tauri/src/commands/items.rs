use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, State};
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

    // Allowlist tipe item — tolak nilai asing (hindari SQL injection via interpolasi).
    const ALLOWED_TYPES: &[&str] = &["note", "task", "link", "file", "image"];
    let (type_filter_sql, type_param): (String, Option<String>) = match filter_type.as_deref() {
        Some("file") | Some("files") => (
            " AND (i.type = 'file' OR i.type = 'image' OR EXISTS (SELECT 1 FROM attachments a WHERE a.item_id = i.id))".to_string(),
            None,
        ),
        Some(t) if ALLOWED_TYPES.contains(&t) => (" AND i.type = ?".to_string(), Some(t.to_string())),
        Some(_) => (" AND 1=0".to_string(), None), // tipe tak dikenal → kosong, bukan error
        None => (String::new(), None),
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
        WHERE {}{}
        ORDER BY i.created_at DESC
        LIMIT 500
        "#,
        where_clause, type_filter_sql
    );

    fn map_summary_row(row: &rusqlite::Row) -> rusqlite::Result<ItemSummary> {
        let pinned_val: i64 = row.get(4)?;
        let archived_val: i64 = row.get(5)?;
        let trashed_val: i64 = row.get(6)?;
        let tags_json: String = row.get(9).unwrap_or_else(|_| "[]".to_string());
        let task_json: Option<String> = row.get(10).ok();
        let link_json: Option<String> = row.get(11).ok();
        let attachments_count: i64 = row.get(12).unwrap_or(0);
        let thumbnail_url: Option<String> = row.get(13).ok();
        let tags: Vec<TagMinimal> = serde_json::from_str(&tags_json).unwrap_or_default();
        let task: Option<TaskSubRecord> =
            task_json.and_then(|s| serde_json::from_str(&s).ok());
        let link: Option<LinkSubRecord> =
            link_json.and_then(|s| serde_json::from_str(&s).ok());
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
    }

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    // Bind param tipe bila ada (hindari format! interpolasi)
    let mut results = Vec::new();
    if let Some(t) = type_param {
        let rows = stmt
            .query_map(rusqlite::params![t], map_summary_row)
            .map_err(|e| e.to_string())?;
        for row in rows {
            results.push(row.map_err(|e| e.to_string())?);
        }
    } else {
        let rows = stmt
            .query_map([], map_summary_row)
            .map_err(|e| e.to_string())?;
        for row in rows {
            results.push(row.map_err(|e| e.to_string())?);
        }
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
    let mut sql = r#"
        SELECT
            i.id,
            COALESCE(i.type, 'note'),
            COALESCE(i.title, ''),
            COALESCE(i.content, ''),
            COALESCE(i.source, 'direct'),
            COALESCE(i.status, 'inbox'),
            CASE WHEN (i.pinned = 1 OR i.favorite = 1) THEN 1 ELSE 0 END as favorite,
            COALESCE(i.archived, 0) as archived,
            COALESCE(i.created_at, '') as created_at,
            COALESCE(i.updated_at, '') as updated_at,
            i.deleted_at,
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
            COALESCE(
                (
                    SELECT json_group_array(
                        json_object('id', a.id, 'file_name', a.file_name, 'file_path', a.file_path, 'mime_type', a.mime_type, 'file_size', a.file_size, 'checksum', a.checksum, 'created_at', a.created_at, 'data_url', a.data_url)
                    )
                    FROM attachments a WHERE a.item_id = i.id
                ),
                '[]'
            ) as attachments_json,
            (
                SELECT json_object('id', ai.id, 'item_id', ai.item_id, 'provider', ai.provider, 'model', ai.model, 'summary', ai.summary, 'classification', ai.classification, 'confidence', ai.confidence, 'suggested_tags', CASE WHEN json_valid(ai.suggested_tags) = 1 THEN json(ai.suggested_tags) ELSE NULL END, 'processed_at', ai.processed_at)
                FROM ai_metadata ai WHERE ai.item_id = i.id
            ) as ai_json
        FROM items i
        WHERE "#.to_string();

    if show_trash && show_archived {
        sql.push_str("1=1");
    } else if show_trash {
        sql.push_str("i.deleted_at IS NOT NULL");
    } else if show_archived {
        sql.push_str("i.deleted_at IS NULL AND i.archived = 1");
    } else {
        sql.push_str("i.deleted_at IS NULL AND i.archived = 0");
    }

    let mut query_params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref t) = filter_type {
        if t == "file" || t == "files" {
            sql.push_str(" AND (i.type = 'file' OR i.type = 'image' OR EXISTS (SELECT 1 FROM attachments a WHERE a.item_id = i.id))");
        } else {
            sql.push_str(" AND i.type = ?");
            query_params.push(Box::new(t.clone()));
        }
    }

    sql.push_str(" ORDER BY i.created_at DESC LIMIT 500");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = query_params.iter().map(|p| p.as_ref()).collect();
    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            let id: String = row.get(0)?;
            let favorite: i64 = row.get(6)?;
            let archived: i64 = row.get(7)?;
            let tags_json: String = row.get(11).unwrap_or_else(|_| "[]".to_string());
            let task_json: Option<String> = row.get(12).ok();
            let link_json: Option<String> = row.get(13).ok();
            let att_json: String = row.get(14).unwrap_or_else(|_| "[]".to_string());
            let ai_json: Option<String> = row.get(15).ok();

            let tags: Vec<TagSubRecord> = serde_json::from_str(&tags_json).unwrap_or_default();
            let task: Option<TaskSubRecord> = task_json.and_then(|s| serde_json::from_str(&s).ok());
            let link: Option<LinkSubRecord> = link_json.and_then(|s| serde_json::from_str(&s).ok());
            let attachments: Vec<AttachmentSubRecord> = serde_json::from_str(&att_json).unwrap_or_default();
            let ai_metadata: Option<AiMetadataSubRecord> = ai_json.and_then(|s| serde_json::from_str(&s).ok());

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
                tags,
                task,
                link,
                attachments,
                ai_metadata,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r.map_err(|e| e.to_string())?);
    }
    Ok(items)
}

#[tauri::command]
pub fn create_item(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    storage: State<'_, StorageManager>,
    payload: CreateItemPayload,
) -> Result<ItemRecord, String> {
    // Validasi awal (tanpa lock)
    const ALLOWED_TYPES: &[&str] = &["note", "task", "link", "file", "image"];
    if !ALLOWED_TYPES.contains(&payload.r#type.as_str()) {
        return Err(format!("Invalid item type: {}", payload.r#type));
    }
    let title: String = payload.title.chars().take(500).collect();
    if title.trim().is_empty() {
        return Err("Title cannot be empty".to_string());
    }
    let id = payload.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    if id.len() > 64 || id.contains('/') || id.contains('\\') {
        return Err("Invalid item id".to_string());
    }
    let now = chrono::Utc::now().to_rfc3339();
    let content: String = payload.content.clone().unwrap_or_default().chars().take(2_000_000).collect();
    let source = payload.source.clone().unwrap_or_else(|| "direct".to_string());

    // Pre-process attachments: decode base64 + tulis ke disk TANPA memegang DB lock.
    // (Mencegah UI freeze + menghindari I/O panjang di dalam Mutex.)
    struct PreparedAtt {
        att_id: String,
        file_name: String,
        file_path: String,
        mime_type: String,
        file_size: i64,
        checksum: String,
        created_at: String,
        data_url: Option<String>,
    }
    let mut prepared: Vec<PreparedAtt> = Vec::new();
    if let Some(attachments) = &payload.attachments {
        if attachments.len() > 50 {
            return Err("Too many attachments (max 50)".to_string());
        }
        for att in attachments {
            let att_id = if att.id.is_empty() {
                uuid::Uuid::new_v4().to_string()
            } else {
                att.id.clone()
            };
            let created_at = if att.created_at.is_empty() {
                now.clone()
            } else {
                att.created_at.clone()
            };
            let safe_name = StorageManager::sanitize_file_name(&att.file_name);
            let mut file_path = String::new();
            let mut checksum = att.checksum.clone();
            let mut file_size = att.file_size;
            let final_data_url = match &att.data_url {
                Some(s) if s.trim().is_empty() => None,
                Some(s) if s.len() > 30_000_000 => None, // tolak blob > ~22MB
                Some(s) => Some(s.clone()),
                None => None,
            };
            if let Some(ref data_url) = final_data_url.clone() {
                if let Some(comma_pos) = data_url.find(',') {
                    let b64_str = &data_url[comma_pos + 1..];
                    if b64_str.len() < 30_000_000 {
                        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64_str) {
                            if bytes.len() <= 20 * 1024 * 1024 {
                                if let Ok((target_path, computed_hash, written_size)) =
                                    storage.save_attachment(&safe_name, &bytes)
                                {
                                    file_path = target_path.to_string_lossy().to_string();
                                    checksum = computed_hash;
                                    file_size = written_size as i64;
                                }
                            }
                        }
                    }
                }
            }
            // NOTE: fallback baca arbitrary file_path dari frontend DIHAPUS (arbitrary file read).
            // File dari disk harus masuk via import_files_from_paths yang tervalidasi.
            prepared.push(PreparedAtt {
                att_id,
                file_name: safe_name,
                file_path,
                mime_type: att.mime_type.clone(),
                file_size,
                checksum,
                created_at,
                data_url: final_data_url,
            });
        }
    }

    // Tulis DB dalam SATU transaction (atomic: gagal di tengah → rollback, tanpa item yatim).
    // Trigger items_ai otomatis isi FTS — jangan insert manual (hindari duplikat).
    let (saved_tags, saved_attachments): (Vec<TagSubRecord>, Vec<AttachmentSubRecord>) = {
        let mut conn = db.conn.lock().map_err(|e| e.to_string())?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO items (id, type, title, content, source, status, favorite, archived, created_at, updated_at, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, 'inbox', 0, 0, ?6, ?7, NULL)",
            params![id, payload.r#type, title, content, source, now, now],
        )
        .map_err(|e| e.to_string())?;

        if let Some(task) = &payload.task {
            // Validasi priority
            let prio = match task.priority.as_str() {
                "low" | "medium" | "high" | "urgent" => task.priority.clone(),
                _ => "medium".to_string(),
            };
            tx.execute(
                "INSERT INTO tasks (id, item_id, due_date, priority, completed, completed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![uuid::Uuid::new_v4().to_string(), id, task.due_date, prio, if task.completed { 1 } else { 0 }, task.completed_at],
            ).map_err(|e| e.to_string())?;
        }

        if let Some(link) = &payload.link {
            // Validasi URL scheme
            let url_ok = link.url.starts_with("http://") || link.url.starts_with("https://");
            if !url_ok {
                return Err("Invalid link URL (only http/https allowed)".to_string());
            }
            let url: String = link.url.chars().take(2000).collect();
            tx.execute(
                "INSERT INTO links (id, item_id, url, domain, page_title, preview_image) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![uuid::Uuid::new_v4().to_string(), id, url, link.domain, link.page_title, link.preview_image],
            ).map_err(|e| e.to_string())?;
        }

        let mut saved_attachments = Vec::new();
        for p in prepared {
            tx.execute(
                "INSERT INTO attachments (id, item_id, file_name, file_path, mime_type, file_size, checksum, created_at, data_url) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![p.att_id, id, p.file_name, p.file_path, p.mime_type, p.file_size, p.checksum, p.created_at, p.data_url],
            ).map_err(|e| e.to_string())?;
            saved_attachments.push(AttachmentSubRecord {
                id: p.att_id,
                file_name: p.file_name,
                file_path: p.file_path,
                mime_type: p.mime_type,
                file_size: p.file_size,
                checksum: p.checksum,
                created_at: p.created_at,
                data_url: p.data_url,
            });
        }

        let mut saved_tags = Vec::new();
        if let Some(tag_ids) = &payload.tag_ids {
            if tag_ids.len() > 20 {
                return Err("Too many tags (max 20)".to_string());
            }
            for tag_id in tag_ids {
                // FK check: hanya assign bila tag benar-benar ada
                let exists: bool = tx
                    .query_row("SELECT 1 FROM tags WHERE id = ?1", params![tag_id], |_| Ok(true))
                    .unwrap_or(false);
                if !exists {
                    continue;
                }
                tx.execute(
                    "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
                    params![id, tag_id],
                )
                .map_err(|e| e.to_string())?;

                if let Ok(t) = tx.query_row(
                    "SELECT id, name, color FROM tags WHERE id = ?1",
                    params![tag_id],
                    |r| Ok(TagSubRecord { id: r.get(0)?, name: r.get(1)?, color: r.get(2)? }),
                ) {
                    saved_tags.push(t);
                }
            }
        }
        tx.commit().map_err(|e| e.to_string())?;
        (saved_tags, saved_attachments)
        // lock dilepas di sini
    };

    let _ = app.emit("velco://items-changed", ());

    Ok(ItemRecord {
        id,
        r#type: payload.r#type,
        title,
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
pub fn update_item(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    payload: UpdateItemPayload,
) -> Result<ItemRecord, String> {
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

    let _ = app.emit("velco://items-changed", ());

    fetch_item_by_id(&conn, &payload.id)
}

#[tauri::command]
pub fn trash_item(app: tauri::AppHandle, db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE items SET deleted_at = ?1, updated_at = ?2 WHERE id = ?3",
        params![now, now, id],
    )
    .map_err(|e| e.to_string())?;
    let _ = app.emit("velco://items-changed", ());
    Ok(())
}

#[tauri::command]
pub fn restore_item(app: tauri::AppHandle, db: State<'_, Database>, id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE items SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;
    let _ = app.emit("velco://items-changed", ());
    Ok(())
}

/// Hapus file fisik HANYA bila berada di dalam attachments_dir (jail).
fn remove_jailed_file(storage: &StorageManager, file_path: &str, file_name: &str) {
    // Resolve via jail helper; tolak absolut di luar sandbox.
    let resolved = if let Some(r) = storage.resolve_attachment_path(file_path, file_name) {
        r
    } else {
        return;
    };
    if StorageManager::ensure_within_dir(&storage.attachments_dir(), &resolved).is_err() {
        return;
    }
    if resolved.is_file() {
        let _ = std::fs::remove_file(resolved);
    }
}

#[tauri::command]
pub fn delete_item_permanent(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    storage: State<'_, StorageManager>,
    id: String,
) -> Result<(), String> {
    // 1. Ambil daftar file di bawah lock singkat
    let files: Vec<(String, String)> = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        if let Ok(mut stmt) =
            conn.prepare("SELECT file_path, file_name FROM attachments WHERE item_id = ?1")
        {
            if let Ok(rows) = stmt.query_map(params![id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            }) {
                for r in rows.flatten() {
                    out.push(r);
                }
            }
        }
        out
        // lock dilepas sebelum hapus file
    };

    // 2. Hapus file fisik dengan jail (di luar lock agar tidak block IPC)
    for (fp, fn_) in files {
        remove_jailed_file(&storage, &fp, &fn_);
    }

    // 3. Hapus row DB (CASCADE + trigger FTS otomatis bersih)
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM items WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    let _ = app.emit("velco://items-changed", ());
    Ok(())
}

#[tauri::command]
pub fn empty_trash(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    storage: State<'_, StorageManager>,
) -> Result<usize, String> {
    // 1. Ambil daftar file trashed di bawah lock singkat
    let files: Vec<(String, String)> = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        if let Ok(mut stmt) = conn.prepare("SELECT a.file_path, a.file_name FROM attachments a JOIN items i ON a.item_id = i.id WHERE i.deleted_at IS NOT NULL") {
            if let Ok(rows) = stmt.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            }) {
                for r in rows.flatten() {
                    out.push(r);
                }
            }
        }
        out
    };

    // 2. Hapus file di luar lock dengan jail
    for (fp, fn_) in files {
        remove_jailed_file(&storage, &fp, &fn_);
    }

    // 3. Hapus rows
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let count = conn
        .execute("DELETE FROM items WHERE deleted_at IS NOT NULL", [])
        .map_err(|e| e.to_string())?;
    let _ = app.emit("velco://items-changed", ());
    Ok(count)
}

#[tauri::command]
pub fn import_files_from_paths(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    storage: State<'_, StorageManager>,
    paths: Vec<String>,
) -> Result<Vec<ItemRecord>, String> {
    // Batasi batch agar tidak OOM / freeze (frontend harus chunk bila >20)
    if paths.len() > 20 {
        return Err("Too many files in one batch (max 20)".to_string());
    }
    struct StagedFile {
        file_name: String,
        file_bytes: Vec<u8>,
        mime_type: String,
        item_type: String,
        extension: String,
    }
    // 1. Baca + validasi SEMUA file TANPA memegang DB lock.
    let mut staged: Vec<StagedFile> = Vec::new();
    for path_str in paths {
        let path = std::path::Path::new(&path_str);
        // Tolak symlink / direktori / file tak ada
        let meta = match std::fs::symlink_metadata(path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if meta.file_type().is_symlink() || !meta.is_file() {
            continue;
        }
        // Cap 100MB per file
        if meta.len() > 100 * 1024 * 1024 {
            continue;
        }
        let raw_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unnamed_file");
        let file_name = StorageManager::sanitize_file_name(raw_name);
        let file_bytes = match std::fs::read(path) {
            Ok(bytes) => bytes,
            Err(e) => {
                eprintln!("Failed to read file {}: {}", path_str, e);
                continue;
            }
        };

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

        staged.push(StagedFile {
            file_name,
            file_bytes,
            mime_type: mime_type.to_string(),
            item_type: item_type.to_string(),
            extension,
        });
    }

    // 2. Tulis ke attachments_dir (masih tanpa DB lock) + siapkan konten.
    struct ReadyFile {
        file_name: String,
        mime_type: String,
        item_type: String,
        content: String,
        data_url: Option<String>,
        saved_file_name: String,
        checksum: String,
        file_size: i64,
    }
    let mut ready: Vec<ReadyFile> = Vec::new();
    for s in staged {
        let file_size = s.file_bytes.len() as i64;
        let (saved_path, checksum, _) = storage
            .save_attachment(&s.file_name, &s.file_bytes)
            .map_err(|e| format!("Failed to save attachment {}: {}", s.file_name, e))?;
        let saved_file_name = saved_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&s.file_name)
            .to_string();

        let data_url = if s.item_type == "image" && file_size <= 64 * 1024 {
            let b64 = base64::engine::general_purpose::STANDARD.encode(&s.file_bytes);
            Some(format!("data:{};base64,{}", s.mime_type, b64))
        } else {
            None
        };

        // Jangan simpan path absolut asal ke konten (privacy + cegah leak path sistem).
        let mut content = format!(
            "File: {}\nSize: {:.1} KB\nType: {}",
            s.file_name,
            file_size as f64 / 1024.0,
            s.mime_type,
        );

        if matches!(
            s.extension.as_str(),
            "txt" | "md" | "json" | "csv" | "log" | "rs" | "ts" | "js" | "html" | "css" | "xml" | "yaml" | "yml" | "sql" | "py" | "sh" | "bat" | "env" | "ini"
        ) && file_size <= 1 * 1024 * 1024
        {
            if let Ok(text) = String::from_utf8(s.file_bytes.clone()) {
                content = text.chars().take(200_000).collect();
            }
        } else if s.extension == "docx" && file_size <= 15 * 1024 * 1024 {
            if let Some(text) = extract_docx_text(&s.file_bytes) {
                content = text.chars().take(200_000).collect();
            }
        } else if s.extension == "xlsx" && file_size <= 15 * 1024 * 1024 {
            if let Some(text) = extract_xlsx_text(&s.file_bytes) {
                content = text.chars().take(200_000).collect();
            }
        }

        ready.push(ReadyFile {
            file_name: s.file_name,
            mime_type: s.mime_type,
            item_type: s.item_type,
            content,
            data_url,
            saved_file_name,
            checksum,
            file_size,
        });
    }

    // 3. Insert DB dalam transaction singkat (trigger FTS otomatis, tanpa manual insert).
    let now = chrono::Utc::now().to_rfc3339();
    let mut imported_ids: Vec<String> = Vec::new();
    {
        let mut conn = db.conn.lock().map_err(|e| e.to_string())?;
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        for r in &ready {
            let item_id = uuid::Uuid::new_v4().to_string();
            let att_id = uuid::Uuid::new_v4().to_string();
            let relative_file_path = format!("attachments/{}", r.saved_file_name);
            tx.execute(
                "INSERT INTO items (id, type, title, content, source, status, favorite, archived, created_at, updated_at, deleted_at) VALUES (?1, ?2, ?3, ?4, 'drag_drop', 'inbox', 0, 0, ?5, ?6, NULL)",
                params![item_id, r.item_type, r.file_name, r.content, now, now],
            )
            .map_err(|e| e.to_string())?;
            tx.execute(
                "INSERT INTO attachments (id, item_id, file_name, file_path, mime_type, file_size, checksum, created_at, data_url) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![att_id, item_id, r.file_name, relative_file_path, r.mime_type, r.file_size, r.checksum, now, r.data_url],
            )
            .map_err(|e| e.to_string())?;
            imported_ids.push(item_id);
        }
        tx.commit().map_err(|e| e.to_string())?;
    }

    // 4. Fetch records (read-only, tanpa menahan transaction)
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut imported_items = Vec::new();
    for item_id in imported_ids {
        if let Ok(rec) = fetch_item_by_id(&conn, &item_id) {
            imported_items.push(rec);
        }
    }

    let _ = app.emit("velco://items-changed", ());

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

    // 1. Cek apakah berkas ada di disk — HANYA di dalam attachments_dir (jail).
    // Path absolut di luar sandbox DITOLAK (mencegah arbitrary file read via DB beracun).
    // Lock DB dilepas sebelum I/O file agar tidak block IPC lain.
    let att_dir = storage.attachments_dir();
    let safe_name = StorageManager::sanitize_file_name(&file_name);
    let jailed_primary: Option<std::path::PathBuf> =
        storage.resolve_attachment_path(&file_path, &safe_name);
    // Drop guard sebelum fs::read (conn masih dipinjam oleh query di atas; explicitly drop)
    // NOTE: `conn` adalah MutexGuard — drop agar read file tidak menahan lock.
    drop(conn);

    let mut found_bytes: Option<Vec<u8>> = None;
    if let Some(p) = jailed_primary {
        if let Ok(jailed) = StorageManager::ensure_within_dir(&att_dir, &p) {
            // Cap baca 30MB agar tidak OOM
            if let Ok(meta) = std::fs::metadata(&jailed) {
                if meta.len() <= 30 * 1024 * 1024 && jailed.is_file() {
                    if let Ok(bytes) = std::fs::read(&jailed) {
                        found_bytes = Some(bytes);
                    }
                }
            }
        }
    }

    // Jika belum ketemu, scan folder attachments untuk UUID prefix (tetap di dalam att_dir)
    if found_bytes.is_none() {
        if let Ok(entries) = std::fs::read_dir(&att_dir) {
            let suffix = format!("_{}", safe_name);
            for entry in entries.flatten() {
                let p = entry.path();
                let is_file = entry
                    .file_type()
                    .map(|f| f.is_file())
                    .unwrap_or_else(|_| p.is_file());
                if !is_file {
                    continue;
                }
                // Jail tiap kandidat
                if StorageManager::ensure_within_dir(&att_dir, &p).is_err() {
                    continue;
                }
                let fname = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if fname.ends_with(&suffix) || fname == safe_name {
                    if let Ok(meta) = std::fs::metadata(&p) {
                        if meta.len() > 30 * 1024 * 1024 {
                            continue;
                        }
                    }
                    if let Ok(bytes) = std::fs::read(&p) {
                        found_bytes = Some(bytes);
                        break;
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

    // Helper: cache data_url kecil kembali ke DB di bawah lock singkat
    let cache_data_url = |att_id: &str, url: &str| {
        if let Ok(conn) = db.conn.lock() {
            let _ = conn.execute(
                "UPDATE attachments SET data_url = ?1 WHERE id = ?2",
                params![url, att_id],
            );
        }
    };

    if is_pdf {
        preview_type = "pdf".to_string();
        if data_url.is_none() || data_url.as_deref() == Some("") {
            if let Some(bytes) = &found_bytes {
                if bytes.len() <= 30 * 1024 * 1024 {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
                    let url = format!("data:application/pdf;base64,{}", b64);
                    // Do NOT cache multi-megabyte PDF base64 to SQLite; keep DB file light
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

        // Jika masih belum ada text_content, ambil dari content tabel items (lock singkat)
        if text_content.is_none() {
            if let Ok(conn) = db.conn.lock() {
                if let Ok(raw_content) = conn.query_row(
                    "SELECT content FROM items WHERE id = ?1",
                    params![item_id],
                    |r| r.get::<_, String>(0),
                ) {
                    if !raw_content.trim().is_empty() {
                        text_content = Some(raw_content.chars().take(500_000).collect());
                    }
                }
            }
        }
    } else if is_image {
        preview_type = "image".to_string();
        if data_url.is_none() || data_url.as_deref() == Some("") {
            if let Some(bytes) = &found_bytes {
                if bytes.len() <= 20 * 1024 * 1024 {
                    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
                    let safe_mime = if mime_type.starts_with("image/") {
                        mime_type.clone()
                    } else {
                        format!("image/{}", if extension == "jpg" { "jpeg" } else { &extension })
                    };
                    let url = format!("data:{};base64,{}", safe_mime, b64);
                    // Only cache tiny thumbnails (<= 64KB) in SQLite to prevent bloat
                    if bytes.len() <= 64 * 1024 {
                        cache_data_url(&id, &url);
                    }
                    data_url = Some(url);
                }
            }
        }
    } else if is_audio || is_video {
        preview_type = if is_audio { "audio".to_string() } else { "video".to_string() };
        if data_url.is_none() || data_url.as_deref() == Some("") {
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
