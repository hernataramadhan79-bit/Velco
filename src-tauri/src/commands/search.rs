use rusqlite::params;
use tauri::State;

use crate::commands::items::ItemRecord;
use crate::database::Database;

#[tauri::command]
pub fn search_items(db: State<'_, Database>, query: String) -> Result<Vec<ItemRecord>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let fts_query = format!("{}*", query.trim().replace('"', "\"\""));

    let mut stmt = conn
        .prepare(
            r#"
            SELECT i.id, i.type, i.title, i.content, i.source, i.status, i.favorite, i.archived, i.created_at, i.updated_at, i.deleted_at
            FROM items_fts f
            JOIN items i ON f.item_id = i.id
            WHERE items_fts MATCH ?1 AND i.deleted_at IS NULL
            ORDER BY rank
            LIMIT 50
            "#,
        )
        .map_err(|e| e.to_string())?;

    let id_rows = stmt
        .query_map(params![fts_query], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for id in id_rows.flatten() {
        if let Ok(item) = crate::commands::items::fetch_item_by_id(&conn, &id) {
            results.push(item);
        }
    }
    Ok(results)
}
