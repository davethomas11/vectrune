# Rune Mobile Web (source-build prototype)

`@Frontend type = rune-mobile-web` compiles through the existing Rune-Web
compiler and runtime. Capacitor packages the HTML/JavaScript into Android
WebView or iOS WKWebView; the device contains no Rust compiler or HTTP backend.
`rune-mobile` remains reserved for a future native runtime, not a supported target.

```sh
cargo build --bin vectrune
target/debug/vectrune examples/rune_mobile_web --build android
# macOS with Xcode:
target/debug/vectrune examples/rune_mobile_web --build ios
# Export without Node, SDKs or signing credentials:
target/debug/vectrune examples/rune_mobile_web --export ios --build-dir ./mobile-project
```

Builds require Node.js 22+/npm plus JDK 21 and Android SDK 36 for Android,
or macOS/Xcode 26+ for iOS. Minimum device targets are Android API 24 and iOS 15.
Build dependencies need network access; bundled UI/actions can operate offline.
Remote APIs and server-side Rune routes do not become offline device services.

Android output is a debug APK; iOS output is an unsigned Simulator `.app`, not
a device IPA. Signing, device builds and store publication are manual native IDE
workflows. The template application ID is `com.vectrune.mobileweb`; change it
in an editable export before distributing your own app.

`--build-dir` defaults to `<source directory>/.vectrune/rune-mobile-web`.
`--build <platform> --prepare-only` generates compiled HTML and native templates
without invoking dependency installation or SDK tools. Ordinary generated builds
replace templates on rebuild. `--export` marks the directory as editable and
refuses regeneration to preserve native changes/signing settings. Nonempty
unmarked directories are never overwritten.

Mobile build/export flags cannot combine with desktop/pixel targets, secondary
apps, watch mode or data-output operations. `-o html` supports mobile frontends;
browser REST previews use the existing Rune-Web router. `viewport-fit=cover`
enables safe-area CSS in generated mobile HTML.

The prototype's counter demo covers touch targets, navigation, local storage,
offline actions and portrait/landscape layout in Chromium and WebKit.
The CI Android setup requests `platform-tools`, not the removed legacy `tools`
package. Native artifact verification still depends on platform CI/toolchains.
Linux CI also installs ALSA development headers required by the current CLI's
shared audio backend.

Sources: `src/cli/mobile_web.rs`, `src/cli/mobile_web_templates.rs`,
`runtime/rune-mobile-web/README.md`, `tests/mobile_web_cli.rs`,
`tests/browser/rune_mobile_web.py`, `.github/workflows/mobile.yml`.
