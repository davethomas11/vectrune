# Core Vectrune Language

This page captures the current mental model for authoring `.rune` files.

## File shape

Vectrune documents are organized into sections introduced with `@`.
Examples include:
- `@App`
- `@Schema/User`
- `@Route/GET /users`
- `@Websocket/ws`
- `@Frontend`
- `@Page/home`
- `@Component/HeroBanner`
- `@Style/site`
- `@Logic/site`
- `@Module/Wallet`
- `@Type/Pet`

Within sections, common constructs are:
- key-value pairs like `name = User API`
- series blocks like `run:` with indented steps
- records introduced with `+` in data-oriented sections

Frontend-oriented documents may also use `@Page`, `@Component`, `@Style`, and `@Logic` sections when `@Frontend type = rune-web` is configured. This is currently treated as a frontend mode layered onto app routing, not as a separate `@App type`.

Source builds support [namespaced logic modules and composable entity types](logic-modules.md)
in the shared Rune-Web runtime, including ordinary pages and Pixel game hosts.
Use `modules = {"wallet":"Wallet"}` and `types = ["Pet"]` in `@Logic`.
Module actions/helpers are exported explicitly; type constructors run in actions
and return plain-data records with stable IDs. Existing flat logic stays compatible.

## Rune-Web components

Rune-Web supports reusable view sections through `@Component/<name>`.

```rune
@Component/HeroBanner
view:
    section .hero:
        h1 "Learn Vectrune"

@Page/home
view:
    main:
        HeroBanner
```

Current component behavior:
- component references are expanded during frontend parsing, before server rendering and browser runtime generation
- referencing a component in `view:` uses the component name as a tag-like node, such as `HeroBanner`
- component invocations inherit page state and loop locals automatically
- props (named string values) can be passed at the invocation site as key-value pairs: `HeroBanner title="Learn Vectrune"`

### Component props

Props give each component invocation its own values without touching shared app state.
Inside the component `view:`, reference props with the standard `{propName}` interpolation syntax.

```rune
@Component/Greeting
view:
    div .greeting:
        h2 "{name}"
        p "Welcome to {place}"

@Page/home
view:
    main:
        Greeting name="Vectrune" place="the teaching site"
```

- Props are **static strings** evaluated at invocation time.
- Props can reference loop locals or state using `{…}` syntax at the invocation site (e.g., `title="{item.name}"`).
- Multiple props are space-separated on a single invocation line.
- Component definitions remain reusable — the same `@Component` can be invoked with different props in different places.
- Classes, ids, inline text, events, and child content on the invocation line are not supported; use props instead.
- When passing loop locals, props, or state into view text/attrs, use interpolation braces such as `TicketCard ticket={ticket}`, `id="{id}"`, or `h2 "{title}"`.

#### Declaring expected props with `props:`

A component can declare the props it expects using a bracket-list at the top of the section:

```rune
@Component/Card
props: [title, subtitle?]
view:
    div .card:
        h2 "{title}"
        p "{subtitle}"
```

Behavior:
- Props listed **without** `?` are **required**. If a caller omits one, the parser errors with the missing prop name.
- Props listed **with** a trailing `?` are **optional**. Callers may omit them without error.
- If no `props:` line is declared, no validation is performed — any invocation is accepted.

```rune
# props: [message, level?]
# "message" is required, "level" is optional

@Component/Alert
props: [message, level?]
view:
    div .alert:
        p "{message}"

@Page/home
view:
    main:
        Alert message="Something went wrong"    # ok — level is optional
        Alert                                   # error — message is required
```

## Rune-Web loops

Rune-Web currently supports two equivalent loop styles inside `view:` blocks.

### Inline loop form

This is the existing compact form used in the Tic Tac Toe example:

```rune
button .cell data-index="{index}" click=play(index) "{cell}" <- (cell, index) in board
TicketCard ticket={ticket} <- ticket in board.backlog
```

### Block `for` form

Rune-Web now also supports a block form that is often easier to read for nested component trees:

```rune
for ticket in board.backlog:
    TicketCard ticket={ticket}

for ticket, index in board.backlog:
    div .row data-index="{index}":
        TicketCard ticket={ticket}
```

Current behavior:
- `for` is treated as a protected control keyword inside Rune-Web `view:` blocks
- `for item in collection:` binds the current array item to `item`
- `for item, index in collection:` binds the current array item to `item` and the zero-based array index to `index`
- the block `for` form compiles to the same loop AST/runtime behavior as the inline `<- ... in ...` form
- loop collections are currently array-oriented in server rendering and browser runtime generation

## Rune-Web localization

Define translations in `@I18N/<locale>` sections with matching groups and keys:

```rune
@I18N/en_us
Common {
    hello = "Hello"
}

@I18N/es
Common {
    hello = "Hola"
}
```

Use `%i18n.Common.hello%` in view text or attributes, or `{i18n.Common.hello}` in expressions and component props. `locale = en_us` on `@Frontend` selects the default bundle. The native server accepts `?locale=es` to select another defined bundle for a request. Missing keys do not fall back to another bundle.

An optional `locale_paths` map on `@Frontend` mounts explicit locale URLs:

```rune
locale_paths = { "es": "/es/", "fr": "/fr/" }
```

Each map key must name a defined `@I18N` bundle. Paths are mounted on the native server and can be exported with `vectrune site.rune --path /es/ -o html`. Static hosting requires a generated HTML file at each locale path; it does not evaluate locale query parameters.

## Import declarations

Rune files may declare top-level imports before sections and other top-level content:

```rune
#!RUNE
import "parts"
import "shared_logic.rune"

@App
name = Multi File App
type = REST
```

Current import behavior:
- `import "file.rune"` loads another Rune file before parsing the current file
- `import "directory"` loads all `.rune` files directly inside that directory in sorted filename order
- imports are resolved relative to the importing file's directory
- imported sections are merged first, then the current file is merged on top
- later local key-value assignments override imported key-value assignments when section paths match

Import declarations are handled by a pre-parse loading step. They are not normal runtime statements.

Section key-value pairs may also use inline object literals, including empty objects.

```rune
@Config
state = {}
player = { "name": "worm", "score": 0 }
```

## Common value shapes

The runtime and parser support these common value categories:
- strings
- numbers
- booleans
- lists
- maps/objects

Inline objects and lists are used in runtime expressions as well as data definitions.
For section key-value assignments, JSON-style object literals such as `player = { "x": 10 }` are parsed into map/object values rather than kept as raw strings.

## Portable object syntax

Extended `.vect` scripts, backend `.rune` `run:` blocks, Rune-Web actions and the
browser emulator share these construction and lookup forms. Construction and
reads also work in Rune-Web initial `@Logic` state; mutations belong in executable
scripts, `run:` blocks or actions.

```rune
local batch = { id: i + 1, x: 10, stats: { hp: 3 } } * 3 inc x by 5
actors = [batch with { y: 20 }, batch with { y: 40 }] all { alive: true }
id = 2
actors[]id.stats.hp -= 1
selected = actors[]id
result = { actors, selected }
```

- `{ name, score }` means `{ name: name, score: score }`; explicit and shorthand
  fields can be mixed and nested.
- `{ template } * COUNT inc (x, start_x) by STEP with { overrides }` creates a
  batch. `inc x` is accepted for one property. The template and overrides may use
  zero-based `i`; increments apply before overrides. Counts are integers from 0
  through 1,000,000 and steps are finite numbers.
- `grid COLS x ROWS at (X, Y) step (DX, DY) with { overrides }` emits rows in
  order with position, start position, column and row fields. Overrides may use
  `i`, `row`/`r` and `col`/`c`. `from` is an alias for `at`.
- `with { ... }` copies an object or overrides every object in an array;
  `all { ... }` uses the same operation. Generated and overlaid batches expand
  inside arrays; ordinary nested arrays stay nested. Copies have independent
  nested data, so updates leave the template and other copies intact.
- A named overlay such as `alien with { y: 40 }` uses `alien` when that binding
  exists. Otherwise it looks for `alien_batch`. This shorthand applies to
  overlays in every host, including Rune-Web initial state.
- `objects[]id` selects the first object matching the current `id` binding;
  numeric and string IDs compare by their string value. It supports reads,
  replacements, nested writes and compound writes, including
  `orders[]id.items[]sku.qty += 1`. Missing-match writes do nothing; use `??`
  for a missing read's fallback.
- `local` and `let` create bindings in the current execution scope. Rune-Web
  initial-state locals are private templates and are omitted from public state.

Backend construction fields support literals, paths, arithmetic, comparisons,
booleans, nullish fallback and ternaries. Helper calls and other statements retain
their host-specific support. Bare variable assignment retains each host's
existing value/reference behavior.

The searchable library and `man vectrune-language` document these forms under
**object property shorthand**, **object replication**, **object grid**, **local
templates**, **object overlays**, **matching object lookup** and **compound
assignment**, all sourced from `knowledge/reference/library.json`.
The shared examples are verified by `tests/conformance/objects.json`,
`tests/conformance/object_programs.json` and `tests/object_syntax_parity.rs`.
Runnable script, API and interactive web examples are in
[`examples/language/objects/`](../../examples/language/objects/README.md).

## Execution model

`run:` blocks are executed step-by-step.
A step may be:
- an assignment like `user = users.find it.id == id`
- a builtin call like `parse-json`
- a response command like `respond 200 user`
- a conditional block using `if ...`

## Context and path lookup

Runtime steps resolve identifiers from execution context.
Common values include:
- direct variables such as `id`
- nested values such as `body.name`
- request path params under `path.params.id`
- bracket-path lookups such as `state.players.[id].score`

Bracket lookups are important when part of the path comes from another variable.

## Request body behavior

When a request body is present, it initially enters context as `body`.
Before parsing, `body` may be a raw string.
After `parse-json`, `body` can become a structured JSON object.

## Placeholder expansion in strings

Some builtin behavior may interpret placeholders from context.
Current example: `log` supports placeholder expansion in the form `{expr}` where `expr` resolves through normal context/path lookup.

Example:

```rune
@Route/GET /users/{id}
run:
    log "Fetching user with ID: {id}"
    respond 200 id
```

Nested expressions are also useful:

```rune
log "Player {id} score={state.players.[id].score}"
```

## Conditional blocks

Conditional `if` blocks are supported with arbitrary nesting depth. Indentation determines scope:

```rune
if condition1:
    statement1
    if condition2:
        statement2
        if condition3:
            statement3
```

All statements within an indented block are executed when their `if` condition is true.
Nested conditionals can go as deep as needed; proper indentation is critical for parsing.

## Pattern matching and switch blocks

Pattern matching with `match` (or `switch`) evaluates an expression once and executes only the first matching case branch without evaluating remaining branches:

```rune
match status:
    "title":
        statement1
    "select":
        statement2
    "playing", "player_dying":
        statement3
    else:
        fallback_statement
```

- Supports literals (strings, numbers, booleans) and context identifiers.
- Comma-separated patterns (e.g. `"easy", "normal":`) match if any pattern matches.
- Wildcards `else:`, `default:`, `_:` handle unmatched fallbacks.
- Supported in native REST / Route `run:` blocks as well as Rune-Web and Pixel-3D actions.

## Arithmetic and comparisons

Vectrune supports arithmetic-style expressions and equality checks in runtime evaluation.
Examples in the current codebase include:
- `j = 1 + 1`
- `new_id = books.max it.id + 1`
- `if state.players.[id].x == state.food.x`

Comparison operators like `>`, `<`, `==`, `!=` work in conditional expressions and do not conflict with multiline key markers.

## @Values

A top-level `@Values` section declares read-only constants for server-side `run:` blocks.
Names resolve like any context variable; request data cannot shadow them, and reassigning one fails with a 500.
`@Values` is not implemented in Rune-Web. See `runtime/fetch.md`.

```rune
@Values
weather_url = "https://api.open-meteo.com/v1/forecast?latitude=49.28&longitude=-123.12&current=temperature_2m"

@Route/GET /weather
run:
    weather = fetch-json weather_url
    respond 200 weather
```

## Environment variables

String values may reference environment variables using `$NAME$` syntax.
This is primarily documented as a value-substitution feature for configuration-like values.

## Authoring guidance

When documenting or teaching new language behavior:
- prefer tested examples
- call out whether behavior is parser-level, runtime-level, or builtin-level
- distinguish clearly between raw strings and parsed JSON/object context
- note whether a feature is generally available or only supported by a specific builtin
