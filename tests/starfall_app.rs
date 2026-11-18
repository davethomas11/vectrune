use rune_runtime::{apps::pixel3d, rune_parser::load_rune_document_from_path};
use std::path::Path;

#[test]
fn starfall_completes_and_renders_in_the_shared_desktop_runtime() {
    let doc = load_rune_document_from_path(Path::new("examples/starfall/starfall.rune")).unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    assert_eq!(game.config["camera"], "camera");
    assert_eq!(game.config["mouseLook"], false);
    let runtime = rquickjs::Runtime::new().unwrap();
    // This runs all cinematic, combat and traversal fixtures plus the full return
    // route in one QuickJS context. Shared CI runners need more than three minutes.
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(600);
    runtime.set_interrupt_handler(Some(Box::new(move || {
        std::time::Instant::now() >= deadline
    })));
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_launch.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_chunks.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_layout.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_portals.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_rewards.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_cinematics.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_vault_route.js"))
            .unwrap());
        let frame: rquickjs::TypedArray<u32> = ctx.eval("__RunePixel3D.frame()").unwrap();
        assert_eq!(frame.len(), 432 * 270);
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_effects.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_recovery.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_plasma.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_lifecycle.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_escape.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_duck.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_extras.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_garden_route.js"))
            .unwrap());
        assert!(ctx
            .eval::<bool, _>(include_str!("browser/starfall_foundry_route.js"))
            .unwrap());
        let route: String = ctx
            .eval(format!(
                "JSON.stringify({})",
                include_str!("browser/starfall_route.js")
            ))
            .unwrap();
        let route: serde_json::Value = serde_json::from_str(&route).unwrap();
        assert_eq!(route.as_array().unwrap().len(), 5);
        assert_eq!(route[4]["label"], "home");
        assert_eq!(
            ctx.eval::<String, _>("__RunePixel3D.app.state.status")
                .unwrap(),
            "won"
        );
        ctx.eval::<(), _>(
            "__RunePixel3D.start(); __RunePixel3D.paused=true; __RunePixel3D.step({right:true});",
        )
        .unwrap();
        assert_eq!(
            ctx.eval::<f64, _>("__RunePixel3D.app.state.player.x")
                .unwrap(),
            9.0
        );
        assert!(!ctx.eval::<bool, _>("__RunePixel3D.app.state.jets").unwrap());
    });
}
