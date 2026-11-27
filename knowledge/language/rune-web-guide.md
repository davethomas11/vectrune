# Rune-Web UI framework guide

Rune-Web compiles pages, reusable views, state, actions and styles from Rune into HTML and a reactive browser runtime. The teaching site's **Rune-Web guide** group sits below REST API tutorials. It extends the application-type overview; the existing counter page remains available.

The teaching site's Games menu orders examples by increasing implementation
complexity: VectRaiders, VectWorms, Monster City, Vect Breach, then Rune Crypt.
This progresses from Rune-Web arcade games to the pixel engine, first-person
Pixel 3D, and a dungeon RPG. The shared
[`SidebarLayout`](../../teaching_website/parts/components/layout.rune) preserves
this order across locales and mobile navigation; routes remain unchanged.

## Pages and components

`@Frontend type = rune-web` selects a named `@Page` with `page = workshops`. The page's `view:` composes elements and `@Component` views. A component declares inputs with `props: [title, level, note?]`; a trailing `?` marks an optional prop. Named values at the call site supply each instance's content. `note ?? 'Bring your curiosity.'` provides a fallback.

[Workshop cards](../../examples/rune-web/guide/components.rune) render two instances of the same component with different required and optional inputs. Components reuse view structure; they do not declare server routes or imply independent state stores.

## Reactive state and forms

State values are declared under `state:` on a page or referenced `@Logic`. Interpolation reads state in text and attributes. A named action updates state and the reactive runtime renders the resulting view.

Translation keys can contain hyphens: `%i18n.Common.app-title%` and
`{i18n.Common.app-title}` resolve the same key during server and browser
rendering. Use spaces around subtraction operators in expressions to make the
intent clear. Run `vectrune examples/rune-web/i18n_demo.rune` and use the
language links for `/`, `/es/`, and `/fr/`. The demo uses `locale_paths` to
serve three translated bundles with ordinary links, including without JavaScript.
Static hosts need an exported HTML file for each locale path.

[Workshop RSVP](../../examples/rune-web/guide/forms.rune) uses `change="setGuest(this.value)"` and `change="setSession(this.value)"`. Event arguments can read the event element through `this`. The action assigns its argument to state. Text `change` commits when the user leaves the field; the preview explains this behavior. This example deliberately uses named actions rather than inline assignment of `this.value`.

`<->` is a selection/class binding in the current compiler, not a general input-value binding. Use explicit form events rather than promising automatic two-way form synchronization. The pass is a browser-local preview, not a persisted booking or backend validation flow.

## Actions and repeated views

For shared server memory, configure `@Frontend reactivity = websocket` and
use a `get-memory` view binding. The runtime injects an `emit` action if the
page does not define one; it preserves other actions and defaults the endpoint
to `/ws`. [`reactivity-contract-rune-web.rune`](../../examples/rune-web/reactivity-contract-rune-web.rune)
shows sending a named payload, updating memory, and broadcasting a
`memory_update` object to connected pages. See
[WebSocket communication](javascript-runtime.md#integration-with-server).

Browser actions can request a device position using
`location.current then located catch locationFailed`. The success action
receives `{ latitude, longitude, accuracy, timestamp }`; `accuracy` is in
metres and `timestamp` is milliseconds since the Unix epoch. Failure receives
`{ code, message }`, with `denied`, `unavailable`, or `timeout` as the code.
`location.if-granted then located catch locationFailed` checks browser
permission first and never prompts; it also reports `prompt` when permission
has not yet been requested. Use `location.current` from a user gesture to ask
for permission. Browser location generally requires HTTPS or localhost. This
command does not itself send coordinates to another service, but an app that
uses them in a request must tell users which service receives them. Because
location is asynchronous, actions should guard against a late result replacing
a newer user choice. Run
[`examples/rune-web/location.rune`](../../examples/rune-web/location.rune) for
a permission-based example that does not transmit the coordinates.
Callbacks retain a snapshot of the calling action's local bindings, allowing
the app to compare a request token against current state before accepting a
result. The `location.if-granted` form requires the Permissions API; when it
is unavailable, it reports `unavailable` without requesting location.

```rune
action useMyLocation():
    location.current then showLocation catch locationFailed

action showLocation(position):
    latitude = position.latitude
    longitude = position.longitude

action locationFailed(error):
    message = error.message
```

### Startup and interactive maps

Set `on_mount = initialize` on `@Page` to invoke a named `@Logic` action once
after the browser's initial render. The action must exist; it does not run
during server rendering or static export. It can use `location.if-granted`
without prompting, leaving an explicit button to call `location.current`.

The [weather example](../../examples/rune-web/weather_web.rune) uses a
Leaflet map with OpenStreetMap tiles:

```rune
div .map data-rune-map=weather data-latitude="{latitude}" data-longitude="{longitude}" data-map-select=chooseMap tabindex=0 aria-label="Map: pan with arrows and press Enter to select"

action chooseMap(point):
    latitude = point.latitude
    longitude = point.longitude
```

Give each map a unique `data-rune-map` key, a CSS height, valid numeric
coordinates and a named `data-map-select` action. A click supplies
`{ latitude, longitude }`; keyboard users can pan with arrow keys and press
Enter to select the center. Map state survives reactive renders, and changing
the coordinates recenters the marker. Map tiles load on display, including
before a place is selected. Tile requests disclose the visitor's IP address
and viewed area to OpenStreetMap, which requires visible attribution and a
valid browser Referer. Its public tile service is best-effort, capacity-limited,
and subject to the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/);
production apps must evaluate an appropriate provider and its terms. For
another provider, set `data-map-tiles="https://tiles.example/$z/$x/$y.png"`
and `data-map-attribution="Provider attribution"` on the map. Only HTTPS
tile URLs without embedded credentials are accepted; attribution is plain
text and must meet the provider's licensing requirements. Search and weather
use Open-Meteo and disclose the query or selected coordinates.

Use `url_encode(value)` to encode one query-string component, not a whole
URL. The example uses request tokens to prevent old searches, location results
and weather results from overriding a newer choice. If tiles cannot load,
search and the device-location button remain available.

[Weekend packing list](../../examples/rune-web/guide/packing.rune) demonstrates a complete small app instead of another counter:

- Named `@Logic` actions receive parameters.
- `items.push(...)` adds a record with a stable ID.
- An action `for` loop and `if` condition update the matching record.
- `items.filter it.id != id` removes a record.
- A view `for item in items:` renders each card.
- A view `if items.length == 0:` handles an empty list.
- Conditional expressions choose packed text and a presentation class.

The input updates the draft through a named `change` handler; the Add button calls `addItem()`. IDs advance independently of list length so removing an entry does not reuse an existing ID. Data lives in the browser and resets on preview reload. The small example only guards against an empty string; production input rules and persistence need application logic.

## Selection bindings and view switching

[Trip planner](../../examples/rune-web/guide/navigation.rune) declares:

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
- `mode`: Navigation mode. Use `auto` (the default), `path`, `query`, or `hash`.
- `param`: Query parameter or hash prefix name (defaults to `"page"`).

Features:
- **Direct Link & Refresh**: When opening `https://vectrune.com/?page=documents` or hitting refresh, `activePage` is initialized directly from the URL.
- **Browser History**: Mutating `activePage` (or clicking links with `navigate('target')`) updates the URL using `history.pushState`.
- **Back / Forward Support**: Clicking browser Back or Forward automatically triggers `popstate` to update reactive state and re-render the view.

### Section links

In path or query mode, bind the URL fragment to a separate state property. The property holds the decoded section ID without the leading `#`, or an empty string when the URL has no fragment. Opening a direct link, refreshing, following a native anchor, or using Back and Forward updates that property.

```rune
@Navigator
url bound to activePage
mode = path
fragment = activeSection

@Logic/guide
state:
    activePage = "home"
    activeSection = ""

action openSection(page, section):
    activePage = page
    activeSection = section
```

Updating both properties in one action creates one history entry. Route and fragment state are independent. Pass an empty string as the section to clear the fragment when opening a page overview. The [teaching header](../../teaching_website/parts/components/header.rune) uses `activeSection` to mark its current section with `aria-current="location"`. Focus and scroll after a lazy route loads are handled by the site shell.

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
- A named overlay checks the exact binding first, then its `_batch` form. Here `alien` resolves to `alien_batch` even when other names start with `alien`.
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

[Reading shelf](../../examples/rune-web/guide/styling.rune) and the other lessons import [parts/style.rune](../../examples/rune-web/guide/parts/style.rune). `@Style/guide` defines shared `tokens:`, reusable `presets:` and selector `rules:`. A rule uses a preset with `use = (panel)`, references tokens with `{brand}`, and attaches to a page through `style = guide`.

The shared grid adapts its column count to the available width; focus-visible rules preserve visible keyboard focus. Styling declarations are separate from reactive application state. The complete main file and imported style file are visible alongside each live preview.

## Fitting a game board

The [VectRaiders arcade](../../examples/games/space_invaders/space_invaders.rune) keeps game logic in a fixed 480 by 460 coordinate system. The HTML view maps logical coordinates to percentage positions, with proportional player, invader and shot sizes inside a fluid arena. Physics coordinates remain unchanged; container-relative font sizing keeps alien symbols proportional. The arena uses border-box sizing so its borders fit inside the visible rectangle. This avoids clipping a fixed-size board inside a smaller mobile container.

Cabinet width also respects available viewport height, leaving space for its header and controls. Short landscape views use compact labels and keep touch controls at least 44 pixels high. Both the Games page and Example Lab use the same bounded preview height. The teaching document can scroll normally; the game iframe fits its entire cabinet without an internal scrollbar.

Run `python3 tests/browser/space_invaders.py` to verify both placements in three locales at six viewport sizes. Use `--browser webkit` to check Safari-style rendering, and `--url https://vectrune.com` for a deployed-site check. It verifies arena and entity bounds, iframe overflow, touch targets, movement, firing and keyboard input.

## Run and verify

```sh
cargo run -- examples/rune-web/guide/packing.rune
cargo run -- examples/rune-web/guide/packing.rune -o html > index.html
```

Keep the imported `parts/style.rune` next to the example when copying it. Each app uses a native compiled Rune-Web preview inside the teaching site's iframe sandbox, rather than a simulated counter or JavaScript implementation of the example.

The guide and instructions are localized in English, Spanish and French. Canonical example code and its small demo UI remain in English so the displayed source matches the runnable files exactly.

The teaching site's shared `WebExample` takes a single source bundle prop, for example `files="{sources ../../../examples/rune-web/studio/rune_studio.rune}"`. The build-time `sources` directive follows the compiler's imports, including recursive directory imports, and embeds an array of `{path, code}` records. The entry file appears first, followed by imported files in path order. Paths resolve relative to the declaring Rune file. Missing files and import cycles fail the build with loader diagnostics. Only loaded Rune files are included; unrelated sibling files are excluded.

The source explorer provides filename filtering, file counts, copy and download controls, and native keyboard-accessible disclosures. The first file opens automatically, with one file expanded at a time. Source content preserves its newlines, indentation, quotes, backslashes and literal template braces through both server and browser rendering. Run `python3 tests/browser/source_explorer.py` to verify all source files for the games and Rune Studio, controls, Example Lab, three locales and mobile widths.

After building the CLI, run the repeatable browser regression:

```sh
cargo build --bin vectrune
# Install Python playwright and its Chromium browser first.
python3 tests/browser/rune_web_guide.py
```

The check renders all three teaching-site locales, exercises form/list/selection interactions, verifies exact source and imported styles, checks 320/390/768/1440 widths, and revisits the existing Rune-Web counter and REST navigation.

Implementation references: [parser and binding compilation](../../src/apps/rune_web/parser.rs), [event delegation](../../runtime/rune-web/src/events.ts), [action execution](../../runtime/rune-web/src/statement.ts), [teaching pages](../../teaching_website/parts/pages/rune_web_guide.rune).

## Teaching site routing and first use

Build the static site with `python3 teaching_website/build_site.py --binary target/debug/vectrune --output _site`. The Pages workflow uses this same builder. It reads named route cases from the teaching layout and renders each destination, including aliases, in English, Spanish and French. `routes.json` records the generated inventory. The builder writes the starter API download and all required assets without modifying the checked-in teaching document. Use `--base /repository/` for hosting below a repository prefix; the generated `rune-base-path` metadata lets runtime URL rendering and chunk fetching resolve that prefix without rewriting displayed source.

For local previews, run `python3 teaching_website/build_site.py --output /tmp/vectrune-preview --serve`. For a fresh checkout, install runtime dependencies with `npm ci --prefix runtime/rune-web` first. Omitting `--binary` builds the browser runtime and workspace compiler before rendering, then serves the generated routes at `http://127.0.0.1:8000/`. Use `--port` for another port. The preview server supports the same not-found recovery and repository-prefix mounting as the static build.

The updated teaching templates require compiler version 0.2.20 or later. Rendering them with Homebrew 0.2.18 reproduces the mixed-version failure: the new language disclosure is visible, but the embedded old router mistakes `/es/` for a page called `es`, redirects to `/es/es`, and builds subsequent links from that mistaken page state. The builder rejects an older `--binary` before touching an existing output. Use the workspace preview command until the installed CLI has been upgraded. Regression coverage now repeatedly cycles English, Spanish and French from home, Studio and a lesson, with refresh after every switch, on the actual preview server.

The native `vectrune teaching_website/teaching.rune` server also registers named navigator destinations for each locale and serves the optimizer's JSON route chunks. This keeps a language switch or refresh on `/es/studio` from returning a server 404. Native mounts accept the slash and non-slash forms. `python3 tests/browser/native_teaching.py` covers the native route, asset, locale-switch and lazy-navigation path separately from static preview hosting. The starter file uses the same content asset path on both hosts. In the static-host 404 shell, language links on old malformed locale-only URLs such as `/es/es` recover to a language homepage instead of reusing `es` as a lesson name.

The [release archive](https://vectrune.com/releases/) is a Rune-Web view over `teaching_website/release.json`. The metadata script validates the data and generates Rune state for static builds and native serving. Published versions link to GitHub Releases and GitHub-only tags link to source at the tag.

Locale roots resolve to home. Localized direct routes choose their locale and route before server rendering, and the browser starts with matching state. Static chunk export includes home so a reader can navigate back from a deep link. Lesson metadata uses localized labels. Unknown destinations have a recovery page; the recovery link uses the URL's locale even when static hosting served the English 404 shell.

The teaching shell groups Learn, Developer, Games, and Tools in an expandable header. On desktop, each category opens a panel with grouped links. On narrow screens, the Menu button opens the same categories as an accordion. The desktop Games menu and arcade page share a preview slideshow for all nine showcases. Players can pause or step through the slides, and reduced-motion settings disable autoplay by default. The shell provides native destination links, a skip link, current-page semantics, a language disclosure, and Escape with focus return. Rune binds the route and section to the URL and drives the current menu link. `site-navigation.js` waits for lazy content before moving focus and restores saved scroll positions on Back and Forward. Attribution stays in document flow. The first browser example precedes installation; the local quickstart supplies a complete downloadable `app.rune`, working-directory instructions, command copying, expected responses and port/terminal guidance.

Run `python3 tests/browser/teaching_ux.py` after building the CLI. It checks the static route inventory, locale entry/switching, mobile widths and action visibility, skip links, keyboard focus, history restoration, anchors, lazy loading, refresh, native new-tab links, labeled search, copy/download, not-found recovery and repository-prefix hosting. It also runs the downloaded starter from a temporary project folder using an available local port. Use `--site-dir /path/to/generated/site` to reuse a build and `--screenshots /tmp/teaching-ux` to capture the checked layouts. Existing guide and source-explorer regressions remain separate interaction checks.

The first implementation pass addresses UX01–UX06 in [the UX review](../../docs/UX_REVIEW.md). Fresh platform installation walkthroughs, screen-reader coverage and the later project-explorer/search work remain tracked in [the roadmap](../../ROADMAP.md).

The following pass addresses UX07, UX08 and UX11. Standalone games and Studio now show a compact introduction and live preview before optional implementation notes; their run-local section explains repository setup and imported folders. The sandbox uses Apply code followed by Send Request, groups document/AST inspection under a disclosure, and provides Reset example. Reset invalidates an in-flight Apply so its later result cannot overwrite the reset state. Studio's SAVE/LOAD use session fallback when iframe storage access is denied, including when reading the `localStorage` property itself throws. EXPORT .RUNE is explicitly a song export, separate from downloading the complete application source.



### Start and reopen a Rune Studio song

Rune Studio opens with the VectWorms preset ready to play. Use **Open song**
to choose a different preset or a saved arrangement; saved songs are not
overwritten by the default.

Select **New Song** to start a blank four-bar arrangement in 4/4 at 120 BPM. Enter a title above the transport and choose **Save** before switching songs. **Open song** lists saved arrangements and presets and can reload the current song's saved version. **Export .rune** downloads the arrangement for use outside the browser. The track list sits next to the editor on wide screens and directly above it on narrow screens. The piano roll scrolls on both axes and keeps the pitch keys visible when you move through time.

### Rune Studio's fixed measures

Open the [Rune Studio example](../../examples/rune-web/studio/rune_studio.rune) and choose **4/4** or **3/4** in the transport. Each bar has 16 or 12 sixteenth-note positions, respectively. Tap the piano roll to place a note at that pitch and position. Stack pitches in the same column to build a chord, or stagger the pitches to make them overlap with independent timing. The **STRIP** is a playback view that shows overlapping pitches on separate rows. Right-click a note or tap its **×** to remove that pitch. Drag one note to move it in time, drag it vertically in the piano roll to change its pitch, or drag its right edge to resize it. Each note stays within its bar and leaves existing notes in place. Separate pitches can overlap.

Use **Select** to tap several notes or drag a box around them. On desktop, hold **Shift** while clicking notes or dragging a selection box. Choose **Copy**, then **Paste**, and tap the grid where the first copied note should start. **Ctrl/Cmd+C** and **Ctrl/Cmd+V** use the same in-session clipboard. Pasting preserves the notes' pitches, lengths, and spacing. Choose a clearer destination or add a bar if a pasted note would cross a bar line, go past the end of the song, or collide with an existing note of the same pitch.

The piano-roll keys, bottom keyboard, and drum pads audition their pitches without adding steps. The **Sound** buttons set the instrument for the active pitched voice. That instrument applies to auditioning, upcoming playback notes, and every overlapping layer in the voice. **Save** includes these choices.

Press **Space** to play or pause. While stopped or paused, click or drag the top of the master ruler, or drag the piano roll or Strip playhead handle, to choose a starting beat. Play resumes at that position. The arrows beside Play jump to the previous or next bar while paused. The double-left arrow returns to the beginning. These controls hide during playback. The bar controls apply to all instruments, and Save and Load remember every pitch and the bar count. Playback and .rune exports include the silence between notes and at the ends of bars, and export overlapping pitches as parallel named tracks.

Older scores with notes beyond an explicit bar boundary show and play only the portion that fits the selected meter. The saved score retains those notes, so widening the meter can reveal them again.

Studio sets `studio_fixed_bars = true` and uses the browser host's `music.edit_steps` action statement. Its matrix supplies the click coordinates through `event.offsetX` and `event.offsetY`. An element with `on_contextmenu="deleteStep(step.id)"` handles right-clicks and suppresses the browser menu over that element.

The deployed v0.2.20 site passed `python3 tests/browser/teaching_ux.py --url https://vectrune.com` on 12 November 2026: 75 successful route/locale responses, repeated language switches with refresh, malformed-locale recovery, desktop/mobile layouts, sandbox Apply/Send/Reset, source downloads, and Studio Save/Load/export. Use `--url` for future deployment smoke checks; this mode reads the public route inventory and does not rebuild or start a local server. The implementation is commit `749ba4a` and deployment run [43281949980](https://github.com/davethomas11/vectrune/actions/runs/43281949980).
