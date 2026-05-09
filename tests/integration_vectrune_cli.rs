use rune_runtime::execution::run_program_with_io;
use rune_runtime::vectrune::{compile_document, load_document_from_path};
use std::io::Cursor;
use std::path::PathBuf;

fn example_path(path: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(path)
}

#[test]
fn together_we_are_vectrune_compiles_and_renders_weight_graph() {
    let document = load_document_from_path(&example_path("examples/vectrune/together.we.are.vectrune"))
        .expect("vectrune document should load");
    let program = compile_document(&document).expect("vectrune document should compile");
    let mut input = Cursor::new("1988\n5=42\n10=55\n20=71\ndone\n");
    let mut output = Vec::new();

    run_program_with_io(&program, &mut input, &mut output).expect("vectrune program should run");

    let output = String::from_utf8(output).expect("utf8 output");
    assert!(output.contains("Let's build a weight timeline together."));
    assert!(output.contains("What year were you born?"));
    assert!(output.contains("Weight over time"));
    assert!(output.contains("Age   5 (1993)"));
    assert!(output.contains("Age  20 (2008)"));
    assert!(output.contains("42.0"));
    assert!(output.contains("71.0"));
}

