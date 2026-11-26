# The Kingdom of Borrowed Mornings (v0.3.12)

A complete original text adventure in the native ASCII Animator host.
Tamsin Thread, a royal sock-mender, restores a dawn contract whose missing
letters have turned EVERYONE into ONE. The puzzles reward repairs, sharing,
remembered songs and curiosity rather than combat.

```sh
vectrune ascii run examples/ascii/borrowed_morning.rune
vectrune ascii run examples/ascii/borrowed_morning.rune --mute
vectrune ascii run examples/ascii/borrowed_morning.rune --plain --frames 2 \
  --commands "begin" --commands "talk to kettle"
```

Keep the entry file and its imported `borrowed_morning/scenes.rune` together.
Requires a 78x30 terminal. Nine areas each have animated sprites, plus a title
screen with a repeating eight-note synth phrase and a sunrise ending.
The ordinary `@Logic` action parser handles commands; the host only edits,
normalizes and submits text via `@AsciiAnimator command = command`.

Type `begin`, then `help`. Supported patterns include `look`, `look at object`,
directions, `take item`, `talk to person`, `use item on object`,
`give item to person`, `sing`, `read contract`, and `mend contract`.
The screen lists exact nouns and exits. `inventory`, `journal`, `map`, and
progressive `hint` commands support exploration. `music` toggles title/ending
melody; `--mute` disables all audio. Esc/Ctrl-C exit; Q is ordinary command text.

There are no deaths, timed puzzle consequences, random solutions or item loss
on failed actions. Progress requires repairing the windmill, sharing bread,
learning a lullaby, gathering dew, waking a seed and restoring the charter.
The final repair requires reading the contract and all three proofs.
Restart after the ending resets inventory, progress and journal.
Persistence is not implemented; exiting ends the play session.

The [example README](../../examples/ascii/borrowed_morning/README.md) has a
non-spoiler map and a tested full walkthrough. This is a local example, not an
embedded CLI game or a browser game. The teaching site's ASCII archive includes
the entry file, scene import and README.

Sources: [`examples/ascii/borrowed_morning.rune`](../../examples/ascii/borrowed_morning.rune),
[`examples/ascii/borrowed_morning/scenes.rune`](../../examples/ascii/borrowed_morning/scenes.rune),
[`src/apps/ascii_animator.rs`](../../src/apps/ascii_animator.rs),
[`tests/borrowed_morning.rs`](../../tests/borrowed_morning.rs),
[`tests/terminal/test_ascii_animator.py`](../../tests/terminal/test_ascii_animator.py).
