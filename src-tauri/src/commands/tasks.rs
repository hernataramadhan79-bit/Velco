use rusqlite::params;
use tauri::State;

use crate::database::Database;

#[tauri::command]
pub fn toggle_task_complete(
    db: State<'_, Database>,
    item_id: String,
    completed: bool,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let completed_at = if completed {
        Some(chrono::Utc::now().to_rfc3339())
    } else {
        None
    };

    conn.execute(
        "UPDATE tasks SET completed = ?1, completed_at = ?2 WHERE item_id = ?3",
        params![if completed { 1 } else { 0 }, completed_at, item_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE items SET updated_at = ?1 WHERE id = ?2",
        params![chrono::Utc::now().to_rfc3339(), item_id],
    )
    .ok();

    Ok(())
}

/// Reset flag notified agar task bisa kembali mengirim notifikasi
/// (dipanggil frontend saat user mengubah due_date)
#[tauri::command]
pub fn reset_task_notified(
    db: State<'_, Database>,
    item_id: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tasks SET notified = 0 WHERE item_id = ?1",
        params![item_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
