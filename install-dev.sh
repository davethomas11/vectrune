#!/bin/zsh
# install-dev.sh: Build and install vectrune from the local project for zsh users

set -e

# Build vectrune in release mode
cargo build --release

# Ensure ~/.local/bin exists
mkdir -p "$HOME/.local/bin"

# Symlink the built binary to ~/.local/bin/vectrune
ln -sf "$PWD/target/release/vectrune" "$HOME/.local/bin/vectrune"

# Print instructions for PATH management
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
  echo "\nAdd the following to your ~/.zshrc to use the dev vectrune:"
  echo 'export PATH="$HOME/.local/bin:$PATH"'
fi

# Show installed version
~/.local/bin/vectrune --version || echo "Vectrune installed, but could not run --version. Check build."

echo "\nDev vectrune installed to ~/.local/bin/vectrune. This will override Homebrew if ~/.local/bin is earlier in PATH."

