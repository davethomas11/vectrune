use image::{codecs::gif::GifEncoder, Delay, Frame, Rgba, RgbaImage};
use rune_runtime::{
    apps::ascii_animator::{compile, Engine},
    rune_parser::{load_rune_document_from_path, parse_rune},
};
use std::path::Path;

fn source(fields: &str) -> String {
    format!(
        r#"@App
type = ascii-animator
scene = demo
@AsciiAnimator/demo
size = [4, 1]
fps = 20
logic = demo
@AsciiSprite/test
{fields}
@Logic/demo
state:
    canvas = []
action initialize:
    canvas = [{{"type":"text","x":0,"y":0,"text":"ZZZZ"}}, {{"type":"sprite","x":0,"y":0,"name":"test"}}]
action tick:
    stop
"#
    )
}

fn gif(path: &Path) {
    let mut encoder = GifEncoder::new(std::fs::File::create(path).unwrap());
    for (color, delay) in [([0, 0, 0, 255], 100), ([255, 255, 255, 255], 200)] {
        let mut pixels = RgbaImage::from_pixel(4, 2, Rgba([0, 0, 0, 0]));
        for y in 0..2 {
            for x in 0..2 {
                pixels.put_pixel(x, y, Rgba(color));
            }
        }
        encoder
            .encode_frame(Frame::from_parts(
                pixels,
                0,
                0,
                Delay::from_numer_denom_ms(delay, 1),
            ))
            .unwrap();
    }
}

#[test]
fn imported_gifs_resolve_from_their_own_file_and_decode_once() {
    let folder = tempfile::tempdir().unwrap();
    std::fs::create_dir(folder.path().join("parts")).unwrap();
    let asset = folder.path().join("parts/sprite.gif");
    gif(&asset);
    std::fs::write(
        folder.path().join("parts/demo.rune"),
        source("source = sprite.gif\nwidth = 4"),
    )
    .unwrap();
    let entry = folder.path().join("app.rune");
    std::fs::write(&entry, "import \"parts/demo.rune\"\n").unwrap();
    let animation = compile(&load_rune_document_from_path(&entry).unwrap()).unwrap();
    std::fs::remove_file(asset).unwrap();
    let mut game = Engine::new(animation).unwrap();
    assert_eq!(game.frame().unwrap().plain(), "  ZZ");
    game.step().unwrap();
    assert_eq!(game.frame().unwrap().plain(), "  ZZ");
    assert_eq!(game.step().unwrap().plain(), "@@ZZ");
    for _ in 0..3 {
        assert_eq!(game.step().unwrap().plain(), "@@ZZ");
    }
    assert_eq!(game.step().unwrap().plain(), "  ZZ");
}

#[cfg(feature = "pixel-desktop")]
#[test]
fn desktop_gif_raster_preserves_alpha_delay_and_opaque_black_layers() {
    use rune_runtime::apps::ascii_animator::desktop;
    let folder = tempfile::tempdir().unwrap();
    let asset = folder.path().join("sprite.gif");
    gif(&asset);
    let entry = folder.path().join("app.rune");
    std::fs::write(&entry, source("source = sprite.gif\nwidth = 4")).unwrap();
    let mut game =
        Engine::new(compile(&load_rune_document_from_path(&entry).unwrap()).unwrap()).unwrap();
    std::fs::remove_file(asset).unwrap();
    let initial = desktop::frame(&game).unwrap();
    assert_eq!(initial.len(), 24 * 12 * 4);
    assert_eq!(&initial[..4], &[0, 0, 0, 255]);
    assert!(initial
        .chunks_exact(4)
        .enumerate()
        .any(|(index, pixel)| index % 24 >= 16 && pixel == [240, 240, 240, 255]));
    game.step().unwrap();
    assert_eq!(desktop::frame(&game).unwrap(), initial);
    game.step().unwrap();
    let next = desktop::frame(&game).unwrap();
    assert_eq!(&next[..4], &[255, 255, 255, 255]);
    for y in 0..12 {
        assert_eq!(
            &initial[(y * 24 + 16) * 4..(y * 24 + 24) * 4],
            &next[(y * 24 + 16) * 4..(y * 24 + 24) * 4]
        );
    }
}

#[cfg(feature = "pixel-desktop")]
#[test]
fn desktop_inline_sprites_remain_bitmap_ascii() {
    use rune_runtime::apps::ascii_animator::desktop;
    let game = Engine::new(compile(&parse_rune(&source("frames = [[\"X \"]]")).unwrap()).unwrap())
        .unwrap();
    let raster = desktop::frame(&game).unwrap();
    assert!(raster
        .chunks_exact(4)
        .any(|pixel| pixel == [240, 240, 240, 255]));
    assert!(raster
        .chunks_exact(4)
        .any(|pixel| pixel == [10, 12, 20, 255]));
}

#[cfg(feature = "pixel-desktop")]
#[test]
fn desktop_clips_gifs_to_the_viewport_without_changing_pixels() {
    use rune_runtime::apps::ascii_animator::desktop;
    let folder = tempfile::tempdir().unwrap();
    gif(&folder.path().join("sprite.gif"));
    let entry = folder.path().join("app.rune");
    let prefix = source("source = sprite.gif\nwidth = 4");
    let prefix = prefix.split("action initialize:").next().unwrap();
    let capture = |width, height, x, y| {
        let script = format!(
            "{}action initialize:\n    canvas = [{{\"type\":\"sprite\",\"x\":{x},\"y\":{y},\"name\":\"test\",\"frame\":1,\"color\":\"cyan\"}}]\naction tick:\n    stop\n",
            prefix.replace("size = [4, 1]", &format!("size = [{width}, {height}]"))
        );
        std::fs::write(&entry, script).unwrap();
        let engine =
            Engine::new(compile(&load_rune_document_from_path(&entry).unwrap()).unwrap()).unwrap();
        desktop::frame(&engine).unwrap()
    };
    for (x, y) in [(-2, 0), (3, 0), (0, -1), (0, 1), (-20, -20), (20, 20)] {
        let clipped = capture(4, 1, x, y);
        if (-2..=3).contains(&x) && y == 0 {
            let full = capture(12, 5, x + 4, y + 2);
            for row in 0..12 {
                let offset = ((row + 24) * 72 + 24) * 4;
                assert_eq!(
                    &clipped[row * 24 * 4..(row + 1) * 24 * 4],
                    &full[offset..offset + 24 * 4]
                );
            }
        } else {
            assert!(clipped
                .chunks_exact(4)
                .all(|pixel| pixel == [10, 12, 20, 255]));
        }
    }
}

#[test]
fn invalid_gif_declarations_report_errors_without_loading_silently() {
    let folder = tempfile::tempdir().unwrap();
    let path = folder.path().join("app.rune");
    gif(&folder.path().join("sprite.gif"));
    for fields in [
        "source = absent.gif",
        "source = sprite.gif\nwidth = 0",
        "source = sprite.gif\nwidth = 241",
        "source = sprite.gif\nwidth = 4.5",
        "source = sprite.gif\nfps = 10",
        "source = sprite.gif\nframes = [[\"x\"]]",
        "source = sprite.gif\ninvert = 1",
        "frames = [[\"x\"]]\nwidth = 4",
    ] {
        std::fs::write(&path, source(fields)).unwrap();
        assert!(
            compile(&load_rune_document_from_path(&path).unwrap()).is_err(),
            "{fields}"
        );
    }
    assert!(compile(&parse_rune(&source("source = sprite.gif")).unwrap()).is_err());
}

#[test]
fn corrupt_non_gif_and_excessive_frames_are_rejected() {
    let folder = tempfile::tempdir().unwrap();
    let asset = folder.path().join("sprite.gif");
    let entry = folder.path().join("app.rune");
    std::fs::write(&entry, source("source = sprite.gif\nwidth = 4")).unwrap();
    std::fs::write(&asset, b"GIF89a").unwrap();
    assert!(compile(&load_rune_document_from_path(&entry).unwrap()).is_err());
    RgbaImage::from_pixel(4, 2, Rgba([255, 255, 255, 255]))
        .save_with_format(&asset, image::ImageFormat::Png)
        .unwrap();
    assert!(compile(&load_rune_document_from_path(&entry).unwrap()).is_err());
    let mut encoder = GifEncoder::new(std::fs::File::create(&asset).unwrap());
    for _ in 0..121 {
        encoder
            .encode_frame(Frame::new(RgbaImage::from_pixel(
                4,
                2,
                Rgba([255, 255, 255, 255]),
            )))
            .unwrap();
    }
    drop(encoder);
    let error = compile(&load_rune_document_from_path(&entry).unwrap())
        .err()
        .unwrap();
    assert!(format!("{error:#}").contains("120 frames"));
}
