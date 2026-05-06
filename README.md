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
- `examples/tic_tac_toe/` — multi-file Rune-Web example with UI, logic, and style parts

## Installation

### Homebrew (macOS/Linux)

```sh
brew tap davethomas11/homebrew-vectrune
brew install vectrune
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
