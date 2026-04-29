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

Within sections, common constructs are:
- key-value pairs like `name = User API`
- series blocks like `run:` with indented steps
- records introduced with `+` in data-oriented sections

## Common value shapes

The runtime and parser support these common value categories:
- strings
- numbers
- booleans
- lists
- maps/objects

Inline objects and lists are used in runtime expressions as well as data definitions.

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

## Arithmetic and comparisons

Vectrune supports arithmetic-style expressions and equality checks in runtime evaluation.
Examples in the current codebase include:
- `j = 1 + 1`
- `new_id = books.max it.id + 1`
- `if state.players.[id].x == state.food.x`

## Environment variables

String values may reference environment variables using `$NAME$` syntax.
This is primarily documented as a value-substitution feature for configuration-like values.

## Authoring guidance

When documenting or teaching new language behavior:
- prefer tested examples
- call out whether behavior is parser-level, runtime-level, or builtin-level
- distinguish clearly between raw strings and parsed JSON/object context
- note whether a feature is generally available or only supported by a specific builtin
