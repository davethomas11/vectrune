use rune_runtime::rune_parser::parse_rune;
use rune_runtime::rune_ast::Value;

fn print_value(v: &Value, indent: usize) {
    match v {
        Value::String(s) => println!("{}{}", " ".repeat(indent), s),
        Value::Map(m) => {
            for (k, v) in m {
                println!("{}if block: {}", " ".repeat(indent), k);
                if let Value::List(items) = v {
                    for item in items {
                        print_value(item, indent + 2);
                    }
                }
            }
        }
        Value::List(items) => {
            for item in items {
                print_value(item, indent);
            }
        }
        _ => println!("{}{:?}", " ".repeat(indent), v),
    }
}

#[test]
fn parses_deeply_nested_if_statements() {
    let rune_code = r#"@Event /ws /move
run:
    id = ws.id
    if state.players.[id] != null:
        state.players.[id].x = event.x
        if state.players.[id].x == state.food.x:
            log "X matches food, checking Y"
            if state.players.[id].y == state.food.y:
                log "Collision detected!"
                next_size = state.players.[id].size + 1
                if next_size > 10:
                    next_size = 10
                state.players.[id].size = next_size
"#;

    let doc = parse_rune(rune_code).expect("Should parse successfully");
    let section = doc.sections.get(0).expect("Should have at least one section");

    let run_series = section.series.get("run").expect("Should have 'run' series");

    // Print the series to debug
    println!("\nRun series has {} items", run_series.len());
    for (i, item) in run_series.iter().enumerate() {
        println!("\nItem {}:", i);
        print_value(item, 2);
    }

    // Check that we have the expected items
    assert!(run_series.len() > 0, "Run series should not be empty");

    // The deeply nested if statement should be parsed
    let run_strs: Vec<String> = run_series.iter().map(|v| v.to_string()).collect();
    let run_str = run_strs.join("\n");
    assert!(run_str.contains("if next_size > 10"), "Should contain the deeply nested if statement at line 72");
}

