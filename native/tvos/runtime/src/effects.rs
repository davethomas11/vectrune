use serde::Deserialize;

#[derive(Deserialize)]
pub struct Settings {
    #[serde(default = "disabled_reverb")]
    pub reverb: ReverbSettings,
    #[serde(default = "disabled_delay")]
    pub delay: DelaySettings,
    #[serde(default = "disabled_chorus")]
    pub chorus: ChorusSettings,
}
#[derive(Deserialize)]
#[serde(default)]
pub struct ReverbSettings { decay: f64, wet: f64, pre_delay: f64, filter: f64 }
#[derive(Deserialize)]
#[serde(default)]
pub struct DelaySettings { time: f64, feedback: f64, wet: f64, damping: f64 }
#[derive(Deserialize)]
#[serde(default)]
pub struct ChorusSettings { rate: f64, depth: f64, wet: f64 }

impl Default for ReverbSettings {
    fn default() -> Self { Self { decay: 1.5, wet: 0.25, pre_delay: 0.01, filter: 20000.0 } }
}
impl Default for DelaySettings {
    fn default() -> Self { Self { time: 0.25, feedback: 0.35, wet: 0.25, damping: 2800.0 } }
}
impl Default for ChorusSettings {
    fn default() -> Self { Self { rate: 1.2, depth: 0.0025, wet: 0.3 } }
}
fn disabled_reverb() -> ReverbSettings { ReverbSettings { wet: 0.0, ..Default::default() } }
fn disabled_delay() -> DelaySettings { DelaySettings { wet: 0.0, ..Default::default() } }
fn disabled_chorus() -> ChorusSettings { ChorusSettings { wet: 0.0, ..Default::default() } }

struct DelayLine { data: Vec<f32>, position: usize }
impl DelayLine {
    fn new(size: usize) -> Self { Self { data: vec![0.0; size.max(2)], position: 0 } }
    fn read(&self, delay: f64) -> f32 {
        let length = self.data.len();
        let delay = delay.clamp(1.0, (length - 1) as f64);
        let lower = delay.floor() as usize;
        let fraction = (delay - lower as f64) as f32;
        let a = self.data[(self.position + length - lower) % length];
        let b = self.data[(self.position + length - lower - 1) % length];
        a + (b - a) * fraction
    }
    fn push(&mut self, value: f32) {
        self.data[self.position] = value;
        self.position = (self.position + 1) % self.data.len();
    }
    fn clear(&mut self) {
        self.data.fill(0.0);
        self.position = 0;
    }
}

#[derive(Default)]
pub struct Bank {
    effects: Vec<Effects>,
    selected: Option<usize>,
}
impl Bank {
    pub fn push(&mut self, effects: Effects) -> usize {
        let index = self.effects.len();
        self.effects.push(effects);
        index
    }
    pub fn select(&mut self, index: usize) {
        let next = (index < self.effects.len()).then_some(index);
        if next != self.selected {
            if let Some(index) = next { self.effects[index].clear(); }
            self.selected = next;
        }
    }
    pub fn sample(&mut self, dry: f32, sends: [f32; 3]) -> f32 {
        self.selected.map_or(dry, |index| self.effects[index].sample(dry, sends))
    }
}

pub struct Effects {
    rate: f64, config: Settings, delay: DelayLine, damping: f32, predelay: DelayLine,
    combs: Vec<DelayLine>, comb_lengths: Vec<usize>, feedback: Vec<f32>, reverb_lowpass: f32,
    delay_coeff: f32, reverb_coeff: f32,
    chorus: DelayLine, phase: f64,
}
impl Effects {
    fn clear(&mut self) {
        self.delay.clear();
        self.predelay.clear();
        for comb in &mut self.combs { comb.clear(); }
        self.chorus.clear();
        self.damping = 0.0;
        self.reverb_lowpass = 0.0;
        self.phase = 0.0;
    }
    pub fn new(config: Settings, rate: u32) -> Result<Self, String> {
        let r = &config.reverb; let d = &config.delay; let c = &config.chorus;
        if !(0.05..=10.0).contains(&r.decay) || !(0.0..=1.0).contains(&r.wet) ||
            !(0.0..=1.0).contains(&r.pre_delay) || !(20.0..=20000.0).contains(&r.filter) ||
            !(0.01..=4.0).contains(&d.time) || !(0.0..=0.92).contains(&d.feedback) ||
            !(0.0..=1.0).contains(&d.wet) || !(20.0..=20000.0).contains(&d.damping) ||
            !(0.01..=10.0).contains(&c.rate) || !(0.0..=0.015).contains(&c.depth) ||
            !(0.0..=1.0).contains(&c.wet) { return Err("Unsupported music effect parameters".into()); }
        let hz = rate as f64;
        let comb_lengths: Vec<usize> = [0.0297,0.0371,0.0411,0.0437].iter().map(|t| (t*hz) as usize).collect();
        Ok(Self {
            rate: hz, delay: DelayLine::new((d.time*hz).ceil() as usize+2),
            predelay: DelayLine::new((r.pre_delay*hz).ceil() as usize+2),
            combs: comb_lengths.iter().map(|n| DelayLine::new(n+2)).collect(),
            feedback: comb_lengths.iter().map(|&n| 10f64.powf(-3.0*n as f64/(r.decay*hz)) as f32).collect(),
            delay_coeff: (1.0-(-std::f64::consts::TAU*d.damping/hz).exp()) as f32,
            reverb_coeff: (1.0-(-std::f64::consts::TAU*r.filter/hz).exp()) as f32,
            comb_lengths,
            chorus: DelayLine::new(((0.018+c.depth)*hz).ceil() as usize+2),
            damping: 0.0, reverb_lowpass: 0.0, phase: 0.0, config,
        })
    }
}

#[cfg(test)]
mod tests {
        use super::*;

        fn settings() -> Settings {
            serde_json::from_str(r#"{"reverb":{"decay":3.6,"wet":0.38,"pre_delay":0.035,"filter":2400},"delay":{"time":0.9375,"feedback":0.22,"wet":0.12,"damping":1800},"chorus":{"rate":0.18,"depth":0.003,"wet":0.22}}"#).unwrap()
        }

        #[test]
        fn optional_effects_use_defaults_without_enabling_missing_effects() {
            let config: Settings = serde_json::from_str(r#"{"reverb":{"decay":3,"wet":0.3},"filter":{"type":"lowpass","cutoff":2400}}"#).unwrap();
            assert_eq!(config.reverb.pre_delay, 0.01);
            assert_eq!(config.reverb.filter, 20000.0);
            assert_eq!(config.delay.wet, 0.0);
            assert_eq!(config.chorus.wet, 0.0);
            assert!(Effects::new(config, 48000).is_ok());
            let config: Settings = serde_json::from_str(r#"{"reverb":{},"delay":{},"chorus":{}}"#).unwrap();
            assert_eq!(config.reverb.wet, 0.25);
            assert_eq!(config.delay.wet, 0.25);
            assert_eq!(config.chorus.wet, 0.3);
            assert!(Effects::new(config, 48000).is_ok());
        }

        #[test]
        fn separate_sends_produce_bounded_tails_and_preserve_dry() {
            for send in 0..3 {
                let mut effect = Effects::new(settings(), 48000).unwrap();
                let mut input = [0.0;3]; input[send] = 0.1;
                assert_eq!(effect.sample(0.25, input), 0.25);
                let mut peak = 0.0f32;
                for _ in 0..96000 {
                    let value = effect.sample(0.0, [0.0;3]);
                    assert!(value.is_finite() && value.abs() < 1.0);
                    peak = peak.max(value.abs());
                }
                assert!(peak > 0.001, "effect {send} generated no tail");
            }
        }

        #[test]
        fn rejects_invalid_and_unbounded_parameters() {
            let mut invalid = settings();
            invalid.delay.feedback = 1.0;
            assert!(Effects::new(invalid, 48000).is_err());
            let mut invalid = settings();
            invalid.chorus.depth = f64::NAN;
            assert!(Effects::new(invalid, 48000).is_err());
        }

        #[test]
        fn zero_wet_preserves_dry() {
            let mut config = settings();
            config.delay.wet = 0.0;
            config.reverb.wet = 0.0;
            config.chorus.wet = 0.0;
            let mut effect = Effects::new(config, 48000).unwrap();
            for index in 0..96000 {
                let input = if index == 0 { [0.5; 3] } else { [0.0; 3] };
                assert_eq!(effect.sample(0.125, input), 0.125);
            }
        }

        #[test]
        fn switching_tracks_uses_its_effects_and_clears_old_tails() {
            let mut bank = Bank::default();
            let wet: Settings = serde_json::from_str(r#"{"reverb":{"wet":0.8}}"#).unwrap();
            let dry: Settings = serde_json::from_str(r#"{"reverb":{"wet":0}}"#).unwrap();
            let wet_index = bank.push(Effects::new(wet, 48000).unwrap());
            let dry_index = bank.push(Effects::new(dry, 48000).unwrap());
            bank.select(wet_index);
            bank.sample(0.0, [0.5, 0.0, 0.0]);
            assert!((0..5000).any(|_| bank.sample(0.0, [0.0; 3]).abs() > 0.001));
            bank.select(dry_index);
            bank.sample(0.0, [0.5, 0.0, 0.0]);
            assert!((0..5000).all(|_| bank.sample(0.0, [0.0; 3]) == 0.0));
            bank.select(usize::MAX);
            assert_eq!(bank.sample(0.125, [0.5; 3]), 0.125);
            bank.select(wet_index);
            assert!((0..5000).all(|_| bank.sample(0.0, [0.0; 3]) == 0.0));
        }
}

impl Effects {
    pub fn sample(&mut self, dry: f32, input: [f32;3]) -> f32 {
        let d = &self.config.delay;
        let echo = self.delay.read(d.time*self.rate);
        self.damping += self.delay_coeff*(echo-self.damping);
        self.delay.push(input[1]+self.damping*d.feedback as f32);
        let r = &self.config.reverb;
        let pre = if r.pre_delay == 0.0 { input[0] } else { self.predelay.read(r.pre_delay*self.rate) };
        self.predelay.push(input[0]);
        let mut reverb = 0.0;
        for ((comb, &length), &feedback) in self.combs.iter_mut().zip(&self.comb_lengths).zip(&self.feedback) {
            let value = comb.read(length as f64);
            comb.push(pre + value*feedback);
            reverb += value * 0.25;
        }
        self.reverb_lowpass += self.reverb_coeff*(reverb-self.reverb_lowpass);
        let c = &self.config.chorus;
        let chorus = self.chorus.read((0.018+c.depth*self.phase.sin())*self.rate);
        self.chorus.push(input[2]);
        self.phase = (self.phase+std::f64::consts::TAU*c.rate/self.rate) % std::f64::consts::TAU;
        dry + self.damping*d.wet as f32 + self.reverb_lowpass*r.wet as f32 + chorus*c.wet as f32
    }
}
