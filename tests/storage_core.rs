use rune_runtime::storage::{self, Request, Store};
use serde_json::{json, Value};
fn req(value: Value) -> Request {
    serde_json::from_value(value).unwrap()
}
fn put(key: &str, value: Value) -> Request {
    req(json!({"op":"put","collection":"notes","key":key,"value":value}))
}
fn get(key: &str) -> Request {
    req(json!({"op":"get","collection":"notes","key":key}))
}

#[test]
fn shares_operation_contract_with_indexeddb() {
    let folder = tempfile::tempdir().unwrap();
    let store = Store::open(&folder.path().join("test.sqlite")).unwrap();
    let fixtures: Vec<Value> =
        serde_json::from_str(include_str!("conformance/storage.json")).unwrap();
    for fixture in fixtures {
        let result = store.execute(&req(fixture["request"].clone()));
        if fixture["error"] == true {
            assert!(result.is_err(), "{fixture}");
        } else {
            assert_eq!(result.unwrap(), fixture["expected"], "{fixture}");
        }
    }
}

#[test]
fn persists_values_and_changes_together_and_rolls_back_failed_batches() {
    let folder = tempfile::tempdir().unwrap();
    let path = folder.path().join("test.rdb");
    {
        let store = Store::open(&path).unwrap();
        let result = store
            .execute(&put("one", json!({"title":"Hello 🌍","count":1})))
            .unwrap();
        assert_eq!(result["commit"], "1");
        let failed = req(json!({"op":"batch","operations":[
            {"op":"put","collection":"notes","key":"two","value":2},
            {"op":"increment","collection":"notes","key":"missing","by":1}
        ]}));
        assert!(store.execute(&failed).is_err());
        assert_eq!(store.execute(&get("two")).unwrap(), Value::Null);
        let events = store
            .execute(&req(json!({"op":"read","stream":"$changes"})))
            .unwrap();
        assert_eq!(events["events"].as_array().unwrap().len(), 1);
        assert_eq!(events["events"][0]["commit"], "1");
    }
    let store = Store::open(&path).unwrap();
    assert_eq!(
        store.execute(&get("one")).unwrap()["value"]["title"],
        "Hello 🌍"
    );
    assert_eq!(
        store.execute(&put("two", Value::Null)).unwrap()["commit"],
        "2"
    );
    assert!(store.execute(&get("two")).unwrap().is_object());
}

#[test]
fn scans_pages_without_crossing_namespaces_and_supports_revision_guards() {
    let folder = tempfile::tempdir().unwrap();
    let store = Store::open(&folder.path().join("test.rdb")).unwrap();
    for key in ["a/😀", "b/1", "a/é", "a/1"] {
        store.execute(&put(key, json!(key))).unwrap();
    }
    let page = |after| {
        req(json!({"op":"scan","collection":"notes","prefix":"a/","limit":2,"after":after}))
    };
    let first = store.execute(&page(Value::Null)).unwrap();
    assert_eq!(first["items"][0]["key"], "a/1");
    assert_eq!(first["items"][1]["key"], "a/é");
    let second = store.execute(&page(first["next"].clone())).unwrap();
    assert_eq!(second["items"][0]["key"], "a/😀");
    assert!(second["next"].is_null());
    assert!(store.execute(&page(json!("b/1"))).is_err());
    assert!(store
        .execute(&req(
            json!({"op":"put","collection":"notes","key":"a/1","value":0,"expected":"0"})
        ))
        .is_err());
    let revision = store.execute(&get("a/1")).unwrap()["revision"].clone();
    store
        .execute(&req(
            json!({"op":"delete","collection":"notes","key":"a/1","expected":revision}),
        ))
        .unwrap();
    assert!(store.execute(&get("a/1")).unwrap().is_null());
}

#[test]
fn concurrent_intents_do_not_lose_updates_and_appends_have_unique_positions() {
    let folder = tempfile::tempdir().unwrap();
    let store = Store::open(&folder.path().join("test.rdb")).unwrap();
    store
        .execute(&put(
            "order",
            json!({"items":[{"sku":"A","qty":0},{"sku":"B","qty":3}]}),
        ))
        .unwrap();
    std::thread::scope(|scope| {
        for _ in 0..8 {
            let store = &store;
            scope.spawn(move || {
            for _ in 0..10 {
                store.execute(&req(json!({"op":"batch","operations":[
                    {"op":"increment","collection":"notes","key":"order","path":["items",{"field":"sku","equals":"A"},"qty"],"by":1},
                    {"op":"append","stream":"orders","kind":"incremented","value":{}}
                ]}))).unwrap();
            }
        });
        }
    });
    assert_eq!(
        store.execute(&get("order")).unwrap()["value"]["items"][0]["qty"],
        80
    );
    let events = store
        .execute(&req(json!({"op":"read","stream":"orders","limit":100})))
        .unwrap();
    assert_eq!(events["events"].as_array().unwrap().len(), 80);
    for (i, event) in events["events"].as_array().unwrap().iter().enumerate() {
        assert_eq!(event["sequence"], (i + 1).to_string());
    }
}

#[tokio::test]
async fn long_poll_handles_commit_at_the_replay_boundary() {
    let folder = tempfile::tempdir().unwrap();
    let store = Store::open(&folder.path().join("test.rdb")).unwrap();
    let poll = storage::execute(
        store.clone(),
        req(json!({"op":"read","stream":"orders","wait_ms":2000})),
    );
    let write = async {
        tokio::task::yield_now().await;
        storage::execute(
            store.clone(),
            req(json!({"op":"append","stream":"orders","kind":"created","value":42})),
        )
        .await
        .unwrap();
    };
    let (result, _) = tokio::join!(poll, write);
    assert_eq!(result.unwrap()["events"][0]["value"], 42);
}

#[test]
fn rejects_invalid_bounds_overflow_and_reserved_stream_mutation() {
    let folder = tempfile::tempdir().unwrap();
    let store = Store::open(&folder.path().join("test.rdb")).unwrap();
    store.execute(&put("max", json!(i64::MAX))).unwrap();
    for packet in [
        json!({"op":"increment","collection":"notes","key":"max","by":1}),
        json!({"op":"scan","collection":"notes","limit":0}),
        json!({"op":"read","stream":"x","after":"-1"}),
        json!({"op":"append","stream":"$changes","kind":"fake","value":0}),
        json!({"op":"put","collection":"notes","key":"large","value":"x".repeat(1024*1024+1)}),
    ] {
        assert!(store.execute(&req(packet)).is_err());
    }
    assert_eq!(
        store.execute(&get("max")).unwrap()["value"],
        json!(i64::MAX)
    );
}

#[test]
fn oversized_receipt_aborts_before_commit() {
    let folder = tempfile::tempdir().unwrap();
    let store = Store::open(&folder.path().join("test.rdb")).unwrap();
    let packet = Request::Batch {
        operations: vec![
            put("one", json!("\0".repeat(800000))),
            put("two", json!("\0".repeat(800000))),
        ],
    };
    assert!(store
        .execute(&packet)
        .unwrap_err()
        .to_string()
        .contains("response exceeds"));
    assert!(store.execute(&get("one")).unwrap().is_null());
    assert_eq!(
        store.execute(&put("next", json!(1))).unwrap()["commit"],
        "1"
    );
}
