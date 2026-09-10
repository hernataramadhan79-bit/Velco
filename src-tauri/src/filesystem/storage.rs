use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
pub struct StorageManager {
    root_dir: PathBuf,
}

impl StorageManager {
    pub fn new(custom_root: Option<PathBuf>) -> Self {
        let root = match custom_root {
            Some(r) => r,
            None => {
                let doc_dir = dirs::document_dir().unwrap_or_else(|| PathBuf::from("."));
                doc_dir.join("Velco")
            }
        };

        let manager = Self { root_dir: root };
        manager.ensure_directories().ok();
        manager
    }

    pub fn root(&self) -> &Path {
        &self.root_dir
    }

    pub fn database_dir(&self) -> PathBuf {
        self.root_dir.join("database")
    }

    pub fn attachments_dir(&self) -> PathBuf {
        self.root_dir.join("attachments")
    }

    pub fn thumbnails_dir(&self) -> PathBuf {
        self.root_dir.join("thumbnails")
    }

    pub fn cache_dir(&self) -> PathBuf {
        self.root_dir.join("cache")
    }

    pub fn indexes_dir(&self) -> PathBuf {
        self.root_dir.join("indexes")
    }

    pub fn logs_dir(&self) -> PathBuf {
        self.root_dir.join("logs")
    }

    pub fn db_path(&self) -> PathBuf {
        self.database_dir().join("velco.db")
    }

    pub fn ensure_directories(&self) -> std::io::Result<()> {
        fs::create_dir_all(self.database_dir())?;
        fs::create_dir_all(self.attachments_dir())?;
        fs::create_dir_all(self.thumbnails_dir())?;
        fs::create_dir_all(self.cache_dir())?;
        fs::create_dir_all(self.indexes_dir())?;
        fs::create_dir_all(self.logs_dir())?;
        Ok(())
    }

    /// Sanitasi nama file: hanya izinkan alnum, dot, dash, underscore.
    /// Mencegah traversal (`../`), separator (`/`,`\`), karakter Windows ilegal,
    /// serta nama kosong / terlalu panjang.
    pub fn sanitize_file_name(raw: &str) -> String {
        // Ambil hanya komponen file name terakhir (buang direktori)
        let base = Path::new(raw)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unnamed_file");
        let mut clean: String = base
            .chars()
            .map(|c| {
                if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        // Hindari nama tersembunyi / dot-only
        clean = clean.trim_matches('.').to_string();
        if clean.is_empty() {
            clean = "unnamed_file".to_string();
        }
        // Batasi panjang (NTFS ~255, sisakan ruang untuk UUID prefix)
        if clean.len() > 180 {
            let ext = Path::new(&clean)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");
            let stem_trunc: String = clean.chars().take(180 - ext.len() - 1).collect();
            clean = if ext.is_empty() {
                stem_trunc
            } else {
                format!("{}.{}", stem_trunc.trim_end_matches('.'), ext)
            };
        }
        // Blokir nama reserved Windows
        const RESERVED: &[&str] = &[
            "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6",
            "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6",
            "LPT7", "LPT8", "LPT9",
        ];
        let stem = clean.split('.').next().unwrap_or("").to_uppercase();
        if RESERVED.contains(&stem.as_str()) {
            clean = format!("file_{}", clean);
        }
        clean
    }

    /// Pastikan `path` berada di dalam `dir` (jail). Mengikuti symlink via canonicalize
    /// bila file sudah ada; bila belum ada, canonicalize parent-nya.
    pub fn ensure_within_dir(dir: &Path, path: &Path) -> std::io::Result<PathBuf> {
        let canon_dir = dir.canonicalize().unwrap_or_else(|_| dir.to_path_buf());
        let canon_target = if path.exists() {
            path.canonicalize()?
        } else if let Some(parent) = path.parent() {
            let canon_parent = parent.canonicalize().unwrap_or_else(|_| parent.to_path_buf());
            if let Some(name) = path.file_name() {
                canon_parent.join(name)
            } else {
                canon_parent
            }
        } else {
            path.to_path_buf()
        };
        if canon_target.starts_with(&canon_dir) {
            Ok(canon_target)
        } else {
            Err(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                format!(
                    "Path traversal blocked: {} outside {}",
                    path.display(),
                    dir.display()
                ),
            ))
        }
    }

    /// Resolve `file_path` dari DB menjadi path absolut di dalam attachments_dir.
    /// Menolak absolut di luar sandbox dan traversal. Return None bila tidak valid.
    pub fn resolve_attachment_path(&self, file_path: &str, file_name: &str) -> Option<PathBuf> {
        let att_dir = self.attachments_dir();
        let p = Path::new(file_path);

        // 1. Jika absolut
        if p.is_absolute() {
            if let Ok(jailed) = Self::ensure_within_dir(&att_dir, p) {
                if jailed.exists() {
                    return Some(jailed);
                }
            }
        }

        // 2. Jika path diawali 'attachments/' atau 'attachments\'
        if let Ok(rel) = p.strip_prefix("attachments") {
            let cand = att_dir.join(rel);
            if cand.exists() {
                return Some(cand);
            }
        }

        // 3. Jika relatif langsung terhadap attachments_dir
        if !file_path.contains("..") {
            let cand = att_dir.join(p);
            if cand.exists() {
                return Some(cand);
            }
        }

        // 4. Fallback dengan sanitized file_name
        let safe = Self::sanitize_file_name(file_name);
        let by_name = att_dir.join(&safe);
        if by_name.exists() {
            return Some(by_name);
        }

        // 5. Fallback mencari prefix {uuid}_{safe} di dalam attachments_dir
        if let Ok(entries) = std::fs::read_dir(&att_dir) {
            let suffix = format!("_{}", safe);
            for entry in entries.flatten() {
                let ep = entry.path();
                if ep.is_file() {
                    if let Some(n) = ep.file_name().and_then(|x| x.to_str()) {
                        if n.ends_with(&suffix) || n == safe {
                            return Some(ep);
                        }
                    }
                }
            }
        }

        None
    }

    pub fn save_attachment(
        &self,
        file_name: &str,
        bytes: &[u8],
    ) -> std::io::Result<(PathBuf, String, usize)> {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
        let checksum = hex::encode(hasher.finalize());

        let file_id = uuid::Uuid::new_v4().to_string();
        let safe_name = format!("{}_{}", file_id, Self::sanitize_file_name(file_name));
        let target_path = self.attachments_dir().join(&safe_name);
        // Jail check sebelum tulis
        Self::ensure_within_dir(&self.attachments_dir(), &target_path)?;

        fs::write(&target_path, bytes)?;
        Ok((target_path, checksum, bytes.len()))
    }
}
