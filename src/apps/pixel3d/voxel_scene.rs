//! Experimental enhanced voxel world-frame composition, not a complete game renderer.
#![allow(dead_code)]

use super::{
    enhanced_lighting::{finish_voxel_lighting, EmissionBuffer, GlassPane, ShadowCaster},
    lighting::PointLight,
    model::{render_voxel_model_enhanced, BlockModel},
    raster::{Sky, Thing3D},
    voxel::{render_dense_with_sky, VoxelCamera, VoxelWorld},
};
use anyhow::{ensure, Context, Result};

/// Only ordinary model instances are accepted. Callers must reject unsupported
/// scene features (including tethers, poses, titles, backdrops and overlays)
/// before constructing this deliberately narrow contract.
pub struct VoxelSceneModel<'a> {
    pub instance: &'a Thing3D,
    pub model: &'a BlockModel,
    pub pitch: f64,
    pub glass: Option<[f64; 2]>,
    pub contact_shadow: Option<f64>,
}

pub struct EnhancedVoxelScene<'a> {
    pub world: &'a VoxelWorld<'a>,
    pub camera: &'a VoxelCamera,
    pub fov: f64,
    pub sky: Option<&'a Sky>,
    pub time: f64,
    pub models: &'a [VoxelSceneModel<'a>],
    pub lights: &'a [PointLight],
}

#[derive(Debug)]
pub struct WorldFrame {
    pub color: Vec<u32>,
    pub depth: Vec<f64>,
}

/// Render terrain, ordinary models and enhanced lighting in shared draw order.
/// HUD and other overlays are separate. Returns no partial frame on failure.
pub fn render_enhanced_voxel_scene(
    scene: &EnhancedVoxelScene<'_>,
    width: usize,
    height: usize,
) -> Result<WorldFrame> {
    let count = width
        .checked_mul(height)
        .context("Framebuffer size overflow")?;
    ensure!(width > 0 && height > 0, "Invalid framebuffer dimensions");
    let mut color = vec![0; count];
    let mut depth = vec![0.0; count];
    render_dense_with_sky(
        scene.world,
        scene.camera,
        scene.fov,
        width,
        height,
        &mut color,
        &mut depth,
        scene.sky,
        scene.time,
    )?;
    let mut emission = EmissionBuffer::new(width, height)?;
    let mut panes = Vec::new();
    let mut casters = Vec::new();
    for (index, item) in scene.models.iter().enumerate() {
        let thing = item.instance;
        if thing.visible == Some(false) {
            continue;
        }
        ensure!(
            thing.sprite.is_empty(),
            "Model {index}: sprites are unsupported"
        );
        ensure!(thing.model.is_some(), "Model {index}: missing model name");
        ensure!(
            item.model.blocks.iter().all(|block| {
                block
                    .from
                    .iter()
                    .chain(block.size.iter())
                    .all(|n| n.is_finite() && n.abs() <= 1e12)
                    && block.size.iter().all(|&n| n > 0.0)
            }),
            "Model {index}: invalid block geometry"
        );
        let scale = thing.scale.unwrap_or(1.0);
        let dissolve = thing.dissolve.unwrap_or(0.0);
        if let Some(size) = item.glass {
            if dissolve < 1.0 {
                panes.push(GlassPane {
                    x: thing.x,
                    y: thing.y,
                    z: thing.z.unwrap_or(0.0),
                    angle: thing.angle.unwrap_or(0.0),
                    pitch: item.pitch,
                    scale,
                    size,
                });
            }
        }
        if let Some(radius) = item.contact_shadow {
            casters.push(ShadowCaster {
                x: thing.x,
                y: thing.y,
                z: thing.z,
                radius,
                scale,
                dissolve,
                visible: true,
            });
        }
        render_voxel_model_enhanced(
            item.model,
            thing,
            scene.camera,
            item.pitch,
            scene.fov,
            width,
            height,
            &mut color,
            &mut depth,
            &mut emission,
            scene.sky.map(|sky| sky.horizon),
        )
        .with_context(|| format!("Model {index}: cannot render"))?;
    }
    finish_voxel_lighting(
        &mut color,
        &depth,
        width,
        height,
        scene.camera,
        scene.fov,
        scene.world,
        scene.lights,
        &panes,
        &casters,
        scene.sky.map(|sky| sky.horizon),
        &emission.samples(),
    )?;
    Ok(WorldFrame { color, depth })
}
