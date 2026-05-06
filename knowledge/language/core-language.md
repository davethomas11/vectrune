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

Within sections, common constructs are:
- key-value pairs like `name = User API`
- series blocks like `run:` with indented steps
- records introduced with `+` in data-oriented sections

Frontend-oriented documents may also use `@Page`, `@Component`, `@Style`, and `@Logic` sections when `@Frontend type = rune-web` is configured. This is currently treated as a frontend mode layered onto app routing, not as a separate `@App type`.

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

## Arithmetic and comparisons

Vectrune supports arithmetic-style expressions and equality checks in runtime evaluation.
Examples in the current codebase include:
- `j = 1 + 1`
- `new_id = books.max it.id + 1`
- `if state.players.[id].x == state.food.x`

Comparison operators like `>`, `<`, `==`, `!=` work in conditional expressions and do not conflict with multiline key markers.

## Environment variables

String values may reference environment variables using `$NAME$` syntax.
This is primarily documented as a value-substitution feature for configuration-like values.

## Authoring guidance

When documenting or teaching new language behavior:
- prefer tested examples
- call out whether behavior is parser-level, runtime-level, or builtin-level
- distinguish clearly between raw strings and parsed JSON/object context
- note whether a feature is generally available or only supported by a specific builtin
