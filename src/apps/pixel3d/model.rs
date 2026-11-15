use super::raster::{Camera3D, Thing3D};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Block {
    pub from: [f64; 3],
    pub size: [f64; 3],
    pub color: u32,
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
    let [dir_x, dir_y] = direction;
    let scale = instance.scale.unwrap_or(1.0);
    let dissolve = instance.dissolve.unwrap_or(0.0);
    assert!(dissolve.is_finite() && (0.0..=1.0).contains(&dissolve), "Model dissolve must be between 0 and 1");
    assert!(scale.is_finite() && scale > 0.0, "Model scale must be finite and positive");
    assert!([instance.x, instance.y, instance.z.unwrap_or(0.0), instance.angle.unwrap_or(0.0)]
        .iter().all(|n| n.is_finite()), "Model position and angle must be finite");
    if dissolve == 1.0 { return; }
    let angle = instance.angle.unwrap_or(0.0).to_radians();
    let c = angle.cos();
    let s = angle.sin();
    let ox = camera.x - instance.x;
    let oy = camera.y - instance.y;
    let z_offset = instance.z.unwrap_or(0.0);
    let origin = [(ox * c + oy * s) / scale, (-ox * s + oy * c) / scale, (0.5 - z_offset) / scale];
    for block in &model.blocks {
        let max = std::array::from_fn::<_, 3, _>(|i| block.from[i] + block.size[i]);
        let (mut left, mut right, mut top, mut bottom) = (width as f64, 0.0_f64, height as f64, 0.0_f64);
        let mut clipped = false;
        for corner in 0..8 {
            let lx = if corner & 1 != 0 { max[0] } else { block.from[0] } * scale;
            let ly = if corner & 2 != 0 { max[1] } else { block.from[1] } * scale;
            let z = if corner & 4 != 0 { max[2] } else { block.from[2] } * scale + z_offset;
            let x = instance.x + lx * c - ly * s - camera.x;
            let y = instance.y + lx * s + ly * c - camera.y;
            let d = x * dir_x + y * dir_y;
            if d <= 0.001 {
                clipped = true;
                continue;
            }
            let sx = width as f64 / 2.0 * (1.0 + (-x * dir_y + y * dir_x) / (d * fov_scale));
            let sy = (height / 2) as f64 - (z - 0.5) * height as f64 / d;
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
            let rx = dir_x - dir_y * fov_scale * cx;
            let ry = dir_y + dir_x * fov_scale * cx;
            for y in y0..y1 {
                if dissolve > 0.0 && fragment_noise(x, y) < dissolve {
                    continue;
                }
                let ray = [(rx * c + ry * s) / scale, (-rx * s + ry * c) / scale,
                    ((height / 2) as f64 - y as f64 - 0.5) / (height as f64 * scale)];
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
                let index = y * width + x;
                let hit = if near > 0.001 { near } else { face = exit_face; far };
                if valid && far >= near && hit > 0.001 && hit < depth[index] {
                    depth[index] = hit;
                    buffer[index] = shade(block.color, if face == 2 { 1.0 } else if face == 0 { 0.8 } else { 0.65 });
                }
            }
        }
    }
}
