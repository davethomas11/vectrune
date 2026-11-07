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

## Active Priorities

### Track 1: Teaching Site & Interactive Learning ([vectrune.com](https://vectrune.com))

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

- [ ] **Native In-Language Test Runner (`@Test` & `vectrune test`)**:
  - Introduce `@Test/<name>` sections directly in `.rune` files:
    ```rune
    @Test/UserCreation
    run:
        req = { method: "POST", path: "/users", body: { name: "Alice", role: "admin" } }
        res = test-request req
        assert res.status == 201
        assert res.body.id == 42
    ```
  - Implement CLI command `vectrune test` to auto-discover, execute, and report test assertions with exit codes for CI.
- [ ] **Canonical Formatter & Linter (`vectrune fmt` & `vectrune check`)**:
  - `vectrune fmt`: Formats indentation, key-value spacing, and section headers to standard style.
  - `vectrune check`: Statically validates schemas, routes, props, and missing imports without launching the server.
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

