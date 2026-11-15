# Declarative game controls (unreleased)

Pixel and Pixel 3D games can import a reusable `controls.rune` file. Game logic
continues to receive the same `tick(input)` object. Mappings describe physical
devices; rules such as ammunition, cooldowns and a fresh USE press stay in Rune.

```rune
import "controls.rune"

@Scene/level
logic = game
controls = shooter
```

```rune
#!RUNE
@Controls/shooter
keys:
    KeyW -> forward
    KeyS -> back
    KeyA -> strafe_left
    KeyD -> strafe_right
    Space -> fire
    KeyE -> use
commands:
    Enter -> host.advance
    KeyP -> host.pause
    KeyM -> host.mute
    KeyF -> host.fullscreen
mouse:
    Left -> fire
    MoveX -> {"input":"look_x","scale":0.8}
gamepad:
    Axis0 -> {"input":"move_x","deadzone":0.18}
    Axis1 -> {"input":"move_y","invert":true,"deadzone":0.18}
    Axis2 -> {"input":"look_x","mode":"rate","scale":900}
    Button7 -> fire
    Button0 -> use
    Button9 -> {"command":"host.pause"}
    Button8 -> {"command":"host.advance"}
touch = {"joystick":{"x":"move_x","y":"move_y","size":96},"look":{"x":"look_x","sensitivity":1},"buttons":[{"id":"fire","input":"fire","label":"FIRE","size":60,"offset":[12,12],"drag_x":"look_x"},{"id":"use","input":"use","label":"USE","size":48,"offset":[80,18]}]}
```

See [Vect Breach](../examples/vect_breach/controls.rune) and
[Monster City](../examples/monster_city/controls.rune) for complete profiles.
Use a compiler built from this checkout; this feature is newer than 0.3.3.

## Custom profiles

```rune
@Controls/my_shooter
extends = shooter
keys:
    Space -> null
    KeyZ -> fire
mouse:
    Left -> null
    Right -> fire
```

Change the scene to `controls = my_shooter`. Profiles merge each device map
with their parent, then override any scene `keys` and `commands`. `null` removes
a mapping. A child `touch` object replaces the parent's entire touch layout;
`touch = {"enabled":false}` disables the generated overlay. Inheritance cycles,
unknown references, invalid binding fields and unknown command actions fail
compilation. Arrow mappings and JSON object maps are equivalent:
`keys = {"KeyZ":"fire","Space":null}`.

## Input and command semantics

Bindings name an input, or use an object with exactly one of `input` and
`command`. Input names contain letters, digits and underscores. Commands invoke
an existing game action once on press. Keyboard commands can also be written
under `commands:`. Supported presentation commands are:

| Command | Behavior |
| --- | --- |
| `host.start` | Confirm an active 2D menu choice, otherwise start/restart |
| `host.advance` | Invoke the game's `advance` action while outside gameplay |
| `host.pause` | Toggle pause during gameplay |
| `host.mute` | Toggle audio without releasing held gameplay inputs |
| `host.fullscreen` | Ask the presentation host to toggle fullscreen |

`host.advance` requires a game action named `advance`. Monster City uses
`host.start`; Breach uses `host.advance` for its title and briefings. Existing
2D menu navigation and 3D fire/use-to-advance behavior remain available.
Escape remains a host escape key for mouse lock/fullscreen/window exit.

| Binding mode | Value passed to `tick(input)` |
| --- | --- |
| `button` | Boolean hold, including a queued short tap for at least one tick |
| `value` | Numeric value; the strongest absolute source wins |
| `delta` | Accumulated numeric motion, consumed once per tick |
| `rate` | Numeric rate multiplied by tick duration, added to deltas |

Keyboard/buttons default to `button`; raw gamepad axes default to `value`;
mouse motion/wheel defaults to `delta`. `scale` multiplies values; `invert`
reverses their sign. Gamepad axes have a rescaled `deadzone` (default 0.18,
range 0–0.99). Buttons and signed digital axes use `threshold` (default 0.5).
For keyboard movement on a numeric channel use, for example,
`KeyD -> {"input":"move_x","mode":"value","scale":1}` and
`KeyA -> {"input":"move_x","mode":"value","scale":-1}`.

The compiler rejects mappings that mix boolean and numeric values on the same input. Deltas and rates sum;
absolute axes choose the strongest source. Releasing one device preserves
another device holding the same input. Blur, visibility loss and disposal clear
inputs. Pointer cancellation discards pending taps; normal release preserves
short presses. A disconnected controller releases its own sources.

## Device names and parity

Keyboard uses physical codes (`KeyW`, `ArrowLeft`, `Space`), independent of the
printed character. Mouse names are `Left`, `Middle`, `Right`, `Back`, `Forward`,
`MoveX`, `MoveY`, `WheelX`, `WheelY`. Motion/wheel values use pixel units;
wheel line deltas are normalized to 16 pixels. 3D mouse motion uses pointer lock.

Gamepad profiles use standard layout numbering: axes 0/1 are the left stick,
2/3 the right stick; Y is positive down. Buttons 0/1/2/3 are south/east/west/north,
4/5 shoulders, 6/7 triggers, 8/9 select/start, 10/11 stick clicks, 12–15 dpad
up/down/left/right, 16 home. `Axis0-` and `Axis0+` turn a stick direction into a
boolean input. Multiple connected pads can contribute inputs. Browser polling
is limited to the focused game canvas and follows browser device permissions.
Native hosts normalize controllers to the same layout through gilrs.

| Host | Keyboard / mouse | Gamepad | Generated touch UI |
| --- | --- | --- | --- |
| Pixel browser | Yes | Browser Gamepad API | Yes |
| Pixel 3D browser | Yes | Browser Gamepad API | Yes |
| Pixel / Pixel 3D desktop (`pixel-desktop`) | Yes | gilrs | No |
| Rune-Web games such as VectWorms | Existing `@Logic keys:` actions | Existing behavior | Existing authored UI |

This profile feature targets the fixed-step Pixel engines. VectWorms' existing
`@Logic keys:` invokes actions on keydown and keeps its existing semantics.
The standalone browser language emulator does not compile Pixel scenes.
Desktop gamepad builds need Linux `libudev-dev` alongside the existing audio
headers. No controller hardware is needed to compile or run keyboard games.
Hardware-specific mappings still depend on the browser/OS controller database.

## Touch layout

The overlay follows the rendered canvas and appears on coarse/touch devices or
after a touch gesture. Buttons use `label`, optional `aria_label`, a unique
`id`, and exactly one `input` or `command`. `anchor` chooses a corner
(`bottom-right` by default); `offset = [horizontal, vertical]` is measured from
that corner in CSS pixels, respecting device safe areas. `size` is 44–200 pixels.
Gameplay buttons hide outside gameplay; command buttons remain accessible.
Optional `drag_x` sends horizontal drag deltas while that button is held.

A joystick can expose numeric `x`/`y` inputs, boolean `left`/`right`/`up`/`down`
inputs, or both. Joystick Y is positive up. It supports `size`, `deadzone` and
`anchor` (`bottom-left` or `bottom-right`). Boolean directions activate beyond
0.35 strength after the deadzone. Dragging outside the stick/buttons emits
`look.x`; `look.sensitivity` scales motion. A full-width swipe produces 1200
units before sensitivity; Breach's game logic converts this to 180 degrees.
Looking never implies firing: author a FIRE button explicitly.

Profiles configure source files. An end-user rebinding/settings screen and
persisted per-player overrides are future work; the shared controller and
inherited profiles provide the basis for them.

## Compatibility

Without `@Scene controls`, the generated configuration and old input adapters
are unchanged. Existing scene `keys`, scene `commands`, HTML input buttons,
custom cabinets and `@Logic keys:` continue to work. The migrated examples keep
their prior keyboard mappings and add controller profiles. No new syntax is
required in game action bodies or existing map files.
