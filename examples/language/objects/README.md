# Portable object syntax

Three runnable examples use the same object syntax in a Vect script, a backend
Rune route, and an interactive Rune-Web page. Use a compiler built from this
checkout; older releases may lack these forms.

Run these commands from the repository root. Each app uses port 3000, so run one
server at a time.

If the checkout's compiler is not installed on your PATH, replace `vectrune` with
`cargo run --` in the commands below.

| Example | Run | What to inspect |
|---|---|---|
| [objects.vect](objects.vect) | `vectrune examples/language/objects/objects.vect` | One JSON result containing generated actors, the untouched template, a grid and a nested order update. |
| [objects-api.rune](objects-api.rune) | `vectrune examples/language/objects/objects-api.rune` | `curl http://localhost:3000/objects/2`; try `/objects/99` for a missing match. |
| [objects-web.rune](objects-web.rune) | `vectrune examples/language/objects/objects-web.rune` | Open `http://localhost:3000/`, select an ID, damage the first match and reset. |

The common recipe is:

```rune
local batch = { id: i + 1, x: 10, stats: { hp: 3 } } * 3 inc x by 5
actors = [batch with { y: 20 }, batch with { y: 40 }] all { alive: true }
id = 2
actors[]id.stats.hp -= 1
selected = actors[]id
result = { actors, selected }
```

The template generates IDs 1–3 at x positions 10, 15 and 20. The two overlays
produce six actors in rows y=20 and y=40. Updating `actors[]id` with `id = 2`
changes the first row's ID 2 to 2 HP. The second row and the template retain
3 HP, including their independent nested `stats` objects.

The examples also show `{ name, copies: actors.length }` property shorthand and
`grid 2 x 2 at (10, 20) step (5, 15) with { id: i + 1, tier: row + 1 }`.
The Vect script demonstrates `orders[]id.items[]sku.qty += 4`; SKU B ends with
quantity 7.

The API builds fresh data for every request. `/objects/99` returns
`selected: null` and leaves every actor at 3 HP. URL IDs are strings and match
numeric object IDs by string value. The web example additionally keeps HP at
zero after repeated damage clicks.

Run the native API and headless web tests together:

```sh
vectrune test examples/language/objects
```

To export the web example as a standalone page:

```sh
vectrune examples/language/objects/objects-web.rune -o html > objects.html
```

Open `objects.html` in a browser; the buttons work without a running server.

For implementation-backed syntax details, see the
[specification](../../../docs/SPECIFICATION.md#46-portable-object-construction-and-lookup-2026-11-18),
the library's **Language and documents** chapter, or `man vectrune-language`.
