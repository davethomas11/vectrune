# Vectrune Language Parity & Unified Engine Architecture Roadmap

## Executive Summary

Vectrune has grown organically across several execution targets:
1. **Rust Core Document Engine**: `src/rune_parser.rs`, `src/rune_ast.rs`
2. **Rust Backend Step Execution (`run:`)**: `src/core/mod.rs`, `src/execution/runtime.rs`, `src/builtins/`, `src/arithmetic.rs`
3. **Rust Rune-Web Compiler**: `src/apps/rune_web/parser.rs`, `jscodegen.rs`, `css.rs`, `ast.rs`
4. **TypeScript Rune-Web Client Runtime**: `runtime/rune-web/src/` (`expression.ts`, `statement.ts`, `scope.ts`, `rendering.ts`)
5. **TypeScript In-Browser Emulator**: `runtime/rune-emulator/src/` (`parser/section-parser.ts`, `engine/evaluate.ts`, `engine/builtins.ts`)
6. **Vect Script Engine & REPL**: `src/cli/vect.rs`, `src/cli/repl.rs`, `src/execution/ir.rs`
7. **Vectrune Natural-Language Compiler**: `src/vectrune/` (`compiler.rs`, `manifest_engine.rs`, `english.rs`, `french.rs`)

Over successive releases, features were added to specific targets to solve immediate needs:
- **Rune-Web** received state generators (`* N inc`, `grid`), `local` templates, `all {}` modifiers, compound assignment (`+=`, `-=`), ternary (`? :`), nullish (`??`), unary negation (`-x`), spatial primitives (`collide`, `clamp`, `random`), declarative emitters, sound effects, and `@Navigator`.
- **Backend `run:`** in Rust supports full HTTP routing, data sources (MySQL/Postgres), schema validation, and memory hooks, but lacks ternary, nullish, collection filter/find methods, and compound operators in its step processor.
- **`.vect` Scripts** have while loops and stdio piping (`stdio ->`, `<- stdio`), but lack general collection methods, generators, and multi-file imports.
- **The REPL** is a stub waiting for clean line-based parsing and runtime evaluation.
- **The TS Emulator** maintains a separate parser and evaluator that duplicates subsets of both the Rust core and Rune-Web.

**The Goal**: Establish a single canonical grammar and AST specification, eliminate duplicated ad-hoc parsers, replace unsafe pointer patterns and runtime string splitting with fast typed AST evaluation, and position the codebase for **Rune AOT Compiler**, **Rune Mobile**, and **Unified Vectrune Scripting**.

---

## 1. Feature Parity Matrix (Current State)

| Feature | Core Doc Parser (Rust) | Backend `run:` (Rust) | Rune-Web Compiler (Rust) | Rune-Web Runtime (TS) | In-Browser Emulator (TS) | Vect Scripts (Rust) | Vectrune NL (Rust) | Target State (Universal) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Sections & Path (`@App/v1`)** | ✅ | ✅ | ✅ | N/A | ✅ | ❌ | ⚠️ (`language:`) | ✅ |
| **Key-Values (`key = val`)** | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ (`set k = v`) | ❌ | ✅ |
| **Series / Indented Lists** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Records (`+ name: val`)** | ✅ | ⚠️ (via memory) | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Multi-file Imports (`import`)** | ✅ | ✅ | ✅ | N/A | ❌ | ❌ | ❌ | ✅ |
| **String Interpolation (`{var}`)** | ❌ (stores raw) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Arithmetic (`+ - * / %`)** | ❌ | ⚠️ (limited) | ❌ | ✅ | ⚠️ (limited) | ⚠️ (via eval) | ❌ | ✅ Full |
| **Comparison (`== != < <= > >=`)** | ❌ | ✅ (`contains`) | ❌ | ✅ | ✅ | ✅ (`contains`) | ❌ | ✅ Full |
| **Logical (`and`, `or`, `not` / `!`)** | ❌ | ⚠️ (if only) | ❌ | ✅ | ⚠️ (if only) | ⚠️ (if only) | ❌ | ✅ Full |
| **Ternary (`cond ? a : b`)** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Nullish Coalescing (`a ?? b`)** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Unary Negation (`-x`)** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Compound Assign (`+= -= *= /=`)** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Control Flow (`if / else`)** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ (`else if`) | ❌ | ✅ Full |
| **Loops (`for .. in ..`)** | ❌ | ⚠️ (limited) | ✅ | ✅ | ⚠️ (basic) | ❌ | ❌ | ✅ |
| **While Loop (`while cond:`)** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Pattern Match (`match ..:`)** | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Early Exit (`stop`, `stop when`)** | ❌ | ✅ (`stop`) | ❌ | ✅ (`stop when`) | ✅ (`stop`) | ✅ (`stop`) | ❌ | ✅ Full |
| **Collection Methods (`filter/find/any`)** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Array Mutators (`push`, `delete`)** | ❌ | ✅ (`append`, `del`) | ❌ | ✅ (`.push`, `delete`)| ✅ (`append`) | ⚠️ (`delete`) | ❌ | ✅ Full |
| **Entity State Restore (`restore`)** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Spatial / Game (`collide`, `clamp`)** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **State Generators (`* N inc`, `grid`)** | ❌ | ❌ | ✅ | N/A | ❌ | ❌ | ❌ | ✅ |
| **Local Templates & `all` Modifiers** | ❌ | ❌ | ✅ | N/A | ❌ | ❌ | ❌ | ✅ |
| **Type Coercion (`to-number`, etc.)** | ❌ | ✅ | ❌ | ✅ | ✅ | ⚠️ (builtins) | ❌ | ✅ |
| **Emitters & Particles** | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Web Audio Synth (`sound`)** | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Timer / Game Loop (`timer = tick`)** | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Declarative Keybindings (`keys:`)** | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Stdio Piping (`stdio ->`, `<- stdio`)** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ (lowered) | ✅ |
| **Reusable Actions (`action name(args)`)** | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Database Connectors (`mysql/postgres`)**| ❌ | ✅ | ❌ | ❌ | ❌ | ⚠️ (shared ctx) | ❌ | ✅ |

---

## 2. Architectural Audit & Code-Quality Findings

### Finding A: Unsafe Pointer Traversal in `src/rune_parser.rs`
- **Location**: `src/rune_parser.rs` lines 373–420, 448–458, and 517–527.
- **Problem**: In order to satisfy the Rust borrow checker during nested series and map block parsing, raw pointers (`*mut Vec<Value>`) and unsafe dereferences are duplicated in three separate places:
  ```rust
  let mut current_list: *mut Vec<Value> = list as *mut _;
  for nested_key in path.iter().skip(1) {
      unsafe {
          if let Some(Value::Map(m)) = (*current_list).last_mut() { ... }
      }
  }
  ```
- **Remedy**: Replace with a safe, idiomatic AST builder pattern (e.g. tree zipper or index-based arena node traversal).

### Finding B: Runtime String Splitting & Repeated Regex Re-parsing
- **Location**: `runtime/rune-web/src/expression.ts` (`evaluateExpression`) & `src/core/mod.rs` (`handle_assignment`, `eval_condition`).
- **Problem**: Expressions are parsed from raw strings on **every single evaluation**. During 60fps animations or 25fps game loop ticks (`timer = tick 35ms`), `evaluateExpression` is executed thousands of times per second, invoking `splitTopLevel`, regex matching, and string slicing on every frame.
- **Remedy**: Compile expressions once at load/compile time into an **Expression AST** or lightweight bytecode (both in Rust and TS). Runtime evaluation should be a simple recursive AST walk on pre-parsed enums/nodes.

### Finding C: Fragile Line-Based String Matching
- **Location**: `src/apps/rune_web/parser.rs` lines 850–950, `src/cli/vect.rs`, and `runtime/rune-emulator/src/parser/section-parser.ts`.
- **Problem**: Hand-written string prefix checks (`starts_with("if ")`, `find('=')`, `strip_prefix("import ")`) and regular expressions are scattered across four different parser implementations. Subtle syntax variations (e.g. trailing comments, whitespace around `=`, multiline blocks) parse differently across engines.
- **Remedy**: Consolidate around a shared formal lexer and grammar specification with unambiguous tokens.

### Finding D: Divergent Expressions & Operator Precedence
- **Location**: `runtime/rune-web/src/expression.ts` vs `src/arithmetic.rs` vs `src/core/mod.rs`.
- **Problem**: 
  - `expression.ts` checks operators in fixed order: `? :` -> `??` -> `or` -> `and` -> `!=` -> `==` -> `>=` -> `<=` -> `>` -> `<` -> `+` -> `-` -> `*` -> `/` -> `%`.
  - `src/arithmetic.rs` only handles basic arithmetic for integers/floats without boolean logic, ternary, or nullish coalescing.
  - `src/core/mod.rs` only handles binary comparisons for `if` conditions and `contains`.
- **Remedy**: Define a single canonical operator precedence table and Pratt parser / recursive-descent parser architecture implemented consistently across Rust and TypeScript.

---

## 3. Phased Implementation Roadmap

### Phase 1: Shared Specification & Cross-Engine Parity Test Suite ("The Oracle")
> *Target: High Confidence & Baseline Alignment*

- [ ] **1.1 Formal Language Grammar Specification (`docs/SPECIFICATION.md`)**:
  - Define canonical lexical tokens: comments (`#`), identifiers, strings (escapes, multiline), numbers, booleans, symbols (`@`, `+`, `=`, `:`, `->`, `<-`, `<->`).
  - Define formal expression grammar with strict operator precedence (Primary, Postfix, Unary, Multiplicative, Additive, Relational, Equality, Logical AND, Logical OR, Nullish Coalescing, Ternary).
  - Define statement grammar: declarations, assignments, compound assignments, control flow (`if/else`, `while`, `for`, `match`), builtins, and block series.
- [ ] **1.2 Cross-Platform Conformance Test Suite (`tests/conformance/`)**:
  - JSON-driven conformance test fixtures: input code snippet -> expected AST -> expected evaluated result.
  - Run identical test suites in Rust (`cargo test`) and TypeScript (`npm test` in both `rune-web` and `rune-emulator`).

---

### Phase 2: Modernize Rust Core Parser & Expression Engine (`src/core/`)
> *Target: Clean, Safe, Fast Rust Core*

- [x] **2.1 Safe AST Builder in `src/rune_parser.rs`**: *(Completed in v0.2.16 - Commit `007aae3`)*
  - Eliminated all raw pointer `unsafe { *mut Vec<Value> }` blocks in `src/rune_parser.rs`.
  - Implemented safe, recursive path resolver `resolve_series_path_mut` for arbitrary series and map nesting.
- [ ] **2.2 Unified Expression Parser in Rust (`src/core/expr.rs`)**:
  - Implement a fast Pratt parser producing an `Expr` enum (`Literal`, `Ident`, `Unary`, `Binary`, `Call`, `Member`, `Ternary`, `Coalesce`).
  - Pre-parse expressions in `run:` steps at document load time.
- [ ] **2.3 Language Parity in Backend `run:` Steps**:
  - Support ternary (`? :`), nullish (`??`), unary minus (`-x`), and compound assignments (`+=`, `-=`, `*=`, `/=`) in backend route logic.
  - Support collection methods (`.filter()`, `.find()`, `.any()`, `.max()`, `.length`) in backend execution.
  - Add pattern matching (`match`) to backend step execution.

---

### Phase 3: High-Performance TypeScript Runtime (`runtime/rune-web` & `rune-emulator`)
> *Target: Eliminate Frame-Rate Jitter & Unify Web Implementations*

- [ ] **3.1 AST-Compiled Web Expressions**:
  - In `src/apps/rune_web/jscodegen.rs`, compile inline expressions into lightweight AST nodes or direct JS expressions rather than emitting raw string expressions evaluated via regex at runtime.
  - Benchmark 60fps particle and game animation loops to verify zero string-tokenization overhead per frame.
- [ ] **3.2 Emulator Core Replacement**:
  - Unify `runtime/rune-emulator/src/parser/` and `runtime/rune-web/src/` to share the same parsed AST representations.
  - Ensure any feature added to Rune-Web (generators, audio, emitters) is automatically recognized by the emulator.

---

### Phase 4: REPL Modernization & `.vect` Script Alignment
> *Target: Unified Developer CLI*

- [ ] **4.1 Interactive Line-Based REPL (`vectrune repl`)**:
  - Upgrade `src/cli/repl.rs` to use the unified Pratt expression parser and runtime context.
  - Provide immediate expression evaluation:
    ```rune
    vectrune> 20 * 4 + 10
    90
    vectrune> [1, 2, 3, 4].filter(it > 2)
    [3, 4]
    ```
- [ ] **4.2 Elevate `.vect` Scripts to Full Language Parity**:
  - Allow `.vect` scripts to use full Rune expression syntax, collections, and state generators while preserving concise stdio syntax (`stdio ->`, `<- stdio`).

---

### Phase 5: Ahead-Of-Time (AOT) Compiler Architecture (`rune compiler`)
> *Target: Standalone Executable Compilation & WebAssembly*

- [ ] **5.1 Bytecode / IR Definition (`src/compiler/ir.rs`)**:
  - Design a compact virtual machine bytecode or intermediate representation (IR) representing Rune data documents, routes, and reactive views.
- [ ] **5.2 Native Compilation Targets**:
  - Compile `.rune` fullstack apps into standalone native binaries without runtime text-parsing overhead.
  - Direct WASM compilation target for embedding high-speed Rune applications in browsers, edge workers (Cloudflare Workers, Fastly Compute), and serverless runtimes.

---

### Phase 6: Rune Mobile & Native UI Architecture (`rune mobile`)
> *Target: Multi-Platform Declarative Native Applications*

- [ ] **6.1 Headless Core & Platform Presentation Decoupling**:
  - Isolate the reactive state container, game loop, timers, spatial math, and audio into an architecture-agnostic headless core (`@vectrune/core`).
- [ ] **6.2 Rune Mobile Presentation Layer**:
  - Support native mobile presentation adapters (e.g. Flutter / React Native bridge / Android & iOS canvas/web view surface).
  - Enable building mobile games and applications from the same `.rune` logic, style, and state definitions.

---

### Phase 7: Converge Vectrune Natural-Language Intent Compiler
> *Target: First-Class Swappable Natural Language Dialect*

- [ ] **7.1 Lower `.vectrune` into Unified IR**:
  - Migrate `src/vectrune/compiler.rs` and `src/vectrune/manifest_engine.rs` from ad-hoc procedural branches to emit the unified `ExecProgram` / `Expr` AST directly.
  - Allow embedding natural-language intent blocks inside standard `.rune` application sections.
