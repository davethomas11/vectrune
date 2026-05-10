/// Test for conditional statements inside series (run:) blocks
/// This tests the parser's ability to handle nested if-statements within series

#[cfg(test)]
mod conditional_in_series_tests {
    use rune_runtime::rune_ast::RuneDocument;
    use rune_runtime::rune_parser::parse_rune;

    #[test]
    fn test_parse_conditional_in_run_series() {
        let rune_code = r#"
@Event/ws_update/update_score
run:
  score = get-memory global_score
  if score == null:
    score = 0
  new_score = score + 1
  set-memory global_score new_score
"#;

        let result = parse_rune(rune_code);
        if let Err(ref e) = result {
            eprintln!("Parse error: {:?}", e);
        }
        assert!(result.is_ok(), "Should parse conditional in series. Error: {:?}", result.err());

        let doc = result.unwrap();
        let event_sections: Vec<_> = doc.sections.iter()
            .filter(|s| s.path.first().map(|p| p == "Event").unwrap_or(false))
            .collect();

        assert_eq!(event_sections.len(), 1, "Should have one Event section");

        let event_section = event_sections[0];
        assert!(event_section.series.contains_key("run"), "Should have run series");

        let run_items = &event_section.series["run"];
        assert!(run_items.len() > 0, "Run series should have items");
    }

    #[test]
    fn test_parse_nested_map_in_run_series() {
        let rune_code = r#"
@Event/test_event
run:
  value = 10
  object = {"key": "value"}
  another = 20
"#;

        let result = parse_rune(rune_code);
        assert!(result.is_ok(), "Should parse object assignments in series");

        let doc = result.unwrap();
        let event_sections: Vec<_> = doc.sections.iter()
            .filter(|s| s.path.first().map(|p| p == "Event").unwrap_or(false))
            .collect();

        assert_eq!(event_sections.len(), 1);
    }

    #[test]
    fn test_parse_complex_conditional_in_series() {
        let rune_code = r#"
@Logic/game
run:
  state = get-memory game_state
  if state == null:
    state = {"round": 0, "players": []}
  if state.round > 5:
    log "Game almost over"
  set-memory game_state state
"#;

        let result = parse_rune(rune_code);
        assert!(result.is_ok(), "Should parse multiple conditionals in series");
    }

    #[test]
    fn test_parse_conditional_with_map_after() {
        let rune_code = r#"
@Event/update
run:
  data = parse-json body
  if data != null:
    x = 1
  response = {"status": "ok"}
"#;

        let result = parse_rune(rune_code);
        assert!(result.is_ok(), "Should parse conditional followed by map assignment");
    }
}




