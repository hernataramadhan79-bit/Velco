/// Jalankan migrasi skema database berbasis PRAGMA user_version.
/// Setiap versi bersifat idempoten dan dieksekusi secara berurutan.
pub fn run_migrations(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    let version: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;

    if version < 1 {
        conn.execute_batch(MIGRATION_V1)?;
        conn.execute_batch("PRAGMA user_version = 1")?;
    }
    if version < 2 {
        conn.execute_batch(MIGRATION_V2)?;
        conn.execute_batch("PRAGMA user_version = 2")?;
    }

    Ok(())
}

/// V1: Tabel inti + indexes
const MIGRATION_V1: &str = r#"
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'direct',
    status TEXT NOT NULL DEFAULT 'inbox',
    favorite INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    trashed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY NOT NULL,
    item_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    checksum TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    data_url TEXT,
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item_tags (
    item_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY(item_id, tag_id),
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    item_id TEXT NOT NULL UNIQUE,
    due_date TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    notified INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS links (
    id TEXT PRIMARY KEY NOT NULL,
    item_id TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    domain TEXT NOT NULL DEFAULT '',
    page_title TEXT NOT NULL DEFAULT '',
    preview_image TEXT,
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS content_index (
    item_id TEXT PRIMARY KEY NOT NULL,
    plain_text TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'en',
    word_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_metadata (
    id TEXT PRIMARY KEY NOT NULL,
    item_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    summary TEXT,
    classification TEXT,
    confidence REAL,
    suggested_tags TEXT,
    processed_at TEXT NOT NULL,
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

-- Indexes untuk performa
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_deleted_at ON items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
CREATE INDEX IF NOT EXISTS idx_items_pinned ON items(pinned);
CREATE INDEX IF NOT EXISTS idx_items_trashed ON items(trashed);
CREATE INDEX IF NOT EXISTS idx_item_tags_item ON item_tags(item_id);
CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_notified ON tasks(notified);
CREATE INDEX IF NOT EXISTS idx_attachments_item ON attachments(item_id);

-- Migrasi kolom existing jika DB sudah ada (idempoten via IF NOT EXISTS tidak berlaku untuk kolom)
-- Gunakan IGNORE untuk kolom yang sudah ada
"#;

/// V2: FTS5 content-rowid mode + 3 trigger otomatis
const MIGRATION_V2: &str = r#"
-- Hapus FTS lama jika ada (skema berbeda)
DROP TABLE IF EXISTS items_fts;

-- FTS5 dengan content-rowid mode: rowid = items.id
CREATE VIRTUAL TABLE items_fts USING fts5(
    title,
    content,
    content='items',
    content_rowid='id',
    tokenize='porter unicode61 remove_diacritics 1'
);

-- Rebuild index dari data existing
INSERT INTO items_fts(rowid, title, content)
SELECT id, title, content FROM items;

-- Trigger AFTER INSERT: tambah ke FTS
CREATE TRIGGER IF NOT EXISTS items_ai
AFTER INSERT ON items BEGIN
    INSERT INTO items_fts(rowid, title, content)
    VALUES (new.id, new.title, new.content);
END;

-- Trigger AFTER DELETE: hapus dari FTS
CREATE TRIGGER IF NOT EXISTS items_ad
AFTER DELETE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, content)
    VALUES ('delete', old.id, old.title, old.content);
END;

-- Trigger AFTER UPDATE: update FTS
CREATE TRIGGER IF NOT EXISTS items_au
AFTER UPDATE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, content)
    VALUES ('delete', old.id, old.title, old.content);
    INSERT INTO items_fts(rowid, title, content)
    VALUES (new.id, new.title, new.content);
END;
"#;
