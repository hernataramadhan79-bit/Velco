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
        conn.execute_batch("
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA busy_timeout = 5000;
            PRAGMA foreign_keys = ON;
            PRAGMA cache_size = -64000;
            PRAGMA temp_store = MEMORY;
            PRAGMA mmap_size = 268435456;
        ").map_err(|e| rusqlite::Error::ToSqlConversionFailure(
            format!("PRAGMA setup failed: {}", e).into()
        ))?;

        // Jalankan migrasi berbasis user_version
        schema::run_migrations(&conn)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(
                format!("Migration failed: {}", e).into()
            ))?;

        // Migrasi kolom legacy (idempoten — error diabaikan jika kolom sudah ada)
        let _ = conn.execute("ALTER TABLE items ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE items ADD COLUMN trashed INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE tasks ADD COLUMN notified INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE attachments ADD COLUMN data_url TEXT", []);
        let _ = conn.execute("ALTER TABLE ai_metadata ADD COLUMN suggested_tags TEXT", []);
        let _ = conn.execute_batch("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)");

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}
