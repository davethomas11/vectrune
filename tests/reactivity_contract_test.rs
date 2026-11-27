/// Test for the actual reactivity-contract-rune-web.rune file
#[cfg(test)]
mod reactivity_contract_test {
    use rune_runtime::rune_ast::Value;
    use rune_runtime::rune_parser::load_rune_document_from_path;
    use std::path::Path;

    #[test]
    fn test_reactivity_contract_rune_web_file() {
        let path = Path::new("examples/rune-web/reactivity-contract-rune-web.rune");
        let result = load_rune_document_from_path(path);

        if let Err(ref e) = result {
            eprintln!("Parse error: {:?}", e);
        }
        assert!(result.is_ok(), "Should parse reactivity-contract-rune-web.rune. Error: {:?}", result.err());

        let doc = result.unwrap();

        // Find the Event section with the ws.broadcast call
        // The section path for "@Event /ws /update_score" is ["Event", "ws", "update_score"] (split on /)
        let event_sections: Vec<_> = doc.sections.iter()
            .filter(|s| {
                s.path.get(0).map(|p| p == "Event").unwrap_or(false) &&
                s.path.get(1).map(|p| p.contains("ws")).unwrap_or(false)
            })
            .collect();

        assert_eq!(event_sections.len(), 1, "Should have one Event /ws section");

        let event_section = event_sections[0];
        assert!(event_section.series.contains_key("run"), "Should have run series");

        let run_items = &event_section.series["run"];

        // Broadcast the evaluated message binding, rather than an inline template.
        let ws_broadcast_line = run_items.iter().find(|item| {
            if let Value::String(s) = item {
                s == "ws.broadcast /ws update"
            } else {
                false
            }
        });

        assert!(ws_broadcast_line.is_some(), "Should broadcast the evaluated update");
    }
}



