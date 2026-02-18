use rune_runtime::cli::{calculate, transform};
use rune_runtime::rune_parser::parse_rune;
use std::fs;

fn load_example(path: &str) -> rune_runtime::rune_ast::RuneDocument {
    let contents = fs::read_to_string(path).expect("read example");
    parse_rune(&contents).expect("parse_rune should succeed")
}

#[test]
fn calculate_basic_functions() {
    let doc = load_example("examples/skateboarders.rune");

    let avg = calculate::calculate_to_string(&doc, "avg Skateboarder.age").unwrap();
    assert_eq!(avg, "36");

    let sum = calculate::calculate_to_string(&doc, "sum Skateboarder.age").unwrap();
    assert_eq!(sum, "107");

    let min = calculate::calculate_to_string(&doc, "min Skateboarder.age").unwrap();
    assert_eq!(min, "26");

    let max = calculate::calculate_to_string(&doc, "max Skateboarder.age").unwrap();
    assert_eq!(max, "53");

    let count_section = calculate::calculate_to_string(&doc, "count Skateboarder").unwrap();
    assert_eq!(count_section, "3");

    let count_field = calculate::calculate_to_string(&doc, "count Skateboarder.age").unwrap();
    assert_eq!(count_field, "3");
}

#[test]
fn transform_baseline_names_list() {
    let doc = load_example("examples/skateboarders.rune");
    let out = transform::transform_to_string(&doc, "@Skaters name:[@Skateboarder.name]").unwrap();
    let expected = "#!RUNE\n@Skaters\nname:\n  Tony Hawk\n  Nyjah Huston\n  Leticia Bufoni\n";
    assert_eq!(out.trim_end(), expected.trim_end());
}

#[test]
fn transform_unique_and_sort_modifiers() {
    let doc = load_example("examples/skateboarders.rune");
    let out = transform::transform_to_string(
        &doc,
        "@Skaters names:[@Skateboarder.name|unique|sort] ages:[@Skateboarder.age|sort:desc]",
    )
    .unwrap();
    let expected = "#!RUNE\n@Skaters\nnames:\n  Leticia Bufoni\n  Nyjah Huston\n  Tony Hawk\nages:\n  53\n  28\n  26\n";
    assert_eq!(out.trim_end(), expected.trim_end());
}
