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

### Rune Pixel / Monster City prototype

The pixel engine runs a Rune-authored game in a browser canvas or an optional native desktop window. The [Monster City example](examples/monster_city/monster_city.rune) has a giant kaiju, five destructible buildings, soldiers, tanks, bullets, health, scoring, animation, keyboard/touch controls, pause, restart, and fullscreen.

```sh
# Serve the game at http://127.0.0.1:3010
cargo run -- examples/monster_city/monster_city.rune --target web

# Export a self-contained HTML game; it also works directly from a file URL
cargo run -- examples/monster_city/monster_city.rune -o html > monster-city.html

# Use a normal Rune-Web page as the game's shell
cargo run -- examples/monster_city/custom_shell.rune -o html > custom-cabinet.html

# Build the experimental native window host (winit + pixels)
cargo run --features pixel-desktop -- examples/monster_city/monster_city.rune --target desktop
cargo run --features pixel-desktop -- examples/monster_city/monster_city.rune --target desktop --fullscreen

# Native HTTP/export tests and headless JavaScript game rules
cargo run -- test examples/monster_city
```

Use arrows/A/D to move, Space to smash, Enter to start/restart, P to pause, and F for fullscreen. M toggles music and effects in both hosts. Desktop also supports F11; Escape leaves fullscreen or closes the window. Desktop builds play through CPAL; the browser uses Web Audio. Both use the same Rune synth/sequencer and declarations. This entire pixel engine is an unreleased prototype, absent from the published 0.3.2 CLI. The native host is opt-in while platform packaging is validated. On Debian/Ubuntu, install `libasound2-dev` before compiling the desktop feature. The default pixel target is web.

[sound.rune](examples/monster_city/sound.rune) defines the original four-bar **Monster March** with `@Music/monster_city`, the title/shop themes **Monster Parade** / **Tiny Treasures**, menu move/confirm/purchase/denial cues, plus ten gameplay `@Sound` effects for roar, footsteps, smash, collapse, rifle/cannon fire, damage, tank explosions, victory and game over. These are the same declarations and `music.play` / `sound.play` commands used by VectRaiders and VectWorms; no audio files or downloads are needed. The native title screen plays Monster Parade immediately; browsers wait for a game interaction before starting music. Tiny Treasures plays in the shop, and Monster March plays during a rampage. Track changes keep one scheduler, browsing/buying does not restart the shop loop, music pauses on focus loss, and victory/defeat stops the level track. M or the Sound button mutes both music and effects while gameplay continues. Muting survives restart; hiding the page or replacing/removing the canvas pauses audio and stops its schedulers. The pixel audio host disables Rune-Web playback-state/DOM synchronization so music cannot rerender its surrounding shell.

The native host installs a small adapter for the oscillator/noise/gain/filter primitives used by the existing synthesizer. The shared JavaScript sequencer sends scheduled voices and automation over a bounded queue to a Rust PCM mixer; CPAL writes the mix to the default output device. The device sample cursor drives native scheduling. Mute also displays MUTE in the in-game HUD. Closing the window drops the sound stream; unavailable output devices produce a warning and allow silent play. The adapter implements Rune's synth surface, rather than the full browser Web Audio API.

Native audio tests run without hardware using `cargo test --lib apps::pixel::native_audio`. To deliberately play a short real-device sample, use `cargo test --features pixel-desktop --lib real_output_device_plays_shared_rune_synth -- --ignored --nocapture`.

`.pixel.rune` is ordinary importable Rune asset data: `@Palette/<name>` defines a `colors` JSON map from single ASCII characters to `#RRGGBB` or `transparent`; `@Sprite/<name>[/frame]` declares `palette`, integer `size`, optional `origin`, and a `pixels:` block of quoted equal-width rows. `@Animation/<name>` supplies `frames` and `fps`. See [the human-readable sprites](examples/monster_city/sprites.pixel.rune). `check` validates dimensions, palette characters, colors, and animation references. Sprite sheets are represented internally by indexed sprite assets; atlas packing/editor tooling remains future work.

`@App type = pixel` selects a `scene`, logical `resolution`, and `tick_rate` (default 30). `@Scene/<name>` selects a `logic`, `background`, ordered `layers` of state paths, optional background `rects`, `keys`, `hud`, and status `overlays`. Each renderable entity has `x`, `y`, `sprite`, and optional integer `scale`, `flip`, and `visible`. Sprite origins are applied before scaling. Scene logic provides `start` and `tick(input)` actions; `call smash` invokes another Rune action. Keep boolean input checks explicit, such as `input.left == true`. The engine owns its fixed-step clock, so scene logic must omit `timer`.

The same JavaScript interpreter, simulation, animations, and RGBA framebuffer run in the browser and native QuickJS host. The browser presents through Canvas 2D; the native host uploads that framebuffer through `pixels`. Rendering uses integer scaling when space permits, with a fitted view on smaller mobile screens. Input clears on focus loss; hidden/blurred games pause, and catch-up steps are bounded.

For a custom Rune-Web shell, set `@App shell = arcade`, define `@Page/arcade`, and include one `canvas data-rune-pixel=true tabindex=0`. Optional HTML controls use `data-pixel-start`, `data-pixel-pause`, `data-pixel-mute`, `data-pixel-fullscreen`, or `data-pixel-input="left|right|smash|defend|special"`. The pixel runtime has a separate namespace/context from the shell. A shell rerender disposes old listeners/frames and remounts the same paused game state. See [custom_shell.rune](examples/monster_city/custom_shell.rune).

Browser regressions: `python3 tests/browser/monster_city.py` and `python3 tests/browser/monster_audio.py`. The audio regression checks real nonzero output samples, silence when muted/paused, and scheduler cleanup. The initial game deliberately uses staged destruction and a single city block. Scrolling levels, sprite atlas packing, a sprite editor, and broader desktop release validation remain follow-ups.

Monster City's title screen offers the next city and a 17-monster shop across six pages. **B** opens the shop; **T** returns to the title. The title screen offers **Reset to city 1**, with confirmation; this resets saved city progress while keeping coins, owned/equipped skins, best score and the level seed. Use arrows and Enter, or click/tap a card. Browser shells also expose regular HTML menu buttons for keyboard and screen reader access. Moss is free; Ember costs 120 coins and Frost costs 240. Ten additional monsters—Volt, Coral, Golem, Cyclops, Mantis, Drake, Yeti, Slime, Mecha and Cosmo—have distinct silhouettes and cost 300–900 coins. Thorn (1,000), Obsidian (1,100), Tide (1,200), and Nova (1,400) add four more shapes and moves. Previous/Next buttons and Page Up/Page Down browse three cards per page, with the page count derived from the catalog. Each skin now has an exclusive energy-based special move; ordinary movement and base health stay shared. A completed city awards `50 + city * 10 + floor(score / 10)` coins exactly once. Coins and unlocks survive defeat and restart. Helicopters arrive in city 3, planes in city 5, and a second helicopter in city 8. Enemy counts, projectile counts, armor and firing rates have upper bounds.

The game imports each monster from its own file in [skins/](examples/monster_city/skins). Later cities vary building positions/colors and army placements using a saved seed plus the city number; retrying recreates the same city. City 1 keeps a predictable introductory layout. Game logic remains in [logic.rune](examples/monster_city/logic.rune).

Hold **Down/S** or the **BLOCK** touch button to duck. The monster uses a shorter, grounded sprite/hitbox, high bullets can pass overhead, and hits that connect deal 10% damage rounded up (minimum 1). Blocking stops movement and manual attacks, while power timers and energy regeneration keep advancing. Release to stand and attack. Blocking has a visible shield and a throttled hit sound. Every skin includes an authored 16×16 duck pose, including while Bigger Juice is active.

Press **X** or tap **SPECIAL** to use the equipped monster's exclusive move. Energy starts at 100 each city and recharges at 6 per second up to 100 during play; pause freezes it. Moves cost 40–70 energy, have a 1.5-second cast cooldown, and require a new press rather than automatically firing when held. The HUD shows energy and the move's cost; the touch button disables while blocking, cooling down or short of energy. Shop cards show the move and cost before purchase. Energy, defense and ongoing attacks are temporary state, separate from the saved collection.

[combat.rune](examples/monster_city/combat.rune) defines all 17 moves and their balance data. Examples include Moss's Vine Snare, Ember's Fire Fan, Frost's Ice Nova, Volt's Chain Lightning, Coral's Reef Repair, Golem's Stonewall, Cyclops's Focus Ray, Mantis's Razor Dash, Drake's Dragon Roar, Yeti's Avalanche, Slime's Acid Splash, Mecha's Missile Salvo, Cosmo's Meteor Call, Thorn's Thorn Ring, Obsidian's Fault Line, Tide's Tidal Surge and Nova's Solar Burst. The shared strike helpers preserve kill/score accounting across attacks. A scene HUD may bind `energy`, `max_energy` and `special` state fields. Browser coverage: `python3 tests/browser/monster_combat.py`.

Parachute crates provide seven temporary powers, all authored in [powers.rune](examples/monster_city/powers.rune), with sprites in [powers.pixel.rune](examples/monster_city/powers.pixel.rune). Walk into a descending or landed crate to collect it. A new pickup replaces the current power; the HUD shows the name and remaining seconds. Pause freezes power timers. Restart, leaving a level, victory and defeat clear temporary powers; the saved profile contains no crates or power timers.

| Power | Effect | Duration |
| --- | --- | --- |
| Atomic Breath | Charge automatically, then aim left/right with movement; the beam damages buildings/ground units and clears shots | 2 seconds charging, 4 seconds firing |
| Force Field | Invulnerable to incoming shots | 6 seconds |
| Electric Storm | Contact explosions, ranged lightning against ground/air units, nearby projectile clearing | 8 seconds |
| Bigger Juice | Larger monster, contact demolition, half incoming damage rounded up | 10 seconds |
| Super Speed | Faster movement and a seeded 65% dodge chance on incoming hits | 10 seconds |
| Baby Kaju | A small companion follows and attacks nearby buildings/ground troops | 20 seconds |
| Aftershock | A ground blast demolishes nearby buildings/units and clears nearby shots | Instant blast, 1-second visual |

Cities 1–4 attempt a drop every 15 seconds at 50% probability, starting after 5 seconds, with shield/speed/baby pickups. Cities 5–14 attempt every 10 seconds at 75%, starting after 3 seconds, with all seven powers. City 15+ attempts every 5 seconds at 100%, starting after 1 second. Crates take time to descend; their positions/types are seeded for reproducible retries. At most two crates coexist, and uncollected crates expire after 20 seconds. No additional controls are required. Power-up browser checks: `python3 tests/browser/monster_powers.py`.

Reusable pixel scene options:

```rune
@Scene/city
persistence = {"key":"monster-city-v1","state":"profile"}
menu = menu
commands = {"KeyB":"openStore","KeyT":"openTitle"}
menu_sounds = {"move":"menu_move","confirm":"menu_confirm"}
```

`persistence` saves only the named state object, with a versioned JSON envelope. Desktop saves live under `.vectrune/saves/` in the launch directory, which Git ignores; browser saves use localStorage under `rune-pixel-<key>`. Use a distinct key per game. The two hosts have separate local profiles. Writes happen when the profile changes, with atomic file replacement on desktop. Saved data restores only declared fields and compatible types; Monster City also validates its wallet, ownership and equipped skin. Unreadable saves start a fresh profile with a visible notice. When storage is unavailable, play continues with a visible session-only notice. No account or cloud sync is involved.

Tune/effect definitions and `music.play` / `sound.play` calls live in [sound.rune](examples/monster_city/sound.rune) and [logic.rune](examples/monster_city/logic.rune). Scene `menu_sounds` supplies reusable navigation/activation cues; purchase and denial effects remain Rune actions.

A scene's `menu` binds a state object with `title`, `subtitle`, `note`, optional `cards` (`name`, `sprite`, `detail`, `action`, `args`) and `buttons` (`label`, `action`, `args`). The portable renderer provides the same menus on desktop and web. Custom browser shells can include `nav data-pixel-menu=true` and `p data-pixel-save=true`, plus `button data-pixel-action="openStore"` to invoke an action. A pixel logic action named `initialize` runs after the saved profile loads, before the first frame. Keep save validation there.

Game expressions support `random(min, max, seed)` for an inclusive seeded integer, `pick(list, seed)` and `shuffle(list, seed)`. Equal seeds reproduce results in both hosts; shuffle returns a copy. Omitting the seed chooses fresh randomness. These are shared JavaScript runtime tools, also available to logic tests.

Desktop performance: sprites reuse cached horizontal color runs and static scene backgrounds; the interpreter resolves simple state paths directly and caches operator parsing rather than evaluated values. QuickJS is optimized even in local development/test builds while Rune's Rust code retains debugging support. The desktop host schedules redraws at 60 Hz. Measure a busy generated city with `cargo test --test pixel_app native_pixel_frame_benchmark -- --ignored --nocapture`. The benchmark reports simulation and rasterization timings, separately from GPU presentation and device audio. Additional progression/browser coverage: `python3 tests/browser/monster_progression.py`.

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
