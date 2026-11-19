use rune_runtime::{
    apps::{pixel3d, rune_web::parser::parse_rune_web_frontend},
    rune_parser::load_rune_document_from_path,
};
use std::path::Path;

#[test]
fn sequel_compiles_arranged_score_and_renders_every_destination_in_quickjs() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/skybound_2/skybound_2.rune")).unwrap();
    let frontend = parse_rune_web_frontend(&doc, "beyond").unwrap();
    assert_eq!(frontend.music.len(), 10);
    for song in frontend.music.values() {
        assert_eq!(song.sections.len(), 5);
        assert!(!song.arrangement.is_empty());
        assert_eq!(song.instruments["harmony"], "strings");
    }
    let game = pixel3d::compile(&doc).unwrap();
    for name in ["heart", "heart_empty", "seed", "bug", "lantern", "boss"] {
        let sprite = &game.config["sprites"][format!("beyond/hud/{name}")];
        assert_eq!(sprite["width"], 9);
        assert!(sprite["colors"][0].is_null());
        assert_eq!(sprite["pixels"].as_array().unwrap().len(),
            9 * sprite["height"].as_u64().unwrap() as usize);
    }
    assert_eq!(game.config["persistence"]["key"], "skybound-2");
    assert_eq!(game.config["mouseLook"], false);
    let runtime = rquickjs::Runtime::new().unwrap();
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        assert_eq!(ctx.eval::<String, _>("__RunePixel3D.app.state.phase").unwrap(), "map");
        let mut frames = Vec::new();
        for index in 0..7 {
            ctx.eval::<(), _>(format!("__RunePixel3D.paused=true;__RunePixel3D.invoke('show_map');__RunePixel3D.app.state.saga.unlocked=7;__RunePixel3D.invoke('select_stage',[{index}]);__RunePixel3D.start();__RunePixel3D.step({{jump:true}});")).unwrap();
            // Patrols and seed caches must remain supported as platform footprints change.
            assert!(ctx.eval::<bool, _>(r#"(() => {
              const s=__RunePixel3D.app.state,w=s.world;
              const solid=(x,y,z)=>!!w.cells[(z*w.height+Math.floor(y))*w.width+Math.floor(x)];
              return s.enemies.length>=6 && s.enemies.every(e=>[-1,0,1].every(t=>
                solid(e.home_x+(e.axis==='x'?t*e.reach:0),e.home_y+(e.axis==='y'?t*e.reach:0),e.floor-1))) &&
                s.seeds.every(e=>solid(e.x,e.y,Math.round(e.base-.45)-1));
            })()"#).unwrap(), "unsupported patrol or seed in destination {index}");
            assert!(ctx.eval::<f64, _>("__RunePixel3D.app.state.player.vz").unwrap() > 0.3);
            let frame: rquickjs::TypedArray<u32> = ctx.eval("__RunePixel3D.frame()").unwrap();
            let bytes = unsafe { frame.as_bytes() }.unwrap().to_vec();
            assert_eq!(bytes.len(), 432 * 270 * 4);
            assert!(bytes.chunks_exact(4).all(|pixel| pixel[3] == 255));
            assert!(frames.iter().all(|previous| previous != &bytes));
            frames.push(bytes);
        }
    });
}
