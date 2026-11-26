# The Kingdom of Borrowed Mornings

An original, complete fairy-tale text adventure. You are Tamsin Thread, the
royal sock-mender. Bellwether has been stuck at midnight for three days. A magpie
notary owns the dawn, a troll wants breakfast, and the law has a hole in it.
Bring your sewing kit. This is a story about small repairs, not swords.

## Play

From the repository root:

```sh
cargo build --bin vectrune
target/debug/vectrune ascii run examples/ascii/borrowed_morning.rune
```

Or download the ASCII example archive, keep `borrowed_morning.rune` beside the
`borrowed_morning/` directory, and run the local entry file. Nothing is embedded.
The terminal must be at least **78 columns by 30 rows**.
Use `--mute` to skip the audio device. Type `begin` at the title.

There are nine animated locations, a title theme, an animated sunrise ending,
inventory exchanges, reusable tools, a journal, and progressive hints.
There are no deaths, time limits, combat, random puzzle solutions, or discarded
items. Failed uses never consume items; needed objects cannot be lost.
Expect roughly 15-25 minutes of exploration. Saves are not implemented;
leaving the app ends the session. `restart` is available after the ending.

Commands are case-insensitive; extra spaces collapse. Enter submits,
Backspace edits, Ctrl-U clears, and Esc/Ctrl-C exits. `q` is an ordinary letter
in command mode, not an exit key. Input is limited to 120 printable ASCII
characters. The scene keeps animating while you type.

| Command | Example |
|---|---|
| `look`, `look at`, `examine` | `look at charter` |
| `go` or a direction | `go east`, `north`, `up`, `w` |
| `take`, `get` | `take thimble` |
| `talk to`, `talk` | `talk to librarian` |
| `use ... on ...` | `use sewing kit on sail` |
| `give ... to ...` | `give flour to baker` |
| Special actions | `sing`, `read contract`, `mend contract` |
| Reference commands | `help`, `inventory` (`i`), `journal`, `map`, `hint` |
| Music | `music` toggles the title/ending tune |

Use the exact nouns printed beneath each scene. The parser intentionally uses
clear verb/noun patterns, not arbitrary natural language.

## Map (no puzzle spoilers)

```text
             LIBRARY
COTTAGE ---- SQUARE ---- ORCHARD ---- MARSH
               |
              MILL ---- BRIDGE ---- OBSERVATORY
                                        |
                                      TOWER
```

## Walkthrough (spoilers)

Try `hint` in the game before reading this. Every command below is exercised
by `tests/borrowed_morning.rs`.

```text
begin
take ribbon
take thimble
east
south
use sewing kit on sail
take flour
north
give flour to baker
south
east
give bread to troll
west
north
east
take apple
west
north
give apple to librarian
south
east
east
sing
use thimble on dew
west
west
south
east
east
use ribbon on vane
use dew on seed
up
read contract
use star bottle on contract
use bell on contract
use seed on contract
mend contract
```

Read and talk along the way for the story. The key discovery is that a torn
contract has turned EVERYONE into ONE. Starlight, freely shared kindness and
a living promise supply the evidence; your humble sewing kit does the rest.

## Capture commands without a terminal

```sh
vectrune ascii run examples/ascii/borrowed_morning.rune --plain --frames 2 \
  --commands "begin" --commands "talk to kettle"
```

Plain mode is silent, processes one command before each tick, and prints only
the final frame. Increase `--frames` to at least the number of `--commands`.
