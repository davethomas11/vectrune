# Execution Engine

This page describes the current direction for Vectrune execution semantics across both Rune and Vect script surfaces.

## Overview

Vectrune currently has two execution-facing entry points:

- `.rune` documents with `run:` blocks
- `.vect` interactive scripts executed directly by the CLI
- `.vectrune` natural-language scripts compiled into executable programs

The product direction is to converge these toward a shared execution engine rather than letting them evolve into unrelated runtimes.

## Current state

### Rune `run:` execution

Rune `run:` blocks currently execute through the core runtime and are optimized for:
- app routes
- request/runtime context
- builtins
- server-side response handling

This path is mature for app behavior, but much of its step execution still originates from string-like command forms.

### `.vect` prototype execution

`.vect` files currently execute through a dedicated CLI prototype runner.

Current behavior includes:
- direct stdin/stdout access
- explicit statement parsing
- branching via `if`, `else if`, and `else`
- `repeat from line N`
- output interpolation such as `stdio -> "Hello {name}"`

The `.vect` runner already uses a more structured interpreter shape than the current Rune `run:` path.

### `.vectrune` prototype execution

`.vectrune` files currently compile through deterministic language engines into executable programs for the shared runtime.

Current behavior includes:
- default English engine or explicit `language: ...` header
- deterministic intent compilation
- a weight-timeline survey prototype
- reuse of the same shared execution runtime used by `.vect`

## Shared-engine direction

The intended long-term model is:

```text
surface syntax (.rune / .vect / .vectrune)
        ↓
shared execution IR
        ↓
shared interpreter/runtime
```

That shared runtime should eventually be able to execute against contexts that expose:
- local variables
- app/runtime memory
- request/runtime values
- builtins
- stdio when enabled
- response/output channels when enabled

## Why convergence matters

Without a shared engine, the platform risks drift in:
- condition semantics
- control flow semantics
- variable scoping
- output behavior
- debugging/tracing behavior
- documentation and example consistency
- natural-language compiler targets across language engines

## Current `.vect` scope

The current `.vect` prototype is intentionally narrow.

Supported syntax today:
- `stdio -> "text"`
- `.. "text"`
- `name <- stdio`
- `stdio -> "Hello {name}"`
- `if ...:`
- `else if ...:`
- `else:`
- `repeat from line N`

Current constraints:
- one `.vect` file at a time
- CLI interactive execution only
- no `--output`, `--calculate`, `--transform`, or `--merge-with`
- separate from `.rune` document loading

## Current `.vectrune` scope

The current `.vectrune` prototype is also intentionally narrow.

Supported behavior today:
- deterministic English compilation
- weight-timeline survey intent
- birth year prompt
- weight-point collection in `age=weight` format
- ASCII graph rendering

## Near-term plan

Near-term work should favor extracting the structured parts of `.vect` execution into reusable layers rather than forcing `.vect` back into the legacy Rune step executor.

Good next milestones include:
- shared execution context abstraction
- shared expression/interpolation helpers
- shared typed instruction set
- Rune `run:` lowering into that instruction set

## Source anchors

Current implementation anchors include:
- `src/execution/`
- `src/cli/vect.rs`
- `src/cli/vectrune.rs`
- `src/vectrune/`
- `src/core/mod.rs`
- `src/main.rs`
- `tests/integration_vect_cli.rs`
- `tests/integration_vectrune_cli.rs`


