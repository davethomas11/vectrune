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








