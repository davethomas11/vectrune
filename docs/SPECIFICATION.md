# Vectrune Language Specification (Draft v1.0)

This document serves as the canonical formal language specification for the Vectrune ecosystem. It standardizes lexical structure, expression evaluation, operator precedence, statement semantics, and document shapes across all runtime targets (Rust Core, Rust Backend, Rune-Web, Browser Emulator, REPL, and Mobile).

---

## 1. Lexical Grammar & Tokens

### 1.1 Source Encoding & Shebang
A Vectrune source file is UTF-8 encoded text. An optional shebang may appear as the very first line:
- `#!RUNE` for general declarative and full-stack documents.
- `#!VECT` for imperative standalone scripts.

### 1.2 Comments
- Full-line or trailing comments start with `#` (unless `#` is part of a hex color `#39ff14` or schema type reference `#User`).
- Block comments are not currently standard; repeated `#` lines are used.

### 1.3 Identifiers
- Identifiers match `[a-zA-Z_][a-zA-Z0-9_-]*`.
- In path expressions, nested properties use dot-syntax (`a.b.c`) or bracket notation (`items[0]`, `state[key]`).

### 1.4 Literals
- **Numeric**: Integers (`42`, `-10`), floating point (`3.14159`, `-0.5`).
- **Boolean**: `true`, `false`.
- **Null**: `null`.
- **Strings**: Double-quoted (`"hello\nworld"`) or single-quoted (`'hello'`).
  - Supports standard escapes: `\"`, `\'`, `\\`, `\n`, `\t`, `\r`.
  - Supports embedded interpolation `{expression}` inside string bodies.
  - Multi-line strings preserve line breaks when defined under multiline keys or triple-quotes.
- **Collections**:
  - Array literals: `[1, 2, "three", true]`.
  - Object / Map literals: `{ "x": 10, "y": 20 }` or `{ x: 10, y: 20 }`.
  - Object property shorthand: `{ name, score }` means `{ name: name, score: score }`.

---

## 2. Expressions & Operator Precedence

Expressions are evaluated according to standard operator precedence (from highest binding power to lowest):

| Precedence Level | Category | Operators | Associativity | Description |
|---|---|---|---|---|
| **1 (Highest)** | Primary | `(...)`, literals, identifiers | N/A | Grouping and atomic values |
| **2** | Postfix / Member | `.prop`, `[expr]`, `call(...)` | Left | Field access, index lookup, function invocation |
| **3** | Unary | `-`, `!`, `not` | Right | Arithmetic negation, logical NOT |
| **4** | Multiplicative | `*`, `/`, `%` | Left | Multiplication, division, modulo |
| **5** | Additive | `+`, `-` | Left | Addition, string concatenation, subtraction |
| **6** | Relational | `<`, `<=`, `>`, `>=` | Left | Numeric and string ordering comparisons |
| **7** | Equality | `==`, `!=`, `contains` | Left | Value equality, case-insensitive substring search |
| **8** | Logical AND | `and`, `&&` | Left | Short-circuit boolean conjunction |
| **9** | Logical OR | `or`, `\|\|` | Left | Short-circuit boolean disjunction |
| **10** | Nullish Coalescing | `??` | Left | Fallback if LHS is `null`, `undefined`, or empty string |
| **11 (Lowest)**| Conditional / Ternary | `cond ? true_val : false_val` | Right | Inline ternary branching |

### 2.1 Collection Pipeline Methods
Collections support method chaining on arrays:
- `.filter(it => condition)` or `.filter(item => condition)`
- `.find(it => condition)`
- `.any(it => condition)`
- `.max(it => score_expr)`
- `.length`

### 2.2 Standard Math & Spatial Primitives
- `clamp(val, min, max)`: Restricts value within `[min, max]`.
- `collide(box_a, box_b, width, height)`: Axis-aligned 2D AABB bounding check.
- `abs(val)`: Absolute value.
- `random(min, max)`: Pseudo-random integer between `min` and `max` inclusive.
- `min(a, b, ...)` / `max(a, b, ...)`: Minimum or maximum of given operands.

---

## 3. Statement Grammar

### 3.1 Assignments
- **Simple Assignment**: `<path> = <expression>`
- **Compound Assignment**: `<path> += <expr>`, `<path> -= <expr>`, `<path> *= <expr>`, `<path> /= <expr>`

### 3.2 Control Flow
- **Conditional**:
  ```rune
  if condition:
      # steps
  else if other_condition:
      # steps
  else:
      # steps
  ```
- **Loop**:
  ```rune
  for item in collection:
      # steps
  for item, index in collection:
      # steps
  ```
- **While Loop**:
  ```rune
  while condition:
      # steps
  ```
- **Pattern Matching**:
  ```rune
  match expression:
      "matcher_a" -> actionA
      "matcher_b" -> actionB
      _           -> fallbackAction
  ```
- **Early Exit**:
  - `stop`: Terminates the current execution block / action.
  - `stop when condition`: Guards against execution when condition is true.

---

## 4. Document Structure & Metamodel

### 4.1 Section Headers (`@Section`)
A section header begins with `@` at column 0:
- `@App`
- `@Page/<slug>`
- `@Component/<Name>`
- `@Logic/<Name>`
- `@Style/<Name>`
- `@Route/<METHOD> <path>`
- `@Schema/<Name>`
- `@I18N/<locale>`
- `@Navigator`

### 4.2 Key-Value Pairs
Simple assignment at root of section or record:
```rune
title = VectWorms
version = 1.0
```

### 4.3 Series & Blocks
Key followed by colon and indented child elements:
```rune
view:
    main .container:
        h1 "Hello"
```

### 4.4 Records (`+`)
Repeated data rows within a section:
```rune
+ name: "Alice"
  role: "Engineer"
+ name: "Bob"
  role: "Designer"
```

### 4.5 State Generators
Declarative replication of data items:
- 1D Generator: `{ template } * N inc (props) by STEP with { overrides }`
- 2D Grid: `grid COLS x ROWS at (X, Y) step (DX, DY) with { overrides }`
- Local Templates: `local template_name = { ... }`
- Batch Modifiers: `all { prop: val }`

### 4.6 Portable object construction and lookup (2026-11-18)

Object construction works in extended `.vect` scripts, backend `.rune` `run:`
blocks, Rune-Web actions and initial `@Logic` state, and the browser emulator.
Mutations belong in executable scripts, `run:` blocks or actions. Object fields
use `:`. Names resolve from the current scope.

```rune
local batch = { id: i + 1, x: 10, stats: { hp: 3 } } * 3 inc x by 5
actors = [batch with { y: 20 }, batch with { y: 40 }] all { alive: true }
id = 2
actors[]id.stats.hp -= 1
selected = actors[]id
result = { actors, selected }
```

- Replication accepts `inc x` or `inc (x, start_x)`. The template and optional
  `with { ... }` overrides can use the zero-based `i`; increments apply before
  overrides. Counts are integers from 0 through 1,000,000; steps are finite numbers.
- `grid COLS x ROWS at (X, Y) step (DX, DY) with { ... }` emits rows in order,
  with `x`, `y`, `start_x`, `start_y`, `col`, and `row` fields. Overrides can use
  `i`, `row`/`r`, and `col`/`c`. `from` is an alias for `at`.
- `template with { ... }` copies an object or overlays every object in an array.
  `all { ... }` is the same overlay operation. Generated batches and overlay
  arrays expand inside array literals; ordinary nested arrays stay nested.
  A bare overlay name resolves exactly first, then tries the `_batch` suffix.
  For example, `alien with { y: 40 }` uses `alien_batch` when `alien` is absent.
- Generated objects and overlays copy nested data, so later updates do not
  change the template or other copies. Bare variable assignment retains the
  host's existing value/reference behavior.
- `objects[]id` selects the first object whose `id` matches the scope's `id`.
  Numeric and string IDs compare by their string value. Reads can use `??` for
  a missing match; writes and compound writes to missing matches do nothing.
  Lookups can nest, as in `orders[]id.items[]sku.qty += 1`.
- `local` and `let` declare a binding in the current execution scope. Rune-Web
  initial-state locals remain private templates and are omitted from public state.

Portability covers these construction forms. Backend field expressions support
literals, paths, arithmetic, comparisons, booleans, nullish fallback
and ternaries. UI, game and filesystem adapters remain
specific to their hosts; arbitrary helper calls and statements have their host's
existing support. The fixtures in `tests/conformance/objects.json` and
`object_programs.json` cover both values and mutation behavior across hosts.

## 5. Shared Expression / Vect Implementation Slice (2026-11-14)

`runtime/rune-web/src/core_expression.ts` implements a typed Pratt AST with the
precedence table above. Native extended `.vect` scripts embed the same evaluator
used by Rune-Web; they do not use JavaScript `eval` for user expressions. Parsed
expressions and assignment targets are cached for reuse. The JSON fixtures in
`tests/conformance/expressions.json` run against native Vect execution, Rune-Web
and the browser emulator. This is an implementation slice, not a claim that
every runtime implements the full draft.

The browser emulator uses the same parser for supported expressions, with a
bounded cache of compiled expressions evaluated against each request's current
scope. This aligns precedence, unary operators, nullish fallback, ternaries,
math helpers and explicit-lambda collection pipelines such as
`items.filter(n => n > 2).map(n => n * 2)`. Its existing bare-text values and
helper shorthand (`items.find it.id == 1`, `full`, `swap`, `mask`) retain the
legacy evaluator. This does not add Rune-Web UI, game or statement features to
the emulator.

Extended Vect supports `action name(params):` and `return expression`, local
action assignments, reference-valued array/object parameters, `for item, index
in expression:`, `while`, `break`, and `continue`. Arrays and objects can span
source lines inside balanced brackets; string literals use escaped newlines.
The canonical math surface uses **degrees for `sin`/`cos`**, and `round` rounds
ties toward positive infinity. `range(start, end?, step?)` excludes its end;
`range(end)` starts at zero. `repeat(value, count)` makes a shallow array.

The native adapter supplies `file.write(path, text)` and `script_dir`. Relative
output paths resolve beside the source script; absolute paths are preserved.
Browser runtimes do not receive filesystem access from the common evaluator.
Legacy-only Vect programs, including line jumps, retain their original executor.
Backend object construction uses the portable Rust evaluator in
`src/object_syntax.rs`, also used for Rune-Web initial state. The rest of the
backend expression engine, imports and the REPL still need the migrations
described in `LANGUAGE_PARITY_ROADMAP.md`.

### Pixel-3D map starts

An `@Map` can declare `spawn = {"x":1.5,"y":1.5,"angle":0}` in world tile
coordinates. Integer coordinates are tile edges; `.5` places the camera at a
tile center. Angles are degrees: east 0, south 90, west 180, north 270.
`map_spawn("e1m2")` returns a fresh copy for game logic; Vect Breach sets
`player = map_spawn(level_map)` when entering a sector. The compiler rejects
non-numeric starts, out-of-bounds starts and starts inside solid tiles. Spawn
metadata is shared by web/native play and embedded logic tests.

### Declarative game input profiles (unreleased)

Pixel and Pixel 3D scenes may reference `controls = name`, resolving an imported
`@Controls/name` section. Profiles contain `keys`, `commands`, `mouse`, `gamepad`
mappings, a `touch` layout and optional `extends`. Physical bindings resolve to
named boolean/numeric inputs consumed by `tick(input)` or one-shot game/host
commands. Arrow series and JSON maps are accepted; `null` explicitly unbinds a
control. Existing scenes without a profile retain their old input configuration.
See [Game controls](GAME_CONTROLS.md) for the schema, inheritance, source merging,
touch layout, native/browser parity and runnable examples. Existing Rune-Web
`@Logic keys:` remains an action-on-keydown interface.
