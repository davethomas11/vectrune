use super::raster::Rasterizer3D;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HudMeter {
    pub label: String,
    pub value: f64,
    pub max: f64,
    pub color: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HudPanel {
    pub title: String,
    pub body: String,
    pub choices: Vec<String>,
    pub selected: usize,
    pub footer: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GameHud {
    pub heading: Option<String>,
    pub meters: Vec<HudMeter>,
    pub objective: String,
    pub detail: String,
    pub prompt: String,
    pub notice: String,
    pub panel: Option<HudPanel>,
}

fn wrap(text: &str, columns: usize) -> Vec<String> {
    let mut lines = Vec::new();
    for paragraph in text.split('|') {
        let mut line = String::new();
        for word in paragraph.split_whitespace() {
            if !line.is_empty() && line.chars().count() + word.chars().count() + 1 > columns {
                lines.push(std::mem::take(&mut line));
            }
            let mut rest: Vec<char> = word.chars().collect();
            while rest.len() > columns {
                if !line.is_empty() {
                    lines.push(std::mem::take(&mut line));
                }
                lines.push(rest.drain(..columns).collect());
            }
            if !line.is_empty() {
                line.push(' ');
            }
            line.extend(rest);
        }
        if !line.is_empty() {
            lines.push(line);
        }
    }
    lines
}

fn rgb(color: u32) -> u32 {
    0xff000000 | ((color & 255) << 16) | (color & 0xff00) | ((color >> 16) & 255)
}

fn text(rc: &mut Rasterizer3D, value: &str, x: i32, y: i32, color: u32, columns: usize) {
    rc.draw_text(
        &value.chars().take(columns).collect::<String>(),
        x,
        y,
        color,
        1,
    );
}

pub fn render_hud(rc: &mut Rasterizer3D, ui: &GameHud, status: &str, paused: bool) {
    let w = rc.width as i32;
    let h = rc.height as i32;
    let columns = ((w - 12) / 4).max(1) as usize;
    let panel_columns = ((w - 48) / 4).max(1) as usize;
    let width = (w - 16) / ui.meters.len().max(1) as i32;
    rc.draw_rect(0, 0, w, 25, rgb(0x0b111b));
    for (i, m) in ui.meters.iter().enumerate() {
        let x = 6 + i as i32 * width;
        text(
            rc,
            &format!("{} {}/{}", m.label, m.value.ceil(), m.max.ceil()),
            x,
            3,
            m.color,
            columns,
        );
        rc.draw_rect(x, 11, width - 6, 5, rgb(0x273445));
        rc.draw_rect(
            x,
            11,
            ((width - 6) as f64 * (m.value / m.max).clamp(0.0, 1.0)).floor() as i32,
            5,
            rgb(m.color),
        );
    }
    text(rc, &ui.detail, 6, 19, 0xb5c9de, columns);
    rc.draw_rect(0, 25, w, 11, rgb(0x172133));
    text(rc, &ui.objective, 6, 28, 0xf2d58a, columns);
    let heading = if status != "playing" || paused {
        ui.heading
            .as_deref()
            .unwrap_or("")
            .chars()
            .take(((w - 32) / 12).max(1) as usize)
            .collect::<String>()
    } else {
        String::new()
    };
    if !heading.is_empty() {
        rc.draw_rect(16, 40, w - 32, 26, rgb(0x0b111b));
        rc.draw_text(
            &heading,
            (w - heading.chars().count() as i32 * 12) / 2,
            44,
            0xf2d58a,
            3,
        );
    }
    if !ui.notice.is_empty() && ui.panel.is_none() {
        let notice_y = if heading.is_empty() { 40 } else { 70 };
        let lines = wrap(&ui.notice, ((w - 32) / 4).max(1) as usize);
        rc.draw_rect(
            12,
            notice_y,
            w - 24,
            lines.len().min(2) as i32 * 8 + 8,
            rgb(0x172133),
        );
        for (i, line) in lines.iter().take(2).enumerate() {
            text(rc, line, 16, notice_y + 4 + i as i32 * 8, 0xf2d58a, columns);
        }
    }
    if let Some(p) = &ui.panel {
        let camp = status != "playing" || paused;
        let body: Vec<_> = wrap(&p.body, panel_columns)
            .into_iter()
            .take(if camp { 3 } else { 2 })
            .collect();
        let bh = 35 + body.len() as i32 * 8 + p.choices.len() as i32 * 12;
        let by = if camp {
            if heading.is_empty() {
                44
            } else {
                70
            }
        } else {
            h - bh - 18
        };
        rc.draw_rect(16, by, w - 32, bh, rgb(0x0b111b));
        rc.draw_rect(16, by, w - 32, 2, rgb(0xf2d58a));
        text(rc, &p.title, 24, by + 7, 0xf2d58a, panel_columns);
        for (i, line) in body.iter().enumerate() {
            text(
                rc,
                line,
                24,
                by + 18 + i as i32 * 8,
                0xb5c9de,
                panel_columns,
            );
        }
        for (i, choice) in p.choices.iter().enumerate() {
            let y = by + 22 + body.len() as i32 * 8 + i as i32 * 12;
            if i == p.selected {
                rc.draw_rect(22, y - 2, w - 44, 10, rgb(0x30445c));
            }
            text(
                rc,
                &format!(
                    "{} {} {}",
                    if i == p.selected { ">" } else { " " },
                    i + 1,
                    choice
                ),
                24,
                y,
                if i == p.selected { 0xffffff } else { 0xb5c9de },
                panel_columns,
            );
        }
        text(rc, &p.footer, 24, by + bh - 8, 0x7ed6ac, panel_columns);
    } else {
        let (x, y) = (w / 2, h / 2);
        for (x, y, width, height) in [
            (x - 3, y, 2, 1),
            (x + 2, y, 2, 1),
            (x, y - 3, 1, 2),
            (x, y + 2, 1, 2),
        ] {
            rc.draw_rect(x, y, width, height, rgb(0xffffff));
        }
    }
    rc.draw_rect(0, h - 14, w, 14, rgb(0x0b111b));
    text(
        rc,
        if paused && ui.heading.as_deref().unwrap_or("").is_empty() {
            "PAUSED - P OR PAUSE BUTTON TO RESUME"
        } else {
            &ui.prompt
        },
        6,
        h - 9,
        0xffffff,
        columns,
    );
}
