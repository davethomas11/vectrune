use rune_runtime::{
    apps::ascii_animator::{compile, Engine},
    rune_parser::load_rune_document_from_path,
};
use serde_json::json;
use std::path::Path;

fn game() -> Engine {
    Engine::new(
        compile(
            &load_rune_document_from_path(Path::new("examples/ascii/borrowed_morning.rune"))
                .unwrap(),
        )
        .unwrap(),
    )
    .unwrap()
}

const WALKTHROUGH: &[&str] = &[
    "begin",
    "take ribbon",
    "take thimble",
    "east",
    "south",
    "use sewing kit on sail",
    "take flour",
    "north",
    "give flour to baker",
    "south",
    "east",
    "give bread to troll",
    "west",
    "north",
    "east",
    "take apple",
    "west",
    "north",
    "give apple to librarian",
    "south",
    "east",
    "east",
    "sing",
    "use thimble on dew",
    "west",
    "west",
    "south",
    "east",
    "east",
    "use ribbon on vane",
    "use dew on seed",
    "up",
    "read contract",
    "use star bottle on contract",
    "use bell on contract",
    "use seed on contract",
    "mend contract",
];

#[test]
fn adventure_is_completable_and_restart_restores_all_puzzles() {
    let mut game = game();
    assert_eq!(game.snapshot().unwrap()["state"]["status"], "title");
    let initial = game.frame().unwrap().plain();
    for _ in 0..9 {
        game.step().unwrap();
    }
    assert_ne!(initial, game.frame().unwrap().plain());
    for command in WALKTHROUGH {
        game.command(command).unwrap();
        game.step().unwrap();
    }
    let state = game.snapshot().unwrap()["state"].clone();
    assert_eq!(state["status"], "won", "{state}");
    assert_eq!(state["journal"].as_array().unwrap().len(), 7);
    assert!(game.frame().unwrap().plain().contains("THE END"));
    game.command("restart").unwrap();
    let state = game.snapshot().unwrap()["state"].clone();
    assert_eq!(state["status"], "playing");
    assert_eq!(state["room"], "cottage");
    assert_eq!(state["inventory"], json!(["sewing kit"]));
    assert!(state["flags"]
        .as_object()
        .unwrap()
        .values()
        .all(|v| v == false));
    assert_eq!(state["journal"], json!([]));
    for command in &WALKTHROUGH[1..] {
        game.command(command).unwrap();
    }
    assert_eq!(game.snapshot().unwrap()["state"]["status"], "won");
}

#[test]
fn puzzles_are_gated_and_wrong_actions_do_not_consume_items() {
    let mut game = game();
    for command in [
        "begin",
        "take ribbon",
        "take thimble",
        "east",
        "south",
        "east",
        "east",
    ] {
        game.command(command).unwrap();
    }
    assert_eq!(game.snapshot().unwrap()["state"]["room"], "bridge");
    let inventory = game.snapshot().unwrap()["state"]["inventory"].clone();
    for command in [
        "give ribbon to troll",
        "use sewing kit on troll",
        "take bell",
        "banana dance",
    ] {
        game.command(command).unwrap();
        assert_eq!(game.snapshot().unwrap()["state"]["inventory"], inventory);
    }
    for command in [
        "west",
        "use sewing kit on sail",
        "use sewing kit on sail",
        "take flour",
        "take flour",
    ] {
        game.command(command).unwrap();
    }
    let state = game.snapshot().unwrap()["state"].clone();
    assert_eq!(
        state["inventory"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|v| **v == "flour")
            .count(),
        1
    );
    assert_eq!(state["journal"].as_array().unwrap().len(), 1);
    game.command("hint").unwrap();
    assert!(game.frame().unwrap().plain().contains("BAKER"));
    for _ in 0..120 {
        game.step().unwrap();
    }
    assert_eq!(game.snapshot().unwrap()["state"]["status"], "playing");
}

#[test]
fn every_location_animates_without_hidden_progress_or_clipped_story() {
    let mut game = game();
    let mut visited = std::collections::HashSet::new();
    for command in WALKTHROUGH {
        game.command(command).unwrap();
        let state = game.snapshot().unwrap()["state"].clone();
        let room = state["room"].as_str().unwrap().to_owned();
        for line in state["message"].as_array().unwrap() {
            assert!(line.as_str().unwrap().len() <= 74, "{room}: {line}");
        }
        if visited.insert(room.clone()) && state["status"] == "playing" {
            let initial = game.frame().unwrap().plain();
            for _ in 0..9 {
                game.step().unwrap();
            }
            assert_ne!(
                initial,
                game.frame().unwrap().plain(),
                "{room} should animate"
            );
            assert_eq!(game.snapshot().unwrap()["state"]["flags"], state["flags"]);
            assert_eq!(
                game.snapshot().unwrap()["state"]["inventory"],
                state["inventory"]
            );
        }
    }
    assert_eq!(visited.len(), 9);
    assert_eq!(game.snapshot().unwrap()["mock"]["audio"], json!([]));
}

#[test]
fn plain_cli_accepts_repeated_commands_without_a_device() {
    let output = assert_cmd::cargo::cargo_bin_cmd!("vectrune")
        .args([
            "ascii",
            "run",
            "examples/ascii/borrowed_morning.rune",
            "--plain",
            "--frames",
            "2",
            "--commands",
            "BEGIN",
            "--commands",
            "  Talk   To Kettle  ",
        ])
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    let text = String::from_utf8(output.stdout).unwrap();
    assert!(text.contains("seventeen times"));
    assert_eq!(text.lines().count(), 29);
    assert!(text.lines().all(|line| line.len() == 78));
}

#[test]
fn command_configuration_and_input_fail_explicitly() {
    use rune_runtime::rune_parser::parse_rune;
    let source = std::fs::read_to_string("examples/ascii/borrowed_morning.rune").unwrap();
    for ending in ["\n", "\r\n"] {
        let source = source.replace("\r\n", "\n").replace('\n', ending);
        let source = source
            .lines()
            .filter(|line| *line != "import \"borrowed_morning/scenes.rune\"")
            .collect::<Vec<_>>()
            .join(ending);
        for source in [
            source.replace("command = command", "command = absent"),
            source.replace("action command(input):", "action command:"),
            source.replace("action command(input):", "action command(a, b):"),
            source.replace(
                "action initialize:",
                &format!("keys:{ending}    Enter -> start{ending}action initialize:"),
            ),
        ] {
            assert!(compile(&parse_rune(&source).unwrap()).is_err());
        }
    }
    let game = game();
    for input in ["hi\nthere", "\u{1b}[2J", &"a".repeat(121)] {
        assert!(game.command(input).is_err());
    }
    game.command("    ").unwrap();
    assert_eq!(game.snapshot().unwrap()["state"]["status"], "title");
    game.command("  BeGiN  ").unwrap();
    assert_eq!(game.snapshot().unwrap()["state"]["status"], "playing");
    for args in [
        vec!["--commands", "begin"],
        vec!["--plain", "--commands", "begin", "--commands", "look"],
        vec!["--plain", "--commands", "begin", "--keys", "Enter"],
        vec!["--plain", "--keys", "Enter"],
    ] {
        assert_cmd::cargo::cargo_bin_cmd!("vectrune")
            .args(["ascii", "run", "examples/ascii/borrowed_morning.rune"])
            .args(args)
            .assert()
            .failure();
    }
    assert_cmd::cargo::cargo_bin_cmd!("vectrune")
        .args([
            "ascii",
            "run",
            "examples/ascii/paddle.rune",
            "--plain",
            "--commands",
            "begin",
        ])
        .assert()
        .failure();
}

#[test]
fn final_repair_requires_reading_and_all_three_proofs() {
    let game = game();
    for command in &WALKTHROUGH[..32] {
        game.command(command).unwrap();
    }
    assert_eq!(game.snapshot().unwrap()["state"]["room"], "tower");
    game.command("mend contract").unwrap();
    assert_eq!(game.snapshot().unwrap()["state"]["status"], "playing");
    for command in [
        "read contract",
        "mend contract",
        "use star bottle on contract",
        "mend contract",
        "use bell on contract",
        "mend contract",
    ] {
        game.command(command).unwrap();
        assert_eq!(game.snapshot().unwrap()["state"]["status"], "playing");
    }
    game.command("use seed on contract").unwrap();
    game.command("mend contract").unwrap();
    assert_eq!(game.snapshot().unwrap()["state"]["status"], "won");
}

#[test]
fn title_theme_produces_pcm_and_music_toggle_stops_new_notes() {
    use rune_runtime::apps::pixel::native_audio::Mixer;
    let (mut mixer, bridge) = Mixer::new(48000);
    let doc =
        load_rune_document_from_path(Path::new("examples/ascii/borrowed_morning.rune")).unwrap();
    let mut game = Engine::with_audio(compile(&doc).unwrap(), bridge).unwrap();
    let mut audible = false;
    for _ in 0..24 {
        game.step().unwrap();
        mixer.commands();
        for _ in 0..4000 {
            let sample = mixer.sample();
            assert!(sample.is_finite() && sample.abs() <= 0.16);
            audible |= sample.abs() > 0.01;
        }
        mixer.publish_clock();
    }
    assert!(audible);
    game.command("music").unwrap();
    for _ in 0..12000 {
        mixer.sample();
    }
    mixer.publish_clock();
    for _ in 0..72 {
        game.step().unwrap();
        mixer.commands();
        assert!((0..4000).all(|_| mixer.sample() == 0.0));
        mixer.publish_clock();
    }
    assert_eq!(game.snapshot().unwrap()["state"]["status"], "title");
}

#[test]
fn complete_walkthrough_runs_through_plain_cli() {
    let mut cli = assert_cmd::cargo::cargo_bin_cmd!("vectrune");
    cli.args([
        "ascii",
        "run",
        "examples/ascii/borrowed_morning.rune",
        "--plain",
        "--frames",
    ])
    .arg(WALKTHROUGH.len().to_string());
    for command in WALKTHROUGH {
        cli.args(["--commands", command]);
    }
    let output = cli.output().unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    let frame = String::from_utf8(output.stdout).unwrap();
    assert!(frame.contains("THE END."));
    assert!(frame.contains("DAWN") || frame.contains("D A W N"));
}
