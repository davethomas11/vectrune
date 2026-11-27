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

Experimental persistent storage commands are `vectrune db` and `vectrune events`.
They support direct files, named datasource configuration and remote standalone
servers. See [Rune DB and Vect Event](storage.md) and
[`examples/data/storage/`](../../examples/data/storage/README.md).

## Mobile Web (source builds)

`vectrune examples/rune-mobile-web --build android|ios` packages a
`rune-mobile-web` frontend into a debug APK or unsigned iOS Simulator app.
`--export android|ios --build-dir <directory>` hands off an editable native
project without installing dependencies or requiring SDKs. `--prepare-only`
with `--build` skips native tooling. See [Rune Mobile Web](mobile-web.md) for
platform prerequisites, generated-directory protections and signing limitations.

## Apple TV tooling (experimental)

`vectrune tvos` wraps a Pixel-3D game for Apple TV. `check`, `init` and `icon`
run on any OS; everything else needs macOS, Xcode, the Rust targets
`aarch64-apple-tvos` and `aarch64-apple-tvos-sim`, and (to run on hardware) a
paired Apple TV. Commands run from a Vectrune checkout unless
`--runtime-source` or `--runtime-libs` points at the TV runtime.

```sh
vectrune tvos doctor                       # verify Xcode, targets, signing, pairing
vectrune tvos check game.rune              # can the TV runtime run this game?
vectrune tvos init game.rune               # write tvos.toml (team and device auto-detected)
vectrune tvos deploy                       # check, bundle, build, install, launch
vectrune tvos watch                        # redeploy whenever .rune files change
vectrune tvos stats --seconds 20           # fps, frame timings and memory from the TV
vectrune tvos logs                         # stream the game's console output
vectrune tvos pull-saves -o saves          # copy saved progress from the TV
vectrune tvos reset-saves                  # delete saved progress and relaunch
vectrune tvos package                      # archive and export for App Store Connect
vectrune tvos icon art.png -o Assets.xcassets
```

`tvos.toml` (beside the game or in the working directory, or `--config FILE`)
holds `game`, `name`, `bundle_id`, `team`, `device` (name or identifier), `icon`,
`build_dir`, `runtime_source` and `runtime_libs`; unknown keys are rejected,
relative paths resolve against the file, and command-line flags override it.
Without `team` the only keychain signing team is used; without `device` the
only paired Apple TV is used. Generated output lives in `build/tvos`
(`project/`, `derived/`, and a cached `runtime/` that is built once).

- `bundle GAME [-o DIR]` writes only the Xcode project (host, `game.js` from the
  compiled game, asset catalog, runtime libraries) without building it.
- `icon` produces a tvOS brand-asset catalog (layered app icon, App Store icon,
  top shelf images) from one image; `bundle`/`deploy` use `icon` from
  `tvos.toml` or a placeholder tile.
- `stats` and `logs` relaunch the app attached to the console. The host logs
  `Rune stats: fps=… sim_ms=… native_ms=… memory_mb=…` every three seconds.
- Saves live in the app's `Library/Caches/RuneSaves`, which tvOS may purge under
  storage pressure; they are flushed whenever the app leaves the foreground.
  `reset-saves` launches with `RUNE_TV_RESET_SAVES=1`.
- `package` archives, then exports with the `app-store-connect` method; export
  needs an App Store Connect record and distribution profile for the bundle ID.
- A sleeping Apple TV refuses launches; wake it and rerun.

The lower-level commands remain for existing projects: `devices`,
`build --project P --scheme S [--device D] --derived-data DIR` and
`run --app APP [--device D]` (device defaults to `tvos.toml`, then the only
paired Apple TV). `build-runtime --source DIR -o DIR` builds the device and
simulator runtime libraries. See the
[Apple TV discovery](../../documents/feature/apple_tv/discovery.md); declare TV
navigation with the [`@TV` profile](pixel3d.md).

## ASCII Animator (v0.3.12)

`vectrune ascii generate --text "Hello!" -o animation.rune` creates a runnable
starter animation. `vectrune ascii image photo.png --width 80` converts an image
to ASCII, and `vectrune ascii text "Hello"` renders a character banner.
For GIF playback use `ascii image animation.gif --play` (Space pauses;
Q/Esc/Ctrl-C exits). Use `ascii image animation.gif --rune -o animation.rune`
to export a self-contained runnable app with composited frames and 60 Hz
quantized GIF delays. Both modes loop continuously; animation limits are
120 frames, 80 output rows and 8 MiB ASCII frame data. Default GIF output
remains the first frame. `--play --frames N` bounds simulation ticks and
cannot be combined with `--rune` or file output.
Text accepts `--font bitmap|compact|double`, `--char` for filled pixels,
and `--background` for empty pixels/spacing (single printable ASCII characters).
Generators write to stdout unless `-o <new-file>` is provided; existing files
are never overwritten. These commands need no example directory.
Example apps remain ordinary Rune files, not embedded assets; there is no
`ascii demo` or `ascii list` command.
`vectrune ascii run <entry.rune>` runs a custom terminal app;
`vectrune <entry.rune>` also launches `@App type = ascii-animator` directly.
Q, Esc and Ctrl-C restore the terminal and exit.

`ascii run` accepts `--frames N` for bounded playback and
`--plain` to print only the final frame without ANSI codes or delays
(default one tick). `--keys Enter,ArrowLeft` supplies one key per tick and
requires plain mode. Interactive output requires a real terminal; redirected
execution must use plain mode. `--mute` disables declared synth tones without
opening an audio device, and also works for direct ASCII file execution.
Plain mode is always silent. See [ASCII Animator](ascii-animator.md).
Command-mode apps declare `@AsciiAnimator command = action`; Enter submits typed
text, Backspace edits, Ctrl-U clears, and Esc/Ctrl-C exits (Q is ordinary text).
Plain captures can repeat `--commands "text"` once per tick; this requires a
command-mode app and cannot be combined with `--keys`.
Try the complete [Borrowed Mornings adventure](../examples/borrowed-morning.md).

## Offline manuals

Release archives include `man/man1/vectrune.1` and
`man/man7/vectrune-language.7`. The Homebrew formula installs them for
`man vectrune` and `man vectrune-language` on macOS and Linux. Older releases
without bundled pages remain installable, but do not provide these manuals.
Windows archives contain the same pages; Windows does not include a man viewer.
CLI/runtime behavior is unchanged.

The renderer is `teaching_website/generate_man_pages.vect`. Its Python launcher
only collects the shared inventory through `reference_inventory.py`, queries
the release binary for version/help, and creates output directories. Formatting,
content selection and roff escaping execute in `.vect`. The language manual
uses `knowledge/reference/library.json` plus extracted frontend command metadata;
the CLI manual uses the binary's recursively collected help. Runtime labels,
examples, parameters, defaults and limitations are retained.

`man vectrune-language` includes portable object property shorthand, replication
and grid generators, local templates, `with`/`all` overlays, `objects[]id`
lookup/update syntax and compound assignments. The website's **Language and
documents** library chapter uses the same entries and examples, including runtime
availability, independent-copy behavior and missing-match rules.

From a checkout with a built CLI:

```sh
python3 teaching_website/build_man_pages.py --binary target/debug/vectrune --output dist/man
man ./dist/man/man1/vectrune.1
man ./dist/man/man7/vectrune-language.7
```

Release CI generates once on a native Linux host from the checked-out release
tag, then bundles identical pages with every platform binary. It does not execute
cross-compiled binaries for documentation generation. No generation tools are
required during Homebrew installation. The public website may describe a newer
version; the bundled manuals describe the installed release. Tests:
`python3 tests/browser/test_man_pages.py`.

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
- `--secondary-app <RUNE_PATH>` — launch an independent HTTP app alongside the primary; repeat for more apps. Each uses its configured port. Host/port overrides apply only to the primary. Ctrl-C stops the group; `--watch` reloads it. Export/transform/script execution flags cannot be combined with this option.
- `-w`, `--watch` — watch for file changes and automatically restart the server (development mode)

## Merging documents with `--merge-with`

`--merge-with '<base-file>@<selector>'` applies values from the primary input document to a base Rune, JSON, YAML, or XML document. Input and output formats remain independently selectable with `-i` and `-o`.

Selectors use dot-separated object paths, `(a|b)` alternatives, `[]` wildcards for array items or object values, and merge instructions:

```text
(KEY_FIELD=TARGET on VALUE_FIELD from SOURCE_PATH)
(VALUE_FIELD from SOURCE_PATH)
```

`SOURCE_PATH` is a root-relative dot path in the input document. For example:

```bash
vectrune -i yaml ips.yaml \
  --merge-with 'config.yaml@environment.(preview|prod).[].(name=allowedIps on value from Ips)' \
  -o yaml
```

Wildcards can be chained to traverse nested arrays, for example `services.[][].(name=selected on value from data)`. Direct field instructions such as `config.(keys from api.keys)` copy the source value to the selected object. Updates replace values rather than append. Existing destinations must have the same JSON type as the source; absent destination fields are created. Missing source paths, malformed selectors, type conflicts, and selectors with no matching targets fail explicitly. Nonmatching alternatives/items are skipped if another target matches; empty source arrays are valid. A root-level instruction can populate an empty object base, for example `(settings from settings)`.

XML documents use the outer element as a wrapper. Repeated sibling elements become arrays, leaf text becomes strings, empty elements become null, attributes are represented as `@name` fields, and mixed element text is stored in `$text`.

## Rune file loading behavior

For Rune input, the CLI now performs an import-aware pre-parse load step.

Current behavior:
- a script path may point to a single `.rune` file or a directory of `.rune` files
- top-level `import "..."` declarations inside Rune files are resolved before parsing
- imported directories load direct child `.rune` files in sorted filename order
- imports are resolved relative to the importing file
- when sections overlap, imported content is merged first and the importing file is merged after it

## Formatting Rune files

`vectrune fmt <entry-or-directory>` formats the entry and its imports;
`--check` reports changes without writing and exits 1 when formatting is needed.
`--line-width <characters>` defaults to 100 and accepts integers of at least 20.
Long top-level JSON object assignments are expanded into four-space
indented fields, recursively wrapping nested objects and arrays to fit the target.
Top-level arrays that contain objects or arrays (for example `@TV` `modes = [...]`)
wrap one element per line too, including when written across several lines; arrays
of scalars stay inline. Object keys keep their source order.
Logic objects, arrays and calls containing collections also wrap, including
dynamic values such as HUD meters and enemy definitions. Balanced logic
expressions continue across lines; quoted brackets do not affect continuation.
Long `@Logic` ternary assignments and `if` conditions may also wrap at
ternary or boolean operators. When the right-hand side fits, a long assignment
may wrap after `=`. Continuation lines are indented beyond the original line.
Formatting checks the parsed document and logic tokens before writing, preserving
quoted text and executable expressions. Long strings, scalar expressions and
opaque view/style/source blocks can exceed the target width.
For example, format Rune Crypt's touch controls with:

```bash
vectrune fmt examples/games/rune_crypt --line-width 100
vectrune fmt examples/games/rune_crypt --check
```

The limit is a target, not a hard cap: individual strings, comments, expressions
without supported break points, views, styles and embedded source are not split.
Existing multiline JSON assignments and supported logic expressions are
reformatted to the selected width. Line endings are preserved. Every changed file
is reparsed and compared before any writes; semantic differences fail explicitly.
Implementation: [`src/cli/formatting.rs`](../../src/cli/formatting.rs).
Rust callers of `format_source` must handle its `Result<String, ParseError>`;
incomplete continuations are reported instead of silently consuming lines.

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
