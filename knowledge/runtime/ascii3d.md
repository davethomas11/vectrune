# Ascii3D (v0.3.12)

Ascii3D augments [ASCII Animator](ascii-animator.md) with a textured grid
raycaster and depth-tested billboard sprites. It is not a separate app type:
keep `@App type = ascii-animator` and place an `ascii3d` object in the canvas.
Normal text, graphs, boxes and sprites can be drawn afterward as HUD overlays.
The native terminal host, CLI capture mode and input/cleanup behavior are shared.

```sh
vectrune ascii run examples/ascii/sentinel.rune
vectrune ascii run examples/ascii/halls.rune
vectrune ascii run examples/ascii/descent.rune
vectrune ascii run examples/ascii/sentinel.rune --plain --frames 20 --keys Enter,Space
vectrune ascii run examples/ascii/halls.rune --plain --frames 120
```

## Small complete scene

```rune
@App
type = ascii-animator
scene = room

@AsciiAnimator/room
size = [72, 22]
fps = 20
logic = room
spatial = room

@Ascii3D/room
map = ["########", "#......#", "#......#", "#......#", "########"]
walls = {"#": {"texture": "brick", "color": "cyan"}}
camera = camera
entities = things

@AsciiSprite/brick
frames = [["----+---", "....|...", "+-------", "|......."]]

@Logic/room
state:
    camera = {"x": 2.5, "y": 2.5, "angle": 0}
    things = []
    canvas = []
keys:
    ArrowLeft -> turn
    ArrowUp -> walk
action initialize:
    call paint
action turn:
    camera.angle = (camera.angle + 345) % 360
action walk:
    next = slide(camera.x, camera.y, cos(camera.angle) * 0.2, sin(camera.angle) * 0.2, 0.22)
    camera.x = next.x
    camera.y = next.y
action tick:
    call paint
action paint:
    canvas = [
        {"type": "ascii3d", "scene": "room", "x": 0, "y": 1, "width": 72, "height": 20},
        {"type": "text", "x": 2, "y": 0, "text": "MY FIRST ASCII3D ROOM", "color": "cyan"},
        {"type": "text", "x": 35, "y": 11, "text": "+", "color": "yellow"}
    ]
```

## Scene and viewport fields

`@Ascii3D/<name>` declares static scene geometry.

| Field | Default | Meaning |
|---|---|---|
| `map` | required | Rectangular array of 3-128 printable ASCII rows, each 3-128 columns. `.` is open space. |
| `walls` | required | Object mapping single-character symbols to `{texture: "<AsciiSprite name>", color: "<Ink>"}`. Color defaults to white. Every non-`.` map symbol needs a material. |
| `camera` | `camera` | Top-level state field containing camera data. |
| `entities` | `things` | Top-level state field containing an entity array, including an empty array. |
| `fov` | `65` | Horizontal field of view, 30-110 degrees. |
| `far` | `32` | Ray visibility limit, 2-96 map units. |
| `cell_aspect` | `2` | Character height divided by width, 1-3; adjust for the terminal font. |
| `repeat_y` | `false` | Repeat map rows along Y for endless corridors. Entities do **not** repeat automatically. |
| `floor` | `gray` | ASCII Animator color for perspective floor tiles. |
| `ceiling` | `blue` | ASCII Animator color for ceiling seam lines. |

Left/right boundaries must be solid. Non-repeating maps also need solid top
and bottom rows. Wall texture sprites must have nonempty rectangular frames
of identical dimensions. Their normal sprite frame rate animates the texture;
spaces in wall textures are opaque, not holes. Wall sides and distant walls
are dimmed to gray. Floor and ceiling patterns scroll in world coordinates.

The canvas object is
`{type: "ascii3d", scene: "<name>", x, y, width, height}`.
Position floors to cell coordinates and clips like other canvas objects.
Viewport size uses the standard 1-240 columns by 1-80 rows bounds.
At most four 3D views may be rendered in one canvas. Every view has its own
depth buffer; later views/2D objects overwrite earlier objects.

## Camera and entities

The camera requires `x`, `y`, and `angle`. X/Y are map coordinates, with tile
centers at `n + 0.5`; angle is in degrees, 0 facing +X and 90 facing +Y.
Optional `z` is eye height (default `0.5`, range `0.05`-`0.95`).
Optional `pitch` shifts the horizon, from -45 to +45 degrees; positive looks up.
X/Y/angle must be finite and within +/-1,000,000. Cameras inside solid cells
fail explicitly.

Each entity requires `x`, `y`, and `sprite` (an `@AsciiSprite` name).
Optional fields: `z` (base height, default 0, range 0-1), `size` (world height,
default 1, range 0.05-4), `color` (default white), `visible` (default true),
and `frame` (fixed zero-based frame index; otherwise animated).
Sprite width preserves source character proportions using `cell_aspect`.
Spaces are transparent. Entities scale with distance and are occluded by
walls, floor, ceiling and nearer opaque sprite cells.

Up to 256 entities are supported. `id`, `health`, and `cooldown` are accepted
gameplay metadata; health/cooldown must be finite numbers when supplied.
Other unknown scene, camera, material and entity fields fail explicitly.
Entities and the camera are bound at render time; a missing binding fails.

## Collision and shooting

`@AsciiAnimator spatial = <Ascii3D name>` installs one **non-repeating** scene's
grid for the existing `slide(...)` and `sees(...)` Rune-Web spatial helpers.
`slide(x, y, dx, dy, radius)` returns collision-constrained `{x, y}`.
`sees(camera, enemy)` checks walls between two positions.
Keep movement steps smaller than a tile: these shared helpers are not swept
physics. Raycasting is visual-only; game actions own health, aiming and damage.
Without an explicit spatial binding, do not use spatial movement/visibility
helpers for an Ascii3D scene.

Repeating scenes cannot be the spatial binding. Their scripts control movement
along clear corridors, wrapping/rebasing camera and entities together. This
keeps captures deterministic and prevents unbounded coordinates.

## Demo tour

**Sentinel** is a first-person maze shooter. Enter starts; W/S or Up/Down moves,
Left/Right turns, A/D strafes, Space fires, P pauses and R restarts.
Six drones approach when they can see you and damage the suit at close range.
Center-aligned shots pick the nearest visible target, respect walls and have
a short cooldown. Destroy all six to win; suit failure ends the run.
Short native synth cues mark shots, hits, drone destruction, damage and the
result. Use `--mute` for silent interactive play; plain captures are always
silent. See [ASCII tones](ascii-animator.md#simple-synth-tones).

**Endless Halls** is a repeating corridor screensaver with textured pillars,
pulsing lamps, perspective floor tiles, camera drift and head bob.
Up/Down changes speed; Space pauses. It has no endpoint.

**Descent** is an automatically accelerating first-person tunnel shooter.
Enter starts, A/D or Left/Right steers between lanes, Space fires, P pauses
and R restarts. Destroy aligned turrets before passing them. Missed turrets
cost 10 shield; direct collisions cost 30. Reach 1000 meters with shield
remaining to win. Altitude decreases as distance advances. The pitched
horizon, moving floor and head bob create the downhill effect.

**Limitations:** this is a 2.5D raycaster: fixed-height grid walls, planar floor
and ceiling, no polygon meshes, actual sloped geometry or vertical physics.
Descent's downhill grade is a presentation/gameplay-distance effect, not
a simulated physical slope. There is no browser or native window renderer
for Ascii3D; all eight ASCII demos are terminal-only and available in v0.3.12.

Sources: [`src/apps/ascii_animator/ascii3d.rs`](../../src/apps/ascii_animator/ascii3d.rs),
[`examples/ascii/sentinel.rune`](../../examples/ascii/sentinel.rune),
[`examples/ascii/halls.rune`](../../examples/ascii/halls.rune),
[`examples/ascii/descent.rune`](../../examples/ascii/descent.rune),
[`tests/ascii3d.rs`](../../tests/ascii3d.rs).
