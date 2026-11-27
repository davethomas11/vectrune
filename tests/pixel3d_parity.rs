//! Cross-renderer parity checks. Both paths consume the same compiled game state.
use rune_runtime::{
    apps::pixel3d::{
        self,
        lighting::{light_voxel_frame, PointLight},
        model::{render_model_oriented, BlockModel},
        raster::{Camera3D, MapData, Rasterizer3D, RenderState, Sky, Sprite, Texture, Thing3D},
        voxel::{render_dense, render_dense_with_sky, VoxelCamera, VoxelWorld},
    },
    rune_parser::load_rune_document_from_path,
};
use std::{
    collections::{BTreeMap, HashMap},
    path::Path,
};

fn compare_frames(native: &[u8], shared: &[u8]) -> (usize, u8) {
    assert_eq!(native.len(), shared.len(), "framebuffer dimensions differ");
    assert_eq!(native.len() % 4, 0, "framebuffer is not RGBA");
    let mut different_pixels = 0;
    let mut max_channel_difference = 0;
    for (a, b) in native.chunks_exact(4).zip(shared.chunks_exact(4)) {
        let difference = a.iter().zip(b).map(|(&x, &y)| x.abs_diff(y)).max().unwrap();
        different_pixels += usize::from(difference != 0);
        max_channel_difference = max_channel_difference.max(difference);
    }
    (different_pixels, max_channel_difference)
}

#[test]
fn dense_voxel_terrain_matches_shared_color_and_depth() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/idle_aquarium/idle_aquarium.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    let texture = Texture {
        width: 4,
        height: 4,
        pixels: (0..16).map(|i| 0xff000000 | i * 0x090b0d).collect(),
    };
    let texture2 = Texture {
        width: 2,
        height: 2,
        pixels: vec![0xff123456, 0xffaabbcc, 0xffee4499, 0xff508090],
    };
    let mut cells = vec![0u16; 8 * 7 * 5];
    for z in 0..5 {
        for y in 0..7 {
            for x in 0..8 {
                if z == 0
                    || (x == 5 && (1..=5).contains(&y) && z < 4)
                    || (x == 2 && y == 3 && z == 2)
                {
                    cells[(z * 7 + y) * 8 + x] = if x == 5 { 2 } else { 1 };
                }
            }
        }
    }
    let materials = [&texture, &texture2];
    let mut world = VoxelWorld {
        width: 8,
        height: 7,
        depth: 5,
        cells: &cells,
        materials: &materials,
        render_distance: Some(20.0),
    };
    let width = 64;
    let height = 40;
    let cases = [
        (3.5, 3.5, 1.0, 0.0, 0.0),
        (3.5, 3.5, 1.0, 37.0, -25.0),
        (3.0, 2.0, 0.75, 90.0, 30.0),
        (-2.0, 3.5, 1.0, 0.0, -10.0),
        (10.0, 3.5, 1.0, 180.0, 0.0),
        (0.0, 3.5, 1.0, 180.0, 0.0),
    ];
    context.with(|ctx| {
            ctx.eval::<(), _>(game.script.as_str()).unwrap();
            let config = serde_json::json!({
                "width": 8, "height": 7, "depth": 5, "materials": ["test", "test2"],
                "cells": cells, "renderDistance": 20,
            });
            ctx.eval::<(), _>(format!(
                "const r=__RunePixel3D.raycaster; r.resize({width},{height},1); r.fov=58; r.config.world={config}; r.config.map.sky=null; r.config.textures.test={}; r.config.textures.test2={};",
                serde_json::to_string(&texture).unwrap(), serde_json::to_string(&texture2).unwrap()
            )).unwrap();
            for (case, (x, y, z, angle, pitch)) in cases.into_iter().enumerate() {
                if case == 2 {
                    world.render_distance = Some(2.0);
                    ctx.eval::<(), _>("r.config.world.renderDistance=2").unwrap();
                }
                let camera = VoxelCamera { x, y, z, angle, pitch };
                let mut native = vec![0; width * height];
                let mut native_depth = vec![0.0; width * height];
                render_dense(&world, &camera, 58.0, width, height, &mut native, &mut native_depth).unwrap();
                let result: String = ctx.eval(format!(
                    "r.render({{x:{x},y:{y},z:{z},angle:{angle},pitch:{pitch}}});JSON.stringify({{pixels:Array.from(r.buffer),depth:Array.from(r.pixelDepth)}})"
                )).unwrap();
                let shared: serde_json::Value = serde_json::from_str(&result).unwrap();
                for (i, (&color, &depth)) in native.iter().zip(&native_depth).enumerate() {
                    assert_eq!(color as u64, shared["pixels"][i].as_u64().unwrap(), "color at ({x},{y},{z}) angle {angle} pitch {pitch}, pixel {i}");
                    match shared["depth"][i].as_f64() {
                        Some(expected) => assert!((depth - expected).abs() < 1e-10, "depth at ({x},{y},{z}) angle {angle} pitch {pitch}, pixel {i}: {depth} vs {expected}"),
                        None => assert!(depth.is_infinite(), "expected infinite depth at pixel {i}"),
                    }
                }
            }
        });
}

#[test]
fn voxel_point_lights_match_shared_renderer() {
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
        pixels: vec![0xff302010],
    };
    let mut cells = vec![0; 8 * 8 * 5];
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
    let lights_json = serde_json::json!([
        {"x":4.0,"y":3.5,"z":0.5,"color":0xff8000,"radius":3.5,"intensity":0.7},
        {"x":2.5,"y":3.0,"z":1.8,"color":0x007fff,"radius":2.0,"intensity":1.0},
        {"x":-6.0,"y":3.5,"z":0.5,"color":0xffffff,"radius":1.0,"intensity":1.0},
        {"x":4.0,"y":3.5,"z":1.0,"color":0xffffff,"radius":2.0,"intensity":0.0}
    ]);
    let lights: Vec<PointLight> = serde_json::from_value(lights_json.clone()).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        let config = serde_json::json!({"width":8,"height":8,"depth":5,"materials":["test"],"cells":cells});
        ctx.eval::<(), _>(format!(
            "const r=__RunePixel3D.raycaster;r.resize(64,40,1);r.fov=58;r.config.map.sky=null;r.config.world={config};r.config.textures.test={};",
            serde_json::to_string(&texture).unwrap()
        )).unwrap();
        for pitch in [-30.0, 0.0, 25.0] {
            let camera = VoxelCamera { x: 2.5, y: 3.5, z: 1.0, angle: 0.0, pitch };
            let mut color = vec![0; 64 * 40];
            let mut depth = vec![0.0; 64 * 40];
            render_dense(&world, &camera, 58.0, 64, 40, &mut color, &mut depth).unwrap();
            let unlit = color.clone();
            light_voxel_frame(&lights, &mut color, &depth, 64, 40, &camera, 58.0).unwrap();
            if pitch <= 0.0 {
                assert!(unlit != color, "fixture must exercise lighting at pitch {pitch}");
            }
            let json: String = ctx.eval(format!(
                "r.render({{x:2.5,y:3.5,z:1,angle:0,pitch:{pitch}}},[],undefined,0,undefined,[],0,undefined,[],{lights_json});JSON.stringify(Array.from(r.buffer))"
            )).unwrap();
            let shared: Vec<u32> = serde_json::from_str(&json).unwrap();
            assert_eq!(color, shared, "lighting differs at pitch {pitch}");
        }
    });
    let mut pixels = [0; 16];
    let depth = [0.0; 16];
    let camera = VoxelCamera {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        angle: 0.0,
        pitch: 0.0,
    };
    let invalid = PointLight {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        color: 0xffffff,
        radius: 0.0,
        intensity: 1.0,
    };
    assert!(light_voxel_frame(&[invalid], &mut pixels, &depth, 4, 4, &camera, 58.0).is_err());
    assert!(light_voxel_frame(&lights, &mut pixels[..15], &depth, 4, 4, &camera, 58.0).is_err());
}

#[test]
fn comparator_reports_pixel_and_channel_differences() {
    assert_eq!(
        compare_frames(&[1, 2, 3, 255, 0, 0, 0, 255], &[1, 2, 3, 255, 4, 0, 8, 255]),
        (1, 8)
    );
    assert_eq!(compare_frames(&[1, 2, 3, 255], &[1, 2, 3, 255]), (0, 0));
}

#[test]
fn dense_voxel_renderer_rejects_invalid_inputs_and_refreshes_buffers() {
    let texture = Texture {
        width: 1,
        height: 1,
        pixels: vec![0xffaabbcc],
    };
    let cells = [0u16; 8];
    let mut world = VoxelWorld {
        width: 2,
        height: 2,
        depth: 2,
        cells: &cells,
        materials: &[&texture],
        render_distance: None,
    };
    let camera = VoxelCamera {
        x: 0.5,
        y: 0.5,
        z: 0.0,
        angle: 0.0,
        pitch: 0.0,
    };
    let mut pixels = [0; 16];
    let mut depth = [0.0; 16];
    render_dense(&world, &camera, 60.0, 4, 4, &mut pixels, &mut depth).unwrap();
    assert!(pixels.iter().all(|&pixel| pixel == 0xff342820));
    assert!(depth.iter().all(|d| d.is_infinite()));
    assert!(render_dense(&world, &camera, 60.0, 4, 4, &mut pixels[..15], &mut depth).is_err());
    assert!(render_dense(&world, &camera, 180.0, 4, 4, &mut pixels, &mut depth).is_err());
    assert!(render_dense(
        &world,
        &VoxelCamera {
            pitch: 86.0,
            ..camera
        },
        60.0,
        4,
        4,
        &mut pixels,
        &mut depth
    )
    .is_err());
    let invalid_cells = [2u16; 8];
    world.cells = &invalid_cells;
    assert!(render_dense(&world, &camera, 60.0, 4, 4, &mut pixels, &mut depth).is_err());
    let filled = [1u16; 8];
    world.cells = &filled;
    render_dense(&world, &camera, 60.0, 4, 4, &mut pixels, &mut depth).unwrap();
    assert!(pixels.iter().all(|&pixel| pixel == 0xffaabbcc));
    assert!(depth.iter().all(|&d| d == 0.0));
    world.cells = &cells;
    render_dense(&world, &camera, 60.0, 4, 4, &mut pixels, &mut depth).unwrap();
    assert!(pixels.iter().all(|&pixel| pixel == 0xff342820));
    assert!(depth.iter().all(|d| d.is_infinite()));
}

#[test]
fn aquarium_voxel_terrain_matches_shared_renderer() {
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
            const g=__RunePixel3D, w=g.app.state.world;
            return JSON.stringify({width:w.width,height:w.height,depth:w.depth,cells:Array.from(w.cells),
                renderDistance:w.renderDistance,materials:w.materials,camera:g.app.state.camera});
        })()"#).unwrap();
        let data: serde_json::Value = serde_json::from_str(&json).unwrap();
        let cells: Vec<u16> = serde_json::from_value(data["cells"].clone()).unwrap();
        let texture: Texture = serde_json::from_value(game.config["textures"]["aqua/sand"].clone()).unwrap();
        let world = VoxelWorld {
            width: data["width"].as_u64().unwrap() as usize,
            height: data["height"].as_u64().unwrap() as usize,
            depth: data["depth"].as_u64().unwrap() as usize,
            cells: &cells, materials: &[&texture],
            render_distance: data["renderDistance"].as_f64(),
        };
        assert_eq!(data["materials"], serde_json::json!(["aqua/sand"]));
        ctx.eval::<(), _>("const r=__RunePixel3D.raycaster;r.resize(80,50,1);r.config.world=__RunePixel3D.app.state.world;r.config.map.sky=null;").unwrap();
        let original = &data["camera"];
        for (x, y, z, angle, pitch) in [
            (original["x"].as_f64().unwrap(), original["y"].as_f64().unwrap(),
             original["z"].as_f64().unwrap(), original["angle"].as_f64().unwrap(),
             original["pitch"].as_f64().unwrap()),
            (-4.0, 20.0, 8.0, 0.0, -20.0),
            (20.0, 20.0, 5.0, 123.0, 12.0),
        ] {
            let mut native = vec![0; 80 * 50];
            let mut native_depth = vec![0.0; 80 * 50];
            render_dense(&world, &VoxelCamera { x, y, z, angle, pitch }, 58.0, 80, 50, &mut native, &mut native_depth).unwrap();
            let result: String = ctx.eval(format!(
                "r.render({{x:{x},y:{y},z:{z},angle:{angle},pitch:{pitch}}});JSON.stringify({{pixels:Array.from(r.buffer),depth:Array.from(r.pixelDepth)}})"
            )).unwrap();
            let shared: serde_json::Value = serde_json::from_str(&result).unwrap();
            for (i, (&color, &depth)) in native.iter().zip(&native_depth).enumerate() {
                assert_eq!(color as u64, shared["pixels"][i].as_u64().unwrap(), "aquarium terrain color pixel {i}, camera ({x},{y},{z}), angle {angle}, pitch {pitch}");
                match shared["depth"][i].as_f64() {
                    Some(expected) => assert!((depth - expected).abs() < 1e-10, "aquarium terrain depth pixel {i}: {depth} vs {expected}"),
                    None => assert!(depth.is_infinite(), "expected infinite aquarium depth at pixel {i}"),
                }
            }
        }
    });
}

#[test]
fn aquarium_terrain_and_sky_match_shared_renderer() {
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
            const w=__RunePixel3D.app.state.world;
            return JSON.stringify({width:w.width,height:w.height,depth:w.depth,cells:Array.from(w.cells),renderDistance:w.renderDistance});
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
        let sky: Sky = serde_json::from_value(game.config["map"]["sky"].clone()).unwrap();
        assert!(sky.below.is_some(), "fixture must exercise the lower sky");
        ctx.eval::<(), _>("const r=__RunePixel3D.raycaster;r.resize(80,50,1);r.config.world=__RunePixel3D.app.state.world;").unwrap();
        for (x, y, z, angle, pitch, time) in [
            (-4.0, 20.0, 8.0, 0.0, -20.0, 0.0),
            (20.0, 20.0, 5.0, 123.0, 12.0, 17.5),
            (45.0, 22.0, 25.0, 225.0, -35.0, 123.0),
            (20.0, 20.0, 5.0, 90.0, 0.0, 5.0),
        ] {
            let mut color = vec![0; 80 * 50];
            let mut depth = vec![0.0; 80 * 50];
            let camera = VoxelCamera { x, y, z, angle, pitch };
            render_dense_with_sky(&world, &camera, 58.0, 80, 50, &mut color, &mut depth, Some(&sky), time).unwrap();
            let result: String = ctx.eval(format!(
                "r.render({{x:{x},y:{y},z:{z},angle:{angle},pitch:{pitch}}},[],undefined,0,undefined,[],{time});JSON.stringify({{pixels:Array.from(r.buffer),depth:Array.from(r.pixelDepth)}})"
            )).unwrap();
            let shared: serde_json::Value = serde_json::from_str(&result).unwrap();
            for (i, (&pixel, &distance)) in color.iter().zip(&depth).enumerate() {
                assert_eq!(pixel as u64, shared["pixels"][i].as_u64().unwrap(), "sky pixel {i}, camera ({x},{y},{z}), angle {angle}, pitch {pitch}, time {time}");
                match shared["depth"][i].as_f64() {
                    Some(expected) => assert!((distance - expected).abs() < 1e-10, "sky depth pixel {i}: {distance} vs {expected}"),
                    None => assert!(distance.is_infinite(), "expected infinite depth at pixel {i}"),
                }
            }
        }
    });
}

#[test]
#[should_panic(expected = "framebuffer dimensions differ")]
fn comparator_rejects_different_frame_sizes() {
    compare_frames(&[0; 4], &[0; 8]);
}

#[test]
fn vect_breach_fixed_eye_frames_match() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/vect_breach/vect_breach.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    let mut raster = Rasterizer3D::new(
        game.width,
        game.height,
        66.0,
        serde_json::from_value::<BTreeMap<String, Texture>>(game.config["textures"].clone())
            .unwrap()
            .into_values()
            .collect(),
        serde_json::from_value::<HashMap<String, Sprite>>(game.config["sprites"].clone()).unwrap(),
        serde_json::from_value::<MapData>(game.config["map"].clone()).unwrap(),
    );
    raster.models = serde_json::from_value(game.config["models"].clone()).unwrap();

    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        ctx.eval::<(), _>("__RunePixel3D.start()").unwrap();
        assert!(!ctx.eval::<bool, _>("__RunePixel3D.usesSharedRenderer").unwrap(), "fixture requires the native path");
        for (angle, message) in [(0.0, false), (37.0, false), (90.0, false), (227.0, false), (-37.0, false), (397.0, false), (0.0, true)] {
            ctx.eval::<(), _>(format!("__RunePixel3D.app.state.player.angle = {angle}")).unwrap();
            if message {
                ctx.eval::<(), _>("__RunePixel3D.app.state.message = 'ALERT'").unwrap();
            }
            let json: String = ctx.eval("JSON.stringify(__RunePixel3D.renderState())").unwrap();
            let state: RenderState = serde_json::from_str(&json).unwrap();
            if message {
                assert_eq!(state.message.as_deref(), Some("ALERT"));
            }
            let frame: rquickjs::TypedArray<u32> = ctx.eval("__RunePixel3D.frame()").unwrap();
            let shared = unsafe { frame.as_bytes() }.unwrap().to_vec();
            let mut native = vec![0; game.width * game.height * 4];
            raster.render(&state, &mut native);
            let (different, max_difference) = compare_frames(&native, &shared);
            assert_eq!(different, 0,
                "fixed-eye angle {angle}, message {message}: {different}/{} differing pixels, max channel difference {max_difference}",
                game.width * game.height);
        }

    });
}

#[test]
fn unsupported_camera_and_voxel_world_keep_shared_renderer() {
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    for (path, setup) in [
        (
            "examples/games/vect_breach/vect_breach.rune",
            "__RunePixel3D.start(); __RunePixel3D.app.state.player.pitch = 15;",
        ),
        ("examples/games/idle_aquarium/idle_aquarium.rune", ""),
    ] {
        let doc = load_rune_document_from_path(Path::new(path)).unwrap();
        let game = pixel3d::compile(&doc).unwrap();
        let context = rquickjs::Context::full(&runtime).unwrap();
        context.with(|ctx| {
            ctx.eval::<(), _>(game.script.as_str()).unwrap();
            ctx.eval::<(), _>(setup).unwrap();
            assert!(
                ctx.eval::<bool, _>("__RunePixel3D.usesSharedRenderer")
                    .unwrap(),
                "{path} must not silently use the incomplete native renderer"
            );
        });
    }
}

#[test]
fn oriented_models_match_voxel_scene_color_and_depth() {
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
        pixels: vec![0xffaabbcc],
    };
    let mut cells = vec![0; 8 * 8 * 5];
    for y in 0..8 {
        for x in 0..8 {
            cells[y * 8 + x] = 1;
        }
    }

    let world = VoxelWorld {
        width: 8,
        height: 8,
        depth: 5,
        cells: &cells,
        materials: &[&texture],
        render_distance: None,
    };
    context.with(|ctx| {
            ctx.eval::<(), _>(game.script.as_str()).unwrap();
            let config = serde_json::json!({"width":8,"height":8,"depth":5,"materials":["test"],"cells":cells});
            ctx.eval::<(), _>(format!(
                "const r=__RunePixel3D.raycaster;r.resize(64,40,1);r.fov=58;r.config.map.sky=null;r.config.world={config};r.config.textures.test={};",
                serde_json::to_string(&texture).unwrap()
            )).unwrap();
            for shape in ["box", "sphere", "cylinder", "ramp"] {
                let model_json = serde_json::json!({"blocks":[{"shape":shape,"from":[-0.5,-0.5,0],"size":[1,1,1],"color":0xff80a0ffu32}]});
                let model: BlockModel = serde_json::from_value(model_json.clone()).unwrap();
                ctx.eval::<(), _>(format!("r.config.models.test={model_json}")).unwrap();
                for (cam_pitch, thing_pitch, thing_angle, dissolve) in [(0.0,0.0,0.0,0.0),(-20.0,35.0,45.0,0.0),(18.0,-45.0,90.0,0.35)] {
                    let camera = VoxelCamera { x: 2.5, y: 3.5, z: 1.0, angle: 0.0, pitch: cam_pitch };
                    let camera2 = Camera3D { x: camera.x, y: camera.y, angle: camera.angle };
                    let instance_json = serde_json::json!({"x":4.5,"y":3.5,"z":1.0,"model":"test","angle":thing_angle,"pitch":thing_pitch,"dissolve":dissolve});
                    let instance: Thing3D = serde_json::from_value(instance_json.clone()).unwrap();
                    let mut color = vec![0; 64 * 40];
                    let mut depth = vec![0.0; 64 * 40];
                    render_dense(&world, &camera, 58.0, 64, 40, &mut color, &mut depth).unwrap();
                    render_model_oriented(&model, &instance, &camera2, camera.z + 1.25, cam_pitch, thing_pitch, [1.0,0.0],
                        (58.0_f64.to_radians()/2.0).tan(), 64, 40, &mut color, &mut depth);
                    let result: String = ctx.eval(format!(
                        "r.render({{x:2.5,y:3.5,z:1,angle:0,pitch:{cam_pitch}}},[{instance_json}]);JSON.stringify({{pixels:Array.from(r.buffer),depth:Array.from(r.pixelDepth)}})"
                    )).unwrap();
                    let shared: serde_json::Value = serde_json::from_str(&result).unwrap();
                    for (i, (&pixel, &distance)) in color.iter().zip(&depth).enumerate() {
                        assert_eq!(pixel as u64, shared["pixels"][i].as_u64().unwrap(), "{shape} cam pitch {cam_pitch} model pitch {thing_pitch}, pixel {i}");
                        match shared["depth"][i].as_f64() {
                            Some(expected) => assert!((distance - expected).abs() < 1e-10, "{shape}, pixel {i}, depth {distance} vs {expected}"),
                            None => assert!(distance.is_infinite(), "{shape}, pixel {i} expected infinite depth"),
                        }
                    }
                }
            }
        });
}

#[test]
fn aquarium_models_compose_over_native_terrain_and_sky() {
    let doc =
        load_rune_document_from_path(Path::new("examples/games/idle_aquarium/idle_aquarium.rune"))
            .unwrap();
    let game = pixel3d::compile(&doc).unwrap();
    let runtime = rquickjs::Runtime::new().unwrap();
    runtime.set_memory_limit(128 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).unwrap();
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str()).unwrap();
        let mut previous_things = None;
        for ticks in [0, 30] {
        if ticks != 0 {
            ctx.eval::<(), _>("for (let i=0;i<30;i++) __RunePixel3D.step({})").unwrap();
        }
        let json: String = ctx.eval(r#"(() => {
            const g=__RunePixel3D,w=g.app.state.world,s=g.renderState();
            return JSON.stringify({width:w.width,height:w.height,depth:w.depth,cells:Array.from(w.cells),
                renderDistance:w.renderDistance,camera:s.camera,lights:s.lights,time:s.time,
                things:s.things.filter(t=>t.model && t.visible !== false)});
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
        let sky: Sky = serde_json::from_value(game.config["map"]["sky"].clone()).unwrap();
        let c = &data["camera"];
        let camera = VoxelCamera {
            x: c["x"].as_f64().unwrap(), y: c["y"].as_f64().unwrap(), z: c["z"].as_f64().unwrap(),
            angle: c["angle"].as_f64().unwrap(), pitch: c["pitch"].as_f64().unwrap(),
        };
        let camera2 = Camera3D { x: camera.x, y: camera.y, angle: camera.angle };
        let angle = camera.angle * std::f64::consts::PI / 180.0;
        let mut color = vec![0; 80 * 50];
        let mut depth = vec![0.0; 80 * 50];
        let time = data["time"].as_f64().unwrap();
        render_dense_with_sky(&world, &camera, 58.0, 80, 50, &mut color, &mut depth, Some(&sky), time).unwrap();
        let terrain = color.clone();
        let things = data["things"].as_array().unwrap();
        assert!(things.len() >= 20, "fixture must contain aquarium models");
        if let Some(previous) = &previous_things {
            assert_ne!(previous, things, "simulation must change model state");
        }
        previous_things = Some(things.clone());
        for value in things {
            let instance: Thing3D = serde_json::from_value(value.clone()).unwrap();
            let name = instance.model.as_ref().unwrap();
            let model: BlockModel = serde_json::from_value(game.config["models"][name].clone()).unwrap();
            render_model_oriented(&model, &instance, &camera2, camera.z + 1.25, camera.pitch,
                value["pitch"].as_f64().unwrap_or(0.0), [angle.cos(), angle.sin()],
                (58.0_f64 * std::f64::consts::PI / 360.0).tan(), 80, 50, &mut color, &mut depth);
        }
        assert_ne!(terrain, color, "fixture must show actual aquarium models");
        let lights: Vec<PointLight> = serde_json::from_value(data["lights"].clone()).unwrap();
        assert!(!lights.is_empty(), "fixture must include aquarium lights");
        let unlit = color.clone();
        light_voxel_frame(&lights, &mut color, &depth, 80, 50, &camera, 58.0).unwrap();
        assert_ne!(unlit, color, "fixture must visibly exercise lighting");
        let result: String = ctx.eval(format!(
            "(() => {{ const r=__RunePixel3D.raycaster;r.resize(80,50,1);r.config.world=__RunePixel3D.app.state.world;r.render({},{},undefined,0,undefined,[],{time},undefined,[],{});return JSON.stringify({{pixels:Array.from(r.buffer),depth:Array.from(r.pixelDepth)}}); }})()",
            data["camera"], data["things"], data["lights"]
        )).unwrap();
        let shared: serde_json::Value = serde_json::from_str(&result).unwrap();
        for (i, (&pixel, &distance)) in color.iter().zip(&depth).enumerate() {
            assert_eq!(pixel as u64, shared["pixels"][i].as_u64().unwrap(), "aquarium model pixel {i}");
            match shared["depth"][i].as_f64() {
                Some(expected) => assert!((distance - expected).abs() < 1e-10, "aquarium model depth pixel {i}: {distance} vs {expected}"),
                None => assert!(distance.is_infinite(), "expected infinite depth at pixel {i}"),
            }
        }
        }
    });
}
