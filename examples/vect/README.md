# `.vect` Prototype Examples

This folder contains prototype `.vect` scripts for Vectrune.

## What `.vect` is

`.vect` files are interactive script files that execute directly against the runtime instead of going through the `.rune` document parser.

## Language features

| Syntax | Description |
|---|---|
| `stdio -> "text"` | Print a line to stdout |
| `.. "text"` | Continue output with another line (same as `stdio ->`) |
| `name <- stdio` | Read a line from stdin into a variable |
| `stdio -> "Hello {name}"` | Interpolate variables into printed output |
| `set <var> = <value>` | Assign a literal string or number to a variable |
| `if <cond>:` / `else if <cond>:` / `else:` | Conditional branches |
| `while <cond>:` | Loop while condition is true |
| `repeat from line N` | Jump back to source line N (good for retry loops) |
| `stop` | Terminate execution immediately |
| `stop "message"` | Terminate and print a final message |
| `log ...` | Call log builtin (diagnostics) |
| `parse-json [var] [as target]` | Call parse-json builtin |
| `is-set var [as target]` | Call is-set builtin |
| `delete var` | Call delete builtin |

### Condition operators

All conditions support: `==`, `!=`, `>`, `<`, `>=`, `<=`, and `contains`.

```vect
if score >= 100:
    stdio -> "You win!"

if name contains "admin":
    stdio -> "Welcome back, admin."
```

## Examples

### `introducing.vect`
A simple text adventure with branching choices and a retry loop via `repeat from line`.

```powershell
cargo run -- .\examples\vect\introducing.vect
```

### `interpolation.vect`
Demonstrates variable capture and `{var}` interpolation in printed text.

```powershell
cargo run -- .\examples\vect\interpolation.vect
```

### `counter.vect`
Demonstrates `set`, `while` loop, and `stop` with a message.

```powershell
cargo run -- .\examples\vect\counter.vect
```

### `contains_demo.vect`
Demonstrates `set`, `contains` condition, and `stop "message"`.

```powershell
cargo run -- .\examples\vect\contains_demo.vect
```

### `builtins_demo.vect`
Demonstrates builtin function calls: `log`, `parse-json`, and `is-set`.

```powershell
cargo run -- .\examples\vect\builtins_demo.vect
```

## Current prototype scope

- one `.vect` file at a time
- interactive stdin/stdout flow
- no `--output`, `--calculate`, `--transform`, or `--merge-with` support yet
- separate from `.rune` app loading and server runtimes

