#!/usr/bin/env bash
set -euo pipefail

# Build the same small ALSA library for each release ABI, including static musl.
target="${1:?Expected a Rust Linux target}"
case "$target" in
  x86_64-unknown-linux-gnu) host=x86_64-linux-gnu; zig_target=x86_64-linux-gnu.2.28 ;;
  x86_64-unknown-linux-musl) host=x86_64-linux-musl; zig_target=x86_64-linux-musl ;;
  aarch64-unknown-linux-gnu) host=aarch64-linux-gnu; zig_target=aarch64-linux-gnu.2.28 ;;
  armv7-unknown-linux-gnueabihf) host=arm-linux-gnueabihf; zig_target=arm-linux-gnueabihf.2.28 ;;
  *) echo "Unsupported Linux audio target: $target" >&2; exit 1 ;;
esac
plugindir="/usr/lib/$host/alsa-lib"
if [[ "$target" == *musl ]]; then
  plugindir=/usr/lib/alsa-lib
fi

root="$(pwd)/target/linux-audio/$target"
mkdir -p "$root"
archive="$root/alsa-lib-1.2.14.tar.bz2"
curl --fail --location --silent --show-error \
  https://www.alsa-project.org/files/pub/lib/alsa-lib-1.2.14.tar.bz2 -o "$archive"
echo "be9c88a0b3604367dd74167a2b754a35e142f670292ae47a2fdef27a2ee97a32  $archive" |
  shasum -a 256 --check
tar -xjf "$archive" -C "$root"
prefix="$root/install"
(
  cd "$root/alsa-lib-1.2.14"
  CC="zig cc -target $zig_target" AR="zig ar" RANLIB="zig ranlib" CFLAGS="-Os -fPIE" \
    ./configure --host="$host" --prefix="$prefix" --libdir="$prefix/lib" \
    --disable-shared --enable-static --disable-python \
    --with-configdir=/usr/share/alsa --with-plugindir="$plugindir"
  make -j2
  make -C src install-libLTLIBRARIES
  make -C include install
)

# alsa-sys asks pkg-config for dynamic flags. The directory contains only .a;
# include its private dependencies explicitly so that musl remains self-contained.
mkdir -p "$prefix/lib/pkgconfig"
cat > "$prefix/lib/pkgconfig/alsa.pc" <<EOF
prefix=$prefix
libdir=\${prefix}/lib
includedir=\${prefix}/include
Name: alsa
Description: ALSA release audio backend
Version: 1.2.14
Libs: -L\${libdir} -lasound -lm -lpthread -ldl
Cflags: -I\${includedir}
EOF

zig cc -target "$zig_target" -I "$prefix/include" tests/terminal/alsa_backend.c \
  "$prefix/lib/libasound.a" -lm -lpthread -ldl -o "$root/audio-backend-check"
