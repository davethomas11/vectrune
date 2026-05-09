# `.vectrune` Prototype Examples

This folder contains natural-language `.vectrune` scripts that compile into deterministic executable plans for the shared execution engine.

## Current model

- `.vectrune` is a higher-level natural-language surface
- a language engine (English today) parses the request into an intent
- the compiler lowers that intent into executable statements for the shared runtime
- the runtime executes against stdin/stdout and structured variables

## Run the weight timeline example

```powershell
cd C:\Users\davet\dev\vectrune
cargo run -- .\examples\vectrune\together.we.are.vectrune
```

## Current prototype scope

- deterministic English engine only
- one `.vectrune` file at a time
- natural-language compilation is rule-based, not probabilistic
- the current example compiles a weight-timeline survey and renders an ASCII graph
- this path is intended to converge with the shared execution-engine direction documented under `documents/feature/rune_executor_engine/`

