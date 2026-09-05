use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;

use crate::filesystem::StorageManager;

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemPaths {
    pub root_dir: PathBuf,
    pub database_dir: PathBuf,
    pub attachments_dir: PathBuf,
    pub thumbnails_dir: PathBuf,
    pub cache_dir: PathBuf,
    pub indexes_dir: PathBuf,
    pub logs_dir: PathBuf,
}

#[tauri::command]
pub fn get_system_paths(storage: State<'_, StorageManager>) -> Result<SystemPaths, String> {
    Ok(SystemPaths {
        root_dir: storage.root().to_path_buf(),
        database_dir: storage.database_dir(),
        attachments_dir: storage.attachments_dir(),
        thumbnails_dir: storage.thumbnails_dir(),
        cache_dir: storage.cache_dir(),
        indexes_dir: storage.indexes_dir(),
        logs_dir: storage.logs_dir(),
    })
}
