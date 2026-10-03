#[tauri::command]
fn create_database_dir(path: String) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Database path is empty.".to_string());
    }

    std::fs::create_dir_all(trimmed).map_err(|error| {
        format!("Failed to create database directory '{}': {}", trimmed, error)
    })?;

    Ok(trimmed.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![create_database_dir])
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
