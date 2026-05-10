#!/bin/bash
# release-bump.sh: Bump version, commit, and tag for Vectrune
# Usage:
#   ./release-bump.sh <new_version>
#   ./release-bump.sh --major
#   ./release-bump.sh --minor
#   ./release-bump.sh (no args: patch bump)
# Example: ./release-bump.sh 0.1.5

set -e

CARGO_FILE="Cargo.toml"

# Extract current version from Cargo.toml
CUR_VERSION=$(grep '^version = "' "$CARGO_FILE" | head -1 | sed -E 's/version = "([0-9]+\.[0-9]+\.[0-9]+)"/\1/')
if [[ ! $CUR_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Could not parse current version from $CARGO_FILE"
  exit 1
fi

# Parse args
MODE="patch"
NEW_VERSION=""
if [ $# -eq 0 ]; then
  MODE="patch"
elif [ "$1" == "--major" ]; then
  MODE="major"
elif [ "$1" == "--minor" ]; then
  MODE="minor"
else
  NEW_VERSION="$1"
fi

# Bump version if needed
if [ -z "$NEW_VERSION" ]; then
  IFS=. read -r MAJOR MINOR PATCH <<< "$CUR_VERSION"
  case "$MODE" in
    major)
      ((MAJOR++)); MINOR=0; PATCH=0;;
    minor)
      ((MINOR++)); PATCH=0;;
    patch)
      ((PATCH++));;
  esac
  NEW_VERSION="$MAJOR.$MINOR.$PATCH"
fi

# Check that NEW_VERSION > CUR_VERSION
verlte() { [ "$1" = "$2" ] && return 0 || [  "$(printf '%s\n' "$1" "$2" | sort -V | head -n1)" = "$1" ]; }
vergte() { [ "$1" = "$2" ] && return 0 || [  "$(printf '%s\n' "$1" "$2" | sort -V | tail -n1)" = "$1" ]; }
if verlte "$NEW_VERSION" "$CUR_VERSION"; then
  echo "Error: New version $NEW_VERSION must be greater than current $CUR_VERSION"
  exit 1
fi

# Update version in Cargo.toml - ONLY in [package] section
# Use awk to find and replace only the first `version =` line after [package]
awk '
BEGIN { in_package = 0; version_updated = 0 }
/^\[package\]/ { in_package = 1 }
/^\[/ && !/^\[package\]/ && in_package { in_package = 0 }
in_package && /^version = "/ && !version_updated {
  print "version = \"'"$NEW_VERSION"'\""
  version_updated = 1
  next
}
{ print }
' "$CARGO_FILE" > "$CARGO_FILE.tmp"
mv "$CARGO_FILE.tmp" "$CARGO_FILE"

echo "Version bumped from $CUR_VERSION to $NEW_VERSION in $CARGO_FILE."

git add "$CARGO_FILE"
git commit -m "chore: bump version to $NEW_VERSION"
git tag "v$NEW_VERSION"

echo "Committed and tagged v$NEW_VERSION. Push with: git push && git push --tags"
