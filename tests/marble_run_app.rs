use rune_runtime::{apps::pixel3d, rune_parser::load_rune_document_from_path};
use std::{
    path::Path,
    time::{Duration, Instant},
};

#[test]
fn marble_campaign_completes_with_input_only_in_quickjs() {
    let doc = load_rune_document_from_path(Path::new("examples/games/marble_run/marble_run.rune"))
        .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    assert_eq!(
        game.config["models"]["marble/ball"]["blocks"][0]["shape"],
        "sphere"
    );
    let runtime = rquickjs::Runtime::new().unwrap();
    let deadline = Instant::now() + Duration::from_secs(240);
    runtime.set_interrupt_handler(Some(Box::new(move || Instant::now() >= deadline)));
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        ctx.eval::<(), _>("__RunePixel3D.resizeViewport(144,90)")
            .unwrap();
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/marble_route.js"))
            .unwrap_or_else(|e| panic!(
                "Marble course: {}",
                rquickjs::CaughtError::from_error(&ctx, e)
            )));
        let report: String = ctx.eval("JSON.stringify(__marbleCampaignReport)").unwrap();
        eprintln!("Marble campaign: {report}");
    });
}

#[test]
fn marble_title_death_and_arranged_music_work() {
    use rune_runtime::apps::rune_web::{ast::MusicCue, parser::parse_rune_web_frontend};
    let doc = load_rune_document_from_path(Path::new("examples/games/marble_run/marble_run.rune"))
        .unwrap();
    let frontend = parse_rune_web_frontend(&doc, "marble_run").unwrap();
    let song = &frontend.music["marble_theme"];
    assert_eq!(song.sections.len(), 7);
    assert_eq!(song.arrangement.len(), 9);
    let bars: f64 = song
        .arrangement
        .iter()
        .map(|cue| match cue {
            MusicCue::Section(name) => song.sections[name].bars,
            MusicCue::Repeat { section, repeat } => song.sections[section].bars * repeat,
        })
        .sum();
    assert_eq!(bars, 56.0);
    assert!(bars * 4.0 * 60.0 / song.tempo > 100.0);
    let game = pixel3d::compile(&doc).unwrap();
    assert_eq!(game.config["titleScene"]["heading"], "MARBLE RUN");
    let runtime = rquickjs::Runtime::new().unwrap();
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        ctx.eval::<(), _>("__RunePixel3D.resizeViewport(144,90)")
            .unwrap();
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/marble_lifecycle.js"))
            .unwrap_or_else(|e| panic!(
                "Marble lifecycle: {}",
                rquickjs::CaughtError::from_error(&ctx, e)
            )));
    });
}
