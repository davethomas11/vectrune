//! Experimental contact-shadow, glass, distance-haze and bloom primitives.
#![allow(dead_code)]
use super::lighting::{light_voxel_frame, PointLight};
use super::voxel::{VoxelCamera, VoxelWorld};
use anyhow::{ensure, Result};

const TILE: usize = 4;
const GLASS_TINT: u32 = 0xf0c981;
const FALLBACK_HAZE: u32 = 0x49383a;

pub struct GlassPane {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub angle: f64,
    pub pitch: f64,
    pub scale: f64,
    pub size: [f64; 2],
}

/// A visible model's ground-contact shadow parameters, in world coordinates.
pub struct ShadowCaster {
    pub x: f64,
    pub y: f64,
    pub z: Option<f64>,
    pub radius: f64,
    pub scale: f64,
    pub dissolve: f64,
    pub visible: bool,
}

/// Compose the supported voxel lighting passes in shared-renderer order.
///
/// The caller supplies scene-derived panes and casters in render order. This
/// does not draw terrain, models, HUD, backdrops, or other scene elements.
/// On error the framebuffer is left unchanged.
pub fn finish_voxel_lighting(
    buffer: &mut [u32],
    depth: &[f64],
    width: usize,
    height: usize,
    camera: &VoxelCamera,
    fov: f64,
    world: &VoxelWorld<'_>,
    lights: &[PointLight],
    panes: &[GlassPane],
    casters: &[ShadowCaster],
    horizon: Option<u32>,
    emission: &Emission<'_>,
) -> Result<()> {
    ensure!(
        width > 0
            && height > 0
            && width.checked_mul(height) == Some(buffer.len())
            && depth.len() == buffer.len(),
        "Invalid voxel lighting framebuffer"
    );
    let mut frame = buffer.to_vec();
    light_voxel_frame(lights, &mut frame, depth, width, height, camera, fov)?;
    apply_contact_shadows(
        &mut frame, depth, width, height, camera, fov, world, panes, casters,
    )?;
    apply_glass_and_haze(
        &mut frame, depth, width, height, camera, fov, panes, horizon,
    )?;
    apply_bloom(&mut frame, depth, width, height, emission)?;
    buffer.copy_from_slice(&frame);
    Ok(())
}

fn valid_pane(p: &GlassPane) -> bool {
    [
        p.x, p.y, p.z, p.angle, p.pitch, p.scale, p.size[0], p.size[1],
    ]
    .iter()
    .all(|v| v.is_finite())
        && [p.x, p.y, p.z, p.scale, p.size[0], p.size[1]]
            .iter()
            .all(|v| v.abs() <= 1e12)
        && p.scale > 0.0
        && p.size.iter().all(|&v| v > 0.0)
        && (p.angle * std::f64::consts::PI).is_finite()
        && (p.pitch * std::f64::consts::PI).is_finite()
}

/// Darken the supporting voxel floor or horizontal glass before glass, haze and bloom.
pub fn apply_contact_shadows(
    buffer: &mut [u32],
    depth: &[f64],
    width: usize,
    height: usize,
    camera: &VoxelCamera,
    fov: f64,
    world: &VoxelWorld<'_>,
    panes: &[GlassPane],
    casters: &[ShadowCaster],
) -> Result<()> {
    ensure!(
        width > 0
            && height > 0
            && width.checked_mul(height) == Some(buffer.len())
            && depth.len() == buffer.len(),
        "Invalid shadow framebuffer"
    );
    ensure!(
        [
            camera.x,
            camera.y,
            camera.z,
            camera.angle,
            camera.pitch,
            fov
        ]
        .iter()
        .all(|v| v.is_finite())
            && [camera.x, camera.y, camera.z]
                .iter()
                .all(|v| v.abs() <= 1e12)
            && (camera.angle * std::f64::consts::PI).is_finite()
            && camera.pitch.abs() <= 85.0
            && fov > 0.0
            && fov < 180.0,
        "Invalid shadow camera"
    );
    ensure!(
        world.width > 0
            && world.height > 0
            && world.depth > 0
            && world
                .width
                .checked_mul(world.height)
                .and_then(|v| v.checked_mul(world.depth))
                == Some(world.cells.len()),
        "Invalid shadow voxel world"
    );
    ensure!(panes.iter().all(valid_pane), "Invalid shadow glass pane");
    ensure!(
        casters.iter().all(|c| {
            [c.x, c.y, c.radius, c.scale, c.dissolve]
                .iter()
                .all(|v| v.is_finite())
                && [c.x, c.y, c.radius, c.scale]
                    .iter()
                    .all(|v| v.abs() <= 1e12)
                && c.z.is_none_or(|z| z.is_finite() && z.abs() <= 1e12)
                && c.radius > 0.0
                && c.scale > 0.0
                && (0.0..=1.0).contains(&c.dissolve)
                && (c.radius * c.scale * 0.77) > 0.0
        }),
        "Invalid shadow caster"
    );

    let angle = camera.angle * std::f64::consts::PI / 180.0;
    let (dir_y, dir_x) = angle.sin_cos();
    let (sp, cp) = (camera.pitch * std::f64::consts::PI / 180.0).sin_cos();
    let fov_scale = (fov * std::f64::consts::PI / 360.0).tan();
    let eye = camera.z + 1.25;
    for caster in casters {
        let Some(z) = caster.z else {
            continue;
        };
        if !caster.visible || caster.dissolve >= 1.0 {
            continue;
        }
        let mut floor = None;
        let mut on_glass = false;
        for pane in panes {
            let (s, c) = (pane.angle * std::f64::consts::PI / 180.0).sin_cos();
            let (ps, pc) = (pane.pitch * std::f64::consts::PI / 180.0).sin_cos();
            if ps.abs() > 0.01 || z < pane.z - 0.05 || z > pane.z + 1.65 {
                continue;
            }
            let dx = caster.x - pane.x;
            let dy = caster.y - pane.y;
            if (dx * (c * pc) + dy * (s * pc)).abs() <= pane.size[0] * pane.scale / 2.0
                && (-dx * s + dy * c).abs() <= pane.size[1] * pane.scale / 2.0
            {
                floor = Some(pane.z + 0.02);
                on_glass = true;
                break;
            }
        }
        if floor.is_none() {
            let x = caster.x.floor();
            let y = caster.y.floor();
            let below = (z - 0.05).floor();
            if x >= 0.0
                && x < world.width as f64
                && y >= 0.0
                && y < world.height as f64
                && below >= 0.0
            {
                for offset in 0..=2 {
                    let cell_z = below - offset as f64;
                    if cell_z < 0.0 {
                        break;
                    }
                    if cell_z < world.depth as f64 {
                        let index = (cell_z as usize * world.height + y as usize) * world.width
                            + x as usize;
                        if world.cells[index] != 0 {
                            floor = Some(cell_z + 1.0);
                            break;
                        }
                    }
                }
            }
        }
        let Some(floor) = floor else {
            continue;
        };
        let half_a = caster.radius * caster.scale;
        let half_b = half_a * 0.77;
        let strength = 0.33 * (1.0 - (z - floor) * 0.6).max(0.0) * (1.0 - caster.dissolve);
        for y in 0..height {
            let up = (height as f64 / 2.0 - y as f64 - 0.5) / height as f64;
            let rz = sp + cp * up;
            let distance = (floor - eye) / rz;
            if distance <= 0.10 || distance.is_nan() {
                continue;
            }
            let heading = cp - sp * up;
            for x in 0..width {
                let i = y * width + x;
                if if on_glass {
                    depth[i] < distance - 0.02
                } else {
                    (depth[i] - distance).abs() > 0.055
                } {
                    continue;
                }
                let side = (2.0 * x as f64 / width as f64 - 1.0) * fov_scale;
                let dx =
                    (camera.x - caster.x + distance * (dir_x * heading - dir_y * side)) / half_a;
                let dy =
                    (camera.y - caster.y + distance * (dir_y * heading + dir_x * side)) / half_b;
                let fade = 1.0 - dx * dx - dy * dy;
                if fade > 0.0 {
                    buffer[i] = blend(buffer[i], 0x10090b, fade * strength);
                }
            }
        }
    }
    Ok(())
}

struct Plane {
    position: [f64; 3],
    axis_a: [f64; 3],
    axis_b: [f64; 2],
    half_a: f64,
    half_b: f64,
    scale: f64,
}

pub(super) fn blend(color: u32, tint: u32, alpha: f64) -> u32 {
    let mut result = 0xff000000;
    for shift in [0, 8, 16] {
        let channel = ((color >> shift) & 255) as f64;
        let target = ((tint >> shift) & 255) as f64;
        result |= ((channel + (target - channel) * alpha) as u32) << shift;
    }
    result
}

pub struct Emission<'a> {
    pub pixels: &'a [usize],
    pub depths: &'a [f64],
    pub colors: &'a [u32],
}

/// Per-frame emissive samples. Reuse across models, then clear before the next frame.
pub struct EmissionBuffer {
    width: usize,
    height: usize,
    pixels: Vec<usize>,
    depths: Vec<f64>,
    colors: Vec<u32>,
}

impl EmissionBuffer {
    pub fn new(width: usize, height: usize) -> Result<Self> {
        ensure!(
            width > 0 && height > 0 && width.checked_mul(height).is_some(),
            "Invalid emission framebuffer"
        );
        let count = width
            .div_ceil(TILE)
            .checked_mul(height.div_ceil(TILE))
            .ok_or_else(|| anyhow::anyhow!("Emission tile dimensions overflow"))?;
        Ok(Self {
            width,
            height,
            pixels: vec![0; count],
            depths: vec![0.0; count],
            colors: vec![0; count],
        })
    }

    pub fn clear(&mut self) {
        self.colors.fill(0);
    }

    pub fn samples(&self) -> Emission<'_> {
        Emission {
            pixels: &self.pixels,
            depths: &self.depths,
            colors: &self.colors,
        }
    }

    pub(super) fn matches(&self, width: usize, height: usize) -> bool {
        self.width == width && self.height == height
    }

    pub(super) fn record(&mut self, x: usize, y: usize, pixel: usize, depth: f64, color: u32) {
        let tile = (y / TILE) * self.width.div_ceil(TILE) + x / TILE;
        if self.colors[tile] == 0 || depth < self.depths[tile] {
            self.pixels[tile] = pixel;
            self.depths[tile] = depth;
            self.colors[tile] = color & 0xffffff;
        }
    }
}

fn blur(source: &[u32], target: &mut [u32], width: usize, height: usize, horizontal: bool) {
    for y in 0..height {
        for x in 0..width {
            let i = y * width + x;
            let position = if horizontal { x } else { y };
            let length = if horizontal { width } else { height };
            let stride = if horizontal { 1 } else { width };
            let taps = [
                if position > 1 {
                    source[i - 2 * stride]
                } else {
                    0
                },
                if position > 0 { source[i - stride] } else { 0 },
                source[i],
                if position + 1 < length {
                    source[i + stride]
                } else {
                    0
                },
                if position + 2 < length {
                    source[i + 2 * stride]
                } else {
                    0
                },
            ];
            let weights = [1, 2, 4, 2, 1];
            let mut rb = 0u32;
            let mut green = 0u32;
            for (value, weight) in taps.into_iter().zip(weights) {
                rb += (value & 0xff00ff) * weight;
                green += ((value >> 8) & 255) * weight;
            }
            target[i] = (rb & 0xffff) / 10 | (green / 10) << 8 | ((rb >> 16) / 10) << 16;
        }
    }
}

fn mix_glow(a: u32, b: u32, weight: u32) -> u32 {
    let other = 4 - weight;
    (((a & 0xff00ff) * other + (b & 0xff00ff) * weight) >> 2 & 0xff00ff)
        | (((a & 0xff00) * other + (b & 0xff00) * weight) >> 2 & 0xff00)
}

/// Composite pre-recorded emissive tiles after glass and haze; depth hides occluded emitters.
pub fn apply_bloom(
    buffer: &mut [u32],
    depth: &[f64],
    width: usize,
    height: usize,
    emission: &Emission<'_>,
) -> Result<()> {
    ensure!(
        width > 0
            && height > 0
            && width.checked_mul(height) == Some(buffer.len())
            && buffer.len() == depth.len(),
        "Invalid bloom framebuffer"
    );
    let tile_width = width.div_ceil(TILE);
    let tile_height = height.div_ceil(TILE);
    let count = tile_width
        .checked_mul(tile_height)
        .ok_or_else(|| anyhow::anyhow!("Bloom tile dimensions overflow"))?;
    ensure!(
        emission.colors.len() == count
            && emission.pixels.len() == count
            && emission.depths.len() == count,
        "Invalid emission buffer dimensions"
    );
    ensure!(
        emission
            .colors
            .iter()
            .enumerate()
            .all(|(i, &color)| color <= 0xffffff
                && (color == 0
                    || (emission.pixels[i] < buffer.len() && emission.depths[i].is_finite()))),
        "Invalid emissive sample"
    );
    let mut visible = emission.colors.to_vec();
    for (i, color) in visible.iter_mut().enumerate() {
        if *color != 0 && depth[emission.pixels[i]] != emission.depths[i] {
            *color = 0;
        }
    }
    if visible.iter().all(|&color| color == 0) {
        return Ok(());
    }
    let mut scratch = vec![0; count];
    let mut glow = vec![0; count];
    blur(&visible, &mut scratch, tile_width, tile_height, true);
    blur(&scratch, &mut glow, tile_width, tile_height, false);
    for y in 0..height {
        let tile_row = (y / TILE) * tile_width;
        let next_row = (y / TILE + 1).min(tile_height - 1) * tile_width;
        for x in 0..width {
            let tile_x = x / TILE;
            let next_x = (tile_x + 1).min(tile_width - 1);
            let near = mix_glow(
                glow[tile_row + tile_x],
                glow[next_row + tile_x],
                (y % TILE) as u32,
            );
            let far = mix_glow(
                glow[tile_row + next_x],
                glow[next_row + next_x],
                (y % TILE) as u32,
            );
            let light = mix_glow(near, far, (x % TILE) as u32);
            if light == 0 {
                continue;
            }
            let i = y * width + x;
            let c = buffer[i];
            let r = ((c & 255) + (light & 255)).min(255);
            let g = (((c >> 8) & 255) + ((light >> 8) & 255)).min(255);
            let b = (((c >> 16) & 255) + (light >> 16)).min(255);
            buffer[i] = 0xff000000 | b << 16 | g << 8 | r;
        }
    }
    Ok(())
}

/// Applies the shared renderer's tiled glass tint and distance haze, without bloom or shadows.
pub fn apply_glass_and_haze(
    buffer: &mut [u32],
    depth: &[f64],
    width: usize,
    height: usize,
    camera: &VoxelCamera,
    fov: f64,
    panes: &[GlassPane],
    horizon: Option<u32>,
) -> Result<()> {
    ensure!(
        width > 0
            && height > 0
            && width.checked_mul(height) == Some(buffer.len())
            && buffer.len() == depth.len(),
        "Invalid enhanced lighting framebuffer"
    );
    ensure!(
        [
            camera.x,
            camera.y,
            camera.z,
            camera.angle,
            camera.pitch,
            fov
        ]
        .iter()
        .all(|v| v.is_finite())
            && [camera.x, camera.y, camera.z]
                .iter()
                .all(|v| v.abs() <= 1e12)
            && camera.pitch.abs() <= 85.0
            && fov > 0.0
            && fov < 180.0,
        "Invalid enhanced lighting camera"
    );
    ensure!(panes.iter().all(valid_pane), "Invalid glass pane");
    let angle = camera.angle * std::f64::consts::PI / 180.0;
    ensure!(angle.is_finite(), "Invalid enhanced lighting camera angle");
    let (dir_y, dir_x) = angle.sin_cos();
    let (sp, cp) = (camera.pitch * std::f64::consts::PI / 180.0).sin_cos();
    let scale = (fov * std::f64::consts::PI / 360.0).tan();
    let eye = camera.z + 1.25;
    let tile_width = width.div_ceil(TILE);
    let tile_height = height.div_ceil(TILE);
    let tiles = tile_width
        .checked_mul(tile_height)
        .ok_or_else(|| anyhow::anyhow!("Glass tile dimensions overflow"))?;
    let mut pane_depth = vec![f64::INFINITY; tiles];
    let mut pane_alpha = vec![0u8; tiles];
    for pane in panes {
        let (s, c) = (pane.angle * std::f64::consts::PI / 180.0).sin_cos();
        let (ps, pc) = (pane.pitch * std::f64::consts::PI / 180.0).sin_cos();
        let plane = Plane {
            position: [pane.x, pane.y, pane.z],
            axis_a: [c * pc, s * pc, -ps],
            axis_b: [-s, c],
            half_a: pane.size[0] * pane.scale / 2.0,
            half_b: pane.size[1] * pane.scale / 2.0,
            scale: pane.scale,
        };
        let [ax, ay, az] = plane.axis_a;
        let [bx, by] = plane.axis_b;
        let normal = [-az * by, az * bx, ax * by - ay * bx];
        let ox = camera.x - plane.position[0];
        let oy = camera.y - plane.position[1];
        let oz = eye - plane.position[2];
        let offset = -(ox * normal[0] + oy * normal[1] + oz * normal[2]);
        let start_a = ox * ax + oy * ay + oz * az;
        let start_b = ox * bx + oy * by;
        for y in 0..tile_height {
            let up = (height as f64 / 2.0 - (y * TILE + TILE / 2) as f64 - 0.5) / height as f64;
            let heading = cp - sp * up;
            let rz = sp + cp * up;
            for x in 0..tile_width {
                let side = (2.0 * (x * TILE + TILE / 2) as f64 / width as f64 - 1.0) * scale;
                let rx = dir_x * heading - dir_y * side;
                let ry = dir_y * heading + dir_x * side;
                let rate = rx * normal[0] + ry * normal[1] + rz * normal[2];
                let distance = offset / rate;
                let i = y * tile_width + x;
                if !(distance > 0.1 && distance < pane_depth[i]) {
                    continue;
                }
                let a = start_a + distance * (rx * ax + ry * ay + rz * az);
                let b = start_b + distance * (rx * bx + ry * by);
                let edge = (plane.half_a - a.abs()).min(plane.half_b - b.abs());
                if edge < 0.0 {
                    continue;
                }
                let grazing = (1.0 - rate.abs()).max(0.0);
                let rim = (1.0 - edge / (0.26 * plane.scale)).max(0.0);
                pane_depth[i] = distance;
                pane_alpha[i] =
                    (10.0 + 23.0 * grazing * grazing + (22.0 + 28.0 * grazing) * rim) as u8;
            }
        }
    }
    let haze =
        ((dir_x.abs() - 0.35) / 0.4).clamp(0.0, 1.0) * ((0.8 - sp.abs()) / 0.25).clamp(0.0, 1.0);
    for y in 0..height {
        for x in 0..width {
            let i = y * width + x;
            let tile = (y / TILE) * tile_width + x / TILE;
            let distance = depth[i];
            let mut pixel = buffer[i];
            if haze > 0.0 && distance > 22.0 && distance < f64::INFINITY {
                pixel = blend(
                    pixel,
                    horizon.unwrap_or(FALLBACK_HAZE),
                    haze * (0.30_f64).min((distance - 22.0) * 0.008),
                );
            }
            if pane_alpha[tile] != 0 && distance > pane_depth[tile] + 1e-5 {
                pixel = blend(pixel, GLASS_TINT, pane_alpha[tile] as f64 / 255.0);
            }
            buffer[i] = pixel;
        }
    }
    Ok(())
}
