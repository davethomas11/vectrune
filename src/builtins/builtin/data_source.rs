use crate::builtins::builtin::postgres::{
    builtin_postgres_query, create_or_reuse_postgres_pool, create_table_columns_string,
    create_table_postgres,
};
use crate::builtins::builtin::mysql::{
    create_table_mysql, create_or_reuse_mysql_pool, builtin_mysql_query
};
use crate::builtins::{BuiltinResult, Context};
use crate::rune_ast::{Section, Value};
use crate::core::AppState;
use sqlx::{Pool, Postgres, MySql};
use std::collections::HashMap;
use std::sync::Arc;
use sqlx::types::JsonValue;
// --- Shared Helpers ---

async fn get_pool_details(datasource_name: &str, state: &AppState) -> Result<(String, String), BuiltinResult> {
    let datasource_section = state.data_sources.get(datasource_name).ok_or_else(|| {
        BuiltinResult::Error(format!("Data source '{}' not found", datasource_name))
    })?;

    let conn_str = datasource_section.kv.get("connection")
        .and_then(|v| if let Value::String(s) = v { Some(s) } else { None })
        .ok_or_else(|| BuiltinResult::Error("connection string not specified".to_string()))?;

    let conn_type = datasource_section.kv.get("type")
        .and_then(|v| if let Value::String(t) = v { Some(t.clone()) } else { None })
        .ok_or_else(|| BuiltinResult::Error("connection type not specified".to_string()))?;

    Ok((conn_str.to_string(), conn_type))
}

async fn get_postgres_pool(datasource_name: &str, state: &AppState) -> Result<Pool<Postgres>, BuiltinResult> {
    let (conn_str, conn_type) = get_pool_details(datasource_name, state).await?;
    if conn_type != "postgres" {
        return Err(BuiltinResult::Error(format!("Data source '{}' is not postgres", datasource_name)));
    }
    create_or_reuse_postgres_pool(&conn_str).await
        .map_err(|e| BuiltinResult::Error(format!("failed to connect to postgres: {}", e)))
}

async fn get_mysql_pool(datasource_name: &str, state: &AppState) -> Result<Pool<MySql>, BuiltinResult> {
    let (conn_str, conn_type) = get_pool_details(datasource_name, state).await?;
    if conn_type != "mysql" {
        return Err(BuiltinResult::Error(format!("Data source '{}' is not mysql", datasource_name)));
    }
    create_or_reuse_mysql_pool(&conn_str).await
        .map_err(|e| BuiltinResult::Error(format!("failed to connect to mysql: {}", e)))
}

fn get_id_from_ctx(ctx: &Context) -> String {
    ctx.get("path.params")
        .and_then(|v| v.as_object()?.get("id")?.as_str().map(|s| s.to_string()))
        .or_else(|| ctx.get("body").and_then(|v| v.as_object()?.get("id")?.as_str().map(|s| s.to_string())))
        .unwrap_or_default()
}

fn format_sql_value(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => format!("'{}'", s.replace("'", "''")),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        _ => "NULL".to_string(),
    }
}

async fn execute_query(
    conn_type: &str,
    datasource_name: &str,
    state: &AppState,
    ctx: &mut Context,
    query: String,
    assign_to: Option<&str>,
) -> BuiltinResult {
    match conn_type {
        "mysql" => {
            let pool = match get_mysql_pool(datasource_name, state).await {
                Ok(p) => p,
                Err(e) => return e,
            };
            builtin_mysql_query(&[query], ctx, &pool, assign_to).await
        }
        "postgres" => {
            let pool = match get_postgres_pool(datasource_name, state).await {
                Ok(p) => p,
                Err(e) => return e,
            };
            builtin_postgres_query(&[query], ctx, &pool, assign_to).await
        }
        _ => BuiltinResult::Error(format!("unsupported connection type '{}'", conn_type)),
    }
}

// --- RESTful Command Generation ---

fn get_section_by_string_key(
    section: &Section,
    key: &str,
    map: &Arc<HashMap<String, Section>>,
) -> Option<Section> {
    section.kv.get(key).cloned().and_then(|v| {
        if let Value::String(name) = v {
            map.get(&name).cloned()
        } else {
            None
        }
    })
}

pub fn get_data_source_commands(
    method: &str,
    section: Section,
    schemas: &Arc<HashMap<String, Section>>,
    data_sources: &Arc<HashMap<String, Section>>,
    single: bool,
) -> Vec<Value> {
    let schema_name = if let Some(Value::String(name)) = section.kv.get("schema") {
        name.clone()
    } else {
        return vec![Value::String("respond 500 \"Schema name not provided\"".into())];
    };

    let data_source_name = if let Some(Value::String(name)) = section.kv.get("data_source") {
        name.clone()
    } else {
        return vec![Value::String("respond 500 \"Data source name not provided\"".into())];
    };

    let schema = get_section_by_string_key(&section, "schema", schemas);
    let data_source = get_section_by_string_key(&section, "data_source", data_sources);

    if data_source.is_none() {
        return vec![Value::String(format!("respond 500 \"Data source not configured\" with name {}", data_source_name).into())];
    }

    if schema.is_none() {
        return vec![Value::String("respond 500 \"Schema not found\"".into())];
    }

    let create_table_command = format!("datasource create_table {} in {}", schema_name, data_source_name);
    let fetch_command = if single {
        format!("datasource fetch {} from {} into data", schema_name, data_source_name)
    } else {
        format!("datasource fetch_all {} from {} into data", schema_name, data_source_name)
    };

    match method {
        "GET" => vec![
            Value::String(create_table_command),
            Value::String(fetch_command),
            Value::String("respond 200 data".to_string()),
        ],
        "POST" => vec![
            Value::String("parse-json".to_string()),
            Value::String("validate body #".to_string() + &schema_name),
            Value::String(create_table_command),
            Value::String(format!("datasource insert {} into {}", schema_name, data_source_name)),
            Value::String("respond 201 created".to_string()),
        ],
        "PUT" => vec![
            Value::String("parse-json".to_string()),
            Value::String(create_table_command),
            Value::String(format!("datasource update {} in {}", schema_name, data_source_name)),
            Value::String("respond 200 data_object".to_string()),
        ],
        "DELETE" => vec![
            Value::String(format!("datasource delete {} from {}", schema_name, data_source_name)),
            Value::String("respond 204".to_string()),
        ],
        _ => vec![],
    }
}

// --- Builtin Entrypoint & Operations ---

pub async fn builtin_data_source(
    args: &[String],
    ctx: &mut Context,
    state: &AppState,
    assign_to: Option<&str>,
) -> BuiltinResult {
    if args.is_empty() { return BuiltinResult::Error("missing arguments".to_string()); }
    let action = &args[0];
    let name = if args.len() > 1 { &args[1] } else { "" };
    let action_args = if args.len() > 2 { &args[2..] } else { &[] };

    match action.as_str() {
        "create_table" => create_table(name, action_args, state).await,
        "fetch_all" => fetch_all_from_datasource(name, action_args, state, ctx, assign_to).await,
        "fetch" => fetch_from_datasource(name, action_args, state, ctx, assign_to).await,
        "insert" => upsert_into_datasource(name, action_args, state, ctx).await,
        "update" => upsert_into_datasource(name, action_args, state, ctx).await,
        "delete" => delete_from_datasource(name, action_args, state, ctx, assign_to).await,
        _ => BuiltinResult::Error(format!("unknown action: {}", action)),
    }
}

pub async fn create_table(name: &str, args: &[String], state: &AppState) -> BuiltinResult {
    let schema_section = state.schemas.get(name).unwrap_or_else(|| {
        eprintln!(
            "[ERROR] datasource.create_table: schema '{}' not found",
            name
        );
        panic!("schema not found");
    });
    let datasource_name = if args.len() > 1 && args[0] == "in" { &args[1] } else { return BuiltinResult::Error("missing 'in'".into()); };
    let (_, conn_type) = match get_pool_details(datasource_name, state).await{
        Ok(v) => v,
        Err(e) => return e,
    };

    let mut columns: Vec<(String, String)> = Vec::new();
    for (field, typ_value) in &schema_section.kv {
        if let Value::String(typ) = typ_value {
            let sql_type = match typ.as_str() {
                "string" => "TEXT",
                "number" => "FLOAT",
                "bool" => "BOOLEAN",
                _ => return BuiltinResult::Error(format!("unsupported type '{}'", typ)),
            };
            columns.push((field.clone(), sql_type.to_string()));
        }
    }

    if conn_type == "mysql" {
        columns.insert(0, ("id".to_string(), "INT AUTO_INCREMENT PRIMARY KEY".to_string()));
        let pool = match get_mysql_pool(datasource_name, state).await {
            Ok(p) => p,
            Err(e) => return e,
        };
        create_table_mysql(name, &[create_table_columns_string(&columns)], &pool).await
    } else {
        columns.insert(0, ("id".to_string(), "SERIAL PRIMARY KEY".to_string()));
        let pool = match get_postgres_pool(datasource_name, state).await{
            Ok(p) => p,
            Err(e) => return e,
        };
        create_table_postgres(name, &[create_table_columns_string(&columns)], &pool).await
    }
}

pub async fn fetch_all_from_datasource(name: &str, args: &[String], state: &AppState, ctx: &mut Context, assign_to: Option<&str>) -> BuiltinResult {
    let ds_name = if args.len() > 1 && args[0] == "from" { &args[1] } else { "" };
    let (_, conn_type) = match get_pool_details(ds_name, state).await {
        Ok(v) => v,
        Err(e) => return e,
    };
    let target = if args.len() > 3 && args[2] == "into" { Some(args[3].as_str()) } else { assign_to };

    execute_query(&conn_type, ds_name, state, ctx, format!("SELECT * FROM {}", name), target).await
}

pub async fn fetch_from_datasource(name: &str, args: &[String], state: &AppState, ctx: &mut Context, assign_to: Option<&str>) -> BuiltinResult {
    let ds_name = args.get(1).map(|s| s.as_str()).unwrap_or("");
    let (_, conn_type) = match get_pool_details(ds_name, state).await {
        Ok(v) => v,
        Err(e) => return e,
    };
    let target = if args.len() > 3 && args[2] == "into" { Some(args[3].as_str()) } else { assign_to };
    let id = get_id_from_ctx(ctx);

    if id.is_empty() { return BuiltinResult::Error("missing id".into()); }
    match execute_query(&conn_type, ds_name, state, ctx, format!("SELECT * FROM {} WHERE id = {} LIMIT 1", name, id), target).await {
        BuiltinResult::Ok => {
            // After fetching, move the first result into target variable
            if let Some(var_name) = target {
                if let Some(JsonValue::Array(arr)) = ctx.get(var_name) {
                    if let Some(first) = arr.get(0) {
                        ctx.insert(var_name.into(), first.clone());
                    } else {
                        return BuiltinResult::Respond(404, "no record found".into())
                    }
                }
            }
            BuiltinResult::Ok
        }
        other => other,
    }
}

pub async fn delete_from_datasource(name: &str, args: &[String], state: &AppState, ctx: &mut Context, assign_to: Option<&str>) -> BuiltinResult {
    let ds_name = args.get(1).map(|s| s.as_str()).unwrap_or("");
    let (_, conn_type) = match get_pool_details(ds_name, state).await {
        Ok(v) => v,
        Err(e) => return e,
    };
    let id = get_id_from_ctx(ctx);

    execute_query(&conn_type, ds_name, state, ctx, format!("DELETE FROM {} WHERE id = {}", name, id), assign_to).await
}

pub async fn upsert_into_datasource(name: &str, args: &[String], state: &AppState, ctx: &mut Context) -> BuiltinResult {
    let id = get_id_from_ctx(ctx);
    if !id.is_empty() && id != "0" {
        return update_datasource(name, args, state, ctx).await;
    }
    insert_into_datasource(name, args, state, ctx).await
}

pub async fn insert_into_datasource(name: &str, args: &[String], state: &AppState, ctx: &mut Context) -> BuiltinResult {
    let ds_name = args.get(1).map(|s| s.as_str()).unwrap_or("");
    let (_, conn_type) = match get_pool_details(ds_name, state).await {
        Ok(v) => v,
        Err(e) => return e,
    };
    let obj = match ctx.get("body") {
        Some(v) => match v.as_object() {
            Some(o) => o,
            None => return BuiltinResult::Error("body is not an object".into()),
        },
        None => return BuiltinResult::Error("body missing".into()),
    };
    let fields: Vec<String> = obj.keys().cloned().collect();
    let values: Vec<String> = obj.values().map(format_sql_value).collect();
    let query = format!("INSERT INTO {} ({}) VALUES ({})", name, fields.join(", "), values.join(", "));

    execute_query(&conn_type, ds_name, state, ctx, query, None).await
}

pub async fn update_datasource(name: &str, args: &[String], state: &AppState, ctx: &mut Context) -> BuiltinResult {
    let schema_section = match state.schemas.get(name) {
        Some(s) => s,
        None => return BuiltinResult::Error(format!("schema '{}' not found", name)),
    };
    let ds_name = args.get(1).map(|s| s.as_str()).unwrap_or("");
    let (_, conn_type) = match get_pool_details(ds_name, state).await {
        Ok(v) => v,
        Err(e) => return e,
    };
    let id = get_id_from_ctx(ctx);
    let obj = match ctx.get("body") {
        Some(v) => match v.as_object() {
            Some(o) => o,
            None => return BuiltinResult::Error("body is not an object".into()),
        },
        None => return BuiltinResult::Error("body missing".into()),
    };

    let assignments: Vec<String> = schema_section.kv.keys()
        .filter_map(|f| obj.get(f).map(|v| format!("{} = {}", f, format_sql_value(v))))
        .collect();
    let query = format!("UPDATE {} SET {} WHERE id = {}", name, assignments.join(", "), id);

    execute_query(&conn_type, ds_name, state, ctx, query, None).await
}