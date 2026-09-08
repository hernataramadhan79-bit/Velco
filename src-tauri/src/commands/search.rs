use rusqlite::params;
use tauri::State;

use crate::commands::items::{ItemSummary, SearchResult, TagMinimal};
use crate::database::Database;

/// Sanitasi query FTS5: hilangkan karakter berbahaya, pertahankan alphanumeric
fn sanitize_fts_query(query: &str) -> String {
    let tokens: Vec<String> = query
        .split_whitespace()
        .filter_map(|w| {
            let clean: String = w
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                .collect();
            if clean.len() >= 2 { Some(format!("\"{}\"", clean)) } else { None }
        })
        .collect();
    tokens.join(" ")
}

/// Pencarian menggunakan FTS5 MATCH + BM25 ranking + snippet()
#[tauri::command]
pub fn search_items_v2(
    db: State<'_, Database>,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let trimmed = query.trim();

    if trimmed.is_empty() {
        // Jika query kosong, kembalikan 50 item terbaru
        let sql = r#"
            SELECT
                i.id, i.type, i.title,
                COALESCE(SUBSTR(i.content, 1, 120), '') as excerpt,
                COALESCE(i.pinned, i.favorite, 0) as pinned,
                i.archived,
                CASE WHEN i.deleted_at IS NOT NULL THEN 1 ELSE 0 END as trashed,
                i.created_at, i.updated_at,
                COALESCE(
                    (SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color))
                     FROM tags t JOIN item_tags it ON t.id = it.tag_id WHERE it.item_id = i.id),
                    '[]'
                ) as tags_json,
                '' as snippet_text,
                0.0 as rank
            FROM items i
            WHERE i.deleted_at IS NULL
            ORDER BY i.updated_at DESC
            LIMIT 50
        "#;

        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| map_search_row(row)).map_err(|e| e.to_string())?;
        let mut results = Vec::new();
        for r in rows { results.push(r.map_err(|e| e.to_string())?); }
        return Ok(results);
    }

    let fts_query = sanitize_fts_query(trimmed);
    if fts_query.is_empty() {
        return Ok(vec![]);
    }

    // Pencarian FTS5 dengan BM25 ranking dan snippet
    let sql = r#"
        SELECT
            i.id, i.type, i.title,
            COALESCE(SUBSTR(i.content, 1, 120), '') as excerpt,
            COALESCE(i.pinned, i.favorite, 0) as pinned,
            i.archived,
            CASE WHEN i.deleted_at IS NOT NULL THEN 1 ELSE 0 END as trashed,
            i.created_at, i.updated_at,
            COALESCE(
                (SELECT json_group_array(json_object('id', t.id, 'name', t.name, 'color', t.color))
                 FROM tags t JOIN item_tags it ON t.id = it.tag_id WHERE it.item_id = i.id),
                '[]'
            ) as tags_json,
            snippet(items_fts, 1, '<b>', '</b>', '...', 20) as snippet_text,
            bm25(items_fts) as rank
        FROM items_fts
        JOIN items i ON items_fts.rowid = i.id
        WHERE items_fts MATCH ?1 AND i.deleted_at IS NULL
        ORDER BY bm25(items_fts)
        LIMIT 50
    "#;

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![fts_query], |row| map_search_row(row))
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for r in rows {
        match r {
            Ok(sr) => results.push(sr),
            Err(_) => continue, // skip baris bermasalah
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
        },
        snippet: snippet_text,
        rank,
    })
}

/// Command lama — dipertahankan untuk backward compatibility
#[tauri::command]
pub fn search_items(db: State<'_, Database>, query: String) -> Result<Vec<crate::commands::items::ItemRecord>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
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
    if fts_query.is_empty() {
        return Ok(vec![]);
    }

    let mut item_ids: Vec<String> = Vec::new();
    if let Ok(mut stmt) = conn.prepare(
        "SELECT i.id FROM items_fts JOIN items i ON items_fts.rowid = i.id WHERE items_fts MATCH ?1 AND i.deleted_at IS NULL ORDER BY bm25(items_fts) LIMIT 50"
    ) {
        if let Ok(rows) = stmt.query_map(params![fts_query], |row| row.get::<_, String>(0)) {
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
