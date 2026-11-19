use rune_runtime::{apps::pixel3d, rune_parser::load_rune_document_from_path};
use std::path::Path;

#[test]
fn skybound_runs_and_renders_in_the_shared_desktop_runtime() {
    let doc = load_rune_document_from_path(Path::new("examples/games/skybound/skybound.rune")).unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    assert_eq!(game.config["camera"], "camera");
    assert_eq!(game.config["mouseLook"], false);
    assert_eq!(game.config["models"].as_object().unwrap().len(), 7);
    let runtime = rquickjs::Runtime::new().unwrap();
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        ctx.eval::<(), _>("__RunePixel3D.start(); __RunePixel3D.step({jump:true});").unwrap();
        assert!(ctx.eval::<f64, _>("__RunePixel3D.app.state.player.z").unwrap() > 3.3);
        assert!(!ctx.eval::<bool, _>("__RunePixel3D.app.state.checkpoint_active").unwrap());
        let frame: rquickjs::TypedArray<u32> = ctx.eval("__RunePixel3D.frame()").unwrap();
        let pixels = unsafe { frame.as_bytes() }.unwrap().to_vec();
        assert_eq!(pixels.len(), 384 * 240 * 4);
        assert!(pixels.chunks_exact(4).all(|pixel| pixel[3] == 255));
        ctx.eval::<(), _>("__RunePixel3D.paused=true; __RunePixel3D.step({forward:true});").unwrap();
        assert_eq!(ctx.eval::<f64, _>("__RunePixel3D.app.state.player.x").unwrap(), 7.0);
    });
}
