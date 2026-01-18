// src/builtins/datasource_mysql.rs
use crate::builtins::{BuiltinResult, Context};
use serde_json::{Map, Value as JsonValue};
use sqlx::{mysql::MySqlRow, Column, Pool, MySql, Row};

use tokio::sync::OnceCell;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

static MYSQL_POOLS: OnceCell<Arc<Mutex<HashMap<String, Pool<MySql>>>>> =
    OnceCell::const_new();

async fn init_pool(connection_string: &str) {
    let pool = Pool::<MySql>::connect(connection_string).await.unwrap();
    let pools = MYSQL_POOLS
        .get_or_init(|| async { Arc::new(Mutex::new(HashMap::new())) })
        .await;
    let mut pools_guard = pools.lock().await;
    pools_guard.insert(connection_string.to_string(), pool);
}

/// Create or reuse a MySQL connection pool
pub async fn create_or_reuse_mysql_pool(
    connection_string: &str,
) -> Result<Pool<MySql>, sqlx::Error> {
    let pools = MYSQL_POOLS
        .get_or_init(|| async { Arc::new(Mutex::new(HashMap::new())) })
        .await;
    let mut pools_guard: tokio::sync::MutexGuard<HashMap<String, Pool<MySql>>> =
        pools.lock().await;
    if !pools_guard.contains_key(connection_string) {
        let pool = Pool::<MySql>::connect(connection_string).await?;
        pools_guard.insert(connection_string.to_string(), pool);
    }
    Ok(pools_guard.get(connection_string).unwrap().clone())
}

pub fn create_table_columns_string(columns: &[(String, String)]) -> String {
    columns
        .iter()
        .map(|(name, typ)| format!("{} {}", name, typ))
        .collect::<Vec<String>>()
        .join(", ")
}

pub async fn create_table_mysql(
    name: &str,
    args: &[String],
    pool: &Pool<MySql>,
) -> BuiltinResult {
    if args.is_empty() {
        return BuiltinResult::Error("mysql.create_table: missing table schema".to_string());
    }
    let schema = &args[0];
    let create_table_query = format!("CREATE TABLE IF NOT EXISTS {} ({})", name, schema);
    match sqlx::query(&create_table_query).execute(pool).await {
        Ok(_) => BuiltinResult::Ok,
        Err(e) => BuiltinResult::Error(format!("mysql.create_table error: {}", e)),
    }
}

/// Built-in to execute a MySQL query and store results in context.
/// Expected args: ["query_string", "param1", "param2", ...]
pub async fn builtin_mysql_query(
    args: &[String],
    ctx: &mut Context,
    pool: &Pool<MySql>,
    assign_to: Option<&str>,
) -> BuiltinResult {
    if args.is_empty() {
        return BuiltinResult::Error("mysql: missing query argument".to_string());
    }

    let query_str = &args[0];
    let mut query = sqlx::query(query_str);

    // Bind parameters from the remaining args
    for arg_name in &args[1..] {
        if let Some(val) = ctx.get(arg_name) {
            match val {
                JsonValue::String(s) => query = query.bind(s),
                JsonValue::Number(n) => {
                    if let Some(f) = n.as_f64() {
                        query = query.bind(f);
                    }
                }
                JsonValue::Bool(b) => query = query.bind(b),
                _ => {
                    return BuiltinResult::Error(format!("Unsupported param type for {}", arg_name))
                }
            }
        }
    }

    match query.fetch_all(pool).await {
        Ok(rows) => {
            let json_rows: Vec<JsonValue> = rows.iter().map(row_to_json).collect();
            if let Some(target) = assign_to {
                ctx.insert(target.to_string(), JsonValue::Array(json_rows));
            }
            BuiltinResult::Ok
        }
        Err(e) => BuiltinResult::Error(format!("MySQL error: {}", e)),
    }
}

/// Helper to convert a MySqlRow into a JSON Object
fn row_to_json(row: &MySqlRow) -> JsonValue {
    let mut map = Map::new();
    for column in row.columns() {
        let name = column.name();
        let val: JsonValue =
            // Try to extract as String
            row.try_get::<String, &str>(name).map(JsonValue::String)
            // Try to extract as i32
            .or_else(|_| row.try_get::<i32, &str>(name).map(|n| JsonValue::Number(n.into())))
            // Try to extract as i64
            .or_else(|_| row.try_get::<i64, &str>(name).map(|n| JsonValue::Number(n.into())))
            // Try to extract as f64
            .or_else(|_| row.try_get::<f64, &str>(name).map(|f| {
                serde_json::Number::from_f64(f)
                    .map(JsonValue::Number)
                    .unwrap_or(JsonValue::Null)
            }))
            // Try to extract as bool
            .or_else(|_| row.try_get::<bool, &str>(name).map(JsonValue::Bool))
            // Fallback to Null
            .unwrap_or(JsonValue::Null);

        map.insert(name.to_string(), val);
    }
    JsonValue::Object(map)
}
