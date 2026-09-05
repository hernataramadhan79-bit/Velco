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

    let rows = stmt
        .query_map(params![fts_query], |row| {
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
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for item_res in rows {
        results.push(item_res.map_err(|e| e.to_string())?);
    }
    Ok(results)
}
