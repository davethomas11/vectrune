//! Native presentation host for 3D pixel engine (hybrid desktop runtime).
use super::{
    raster::{MapData, Rasterizer3D, RenderState, Sprite, Texture},
    Game3D,
};
use crate::apps::pixel::native_audio::Output;
use anyhow::{anyhow, ensure, Context as _, Result};
use pixels::{Pixels, SurfaceTexture};
use rquickjs::{CaughtError, Context, Runtime, TypedArray};
use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use winit::{
    application::ApplicationHandler,
    dpi::LogicalSize,
    event::{DeviceEvent, DeviceId, ElementState, MouseButton, WindowEvent},
    event_loop::{ActiveEventLoop, ControlFlow, EventLoop},
    keyboard::{KeyCode, PhysicalKey},
    window::{CursorGrabMode, Fullscreen, Window, WindowId},
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
    keys: HashMap<String, String>,
    pending: HashSet<String>,
    previous: Instant,
    next_redraw: Instant,
    tick_duration: Duration,
    accumulator: Duration,
    frame_limit: Option<u64>,
    frames: u64,
    rasterizer: Rasterizer3D,
    maps: HashMap<String, MapData>,
    current_map_name: String,
    mouse_look: bool,
    mouse_locked: bool,
    mouse_accum_x: f64,
    error: Option<anyhow::Error>,
}

impl Host {
    fn js(&self, source: &str) -> Result<()> {
        *self.deadline.lock().unwrap() = Instant::now() + Duration::from_secs(2);
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
        self.input = serde_json::json!({
            "forward": false,
            "back": false,
            "strafe_left": false,
            "strafe_right": false,
            "turn_left": false,
            "turn_right": false,
            "fire": false,
            "use": false
        });
        self.mouse_accum_x = 0.0;
    }

    fn draw(&mut self) -> Result<()> {
        *self.deadline.lock().unwrap() = Instant::now() + Duration::from_secs(2);
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
            if self.mouse_accum_x != 0.0 {
                input["look_x"] = self.mouse_accum_x.into();
                self.mouse_accum_x = 0.0;
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
                    "__RunePixel3D.step(__RunePixel.controls.sample({}))",
                    step.as_secs_f64()
                ))?;
            } else {
                self.js(&format!("__RunePixel3D.step({input})"))?;
            }
            self.accumulator -= step;
        }

        *self.deadline.lock().unwrap() = Instant::now() + Duration::from_secs(2);
        let pixels = self.pixels.as_mut().context("Missing pixel surface")?;

        let shared_frame: bool = self.context.with(|ctx| {
            ctx.eval("__RunePixel3D.usesSharedRenderer")
                .map_err(|error| anyhow!(CaughtError::from_error(&ctx, error).to_string()))
        })?;
        if shared_frame {
            self.context.with(|ctx| -> Result<()> {
                let frame: TypedArray<u32> = ctx
                    .eval("__RunePixel3D.frame()")
                    .map_err(|error| anyhow!(CaughtError::from_error(&ctx, error).to_string()))?;
                // Do not call JS while this borrowed framebuffer is live.
                let bytes = unsafe { frame.as_bytes() }.context("Detached shared framebuffer")?;
                ensure!(
                    bytes.len() == pixels.frame_mut().len(),
                    "Shared framebuffer size mismatch"
                );
                pixels.frame_mut().copy_from_slice(bytes);
                Ok(())
            })?;
        } else {
            let state_json: String = self.context.with(|ctx| {
                ctx.eval(
                "__RunePixel3D.renderState ? JSON.stringify(__RunePixel3D.renderState()) : '{}'",
            )
            .map_err(|error| anyhow!(CaughtError::from_error(&ctx, error).to_string()))
            })?;

            {
                let state = serde_json::from_str::<RenderState>(&state_json)
                    .context("Invalid pixel-3d render state")?;
                if let Some(map_name) = &state.level_map {
                    if map_name != &self.current_map_name {
                        if let Some(new_map) = self.maps.get(map_name) {
                            self.current_map_name = map_name.clone();
                            self.rasterizer.set_map(new_map.clone());
                        }
                    }
                }
                self.rasterizer.render(&state, pixels.frame_mut());
            }
        }

        match pixels.render() {
            Ok(()) => {}
            Err(_error) => {
                // If the surface was lost or invalidated due to an overlay hook, attempt to recover by resizing
                if let Some(window) = &self.window {
                    let size = window.inner_size();
                    if size.width > 0 && size.height > 0 {
                        let _ = pixels.resize_surface(size.width, size.height);
                    }
                }
            }
        }

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

    fn device_event(
        &mut self,
        _event_loop: &ActiveEventLoop,
        _device_id: DeviceId,
        event: DeviceEvent,
    ) {
        if let DeviceEvent::MouseMotion { delta: (dx, dy) } = event {
            if self.mouse_locked {
                if self.controls {
                    let result = self
                        .control_event(
                            serde_json::json!({"device":"mouse","code":"MoveX","value":dx}),
                        )
                        .and_then(|_| {
                            self.control_event(
                                serde_json::json!({"device":"mouse","code":"MoveY","value":dy}),
                            )
                        });
                    if let Err(error) = result {
                        self.error = Some(error);
                        _event_loop.exit();
                    }
                } else {
                    self.mouse_accum_x += dx;
                }
            }
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
                                if event.state == ElementState::Pressed {
                                    let code = serde_json::to_string(&format!("{key:?}"))?;
                                    let advance: bool = self.context.with(|ctx| ctx.eval(format!("(() => {{ const c=__RunePixel.controls.profile; const b=c.keys[{code}]; const input=typeof b === 'string' ? b : b && b.input; return __RunePixel.app.state.status !== 'playing' && !c.commands[{code}] && (input === 'fire' || input === 'use'); }})()")))?;
                                    if advance {
                                        if !event.repeat {
                                            self.clear_input();
                                            self.js("__RunePixel.invoke('advance')")?;
                                        }
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
                WindowEvent::MouseInput {
                    state,
                    button: MouseButton::Left,
                    ..
                } => {
                    let down = state == ElementState::Pressed;
                    if down && !self.mouse_locked && self.mouse_look {
                        let is_advance: bool = self.context.with(|ctx| {
                            ctx.eval::<bool, _>("Boolean(__RunePixel3D.app && (__RunePixel3D.app.state.status === 'title' || __RunePixel3D.app.state.status === 'story'))").unwrap_or(false)
                        });
                        if is_advance {
                            let _ = self.js("__RunePixel3D.invoke('advance')");
                        } else if let Some(window) = &self.window {
                            let _ = window
                                .set_cursor_grab(CursorGrabMode::Locked)
                                .or_else(|_| window.set_cursor_grab(CursorGrabMode::Confined));
                            window.set_cursor_visible(false);
                            self.mouse_locked = true;
                        }
                    }
                    if self.controls {
                        return Ok(());
                    }
                    self.input["fire"] = down.into();
                    if down {
                        self.pending.insert("fire".to_string());
                    }
                }
                WindowEvent::CloseRequested => event_loop.exit(),
                WindowEvent::Focused(false) => {
                    self.clear_input();
                    if self.mouse_locked {
                        if let Some(window) = &self.window {
                            let _ = window.set_cursor_grab(CursorGrabMode::None);
                            window.set_cursor_visible(true);
                            self.mouse_locked = false;
                        }
                    }
                }
                WindowEvent::Focused(true) => {
                    let _ = self.js("if (__RunePixel3D) __RunePixel3D.paused = false");
                    self.previous = Instant::now();
                    self.accumulator = Duration::ZERO;
                }
                WindowEvent::Occluded(true) => {
                    self.clear_input();
                }
                WindowEvent::Occluded(false) => {
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
                                let _ = self.js("if (__RunePixel3D.app && (__RunePixel3D.app.state.status === 'title' || __RunePixel3D.app.state.status === 'story')) { __RunePixel3D.invoke('advance'); } else if (__RunePixel3D.app && __RunePixel3D.app.state.status !== 'playing') { __RunePixel3D.start(); }");
                            }
                            KeyCode::Space if down && !event.repeat => {
                                let _ = self.js("if (__RunePixel3D.app && (__RunePixel3D.app.state.status === 'title' || __RunePixel3D.app.state.status === 'story')) { __RunePixel3D.invoke('advance'); }");
                            }
                            KeyCode::KeyP if down && !event.repeat => {
                                self.clear_input();
                                self.js("if (__RunePixel3D.app && __RunePixel3D.app.state.status === 'playing') __RunePixel3D.paused = !__RunePixel3D.paused")?;
                            }
                            KeyCode::KeyM if down && !event.repeat => {
                                self.js("__RunePixel3D.muted = !__RunePixel3D.muted")?;
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
                                if self.mouse_locked {
                                    if let Some(window) = &self.window {
                                        let _ = window.set_cursor_grab(CursorGrabMode::None);
                                        window.set_cursor_visible(true);
                                        self.mouse_locked = false;
                                    }
                                } else if let Some(window) = &self.window {
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

pub fn run(game: &Game3D, fullscreen: bool, frame_limit: Option<u64>) -> Result<()> {
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

    *deadline.lock().unwrap() = Instant::now() + Duration::from_secs(2);
    let context = Context::full(&runtime)?;
    crate::apps::pixel::persistence::install(
        &context,
        std::env::current_dir()?.join(".vectrune/saves"),
    )?;
    audio.bridge.install(&context)?;

    context.with(|ctx| {
        ctx.eval::<(), _>(game.script.as_str())
            .map_err(|error| anyhow!(CaughtError::from_error(&ctx, error).to_string()))
    })?;

    let keys: HashMap<String, String> =
        serde_json::from_value(game.config.get("keys").cloned().unwrap_or_default())
            .unwrap_or_default();
    let tick_rate = game
        .config
        .get("tickRate")
        .and_then(|v| v.as_f64())
        .unwrap_or(30.0);
    let mouse_look = game
        .config
        .get("mouseLook")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    // Build Rasterizer3D
    // Keep indices in the same sorted order as the compiled JSON and web renderer.
    let tex_map: std::collections::BTreeMap<String, Texture> =
        serde_json::from_value(game.config["textures"].clone())
            .context("Invalid pixel-3d textures")?;
    let textures: Vec<Texture> = tex_map.into_values().collect();

    let sprites: HashMap<String, Sprite> =
        serde_json::from_value(game.config.get("sprites").cloned().unwrap_or_default())
            .unwrap_or_default();

    let map: MapData = serde_json::from_value(game.config.get("map").cloned().unwrap_or_default())
        .context("Invalid map configuration in pixel-3d game")?;

    let maps: HashMap<String, MapData> =
        serde_json::from_value(game.config.get("maps").cloned().unwrap_or_default())
            .unwrap_or_default();

    let mut rasterizer = Rasterizer3D::new(game.width, game.height, 66.0, textures, sprites, map);
    rasterizer.models =
        serde_json::from_value(game.config["models"].clone()).context("Invalid pixel-3d models")?;

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
        pending: HashSet::new(),
        previous: Instant::now(),
        next_redraw: Instant::now(),
        tick_duration: Duration::from_secs_f64(1.0 / tick_rate),
        accumulator: Duration::ZERO,
        frame_limit,
        frames: 0,
        rasterizer,
        maps,
        current_map_name: String::new(),
        mouse_look,
        mouse_locked: false,
        mouse_accum_x: 0.0,
        error: None,
    };

    EventLoop::new()?.run_app(&mut host)?;
    if let Some(error) = host.error {
        return Err(error);
    }
    Ok(())
}
