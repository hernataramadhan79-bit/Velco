use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::database::Database;

// ─── Response Types ──────────────────────────────────────────────────────────

/// Ringkasan sesi untuk list view (dropdown history)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatSessionSummary {
    pub id: String,
    pub title: String,
    pub origin: String,
    pub updated_at: i64,
    pub created_at: i64,
    pub message_count: i64,
    pub last_message_preview: Option<String>,
}

/// Record pesan lengkap untuk tampilan chat
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessageRecord {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub staged_item_ids: Option<String>,
    pub error: Option<String>,
    pub timestamp: i64,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Generate ID unik berdasarkan timestamp + xorshift
fn new_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let mut x = ts ^ (ts >> 16);
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    format!("{:x}-{:x}", ts, x)
}

/// Timestamp unix millisecond sekarang
fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// Auto-generate judul dari 50 karakter pertama pesan user
fn auto_title(first_message: &str) -> String {
    let trimmed = first_message.trim();
    if trimmed.is_empty() {
        return "New Chat".to_string();
    }
    let char_count = trimmed.chars().count();
    if char_count <= 50 {
        trimmed.to_string()
    } else {
        let mut title: String = trimmed.chars().take(50).collect();
        title.push('…');
        title
    }
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// Buat sesi chat baru. `first_message` (opsional) dipakai untuk auto-generate judul.
/// Returns session ID.
#[tauri::command]
pub fn create_chat_session(
    origin: String,
    first_message: Option<String>,
    db: State<'_, Database>,
) -> Result<String, String> {
    let conn = db.write_conn.lock().map_err(|e| e.to_string())?;

    let id = new_id();
    let now = now_ms();
    let title = first_message
        .as_deref()
        .map(auto_title)
        .unwrap_or_else(|| "New Chat".to_string());

    conn.execute(
        "INSERT INTO chat_sessions (id, title, origin, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4)",
        params![id, title, origin, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(id)
}

/// Tambahkan pesan ke sesi. Update `updated_at` sesi secara atomik.
/// Returns message ID.
#[tauri::command]
pub fn append_chat_message(
    session_id: String,
    role: String,
    content: String,
    staged_item_ids: Option<String>,
    db: State<'_, Database>,
) -> Result<String, String> {
    let conn = db.write_conn.lock().map_err(|e| e.to_string())?;

    let msg_id = new_id();
    let now = now_ms();

    conn.execute(
        "INSERT INTO chat_messages
             (id, session_id, role, content, staged_item_ids, error, timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6)",
        params![msg_id, session_id, role, content, staged_item_ids, now],
    )
    .map_err(|e| e.to_string())?;

    // Update session updated_at
    conn.execute(
        "UPDATE chat_sessions SET updated_at = ?1 WHERE id = ?2",
        params![now, session_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(msg_id)
}

/// Daftar semua sesi diurutkan updated_at DESC, sertakan ringkasan pesan terakhir.
#[tauri::command]
pub fn list_chat_sessions(db: State<'_, Database>) -> Result<Vec<ChatSessionSummary>, String> {
    let pool_conn = db.read_pool.get().map_err(|e| e.to_string())?;

    let mut stmt = pool_conn
        .prepare(
            r#"
            SELECT
                s.id,
                s.title,
                s.origin,
                s.updated_at,
                s.created_at,
                COUNT(m.id) AS message_count,
                (
                    SELECT content FROM chat_messages
                    WHERE session_id = s.id
                    ORDER BY timestamp DESC
                    LIMIT 1
                ) AS last_preview
            FROM chat_sessions s
            LEFT JOIN chat_messages m ON m.session_id = s.id
            GROUP BY s.id
            ORDER BY s.updated_at DESC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let last_preview: Option<String> = row.get(6)?;
            Ok(ChatSessionSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                origin: row.get(2)?,
                updated_at: row.get(3)?,
                created_at: row.get(4)?,
                message_count: row.get(5)?,
                last_message_preview: last_preview.map(|p| {
                    let trimmed = p.trim();
                    if trimmed.chars().count() > 80 {
                        let mut preview: String = trimmed.chars().take(80).collect();
                        preview.push('…');
                        preview
                    } else {
                        trimmed.to_string()
                    }
                }),
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

/// Ambil semua pesan dalam satu sesi, diurutkan timestamp ASC.
#[tauri::command]
pub fn get_chat_session_messages(
    session_id: String,
    db: State<'_, Database>,
) -> Result<Vec<ChatMessageRecord>, String> {
    let pool_conn = db.read_pool.get().map_err(|e| e.to_string())?;

    let mut stmt = pool_conn
        .prepare(
            "SELECT id, session_id, role, content, staged_item_ids, error, timestamp
             FROM chat_messages
             WHERE session_id = ?1
             ORDER BY timestamp ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(ChatMessageRecord {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                staged_item_ids: row.get(4)?,
                error: row.get(5)?,
                timestamp: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

/// Rename judul sesi.
#[tauri::command]
pub fn rename_chat_session(
    session_id: String,
    new_title: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let conn = db.write_conn.lock().map_err(|e| e.to_string())?;
    let now = now_ms();

    conn.execute(
        "UPDATE chat_sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
        params![new_title, now, session_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Hapus sesi. ON DELETE CASCADE otomatis menghapus semua chat_messages terkait.
#[tauri::command]
pub fn delete_chat_session(
    session_id: String,
    db: State<'_, Database>,
) -> Result<(), String> {
    let conn = db.write_conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM chat_sessions WHERE id = ?1",
        params![session_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Migrasi satu kali dari localStorage legacy ke chat_sessions.
/// Frontend mengirimkan JSON string dari localStorage key 'velco-context-chat-storage'.
/// Returns true jika migrasi baru dijalankan, false jika sudah pernah atau tidak ada data.
#[tauri::command]
pub fn migrate_legacy_chat(
    serialized_messages: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    let conn = db.write_conn.lock().map_err(|e| e.to_string())?;

    // Cek apakah sudah pernah dimigrasi
    let already_migrated: bool = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'chat_legacy_migrated'",
            [],
            |row| {
                let val: String = row.get(0)?;
                Ok(val == "1")
            },
        )
        .unwrap_or(false);

    if already_migrated {
        return Ok(false);
    }

    // Tandai migrated dulu (bahkan jika data kosong — supaya tidak jalan dobel)
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('chat_legacy_migrated', '1')",
        [],
    )
    .map_err(|e| e.to_string())?;

    // Parse messages dari JSON zustand persist format: { state: { messages: [...] } }
    let parsed: serde_json::Value = match serde_json::from_str(&serialized_messages) {
        Ok(v) => v,
        Err(_) => return Ok(false),
    };

    let messages = match parsed
        .get("state")
        .and_then(|s| s.get("messages"))
        .and_then(|m| m.as_array())
    {
        Some(arr) if !arr.is_empty() => arr.clone(),
        _ => return Ok(false),
    };

    // Buat sesi "Imported Chat"
    let session_id = new_id();
    let now = now_ms();

    conn.execute(
        "INSERT INTO chat_sessions (id, title, origin, created_at, updated_at)
         VALUES (?1, 'Imported Chat', 'playground', ?2, ?2)",
        params![session_id, now],
    )
    .map_err(|e| e.to_string())?;

    // Insert semua messages
    for msg in &messages {
        let id = new_id();
        let role = msg
            .get("role")
            .and_then(|v| v.as_str())
            .unwrap_or("user")
            .to_string();
        let content = msg
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let timestamp = msg
            .get("timestamp")
            .and_then(|v| v.as_i64())
            .unwrap_or(now);
        // stagedItemIds array dari legacy → serialize ke JSON string
        let staged_ids: Option<String> = msg
            .get("stagedItemIds")
            .and_then(|v| {
                if v.is_null() || (v.is_array() && v.as_array().map(|a| a.is_empty()).unwrap_or(true)) {
                    None
                } else {
                    serde_json::to_string(v).ok()
                }
            });

        conn.execute(
            "INSERT INTO chat_messages
                 (id, session_id, role, content, staged_item_ids, error, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6)",
            params![id, session_id, role, content, staged_ids, timestamp],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(true)
}
