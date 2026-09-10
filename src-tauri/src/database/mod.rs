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

        // Konfigurasi PRAGMA untuk performa dan ketahanan.
        // Kegagalan PRAGMA kritis (WAL/foreign_keys) kini dilog ke stderr agar tidak fail-silent.
        apply_pragma(&conn, "PRAGMA journal_mode = WAL", true);
        apply_pragma(&conn, "PRAGMA synchronous = NORMAL", false);
        apply_pragma(&conn, "PRAGMA busy_timeout = 5000", false);
        apply_pragma(&conn, "PRAGMA foreign_keys = ON", true);
        apply_pragma(&conn, "PRAGMA cache_size = -64000", false);
        apply_pragma(&conn, "PRAGMA temp_store = MEMORY", false);
        apply_pragma(&conn, "PRAGMA mmap_size = 268435456", false);

        // Jalankan migrasi berbasis user_version
        schema::run_migrations(&conn)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(
                format!("Migration failed: {}", e).into()
            ))?;

        // Index tambahan untuk pencarian inisial & prefix cepat
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_items_title ON items(title)", []);
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_attachments_name ON attachments(file_name)", []);

        // Normalisasi item lawas bertipe 'text' agar menjadi 'note'
        let _ = conn.execute("UPDATE items SET type = 'note' WHERE type = 'text'", []);

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}

/// Eksekusi PRAGMA. `critical=true` → log warning bila gagal (sebelumnya ditelan diam-diam).
fn apply_pragma(conn: &Connection, pragma_sql: &str, critical: bool) {
    match conn.prepare(pragma_sql) {
        Ok(mut stmt) => match stmt.query([]) {
            Ok(mut rows) => {
                let _ = rows.next();
            }
            Err(e) if critical => {
                eprintln!("Warning: PRAGMA failed '{}': {}", pragma_sql, e);
            }
            _ => {}
        },
        Err(e) if critical => {
            eprintln!("Warning: PRAGMA prepare failed '{}': {}", pragma_sql, e);
        }
        _ => {}
    }
}
