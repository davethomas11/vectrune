//! Native GIF presentation; simulation and draw order remain in the ASCII engine.
use super::{coordinate, Animation, Draw, Engine, Frame, Ink};
use crate::apps::pixel::native_audio::Output;
use anyhow::{ensure, Context, Result};
use font8x8::{UnicodeFonts, BASIC_FONTS};
use pixels::{Pixels, SurfaceTexture};
use std::{
    collections::BTreeSet,
    sync::Arc,
    time::{Duration, Instant},
};
use winit::{
    application::ApplicationHandler,
    dpi::LogicalSize,
    event::{ElementState, WindowEvent},
    event_loop::{ActiveEventLoop, ControlFlow, EventLoop},
    keyboard::{KeyCode, PhysicalKey},
    window::{Window, WindowId},
};

const CELL_W: usize = 6;
const CELL_H: usize = 12;

fn ink(color: Ink) -> [u8; 3] {
    match color {
        Ink::White => [240, 240, 240],
        Ink::Gray => [100, 110, 125],
        Ink::Red => [255, 90, 90],
        Ink::Green => [100, 235, 130],
        Ink::Yellow => [255, 220, 100],
        Ink::Blue => [110, 145, 245],
        Ink::Magenta => [245, 130, 235],
        Ink::Cyan => [100, 225, 235],
    }
}

fn blend(destination: &mut [u8], pixel: [u8; 4]) {
    if pixel[3] == 255 {
        destination.copy_from_slice(&pixel);
        return;
    }
    let alpha = u32::from(pixel[3]);
    for channel in 0..3 {
        destination[channel] = ((u32::from(pixel[channel]) * alpha
            + u32::from(destination[channel]) * (255 - alpha))
            / 255) as u8;
    }
    destination[3] = 255;
}

fn paint_ascii(output: &mut [u8], frame: &mut Frame) -> Result<()> {
    let width = frame.width * CELL_W;
    for (index, cell) in frame.cells.iter().enumerate() {
        if !frame.painted[index] {
            continue;
        }
        let rgb = ink(cell.color);
        let bitmap = BASIC_FONTS
            .get(cell.glyph as char)
            .context("Missing desktop ASCII font glyph")?;
        let x = index % frame.width * CELL_W;
        let y = index / frame.width * CELL_H;
        for row in 0..CELL_H {
            let offset = ((y + row) * width + x) * 4;
            for (col, pixel) in output[offset..offset + CELL_W * 4]
                .chunks_exact_mut(4)
                .enumerate()
            {
                let on = bitmap[row * 8 / CELL_H] & (1 << (col * 8 / CELL_W)) != 0;
                let rgb = if on { rgb } else { [10, 12, 20] };
                pixel.copy_from_slice(&[rgb[0], rgb[1], rgb[2], 255]);
            }
        }
    }
    frame.painted.fill(false);
    Ok(())
}

fn render(engine: &Engine, output: &mut [u8]) -> Result<()> {
    let (snapshot, commands) = engine.drawing_commands()?;
    let width = engine.animation.width * CELL_W;
    let height = engine.animation.height * CELL_H;
    ensure!(
        output.len() == width * height * 4,
        "Invalid desktop framebuffer size"
    );
    output[..4].copy_from_slice(&[10, 12, 20, 255]);
    let mut initialized = 4;
    while initialized < output.len() {
        let count = initialized.min(output.len() - initialized);
        output.copy_within(..count, initialized);
        initialized += count;
    }
    let mut ascii = Frame::new(engine.animation.width, engine.animation.height);
    let mut pending = Vec::new();
    for command in commands {
        match command {
            Draw::Ascii3D { .. } => {
                anyhow::bail!("ASCII desktop does not support Ascii3D viewports")
            }
            Draw::Sprite {
                x,
                y,
                name,
                frame: index,
                color,
            } if engine
                .animation
                .sprites
                .get(&name)
                .is_some_and(|sprite| sprite.pixels.is_some()) =>
            {
                if !pending.is_empty() {
                    engine.render_into(&snapshot, std::mem::take(&mut pending), &mut ascii)?;
                    paint_ascii(output, &mut ascii)?;
                }
                let sprite = &engine.animation.sprites[&name];
                let index = sprite.index(engine.ticks, engine.animation.fps, index);
                let rows = sprite.frame(engine.ticks, engine.animation.fps, Some(index))?;
                let original = &sprite.pixels.as_ref().context("Missing GIF pixels")?[index];
                ensure!(
                    original.width() as usize == rows[0].len() * CELL_W
                        && original.height() as usize == rows.len() * CELL_H,
                    "Invalid cached GIF raster size"
                );
                let tint = if color == Ink::White {
                    [255, 255, 255]
                } else {
                    ink(color)
                };
                let x = coordinate(x)? * CELL_W as i32;
                let y = coordinate(y)? * CELL_H as i32;
                // Clip before touching source pixels, including entirely offscreen scenery.
                let left = (-x).max(0).min(original.width() as i32) as u32;
                let top = (-y).max(0).min(original.height() as i32) as u32;
                let right = (width as i32 - x).clamp(0, original.width() as i32) as u32;
                let bottom = (height as i32 - y).clamp(0, original.height() as i32) as u32;
                if left >= right || top >= bottom {
                    continue;
                }
                let row_bytes = (right - left) as usize * 4;
                for py in top..bottom {
                    let source_offset =
                        (py as usize * original.width() as usize + left as usize) * 4;
                    let destination_offset =
                        ((y + py as i32) as usize * width + (x + left as i32) as usize) * 4;
                    let source = &original.as_raw()[source_offset..source_offset + row_bytes];
                    let destination =
                        &mut output[destination_offset..destination_offset + row_bytes];
                    for (pixel, destination) in
                        source.chunks_exact(4).zip(destination.chunks_exact_mut(4))
                    {
                        let mut rgba = [pixel[0], pixel[1], pixel[2], pixel[3]];
                        if rgba[3] == 0 {
                            continue;
                        }
                        if color != Ink::White {
                            for channel in 0..3 {
                                rgba[channel] = (u16::from(rgba[channel])
                                    * u16::from(tint[channel])
                                    / 255) as u8;
                            }
                        }
                        blend(destination, rgba);
                    }
                }
            }
            command => {
                pending.push(command);
            }
        }
    }
    if !pending.is_empty() {
        engine.render_into(&snapshot, pending, &mut ascii)?;
        paint_ascii(output, &mut ascii)?;
    }
    Ok(())
}

/// Device-free graphical capture using the same simulation and explicit GIF frames.
pub fn frame(engine: &Engine) -> Result<Vec<u8>> {
    let mut output =
        vec![0; engine.animation.width * CELL_W * engine.animation.height * CELL_H * 4];
    render(engine, &mut output)?;
    Ok(output)
}

/// Advance one simulation tick and capture it without rendering a terminal frame.
pub fn step(engine: &mut Engine, output: &mut [u8]) -> Result<()> {
    engine.advance()?;
    render(engine, output)
}

struct Host {
    engine: Engine,
    _audio: Output,
    window: Option<Arc<Window>>,
    pixels: Option<Pixels<'static>>,
    held: BTreeSet<String>,
    next: Instant,
    frames: u64,
    limit: Option<u64>,
    error: Option<anyhow::Error>,
    focused: bool,
    tick_due: bool,
}
impl Host {
    fn draw(&mut self) -> Result<()> {
        let pixels = self.pixels.as_mut().context("Missing desktop surface")?;
        if self.tick_due {
            for key in &self.held {
                self.engine.key(key)?;
            }
            step(&mut self.engine, pixels.frame_mut())?;
            self.frames += 1;
            self.tick_due = false;
        } else {
            render(&self.engine, pixels.frame_mut())?;
        }
        pixels.render()?;
        Ok(())
    }
}
impl ApplicationHandler for Host {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.window.is_some() {
            return;
        }
        let result = (|| -> Result<()> {
            let width = (self.engine.animation.width * CELL_W) as u32;
            let height = (self.engine.animation.height * CELL_H) as u32;
            let window = Arc::new(
                event_loop.create_window(
                    Window::default_attributes()
                        .with_title("Vectrune - GIF Animator")
                        .with_inner_size(LogicalSize::new(width, height)),
                )?,
            );
            let size = window.inner_size();
            self.pixels = Some(Pixels::new(
                width,
                height,
                SurfaceTexture::new(size.width, size.height, window.clone()),
            )?);
            self.window = Some(window);
            Ok(())
        })();
        if let Err(error) = result {
            self.error = Some(error);
            event_loop.exit();
        }
    }
    fn window_event(&mut self, event_loop: &ActiveEventLoop, _: WindowId, event: WindowEvent) {
        let result = (|| -> Result<()> {
            match event {
                WindowEvent::CloseRequested => event_loop.exit(),
                WindowEvent::Focused(focused) => {
                    self.focused = focused;
                    self.held.clear();
                    self.next = Instant::now();
                    self.tick_due = false;
                }
                WindowEvent::Resized(size) if size.width > 0 && size.height > 0 => {
                    if let Some(pixels) = &mut self.pixels {
                        pixels.resize_surface(size.width, size.height)?;
                    }
                }
                WindowEvent::KeyboardInput { event, .. } => {
                    if let PhysicalKey::Code(code) = event.physical_key {
                        let down = event.state == ElementState::Pressed;
                        if down && matches!(code, KeyCode::Escape | KeyCode::KeyQ) {
                            event_loop.exit();
                            return Ok(());
                        }
                        let name = match code {
                            KeyCode::Space => "Space".to_owned(),
                            _ => format!("{code:?}"),
                        };
                        if matches!(
                            code,
                            KeyCode::ArrowLeft
                                | KeyCode::ArrowRight
                                | KeyCode::KeyA
                                | KeyCode::KeyD
                        ) {
                            if down {
                                self.held.insert(name.clone());
                            } else {
                                self.held.remove(&name);
                            }
                        }
                        if down && !event.repeat && super::supported_key(&name) {
                            self.engine.key(&name)?;
                        }
                    }
                }
                WindowEvent::RedrawRequested if self.focused => {
                    self.draw()?;
                    if self.limit.is_some_and(|limit| self.frames >= limit) {
                        event_loop.exit();
                    }
                }
                _ => {}
            }
            Ok(())
        })();
        if let Err(error) = result {
            self.error = Some(error);
            event_loop.exit();
        }
    }
    fn about_to_wait(&mut self, event_loop: &ActiveEventLoop) {
        if let Err(error) = self.engine.pump_audio() {
            self.error = Some(error);
            event_loop.exit();
            return;
        }
        let now = Instant::now();
        if now >= self.next {
            let interval = Duration::from_secs_f64(1.0 / self.engine.animation.fps as f64);
            self.next = next_deadline(self.next, now, interval);
            if self.focused {
                if let Some(window) = &self.window {
                    self.tick_due = true;
                    window.request_redraw();
                }
            }
        }
        event_loop.set_control_flow(ControlFlow::WaitUntil(
            self.next.min(now + Duration::from_millis(20)),
        ));
    }
}

fn next_deadline(previous: Instant, now: Instant, interval: Duration) -> Instant {
    let next = previous + interval;
    if next <= now {
        now + interval
    } else {
        next
    }
}

pub fn run(animation: Animation, mute: bool, limit: Option<u64>) -> Result<()> {
    ensure!(
        animation.command.is_none(),
        "ASCII desktop does not support typed-command apps"
    );
    ensure!(
        animation.scenes.is_empty(),
        "ASCII desktop does not support Ascii3D scenes"
    );
    let audible = !mute && (!animation.tones.is_empty() || !animation.music.is_empty());
    let audio = if audible {
        Output::open().context("Could not open desktop audio; rerun with --mute")?
    } else {
        Output::silent()
    };
    let engine = Engine::with_audio(animation, audio.bridge.clone())?;
    frame(&engine)?;
    let event_loop = EventLoop::new()?;
    let mut host = Host {
        engine,
        _audio: audio,
        window: None,
        pixels: None,
        held: BTreeSet::new(),
        next: Instant::now(),
        frames: 0,
        limit,
        error: None,
        focused: true,
        tick_due: false,
    };
    event_loop.run_app(&mut host)?;
    if let Some(error) = host.error {
        return Err(error);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deadlines_preserve_cadence_without_catchup_bursts() {
        let start = Instant::now();
        let interval = Duration::from_millis(33);
        assert_eq!(
            next_deadline(start, start + Duration::from_millis(5), interval),
            start + interval
        );
        assert_eq!(
            next_deadline(start, start + Duration::from_millis(100), interval),
            start + Duration::from_millis(133)
        );
    }
}
