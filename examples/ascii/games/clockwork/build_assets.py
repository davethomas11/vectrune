"""Rebuild original GIF artwork for The Thirteenth Bell (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw
import math
import sys

ROOT = Path(__file__).resolve().parent / "assets"
ROOT.mkdir(exist_ok=True)
SCALE = 4


class DetailDraw:
    """Draw in design coordinates, allowing subpixel details at source resolution."""
    def __init__(self, image):
        self.draw = ImageDraw.Draw(image)

    def box(self, bounds):
        return tuple(round(value * SCALE) for value in bounds)

    def points(self, points):
        return [self.box(point) for point in points]

    def ellipse(self, bounds, **kwargs):
        if "width" in kwargs:
            kwargs["width"] = max(1, round(kwargs["width"] * SCALE))
        self.draw.ellipse(self.box(bounds), **kwargs)

    def rectangle(self, bounds, **kwargs):
        self.draw.rectangle(self.box(bounds), **kwargs)

    def polygon(self, points, **kwargs):
        self.draw.polygon(self.points(points), **kwargs)

    def line(self, points, fill, width=1):
        self.draw.line(self.points(points), fill=fill, width=max(1, round(width * SCALE)))

    def arc(self, bounds, start, end, fill, width=1):
        self.draw.arc(self.box(bounds), start, end, fill=fill, width=max(1, round(width * SCALE)))

    def point(self, point, fill):
        x, y = point
        self.ellipse((x, y, x + 0.5, y + 0.5), fill=fill)


def asset(name, size, paint, count=8):
    if len(sys.argv) > 1 and name not in sys.argv[1:]:
        return
    frames = []
    for frame in range(count):
        image = Image.new("RGBA", (size[0] * SCALE, size[1] * SCALE))
        paint(DetailDraw(image), frame)
        # Reserve index 255 for transparency instead of assuming palette index 0.
        palette = image.convert("RGB").quantize(colors=255)
        transparent = image.getchannel("A").point(lambda alpha: 255 if alpha < 128 else 0)
        palette.paste(255, mask=transparent)
        frames.append(palette)
    frames[0].save(ROOT / f"{name}.gif", save_all=True, append_images=frames[1:],
                   duration=[100] * count, loop=0, disposal=2, transparency=255,
                   optimize=False)


def lamplighter(draw, stride=0, airborne=None):
    draw.polygon([(2, 5), (3, 2), (6, 0.5), (9, 3), (9, 7), (2, 7)],
                 fill=(215, 215, 215))
    draw.ellipse((3, 3, 8, 8), fill=(45, 45, 45))
    draw.rectangle((4, 4.5, 5, 5.5), fill="white")
    draw.rectangle((6.5, 4.5, 7.5, 5.5), fill="white")
    draw.line([(3, 2.5), (6, 1), (8, 3)], fill="white", width=0.5)
    tail = 1 if airborne is not None else stride * 0.6
    draw.polygon([(3, 8), (8, 8), (9.5, 15), (2 + tail, 16), (1, 13)],
                 fill=(180, 180, 180))
    draw.line([(3, 8), (7.5, 8)], fill="white", width=1)
    draw.line([(5, 9), (4, 14)], fill=(70, 70, 70), width=0.7)
    draw.line([(7, 9), (8, 14)], fill=(230, 230, 230), width=0.6)
    boots = [(3 + stride, 19), (7 - stride, 19)]
    if airborne == 0:
        boots = [(3, 17), (8, 18)]
    if airborne == 1:
        boots = [(4, 19), (7, 18)]
    for hip, (x, y) in zip([4, 7], boots):
        draw.line([(hip, 15), (x, y - 1)], fill=(150, 150, 150), width=1.3)
        draw.rectangle((x - 0.7, y - 1, x + 1.2, y), fill="white")
    lantern_y = 9 if airborne == 0 else 10
    draw.line([(8, 9), (10, lantern_y)], fill="white", width=1)
    draw.arc((9, lantern_y - 1, 11, lantern_y + 1), 180, 360, fill="white", width=0.5)
    draw.rectangle((9, lantern_y, 11, lantern_y + 3), fill="white")
    draw.rectangle((9.4, lantern_y + 0.5, 10.6, lantern_y + 2.5), fill=(50, 50, 50))
    draw.ellipse((9.6, lantern_y + 0.8, 10.4, lantern_y + 2.2), fill="white")


def courier(draw, frame):
    lamplighter(draw, math.sin(frame * math.pi / 4) * 1.2)


def courier_jump(draw, frame):
    lamplighter(draw, airborne=frame)


def tree(draw, frame):
    sway = round(math.sin(frame * math.pi / 4) * 2)
    draw.polygon([(9, 63), (12, 23), (15, 63)], fill=(125, 125, 125))
    for y in [9, 22, 35]:
        draw.line([(12, y + 20), (2 + sway, y), (0, y + 3)], fill=(95, 95, 95), width=2)
        draw.line([(12, y + 18), (21 + sway, y + 4)], fill=(135, 135, 135), width=2)
    draw.ellipse((10, 29, 13, 33), fill="black")
    draw.point((9, 40), fill="white")
    draw.point((15, 40), fill="white")
    for y in range(27, 62, 5):
        draw.line([(11, y), (12.5, y + 2), (11.5, y + 4)], fill=(65, 65, 65), width=0.5)
    for y in [9, 22, 35]:
        draw.line([(4 + sway, y + 5), (5 + sway, y + 1)], fill=(165, 165, 165), width=0.5)
        draw.line([(19 + sway, y + 8), (18 + sway, y + 2)], fill=(180, 180, 180), width=0.5)
    draw.line([(9, 63), (5, 63)], fill=(170, 170, 170), width=0.6)
    draw.line([(14, 61), (20, 63)], fill=(170, 170, 170), width=0.6)


def gear(draw, frame):
    draw.ellipse((3, 5, 28, 28), outline=(220, 220, 220), width=2)
    draw.ellipse((12, 13, 19, 20), fill=(160, 160, 160))
    for spoke in range(8):
        angle = (spoke + frame / 8) * math.pi / 4
        x, y = math.cos(angle), math.sin(angle)
        draw.line([(16 + x * 4, 16 + y * 4), (16 + x * 15, 16 + y * 15)], fill="white", width=2)
        cx, cy = 16 + x * 10, 16 + y * 10
        draw.ellipse((cx - 0.7, cy - 0.7, cx + 0.7, cy + 0.7), fill=(75, 75, 75))
    draw.ellipse((14.5, 15.5, 17.5, 18.5), fill=(60, 60, 60))
    draw.ellipse((15, 16, 16, 17), fill="white")
    draw.rectangle((0, 0, 31, 3), fill="white")
    for x in range(2, 31, 4):
        draw.line([(x, 1), (x + 1.5, 2)], fill=(100, 100, 100), width=0.5)


def ghost(draw, frame):
    y = (1 + math.sin(frame * math.pi / 4)) * 0.8
    draw.ellipse((2, y, 13, 12 + y), fill="white")
    draw.polygon([(2, 7 + y), (13, 7 + y), (15, 15 + y),
                  (11, 13 + y), (8, 16 + y), (4, 13 + y), (0, 16 + y)], fill="white")
    draw.rectangle((4, 4 + y, 6, 7 + y), fill="black")
    draw.rectangle((9, 4 + y, 11, 7 + y), fill="black")
    draw.rectangle((7, 10 + y, 8, 12 + y), fill="black")
    draw.ellipse((4.5, 4.5 + y, 5.2, 5.2 + y), fill=(150, 150, 150))
    draw.ellipse((9.5, 4.5 + y, 10.2, 5.2 + y), fill=(150, 150, 150))
    draw.line([(2.5, 10 + y), (3, 12 + y)], fill=(200, 200, 200), width=0.4)
    draw.line([(12.5, 10 + y), (12, 12 + y)], fill=(200, 200, 200), width=0.4)


def seed(draw, frame):
    shade = 130 + frame * 15
    draw.ellipse((3, 4, 10, 13), fill=(shade, shade, shade))
    draw.line([(6, 5), (6, 12)], fill="black")
    draw.line([(6, 4), (6, 0), (10, 1)], fill="white")
    draw.point((0, frame % 12), fill="white")
    draw.point((13, 11 - frame % 8), fill="white")
    draw.ellipse((3.5, 4.5, 9.5, 12.5), outline="white", width=0.4)
    for y in [6, 9, 11]:
        draw.line([(6, y), (8.5, y - 1)], fill=(70, 70, 70), width=0.4)
    draw.line([(9, 1), (11, 2)], fill=(170, 170, 170), width=0.5)


def moon(draw, frame):
    draw.ellipse((0, 0, 23, 23), fill=(160, 160, 160))
    for x, y, r in [(4, 5, 1.5), (3, 15, 1), (8, 19, 1.8), (5, 10, 0.7)]:
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(105, 105, 105))
        draw.arc((x - r, y - r, x + r, y + r), 30, 160, fill=(220, 220, 220), width=0.4)
    draw.ellipse((8, 2, 27, 20), fill=(0, 0, 0, 0))
    draw.line([(3, 10), (5, 12), (7, 10)], fill="white")


def floor(draw, frame):
    draw.rectangle((0, 0, 23, 3), fill=(190, 190, 190))
    for x in range(0, 24, 6):
        draw.line([(x, 5), (x + 3, 8), (x, 11)], fill=(95, 95, 95))
    draw.point((frame * 3, 2), fill="white")
    for x in range(1, 24, 4):
        draw.line([(x, 0.5), (x + 1, 2.5)], fill=(110, 110, 110), width=0.5)
        draw.line([(x + 1, 6), (x + 3, 7)], fill=(145, 145, 145), width=0.4)


def mist(draw, frame):
    for i in range(3):
        y = 2 + i * 4
        x = (frame * 2 + i * 7) % 12
        draw.arc((x - 8, y, x + 18, y + 6), 180, 330, fill=(95, 95, 95), width=2)
        draw.arc((x + 10, y + 0.5, x + 34, y + 4), 190, 320, fill=(65, 65, 65), width=0.5)


def gate(draw, frame):
    draw.arc((0, 0, 31, 35), 180, 360, fill="white", width=3)
    draw.line([(0, 17), (0, 39)], fill=(190, 190, 190), width=3)
    draw.line([(31, 17), (31, 39)], fill=(190, 190, 190), width=3)
    for x in [6, 13, 20, 27]:
        draw.line([(x, 12), (x, 39)], fill=(125, 125, 125))
    draw.ellipse((11, 4, 20, 13), outline="white")
    draw.line([(16, 9), (16 + round(math.sin(frame) * 4), 9 + round(math.cos(frame) * 4))], fill="white")
    for y in range(18, 38, 5):
        draw.line([(2, y), (3.5, y + 1), (2, y + 2)], fill="white", width=0.5)
        draw.line([(29, y), (27.5, y + 1), (29, y + 2)], fill="white", width=0.5)
    for x in [6, 13, 20, 27]:
        draw.ellipse((x - 0.7, 20, x + 0.7, 21.5), fill=(220, 220, 220))


asset("courier", (12, 20), courier)
asset("courier_jump", (12, 20), courier_jump, 2)
asset("tree", (24, 64), tree)
asset("gear", (32, 32), gear)
asset("ghost", (16, 20), ghost)
asset("seed", (14, 16), seed)
asset("moon", (24, 24), moon, 2)
asset("floor", (24, 12), floor)
asset("mist", (48, 16), mist)
asset("gate", (32, 40), gate)
print(f"Rebuilt {', '.join(sys.argv[1:]) if len(sys.argv) > 1 else '10 GIF assets'} in {ROOT}")
