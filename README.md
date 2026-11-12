# Vectrune

![Vectrune Logo](intellij_plugin/src/resources/icons/rune.png)

Vectrune is a declarative language and runtime for structured data, APIs, and small app workflows.

It is designed to make common application code easier to read, easier to trust, and easier to ship.

## Why Vectrune

Use Vectrune when you want to:
- define REST or GraphQL behavior in a compact `.rune` document
- model structured data without a lot of boilerplate
- keep request handling, validation, and docs generation close together
- prototype small apps and workflows quickly with readable source files

## 5-minute first success

The fastest way to see Vectrune do something useful from this repository is to run the minimal REST example.

### 1. Verify your toolchain

```powershell
rustc --version
cargo --version
```

### 2. Build and run the example app

```powershell
cargo run -- examples/app.rune
```

### 3. Hit the health route

```powershell
curl http://127.0.0.1:3000/health
```

Expected result:

```text
OK
```

If you already have the `vectrune` binary installed, you can run the same example with:

```powershell
vectrune examples/app.rune
```

## What Vectrune looks like

Small REST app:

```rune
#!RUNE

@App
name = Example API
type = REST
version = 1.0

@Route/GET /health
run:
    log "Health check"
    respond 200 "OK"
```

Structured data document:

```rune
#!RUNE
@Skateboarder
+ name = Tony Hawk
  age = 53
  style = Vert
 
+ name = Nyjah Huston
  age = 26
  style = Street
  
+ name = Leticia Bufoni
  age = 28
  style = Street
```

## Recommended starter examples

Start with one of these depending on what you want to learn first:

- `examples/app.rune` — smallest complete `@App` + `@Route` example
- `examples/skateboarders.rune` — simplest structured data document
- `examples/user_api.rune` — REST API with schemas, validation, and CRUD-style routes
- `examples/book_graphql.rune` — GraphQL example with memory-backed state
- `examples/dynamic_ai_web_codex.rune` and `examples/dynamic_ai_web_copilot.rune` — ready-to-run AI cafe demos for authenticated CLIs
- `examples/rune_web_guide/` — [Rune-Web UI lessons](knowledge/language/rune-web-guide.md) with forms, a packing checklist, components, view switching and responsive styles
- `examples/dynamic_ai_web.rune` — [descriptive AI sites](knowledge/language/dynamic-ai-web.md) with Ollama, Codex CLI, or Copilot CLI
- `examples/sales_report.rune` — one-line grouped CSV reports with [`summarize`](knowledge/language/summarize.md)
- `examples/tic_tac_toe/` — multi-file Rune-Web example with UI, logic, and style parts

## Installation

### Homebrew (macOS/Linux)

```sh
brew tap davethomas11/homebrew-vectrune
brew install vectrune
```

### Windows local dev install

For repeat local development installs on Windows PowerShell, use the checked-in installer script:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install-dev.ps1
```

What it does:
- builds `vectrune` in release mode from the current repo
- installs `vectrune.exe` into `$HOME\.local\bin`
- adds `$HOME\.local\bin` to your user `PATH`
- installs a `v.cmd` shortcut in the same directory so you can run `v` as a quick command in PowerShell or `cmd.exe`

After the script completes, open a new shell and verify:

```powershell
vectrune --version
v --version
```

### From source

```powershell
cargo build --release
```

The binary will be available at `target/release/vectrune`.

## Running scripts

You can run a script with the `vectrune` CLI. Pass a file path, or use `-` to read the script from standard input.

```powershell
vectrune examples/user_api.rune
```

```sh
cat examples/user_api.rune | vectrune -
```

Rune files may also declare top-level imports such as `import "shared.rune"` or `import "parts"` to load another Rune file or a directory of `.rune` files before parsing.

## Common CLI workflows

Vectrune provides several CLI commands for interacting with scripts and data:

Basic usage:

```text
vectrune <script.rune> [options]
```

Common commands and options:

```powershell
# Run a script
vectrune examples/user_api.rune

# Calculate an aggregate over data
vectrune examples/skateboarders.rune --calculate "avg Skateboarder.age"

# Transform data into a new document
vectrune examples/skateboarders.rune --transform "@Skaters name:[@Skateboarder.name]"

# Merge two documents using a custom expression
vectrune -i <input_format> <input_file> --merge-with '<base_file>@<selector>' -o <output_format>

# Use the AI command (if enabled)
vectrune --ai "Give me CLI commands to list Docker containers"

# Regenerate docs/AI export artifacts from the shared knowledge source
vectrune knowledge export

# Show help
vectrune --help

# Show version
vectrune --version
```

Lambda Packaging (AWS Lambda)
----------------------------
Vectrune ships a `lambda` subcommand that bundles your Rune sources, config, and Lambda-ready binary into either a zip (classic Lambda) or a container context (Lambda container images).

### 1. Build a Lambda-Compatible Binary (manual)
The packager requires you to provide a Linux binary that matches the Lambda execution environment. See `documents/feature/lambda_runner/binary_build_guide.md` for full cross-compilation steps.

```bash
cargo build --release --target x86_64-unknown-linux-musl
cp target/x86_64-unknown-linux-musl/release/vectrune dist/vectrune-lambda
```

### 2. Create a Zip Artifact
Produces `dist/book-api-lambda.zip` containing `bootstrap`, rune files under `rune/`, optional config under `config/`, and a manifest.

```bash
vectrune lambda package \
  --rune examples/book_graphql.rune \
  --binary dist/vectrune-lambda \
  --config examples/config.yaml \
  --mode zip \
  --output dist/book-api-lambda.zip
```

### 3. Create a Container Context
Generates a tarball you can build into a Lambda container image (Dockerfile + bundle staged under `bundle/`).

```bash
vectrune lambda package \
  --rune examples/book_graphql.rune \
  --binary dist/vectrune-lambda \
  --mode container \
  --image-name "vectrune/lambda:book-api" \
  --output dist/book-api-lambda-context.tar.gz
```

The command writes `manifest.json` with metadata (version, files, sources) and enforces the 50 MB Lambda zip limit. Staged contents always include:
- `bootstrap`: the executable you provided (chmod 755 automatically)
- `rune/`: Rune sources or directories supplied via `--rune`
- `config/`: Optional configs from `--config`
- `manifest.json`: Build metadata for auditing

### How to install Ollama with Homebrew on macOS/Linux

```bash
brew install ollama
brew services start ollama
ollama pull phi4
```

### Environment variables used by AI command

- `VECTRUNE_OLLAMA_URL` (optional): URL of the Ollama API (default: `http://localhost:11434/api/generate`)
- `VECTRUNE_AI_MODEL` (optional): Ollama model to use for generation (default: `phi4`)


## Doctor, check, and Rune tests

The developer workflow is available in Vectrune 0.3.2, including embedded JavaScript logic tests (introduced in 0.3.2). See the [Developer section](https://vectrune.com/developer) for installation, examples, and a downloadable tested starter. `doctor`, `check`, and the initial test runner were introduced in 0.2.21.

```sh
vectrune doctor examples/testing/app.rune
vectrune check examples/testing
vectrune fmt examples/testing --check
vectrune test examples/testing
vectrune test examples/testing --filter User --json
```

`doctor` reports the running version, executable, platform, other Vectrune executables on PATH, import resolution, project diagnostics, and local availability of the configured port. This helps identify an older global binary shadowing a workspace build. Without a path it checks `app.rune` if present, otherwise just the installation. An occupied port is advisory; invalid project configuration fails.

`check` loads imports and validates native application types, REST methods, conflicting parameterized routes, authentication/schema/data-source references, test declarations, and Rune-Web pages/components/props using the frontend parser. It reports unsupported native schema types and unrecognized backend commands as warnings; likely command typos include suggestions and source locations. Use `--deny-warnings` to fail on warnings, and `--json` for structured diagnostics. It never starts the server or executes `run:` blocks. This is an initial static checker; full expression typing and cross-engine schema parity remain roadmap work.

### Write tests in Rune

Keep tests beside the application, for example `api.test.rune`. Put test-only fixtures and suite setup in `.test.rune` files too. Application directory imports skip these files recursively; explicit imports from application `.rune` files into test files fail clearly. Test files may import application modules and explicitly import other test helpers. Importing a directory always skips test files, so a test can safely import its application directory without importing itself.

`vectrune test` still discovers test files, and developer `check`/`fmt` can inspect them. Normal application loading, source collection, and Lambda deployment bundles exclude them. Existing inline `@Test` declarations in ordinary `.rune` files remain supported; use the `.test.rune` convention when you want deployment isolation.

Example:

```rune
import "app.rune"

@Test/UserCreation
run:
    req = { method: "POST", path: "/users", body: { name: "Alice", role: "admin" } }
    res = test-request req
    assert res.status == 201
    assert res.body.name == "Alice"
    assert res.body.role == "admin"
```

Run the [complete example](examples/testing/api.test.rune):

```sh
vectrune test examples/testing
vectrune test examples/testing --list
vectrune test examples/testing --filter UserCreation --timeout 5
```

With no path, `test` discovers `.rune` files recursively in the current directory. A directory is **one application/suite**; point it at a project rather than a catalogue of unrelated applications. Imported files are deduplicated. Discovery skips `target`, `node_modules`, `.git`, `.venv`, `_site`, `dist`, and `build`, and does not follow directory symlinks. A file path runs that file and its imports, so import the application from your test entry. `check` defaults to `app.rune`, then the current directory.

`test-request` sends an in-process HTTP request through the native application router, including middleware. No listening port is needed. The request accepts `method` (default `GET`), a local `path`, optional string-valued `headers`, and `body`. Object/array bodies are JSON-encoded with a default JSON content type. Responses expose `status`, parsed JSON `body` (or a string for other content), raw `text`, and `headers`; use indexed paths such as `res.body.tags[0]` or `res.headers["content-type"]`.

Assertions support `==`, `!=`, `>`, `<`, `>=`, `<=`, `contains` for strings/arrays, and boolean values. Equality compares values without coercing strings to numbers. Missing paths fail explicitly. Existing backend `run:` steps and conditional blocks are available for setup and helpers; `assert` and `test-request` are test-only builtins. Each test must execute at least one assertion. A failed assertion or unknown command in test steps stops that test, while remaining tests continue. Application handlers retain their normal runtime behavior.

Tests run sequentially, rebuilding the application and resetting Rune memory before each test and clearing it afterwards. Application startup runs for every test. Tests use the application's normal file, network, and database behavior; external resources are not rolled back. Use dedicated test configuration for these resources. The main execution budget defaults to 10 seconds including application construction/startup; cleanup has a separate budget of the same duration. Response bodies are limited to 8 MiB. Timeouts cancel asynchronous work, while synchronous/blocking operations follow the runtime's normal behavior.

`--list` only discovers tests and performs static checks. `--filter` selects case-sensitive substrings of test names. `--json` writes a machine-readable report to stdout with runtime diagnostics on stderr. Successful checks/tests exit `0`; project/test failures and an empty test selection exit `1`; invalid command usage exits `2`. Listing an empty selection succeeds. `test --watch` reruns after edits to Rune source, recursive imports, and JSON/YAML/CSV fixtures, including atomic saves, deletions, and repairs after load errors. Generated/dependency directories are skipped. Ctrl-C while waiting exits with the last run’s status. Changes during execution are picked up afterwards. Keep generated output outside watched fixture inputs to avoid rerun loops.

### Testing Rune-Web

The native test runner supports Rune-Web HTTP responses and server-rendered HTML through `test-request`. The [Studio suite](examples/rune_studio/studio.test.rune) exercises document rendering, initial editor markup, presets and controls, HEAD requests, missing pages, and unsupported methods:

```sh
vectrune test examples/rune_studio
vectrune test examples/rune_studio/studio.test.rune --filter Studio/Document
```

These assertions check full rendered elements, rather than just text that could also appear in the embedded client templates. They do not execute JavaScript, click controls, or inspect a browser DOM. Studio's client logic runs in the browser, so posting an action name to its page is not a way to invoke that action.

The companion browser check exercises preset changes, tempo, note editing, Save/Load across a reload, Play/Stop controls, and the downloaded song:

```sh
python3 tests/browser/rune_studio.py
```

It requires a built `target/debug/vectrune`, Python Playwright, and Chromium, as do the other scripts in `tests/browser`. It checks UI state and export contents; it does not measure audible playback quality. The `.test.rune` file remains excluded from production imports, source bundles, and Lambda packages.

### JavaScript logic tests

The test command includes an embedded QuickJS runner that executes Rune-Web's production action and expression interpreter without opening a browser. Try the [Studio logic tests](examples/rune_studio/studio.logic.test.rune):

```sh
vectrune test examples/rune_studio/studio.logic.test.rune
vectrune test examples/rune_studio --json
```

`vectrune test` runs native and JavaScript logic tests together by default (`--type all`). Use `--type native` or `--type logic` to select one engine. These selectors also apply to `--list`, `--filter`, and `--watch`. No feature flag, Node installation, or browser is required to run logic tests in a newly built CLI.

```rune
@Test/Tempo
type = logic
page = studio
run:
    invoke changeTempo 4
    assert state.tempo == 148
    assert mock.audio[0].operation == "music.tempo"
```

Set `page` to an existing `@Page` name; its `logic` reference selects the action definitions. An optional `logic = name` overrides that reference. `invoke` accepts an action name followed by one JSON value, or a JSON array of positional arguments; omit the value for actions without arguments. Assertions use the same strict comparisons as native tests, with `state`, `derived`, and `mock` as roots. Unknown actions and test steps fail. A test must execute an assertion in its own `run:` block.

Every test gets a fresh runtime with isolated state and in-memory storage. `mock.storage` contains decoded saved values; `mock.downloads` records `{filename, content}`; `mock.clipboard` records copied text; `mock.audio` records `{operation, args}` without producing sound. Reactive renders recompute derived values without a DOM. Optional per-test `setup:` and `teardown:` blocks use the same `invoke`/`assert` steps; teardown runs after action or assertion failure and has a separate bounded budget. QuickJS interrupts runaway JavaScript at `--timeout`, with a 64 MiB memory limit and a 512 KiB stack limit.

This first prototype covers synchronous actions. DOM/layout/events, network mocks, timers, pending asynchronous jobs, shared fixtures, logic suite hooks, i18n/memory seeds, and a `type = browser` adapter remain future work. Native suite hooks belong to native tests and are not applied to logic tests. Use the existing Playwright companion for actual browser behavior. The developer CLI CI matrix exercises both engines on Linux, macOS, and Windows. Node is only needed when rebuilding the JavaScript bundles (`cd runtime/rune-web && npm ci && npm run build`).

### Fixtures and cleanup

```rune
@TestSuite
setup:
    expected = { role: "admin" }

@TestFixture/User
setup:
    alice = { name: "Alice", role: "admin" }
teardown:
    clear-memory

@Test/UserCreation
fixtures = [User]
run:
    req = { method: "POST", path: "/users", body: alice }
    res = test-request req
    assert res.body.role == expected.role
```

Each test runs suite `setup`, selected fixture `setup` blocks in list order, its own optional `setup`, and then `run`. Context variables are shared across these phases. Teardown runs in reverse order: test, fixtures, suite. An entered setup phase registers its cleanup before executing, so cleanup still runs after setup failure. Only tests that execute an assertion in their own `run` can pass. Startup, setup, assertion, and teardown failures all fail the test. Cleanup has a separate bounded timeout after the main execution budget. Abrupt termination cannot guarantee teardown. External-resource isolation and richer assertion helpers remain future work.

### Formatting

`vectrune fmt <entry-or-directory>` formats the entry and its imports. `--check` reports needed changes and exits `1` without writing. Section headers, top-level assignment spacing, and executable-block indentation are normalized; views, CSS, embedded text, and comments are preserved. All candidates are reparsed and compared before any writes; a semantic difference makes formatting fail. The formatter is deliberately conservative and does not rewrite expressions or reorder declarations.

### Machine-readable reports

All developer commands support `--json` and emit `schema_version: 1`. Ordinary invocations emit one JSON document. Watch mode emits JSON Lines: `event: "run"` for results, followed by `event: "watching"` while waiting. Test results retain `success`, `passed`, `failed`, and `tests`; preflight failures also include `diagnostics`. Each executed test includes `name`, `file`, `passed`, `assertions`, `duration_ms`, `error`, and an optional `location` with `file`, `line`, `column`, and `source`. Static diagnostics also provide `severity`, `code`, `section`, `message`, and an optional `suggestion`. Lines and columns start at one. Section-level diagnostics identify the relevant declaration; statement diagnostics identify the executed or linted source when available. Unknown future fields should be ignored.

## Tests

This project has unit and integration tests. Integration tests live under "tests/":

- tests/integration_app.rs
- tests/integration_user_api.rs

Run all tests:

    cargo test

Run only a specific integration test file:

    # integration_app.rs
    cargo test --test integration_app

    # integration_user_api.rs
    cargo test --test integration_user_api

Run a single test function (exact name) and show logs/output:

    # From integration_app.rs
    cargo test --test integration_app health_route_returns_ok -- --exact --nocapture

    # From integration_user_api.rs
    cargo test --test integration_user_api get_users_returns_array -- --exact --nocapture
    cargo test --test integration_user_api get_user_by_id_not_found -- --exact --nocapture
    cargo test --test integration_user_api put_user_mismatched_id_triggers_validate -- --exact --nocapture

Useful flags:

    # Show logs if using env_logger/tracing
    RUST_LOG=debug cargo test --test integration_user_api -- --nocapture

    # Run tests single-threaded (if needed for shared resources)
    cargo test -- --test-threads=1

## Additional installation and CI options

### From GitHub Releases

You can download pre-compiled binaries for Linux and macOS from the GitHub Releases page.

1. Go to the [Releases](https://github.com/davethomas11/vectrune/releases) page.
2. Download the appropriate `.tar.gz` for your platform:
   - `vectrune-linux-x86_64.tar.gz`
   - `vectrune-macos-x86_64.tar.gz`
   - `vectrune-macos-arm64.tar.gz`
3. Extract the binary:
   ```bash
   tar -xzf vectrune-linux-x86_64.tar.gz
   chmod +x vectrune
   mv vectrune /usr/local/bin/ # Optional: move to PATH
   ```

### GitLab CI/CD Integration

To use `vectrune` in your GitLab pipeline, you can add a step to download and install it:

```yaml
stages:
  - test

run_vectrune:
  stage: test
  image: ubuntu:latest
  before_script:
    - apt-get update && apt-get install -y curl tar
    - |
      VECTRUNE_VERSION="v0.1.0" # Use the desired version
      curl -L "https://github.com/davethomas11/vectrune/releases/download/${VECTRUNE_VERSION}/vectrune-linux-x86_64.tar.gz" | tar -xz
      chmod +x vectrune
      mv vectrune /usr/local/bin/
  script:
    - vectrune --version
    - vectrune input.yaml --merge-with 'config.yaml@env.(prod).[].(name=allowedIps on value from Ips)' -o yaml
```

Repository layout
-----------------

- src/ — runtime and built-ins
- examples/ — example Rune scripts
- tests/ — integration tests
- users.csv — sample data file used by examples/tests

License
-------

TBD. Add your license of choice (e.g., MIT/Apache-2.0) here.

## Environment Variable Substitution

Vectrune supports substituting environment variables into string values using the `$VAR_NAME$` syntax. When a string value is wrapped in dollar signs, the runtime will look up the environment variable with the given name and substitute its value.

**Example:**

```rune
@Database
connection_string = $DATABASE_URL$
```

If the environment variable `DATABASE_URL` is set, its value will be used for `connection_string`. If the variable is not set, an empty string will be used.

This substitution works for:
- Single string values: `key = $VAR$`
- List items: `key = ($VAR1$ $VAR2$)`

If you want to use a literal string with dollar signs, do not wrap the entire value in `$...$`.

## Running Vectrune with Custom Host and Port

Vectrune now supports specifying the bind address and port via CLI flags or in the App section of your .rune file.

### CLI Options

- `--host <HOST>`: Bind to a specific address (default: 127.0.0.1)
- `--port <PORT>`: Bind to a specific port (default: 3000)

Example:

```sh
vectrune --host 0.0.0.0 --port 8080 myapi.rune
```

### App Section in `.rune` File

You can also specify host and port in your `.rune` file:

```rune
@App
host = "0.0.0.0"
port = 8080
```

CLI flags always override the App section.

### Docker Usage

When running inside Docker, you must bind to `0.0.0.0` to make Vectrune accessible from outside the container:

```sh
docker run -p 8080:8080 vectrune --host 0.0.0.0 --port 8080 myapi.rune
```

If you see `Vectrune runtime listening on http://127.0.0.1:3000`, the server is only accessible inside the container. Use `--host 0.0.0.0` to fix this.

### Troubleshooting

- If you cannot access Vectrune from your host, ensure you are binding to `0.0.0.0` and using the correct port mapping in Docker.
- The bind address and port are logged on startup for verification
