use rquickjs::{CaughtError, Ctx, FromJs};
use rune_runtime::{apps::pixel3d, rune_parser::load_rune_document_from_path};
use std::{
    path::Path,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

fn eval_stage<'js, T: FromJs<'js>>(
    ctx: &Ctx<'js>,
    deadline: &Mutex<Instant>,
    name: &str,
    source: &str,
) -> T {
    let started = Instant::now();
    *deadline.lock().unwrap() = started + Duration::from_secs(600);
    let result = ctx.eval(source).unwrap_or_else(|error| {
        panic!(
            "Starfall {name} failed after {:.2?}: {}",
            started.elapsed(),
            CaughtError::from_error(ctx, error)
        )
    });
    eprintln!("Starfall {name} completed in {:.2?}", started.elapsed());
    result
}

#[test]
fn starfall_completes_and_renders_in_the_shared_desktop_runtime() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/starfall/starfall.rune")).unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    assert_eq!(game.config["camera"], "camera");
    assert_eq!(game.config["mouseLook"], false);
    let runtime = rquickjs::Runtime::new().unwrap();
    // Bound each fixture and the full route separately: their cumulative runtime
    // can exceed ten minutes on shared Intel macOS runners.
    let deadline = Arc::new(Mutex::new(Instant::now()));
    let interrupt_deadline = Arc::clone(&deadline);
    runtime.set_interrupt_handler(Some(Box::new(move || {
        Instant::now() >= *interrupt_deadline.lock().unwrap()
    })));
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        eval_stage::<()>(&ctx, &deadline, "load game", game.script.as_str());
        // Check the shipped resolution once. The fixtures below check game state
        // and opaque frames, so use the same aspect ratio with nine times fewer
        // pixels for their repeated software renders.
        let frame: rquickjs::TypedArray<u32> = ctx.eval("__RunePixel3D.frame()").unwrap();
        assert_eq!(frame.len(), 432 * 270);
        assert!(unsafe { frame.as_bytes() }
            .unwrap()
            .chunks_exact(4)
            .all(|pixel| pixel[3] == 255));
        ctx.eval::<(), _>("__RunePixel3D.resizeViewport(144, 90)")
            .unwrap();
        let fixture = |name: &str, source: &str| {
            assert!(eval_stage::<bool>(&ctx, &deadline, name, source));
        };
        fixture("launch", include_str!("browser/starfall_launch.js"));
        fixture("chunks", include_str!("browser/starfall_chunks.js"));
        fixture("layout", include_str!("browser/starfall_layout.js"));
        fixture("portals", include_str!("browser/starfall_portals.js"));
        fixture("rewards", include_str!("browser/starfall_rewards.js"));
        fixture("discovery", include_str!("browser/starfall_discovery.js"));
        fixture("cinematics", include_str!("browser/starfall_cinematics.js"));
        fixture(
            "vault_route",
            include_str!("browser/starfall_vault_route.js"),
        );
        let frame: rquickjs::TypedArray<u32> = ctx.eval("__RunePixel3D.frame()").unwrap();
        assert_eq!(frame.len(), 144 * 90);
        fixture("effects", include_str!("browser/starfall_effects.js"));
        fixture("recovery", include_str!("browser/starfall_recovery.js"));
        fixture("plasma", include_str!("browser/starfall_plasma.js"));
        fixture("lifecycle", include_str!("browser/starfall_lifecycle.js"));
        fixture("escape", include_str!("browser/starfall_escape.js"));
        fixture("duck", include_str!("browser/starfall_duck.js"));
        fixture("extras", include_str!("browser/starfall_extras.js"));
        fixture(
            "garden_route",
            include_str!("browser/starfall_garden_route.js"),
        );
        fixture(
            "foundry_route",
            include_str!("browser/starfall_foundry_route.js"),
        );
        let route: String = eval_stage(
            &ctx,
            &deadline,
            "starfall_route",
            &format!(
                "JSON.stringify({})",
                include_str!("browser/starfall_route.js")
            ),
        );
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
