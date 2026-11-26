# Native audio builds

ASCII Animator and desktop games share the bounded PCM mixer in
`src/apps/pixel/native_audio.rs`, with CPAL for system output. Default native
builds include terminal tones; the desktop window feature remains opt-in.
Headless tests, ASCII `--plain`, and `--mute` never open an audio device.

Linux source builds need ALSA headers (`libasound2-dev` on Debian/Ubuntu or
`alsa-lib-devel` on Fedora). macOS and Windows use system audio APIs.

## Portable Linux releases

`.github/scripts/build-linux-audio.sh` builds unmodified ALSA 1.2.14, verified
by SHA-256, using Zig 0.14.1 for the release target. The release links that static
library rather than requiring target-specific ALSA development packages.
GNU targets use a glibc 2.28 baseline. The static musl build cannot load external
ALSA plugins; plugin-only device configurations may need the GNU build or
`--mute`. A working output device and ALSA runtime configuration are still needed.
GNU release builds search Debian-style multiarch plugin directories; on systems
using another location, set `ALSA_PLUGIN_DIR` to that directory (for example,
`/usr/lib64/alsa-lib` on Fedora). Source builds against the system ALSA library
use that distribution's normal paths.

ALSA is LGPL-2.1-or-later. Linux binary archives include its license and this
notice. The same release supplies `vectrune-audio-source.zip`, containing the
Vectrune source snapshot, resolved Cargo lockfile, and original ALSA source
archive so the application can be rebuilt with a modified ALSA library.
Vectrune's own source remains MIT licensed.

## Rebuilding or replacing the Linux audio library

Extract `vectrune-audio-source.zip`, then extract `vectrune-source.tar` into a
working directory and copy the supplied `Cargo.lock` there. Install Rust,
Node.js, pkg-config, make, Zig 0.14.1, and cargo-zigbuild. From that directory:

```sh
rustup target add x86_64-unknown-linux-musl
cd runtime/rune-web
npm ci
npm run build
cd ../..
bash .github/scripts/build-linux-audio.sh x86_64-unknown-linux-musl
export PKG_CONFIG_ALLOW_CROSS=1
export PKG_CONFIG_LIBDIR="$PWD/target/linux-audio/x86_64-unknown-linux-musl/install/lib/pkgconfig"
cargo zigbuild --release --locked --target x86_64-unknown-linux-musl
```

To change ALSA, modify the extracted source under
`target/linux-audio/<target>/alsa-lib-1.2.14`, run `make`,
`make -C src install-libLTLIBRARIES` and `make -C include install` there,
and rerun the Cargo command (clean the `alsa-sys` package first if rebuilding
an existing binary). Do not rerun the dependency script after modifying its
source: it downloads and extracts the original release again.

Alternatively, build a modified ALSA library into your own prefix and point
`PKG_CONFIG_LIBDIR` at its `alsa.pc`. For a static library, include its private
`-lm -lpthread -ldl` dependencies in `Libs`, as the release script does.
