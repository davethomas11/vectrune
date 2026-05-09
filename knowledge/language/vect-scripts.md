# `.vect` Script Language

`.vect` files are structured interactive scripts that execute directly against the Vectrune shared runtime engine — no `.rune` document or language engine is involved.

> **Source of truth:** `src/cli/vect.rs` (parser + AST), `src/execution/` (IR + runtime)  
> **Examples:** `examples/vect/`

---

## File shape

Every `.vect` file begins with the shebang `#!VECT`. Lines starting with `#` are comments and are ignored.

```vect
#!VECT
# This is a comment
stdio -> "Hello, world!"
```

---

## Statements

### Print — `stdio -> "text"`

Writes a line to stdout. Supports `{var}` interpolation.

```vect
stdio -> "Hello, {name}!"
```

### Continuation — `.. "text"`

Shorthand for printing another line immediately after a previous `stdio ->`. Parsed as an independent `Print` statement.

```vect
stdio -> "Line one."
.. "Line two."
```

### Read input — `name <- stdio`

Reads a single line from stdin into a variable.

```vect
answer <- stdio
```

### Assign — `set <var> = <value>`

Assigns a literal string or number to a variable. The value may be a bare number, a quoted string, or a `{var}` interpolation expression.

```vect
set count = 0
set greeting = "Hello"
set label = "Step {count}"
```

At runtime, bare numeric strings are coerced to JSON numbers; `true`/`false` become JSON booleans.

### Conditional — `if` / `else if` / `else`

Standard conditional branching. Indentation determines block scope.

```vect
if score >= 100:
    stdio -> "You win!"
else if score > 50:
    stdio -> "Getting there."
else:
    stdio -> "Keep trying."
```

### While loop — `while <cond>:`

Loops while the condition is true. Subject to a 10,000-iteration safety limit.

```vect
set count = 0
while count < 5:
    set count = {count} + 1
    stdio -> "Tick {count}"
```

### Repeat — `repeat from line N`

Jumps execution back to the statement at or after source line `N`. Useful for retry loops.

```vect
stdio -> "Choose 1 or 2"
choice <- stdio
if choice == "1":
    stdio -> "Good choice."
else:
    stdio -> "Invalid. Try again."
    repeat from line 2
```

### Stop — `stop` / `stop "message"`

Terminates execution immediately. If a message is provided, it is printed before exiting.

```vect
stop
stop "Thanks for playing!"
```

### Call builtin — `<builtin_name> [args...] [as <var_name>]`

Invokes a builtin function directly by name. Builtins are recognized automatically without a special prefix.

```vect
log "User: {name}"
parse-json body as parsed_data
delete old_var
is-set data as exists
```

Supported builtins:
- **`log <message>`** — Log a message to output. Works with interpolation.
- **`parse-json [source_var] [as target_var]`** — Parse JSON from `source_var` (default: `body`). Stores the parsed object in `target_var` (default: `source_var`).
- **`is-set <variable> [as target_var]`** — Check if a variable exists. Assigns `true` or `false` to the result variable (default: `___result___`).
- **`delete <variable>`** — Remove a variable from context.

All Vectrune builtins (`csv.read`, `datasource`, `memory.get`, etc.) are available in `.vect` scripts when run within an app context. In standalone `.vect` execution, only the four listed above are fully supported.

---

## Condition operators

Conditions are evaluated by the shared `eval_condition` engine in `src/core/mod.rs`.

| Operator | Meaning |
|---|---|
| `==` | Equal (loose: numeric strings compared as numbers) |
| `!=` | Not equal |
| `>` | Greater than |
| `<` | Less than |
| `>=` | Greater than or equal |
| `<=` | Less than or equal |
| `contains` | Substring match (case-insensitive) |

```vect
if name contains "admin":
    stdio -> "Admin access granted."
```

---

## Variable interpolation

Any `stdio ->` text or `set` value may contain `{varname}` placeholders. These are resolved via `resolve_path` against the execution context, which supports nested dot-paths (`{player.score}`) and bracket-paths (`{state.players.[id].score}`).

---

## Execution model

`.vect` files are:
1. Parsed into a `VectProgram` (AST) by `src/cli/vect.rs`
2. Lowered to an `ExecProgram` (IR) shared with the `.vectrune` engine
3. Executed step-by-step by the runtime in `src/execution/runtime.rs`

The shared `ExecProgram` IR makes it easy to add new `.vect` constructs that immediately benefit from the runtime's features (interpolation, condition evaluation, control flow).

---

## Source anchors

- `src/cli/vect.rs` — parser, AST, lowering
- `src/execution/ir.rs` — shared IR
- `src/execution/runtime.rs` — execution engine
- `src/core/mod.rs` — `eval_condition`, `resolve_path`
- `examples/vect/` — example scripts
- `tests/integration_vect_cli.rs` — integration tests

---

## Current scope and limitations

- One `.vect` file at a time
- Interactive stdin/stdout only — no file output, transforms, or merges
- No function definitions or subroutine calls yet
- No list/array literals yet
- No `import` support yet
- Separate from `.rune` app loading and server runtimes

### Limited builtin support

Standalone `.vect` files access the full Vectrune builtin library through the shared `call_builtin` interface, which means all builtins work (including `csv.read`, `datasource`, `memory.get/set`, `validate`, etc.). The `.vect` runtime constructs a minimal `AppState` for execution, allowing any builtin that doesn't depend on app-specific routes or schemas to work seamlessly.

**Direct syntax:** Builtins are recognized by name and invoked without any special `call` prefix:
```vect
log "message"
parse-json body as data
datasource db query "SELECT ..." as result
```

**Note:** In standalone mode, builtins have limited access to app-specific metadata (routes, schemas). For full functionality, embed `.vect` constructs within a `.rune` app context.

---

## Future integration

- Planned: extend `.vect` to be embeddable within `.rune` app definitions
- Planned: share more builtins between `.vect` and `.rune` contexts by decoupling AppState dependencies
- Planned: support for function definitions and subroutine calls





