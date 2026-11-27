//! Generates the tvOS app icon and top shelf asset catalog from one image.
use anyhow::{Context, Result};
use image::{imageops::FilterType, DynamicImage, ImageFormat, Rgba, RgbaImage};
use std::path::Path;

const BRAND: &str = "App Icon & Top Shelf Image.brandassets";

const INFO: &str = r#""info" : { "author" : "xcode", "version" : 1 }"#;

fn write(path: &Path, text: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, text).with_context(|| format!("Cannot write {}", path.display()))
}

fn save(image: &RgbaImage, path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    DynamicImage::ImageRgba8(image.clone())
        .save_with_format(path, ImageFormat::Png)
        .with_context(|| format!("Cannot write {}", path.display()))
}

/// Scales to cover the target and crops the overflow from the center.
fn cover(source: &RgbaImage, width: u32, height: u32) -> RgbaImage {
    let scale = f64::max(width as f64 / source.width() as f64, height as f64 / source.height() as f64);
    let scaled_width = ((source.width() as f64 * scale).ceil() as u32).max(width);
    let scaled_height = ((source.height() as f64 * scale).ceil() as u32).max(height);
    let scaled = image::imageops::resize(source, scaled_width, scaled_height, FilterType::Lanczos3);
    image::imageops::crop_imm(&scaled, (scaled_width - width) / 2, (scaled_height - height) / 2, width, height).to_image()
}

fn average_color(source: &RgbaImage) -> Rgba<u8> {
    let (mut sum, mut count) = ([0u64; 3], 0u64);
    for pixel in source.pixels().filter(|p| p[3] > 0) {
        for (total, channel) in sum.iter_mut().zip(pixel.0) {
            *total += channel as u64;
        }
        count += 1;
    }
    let count = count.max(1);
    Rgba([(sum[0] / count) as u8, (sum[1] / count) as u8, (sum[2] / count) as u8, 255])
}

/// A calm teal tile used until the game provides its own icon.
fn placeholder() -> RgbaImage {
    let mut image = RgbaImage::from_pixel(1280, 768, Rgba([12, 42, 66, 255]));
    let (cx, cy) = (640.0f64, 384.0f64);
    for (x, y, pixel) in image.enumerate_pixels_mut() {
        let distance = ((x as f64 - cx).powi(2) + (y as f64 - cy).powi(2)).sqrt();
        if distance < 220.0 {
            *pixel = Rgba([72, 190, 200, 255]);
        } else if distance < 250.0 {
            *pixel = Rgba([30, 100, 130, 255]);
        }
    }
    image
}

fn imageset(dir: &Path, name: &str, art: &RgbaImage, width: u32, height: u32, scales: &[u32]) -> Result<()> {
    let mut entries = Vec::new();
    for &scale in scales {
        let file = if scale == 1 { format!("{name}.png") } else { format!("{name}@{scale}x.png") };
        save(&cover(art, width * scale, height * scale), &dir.join(&file))?;
        entries.push(format!(r#"{{ "idiom" : "tv", "filename" : "{file}", "scale" : "{scale}x" }}"#));
    }
    write(&dir.join("Contents.json"), &format!("{{\n  \"images\" : [ {} ],\n  {INFO}\n}}\n", entries.join(", ")))
}

fn imagestack(dir: &Path, art: &RgbaImage, back: Rgba<u8>, width: u32, height: u32, scales: &[u32]) -> Result<()> {
    write(
        &dir.join("Contents.json"),
        &format!("{{\n  \"layers\" : [ {{ \"filename\" : \"Front.imagestacklayer\" }}, {{ \"filename\" : \"Back.imagestacklayer\" }} ],\n  {INFO}\n}}\n"),
    )?;
    for (layer, name) in [("Front", "front"), ("Back", "back")] {
        let layer_dir = dir.join(format!("{layer}.imagestacklayer"));
        write(&layer_dir.join("Contents.json"), &format!("{{\n  {INFO}\n}}\n"))?;
        let content = layer_dir.join("Content.imageset");
        if layer == "Front" {
            imageset(&content, name, art, width, height, scales)?;
        } else {
            let solid = RgbaImage::from_pixel(width, height, back);
            imageset(&content, name, &solid, width, height, scales)?;
        }
    }
    Ok(())
}

/// Writes `Assets.xcassets` into `output`, replacing any previous generated catalog.
pub fn write_assets(source: Option<&Path>, output: &Path) -> Result<()> {
    let art = match source {
        Some(path) => image::open(path)
            .with_context(|| format!("Cannot read icon image {}", path.display()))?
            .to_rgba8(),
        None => placeholder(),
    };
    let back = average_color(&art);
    if output.exists() {
        std::fs::remove_dir_all(output)?;
    }
    write(&output.join("Contents.json"), &format!("{{\n  {INFO}\n}}\n"))?;
    let brand = output.join(BRAND);
    write(
        &brand.join("Contents.json"),
        &format!(
            "{{\n  \"assets\" : [\n    {{ \"filename\" : \"App Icon - App Store.imagestack\", \"idiom\" : \"tv\", \"role\" : \"primary-app-icon\", \"size\" : \"1280x768\" }},\n    {{ \"filename\" : \"App Icon.imagestack\", \"idiom\" : \"tv\", \"role\" : \"primary-app-icon\", \"size\" : \"400x240\" }},\n    {{ \"filename\" : \"Top Shelf Image Wide.imageset\", \"idiom\" : \"tv\", \"role\" : \"top-shelf-image-wide\", \"size\" : \"2320x720\" }},\n    {{ \"filename\" : \"Top Shelf Image.imageset\", \"idiom\" : \"tv\", \"role\" : \"top-shelf-image\", \"size\" : \"1920x720\" }}\n  ],\n  {INFO}\n}}\n"
        ),
    )?;
    imagestack(&brand.join("App Icon - App Store.imagestack"), &art, back, 1280, 768, &[1])?;
    imagestack(&brand.join("App Icon.imagestack"), &art, back, 400, 240, &[1, 2])?;
    imageset(&brand.join("Top Shelf Image Wide.imageset"), "top-shelf-wide", &art, 2320, 720, &[1, 2])?;
    imageset(&brand.join("Top Shelf Image.imageset"), "top-shelf", &art, 1920, 720, &[1, 2])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_contains_every_required_brand_asset() {
        let dir = tempfile::tempdir().unwrap();
        let output = dir.path().join("Assets.xcassets");
        write_assets(None, &output).unwrap();
        let brand = output.join(BRAND);
        for path in [
            "App Icon - App Store.imagestack/Front.imagestacklayer/Content.imageset/front.png",
            "App Icon.imagestack/Back.imagestacklayer/Content.imageset/back@2x.png",
            "Top Shelf Image.imageset/top-shelf@2x.png",
            "Top Shelf Image Wide.imageset/top-shelf-wide.png",
        ] {
            assert!(brand.join(path).is_file(), "{path}");
        }
        let wide = image::open(brand.join("Top Shelf Image Wide.imageset/top-shelf-wide@2x.png")).unwrap();
        assert_eq!((wide.width(), wide.height()), (4640, 1440));
    }
}
