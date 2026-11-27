//! Experimental CPU point-light pass for voxel scenes.
#![allow(dead_code)]
use super::voxel::VoxelCamera;
use anyhow::{ensure, Result};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct PointLight {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub color: u32,
    pub radius: f64,
    pub intensity: f64,
}

pub fn light_voxel_frame(
    lights: &[PointLight],
    buffer: &mut [u32],
    depth: &[f64],
    width: usize,
    height: usize,
    camera: &VoxelCamera,
    fov: f64,
) -> Result<()> {
    ensure!(
        width > 0
            && height > 0
            && width.checked_mul(height) == Some(buffer.len())
            && buffer.len() == depth.len(),
        "Invalid lighting framebuffer dimensions"
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
            && camera.pitch.abs() <= 85.0
            && fov > 0.0
            && fov < 180.0,
        "Invalid lighting camera"
    );
    ensure!(
        lights.len() <= 8
            && lights.iter().all(|l| [l.x, l.y, l.z, l.radius, l.intensity]
                .iter()
                .all(|v| v.is_finite())
                && [l.x, l.y, l.z].iter().all(|v| v.abs() <= 1e12)
                && l.radius > 0.0
                && l.radius <= 64.0
                && (0.0..=1.0).contains(&l.intensity)
                && l.color <= 0xffffff),
        "Invalid point light"
    );
    ensure!(
        [camera.x, camera.y, camera.z]
            .iter()
            .all(|v| v.abs() <= 1e12),
        "Lighting camera exceeds experimental renderer bounds"
    );
    let angle = camera.angle * std::f64::consts::PI / 180.0;
    ensure!(
        angle.is_finite() && (camera.z + 1.25).is_finite(),
        "Invalid lighting camera"
    );
    let (dir_y, dir_x) = angle.sin_cos();
    let (sp, cp) = (camera.pitch * std::f64::consts::PI / 180.0).sin_cos();
    let scale = (fov * std::f64::consts::PI / 360.0).tan();
    let row_origin = height as f64 / 2.0;
    let column_step = 2.0 * scale / width as f64;
    for light in lights {
        if light.intensity <= 0.0 {
            continue;
        }
        let dx = light.x - camera.x;
        let dy = light.y - camera.y;
        let dz = light.z - (camera.z + 1.25);
        let heading = dx * dir_x + dy * dir_y;
        let forward = heading * cp + dz * sp;
        let up = dz * cp - heading * sp;
        let side = -dx * dir_y + dy * dir_x;
        let near = forward - light.radius;
        let far = forward + light.radius;
        if far <= 0.0 {
            continue;
        }
        let (mut left, mut right, mut top, mut bottom) = (0, width, 0, height);
        if near > 0.0 {
            let x_min = (side - light.radius) / if side - light.radius < 0.0 { near } else { far };
            let x_max = (side + light.radius) / if side + light.radius > 0.0 { near } else { far };
            let y_min = (up - light.radius) / if up - light.radius < 0.0 { near } else { far };
            let y_max = (up + light.radius) / if up + light.radius > 0.0 { near } else { far };
            left = ((x_min / scale + 1.0) * width as f64 / 2.0)
                .floor()
                .max(0.0)
                .min(width as f64) as usize;
            right = (((x_max / scale + 1.0) * width as f64 / 2.0).ceil() + 1.0)
                .max(0.0)
                .min(width as f64) as usize;
            top = (row_origin - y_max * height as f64 - 0.5)
                .floor()
                .max(0.0)
                .min(height as f64) as usize;
            bottom = ((row_origin - y_min * height as f64 - 0.5).ceil() + 1.0)
                .max(0.0)
                .min(height as f64) as usize;
        }
        let radius_squared = light.radius * light.radius;
        let red = (light.color >> 16) as f64 * light.intensity;
        let green = ((light.color >> 8) & 255) as f64 * light.intensity;
        let blue = (light.color & 255) as f64 * light.intensity;
        for y in top..bottom {
            let ray_up = (row_origin - y as f64 - 0.5) / height as f64;
            for x in left..right {
                let i = y * width + x;
                let distance = depth[i];
                if !distance.is_finite() || distance < near || distance > far {
                    continue;
                }
                let at_side = distance * (x as f64 * column_step - scale) - side;
                let at_up = distance * ray_up - up;
                let at_forward = distance - forward;
                let distance_squared = at_side * at_side + at_up * at_up + at_forward * at_forward;
                if distance_squared >= radius_squared {
                    continue;
                }
                let edge = 1.0 - distance_squared / radius_squared;
                let amount = edge * edge;
                let c = buffer[i];
                let r = ((c & 255) as f64 + red * amount).min(255.0) as u32;
                let g = (((c >> 8) & 255) as f64 + green * amount).min(255.0) as u32;
                let b = (((c >> 16) & 255) as f64 + blue * amount).min(255.0) as u32;
                buffer[i] = 0xff000000 | b << 16 | g << 8 | r;
            }
        }
    }
    Ok(())
}
