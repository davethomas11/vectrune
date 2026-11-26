use anyhow::{ensure, Context, Result};
use image::{
    imageops::FilterType, AnimationDecoder, DynamicImage, ImageDecoder, ImageReader, Limits,
};
use std::path::Path;

pub(crate) fn limits() -> Limits {
    let mut limits = Limits::default();
    limits.max_image_width = Some(8192);
    limits.max_image_height = Some(8192);
    limits.max_alloc = Some(64 * 1024 * 1024);
    limits
}

pub(crate) fn pixels(image: &DynamicImage, width: u16) -> Result<image::RgbaImage> {
    ensure!((1..=240).contains(&width), "Image width must be 1-240");
    ensure!(
        image.width() > 0 && image.height() > 0,
        "Image must have nonzero dimensions"
    );
    let height = (f64::from(image.height()) / f64::from(image.width()) * f64::from(width) * 0.5)
        .round()
        .max(1.0) as u32;
    ensure!(
        height <= 1000,
        "ASCII image would exceed 1000 rows; use a smaller --width"
    );
    Ok(image
        .resize_exact(u32::from(width), height, FilterType::Triangle)
        .to_rgba8())
}

pub(crate) fn glyph(pixel: image::Rgba<u8>, invert: bool) -> u8 {
    let [r, g, b, a] = pixel.0;
    let ramp = b" .:-=+*#%@";
    let light = (0.2126 * f64::from(r) + 0.7152 * f64::from(g) + 0.0722 * f64::from(b))
        * f64::from(a)
        / 255.0;
    let index = (light / 255.0 * (ramp.len() - 1) as f64).round() as usize;
    ramp[if invert {
        ramp.len() - 1 - index
    } else {
        index
    }]
}

pub(super) fn sprite(path: &Path, width: u16, invert: bool) -> Result<super::Sprite> {
    let reader = ImageReader::open(path)
        .with_context(|| format!("Open GIF sprite {}", path.display()))?
        .with_guessed_format()?;
    ensure!(
        reader.format() == Some(image::ImageFormat::Gif),
        "AsciiSprite source must be a GIF"
    );
    let mut decoder =
        image::codecs::gif::GifDecoder::new(reader.into_inner()).context("Decode GIF sprite")?;
    decoder.set_limits(limits())?;
    let mut frames = Vec::new();
    let mut masks = Vec::new();
    let mut delays = Vec::new();
    let mut total = 0usize;
    #[cfg(feature = "pixel-desktop")]
    let mut originals = Vec::new();
    #[cfg(feature = "pixel-desktop")]
    let mut original_bytes = 0usize;
    for frame in decoder.into_frames() {
        ensure!(frames.len() < 120, "GIF sprite exceeds 120 frames");
        let frame = frame.context("Decode GIF sprite frame")?;
        let (numerator, denominator) = frame.delay().numer_denom_ms();
        delays.push((u64::from(numerator).div_ceil(u64::from(denominator))).max(1));
        let original = frame.into_buffer();
        #[cfg(feature = "pixel-desktop")]
        {
            original_bytes += original.len();
            ensure!(
                original_bytes <= 64 * 1024 * 1024,
                "GIF desktop pixels exceed 64 MiB per sprite"
            );
        }
        let original = DynamicImage::ImageRgba8(original);
        let pixels = pixels(&original, width)?;
        ensure!(
            pixels.height() <= 80,
            "GIF sprite exceeds 80 rows; reduce width"
        );
        #[cfg(feature = "pixel-desktop")]
        {
            // Cache the graphical raster once too; repeated scene instances reuse it.
            let raster_bytes = usize::from(width) * 6 * pixels.height() as usize * 12 * 4;
            ensure!(
                original_bytes + raster_bytes <= 64 * 1024 * 1024,
                "GIF desktop raster exceeds 64 MiB per sprite"
            );
            let raster = original
                .resize_exact(
                    u32::from(width) * 6,
                    pixels.height() * 12,
                    FilterType::Triangle,
                )
                .to_rgba8();
            original_bytes += raster.len();
            ensure!(
                original_bytes <= 64 * 1024 * 1024,
                "GIF desktop raster exceeds 64 MiB per sprite"
            );
            originals.push(raster);
        }
        total += pixels.len() / 4 * 2;
        ensure!(
            total <= 8 * 1024 * 1024,
            "GIF sprite frames and masks exceed 8 MiB"
        );
        frames.push(
            pixels
                .rows()
                .map(|row| row.map(|pixel| glyph(*pixel, invert) as char).collect())
                .collect(),
        );
        masks.push(
            pixels
                .rows()
                .map(|row| row.map(|pixel| pixel[3] >= 128).collect())
                .collect(),
        );
    }
    ensure!(!frames.is_empty(), "GIF sprite contains no frames");
    Ok(super::Sprite {
        frames,
        fps: 8,
        masks: Some(masks),
        delays: Some(delays),
        #[cfg(feature = "pixel-desktop")]
        pixels: Some(originals),
    })
}
