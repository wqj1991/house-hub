//! 桌面 / 移动壳：只做「开库 + IPC」。领域逻辑在 packages/core，数据访问在 packages/data。
//! 命令清单与 D:\repos\house\src-tauri\src\lib.rs 保持一致，P0 阶段逐个搬入。

use std::sync::Mutex;

use rusqlite::Connection;
use serde::Serialize;
use tauri::Manager;

pub struct Db(pub Mutex<Connection>);

#[derive(Serialize)]
pub struct DbStatus {
    path: String,
    communities: i64,
    persons: i64,
    lines: i64,
    stops: i64,
    routes: i64,
    rev: i64,
    version: String,
}

fn open_db(app: &tauri::AppHandle) -> Result<(Connection, String), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("house.db");
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch(include_str!("schema.sql"))
        .map_err(|e| e.to_string())?;
    let migrations = include_str!("../migrations/0001_sync_columns.sql");
    // 加列语句不幂等，失败（列已存在）时忽略
    let _ = conn.execute_batch(migrations);
    Ok((conn, path.to_string_lossy().to_string()))
}

fn count(conn: &Connection, table: &str) -> i64 {
    conn.query_row(&format!("select count(*) from {table}"), [], |r| r.get(0))
        .unwrap_or(0)
}

#[tauri::command]
fn db_status(state: tauri::State<Db>) -> Result<DbStatus, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let path: String = conn
        .query_row("select file from pragma_database_list where name = 'main'", [], |r| r.get(0))
        .unwrap_or_default();
    Ok(DbStatus {
        path,
        communities: count(&conn, "community"),
        persons: count(&conn, "person"),
        lines: count(&conn, "line"),
        stops: count(&conn, "stop"),
        routes: count(&conn, "route"),
        rev: conn
            .query_row("select coalesce(max(rev), 0) from community", [], |r| r.get(0))
            .unwrap_or(0),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let (conn, _path) = open_db(app.handle())?;
            app.manage(Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![db_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
