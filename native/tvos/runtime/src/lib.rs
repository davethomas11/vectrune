use rquickjs::{CaughtError, Context, Runtime, TypedArray};
use serde::Deserialize;
use std::collections::HashMap;
use std::ffi::{c_char, CStr};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::cell::UnsafeCell;
mod native_audio;
mod effects;

struct Audio {
    bridge: native_audio::Bridge,
    mixer: UnsafeCell<native_audio::Mixer>,
    effects: UnsafeCell<Option<effects::Effects>>,
    muted: Arc<std::sync::atomic::AtomicBool>,
}

#[no_mangle]
pub extern "C" fn rune_tv_audio_create() -> *mut std::ffi::c_void {
    let (mixer, bridge) = native_audio::Mixer::new(48000);
    Box::into_raw(Box::new(Audio { bridge, mixer: UnsafeCell::new(mixer), effects: UnsafeCell::new(None),
        muted: Arc::new(std::sync::atomic::AtomicBool::new(false)) })).cast()
}

// The host must call this from one audio render callback at a time.
#[no_mangle]
pub unsafe extern "C" fn rune_tv_audio_render(handle: *mut std::ffi::c_void, output: *mut f32, frames: usize) {
    if handle.is_null() || output.is_null() { return; }
    let mixer = &mut *(*handle.cast::<Audio>()).mixer.get();
    mixer.commands();
    let effects = &mut *(*handle.cast::<Audio>()).effects.get();
    let muted = (*handle.cast::<Audio>()).muted.load(std::sync::atomic::Ordering::Relaxed);
    for sample in std::slice::from_raw_parts_mut(output, frames) {
        let (dry, sends) = mixer.sample();
        let mixed = effects.as_mut().map_or(dry, |fx| fx.sample(dry, sends));
        *sample = if muted { 0.0 } else { mixed.clamp(-1.0, 1.0) };
    }
    mixer.publish_clock();
}

#[repr(C)]
pub struct AudioStats { frames: u64, nonzero: u64, peak: f32, dropped: u64 }
#[no_mangle]
pub unsafe extern "C" fn rune_tv_audio_stats(handle: *const std::ffi::c_void, stats: *mut AudioStats) {
    if handle.is_null() || stats.is_null() { return; }
    let data = &(*handle.cast::<Audio>()).bridge.stats;
    use std::sync::atomic::Ordering;
    *stats = AudioStats { frames: data.frames.load(Ordering::Relaxed),
        nonzero: data.nonzero.load(Ordering::Relaxed),
        peak: f32::from_bits(data.peak.load(Ordering::Relaxed)),
        dropped: data.dropped.load(Ordering::Relaxed) };
}

// Stop and dispose the audio engine before destroying the handle.
#[no_mangle]
pub unsafe extern "C" fn rune_tv_audio_destroy(handle: *mut std::ffi::c_void) {
    if !handle.is_null() { drop(Box::from_raw(handle.cast::<Audio>())); }
}

mod pixel3d;
use pixel3d::{lighting::PointLight, model::BlockModel, raster::{Sky, Texture, Thing3D},
    voxel::{VoxelCamera, VoxelWorld}, voxel_scene::{EnhancedVoxelScene, VoxelSceneModel, render_enhanced_voxel_scene}};

#[derive(Deserialize)]
struct Assets { models: HashMap<String, ModelAsset>, textures: HashMap<String, Texture>, sky: Option<Sky> }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelAsset { #[serde(flatten)] model: BlockModel, glass: Option<[f64; 2]>, contact_shadow: Option<f64> }
#[derive(Deserialize)]
struct Camera { x: f64, y: f64, z: Option<f64>, angle: f64, pitch: Option<f64> }
#[derive(Deserialize)]
struct Entity { #[serde(flatten)] thing: Thing3D, pitch: Option<f64> }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Snapshot {
    width: usize, height: usize, depth: usize, cells: Option<Vec<u16>>,
    chunks: Option<HashMap<String, Vec<u16>>>, materials: Vec<String>,
    render_distance: Option<f64>, camera: Camera, fov: f64, time: f64,
    things: Vec<Entity>, lights: Vec<PointLight>,
}

impl Snapshot {
    fn dense_cells(&self) -> Result<Vec<u16>, String> {
        let volume = self.width.checked_mul(self.height).and_then(|v| v.checked_mul(self.depth))
            .filter(|&v| self.width > 0 && self.width <= 4096 && self.height > 0 &&
                self.height <= 4096 && self.depth > 0 && self.depth <= 24 && v <= 55296)
            .ok_or("Unsupported voxel dimensions")?;
        if let Some(cells) = &self.cells {
            if self.chunks.is_some() || cells.len() != volume { return Err("Invalid dense voxel storage".into()); }
            return Ok(cells.clone());
        }
        let chunks = self.chunks.as_ref().ok_or("Missing voxel storage")?;
        let cw = self.width.div_ceil(4);
        let ch = self.height.div_ceil(4);
        let cd = self.depth.div_ceil(4);
        let mut cells = vec![0; volume];
        for (key, chunk) in chunks {
            let id: usize = key.parse().map_err(|_| format!("Invalid voxel chunk index: {key}"))?;
            if id >= cw * ch * cd || chunk.len() != 64 { return Err(format!("Invalid voxel chunk: {key}")); }
            let bx = id % cw * 4;
            let by = (id / cw) % ch * 4;
            let bz = id / (cw * ch) * 4;
            for (i, &block) in chunk.iter().enumerate() {
                let x = bx + (i & 3);
                let y = by + ((i >> 2) & 3);
                let z = bz + (i >> 4);
                if x < self.width && y < self.height && z < self.depth {
                    cells[(z * self.height + y) * self.width + x] = block;
                } else if block != 0 { return Err(format!("Voxel chunk {key} extends outside world")); }
            }
        }
        Ok(cells)
    }
}

#[repr(C)]
#[derive(Default)]
pub struct Timings { simulation_ms: f64, transfer_ms: f64, native_ms: f64, hud_ms: f64 }
struct Probe {
    context: Context, _runtime: Runtime, deadline: Arc<Mutex<Instant>>,
    assets: Assets, width: usize, height: usize, frames: usize, audio: bool,
    audio_muted: Option<Arc<std::sync::atomic::AtomicBool>>,
    audio_bridge: Option<native_audio::Bridge>,
}

fn set_error(error: *mut u8, size: usize, text: &str) {
    if error.is_null() || size == 0 { return; }
    let message = unsafe { std::slice::from_raw_parts_mut(error, size) };
    let len = text.len().min(size - 1);
    message[..len].copy_from_slice(&text.as_bytes()[..len]);
    message[len] = 0;
}
fn guard<T>(error: *mut u8, size: usize, f: impl FnOnce() -> Result<T, String>) -> Option<T> {
    set_error(error, size, "");
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)) {
        Ok(Ok(value)) => Some(value),
        Ok(Err(text)) => { set_error(error, size, &text); None },
        Err(_) => { set_error(error, size, "Rust runtime panicked"); None }
    }
}
fn ms(start: Instant) -> f64 { start.elapsed().as_secs_f64() * 1000.0 }

const INSTALL: &str = r#"
globalThis.__tvSnapshot = () => {
    const g=__RunePixel3D, s=g.renderState(), w=g.raycaster.config.world;
    if (!w) throw Error('Native probe requires a voxel world');
    if (s.title_scene || s.tethers.length || s.weapon || s.flash || s.camera.backdrop ||
        s.camera.terrainPose || s.ui?.cinema?.fade || g.raycaster.palette || g.raycaster.silhouettes)
        throw Error('Native probe encountered an unsupported scene feature');
    for (const t of s.things) {
        if (t.visible === false) continue;
        if (!t.model || t.sprite || t.title !== undefined || t.axisTilt !== undefined || t.axialScale !== undefined)
            throw Error('Native probe encountered an unsupported model or overlay');
    }
    globalThis.__tvHudState=s;
    const terrain=w.storage==='chunked' ? {chunks:w.chunks} :
        w.storage===undefined ? {cells:Array.from(w.cells)} : (()=>{throw Error('Unsupported voxel storage');})();
    return JSON.stringify({width:w.width,height:w.height,depth:w.depth,...terrain,
        materials:w.materials,renderDistance:w.renderDistance,camera:s.camera,fov:g.raycaster.fov,
        time:s.time,things:s.things,lights:s.lights});
};
globalThis.__tvHud = () => {
    const g=__RunePixel3D;
    const hud=g.frameHud(__tvHudState);
    if (hud.ui && g.raycaster.width===640 && g.raycaster.height===400)
        hud.ui={...hud.ui,detail:'',objective:''};
    g.raycaster.renderOverlay(hud);
    __RuneTVInput.overlay(__tvHudState.camera, __tvHudState.time);
    return g.raycaster.buffer;
};
"#;

#[no_mangle]
pub unsafe extern "C" fn rune_tv_create(source: *const c_char, width: u32, height: u32, audio: *mut std::ffi::c_void,
    error: *mut u8, error_bytes: usize) -> *mut std::ffi::c_void {
    guard(error, error_bytes, || {
        if source.is_null() { return Err("Missing compiled Rune source".into()); }
        if width == 0 || height == 0 || width > 640 || height > 400 || width * 400 != height * 640 {
            return Err("Unsupported probe resolution".into());
        }
        let script = CStr::from_ptr(source).to_str().map_err(|e| e.to_string())?;
        let instrumented = if !audio.is_null() {
            let marker = "__RunePixel3DRuntime.boot({";
            if script.matches(marker).count() != 1 { return Err("Cannot inspect compiled music configuration".into()); }
            Some(script.replacen(marker, "((options)=>{globalThis.__tvMusic=options.music;return __RunePixel3DRuntime.boot(options);})({", 1))
        } else { None };
        let runtime = Runtime::new().map_err(|e| e.to_string())?;
        runtime.set_memory_limit(128 * 1024 * 1024);
        runtime.set_max_stack_size(1024 * 1024);
        let deadline = Arc::new(Mutex::new(Instant::now() + Duration::from_secs(10)));
        let interrupt = deadline.clone();
        runtime.set_interrupt_handler(Some(Box::new(move || Instant::now() >= *interrupt.lock().unwrap())));
        let context = Context::full(&runtime).map_err(|e| e.to_string())?;
        if !audio.is_null() {
            (*audio.cast::<Audio>()).bridge.install(&context).map_err(|e| format!("Audio setup: {e:#}"))?;
        }
        let assets = context.with(|ctx| -> Result<Assets, String> {
            ctx.eval::<(), _>(instrumented.as_deref().unwrap_or(script)).map_err(|e| CaughtError::from_error(&ctx,e).to_string())?;
            if !audio.is_null() {
                let json: String = ctx.eval("JSON.stringify(__tvMusic.glowtide_drift.effects)")
                    .map_err(|e| format!("Music effects: {}", CaughtError::from_error(&ctx,e)))?;
                let config: effects::Settings = serde_json::from_str(&json).map_err(|e| format!("Music effects configuration: {e}"))?;
                *(*audio.cast::<Audio>()).effects.get() = Some(effects::Effects::new(config, 48000)?);
            }
            ctx.eval::<(), _>(format!("__RunePixel3D.resizeViewport({width},{height},{width}/640);__RunePixel3D.raycaster.setEnhancedLighting(true)"))
                .map_err(|e| CaughtError::from_error(&ctx,e).to_string())?;
            if width == 640 && height == 400 {
                ctx.eval::<(), _>(include_str!("tv_input.js"))
                    .map_err(|e| format!("TV input setup: {}", CaughtError::from_error(&ctx,e)))?;
            } else {
                ctx.eval::<(), _>("globalThis.__RuneTVInput={overlay:()=>{}}")
                    .map_err(|e| CaughtError::from_error(&ctx,e).to_string())?;
            }
            ctx.eval::<(), _>(INSTALL).map_err(|e| CaughtError::from_error(&ctx,e).to_string())?;
            let json: String = ctx.eval("JSON.stringify({models:__RunePixel3D.config.models,textures:__RunePixel3D.config.textures,sky:__RunePixel3D.config.map.sky})")
                .map_err(|e| CaughtError::from_error(&ctx,e).to_string())?;
            serde_json::from_str(&json).map_err(|e| format!("Invalid scene assets: {e}"))
        })?;
        let audio_muted = if audio.is_null() { None } else { Some((*audio.cast::<Audio>()).muted.clone()) };
        let audio_bridge = if audio.is_null() { None } else { Some((*audio.cast::<Audio>()).bridge.clone()) };
        Ok(Box::into_raw(Box::new(Probe { context, _runtime: runtime, deadline, assets,
            width: width as usize, height: height as usize, frames: 0, audio: !audio.is_null(), audio_muted, audio_bridge })).cast())
    }).unwrap_or(std::ptr::null_mut())
}

#[no_mangle]
pub unsafe extern "C" fn rune_tv_input(handle: *mut std::ffi::c_void, command: u32,
    error: *mut u8, error_bytes: usize) -> i32 {
    guard(error, error_bytes, || {
        if handle.is_null() { return Err("Missing runtime for remote input".into()); }
        let command = match command {
            0 => "up", 1 => "down", 2 => "left", 3 => "right", 4 => "select", 5 => "back",
            _ => return Err("Unknown remote input".into()),
        };
        let probe = &mut *handle.cast::<Probe>();
        if probe.width != 640 || probe.height != 400 { return Err("Remote input requires 640 x 400".into()); }
        *probe.deadline.lock().map_err(|e|e.to_string())? = Instant::now()+Duration::from_secs(10);
        let (handled, muted) = probe.context.with(|ctx| -> Result<(bool,bool),String> {
            let handled = ctx.eval::<bool, _>(format!("__RuneTVInput.input('{command}')"))
                .map_err(|e| format!("Remote input: {}", CaughtError::from_error(&ctx,e)))?;
            let muted = ctx.eval::<bool, _>("__RunePixel3D.muted")
                .map_err(|e| format!("Remote mute: {}", CaughtError::from_error(&ctx,e)))?;
            Ok((handled, muted))
        })?;
        if let Some(flag) = &probe.audio_muted { flag.store(muted, std::sync::atomic::Ordering::Relaxed); }
        if handled && !muted {
            if let Some(bridge) = &probe.audio_bridge {
                bridge.ui_cue(command == "select").map_err(|e| format!("Remote audio cue: {e:#}"))?;
            }
        }
        Ok(())
    }).map_or(-1, |_| 0)
}

#[no_mangle]
pub unsafe extern "C" fn rune_tv_frame(handle: *mut std::ffi::c_void, ticks: u32,
    pixels: *mut u8, pixel_bytes: usize, timings: *mut Timings, error: *mut u8, error_bytes: usize) -> i32 {
    guard(error, error_bytes, || {
        static FIRST: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(true);
        let log = FIRST.swap(false, std::sync::atomic::Ordering::Relaxed);
        if log { eprintln!("Rune native probe: frame entered"); }
        if handle.is_null() || pixels.is_null() || timings.is_null() || ticks > 5 {
            return Err("Invalid frame arguments".into());
        }
        let probe = &mut *handle.cast::<Probe>();
        if pixel_bytes != probe.width * probe.height * 4 { return Err("Framebuffer size mismatch".into()); }
        *probe.deadline.lock().map_err(|e| e.to_string())? = Instant::now() + Duration::from_secs(10);
        let mut stats = Timings::default();
        let mut frame = probe.context.with(|ctx| -> Result<_, String> {
            let start=Instant::now();
            if probe.audio {
                ctx.eval::<(), _>("__RuneNativeAudio.pump()").map_err(|e| format!("audio scheduler: {}", CaughtError::from_error(&ctx,e)))?;
            }
            for _ in 0..ticks {
                ctx.eval::<(), _>("__RunePixel3D.step({})").map_err(|e| format!("simulation: {}", CaughtError::from_error(&ctx,e)))?;
            }
            stats.simulation_ms=ms(start);
            let start=Instant::now();
            let json: String = ctx.eval("__tvSnapshot()").map_err(|e| format!("scene snapshot: {}", CaughtError::from_error(&ctx,e)))?;
            if log { eprintln!("Rune native probe: snapshot ready"); }
            let snapshot: Snapshot = serde_json::from_str(&json).map_err(|e| format!("Invalid scene snapshot: {e}"))?;
            let cells = snapshot.dense_cells().map_err(|e| format!("Invalid scene terrain: {e}"))?;
            let textures: Vec<&Texture> = snapshot.materials.iter().map(|name|
                probe.assets.textures.get(name).ok_or_else(|| format!("Unknown material {name}")))
                .collect::<Result<_,_>>()?;
            let models: Vec<_> = snapshot.things.iter().filter(|e| e.thing.visible != Some(false)).map(|entity| {
                let name=entity.thing.model.as_ref().ok_or("Missing model name")?;
                let asset=probe.assets.models.get(name).ok_or_else(|| format!("Unknown model {name}"))?;
                Ok(VoxelSceneModel { instance:&entity.thing, model:&asset.model, pitch:entity.pitch.unwrap_or(0.0),
                    glass:asset.glass, contact_shadow:asset.contact_shadow })
            }).collect::<Result<_, String>>()?;
            stats.transfer_ms=ms(start);
            if log { eprintln!("Rune native probe: scene decoded"); }
            let camera=VoxelCamera { x:snapshot.camera.x, y:snapshot.camera.y, z:snapshot.camera.z.unwrap_or(0.0),
                angle:snapshot.camera.angle, pitch:snapshot.camera.pitch.unwrap_or(0.0) };
            let world=VoxelWorld { width:snapshot.width,height:snapshot.height,depth:snapshot.depth,
                cells:&cells,materials:&textures,render_distance:snapshot.render_distance };
            let scene=EnhancedVoxelScene { world:&world,camera:&camera,fov:snapshot.fov,sky:probe.assets.sky.as_ref(),
                time:snapshot.time,models:&models,lights:&snapshot.lights };
            let start=Instant::now();
            let frame=render_enhanced_voxel_scene(&scene,probe.width,probe.height).map_err(|e| format!("native render: {e:#}"))?;
            if log { eprintln!("Rune native probe: native frame ready"); }
            stats.native_ms=ms(start);
            Ok(frame.color)
        })?;
        probe.context.with(|ctx| -> Result<(), String> {
            let start=Instant::now();
            let hud: TypedArray<u32>=ctx.eval("__tvHud()").map_err(|e| format!("HUD: {}", CaughtError::from_error(&ctx,e)))?;
            let overlay=hud.as_bytes().ok_or("Detached HUD")?;
            if overlay.len()!=pixel_bytes { return Err("HUD size mismatch".into()); }
            let values: Vec<u32>=overlay.chunks_exact(4).map(|p|u32::from_ne_bytes([p[0],p[1],p[2],p[3]])).collect();
            pixel3d::overlay::composite_hud(&mut frame,&values,probe.width,probe.height).map_err(|e|format!("HUD composition: {e}"))?;
            if log { eprintln!("Rune native probe: HUD ready"); }
            stats.hud_ms=ms(start);
            Ok(())
        })?;
        let output=std::slice::from_raw_parts_mut(pixels,pixel_bytes);
        for (dst, pixel) in output.chunks_exact_mut(4).zip(frame) { dst.copy_from_slice(&pixel.to_le_bytes()); }
        *timings=stats;
        probe.frames += 1;
        if probe.frames % 300 == 0 {
            let usage = probe._runtime.memory_usage();
            eprintln!("Rune native probe: frame {} QuickJS allocated {} bytes, used {} bytes", probe.frames, usage.malloc_size, usage.memory_used_size);
        }
        Ok(())
    }).map_or(-1, |_| 0)
}

#[no_mangle]
pub unsafe extern "C" fn rune_tv_reference(handle: *mut std::ffi::c_void, pixels: *mut u8,
    pixel_bytes: usize, error: *mut u8, error_bytes: usize) -> i32 {
    guard(error, error_bytes, || {
        if handle.is_null() || pixels.is_null() { return Err("Invalid reference arguments".into()); }
        let probe=&mut *handle.cast::<Probe>();
        if pixel_bytes != probe.width*probe.height*4 { return Err("Framebuffer size mismatch".into()); }
        *probe.deadline.lock().map_err(|e|e.to_string())? = Instant::now()+Duration::from_secs(10);
        probe.context.with(|ctx| -> Result<(),String> {
            let frame: TypedArray<u32>=ctx.eval(r#"(()=>{
                const g=__RunePixel3D, key=g.config.ui, old=key && g.app.state[key];
                if(old && g.raycaster.width===640 && g.raycaster.height===400)
                    g.app.state[key]={...old,detail:'',objective:''};
                try {
                    const frame=g.frame();
                    __RuneTVInput.overlay(__tvHudState.camera,__tvHudState.time);
                    return frame;
                } finally { if(old) g.app.state[key]=old; }
            })()"#).map_err(|e|CaughtError::from_error(&ctx,e).to_string())?;
            let bytes=frame.as_bytes().ok_or("Detached reference")?;
            if bytes.len()!=pixel_bytes { return Err("Reference size mismatch".into()); }
            std::slice::from_raw_parts_mut(pixels,pixel_bytes).copy_from_slice(bytes);
            Ok(())
        })
    }).map_or(-1, |_| 0)
}

#[no_mangle]
pub unsafe extern "C" fn rune_tv_destroy(handle: *mut std::ffi::c_void) {
    if !handle.is_null() { drop(Box::from_raw(handle.cast::<Probe>())); }
}
