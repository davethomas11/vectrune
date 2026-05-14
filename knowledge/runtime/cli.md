# Vectrune CLI Runtime

This page summarizes the current CLI surface visible from `src/main.rs` and user-facing docs.

## Primary usage

Common entrypoints include:
- `vectrune <script.rune>`
- `vectrune <script.vect>`
- `vectrune <script.vectrune>`
- `vectrune -` to read a script from STDIN
- `vectrune <script.rune> --calculate <expr>`
- `vectrune <script.rune> --transform <spec>`
- `vectrune <script.rune> --merge-with <spec>`
- `vectrune --ai <prompt>`

## Local development install helpers

The repository includes checked-in install helpers for repeat local development installs:
- `install-dev.sh` — zsh-oriented local install for macOS/Linux-style environments
- `install-dev.ps1` — Windows PowerShell local install

Current `install-dev.ps1` behavior:
- builds the local repository in release mode with Cargo
- copies `target/release/vectrune.exe` into `$HOME\.local\bin`
- adds `$HOME\.local\bin` to the user's Windows `PATH` unless `-NoPathUpdate` is supplied
- creates a `v.cmd` shim in the same directory so `v` works as a short command in PowerShell and `cmd.exe`

Example Windows usage:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-dev.ps1
vectrune --version
v --version
```

## Common flags

Current top-level flags include:
- `-i`, `--input` — input format
- `-o`, `--output` — output format
- `--path` — request path to render when using `-o html` (defaults to `/`)
- `--calculate` — run a calculation expression
- `--transform` — run a transform expression
- `--merge-with` — merge another input/document
- `-l`, `--log-level` — set log level
- `--ai` — send a prompt to local AI integration
- `--model` — select the model for `--ai`
- `--host` — override app host for server runtimes
- `-p`, `--port` — override app port for server runtimes
- `-w`, `--watch` — watch for file changes and automatically restart the server (development mode)

## Rune file loading behavior

For Rune input, the CLI now performs an import-aware pre-parse load step.

Current behavior:
- a script path may point to a single `.rune` file or a directory of `.rune` files
- top-level `import "..."` declarations inside Rune files are resolved before parsing
- imported directories load direct child `.rune` files in sorted filename order
- imports are resolved relative to the importing file
- when sections overlap, imported content is merged first and the importing file is merged after it

## Development mode: hot reloading with `-w` / `--watch`

When running a Vectrune app in server mode (REST, GraphQL, etc.), the `-w` flag enables automatic file monitoring:

**Usage:**
```bash
vectrune app.rune -w -p 3000
vectrune app.rune -w -l debug --host 0.0.0.0
```

**Behavior:**
- A background file watcher monitors the app directory and subdirectories
- Detects changes to `.rune`, `.json`, and `.yaml` files
- When changes are detected, logs "Changes detected. Preparing to restart..."
- User must manually restart the server (Ctrl+C and re-run the command) to apply changes

**Implementation:**
- Cross-platform file system monitoring via `notify` crate (FSEvents on macOS/Linux, ReadDirectoryChangesW on Windows)
- Background thread spawned during server startup
- Non-blocking notifications to allow server to continue handling requests while monitoring

**Common workflow:**
```bash
# Terminal 1: Start app with watch mode
vectrune ./app.rune -w -p 3000

# Terminal 2: Edit files
# Edit app.rune, routes, schemas, etc.

# Back in Terminal 1: See "Changes detected..."
# Press Ctrl+C
# Run the command again to restart with new code
```

## `.vect` prototype script behavior

The CLI now supports a separate prototype script format for interactive execution:

- a single `.vect` file can be run directly with `vectrune <script.vect>`
- `.vect` files do **not** go through the Rune document loader
- `.vect` execution is currently interactive and has direct access to stdin/stdout
- current prototype syntax includes:
  - `stdio -> "text"`
  - `.. "continued text"`
  - `name <- stdio`
  - `stdio -> "Hello {name}"`
  - `if ...:`, `else if ...:`, `else:`
  - `repeat from line N`

Current prototype constraints:
- `.vect` execution currently supports one file at a time
- `.vect` does not support `--input`, `--output`, `--calculate`, `--transform`, or `--merge-with`
- `.vect` is intentionally separate from `.rune` app/runtime loading

## `.vectrune` prototype behavior

The CLI also supports a higher-level prototype natural-language surface:

- a single `.vectrune` file can be run directly with `vectrune <script.vectrune>`
- `.vectrune` files compile through a deterministic language engine into executable statements for the shared runtime
- the current engine is English-only and rule-based
- the current supported intent is a weight-timeline survey that asks for birth year, collects `age=weight` points, and renders an ASCII graph

Current prototype constraints:
- `.vectrune` execution currently supports one file at a time
- `.vectrune` does not support `--input`, `--output`, `--calculate`, `--transform`, or `--merge-with`
- unsupported natural-language requests fail with an explicit compiler error

## Output formats

The current CLI parser advertises these output format values:
- `text`
- `json`
- `rune`
- `xml`
- `yaml`
- `curl`
- `html`

### `-o html` frontend rendering

When a loaded Rune document includes `@Frontend type = rune-web` or `@Frontend type = static`, the CLI can print HTML instead of starting a server:

```bash
vectrune app.rune -o html
vectrune app.rune -o html --path /docs/
vectrune app.rune -o html --path /app
```

Current behavior:
- `--path` defaults to `/`
- for `@Frontend type = rune-web`, the CLI renders the mounted page for the requested frontend path
- for `@Frontend type = static`, the CLI resolves the requested path under the configured static `src` directory and prints the matching `.html` file
- if the requested `--path` does not match the configured frontend mount path, the CLI returns a clear error instead of guessing
- if `-o html` is used without a detected `rune-web` or `static` frontend, the CLI returns an error

## Lambda subcommands

Current lambda tooling includes:
- `vectrune lambda launch`
- `vectrune lambda package`

The package command includes options such as:
- `--rune`
- `--config`
- `--binary`
- `--mode` (`zip` or `container`)
- `--output`
- `--image-name`

## SAM subcommands

Current SAM tooling includes:
- `vectrune sam generate`
- `vectrune sam local`

## Knowledge subcommands

Current knowledge tooling includes:
- `vectrune knowledge export`

This command regenerates starter docs and AI export artifacts from `knowledge/` into:
- `language/docs/data/`
- `documents/ai/vectrune-llm-pack/`

Optional usage:
- `vectrune knowledge export --root <workspace-path>`

Use this command after updating shared knowledge/reference files so the served docs data and AI pack stay aligned.

## AI integration notes

The repository README currently describes environment variables for AI integration:
- `VECTRUNE_OLLAMA_URL`
- `VECTRUNE_AI_MODEL`

These should stay aligned with the runtime implementation and user guidance.

## Docs maintenance notes

When CLI behavior changes:
- update this page
- update examples in `README.md` or `examples/` if common workflows changed
- update `language/docs/` if public docs nav or wording should change
- add tests for changed parsing/default behavior where practical
