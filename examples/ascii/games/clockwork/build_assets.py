"""Rebuild original GIF artwork for The Thirteenth Bell (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw
import math
import sys

ROOT = Path(__file__).resolve().parent / "assets"
ROOT.mkdir(exist_ok=True)


def asset(name, size, paint, count=8):
    if len(sys.argv) > 1 and name not in sys.argv[1:]:
        return
    frames = []
    for frame in range(count):
        image = Image.new("RGBA", size)
        paint(ImageDraw.Draw(image), frame)
        # Reserve index 255 for transparency instead of assuming palette index 0.
        palette = image.convert("RGB").quantize(colors=255)
        transparent = image.getchannel("A").point(lambda alpha: 255 if alpha < 128 else 0)
        palette.paste(255, mask=transparent)
        frames.append(palette)
    frames[0].save(ROOT / f"{name}.gif", save_all=True, append_images=frames[1:],
                   duration=[100] * count, loop=0, disposal=2, transparency=255,
                   optimize=False)


def courier(draw, frame):
    sway = frame % 2
    draw.polygon([(2, 4), (6, 0), (10, 4)], fill=(185, 185, 185))
    draw.rectangle((3, 4, 8, 8), fill="white")
    draw.rectangle((4, 6, 7, 6), fill="black")
    draw.polygon([(3, 9), (8, 9), (11, 16), (0, 16)], fill=(190, 190, 190))
    draw.line([(3 + sway, 16), (2 + sway, 19)], fill="white", width=2)
    draw.line([(8 - sway, 16), (9 - sway, 19)], fill="white", width=2)
    draw.rectangle((9, 9, 11, 12), fill="white")


def tree(draw, frame):
    sway = round(math.sin(frame * math.pi / 4) * 2)
    draw.polygon([(9, 63), (12, 23), (15, 63)], fill=(125, 125, 125))
    for y in [9, 22, 35]:
        draw.line([(12, y + 20), (2 + sway, y), (0, y + 3)], fill=(95, 95, 95), width=2)
        draw.line([(12, y + 18), (21 + sway, y + 4)], fill=(135, 135, 135), width=2)
    draw.ellipse((10, 29, 13, 33), fill="black")
    draw.point((9, 40), fill="white")
    draw.point((15, 40), fill="white")


def gear(draw, frame):
    draw.ellipse((3, 5, 28, 28), outline=(220, 220, 220), width=2)
    draw.ellipse((12, 13, 19, 20), fill=(160, 160, 160))
    for spoke in range(8):
        angle = (spoke + frame / 8) * math.pi / 4
        x, y = math.cos(angle), math.sin(angle)
        draw.line([(16 + x * 4, 16 + y * 4), (16 + x * 15, 16 + y * 15)], fill="white", width=2)
    draw.rectangle((0, 0, 31, 3), fill="white")


def ghost(draw, frame):
    y = frame % 3
    draw.ellipse((2, y, 13, 12 + y), fill="white")
    draw.polygon([(2, 7 + y), (13, 7 + y), (15, 15 + y),
                  (11, 13 + y), (8, 16 + y), (4, 13 + y), (0, 16 + y)], fill="white")
    draw.rectangle((4, 4 + y, 6, 7 + y), fill="black")
    draw.rectangle((9, 4 + y, 11, 7 + y), fill="black")
    draw.rectangle((7, 10 + y, 8, 12 + y), fill="black")


def seed(draw, frame):
    shade = 130 + frame * 15
    draw.ellipse((3, 4, 10, 13), fill=(shade, shade, shade))
    draw.line([(6, 5), (6, 12)], fill="black")
    draw.line([(6, 4), (6, 0), (10, 1)], fill="white")
    draw.point((0, frame % 12), fill="white")
    draw.point((13, 11 - frame % 8), fill="white")


def moon(draw, frame):
    draw.ellipse((0, 0, 23, 23), fill=(160, 160, 160))
    draw.ellipse((8, 2, 27, 20), fill=(0, 0, 0, 0))
    draw.line([(3, 10), (5, 12), (7, 10)], fill="white")


def floor(draw, frame):
    draw.rectangle((0, 0, 23, 3), fill=(190, 190, 190))
    for x in range(0, 24, 6):
        draw.line([(x, 5), (x + 3, 8), (x, 11)], fill=(95, 95, 95))
    draw.point((frame * 3, 2), fill="white")


def mist(draw, frame):
    for i in range(3):
        y = 2 + i * 4
        x = (frame * 2 + i * 7) % 12
        draw.arc((x - 8, y, x + 18, y + 6), 180, 330, fill=(95, 95, 95), width=2)


def gate(draw, frame):
    draw.arc((0, 0, 31, 35), 180, 360, fill="white", width=3)
    draw.line([(0, 17), (0, 39)], fill=(190, 190, 190), width=3)
    draw.line([(31, 17), (31, 39)], fill=(190, 190, 190), width=3)
    for x in [6, 13, 20, 27]:
        draw.line([(x, 12), (x, 39)], fill=(125, 125, 125))
    draw.ellipse((11, 4, 20, 13), outline="white")
    draw.line([(16, 9), (16 + round(math.sin(frame) * 4), 9 + round(math.cos(frame) * 4))], fill="white")


asset("courier", (12, 20), courier)
asset("tree", (24, 64), tree)
asset("gear", (32, 32), gear)
asset("ghost", (16, 20), ghost)
asset("seed", (14, 16), seed)
asset("moon", (24, 24), moon, 2)
asset("floor", (24, 12), floor)
asset("mist", (48, 16), mist)
asset("gate", (32, 40), gate)
print(f"Rebuilt {', '.join(sys.argv[1:]) if len(sys.argv) > 1 else '9 GIF assets'} in {ROOT}")
