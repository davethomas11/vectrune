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
fn simple_4level_nesting() {
    let rune_code = r#"@Event /ws /test
run:
    a = 1
    if x > 1:
        b = 2
        if y > 2:
            c = 3
            if z > 3:
                d = 4
                if w > 4:
                    e = 5
"#;

    // Debug: print the raw code with visible spaces
    println!("\n=== RAW CODE ===");
    for (i, line) in rune_code.lines().enumerate() {
        let visible = line.replace(" ", "·").replace("\t", "→");
        println!("{:2}: {}", i, visible);
    }

    let doc = parse_rune(rune_code).expect("Should parse successfully");
    let section = doc.sections.get(0).expect("Should have at least one section");

    // Debug: print all series in the section
    println!("\n=== SECTION SERIES ===");
    for (key, list) in &section.series {
        println!("Series: {} (items: {})", key, list.len());
    }

    let run_series = section.series.get("run").expect("Should have 'run' series");

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
    println!("\n=== Full output ===\n{}", run_str);
    assert!(run_str.contains("if w > 4"), "Should contain the 4-level nested if statement");
}



