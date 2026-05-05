# Proposed RUNE Frontend Format

## Goal

Define a frontend authoring format that stays true to Vectrune's current section-based style while being:
- less verbose than raw HTML, CSS, and JavaScript
- readable top-to-bottom by a human
- friendly to single-file apps and teaching examples
- easy to compile into plain HTML, CSS, and JavaScript

This is a proposal, not implemented runtime behavior.

## Design principles

1. Keep the existing Vectrune mental model
   - sections start with `@`
   - small key/value metadata stays simple
   - indented blocks describe structure and behavior
2. Prefer readable defaults over exhaustive power
   - short tags
   - short style aliases
   - action-oriented client logic
3. Keep escape hatches
   - raw html, css, or js should still be allowed when needed
4. Make generated output predictable
   - one `@Page` compiles to HTML
   - one `@Style` compiles to CSS
   - one `@Logic` compiles to JavaScript

## Proposed top-level sections

### `@Frontend`
Extends the existing section instead of inventing a separate app type.

```rune
@Frontend
type = rune-web
path = %ROOT%
page = tic-tac-toe
```

Proposed keys:
- `type = rune-web` — frontend is generated from RUNE sections instead of served from a static directory
- `path` — mount path, same idea as current `@Frontend`
- `page` — default `@Page/<name>` entry to render

### `@Page/<name>`
Owns the HTML document shape.

```rune
@Page/tic-tac-toe
title = Tic Tac Toe
style = game
logic = game
view:
    main .screen:
        h1 "Tic Tac Toe"
        p .status "{status_text}"
```

Responsibilities:
- document title and metadata
- semantic structure
- text bindings
- event bindings
- loops and simple conditionals for rendering

### `@Style/<name>`
Defines a concise CSS-like language.

```rune
@Style/game
tokens:
    page-bg = #0f172a
    text-main = #cbd5e1
presets:
    page-base:
        margin = 0
        font = system-ui
rules:
    body:
        use = (page-base)
        bg = {page-bg}
        color = {text-main}
```

Responsibilities:
- repeated design tokens
- reusable style presets
- selector blocks
- readable style aliases
- simple layout helpers
- optional raw CSS escape hatch

### `@Logic/<name>`
Defines client-side behavior with a lighter, action-based language.

```rune
@Logic/game
state:
    board = ["", "", "", "", "", "", "", "", ""]
    turn = X

action play(index):
    if board.[index] != "":
        stop
```

Responsibilities:
- local state
- derived values
- UI event handlers
- optional lifecycle hooks like `start:`

## Proposed page syntax

The page language should read like a simplified HTML outline.

### Element line shape

```text
<tag> [#id] [.class] [name=value ...] [event=value ...] ["text"]
```

Examples:

```rune
h1 "Tic Tac Toe"
p .status "{status_text}"
button .reset click=reset "New Game"
```

### Nesting

Indented children become nested DOM nodes.

```rune
main .screen:
    h1 "Tic Tac Toe"
    p .status "{status_text}"
```

### Text binding

Text supports placeholder expansion using the same visual idea already used elsewhere in Vectrune.

```rune
p "Turn: {turn}"
span "X {score.X}"
```

### Loops

Use a short `each` form instead of verbose template directives.

```rune
each cell, index in board:
    button .cell data-index=index click=play(index) "{cell}"
```

### Conditionals

Use the same `if ...:` shape already familiar in Vectrune runtime blocks.

```rune
if winner != "":
    p .winner "Winner: {winner}"
```

## Proposed style language

The style language should remove common CSS noise without hiding the intent.

### Design tokens for repeated values

Repeated values should use a lightweight `tokens:` block instead of full CSS variable syntax.

```rune
@Style/game
tokens:
    page-bg = #0f172a
    surface = #334155
    text-main = #cbd5e1
    text-strong = #f8fafc
    cell-size = 96px
    pill = 999px

rules:
    body:
        bg = {page-bg}
        color = {text-main}

    .cell:
        size = {cell-size}
        bg = {surface}
        color = {text-strong}

    .score:
        round = {pill}
```

Why `tokens:` instead of generic variables:
- reads more like design intent than programming syntax
- avoids introducing CSS-style scoping and fallback rules too early
- fits the existing Vectrune pattern of named blocks with simple assignments

Recommended rule of thumb:
- use `tokens:` for repeated literals
- keep one-off values inline
- keep tokens flat and style-local for now

### Presets for repeated groups of properties

When the repetition is not just one value but a whole shape of properties, use a `presets:` block.

```rune
@Style/game
tokens:
    surface = #334155
    text-strong = #f8fafc
    pill = 999px

presets:
    badge:
        bg = {surface}
        color = {text-strong}
        pad = 8px 12px
        round = {pill}

rules:
    .score:
        use = (badge)
```

Why `presets:` helps:
- removes repeated groups like card, badge, primary-button, centered-screen
- keeps the selector rules focused on what is unique
- reads more like named design intent than low-level CSS copying

Recommended rule of thumb:
- use `tokens:` for repeated single values
- use `presets:` for repeated groups of properties
- keep preset expansion simple: values written directly in a selector should override preset values

### Selector blocks

```rune
@Style/game
tokens:
    page-bg = #0f172a
    cell-size = 96px

presets:
    page-base:
        margin = 0
        font = system-ui

rules:
    body:
        use = (page-base)
        bg = {page-bg}

    .board:
        display = grid
        columns = 3 x {cell-size}
        gap = 12px
```

### Suggested shorthand aliases

| RUNE style key | CSS output |
| --- | --- |
| `bg` | `background` |
| `color` | `color` |
| `font` | `font-family` |
| `size` | `width` + `height` |
| `round` | `border-radius` |
| `shadow` | `box-shadow` |
| `columns` | `grid-template-columns` |
| `rows` | `grid-template-rows` |
| `place` | `place-items` |
| `text-size` | `font-size` |
| `weight` | `font-weight` |
| `pad` | `padding` |
| `stack` | `display:flex; flex-direction:column` |
| `inline` | `display:flex; flex-direction:row` |

### Escape hatch

A raw CSS block should remain available.

```rune
@Style/game
tokens:
    lift = translateY(-1px)

css >
    .cell:hover {
      transform: {lift};
    }
```

## Proposed client logic language

The logic language should feel like Vectrune runtime steps, but focused on browser interaction.

### State

```rune
state:
    board = ["", "", "", "", "", "", "", "", ""]
    turn = X
    winner = ""
    score = { "X": 0, "O": 0, "draws": 0 }
```

### Derived values

Derived values are recomputed when state changes.

```rune
derive:
    status_text = status-message turn winner
```

### Actions

Actions are named handlers that the page can call from events.

```rune
action play(index):
    if winner != "":
        stop
    if board.[index] != "":
        stop
    board.[index] = turn
```

### Small helper builtins

To keep the language short, the browser-side logic layer should offer a tiny helper set:
- `stop` — return early from an action
- `win board player` — true when the player has a winning line
- `full board` — true when no empty cells remain
- `swap value a b` — return `b` when `value == a`, otherwise `a`

These helpers keep the example readable while avoiding a large JavaScript surface.

## Proposed tic-tac-toe example

```rune
#!RUNE

import "parts"

@App
name = Tic Tac Toe
version = 1.0
type = REST
port = 3000

@Frontend
type = rune-web
path = %ROOT%
page = tic-tac-toe

@Page/tic-tac-toe
title = Tic Tac Toe
style = game
logic = game
view:
    main .screen:
        h1 "Tic Tac Toe"
        p .status "{status_text}"

        div .scoreboard:
            span .score "X {score.X}"
            span .score "O {score.O}"
            span .score "Draws {score.draws}"

        div .board:
            each cell, index in board:
                button .cell data-index=index click=play(index) "{cell}"

        button .reset click=reset "Play Again"
```

With the new import declaration, the root file can stay focused on app and page structure while `parts/style.rune` and `parts/logic.rune` hold the companion frontend sections.

## Why this fits Vectrune

This proposal copies the patterns already familiar in the repo:
- `@Section`-driven structure
- compact key/value metadata
- indented blocks for nested meaning
- `if ...:` as the main readable conditional form
- placeholder interpolation using `{...}`
- action blocks that resemble today's `run:` execution steps

## Recommended implementation order

1. Support `@Frontend type = rune-web`
2. Render a single `@Page` to HTML
3. Add `@Style` shorthand compilation to CSS
4. Add `@Logic` state + action compilation to JavaScript
5. Add one end-to-end example: tic-tac-toe
6. Add docs-site pages generated from the same frontend source model

## Open questions

1. Should `@Page` support reusable components, or should that wait?
2. Should `@Logic` compile to plain JavaScript strings first, or to a tiny runtime helper layer?
3. Should style shorthands stay minimal, or include more design-system style aliases?
4. Do we want `@Page` to support server-rendered values later using the same placeholder syntax?
5. Should `tokens:` remain style-local only, or should Vectrune later support shared theme sections?
6. Should preset composition stay limited to `use = (...)`, or eventually allow lightweight state variants like `hover = accent-button`?

## Companion preview

The hand-written HTML equivalent for the tic-tac-toe example lives at:

- `examples/tic_tac_toe/preview.html`

That file is useful as a visual target for any future compiler or renderer work.





