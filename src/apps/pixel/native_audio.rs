//! Shared-synth voice bridge and bounded native PCM mixer.
//! QuickJS runs on the window thread. The audio callback only consumes voice data.
use anyhow::{Context as _, Result};
use crossbeam_queue::ArrayQueue;
use serde::Deserialize;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU32, AtomicU64, Ordering},
        Arc,
    },
    time::Instant,
};

#[cfg(feature = "pixel-desktop")]
mod output;
#[cfg(feature = "pixel-desktop")]
pub use output::Output;

const MAX_VOICES: usize = 128;
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Ramp {
    Set,
    Linear,
    Exponential,
}
#[derive(Clone, Debug, Deserialize)]
struct Event {
    time: f64,
    value: f64,
    ramp: Ramp,
}
#[derive(Clone, Debug, Deserialize)]
struct Envelope {
    initial: f64,
    events: Vec<Event>,
}
impl Envelope {
    fn at(&self, time: f64) -> f64 {
        let (mut at, mut value) = (0.0, self.initial);
        for event in &self.events {
            if time < event.time {
                let fraction = ((time - at) / (event.time - at).max(1e-9)).clamp(0.0, 1.0);
                return match event.ramp {
                    Ramp::Set => value,
                    Ramp::Linear => value + (event.value - value) * fraction,
                    Ramp::Exponential if value > 0.0 && event.value > 0.0 => {
                        value * (event.value / value).powf(fraction)
                    }
                    Ramp::Exponential => value,
                };
            }
            at = event.time;
            value = event.value;
        }
        value
    }
    fn valid(&self) -> bool {
        self.initial.is_finite()
            && self.events.len() <= 64
            && self
                .events
                .iter()
                .all(|e| e.time.is_finite() && e.time >= 0.0 && e.value.is_finite())
            && self.events.windows(2).all(|e| e[0].time <= e[1].time)
    }
}
#[derive(Debug, Deserialize)]
struct Gain {
    id: u64,
    connected: bool,
    envelope: Envelope,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Wave {
    Sine,
    Square,
    Triangle,
    Sawtooth,
    Noise,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum FilterKind {
    Lowpass,
    Highpass,
    Bandpass,
}
#[derive(Debug, Deserialize)]
struct Filter {
    kind: FilterKind,
    frequency: Envelope,
    q: f64,
}
#[derive(Debug, Deserialize)]
struct VoiceSpec {
    wave: Wave,
    start: f64,
    end: f64,
    frequency: Envelope,
    #[serde(default)]
    routes: Vec<u64>,
    gains: Vec<Gain>,
    filters: Vec<Filter>,
    seed: u32,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
enum Command {
    Voice(VoiceSpec),
    Gain { gain: Gain },
}
impl Command {
    fn valid(&self) -> bool {
        match self {
            Self::Gain { gain } => gain.envelope.valid(),
            Self::Voice(v) => {
                v.start.is_finite()
                    && v.end.is_finite()
                    && v.start >= 0.0
                    && v.end > v.start
                    && v.end - v.start <= 60.0
                    && v.frequency.valid()
                    && v.gains.len() <= 8
                    && v.routes.len() <= 8
                    && v.filters.len() <= 2
                    && v.gains.iter().all(|g| g.envelope.valid())
                    && v.filters
                        .iter()
                        .all(|f| f.frequency.valid() && f.q.is_finite() && f.q > 0.0)
            }
        }
    }
}
#[derive(Default)]
pub struct Stats {
    pub frames: AtomicU64,
    pub nonzero: AtomicU64,
    pub peak: AtomicU32,
    pub dropped: AtomicU64,
}
#[derive(Clone)]
pub struct Bridge {
    sender: Option<Arc<ArrayQueue<Command>>>,
    clock: Arc<AtomicU64>,
    pub rate: u32,
    pub stats: Arc<Stats>,
    silent_since: Option<Instant>,
}
impl Bridge {
    pub fn silent() -> Self {
        Self {
            sender: None,
            clock: Arc::new(AtomicU64::new(0)),
            rate: 48000,
            stats: Arc::new(Stats::default()),
            silent_since: Some(Instant::now()),
        }
    }
    pub fn now(&self) -> f64 {
        self.silent_since
            .map(|t| t.elapsed().as_secs_f64())
            .unwrap_or_else(|| self.clock.load(Ordering::Relaxed) as f64 / self.rate as f64)
    }
    pub fn install(&self, context: &rquickjs::Context) -> Result<()> {
        context
            .with(|ctx| -> Result<()> {
                let clock = self.clone();
                ctx.globals().set(
                    "__runeAudioNow",
                    rquickjs::Function::new(ctx.clone(), move || clock.now())?,
                )?;
                ctx.globals().set("__runeAudioRate", self.rate)?;
                let bridge = self.clone();
                ctx.globals().set(
                    "__runeAudioSend",
                    rquickjs::Function::new(
                        ctx.clone(),
                        move |message: String| -> rquickjs::Result<()> {
                            let Some(sender) = &bridge.sender else {
                                return Ok(());
                            };
                            if message.len() > 65536 {
                                return Err(rquickjs::Error::new_from_js_message(
                                    "JSON",
                                    "native audio",
                                    "Audio command too large",
                                ));
                            }
                            let command: Command = serde_json::from_str(&message).map_err(|e| {
                                rquickjs::Error::new_from_js_message(
                                    "JSON",
                                    "native audio",
                                    e.to_string(),
                                )
                            })?;
                            if !command.valid() {
                                return Err(rquickjs::Error::new_from_js_message(
                                    "JSON",
                                    "native audio",
                                    "Invalid audio automation",
                                ));
                            }
                            if sender.push(command).is_err() {
                                bridge.stats.dropped.fetch_add(1, Ordering::Relaxed);
                            }
                            Ok(())
                        },
                    )?,
                )?;
                ctx.eval::<(), _>(include_str!(
                    "../../../runtime/rune-web/dist/rune-native-audio.js"
                ))
                .map_err(|e| {
                    anyhow::anyhow!(rquickjs::CaughtError::from_error(&ctx, e).to_string())
                })?;
                ctx.eval::<(), _>("__RuneNativeAudio.install()")?;
                Ok(())
            })
            .context("Install native audio adapter")
    }
}
#[derive(Clone, Copy, Default)]
struct Biquad {
    b0: f64,
    b1: f64,
    b2: f64,
    a1: f64,
    a2: f64,
    z1: f64,
    z2: f64,
}
impl Biquad {
    fn tune(&mut self, kind: &FilterKind, frequency: f64, q: f64, rate: f64) {
        let omega = std::f64::consts::TAU * frequency.clamp(10.0, rate * 0.45) / rate;
        let (s, c) = omega.sin_cos();
        let alpha = s / (2.0 * q.clamp(0.1, 20.0));
        let a0 = 1.0 + alpha;
        let (b0, b1, b2) = match kind {
            FilterKind::Lowpass => ((1.0 - c) * 0.5, 1.0 - c, (1.0 - c) * 0.5),
            FilterKind::Highpass => ((1.0 + c) * 0.5, -(1.0 + c), (1.0 + c) * 0.5),
            FilterKind::Bandpass => (alpha, 0.0, -alpha),
        };
        self.b0 = b0 / a0;
        self.b1 = b1 / a0;
        self.b2 = b2 / a0;
        self.a1 = -2.0 * c / a0;
        self.a2 = (1.0 - alpha) / a0;
    }
    fn sample(&mut self, input: f64) -> f64 {
        let out = input * self.b0 + self.z1;
        self.z1 = input * self.b1 - self.a1 * out + self.z2;
        self.z2 = input * self.b2 - self.a2 * out;
        out
    }
}
struct Voice {
    spec: VoiceSpec,
    phase: f64,
    noise: u32,
    filters: [Biquad; 2],
    filter_tick: u8,
}
fn blep(phase: f64, delta: f64) -> f64 {
    if phase < delta {
        let t = phase / delta;
        t + t - t * t - 1.0
    } else if phase > 1.0 - delta {
        let t = (phase - 1.0) / delta;
        t * t + t + t + 1.0
    } else {
        0.0
    }
}
impl Voice {
    fn sample(&mut self, time: f64, rate: f64) -> f64 {
        let delta = (self.spec.frequency.at(time) / rate).clamp(0.000001, 0.49);
        let p = self.phase;
        let mut value = match self.spec.wave {
            Wave::Sine => (p * std::f64::consts::TAU).sin(),
            Wave::Triangle => {
                if p < 0.25 {
                    4.0 * p
                } else if p < 0.75 {
                    2.0 - 4.0 * p
                } else {
                    4.0 * p - 4.0
                }
            }
            Wave::Sawtooth => 2.0 * p - 1.0 - blep(p, delta),
            Wave::Square => {
                (if p < 0.5 { 1.0 } else { -1.0 }) + blep(p, delta) - blep((p + 0.5) % 1.0, delta)
            }
            Wave::Noise => {
                self.noise ^= self.noise << 13;
                self.noise ^= self.noise >> 17;
                self.noise ^= self.noise << 5;
                self.noise as f64 / u32::MAX as f64 * 2.0 - 1.0
            }
        };
        self.phase = (p + delta) % 1.0;
        for (index, filter) in self.spec.filters.iter().enumerate() {
            if self.filter_tick == 0 {
                self.filters[index].tune(&filter.kind, filter.frequency.at(time), filter.q, rate);
            }
            value = self.filters[index].sample(value);
        }
        self.filter_tick = (self.filter_tick + 1) % 32;
        value
    }
}

pub struct Mixer {
    rate: u32,
    frame: u64,
    receiver: Arc<ArrayQueue<Command>>,
    voices: Vec<Voice>,
    gains: HashMap<u64, Gain>,
    bridge: Bridge,
}
impl Mixer {
    pub fn new(rate: u32) -> (Self, Bridge) {
        let receiver = Arc::new(ArrayQueue::new(512));
        let sender = receiver.clone();
        let bridge = Bridge {
            sender: Some(sender),
            clock: Arc::new(AtomicU64::new(0)),
            rate,
            stats: Arc::new(Stats::default()),
            silent_since: None,
        };
        (
            Self {
                rate,
                frame: 0,
                receiver,
                voices: Vec::with_capacity(MAX_VOICES),
                gains: HashMap::with_capacity(2048),
                bridge: bridge.clone(),
            },
            bridge,
        )
    }
    pub fn commands(&mut self) {
        let time = self.frame as f64 / self.rate as f64;
        self.voices.retain(|v| v.spec.end > time);
        for _ in 0..512 {
            let Some(command) = self.receiver.pop() else {
                break;
            };
            match command {
                Command::Gain { gain } => {
                    self.gains.insert(gain.id, gain);
                }
                Command::Voice(mut spec) => {
                    if self.voices.len() >= MAX_VOICES {
                        self.bridge.stats.dropped.fetch_add(1, Ordering::Relaxed);
                        continue;
                    }
                    for gain in spec.gains.drain(..) {
                        self.gains.insert(gain.id, gain);
                    }
                    self.voices.push(Voice {
                        noise: spec.seed.max(1),
                        spec,
                        phase: 0.0,
                        filters: [Biquad::default(); 2],
                        filter_tick: 0,
                    });
                }
            }
        }
        let time = self.frame as f64 / self.rate as f64;
        self.voices.retain(|v| v.spec.end > time);
        self.gains
            .retain(|id, _| self.voices.iter().any(|v| v.spec.routes.contains(id)));
    }
    pub fn sample(&mut self) -> f32 {
        let time = self.frame as f64 / self.rate as f64;
        let mut mixed = 0.0;
        for voice in &mut self.voices {
            if time < voice.spec.start || time >= voice.spec.end {
                continue;
            }
            let gain = voice
                .spec
                .routes
                .iter()
                .map(|id| {
                    self.gains
                        .get(id)
                        .filter(|g| g.connected)
                        .map(|g| g.envelope.at(time))
                        .unwrap_or(0.0)
                })
                .product::<f64>();
            mixed += voice.sample(time, self.rate as f64) * gain;
        }
        self.frame += 1;
        let sample = if mixed.is_finite() {
            mixed.clamp(-1.0, 1.0) as f32
        } else {
            0.0
        };
        if sample.abs() > 1e-7 {
            self.bridge.stats.nonzero.fetch_add(1, Ordering::Relaxed);
        }
        self.bridge
            .stats
            .peak
            .fetch_max(sample.abs().to_bits(), Ordering::Relaxed);
        sample
    }
    pub fn publish_clock(&self) {
        self.bridge.clock.store(self.frame, Ordering::Relaxed);
        self.bridge
            .stats
            .frames
            .store(self.frame, Ordering::Relaxed);
    }
    #[cfg(test)]
    fn render(&mut self, frames: usize) -> Vec<f32> {
        self.commands();
        let data = (0..frames).map(|_| self.sample()).collect();
        self.publish_clock();
        data
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rune_parser::load_rune_document_from_path;
    use std::path::Path;

    fn game(context: &rquickjs::Context, bridge: &Bridge) {
        bridge.install(context).unwrap();
        let doc =
            load_rune_document_from_path(Path::new("examples/monster_city/monster_city.rune"))
                .unwrap();
        let game = crate::apps::pixel::compile(&doc).unwrap();
        context.with(|ctx| {
            ctx.eval::<(), _>(game.script.as_str()).unwrap();
            ctx.eval::<(), _>("__RunePixel.start()").unwrap();
        });
    }
    fn advance(context: &rquickjs::Context, mixer: &mut Mixer, seconds: f64) -> Vec<f32> {
        let frames = (seconds * mixer.rate as f64) as usize;
        let mut samples = Vec::with_capacity(frames);
        while samples.len() < frames {
            context
                .with(|ctx| ctx.eval::<(), _>("__RuneNativeAudio.pump()"))
                .unwrap();
            let block = mixer.render((frames - samples.len()).min(256));
            samples.extend(block);
        }
        samples
    }
    fn rms(samples: &[f32]) -> f64 {
        (samples.iter().map(|s| (*s as f64).powi(2)).sum::<f64>() / samples.len() as f64).sqrt()
    }

    #[test]
    fn automation_matches_linear_exponential_and_step_envelopes() {
        let envelope:Envelope=serde_json::from_value(serde_json::json!({"initial":0.0,"events":[{"time":1.0,"value":2.0,"ramp":"linear"},{"time":2.0,"value":8.0,"ramp":"exponential"},{"time":3.0,"value":0.0,"ramp":"set"}]})).unwrap();
        assert_eq!(envelope.at(0.5), 1.0);
        assert_eq!(envelope.at(1.5), 4.0);
        assert_eq!(envelope.at(2.5), 8.0);
        assert_eq!(envelope.at(3.0), 0.0);
    }
    #[test]
    fn rune_music_and_effects_render_native_pcm_and_obey_mute_pause_restart() {
        let runtime = rquickjs::Runtime::new().unwrap();
        let context = rquickjs::Context::full(&runtime).unwrap();
        let (mut mixer, bridge) = Mixer::new(48000);
        game(&context, &bridge);
        let samples = advance(&context, &mut mixer, 0.3);
        assert!(
            rms(&samples) > 0.005,
            "Native synth must produce audible PCM"
        );
        assert!(samples.iter().all(|s| s.is_finite() && s.abs() <= 1.0));
        context
            .with(|ctx| ctx.eval::<(), _>("__RunePixel.muted=true"))
            .unwrap();
        assert_eq!(rms(&advance(&context, &mut mixer, 0.1)), 0.0);
        context
            .with(|ctx| ctx.eval::<(), _>("__RunePixel.muted=false"))
            .unwrap();
        assert!(rms(&advance(&context, &mut mixer, 0.2)) > 0.001);
        context
            .with(|ctx| ctx.eval::<(), _>("__RunePixel.paused=true"))
            .unwrap();
        assert_eq!(rms(&advance(&context, &mut mixer, 0.2)), 0.0);
        context.with(|ctx| {
            assert_eq!(
                ctx.eval::<u32, _>("__RuneNativeAudio.pending().timers")
                    .unwrap(),
                0
            )
        });
        context
            .with(|ctx| {
                ctx.eval::<(), _>(
                    "__RunePixel.paused=false; __RunePixel.start(); __RunePixel.start()",
                )
            })
            .unwrap();
        assert!(rms(&advance(&context, &mut mixer, 0.3)) > 0.005);
        context.with(|ctx| {
            assert_eq!(
                ctx.eval::<u32, _>("__RuneNativeAudio.pending().timers")
                    .unwrap(),
                1
            )
        });
        context
            .with(|ctx| ctx.eval::<(), _>("__RunePixel.muted=true;__RunePixel.start()"))
            .unwrap();
        assert_eq!(rms(&advance(&context, &mut mixer, 0.2)), 0.0);
        context
            .with(|ctx| ctx.eval::<(), _>("__RunePixel.muted=false"))
            .unwrap();
        assert!(rms(&advance(&context, &mut mixer, 0.2)) > 0.001);
        assert_eq!(bridge.stats.dropped.load(Ordering::Relaxed), 0);
    }
    #[test]
    fn victory_stops_the_native_sequencer_and_the_jingle_finishes() {
        let runtime = rquickjs::Runtime::new().unwrap();
        let context = rquickjs::Context::full(&runtime).unwrap();
        let (mut mixer, bridge) = Mixer::new(48000);
        game(&context, &bridge);
        advance(&context, &mut mixer, 0.2);
        context
            .with(|ctx| {
                ctx.eval::<(), _>(
                    r#"
            const state=__RunePixel.app.state;
            state.destroyed=4;state.monster.x=300;
            for(let i=0;i<4;i++)state.buildings[i].hp=0;
            state.buildings[4].hp=1;
            __RunePixel.step({smash:true});
        "#,
                )
            })
            .unwrap();
        assert!(rms(&advance(&context, &mut mixer, 0.35)) > 0.001);
        advance(&context, &mut mixer, 0.5);
        assert_eq!(rms(&advance(&context, &mut mixer, 0.1)), 0.0);
        assert!(mixer.voices.is_empty());
        assert!(mixer.gains.is_empty());
        context.with(|ctx| {
            assert_eq!(
                ctx.eval::<String, _>("__RunePixel.app.state.status")
                    .unwrap(),
                "won"
            );
            assert_eq!(
                ctx.eval::<u32, _>("__RuneNativeAudio.pending().timers")
                    .unwrap(),
                0
            );
            assert_eq!(
                ctx.eval::<u32, _>("__RuneNativeAudio.pending().frames")
                    .unwrap(),
                0
            );
        });
    }
    #[test]
    fn bounds_voice_counts_and_cleans_finished_gain_graphs() {
        let (mut mixer, bridge) = Mixer::new(48000);
        for seed in 1..=150 {
            let cmd:Command=serde_json::from_value(serde_json::json!({"kind":"voice","wave":"sine","start":0.0,"end":0.01,"frequency":{"initial":440.0,"events":[]},"routes":[seed],"gains":[{"id":seed,"connected":true,"envelope":{"initial":0.01,"events":[]}}],"filters":[],"seed":seed})).unwrap();
            bridge.sender.as_ref().unwrap().push(cmd).unwrap();
        }
        mixer.commands();
        assert_eq!(mixer.voices.len(), MAX_VOICES);
        assert_eq!(bridge.stats.dropped.load(Ordering::Relaxed), 22);
        mixer.render(1024);
        mixer.commands();
        assert!(mixer.voices.is_empty());
        assert!(mixer.gains.is_empty());
    }
    #[test]
    fn missing_device_fallback_keeps_game_logic_and_clock_running() {
        let runtime = rquickjs::Runtime::new().unwrap();
        let context = rquickjs::Context::full(&runtime).unwrap();
        let bridge = Bridge::silent();
        game(&context, &bridge);
        context.with(|ctx|ctx.eval::<(),_>("__RunePixel.step({right:true});__RunePixel.paused=true;__RunePixel.paused=false")).unwrap();
        context.with(|ctx| {
            assert_eq!(
                ctx.eval::<u32, _>("__RunePixel.app.state.monster.x")
                    .unwrap(),
                10
            )
        });
        assert!(bridge.now() >= 0.0);
    }
    #[cfg(feature = "pixel-desktop")]
    #[test]
    #[ignore = "requires a real sound output device; plays a short Monster City sample"]
    fn real_output_device_plays_shared_rune_synth() {
        let output = Output::open().expect("Open actual native output device");
        let runtime = rquickjs::Runtime::new().unwrap();
        let context = rquickjs::Context::full(&runtime).unwrap();
        game(&context, &output.bridge);
        let started = Instant::now();
        while started.elapsed() < std::time::Duration::from_millis(1100) {
            context
                .with(|ctx| ctx.eval::<(), _>("__RuneNativeAudio.pump()"))
                .unwrap();
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
        context
            .with(|ctx| ctx.eval::<(), _>("__RunePixel.paused=true"))
            .unwrap();
        std::thread::sleep(std::time::Duration::from_millis(80));
        let nonzero = output.bridge.stats.nonzero.load(Ordering::Relaxed);
        let peak = f32::from_bits(output.bridge.stats.peak.load(Ordering::Relaxed));
        assert!(nonzero > 100, "Output callback only emitted silence");
        assert!(
            peak > 0.01 && peak <= 1.0,
            "Unexpected native output peak {peak}"
        );
        assert_eq!(output.bridge.stats.dropped.load(Ordering::Relaxed), 0);
        println!("Native device emitted {nonzero} nonzero PCM frames; peak {peak:.3}");
    }
}
