use tauri::{AppHandle, Manager};

/// Sembunyikan spotlight window — dipanggil dari frontend via invoke
#[tauri::command]
pub fn hide_spotlight_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("spotlight") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Tampilkan dan fokuskan spotlight window (untuk digunakan dari command jika perlu)
#[tauri::command]
pub fn show_spotlight_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("spotlight") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}
