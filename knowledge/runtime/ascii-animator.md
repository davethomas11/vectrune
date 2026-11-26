# ASCII Animator (v0.3.12)

ASCII Animator is a terminal-only app host available in the default native CLI
build on macOS, Linux and Windows. It uses the same `@Logic` expression/action
interpreter as Rune-Web, without a browser or a web server.

## Try it

```sh
vectrune ascii generate --text "Hello!" -o animation.rune
vectrune ascii run animation.rune
vectrune ascii image photo.png --width 80 -o photo.txt
vectrune ascii text "VECTRUNE"
# With a checkout or downloaded example files:
vectrune ascii run examples/ascii/sentinel.rune
vectrune ascii run examples/ascii/sentinel.rune --mute
vectrune ascii run examples/ascii/halls.rune
vectrune ascii run examples/ascii/descent.rune
vectrune examples/ascii/aquarium.rune
vectrune ascii run examples/ascii/observatory.rune --plain --frames 30
vectrune ascii run examples/ascii/meteors.rune --plain --frames 40 --keys Enter,ArrowLeft,ArrowRight
```

Generators need no checkout, network, desktop feature, or external interpreter.
Example games/screensavers remain ordinary files under `examples/ascii/` and
are not embedded in the binary. `ascii run` accepts a Rune entry file or directory
and uses normal import resolution. Direct file execution launches the terminal
host when `@App type = ascii-animator`; document export remains available with
`-o json` / `-o rune`. HTTP hosting, HTML export, `--target`, secondary apps and
`--watch` are not supported for this app type.

## CLI generators

`ascii generate` produces an editable, runnable `.rune` animation: text bounces
inside a bordered canvas, and Space pauses/resumes. `--text` defaults to
`Hello, ASCII!`, `--width` to 60 (3-240), and `--height` to 12 (3-80).
Text must fit within width minus two border columns. The generated app uses
20 fps; edit its `@AsciiAnimator` and `@Logic` sections to customize it.

`ascii image <file>` converts PNG, JPEG, GIF (first frame), WebP, or BMP into
plain ASCII by default. `--width` is output columns, 1-240 (default 80). Height follows
the original aspect ratio with a 0.5 correction for tall terminal cells,
rounded to at least one row. Inputs are limited to 8192x8192 and 64 MiB decoded;
outputs above 1000 rows fail with smaller-width guidance. Brightness uses the
ramp ` .:-=+*#%@`; transparent pixels composite onto black. `--invert` reverses
the ramp for different terminal backgrounds. There is no ANSI color output in
the default text capture.

```sh
vectrune ascii image animation.gif --play --width 80
vectrune ascii image animation.gif --rune --width 80 -o animation.rune
vectrune ascii run animation.rune
```

`--play` loops all composited GIF frames in an interactive terminal, without
sound. Space pauses/resumes; Q, Esc and Ctrl-C exit and restore the terminal.
`--frames N` stops after N simulation ticks, not N source GIF frames.
`--play` cannot be combined with `-o` or `--rune`, and rejects non-GIF images.

`--rune` exports a self-contained, runnable ASCII Animator app to stdout or
a new `-o` file; it embeds converted frames, not the original image path.
GIF transparency, frame offsets and disposal are composited by the decoder.
Frame delays are rounded to the nearest 60 Hz simulation tick, with a minimum
of one tick (including zero-delay frames). Playback and exported apps loop
continuously, ignoring the GIF's finite loop count. Still images can also be
exported with `--rune`. Animated modes require at most 80 output rows,
120 GIF frames and 8 MiB of converted ASCII frame data; decode limits remain
8192x8192 and 64 MiB. Reduce width or shorten long GIFs if a limit is exceeded.

`ascii text <text>` supports 1-120 printable ASCII characters, including lowercase
and punctuation. `--font bitmap` (default) uses 8x8 glyphs with a one-column
separator. `--font compact` uses the same bitmap shapes with empty left/right
columns removed (spaces remain four columns wide), still eight rows tall.
`--font double` doubles each bitmap pixel horizontally and vertically: 16x16
glyphs with two-column separators.

`--char <character>` selects filled pixels (default `#`).
`--background <character>` selects empty pixels and separators (default space).
Both must be exactly one printable ASCII character, with no control characters.
Output retains background padding; there is no ANSI color or external font loader.

```sh
vectrune ascii text "HELLO" --font compact --char "*"
vectrune ascii text "RUNE" --font double --char "@" --background "." -o banner.txt
```

Except for interactive `image --play`, generators write only their result to stdout. `-o <file>` / `--output <file>`
writes a **new** file instead, refusing to overwrite an existing file. File
errors are explicit. Text inputs reject newlines, non-ASCII and terminal escapes.
`generate` outputs Rune source; `image` and `text` output plain text, not apps.
The former `ascii demo` and `ascii list` commands have been removed.

## Small complete animation

```rune
@App
type = ascii-animator
scene = hello

@AsciiAnimator/hello
size = [40, 8]
fps = 20
logic = hello
canvas = canvas

@Logic/hello
state:
    x = 0
    canvas = []
action initialize:
    call paint
action tick:
    x = (x + 1) % 35
    call paint
action paint:
    canvas = [
        {"type": "box", "x": 0, "y": 0, "width": 40, "height": 8, "color": "blue"},
        {"type": "text", "x": x + 1, "y": 3, "text": "Hello", "color": "cyan"}
    ]
```

`@App.scene` selects a named `@AsciiAnimator`. `size` is two integers:
1-240 columns and 1-80 rows. `fps` is an integer from 1-60 (default 20).
`logic` references `@Logic/<name>`. `canvas` names a declared state field
(default `canvas`) holding an ordered array of drawing objects.
`initialize` runs once; `tick` runs once per simulation frame. Both actions are
required. `@Logic` timers are rejected: the host owns the frame clock.
Optional `spatial` names a non-repeating `@Ascii3D` scene to supply the shared
`slide`/`sees` helpers with its collision grid; see [Ascii3D](ascii3d.md).
Optional `command` names a one-parameter action for a typed command prompt;
command-mode apps must not also declare key bindings.

## Drawing objects

Later objects overwrite earlier cells. Coordinates are finite numbers from
-4096 through 4096, floored to cell positions; drawing outside the canvas is
clipped. Colors are `white` (default), `gray`, `red`, `green`, `yellow`, `blue`,
`magenta`, and `cyan`.

| `type` | Required fields | Behavior |
|---|---|---|
| `text` | `x`, `y`, `text` | Single-line printable ASCII, at most 4096 characters. Spaces overwrite cells. |
| `line` | `x`, `y`, `x2`, `y2`, `glyph` | Inclusive line; `glyph` is one printable ASCII character. |
| `box` | `x`, `y`, `width`, `height` | `+`, `-`, `\|` border. Optional `fill = true` clears its interior with spaces. |
| `sprite` | `x`, `y`, `name` | Named `@AsciiSprite`; spaces are transparent. Optional zero-based integer `frame` selects a fixed frame. |
| `plot` | `x`, `y`, `width`, `height`, `values`, `min`, `max` | Connected `*` graph. Values clamp to the finite range `min < max`; newest `width` samples spread across the graph. Empty values draw nothing. |
| `ascii3d` | `scene`, `x`, `y`, `width`, `height` | Optional raycast scene layer with depth-tested sprite entities; see [Ascii3D](ascii3d.md). |

All 2D objects accept optional `color`; Ascii3D colors come from its scene.
Unknown fields/types, invalid sizes,
non-printable text, and missing sprite names/frames fail explicitly.
Box/plot sizes have the same bounds as canvas sizes. Canvases allow at most
1024 drawing objects and plots at most 4096 finite samples.

```rune
@AsciiSprite/fish
fps = 3
frames = [["><(((o>"], ["><((o>"]]
```

Sprite frames are arrays of rows: 1-120 frames, 1-80 rows per frame, at most
240 printable ASCII characters per row. Sprite `fps` defaults to 8 and accepts
1-60. Automatic playback is based on simulation ticks, not wall time, so plain
captures are reproducible. `initialize` displays frame zero.

## Input and terminal safety

Use ordinary `@Logic` key bindings, for example:

```rune
keys:
    ArrowLeft -> left
    KeyA -> left
    Space -> pause
```

Supported codes are arrows, `KeyA`-`KeyZ`, `Digit0`-`Digit9`, `Space`,
`Enter`, `Tab`, and `Backspace`. Keys dispatch on press/repeat, not on release;
this is event-based input, not held-key polling. `Q`, `Escape`, and Ctrl-C are
reserved for clean exit in key-binding mode. In command mode Q is ordinary
text; Esc and Ctrl-C still exit. The host restores cursor visibility, colors, the
original screen, and terminal input mode on normal exit and runtime errors.
It requires a terminal at least canvas width by canvas height + 1; reducing
the size pauses simulation until it fits again. Terminal font/color support
determines presentation.

`--frames N` stops after N ticks. `--plain` prints **only the final rectangular
frame**, with no ANSI sequences, no keyboard polling and no delays; its default
is one tick. `--keys` supplies comma-separated Rune key codes, one before each
tick; it requires plain mode and cannot exceed the frame count. Unbound supported
keys do nothing. Redirected interactive execution fails with plain-mode guidance.

## Typed command prompt

```rune
@AsciiAnimator/adventure
size = [78, 29]
fps = 12
logic = adventure
command = command

# In the referenced @Logic section, with initialize/tick and canvas as usual:
action command(input):
    if input == "look":
        call describe
```

The host accepts up to 120 printable ASCII characters, with Enter to submit,
Backspace to erase, and Ctrl-U to clear. Long text scrolls within the footer.
Animation continues while typing. It lowercases commands and collapses whitespace
before invoking the configured action with one string argument. Blank submissions
do nothing. The app implements its own vocabulary and displays its own responses.
Control characters and non-ASCII text are not accepted.

For deterministic captures, repeat `--commands "text"` in plain mode: one command
runs before each tick. Specify at least as many `--frames` as commands.
`--commands` requires a command-mode app and cannot be combined with `--keys`;
command-mode apps reject scripted keys. Plain playback never polls input or opens
audio. See [Borrowed Mornings](../examples/borrowed-morning.md) for a complete
adventure with an original story, nine animated areas, puzzles and an ending.

## Simple synth tones

Define short named cues and play them from ordinary actions:

```rune
@AsciiTone/shot
frequency = 1000
end_frequency = 160
duration = 0.07
wave = square
volume = 0.12

# Inside an existing @Logic action:
sound "shot"
```

`frequency` is required, in Hz (20-8000). Optional `end_frequency` has the same
range and linearly sweeps from the starting frequency. `duration` is seconds
from 0.01-1 (default 0.1); `volume` is 0-0.5 (default 0.15); `wave` is
`sine` (default), `square`, `triangle`, `sawtooth`, or `noise`. A short attack
and release soften clicks. Up to 64 tones may be declared. Only the literal
`sound "name"` form is supported: unknown names, parameters, music commands,
and browser sound aliases are rejected. At most 32 cues may be emitted per
top-level action invocation, including nested calls.

Interactive playback reuses the desktop game's native PCM mixer and opens the
default audio device only when tones are declared. `--mute` skips the device,
including direct execution (`vectrune sentinel.rune --mute`). `--plain` and
headless engines are always silent, while still validating and consuming cues.
Cues are consumed once after each action and can overlap; they do not block
animation. Closing the app stops pending sound. Device/queue errors are explicit;
if no usable device exists, rerun with `--mute`.

Sentinel provides shot, hit, destroyed-drone, hurt, win and loss cues. Its shot
cooldown also limits repeated sound; pause/title screens do not emit cues.
No sound files, music sequencer, or WebAudio setup are needed.

Linux source builds require ALSA development headers (`libasound2-dev` on
Debian/Ubuntu, `alsa-lib-devel` on Fedora). Release builds compile a pinned
static ALSA backend for each Linux target. Playback still requires a usable
ALSA device/configuration; the statically linked musl build cannot load external
ALSA plugins, so plugin-only configurations may require the GNU build or mute.
macOS and Windows use their normal system audio backends.
Linux archives include the ALSA license; releases also supply an audio rebuild
source kit. See [native audio builds](../../docs/native-audio-builds.md).

Supported action statements are assignments (including compound assignments),
array `.push(...)`, postfix `++`/`--`, `increment`, `decrement`, `invert`,
`delete`, `push`, `swap`, `stop`, `sound "declared-tone"`, and `call <declared action>`, nested inside
ordinary conditionals, loops and matches. Unknown statements and I/O commands
are rejected at compile time instead of being silently ignored.

Logic runs with a 64 MiB VM limit and a 250 ms execution budget per VM operation.
Browser APIs, network requests, storage, downloads and clipboard are not
provided by this host. The shared headless interpreter's effect records are
checked and rejected, except declared tones routed to native audio.

## Example tour

`starfield` has layered outward star motion and adjustable warp speed;
`aquarium` combines animated sprites, bubbles and swaying plants.
`observatory` is **simulated** telemetry: two live graphs, radar and counters,
with Space to freeze/resume. It does not read real machine metrics.
`paddle` has ball/paddle collisions, score, pause, loss and restart.
`meteors` has a title screen, increasing falling-rock speed, dodge collisions,
score and restart. Both games use arrows/A/D; see the example README for controls.
The [Ascii3D augmentation](ascii3d.md) adds `sentinel` (maze shooter),
`halls` (endless first-person corridor) and `descent` (downhill tunnel attack).
The nine example files share the `ascii run <path>` and plain-frame workflow.

Sources: [`src/apps/ascii_animator.rs`](../../src/apps/ascii_animator.rs),
[`src/cli/ascii.rs`](../../src/cli/ascii.rs),
[`src/apps/pixel/native_audio.rs`](../../src/apps/pixel/native_audio.rs),
[`examples/ascii/`](../../examples/ascii/),
[`tests/ascii_animator.rs`](../../tests/ascii_animator.rs).
Generator checks: [`tests/ascii_generation.rs`](../../tests/ascii_generation.rs).
