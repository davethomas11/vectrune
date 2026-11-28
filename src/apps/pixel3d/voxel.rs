//! Experimental dense voxel terrain renderer. This is not a complete scene renderer.
#![allow(dead_code)]
use super::raster::{sky_pixel, Sky, Texture};
use anyhow::{bail, ensure, Result};

pub struct VoxelWorld<'a> {
    pub width: usize,
    pub height: usize,
    pub depth: usize,
    pub cells: &'a [u16],
    pub materials: &'a [&'a Texture],
    pub render_distance: Option<f64>,
}

pub struct VoxelCamera {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub angle: f64,
    pub pitch: f64,
}

#[derive(Debug, PartialEq)]
struct Hit {
    block: usize,
    distance: f64,
    face: usize,
}

struct ChunkOccupancy {
    dimensions: [usize; 3],
    occupied: Vec<bool>,
    bounds: Vec<[usize; 6]>,
}

impl ChunkOccupancy {
    // Rebuild per render so raw cell changes are reflected without a revision protocol.
    fn new(world: &VoxelWorld<'_>) -> Option<Self> {
        let dimensions = [
            world.width.div_ceil(4),
            world.height.div_ceil(4),
            world.depth.div_ceil(4),
        ];
        let mut occupied = vec![false; dimensions[0] * dimensions[1] * dimensions[2]];
        let mut bounds = vec![[usize::MAX, usize::MAX, usize::MAX, 0, 0, 0]; occupied.len()];
        let mut count = 0;
        for (i, &block) in world.cells.iter().enumerate() {
            if block == 0 {
                continue;
            }
            let x = i % world.width;
            let yz = i / world.width;
            let y = yz % world.height;
            let z = yz / world.height;
            let index = ((z / 4) * dimensions[1] + y / 4) * dimensions[0] + x / 4;
            if !occupied[index] {
                occupied[index] = true;
                count += 1;
            }
            let b = &mut bounds[index];
            b[0] = b[0].min(x);
            b[1] = b[1].min(y);
            b[2] = b[2].min(z);
            b[3] = b[3].max(x + 1);
            b[4] = b[4].max(y + 1);
            b[5] = b[5].max(z + 1);
        }
        (count * 10 < occupied.len() * 6).then_some(Self {
            dimensions,
            occupied,
            bounds,
        })
    }

    fn visible_tiles(
        &self,
        origin: [f64; 3],
        ca: f64,
        sa: f64,
        cp: f64,
        sp: f64,
        scale: f64,
        width: usize,
        height: usize,
    ) -> Option<Vec<bool>> {
        if self.occupied.iter().filter(|&&value| value).count() > 1024 {
            return None;
        }
        let tw = width.div_ceil(8);
        let th = height.div_ceil(8);
        let mut tiles = vec![false; tw * th];
        for (occupied, bounds) in self.occupied.iter().zip(&self.bounds) {
            if !occupied {
                continue;
            }
            let mut min_x = f64::INFINITY;
            let mut max_x = f64::NEG_INFINITY;
            let mut min_y = f64::INFINITY;
            let mut max_y = f64::NEG_INFINITY;
            let mut near = f64::INFINITY;
            let mut far = f64::NEG_INFINITY;
            let mut outside = 15u8;
            for corner in 0..8 {
                let x = bounds[if corner & 1 == 0 { 0 } else { 3 }] as f64 - origin[0];
                let y = bounds[if corner & 2 == 0 { 1 } else { 4 }] as f64 - origin[1];
                let z = bounds[if corner & 4 == 0 { 2 } else { 5 }] as f64 - origin[2];
                let heading = x * ca + y * sa;
                let forward = cp * heading + sp * z;
                let side = -sa * x + ca * y;
                let up = cp * z - sp * heading;
                near = near.min(forward);
                far = far.max(forward);
                outside &= u8::from(side < -scale * forward - 1e-7)
                    | (u8::from(side > scale * forward + 1e-7) << 1)
                    | (u8::from(up < -0.5 * forward - 1e-7) << 2)
                    | (u8::from(up > 0.5 * forward + 1e-7) << 3);
                if forward <= 1e-7 {
                    continue;
                }
                let px = (1.0 + side / (forward * scale)) * width as f64 / 2.0;
                let py = height as f64 / 2.0 - 0.5 - up / forward * height as f64;
                min_x = min_x.min(px);
                max_x = max_x.max(px);
                min_y = min_y.min(py);
                max_y = max_y.max(py);
            }
            if outside != 0 || far < -1e-7 {
                continue;
            }
            // Near-plane crossings can cover the screen, so do not cull them.
            if near <= 1e-7 {
                return None;
            }
            let left = (((min_x - 1.0) / 8.0).floor() as isize).max(0);
            let right = (((max_x + 1.0) / 8.0).floor() as isize).min(tw as isize - 1);
            let top = (((min_y - 1.0) / 8.0).floor() as isize).max(0);
            let bottom = (((max_y + 1.0) / 8.0).floor() as isize).min(th as isize - 1);
            if left <= right && top <= bottom {
                for row in top..=bottom {
                    tiles[row as usize * tw + left as usize..=row as usize * tw + right as usize]
                        .fill(true);
                }
            }
        }
        Some(tiles)
    }

    fn entry(
        &self,
        cell: [i64; 3],
        next: [f64; 3],
        delta: [f64; 3],
        step: [i64; 3],
        limit: f64,
    ) -> Option<f64> {
        let mut chunk = cell.map(|v| v / 4);
        let mut crossing = std::array::from_fn::<_, 3, _>(|axis| {
            if next[axis].is_finite() {
                next[axis]
                    + (if step[axis] > 0 {
                        3 - (cell[axis] & 3)
                    } else {
                        cell[axis] & 3
                    }) as f64
                        * delta[axis]
            } else {
                f64::INFINITY
            }
        });
        let mut entry = 0.0;
        loop {
            let index = (chunk[2] as usize * self.dimensions[1] + chunk[1] as usize)
                * self.dimensions[0]
                + chunk[0] as usize;
            if self.occupied[index] {
                return Some(entry);
            }
            let axis = if crossing[0] < crossing[1] && crossing[0] < crossing[2] {
                0
            } else if crossing[1] < crossing[2] {
                1
            } else {
                2
            };
            let distance = crossing[axis];
            if !distance.is_finite() || distance > limit {
                return None;
            }
            let tolerance = 1e-9 * distance.max(1.0);
            // Let the fine DDA resolve corner and near-corner crossings.
            if (0..3).any(|i| i != axis && crossing[i] - distance <= tolerance) {
                return Some(entry);
            }
            entry = distance;
            chunk[axis] += step[axis];
            if chunk[axis] < 0 || chunk[axis] >= self.dimensions[axis] as i64 {
                return None;
            }
            crossing[axis] += delta[axis] * 4.0;
        }
    }
}

fn trace(
    world: &VoxelWorld<'_>,
    chunks: Option<&ChunkOccupancy>,
    origin: [f64; 3],
    ray: [f64; 3],
    limit: f64,
    entry_face: usize,
) -> Option<Hit> {
    let dims = [world.width as i64, world.height as i64, world.depth as i64];
    let mut cell = origin.map(|v| v.floor() as i64);
    if (0..3).any(|axis| cell[axis] < 0 || cell[axis] >= dims[axis]) {
        return None;
    }
    let step = ray.map(|v| if v < 0.0 { -1 } else { 1 });
    let delta = ray.map(|v| (1.0 / v).abs());
    let mut next = std::array::from_fn::<_, 3, _>(|axis| {
        if ray[axis] == 0.0 {
            f64::INFINITY
        } else {
            let distance = if step[axis] < 0 {
                origin[axis] - cell[axis] as f64
            } else {
                cell[axis] as f64 + 1.0 - origin[axis]
            };
            distance * delta[axis]
        }
    });
    if let Some(chunks) = chunks {
        let entry = chunks.entry(cell, next, delta, step, limit)?;
        // Preserve repeated-addition rounding and the fine DDA's entry face.
        let before_entry = entry - 1e-9 * entry.max(1.0);
        for axis in 0..3 {
            while next[axis] < before_entry {
                cell[axis] += step[axis];
                next[axis] += delta[axis];
            }
        }
        if (0..3).any(|axis| cell[axis] < 0 || cell[axis] >= dims[axis]) {
            return None;
        }
    }
    let mut distance = 0.0;
    let mut face = entry_face;
    while distance <= limit {
        let index =
            (cell[2] as usize * world.height + cell[1] as usize) * world.width + cell[0] as usize;
        let block = world.cells[index] as usize;
        if block != 0 {
            return Some(Hit {
                block,
                distance,
                face,
            });
        }
        face = if next[0] < next[1] && next[0] < next[2] {
            0
        } else if next[1] < next[2] {
            1
        } else {
            2
        };
        distance = next[face];
        next[face] += delta[face];
        cell[face] += step[face];
        if cell[face] < 0 || cell[face] >= dims[face] {
            break;
        }
    }
    None
}

fn terrain_entry(origin: f64, direction: f64, end: f64) -> f64 {
    if origin == 0.0 && direction < 0.0 {
        return f64::INFINITY;
    }
    if origin <= 0.0 && direction > 0.0 {
        return -origin / direction;
    }
    if origin >= end && direction < 0.0 {
        return (end - origin) / direction;
    }
    if origin < 0.0 || origin >= end {
        f64::INFINITY
    } else {
        f64::NEG_INFINITY
    }
}

fn trace_from_outside(
    world: &VoxelWorld<'_>,
    chunks: Option<&ChunkOccupancy>,
    origin: [f64; 3],
    ray: [f64; 3],
    limit: f64,
) -> Option<Hit> {
    let dims = [world.width as f64, world.height as f64, world.depth as f64];
    let entry = std::array::from_fn::<_, 3, _>(|i| terrain_entry(origin[i], ray[i], dims[i]));
    let enter = entry[0].max(entry[1]).max(entry[2]);
    if enter > limit {
        return None;
    }
    if enter < 0.0 {
        return trace(world, chunks, origin, ray, limit, 2);
    }
    let exit = (0..3)
        .map(|i| {
            if ray[i] == 0.0 {
                f64::INFINITY
            } else {
                ((if ray[i] > 0.0 { dims[i] } else { 0.0 }) - origin[i]) / ray[i]
            }
        })
        .fold(f64::INFINITY, f64::min);
    if enter >= exit {
        return None;
    }
    let start = enter + 1e-7_f64.min((exit - enter) / 2.0);
    let face = if enter == entry[0] {
        0
    } else if enter == entry[1] {
        1
    } else {
        2
    };
    let mut hit = trace(
        world,
        chunks,
        std::array::from_fn(|i| origin[i] + ray[i] * start),
        ray,
        limit - start,
        face,
    )?;
    hit.distance += if hit.distance == 0.0 { enter } else { start };
    Some(hit)
}

fn texel(point: f64, size: usize) -> usize {
    let wrapped = point - point.trunc() + 1.0;
    ((if wrapped >= 1.0 {
        wrapped - 1.0
    } else {
        wrapped
    }) * size as f64)
        .floor() as usize
}

/// Render validated dense terrain only; callers must supply scene composition separately.
pub fn render_dense(
    world: &VoxelWorld<'_>,
    camera: &VoxelCamera,
    fov: f64,
    width: usize,
    height: usize,
    color: &mut [u32],
    depth: &mut [f64],
) -> Result<()> {
    render_dense_with_sky(world, camera, fov, width, height, color, depth, None, 0.0)
}

/// Render terrain and its optional procedural sky, without objects or lighting.
pub fn render_dense_with_sky(
    world: &VoxelWorld<'_>,
    camera: &VoxelCamera,
    fov: f64,
    width: usize,
    height: usize,
    color: &mut [u32],
    depth: &mut [f64],
    sky: Option<&Sky>,
    time: f64,
) -> Result<()> {
    let count = width
        .checked_mul(height)
        .ok_or_else(|| anyhow::anyhow!("Framebuffer size overflow"))?;
    let volume = world
        .width
        .checked_mul(world.height)
        .and_then(|n| n.checked_mul(world.depth))
        .ok_or_else(|| anyhow::anyhow!("Voxel volume overflow"))?;
    ensure!(
        width > 0 && height > 0 && color.len() == count && depth.len() == count,
        "Invalid framebuffer dimensions"
    );
    ensure!(
        world.width > 0
            && world.width <= 4096
            && world.height > 0
            && world.height <= 4096
            && world.depth > 0
            && world.depth <= 24
            && volume <= 55296
            && world.cells.len() == volume,
        "Invalid dense voxel dimensions"
    );
    ensure!(
        !world.materials.is_empty() && world.materials.len() <= 256,
        "Invalid voxel materials"
    );
    ensure!(
        world
            .cells
            .iter()
            .all(|&id| usize::from(id) <= world.materials.len()),
        "Invalid voxel material ID"
    );
    for texture in world.materials {
        let size = texture.width.checked_mul(texture.height);
        ensure!(
            texture.width > 0 && texture.height > 0 && size == Some(texture.pixels.len()),
            "Invalid voxel texture"
        );
    }
    ensure!(
        [
            camera.x,
            camera.y,
            camera.z,
            camera.angle,
            camera.pitch,
            fov,
            time
        ]
        .iter()
        .all(|v| v.is_finite())
            && camera.pitch.abs() <= 85.0
            && fov > 0.0
            && fov < 180.0,
        "Invalid voxel camera or field of view"
    );
    if let Some(distance) = world.render_distance {
        if !distance.is_finite() || distance <= 0.0 || distance > 4096.0 {
            bail!("Invalid voxel render distance");
        }
    }
    if let Some(sky) = sky {
        ensure!(
            sky.speed.is_finite()
                && (0.0..=1.0).contains(&sky.cloud_wave)
                && (0.0..=1.0).contains(&sky.cloud_glow)
                && (time * sky.speed).is_finite()
                && (time * sky.speed).abs() <= 1e12,
            "Invalid sky speed or time"
        );
    }
    let origin = [camera.x, camera.y, camera.z + 1.25];
    ensure!(origin[2].is_finite(), "Invalid voxel camera eye");
    let angle = camera.angle * std::f64::consts::PI / 180.0;
    let pitch = camera.pitch * std::f64::consts::PI / 180.0;
    ensure!(
        angle.is_finite() && origin.iter().all(|v| v.abs() <= 1e12),
        "Voxel camera exceeds experimental renderer bounds"
    );
    let (sa, ca) = angle.sin_cos();
    let (sp, cp) = pitch.sin_cos();
    let scale = (fov * std::f64::consts::PI / 360.0).tan();
    let limit = ((world.width as f64).powi(2)
        + (world.height as f64).powi(2)
        + (world.depth as f64).powi(2))
    .sqrt()
    .min(world.render_distance.unwrap_or(f64::INFINITY));
    let outside = origin[0] <= 0.0
        || origin[0] >= world.width as f64
        || origin[1] <= 0.0
        || origin[1] >= world.height as f64
        || origin[2] <= 0.0
        || origin[2] >= world.depth as f64;
    let chunks = ChunkOccupancy::new(world);
    let tiles = chunks
        .as_ref()
        .and_then(|chunks| chunks.visible_tiles(origin, ca, sa, cp, sp, scale, width, height));
    let tile_width = width.div_ceil(8);
    for y in 0..height {
        let v = (height as f64 / 2.0 - y as f64 - 0.5) / height as f64;
        for x in 0..width {
            let u = (2.0 * x as f64 / width as f64 - 1.0) * scale;
            let ray = [
                ca * cp - sa * u - ca * sp * v,
                sa * cp + ca * u - sa * sp * v,
                sp + cp * v,
            ];
            let hit = if tiles
                .as_ref()
                .is_some_and(|tiles| !tiles[(y / 8) * tile_width + x / 8])
            {
                None
            } else if outside {
                trace_from_outside(world, chunks.as_ref(), origin, ray, limit)
            } else {
                trace(world, chunks.as_ref(), origin, ray, limit, 2)
            };
            let i = y * width + x;
            if let Some(hit) = hit {
                depth[i] = hit.distance;
                let texture = world.materials[hit.block - 1];
                let point_u = if hit.face == 0 {
                    origin[1] + ray[1] * hit.distance
                } else {
                    origin[0] + ray[0] * hit.distance
                };
                let point_v = if hit.face == 2 {
                    origin[1] + ray[1] * hit.distance
                } else {
                    origin[2] + ray[2] * hit.distance
                };
                let pixel = texture.pixels[texel(point_v, texture.height) * texture.width
                    + texel(point_u, texture.width)];
                let shade = if hit.face == 0 { 0.8 } else { 0.65 };
                color[i] = if hit.face == 2 {
                    0xff000000 | pixel
                } else {
                    0xff000000
                        | ((pixel & 255) as f64 * shade).floor() as u32
                        | ((((pixel >> 8) & 255) as f64 * shade).floor() as u32) << 8
                        | ((((pixel >> 16) & 255) as f64 * shade).floor() as u32) << 16
                };
            } else {
                color[i] = match sky {
                    Some(sky) if ray[2] > 0.0 || sky.below.is_some() => {
                        sky_pixel(sky, ray[1].atan2(ray[0]), ray[2].clamp(-1.0, 1.0), time)
                    }
                    Some(sky) => 0xff000000 | sky.horizon,
                    None => 0xff342820,
                };
                depth[i] = f64::INFINITY;
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn projected_tiles_never_hide_voxel_hits() {
        let texture = Texture {
            width: 1,
            height: 1,
            pixels: vec![0xffffff],
        };
        let materials = [&texture];
        let (width, height, depth) = (19, 17, 13);
        let mut random = 9876543u64;
        let mut next = || {
            random = random.wrapping_mul(6364136223846793005).wrapping_add(1);
            (random >> 32) as u32
        };
        let mut checked = 0;
        let mut hits = 0;
        let mut skipped = 0;
        for fixture in 0..60 {
            let mut cells = vec![0; width * height * depth];
            for _ in 0..20 {
                let i = next() as usize % cells.len();
                cells[i] = 1;
            }
            let world = VoxelWorld {
                width,
                height,
                depth,
                cells: &cells,
                materials: &materials,
                render_distance: None,
            };
            let chunks = ChunkOccupancy::new(&world).unwrap();
            let origin = [
                (next() % 3500) as f64 / 100.0 - 8.0,
                (next() % 3300) as f64 / 100.0 - 8.0,
                (next() % 2900) as f64 / 100.0 - 8.0,
            ];
            let (sa, ca) = ((next() % 360) as f64 * std::f64::consts::PI / 180.0).sin_cos();
            let (sp, cp) = ((next() % 151) as f64 * std::f64::consts::PI / 180.0 - 1.3).sin_cos();
            let fov = (30.0 + (next() % 90) as f64) * std::f64::consts::PI / 360.0;
            let scale = fov.tan();
            let (w, h) = (81usize, 53usize);
            let Some(tiles) = chunks.visible_tiles(origin, ca, sa, cp, sp, scale, w, h) else {
                continue;
            };
            checked += 1;
            for y in 0..h {
                let v = (h as f64 / 2.0 - y as f64 - 0.5) / h as f64;
                for x in 0..w {
                    let u = (2.0 * x as f64 / w as f64 - 1.0) * scale;
                    let ray = [
                        ca * cp - sa * u - ca * sp * v,
                        sa * cp + ca * u - sa * sp * v,
                        sp + cp * v,
                    ];
                    let visible = tiles[(y / 8) * w.div_ceil(8) + x / 8];
                    let hit = trace_from_outside(&world, None, origin, ray, 100.0).is_some();
                    hits += usize::from(hit);
                    skipped += usize::from(!visible);
                    assert!(visible || !hit,
                        "hidden hit fixture {fixture}, pixel {x},{y}, origin {origin:?}, ray {ray:?}");
                }
            }
        }
        assert!(checked > 20);
        assert!(hits > 100 && skipped > 100);
    }

    #[test]
    fn sparse_chunk_traversal_matches_fine_dda() {
        let texture = Texture {
            width: 1,
            height: 1,
            pixels: vec![0xffffff],
        };
        let materials = [&texture];
        let mut random = 1234567u64;
        let mut next = || {
            random = random.wrapping_mul(6364136223846793005).wrapping_add(1);
            (random >> 32) as u32
        };
        for world_number in 0..12 {
            let (width, height, depth) = (19, 17, 13);
            let mut cells = vec![0; width * height * depth];
            for _ in 0..(world_number * 5) {
                let i = next() as usize % cells.len();
                cells[i] = 1;
            }
            let world = VoxelWorld {
                width,
                height,
                depth,
                cells: &cells,
                materials: &materials,
                render_distance: None,
            };
            let chunks = ChunkOccupancy::new(&world).expect("sparse fixture");
            for i in 0..5000 {
                let origin = [
                    (next() % 2700) as f64 / 100.0 - 4.0,
                    (next() % 2500) as f64 / 100.0 - 4.0,
                    (next() % 2100) as f64 / 100.0 - 4.0,
                ];
                let ray = if i % 10 == 0 {
                    [[1.0, 1.0, 1.0], [-1.0, 0.0, 1.0], [0.0, 0.0, 0.0]][i % 3]
                } else {
                    std::array::from_fn(|_| (next() % 201) as f64 / 100.0 - 1.0)
                };
                let limit = (next() % 10000) as f64 / 100.0;
                let expected = trace_from_outside(&world, None, origin, ray, limit);
                let actual = trace_from_outside(&world, Some(&chunks), origin, ray, limit);
                assert_eq!(
                    actual, expected,
                    "world {world_number}, ray {i}: {origin:?} {ray:?}, limit {limit}"
                );
            }
        }
    }

    #[test]
    fn sparse_traversal_preserves_boundary_hits_and_limits() {
        let texture = Texture {
            width: 1,
            height: 1,
            pixels: vec![0xffffff],
        };
        let materials = [&texture];
        let (width, height, depth) = (9, 7, 5);
        for &(x, y, z) in &[(0, 0, 0), (3, 3, 3), (4, 4, 4), (8, 6, 4)] {
            let mut cells = vec![0; width * height * depth];
            cells[(z * height + y) * width + x] = 1;
            let world = VoxelWorld {
                width,
                height,
                depth,
                cells: &cells,
                materials: &materials,
                render_distance: None,
            };
            let chunks = ChunkOccupancy::new(&world).unwrap();
            for ox in [-1.0, 0.0, 3.0, 4.0, 8.5, 9.0] {
                for oy in [-1.0, 0.0, 3.0, 4.0, 6.5, 7.0] {
                    for oz in [-1.0, 0.0, 3.0, 4.0, 4.5, 5.0] {
                        for ray in [
                            [1.0, 1.0, 1.0],
                            [-1.0, -1.0, -1.0],
                            [1.0, 0.0, 0.0],
                            [0.0, -1.0, 1.0],
                            [0.0, 0.0, 0.0],
                            [1.0, 1.0 + 1e-10, 0.5],
                        ] {
                            for limit in [0.0, 1.0, 4.0, 100.0] {
                                let origin = [ox, oy, oz];
                                let expected = trace_from_outside(&world, None, origin, ray, limit);
                                let actual =
                                    trace_from_outside(&world, Some(&chunks), origin, ray, limit);
                                assert_eq!(
                                    actual, expected,
                                    "block {x},{y},{z}; {origin:?} {ray:?}, limit {limit}"
                                );
                            }
                        }
                    }
                }
            }
        }
    }
}
