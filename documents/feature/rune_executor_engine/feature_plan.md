# Rune Executor Engine

## Goal

Create a shared execution engine that can power both:
- `.rune` `run:` blocks
- `.vect` interactive scripts

The immediate aim is to prevent semantic drift between the two execution models while keeping Vect experimentation fast.

## Why this feature exists

Today the repository has two execution styles:

1. **Current Rune `run:` execution**
   - built around string-based steps
   - strongly coupled to HTTP/app runtime context
   - effective for route handlers and builtins
   - harder to evolve into a structured scripting model

2. **Current `.vect` execution**
   - built around a typed statement tree
   - explicit control flow and interpreter loop
   - simpler to test and extend
   - currently isolated from the main Rune executor

If these two models evolve independently, the language will drift.

## Feature direction

The long-term direction is:

```text
.rune parser -----> shared execution IR -----> shared interpreter/runtime
.vect parser -----^
```

### Shared execution layers

1. **Surface syntax**
   - `.rune` route/app `run:` blocks
   - `.vect` script files

2. **Shared execution IR**
   - typed instruction model for assignment, branching, builtins, stdio, response, loops, and jumps

3. **Shared runtime**
   - executes the IR against a context that can expose:
     - local variables
     - request/runtime context
     - app memory
     - builtins
     - stdio
     - response channel

## Current prototype state

The `.vect` prototype already demonstrates the preferred execution shape:
- explicit statement enums
- explicit control flow
- block-based parsing
- reusable condition evaluation from `core`
- incremental feature growth with targeted tests

Current `.vect` prototype capabilities:
- `stdio -> "text"`
- `.. "text"`
- `name <- stdio`
- output interpolation such as `stdio -> "Hello {name}"`
- `if`, `else if`, `else`
- `repeat from line N`

## Proposed migration path

### Phase 1 — stabilize `.vect`
- continue experimenting in a small, typed interpreter
- add useful script semantics in isolated steps
- keep tests focused and example-driven

### Phase 2 — extract shared execution module
Create a reusable execution layer, likely under a future path such as:
- `src/execution/ast.rs`
- `src/execution/runtime.rs`

### Phase 3 — lower `.vect` into shared IR
- `.vect` becomes a parser frontend for the shared runtime

### Phase 4 — lower Rune `run:` into shared IR
- `run:` blocks stop being executed as raw string steps
- route logic becomes typed and more analyzable

### Phase 5 — retire or shrink legacy string-step execution
- keep compatibility where needed
- converge on one execution model

## Capability matrix

| Capability | `.vect` prototype | current `run:` | target shared engine |
|---|---:|---:|---:|
| typed statements | yes | partial/no | yes |
| stdio | yes | no | yes (opt-in) |
| request context | no | yes | yes |
| builtins | limited | yes | yes |
| structured branching | yes | partial | yes |
| line-based repeat/jump | yes | no | maybe |
| execution tracing | easier | harder | yes |

## Near-term implementation ideas

Good next steps that fit this feature:
- variable interpolation in `.vect` output
- labels or named jumps instead of `repeat from line N`
- selective builtin calls from `.vect`
- explicit assignment from literals and expressions
- reusable execution context abstraction shared with Rune

## Risks

- over-fitting `.vect` syntax before the shared IR exists
- trying to rewrite all of Rune execution in one pass
- coupling stdio assumptions into HTTP execution paths

## Success criteria

This feature is successful when:
- `.vect` and Rune `run:` move toward the same execution semantics
- the interpreter core becomes testable without a full app runtime
- adding control-flow features no longer requires parsing raw command strings in many places
- docs can describe one execution model with multiple frontends

