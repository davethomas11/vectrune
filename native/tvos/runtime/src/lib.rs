use rquickjs::{CaughtError, Context, Runtime, TypedArray};
use serde::Deserialize;
use std::collections::HashMap;
use std::ffi::{c_char, CStr};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU32, AtomicUsize, Ordering};
use std::time::{Duration, Instant};
use std::cell::UnsafeCell;
mod native_audio;
mod effects;
mod storage;

struct Audio {
    bridge: native_audio::Bridge,
    mixer: UnsafeCell<native_audio::Mixer>,
    effects: UnsafeCell<effects::Bank>,
    selected_effects: Arc<AtomicUsize>,
    output_gain: Arc<AtomicU32>,
    muted: Arc<std::sync::atomic::AtomicBool>,
}

#[no_mangle]
pub extern "C" fn rune_tv_audio_create() -> *mut std::ffi::c_void {
    let (mixer, bridge) = native_audio::Mixer::new(48000);
    Box::into_raw(Box::new(Audio { bridge, mixer: UnsafeCell::new(mixer), effects: UnsafeCell::new(effects::Bank::default()),
        selected_effects: Arc::new(AtomicUsize::new(usize::MAX)),
        output_gain: Arc::new(AtomicU32::new(1.0f32.to_bits())),
        muted: Arc::new(std::sync::atomic::AtomicBool::new(false)) })).cast()
}

// The host must call this from one audio render callback at a time.
#[no_mangle]
pub unsafe extern "C" fn rune_tv_audio_render(handle: *mut std::ffi::c_void, output: *mut f32, frames: usize) {
    if handle.is_null() || output.is_null() { return; }
    let mixer = &mut *(*handle.cast::<Audio>()).mixer.get();
    mixer.commands();
    let audio = &*handle.cast::<Audio>();
    let effects = &mut *audio.effects.get();
    effects.select(audio.selected_effects.load(Ordering::Acquire));
    let muted = (*handle.cast::<Audio>()).muted.load(std::sync::atomic::Ordering::Relaxed);
    let gain = f32::from_bits(audio.output_gain.load(Ordering::Relaxed));
    for sample in std::slice::from_raw_parts_mut(output, frames) {
        let (dry, sends) = mixer.sample();
        let mixed = effects.sample(dry, sends);
        *sample = if muted { 0.0 } else { (mixed * gain).clamp(-1.0, 1.0) };
        if sample.abs() > 1e-7 { audio.bridge.stats.nonzero.fetch_add(1, Ordering::Relaxed); }
        audio.bridge.stats.peak.fetch_max(sample.abs().to_bits(), Ordering::Relaxed);
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
pub struct Timings { simulation_ms: f64, transfer_ms: f64, native_ms: f64, hud_ms: f64,
    scheduler_ms: f64, step_ms: f64 }
struct Probe {
    context: Context, _runtime: Runtime, deadline: Arc<Mutex<Instant>>,
    assets: Assets, width: usize, height: usize, audio: bool,
    audio_muted: Option<Arc<std::sync::atomic::AtomicBool>>,
    audio_bridge: Option<native_audio::Bridge>,
    music_effect_indices: HashMap<String, usize>,
    selected_effects: Option<Arc<AtomicUsize>>,
    output_gain: Option<Arc<AtomicU32>>,
}

fn sync_music_effects(ctx: &rquickjs::Ctx<'_>, indices: &HashMap<String, usize>,
    selected: &AtomicUsize) -> Result<(), String> {
    let track: Option<String> = ctx.eval("__RunePixel3D.audioState.track")
        .map_err(|e| format!("Music effects selection: {}", CaughtError::from_error(ctx, e)))?;
    let index = track.as_ref().and_then(|name| indices.get(name)).copied().unwrap_or(usize::MAX);
    selected.store(index, Ordering::Release);
    Ok(())
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
        Err(panic) => {
            let detail = panic.downcast_ref::<String>().map(String::as_str)
                .or_else(|| panic.downcast_ref::<&str>().copied())
                .unwrap_or("unknown panic");
            set_error(error, size, &format!("Rust runtime panicked: {detail}"));
            None
        }
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
    if (!__RuneTVInput.visible()) {
        g.raycaster.buffer.fill(0);
        return g.raycaster.buffer;
    }
    const hud=g.frameHud(__tvHudState);
    if (hud.ui && __RuneTVInput.interactive)
        hud.ui={...hud.ui,detail:'',objective:''};
    g.raycaster.renderOverlay(hud);
    __RuneTVInput.overlay(__tvHudState.camera, __tvHudState.time);
    return g.raycaster.buffer;
};
"#;

/// Call before `rune_tv_create`; returns 0 on success. Saves persist in this directory.
#[no_mangle]
pub unsafe extern "C" fn rune_tv_set_storage_directory(path: *const c_char) -> i32 {
    if path.is_null() { return 1; }
    match CStr::from_ptr(path).to_str() {
        Ok(path) if storage::set_directory(path.into()).is_ok() => 0,
        _ => 1,
    }
}

#[no_mangle]
pub unsafe extern "C" fn rune_tv_create(source: *const c_char, width: u32, height: u32, audio: *mut std::ffi::c_void,
    error: *mut u8, error_bytes: usize) -> *mut std::ffi::c_void {
    guard(error, error_bytes, || {
        if source.is_null() { return Err("Missing compiled Rune source".into()); }
        let auto = width == 0 && height == 0;
        if !auto && !(width == 720 && height == 405) &&
            (width == 0 || height == 0 || width > 640 || height > 400 || width * 400 != height * 640) {
            return Err("Unsupported probe resolution".into());
        }
        let script = CStr::from_ptr(source).to_str().map_err(|e| e.to_string())?;
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
        let mut music_effect_indices = HashMap::new();
        let (assets, width, height) = context.with(|ctx| -> Result<(Assets, u32, u32), String> {
            storage::install(&ctx).map_err(|e| format!("Storage setup: {e}"))?;
            if !audio.is_null() {
                ctx.eval::<(), _>("globalThis.__runeTvMusic=(music)=>{globalThis.__tvMusic=music;}")
                    .map_err(|e| CaughtError::from_error(&ctx,e).to_string())?;
            }
            ctx.eval::<(), _>(script).map_err(|e| CaughtError::from_error(&ctx,e).to_string())?;
            let (width, height) = if auto {
                let dimensions: Vec<u32> = ctx.eval("__RunePixel3D.config.tv?.resolution ?? [640,400]")
                    .map_err(|e| format!("TV resolution: {}", CaughtError::from_error(&ctx,e)))?;
                match dimensions.as_slice() {
                    [640, 400] => (640, 400),
                    [720, 405] => (720, 405),
                    _ => return Err("TV resolution must be [640,400] or [720,405]".into()),
                }
            } else { (width, height) };
            if !audio.is_null() {
                let gain: f64 = ctx.eval("__RunePixel3D.config.tv?.master_volume ?? __RunePixel3D.config.tv?.audio_gain ?? 1")
                    .map_err(|e| format!("TV audio gain: {}", CaughtError::from_error(&ctx,e)))?;
                if !gain.is_finite() || !(0.0..=4.0).contains(&gain) {
                    return Err("TV master volume must be 0–4".into());
                }
                (*audio.cast::<Audio>()).output_gain.store((gain as f32).to_bits(), Ordering::Relaxed);
                let json: String = ctx.eval("JSON.stringify(Object.fromEntries(Object.entries(globalThis.__tvMusic ?? {}).map(([name, track]) => [name.trim().toLowerCase(), track?.effects ?? null])))")
                    .map_err(|e| format!("Music effects: {}", CaughtError::from_error(&ctx,e)))?;
                let configs: HashMap<String, Option<effects::Settings>> = serde_json::from_str(&json)
                    .map_err(|e| format!("Music effects configuration: {e}"))?;
                let mut bank = effects::Bank::default();
                for (name, config) in configs {
                    if let Some(config) = config {
                        let effect = effects::Effects::new(config, 48000)
                            .map_err(|e| format!("Music effects for {name}: {e}"))?;
                        music_effect_indices.insert(name, bank.push(effect));
                    }
                }
                *(*audio.cast::<Audio>()).effects.get() = bank;
                sync_music_effects(&ctx, &music_effect_indices, &(*audio.cast::<Audio>()).selected_effects)?;
            }
            ctx.eval::<(), _>(format!("__RunePixel3D.resizeViewport({width},{height},{height}/400);__RunePixel3D.raycaster.setEnhancedLighting(true)"))
                .map_err(|e| CaughtError::from_error(&ctx,e).to_string())?;
            if (width, height) == (640, 400) || (width, height) == (720, 405) {
                ctx.eval::<(), _>(include_str!("tv_input.js"))
                    .map_err(|e| format!("TV input setup: {}", CaughtError::from_error(&ctx,e)))?;
            } else {
                ctx.eval::<(), _>("globalThis.__RuneTVInput={interactive:false,overlay:()=>{},visible:()=>true}")
                    .map_err(|e| CaughtError::from_error(&ctx,e).to_string())?;
            }
            ctx.eval::<(), _>(INSTALL).map_err(|e| CaughtError::from_error(&ctx,e).to_string())?;
            let json: String = ctx.eval("JSON.stringify({models:__RunePixel3D.config.models,textures:__RunePixel3D.config.textures,sky:__RunePixel3D.config.map.sky})")
                .map_err(|e| CaughtError::from_error(&ctx,e).to_string())?;
            let assets = serde_json::from_str(&json).map_err(|e| format!("Invalid scene assets: {e}"))?;
            Ok((assets, width, height))
        })?;
        let audio_muted = if audio.is_null() { None } else { Some((*audio.cast::<Audio>()).muted.clone()) };
        let audio_bridge = if audio.is_null() { None } else { Some((*audio.cast::<Audio>()).bridge.clone()) };
        let selected_effects = if audio.is_null() { None } else { Some((*audio.cast::<Audio>()).selected_effects.clone()) };
        let output_gain = if audio.is_null() { None } else { Some((*audio.cast::<Audio>()).output_gain.clone()) };
        Ok(Box::into_raw(Box::new(Probe { context, _runtime: runtime, deadline, assets,
            width: width as usize, height: height as usize, audio: !audio.is_null(), audio_muted, audio_bridge,
            music_effect_indices, selected_effects, output_gain })).cast())
    }).unwrap_or(std::ptr::null_mut())
}

#[no_mangle]
pub unsafe extern "C" fn rune_tv_dimensions(handle: *mut std::ffi::c_void, width: *mut u32, height: *mut u32) -> i32 {
    if handle.is_null() || width.is_null() || height.is_null() { return -1; }
    let probe = &*handle.cast::<Probe>();
    *width = probe.width as u32;
    *height = probe.height as u32;
    0
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
        if !matches!((probe.width, probe.height), (640, 400) | (720, 405)) {
            return Err("Remote input requires a full-size TV resolution".into());
        }
        *probe.deadline.lock().map_err(|e|e.to_string())? = Instant::now()+Duration::from_secs(10);
        let (handled, muted) = probe.context.with(|ctx| -> Result<(bool,bool),String> {
            let handled = ctx.eval::<bool, _>(format!("__RuneTVInput.input('{command}')"))
                .map_err(|e| format!("Remote input: {}", CaughtError::from_error(&ctx,e)))?;
            let muted = ctx.eval::<bool, _>("__RunePixel3D.muted")
                .map_err(|e| format!("Remote mute: {}", CaughtError::from_error(&ctx,e)))?;
            if let Some(output_gain) = &probe.output_gain {
                let gain: f64 = ctx.eval("__RuneTVInput.volume()")
                    .map_err(|e| format!("Remote volume: {}", CaughtError::from_error(&ctx,e)))?;
                if !gain.is_finite() || !(0.0..=4.0).contains(&gain) {
                    return Err("Remote volume must be 0–4".into());
                }
                output_gain.store((gain as f32).to_bits(), Ordering::Relaxed);
            }
            if let Some(selected) = &probe.selected_effects {
                sync_music_effects(&ctx, &probe.music_effect_indices, selected)?;
            }
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
            stats.scheduler_ms=ms(start);
            let step_start=Instant::now();
            for _ in 0..ticks {
                ctx.eval::<(), _>("__RunePixel3D.step({})").map_err(|e| format!("simulation: {}", CaughtError::from_error(&ctx,e)))?;
            }
            stats.step_ms=ms(step_start);
            if let Some(selected) = &probe.selected_effects {
                sync_music_effects(&ctx, &probe.music_effect_indices, selected)?;
            }
            stats.simulation_ms=ms(start);
            let start=Instant::now();
            let json: String = ctx.eval("__tvSnapshot()").map_err(|e| format!("scene snapshot: {}", CaughtError::from_error(&ctx,e)))?;
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
            let camera=VoxelCamera { x:snapshot.camera.x, y:snapshot.camera.y, z:snapshot.camera.z.unwrap_or(0.0),
                angle:snapshot.camera.angle, pitch:snapshot.camera.pitch.unwrap_or(0.0) };
            let world=VoxelWorld { width:snapshot.width,height:snapshot.height,depth:snapshot.depth,
                cells:&cells,materials:&textures,render_distance:snapshot.render_distance };
            let scene=EnhancedVoxelScene { world:&world,camera:&camera,fov:snapshot.fov,sky:probe.assets.sky.as_ref(),
                time:snapshot.time,models:&models,lights:&snapshot.lights };
            let start=Instant::now();
            let frame=render_enhanced_voxel_scene(&scene,probe.width,probe.height).map_err(|e| format!("native render: {e:#}"))?;
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
            stats.hud_ms=ms(start);
            Ok(())
        })?;
        let output=std::slice::from_raw_parts_mut(pixels,pixel_bytes);
        for (dst, pixel) in output.chunks_exact_mut(4).zip(frame) { dst.copy_from_slice(&pixel.to_le_bytes()); }
        *timings=stats;
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
                if(old && __RuneTVInput.interactive)
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

/// Writes pending progress immediately; call when the app leaves the foreground.
#[no_mangle]
pub unsafe extern "C" fn rune_tv_flush_save(handle: *mut std::ffi::c_void, error: *mut u8, error_bytes: usize) -> i32 {
    guard(error, error_bytes, || {
        if handle.is_null() { return Err("Missing runtime for save".into()); }
        let probe = &mut *handle.cast::<Probe>();
        *probe.deadline.lock().map_err(|e|e.to_string())? = Instant::now()+Duration::from_secs(10);
        probe.context.with(|ctx| ctx.eval::<(), _>("__RunePixel3D.flushSave()")
            .map_err(|e| format!("Save: {}", CaughtError::from_error(&ctx,e))))
    }).map_or(-1, |_| 0)
}

#[no_mangle]
pub unsafe extern "C" fn rune_tv_destroy(handle: *mut std::ffi::c_void) {
    if !handle.is_null() { drop(Box::from_raw(handle.cast::<Probe>())); }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remote_volume_reaches_audio_callback() {
        let script = std::ffi::CString::new(r#"
            globalThis.__RunePixel3D = {
                config: { tv: { master_volume: 2, volume_control: true, resolution: [720,405] }, models: {}, textures: {}, map: { sky: null } },
                audioState: { track: null }, muted: false,
                raycaster: { setEnhancedLighting() {} }, resizeViewport() {}
            };
            globalThis.__RunePixel3DRuntime = {
                createTvNavigation() {
                    let gain = 2;
                    return { input(command) { if (command === 'right') gain += 0.25; return true; },
                        volume() { return gain; }, overlay() {} };
                }
            };
        "#).unwrap();
        let audio_handle = rune_tv_audio_create();
        let mut error = [0u8; 1024];
        for (requested, expected) in [((640, 400), (640, 400)), ((0, 0), (720, 405))] {
            let probe = unsafe { rune_tv_create(script.as_ptr(), requested.0, requested.1, audio_handle,
                error.as_mut_ptr(), error.len()) };
            assert!(!probe.is_null(), "create: {}", String::from_utf8_lossy(&error));
            let mut width = 0;
            let mut height = 0;
            assert_eq!(unsafe { rune_tv_dimensions(probe, &mut width, &mut height) }, 0);
            assert_eq!((width, height), expected);
            let audio = unsafe { &*audio_handle.cast::<Audio>() };
            assert_eq!(f32::from_bits(audio.output_gain.load(Ordering::Relaxed)), 2.0);
            assert_eq!(unsafe { rune_tv_input(probe, 3, error.as_mut_ptr(), error.len()) }, 0);
            assert_eq!(f32::from_bits(audio.output_gain.load(Ordering::Relaxed)), 2.25);
            unsafe { rune_tv_destroy(probe); }
        }
        unsafe { rune_tv_audio_destroy(audio_handle); }
    }

    #[test]
    fn tv_output_gain_amplifies_pcm_and_preserves_mute_and_bounds() {
        fn render(gain: f32, volume: f64, muted: bool) -> (Vec<f32>, AudioStats) {
            let handle = rune_tv_audio_create();
            let audio = unsafe { &*handle.cast::<Audio>() };
            audio.output_gain.store(gain.to_bits(), Ordering::Relaxed);
            audio.muted.store(muted, Ordering::Relaxed);
            let tone: native_audio::Tone = serde_json::from_value(serde_json::json!({
                "frequency": 440, "duration": 0.1, "volume": volume
            })).unwrap();
            audio.bridge.tone(&tone).unwrap();
            let mut output = vec![0.0; 4800];
            unsafe { rune_tv_audio_render(handle, output.as_mut_ptr(), output.len()); }
            let mut stats = AudioStats { frames: 0, nonzero: 0, peak: 0.0, dropped: 0 };
            unsafe { rune_tv_audio_stats(handle, &mut stats); rune_tv_audio_destroy(handle); }
            (output, stats)
        }
        let (normal, normal_stats) = render(1.0, 0.05, false);
        let (louder, loud_stats) = render(3.0, 0.05, false);
        for (one, three) in normal.iter().zip(&louder) {
            assert!((three - one * 3.0).abs() < 1e-6);
        }
        assert!(normal_stats.peak > 0.0);
        assert!((loud_stats.peak - normal_stats.peak * 3.0).abs() < 1e-6);
        let (bounded, _) = render(4.0, 0.5, false);
        assert!(bounded.iter().all(|sample| sample.is_finite() && sample.abs() <= 1.0));
        let (silent, stats) = render(3.0, 0.05, true);
        assert!(silent.iter().all(|sample| *sample == 0.0));
        assert_eq!(stats.nonzero, 0);
        assert_eq!(stats.peak, 0.0);
    }

    #[test]
    fn frames_keep_rendering_when_console_disconnects() {
        use std::io::{Read, Write};
        use std::process::{Command, Stdio};

        if std::env::var_os("RUNE_TEST_DISCONNECTED_CONSOLE").is_none() {
            let mut child = Command::new(std::env::current_exe().unwrap())
                .args(["--exact", "tests::frames_keep_rendering_when_console_disconnects", "--nocapture"])
                .env("RUNE_TEST_DISCONNECTED_CONSOLE", "1")
                .stdin(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();
            drop(child.stderr.take());
            child.stdin.take().unwrap().write_all(b"x").unwrap();
            assert!(child.wait().unwrap().success(), "rendering failed after console disconnect");
            return;
        }
        std::io::stdin().read_exact(&mut [0]).unwrap();
        let script = std::ffi::CString::new(r#"
            globalThis.__RunePixel3D = {
                config: { models: {}, textures: { ground: { width: 1, height: 1, pixels: [0] } }, map: { sky: null } },
                raycaster: { config: { world: { width: 1, height: 1, depth: 1, cells: [0], materials: ['ground'] } },
                    fov: 66, buffer: new Uint32Array(40), setEnhancedLighting() {},
                    renderOverlay() { this.buffer.fill(0); } },
                resizeViewport() {}, step() {},
                renderState() { return { camera: { x: 0.5, y: 0.5, z: 0.5, angle: 0 },
                    things: [], tethers: [], lights: [], time: 0 }; },
                frameHud() { return {}; }
            };
        "#).unwrap();
        let mut error = [0u8; 1024];
        let handle = unsafe { rune_tv_create(script.as_ptr(), 8, 5, std::ptr::null_mut(),
            error.as_mut_ptr(), error.len()) };
        assert!(!handle.is_null(), "create: {}", String::from_utf8_lossy(&error));
        let mut pixels = [0u8; 8 * 5 * 4];
        let mut timings = Timings::default();
        for _ in 0..305 {
            let result = unsafe { rune_tv_frame(handle, 1, pixels.as_mut_ptr(), pixels.len(),
                &mut timings, error.as_mut_ptr(), error.len()) };
            assert_eq!(result, 0, "frame: {}", String::from_utf8_lossy(&error));
        }
        unsafe { rune_tv_destroy(handle); }
    }

    #[test]
    fn music_selection_follows_active_track_and_disables_missing_effects() {
        let runtime = Runtime::new().unwrap();
        let context = Context::full(&runtime).unwrap();
        let selected = AtomicUsize::new(usize::MAX);
        let indices = HashMap::from([("first".to_string(), 0), ("second".to_string(), 1)]);
        context.with(|ctx| {
            ctx.eval::<(), _>("globalThis.__RunePixel3D={audioState:{track:'first'}}").unwrap();
            sync_music_effects(&ctx, &indices, &selected).unwrap();
            assert_eq!(selected.load(Ordering::Acquire), 0);
            ctx.eval::<(), _>("__RunePixel3D.audioState.track='second'").unwrap();
            sync_music_effects(&ctx, &indices, &selected).unwrap();
            assert_eq!(selected.load(Ordering::Acquire), 1);
            ctx.eval::<(), _>("__RunePixel3D.audioState.track='dry'").unwrap();
            sync_music_effects(&ctx, &indices, &selected).unwrap();
            assert_eq!(selected.load(Ordering::Acquire), usize::MAX);
            ctx.eval::<(), _>("__RunePixel3D.audioState.track=null").unwrap();
            sync_music_effects(&ctx, &indices, &selected).unwrap();
            assert_eq!(selected.load(Ordering::Acquire), usize::MAX);
        });
    }
}
