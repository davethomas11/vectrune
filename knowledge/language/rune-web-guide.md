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

A button with `{.active when 'schedule'}` receives a conditional `active` class and a click assignment to `tab`. `match tab:` selects the summary or schedule component. The demo uses native navigation buttons; it does not implement a complete ARIA tab widget, browser-history router or URL-based navigation system.

## Styles and responsive layout

[Reading shelf](../../examples/rune_web_guide/styling.rune) and the other lessons import [parts/style.rune](../../examples/rune_web_guide/parts/style.rune). `@Style/guide` defines shared `tokens:`, reusable `presets:` and selector `rules:`. A rule uses a preset with `use = (panel)`, references tokens with `{brand}`, and attaches to a page through `style = guide`.

The shared grid adapts its column count to the available width; focus-visible rules preserve visible keyboard focus. Styling declarations are separate from reactive application state. The complete main file and imported style file are visible alongside each live preview.

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
