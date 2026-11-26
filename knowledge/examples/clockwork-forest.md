# The Thirteenth Bell (unreleased prototype)

[Entry source](../../examples/ascii/games/clockwork/forest.rune) |
[Controls and asset workflow](../../examples/ascii/games/clockwork/README.md)

Wick is the last lamplighter in a haunted clockwork forest. Collect three
clockseeds and reach the gate to awaken it. One scrolling room has separate
platform rectangles, jumping/gravity, two ghosts, checkpoints, preserved
collectibles, restart and a complete ending. Gears animate but do not move
their collision surfaces. There is no persistence.
Ghost contact uses inset rectangles aligned to the rendered integer-cell
positions, not distance between sprite corners. The final overhead ghost stays
clear of the jump from the last gear to the gate.
Ghost GIFs use bright opaque bodies with dark eyes/mouth. The art generator
reserves a separate transparency palette index; optional asset-name arguments
allow targeted regeneration without replacing the other checked-in artwork.

All scenery and actor artwork is loaded from original on-disk GIFs at compile/
startup time. Nine reusable sprites layer parallax trees, moon, gears, terrain,
seeds, ghosts, courier and foreground mist. Text-only HUD/title overlays remain
normal canvas objects. An original two-bar D-minor `@AsciiMusic` score uses
triangle lead and sine bass, reusing Rune-Web's score parser, scheduler and synth.
M pauses/resumes music and disables/enables new sound effects;
`--mute` avoids opening a device. P freezes gameplay/music; sprite animations
continue on the host clock.

Requires the unreleased GIF sprite/music runtime and a 120x36 terminal.
The canvas is 120x35 at 30 FPS with larger sprites. Horizontal acceleration,
air steering, retained jump momentum, four-frame jump buffering and coyote time
make platforming forgiving.
Movement tuning keeps roughly the same jump height with quicker acceleration,
less hang time and stronger descending gravity, without changing the level.
Ordinary terminals do not report reliable key-up:
ground input uses an 18-tick repeat grace then decelerates; Down/S brakes
immediately. Jumping preserves momentum even when Space interrupts arrow repeat.
See [ASCII Animator](../runtime/ascii-animator.md) for `source`, transparency and
timing. Tests: `tests/ascii_gif_sprites.rs`, `tests/ascii_music.rs` and
`tests/clockwork_forest.rs`.
