use rune_runtime::{
    apps::pixel3d::{
        self,
        enhanced_lighting::{
            apply_bloom, apply_contact_shadows, apply_glass_and_haze, finish_voxel_lighting,
            Emission, EmissionBuffer, GlassPane, ShadowCaster,
        },
        lighting::{light_voxel_frame, PointLight},
        model::{render_model_with_emission, render_voxel_model_enhanced, BlockModel},
        overlay::composite_hud,
        raster::{Camera3D, Texture, Thing3D},
        voxel::{render_dense, VoxelCamera, VoxelWorld},
        voxel_scene::{render_enhanced_voxel_scene, EnhancedVoxelScene, VoxelSceneModel},
    },
    rune_parser::load_rune_document_from_path,
};
use std::path::Path;

#[test]
fn aquarium_quickjs_scene_preparation_does_not_retain_per_frame_indexes() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/idle_aquarium/idle_aquarium.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        ctx.eval::<(), _>(
            "for (let i=0;i<10;i++) { __RunePixel3D.step({}); __RunePixel3D.renderState(); }",
        )
        .unwrap();
    });
    let baseline = runtime.memory_usage().malloc_size;
    context.with(|ctx| {
        ctx.eval::<(), _>("for (let i=0;i<200;i++) __RunePixel3D.renderState();")
            .unwrap();
    });
    let after_render = runtime.memory_usage().malloc_size;
    assert!(
        after_render <= baseline + 512 * 1024,
        "scene preparation retained {} bytes across 200 unchanged frames",
        after_render - baseline
    );
    context.with(|ctx| {
        ctx.eval::<(), _>(
            "for (let i=0;i<100;i++) { __RunePixel3D.step({}); __RunePixel3D.renderState(); }",
        )
        .unwrap();
    });
    let after_ticks = runtime.memory_usage().malloc_size;
    assert!(
        after_ticks <= after_render + 2 * 1024 * 1024,
        "simulation and scene preparation retained {} bytes across 100 ticks",
        after_ticks - after_render
    );
}

#[test]
fn enhanced_glass_and_haze_match_shared_voxel_renderer() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/idle_aquarium/idle_aquarium.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    let texture = Texture {
        width: 1,
        height: 1,
        pixels: vec![0xff887766],
    };
    let mut cells = vec![0u16; 40 * 8 * 8];
    for y in 0..8 {
        for x in 0..40 {
            cells[y * 40 + x] = 1;
        }
    }
    let world = VoxelWorld {
        width: 40,
        height: 8,
        depth: 8,
        cells: &cells,
        materials: &[&texture],
        render_distance: None,
    };
    let panes = [
        GlassPane {
            x: 5.0,
            y: 4.0,
            z: 2.0,
            angle: 90.0,
            pitch: 90.0,
            scale: 1.0,
            size: [4.0, 5.0],
        },
        GlassPane {
            x: 7.0,
            y: 4.0,
            z: 2.0,
            angle: 90.0,
            pitch: 90.0,
            scale: 1.0,
            size: [4.0, 5.0],
        },
    ];
    let things = serde_json::json!([
        {"x":5,"y":4,"z":2,"angle":90,"pitch":90,"model":"pane"},
        {"x":7,"y":4,"z":2,"angle":90,"pitch":90,"model":"pane"}
    ]);
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        let config = serde_json::json!({"width":40,"height":8,"depth":8,"materials":["test"],"cells":cells});
        ctx.eval::<(), _>(format!(
            "const r=__RunePixel3D.raycaster;r.resize(65,49,1);r.fov=58;r.config.map.sky=null;r.config.world={config};r.config.textures.test={};r.config.models.pane={{blocks:[],glass:[4,5]}};r.setEnhancedLighting(true);",
            serde_json::to_string(&texture).unwrap()
        )).unwrap();
        let mut changed = 0;
        let mut haze_changed = 0;
        for (x, y, z, angle, pitch) in [
            (2.5, 4.0, 1.0, 0.0, 0.0),
            (2.5, 3.0, 1.0, 20.0, -20.0),
            (6.0, 4.0, 1.0, 0.0, -10.0),
            (9.0, 4.0, 1.0, 180.0, 10.0),
        ] {
            let camera = VoxelCamera { x, y, z, angle, pitch };
            let mut color = vec![0; 65 * 49];
            let mut depth = vec![0.0; 65 * 49];
            render_dense(&world, &camera, 58.0, 65, 49, &mut color, &mut depth).unwrap();
            let standard = color.clone();
            let mut haze_only = color.clone();
            apply_glass_and_haze(&mut haze_only, &depth, 65, 49, &camera, 58.0, &[], None).unwrap();
            haze_changed += haze_only.iter().zip(&standard).filter(|(a, b)| a != b).count();
            apply_glass_and_haze(&mut color, &depth, 65, 49, &camera, 58.0, &panes, None).unwrap();
            changed += color.iter().zip(&standard).filter(|(a, b)| a != b).count();
            let result: String = ctx.eval(format!(
                "r.render({{x:{x},y:{y},z:{z},angle:{angle},pitch:{pitch}}},{things});JSON.stringify({{pixels:Array.from(r.buffer),depth:Array.from(r.pixelDepth)}})"
            )).unwrap();
            let shared: serde_json::Value = serde_json::from_str(&result).unwrap();
            for (i, (&pixel, &distance)) in color.iter().zip(&depth).enumerate() {
                assert_eq!(pixel as u64, shared["pixels"][i].as_u64().unwrap(),
                    "glass/haze color pixel {i}, camera ({x},{y},{z}), angle {angle}, pitch {pitch}");
                match shared["depth"][i].as_f64() {
                    Some(expected) => assert!((distance - expected).abs() < 1e-10,
                        "depth pixel {i}: {distance} vs {expected}"),
                    None => assert!(distance.is_infinite()),
                }
            }
        }
        assert!(changed > 100, "fixtures must visibly exercise glass or haze");
        assert!(haze_changed > 0, "fixtures must visibly exercise distance haze");
    });
}

#[test]
fn invalid_glass_input_is_rejected_without_writing() {
    let camera = VoxelCamera {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        angle: 0.0,
        pitch: 0.0,
    };
    let pane = GlassPane {
        x: 1.0,
        y: 0.0,
        z: 0.0,
        angle: 0.0,
        pitch: 90.0,
        scale: 0.0,
        size: [2.0, 2.0],
    };
    let mut frame = [123; 16];
    let depth = [f64::INFINITY; 16];
    assert!(apply_glass_and_haze(&mut frame, &depth, 4, 4, &camera, 58.0, &[pane], None).is_err());
    assert_eq!(frame, [123; 16]);
    assert!(
        apply_glass_and_haze(&mut frame[..15], &depth, 4, 4, &camera, 58.0, &[], None).is_err()
    );
}

#[test]
fn glass_preserves_coplanar_and_front_geometry() {
    let camera = VoxelCamera {
        x: 0.0,
        y: 0.0,
        z: 0.75,
        angle: 0.0,
        pitch: 0.0,
    };
    let pane = GlassPane {
        x: 2.0,
        y: 0.0,
        z: 2.0,
        angle: 0.0,
        pitch: -90.0,
        scale: 1.0,
        size: [4.0, 4.0],
    };
    let mut color = [0xff202020; 48 * 40];
    let mut depth = [f64::INFINITY; 48 * 40];
    let center = 20 * 48 + 24;
    depth[center] = 2.0;
    depth[center + 1] = 2.0 + 1e-5;
    depth[center + 2] = 1.0;
    apply_glass_and_haze(&mut color, &depth, 48, 40, &camera, 58.0, &[pane], None).unwrap();
    assert_eq!(color[center], 0xff202020);
    assert_eq!(color[center + 1], 0xff202020);
    assert_eq!(color[center + 2], 0xff202020);
    assert_ne!(color[center + 3], 0xff202020);
}

#[test]
fn aquarium_glass_matches_shared_tint_and_haze() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/idle_aquarium/idle_aquarium.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        let json: String = ctx.eval(r#"(() => {
            const g=__RunePixel3D,w=g.app.state.world,s=g.renderState();
            return JSON.stringify({width:w.width,height:w.height,depth:w.depth,cells:Array.from(w.cells),
              renderDistance:w.renderDistance,camera:s.camera,time:s.time,
              panes:s.things.filter(t=>t.visible !== false && t.model && g.config.models[t.model].glass && (t.dissolve ?? 0)<1)
                .map(t=>({x:t.x,y:t.y,z:t.z ?? 0,angle:t.angle ?? 0,pitch:t.pitch ?? 0,
                  scale:t.scale ?? 1,size:g.config.models[t.model].glass}))});
        })()"#).unwrap();
        let data: serde_json::Value = serde_json::from_str(&json).unwrap();
        let cells: Vec<u16> = serde_json::from_value(data["cells"].clone()).unwrap();
        let texture: Texture = serde_json::from_value(game.config["textures"]["aqua/sand"].clone()).unwrap();
        let world = VoxelWorld {
            width: data["width"].as_u64().unwrap() as usize,
            height: data["height"].as_u64().unwrap() as usize,
            depth: data["depth"].as_u64().unwrap() as usize,
            cells: &cells, materials: &[&texture], render_distance: data["renderDistance"].as_f64(),
        };
        let panes: Vec<GlassPane> = data["panes"].as_array().unwrap().iter().map(|pane| GlassPane {
            x: pane["x"].as_f64().unwrap(), y: pane["y"].as_f64().unwrap(),
            z: pane["z"].as_f64().unwrap(), angle: pane["angle"].as_f64().unwrap(),
            pitch: pane["pitch"].as_f64().unwrap(), scale: pane["scale"].as_f64().unwrap(),
            size: [pane["size"][0].as_f64().unwrap(), pane["size"][1].as_f64().unwrap()],
        }).collect();
        assert_eq!(panes.len(), 4, "fixture should contain all four tank panes");
        let c = &data["camera"];
        let camera = VoxelCamera {
            x: c["x"].as_f64().unwrap(), y: c["y"].as_f64().unwrap(),
            z: c["z"].as_f64().unwrap(), angle: c["angle"].as_f64().unwrap(),
            pitch: c["pitch"].as_f64().unwrap(),
        };
        let sky = serde_json::from_value(game.config["map"]["sky"].clone()).unwrap();
        let mut color = vec![0; 80 * 50];
        let mut depth = vec![0.0; 80 * 50];
        pixel3d::voxel::render_dense_with_sky(&world, &camera, 58.0, 80, 50, &mut color, &mut depth, Some(&sky), data["time"].as_f64().unwrap()).unwrap();
        let standard = color.clone();
        apply_glass_and_haze(&mut color, &depth, 80, 50, &camera, 58.0, &panes, Some(sky.horizon)).unwrap();
        assert!(color != standard, "aquarium glass must visibly tint pixels");
        let shared: String = ctx.eval(r#"(() => {
            const g=__RunePixel3D,r=g.raycaster,s=g.renderState();
            const panes=s.things.filter(t=>t.visible !== false && t.model && g.config.models[t.model].glass);
            r.resize(80,50,1);r.config.world=g.app.state.world;r.setEnhancedLighting(true);
            r.render(s.camera,panes,undefined,0,undefined,[],s.time);
            return JSON.stringify(Array.from(r.buffer));
        })()"#).unwrap();
        let shared: Vec<u32> = serde_json::from_str(&shared).unwrap();
        for (i, (&a, &b)) in color.iter().zip(&shared).enumerate() {
            assert_eq!(a, b, "aquarium glass pixel {i}");
        }

    });
}

#[test]
fn bloom_compositing_matches_shared_and_respects_occlusion() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/idle_aquarium/idle_aquarium.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        ctx.eval::<(), _>(r#"const r=__RunePixel3D.raycaster;
            r.resize(65,49,1); r.fov=58;
            r.config.world=undefined; r.config.map={width:4,height:4,grid:Array(16).fill(0),floor:0xff242020,ceiling:0xff242020};
            r.config.textures={};r.config.sprites={};
            r.config.models={
              lamp:{blocks:[{from:[-.18,-.1,-.18],size:[.36,.2,.36],color:0xfff4a015,emissive:true}]},
              cover:{blocks:[{from:[-1,-.1,-1],size:[2,.2,2],color:0xff242020}]}
            };r.setEnhancedLighting(true);"#).unwrap();
        for covered in [false, true] {
            let result: String = ctx.eval(format!(r#"(() => {{
                const camera={{x:2,y:3,angle:270,height:1}};
                const things=[{{x:2,y:1,z:1,model:'lamp'}}];
                if ({covered}) things.push({{x:2,y:2,z:1,model:'cover'}});
                let raw;
                r.render(camera,things,undefined,0,undefined,[],0,undefined,[],[],frame=>{{
                  const e=frame.enhancement.emission;
                  raw={{base:Array.from(frame.color),depth:Array.from(frame.depth),
                    pixels:Array.from(e.pixels),depths:Array.from(e.depths),colors:Array.from(e.colors)}};
                }});
                raw.expected=Array.from(r.render(camera,things));
                return JSON.stringify(raw);
            }})()"#)).unwrap();
            let raw: serde_json::Value = serde_json::from_str(&result).unwrap();
            let mut color: Vec<u32> = serde_json::from_value(raw["base"].clone()).unwrap();
            let baseline = color.clone();
            let depth: Vec<f64> = raw["depth"].as_array().unwrap().iter()
                .map(|v| v.as_f64().unwrap_or(f64::INFINITY)).collect();
            let pixels: Vec<usize> = serde_json::from_value(raw["pixels"].clone()).unwrap();
            let sample_depths: Vec<f64> = raw["depths"].as_array().unwrap().iter()
                .map(|v| v.as_f64().unwrap_or(f64::INFINITY)).collect();
            let colors: Vec<u32> = serde_json::from_value(raw["colors"].clone()).unwrap();
            let emission = Emission { pixels: &pixels, depths: &sample_depths, colors: &colors };
            apply_bloom(&mut color, &depth, 65, 49, &emission).unwrap();
            let expected: Vec<u32> = serde_json::from_value(raw["expected"].clone()).unwrap();
            for (i, (&a, &b)) in color.iter().zip(&expected).enumerate() {
                assert_eq!(a, b, "bloom pixel {i}, covered={covered}");
            }

            if covered {
                assert_eq!(color, baseline, "occluded lamp must not bloom");
            } else {
                assert_ne!(color, baseline, "visible lamp must bloom");
            }
        }
    });
}

#[test]
fn bloom_tiles_match_shared_at_edges_and_with_stale_samples() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/idle_aquarium/idle_aquarium.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        ctx.eval::<(), _>("const r=__RunePixel3D.raycaster;r.setEnhancedLighting(true);").unwrap();
        for (width, height) in [(1usize, 1usize), (7, 5), (17, 13), (20, 16)] {
            let count = width.div_ceil(4) * height.div_ceil(4);
            let mut pixels = vec![0; count];
            let mut depths = vec![0.0; count];
            let mut colors = vec![0; count];
            let depth = vec![3.0; width * height];
            let baseline: Vec<u32> = (0..width * height)
                .map(|i| 0xff000000 | ((i as u32 * 0x12345) & 0xffffff)).collect();
            for tile in 0..count {
                let x = (tile % width.div_ceil(4) * 4).min(width - 1);
                let y = (tile / width.div_ceil(4) * 4).min(height - 1);
                pixels[tile] = y * width + x;
                depths[tile] = if tile % 3 == 1 { 4.0 } else { 3.0 };
                colors[tile] = [0xffffff, 0x0000ff, 0xff0000, 0x00ff00][tile % 4];
            }
            let input = serde_json::json!({
                "pixels": pixels, "depths": depths, "colors": colors,
                "depth": depth, "buffer": baseline,
            });
            let output: String = ctx.eval(format!(r#"(() => {{
                const data={input}, e=r.enhanced.begin({width},{height});
                e.pixels.set(data.pixels); e.depths.set(data.depths); e.colors.set(data.colors);
                const buffer=new Uint32Array(data.buffer), depth=new Float64Array(data.depth);
                r.enhanced.finish(buffer,depth,{{x:0,y:0,angle:0}},1,0,1,{height}/2,undefined,[],{{}});
                return JSON.stringify(Array.from(buffer));
            }})()"#)).unwrap();
            let expected: Vec<u32> = serde_json::from_str(&output).unwrap();
            let mut actual = baseline.clone();
            apply_bloom(&mut actual, &depth, width, height,
                &Emission { pixels: &pixels, depths: &depths, colors: &colors }).unwrap();
            assert_ne!(actual, baseline);
            assert_eq!(actual, expected, "bloom mismatch at {width}x{height}");
        }
    });
}

#[test]
fn bloom_rejects_bad_samples_before_writing_and_preserves_inputs() {
    let pixels = [0, 3];
    let depths = [1.0, 1.0];
    let colors = [0xffffff, 0x336699];
    let depth = [1.0; 8];
    let mut buffer = [0xff202020; 8];
    let original = buffer;
    for emission in [
        Emission {
            pixels: &pixels[..1],
            depths: &depths,
            colors: &colors,
        },
        Emission {
            pixels: &[0, 8],
            depths: &depths,
            colors: &colors,
        },
        Emission {
            pixels: &pixels,
            depths: &[1.0, f64::NAN],
            colors: &colors,
        },
        Emission {
            pixels: &pixels,
            depths: &depths,
            colors: &[0xffffff, 0x1000000],
        },
    ] {
        assert!(apply_bloom(&mut buffer, &depth, 8, 1, &emission).is_err());
        assert_eq!(buffer, original);
    }

    let occluded = [2.0; 8];
    apply_bloom(
        &mut buffer,
        &occluded,
        8,
        1,
        &Emission {
            pixels: &pixels,
            depths: &depths,
            colors: &colors,
        },
    )
    .unwrap();
    assert_eq!(buffer, original);
    assert_eq!(pixels, [0, 3]);
    assert_eq!(depths, [1.0, 1.0]);
    assert_eq!(colors, [0xffffff, 0x336699]);
    assert_eq!(occluded, [2.0; 8]);
}

#[test]
fn native_emissive_models_match_shared_bloom_and_visibility() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/idle_aquarium/idle_aquarium.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    let texture = Texture {
        width: 1,
        height: 1,
        pixels: vec![0xff887766],
    };
    let mut cells = vec![0u16; 8 * 8 * 5];
    for cell in &mut cells[..64] {
        *cell = 1;
    }
    let world = VoxelWorld {
        width: 8,
        height: 8,
        depth: 5,
        cells: &cells,
        materials: &[&texture],
        render_distance: None,
    };
    let camera = VoxelCamera {
        x: 2.5,
        y: 3.5,
        z: 1.0,
        angle: 0.0,
        pitch: 0.0,
    };
    let model_camera = Camera3D {
        x: camera.x,
        y: camera.y,
        angle: camera.angle,
    };
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        let config = serde_json::json!({"width":8,"height":8,"depth":5,"materials":["test"],"cells":cells});
        ctx.eval::<(), _>(format!(
            "const r=__RunePixel3D.raycaster;r.resize(65,48,1);r.fov=58;r.config.map.sky=null;r.config.world={config};r.config.textures.test={};r.setEnhancedLighting(true);",
            serde_json::to_string(&texture).unwrap()
        )).unwrap();
        for shape in ["box", "sphere", "cylinder", "ramp"] {
            let models = serde_json::json!({
                "lamp":{"blocks":[{"shape":shape,"from":[-0.5,-0.5,0],"size":[1,1,1],"color":0xff80a0ffu32,"emissive":true}]},
                "second":{"blocks":[{"from":[-0.25,-0.25,0],"size":[0.5,0.5,1],"color":0xff00ff40u32,"emissive":true}]},
                "cover":{"blocks":[{"from":[-0.1,-0.25,0],"size":[0.2,0.5,1],"color":0xff303030u32}]}
            });
            ctx.eval::<(), _>(format!("r.config.models={models}")).unwrap();
            for (pitch, dissolve, cover, second) in [(0.0, 0.0, false, false), (25.0, 0.3, true, false), (0.0, 0.0, false, true)] {
                let mut things = vec![serde_json::json!({"x":4.5,"y":3.5,"z":1,"model":"lamp","pitch":pitch,"dissolve":dissolve})];
                if cover { things.push(serde_json::json!({"x":3.5,"y":3.5,"z":1,"model":"cover"})); }
                if second { things.push(serde_json::json!({"x":3.8,"y":3.8,"z":1,"model":"second"})); }
                let mut color = vec![0; 65 * 48];
                let mut depth = vec![0.0; 65 * 48];
                render_dense(&world, &camera, 58.0, 65, 48, &mut color, &mut depth).unwrap();
                let mut emission = EmissionBuffer::new(65, 48).unwrap();
                for thing in &things {
                    let model: BlockModel = serde_json::from_value(models[thing["model"].as_str().unwrap()].clone()).unwrap();
                    let instance: Thing3D = serde_json::from_value(thing.clone()).unwrap();
                    render_model_with_emission(&model, &instance, &model_camera, 2.25, 0.0,
                        thing["pitch"].as_f64().unwrap_or(0.0), [1.0, 0.0], (58.0_f64.to_radians()/2.0).tan(),
                        65, 48, &mut color, &mut depth, &mut emission).unwrap();
                }
                let result: String = ctx.eval(format!(r#"(() => {{
                    let samples;
                    const camera={{x:2.5,y:3.5,z:1,angle:0,pitch:0}}, things={};
                    r.render(camera,things,undefined,0,undefined,[],0,undefined,[],[],frame=>{{
                        samples={{colors:Array.from(frame.enhancement.emission.colors),
                                  pixels:Array.from(frame.enhancement.emission.pixels),
                                  depths:Array.from(frame.enhancement.emission.depths)}};
                    }});
                    samples.frame=Array.from(r.render(camera,things));
                    return JSON.stringify(samples);
                }})()"#, serde_json::to_string(&things).unwrap())).unwrap();
                let shared: serde_json::Value = serde_json::from_str(&result).unwrap();
                let samples = emission.samples();
                let mut visible = 0;
                let mut stale = 0;
                for i in 0..samples.colors.len() {
                    let reference = shared["colors"][i].as_u64().unwrap() as u32;
                    let actual = if samples.colors[i] != 0 && depth[samples.pixels[i]] == samples.depths[i] {
                        visible += 1;
                        samples.colors[i]
                    } else {
                        if samples.colors[i] != 0 { stale += 1; }
                        0
                    };
                    assert_eq!(actual, reference, "{shape}, cover={cover}, tile={i}");
                    if actual != 0 {
                        assert_eq!(samples.pixels[i] as u64, shared["pixels"][i].as_u64().unwrap());
                        assert!((samples.depths[i] - shared["depths"][i].as_f64().unwrap()).abs() < 1e-10);
                    }
                }
                assert!(visible > 0, "{shape} must emit visible light");
                if cover { assert!(stale > 0, "{shape} must exercise later occlusion"); }
                if second {
                    assert!(samples.colors.contains(&0x00ff40));
                    assert!(samples.colors.contains(&0x80a0ff));
                }
                let before_bloom = color.clone();
                apply_bloom(&mut color, &depth, 65, 48, &emission.samples()).unwrap();
                assert_ne!(color, before_bloom);
                let expected: Vec<u32> = serde_json::from_value(shared["frame"].clone()).unwrap();
                assert_eq!(color, expected, "{shape}, cover={cover}, complete frame");
                emission.clear();
                assert!(emission.samples().colors.iter().all(|&c| c == 0));
            }
        }
    });
}

#[test]
fn model_emission_rejects_mismatched_buffers_before_writing() {
    let model: BlockModel = serde_json::from_value(serde_json::json!({
        "blocks":[{"from":[0,0,0],"size":[1,1,1],"color":4294967295u32,"emissive":true}]
    }))
    .unwrap();
    let instance: Thing3D = serde_json::from_value(serde_json::json!({"x":2,"y":0})).unwrap();
    let camera = Camera3D {
        x: 0.0,
        y: 0.0,
        angle: 0.0,
    };
    let mut pixels = [17; 16];
    let mut depth = [f64::INFINITY; 16];
    let mut emission = EmissionBuffer::new(8, 2).unwrap();
    assert!(render_model_with_emission(
        &model,
        &instance,
        &camera,
        0.5,
        0.0,
        0.0,
        [1.0, 0.0],
        1.0,
        4,
        4,
        &mut pixels,
        &mut depth,
        &mut emission
    )
    .is_err());
    assert_eq!(pixels, [17; 16]);
    assert_eq!(depth, [f64::INFINITY; 16]);
    assert!(emission.samples().colors.iter().all(|&c| c == 0));
    let voxel_camera = VoxelCamera {
        x: 0.0,
        y: 0.0,
        z: 1.0,
        angle: 0.0,
        pitch: 0.0,
    };
    let mut matching_emission = EmissionBuffer::new(4, 4).unwrap();
    assert!(render_voxel_model_enhanced(
        &model,
        &instance,
        &voxel_camera,
        0.0,
        f64::NAN,
        4,
        4,
        &mut pixels,
        &mut depth,
        &mut matching_emission,
        None
    )
    .is_err());
    assert_eq!(pixels, [17; 16]);
    assert_eq!(depth, [f64::INFINITY; 16]);
    assert!(matching_emission.samples().colors.iter().all(|&c| c == 0));
    assert!(EmissionBuffer::new(0, 4).is_err());
}

#[test]
fn contact_shadows_match_shared_floor_and_glass() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/idle_aquarium/idle_aquarium.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    let texture = Texture {
        width: 1,
        height: 1,
        pixels: vec![0xffc89988],
    };
    let mut cells = vec![0u16; 8 * 8 * 8];
    cells[..64].fill(1);
    let world = VoxelWorld {
        width: 8,
        height: 8,
        depth: 8,
        cells: &cells,
        materials: &[&texture],
        render_distance: None,
    };
    let camera = VoxelCamera {
        x: 4.0,
        y: 6.0,
        z: 2.8,
        angle: 270.0,
        pitch: -50.0,
    };
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        let config = serde_json::json!({"width":8,"height":8,"depth":8,"materials":["test"],"cells":cells});
        ctx.eval::<(), _>(format!(
            "const r=__RunePixel3D.raycaster;r.resize(72,52,1);r.fov=58;r.config.map.sky=null;r.config.world={config};r.config.textures.test={};r.config.models={{actor:{{blocks:[],contactShadow:.8}},pane:{{blocks:[],glass:[4,4]}}}};r.setEnhancedLighting(true);",
            serde_json::to_string(&texture).unwrap()
        )).unwrap();
        for (pane_pitch, pane_z, actor_z, dissolve, visible) in [
            (None, 0.0, 1.0, 0.0, true),
            (Some(90.0), 2.0, 1.0, 0.35, true),
            (Some(0.0), 1.2, 1.25, 0.0, true),
            (Some(0.0), 1.2, 1.25, 1.0, true),
            (None, 0.0, 1.0, 0.0, false),
            (None, 0.0, 4.0, 0.0, true),
        ] {
            let panes: Vec<GlassPane> = pane_pitch.map(|pitch| GlassPane {
                x: 4.0, y: 4.0, z: pane_z, angle: 0.0, pitch, scale: 1.0, size: [4.0, 4.0],
            }).into_iter().collect();
            let mut things = Vec::new();
            if let Some(pitch) = pane_pitch {
                things.push(serde_json::json!({"x":4,"y":4,"z":pane_z,"pitch":pitch,"model":"pane"}));
            }
            things.push(serde_json::json!({"x":4,"y":4,"z":actor_z,"dissolve":dissolve,"visible":visible,"model":"actor"}));
            let caster = ShadowCaster { x: 4.0, y: 4.0, z: Some(actor_z), radius: 0.8, scale: 1.0, dissolve, visible };
            let mut pixels = vec![0; 72*52];
            let mut depth = vec![0.0; 72*52];
            render_dense(&world, &camera, 58.0, 72, 52, &mut pixels, &mut depth).unwrap();
            let light_data = serde_json::json!([{"x":4,"y":4,"z":2,"radius":4,"intensity":0.6,"color":0x8090ff}]);
            let lights: Vec<PointLight> = serde_json::from_value(light_data.clone()).unwrap();
            light_voxel_frame(&lights, &mut pixels, &depth, 72, 52, &camera, 58.0).unwrap();
            let before = pixels.clone();
            let old_depth = depth.clone();
            apply_contact_shadows(&mut pixels, &depth, 72, 52, &camera, 58.0, &world, &panes, &[caster]).unwrap();
            if visible && dissolve < 1.0 && actor_z < 2.0 { assert_ne!(pixels, before, "fixture should cast shadow"); }
            else { assert_eq!(pixels, before); }
            assert_eq!(depth, old_depth);
            apply_glass_and_haze(&mut pixels, &depth, 72, 52, &camera, 58.0, &panes, None).unwrap();
            let result: String = ctx.eval(format!(
                "r.render({{x:4,y:6,z:2.8,angle:270,pitch:-50}},{things},undefined,0,undefined,[],0,undefined,[],{light_data});JSON.stringify(Array.from(r.buffer))",
                things = serde_json::to_string(&things).unwrap()
            )).unwrap();
            let shared: Vec<u32> = serde_json::from_str(&result).unwrap();
            for (i, (&a, &b)) in pixels.iter().zip(&shared).enumerate() {
                assert_eq!(a, b, "shadow pixel {i}, pane={pane_pitch:?}, z={actor_z}, dissolve={dissolve}, visible={visible}");
            }
        }
    });
}

#[test]
fn invalid_contact_shadow_input_does_not_modify_frame() {
    let camera = VoxelCamera {
        x: 0.0,
        y: 0.0,
        z: 1.0,
        angle: 0.0,
        pitch: 0.0,
    };
    let texture = Texture {
        width: 1,
        height: 1,
        pixels: vec![1],
    };
    let world = VoxelWorld {
        width: 1,
        height: 1,
        depth: 1,
        cells: &[1],
        materials: &[&texture],
        render_distance: None,
    };
    let mut pixels = [0xff202020; 16];
    let depth = [f64::INFINITY; 16];
    let caster = ShadowCaster {
        x: 0.0,
        y: 0.0,
        z: Some(1.0),
        radius: 1.0,
        scale: 1.0,
        dissolve: f64::NAN,
        visible: true,
    };
    assert!(apply_contact_shadows(
        &mut pixels,
        &depth,
        4,
        4,
        &camera,
        58.0,
        &world,
        &[],
        &[caster]
    )
    .is_err());
    assert_eq!(pixels, [0xff202020; 16]);
    let bad_world = VoxelWorld {
        cells: &[],
        ..world
    };
    assert!(apply_contact_shadows(
        &mut pixels,
        &depth,
        4,
        4,
        &camera,
        58.0,
        &bad_world,
        &[],
        &[]
    )
    .is_err());
    assert_eq!(pixels, [0xff202020; 16]);
}

#[test]
fn aquarium_casters_without_support_match_shared_terrain() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/idle_aquarium/idle_aquarium.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        let json: String = ctx.eval(r#"(() => {
            const g=__RunePixel3D,w=g.app.state.world,s=g.renderState();
            const casters=s.things.filter(t=>t.model && g.config.models[t.model].contactShadow && t.visible !== false && t.z !== undefined)
                .map(t=>({x:t.x,y:t.y,z:t.z,radius:g.config.models[t.model].contactShadow,
                    scale:t.scale??1,dissolve:t.dissolve??0,visible:true}));
            const panes=s.things.filter(t=>t.visible !== false && t.model && g.config.models[t.model].glass && (t.dissolve??0)<1)
              .map(t=>({x:t.x,y:t.y,z:t.z??0,angle:t.angle??0,pitch:t.pitch??0,scale:t.scale??1,size:g.config.models[t.model].glass}));
            return JSON.stringify({width:w.width,height:w.height,depth:w.depth,cells:Array.from(w.cells),
              renderDistance:w.renderDistance,time:s.time,casters,panes});
        })()"#).unwrap();
        let data: serde_json::Value = serde_json::from_str(&json).unwrap();
        let cells: Vec<u16> = serde_json::from_value(data["cells"].clone()).unwrap();
        let texture: Texture = serde_json::from_value(game.config["textures"]["aqua/sand"].clone()).unwrap();
        let world = VoxelWorld {
            width: data["width"].as_u64().unwrap() as usize, height: data["height"].as_u64().unwrap() as usize,
            depth: data["depth"].as_u64().unwrap() as usize, cells: &cells, materials: &[&texture],
            render_distance: data["renderDistance"].as_f64(),
        };
        let casters: Vec<ShadowCaster> = data["casters"].as_array().unwrap().iter().map(|c| ShadowCaster {
            x: c["x"].as_f64().unwrap(), y: c["y"].as_f64().unwrap(), z: c["z"].as_f64(),
            radius: c["radius"].as_f64().unwrap(), scale: c["scale"].as_f64().unwrap(),
            dissolve: c["dissolve"].as_f64().unwrap(), visible: true,
        }).collect();
        let panes: Vec<GlassPane> = data["panes"].as_array().unwrap().iter().map(|p| GlassPane {
            x:p["x"].as_f64().unwrap(), y:p["y"].as_f64().unwrap(), z:p["z"].as_f64().unwrap(),
            angle:p["angle"].as_f64().unwrap(), pitch:p["pitch"].as_f64().unwrap(), scale:p["scale"].as_f64().unwrap(),
            size:[p["size"][0].as_f64().unwrap(),p["size"][1].as_f64().unwrap()],
        }).collect();
        assert!(!casters.is_empty(), "fixture must have actual aquarium shadow casters");
        assert_eq!(panes.len(), 4);
        let camera = VoxelCamera { x:15.65, y:33.5, z:3.0, angle:270.0, pitch:-50.0 };
        let sky = serde_json::from_value(game.config["map"]["sky"].clone()).unwrap();
        let mut pixels = vec![0; 160*100];
        let mut depth = vec![0.0; 160*100];
        pixel3d::voxel::render_dense_with_sky(&world, &camera, 58.0, 160, 100, &mut pixels, &mut depth, Some(&sky), data["time"].as_f64().unwrap()).unwrap();
        let before = pixels.clone();
        apply_contact_shadows(&mut pixels, &depth, 160, 100, &camera, 58.0, &world, &panes, &casters).unwrap();
        assert!(pixels == before, "unsupported casters must not create terrain shadows");
        apply_glass_and_haze(&mut pixels, &depth, 160, 100, &camera, 58.0, &panes, Some(sky.horizon)).unwrap();
        let output: String = ctx.eval(r#"(() => {
            const g=__RunePixel3D,r=g.raycaster,s=g.renderState();
            const things=s.things.filter(t=>t.model && t.visible !== false &&
                (g.config.models[t.model].glass || (g.config.models[t.model].contactShadow && t.z !== undefined)));
            r.resize(160,100,1);r.config.world=g.app.state.world;
            r.config.models=Object.fromEntries(Object.entries(g.config.models).map(([name,model])=>[name,{blocks:[],contactShadow:model.contactShadow,glass:model.glass}]));
            r.setEnhancedLighting(true);r.render({x:15.65,y:33.5,z:3,angle:270,pitch:-50},things,undefined,0,undefined,[],s.time);
            return JSON.stringify(Array.from(r.buffer));
        })()"#).unwrap();
        let expected: Vec<u32> = serde_json::from_str(&output).unwrap();
        for (i, (&a, &b)) in pixels.iter().zip(&expected).enumerate() {
            assert_eq!(a,b,"aquarium terrain shadow pixel {i}");
        }

    });
}

#[test]
fn aquarium_enhanced_world_frames_match_shared_renderer() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/idle_aquarium/idle_aquarium.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        let texture: Texture = serde_json::from_value(game.config["textures"]["aqua/sand"].clone()).unwrap();
        let sky = serde_json::from_value(game.config["map"]["sky"].clone()).unwrap();
        let mut previous = None;
        for ticks in [0, 30] {
            if ticks != 0 { ctx.eval::<(), _>("for(let i=0;i<30;i++) __RunePixel3D.step({})").unwrap(); }
            let json: String = ctx.eval(r#"(() => {
                const g=__RunePixel3D,w=g.app.state.world,s=g.renderState();
                return JSON.stringify({width:w.width,height:w.height,depth:w.depth,cells:Array.from(w.cells),
                  renderDistance:w.renderDistance,camera:s.camera,time:s.time,lights:s.lights,
                  things:s.things.filter(t=>t.model && t.visible !== false)});
            })()"#).unwrap();
            let data: serde_json::Value = serde_json::from_str(&json).unwrap();
            let cells: Vec<u16> = serde_json::from_value(data["cells"].clone()).unwrap();
            let world = VoxelWorld {
                width: data["width"].as_u64().unwrap() as usize, height: data["height"].as_u64().unwrap() as usize,
                depth: data["depth"].as_u64().unwrap() as usize, cells: &cells, materials: &[&texture],
                render_distance: data["renderDistance"].as_f64(),
            };
            let cameras = [
                data["camera"].clone(),
                serde_json::json!({"x":20,"y":38,"z":10,"angle":270,"pitch":-15}),
                serde_json::json!({"x":8,"y":30,"z":8,"angle":0,"pitch":-12}),
                serde_json::json!({"x":31,"y":30,"z":6,"angle":180,"pitch":-8}),
            ];
            let things = data["things"].as_array().unwrap();
            assert!(things.len() >= 20);
            if let Some(old) = &previous { assert_ne!(old, things); }
            previous = Some(things.clone());
            for (view, c) in cameras.iter().enumerate() {
            let camera = VoxelCamera { x:c["x"].as_f64().unwrap(), y:c["y"].as_f64().unwrap(),
                z:c["z"].as_f64().unwrap(), angle:c["angle"].as_f64().unwrap(), pitch:c["pitch"].as_f64().unwrap() };
            let mut color = vec![0; 80*50];
            let mut depth = vec![0.0; 80*50];
            let mut emission = EmissionBuffer::new(80, 50).unwrap();
            let mut panes = Vec::new();
            let mut casters = Vec::new();
            pixel3d::voxel::render_dense_with_sky(&world, &camera, 58.0, 80, 50, &mut color, &mut depth, Some(&sky), data["time"].as_f64().unwrap()).unwrap();
            for value in things {
                let instance: Thing3D = serde_json::from_value(value.clone()).unwrap();
                let model_data = &game.config["models"][instance.model.as_ref().unwrap()];
                let model: BlockModel = serde_json::from_value(model_data.clone()).unwrap();
                if let Some(size) = model_data["glass"].as_array() {
                    if instance.dissolve.unwrap_or(0.0) < 1.0 {
                        panes.push(GlassPane { x:instance.x,y:instance.y,z:instance.z.unwrap_or(0.0),
                            angle:instance.angle.unwrap_or(0.0),pitch:value["pitch"].as_f64().unwrap_or(0.0),
                            scale:instance.scale.unwrap_or(1.0),size:[size[0].as_f64().unwrap(),size[1].as_f64().unwrap()] });
                    }
                }
                if let Some(radius) = model_data["contactShadow"].as_f64() {
                    casters.push(ShadowCaster { x:instance.x,y:instance.y,z:instance.z,radius,
                        scale:instance.scale.unwrap_or(1.0),dissolve:instance.dissolve.unwrap_or(0.0),visible:true });
                }
                render_voxel_model_enhanced(&model, &instance, &camera,
                    value["pitch"].as_f64().unwrap_or(0.0), 58.0, 80, 50, &mut color,
                    &mut depth, &mut emission, Some(sky.horizon)).unwrap();
            }
            assert_eq!(panes.len(), 4);
            assert!(!casters.is_empty());
            let lights: Vec<PointLight> = serde_json::from_value(data["lights"].clone()).unwrap();
            assert!(!lights.is_empty());
            let owned_models: Vec<_> = things.iter().map(|value| {
                let instance: Thing3D = serde_json::from_value(value.clone()).unwrap();
                let source = &game.config["models"][instance.model.as_ref().unwrap()];
                let model: BlockModel = serde_json::from_value(source.clone()).unwrap();
                let glass = source["glass"].as_array().map(|v| [v[0].as_f64().unwrap(),v[1].as_f64().unwrap()]);
                (instance,model,value["pitch"].as_f64().unwrap_or(0.0),glass,source["contactShadow"].as_f64())
            }).collect();
            let scene_models: Vec<_> = owned_models.iter().map(|(instance,model,pitch,glass,contact_shadow)|
                VoxelSceneModel { instance, model, pitch:*pitch, glass:*glass, contact_shadow:*contact_shadow }).collect();
            let scene = EnhancedVoxelScene { world:&world, camera:&camera, fov:58.0, sky:Some(&sky),
                time:data["time"].as_f64().unwrap(), models:&scene_models, lights:&lights };
            let frame = render_enhanced_voxel_scene(&scene,80,50).unwrap();
            assert_eq!(frame.depth,depth, "assembled scene depth");
            let mut composed = color.clone();
            finish_voxel_lighting(&mut composed, &depth, 80, 50, &camera, 58.0, &world, &lights,
                &panes, &casters, Some(sky.horizon), &emission.samples()).unwrap();
            light_voxel_frame(&lights, &mut color, &depth, 80, 50, &camera, 58.0).unwrap();
            apply_contact_shadows(&mut color, &depth, 80, 50, &camera, 58.0, &world, &panes, &casters).unwrap();
            let before_glass = color.clone();
            apply_glass_and_haze(&mut color, &depth, 80, 50, &camera, 58.0, &panes, Some(sky.horizon)).unwrap();
            if view == 0 { assert!(color != before_glass, "aquarium glass must contribute"); }
            let before_bloom = color.clone();
            apply_bloom(&mut color, &depth, 80, 50, &emission.samples()).unwrap();
            if view == 0 { assert!(color != before_bloom, "aquarium bloom must contribute at tick {ticks}"); }
            assert_eq!(color, composed, "combined native lighting pass order");
            assert_eq!(frame.color, composed, "assembled scene color");
            let output: String = ctx.eval(format!(r#"(() => {{
                const r=__RunePixel3D.raycaster;
                r.resize(80,50,1);r.config.world=__RunePixel3D.app.state.world;r.setEnhancedLighting(true);
                r.render({},{},undefined,0,undefined,[],{},undefined,[],{});
                return JSON.stringify({{pixels:Array.from(r.buffer),depth:Array.from(r.pixelDepth)}});
            }})()"#, c, data["things"], data["time"], data["lights"])).unwrap();
            let shared: serde_json::Value = serde_json::from_str(&output).unwrap();
            for (i, (&pixel, &distance)) in color.iter().zip(&depth).enumerate() {
                assert_eq!(pixel as u64, shared["pixels"][i].as_u64().unwrap(), "enhanced aquarium tick {ticks}, view {view}, pixel {i}");
                match shared["depth"][i].as_f64() {
                    Some(expected) => assert!((distance-expected).abs()<1e-10,"tick {ticks} depth pixel {i}"),
                    None => assert!(distance.is_infinite(),"tick {ticks} expected infinite depth at {i}"),
                }
                }
                if view == 0 {
                    let overlay_json: String = ctx.eval(r#"(() => {
                        const g=__RunePixel3D,r=g.raycaster,s=g.renderState(),hud=g.frameHud(s);
                        r.renderOverlay(hud);
                        const overlay=Array.from(r.buffer);
                        r.render(s.camera,s.things,undefined,0,hud,[],s.time,undefined,[],s.lights);
                        return JSON.stringify({overlay,full:Array.from(r.buffer)});
                    })()"#).unwrap();
                    let overlay_data: serde_json::Value = serde_json::from_str(&overlay_json).unwrap();
                    let overlay: Vec<u32> = serde_json::from_value(overlay_data["overlay"].clone()).unwrap();
                    assert!(overlay.iter().any(|&pixel| pixel == 0));
                    assert!(overlay.iter().any(|&pixel| pixel != 0));
                    composite_hud(&mut composed, &overlay, 80, 50).unwrap();
                    let full: Vec<u32> = serde_json::from_value(overlay_data["full"].clone()).unwrap();
                    assert_eq!(composed, full, "aquarium world and HUD composition at tick {ticks}");
                    if ticks == 0 {
                        let menu_json: String = ctx.eval(r#"(() => {
                            const g=__RunePixel3D,r=g.raycaster;
                            g.invoke('toggle_menu');
                            const s=g.renderState(),hud=g.frameHud(s);
                            r.renderOverlay(hud);
                            const overlay=Array.from(r.buffer);
                            r.render(s.camera,s.things,undefined,0,hud,[],s.time,undefined,[],s.lights);
                            const full=Array.from(r.buffer),items=s.ui.grid.items.length;
                            g.invoke('close_menu');
                            return JSON.stringify({overlay,full,items});
                        })()"#).unwrap();
                        let menu_data: serde_json::Value = serde_json::from_str(&menu_json).unwrap();
                        assert_eq!(menu_data["items"].as_u64().unwrap(), 10);
                        let menu_overlay: Vec<u32> = serde_json::from_value(menu_data["overlay"].clone()).unwrap();
                        let menu_full: Vec<u32> = serde_json::from_value(menu_data["full"].clone()).unwrap();
                        let mut with_menu = color.clone();
                        composite_hud(&mut with_menu, &menu_overlay, 80, 50).unwrap();
                        assert_eq!(with_menu, menu_full, "aquarium world and open menu composition");
                    }
                }
                }
        }
    });
}

#[test]
fn combined_voxel_lighting_is_atomic_on_late_failure() {
    let texture = Texture {
        width: 1,
        height: 1,
        pixels: vec![0xff887766],
    };
    let world = VoxelWorld {
        width: 1,
        height: 1,
        depth: 1,
        cells: &[1],
        materials: &[&texture],
        render_distance: None,
    };
    let camera = VoxelCamera {
        x: 0.0,
        y: 0.0,
        z: 1.0,
        angle: 0.0,
        pitch: 0.0,
    };
    let lights = [PointLight {
        x: 0.0,
        y: 0.0,
        z: 1.0,
        color: 0xffffff,
        radius: 4.0,
        intensity: 1.0,
    }];
    let depth = [1.0; 16];
    let mut buffer = [0xff202020; 16];
    let original = buffer;
    let mut partially_lit = buffer;
    light_voxel_frame(&lights, &mut partially_lit, &depth, 4, 4, &camera, 58.0).unwrap();
    assert_ne!(
        partially_lit, original,
        "the pass preceding the error must modify the frame"
    );
    let bad_emission = Emission {
        pixels: &[16],
        depths: &[1.0],
        colors: &[0xffffff],
    };
    assert!(finish_voxel_lighting(
        &mut buffer,
        &depth,
        4,
        4,
        &camera,
        58.0,
        &world,
        &lights,
        &[],
        &[],
        None,
        &bad_emission
    )
    .is_err());
    assert_eq!(buffer, original);
    assert_eq!(depth, [1.0; 16]);
}

#[test]
fn shared_hud_overlay_rejects_malformed_input_atomically() {
    let mut frame = [0xff112233, 0xff445566];
    let original = frame;
    for (overlay, width, height) in [
        (&[0, 0xff000001][..], 1, 1),
        (&[0, 0x80123456][..], 2, 1),
        (&[0, 0x00123456][..], 2, 1),
        (&[0][..], 2, 1),
    ] {
        assert!(composite_hud(&mut frame, overlay, width, height).is_err());
        assert_eq!(frame, original);
    }
    composite_hud(&mut frame, &[0, 0xffabcdef], 2, 1).unwrap();
    assert_eq!(frame, [0xff112233, 0xffabcdef]);
}

#[test]
fn distant_enhanced_voxel_models_match_shared_skyline_haze() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/idle_aquarium/idle_aquarium.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    let texture = Texture {
        width: 1,
        height: 1,
        pixels: vec![0xff887766],
    };
    let mut cells = vec![0u16; 40 * 8 * 8];
    cells[..40 * 8].fill(1);
    let world = VoxelWorld {
        width: 40,
        height: 8,
        depth: 8,
        cells: &cells,
        materials: &[&texture],
        render_distance: None,
    };
    let model_json = serde_json::json!({"blocks":[{"from":[-1,-1,0],"size":[2,2,2],"color":0xff80a0ffu32,"emissive":true}]});
    let model: BlockModel = serde_json::from_value(model_json.clone()).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        let config = serde_json::json!({"width":40,"height":8,"depth":8,"materials":["test"],"cells":cells});
        ctx.eval::<(), _>(format!("const r=__RunePixel3D.raycaster;r.resize(96,60,1);r.fov=58;r.config.map.sky=null;r.config.world={config};r.config.textures.test={};r.config.models={{lamp:{model_json}}};r.setEnhancedLighting(true);",
            serde_json::to_string(&texture).unwrap())).unwrap();
        let sky = serde_json::from_value(game.config["map"]["sky"].clone()).unwrap();
        for (camera_y, model_x, use_sky) in [(2.5, 7.0, false), (2.5, 20.0, false), (2.5, 35.0, false), (5.0, 20.0, false), (2.5, 20.0, true)] {
            let selected_sky = if use_sky { Some(&sky) } else { None };
            ctx.eval::<(), _>(format!("r.config.map.sky={}",if use_sky { game.config["map"]["sky"].to_string() } else { "null".to_owned() })).unwrap();
            let camera = VoxelCamera { x:2.5,y:camera_y,z:1.0,angle:0.0,pitch:0.0 };
            let thing = serde_json::json!({"x":model_x,"y":camera_y,"z":1,"model":"lamp"});
            let instance: Thing3D = serde_json::from_value(thing.clone()).unwrap();
            let mut color = vec![0;96*60];
            let mut depth = vec![0.0;96*60];
            pixel3d::voxel::render_dense_with_sky(&world,&camera,58.0,96,60,&mut color,&mut depth,selected_sky,0.0).unwrap();
            let mut unshaded = color.clone();
            let mut unshaded_depth = depth.clone();
            let model_camera = Camera3D { x:camera.x,y:camera.y,angle:camera.angle };
            let mut baseline_emission = EmissionBuffer::new(96,60).unwrap();
            render_model_with_emission(&model,&instance,&model_camera,2.25,0.0,0.0,[1.0,0.0],
                (58.0_f64.to_radians()/2.0).tan(),96,60,&mut unshaded,&mut unshaded_depth,&mut baseline_emission).unwrap();
            let mut emission = EmissionBuffer::new(96,60).unwrap();
            render_voxel_model_enhanced(&model,&instance,&camera,0.0,58.0,96,60,&mut color,&mut depth,&mut emission,selected_sky.map(|s|s.horizon)).unwrap();
            if camera_y < 4.0 && model_x > 13.5 {
                assert!(color != unshaded,"distant skyline model must be hazed");
            } else {
                assert_eq!(color,unshaded,"near and non-skyline models must not be hazed");
            }
            assert_eq!(depth,unshaded_depth);
            assert_eq!(emission.samples().colors,baseline_emission.samples().colors,"haze must not change emissive color");
            finish_voxel_lighting(&mut color,&depth,96,60,&camera,58.0,&world,&[],&[],&[],selected_sky.map(|s|s.horizon),&emission.samples()).unwrap();
            let output: String = ctx.eval(format!("r.render({{x:2.5,y:{camera_y},z:1,angle:0,pitch:0}},[{thing}]);JSON.stringify({{pixels:Array.from(r.buffer),depth:Array.from(r.pixelDepth)}})")).unwrap();
            let shared: serde_json::Value = serde_json::from_str(&output).unwrap();
            for (i, (&pixel,&distance)) in color.iter().zip(&depth).enumerate() {
                assert_eq!(pixel as u64,shared["pixels"][i].as_u64().unwrap(),"haze x={model_x} y={camera_y} pixel={i}");
                match shared["depth"][i].as_f64() {
                    Some(expected) => assert!((distance-expected).abs()<1e-10,"haze depth at {i}"),
                    None => assert!(distance.is_infinite()),
                }
            }
        }
    });
}

#[test]
fn shared_aquarium_hud_overlays_match_direct_rendering() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/idle_aquarium/idle_aquarium.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        ctx.eval::<(), _>("__RunePixel3D.raycaster.resize(640,400,1)").unwrap();
        let mut menu_selection = None;
        for (stage, action) in [
            ("buttons", ""),
            ("menu", "__RunePixel3D.invoke('toggle_menu')"),
            ("menu-move", "__RunePixel3D.invoke('menu_move',[1])"),
            ("profile", "__RunePixel3D.invoke('close_menu');__RunePixel3D.invoke('inspect_fish',[0])"),
            ("keyboard", "__RunePixel3D.invoke('open_name_keyboard')"),
        ] {
            if !action.is_empty() { ctx.eval::<(), _>(action).unwrap(); }
            let result: String = ctx.eval(r#"(() => {
                const g=__RunePixel3D,r=g.raycaster,s=g.renderState(),hud=g.frameHud(s);
                for(let i=0;i<r.buffer.length;i++)r.buffer[i]=(0xff000000|((i*0x12345)&0xffffff))>>>0;
                r.drawHud(hud);
                const full=Array.from(r.buffer);
                r.renderOverlay(hud);
                return JSON.stringify({overlay:Array.from(r.buffer),full,
                    buttons:s.ui?.buttons?.length??0,grid:s.ui?.grid?.items?.length??0,
                    selected:s.ui?.grid?.items?.findIndex(item=>item.selected)??-1,
                    callout:!!s.ui?.callout,keyboard:!!s.ui?.keyboard});
            })()"#).unwrap();
            let data: serde_json::Value = serde_json::from_str(&result).unwrap();
            match stage {
                "buttons" => assert!(data["buttons"].as_u64().unwrap() >= 4),
                "menu" => {
                    assert_eq!(data["grid"].as_u64().unwrap(), 10);
                    menu_selection = data["selected"].as_i64();
                    assert!(menu_selection.unwrap() >= 0);
                }
                "menu-move" => assert_ne!(data["selected"].as_i64(), menu_selection),
                "profile" => assert_eq!(data["callout"], true),
                "keyboard" => assert_eq!(data["keyboard"], true),
                _ => unreachable!(),
            }
            let overlay: Vec<u32> = serde_json::from_value(data["overlay"].clone()).unwrap();
            let expected: Vec<u32> = serde_json::from_value(data["full"].clone()).unwrap();
            let mut frame: Vec<u32> = (0..640*400).map(|i| 0xff000000 | ((i as u32).wrapping_mul(0x12345) & 0xffffff)).collect();
            assert!(overlay.iter().any(|&pixel| pixel == 0));
            assert!(overlay.iter().any(|&pixel| pixel != 0));
            composite_hud(&mut frame,&overlay,640,400).unwrap();
            assert_eq!(frame,expected,"shared HUD overlay stage {stage}");
        }
    });
}

#[test]
fn enhanced_scene_contract_validates_inputs_and_rebuilds_frames() {
    let texture = Texture {
        width: 1,
        height: 1,
        pixels: vec![0xff887766],
    };
    let world = VoxelWorld {
        width: 4,
        height: 4,
        depth: 2,
        cells: &[1; 32],
        materials: &[&texture],
        render_distance: None,
    };
    let camera = VoxelCamera {
        x: 1.5,
        y: 1.5,
        z: 2.0,
        angle: 0.0,
        pitch: -20.0,
    };
    let model: BlockModel = serde_json::from_value(serde_json::json!({"blocks":[
        {"from":[0,0,0],"size":[1,1,1],"color":0xffffffffu32,"emissive":true}
    ]}))
    .unwrap();
    let instance: Thing3D =
        serde_json::from_value(serde_json::json!({"x":2.5,"y":1.5,"z":1,"model":"lamp"})).unwrap();
    let models = [VoxelSceneModel {
        instance: &instance,
        model: &model,
        pitch: 0.0,
        glass: None,
        contact_shadow: None,
    }];
    let scene = EnhancedVoxelScene {
        world: &world,
        camera: &camera,
        fov: 58.0,
        sky: None,
        time: 0.0,
        models: &models,
        lights: &[],
    };
    let first = render_enhanced_voxel_scene(&scene, 16, 12).unwrap();
    let different = render_enhanced_voxel_scene(&scene, 9, 7).unwrap();
    let again = render_enhanced_voxel_scene(&scene, 16, 12).unwrap();
    assert_eq!(different.color.len(), 63);
    assert_eq!(first.color, again.color);
    assert_eq!(first.depth, again.depth);
    assert!(render_enhanced_voxel_scene(&scene, 0, 12).is_err());
    let sprite_instance = Thing3D {
        sprite: "unsupported".into(),
        ..instance.clone()
    };
    let sprite_models = [VoxelSceneModel {
        instance: &sprite_instance,
        model: &model,
        pitch: 0.0,
        glass: None,
        contact_shadow: None,
    }];
    let invalid = EnhancedVoxelScene {
        models: &sprite_models,
        ..scene
    };
    assert!(render_enhanced_voxel_scene(&invalid, 16, 12)
        .unwrap_err()
        .to_string()
        .contains("sprites are unsupported"));
    let bad_model: BlockModel = serde_json::from_value(serde_json::json!({"blocks":[
        {"from":[0,0,0],"size":[0,1,1],"color":0xffffffffu32}
    ]}))
    .unwrap();
    let invalid_models = [VoxelSceneModel {
        instance: &instance,
        model: &bad_model,
        pitch: 0.0,
        glass: None,
        contact_shadow: None,
    }];
    let invalid_geometry = EnhancedVoxelScene {
        models: &invalid_models,
        ..scene
    };
    assert!(render_enhanced_voxel_scene(&invalid_geometry, 16, 12)
        .unwrap_err()
        .to_string()
        .contains("geometry"));
    let bad_pane = [VoxelSceneModel {
        instance: &instance,
        model: &model,
        pitch: 0.0,
        glass: Some([0.0, 1.0]),
        contact_shadow: None,
    }];
    let invalid_pane = EnhancedVoxelScene {
        models: &bad_pane,
        ..scene
    };
    assert!(render_enhanced_voxel_scene(&invalid_pane, 16, 12)
        .unwrap_err()
        .to_string()
        .contains("glass"));
    let bad_sky = rune_runtime::apps::pixel3d::raster::Sky {
        seed: 0,
        zenith: 0,
        horizon: 0,
        cloud: 0,
        speed: f64::NAN,
        below: None,
    };
    let invalid_sky = EnhancedVoxelScene {
        sky: Some(&bad_sky),
        models: &models,
        ..scene
    };
    assert!(render_enhanced_voxel_scene(&invalid_sky, 16, 12)
        .unwrap_err()
        .to_string()
        .contains("sky"));
}
