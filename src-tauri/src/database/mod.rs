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
        conn.execute("PRAGMA foreign_keys = ON;", [])
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(format!("foreign_keys failed: {}", e).into()))?;
        
        let _mode: String = conn.query_row("PRAGMA journal_mode = WAL;", [], |r| r.get(0))
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(format!("journal_mode failed: {}", e).into()))?;

        conn.execute_batch(schema::INITIAL_SCHEMA)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(format!("schema failed: {}", e).into()))?;

        // Migration: add data_url to attachments if not present
        conn.execute("ALTER TABLE attachments ADD COLUMN data_url TEXT;", []).ok();

        // Migration: add suggested_tags to ai_metadata if not present
        conn.execute("ALTER TABLE ai_metadata ADD COLUMN suggested_tags TEXT;", []).ok();

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}
