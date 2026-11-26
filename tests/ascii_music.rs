use rune_runtime::{
    apps::{
        ascii_animator::{compile, Engine},
        pixel::native_audio::Mixer,
    },
    rune_parser::parse_rune,
};
use std::sync::atomic::Ordering;

fn source(score: &str) -> String {
    format!(
        r#"@App
type = ascii-animator
scene = demo
@AsciiAnimator/demo
size = [8, 2]
fps = 30
logic = demo
@AsciiMusic/haunted
{score}
@Logic/demo
state:
    canvas = []
keys:
    KeyP -> pause
    KeyR -> resume
    KeyS -> stop_song
action initialize:
    music "haunted"
action tick:
    stop
action pause:
    music.pause
action resume:
    music.resume
action stop_song:
    music.stop
"#
    )
}

#[test]
fn shared_music_synth_plays_pauses_resumes_and_stops_without_a_device() {
    let score = "tempo = 120\nvolume = 0.07\nbars = 1\nloop = true\ninstruments = {\"lead\":\"triangle\",\"bass\":\"sine\"}\nlead:\n    D4:4 [F4,A4]:4 Eb4:4 C4:4\nbass:\n    D2:2 -:2";
    let (mut mixer, bridge) = Mixer::new(48000);
    let stats = bridge.stats.clone();
    let mut game = Engine::with_audio(
        compile(&parse_rune(&source(score)).unwrap()).unwrap(),
        bridge,
    )
    .unwrap();
    let mut audio = |game: &mut Engine, frames| {
        let mut audible = false;
        for _ in 0..frames {
            game.step().unwrap();
            mixer.commands();
            for _ in 0..1600 {
                let sample = mixer.sample();
                assert!(sample.is_finite() && sample.abs() <= 1.0);
                audible |= sample.abs() > 0.001;
            }
            mixer.publish_clock();
        }
        audible
    };
    assert!(audio(&mut game, 100));
    game.key("KeyP").unwrap();
    assert!(!audio(&mut game, 30));
    game.key("KeyR").unwrap();
    assert!(audio(&mut game, 100));
    game.key("KeyS").unwrap();
    assert!(!audio(&mut game, 30));
    assert_eq!(stats.dropped.load(Ordering::Relaxed), 0);
}

#[test]
fn score_errors_are_explicit_even_for_silent_engines() {
    for score in [
        "tempo = 0\nlead = D4:4",
        "tempo = \"fast\"\nlead = D4:4",
        "volume = 0.9\nlead = D4:4",
        "bars = 2.5\nlead = D4:4",
        "bars = 65\nlead = D4:4",
        "loop = 1\nlead = D4:4",
        "time_signature = 7/8\nlead = D4:4",
        "type = bogus\nlead = D4:4",
        "reverb = {}\nlead = D4:4",
        "instruments = {\"lead\":\"bogus\"}\nlead = D4:4",
    ] {
        assert!(
            compile(&parse_rune(&source(score)).unwrap()).is_err(),
            "{score}"
        );
    }
    for score in [
        "lead = Banana:4",
        "lead = D4:0",
        "lead = D4:3",
        "volume = 0.1",
    ] {
        let animation = compile(&parse_rune(&source(score)).unwrap()).unwrap();
        assert!(Engine::new(animation).is_err(), "{score}");
    }
    let unknown = source("lead = D4:4").replace("music \"haunted\"", "music \"absent\"");
    assert!(compile(&parse_rune(&unknown).unwrap()).is_err());
}

#[test]
fn drum_and_custom_channels_share_the_rune_web_score_notation() {
    let score = "tempo = 100\nvolume = 0.03\nlead = D4:4 -:4 F4:4 A4:4\ndrums = kick:4 hihat:4 snare:4 hihat:4\npad = \"[D3,F3,A3]:1\"\ninstruments = {\"pad\":\"sine\"}";
    let mut game = Engine::new(compile(&parse_rune(&source(score)).unwrap()).unwrap()).unwrap();
    for _ in 0..20 {
        game.step().unwrap();
    }
    game.key("KeyP").unwrap();
    game.key("KeyR").unwrap();
    game.key("KeyS").unwrap();
}
