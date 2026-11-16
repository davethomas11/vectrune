use rune_runtime::{apps::pixel3d, rune_parser::load_rune_document_from_path};
use std::path::Path;

#[test]
fn compiles_voxel_scene_and_rejects_unknown_world_binding() {
    let mut doc =
        load_rune_document_from_path(Path::new("examples/rune_miners/rune_miners.rune")).unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    assert_eq!(game.config["world"], "world");
    assert_eq!(game.config["controls"]["touch"]["look"]["y"], "look_y");
    assert_eq!(game.config["models"].as_object().unwrap().len(), 9);
    assert_eq!(game.config["textures"].as_object().unwrap().len(), 8);
    let scene = doc
        .sections
        .iter_mut()
        .find(|s| s.path == ["Scene", "miners"])
        .unwrap();
    scene.kv.insert(
        "world".into(),
        rune_runtime::rune_ast::Value::String("missing".into()),
    );
    assert!(pixel3d::compile(&doc)
        .err()
        .unwrap()
        .to_string()
        .contains("unknown state"));
}

#[test]
#[cfg(feature = "pixel-desktop")]
fn quickjs_voxel_framebuffer_and_turn_battle_work_without_a_browser() {
    let doc =
        load_rune_document_from_path(Path::new("examples/rune_miners/rune_miners.rune")).unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        ctx.eval::<(), _>("__RunePixel3D.start();__RunePixel3D.step({forward:true});").unwrap();
        assert!(ctx.eval::<f64, _>("__RunePixel3D.app.state.player.x").unwrap() > 4.5);
        let frame: rquickjs::TypedArray<u32> = ctx.eval("__RunePixel3D.frame()").unwrap();
        let bytes = unsafe { frame.as_bytes() }.unwrap().to_vec();
        assert_eq!(bytes.len(), 320 * 200 * 4);
        assert!(bytes.chunks_exact(4).all(|p| p[3] == 255));
        ctx.eval::<(), _>("__RunePixel3D.invoke('cycle_hud');__RunePixel3D.invoke('cycle_hud');__RunePixel3D.invoke('toggle_text');").unwrap();
        assert_eq!(ctx.eval::<i32, _>("__RunePixel3D.app.state.ui.textScale").unwrap(), 2);
        let large: rquickjs::TypedArray<u32> = ctx.eval("__RunePixel3D.frame()").unwrap();
        assert_ne!(unsafe { large.as_bytes() }.unwrap(), bytes.as_slice());
        ctx.eval::<(), _>("__RunePixel3D.app.state.player={x:14.5,y:12.5,z:1,angle:0,pitch:0,vz:0};__RunePixel3D.step({});__RunePixel3D.invoke('skip_tutorial');__RunePixel3D.invoke('choice_one');for(let i=0;i<40;i++)__RunePixel3D.step({});__RunePixel3D.invoke('guard');for(let i=0;i<10;i++)__RunePixel3D.step({});").unwrap();
        assert_eq!(ctx.eval::<i32, _>("__RunePixel3D.app.state.health").unwrap(), 56);
        let frame: rquickjs::TypedArray<u32> = ctx.eval("__RunePixel3D.frame()").unwrap();
        assert_ne!(unsafe { frame.as_bytes() }.unwrap(), bytes.as_slice());
    });
}
