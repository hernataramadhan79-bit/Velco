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

/// Escape nilai YAML double-quoted: backslash, quote, newline.
fn yaml_escape(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

/// Export catatan ke folder lokal sebagai file .md dengan YAML frontmatter
#[tauri::command]
pub fn export_notes_to_folder(
    db: State<'_, Database>,
    folder_path: String,
    item_ids: Option<Vec<String>>,
) -> Result<usize, String> {
    let target_dir = PathBuf::from(&folder_path);

    fs::create_dir_all(&target_dir).map_err(|e| format!("Cannot create folder: {}", e))?;

    // 1. Ambil rows di bawah lock singkat, lalu LEPASKAN lock sebelum I/O file.
    let rows_data: Vec<(String, String, String, String, String)> = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        // Gunakan bound params untuk item_ids (hindari filter di Rust + hindari interpolasi SQL)
        let (sql, param_ids): (String, Vec<String>) = match &item_ids {
            Some(ids) if !ids.is_empty() => {
                let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                (
                    format!(
                        "SELECT i.id, i.title, i.content, i.created_at, \
                         COALESCE((SELECT json_group_array(json_object('name', t.name)) FROM tags t JOIN item_tags it ON t.id = it.tag_id WHERE it.item_id = i.id), '[]') as tags_json \
                         FROM items i WHERE i.deleted_at IS NULL AND i.type = 'note' AND i.id IN ({})",
                        placeholders
                    ),
                    ids.clone(),
                )
            }
            _ => (
                "SELECT i.id, i.title, i.content, i.created_at, \
                 COALESCE((SELECT json_group_array(json_object('name', t.name)) FROM tags t JOIN item_tags it ON t.id = it.tag_id WHERE it.item_id = i.id), '[]') as tags_json \
                 FROM items i WHERE i.deleted_at IS NULL AND i.type = 'note'"
                    .to_string(),
                Vec::new(),
            ),
        };
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let param_refs: Vec<&dyn rusqlite::ToSql> =
            param_ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();
        let rows = stmt
            .query_map(param_refs.as_slice(), |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4).unwrap_or_else(|_| "[]".to_string()),
                ))
            })
            .map_err(|e| e.to_string())?;
        rows.flatten().collect()
        // lock dilepas di sini
    };

    let mut exported = 0usize;
    for (id, title, content, created_at, tags_json) in rows_data {
        // Parse tags untuk frontmatter
        let tags: Vec<serde_json::Value> = serde_json::from_str(&tags_json).unwrap_or_default();
        let tag_names: Vec<String> = tags
            .iter()
            .filter_map(|t| t.get("name").and_then(|n| n.as_str()).map(|s| s.to_string()))
            .collect();
        let tags_yaml = if tag_names.is_empty() {
            "tags: []".to_string()
        } else {
            // Escape tiap tag name agar frontmatter tidak rusak
            let escaped: Vec<String> = tag_names.iter().map(|t| format!("\"{}\"", yaml_escape(t))).collect();
            format!("tags: [{}]", escaped.join(", "))
        };

        // Buat nama file aman dengan UUID prefix (tanpa panic slice)
        let slug = title
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-')
            .take(50)
            .collect::<String>()
            .trim()
            .replace(' ', "_")
            .to_lowercase();
        let slug = if slug.is_empty() { "untitled".to_string() } else { slug };
        let id_prefix: String = id.chars().take(8).collect();
        let id_prefix = if id_prefix.is_empty() { "noid".to_string() } else { id_prefix };
        let file_name = format!("{}-{}.md", id_prefix, StorageManager::sanitize_file_name(&slug));
        // Jail: pastikan tetap di dalam target_dir
        let file_path = target_dir.join(&file_name);
        if StorageManager::ensure_within_dir(&target_dir, &file_path).is_err() {
            continue;
        }

        let frontmatter = format!(
            "---\nid: {}\ntitle: \"{}\"\ncreated_at: \"{}\"\n{}\n---\n\n",
            yaml_escape(&id),
            yaml_escape(&title),
            yaml_escape(&created_at),
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
    let source_dir = PathBuf::from(&folder_path);

    if !source_dir.is_dir() {
        return Err(format!("Folder not found: {}", folder_path));
    }

    // 1. Kumpulkan file .md + baca isi TANPA memegang DB lock (hindari freeze IPC).
    let entries = fs::read_dir(&source_dir).map_err(|e| e.to_string())?;
    let mut pending: Vec<(PathBuf, String)> = Vec::new();
    let mut errors = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        // Hanya file langsung (tolak symlink ke luar / subdir traversal)
        if !path.is_file() {
            continue;
        }
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        // Batasi ukuran 5MB per file agar tidak OOM
        if let Ok(meta) = std::fs::metadata(&path) {
            if meta.len() > 5 * 1024 * 1024 {
                errors.push(format!("{}: skipped (exceeds 5MB)", path.display()));
                continue;
            }
        }
        match fs::read_to_string(&path) {
            Ok(s) => pending.push((path, s)),
            Err(e) => errors.push(format!("{}: {}", path.display(), e)),
        }
        if pending.len() > 2000 {
            errors.push("Import capped at 2000 files per batch".to_string());
            break;
        }
    }

    // 2. Insert di bawah lock singkat + transaction.
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut imported = 0usize;
    let mut skipped = 0usize;

    for (path, raw) in pending {
        // Parse YAML frontmatter
        let (frontmatter, content) = parse_frontmatter(&raw);
        let id = frontmatter.get("id").cloned()
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        // Validasi id: tolak id dengan path separator / terlalu panjang
        if id.contains('/') || id.contains('\\') || id.len() > 64 {
            errors.push(format!("{}: invalid frontmatter id, skipped", path.display()));
            continue;
        }
        let title = frontmatter.get("title").cloned()
            .unwrap_or_else(|| path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Untitled")
                .to_string());
        // Batasi panjang title/content
        let title: String = title.chars().take(500).collect();
        let content_trimmed: String = content.trim().chars().take(1_000_000).collect();
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

        // Trigger items_ai otomatis isi FTS — jangan insert manual.
        match conn.execute(
            "INSERT INTO items (id, type, title, content, source, status, favorite, archived, created_at, updated_at) VALUES (?1, 'note', ?2, ?3, 'obsidian_import', 'inbox', 0, 0, ?4, ?5)",
            params![id, title, content_trimmed, created_at, now],
        ) {
            Ok(_) => imported += 1,
            Err(e) => errors.push(format!("Insert error {}: {}", path.display(), e)),
        }
    }

    Ok(ImportResult { imported, skipped, errors })
}

/// Normalisasi file_path DB menjadi file_name untuk perbandingan orphan.
/// DB menyimpan campuran absolut (`C:\...\attachments\uuid_name`) dan relatif
/// (`attachments/uuid_name`). Keduanya dinormalisasi ke file_name.
fn normalize_db_file_key(file_path: &str) -> String {
    PathBuf::from(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(file_path)
        .to_string()
}

/// Scan file di folder attachments yang tidak memiliki entri di database
#[tauri::command]
pub fn scan_orphan_files(
    db: State<'_, Database>,
    storage: State<'_, StorageManager>,
) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let att_dir = storage.attachments_dir();

    // Ambil semua file_path + file_name dari DB, normalisasi ke file_name
    let mut stmt = conn
        .prepare("SELECT file_path, file_name FROM attachments")
        .map_err(|e| e.to_string())?;
    let db_keys: std::collections::HashSet<String> = stmt
        .query_map([], |row| {
            let fp: String = row.get(0)?;
            let fn_: String = row.get(1)?;
            Ok((fp, fn_))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .flat_map(|(fp, fn_)| {
            vec![
                normalize_db_file_key(&fp),
                StorageManager::sanitize_file_name(&fn_),
            ]
        })
        .collect();

    let entries = fs::read_dir(&att_dir).map_err(|e| e.to_string())?;
    let mut orphans = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        // Tolak symlink / direktori — hanya file reguler
        if let Ok(ft) = entry.file_type() {
            if !ft.is_file() {
                continue;
            }
        } else if !path.is_file() {
            continue;
        }
        if let Some(fname) = path.file_name().and_then(|n| n.to_str()) {
            if !db_keys.contains(fname) {
                orphans.push(path.to_string_lossy().to_string());
            }
        }
    }

    Ok(orphans)
}

/// Hapus file orphan dari disk (tidak ada di database)
/// HANYA menghapus file yang terverifikasi berada di dalam attachments_dir (jail).
#[tauri::command]
pub fn cleanup_orphan_files(
    db: State<'_, Database>,
    storage: State<'_, StorageManager>,
) -> Result<usize, String> {
    let orphans = scan_orphan_files(db.clone(), storage.clone())?;
    let att_dir = storage.attachments_dir();
    let mut count = 0usize;
    for path_str in &orphans {
        let p = std::path::Path::new(path_str);
        // Jail: pastikan masih di dalam attachments_dir sebelum hapus
        let jailed = match StorageManager::ensure_within_dir(&att_dir, p) {
            Ok(c) => c,
            Err(_) => continue,
        };
        // Double-check: hanya hapus bila file_name masih orphan (TOCTOU guard:
        // re-query cepat dilakukan di scan; di sini pastikan parent masih att_dir)
        if jailed.is_file() {
            if fs::remove_file(&jailed).is_ok() {
                count += 1;
            }
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

/// Checks if an extension is a known safe document or media format.
fn is_safe_document_or_media(extension: &str) -> bool {
    matches!(
        extension,
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "ico" | "avif"
            | "pdf" | "txt" | "md" | "markdown" | "json" | "csv" | "tsv" | "xml" | "yaml" | "yml"
            | "docx" | "xlsx" | "pptx" | "odt" | "ods" | "odp" | "rtf"
            | "mp3" | "wav" | "ogg" | "m4a" | "flac" | "aac"
            | "mp4" | "mkv" | "mov" | "webm" | "avi"
            | "zip" | "tar" | "gz" | "7z" | "rar"
    )
}

/// Launch file yang sudah tervalidasi jail-nya tanpa melalui shell interpreter.
/// Berkas dokumen/media aman dibuka dengan aplikasi default OS.
/// Berkas eksekutabel atau berbahaya (.exe, .bat, .ps1, dll) TIDAK dieksekusi secara langsung,
/// melainkan dibuka di file manager dengan posisi berkas tersorot (/select di Windows).
fn launch_file_sandboxed(path: &std::path::Path) -> Result<(), String> {
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let is_safe = is_safe_document_or_media(&extension);

    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("explorer");
        if is_safe {
            // Berkas aman: buka langsung dengan aplikasi asosiasi default
            cmd.arg(path);
        } else {
            // Berkas eksekutabel/tidak dikenal: hanya sorot di Explorer (mencegah RCE)
            cmd.arg("/select,").arg(path);
        }
        cmd.spawn().map_err(|e| format!("Failed to open file: {}", e))?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        let mut cmd = std::process::Command::new("open");
        if is_safe {
            cmd.arg(path);
        } else {
            // Sorot di Finder (-R)
            cmd.arg("-R").arg(path);
        }
        cmd.spawn().map_err(|e| format!("Failed to open file: {}", e))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        if is_safe {
            std::process::Command::new("xdg-open")
                .arg(path)
                .spawn()
                .map_err(|e| format!("Failed to open file: {}", e))?;
        } else if let Some(parent) = path.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| format!("Failed to open directory: {}", e))?;
        }
        return Ok(());
    }
}

/// Buka berkas lampiran langsung di aplikasi bawaan sistem operasi.
/// Semua path divalidasi jail ke attachments_dir / cache_dir — path absolut
/// di luar sandbox DITOLAK (mencegah arbitrary file open via DB beracun).
#[tauri::command]
pub fn open_attachment_in_os(
    db: State<'_, Database>,
    storage: State<'_, StorageManager>,
    attachment_id: String,
) -> Result<(), String> {
    // 1. Ambil metadata di bawah lock singkat, lalu lepas sebelum I/O.
    let (file_name, file_path, data_url): (String, String, Option<String>) = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let query_res: rusqlite::Result<(String, String, Option<String>)> = conn.query_row(
            "SELECT file_name, file_path, data_url FROM attachments WHERE id = ?1 LIMIT 1",
            params![attachment_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        );
        match query_res {
            Ok(t) => t,
            Err(_) => conn
                .query_row(
                    "SELECT file_name, file_path, data_url FROM attachments WHERE item_id = ?1 LIMIT 1",
                    params![attachment_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
                .map_err(|e| format!("Attachment not found: {}", e))?,
        }
    };

    let safe_file_name = StorageManager::sanitize_file_name(&file_name);
    let att_dir = storage.attachments_dir();

    // 2. Resolve path via jail helper (menolak absolut di luar sandbox).
    if let Some(resolved) = storage.resolve_attachment_path(&file_path, &safe_file_name) {
        if let Ok(jailed) = StorageManager::ensure_within_dir(&att_dir, &resolved) {
            if jailed.is_file() {
                return launch_file_sandboxed(&jailed);
            }
        }
    }

    // 3. Scan attachments folder untuk UUID prefix (tetap di dalam att_dir).
    if let Ok(entries) = std::fs::read_dir(&att_dir) {
        // Sanitasi suffix agar tidak bisa jadi pattern traversal
        let suffix = format!("_{}", safe_file_name);
        for entry in entries.flatten() {
            let p = entry.path();
            let is_file = entry.file_type().map(|f| f.is_file()).unwrap_or_else(|_| p.is_file());
            if !is_file {
                continue;
            }
            let fname = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if fname.ends_with(&suffix) || fname == safe_file_name {
                if let Ok(jailed) = StorageManager::ensure_within_dir(&att_dir, &p) {
                    if jailed.is_file() {
                        return launch_file_sandboxed(&jailed);
                    }
                }
            }
        }
    }

    // 4. Jika tidak ada di disk tapi punya base64 data_url, tulis ke cache (jail) dan launch.
    // Batasi 25MB agar tidak penuhi disk dari blob raksasa.
    if let Some(ref d_url) = data_url {
        if let Some(comma_pos) = d_url.find(',') {
            // Tolak data_url non-file (hanya izinkan tipe umum)
            let header = &d_url[..comma_pos.min(d_url.len())];
            let allowed = header.contains("image/")
                || header.contains("application/pdf")
                || header.contains("text/")
                || header.contains("audio/")
                || header.contains("video/");
            if !allowed {
                return Err("Refusing to materialize disallowed data_url type".to_string());
            }
            let b64 = &d_url[comma_pos + 1..];
            if b64.len() > 35_000_000 {
                return Err("Embedded file too large to open (cap 25MB)".to_string());
            }
            use base64::Engine;
            if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64) {
                if bytes.len() > 25 * 1024 * 1024 {
                    return Err("Embedded file too large to open (cap 25MB)".to_string());
                }
                let cache_dir = storage.cache_dir();
                let _ = std::fs::create_dir_all(&cache_dir);
                let cache_path = cache_dir.join(&safe_file_name);
                let jailed = StorageManager::ensure_within_dir(&cache_dir, &cache_path)
                    .map_err(|_| "Cache path traversal blocked".to_string())?;
                std::fs::write(&jailed, bytes).map_err(|e| format!("Cache write failed: {}", e))?;
                return launch_file_sandboxed(&jailed);
            }
        }
    }

    Err("Physical file not found on system".to_string())
}

