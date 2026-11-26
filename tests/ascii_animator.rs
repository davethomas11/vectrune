use assert_cmd::Command;
use rune_runtime::{
    apps::ascii_animator::{compile, Engine, Ink},
    rune_parser::parse_rune,
};
use serde_json::json;

fn engine(source: &str) -> Engine {
    Engine::new(compile(&parse_rune(source).unwrap()).unwrap()).unwrap()
}
fn demo(name: &str) -> String {
    std::fs::read_to_string(format!("examples/ascii/{name}.rune")).unwrap()
}
fn cli() -> Command {
    assert_cmd::cargo::cargo_bin_cmd!("vectrune")
}
const SIMPLE: &str = r#"@App
type = ascii-animator
scene = test
@AsciiAnimator/test
size = [12, 6]
fps = 20
logic = test
@AsciiSprite/blink
fps = 20
frames = [["A A"], ["B B"]]
@Logic/test
state:
    canvas = []
    ticks = 0
keys:
    ArrowRight -> right
action initialize:
    canvas = [
        {"type": "box", "x": 0, "y": 0, "width": 12, "height": 6, "color": "blue"},
        {"type": "text", "x": -1.1, "y": 1.9, "text": "ABCDE", "color": "cyan"},
        {"type": "line", "x": 2, "y": 2, "x2": 4, "y2": 2, "glyph": "=", "color": "green"},
        {"type": "sprite", "x": 6, "y": 1, "name": "blink", "color": "yellow"},
        {"type": "plot", "x": 1, "y": 3, "width": 3, "height": 2, "values": [0, 50, 100], "min": 0, "max": 100, "color": "magenta"}
    ]
action tick:
    ticks += 1
action right:
    ticks += 10
"#;

#[test]
fn named_tones_validate_and_headless_events_are_drained_once() {
    let source = format!(
        "{}\n@AsciiTone/beep\nfrequency = 440\n",
        SIMPLE.replace("ticks += 1", "sound \"beep\"\n    ticks += 1")
    );
    let mut game = engine(&source);
    for _ in 0..100 {
        game.step().unwrap();
        assert_eq!(game.snapshot().unwrap()["mock"]["audio"], json!([]));
    }
    for fields in [
        "frequency = 0",
        "frequency = 8001",
        "frequency = 440\nend_frequency = 0",
        "frequency = 440\nduration = 0",
        "frequency = 440\nduration = 1.1",
        "frequency = 440\nvolume = -0.1",
        "frequency = 440\nvolume = 0.6",
        "frequency = 440\nwave = invalid",
        "frequency = 440\nunknown = 1",
    ] {
        let invalid = source.replace("frequency = 440", fields);
        assert!(compile(&parse_rune(&invalid).unwrap()).is_err(), "{fields}");
    }
    for statement in [
        "sound \"missing\"",
        "sound beep",
        "sound.play(\"beep\")",
        "music \"beep\"",
        "sound \"beep\", 1",
    ] {
        let invalid = source.replace("sound \"beep\"", statement);
        assert!(
            compile(&parse_rune(&invalid).unwrap()).is_err(),
            "{statement}"
        );
    }
    let excessive = source.replace("sound \"beep\"", &vec!["sound \"beep\""; 33].join("\n    "));
    assert!(engine(&excessive)
        .step()
        .unwrap_err()
        .to_string()
        .contains("at most 32"));
}

#[test]
fn sentinel_tones_use_native_pcm_without_replay_or_gameplay_changes() {
    use rune_runtime::apps::pixel::native_audio::Mixer;
    let (mut mixer, bridge) = Mixer::new(48000);
    let mut game = Engine::with_audio(
        compile(&parse_rune(&demo("sentinel")).unwrap()).unwrap(),
        bridge,
    )
    .unwrap();
    mixer.commands();
    assert_eq!(mixer.sample(), 0.0, "Title screen should be quiet");
    game.key("Enter").unwrap();
    game.key("Space").unwrap();
    assert_eq!(game.snapshot().unwrap()["state"]["drones"][0]["health"], 1);
    mixer.commands();
    let pcm: Vec<_> = (0..6000).map(|_| mixer.sample()).collect();
    mixer.publish_clock();
    assert!(pcm.iter().any(|s| s.abs() > 0.01));
    assert!(pcm.iter().all(|s| s.is_finite() && s.abs() <= 0.5));
    assert_eq!(game.snapshot().unwrap()["mock"]["audio"], json!([]));
    game.key("Space").unwrap(); // Shot cooldown suppresses both gameplay and audio.
    game.frame().unwrap();
    game.step().unwrap();
    mixer.commands();
    assert!((0..1000).all(|_| mixer.sample() == 0.0));
    cli()
        .args([
            "ascii",
            "run",
            "examples/ascii/sentinel.rune",
            "--plain",
            "--frames",
            "2",
            "--keys",
            "Enter,Space",
        ])
        .assert()
        .success();
    cli()
        .args([
            "ascii",
            "run",
            "examples/ascii/sentinel.rune",
            "--mute",
            "--plain",
            "--frames",
            "2",
            "--keys",
            "Enter,Space",
        ])
        .assert()
        .success();
}

#[test]
fn renders_clipped_cells_layers_colors_plots_and_animated_sprites() {
    let mut game = engine(SIMPLE);
    let frame = game.frame().unwrap();
    assert_eq!(frame.width, 12);
    assert_eq!(frame.height, 6);
    let rows: Vec<_> = frame.plain().lines().map(str::to_string).collect();
    assert_eq!(rows[0], "+----------+");
    assert_eq!(&rows[1][0..3], "CDE");
    assert_eq!(&rows[1][6..9], "A A");
    assert_eq!(&rows[2][2..5], "===");
    assert_eq!(frame.cells[12].color, Ink::Cyan);
    assert_eq!(frame.cells[4 * 12 + 1].glyph, b'*');
    assert_eq!(frame.cells[3 * 12 + 3].glyph, b'*');
    let frame = game.step().unwrap().plain();
    assert_eq!(&frame.lines().nth(1).unwrap()[6..9], "B B");
    game.key("ArrowRight").unwrap();
    assert_eq!(game.snapshot().unwrap()["state"]["ticks"], 11);
}

#[test]
fn invalid_config_and_drawings_fail_explicitly() {
    for (from, to) in [
        ("size = [12, 6]", "size = [241, 6]"),
        ("fps = 20", "fps = 0"),
        ("fps = 20", "fps = 1.5"),
        ("logic = test", "logic = missing"),
        ("ArrowRight -> right", "ArrowRight -> absent"),
        ("ArrowRight -> right", "KeyQ -> right"),
        ("action tick:", "action other:"),
        ("ticks += 1", "unknown-command"),
        ("ticks += 1", "sound \"beep\""),
        (
            "ticks += 1",
            "data = fetch-json \"https://example.invalid\"",
        ),
        ("ticks += 1", "call missing"),
        ("size = [12, 6]", "size = [12, 6]\nunknown = true"),
    ] {
        assert!(
            compile(&parse_rune(&SIMPLE.replacen(from, to, 1)).unwrap()).is_err(),
            "{to}"
        );
    }
    for (from, to) in [
        ("\"glyph\": \"=\"", "\"glyph\": \"==\""),
        ("\"type\": \"text\"", "\"type\": \"typo\""),
        ("\"name\": \"blink\"", "\"name\": \"missing\""),
        ("\"name\": \"blink\"", "\"name\": \"blink\", \"frame\": 9"),
        ("\"max\": 100", "\"max\": 0"),
        ("\"x\": 6", "\"x\": 5000"),
        ("\"width\": 12", "\"width\": 0"),
        ("\"text\": \"ABCDE\"", "\"text\": \"ABCDE\", \"typo\": 1"),
    ] {
        let doc = parse_rune(&SIMPLE.replacen(from, to, 1)).unwrap();
        assert!(Engine::new(compile(&doc).unwrap()).is_err(), "{to}");
    }
    let mut doc = parse_rune(SIMPLE).unwrap();
    let logic = doc
        .sections
        .iter_mut()
        .find(|s| s.path == ["Logic", "test"])
        .unwrap();
    logic.series.insert(
        "action initialize".into(),
        vec![rune_runtime::rune_ast::Value::String(format!(
            "canvas = {}",
            json!([{"type":"text","x":0,"y":0,"text":"\u{1b}[2J"}])
        ))],
    );
    let error = Engine::new(compile(&doc).unwrap())
        .err()
        .unwrap()
        .to_string();
    assert!(error.contains("printable ASCII"), "{error}");
}

#[test]
fn custom_canvas_imports_and_document_export_work_without_a_terminal() {
    let source = SIMPLE
        .replace("logic = test", "logic = test\ncanvas = screen")
        .replace("    canvas =", "    screen =");
    assert_eq!(engine(&source).frame().unwrap().width, 12);
    let directory = tempfile::tempdir().unwrap();
    std::fs::write(directory.path().join("parts.rune"), source).unwrap();
    let path = directory.path().join("app.rune");
    std::fs::write(&path, "import \"parts.rune\"\n").unwrap();
    cli()
        .args(["ascii", "run"])
        .arg(&path)
        .args(["--plain", "--frames", "2"])
        .assert()
        .success();
    let output = cli().arg(&path).args(["-o", "json"]).output().unwrap();
    assert!(output.status.success());
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["App"]["type"], "ascii-animator");
}

#[test]
fn runaway_actions_are_interrupted() {
    let source = SIMPLE.replace(
        "    ticks += 1",
        "    for i in range(0, 1000000):\n        ticks += 1",
    );
    let mut game = engine(&source);
    let start = std::time::Instant::now();
    let error = game.step().err().unwrap().to_string();
    assert!(error.contains("interrupt"), "{error}");
    assert!(start.elapsed() < std::time::Duration::from_secs(5));
}

#[test]
fn all_example_files_animate_and_cli_output_is_plain_and_rectangular() {
    for name in [
        "starfield",
        "aquarium",
        "observatory",
        "paddle",
        "meteors",
        "sentinel",
        "halls",
        "descent",
    ] {
        let mut game = engine(&demo(name));
        let initial = game.frame().unwrap().plain();
        if matches!(name, "meteors" | "sentinel" | "descent") {
            game.key("Enter").unwrap();
        }
        for _ in 0..30 {
            game.step()
                .unwrap_or_else(|error| panic!("{name} tick failed: {error:#}"));
        }
        assert_ne!(
            initial,
            game.frame().unwrap().plain(),
            "{name} must animate"
        );
        let frame = game.frame().unwrap();
        let output = cli()
            .args([
                "ascii",
                "run",
                &format!("examples/ascii/{name}.rune"),
                "--plain",
                "--frames",
                "30",
            ])
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(output.stderr.is_empty());
        assert!(!output.stdout.contains(&27));
        let plain = String::from_utf8(output.stdout).unwrap();
        assert_eq!(plain.lines().count(), frame.height);
        assert!(plain.lines().all(|line| line.len() == frame.width));
        cli()
            .args(["check", &format!("examples/ascii/{name}.rune"), "--json"])
            .assert()
            .success();
    }
}

#[test]
fn games_handle_pause_movement_loss_score_and_restart() {
    let mut paddle = engine(&demo("paddle"));
    paddle.key("ArrowLeft").unwrap();
    assert_eq!(paddle.snapshot().unwrap()["state"]["paddle"], 24);
    paddle.key("Space").unwrap();
    let before = paddle.snapshot().unwrap()["state"]["ball"].clone();
    for _ in 0..5 {
        paddle.step().unwrap();
    }
    assert_eq!(paddle.snapshot().unwrap()["state"]["ball"], before);
    paddle.key("Space").unwrap();
    for _ in 0..50 {
        paddle.step().unwrap();
    }
    assert_eq!(paddle.snapshot().unwrap()["state"]["status"], "gameover");
    paddle.key("KeyR").unwrap();
    assert_eq!(paddle.snapshot().unwrap()["state"]["status"], "playing");
    assert_eq!(paddle.snapshot().unwrap()["state"]["score"], 0);
    let mut centered = engine(&demo("paddle").replace("\"dx\": 0.6", "\"dx\": 0"));
    for _ in 0..25 {
        centered.step().unwrap();
    }
    assert_eq!(centered.snapshot().unwrap()["state"]["score"], 10);
    let mut meteors = engine(&demo("meteors"));
    meteors.key("Enter").unwrap();
    meteors.key("ArrowLeft").unwrap();
    assert_eq!(meteors.snapshot().unwrap()["state"]["player"], 27);
    for _ in 0..100 {
        meteors.step().unwrap();
    }
    assert_eq!(meteors.snapshot().unwrap()["state"]["status"], "gameover");
    meteors.key("KeyR").unwrap();
    assert_eq!(meteors.snapshot().unwrap()["state"]["score"], 0);
    assert_eq!(meteors.snapshot().unwrap()["state"]["rocks"], json!([]));
    let mut safe = engine(&demo("meteors").replace("player = 30", "player = 57"));
    safe.key("Enter").unwrap();
    for _ in 0..70 {
        safe.step().unwrap();
    }
    assert!(safe.snapshot().unwrap()["state"]["score"].as_u64().unwrap() > 0);
}

#[test]
fn cli_validates_arguments_and_does_not_hang_without_a_terminal() {
    cli().args(["ascii", "demo", "missing"]).assert().failure();
    cli()
        .args([
            "ascii",
            "run",
            "examples/ascii/paddle.rune",
            "--frames",
            "0",
        ])
        .assert()
        .failure();
    cli()
        .args([
            "ascii",
            "run",
            "examples/ascii/paddle.rune",
            "--keys",
            "ArrowLeft",
        ])
        .assert()
        .failure();
    cli()
        .args([
            "ascii",
            "run",
            "examples/ascii/paddle.rune",
            "--plain",
            "--keys",
            "NoSuchKey",
        ])
        .assert()
        .failure();
    cli()
        .args([
            "ascii",
            "run",
            "examples/ascii/paddle.rune",
            "--plain",
            "--keys",
            "ArrowLeft,ArrowRight",
        ])
        .assert()
        .failure();
    cli()
        .args(["examples/ascii/paddle.rune"])
        .assert()
        .failure();
    cli()
        .args(["ascii", "run", "examples/ascii/aquarium.rune", "--plain"])
        .assert()
        .success();
    let first = cli()
        .args([
            "ascii",
            "run",
            "examples/ascii/meteors.rune",
            "--plain",
            "--frames",
            "40",
            "--keys",
            "Enter,ArrowLeft",
        ])
        .output()
        .unwrap();
    let second = cli()
        .args([
            "ascii",
            "run",
            "examples/ascii/meteors.rune",
            "--plain",
            "--frames",
            "40",
            "--keys",
            "Enter,ArrowLeft",
        ])
        .output()
        .unwrap();
    assert!(first.status.success());
    assert_eq!(first.stdout, second.stdout);
}
