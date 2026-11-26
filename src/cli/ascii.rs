use crate::{apps::ascii_animator, rune_parser::load_rune_document_from_path};
use anyhow::{ensure, Context, Result};
use clap::{Arg, ArgAction, ArgMatches, Command};
use font8x8::{UnicodeFonts, BASIC_FONTS};
use image::{
    imageops::FilterType, AnimationDecoder, DynamicImage, ImageDecoder, ImageReader, Limits,
};
use std::io::Write;

pub fn command() -> Command {
    let output = |command: Command| {
        command.arg(
            Arg::new("output")
                .short('o')
                .long("output")
                .value_name("FILE")
                .help("Write to a new file instead of stdout; refuses to overwrite"),
        )
    };
    Command::new("ascii")
        .about("Generate ASCII art and Rune animations, or run a terminal app")
        .subcommand_required(true)
        .subcommand(output(Command::new("generate")
            .about("Generate a runnable starter .rune animation")
            .arg(Arg::new("text").long("text").default_value("Hello, ASCII!").help("Printable ASCII text to animate"))
            .arg(Arg::new("width").long("width").default_value("60").value_parser(clap::value_parser!(u16).range(3..=240)).help("Canvas columns, 3-240; text must fit inside the border"))
            .arg(Arg::new("height").long("height").default_value("12").value_parser(clap::value_parser!(u16).range(3..=80)).help("Canvas rows, 3-80"))))
        .subcommand(output(Command::new("image")
            .about("Convert images to ASCII, play a GIF, or generate a runnable Rune animation")
            .arg(Arg::new("path").required(true).value_name("IMAGE"))
            .arg(Arg::new("width").long("width").default_value("80").value_parser(clap::value_parser!(u16).range(1..=240)).help("Output columns, 1-240; height follows aspect with terminal cell correction"))
            .arg(Arg::new("invert").long("invert").action(ArgAction::SetTrue).help("Reverse the brightness ramp"))
            .arg(Arg::new("play").long("play").action(ArgAction::SetTrue).conflicts_with_all(["rune", "output"]).help("Loop a GIF in the terminal; Space pauses, Q/Esc/Ctrl-C exits"))
            .arg(Arg::new("rune").long("rune").action(ArgAction::SetTrue).help("Generate runnable .rune source with all GIF frames (or a still image)"))
            .arg(Arg::new("frames").long("frames").requires("play").value_parser(clap::value_parser!(u64).range(1..)).help("Stop playback after N 60 Hz simulation ticks"))))
        .subcommand(output(Command::new("text")
            .about("Render printable ASCII text as a character banner")
            .arg(Arg::new("text").required(true).value_name("TEXT"))
            .arg(Arg::new("font").long("font").default_value("bitmap").value_parser(["bitmap", "compact", "double"]).help("bitmap: 8x8 glyphs; compact: trimmed glyph widths; double: 16x16 glyphs"))
            .arg(Arg::new("char").long("char").default_value("#").value_name("CHAR").help("One printable ASCII character for filled pixels"))
            .arg(Arg::new("background").long("background").default_value(" ").value_name("CHAR").help("One printable ASCII character for empty pixels and spacing"))))
        .subcommand(Command::new("run")
            .about("Run an @App type = ascii-animator Rune file or directory")
            .arg(Arg::new("path").required(true).value_name("RUNE_PATH"))
            .arg(Arg::new("frames").long("frames").value_parser(clap::value_parser!(u64).range(1..)).help("Stop after N simulation frames"))
            .arg(Arg::new("plain").long("plain").action(ArgAction::SetTrue).help("Print only the final ASCII frame, without sound, ANSI codes or delays (default: 1 frame)"))
            .arg(Arg::new("mute").long("mute").action(ArgAction::SetTrue).help("Disable synthesized tones without opening an audio device"))
            .arg(Arg::new("commands").long("commands").action(ArgAction::Append).requires("plain").conflicts_with("keys").value_name("TEXT").help("Repeat for one typed command before each frame; requires --plain and an app command action"))
            .arg(Arg::new("keys").long("keys").value_delimiter(',').requires("plain").help("One Rune key code per frame, e.g. Enter,ArrowLeft,KeyR; requires --plain")))
}

fn printable(text: &str) -> Result<()> {
    ensure!(
        !text.is_empty() && text.bytes().all(|b| (32..=126).contains(&b)),
        "Text must be nonempty printable ASCII (no newlines or terminal escapes)"
    );
    Ok(())
}

fn starter(text: &str, width: u16, height: u16) -> Result<String> {
    printable(text)?;
    ensure!(
        text.len() <= usize::from(width - 2),
        "Text must fit inside the canvas (width minus 2)"
    );
    let text_json = serde_json::to_string(text)?;
    let max_x = usize::from(width) - 1 - text.len();
    Ok(format!(
        r#"@App
type = ascii-animator
scene = animation

@AsciiAnimator/animation
size = [{width}, {height}]
fps = 20
logic = animation

@Logic/animation
state:
    x = 1
    dx = 0.25
    paused = false
    canvas = []
keys:
    Space -> pause
action initialize:
    call paint
action pause:
    paused = not paused
action tick:
    if not paused:
        x = x + dx
        if x >= {max_x}:
            x = {max_x}
            dx = -0.25
        if x <= 1:
            x = 1
            dx = 0.25
    call paint
action paint:
    canvas = [
        {{"type": "box", "x": 0, "y": 0, "width": {width}, "height": {height}, "color": "blue"}},
        {{"type": "text", "x": x, "y": {}, "text": {text_json}, "color": "cyan"}}
    ]
"#,
        height / 2
    ))
}

fn banner_character(text: &str) -> Result<char> {
    printable(text)?;
    ensure!(
        text.len() == 1,
        "Banner drawing characters must be exactly one printable ASCII character"
    );
    Ok(text.as_bytes()[0] as char)
}

fn banner(text: &str, font: &str, ink: char, background: char) -> Result<String> {
    printable(text)?;
    ensure!(
        text.len() <= 120,
        "Banner text cannot exceed 120 characters"
    );
    let glyphs: Vec<_> = text
        .chars()
        .map(|ch| {
            BASIC_FONTS
                .get(ch)
                .with_context(|| format!("No banner glyph for {ch}"))
        })
        .collect::<Result<_>>()?;
    let scale = if font == "double" { 2 } else { 1 };
    let bounds: Vec<_> = glyphs
        .iter()
        .map(|glyph| {
            if font == "compact" {
                let occupied = glyph.iter().fold(0u8, |bits, row| bits | row);
                if occupied == 0 {
                    (0, 4)
                } else {
                    (
                        occupied.trailing_zeros() as usize,
                        8 - occupied.leading_zeros() as usize,
                    )
                }
            } else {
                (0, 8)
            }
        })
        .collect();
    let separator = background.to_string().repeat(scale);
    let rows: Vec<String> = (0..8 * scale)
        .map(|row| {
            glyphs
                .iter()
                .zip(&bounds)
                .map(|(glyph, &(start, end))| {
                    (start * scale..end * scale)
                        .map(|col| {
                            if glyph[row / scale] & (1 << (col / scale)) != 0 {
                                ink
                            } else {
                                background
                            }
                        })
                        .collect::<String>()
                })
                .collect::<Vec<_>>()
                .join(&separator)
        })
        .collect();
    Ok(rows.join("\n") + "\n")
}

fn image_limits() -> Limits {
    let mut limits = Limits::default();
    limits.max_image_width = Some(8192);
    limits.max_image_height = Some(8192);
    limits.max_alloc = Some(64 * 1024 * 1024);
    limits
}

fn image_art(path: &str, width: u16, invert: bool) -> Result<String> {
    let mut reader = ImageReader::open(path)
        .with_context(|| format!("Open image {path}"))?
        .with_guessed_format()?;
    reader.limits(image_limits());
    let image = reader
        .decode()
        .context("Decode image (maximum 8192x8192 and 64 MiB decoded)")?;
    pixels_art(&image, width, invert)
}

fn pixels_art(image: &DynamicImage, width: u16, invert: bool) -> Result<String> {
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
    let pixels = image
        .resize_exact(u32::from(width), height, FilterType::Triangle)
        .to_rgba8();
    let ramp = b" .:-=+*#%@";
    let mut output = String::with_capacity((usize::from(width) + 1) * height as usize);
    for row in pixels.rows() {
        for pixel in row {
            let [r, g, b, a] = pixel.0;
            // Composite transparent pixels onto black before mapping brightness.
            let light = (0.2126 * f64::from(r) + 0.7152 * f64::from(g) + 0.0722 * f64::from(b))
                * f64::from(a)
                / 255.0;
            let index = (light / 255.0 * (ramp.len() - 1) as f64).round() as usize;
            output.push(
                ramp[if invert {
                    ramp.len() - 1 - index
                } else {
                    index
                }] as char,
            );
        }
        output.push('\n');
    }
    Ok(output)
}

fn image_animation(path: &str, width: u16, invert: bool, gif_only: bool) -> Result<String> {
    let reader = ImageReader::open(path)
        .with_context(|| format!("Open image {path}"))?
        .with_guessed_format()?;
    let is_gif = reader.format() == Some(image::ImageFormat::Gif);
    ensure!(!gif_only || is_gif, "--play requires a GIF image");
    let mut frames = Vec::new();
    let mut delays = Vec::new();
    if is_gif {
        let mut decoder =
            image::codecs::gif::GifDecoder::new(reader.into_inner()).context("Decode GIF")?;
        decoder
            .set_limits(image_limits())
            .context("GIF decode limits")?;
        let mut total = 0usize;
        for frame in decoder.into_frames() {
            ensure!(frames.len() < 120, "GIF exceeds 120 frames");
            let frame = frame.context("Decode GIF frame (maximum 64 MiB decoded)")?;
            let (numerator, denominator) = frame.delay().numer_denom_ms();
            let ticks = (f64::from(numerator) / f64::from(denominator) * 0.06)
                .round()
                .max(1.0) as u64;
            let art = pixels_art(
                &DynamicImage::ImageRgba8(frame.into_buffer()),
                width,
                invert,
            )?;
            total += art.len();
            ensure!(total <= 8 * 1024 * 1024, "GIF ASCII frames exceed 8 MiB");
            frames.push(art.lines().map(str::to_owned).collect::<Vec<_>>());
            delays.push(ticks);
        }
        ensure!(!frames.is_empty(), "GIF contains no frames");
    } else {
        frames.push(
            image_art(path, width, invert)?
                .lines()
                .map(str::to_owned)
                .collect(),
        );
        delays.push(1);
    }
    let height = frames[0].len();
    ensure!(
        height <= 80,
        "Animation exceeds 80 rows; use a smaller --width"
    );
    let frames_json = serde_json::to_string(&frames)?;
    let delays_json = serde_json::to_string(&delays)?;
    let count = frames.len();
    Ok(format!(
        r#"@App
type = ascii-animator
scene = image

@AsciiAnimator/image
size = [{width}, {height}]
fps = 60
logic = image

@Logic/image
state:
    frames = {frames_json}
    delays = {delays_json}
    index = 0
    elapsed = 0
    paused = false
    canvas = []
keys:
    Space -> pause
action initialize:
    call paint
action pause:
    paused = not paused
action tick:
    if not paused:
        elapsed = elapsed + 1
        if elapsed >= delays[index]:
            elapsed = 0
            index = (index + 1) % {count}
    call paint
action paint:
    canvas = []
    for row in range(0, {height}):
        canvas.push({{"type": "text", "x": 0, "y": row, "text": frames[index][row]}})
"#
    ))
}

fn write_output(args: &ArgMatches, content: &str) -> Result<()> {
    if let Some(path) = args.get_one::<String>("output") {
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .with_context(|| format!("Create {path} (existing files are never overwritten)"))?;
        file.write_all(content.as_bytes())
            .with_context(|| format!("Write {path}"))?;
    } else {
        std::io::stdout().lock().write_all(content.as_bytes())?;
    }
    Ok(())
}

pub fn run(args: &ArgMatches) -> Result<()> {
    match args.subcommand() {
        Some(("generate", args)) => write_output(
            args,
            &starter(
                args.get_one::<String>("text").context("Missing text")?,
                *args.get_one::<u16>("width").context("Missing width")?,
                *args.get_one::<u16>("height").context("Missing height")?,
            )?,
        ),
        Some(("text", args)) => write_output(
            args,
            &banner(
                args.get_one::<String>("text").context("Missing text")?,
                args.get_one::<String>("font").context("Missing font")?,
                banner_character(
                    args.get_one::<String>("char")
                        .context("Missing drawing character")?,
                )?,
                banner_character(
                    args.get_one::<String>("background")
                        .context("Missing background character")?,
                )?,
            )?,
        ),
        Some(("image", args)) => {
            let path = args
                .get_one::<String>("path")
                .context("Missing image path")?;
            let width = *args.get_one::<u16>("width").context("Missing width")?;
            let invert = args.get_flag("invert");
            if args.get_flag("play") || args.get_flag("rune") {
                let source = image_animation(path, width, invert, args.get_flag("play"))?;
                let animation = ascii_animator::compile(&crate::rune_parser::parse_rune(&source)?)?;
                if args.get_flag("play") {
                    ascii_animator::run(
                        animation,
                        args.get_one::<u64>("frames").copied(),
                        false,
                        &[],
                        true,
                        &[],
                    )
                } else {
                    write_output(args, &source)
                }
            } else {
                write_output(args, &image_art(path, width, invert)?)
            }
        }
        Some(("run", args)) => {
            let doc = load_rune_document_from_path(std::path::Path::new(
                args.get_one::<String>("path")
                    .context("Missing Rune path")?,
            ))?;
            let keys = args
                .get_many::<String>("keys")
                .map(|v| v.cloned().collect::<Vec<_>>())
                .unwrap_or_default();
            ascii_animator::run(
                ascii_animator::compile(&doc)?,
                args.get_one::<u64>("frames").copied(),
                args.get_flag("plain"),
                &keys,
                args.get_flag("mute"),
                &args
                    .get_many::<String>("commands")
                    .map(|v| v.cloned().collect::<Vec<_>>())
                    .unwrap_or_default(),
            )
        }
        _ => anyhow::bail!("Expected ascii generate, image, text, or run"),
    }
}
