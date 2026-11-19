# Vectrune contributor notes

Follow [CONTRIBUTING.md](CONTRIBUTING.md) and the [knowledge maintenance guide](knowledge/agents/maintenance.md).

## Public features and docs

- Start from runtime behavior, tests, and a runnable example. Update the relevant `knowledge/` guide in the same change. Add new guides to `knowledge/manifest.yaml`.
- Maintain `knowledge/reference/library.json` for public syntax, configuration, and runtime availability. Maintain `knowledge/reference/api-docs.json` for the teaching site’s API walkthroughs. The reference build also reads CLI help and the native registry, so update their sources when behavior changes.
- For teaching site changes, check `teaching_website/parts/pages/`, navigation and SEO, and the English, Spanish, and French bundles. A published game needs an entry in `teaching_website/build_site.py` so the embedded preview and standalone page use the same origin and save data.

## Offline manuals

The website and manuals share `teaching_website/reference_inventory.py`. The manual launcher reads the actual binary's version and CLI help. `teaching_website/generate_man_pages.vect` renders the two roff pages. Update the reference sources or generator and regenerate the output rather than editing packaged pages.

```sh
cargo build --bin vectrune
python3 teaching_website/build_man_pages.py --binary target/debug/vectrune --output dist/manuals/man
python3 tests/browser/test_man_pages.py
```

The release workflow builds the manuals with the release binary and includes `man/man1/vectrune.1` and `man/man7/vectrune-language.7` in every platform archive. This started in v0.3.7 (commit `0da38e0`). The later portable syntax and persistence release is documented in [v0.3.9](docs/releases/v0.3.9.md).

## Preparing a release

1. Use the requested version and inspect the changes since the latest published tag. Record user-visible changes and compatibility notes in `docs/releases/v<VERSION>.md`.
2. Update the package version in `Cargo.toml` and the version and localized release copy in `teaching_website/release.json`. Run `python3 teaching_website/release_metadata.py --write` and commit the generated Rune file with them. The site’s heading, navigation, copy, and tag link derive from this metadata. For local version bumps, the shell and PowerShell bump scripts can generate and stage these files after you prepare the JSON and notes.
3. Build the site with the candidate binary and inspect the release page in each locale. Run the teaching build, reference inventory, and manual tests. Verify the feature’s relevant tests and the GitHub Linux, Windows, and Intel macOS checks for the candidate commit.
4. After review, merge the candidate into `main`, which triggers the GitHub Pages deployment. Push only the intended `v<VERSION>` tag on the approved release commit when authorized. The release workflow validates the JSON, package version, and tag, and builds the archives before publishing and notifying the Homebrew tap.
5. Verify the public site, GitHub release assets, and Homebrew workflow so build success alone does not get reported as publication.

For a local site build, use `python3 teaching_website/build_site.py --binary target/debug/vectrune --output _site`. Release metadata tooling requires Python 3.11 or newer.
