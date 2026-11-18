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

## Extended scripts and shared expressions (unreleased)

Standalone scripts can now use Rune-style assignments, arrays/objects, indexed
mutation, compound assignment, `for item, index in collection:`, `while`, and
`action name(params):` with `return`, `break` and `continue`:

```vect
#!VECT
action double(items):
    result = []
    for item in items:
        result.push(item * 2)
    return result

numbers = double(range(1, 4))
file.write("numbers.json", json.stringify(numbers))
stdio -> "Saved {numbers.length} numbers"
```

Run `vectrune examples/vect_breach/generate_guards.vect` to regenerate all 40
directional guard views without Python or Node. `file.write(path, text)` resolves
relative paths beside the script, regardless of the current working directory;
absolute paths remain absolute. `script_dir` exposes that directory. Writes
replace the target file and report filesystem errors. Parent directories must
already exist.

The release manual renderer is another extended-script example:
`teaching_website/generate_man_pages.vect` reads one JSON inventory line from
stdin and writes two roff manuals using reusable actions and collections.
Run it through `python3 teaching_website/build_man_pages.py --output dist/man`;
Python collects the existing docs inventory and CLI help, while `.vect` handles
all manual rendering. See [offline manuals](../runtime/cli.md#offline-manuals).

Expressions parse once into a typed Pratt AST from
`runtime/rune-web/src/core_expression.ts`. Rune-Web uses the same implementation
for supported expressions, retaining its existing evaluator for specialized
syntax. Native `.vect` execution embeds that code in QuickJS; host adapters
provide interactive stdio and file output. Both adapters run the fixtures in
`tests/conformance/expressions.json`.

The common expression surface includes array/object literals, computed member
access, operator precedence, ternary, Rune nullish fallback (including empty
strings), short-circuit logic, arrow predicates, `.map/.filter/.find`, slicing
and joining. Shared utility functions include `range(start, end?, step?)`,
`repeat(value, count)`, `keys`, `values`, `len`, `hex(value, width?)`,
`json.stringify`, `json.parse`, `floor`, `ceil`, `round`, `pow`, `sqrt`,
`min`, `max`, `abs`, and `clamp`. **`sin` and `cos` take degrees**, as in Rune-Web.
`round` uses JavaScript nearest-integer rounding; the guard baker explicitly
implements ties-to-even color quantization to preserve its original palette.
`repeat` copies values shallowly; use a loop for independent mutable rows.

Multiline array/object/function expressions and trailing `#` comments are
supported. Strings must close on their source line; use escaped newlines.
Actions have local assignment scope and read globals; passed arrays/objects
retain reference semantics. Loops retain assignments in their enclosing scope.
Unknown calls, invalid expressions and I/O failures include the source line.
Native extended scripts have a 128 MiB memory limit, a 120-second interrupt
budget, a statement/loop budget and a recursion limit of 128 actions.

Migration remains incremental: legacy-only programs continue through the
existing executor, including `repeat from line` and `.vectrune` shared IR.
Extended programs use the shared script engine. The legacy `set` syntax keeps
its literal/interpolation behavior; prefer `name = expression` in new scripts.
Do not mix `repeat from line` with extended constructs. Imports, state generators,
pattern matching, REPL integration, Rust backend `run:` expressions and emulator
migration remain work under the language-parity roadmap. The CLI host's
`file.write` capability is not a browser filesystem API.
