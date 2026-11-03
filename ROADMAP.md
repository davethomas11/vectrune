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
5. **Status Update**: Mark the task as `[x]` with the commit hash and date, then log a concise summary.

**Task Status Legend**:
- `[ ]` Open (Ready to be picked up)
- `[-]` In Progress
- `[x]` Completed

---

## Active Priorities

### Track 1: Teaching Site & Interactive Learning ([vectrune.com](https://vectrune.com))

- [x] **Fix Builtin Demo Sandbox Corrupted Syntax**: Resolved Rune-Web template interpolation stripping curly braces and quotes from `{raw ...}` imports; fixed emulator multi-line objects, comment tokenization, and schema validation. *(Commit: `b8875d9` - 2026-11-01)*
- [ ] **Fix Subpage Code Snippet Loading**: Update `rest_api_get.rune`, `rest_api_post.rune`, `rest_api_validation.rune`, `graphql_overview.rune`, `websocket_overview.rune`, and `rune_web_overview.rune` to inject untampered code snippets into `#sandbox-editor` via JS instead of `code="{raw ...}"` to prevent brace stripping.
- [ ] **Enrich REST Tutorial Pages**:
  - Add request payload walkthrough cards for `POST /products` and `POST /users`.
  - Add interactive schema validation breakdown on the Validation page.
- [ ] **GraphQL Interactive Overview Page**:
  - Build explanation cards for `@Schema` vs GraphQL types and query resolvers.
  - Implement mock GraphQL query execution in the in-browser sandbox (e.g. `{ skaters { name, age } }`).
- [ ] **WebSocket Interactive Overview Page**:
  - Build real-time channel demonstration with mock incoming/outgoing message feed in the sandbox output.
  - Add interactive snippets for `ws.send`, `ws.broadcast`, and `ws.id`.
- [ ] **Rune-Web UI Framework Guide**:
  - Document reactive state binding (`<->`), `@Component`, and event handlers.
  - Provide an interactive counter or todo-list demo inside the sandbox.
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

- [ ] **Clean Up Compiler Warnings**:
  - Fix unused assignments for `resolved_path` in `src/apps/rune_web/parser.rs`.
  - Fix unused `state_json` in `src/apps/rune_web/jscodegen.rs`.
  - Remove unused imports in `src/cli/mod.rs` and `src/memory/mod.rs`.
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
