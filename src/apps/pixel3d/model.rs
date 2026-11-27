use super::raster::{Camera3D, Thing3D};
use super::enhanced_lighting::{blend, EmissionBuffer};
use super::voxel::VoxelCamera;
use anyhow::{ensure, Result};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModelShape {
    #[default]
    Box,
    Sphere,
    Cylinder,
    Ramp,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Block {
    pub from: [f64; 3],
    pub size: [f64; 3],
    pub color: u32,
    #[serde(default)]
    pub shape: ModelShape,
    #[serde(default)]
    pub emissive: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BlockModel {
    pub blocks: Vec<Block>,
}

fn shade(color: u32, factor: f64) -> u32 {
    let mut result = 0xff000000;
    for shift in [0, 8, 16] {
        result |= ((((color >> shift) & 255) as f64 * factor).floor() as u32) << shift;
    }
    result
}

fn fragment_noise(x: usize, y: usize) -> f64 {
    let hash = (x as u32 / 2).wrapping_mul(73856093) ^ (y as u32 / 2).wrapping_mul(19349663);
    (hash ^ (hash >> 13)).wrapping_mul(1274126177) as f64 / 4294967296.0
}

pub fn render_model(
    model: &BlockModel, instance: &Thing3D, camera: &Camera3D,
    direction: [f64; 2], fov_scale: f64, width: usize, height: usize,
    buffer: &mut [u32], depth: &mut [f64],
) {
    render_model_oriented(model, instance, camera, 0.5, 0.0, 0.0, direction, fov_scale, width, height, buffer, depth);
}

/// Render a model with a pitched camera and a local-Y instance pitch.
pub fn render_model_oriented(
    model: &BlockModel, instance: &Thing3D, camera: &Camera3D,
    eye: f64, camera_pitch: f64, instance_pitch: f64,
    direction: [f64; 2], fov_scale: f64, width: usize, height: usize,
    buffer: &mut [u32], depth: &mut [f64],
) {
    render_model_inner(model, instance, camera, eye, camera_pitch, instance_pitch, direction, fov_scale, width, height, buffer, depth, None, None);
}

/// Render and record visible emissive fragments for later bloom composition.
#[allow(dead_code)]
pub fn render_model_with_emission(
    model: &BlockModel, instance: &Thing3D, camera: &Camera3D,
    eye: f64, camera_pitch: f64, instance_pitch: f64,
    direction: [f64; 2], fov_scale: f64, width: usize, height: usize,
    buffer: &mut [u32], depth: &mut [f64], emission: &mut EmissionBuffer,
) -> Result<()> {
    ensure!(width > 0 && height > 0 && width.checked_mul(height) == Some(buffer.len())
        && buffer.len() == depth.len() && emission.matches(width, height), "Invalid model emission framebuffer");
    render_model_inner(model, instance, camera, eye, camera_pitch, instance_pitch, direction, fov_scale, width, height, buffer, depth, Some(emission), None);
    Ok(())
}

/// Render an enhanced voxel-world model without a side backdrop, including skyline haze.
#[allow(dead_code)]
pub fn render_voxel_model_enhanced(
    model: &BlockModel, instance: &Thing3D, camera: &VoxelCamera, instance_pitch: f64,
    fov: f64, width: usize, height: usize, buffer: &mut [u32], depth: &mut [f64],
    emission: &mut EmissionBuffer, horizon: Option<u32>,
) -> Result<()> {
    ensure!(width > 0 && height > 0 && width.checked_mul(height) == Some(buffer.len())
        && buffer.len() == depth.len() && emission.matches(width, height), "Invalid model emission framebuffer");
    ensure!([camera.x, camera.y, camera.z, camera.angle, camera.pitch, fov, instance_pitch,
        instance.x, instance.y, instance.z.unwrap_or(0.0), instance.angle.unwrap_or(0.0),
        instance.scale.unwrap_or(1.0), instance.dissolve.unwrap_or(0.0)].iter().all(|n| n.is_finite())
        && camera.pitch.abs() <= 85.0 && fov > 0.0 && fov < 180.0
        && instance.scale.unwrap_or(1.0) > 0.0
        && [camera.x, camera.y, camera.z, instance.x, instance.y, instance.z.unwrap_or(0.0),
            instance.scale.unwrap_or(1.0)].iter().all(|n| n.abs() <= 1e12)
        && (0.0..=1.0).contains(&instance.dissolve.unwrap_or(0.0))
        && (camera.angle * std::f64::consts::PI).is_finite()
        && (instance_pitch * std::f64::consts::PI).is_finite()
        && (instance.angle.unwrap_or(0.0) * std::f64::consts::PI).is_finite(),
        "Invalid enhanced model camera or instance");
    let angle = camera.angle * std::f64::consts::PI / 180.0;
    let (dir_y, dir_x) = angle.sin_cos();
    let haze = if instance.y < 4.0 {
        (((instance.x - camera.x) * dir_x + (instance.y - camera.y) * dir_y - 11.0) * 0.025).clamp(0.0, 0.20)
    } else { 0.0 };
    let eye_camera = Camera3D { x: camera.x, y: camera.y, angle: camera.angle };
    render_model_inner(model, instance, &eye_camera, camera.z + 1.25, camera.pitch,
        instance_pitch, [dir_x, dir_y], (fov * std::f64::consts::PI / 360.0).tan(),
        width, height, buffer, depth, Some(emission), Some((haze, horizon.unwrap_or(0))));
    Ok(())
}

fn render_model_inner(
    model: &BlockModel, instance: &Thing3D, camera: &Camera3D,
    eye: f64, camera_pitch: f64, instance_pitch: f64,
    direction: [f64; 2], fov_scale: f64, width: usize, height: usize,
    buffer: &mut [u32], depth: &mut [f64], mut emission: Option<&mut EmissionBuffer>,
    haze: Option<(f64, u32)>,
) {
    let [dir_x, dir_y] = direction;
    let scale = instance.scale.unwrap_or(1.0);
    let dissolve = instance.dissolve.unwrap_or(0.0);
    assert!(dissolve.is_finite() && (0.0..=1.0).contains(&dissolve), "Model dissolve must be between 0 and 1");
    assert!(scale.is_finite() && scale > 0.0, "Model scale must be finite and positive");
    assert!([instance.x, instance.y, instance.z.unwrap_or(0.0), instance.angle.unwrap_or(0.0), eye, camera_pitch, instance_pitch]
        .iter().all(|n| n.is_finite()), "Model position and angle must be finite");
    if dissolve == 1.0 { return; }
    let angle = instance.angle.unwrap_or(0.0) * std::f64::consts::PI / 180.0;
    let c = angle.cos();
    let s = angle.sin();
    let pitch = camera_pitch * std::f64::consts::PI / 180.0;
    let (sp, cp) = pitch.sin_cos();
    let tilt = instance_pitch * std::f64::consts::PI / 180.0;
    let (ts, tc) = tilt.sin_cos();
    let ox = camera.x - instance.x;
    let oy = camera.y - instance.y;
    let z_offset = instance.z.unwrap_or(0.0);
    let mut origin = [(ox * c + oy * s) / scale, (-ox * s + oy * c) / scale, (eye - z_offset) / scale];
    if instance_pitch != 0.0 {
        let [x, _, z] = origin;
        origin[0] = x * tc - z * ts;
        origin[2] = x * ts + z * tc;
    }
    for block in &model.blocks {
        let color = match haze {
            Some((amount, tint)) if amount > 0.0 => blend(block.color, tint, amount),
            _ => block.color,
        };
        let max = std::array::from_fn::<_, 3, _>(|i| block.from[i] + block.size[i]);
        let (mut left, mut right, mut top, mut bottom) = (width as f64, 0.0_f64, height as f64, 0.0_f64);
        let mut clipped = false;
        for corner in 0..8 {
            let mut lx = if corner & 1 != 0 { max[0] } else { block.from[0] } * scale;
            let ly = if corner & 2 != 0 { max[1] } else { block.from[1] } * scale;
            let mut z = if corner & 4 != 0 { max[2] } else { block.from[2] } * scale;
            if instance_pitch != 0.0 {
                let old_x = lx;
                lx = old_x * tc + z * ts;
                z = -old_x * ts + z * tc;
            }
            z += z_offset;
            let x = instance.x + lx * c - ly * s - camera.x;
            let y = instance.y + lx * s + ly * c - camera.y;
            let forward = x * dir_x + y * dir_y;
            let d = forward * cp + (z - eye) * sp;
            if d <= 0.001 {
                clipped = true;
                continue;
            }
            let sx = width as f64 / 2.0 * (1.0 + (-x * dir_y + y * dir_x) / (d * fov_scale));
            let sy = (height / 2) as f64 - ((z - eye) * cp - forward * sp) * height as f64 / d;
            left = left.min(sx);
            right = right.max(sx);
            top = top.min(sy);
            bottom = bottom.max(sy);
        }
        let x0 = if clipped { 0 } else { left.floor().max(0.0).min(width as f64) as usize };
        let x1 = if clipped { width } else { right.ceil().max(0.0).min(width as f64) as usize };
        let y0 = if clipped { 0 } else { top.floor().max(0.0).min(height as f64) as usize };
        let y1 = if clipped { height } else { bottom.ceil().max(0.0).min(height as f64) as usize };
        for x in x0..x1 {
            let cx = 2.0 * x as f64 / width as f64 - 1.0;
            for y in y0..y1 {
                if dissolve > 0.0 && fragment_noise(x, y) < dissolve {
                    continue;
                }
                let v = ((height / 2) as f64 - y as f64 - 0.5) / height as f64;
                let rx = dir_x * cp - dir_y * fov_scale * cx - dir_x * sp * v;
                let ry = dir_y * cp + dir_x * fov_scale * cx - dir_y * sp * v;
                let mut ray = [(rx * c + ry * s) / scale, (-rx * s + ry * c) / scale, (sp + cp * v) / scale];
                if instance_pitch != 0.0 {
                    let [x, _, z] = ray;
                    ray[0] = x * tc - z * ts;
                    ray[2] = x * ts + z * tc;
                }
                let (mut near, mut far) = (f64::NEG_INFINITY, f64::INFINITY);
                let (mut face, mut exit_face) = (0, 0);
                let mut valid = true;
                for axis in 0..3 {
                    if ray[axis].abs() < 1e-12 {
                        if origin[axis] < block.from[axis] || origin[axis] > max[axis] { valid = false; }
                    } else {
                        let a = (block.from[axis] - origin[axis]) / ray[axis];
                        let b = (max[axis] - origin[axis]) / ray[axis];
                        let entry = a.min(b);
                        if entry > near { near = entry; face = axis; }
                        if a.max(b) < far { far = a.max(b); exit_face = axis; }
                    }
                }
                let mut curved_shade = None;
                if matches!(block.shape, ModelShape::Sphere | ModelShape::Cylinder) {
                    let sphere = block.shape == ModelShape::Sphere;
                    let center = std::array::from_fn::<_, 3, _>(|i| block.from[i]+block.size[i]/2.0);
                    let p = std::array::from_fn::<_, 3, _>(|i| origin[i]-center[i]);
                    let radius = block.size[0]/2.0;
                    let a = ray[0]*ray[0]+ray[1]*ray[1]+if sphere { ray[2]*ray[2] } else { 0.0 };
                    let b = p[0]*ray[0]+p[1]*ray[1]+if sphere { p[2]*ray[2] } else { 0.0 };
                    let k = p[0]*p[0]+p[1]*p[1]+if sphere { p[2]*p[2] } else { 0.0 }-radius*radius;
                    if a < 1e-20 { if k > 0.0 { valid = false; } }
                    else {
                        let discriminant = b*b-a*k;
                        if discriminant < 0.0 { valid = false; }
                        else {
                            let root = discriminant.sqrt();
                            near = near.max((-b-root)/a);
                            far = far.min((-b+root)/a);
                        }
                    }
                    let distance = if near > 0.001 { near } else { far };
                    let n = std::array::from_fn::<_, 3, _>(|i| p[i]+ray[i]*distance);
                    let cap = !sphere && (n[2].abs()-block.size[2]/2.0).abs() < 1e-7;
                    let length = if sphere { radius } else { n[0].hypot(n[1]) };
                    let light = if cap { if n[2] > 0.0 { 0.75 } else { -0.75 } }
                        else { (-0.4*n[0]-0.5*n[1]+if sphere { 0.75*n[2] } else { 0.0 })/length };
                    curved_shade = Some(0.55+0.45*light.max(0.0));
                } else if block.shape == ModelShape::Ramp {
                    let slope = block.size[2]/block.size[0];
                    let offset = origin[2]-block.from[2]-slope*(origin[0]-block.from[0]);
                    let rate = ray[2]-slope*ray[0];
                    if rate.abs() < 1e-12 { if offset > 0.0 { valid = false; } }
                    else if rate < 0.0 && -offset/rate > near { near = -offset/rate; face = 3; }
                    else if rate > 0.0 && -offset/rate < far { far = -offset/rate; exit_face = 3; }
                }
                let index = y * width + x;
                let hit = if near > 0.001 { near } else { face = exit_face; far };
                if valid && far >= near && hit > 0.001 && hit < depth[index] {
                    depth[index] = hit;
                    buffer[index] = shade(color, curved_shade.unwrap_or(if face == 3 { 0.9 } else if face == 2 { 1.0 } else if face == 0 { 0.8 } else { 0.65 }));
                    if block.emissive {
                        if let Some(emission) = emission.as_deref_mut() {
                            emission.record(x, y, index, hit, block.color);
                        }
                    }
                }
            }
        }
    }
}
