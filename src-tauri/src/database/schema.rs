/// Jalankan migrasi skema database berbasis PRAGMA user_version.
/// Setiap versi bersifat idempoten dan dieksekusi secara berurutan.
pub fn run_migrations(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    let version: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap_or(0);

    if version < 1 {
        // 1. Buat tabel-tabel inti
        conn.execute_batch(MIGRATION_V1_TABLES)?;

        // 2. Pastikan kolom-kolom baru tersedia pada database existing yang sudah memiliki tabel
        let _ = conn.execute("ALTER TABLE items ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE items ADD COLUMN trashed INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE tasks ADD COLUMN notified INTEGER NOT NULL DEFAULT 0", []);
        let _ = conn.execute("ALTER TABLE attachments ADD COLUMN data_url TEXT", []);
        let _ = conn.execute("ALTER TABLE ai_metadata ADD COLUMN suggested_tags TEXT", []);

        // 3. Buat indexes setelah kolom dipastikan ada
        conn.execute_batch(MIGRATION_V1_INDEXES)?;

        // Update versi skema
        conn.pragma_update(None, "user_version", 1)?;
    }
    if version < 2 {
        conn.execute_batch(MIGRATION_V2)?;
        conn.pragma_update(None, "user_version", 2)?;
    }
    if version < 3 {
        conn.execute_batch(MIGRATION_V3)?;
        conn.pragma_update(None, "user_version", 3)?;
    }
    if version < 4 {
        conn.execute_batch(MIGRATION_V4)?;
        conn.pragma_update(None, "user_version", 4)?;
    }

    Ok(())
}

/// V1: Tabel inti
const MIGRATION_V1_TABLES: &str = r#"
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
"#;

/// V1: Indexes untuk performa
const MIGRATION_V1_INDEXES: &str = r#"
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
"#;

/// V2: FTS5 dengan item_id UNINDEXED (mendukung UUID) + 3 trigger otomatis
const MIGRATION_V2: &str = r#"
-- Hapus FTS lama jika ada
DROP TRIGGER IF EXISTS items_ai;
DROP TRIGGER IF EXISTS items_ad;
DROP TRIGGER IF EXISTS items_au;
DROP TABLE IF EXISTS items_fts;

-- FTS5 dengan item_id UNINDEXED untuk menyimpan UUID
CREATE VIRTUAL TABLE items_fts USING fts5(
    item_id UNINDEXED,
    title,
    content,
    tokenize='porter unicode61 remove_diacritics 1'
);

-- Rebuild index dari data existing
INSERT INTO items_fts(item_id, title, content)
SELECT id, title, content FROM items;

-- Trigger AFTER INSERT: tambah ke FTS otomatis
CREATE TRIGGER IF NOT EXISTS items_ai
AFTER INSERT ON items BEGIN
    INSERT INTO items_fts(item_id, title, content)
    VALUES (new.id, new.title, new.content);
END;

-- Trigger AFTER DELETE: hapus dari FTS otomatis
CREATE TRIGGER IF NOT EXISTS items_ad
AFTER DELETE ON items BEGIN
    DELETE FROM items_fts WHERE item_id = old.id;
END;

-- Trigger AFTER UPDATE: update FTS otomatis
CREATE TRIGGER IF NOT EXISTS items_au
AFTER UPDATE ON items BEGIN
    DELETE FROM items_fts WHERE item_id = old.id;
    INSERT INTO items_fts(item_id, title, content)
    VALUES (new.id, new.title, new.content);
END;
"#;

/// V3: Index tambahan untuk ORDER BY updated_at + filter kombinasi.
/// Sebelumnya tidak ada index updated_at padahal dipakai di search_items_v2,
/// search_items, dan get_items_summary (ORDER BY updated_at/created_at DESC).
const MIGRATION_V3: &str = r#"
CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_status_trash ON items(status, archived, deleted_at);
"#;

/// V4: Tabel capsules & capsule_items untuk Context Hub
const MIGRATION_V4: &str = r#"
CREATE TABLE IF NOT EXISTS capsules (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'Host',
    encryption_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS capsule_items (
    capsule_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    added_at TEXT NOT NULL,
    PRIMARY KEY(capsule_id, item_id),
    FOREIGN KEY(capsule_id) REFERENCES capsules(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_capsule_items_capsule ON capsule_items(capsule_id);
CREATE INDEX IF NOT EXISTS idx_capsule_items_item ON capsule_items(item_id);
"#;

