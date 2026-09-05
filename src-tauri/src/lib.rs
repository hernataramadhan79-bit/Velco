pub mod ai;
pub mod commands;
pub mod database;
pub mod filesystem;

use database::Database;
use filesystem::StorageManager;

pub fn run() {
    let storage = StorageManager::new(None);
    let db = Database::new(storage.db_path()).expect("Failed to initialize SQLite database");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(storage)
        .manage(db)
        .invoke_handler(tauri::generate_handler![
            commands::items::get_items,
            commands::items::get_item,
            commands::items::get_item_counts,
            commands::items::create_item,
            commands::items::update_item,
            commands::items::trash_item,
            commands::items::restore_item,
            commands::items::delete_item_permanent,
            commands::tasks::toggle_task_complete,
            commands::tags::get_tags,
            commands::tags::create_tag,
            commands::tags::assign_tag,
            commands::tags::remove_tag,
            commands::search::search_items,
            commands::backup::export_backup,
            commands::backup::import_backup,
            commands::settings::get_system_paths,
            commands::ai::check_ollama_status,
            commands::ai::list_ollama_models,
            commands::ai::list_ai_models_detailed,
            commands::ai::generate_ai_completion,
            commands::ai::test_ai_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Life Inbox application");
}
