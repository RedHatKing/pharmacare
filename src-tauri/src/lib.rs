use serde_json::{json, Map, Number, Value};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

static DB_LOCATION: OnceLock<Mutex<String>> = OnceLock::new();
static DB_CONNECTION: OnceLock<Mutex<Option<rusqlite::Connection>>> = OnceLock::new();

fn default_db_directory() -> String {
    "E:/PharmaCare Database".to_string()
}

fn get_db_location_state() -> &'static Mutex<String> {
    DB_LOCATION.get_or_init(|| Mutex::new(default_db_directory()))
}

fn get_db_connection_state() -> &'static Mutex<Option<rusqlite::Connection>> {
    DB_CONNECTION.get_or_init(|| Mutex::new(None))
}

fn normalize_directory_path(path: &str) -> Result<String, String> {
    let cleaned = path.trim().trim_matches('"').replace('\\', "/");
    let trimmed = cleaned.trim();

    if trimmed.is_empty() {
        return Err("Database directory is empty.".to_string());
    }

    let is_allowed = trimmed.starts_with('/')
        || trimmed.starts_with("C:/")
        || trimmed.starts_with("D:/")
        || trimmed.starts_with("E:/")
        || trimmed.starts_with("F:/")
        || trimmed.starts_with("G:/")
        || trimmed.starts_with("H:/")
        || trimmed.starts_with("$HOME/")
        || trimmed.starts_with("~/")
        || trimmed.starts_with("C:\\")
        || trimmed.starts_with("D:\\")
        || trimmed.starts_with("E:\\")
        || trimmed.starts_with("F:\\")
        || trimmed.starts_with("G:\\")
        || trimmed.starts_with("H:\\")
        || trimmed.starts_with("$HOME\\")
        || trimmed.starts_with("~/");

    if !is_allowed {
        return Err(format!(
            "Database directory '{}' is not an allowed absolute path for this application.",
            trimmed
        ));
    }

    Ok(trimmed)
}

fn resolve_database_directory(path: &str) -> Result<PathBuf, String> {
    let normalized = normalize_directory_path(path)?;
    let candidate = Path::new(&normalized);

    let directory = if candidate
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("db"))
    {
        candidate.parent().unwrap_or_else(|| Path::new("."))
    } else {
        candidate
    };

    if !directory.exists() {
        std::fs::create_dir_all(directory).map_err(|error| {
            format!(
                "Failed to create database directory '{}': {}",
                directory.display(),
                error
            )
        })?;
    }

    Ok(directory.to_path_buf())
}

fn resolve_database_file(path: &str) -> Result<PathBuf, String> {
    let directory = resolve_database_directory(path)?;
    Ok(directory.join("pharmacare.db"))
}

fn ensure_database_connection(path: &str) -> Result<(), String> {
    let normalized_path = normalize_directory_path(path)?;
    let mut connection_state = get_db_connection_state()
        .lock()
        .map_err(|error| error.to_string())?;

    if connection_state.is_some() {
        let active_path = get_db_location_state()
            .lock()
            .map_err(|error| error.to_string())?;
        if !active_path.trim().is_empty() && active_path.trim() == normalized_path {
            return Ok(());
        }
    }

    let db_path = resolve_database_file(&normalized_path)?;
    let connection = rusqlite::Connection::open(&db_path).map_err(|error| {
        format!(
            "Failed to open SQLite database '{}': {}",
            db_path.display(),
            error
        )
    })?;

    connection
        .execute_batch(
            "PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;",
        )
        .map_err(|error| {
            format!(
                "Failed to configure SQLite database '{}': {}",
                db_path.display(),
                error
            )
        })?;

    *connection_state = Some(connection);
    *get_db_location_state()
        .lock()
        .map_err(|error| error.to_string())? = normalized_path;

    Ok(())
}

fn sqlite_value_to_json(value: &rusqlite::types::ValueRef<'_>) -> Value {
    match value {
        rusqlite::types::ValueRef::Null => Value::Null,
        rusqlite::types::ValueRef::Integer(value) => Value::Number(Number::from(*value)),
        rusqlite::types::ValueRef::Real(value) => Number::from_f64(*value)
            .map(Value::Number)
            .unwrap_or(Value::Null),
        rusqlite::types::ValueRef::Text(value) => {
            Value::String(String::from_utf8_lossy(value).into_owned())
        }
        rusqlite::types::ValueRef::Blob(value) => {
            Value::String(String::from_utf8_lossy(value).into_owned())
        }
    }
}

fn json_value_to_sqlite(value: &Value) -> rusqlite::types::Value {
    match value {
        Value::Null => rusqlite::types::Value::Null,
        Value::Bool(flag) => rusqlite::types::Value::Integer(if *flag { 1 } else { 0 }),
        Value::Number(number) => {
            if let Some(int_value) = number.as_i64() {
                rusqlite::types::Value::Integer(int_value)
            } else if let Some(float_value) = number.as_f64() {
                rusqlite::types::Value::Real(float_value)
            } else {
                rusqlite::types::Value::Null
            }
        }
        Value::String(string) => rusqlite::types::Value::Text(string.clone()),
        Value::Array(values) => {
            let joined = values
                .iter()
                .map(|entry| serde_json::to_string(entry).unwrap_or_else(|_| "null".to_string()))
                .collect::<Vec<_>>()
                .join(",");
            rusqlite::types::Value::Text(joined)
        }
        Value::Object(_) => {
            let serialized = serde_json::to_string(value).unwrap_or_else(|_| "null".to_string());
            rusqlite::types::Value::Text(serialized)
        }
    }
}

#[tauri::command]
fn create_database_dir(path: String) -> Result<String, String> {
    let directory = resolve_database_directory(&path)?;
    Ok(directory.to_string_lossy().replace('\\', "/").to_string())
}

#[tauri::command]
fn set_db_location(path: String) -> Result<String, String> {
    let normalized_path = normalize_directory_path(&path)?;
    let resolved_dir = resolve_database_directory(&normalized_path)?;
    let final_path = resolved_dir.to_string_lossy().replace('\\', "/");

    ensure_database_connection(&final_path)?;
    Ok(final_path)
}

#[tauri::command]
fn get_db_location() -> Result<String, String> {
    let current = get_db_location_state()
        .lock()
        .map_err(|error| error.to_string())?;
    let value = current.trim();
    Ok(if value.is_empty() {
        default_db_directory()
    } else {
        value.to_string()
    })
}

#[tauri::command]
fn execute_sql(sql: String, params: Vec<Value>) -> Result<Value, String> {
    let active_path = get_db_location_state()
        .lock()
        .map_err(|error| error.to_string())?;
    let path_for_query = if active_path.trim().is_empty() {
        default_db_directory()
    } else {
        active_path.clone()
    };
    drop(active_path);

    ensure_database_connection(&path_for_query)?;

    let mut connection_guard = get_db_connection_state()
        .lock()
        .map_err(|error| error.to_string())?;
    let connection = connection_guard.as_mut().ok_or_else(|| {
        format!(
            "No SQLite database connection is initialized for '{}'.",
            path_for_query
        )
    })?;

    let converted = params.iter().map(json_value_to_sqlite).collect::<Vec<_>>();
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("Failed to prepare SQL statement '{}': {}", sql, error))?;

    let rows_changed = statement
        .execute(rusqlite::params_from_iter(converted))
        .map_err(|error| format!("Failed to execute SQL statement '{}': {}", sql, error))?;

    Ok(json!({
        "lastInsertId": connection.last_insert_rowid().max(0),
        "changes": rows_changed
    }))
}

#[tauri::command]
fn select_sql_all(sql: String, params: Vec<Value>) -> Result<Vec<Value>, String> {
    let active_path = get_db_location_state()
        .lock()
        .map_err(|error| error.to_string())?;
    let path_for_query = if active_path.trim().is_empty() {
        default_db_directory()
    } else {
        active_path.clone()
    };
    drop(active_path);

    ensure_database_connection(&path_for_query)?;

    let mut connection_guard = get_db_connection_state()
        .lock()
        .map_err(|error| error.to_string())?;
    let connection = connection_guard.as_mut().ok_or_else(|| {
        format!(
            "No SQLite database connection is initialized for '{}'.",
            path_for_query
        )
    })?;

    let converted = params.iter().map(json_value_to_sqlite).collect::<Vec<_>>();
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("Failed to prepare SQL statement '{}': {}", sql, error))?;
    let column_names = statement
        .column_names()
        .iter()
        .map(|name| name.to_string())
        .collect::<Vec<_>>();

    let rows = statement
        .query_map(rusqlite::params_from_iter(converted), |row| {
            let mut object = Map::new();
            for (index, name) in column_names.iter().enumerate() {
                let value = row.get_ref(index)?;
                object.insert(name.clone(), sqlite_value_to_json(&value));
            }
            Ok(Value::Object(object))
        })
        .map_err(|error| format!("Failed to execute SQL query '{}': {}", sql, error))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to enumerate SQL query rows '{}': {}", sql, error))?;

    Ok(rows)
}

#[tauri::command]
fn select_sql_get(sql: String, params: Vec<Value>) -> Result<Value, String> {
    let rows = select_sql_all(sql, params)?;
    if rows.is_empty() {
        Ok(Value::Null)
    } else {
        Ok(rows[0].clone())
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            create_database_dir,
            set_db_location,
            get_db_location,
            execute_sql,
            select_sql_all,
            select_sql_get
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
