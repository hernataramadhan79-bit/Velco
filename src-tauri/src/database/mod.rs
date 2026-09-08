pub mod schema;

use rusqlite::{Connection, Result};
use std::path::Path;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path)?;

        // Konfigurasi PRAGMA untuk performa dan ketahanan
        apply_pragma(&conn, "PRAGMA journal_mode = WAL");
        apply_pragma(&conn, "PRAGMA synchronous = NORMAL");
        apply_pragma(&conn, "PRAGMA busy_timeout = 5000");
        apply_pragma(&conn, "PRAGMA foreign_keys = ON");
        apply_pragma(&conn, "PRAGMA cache_size = -64000");
        apply_pragma(&conn, "PRAGMA temp_store = MEMORY");
        apply_pragma(&conn, "PRAGMA mmap_size = 268435456");

        // Jalankan migrasi berbasis user_version
        schema::run_migrations(&conn)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(
                format!("Migration failed: {}", e).into()
            ))?;

        // Index tambahan untuk pencarian inisial & prefix cepat
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_items_title ON items(title)", []);
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_attachments_name ON attachments(file_name)", []);

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}

/// Eksekusi PRAGMA secara aman, mengabaikan apakah menghasilkan baris (seperti journal_mode/mmap) atau tidak
fn apply_pragma(conn: &Connection, pragma_sql: &str) {
    if let Ok(mut stmt) = conn.prepare(pragma_sql) {
        if let Ok(mut rows) = stmt.query([]) {
            let _ = rows.next();
        }
    }
}
