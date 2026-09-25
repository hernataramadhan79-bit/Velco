pub mod schema;

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::{Connection, Result};
use std::path::Path;
use std::sync::Mutex;

pub struct Database {
    pub write_conn: Mutex<Connection>,
    pub read_pool: Pool<SqliteConnectionManager>,
}

impl Database {
        pub fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let conn = Connection::open(path.as_ref())?;

        apply_pragma(&conn, "PRAGMA journal_mode = WAL", true);
        apply_pragma(&conn, "PRAGMA synchronous = NORMAL", false);
        apply_pragma(&conn, "PRAGMA busy_timeout = 5000", false);
        apply_pragma(&conn, "PRAGMA foreign_keys = ON", true);
        apply_pragma(&conn, "PRAGMA cache_size = -64000", false);
        apply_pragma(&conn, "PRAGMA temp_store = MEMORY", false);
        apply_pragma(&conn, "PRAGMA mmap_size = 268435456", false);

        schema::run_migrations(&conn)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(
                format!("Migration failed: {}", e).into()
            ))?;

        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_items_title ON items(title)", []);
        let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_attachments_name ON attachments(file_name)", []);
        let _ = conn.execute("UPDATE items SET type = 'note' WHERE type = 'text'", []);
        let _ = conn.execute("DELETE FROM chat_sessions WHERE id NOT IN (SELECT DISTINCT session_id FROM chat_messages)", []);

        let manager = SqliteConnectionManager::file(path.as_ref())
            .with_init(|conn| {
                apply_pragma(conn, "PRAGMA synchronous = NORMAL", false);
                apply_pragma(conn, "PRAGMA busy_timeout = 5000", false);
                apply_pragma(conn, "PRAGMA foreign_keys = ON", false);
                apply_pragma(conn, "PRAGMA cache_size = -32000", false);
                apply_pragma(conn, "PRAGMA temp_store = MEMORY", false);
                Ok(())
            });
        let pool = Pool::builder()
            .max_size(4)
            .build(manager)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(format!("Pool creation failed: {}", e).into()))?;

        Ok(Self {
            write_conn: Mutex::new(conn),
            read_pool: pool,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_new_file_initialization() {
        let temp_dir = std::env::temp_dir();
        let db_file = temp_dir.join(format!("velco_test_{}.db", uuid::Uuid::new_v4()));

        let db = Database::new(&db_file).expect("Database::new failed to initialize");
        let pool_conn = db.read_pool.get().expect("Failed to acquire connection from pool");

        let busy_timeout: i64 = pool_conn
            .query_row("PRAGMA busy_timeout", [], |r| r.get(0))
            .expect("Failed to read busy_timeout");
        assert_eq!(busy_timeout, 5000);

        let _ = std::fs::remove_file(&db_file);
    }
}
