# ASCII Animator

Install Vectrune 0.3.12 or build the native CLI from source, then:

```sh
cargo build --bin vectrune
target/debug/vectrune ascii run examples/ascii/starfield.rune
target/debug/vectrune ascii generate --text "Hello!" -o animation.rune
```

You can also animate your own GIF without any example files:

```sh
vectrune ascii image animation.gif --play --width 80
vectrune ascii image animation.gif --rune --width 80 -o animation.rune
vectrune ascii run animation.rune
```

Space pauses; Q/Esc/Ctrl-C exits. GIFs loop continuously with delays rounded to
60 Hz ticks. Exported Rune files embed converted frames and need no GIF at runtime.
Animated modes support up to 120 GIF frames, 80 output rows and 8 MiB of ASCII data.

On Linux, source builds need ALSA development headers (`libasound2-dev` on
Debian/Ubuntu or `alsa-lib-devel` on Fedora).

These examples are ordinary files, not bundled into the binary. Use a checkout
or the documentation's example download, then pass a local path to `ascii run`.
No `ascii demo` or `ascii list` command is provided.
Use `vectrune.exe` on Windows. All demos reserve Q, Esc and Ctrl-C for exit.
The typed adventure instead reserves only Esc/Ctrl-C; Q is normal text input.

| Demo | What to try |
|---|---|
| `starfield` | Layered warp screensaver; Up/Down changes speed. |
| `aquarium` | Fish and jellyfish sprite animation, bubbles and seaweed. |
| `observatory` | Simulated telemetry graphs and sweeping radar; Space freezes/resumes. |
| `paddle` | Arrows/A/D move; Space pauses; R restarts after losing the ball. |
| `meteors` | Enter starts; arrows/A/D dodge; R restarts after a collision. |
| `sentinel` | Ascii3D maze shooter: Enter starts; W/S moves; arrows turn; A/D strafes; Space fires; P pauses; R retries. |
| `halls` | Ascii3D endless hall screensaver: Up/Down changes speed; Space pauses. |
| `descent` | Ascii3D downhill tunnel attack on rails: Enter starts; arrows/A/D steers; Space fires; P pauses; R retries. |
| `borrowed_morning` | Complete original fairy-tale adventure: type BEGIN, then HELP. Nine animated areas, inventory puzzles, journal, hints and a title tune. Needs 78x30. |

```sh
vectrune examples/ascii/aquarium.rune
vectrune ascii run examples/ascii/observatory.rune --plain --frames 30
vectrune ascii run examples/ascii/meteors.rune --plain --frames 40 --keys Enter,ArrowLeft
vectrune ascii run examples/ascii/sentinel.rune
vectrune ascii run examples/ascii/sentinel.rune --mute
vectrune ascii run examples/ascii/halls.rune
vectrune ascii run examples/ascii/descent.rune --plain --frames 60 --keys Enter,Space
vectrune ascii run examples/ascii/borrowed_morning.rune
```

Generate your own without these files:

```sh
vectrune ascii generate --text "Hello!" -o animation.rune
vectrune ascii run animation.rune
vectrune ascii image photo.png --width 80 -o photo.txt
vectrune ascii text "VECTRUNE" -o banner.txt
vectrune ascii text "RUNE" --font double --char "@" --background "."
```

Generators write to stdout by default; `-o` writes a new file and never
overwrites one. `image` and `text` produce plain art, not Rune animations.

Sentinel uses short synthesized cues for shots, hits, damage and win/loss.
`--mute` skips the audio device; it also works with direct file execution.
Plain mode prints only the last frame, without escape codes, sound or delays.
Interactive terminals need at least one more row than the configured canvas.
See the [language and runtime guide](../../knowledge/runtime/ascii-animator.md)
for drawing objects, sprites, key bindings, limits and a complete starter.
See [Ascii3D](../../knowledge/runtime/ascii3d.md) for textured raycast scenes,
3D sprite entities and shared collision/visibility helpers. Descent simulates
downhill motion with pitch and distance/altitude; it does not model real slopes.
The [Borrowed Mornings guide](borrowed_morning/README.md) includes commands,
a map and a spoiler-marked walkthrough. Keep its scene-import directory beside
`borrowed_morning.rune` when copying the game.
