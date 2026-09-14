pub mod ai;
pub mod commands;
pub mod database;
pub mod filesystem;
pub mod p2p;

use database::Database;
use filesystem::StorageManager;
use ai::state::AiState;
use p2p::P2PState;
use std::time::Duration;
use tauri::{Emitter, Manager};

pub fn run() {
    let storage = StorageManager::new(None);
    let db_path = storage.db_path();
    let ai_state = AiState::default();
    let p2p_state = P2PState::default();
    let db = match Database::new(&db_path) {
        Ok(d) => d,
        Err(e) => {
            let err_str = e.to_string().to_lowercase();
            let is_lock_or_busy = err_str.contains("busy")
                || err_str.contains("locked")
                || err_str.contains("permission denied")
                || err_str.contains("access is denied");

            if is_lock_or_busy {
                eprintln!(
                    "Fatal: Database at {:?} is locked or accessed by another process ({}). Exiting safely without destructive modification.",
                    db_path, e
                );
                std::process::exit(1);
            }

            let is_corrupt = err_str.contains("corrupt")
                || err_str.contains("malformed")
                || err_str.contains("not a database");

            if is_corrupt {
                eprintln!("Database corruption detected at {:?}: {}. Attempting recovery...", db_path, e);
                let backup_name = format!("velco_corrupted_{}.db", chrono::Utc::now().timestamp());
                let backup_path = storage.database_dir().join(backup_name);
                // Rename DB utama + file pendamping WAL/SHM agar tidak orphan.
                let _ = std::fs::rename(&db_path, &backup_path);
                for suffix in ["-wal", "-shm", "-journal"] {
                    let mut src = db_path.as_os_str().to_owned();
                    src.push(suffix);
                    let src_path = std::path::PathBuf::from(src);
                    if src_path.exists() {
                        let mut dst = backup_path.as_os_str().to_owned();
                        dst.push(suffix);
                        let _ = std::fs::rename(&src_path, std::path::PathBuf::from(dst));
                    }
                }
                match Database::new(&db_path) {
                    Ok(d) => d,
                    Err(e2) => {
                        eprintln!("Recovery failed ({}). Exiting.", e2);
                        std::process::exit(1);
                    }
                }
            } else {
                eprintln!("Failed to initialize database ({}). Exiting.", e);
                std::process::exit(1);
            }
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            } else {
                // Jika window "main" sebelumnya telah ditutup/hancur, buat ulang agar aplikasi tetap bisa dibuka
                let _ = tauri::WebviewWindowBuilder::new(
                    app,
                    "main",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("Velco")
                .inner_size(1280.0, 840.0)
                .min_inner_size(900.0, 600.0)
                .center()
                .resizable(true)
                .build();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Saat user menekan tombol "X" (close), sembunyikan window (hide) alih-alih menghancurkannya (destroy).
                // Dengan begini, background worker (reminder) dan shortcut Spotlight tetap berjalan,
                // dan window dapat dibuka kembali secara instan kapan saja user membuka aplikasi.
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .manage(storage)
        .manage(db)
        .manage(ai_state)
        .manage(p2p_state)
        .manage(reqwest::Client::builder().timeout(Duration::from_secs(180)).build().expect("failed to build http client"))
        .setup(|app| {
            // ── System Tray Icon ───────────────────────────────────────
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

            let show_i = MenuItem::with_id(app, "show", "Open Velco", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Velco", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .tooltip("Velco Workstation")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _ = tray_builder.build(app)?;

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
            let primary_mod = if cfg!(target_os = "macos") {
                Modifiers::SUPER
            } else {
                Modifiers::CONTROL
            };
            let shortcut = Shortcut::new(
                Some(primary_mod | Modifiers::SHIFT),
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
            commands::items::get_attachment_preview,
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
            commands::filesystem::open_attachment_in_os,
            // Backup
            commands::backup::export_backup,
            commands::backup::import_backup,
            commands::backup::get_backup_status,
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
            commands::ai::cancel_chat,
            commands::ai::set_ai_credential,
            commands::ai::get_ai_credential,
            commands::ai::delete_ai_credential,
            commands::ai::get_ai_usage_summary,
            commands::ai::grant_cloud_consent,
            commands::ai::revoke_cloud_consent,
            commands::ai::get_cloud_consent,
            // Capsules (Context Hub)
            commands::capsules::get_capsules,
            commands::capsules::create_capsule,
            commands::capsules::update_capsule,
            commands::capsules::delete_capsule,
            commands::capsules::add_item_to_capsule,
            commands::capsules::remove_item_from_capsule,
            commands::capsules::get_capsule_items,
            commands::capsules::export_capsule,
            commands::capsules::import_capsule,
            // P2P Real-Time LAN Sync
            commands::p2p::start_p2p_session,
            commands::p2p::stop_p2p_session,
            commands::p2p::get_p2p_status,
            commands::p2p::broadcast_p2p_item_upsert,
            commands::p2p::broadcast_p2p_task_toggle,
            commands::p2p::broadcast_p2p_item_removed,
            // Updater
            commands::updater::check_for_updates,
            commands::updater::install_update,
            // Chat Sessions
            commands::chat_sessions::create_chat_session,
            commands::chat_sessions::append_chat_message,
            commands::chat_sessions::list_chat_sessions,
            commands::chat_sessions::get_chat_session_messages,
            commands::chat_sessions::rename_chat_session,
            commands::chat_sessions::delete_chat_session,
            commands::chat_sessions::migrate_legacy_chat,
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

    // 1. Ambil tasks yang due dan update notified = 1, lalu LEPASKAN db lock secepatnya
    let tasks: Vec<(String, String, String, String, String, String)> = {
        let conn = match db.write_conn.lock() {
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

        let rows: Vec<(String, String, String, String, String, String)> = stmt
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

        for (task_id, ..) in &rows {
            let _ = conn.execute(
                "UPDATE tasks SET notified = 1 WHERE id = ?1",
                rusqlite::params![task_id],
            );
        }

        rows
        // lock db.conn dilepaskan di sini
    };

    // 2. Kirim notifikasi desktop OS DI LUAR lock database agar tidak memblokir IPC UI
    for (_task_id, _item_id, title, content, due_date, priority) in tasks {
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

        let _ = app.emit_to(
            "main",
            "velco://reminder-fired",
            serde_json::json!({
                "title": notif_title,
                "body": notif_body,
                "priority": priority
            }),
        );
    }
}
