use rune_runtime::{
    apps::{pixel, pixel3d},
    rune_parser::load_rune_document_from_path,
};
use std::path::Path;

#[test]
fn exported_games_share_controls_with_native_quickjs() {
    for (path, is_3d, action) in [
        ("examples/games/monster_city/monster_city.rune", false, "smash"),
        ("examples/games/vect_breach/vect_breach.rune", true, "fire"),
    ] {
        let doc = load_rune_document_from_path(Path::new(path)).unwrap();
        let script = if is_3d {
            pixel3d::compile(&doc).unwrap().script
        } else {
            pixel::compile(&doc).unwrap().script
        };
        let runtime = rquickjs::Runtime::new().unwrap();
        let context = rquickjs::Context::full(&runtime).unwrap();
        context.with(|ctx| {
            ctx.eval::<(), _>(script.as_str()).unwrap();
            let passed: bool = ctx
                .eval(format!(
                    r#"(() => {{
                const g=__RunePixel,c=g.controls;
                if (!c || c.profile.version !== 1) return false;
                c.event({{device:'keyboard',code:'Space',value:true}});
                c.event({{device:'mouse',code:'Left',value:true}});
                if (!c.sample(1/30).{action}) return false;
                c.event({{device:'mouse',code:'Left',value:false}});
                if (!c.sample(1/30).{action}) return false;
                c.event({{device:'keyboard',code:'Space',value:false}});
                if (c.sample(1/30).{action}) return false;
                c.clear();g.start();
                c.event({{device:'keyboard',code:'KeyP',value:true}});
                c.event({{device:'keyboard',code:'KeyP',value:true}});
                if (!g.paused) return false;
                c.event({{device:'keyboard',code:'KeyP',value:false}});
                c.event({{device:'keyboard',code:'KeyP',value:true}});
                return !g.paused;
            }})()"#
                ))
                .unwrap();
            assert!(passed, "{path}");
        });
    }
}

#[test]
fn scenes_without_profiles_retain_the_legacy_configuration() {
    let mut doc =
        load_rune_document_from_path(Path::new("examples/games/vect_breach/vect_breach.rune")).unwrap();
    let scene = doc
        .sections
        .iter_mut()
        .find(|s| s.path == ["Scene", "breach_level"])
        .unwrap();
    scene.kv.remove("controls");
    let legacy = pixel3d::compile(&doc).unwrap();
    assert!(legacy.config.get("controls").is_none());
    assert_eq!(legacy.config["keys"]["KeyW"], "forward");
    assert_eq!(legacy.config["keys"]["Space"], "fire");
    assert_eq!(legacy.config["mouseLook"], true);
}
