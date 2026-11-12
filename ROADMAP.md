# Vectrune Project Roadmap & Autonomous Work Queue

This roadmap serves as the persistent, prioritized task backlog for Vectrune. It is organized into bite-sized, independently testable tasks designed for both scheduled autonomous agent runs and collaborative contributor workflows.

---

## Autonomous Execution Guidelines

When picking up work autonomously (via `/schedule`, `/goal`, or recurring cron):
1. **Selection**: Find the highest-priority open task (`[ ]`) under **Active Priorities**.
2. **Implementation**: Modify the relevant files and maintain repo guidelines.
3. **Verification**:
   - Run `cargo check --offline` to verify compilation.
   - Run `cargo run -q -- teaching_website/teaching.rune -o html | Out-Null` if web/docs files are modified.
   - Verify frontend changes using the browser subagent if relevant.
4. **Commit & Deploy**:
   - Commit with a clear conventional commit message (e.g. `feat(...)` or `fix(...)`).
   - Push to `main` (which automatically triggers the GitHub Pages deploy workflow).
5. **Binary Releases**:
   - Whenever changes modify the core binary or runtime (`src/`, `Cargo.toml`):
     - Bump the version in `Cargo.toml` (e.g. `0.2.6`).
     - Create an annotated git tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z: <summary>"`.
     - Push the tag: `git push origin vX.Y.Z`.
     - This triggers `.github/workflows/release.yml`, building binaries across 7 OS/architecture targets and publishing a new GitHub Release.
6. **Status Update**: Mark the task as `[x]` with the commit hash and date, then log a concise summary.

**Task Status Legend**:
- `[ ]` Open (Ready to be picked up)
- `[-]` In Progress
- `[x]` Completed

---

## Strategic Architecture: Language Parity & Multi-Target Convergence

A dedicated, comprehensive architectural blueprint and multi-phase roadmap has been established in [LANGUAGE_PARITY_ROADMAP.md](LANGUAGE_PARITY_ROADMAP.md).

### Vision & High-Level Summary
As Vectrune has rapidly evolved, various language processors and dialects developed target-specific features:
- **Rune-Web client runtime & compiler**: Gained state generators (`* N inc`, `grid`), `local` templates, `all` modifiers, compound assignments (`+=`, `-=`), ternary (`? :`), nullish (`??`), unary negation (`-x`), spatial primitives, and audio/emitter support.
- **Backend `run:` engine (Rust)**: Powers HTTP, data sources, and memory hooks, but lacks recent expression innovations (ternary, nullish, collection filter/find methods) in its step evaluator.
- **`.vect` Scripts**: Features interactive I/O (`stdio ->`, `<- stdio`) and while loops, but operates on an isolated IR without multi-file imports or collections.
- **Vectrune Natural Language Engine**: Compiles English/French intent models to execution IR via ad-hoc rules.
- **In-Browser Emulator**: Re-implements document parsing and step execution in TypeScript with subtle dialect divergences.
- **REPL**: Awaiting a unified line-by-line expression parser and executor.

### Parity & Architecture Roadmap Highlights ([Full Details](LANGUAGE_PARITY_ROADMAP.md))
1. **Phase 1: Shared Specification & Cross-Engine Conformance Suite ("The Oracle")**: Formal token/precedence grammar (`docs/SPECIFICATION.md`) and cross-engine JSON conformance fixtures.
2. **Phase 2: Modernize Rust Core Parser & Pratt Expression Engine**: Eliminate unsafe raw pointer traversals in `src/rune_parser.rs`; introduce pre-compiled typed AST expressions in backend `run:` steps (bringing ternary, nullish, compound operators, and collection methods to the backend).
3. **Phase 3: High-Performance TypeScript AST Runtime**: Pre-compile expressions in `runtime/rune-web` to eliminate per-frame regex string re-parsing during 60fps animations; unify emulator core.
4. **Phase 4: REPL Modernization & `.vect` Script Alignment**: Connect `vectrune repl` and `.vect` scripts directly to the unified expression and collection engine.
5. **Phase 5: Ahead-Of-Time (AOT) Compiler Architecture (`rune compiler`)**: Define bytecode/IR for compiling `.rune` into standalone native executables and WASM.
6. **Phase 6: Rune Mobile & Native UI Architecture (`rune mobile`)**: Decouple reactive engine into a headless core (`@vectrune/core`) and build mobile presentation adapters (canvas/native UI bridge).
7. **Phase 7: Converge Vectrune Natural-Language Intent Compiler**: Modernize the natural language compiler to emit the unified Rune AST / IR directly.

---

## Active Priorities

### Track 1: Teaching Site & Interactive Learning ([vectrune.com](https://vectrune.com))

- [x] **P0 Restore French and Spanish Entry Routes** ([UX01](docs/UX_REVIEW.md#ux01-repair-language-entry-routes)): Fixed locale-root parsing and destination-preserving language changes. Reproduced the old-router failure with Homebrew 0.2.18; compiler 0.2.20 and the guarded workspace preview prevent mixed-version builds. Verified repeated English/Spanish/French switching, refresh and recovery from `/es/es`, `/es/fr`, `/fr/fr` and `/fr/es` on vectrune.com. *(Commit: `749ba4a` - 2026-11-12)*
- [x] **P1 Make Shared Lesson and Locale URLs Reliable** ([UX05](docs/UX_REVIEW.md#ux05-make-shared-urls-dependable)): The shared builder renders all 25 named routes in three languages, aligns SSR/browser state, exports the home chunk and localizes lesson metadata. The native server serves localized deep links and route chunks too. All 75 public route/locale combinations and deployed refresh checks pass. *(Commit: `749ba4a` - 2026-11-12)*
- [-] **P1 Complete the Teaching Site First Success Path** ([UX02](docs/UX_REVIEW.md#ux02-make-the-quickstart-self-contained)): Provide every prerequisite, example file, working-directory step and expected response for release/Homebrew users; separate browser and local setup, and add command copy controls. Validate from an empty working folder. **Progress (2026-11-12):** Added complete install prerequisites, browser/local choices, downloadable app.rune, exact source, copy controls and terminal/port guidance in three languages. The downloaded starter returns OK from an otherwise empty folder, and the deployed download/copy controls pass. Manual fresh Windows/Homebrew installation walkthroughs remain.
- [-] **P1 Repair Navigation Orientation and Keyboard Access** ([UX03](docs/UX_REVIEW.md#ux03-restore-orientation-after-navigation), [UX06](docs/UX_REVIEW.md#ux06-make-navigation-accessible-and-easier-to-read)): Set route scroll/focus intentionally while preserving anchor and history behavior; use destination links, current-page semantics, a skip link, persistent search labels and readable navigation contrast. **Progress (2026-11-12):** Implemented route links, current-page semantics, skip navigation, page headings, labeled reference search, darker group labels, anchor/focus handling and saved history positions. Local and deployed Chromium keyboard/history checks pass; manual screen-reader and full iframe-control audits remain.
- [x] **P1 Simplify the Mobile Shell** ([UX04](docs/UX_REVIEW.md#ux04-give-mobile-content-the-first-screen)): Added a compact notice/header, language disclosure, bounded navigation with Close/Escape and normal-flow attribution. The complete primary action is visible and unobstructed at 390 × 844 in all three languages; local and deployed width/focus checks pass. *(Commit: `749ba4a` - 2026-11-12)*
- [x] **P2 Put Live Demos First** ([UX07](docs/UX_REVIEW.md#ux07-demonstrate-value-sooner)): Compact game/Studio introductions lead directly to the preview and one suggested action; optional implementation notes follow. Verified the three live showcases in all locales on desktop and mobile. *(Commit: `749ba4a` - 2026-11-12)*
- [-] **P2 Clarify Sandbox Apply and Reset** ([UX08](docs/UX_REVIEW.md#ux08-explain-what-run-actually-does)): Added localized Apply code → Send Request guidance, advanced document/AST controls and Reset example. Reset preserves the initial sample, clears request state and cancels an in-flight Apply. Request/edit/reset/race and advanced-control checks pass locally and on vectrune.com in three languages. Precise syntax-error location/recovery review remains.
- [x] **P2 Align Studio Instructions and Exports** ([UX11](docs/UX_REVIEW.md#ux11-keep-instructions-aligned-with-the-interface)): Instructions now match PLAY/STOP, SAVE/LOAD and EXPORT .RUNE, distinguish song export from application source, and explain iframe session storage. Fixed storage getter exceptions so fallback works. Save/Load/export pass locally and on vectrune.com. *(Commit: `749ba4a` - 2026-11-12)*
- [ ] **P2 Add Clear Learning Paths** ([UX10](docs/UX_REVIEW.md#ux10-give-learners-a-clear-path)): Organize navigation around Start, Learn, Reference and Explore, add prerequisites and previous/next lesson links, and distinguish the example catalogue from the editable playground.
- [ ] **P2 Add Project Navigation to the Source Explorer** ([UX09](docs/UX_REVIEW.md#ux09-make-the-explorer-work-at-project-scale)): Build on recursive source bundles with folder grouping, stable file selection, desktop/mobile browsing patterns, source permalinks and a runnable project archive that preserves imported paths.
- [ ] **P3 Add Cross Site Search** ([UX12](docs/UX_REVIEW.md#ux12-extend-search-after-navigation-is-reliable)): Improve reference result labels/state first, then validate search across lessons, concepts and examples using stable destinations and recoverable queries.
- [x] **Review Live Site UX and Recommend Styles**: Reviewed desktop/mobile layouts, routing, language switching, keyboard entry, sandbox feedback, reference filtering and source browsing. Recorded 12 prioritized findings with acceptance criteria, screenshots and measurements in [UX_REVIEW.md](docs/UX_REVIEW.md), with concrete color, typography, spacing, layout and component guidance in [STYLE_RECOMMENDATIONS.md](docs/STYLE_RECOMMENDATIONS.md). Recommendations remain open above. *(2026-11-12)*
- [x] **Repair and Complete the Source Explorer**: Preserve source newlines, indentation, quotes and escapes through client component props. Replace fixed file lists with one `files="{sources entry.rune}"` prop that follows recursive imports, including all 15 Rune Studio files. Add localized filename filtering, file counts, copy/download controls, keyboard focus and one expanded file at a time. Verified compiler/runtime tests and Chromium regressions across three locales, Example Lab, lessons and mobile widths. *(2026-11-12)*
- [x] **Fix Builtin Demo Sandbox Corrupted Syntax**: Resolved Rune-Web template interpolation stripping curly braces and quotes from `{raw ...}` imports; fixed emulator multi-line objects, comment tokenization, and schema validation. *(Commit: `b8875d9` - 2026-11-01)*
- [x] **Fix Subpage Code Snippet Loading**: Updated `rest_api_get.rune`, `rest_api_post.rune`, `rest_api_validation.rune`, `graphql_overview.rune`, `websocket_overview.rune`, and `rune_web_overview.rune` to inject canonical, untampered code snippets into `#sandbox-editor` via JS page detection; added reactive mock runners for REST, GraphQL, WebSocket, and Rune-Web components. *(Commit: `ca2df80` - 2026-11-02)*
- [ ] **Enrich REST Tutorial Pages**:
  - Add request payload walkthrough cards for `POST /products` and `POST /users`.
  - Add interactive schema validation breakdown on the Validation page.
- [ ] **GraphQL Interactive Overview Page**:
  - Build explanation cards for `@Schema` vs GraphQL types and query resolvers.
  - Implement mock GraphQL query execution in the in-browser sandbox (e.g. `{ skaters { name, age } }`).
- [ ] **WebSocket Interactive Overview Page**:
  - Build real-time channel demonstration with mock incoming/outgoing message feed in the sandbox output.
  - Add interactive snippets for `ws.send`, `ws.broadcast`, and `ws.id`.
- [x] **Rune-Web UI Framework Guide**:
  - Added five localized guide pages below the REST API tutorials: components/props, state/forms, actions/lists, selection/view switching, and styles/layout.
  - Added real Rune-Web previews with a workshop RSVP, packing checklist, trip planner and responsive cards, plus complete source and imported styles. Preserved the existing application overview and counter.
  - Added `tests/browser/rune_web_guide.py` covering all locales, live interactions, source fidelity, mobile layouts and existing-page regressions. See `knowledge/language/rune-web-guide.md`. *(2026-11-04)*
- [ ] **Builtin Reference Expansion**:
  - Add runnable sandbox snippets and test cases for remaining builtins: `csv.read`, `csv.write`, `csv.append`, `json.read`, `json.write`, `memory.clear`, `memory.del`, and `delete`.

---

### Track 2: In-Browser Emulator Engine (`rune-emulator.js`)

- [x] **Schema Validation Engine**: Added numeric/string type checking and required field assertions for `#SchemaName`. *(Commit: `05b74ee` - 2026-11-01)*
- [x] **Object & Array Literal Scope Evaluation**: Added `evaluateObjectLiteral` and `evaluateArrayLiteral` supporting unquoted keys and scoped variables. *(Commit: `05b74ee` - 2026-11-01)*
- [x] **Dynamic Import Cache Busting**: Added timestamp query params in `sandbox.js` to ensure browsers always load updated emulator logic. *(Commit: `2c37d01` - 2026-11-01)*
- [ ] **Automated Headless Test Suite**:
  - Create a lightweight test harness (e.g. `tests/emulator/test_emulator.js` or Rust-based runner) to verify emulator parsing and execution without requiring manual browser clicks.
  - Add regression tests for indented comments, array balance, and unescaped strings.
- [ ] **Mock GraphQL Resolver Support**:
  - Enable `emulatorApp.request({ method: 'POST', path: '/graphql', body: { query: '...' } })` to resolve basic queries.

---

### Track 3: Core Compiler & Runtime Engine (Rust)

- [x] **Clean Up Compiler Warnings**:
  - Eliminated unused assignment warnings in `src/apps/rune_web/parser.rs`.
  - Removed unused `state_json` in `src/apps/rune_web/jscodegen.rs`.
  - Cleaned up unused imports and dead code annotations in `src/cli/mod.rs`, `src/memory/mod.rs`, and `src/memory/reactive.rs`.
  - Verified `cargo check --offline` passes with zero warnings. *(Commit: `ca2df80` - 2026-11-02)*
- [ ] **Compiler Syntax Diagnostics**:
  - Improve error reporting when a `.rune` file has unclosed strings, unbalanced braces, or missing section headers.
- [ ] **Knowledge Export Refresh**:
  - Verify and update `vectrune knowledge export` to sync markdown documentation with the active runtime behavior.

---

### Track 4: Developer Onboarding & Ecosystem

- [ ] **README 5-Minute Success Path**:
  - Streamline the opening flow of [README.md](README.md) around a single copy-pasteable first success path.
  - Add badges for the live teaching site, GitHub Actions CI status, and releases.
- [ ] **Curated Starter Examples Polish**:
  - Verify each example under `examples/` (`app.rune`, `memory_api.rune`, `user_api.rune`, `book_graphql.rune`) runs cleanly with the CLI.
  - Add a concise header comment in each example explaining what concept it demonstrates.
- [ ] **Editor Tooling Documentation**:
  - Document installation and configuration for the VS Code extension (`rune-vscode/`) and IntelliJ plugin (`intellij_plugin/`).

---

### Track 5: Language Expressiveness & Ergonomics

- [ ] **First-Class Reusable Actions (`@Action`)**:
  - Introduce `@Action/<name>` blocks with declared `params: [...]` and executable `run:` step sequences.
  - Allow route handlers and components to invoke actions (e.g. `result = run calcDiscount(cart, coupon)`) to eliminate duplicated logic.
- [ ] **Precondition Guard Syntax (`guard`)**:
  - Add `guard <condition> else <action>` statement to `run:` blocks (e.g. `guard user != null else respond 401 "Unauthorized"`).
  - Eliminates deeply nested `if` statements for early-exit validation and authentication checks.
- [ ] **Pattern Matching in Route Logic (`match`)**:
  - Extend pattern matching (already implemented in Rune-Web views) into backend `run:` steps:
    ```rune
    match status:
        "active"  -> respond 200 "Account in good standing"
        "pending" -> respond 202 "Verification required"
        "banned"  -> respond 403 "Access denied"
        _         -> respond 400 "Invalid status"
    ```
- [x] **Rune-Web State Generators & Logic Compressions**:
  - Implemented 1D object replication syntax: `{ template } * N inc (props) by STEP with { ... }`.
  - Implemented 2D grid generation syntax: `grid COLS x ROWS at (X, Y) step (DX, DY) with { ... }`.
  - Nested generator expansion inside array declarations (`[ { ... } * N ..., ... ]`).
  - Added compound assignment operators to Rune-Web actions: `+=`, `-=`, `*=`, `/=`.
  - Added unary negation operator: `-var`, `-1`.
  - Added entity collection restore shorthand: `restore aliens` or `aliens.restore()` resetting entities to initial state or restoring `start_*` coordinates.
  - Compressed Space Invaders fleet state (`enemies.rune`) and game actions (`logic.rune`). *(Release: `v0.2.10` - 2026-11-06)*
- [x] **Rune-Web CSS Enhancements: Multi-Presets, Shorthands, Nesting & Token Opacity**:
  - Implemented multi-preset composition: `use = (preset-a, preset-b)`
  - Added smart layout shorthands: `center = xy/x/y/true`, `abs = inset/0 0`, `fixed = inset/0 0`, `size = W H`, `aspect = W / H`, `round`/`radius`
  - Added glow shorthands: `glow = {token} 15px`, `text-glow = {token} 10px 20px`, `glow = inset {token} 20px`
  - Added token color opacity & alpha functions: `{token / 25%}` and `alpha({token}, 0.25)` compiling to standard `color-mix(in srgb, var(--token) 25%, transparent)`
  - Added indented pseudo-class and state nesting: `:hover:`, `:active:`, `&:hover:`, `&.modifier:`
  - Tuned up `examples/space_invaders/parts/style.rune` and `teaching_website/parts/style.rune` eliminating repetitive rules and hardcoded colors. *(Release: `v0.2.9` - 2026-11-06)*
- [x] **Type Coercion Builtins**:
  - Added explicit casting builtins: `to-number(val)`, `to-bool(val)`, and `to-string(val)` across Rust runtime and browser emulator.
  - Enabled direct coercion of path parameters, query strings, and booleans in expression pipelines. *(Release: `v0.2.6` - 2026-11-02)*

---

### Track 6: Standard Library Builtins

- [ ] **Native Outbound HTTP Client (`http.get` / `http.post`)**:
  - Add builtins for outbound HTTP requests: `res = http.get <url>` and `res = http.post <url> <body> [headers]`.
  - Enables microservice communication, external webhooks (Stripe, GitHub), and LLM/AI model API calls directly from `.rune` routes.
- [ ] **Embedded SQLite Data Source (`sqlite`)**:
  - Add embedded SQLite query support (`sqlite.query <sql>`, `sqlite.exec <sql>`) alongside existing MySQL and Postgres connectors.
  - Enables instant, file-backed local persistence without running external database containers.
- [ ] **Crypto & Hashing Builtins**:
  - [x] Added `uuid.v4` / `uuid` generating cryptographically random RFC 4122 v4 UUIDs across Rust runtime and emulator. *(Release: `v0.2.6` - 2026-11-02)*
  - [ ] Add `hash.sha256 <data>` and password hashing helpers (`bcrypt.hash <pwd>`, `bcrypt.verify <pwd> <hash>`).
- [x] **DateTime & Timestamp Utilities (`now`)**:
  - Added `now` builtin supporting ISO-8601 UTC strings, Unix seconds (`now "unix"`), and millisecond epochs (`now "millis"`). *(Release: `v0.2.6` - 2026-11-02)*
  - [ ] Add `date.format <ts> <fmt>` and `date.add <ts> <duration>` for custom formatting.

---

### Track 7: Developer Tooling & Testing ("Complete Tool" Layer)

- [x] **0.3.1 Developer Workflow Release**: Source-aware failures and command suggestions; startup/teardown failure gates; versioned JSON/JSON Lines; fixture hooks, watch recovery, safe formatting; production exclusion of `.test.rune` imports/source lists/Lambda bundles; five-test CRUD starter with reproducible download; six developer pages in English, Spanish, and French. Local verification: 89 targeted Rust tests, five Rune starter tests, all 18 developer route/locale pages, and the existing 93-route teaching-site UX suite pass. macOS Intel/Linux/Windows [release-gate CI](https://github.com/davethomas11/vectrune/actions/runs/43308420846) passed; all seven [v0.3.1 binaries](https://github.com/davethomas11/vectrune/releases/tag/v0.3.1) are published and the Homebrew formula is updated. The downloaded native release passes doctor/fmt/check, all five starter tests, and production export without test modules. The [developer section](https://vectrune.com/developer) is deployed; live checks pass for all 18 localized developer pages, metadata, lazy navigation, repeated language switching, command copying, mobile layout, and the actual downloaded starter. *(Release commit: `bf80167` - 2026-11-12)*

- [x] **Native In-Language Test Runner (`@Test` & `vectrune test`)**:
  - Introduce `@Test/<name>` sections directly in `.rune` files:
    ```rune
    @Test/UserCreation
    run:
        req = { method: "POST", path: "/users", body: { name: "Alice", role: "admin" } }
        res = test-request req
        assert res.status == 201
        assert res.body.id == 42
    ```
  - Implemented recursive project discovery/import deduplication, native in-process HTTP requests, strict assertions, per-test memory reset/startup, filters, listing, timeouts, and JSON reports with CI exit codes. Runnable suite: `examples/testing`; usage: README. *(Release: `v0.2.21` - 2026-11-12)*
- [x] **Installation & Project Diagnostics (`vectrune doctor`)**: Reports version/executable/platform, PATH shadowing, resolved imports, static project diagnostics, and configured local port availability. Supports JSON without starting the application. *(Release: `v0.2.21` - 2026-11-12)*
- [x] **Rune Studio Web Test Example**: Added `examples/rune_studio/studio.test.rune` with seven native HTTP/SSR tests (28 assertions), and a browser companion for presets, editing, storage across reloads, Play/Stop, and export. Native Studio checks run in the developer CLI matrix; no browser execution is implied by `test-request`. *(2026-11-12)*
- [-] **Release 0.3.2**: Integrated QuickJS into normal builds and default `vectrune test` discovery. Preparing all seven release targets with native artifact smoke tests, then publishing the patch release. *(2026-11-12)*
- [x] **Prototype Embedded Rune-Web Logic Tests**: Integrated QuickJS into the normal `vectrune test` build and default discovery, with `--type native|logic|all`, sharing the production JavaScript action interpreter with mocked storage, downloads, clipboard and audio. Studio has five logic tests (25 assertions), fresh runtimes, per-test hooks and interruptible execution. See README for commands and prototype limits. No feature flag or Node runtime is needed; platform build verification is included in developer CLI CI. *(2026-11-12)*
- [ ] **Browser-Backed Rune Tests**: Add a browser adapter for Rune-authored DOM interactions and assertions; the current native runner covers HTTP/SSR and browser checks use Playwright separately.
- [-] **Rune Test Library Follow-ups**: Watch mode with import/fixture recovery and `@TestSuite` / `@TestFixture` setup/teardown implemented for `v0.3.1`; richer assertion helpers and isolated external-resource adapters remain open.
- [-] **Canonical Formatter & Linter (`vectrune fmt` & `vectrune check`)**:
  - [x] `vectrune fmt`: Conservative, import-aware formatting of section headers, top-level assignment spacing, and executable-block indentation; `--check`, JSON reports, and parsed-meaning validation before writes. Preserves view/style/raw content. *(Release: `v0.3.1` - 2026-11-12)*
  - [x] `vectrune check`: Initial read-only linter for imports, application types, native REST methods/route conflicts, schema/auth/data-source references, test declarations, Rune-Web component/prop parsing, and unsupported schema-type warnings. Human/JSON diagnostics and `--deny-warnings`. Full expression/type analysis remains open. *(Release: `v0.2.21` - 2026-11-12)*
- [ ] **Language Server Protocol (`vectrune lsp`)**:
  - Implement a lightweight LSP server in Rust providing real-time diagnostics, hover documentation for builtins, and syntax completion for VS Code, Neovim, and Zed.
- [ ] **Project Scaffolder (`vectrune new`)**:
  - Implement `vectrune new <project-name> --template <rest|graphql|fullstack>` to generate starter files, schemas, tests, and configuration.
- [ ] **Shareable Playgrounds & Multi-File Tabs in Browser Emulator**:
  - Add URL hash encoding or GitHub Gist export to the browser sandbox for sharing runnable snippets.
  - Add multi-file tabs (`app.rune`, `schemas.rune`, `data.csv`) to test multi-file imports (`import "..."`) in-browser.

---

### Track 8: Game Development Abilities & Interactive Applications

- [x] **Rune-Web Game Abilities & Space Invaders**:
  - Implemented real-time game loop ticker (`timer = tick 40ms` in `@Logic` and builtins `start-timer` / `stop-timer`).
  - Implemented zero-boilerplate declarative keybindings (`keys:` in `@Logic` mapping `ArrowLeft`, `ArrowRight`, `Space`, etc.).
  - Added 2D spatial and game math primitives to expression engine: `collide(a, b, w, h)`, `clamp(val, min, max)`, `abs(val)`, `random(min, max)`, `min(a, b)`, `max(a, b)`.
  - Added comprehensive arithmetic (`-`, `*`, `/`, `%`) and numeric comparison (`<`, `<=`, `>=`, `>`) operators to expression engine.
  - Built complete retro arcade Space Invaders example in pure Rune-Web under `examples/space_invaders/`.
  - Added dedicated "Games" section and interactive playable Space Invaders showcase to [vectrune.com](https://vectrune.com). *(Release: `v0.2.8` - 2026-11-04)*
  - Fixed complete-board scaling on mobile and cabinet height on desktop/landscape; added a browser regression for both game previews, all locales, and touch/keyboard controls. *(2026-11-05)*
- [x] **2D Particle System, Sound Effects & VectWorms**:
  - Added declarative particle emitters (`emitter { ... }`, `.burst(...)`, `.step()`) for arcade explosions and debris.
  - Added Web Audio API synthesis primitives (`sound "laser"`, `sound "explosion"`, `sound "hit"`, `sound "step"`, `sound "victory"`, `sound "gameover"`) in Rune-Web.
  - Built complete retro arcade Centipede shooter (**VectWorms**) in pure Rune-Web under `examples/vectworms/` using local state templates, 1D generators, and `all` modifiers, and added it to the teaching site's Games and Example Lab sections. *(Release: `v0.2.11` - 2026-11-06)*

