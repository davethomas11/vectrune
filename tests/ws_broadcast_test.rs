/// Test for ws.broadcast with inline JSON object in series
#[cfg(test)]
mod ws_broadcast_tests {
    use rune_runtime::rune_ast::Value;
    use rune_runtime::rune_parser::parse_rune;

    #[test]
    fn test_ws_broadcast_with_inline_json_in_series() {
        let rune_code = r#"@Event /ws update_score
run:
    event = parse-json body
    score = get-memory global_score
    if score == null:
        score = 0
    new_score = score + event.payload.add
    set-memory global_score new_score
    ws.broadcast /ws { "type": "memory_update", "key": "global_score", "value": event.payload.newScore }
"#;

        let result = parse_rune(rune_code);
        if let Err(ref e) = result {
            eprintln!("Parse error: {:?}", e);
        }
        assert!(result.is_ok(), "Should parse ws.broadcast with inline JSON. Error: {:?}", result.err());

        let doc = result.unwrap();
        let event_sections: Vec<_> = doc.sections.iter()
            .filter(|s| s.path.first().map(|p| p == "Event").unwrap_or(false))
            .collect();

        assert_eq!(event_sections.len(), 1, "Should have one Event section");

        let event_section = event_sections[0];
        assert!(event_section.series.contains_key("run"), "Should have run series");

        let run_items = &event_section.series["run"];
        assert!(run_items.len() > 0, "Run series should have items");

        // Find the ws.broadcast line
        let ws_broadcast_item = run_items.iter()
            .find(|item| {
                if let Value::String(s) = item {
                    s.contains("ws.broadcast")
                } else {
                    false
                }
            });

        assert!(ws_broadcast_item.is_some(), "Should find ws.broadcast line as a string item");

        // Verify it's stored as a single string, not parsed as a map
        if let Some(Value::String(s)) = ws_broadcast_item {
            assert!(s.contains("memory_update"), "Should preserve the JSON content");
            assert!(s.contains("global_score"), "Should preserve the JSON key-value pairs");
            println!("✓ ws.broadcast line parsed correctly as string: {}", s);
        }
    }

    #[test]
    fn test_regular_map_blocks_still_work() {
        let rune_code = r#"@Config
settings {
    mode = game
    difficulty = medium
}
"#;

        let result = parse_rune(rune_code);
        assert!(result.is_ok(), "Should still parse regular map blocks");

        let doc = result.unwrap();
        let config_sections: Vec<_> = doc.sections.iter()
            .filter(|s| s.path.first().map(|p| p == "Config").unwrap_or(false))
            .collect();

        assert_eq!(config_sections.len(), 1);
        let config = config_sections[0];

        // Verify settings is still parsed as a map, not affected by our change
        let settings = config.kv.get("settings");
        assert!(settings.is_some(), "Should have settings key");

        if let Some(Value::Map(map)) = settings {
            assert!(map.contains_key("mode"), "Map should contain mode key");
            assert!(map.contains_key("difficulty"), "Map should contain difficulty key");
            println!("✓ regular map block still parsed correctly");
        } else {
            panic!("Expected settings to be a map");
        }
    }

    #[test]
    fn test_dotted_function_call_with_json() {
        let rune_code = r#"@Event /api
run:
    my.function.call /endpoint { "data": "value" }
"#;

        let result = parse_rune(rune_code);
        assert!(result.is_ok(), "Should parse dotted function call with JSON");

        let doc = result.unwrap();
        let sections: Vec<_> = doc.sections.iter()
            .filter(|s| s.path.first().map(|p| p == "Event").unwrap_or(false))
            .collect();

        let run_items = &sections[0].series["run"];

        // Should be a single string item, not a map
        let has_string_item = run_items.iter().any(|item| {
            if let Value::String(s) = item {
                s.contains("my.function.call") && s.contains("data")
            } else {
                false
            }
        });

        assert!(has_string_item, "Should have function call as string item");
    }
}

