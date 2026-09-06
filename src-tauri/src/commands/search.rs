use rusqlite::params;
use tauri::State;

use crate::commands::items::ItemRecord;
use crate::database::Database;

#[tauri::command]
pub fn search_items(db: State<'_, Database>, query: String) -> Result<Vec<ItemRecord>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let trimmed = query.trim();

    // 1. If query is empty, return up to 50 most recent items
    if trimmed.is_empty() {
        let mut stmt = conn
            .prepare(
                "SELECT id FROM items WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 50",
            )
            .map_err(|e| e.to_string())?;
        let id_rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;

        let mut results = Vec::new();
        for id in id_rows.flatten() {
            if let Ok(item) = crate::commands::items::fetch_item_by_id(&conn, &id) {
                results.push(item);
            }
        }
        return Ok(results);
    }

    let mut item_ids: Vec<String> = Vec::new();

    // 2. Sanitize query tokens for FTS5 (strip control characters and quotes)
    let clean_tokens: Vec<String> = trimmed
        .split_whitespace()
        .map(|w| {
            w.chars()
                .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '.')
                .collect::<String>()
        })
        .filter(|w| !w.is_empty())
        .collect();

    if !clean_tokens.is_empty() {
        let fts_query = clean_tokens
            .iter()
            .map(|t| format!("\"{}\"*", t))
            .collect::<Vec<_>>()
            .join(" ");

        let fts_res = conn.prepare(
            r#"
            SELECT i.id
            FROM items_fts f
            JOIN items i ON f.item_id = i.id
            WHERE items_fts MATCH ?1 AND i.deleted_at IS NULL
            ORDER BY rank
            LIMIT 50
            "#,
        );

        if let Ok(mut stmt) = fts_res {
            if let Ok(rows) = stmt.query_map(params![fts_query], |row| row.get::<_, String>(0)) {
                for id in rows.flatten() {
                    if !item_ids.contains(&id) {
                        item_ids.push(id);
                    }
                }
            }
        }
    }

    // 3. Search matching tags (e.g. searching for a tag name directly)
    let tag_like = format!("%{}%", trimmed);
    if let Ok(mut tag_stmt) = conn.prepare(
        r#"
        SELECT DISTINCT it.item_id
        FROM tags t
        JOIN item_tags it ON t.id = it.tag_id
        JOIN items i ON it.item_id = i.id
        WHERE i.deleted_at IS NULL AND (t.name LIKE ?1 OR t.name = ?2)
        LIMIT 20
        "#,
    ) {
        if let Ok(tag_rows) = tag_stmt.query_map(params![tag_like, trimmed], |row| row.get::<_, String>(0)) {
            for id in tag_rows.flatten() {
                if !item_ids.contains(&id) {
                    item_ids.push(id);
                }
            }
        }
    }

    // 4. Fallback LIKE search if FTS produced few or no results
    if item_ids.len() < 10 {
        let like_param = format!("%{}%", trimmed);
        if let Ok(mut like_stmt) = conn.prepare(
            r#"
            SELECT id FROM items
            WHERE deleted_at IS NULL AND (title LIKE ?1 OR content LIKE ?1)
            ORDER BY updated_at DESC
            LIMIT 50
            "#,
        ) {
            if let Ok(like_rows) = like_stmt.query_map(params![like_param], |row| row.get::<_, String>(0)) {
                for id in like_rows.flatten() {
                    if !item_ids.contains(&id) {
                        item_ids.push(id);
                    }
                }
            }
        }
    }

    let mut results = Vec::new();
    for id in item_ids.into_iter().take(50) {
        if let Ok(item) = crate::commands::items::fetch_item_by_id(&conn, &id) {
            results.push(item);
        }
    }

    Ok(results)
}
