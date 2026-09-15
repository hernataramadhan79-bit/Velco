use serde::Serialize;
use tauri::Emitter;
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Clone, Serialize)]
pub struct UpdateInfo {
    pub should_update: bool,
    pub current_version: String,
    pub version: String,
    pub body: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgressPayload {
    pub chunk_length: usize,
    pub content_length: Option<u64>,
}

#[tauri::command]
pub fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub async fn check_for_updates(app: tauri::AppHandle) -> Result<Option<UpdateInfo>, String> {
    let current_ver = app.package_info().version.to_string();
    let updater = match app.updater() {
        Ok(u) => u,
        Err(_) => {
            return Ok(Some(UpdateInfo {
                should_update: false,
                current_version: current_ver.clone(),
                version: current_ver,
                body: None,
                date: None,
            }));
        }
    };

    match updater.check().await {
        Ok(Some(update)) => Ok(Some(UpdateInfo {
            should_update: true,
            current_version: update.current_version.clone(),
            version: update.version.clone(),
            body: update.body.clone(),
            date: update.date.map(|d| d.to_string()),
        })),
        Ok(None) => Ok(Some(UpdateInfo {
            should_update: false,
            current_version: current_ver.clone(),
            version: current_ver,
            body: None,
            date: None,
        })),
        Err(e) => Err(format!("Update check failed: {}", e)),
    }
}

#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        let app_handle = app.clone();
        update
            .download_and_install(
                move |chunk_length, content_length| {
                    let _ = app_handle.emit(
                        "velco://updater-progress",
                        DownloadProgressPayload {
                            chunk_length,
                            content_length,
                        },
                    );
                },
                || {},
            )
            .await
            .map_err(|e| format!("Failed to download and install update: {}", e))?;

        app.restart();
    }
    Ok(())
}
