//! Native raycaster for 3D pixel engine (hybrid desktop runtime).
#![allow(dead_code)]
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Texture {
    pub width: usize,
    pub height: usize,
    pub pixels: Vec<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Sprite {
    pub width: usize,
    pub height: usize,
    #[serde(default)]
    pub origin: Vec<usize>,
    pub colors: Vec<Option<u32>>,
    pub pixels: Vec<usize>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MapData {
    pub width: usize,
    pub height: usize,
    pub grid: Vec<usize>,
    pub floor: u32,
    pub ceiling: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Camera3D {
    pub x: f64,
    pub y: f64,
    pub angle: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Thing3D {
    pub x: f64,
    pub y: f64,
    pub sprite: String,
    pub scale: Option<f64>,
    pub visible: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ViewmodelWeapon {
    pub sprite: String,
    pub bob: Option<f64>,
    pub x: Option<f64>,
    pub y: Option<f64>,
}

fn default_health() -> i64 { 100 }
fn default_ammo() -> i64 { 24 }

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RenderState {
    pub camera: Camera3D,
    #[serde(default)]
    pub things: Vec<Thing3D>,
    pub weapon: Option<ViewmodelWeapon>,
    #[serde(default)]
    pub flash: f64,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default = "default_health")]
    pub health: i64,
    #[serde(default = "default_ammo")]
    pub ammo: i64,
    #[serde(default)]
    pub score: i64,
    #[serde(default)]
    pub kills: i64,
    #[serde(default)]
    pub level: Option<i64>,
    pub level_map: Option<String>,
    pub level_title: Option<String>,
    pub story_title: Option<String>,
    pub story_body: Option<String>,
    pub message: Option<String>,
    pub switch_activated: Option<bool>,
}

pub struct Rasterizer3D {
    pub width: usize,
    pub height: usize,
    pub fov: f64,
    pub textures: Vec<Texture>,
    pub sprites: HashMap<String, Sprite>,
    pub map: MapData,
    pub buffer: Vec<u32>,
    pub z_buffer: Vec<f64>,
}

impl Rasterizer3D {
    pub fn new(
        width: usize,
        height: usize,
        fov: f64,
        textures: Vec<Texture>,
        sprites: HashMap<String, Sprite>,
        map: MapData,
    ) -> Self {
        Self {
            width,
            height,
            fov,
            textures,
            sprites,
            map,
            buffer: vec![0; width * height],
            z_buffer: vec![0.0; width],
        }
    }

    pub fn set_map(&mut self, map: MapData) {
        self.map = map;
    }

    pub fn render(&mut self, state: &RenderState, output: &mut [u8]) {
        let w = self.width;
        let h = self.height;
        let half_h = h / 2;

        let px = state.camera.x;
        let py = state.camera.y;
        let ang_rad = state.camera.angle.to_radians();

        let dir_x = ang_rad.cos();
        let dir_y = ang_rad.sin();

        let fov_scale = ((self.fov / 2.0).to_radians()).tan();
        let plane_x = -dir_y * fov_scale;
        let plane_y = dir_x * fov_scale;

        // 1. Floor & Ceiling (flat colors)
        let ceil_packed = self.map.ceiling;
        let floor_packed = self.map.floor;
        for y in 0..half_h {
            self.buffer[y * w..(y + 1) * w].fill(ceil_packed);
        }
        for y in half_h..h {
            self.buffer[y * w..(y + 1) * w].fill(floor_packed);
        }

        // 2. Wall Casting (DDA)
        for x in 0..w {
            let camera_x = 2.0 * (x as f64) / (w as f64) - 1.0;
            let ray_dir_x = dir_x + plane_x * camera_x;
            let ray_dir_y = dir_y + plane_y * camera_x;

            let mut map_x = px.floor() as i32;
            let mut map_y = py.floor() as i32;

            let delta_dist_x = (1.0 / if ray_dir_x.abs() < 1e-6 { 1e-6 } else { ray_dir_x }).abs();
            let delta_dist_y = (1.0 / if ray_dir_y.abs() < 1e-6 { 1e-6 } else { ray_dir_y }).abs();

            let (step_x, mut side_dist_x) = if ray_dir_x < 0.0 {
                (-1, (px - map_x as f64) * delta_dist_x)
            } else {
                (1, (map_x as f64 + 1.0 - px) * delta_dist_x)
            };

            let (step_y, mut side_dist_y) = if ray_dir_y < 0.0 {
                (-1, (py - map_y as f64) * delta_dist_y)
            } else {
                (1, (map_y as f64 + 1.0 - py) * delta_dist_y)
            };

            let mut hit = 0;
            let mut side = 0;

            while hit == 0 {
                if side_dist_x < side_dist_y {
                    side_dist_x += delta_dist_x;
                    map_x += step_x;
                    side = 0;
                } else {
                    side_dist_y += delta_dist_y;
                    map_y += step_y;
                    side = 1;
                }

                if map_x < 0
                    || map_x >= self.map.width as i32
                    || map_y < 0
                    || map_y >= self.map.height as i32
                {
                    hit = 1;
                    break;
                }

                let cell = self.map.grid[map_y as usize * self.map.width + map_x as usize];
                if cell > 0 {
                    hit = cell;
                }
            }

            let perp_wall_dist = if side == 0 {
                side_dist_x - delta_dist_x
            } else {
                side_dist_y - delta_dist_y
            }
            .max(0.001);

            self.z_buffer[x] = perp_wall_dist;

            let line_height = ((h as f64) / perp_wall_dist).floor() as i32;
            let draw_start = ((-line_height / 2 + half_h as i32).max(0)) as usize;
            let draw_end = ((line_height / 2 + half_h as i32).min(h as i32 - 1)) as usize;

            if !self.textures.is_empty() {
                let tex_idx = (hit.saturating_sub(1)) % self.textures.len();
                let tex = &self.textures[tex_idx];

                let mut wall_x = if side == 0 {
                    py + perp_wall_dist * ray_dir_y
                } else {
                    px + perp_wall_dist * ray_dir_x
                };
                wall_x -= wall_x.floor();

                let mut tex_x = (wall_x * tex.width as f64).floor() as i32;
                if side == 0 && ray_dir_x > 0.0 {
                    tex_x = tex.width as i32 - tex_x - 1;
                }
                if side == 1 && ray_dir_y < 0.0 {
                    tex_x = tex.width as i32 - tex_x - 1;
                }
                let tex_x = (tex_x.clamp(0, tex.width as i32 - 1)) as usize;

                let step = tex.height as f64 / line_height as f64;
                let mut tex_pos =
                    (draw_start as f64 - half_h as f64 + line_height as f64 / 2.0) * step;

                for y in draw_start..=draw_end {
                    let tex_y = (tex_pos.floor() as i32).clamp(0, tex.height as i32 - 1) as usize;
                    tex_pos += step;
                    let mut color = tex.pixels[tex_y * tex.width + tex_x];

                    if side == 1 {
                        let r = (((color & 0xff) as f64) * 0.75) as u32;
                        let g = ((((color >> 8) & 0xff) as f64) * 0.75) as u32;
                        let b = ((((color >> 16) & 0xff) as f64) * 0.75) as u32;
                        color = 0xff000000 | (b << 16) | (g << 8) | r;
                    }
                    self.buffer[y * w + x] = color;
                }
            }
        }

        // 3. Billboards (Sprites / Things) sorted by distance
        let mut sorted: Vec<&Thing3D> = state
            .things
            .iter()
            .filter(|t| t.visible.unwrap_or(true))
            .collect();
        sorted.sort_by(|a, b| {
            let da = (px - a.x).powi(2) + (py - a.y).powi(2);
            let db = (px - b.x).powi(2) + (py - b.y).powi(2);
            db.partial_cmp(&da).unwrap_or(std::cmp::Ordering::Equal)
        });

        let inv_det = 1.0 / (plane_x * dir_y - dir_x * plane_y);
        for thing in sorted {
            let sprite = match self.sprites.get(&thing.sprite) {
                Some(s) => s,
                None => continue,
            };
            let sprite_x = thing.x - px;
            let sprite_y = thing.y - py;

            let transform_x = inv_det * (dir_y * sprite_x - dir_x * sprite_y);
            let transform_y = inv_det * (-plane_y * sprite_x + plane_x * sprite_y);

            if transform_y <= 0.1 {
                continue;
            }

            let sprite_screen_x =
                ((w as f64 / 2.0) * (1.0 + transform_x / transform_y)).floor() as i32;
            let scale = thing.scale.unwrap_or(1.0);
            let sprite_h =
                (((h as f64) / transform_y * scale).abs()).floor() as i32;
            let sprite_w = (((h as f64) / transform_y
                * scale
                * (sprite.width as f64 / sprite.height as f64))
                .abs())
            .floor() as i32;

            if sprite_w <= 0 || sprite_h <= 0 {
                continue;
            }

            let draw_start_y = (-sprite_h / 2 + half_h as i32).max(0);
            let draw_end_y = (sprite_h / 2 + half_h as i32).min(h as i32 - 1);
            if draw_start_y > draw_end_y || draw_start_y >= h as i32 || draw_end_y < 0 {
                continue;
            }

            let draw_start_x = (-sprite_w / 2 + sprite_screen_x).max(0);
            let draw_end_x = (sprite_w / 2 + sprite_screen_x).min(w as i32 - 1);
            if draw_start_x > draw_end_x || draw_start_x >= w as i32 || draw_end_x < 0 {
                continue;
            }

            let start_x = draw_start_x as usize;
            let end_x = draw_end_x as usize;
            let start_y = draw_start_y as usize;
            let end_y = draw_end_y as usize;

            for stripe in start_x..=end_x {
                if stripe >= self.z_buffer.len() || stripe >= w {
                    break;
                }
                if transform_y < self.z_buffer[stripe] {
                    let tex_x = (((stripe as i32 - (-sprite_w / 2 + sprite_screen_x))
                        * sprite.width as i32)
                        / sprite_w) as usize;
                    if tex_x >= sprite.width {
                        continue;
                    }

                    for y in start_y..=end_y {
                        if y >= h {
                            break;
                        }
                        let d = y as i32 - half_h as i32 + sprite_h / 2;
                        let tex_y = ((d * sprite.height as i32) / sprite_h) as usize;
                        if tex_y >= sprite.height {
                            continue;
                        }

                        let color_idx = sprite.pixels[tex_y * sprite.width + tex_x];
                        if let Some(Some(rgb)) = sprite.colors.get(color_idx) {
                            let packed = 0xff000000
                                | ((rgb & 0xff) << 16)
                                | (rgb & 0xff00)
                                | ((rgb >> 16) & 0xff);
                            self.buffer[y * w + stripe] = packed;
                        }
                    }
                }
            }
        }

        // 4. Viewmodel Weapon
        if let Some(weapon) = &state.weapon {
            if let Some(sprite) = self.sprites.get(&weapon.sprite) {
                let scale = 2.5;
                let render_w = ((sprite.width as f64 * scale).floor() as i32).max(1);
                let render_h = ((sprite.height as f64 * scale).floor() as i32).max(1);
                let bob_offset = weapon
                    .bob
                    .map(|b| (b.sin() * 4.0).floor() as i32)
                    .unwrap_or(0);
                let start_x = w as i32 / 2 - render_w / 2
                    + weapon.x.unwrap_or(0.0).floor() as i32;
                let start_y = h as i32 - render_h
                    + weapon.y.unwrap_or(0.0).floor() as i32
                    + bob_offset;

                for sy in 0..render_h {
                    let dest_y = start_y + sy;
                    if dest_y < 0 || dest_y >= h as i32 {
                        continue;
                    }
                    let tex_y = ((sy * sprite.height as i32) / render_h) as usize;

                    for sx in 0..render_w {
                        let dest_x = start_x + sx;
                        if dest_x < 0 || dest_x >= w as i32 {
                            continue;
                        }
                        let tex_x = ((sx * sprite.width as i32) / render_w) as usize;

                        let color_idx = sprite.pixels[tex_y * sprite.width + tex_x];
                        if let Some(Some(rgb)) = sprite.colors.get(color_idx) {
                            let packed = 0xff000000
                                | ((rgb & 0xff) << 16)
                                | (rgb & 0xff00)
                                | ((rgb >> 16) & 0xff);
                            self.buffer[dest_y as usize * w + dest_x as usize] = packed;
                        }
                    }
                }
            }
        }

        // 5. Flash tint
        if state.flash > 0.0 {
            let intensity = (state.flash * 0.1).min(1.0);
            for pixel in self.buffer.iter_mut() {
                let c = *pixel;
                let mut r = c & 0xff;
                let g = (c >> 8) & 0xff;
                let b = (c >> 16) & 0xff;
                r = (r as f64 + 160.0 * intensity).min(255.0) as u32;
                *pixel = 0xff000000 | (b << 16) | (g << 8) | r;
            }
        }

        // 6. HUD and Status Overlays
        self.render_hud(state);

        // Copy buffer bytes to output
        let bytes = unsafe {
            std::slice::from_raw_parts(self.buffer.as_ptr() as *const u8, self.buffer.len() * 4)
        };
        let len = output.len().min(bytes.len());
        output[..len].copy_from_slice(&bytes[..len]);
    }

    pub fn draw_rect(&mut self, x: i32, y: i32, width: i32, height: i32, packed: u32) {
        let w = self.width as i32;
        let h = self.height as i32;
        let left = x.clamp(0, w);
        let top = y.clamp(0, h);
        let right = (x + width).clamp(0, w);
        let bottom = (y + height).clamp(0, h);

        for row in top..bottom {
            let start = (row * w + left) as usize;
            let end = (row * w + right) as usize;
            self.buffer[start..end].fill(packed);
        }
    }

    pub fn draw_text(&mut self, text: &str, mut x: i32, y: i32, color_rgb: u32, scale: i32) {
        const FONT_MAP: [(&str, &str); 52] = [
            ("A", "010101111101101"), ("B", "110101110101110"), ("C", "011100100100011"), ("D", "110101101101110"),
            ("E", "111100110100111"), ("F", "111100110100100"), ("G", "011100101101011"), ("H", "101101111101101"),
            ("I", "111010010010111"), ("J", "001001001101010"), ("K", "101101110101101"), ("L", "100100100100111"),
            ("M", "101111111101101"), ("N", "101111111111101"), ("O", "010101101101010"), ("P", "110101110100100"),
            ("Q", "010101101111011"), ("R", "110101110101101"), ("S", "011100010001110"), ("T", "111010010010010"),
            ("U", "101101101101111"), ("V", "101101101101010"), ("W", "101101111111101"), ("X", "101101010101101"),
            ("Y", "101101010010010"), ("Z", "111001010100111"),
            ("0", "111101101101111"), ("1", "010110010010111"), ("2", "110001010100111"), ("3", "110001010001110"),
            ("4", "101101111001001"), ("5", "111100110001110"), ("6", "011100111101111"), ("7", "111001010010010"),
            ("8", "111101111101111"), ("9", "111101111001110"), (":", "000010000010000"), ("-", "000000111000000"),
            ("!", "010010010000010"), ("%", "101001010100101"), ("/", "001010010010100"), (".", "000000000000010"),
            (",", "000000000010010"), ("?", "110001010000010"), ("|", "010010010010010"), ("+", "000010111010000"),
            ("_", "000000000000111"), (">", "100010001010100"), ("<", "001010100010001"), ("[", "011010010010011"),
            ("]", "110010010010110"), (" ", "000000000000000"),
        ];

        let packed = 0xff000000
            | ((color_rgb & 0xff) << 16)
            | (color_rgb & 0xff00)
            | ((color_rgb >> 16) & 0xff);

        for ch in text.to_uppercase().chars() {
            let key = ch.to_string();
            if let Some((_, glyph)) = FONT_MAP.iter().find(|(k, _)| *k == key) {
                for (idx, b) in glyph.bytes().enumerate() {
                    if b == b'1' {
                        let px = x + (idx as i32 % 3) * scale;
                        let py = y + (idx as i32 / 3) * scale;
                        self.draw_rect(px, py, scale, scale, packed);
                    }
                }
            }
            x += 4 * scale;
        }
    }

    fn render_hud(&mut self, state: &RenderState) {
        let w = self.width as i32;
        let h = self.height as i32;

        // 1. Title Screen modal
        if state.status.as_deref() == Some("title") {
            let bw = 280;
            let bh = 160;
            let bx = (w - bw) / 2;
            let by = (h - bh) / 2;

            self.draw_rect(bx, by, bw, bh, 0xff070c12);
            self.draw_rect(bx, by, bw, 2, 0xff3d7a8a);
            self.draw_rect(bx, by + bh - 2, bw, 2, 0xff3d7a8a);
            self.draw_rect(bx, by, 2, bh, 0xff3d7a8a);
            self.draw_rect(bx + bw - 2, by, 2, bh, 0xff3d7a8a);

            self.draw_text("VECT BREACH", bx + 36, by + 16, 0xf6cc44, 3);
            self.draw_text("CYBERNETIC SECTOR INFILTRATION", bx + 28, by + 46, 0x8899aa, 1);

            self.draw_rect(bx + 20, by + 60, bw - 40, 1, 0xff223344);

            self.draw_text("WASD: MOVE / STRAFE       MOUSE: AIM", bx + 22, by + 72, 0xd49922, 1);
            self.draw_text("SPACE / L-CLICK: FIRE     E: USE SWITCH", bx + 22, by + 86, 0xd49922, 1);
            self.draw_text("PURGE GUARDS - UNLOCK ELEVATORS - SURVIVE", bx + 16, by + 102, 0x556677, 1);

            self.draw_rect(bx + 20, by + 118, bw - 40, 1, 0xff223344);

            self.draw_text("PRESS ENTER OR CLICK TO BEGIN MISSION", bx + 18, by + 132, 0x66aa44, 1);
            return;
        }

        // 2. Story / Transmission Briefing modal
        if state.status.as_deref() == Some("story") {
            let bw = 284;
            let bh = 164;
            let bx = (w - bw) / 2;
            let by = (h - bh) / 2;

            self.draw_rect(bx, by, bw, bh, 0xff06110a);
            self.draw_rect(bx, by, bw, 2, 0xff44aa33);
            self.draw_rect(bx, by + bh - 2, bw, 2, 0xff44aa33);
            self.draw_rect(bx, by, 2, bh, 0xff44aa33);
            self.draw_rect(bx + bw - 2, by, 2, bh, 0xff44aa33);

            self.draw_text("// HIGH COMMAND TRANSMISSION //", bx + 28, by + 12, 0xf6cc44, 1);
            let title = state.level_title.as_deref()
                .or(state.story_title.as_deref())
                .unwrap_or("SECTOR BRIEFING");
            self.draw_text(title, bx + 28, by + 26, 0x66aa44, 1);

            self.draw_rect(bx + 16, by + 38, bw - 32, 1, 0xff1b4025);

            if let Some(body) = &state.story_body {
                let mut text_y = by + 48;
                for line in body.split('|') {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        self.draw_text(trimmed, bx + 20, text_y, 0xe4e0d4, 1);
                        text_y += 14;
                    }
                }
            }

            self.draw_rect(bx + 16, by + 124, bw - 32, 1, 0xff1b4025);
            self.draw_text("OBJECTIVE: LOCATE TERMINAL SWITCH & EXTRACT", bx + 18, by + 132, 0xd49922, 1);
            self.draw_text("PRESS ENTER OR CLICK TO ENGAGE", bx + 42, by + 146, 0x66aa44, 1);
            return;
        }

        // 3. Top HUD Bar during gameplay
        self.draw_rect(0, 0, w, 9, 0xff0a0c0e);
        let hp_col = if state.health > 30 { 0x66aa44 } else { 0xdd3322 };
        let lvl = state.level.unwrap_or(1);
        self.draw_text(&format!("SEC 0{lvl}"), 6, 2, 0x8899aa, 1);
        self.draw_text(&format!("HP: {}%", state.health), 54, 2, hp_col, 1);
        self.draw_text(&format!("AMMO: {}", state.ammo), 114, 2, 0xf6cc44, 1);
        self.draw_text(&format!("KILLS: {}", state.kills), 174, 2, 0x8899aa, 1);
        self.draw_text(&format!("SCORE: {}", state.score), 230, 2, 0xe4e0d4, 1);

        if state.switch_activated.unwrap_or(false) {
            self.draw_text("OVR", 296, 2, 0x66aa44, 1);
        }

        // 4. In-game Interactive Message Banner
        if let Some(msg) = &state.message {
            if !msg.is_empty() {
                let msg_w = (msg.len() as i32 * 4 + 16).min(w - 20);
                let msg_x = (w - msg_w) / 2;
                self.draw_rect(msg_x, h - 24, msg_w, 12, 0xff0a0c0e);
                self.draw_rect(msg_x, h - 24, msg_w, 1, 0xffd49922);
                self.draw_text(msg, msg_x + 8, h - 21, 0xf6cc44, 1);
            }
        }

        // 5. Grand Victory overlay
        if state.status.as_deref() == Some("won") {
            let bw = 250;
            let bh = 68;
            let bx = (w - bw) / 2;
            let by = (h - bh) / 2 - 10;
            self.draw_rect(bx, by, bw, bh, 0xff0a140d);
            self.draw_rect(bx, by, bw, 2, 0xff66aa44);
            self.draw_rect(bx, by + bh - 2, bw, 2, 0xff66aa44);
            self.draw_rect(bx, by, 2, bh, 0xff66aa44);
            self.draw_rect(bx + bw - 2, by, 2, bh, 0xff66aa44);

            self.draw_text("MISSION ACCOMPLISHED", bx + 26, by + 10, 0xf6cc44, 2);
            self.draw_text("ALL 3 SECTORS SECURED // SYSTEM PURGED", bx + 16, by + 28, 0x66aa44, 1);
            self.draw_text(&format!("FINAL SCORE: {}  |  KILLS: {}", state.score, state.kills), bx + 36, by + 40, 0x8899aa, 1);
            self.draw_text("PRESS FIRE, CLICK OR ENTER TO REPLAY", bx + 20, by + 54, 0xe4e0d4, 1);
        }

        // 6. Game Over overlay
        if state.status.as_deref() == Some("gameover") {
            let bw = 240;
            let bh = 60;
            let bx = (w - bw) / 2;
            let by = (h - bh) / 2 - 10;
            self.draw_rect(bx, by, bw, bh, 0xff1f0a0a);
            self.draw_rect(bx, by, bw, 2, 0xffdd3322);
            self.draw_rect(bx, by + bh - 2, bw, 2, 0xffdd3322);
            self.draw_rect(bx, by, 2, bh, 0xffdd3322);
            self.draw_rect(bx + bw - 2, by, 2, bh, 0xffdd3322);

            self.draw_text("AGENT TERMINATED", bx + 38, by + 10, 0xdd3322, 2);
            self.draw_text("CRITICAL VITALS LOST // SIGNAL LOST", bx + 30, by + 28, 0xdd3322, 1);
            self.draw_text("PRESS FIRE, CLICK OR ENTER TO RETRY", bx + 14, by + 44, 0xf6cc44, 1);
        }
    }
}
