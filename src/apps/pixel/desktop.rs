//! Optional native presentation host. Simulation and rasterization stay in shared JS.
use super::{native_audio::Output, Game};
use anyhow::{anyhow, Context as _, Result};
use pixels::{Pixels, SurfaceTexture};
use rquickjs::{CaughtError, Context, Runtime, TypedArray};
use std::{
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use winit::{
    application::ApplicationHandler,
    dpi::LogicalSize,
    event::{ElementState, WindowEvent},
    event_loop::{ActiveEventLoop, ControlFlow, EventLoop},
    keyboard::{KeyCode, PhysicalKey},
    window::{Fullscreen, Window, WindowId},
};

struct Host {
    title: String,
    width: u32,
    height: u32,
    fullscreen: bool,
    window: Option<Arc<Window>>,
    pixels: Option<Pixels<'static>>,
    context: Context,
    _audio: Output,
    deadline: Arc<Mutex<Instant>>,
    input: serde_json::Value,
    keys: std::collections::HashMap<String, String>,
    pending: std::collections::HashSet<String>,
    previous: Instant,
    tick_duration: Duration,
    accumulator: Duration,
    frame_limit: Option<u64>,
    frames: u64,
    error: Option<anyhow::Error>,
}
impl Host {
    fn js(&self, source: &str) -> Result<()> {
        *self.deadline.lock().unwrap() = Instant::now() + Duration::from_millis(250);
        self.context.with(|ctx| {
            ctx.eval::<(), _>(source)
                .map_err(|error| anyhow!(CaughtError::from_error(&ctx, error).to_string()))
        })
    }
    fn clear_input(&mut self) {
        self.pending.clear();
        self.input = serde_json::json!({"left":false,"right":false,"smash":false});
    }
    fn draw(&mut self) -> Result<()> {
        self.js("__RuneNativeAudio.pump()")?;
        let now = Instant::now();
        let step = self.tick_duration;
        self.accumulator += now.duration_since(self.previous).min(step * 5);
        self.previous = now;
        while self.accumulator >= step {
            let mut input = self.input.clone();
            for key in self.pending.drain() {
                input[&key] = true.into();
            }
            self.js(&format!("__RunePixel.step({input})"))?;
            self.accumulator -= step;
        }
        *self.deadline.lock().unwrap() = Instant::now() + Duration::from_millis(250);
        let pixels = self.pixels.as_mut().context("Missing pixel surface")?;
        self.context.with(|ctx| -> Result<()> {
            let frame: TypedArray<u32> = ctx
                .eval("__RunePixel.frame()")
                .map_err(|error| anyhow!(CaughtError::from_error(&ctx, error).to_string()))?;
            // No JS is called while this borrowed typed-array view is live.
            let bytes = unsafe { frame.as_bytes() }.context("Detached pixel framebuffer")?;
            anyhow::ensure!(
                bytes.len() == pixels.frame_mut().len(),
                "Invalid pixel framebuffer size"
            );
            pixels.frame_mut().copy_from_slice(bytes);
            Ok(())
        })?;
        pixels.render()?;
        self.frames += 1;
        Ok(())
    }
}
impl ApplicationHandler for Host {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.window.is_some() {
            return;
        }
        let result = (|| -> Result<()> {
            let attributes = Window::default_attributes()
                .with_title(&self.title)
                .with_inner_size(LogicalSize::new(self.width * 3, self.height * 3))
                .with_min_inner_size(LogicalSize::new(self.width, self.height))
                .with_fullscreen(if self.fullscreen {
                    Some(Fullscreen::Borderless(None))
                } else {
                    None
                });
            let window = Arc::new(event_loop.create_window(attributes)?);
            let size = window.inner_size();
            self.pixels = Some(Pixels::new(
                self.width,
                self.height,
                SurfaceTexture::new(size.width, size.height, window.clone()),
            )?);
            self.window = Some(window);
            self.previous = Instant::now();
            Ok(())
        })();
        if let Err(error) = result {
            self.error = Some(error);
            event_loop.exit();
        }
    }
    fn window_event(&mut self, event_loop: &ActiveEventLoop, _id: WindowId, event: WindowEvent) {
        let result = (|| -> Result<()> {
            match event {
                WindowEvent::CloseRequested => event_loop.exit(),
                WindowEvent::Focused(false) => {
                    self.clear_input();
                    self.js("__RunePixel.paused = true")?;
                }
                WindowEvent::Focused(true) => {
                    self.previous = Instant::now();
                    self.accumulator = Duration::ZERO;
                }
                WindowEvent::Resized(size) if size.width > 0 && size.height > 0 => {
                    if let Some(pixels) = &mut self.pixels {
                        pixels.resize_surface(size.width, size.height)?;
                    }
                }
                WindowEvent::KeyboardInput { event, .. } => {
                    let down = event.state == ElementState::Pressed;
                    if let PhysicalKey::Code(key) = event.physical_key {
                        if let Some(action) = self.keys.get(&format!("{key:?}")) {
                            self.input[action] = down.into();
                            if down {
                                self.pending.insert(action.clone());
                            }
                        }
                        match key {
                            KeyCode::Enter if down && !event.repeat => {
                                self.clear_input();
                                self.js("__RunePixel.start()")?;
                            }
                            KeyCode::KeyP if down && !event.repeat => {
                                self.clear_input();
                                self.js("__RunePixel.paused = !__RunePixel.paused")?;
                            }
                            KeyCode::KeyM if down && !event.repeat => {
                                self.js("__RunePixel.muted = !__RunePixel.muted")?;
                            }
                            KeyCode::KeyF | KeyCode::F11 if down && !event.repeat => {
                                if let Some(window) = &self.window {
                                    window.set_fullscreen(if window.fullscreen().is_some() {
                                        None
                                    } else {
                                        Some(Fullscreen::Borderless(None))
                                    });
                                }
                            }
                            KeyCode::Escape if down => {
                                if let Some(window) = &self.window {
                                    if window.fullscreen().is_some() {
                                        window.set_fullscreen(None);
                                    } else {
                                        event_loop.exit();
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
                WindowEvent::RedrawRequested => {
                    self.draw()?;
                    if self.frame_limit.is_some_and(|limit| self.frames >= limit) {
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
        event_loop.set_control_flow(ControlFlow::WaitUntil(
            Instant::now() + Duration::from_millis(16),
        ));
        if let Some(window) = &self.window {
            window.request_redraw();
        }
    }
}

pub fn run(game: &Game, fullscreen: bool, frame_limit: Option<u64>) -> Result<()> {
    let runtime = Runtime::new()?;
    runtime.set_memory_limit(128 * 1024 * 1024);
    runtime.set_max_stack_size(1024 * 1024);
    let deadline = Arc::new(Mutex::new(Instant::now() + Duration::from_secs(2)));
    let interrupt = deadline.clone();
    runtime.set_interrupt_handler(Some(Box::new(move || {
        Instant::now() >= *interrupt.lock().unwrap()
    })));
    let audio = match Output::open() {
        Ok(audio) => audio,
        Err(error) => {
            crate::util::log(
                crate::util::LogLevel::Warn,
                &format!("Native audio unavailable: {error:#}. The game will continue silently."),
            );
            Output::silent()
        }
    };
    // Device discovery can take time; it must not consume the JS startup budget.
    *deadline.lock().unwrap() = Instant::now() + Duration::from_secs(2);
    let context = Context::full(&runtime)?;
    audio.bridge.install(&context)?;
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str())
            .map_err(|error| anyhow!(CaughtError::from_error(&ctx, error).to_string()))
    })?;
    let keys: String = context.with(|ctx| ctx.eval("JSON.stringify(__RunePixel.config.keys)"))?;
    let keys = serde_json::from_str(&keys)?;
    let rate: f64 = context.with(|ctx| ctx.eval("__RunePixel.config.tickRate"))?;
    let mut host = Host {
        title: game.title.clone(),
        width: game.width as u32,
        height: game.height as u32,
        fullscreen,
        window: None,
        pixels: None,
        context,
        _audio: audio,
        deadline,
        input: serde_json::json!({}),
        keys,
        pending: std::collections::HashSet::new(),
        previous: Instant::now(),
        tick_duration: Duration::from_secs_f64(1.0 / rate),
        accumulator: Duration::ZERO,
        frame_limit,
        frames: 0,
        error: None,
    };
    EventLoop::new()?.run_app(&mut host)?;
    if let Some(error) = host.error {
        return Err(error);
    }
    Ok(())
}
