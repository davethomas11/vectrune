use assert_cmd::Command;
use image::{Rgba, RgbaImage};
use rune_runtime::{
    apps::ascii_animator::{compile, Engine},
    rune_parser::parse_rune,
};

fn cli() -> Command {
    assert_cmd::cargo::cargo_bin_cmd!("vectrune")
}

#[test]
fn starter_generation_works_without_a_checkout_and_is_runnable() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("animation.rune");
    cli()
        .current_dir(directory.path())
        .args([
            "ascii", "generate", "--text", "Hi!", "--width", "20", "--height", "6", "-o",
        ])
        .arg(&path)
        .assert()
        .success();
    let source = std::fs::read_to_string(&path).unwrap();
    let mut engine = Engine::new(compile(&parse_rune(&source).unwrap()).unwrap()).unwrap();
    assert!(engine.frame().unwrap().plain().contains("Hi!"));
    let initial = engine.snapshot().unwrap()["state"]["x"].clone();
    for _ in 0..8 {
        engine.step().unwrap();
    }
    assert_ne!(engine.snapshot().unwrap()["state"]["x"], initial);
    engine.key("Space").unwrap();
    let paused = engine.snapshot().unwrap()["state"]["x"].clone();
    engine.step().unwrap();
    assert_eq!(engine.snapshot().unwrap()["state"]["x"], paused);
    cli()
        .current_dir(directory.path())
        .args(["ascii", "run"])
        .arg(&path)
        .args(["--plain", "--frames", "8"])
        .assert()
        .success();
    cli()
        .args(["ascii", "generate", "-o"])
        .arg(&path)
        .assert()
        .failure();
    assert_eq!(std::fs::read_to_string(path).unwrap(), source);
    for old in ["demo", "list"] {
        cli().args(["ascii", old]).assert().failure();
    }
}

#[test]
fn generated_strings_and_canvas_bounds_are_validated() {
    for text in [r#"Hi "you"!"#, r#"C:\art"#, "x # {}"] {
        let output = cli()
            .args(["ascii", "generate", "--text", text])
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let source = String::from_utf8(output.stdout).unwrap();
        let engine = Engine::new(compile(&parse_rune(&source).unwrap()).unwrap()).unwrap();
        assert!(engine.frame().unwrap().plain().contains(text));
    }
    let output = cli()
        .args([
            "ascii", "generate", "--width", "3", "--height", "3", "--text", "X",
        ])
        .output()
        .unwrap();
    let mut game = Engine::new(
        compile(&parse_rune(&String::from_utf8(output.stdout).unwrap()).unwrap()).unwrap(),
    )
    .unwrap();
    for _ in 0..10 {
        assert_eq!(game.step().unwrap().plain(), "+-+\n|X|\n+-+");
    }
    for args in [
        vec!["ascii", "generate", "--width", "2"],
        vec!["ascii", "generate", "--height", "81"],
        vec!["ascii", "generate", "--text", "Too long", "--width", "4"],
        vec!["ascii", "generate", "--text", ""],
        vec!["ascii", "generate", "--text", "Hi\nthere"],
        vec!["ascii", "generate", "--text", "\u{1b}[2J"],
    ] {
        cli().args(args).assert().failure();
    }
}

#[test]
fn text_banner_preserves_dimensions_and_rejects_unsafe_text() {
    let directory = tempfile::tempdir().unwrap();
    let output = cli()
        .current_dir(directory.path())
        .args(["ascii", "text", "Ab"])
        .output()
        .unwrap();
    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    let banner = String::from_utf8(output.stdout).unwrap();
    assert_eq!(banner.lines().count(), 8);
    assert!(banner.lines().all(|line| line.len() == 17));
    assert!(banner.contains('#'));
    assert!(banner.bytes().all(|b| matches!(b, b'#' | b' ' | b'\n')));
    let path = directory.path().join("banner.txt");
    cli()
        .args(["ascii", "text", "Ab", "--output"])
        .arg(&path)
        .assert()
        .success();
    assert_eq!(std::fs::read_to_string(&path).unwrap(), banner);
    cli()
        .args(["ascii", "text", "Ab", "--output"])
        .arg(&path)
        .assert()
        .failure();
    for text in ["", "hello\nworld", "\u{1b}", "caf\u{e9}"] {
        cli().args(["ascii", "text", text]).assert().failure();
    }
    cli()
        .args(["ascii", "text", &"x".repeat(121)])
        .assert()
        .failure();
}

#[test]
fn image_conversion_maps_brightness_transparency_aspect_and_inversion() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("input.png");
    let mut image = RgbaImage::new(4, 4);
    for y in 0..4 {
        for (x, color) in [
            [0, 0, 0, 255],
            [255, 255, 255, 255],
            [255, 255, 255, 0],
            [128, 128, 128, 255],
        ]
        .iter()
        .enumerate()
        {
            image.put_pixel(x as u32, y, Rgba(*color));
        }
    }
    image.save(&path).unwrap();
    let run = |invert| {
        let mut command = cli();
        command
            .current_dir(directory.path())
            .args(["ascii", "image"])
            .arg(&path)
            .args(["--width", "4"]);
        if invert {
            command.arg("--invert");
        }
        let output = command.output().unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert!(output.stderr.is_empty());
        String::from_utf8(output.stdout).unwrap()
    };
    assert_eq!(run(false), " @ +\n @ +\n");
    assert_eq!(run(true), "@ @=\n@ @=\n");
    let output = directory.path().join("art.txt");
    cli()
        .args(["ascii", "image"])
        .arg(&path)
        .args(["--width", "4", "-o"])
        .arg(&output)
        .assert()
        .success();
    assert_eq!(std::fs::read_to_string(output).unwrap(), run(false));
}

#[test]
fn image_errors_and_limits_do_not_create_success_shaped_output() {
    let directory = tempfile::tempdir().unwrap();
    let input = directory.path().join("invalid.png");
    let output = directory.path().join("art.txt");
    std::fs::write(&input, b"not an image").unwrap();
    cli()
        .args(["ascii", "image"])
        .arg(&input)
        .arg("-o")
        .arg(&output)
        .assert()
        .failure();
    assert!(!output.exists());
    RgbaImage::new(8193, 1).save(&input).unwrap();
    cli()
        .args(["ascii", "image"])
        .arg(&input)
        .assert()
        .failure();
    RgbaImage::new(1, 100).save(&input).unwrap();
    cli()
        .args(["ascii", "image"])
        .arg(&input)
        .args(["--width", "240"])
        .assert()
        .failure();
    cli()
        .args(["ascii", "image"])
        .arg(&input)
        .args(["--width", "0"])
        .assert()
        .failure();
    cli()
        .args(["ascii", "image", "missing.png"])
        .assert()
        .failure();
}

#[test]
fn image_conversion_supports_each_advertised_format_and_guessed_extensions() {
    let directory = tempfile::tempdir().unwrap();
    let image = image::RgbImage::from_pixel(2, 2, image::Rgb([255, 255, 255]));
    for extension in ["png", "jpg", "gif", "webp", "bmp"] {
        let path = directory.path().join(format!("image.{extension}"));
        image.save(&path).unwrap();
        let renamed = directory.path().join("no-extension");
        std::fs::copy(path, &renamed).unwrap();
        let output = cli()
            .args(["ascii", "image"])
            .arg(renamed)
            .args(["--width", "2"])
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{extension}: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        assert_eq!(output.stdout, b"@@\n", "{extension}");
    }
}

#[test]
fn animated_gif_conversion_uses_only_the_first_frame() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("animated.gif");
    {
        let mut encoder =
            image::codecs::gif::GifEncoder::new(std::fs::File::create(&path).unwrap());
        for color in [[0, 0, 0, 255], [255, 255, 255, 255]] {
            encoder
                .encode_frame(image::Frame::new(RgbaImage::from_pixel(2, 2, Rgba(color))))
                .unwrap();
        }
    }
    let output = cli()
        .args(["ascii", "image"])
        .arg(path)
        .args(["--width", "2"])
        .output()
        .unwrap();
    assert!(output.status.success());
    assert_eq!(output.stdout, b"  \n");
}

#[test]
fn gif_rune_export_preserves_frames_timing_pause_and_looping() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("animated");
    {
        let mut encoder =
            image::codecs::gif::GifEncoder::new(std::fs::File::create(&path).unwrap());
        for (color, delay) in [([0, 0, 0, 255], 100), ([255, 255, 255, 255], 200)] {
            encoder
                .encode_frame(image::Frame::from_parts(
                    RgbaImage::from_pixel(2, 2, Rgba(color)),
                    0,
                    0,
                    image::Delay::from_numer_denom_ms(delay, 1),
                ))
                .unwrap();
        }
    }
    let exported = directory.path().join("animation.rune");
    cli()
        .args(["ascii", "image"])
        .arg(&path)
        .args(["--rune", "--width", "2", "-o"])
        .arg(&exported)
        .assert()
        .success();
    let source = std::fs::read_to_string(&exported).unwrap();
    let mut engine = Engine::new(compile(&parse_rune(&source).unwrap()).unwrap()).unwrap();
    assert_eq!(engine.frame().unwrap().plain(), "  ");
    for _ in 0..5 {
        assert_eq!(engine.step().unwrap().plain(), "  ");
    }
    assert_eq!(engine.step().unwrap().plain(), "@@");
    engine.key("Space").unwrap();
    for _ in 0..20 {
        assert_eq!(engine.step().unwrap().plain(), "@@");
    }
    engine.key("Space").unwrap();
    for _ in 0..11 {
        assert_eq!(engine.step().unwrap().plain(), "@@");
    }
    assert_eq!(engine.step().unwrap().plain(), "  ");
    cli()
        .args(["ascii", "image"])
        .arg(&path)
        .args(["--rune", "-o"])
        .arg(&exported)
        .assert()
        .failure();
    assert_eq!(std::fs::read_to_string(exported).unwrap(), source);
    let result = cli()
        .args(["ascii", "image"])
        .arg(&path)
        .args(["--play"])
        .output()
        .unwrap();
    assert!(!result.status.success());
    assert!(String::from_utf8_lossy(&result.stderr).contains("interactive terminal"));
}

#[test]
fn animation_export_rejects_invalid_inputs_and_excess_frames() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("still.png");
    RgbaImage::from_pixel(2, 2, Rgba([255, 255, 255, 255]))
        .save(&path)
        .unwrap();
    let result = cli()
        .args(["ascii", "image"])
        .arg(&path)
        .args(["--rune", "--width", "2"])
        .output()
        .unwrap();
    assert!(result.status.success());
    let engine = Engine::new(
        compile(&parse_rune(&String::from_utf8(result.stdout).unwrap()).unwrap()).unwrap(),
    )
    .unwrap();
    assert_eq!(engine.frame().unwrap().plain(), "@@");
    for options in [
        vec!["--play"],
        vec!["--play", "--rune"],
        vec!["--play", "-o", "out.rune"],
        vec!["--frames", "1"],
    ] {
        cli()
            .args(["ascii", "image"])
            .arg(&path)
            .args(options)
            .assert()
            .failure();
    }
    let gif = directory.path().join("long.gif");
    {
        let mut encoder = image::codecs::gif::GifEncoder::new(std::fs::File::create(&gif).unwrap());
        for _ in 0..121 {
            encoder
                .encode_frame(image::Frame::new(RgbaImage::new(1, 1)))
                .unwrap();
        }
    }
    let output = directory.path().join("invalid.rune");
    let result = cli()
        .args(["ascii", "image"])
        .arg(gif)
        .args(["--rune", "-o"])
        .arg(&output)
        .output()
        .unwrap();
    assert!(!result.status.success());
    assert!(String::from_utf8_lossy(&result.stderr).contains("120 frames"));
    assert!(!output.exists());
}

#[test]
fn gif_transparent_frames_keep_the_previous_composited_image() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("transparent.gif");
    let bytes = [
        b"GIF89a".as_slice(),
        &[1, 0, 1, 0, 128, 0, 0, 0, 0, 0, 255, 255, 255],
        &[
            33, 249, 4, 4, 10, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 76, 1, 0,
        ],
        &[
            33, 249, 4, 5, 10, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1, 0, 59,
        ],
    ]
    .concat();
    std::fs::write(&path, bytes).unwrap();
    let result = cli()
        .args(["ascii", "image"])
        .arg(path)
        .args(["--rune", "--width", "2"])
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let mut engine = Engine::new(
        compile(&parse_rune(&String::from_utf8(result.stdout).unwrap()).unwrap()).unwrap(),
    )
    .unwrap();
    assert_eq!(engine.frame().unwrap().plain(), "@@");
    for _ in 0..12 {
        assert_eq!(engine.step().unwrap().plain(), "@@");
    }
}

#[test]
fn banner_fonts_and_characters_preserve_pixels_and_spacing() {
    let render = |options: &[&str]| {
        let output = cli()
            .args(["ascii", "text", "I A!"])
            .args(options)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8(output.stdout).unwrap()
    };
    let bitmap = render(&[]);
    assert_eq!(bitmap, render(&["--font", "bitmap"]));
    let custom = render(&["--char", "*", "--background", "."]);
    assert_eq!(custom, bitmap.replace('#', "*").replace(' ', "."));
    let double = render(&["--font", "double"]);
    let expected: String = bitmap
        .lines()
        .flat_map(|row| {
            let expanded: String = row.chars().flat_map(|ch| [ch, ch]).collect();
            [expanded.clone() + "\n", expanded + "\n"]
        })
        .collect();
    assert_eq!(double, expected);
    let compact = render(&["--font", "compact", "--char", "@", "--background", "."]);
    assert_eq!(compact.lines().count(), 8);
    assert!(compact
        .lines()
        .all(|row| row.len() < bitmap.lines().next().unwrap().len()));
    assert!(compact.contains('@'));
    assert!(!compact.contains(' '));
    assert!(compact
        .lines()
        .all(|row| row.len() == compact.lines().next().unwrap().len()));
    for options in [
        vec!["--font", "missing"],
        vec!["--char", ""],
        vec!["--char", "ab"],
        vec!["--char", "\u{1b}"],
        vec!["--background", "\n"],
        vec!["--background", "\u{e9}"],
    ] {
        cli()
            .args(["ascii", "text", "A"])
            .args(options)
            .assert()
            .failure();
    }
    let path = tempfile::tempdir().unwrap();
    let file = path.path().join("custom.txt");
    cli()
        .args(["ascii", "text", "I A!", "--font", "double", "-o"])
        .arg(&file)
        .assert()
        .success();
    assert_eq!(std::fs::read_to_string(file).unwrap(), double);
}
