#!/bin/bash
# release-bump.sh: Bump version, commit, and tag for Vectrune
# Usage: ./release-bump.sh <new_version>
# Example: ./release-bump.sh 0.1.5

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <new_version>"
  exit 1
fi

NEW_VERSION="$1"
CARGO_FILE="Cargo.toml"

# Update version in Cargo.toml
sed -i.bak "s/^version = \"[0-9.]*\"/version = \"$NEW_VERSION\"/" "$CARGO_FILE"
rm -f "$CARGO_FILE.bak"

echo "Version bumped to $NEW_VERSION in $CARGO_FILE."

git add "$CARGO_FILE"
git commit -m "chore: bump version to $NEW_VERSION"
git tag "v$NEW_VERSION"

echo "Committed and tagged v$NEW_VERSION. Push with: git push && git push --tags"
