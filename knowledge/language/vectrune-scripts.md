# `.vectrune` Scripts

`.vectrune` files are a prototype natural-language scripting surface for Vectrune.

## Goal

The purpose of `.vectrune` is to let deterministic natural-language requests compile into executable code against the shared execution engine.

This is intended to support a model where the natural-language layer is abstract and swappable. For example:
- English engine
- French engine
- potentially other deterministic language engines in the future

## Current execution pipeline

The current prototype flow is:

```text
.vectrune source
  -> parse document + language header
  -> language engine (English v1)
  -> semantic intent
  -> executable program for shared runtime
  -> stdin/stdout execution
```

## Current file shape

Current `.vectrune` files may either:
- start with a language header such as `language: en`
- or omit it and use the default English engine

Example:

```text
language: en
Ask the user for their birth year and weight through out their life time then graph their weight over time.
```

## Current prototype behavior

Today the English engine is deterministic and rule-based.

Supported behavior:
- recognizing a weight-timeline survey request
- recognizing an onboarding flow request
- asking for the user birth year
- collecting weight points as `age=weight`
- rendering an ASCII graph over time
- walking through a series of onboarding steps

## Important constraints

- `.vectrune` is still a prototype surface
- compilation is deterministic, not LLM-driven
- one `.vectrune` file at a time in the CLI
- the current English engine only recognizes a narrow set of requests
- unsupported requests fail with an explicit compiler error

## Relationship to `.vect` and `run:`

`.vectrune` is not meant to become a separate forever-runtime.

The long-term direction is:
- `.vectrune` as a high-level natural-language surface
- `.vect` as a lower-level structured script surface
- Rune `run:` as an app/document execution surface
- all of them converging toward a shared execution engine

## Swappable Language Models

Vectrune uses a data-driven approach for natural-language parsing. Language definitions are stored as `.rune` files in `knowledge/languages/`.

### Loading Priority:
1.  **Local Overrides:** The engine first looks for `.rune` files in the `knowledge/languages/` directory relative to the executable.
2.  **Embedded Defaults:** If no local files are found, it falls back to models baked directly into the binary at compile time.

This allows developers to add or modify language support without needing to recompile the Rust source code.

## Source anchors

Current implementation anchors include:
- `src/vectrune/`
- `src/execution/`
- `src/cli/vectrune.rs`
- `tests/integration_vectrune_cli.rs`
- `examples/vectrune/`

