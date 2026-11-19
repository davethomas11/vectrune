//! Comparable raw KV transactions, not a full Rune service benchmark.
use redb::{ReadableDatabase, ReadableTable, TableDefinition};
use serde_json::{json, Value};
use std::{hint::black_box, time::Instant};
const TABLE: TableDefinition<&[u8], &[u8]> = TableDefinition::new("kv");
fn percentile(values: &[f64], p: f64) -> f64 { values[((values.len()-1) as f64*p).round() as usize] }
fn main() {
    let mut results = Vec::new();
    for size in [128, 1024, 16384] {
        let payload = rmp_serde::to_vec_named(&json!({"value":"x".repeat(size)})).unwrap();
        for batch in [1, 32, 256] {
            for engine in ["redb", "sqlite-wal"] {
                let folder = tempfile::tempdir().unwrap(); let path = folder.path().join("db");
                let redb = if engine == "redb" { let db = redb::Database::builder().set_cache_size(16*1024*1024).create(&path).unwrap(); let tx = db.begin_write().unwrap(); tx.open_table(TABLE).unwrap(); tx.commit().unwrap(); Some(db) } else { None };
                let mut sqlite = if engine == "sqlite-wal" { let db = rusqlite::Connection::open(&path).unwrap(); db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA fullfsync=ON; PRAGMA checkpoint_fullfsync=ON; PRAGMA cache_size=-16384; CREATE TABLE kv(k BLOB PRIMARY KEY, v BLOB NOT NULL) WITHOUT ROWID;").unwrap(); Some(db) } else { None };
                let rounds = 32;
                let mut latencies = Vec::new();
                let start = Instant::now();
                for round in 0..rounds {
                    let start = Instant::now();
                    if let Some(db) = &redb {
                        let tx = db.begin_write().unwrap();
                        { let mut table = tx.open_table(TABLE).unwrap();
                          for i in 0..batch { table.insert(((round*batch+i) as u64).to_be_bytes().as_slice(), payload.as_slice()).unwrap(); } }
                        tx.commit().unwrap();
                    } else if let Some(db) = &mut sqlite {
                        let tx = db.transaction().unwrap();
                        { let mut insert = tx.prepare_cached("INSERT INTO kv VALUES (?1,?2)").unwrap();
                          for i in 0..batch { insert.execute(rusqlite::params![((round*batch+i) as u64).to_be_bytes().as_slice(), payload.as_slice()]).unwrap(); } }
                        tx.commit().unwrap();
                    }
                    latencies.push(start.elapsed().as_secs_f64()*1e6);
                }
                let write_seconds = start.elapsed().as_secs_f64(); latencies.sort_by(f64::total_cmp);
                let mut read_latencies = Vec::new();
                let start = Instant::now();
                for i in 0..1000 {
                    let start = Instant::now(); let key = ((i*3571 % (rounds*batch)) as u64).to_be_bytes();
                    if let Some(db) = &redb { let tx = db.begin_read().unwrap(); let table = tx.open_table(TABLE).unwrap(); let value = table.get(key.as_slice()).unwrap().unwrap(); black_box(rmp_serde::from_slice::<Value>(value.value()).unwrap()); }
                    else if let Some(db) = &sqlite { let value: Vec<u8> = db.prepare_cached("SELECT v FROM kv WHERE k=?1").unwrap().query_row([key.as_slice()], |r| r.get(0)).unwrap(); black_box(rmp_serde::from_slice::<Value>(&value).unwrap()); }
                    read_latencies.push(start.elapsed().as_secs_f64()*1e6);
                }
                let read_seconds = start.elapsed().as_secs_f64(); read_latencies.sort_by(f64::total_cmp);
                let file_bytes: u64 = std::fs::read_dir(folder.path()).unwrap().map(|e| e.unwrap().metadata().unwrap().len()).sum();
                results.push(json!({"engine":engine,"payload_bytes":payload.len(),"batch":batch,"committed_records":rounds*batch,
                    "write_records_per_second":(rounds*batch) as f64/write_seconds,
                    "commit_us":{"p50":percentile(&latencies,0.5),"p95":percentile(&latencies,0.95),"p99":percentile(&latencies,0.99)},
                    "warm_read_per_second":1000.0/read_seconds,
                    "warm_read_decode_us":{"p50":percentile(&read_latencies,0.5),"p95":percentile(&read_latencies,0.95),"p99":percentile(&read_latencies,0.99)},"live_files_bytes":file_bytes}));
            }
        }
    }
    println!("{}", serde_json::to_string_pretty(&json!({"profile":"release","redb":"5.0.0 Immediate","sqlite":rusqlite::version(),"sqlite_settings":"WAL + synchronous FULL + fullfsync ON + checkpoint_fullfsync ON","cache_bytes":16*1024*1024,"scope":"Raw single-writer KV append-inserts and warm point read+MessagePack decode. Includes commit latency; no Rune change log, network, cold-cache or mixed-load claims. Fixed engine order may bias OS caches. Files measured with connections open, including WAL.","results":results})).unwrap());
}
