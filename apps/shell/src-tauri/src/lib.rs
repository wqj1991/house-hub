//! 桌面 / 移动壳：只做「开库 + IPC」。领域逻辑在 packages/core，数据访问在 packages/data。
//! 命令清单与 D:\repos\house\src-tauri\src\lib.rs 保持一致，P0 阶段逐个搬入；
//! P2 已把同步落地（apply_sync_page）与只读查询补上，其余命令保留 TODO(P3)。

use std::collections::HashMap;
use std::sync::Mutex;

use rusqlite::types::Value as SqlValue;
use rusqlite::{params_from_iter, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map as JsonMap, Value as Json};
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

/** 与 @house/protocol 的 SYNC_TABLES 一一对应；白名单外的一律丢弃。 */
const SYNC_TABLES: &[&str] = &[
    "person",
    "anchor",
    "mode",
    "line",
    "stop",
    "community",
    "community_quality",
    "score_rule",
    "route",
    "shortlist",
    "jifen",
    "check_state",
    "app_setting",
    "house",
    "house_score",
    "house_redline",
];

const COMMUNITY_COLS: &str = "uid, id, name, district, bizcircle, lng, lat, \
 build_year as buildYear, build_type as buildType, property_type as propertyType, \
 price, price_tx as priceTx, price_src_n as priceSrcN, bargain, cycle_days as cycleDays, \
 tx_n as txN, online, address, tags, source, fetched_at as fetchedAt, rev";

fn open_db(app: &tauri::AppHandle) -> Result<(Connection, String), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("house.db");
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.execute_batch(include_str!("schema.sql"))
        .map_err(|e| e.to_string())?;
    // 加列语句不幂等，失败（列已存在）时忽略；建表/建索引语句本身幂等。
    let _ = conn.execute_batch(include_str!("../migrations/0001_sync_columns.sql"));
    conn.execute_batch(include_str!("../migrations/0002_sync_meta.sql"))
        .map_err(|e| e.to_string())?;
    Ok((conn, path.to_string_lossy().to_string()))
}

fn count(conn: &Connection, table: &str) -> i64 {
    conn.query_row(&format!("select count(*) from {table}"), [], |r| r.get(0))
        .unwrap_or(0)
}

/** 本地游标只存在 sync_meta：写进 app_setting 会跟着同步跑，等于两端互相覆盖。 */
fn read_rev(conn: &Connection) -> i64 {
    conn.query_row("select cast(value as integer) from sync_meta where key = 'rev'", [], |r| r.get(0))
        .unwrap_or(0)
}

fn write_rev(conn: &Connection, rev: i64) -> Result<(), String> {
    conn.execute(
        "insert into sync_meta (key, value) values ('rev', ?1) \
         on conflict(key) do update set value = excluded.value",
        [rev.to_string()],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
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
        rev: read_rev(&conn),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

fn from_sql(v: SqlValue) -> Json {
    match v {
        SqlValue::Null => Json::Null,
        SqlValue::Integer(i) => Json::from(i),
        SqlValue::Real(f) => Json::from(f),
        SqlValue::Text(t) => Json::from(t),
        SqlValue::Blob(_) => Json::Null,
    }
}

fn to_sql(v: &Json) -> SqlValue {
    match v {
        Json::Null => SqlValue::Null,
        Json::Bool(b) => SqlValue::Integer(i64::from(*b)),
        Json::Number(n) => match n.as_i64() {
            Some(i) => SqlValue::Integer(i),
            None => SqlValue::Real(n.as_f64().unwrap_or(0.0)),
        },
        Json::String(s) => SqlValue::Text(s.clone()),
        other => SqlValue::Text(other.to_string()),
    }
}

fn columns(conn: &Connection, table: &str) -> Vec<String> {
    let sql = format!("pragma table_info(\"{table}\")");
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    let out: Vec<String> = match stmt.query_map([], |r| r.get::<_, String>(1)) {
        Ok(it) => it.filter_map(Result::ok).collect(),
        Err(_) => Vec::new(),
    };
    out
}

fn query_json(conn: &Connection, sql: &str, args: Vec<SqlValue>) -> Result<Vec<JsonMap<String, Json>>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let rows = stmt
        .query_map(params_from_iter(args), |row| {
            let mut m = JsonMap::new();
            for (i, name) in names.iter().enumerate() {
                let v: SqlValue = row.get(i).unwrap_or(SqlValue::Null);
                m.insert(name.clone(), from_sql(v));
            }
            Ok(m)
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/** tags 存 text（逗号分隔），online 存 integer；这里统一成前端的形状。 */
fn fix_community(mut row: JsonMap<String, Json>) -> JsonMap<String, Json> {
    if let Some(Json::String(tags)) = row.get("tags") {
        let arr: Vec<Json> = tags
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| Json::from(s))
            .collect();
        row.insert("tags".into(), Json::Array(arr));
    }
    if let Some(Json::Number(n)) = row.get("online") {
        row.insert("online".into(), Json::Bool(n.as_i64().unwrap_or(0) != 0));
    }
    row
}

#[derive(Deserialize)]
pub struct SyncPage {
    rev: i64,
    #[serde(default)]
    rows: HashMap<String, Vec<JsonMap<String, Json>>>,
    #[serde(default)]
    deleted: HashMap<String, Vec<String>>,
}

#[tauri::command]
fn sync_rev(state: tauri::State<Db>) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    Ok(read_rev(&conn))
}

#[tauri::command]
fn search_communities(state: tauri::State<Db>, q: String, limit: i64) -> Result<Vec<JsonMap<String, Json>>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let sql = format!("select {COMMUNITY_COLS} from community where deleted_at is null \
         and (?1 = '' or name like '%'||?1||'%' or district like '%'||?1||'%' or coalesce(bizcircle,'') like '%'||?1||'%') \
         order by name limit ?2");
    let rows = query_json(&conn, &sql, vec![SqlValue::Text(q), SqlValue::Integer(limit.clamp(1, 500))])?;
    Ok(rows.into_iter().map(fix_community).collect())
}

#[tauri::command]
fn get_community(state: tauri::State<Db>, id: i64) -> Result<Option<JsonMap<String, Json>>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let sql = format!("select {COMMUNITY_COLS} from community where deleted_at is null and id = ?1 limit 1");
    let mut rows = query_json(&conn, &sql, vec![SqlValue::Integer(id)])?;
    Ok(rows.pop().map(fix_community))
}

#[tauri::command]
fn list_shortlist(state: tauri::State<Db>) -> Result<Vec<JsonMap<String, Json>>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let sql = format!("select c.uid, c.id, c.name, c.district, c.bizcircle, c.lng, c.lat, \
         c.build_year as buildYear, c.build_type as buildType, c.property_type as propertyType, \
         c.price, c.price_tx as priceTx, c.price_src_n as priceSrcN, c.bargain, \
         c.cycle_days as cycleDays, c.tx_n as txN, c.online, c.address, c.tags, c.source, \
         c.fetched_at as fetchedAt, c.rev \
         from shortlist s join community c on c.id = s.community_id \
         where s.deleted_at is null and c.deleted_at is null order by s.added_at desc");
    let rows = query_json(&conn, &sql, vec![])?;
    Ok(rows.into_iter().map(fix_community).collect())
}

#[tauri::command]
fn add_shortlist(state: tauri::State<Db>, community_id: i64, note: Option<String>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "insert into shortlist (community_id, note, uid, rev) values (?1, ?2, lower(hex(randomblob(16))), 0) \
         on conflict(community_id) do update set note = excluded.note, deleted_at = null, \
         updated_at = datetime('now'), rev = shortlist.rev + 1",
        rusqlite::params![community_id, note],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_shortlist(state: tauri::State<Db>, community_id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "update shortlist set deleted_at = datetime('now'), rev = rev + 1 where community_id = ?1",
        [community_id],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_settings(state: tauri::State<Db>) -> Result<HashMap<String, String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn	
        .prepare("select key, value from app_setting where deleted_at is null")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<HashMap<_, _>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
fn put_setting(state: tauri::State<Db>, key: String, value: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "insert into app_setting (key, value, uid, rev) values (?1, ?2, lower(hex(randomblob(16))), 0) \
         on conflict(key) do update set value = excluded.value, deleted_at = null, \
         updated_at = datetime('now'), rev = app_setting.rev + 1",
        rusqlite::params![key, value],
    )
    .map(|_| ())
    .map_err(|e| e.to_string())
}

/** 规则全集 + hash：hash 不一致时页面黄条公示，不静默出旧分（ARCHITECTURE §13）。 */
#[tauri::command]
fn list_rules(state: tauri::State<Db>) -> Result<Json, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rows = query_json(
        &conn,
        "select id, scope, item_key as itemKey, weight, formula, note, updated_at as updatedAt \
         from score_rule where deleted_at is null order by scope, id",
        vec![],
    )?;
    let version = read_rev(&conn);
    let mut acc: u64 = 0xcbf29ce484222325;
    for row in &rows {
        let line = format!(
            "{}|{}|{}|{}",
            row.get("scope").and_then(|v| v.as_str()).unwrap_or(""),
            row.get("itemKey").and_then(|v| v.as_str()).unwrap_or(""),
            row.get("weight").map(|v| v.to_string()).unwrap_or_default(),
            row.get("formula").and_then(|v| v.as_str()).unwrap_or(""),
        );
        for b in line.as_bytes() {
            acc ^= u64::from(*b);
            acc = acc.wrapping_mul(0x100000001b3);
        }
    }
    Ok(json!({
        "version": version,
        "hash": format!("{acc:016x}"),
        "minClientVersion": Json::Null,
        "rows": Json::Array(rows.into_iter().map(Json::Object).collect()),
    }))
}

/** pull 落库：单事务 upsert + 墓碑，最后推进本地 rev。返回写入的行数。 */
#[tauri::command]
fn apply_sync_page(state: tauri::State<Db>, page: SyncPage) -> Result<i64, String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    let tx = guard.transaction().map_err(|e| e.to_string())?;
    let mut written: i64 = 0;

    for (table, rows) in &page.rows {
        if !SYNC_TABLES.contains(&table.as_str()) {
            continue;
        }
        let cols = columns(&tx, table);
        if cols.is_empty() {
            continue;
        }
        for row in rows {
            let uid = match row.get("uid").and_then(|v| v.as_str()) {
                Some(u) if !u.is_empty() => u.to_string(),
                _ => continue,
            };
            let exists: bool = tx
                .query_row(
                    &format!("select 1 from \"{table}\" where uid = ?1 limit 1"),
                    [&uid],
                    |r| r.get::<_, i64>(0),
                )
                .is_ok();
            let mut pairs: Vec<(String, SqlValue)> = Vec::new();
            for c in &cols {
                if c == "uid" || c == "id" {
                    continue;
                }
                if let Some(v) = row.get(c) {
                    pairs.push((c.clone(), to_sql(v)));
                }
            }
            if pairs.is_empty() {
                continue;
            }
            if exists {
                let sets: Vec<String> = pairs.iter().map(|(c, _)| format!("\"{c}\" = ?")).collect();
                let sql = format!(
                    "update \"{table}\" set {}, rev = ?, deleted_at = null where uid = ?",
                    sets.join(", ")
                );
                let mut args: Vec<SqlValue> = pairs.into_iter().map(|(_, v)| v).collect();
                args.push(SqlValue::Integer(page.rev));
                args.push(SqlValue::Text(uid));
                tx.execute(&sql, params_from_iter(args)).map_err(|e| e.to_string())?;
            } else {
                let names: Vec<String> = pairs.iter().map(|(c, _)| format!("\"{c}\"")).collect();
                let holders: Vec<String> = (0..names.len() + 1).map(|i| format!("?{}", i + 1)).collect();
                let sql = format!(
                    "insert into \"{table}\" (uid, {}, rev) values ({}, ?{})",
                    names.join(", "),
                    holders.join(", "),
                    names.len() + 2
                );
                let mut args: Vec<SqlValue> = Vec::with_capacity(names.len() + 2);
                args.push(SqlValue::Text(uid));
                args.extend(pairs.into_iter().map(|(_, v)| v));
                args.push(SqlValue::Integer(page.rev));
                tx.execute(&sql, params_from_iter(args)).map_err(|e| e.to_string())?;
            }
            written += 1;
        }
    }

    for (table, uids) in &page.deleted {
        if !SYNC_TABLES.contains(&table.as_str()) {
            continue;
        }
        for uid in uids {
            tx.execute(
                &format!("update \"{table}\" set deleted_at = datetime('now'), rev = ?1 where uid = ?2"),
                rusqlite::params![page.rev, uid],
            )
            .map_err(|e| e.to_string())?;
            written += 1;
        }
    }

    write_rev(&tx, page.rev)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(written)
}

// TODO(P3): list_quality / list_checks / set_quality / set_check / list_lines / list_houses
// / get_house / save_house / delete_house / set_house_score / set_house_redline 仍未搬入。

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let (conn, _path) = open_db(app.handle())?;
            app.manage(Db(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_status,
            sync_rev,
            apply_sync_page,
            search_communities,
            get_community,
            list_shortlist,
            add_shortlist,
            remove_shortlist,
            get_settings,
            put_setting,
            list_rules
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
