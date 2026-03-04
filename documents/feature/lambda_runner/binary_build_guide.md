# Lambda Binary Build Guide

Goal: produce a static Linux binary (`vectrune`) targeting `x86_64-unknown-linux-musl`, which is the architecture AWS Lambda uses for the provided.al2023 runtime. The packaging command (`vectrune lambda package`) expects you to hand this binary in via `--binary`.

## 1. Prerequisites
- Rust toolchain (stable) with `rustup`
- `musl` target installed: `rustup target add x86_64-unknown-linux-musl`
- On macOS (Apple Silicon or Intel): install `llvm` + `musl-cross` helpers
  ```bash
  brew install filosottile/musl-cross/musl-cross
  export CC_x86_64_unknown_linux_musl=x86_64-linux-musl-gcc
  ```
- On Linux: install `musl-tools` (Ubuntu/Debian) or equivalent
  ```bash
  sudo apt-get update && sudo apt-get install -y musl-tools
  export CC_x86_64_unknown_linux_musl=musl-gcc
  ```

## 2. Build Steps
```bash
# From repo root
rustup target add x86_64-unknown-linux-musl   # no-op if already installed
cargo build --release --target x86_64-unknown-linux-musl
mkdir -p dist
cp target/x86_64-unknown-linux-musl/release/vectrune dist/vectrune-lambda
```

### Optional: Strip & Compress
```bash
strip dist/vectrune-lambda
# Inspect size after stripping (goal: < 15 MB)
ls -lh dist/vectrune-lambda
```

## 3. Validate the Binary
- Confirm target triple:
  ```bash
  file dist/vectrune-lambda
  # Expect: ELF 64-bit LSB executable, x86-64, dynamically linked (uses musl), statically linked, etc.
  ```
- Ensure it runs under Docker Lambda base image:
  ```bash
  docker run --rm -v "$PWD/dist:/opt" public.ecr.aws/lambda/provided:al2023 /opt/vectrune-lambda --version
  ```

## 4. Feed into the Packager
Once the binary exists, pass it to the CLI:
```bash
vectrune lambda package \
  --binary dist/vectrune-lambda \
  --rune examples/book_graphql.rune \
  --mode zip \
  --output dist/book-api-lambda.zip
```

## 5. Troubleshooting
- **Linker errors**: ensure `CC_x86_64_unknown_linux_musl` points to a musl-compatible GCC.
- **Missing OpenSSL / TLS**: runtime uses `reqwest` + `rustls`, so no glibc/OpenSSL dependency required.
- **Binary too large (>50 MB)**: run `strip`, remove debug symbols, or switch to container mode with `--mode container`.
