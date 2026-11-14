use rune_runtime::cli::vect::{parse_program, run_program_with_io};
use std::fs;
use std::io::Cursor;
use std::path::PathBuf;

fn load_vect_source(path: &str) -> String {
    let full_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(path);
    fs::read_to_string(&full_path).expect("vect source should load")
}

#[test]
fn introducing_vect_branch_one_runs_to_completion() {
    let source = load_vect_source("examples/vect/introducing.vect");
    let program = parse_program(&source).expect("vect program should parse");
    let mut input = Cursor::new("1\n");
    let mut output = Vec::new();

    run_program_with_io(&program, &mut input, &mut output).expect("vect program should run");

    let output = String::from_utf8(output).expect("utf8 output");
    assert!(output.contains("Welcome to the world of Vect! This is a simple text-based adventure game."));
    assert!(output.contains("What do you choose? (1 or 2)"));
    assert!(output.contains("You walk towards the village and are greeted by the friendly villagers."));
    assert!(output.contains("They invite you to join them for a feast and you have a wonderful time."));
    assert!(!output.contains("Invalid choice"));
}

#[test]
fn introducing_vect_repeats_after_invalid_choice_then_accepts_second_answer() {
    let source = load_vect_source("examples/vect/introducing.vect");
    let program = parse_program(&source).expect("vect program should parse");
    let mut input = Cursor::new("9\n2\n");
    let mut output = Vec::new();

    run_program_with_io(&program, &mut input, &mut output).expect("vect program should run");

    let output = String::from_utf8(output).expect("utf8 output");
    let prompt_count = output.matches("What do you choose? (1 or 2)").count();
    assert!(output.contains("Invalid choice. Please choose 1 or 2."));
    assert!(output.contains("You decide to stay in the field and enjoy the beauty of nature."));
    assert!(output.contains("You lie down on the grass, watch the clouds, and feel at peace."));
    assert!(output.contains("2. Stay in the field and enjoy the beauty of nature."));
    assert_eq!(prompt_count, 2, "expected the choice prompt to repeat after invalid input");
}

#[test]
fn vect_interpolates_values_into_stdio_output() {
    let source = load_vect_source("examples/vect/interpolation.vect");
    let program = parse_program(&source).expect("vect program should parse");
    let mut input = Cursor::new("Avery\nyes\n");
    let mut output = Vec::new();

    run_program_with_io(&program, &mut input, &mut output).expect("vect program should run");

    let output = String::from_utf8(output).expect("utf8 output");
    assert!(output.contains("Hi Avery!"));
    assert!(output.contains("Nice to meet you, Avery. The flowers are listening."));
}









fn execute(source: &str, input: &str) -> anyhow::Result<String> {
    let program = parse_program(source)?;
    let mut output = Vec::new();
    run_program_with_io(&program, &mut Cursor::new(input), &mut output)?;
    Ok(String::from_utf8(output)?)
}

#[test]
fn shared_expression_conformance_matches_rune_web() {
    let fixtures: serde_json::Value = serde_json::from_str(include_str!("conformance/expressions.json")).unwrap();
    for fixture in fixtures.as_array().unwrap() {
        let context = fixture["context"].as_object().unwrap().iter().map(|(k,v)| format!("{k} = {v}\n")).collect::<String>();
        let source = format!("{context}result = {}\nstdio -> \"{{json.stringify(result)}}\"\n", fixture["expr"].as_str().unwrap());
        let output = execute(&source, "").unwrap_or_else(|e| panic!("{}: {e:#}", fixture["category"]));
        let result: serde_json::Value = serde_json::from_str(output.trim()).unwrap();
        assert_eq!(result, fixture["expected"], "{}", fixture["category"]);
    }
}

#[test]
fn vect_actions_collections_scopes_and_loop_control() {
    let source = r#"
#!VECT
x = 100
values = [
    1, 2, # Comments inside multiline expressions
    3, 4,
]
action collect(items):
    x = 0
    result = []
    for item, index in items:
        if item == 2:
            continue
        if item == 4:
            break
        x += item
        result.push({value: x, index: index})
    return result
result = collect(values)
stdio -> "{json.stringify(result)}"
stdio -> "global x = {x}"
"#;
    assert_eq!(execute(source, "").unwrap(), "[{\"value\":1,\"index\":0},{\"value\":4,\"index\":2}]\nglobal x = 100\n");
}

#[test]
fn extended_vect_keeps_interactive_stdio_and_legacy_builtins() {
    let source = r#"
stdio -> "Your name?"
name <- stdio
result = {name: name, count: 0}
while result.count < 3:
    result.count += 1
log "Hello {result.name}"
set json_text = "{\"ok\":true}"
parse-json json_text as parsed
stdio -> "{parsed.ok}: {result.count}"
stop "Done"
stdio -> "Unreachable"
"#;
    assert_eq!(execute(source, "Avery\n").unwrap(), "Your name?\nHello Avery\ntrue: 3\nDone\n");
}

#[test]
fn extended_vect_reports_source_lines_and_invalid_control_flow() {
    let error = execute("x = 1\nx = missing(2)\n", "").unwrap_err().to_string();
    assert!(error.contains("line 2"), "{error}");
    assert!(execute("return 1", "").is_err());
    assert!(execute("break", "").is_err());
    assert!(parse_program("x = [1, 2").is_err());
    assert!(parse_program("x = \"unterminated").is_err());
    assert!(parse_program("x = [1, 2)").is_err());
}

#[test]
fn guard_generator_reproduces_committed_assets_from_any_working_directory() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let temp = tempfile::tempdir().unwrap();
    let script = temp.path().join("generate_guards.vect");
    fs::copy(root.join("examples/vect_breach/generate_guards.vect"), &script).unwrap();
    let result = std::process::Command::new(assert_cmd::cargo::cargo_bin!("vectrune"))
        .arg(&script).current_dir(&root).output().unwrap();
    assert!(result.status.success(), "{}", String::from_utf8_lossy(&result.stderr));
    let generated = fs::read_to_string(temp.path().join("guards.rune")).unwrap();
    use sha2::{Digest, Sha256};
    let expected = fs::read_to_string(root.join("examples/vect_breach/guards.rune")).unwrap().replace("\r\n", "\n");
    assert_eq!(Sha256::digest(generated.as_bytes()), Sha256::digest(expected.as_bytes()), "Guard pixels and palette must reproduce on every platform");
    assert_eq!(generated.matches("@Sprite/guard3d/").count(), 40);
}
