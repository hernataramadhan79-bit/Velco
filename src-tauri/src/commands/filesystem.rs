use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::database::Database;
use crate::filesystem::StorageManager;

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}

/// Export catatan ke folder lokal sebagai file .md dengan YAML frontmatter
#[tauri::command]
pub fn export_notes_to_folder(
    db: State<'_, Database>,
    folder_path: String,
    item_ids: Option<Vec<String>>,
) -> Result<usize, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let target_dir = PathBuf::from(&folder_path);

    fs::create_dir_all(&target_dir).map_err(|e| format!("Cannot create folder: {}", e))?;

    // Ambil items dari DB
    let sql = if item_ids.is_some() {
        "SELECT i.id, i.title, i.content, i.created_at, \
         COALESCE((SELECT json_group_array(json_object('name', t.name)) FROM tags t JOIN item_tags it ON t.id = it.tag_id WHERE it.item_id = i.id), '[]') as tags_json \
         FROM items i WHERE i.deleted_at IS NULL AND i.type = 'note'"
    } else {
        "SELECT i.id, i.title, i.content, i.created_at, \
         COALESCE((SELECT json_group_array(json_object('name', t.name)) FROM tags t JOIN item_tags it ON t.id = it.tag_id WHERE it.item_id = i.id), '[]') as tags_json \
         FROM items i WHERE i.deleted_at IS NULL AND i.type = 'note'"
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4).unwrap_or_else(|_| "[]".to_string()),
        ))
    }).map_err(|e| e.to_string())?;

    let mut exported = 0usize;
    for row in rows.flatten() {
        let (id, title, content, created_at, tags_json) = row;

        // Filter jika item_ids diberikan
        if let Some(ref ids) = item_ids {
            if !ids.contains(&id) {
                continue;
            }
        }

        // Parse tags untuk frontmatter
        let tags: Vec<serde_json::Value> = serde_json::from_str(&tags_json).unwrap_or_default();
        let tag_names: Vec<String> = tags
            .iter()
            .filter_map(|t| t.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
            .collect();
        let tags_yaml = if tag_names.is_empty() {
            "tags: []".to_string()
        } else {
            format!("tags: [{}]", tag_names.iter().map(|t| format!("\"{}\"", t)).collect::<Vec<_>>().join(", "))
        };

        // Buat nama file aman dengan UUID prefix
        let slug = title
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-')
            .take(50)
            .collect::<String>()
            .trim()
            .replace(' ', "_")
            .to_lowercase();
        let file_name = format!("{}-{}.md", &id[..8], slug);
        let file_path = target_dir.join(&file_name);

        let frontmatter = format!(
            "---\nid: {}\ntitle: \"{}\"\ncreated_at: {}\n{}\n---\n\n",
            id,
            title.replace('"', "\\\""),
            created_at,
            tags_yaml
        );

        let full_content = format!("{}{}", frontmatter, content);
        fs::write(&file_path, full_content).map_err(|e| format!("Write error {}: {}", file_name, e))?;
        exported += 1;
    }

    Ok(exported)
}

/// Import folder berisi file .md ke database (idempoten berdasarkan frontmatter id)
#[tauri::command]
pub fn import_folder_as_notes(
    db: State<'_, Database>,
    folder_path: String,
) -> Result<ImportResult, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let source_dir = PathBuf::from(&folder_path);

    if !source_dir.is_dir() {
        return Err(format!("Folder not found: {}", folder_path));
    }

    let entries = fs::read_dir(&source_dir).map_err(|e| e.to_string())?;
    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut errors = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        let raw = match fs::read_to_string(&path) {
            Ok(s) => s,
            Err(e) => {
                errors.push(format!("{}: {}", path.display(), e));
                continue;
            }
        };

        // Parse YAML frontmatter
        let (frontmatter, content) = parse_frontmatter(&raw);
        let id = frontmatter.get("id").cloned()
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let title = frontmatter.get("title").cloned()
            .unwrap_or_else(|| path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Untitled")
                .to_string());
        let created_at = frontmatter.get("created_at").cloned()
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
        let now = chrono::Utc::now().to_rfc3339();

        // Cek apakah sudah ada
        let exists: bool = conn
            .query_row("SELECT 1 FROM items WHERE id = ?1", params![id], |_| Ok(true))
            .unwrap_or(false);

        if exists {
            skipped += 1;
            continue;
        }

        match conn.execute(
            "INSERT INTO items (id, type, title, content, source, status, favorite, archived, created_at, updated_at) VALUES (?1, 'note', ?2, ?3, 'obsidian_import', 'inbox', 0, 0, ?4, ?5)",
            params![id, title, content.trim(), created_at, now],
        ) {
            Ok(_) => imported += 1,
            Err(e) => errors.push(format!("Insert error {}: {}", path.display(), e)),
        }
    }

    Ok(ImportResult { imported, skipped, errors })
}

/// Scan file di folder attachments yang tidak memiliki entri di database
#[tauri::command]
pub fn scan_orphan_files(
    db: State<'_, Database>,
    storage: State<'_, StorageManager>,
) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let att_dir = storage.attachments_dir();

    // Ambil semua file_path dari DB
    let mut stmt = conn
        .prepare("SELECT file_path FROM attachments")
        .map_err(|e| e.to_string())?;
    let db_paths: std::collections::HashSet<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let entries = fs::read_dir(&att_dir).map_err(|e| e.to_string())?;
    let mut orphans = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let path_str = path.to_string_lossy().to_string();
            if !db_paths.contains(&path_str) {
                orphans.push(path_str);
            }
        }
    }

    Ok(orphans)
}

/// Hapus file orphan dari disk (tidak ada di database)
#[tauri::command]
pub fn cleanup_orphan_files(
    db: State<'_, Database>,
    storage: State<'_, StorageManager>,
) -> Result<usize, String> {
    let orphans = scan_orphan_files(db, storage)?;
    let count = orphans.len();
    for path_str in &orphans {
        let p = std::path::Path::new(path_str);
        if p.is_file() {
            let _ = fs::remove_file(p);
        }
    }
    Ok(count)
}

/// Parse YAML frontmatter sederhana dari konten file .md
/// Format: ---\nkey: value\n---\n\ncontent
fn parse_frontmatter(content: &str) -> (std::collections::HashMap<String, String>, String) {
    let mut map = std::collections::HashMap::new();

    if !content.starts_with("---") {
        return (map, content.to_string());
    }

    let rest = &content[3..];
    let end_idx = rest.find("\n---");
    if let Some(end) = end_idx {
        let fm_str = &rest[..end];
        let body = &rest[end + 4..];

        for line in fm_str.lines() {
            if let Some(colon_pos) = line.find(':') {
                let key = line[..colon_pos].trim().to_string();
                let val = line[colon_pos + 1..].trim().trim_matches('"').to_string();
                if !key.is_empty() && !val.is_empty() && key != "tags" {
                    map.insert(key, val);
                }
            }
        }

        (map, body.trim_start_matches('\n').to_string())
    } else {
        (map, content.to_string())
    }
}

/// Buka berkas lampiran langsung di aplikasi bawaan sistem operasi (Windows default app, e.g. Adobe Acrobat / Edge)
#[tauri::command]
pub fn open_attachment_in_os(
    db: State<'_, Database>,
    storage: State<'_, StorageManager>,
    attachment_id: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let query_res: rusqlite::Result<(String, String, Option<String>)> = conn
        .query_row(
            "SELECT file_name, file_path, data_url FROM attachments WHERE id = ?1 LIMIT 1",
            params![attachment_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        );

    let (file_name, file_path, data_url) = match query_res {
        Ok(t) => t,
        Err(_) => {
            conn.query_row(
                "SELECT file_name, file_path, data_url FROM attachments WHERE item_id = ?1 LIMIT 1",
                params![attachment_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            ).map_err(|e| format!("Attachment not found: {}", e))?
        }
    };

    // 1. Check if physical file exists on disk
    let candidate_paths = [
        std::path::PathBuf::from(&file_path),
        storage.attachments_dir().join(&file_path),
        storage.attachments_dir().join(&file_name),
    ];

    for p in &candidate_paths {
        if p.is_file() {
            #[cfg(target_os = "windows")]
            {
                std::process::Command::new("cmd")
                    .args(["/C", "start", "", &p.to_string_lossy()])
                    .spawn()
                    .map_err(|e| format!("Failed to open file: {}", e))?;
                return Ok(());
            }
            #[cfg(not(target_os = "windows"))]
            {
                return Ok(());
            }
        }
    }

    // Scan attachments folder in case of UUID prefix
    if let Ok(entries) = std::fs::read_dir(storage.attachments_dir()) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                let fname = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if fname.ends_with(&format!("_{}", file_name)) || fname == file_name {
                    #[cfg(target_os = "windows")]
                    {
                        std::process::Command::new("cmd")
                            .args(["/C", "start", "", &p.to_string_lossy()])
                            .spawn()
                            .map_err(|e| format!("Failed to open file: {}", e))?;
                        return Ok(());
                    }
                }
            }
        }
    }

    // 2. If not on disk but has base64 data_url, write to temporary cache and launch
    if let Some(ref d_url) = data_url {
        if let Some(comma_pos) = d_url.find(',') {
            let b64 = &d_url[comma_pos + 1..];
            use base64::Engine;
            if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64) {
                let cache_dir = storage.cache_dir();
                let _ = std::fs::create_dir_all(&cache_dir);
                let cache_path = cache_dir.join(&file_name);
                let _ = std::fs::write(&cache_path, bytes);

                #[cfg(target_os = "windows")]
                {
                    std::process::Command::new("cmd")
                        .args(["/C", "start", "", &cache_path.to_string_lossy()])
                        .spawn()
                        .map_err(|e| format!("Failed to open file: {}", e))?;
                    return Ok(());
                }
            }
        }
    }

    Err("Physical file not found on system".to_string())
}

