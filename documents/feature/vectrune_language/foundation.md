# `.vectrune` Language Foundation

## Vision

`.vectrune` is a natural-language programming surface that compiles deterministic human requests into executable machine behavior.

The key design requirement is abstraction:
- the natural-language engine should be replaceable
- English is only one engine implementation
- other language engines such as French should be able to target the same execution core

## Foundational principles

1. **Deterministic compilation**
   - `.vectrune` must compile through explicit rules, not opaque probabilistic execution
2. **Shared runtime target**
   - `.vectrune` should compile into the same execution direction used by `.vect` and future Rune lowering
3. **Language-engine abstraction**
   - parsing natural language belongs to swappable engines
4. **Executable plans, not freeform prompts**
   - the output of compilation must be typed and runnable

## Current foundation

The current implementation establishes:
- a shared execution runtime under `src/execution/`
- a `.vect` parser that lowers into that shared runtime
- a `.vectrune` compiler path under `src/vectrune/`
- an English rule-based language engine

## Current compiler stages

```text
.vectrune file
  -> document parse
  -> language selection
  -> language-engine parse
  -> semantic intent
  -> executable shared-runtime program
```

## Current v1 capability

The first supported `.vectrune` intent is:
- ask the user for birth year
- collect weight-over-time points
- render an ASCII graph

This is intentionally narrow. The goal is to prove the architecture, not to pretend the language is broad before the compiler model is stable.

## Why this is important

This feature is not just about a new file extension.
It is the first concrete step toward a programming model where:
- humans express intent in natural language
- a deterministic compiler translates intent into typed execution
- execution remains auditable and machine-safe

## Next steps

Near-term growth should focus on:
- more English patterns with strict deterministic compilation
- a second language engine (French) targeting the same intent model
- more shared execution statements
- builtin access through the shared runtime
- eventual convergence with Rune `run:` lowering

