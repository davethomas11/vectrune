# Rune Mobile prototype

Android and iOS shells for a bundled Rune-Web app, using Capacitor 8.6.0.
The Rust compiler converts `.rune` into HTML and JavaScript **at build time**.
The device runs the existing Rune-Web engine in WKWebView (iOS) or Android
WebView. No Rust compiler, HTTP backend, remote page, or new Rune interpreter
ships in the app.

## Run the prototype

Requirements: Rust/Cargo, Node.js 22+, and npm. Native builds additionally need
the [Capacitor platform tools](https://capacitorjs.com/docs/getting-started/environment-setup):
Xcode 26+ on macOS for iOS, or Android Studio with JDK 21 and Android SDK 36.
The projects target iOS 15+ and Android API 24+.

From the repository root:

```sh
# Rebuild the runtime embedded by the Rust compiler when changing Rune-Web.
npm ci --prefix runtime/rune-web
npm run build --prefix runtime/rune-web
cd runtime/rune-mobile
npm ci
npm run android   # compiles Rune, syncs bundled assets, opens Android Studio
# Or, on a Mac with Xcode:
npm run ios       # compiles Rune, syncs bundled assets, opens Xcode
```

Select an emulator/simulator or connected device in the native IDE and run.
Physical iOS devices require your own signing team. The checked-in Android and
iOS projects are ready for `cap sync`; do not run `cap add` again.

For command-line builds, after `npm run sync`:

```sh
cd android
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

```sh
# From runtime/rune-mobile, on macOS with Xcode:
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Edit [the demo](../../examples/rune_mobile/app.rune) and its imported styles,
then run `npm run sync`. The demo supports touch, counter actions, two views,
safe areas, and explicit save/restore through Rune's local storage builtins.
It works offline from first launch. Save/restore demonstrates small local
state; WebView storage is not a durable database for critical user data.

`npm run build` exports `www/index.html` using `cargo run --quiet` from this
checkout. To use an already-built compiler, set `VECTRUNE_BIN` to its absolute
path. To export a different self-contained Rune-Web page:

```sh
npm run build -- ../../examples/rune_web_guide/packing.rune
npx cap sync
```

Custom exports must bundle their own logic and CSS. This first exporter does
not copy images, fonts, scripts, or lazy route chunks; it does not package
backend routes, databases, or WebSocket servers. There is no native plugin API
exposed in Rune yet. Use `npx cap sync` after a custom export: `npm run sync`
rebuilds the default mobile demo. Generated web assets and local build outputs
are ignored; native source projects and npm lockfiles are committed.

## Verification

```sh
npm test
npm run build
npx cap sync
# From the repository root:
python3 -m pip install playwright
python3 -m playwright install chromium webkit
python3 tests/browser/rune_mobile.py
cargo check --offline
```

Browser checks exercise the actual compiled Rune page in Chromium and WebKit:
touch actions, local save/restore across reloads, navigation, offline actions,
48px targets, and portrait/landscape layouts. They are not device or native
build tests. Native compilation and device profiling still require the SDKs
above. Template icons/splash screens and application identifiers are prototype
defaults; replace them before distribution.

## Runtime and performance decision

Start with build-time Rune compilation and this WebView adapter. It preserves
the existing Rune-Web language behavior and gets both platforms running from
one source. Capacitor's [workflow](https://capacitorjs.com/docs/basics/workflow)
copies built web assets into each native project.

The current engine still evaluates expression strings and rebuilds DOM content
on reactive renders. A native interpreter alone would not fix that rendering
cost. No performance improvement or 60fps claim is established by this prototype.

Recommended sequence, aligned with phases 3, 5 and 6 of the language roadmap:

1. Compile expressions/actions once into the shared AST/IR or direct JavaScript;
   batch state changes and update only affected UI. Preserve conformance across
   targets before adding a second execution engine.
2. Profile release builds on representative Android and iOS devices. Measure
   cold start, memory, input latency and p95 frame times (16.7ms at 60Hz), using
   real list/form workloads and existing games. Keep runtime and rendering costs
   separate. Browser emulation does not establish device performance.
3. Extract the headless core behind a presentation interface as phase 6.1
   describes. For games, evaluate a canvas renderer if DOM updates dominate.
4. If measured compute costs justify it, compile the shared IR into a small
   Rust core linked through JNI on Android and a C ABI/Swift on iOS, with batched
   event/state transfers. For truly native controls, add platform renderers using
   that same IR. Avoid a separate mobile grammar and per-property bridge calls.

A future native core should be a small mobile library, rather than linking the
current server runtime and database dependencies wholesale. AOT or a bundled
bytecode interpreter can avoid depending on runtime machine-code generation.
Keep application code bundled; any future downloaded-code feature needs its own
distribution design and review against [Apple's guidelines](https://developer.apple.com/app-store/review/guidelines/).

This prototype starts phase 6.2 with a WebView adapter; it does **not** complete
the headless-core extraction, native widget renderer, or AOT compiler.
