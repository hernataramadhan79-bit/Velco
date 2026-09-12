use rusqlite::params;
use tauri::State;

use crate::commands::items::{ItemSummary, SearchResult, TagMinimal};
use crate::database::Database;

/// Sanitasi query FTS5: mendukung wildcard prefix (*) untuk inisial & pengetikan cepat
fn sanitize_fts_query(query: &str) -> String {
    let tokens: Vec<String> = query
        .split_whitespace()
        .filter_map(|w| {
            let clean: String = w
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                .collect();
            if !clean.is_empty() {
                Some(format!("{}*", clean))
            } else {
                None
            }
        })
        .collect();
    tokens.join(" ")
}

/// Pencarian super cepat menggunakan Inisial, Prefix, Substring, dan FTS5 Ranking
#[tauri::command]
pub fn search_items_v2(
    db: State<'_, Database>,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    let conn = db.read_pool.get().map_err(|e| e.to_string())?;
    let trimmed = query.trim();

    if trimmed.is_empty() {
        // Jika query kosong, kembalikan 50 item terbaru
        let sql = r#"
            SELECT
                i.id,
                COALESCE(i.type, 'note') as type,
                COALESCE(i.title, '') as title,
                COALESCE(SUBSTR(i.content, 1, 120), '') as excerpt,
                CASE WHEN (i.pinned = 1 OR i.favorite = 1) THEN 1 ELSE 0 END as pinned,
                COALESCE(i.archived, 0) as archived,
                CASE WHEN i.deleted_at IS NOT NULL THEN 1 ELSE 0 END as trashed,
                COALESCE(i.created_at, '') as created_at,
                COALESCE(i.updated_at, '') as updated_at,
                COALESCE(
                    (SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color))
                     FROM tags t JOIN item_tags it ON t.id = it.tag_id WHERE it.item_id = i.id),
                    '[]'
                ) as tags_json,
                '' as snippet_text,
                0.0 as rank,
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
                ) as thumbnail_url,
                (SELECT COUNT(*) FROM attachments att WHERE att.item_id = i.id) as attachments_count
            FROM items i
            WHERE i.deleted_at IS NULL
            ORDER BY i.updated_at DESC
            LIMIT 50
        "#;

        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], map_search_row).map_err(|e| e.to_string())?;
        let mut results = Vec::new();
        for r in rows { results.push(r.map_err(|e| e.to_string())?); }
        return Ok(results);
    }

    let fts_query = sanitize_fts_query(trimmed);
    let exact_query = trimmed.to_string();
    let prefix_pattern = format!("{}%", trimmed);
    let substring_pattern = format!("%{}%", trimmed);

    // Pencarian hybrid FTS5 + Prefix Title + Substring Matcher
    let sql = r#"
        SELECT
            i.id,
            COALESCE(i.type, 'note') as type,
            COALESCE(i.title, '') as title,
            COALESCE(SUBSTR(i.content, 1, 120), '') as excerpt,
            CASE WHEN (i.pinned = 1 OR i.favorite = 1) THEN 1 ELSE 0 END as pinned,
            COALESCE(i.archived, 0) as archived,
            CASE WHEN i.deleted_at IS NOT NULL THEN 1 ELSE 0 END as trashed,
            COALESCE(i.created_at, '') as created_at,
            COALESCE(i.updated_at, '') as updated_at,
            COALESCE(
                (SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color))
                 FROM tags t JOIN item_tags it ON t.id = it.tag_id WHERE it.item_id = i.id),
                '[]'
            ) as tags_json,
            COALESCE(
                (
                    SELECT snippet(items_fts, 2, '<b>', '</b>', '...', 20)
                    FROM items_fts
                    WHERE items_fts.item_id = i.id AND ?1 != '' AND items_fts MATCH ?1
                    LIMIT 1
                ),
                ''
            ) as snippet_text,
            (
                CASE
                    -- Rank 0: Judul persis sama
                    WHEN LOWER(i.title) = LOWER(?2) THEN 0.0
                    -- Rank 1: Judul diawali inisial / kata pencarian (misal "d" -> "deepseek...")
                    WHEN LOWER(i.title) LIKE LOWER(?3) THEN 1.0
                    -- Rank 2: Nama file lampiran diawali inisial pencarian
                    WHEN EXISTS (SELECT 1 FROM attachments a WHERE a.item_id = i.id AND LOWER(a.file_name) LIKE LOWER(?3)) THEN 2.0
                    -- Rank 3: Judul mengandung kata pencarian
                    WHEN LOWER(i.title) LIKE LOWER(?4) THEN 3.0
                    -- Rank 4: Nama file lampiran mengandung kata pencarian
                    WHEN EXISTS (SELECT 1 FROM attachments a WHERE a.item_id = i.id AND LOWER(a.file_name) LIKE LOWER(?4)) THEN 4.0
                    -- Rank 5: Konten diawali kata pencarian
                    WHEN LOWER(i.content) LIKE LOWER(?3) THEN 5.0
                    -- Rank 6: Konten mengandung kata pencarian
                    WHEN LOWER(i.content) LIKE LOWER(?4) THEN 6.0
                    ELSE 7.0
                END
            ) as rank,
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
            ) as thumbnail_url,
            (SELECT COUNT(*) FROM attachments att WHERE att.item_id = i.id) as attachments_count
        FROM items i
        WHERE i.deleted_at IS NULL
          AND (
              (?1 != '' AND i.id IN (SELECT item_id FROM items_fts WHERE items_fts MATCH ?1))
              OR LOWER(i.title) LIKE LOWER(?4)
              OR EXISTS (SELECT 1 FROM attachments a WHERE a.item_id = i.id AND LOWER(a.file_name) LIKE LOWER(?4))
          )
        ORDER BY
            rank ASC,
            CASE WHEN (i.pinned = 1 OR i.favorite = 1) THEN 0 ELSE 1 END ASC,
            i.updated_at DESC
        LIMIT 50
    "#;

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(
            params![fts_query, exact_query, prefix_pattern, substring_pattern],
            map_search_row,
        )
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for r in rows {
        match r {
            Ok(sr) => results.push(sr),
            Err(_) => continue,
        }
    }

    Ok(results)
}

/// Helper: map baris query ke SearchResult
fn map_search_row(row: &rusqlite::Row) -> rusqlite::Result<SearchResult> {
    let pinned_val: i64 = row.get(4)?;
    let archived_val: i64 = row.get(5)?;
    let trashed_val: i64 = row.get(6)?;
    let tags_json: String = row.get(9).unwrap_or_else(|_| "[]".to_string());
    let snippet_text: String = row.get(10).unwrap_or_default();
    let rank: f64 = row.get(11).unwrap_or(0.0);
    let thumbnail_url: Option<String> = row.get(12).ok();
    let attachments_count: i64 = row.get(13).unwrap_or(0);

    let tags: Vec<TagMinimal> = serde_json::from_str(&tags_json).unwrap_or_default();

    Ok(SearchResult {
        item: ItemSummary {
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
            task: None,
            link: None,
            attachments_count,
            thumbnail_url,
        },
        snippet: snippet_text,
        rank,
    })
}

/// Command lama — dipertahankan untuk backward compatibility dengan prefix matching
#[tauri::command]
pub fn search_items(db: State<'_, Database>, query: String) -> Result<Vec<crate::commands::items::ItemRecord>, String> {
    let conn = db.read_pool.get().map_err(|e| e.to_string())?;
    let trimmed = query.trim();

    if trimmed.is_empty() {
        let mut stmt = conn
            .prepare("SELECT id FROM items WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 50")
            .map_err(|e| e.to_string())?;
        let ids: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        let mut results = Vec::new();
        for id in ids {
            if let Ok(item) = crate::commands::items::fetch_item_by_id(&conn, &id) {
                results.push(item);
            }
        }
        return Ok(results);
    }

    let fts_query = sanitize_fts_query(trimmed);
    let exact_query = trimmed.to_string();
    let prefix_pattern = format!("{}%", trimmed);
    let substring_pattern = format!("%{}%", trimmed);

    let sql = r#"
        SELECT i.id
        FROM items i
        WHERE i.deleted_at IS NULL
          AND (
              (?1 != '' AND i.id IN (SELECT item_id FROM items_fts WHERE items_fts MATCH ?1))
              OR LOWER(i.title) LIKE LOWER(?4)
              OR EXISTS (SELECT 1 FROM attachments a WHERE a.item_id = i.id AND LOWER(a.file_name) LIKE LOWER(?4))
          )
        ORDER BY
            CASE
                WHEN LOWER(i.title) = LOWER(?2) THEN 0
                WHEN LOWER(i.title) LIKE LOWER(?3) THEN 1
                WHEN EXISTS (SELECT 1 FROM attachments a WHERE a.item_id = i.id AND LOWER(a.file_name) LIKE LOWER(?3)) THEN 2
                WHEN LOWER(i.title) LIKE LOWER(?4) THEN 3
                ELSE 4
            END,
            CASE WHEN (i.pinned = 1 OR i.favorite = 1) THEN 0 ELSE 1 END ASC,
            i.updated_at DESC
        LIMIT 50
    "#;

    let mut item_ids: Vec<String> = Vec::new();
    if let Ok(mut stmt) = conn.prepare(sql) {
        if let Ok(rows) = stmt.query_map(params![fts_query, exact_query, prefix_pattern, substring_pattern], |row| row.get::<_, String>(0)) {
            item_ids = rows.filter_map(|r| r.ok()).collect();
        }
    }

    let mut results = Vec::new();
    for id in item_ids {
        if let Ok(item) = crate::commands::items::fetch_item_by_id(&conn, &id) {
            results.push(item);
        }
    }
    Ok(results)
}
