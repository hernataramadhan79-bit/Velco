pub mod ai;
pub mod commands;
pub mod database;
pub mod filesystem;

use database::Database;
use filesystem::StorageManager;
use std::time::Duration;

pub fn run() {
    let storage = StorageManager::new(None);
    let db = Database::new(storage.db_path()).expect("Failed to initialize SQLite database");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(storage)
        .manage(db)
        .setup(|app| {
            // ── Background Reminder Worker ─────────────────────────────
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_secs(30));
                loop {
                    interval.tick().await;
                    check_and_send_reminders(&app_handle);
                }
            });

            // ── Global Shortcut: CmdOrCtrl+Shift+Space → Toggle Spotlight ──
            use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
            let shortcut = Shortcut::new(
                Some(Modifiers::CONTROL | Modifiers::SHIFT),
                Code::Space,
            );
            let app_handle2 = app.handle().clone();
            if let Err(e) = app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, _event| {
                use tauri::Manager;
                if let Some(window) = app_handle2.get_webview_window("spotlight") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        // Posisikan di tengah layar primary monitor
                        if let Ok(Some(monitor)) = window.primary_monitor() {
                            let screen_size = monitor.size();
                            let win_size = window.outer_size().unwrap_or(tauri::PhysicalSize::new(640, 200));
                            let x = (screen_size.width as i32 - win_size.width as i32) / 2;
                            let y = (screen_size.height as i32 / 4).max(100);
                            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                        }
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }) {
                eprintln!("Warning: failed to register global shortcut: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Items
            commands::items::get_items,
            commands::items::get_item,
            commands::items::get_item_counts,
            commands::items::get_items_summary,
            commands::items::get_item_detail,
            commands::items::create_item,
            commands::items::update_item,
            commands::items::trash_item,
            commands::items::restore_item,
            commands::items::delete_item_permanent,
            commands::items::empty_trash,
            commands::items::import_files_from_paths,
            // Tasks
            commands::tasks::toggle_task_complete,
            commands::tasks::reset_task_notified,
            // Tags
            commands::tags::get_tags,
            commands::tags::create_tag,
            commands::tags::assign_tag,
            commands::tags::remove_tag,
            commands::tags::delete_tag,
            // Search
            commands::search::search_items,
            commands::search::search_items_v2,
            // Spotlight
            commands::spotlight::hide_spotlight_window,
            commands::spotlight::show_spotlight_window,
            // Filesystem
            commands::filesystem::export_notes_to_folder,
            commands::filesystem::import_folder_as_notes,
            commands::filesystem::scan_orphan_files,
            commands::filesystem::cleanup_orphan_files,
            // Backup
            commands::backup::export_backup,
            commands::backup::import_backup,
            // Settings
            commands::settings::get_system_paths,
            // AI
            commands::ai::check_ollama_status,
            commands::ai::list_ollama_models,
            commands::ai::list_ai_models_detailed,
            commands::ai::generate_ai_completion,
            commands::ai::test_ai_connection,
            commands::ai::execute_context_recipe,
            commands::ai::apply_recipe_artifacts,
            commands::ai::execute_context_chat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Velco application");
}

/// Cek task yang sudah due dan kirim notifikasi OS native
fn check_and_send_reminders(app: &tauri::AppHandle) {
    use tauri::Manager;

    let db = match app.try_state::<Database>() {
        Some(d) => d,
        None => return,
    };

    let conn = match db.conn.lock() {
        Ok(c) => c,
        Err(_) => return,
    };

    // Query task yang due, belum selesai, belum dinotifikasi
    let sql = r#"
        SELECT t.id, t.item_id, i.title, i.content, t.due_date, t.priority
        FROM tasks t
        JOIN items i ON t.item_id = i.id
        WHERE t.due_date <= datetime('now', 'localtime')
          AND t.completed = 0
          AND t.notified = 0
          AND i.deleted_at IS NULL
        LIMIT 10
    "#;

    let mut stmt = match conn.prepare(sql) {
        Ok(s) => s,
        Err(_) => return,
    };

    let tasks: Vec<(String, String, String, String, String, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0).unwrap_or_default(),
                row.get::<_, String>(1).unwrap_or_default(),
                row.get::<_, String>(2).unwrap_or_default(),
                row.get::<_, String>(3).unwrap_or_default(),
                row.get::<_, String>(4).unwrap_or_default(),
                row.get::<_, String>(5).unwrap_or_else(|_| "medium".to_string()),
            ))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();

    for (task_id, item_id, title, content, due_date, priority) in tasks {
        // Kirim notifikasi OS via tauri-plugin-notification
        let priority_label = match priority.as_str() {
            "high" | "urgent" => "🔴 ",
            "medium" => "🟡 ",
            _ => "",
        };
        let notif_title = format!("{}Task Due: {}", priority_label, title);
        let notif_body = if !content.is_empty() {
            content.chars().take(100).collect::<String>()
        } else {
            format!("Due: {}", due_date)
        };

        let _ = tauri_plugin_notification::NotificationExt::notification(app)
            .builder()
            .title(&notif_title)
            .body(&notif_body)
            .show();

        // Update notified = 1
        let _ = conn.execute(
            "UPDATE tasks SET notified = 1 WHERE id = ?1",
            rusqlite::params![task_id],
        );

        let _ = item_id; // suppress unused warning
    }
}
