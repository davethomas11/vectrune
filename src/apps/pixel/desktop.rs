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
    event::{ElementState, MouseButton, WindowEvent},
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
    controls: bool,
    gamepads: crate::apps::native_controls::Gamepads,
    input: serde_json::Value,
    keys: std::collections::HashMap<String, String>,
    pending: std::collections::HashSet<String>,
    previous: Instant,
    next_redraw: Instant,
    tick_duration: Duration,
    accumulator: Duration,
    frame_limit: Option<u64>,
    frames: u64,
    cursor: (f32, f32),
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
    fn control_event(&mut self, event: serde_json::Value) -> Result<()> {
        *self.deadline.lock().unwrap() = Instant::now() + Duration::from_secs(2);
        let fullscreen: bool = self.context.with(|ctx| {
            ctx.eval(format!(
                "__RunePixel.controls.event({event}) === 'host.fullscreen'"
            ))
        })?;
        if fullscreen {
            if let Some(window) = &self.window {
                window.set_fullscreen(if window.fullscreen().is_some() {
                    None
                } else {
                    Some(Fullscreen::Borderless(None))
                });
            }
        }
        Ok(())
    }
    fn clear_input(&mut self) {
        if self.controls {
            let _ = self.js("__RunePixel.controls.clear()");
        }
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
            if self.controls {
                let focused = self.window.as_ref().is_some_and(|w| w.has_focus());
                let (events, pads) = self.gamepads.poll(focused);
                for event in events {
                    self.control_event(event)?;
                }
                // Host fullscreen commands returned by gamepads must run on the window thread.
                let fullscreen: bool = self.context.with(|ctx| {
                    ctx.eval(format!(
                        "__RunePixel.controls.gamepads({pads}).includes('host.fullscreen')"
                    ))
                })?;
                if fullscreen {
                    if let Some(window) = &self.window {
                        window.set_fullscreen(if window.fullscreen().is_some() {
                            None
                        } else {
                            Some(Fullscreen::Borderless(None))
                        });
                    }
                }
                self.js(&format!(
                    "__RunePixel.step(__RunePixel.controls.sample({}))",
                    step.as_secs_f64()
                ))?;
            } else {
                self.js(&format!("__RunePixel.step({input})"))?;
            }
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
            if self.controls {
                *self.deadline.lock().unwrap() = Instant::now() + Duration::from_secs(2);
                match &event {
                    WindowEvent::KeyboardInput { event, .. } => {
                        if let PhysicalKey::Code(key) = event.physical_key {
                            if key != KeyCode::Escape {
                                if event.state == ElementState::Pressed && !event.repeat {
                                    let code = serde_json::to_string(&format!("{key:?}"))?;
                                    let handled: bool = self.context.with(|ctx| ctx.eval(format!("Boolean(__RunePixel.app.state.status !== 'playing' && !__RunePixel.controls.profile.commands[{code}] && __RunePixel.key({code}))")))?;
                                    if handled {
                                        self.clear_input();
                                        return Ok(());
                                    }
                                }

                                self.control_event(serde_json::json!({"device":"keyboard","code":format!("{key:?}"),"value":event.state == ElementState::Pressed}))?;
                                return Ok(());
                            }
                        }
                    }
                    WindowEvent::MouseInput { state, button, .. } => {
                        if let Some(code) = crate::apps::native_controls::mouse_button(*button) {
                            self.control_event(serde_json::json!({"device":"mouse","code":code,"value":*state == ElementState::Pressed}))?;
                        }
                        if *button != MouseButton::Left {
                            return Ok(());
                        }
                    }
                    WindowEvent::MouseWheel { delta, .. } => {
                        let (x, y) = crate::apps::native_controls::wheel(*delta);
                        self.control_event(
                            serde_json::json!({"device":"mouse","code":"WheelX","value":x}),
                        )?;
                        self.control_event(
                            serde_json::json!({"device":"mouse","code":"WheelY","value":y}),
                        )?;
                        return Ok(());
                    }
                    _ => {}
                }
            }
            match event {
                WindowEvent::CursorMoved { position, .. } => {
                    if self.controls {
                        self.control_event(serde_json::json!({"device":"mouse","code":"MoveX","value":position.x - f64::from(self.cursor.0)}))?;
                        self.control_event(serde_json::json!({"device":"mouse","code":"MoveY","value":position.y - f64::from(self.cursor.1)}))?;
                    }
                    self.cursor = (position.x as f32, position.y as f32)
                }
                WindowEvent::MouseInput {
                    state: ElementState::Pressed,
                    button: MouseButton::Left,
                    ..
                } => {
                    if self.controls {
                        let playing: bool = self
                            .context
                            .with(|ctx| ctx.eval("__RunePixel.app.state.status === 'playing'"))?;
                        if playing {
                            return Ok(());
                        }
                    }
                    if let Some(pixels) = &self.pixels {
                        if let Ok((x, y)) = pixels.window_pos_to_pixel(self.cursor) {
                            self.clear_input();
                            self.js(&format!("__RunePixel.click({x},{y})"))?;
                        }
                    }
                }
                WindowEvent::CloseRequested => event_loop.exit(),
                WindowEvent::Focused(false) => {
                    self.clear_input();
                    self.js("__RunePixel.paused = true")?;
                }
                WindowEvent::Focused(true) => {
                    self.js("if (__RunePixel.app.state.status !== 'playing') __RunePixel.paused = false")?;
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
                        if down && !event.repeat && key != KeyCode::Enter {
                            let mut handled = false;
                            *self.deadline.lock().unwrap() =
                                Instant::now() + Duration::from_millis(250);
                            self.context.with(|ctx| -> Result<()> {
                                handled =
                                    ctx.eval(format!("__RunePixel.key('{}')", format!("{key:?}")))?;
                                Ok(())
                            })?;
                            if handled {
                                self.clear_input();
                                return Ok(());
                            }
                        }
                        match key {
                            KeyCode::Enter if down && !event.repeat => {
                                self.clear_input();
                                self.js("if (!__RunePixel.key('Enter')) __RunePixel.start()")?;
                            }
                            KeyCode::KeyP if down && !event.repeat => {
                                self.clear_input();
                                self.js("if (__RunePixel.app.state.status === 'playing') __RunePixel.paused = !__RunePixel.paused")?;
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
        // Schedule against the frame start, so rendering time does not add a
        // second delay to every frame or trigger an unbounded redraw loop.
        let now = Instant::now();
        if now >= self.next_redraw {
            self.next_redraw = now + Duration::from_nanos(1_000_000_000 / 60);
            if let Some(window) = &self.window {
                window.request_redraw();
            }
        }
        event_loop.set_control_flow(ControlFlow::WaitUntil(self.next_redraw));
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
    super::persistence::install(&context, std::env::current_dir()?.join(".vectrune/saves"))?;
    audio.bridge.install(&context)?;
    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str())
            .map_err(|error| anyhow!(CaughtError::from_error(&ctx, error).to_string()))
    })?;
    let keys: String = context.with(|ctx| ctx.eval("JSON.stringify(__RunePixel.config.keys)"))?;
    let keys = serde_json::from_str(&keys)?;
    let rate: f64 = context.with(|ctx| ctx.eval("__RunePixel.config.tickRate"))?;
    let controls: bool = context.with(|ctx| ctx.eval("Boolean(__RunePixel.controls)"))?;
    let wants_gamepads: bool = context.with(|ctx| ctx.eval("Boolean(__RunePixel.controls && Object.keys(__RunePixel.controls.profile.gamepad).length)"))?;
    let gamepads = crate::apps::native_controls::Gamepads::new(wants_gamepads);
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
        controls,
        gamepads,
        input: serde_json::json!({}),
        keys,
        pending: std::collections::HashSet::new(),
        previous: Instant::now(),
        next_redraw: Instant::now(),
        tick_duration: Duration::from_secs_f64(1.0 / rate),
        accumulator: Duration::ZERO,
        frame_limit,
        frames: 0,
        cursor: (0.0, 0.0),
        error: None,
    };
    EventLoop::new()?.run_app(&mut host)?;
    if let Some(error) = host.error {
        return Err(error);
    }
    Ok(())
}
