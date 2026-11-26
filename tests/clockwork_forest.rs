use rune_runtime::{
    apps::ascii_animator::{compile, Engine},
    rune_parser::load_rune_document_from_path,
};
use serde_json::Value;
use std::path::Path;

fn game() -> Engine {
    Engine::new(
        compile(
            &load_rune_document_from_path(Path::new("examples/ascii/games/clockwork/forest.rune"))
                .unwrap(),
        )
        .unwrap(),
    )
    .unwrap()
}

fn state(game: &Engine) -> Value {
    game.snapshot().unwrap()["state"].clone()
}

#[test]
fn larger_view_scales_scene_positions_without_changing_world_physics() {
    let mut game = game();
    game.key("Enter").unwrap();
    game.key("ArrowRight").unwrap();
    for _ in 0..6 {
        game.step().unwrap();
    }
    let state = state(&game);
    let sprite = state["canvas"]
        .as_array()
        .unwrap()
        .iter()
        .find(|object| object["name"] == "courier")
        .unwrap();
    let world_x = state["player"]["x"].as_f64().unwrap() - state["camera"].as_f64().unwrap();
    let world_y = state["player"]["y"].as_f64().unwrap();
    assert!((sprite["x"].as_f64().unwrap() - world_x * 4.0 / 3.0).abs() < 1e-9);
    assert!((sprite["y"].as_f64().unwrap() - world_y * 4.0 / 3.0).abs() < 1e-9);
    assert_eq!(state["platforms"][0]["y"], 28);
    assert_eq!(state["platforms"][1]["x"], 33);
}

#[test]
fn detailed_source_assets_keep_their_terminal_dimensions() {
    for (name, source, width, rows) in [
        ("courier", (48, 80), 11, 9),
        ("tree", (96, 256), 21, 28),
        ("gear", (128, 128), 27, 14),
        ("ghost", (64, 80), 13, 8),
        ("seed", (56, 64), 12, 7),
        ("moon", (96, 96), 21, 11),
        ("floor", (96, 48), 20, 5),
        ("mist", (192, 64), 43, 7),
        ("gate", (128, 160), 27, 17),
    ] {
        let path = format!("examples/ascii/games/clockwork/assets/{name}.gif");
        assert_eq!(image::image_dimensions(&path).unwrap(), source, "{name}");
        let mut cli = assert_cmd::cargo::cargo_bin_cmd!("vectrune");
        let output = cli
            .args(["ascii", "image", &path, "--width", &width.to_string()])
            .output()
            .unwrap();
        assert!(output.status.success(), "{name}");
        let output = String::from_utf8(output.stdout).unwrap();
        assert_eq!(output.lines().count(), rows, "{name}");
        assert!(output.lines().all(|row| row.len() == width), "{name}");
    }
}

#[test]
fn ghost_gif_keeps_a_bright_opaque_body_and_dark_eyes_in_every_frame() {
    use image::{AnimationDecoder, ImageReader};
    let reader = ImageReader::open("examples/ascii/games/clockwork/assets/ghost.gif").unwrap();
    let decoder = image::codecs::gif::GifDecoder::new(reader.into_inner()).unwrap();
    let frames = decoder.into_frames().collect_frames().unwrap();
    assert_eq!(frames.len(), 8);
    for frame in frames {
        let pixels = frame.buffer();
        assert!(
            pixels
                .pixels()
                .filter(|pixel| pixel[3] == 255 && pixel[0] >= 240)
                .count()
                >= 100
        );
        assert!(
            pixels
                .pixels()
                .filter(|pixel| pixel[3] == 255 && pixel[0] == 0)
                .count()
                >= 24
        );
        assert!(pixels.pixels().any(|pixel| pixel[3] == 0));
    }
}

#[test]
fn forest_assets_animate_and_controls_preserve_puzzles() {
    let mut game = game();
    let initial = game.frame().unwrap().plain();
    for _ in 0..10 {
        game.step().unwrap();
    }
    assert_ne!(initial, game.frame().unwrap().plain());
    assert_eq!(state(&game)["status"], "title");
    game.key("Enter").unwrap();
    game.key("ArrowRight").unwrap();
    game.key("Space").unwrap();
    for _ in 0..4 {
        game.step().unwrap();
    }
    assert!(state(&game)["player"]["x"].as_f64().unwrap() > 5.0);
    assert!(state(&game)["player"]["y"].as_f64().unwrap() < 21.0);
    game.key("KeyP").unwrap();
    let paused = state(&game);
    for _ in 0..10 {
        game.step().unwrap();
    }
    assert_eq!(paused["player"], state(&game)["player"]);
    assert_eq!(paused["ticks"], state(&game)["ticks"]);
    assert_eq!(paused["seeds"], state(&game)["seeds"]);
    game.key("KeyP").unwrap();
    game.key("KeyM").unwrap();
    assert_eq!(state(&game)["melody"], false);
    game.key("KeyR").unwrap();
    assert_eq!(state(&game)["collected"], 0);
    assert_eq!(state(&game)["checkpoint"], 5);
}

#[test]
fn forest_can_be_completed_with_movement_and_jumps() {
    let mut game = game();
    game.key("Enter").unwrap();
    for _ in 0..600 {
        game.key("ArrowRight").unwrap();
        let x = state(&game)["player"]["x"].as_f64().unwrap();
        if state(&game)["player"]["grounded"] == true && (x < 165.0 || x > 212.0) {
            game.key("Space").unwrap();
        }

        game.step().unwrap();
        if state(&game)["status"] == "won" {
            return;
        }
    }
    let state = state(&game);
    panic!(
        "Route not complete: player={}, seeds={}, checkpoint={}",
        state["player"], state["seeds"], state["checkpoint"]
    );
}

#[test]
fn final_platform_jump_clears_the_overhead_ghost_without_respawning() {
    let mut game = game();
    game.key("Enter").unwrap();
    let mut final_jump = false;
    for _ in 0..700 {
        game.key("ArrowRight").unwrap();
        let before = state(&game);
        let x = before["player"]["x"].as_f64().unwrap();
        if before["player"]["grounded"] == true && (x < 165.0 || x >= 195.0) {
            game.key("Space").unwrap();
            final_jump |= x >= 195.0;
        }
        game.step().unwrap();
        if final_jump {
            assert_eq!(
                state(&game)["invulnerable"],
                0,
                "Ghost hit during final jump"
            );
            assert!(
                state(&game)["player"]["x"].as_f64().unwrap() >= x,
                "Final jump respawned"
            );
        }
        if state(&game)["status"] == "won" {
            assert!(final_jump, "Route must exercise the final jump");
            return;
        }
    }
    panic!("Final jumping route did not reach the gate");
}

#[test]
fn jump_keeps_forward_momentum_when_terminal_key_repeat_stops() {
    let mut game = game();
    assert_eq!(game.frame().unwrap().width, 160);
    assert_eq!(game.frame().unwrap().height, 47);
    game.key("Enter").unwrap();
    game.key("ArrowRight").unwrap();
    for _ in 0..10 {
        game.step().unwrap();
    }
    game.key("Space").unwrap();
    let start = state(&game)["player"]["x"].as_f64().unwrap();
    for _ in 0..18 {
        game.step().unwrap();
    }
    let end = state(&game)["player"]["x"].as_f64().unwrap();
    assert!(
        end - start > 10.0,
        "Jump lost forward movement: {start} -> {end}"
    );
    assert!(state(&game)["player"]["vx"].as_f64().unwrap() > 0.9);
    game.key("ArrowLeft").unwrap();
    for _ in 0..8 {
        game.step().unwrap();
    }
    assert!(state(&game)["player"]["vx"].as_f64().unwrap() < -0.9);
    game.key("KeyS").unwrap();
    let stopped = state(&game)["player"]["x"].clone();
    for _ in 0..3 {
        game.step().unwrap();
    }
    assert_eq!(state(&game)["player"]["x"], stopped);
}

#[test]
fn haunted_theme_has_finite_pcm_and_can_be_switched_off() {
    use rune_runtime::apps::pixel::native_audio::Mixer;
    let (mut mixer, bridge) = Mixer::new(48000);
    let doc = load_rune_document_from_path(Path::new("examples/ascii/games/clockwork/forest.rune"))
        .unwrap();
    let mut game = Engine::with_audio(compile(&doc).unwrap(), bridge).unwrap();
    let mut audible = false;
    for _ in 0..96 {
        game.step().unwrap();
        mixer.commands();
        for _ in 0..2400 {
            let value = mixer.sample();
            assert!(value.is_finite() && value.abs() <= 0.3);
            audible |= value.abs() > 0.005;
        }

        mixer.publish_clock();
    }
    assert!(audible);
    game.key("KeyM").unwrap();
    for _ in 0..48000 {
        mixer.sample();
    }
    mixer.publish_clock();
    for _ in 0..96 {
        game.step().unwrap();
        mixer.commands();
        assert!((0..2400).all(|_| mixer.sample() == 0.0));
        mixer.publish_clock();
    }
}

#[test]
fn tuned_jump_is_brisk_without_losing_height() {
    let mut game = game();
    game.key("Enter").unwrap();
    game.key("ArrowRight").unwrap();
    for _ in 0..3 {
        game.step().unwrap();
    }
    assert!(state(&game)["player"]["vx"].as_f64().unwrap() > 0.95);
    game.key("KeyS").unwrap();
    let ground = state(&game)["player"]["y"].as_f64().unwrap();
    game.key("Space").unwrap();
    let mut peak = ground;
    let mut apex_tick = None;
    let mut landing_tick = None;
    for tick in 1..=40 {
        game.step().unwrap();
        let player = state(&game)["player"].clone();
        peak = peak.min(player["y"].as_f64().unwrap());
        if apex_tick.is_none() && player["vy"].as_f64().unwrap() >= 0.0 {
            apex_tick = Some(tick);
        }
        if player["grounded"] == true {
            landing_tick = Some(tick);
            break;
        }
    }
    let height = ground - peak;
    assert!(
        (7.0..=8.2).contains(&height),
        "Jump height changed: {height}"
    );
    assert!(apex_tick.is_some_and(|tick| tick <= 16));
    assert!(landing_tick.is_some_and(|tick| tick <= 30));
}
