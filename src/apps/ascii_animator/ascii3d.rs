//! Bounded grid raycasting; ASCII sprites share the animator's assets and clock.
use super::{ascii, value_json, Frame, Ink, Sprite};
use crate::rune_ast::RuneDocument;
use anyhow::{ensure, Context, Result};
use serde::Deserialize;
use serde_json::{json, Value as Json};
use std::collections::HashMap;

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct Material {
    texture: String,
    #[serde(default)]
    color: Ink,
}
#[derive(Clone)]
pub struct Scene {
    rows: Vec<Vec<u8>>,
    walls: HashMap<u8, Material>,
    camera: String,
    entities: String,
    fov: f64,
    far: f64,
    cell_aspect: f64,
    repeat_y: bool,
    floor: Ink,
    ceiling: Ink,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Camera {
    x: f64,
    y: f64,
    angle: f64,
    #[serde(default = "eye_height")]
    z: f64,
    #[serde(default)]
    pitch: f64,
}
fn eye_height() -> f64 {
    0.5
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Entity {
    x: f64,
    y: f64,
    sprite: String,
    #[serde(default)]
    z: f64,
    #[serde(default = "entity_size")]
    size: f64,
    #[serde(default)]
    color: Ink,
    frame: Option<usize>,
    #[serde(default = "visible")]
    visible: bool,
    // Gameplay metadata stays available to Rune actions without affecting projection.
    #[serde(rename = "id")]
    _id: Option<Json>,
    health: Option<f64>,
    cooldown: Option<f64>,
}
fn entity_size() -> f64 {
    1.0
}
fn visible() -> bool {
    true
}

fn number(
    section: &crate::rune_ast::Section,
    key: &str,
    default: f64,
    min: f64,
    max: f64,
) -> Result<f64> {
    let value = section
        .kv
        .get(key)
        .map(value_json)
        .unwrap_or(Json::from(default));
    let value = value
        .as_f64()
        .with_context(|| format!("Ascii3D {key} must be a number"))?;
    ensure!(
        value.is_finite() && (min..=max).contains(&value),
        "Ascii3D {key} must be between {min} and {max}"
    );
    Ok(value)
}

pub(super) fn compile(
    doc: &RuneDocument,
    sprites: &HashMap<String, Sprite>,
) -> Result<HashMap<String, Scene>> {
    let mut scenes = HashMap::new();
    for section in doc
        .sections
        .iter()
        .filter(|s| s.path.first().map(String::as_str) == Some("Ascii3D"))
    {
        ensure!(section.path.len() == 2, "Expected @Ascii3D/<name>");
        for key in section.kv.keys() {
            ensure!(
                [
                    "map",
                    "walls",
                    "camera",
                    "entities",
                    "fov",
                    "far",
                    "cell_aspect",
                    "repeat_y",
                    "floor",
                    "ceiling"
                ]
                .contains(&key.as_str()),
                "Unknown @Ascii3D field {key}"
            );
        }
        let rows: Vec<String> = serde_json::from_value(value_json(
            section
                .kv
                .get("map")
                .context("Ascii3D needs map = [rows...]")?,
        ))?;
        ensure!(
            (3..=128).contains(&rows.len()),
            "Ascii3D map needs 3-128 rows"
        );
        let width = rows[0].len();
        ensure!(
            (3..=128).contains(&width),
            "Ascii3D map needs 3-128 columns"
        );
        for row in &rows {
            ascii(row)?;
            ensure!(row.len() == width, "Ascii3D map must be rectangular");
        }
        let walls: HashMap<String, Material> = serde_json::from_value(value_json(
            section
                .kv
                .get("walls")
                .context("Ascii3D needs walls = {symbol: {texture, color}}")?,
        ))?;
        ensure!(
            !walls.is_empty() && walls.len() <= 94,
            "Ascii3D needs 1-94 wall materials"
        );
        let mut materials = HashMap::new();
        for (symbol, material) in walls {
            ascii(&symbol)?;
            ensure!(
                symbol.len() == 1 && symbol != ".",
                "Wall symbol must be one printable ASCII character other than '.'"
            );
            let sprite = sprites
                .get(&material.texture)
                .with_context(|| format!("Unknown wall texture {}", material.texture))?;
            let height = sprite.frames[0].len();
            let width = sprite.frames[0][0].len();
            ensure!(
                width > 0
                    && sprite
                        .frames
                        .iter()
                        .all(|rows| rows.len() == height && rows.iter().all(|r| r.len() == width)),
                "Ascii3D wall textures need nonempty rectangular frames of identical size"
            );
            materials.insert(symbol.as_bytes()[0], material);
        }
        ensure!(
            rows.iter()
                .flat_map(|r| r.bytes())
                .all(|b| b == b'.' || materials.contains_key(&b)),
            "Unknown wall symbol in Ascii3D map; '.' is empty space"
        );
        ensure!(
            rows.iter().any(|r| r.contains('.')),
            "Ascii3D map needs empty space"
        );
        let repeat_y = section
            .kv
            .get("repeat_y")
            .map(value_json)
            .unwrap_or(Json::Bool(false));
        let repeat_y = repeat_y
            .as_bool()
            .context("Ascii3D repeat_y must be boolean")?;
        ensure!(
            rows.iter()
                .all(|r| r.as_bytes()[0] != b'.' && r.as_bytes()[width - 1] != b'.'),
            "Ascii3D map must have solid left/right boundaries"
        );
        if !repeat_y {
            ensure!(
                rows[0]
                    .bytes()
                    .chain(rows[rows.len() - 1].bytes())
                    .all(|b| b != b'.'),
                "Non-repeating Ascii3D maps need solid top/bottom boundaries"
            );
        }
        let binding = |key: &str, default: &str| -> Result<String> {
            let value = section
                .kv
                .get(key)
                .map(|v| v.as_str().context("Ascii3D state bindings must be strings"))
                .transpose()?
                .unwrap_or(default);
            ensure!(
                !value.is_empty() && value.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'),
                "Ascii3D {key} must name a top-level state field"
            );
            Ok(value.to_string())
        };
        let ink = |key: &str, default: &str| -> Result<Ink> {
            Ok(serde_json::from_value(
                section
                    .kv
                    .get(key)
                    .map(value_json)
                    .unwrap_or(Json::String(default.into())),
            )?)
        };
        let scene = Scene {
            rows: rows.into_iter().map(String::into_bytes).collect(),
            walls: materials,
            camera: binding("camera", "camera")?,
            entities: binding("entities", "things")?,
            fov: number(section, "fov", 65.0, 30.0, 110.0)?,
            far: number(section, "far", 32.0, 2.0, 96.0)?,
            cell_aspect: number(section, "cell_aspect", 2.0, 1.0, 3.0)?,
            repeat_y,
            floor: ink("floor", "gray")?,
            ceiling: ink("ceiling", "blue")?,
        };
        ensure!(
            scenes.insert(section.path[1].clone(), scene).is_none(),
            "Duplicate @Ascii3D scene"
        );
    }
    Ok(scenes)
}

#[derive(Clone, Copy)]
struct Hit {
    distance: f64,
    symbol: u8,
    u: f64,
    side: bool,
}
impl Scene {
    fn wall(&self, x: i32, y: i32) -> Option<u8> {
        if x < 0 || x >= self.rows[0].len() as i32 {
            return Some(self.rows[0][0]);
        }
        let row = if self.repeat_y {
            y.rem_euclid(self.rows.len() as i32)
        } else if y < 0 || y >= self.rows.len() as i32 {
            return Some(self.rows[0][0]);
        } else {
            y
        };
        let symbol = self.rows[row as usize][x as usize];
        (symbol != b'.').then_some(symbol)
    }
    fn ray(&self, x: f64, y: f64, dx: f64, dy: f64) -> Option<Hit> {
        let (mut mx, mut my) = (x.floor() as i32, y.floor() as i32);
        let (sx, sy) = (if dx < 0.0 { -1 } else { 1 }, if dy < 0.0 { -1 } else { 1 });
        let (ddx, ddy) = ((1.0 / dx).abs(), (1.0 / dy).abs());
        let mut tx = if dx < 0.0 {
            x - mx as f64
        } else {
            mx as f64 + 1.0 - x
        } * ddx;
        let mut ty = if dy < 0.0 {
            y - my as f64
        } else {
            my as f64 + 1.0 - y
        } * ddy;
        // At most far * (|dx| + |dy|) cell crossings; cap also guards degenerate rays.
        for _ in 0..512 {
            let (distance, side) = if tx < ty {
                let distance = tx;
                tx += ddx;
                mx += sx;
                (distance, false)
            } else {
                let distance = ty;
                ty += ddy;
                my += sy;
                (distance, true)
            };
            if distance > self.far {
                return None;
            }
            if let Some(symbol) = self.wall(mx, my) {
                let offset = if side {
                    x + distance * dx
                } else {
                    y + distance * dy
                };
                return Some(Hit {
                    distance,
                    symbol,
                    u: offset.rem_euclid(1.0),
                    side,
                });
            }
        }
        None
    }
    pub(super) fn spatial(&self) -> Result<Json> {
        ensure!(!self.repeat_y, "AsciiAnimator spatial cannot bind a repeating map; rail/screensaver motion must handle wrap explicitly");
        Ok(
            json!({"width": self.rows[0].len(), "height": self.rows.len(),
            "grid": self.rows.iter().flatten().map(|b| if *b == b'.' {0} else {1}).collect::<Vec<_>>()}),
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub(super) fn render(
        &self,
        frame: &mut Frame,
        state: &Json,
        sprites: &HashMap<String, Sprite>,
        ticks: u64,
        fps: u64,
        x: i32,
        y: i32,
        width: usize,
        height: usize,
    ) -> Result<()> {
        let camera: Camera = serde_json::from_value(state[&self.camera].clone())
            .context("Invalid Ascii3D camera")?;
        ensure!(camera.x.is_finite() && camera.y.is_finite() && camera.x.abs() <= 1_000_000.0 && camera.y.abs() <= 1_000_000.0
            && camera.angle.is_finite() && camera.angle.abs() <= 1_000_000.0 && camera.pitch.is_finite() && camera.pitch.abs() <= 45.0
            && camera.z.is_finite() && (0.05..=0.95).contains(&camera.z),
            "Ascii3D camera needs finite x/y/angle within +/-1000000, z 0.05-0.95 and pitch +/-45 degrees");
        ensure!(
            self.wall(camera.x.floor() as i32, camera.y.floor() as i32)
                .is_none(),
            "Ascii3D camera must be in empty map space"
        );
        let entities: Vec<Entity> = serde_json::from_value(state[&self.entities].clone())
            .context("Invalid Ascii3D entities")?;
        ensure!(
            entities.len() <= 256,
            "Ascii3D supports at most 256 entities"
        );
        let angle = camera.angle.to_radians();
        let (dx, dy) = (angle.cos(), angle.sin());
        let plane = (self.fov.to_radians() / 2.0).tan();
        let focal_x = width as f64 / (2.0 * plane);
        let focal = focal_x / self.cell_aspect;
        let horizon = height as f64 / 2.0 + camera.pitch.to_radians().tan() * focal;
        let mut depth = vec![self.far; width * height];
        for col in 0..width {
            let offset = (2.0 * (col as f64 + 0.5) / width as f64 - 1.0) * plane;
            let (rx, ry) = (dx - dy * offset, dy + dx * offset);
            let hit = self.ray(camera.x, camera.y, rx, ry);
            for row in 0..height {
                let below = row as f64 + 0.5 > horizon;
                let elevation = if below { camera.z } else { 1.0 - camera.z };
                let distance = elevation * focal / (row as f64 + 0.5 - horizon).abs().max(0.001);
                depth[row * width + col] = distance.min(self.far);
                let (wx, wy) = (camera.x + rx * distance, camera.y + ry * distance);
                let glyph = if distance >= self.far {
                    b' '
                } else if below {
                    if (wx.floor() as i64 + wy.floor() as i64).rem_euclid(2) == 0 {
                        b'.'
                    } else {
                        b','
                    }
                } else if wx.rem_euclid(4.0) < 0.13 || wy.rem_euclid(4.0) < 0.13 {
                    b'-'
                } else {
                    b' '
                };
                frame.put(
                    x + col as i32,
                    y + row as i32,
                    glyph,
                    if below { self.floor } else { self.ceiling },
                );
                if let Some(hit) = hit {
                    let distance = hit.distance.max(0.025);
                    let top = horizon - (1.0 - camera.z) * focal / distance;
                    let bottom = horizon + camera.z * focal / distance;
                    let center = row as f64 + 0.5;
                    if center >= top && center < bottom {
                        let material = &self.walls[&hit.symbol];
                        let rows = sprites[&material.texture].frame(ticks, fps, None)?;
                        let tx = (hit.u * rows[0].len() as f64).floor() as usize;
                        let ty = (((center - top) / (bottom - top)) * rows.len() as f64).floor()
                            as usize;
                        let glyph =
                            rows[ty.min(rows.len() - 1)].as_bytes()[tx.min(rows[0].len() - 1)];
                        let color = if distance > 16.0 || (hit.side && distance > 6.0) {
                            Ink::Gray
                        } else {
                            material.color
                        };
                        frame.put(x + col as i32, y + row as i32, glyph, color);
                        depth[row * width + col] = distance;
                    }
                }
            }
        }
        for entity in entities {
            ensure!(
                entity.x.is_finite()
                    && entity.y.is_finite()
                    && entity.x.abs() <= 1_000_000.0
                    && entity.y.abs() <= 1_000_000.0
                    && entity.z.is_finite()
                    && (0.0..=1.0).contains(&entity.z)
                    && entity.size.is_finite()
                    && (0.05..=4.0).contains(&entity.size),
                "Ascii3D entities need finite x/y within +/-1000000, z 0-1 and size 0.05-4"
            );
            ensure!(
                entity.health.is_none_or(|v| v.is_finite())
                    && entity.cooldown.is_none_or(|v| v.is_finite()),
                "Entity gameplay values must be finite"
            );
            let sprite = sprites
                .get(&entity.sprite)
                .with_context(|| format!("Unknown Ascii3D entity sprite {}", entity.sprite))?;
            let rows = sprite.frame(ticks, fps, entity.frame)?;
            let index = sprite.index(ticks, fps, entity.frame);
            let sw = rows.iter().map(String::len).max().unwrap_or(0);
            ensure!(sw > 0, "Ascii3D entity sprite needs nonempty rows");
            if !entity.visible {
                continue;
            }
            let ex = entity.x - camera.x;
            let ey = entity.y - camera.y;
            let forward = ex * dx + ey * dy;
            let side = -ex * dy + ey * dx;
            if !(0.05..self.far).contains(&forward) {
                continue;
            }
            let center = width as f64 / 2.0 + side * focal_x / forward;
            let projected_h = entity.size * focal / forward;
            let projected_w = projected_h * self.cell_aspect * sw as f64 / rows.len() as f64;
            let left = center - projected_w / 2.0;
            let top = horizon - (entity.z + entity.size - camera.z) * focal / forward;
            let bottom = top + projected_h;
            for row in
                top.floor().max(0.0) as usize..bottom.ceil().max(0.0).min(height as f64) as usize
            {
                for col in left.floor().max(0.0) as usize
                    ..(left + projected_w).ceil().max(0.0).min(width as f64) as usize
                {
                    if forward >= depth[row * width + col] {
                        continue;
                    }
                    let u = (col as f64 + 0.5 - left) / projected_w;
                    let v = (row as f64 + 0.5 - top) / projected_h;
                    if !(0.0..1.0).contains(&u) || !(0.0..1.0).contains(&v) {
                        continue;
                    }
                    let sy = (v * rows.len() as f64) as usize;
                    let sx = (u * sw as f64) as usize;
                    if let Some(&glyph) = rows[sy].as_bytes().get(sx) {
                        if sprite.opaque(index, sy, sx, glyph) {
                            frame.put(x + col as i32, y + row as i32, glyph, entity.color);
                            depth[row * width + col] = forward;
                        }
                    }
                }
            }
        }
        Ok(())
    }
}
