use rune_runtime::{
    apps::pixel3d::{
        self,
        model::{render_model, BlockModel},
        raster::{Camera3D, Thing3D},
    },
    rune_parser::parse_rune,
};

fn source(record: &str) -> String {
    format!("@Palette/base\ncolors = {{\"w\":\"#ffffff\",\".\":\"transparent\"}}\n\n@Model/test\npalette = base\nunit = 0.5\nshapes:\n    {record}\n")
}

#[test]
fn compiles_radius_shapes_and_wedges_and_rejects_bad_geometry() {
    for record in [
        r#"{"type":"sphere","center":[0,0,1],"radius":1,"color":"w"}"#,
        r#"{"type":"cylinder","center":[0,0,1],"radius":1,"height":2,"color":"w"}"#,
        r#"{"type":"ramp","from":[-1,-1,0],"size":[2,2,2],"color":"w"}"#,
    ] {
        let assets = pixel3d::compile_assets(&parse_rune(&source(record)).unwrap()).unwrap();
        let part = &assets["models"]["test"]["blocks"][0];
        assert_eq!(part["from"], serde_json::json!([-0.5, -0.5, 0.0]));
        assert_eq!(part["size"], serde_json::json!([1.0, 1.0, 1.0]));
        let model: BlockModel = serde_json::from_value(assets["models"]["test"].clone()).unwrap();
        let thing: Thing3D =
            serde_json::from_value(serde_json::json!({"x":3,"y":0,"z":0,"model":"test"})).unwrap();
        let camera: Camera3D =
            serde_json::from_value(serde_json::json!({"x":0,"y":0,"angle":0})).unwrap();
        let mut buffer = vec![0; 64 * 48];
        let mut depth = vec![f64::INFINITY; 64 * 48];
        render_model(
            &model,
            &thing,
            &camera,
            [1.0, 0.0],
            (std::f64::consts::PI / 6.0).tan(),
            64,
            48,
            &mut buffer,
            &mut depth,
        );
        assert!((2.5..3.1).contains(&depth[23 * 64 + 32]));
        assert!(buffer.iter().any(|&p| p != 0));
        for invalid in [
            record.replace("\"radius\":1", "\"radius\":0"),
            record.replace("\"color\":\"w\"", "\"color\":\".\""),
            record.replace("\"type\":", "\"unknown\":"),
        ] {
            if invalid != record {
                assert!(pixel3d::compile_assets(&parse_rune(&source(&invalid)).unwrap()).is_err());
            }
        }
    }
    for record in [
        r#"{"type":"sphere","center":[0,0],"radius":1,"color":"w"}"#,
        r#"{"type":"sphere","center":[0,0,0],"radius":-1,"color":"w"}"#,
        r#"{"type":"cylinder","center":[0,0,0],"radius":1,"height":0,"color":"w"}"#,
        r#"{"type":"ramp","from":[0,0,0],"size":[1,0,2],"color":"w"}"#,
        r#"{"type":"torus","center":[0,0,0],"radius":1,"color":"w"}"#,
    ] {
        assert!(pixel3d::compile_assets(&parse_rune(&source(record)).unwrap()).is_err());
    }
}

#[test]
fn shared_and_native_shape_colors_and_depth_agree() {
    use rune_runtime::rune_parser::load_rune_document_from_path;
    let doc = load_rune_document_from_path(std::path::Path::new(
        "examples/games/marble_run/marble_run.rune",
    ))
    .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        ctx.eval::<(), _>("__RunePixel3D.resizeViewport(64,48)").unwrap();
        for shape in ["sphere", "cylinder", "ramp"] {
            let value = serde_json::json!({"blocks":[{"shape":shape,"from":[-0.5,-0.5,0],"size":[1,1,1],"color":0xff80a0ffu32}]});
            let model: BlockModel = serde_json::from_value(value.clone()).unwrap();
            for angle in [0,90,180] {
                let thing: Thing3D = serde_json::from_value(serde_json::json!({"x":3,"y":0,"z":0,"model":"test","angle":angle})).unwrap();
                let camera: Camera3D = serde_json::from_value(serde_json::json!({"x":0,"y":0,"angle":0})).unwrap();
                let mut buffer = vec![0;64*48];
                let mut depth = vec![f64::INFINITY;64*48];
                render_model(&model,&thing,&camera,[1.0,0.0],(std::f64::consts::PI/6.0).tan(),64,48,&mut buffer,&mut depth);
                let script = format!("(() => {{ const r=__RunePixel3D.raycaster;r.fov=60;r.config.models.test={value};r.render({{x:0,y:0,angle:0}},[{{x:3,y:0,model:'test',angle:{angle}}}]);return JSON.stringify({{pixels:Array.from(r.buffer),depth:Array.from(r.pixelDepth)}}); }})()");
                let result: String = ctx.eval(script).unwrap();
                let result: serde_json::Value = serde_json::from_str(&result).unwrap();
                for (i,&d) in depth.iter().enumerate().filter(|(_,d)| d.is_finite()) {
                    assert_eq!(buffer[i],result["pixels"][i].as_u64().unwrap() as u32,"{shape} at {angle}, pixel {i}");
                    assert!((d-result["depth"][i].as_f64().unwrap()).abs()<1e-9,"{shape} at {angle}, depth {i}");
                }
            }
        }
    });
}
