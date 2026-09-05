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
                doc_dir.join("LifeInbox")
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
        self.database_dir().join("lifeinbox.db")
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

    pub fn save_attachment(
        &self,
        file_name: &str,
        bytes: &[u8],
    ) -> std::io::Result<(PathBuf, String, usize)> {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
        let checksum = hex::encode(hasher.finalize());

        let file_id = uuid::Uuid::new_v4().to_string();
        let safe_name = format!("{}_{}", file_id, file_name);
        let target_path = self.attachments_dir().join(&safe_name);

        fs::write(&target_path, bytes)?;
        Ok((target_path, checksum, bytes.len()))
    }
}
