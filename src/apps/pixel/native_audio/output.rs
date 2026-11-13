//! CPAL is confined to the desktop feature; the mixer is device-independent.
use super::{Bridge, Mixer};
use anyhow::{Context, Result};
use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
    FromSample, SampleFormat, SizedSample,
};
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};

pub struct Output {
    _stream: Option<cpal::Stream>,
    pub bridge: Bridge,
}
impl Output {
    pub fn silent() -> Self {
        Self {
            _stream: None,
            bridge: Bridge::silent(),
        }
    }
    pub fn open() -> Result<Self> {
        let device = cpal::default_host()
            .default_output_device()
            .context("No default sound output device")?;
        let supported = device
            .default_output_config()
            .context("Get sound output format")?;
        let format = supported.sample_format();
        let config = supported.config();
        let (mixer, bridge) = Mixer::new(config.sample_rate);
        macro_rules! build {
            ($sample:ty) => {
                build::<$sample>(&device, config, mixer)?
            };
        }
        let stream = match format {
            SampleFormat::F32 => build!(f32),
            SampleFormat::F64 => build!(f64),
            SampleFormat::I8 => build!(i8),
            SampleFormat::I16 => build!(i16),
            SampleFormat::I24 => build!(cpal::I24),
            SampleFormat::I32 => build!(i32),
            SampleFormat::I64 => build!(i64),
            SampleFormat::U8 => build!(u8),
            SampleFormat::U16 => build!(u16),
            SampleFormat::U24 => build!(cpal::U24),
            SampleFormat::U32 => build!(u32),
            SampleFormat::U64 => build!(u64),
            other => anyhow::bail!("Unsupported sound output format {other}"),
        };
        stream.play().context("Start native audio output")?;
        Ok(Self {
            _stream: Some(stream),
            bridge,
        })
    }
}
fn build<T: SizedSample + FromSample<f32>>(
    device: &cpal::Device,
    config: cpal::StreamConfig,
    mut mixer: Mixer,
) -> Result<cpal::Stream> {
    let channels = config.channels as usize;
    anyhow::ensure!(channels > 0, "Sound device has no output channels");
    let reported = Arc::new(AtomicBool::new(false));
    Ok(device.build_output_stream(
        config,
        move |data: &mut [T], _| {
            mixer.commands();
            for frame in data.chunks_mut(channels) {
                let sample = T::from_sample(mixer.sample());
                for channel in frame {
                    *channel = sample;
                }
            }
            mixer.publish_clock();
        },
        move |error| {
            if !reported.swap(true, Ordering::Relaxed) {
                eprintln!("Native sound output error: {error}");
            }
        },
        Some(Duration::from_secs(2)),
    )?)
}
