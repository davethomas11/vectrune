# Rune-Web UI framework guide

Rune-Web compiles pages, reusable views, state, actions and styles from Rune into HTML and a reactive browser runtime. The teaching site's **Rune-Web guide** group sits below REST API tutorials. It extends the application-type overview; the existing counter page remains available.

## Pages and components

`@Frontend type = rune-web` selects a named `@Page` with `page = workshops`. The page's `view:` composes elements and `@Component` views. A component declares inputs with `props: [title, level, note?]`; a trailing `?` marks an optional prop. Named values at the call site supply each instance's content. `note ?? 'Bring your curiosity.'` provides a fallback.

[Workshop cards](../../examples/rune_web_guide/components.rune) render two instances of the same component with different required and optional inputs. Components reuse view structure; they do not declare server routes or imply independent state stores.

## Reactive state and forms

State values are declared under `state:` on a page or referenced `@Logic`. Interpolation reads state in text and attributes. A named action updates state and the reactive runtime renders the resulting view.

[Workshop RSVP](../../examples/rune_web_guide/forms.rune) uses `change="setGuest(this.value)"` and `change="setSession(this.value)"`. Event arguments can read the event element through `this`. The action assigns its argument to state. Text `change` commits when the user leaves the field; the preview explains this behavior. This example deliberately uses named actions rather than inline assignment of `this.value`.

`<->` is a selection/class binding in the current compiler, not a general input-value binding. Use explicit form events rather than promising automatic two-way form synchronization. The pass is a browser-local preview, not a persisted booking or backend validation flow.

## Actions and repeated views

[Weekend packing list](../../examples/rune_web_guide/packing.rune) demonstrates a complete small app instead of another counter:

- Named `@Logic` actions receive parameters.
- `items.push(...)` adds a record with a stable ID.
- An action `for` loop and `if` condition update the matching record.
- `items.filter it.id != id` removes a record.
- A view `for item in items:` renders each card.
- A view `if items.length == 0:` handles an empty list.
- Conditional expressions choose packed text and a presentation class.

The input updates the draft through a named `change` handler; the Add button calls `addItem()`. IDs advance independently of list length so removing an entry does not reuse an existing ID. Data lives in the browser and resets on preview reload. The small example only guards against an empty string; production input rules and persistence need application logic.

## Selection bindings and view switching

[Trip planner](../../examples/rune_web_guide/navigation.rune) declares:

```rune
state:
    tab = "summary"
bindings:
    .active <-> tab
```

A button with `{.active when 'schedule'}` receives a conditional `active` class and a click assignment to `tab`. `match tab:` selects the summary or schedule component.

## URL Navigation State Synchronization (`@Navigator`)

Rune-Web supports two-way browser URL synchronization using the `@Navigator` section:

```rune
@Navigator
url bound to activePage
```

Options:
- `bind`: Name of the reactive state variable bound to the URL (e.g. `activePage`).
- `mode`: Navigation mode — `"auto"` (default, query with hash fallback), `"query"`, or `"hash"`.
- `param`: Query parameter or hash prefix name (defaults to `"page"`).

Features:
- **Direct Link & Refresh**: When opening `https://vectrune.com/?page=documents` or hitting refresh, `activePage` is initialized directly from the URL.
- **Browser History**: Mutating `activePage` (or clicking links with `navigate('target')`) updates the URL using `history.pushState`.
- **Back / Forward Support**: Clicking browser Back or Forward automatically triggers `popstate` to update reactive state and re-render the view.

## State Replication & Grid Generators

State declarations support concise object generation syntax to eliminate repetitive collections (such as game enemy formations, board grids, or table rows):

### 1D Object Replication & Local Templates:
```rune
state:
    local alien_batch = { "x": 50, "start_x": 50 } * 6 inc (x, start_x) by 65
    aliens = [
        alien with { "y": 40, "start_y": 40, "type": 1 },
        alien with { "y": 80, "start_y": 80, "type": 2 },
        alien with { "y": 120, "start_y": 120, "type": 3 }
    ] all { "alive": true }
```
- `local <name> = <expr>`: Declares a local template or generator in `state:` without exposing it in the public reactive state.
- `<batch_ref> with { ... }`: Maps over a local batch, cloning each element and merging the designated properties.
- `[ ... ] all { ... }`: Post-modifier applying shared properties across all flattened elements in the resulting collection.
- `{ template } * N`: Standalone replication of a template object N times.
- `inc (props) by STEP`: Increments numeric properties across items (`value = base + i * STEP`).

### 2D Grid Generator:
```rune
aliens = grid 6 x 3 at (50, 40) step (65, 40) with { type: row + 1, alive: true }
```
- `grid COLS x ROWS`: Generates a `COLS * ROWS` grid.
- `at (X, Y)` or `from (X, Y)`: Origin coordinates.
- `step (DX, DY)`: Spacing between cells.
- Sets `x`, `y`, `start_x`, `start_y`, `col`, `row`.
- `with { ... }` supports expressions referencing `row`, `col`, or `i`.

## Compressed Action Logic

Rune-Web actions support concise expression and assignment forms:
- **Compound assignments**: `score += 20`, `lives -= 1`, `speed *= 2`, `energy /= 2`.
- **Unary negation**: `alien_dir = -alien_dir`, `move_dir = -1`.
- **Collection restore**: `restore aliens` or `aliens.restore()` resets an entity array to initial coordinates or restores fields prefixed with `start_` (e.g. `x = start_x`, `y = start_y`, `alive = true`).
- **Spatial collisions**: `collide(bullet, alien, width, height)` evaluates bounding box overlap.

## Styles and responsive layout

[Reading shelf](../../examples/rune_web_guide/styling.rune) and the other lessons import [parts/style.rune](../../examples/rune_web_guide/parts/style.rune). `@Style/guide` defines shared `tokens:`, reusable `presets:` and selector `rules:`. A rule uses a preset with `use = (panel)`, references tokens with `{brand}`, and attaches to a page through `style = guide`.

The shared grid adapts its column count to the available width; focus-visible rules preserve visible keyboard focus. Styling declarations are separate from reactive application state. The complete main file and imported style file are visible alongside each live preview.

## Fitting a game board

The [VectRaiders arcade](../../examples/space_invaders/space_invaders.rune) keeps game logic in a fixed 480 by 460 coordinate system. The HTML view maps logical coordinates to percentage positions, with proportional player, invader and shot sizes inside a fluid arena. Physics coordinates remain unchanged; container-relative font sizing keeps alien symbols proportional. The arena uses border-box sizing so its borders fit inside the visible rectangle. This avoids clipping a fixed-size board inside a smaller mobile container.

Cabinet width also respects available viewport height, leaving space for its header and controls. Short landscape views use compact labels and keep touch controls at least 44 pixels high. Both the Games page and Example Lab use the same bounded preview height. The teaching document can scroll normally; the game iframe fits its entire cabinet without an internal scrollbar.

Run `python3 tests/browser/space_invaders.py` to verify both placements in three locales at six viewport sizes. Use `--browser webkit` to check Safari-style rendering, and `--url https://vectrune.com` for a deployed-site check. It verifies arena and entity bounds, iframe overflow, touch targets, movement, firing and keyboard input.

## Run and verify

```sh
cargo run -- examples/rune_web_guide/packing.rune
cargo run -- examples/rune_web_guide/packing.rune -o html > index.html
```

Keep the imported `parts/style.rune` next to the example when copying it. Each app uses a native compiled Rune-Web preview inside the teaching site's iframe sandbox, rather than a simulated counter or JavaScript implementation of the example.

The guide and instructions are localized in English, Spanish and French. Canonical example code and its small demo UI remain in English so the displayed source matches the runnable files exactly.

After building the CLI, run the repeatable browser regression:

```sh
cargo build --bin vectrune
# Install Python playwright and its Chromium browser first.
python3 tests/browser/rune_web_guide.py
```

The check renders all three teaching-site locales, exercises form/list/selection interactions, verifies exact source and imported styles, checks 320/390/768/1440 widths, and revisits the existing Rune-Web counter and REST navigation.

Implementation references: [parser and binding compilation](../../src/apps/rune_web/parser.rs), [event delegation](../../runtime/rune-web/src/events.ts), [action execution](../../runtime/rune-web/src/statement.ts), [teaching pages](../../teaching_website/parts/pages/rune_web_guide.rune).
