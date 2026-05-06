# Copilot Instructions for Vectrune

## Product vision

Vectrune aims for mass adoption. Favor decisions that make the product easier to learn, easier to trust, and easier to ship in real projects.

When multiple valid options exist, prefer the one that most improves:
- clarity of the `.rune` language and generated output
- onboarding speed for new users
- reliability, predictability, and safe defaults
- documentation quality, examples, and copy-paste workflows
- low-friction setup across common developer environments

Avoid unnecessary complexity, surprising behavior, and niche optimizations that make the core experience harder to understand or adopt.

## Knowledge base maintenance is required

Vectrune now has a shared knowledge source under `knowledge/` intended to power both:
- AI-facing retrieval/reference material
- the human docs site and future generated docs assets

When you make a change that affects public behavior, you must update the relevant files in `knowledge/` as part of the same task.

## Changes that require knowledge updates

Update `knowledge/` whenever a change affects any of the following:
- `.rune` language syntax or semantics
- builtins, aliases, argument behavior, or side effects
- request/runtime context behavior such as `body`, `path.params`, placeholder expansion, or `___last_exec_result___`
- app types such as REST, GraphQL, WebSocket, frontend/static hosting, or Lambda behavior
- CLI flags, subcommands, defaults, or examples
- generated documentation behavior, Swagger/OpenAPI behavior, or schema expectations
- examples or recommended workflows that users should copy

## Minimum update checklist

When shipping a feature or behavior change:
1. Update the relevant source file(s) in `knowledge/`
2. Update `knowledge/manifest.yaml` if a new concept/page/reference file is added
3. Add or update at least one example or note when the feature changes user workflows
4. If the change affects public docs wording or navigation, update or queue changes for `language/docs/`
5. If behavior changed, add or update tests

## Source-of-truth policy

Prefer this order when documenting behavior:
1. runtime behavior in `src/`
2. tests in `tests/`
3. examples in `examples/`
4. knowledge source in `knowledge/`
5. rendered/static docs in `language/docs/`

If you find a mismatch, fix `knowledge/` first, then update downstream docs.

## Authoring guidance

- Keep `knowledge/` concise, factual, and source-linked
- Prefer stable concept pages over duplicating the same explanation in many places
- When behavior is partial or evolving, label it clearly instead of overstating support
- Include examples for user-facing features whenever possible
- Keep AI-oriented files structured and easy to diff

## Important files

- `knowledge/README.md`
- `knowledge/manifest.yaml`
- `knowledge/agents/maintenance.md`
- `knowledge/product/overview.md`
- `knowledge/language/core-language.md`
- `knowledge/runtime/cli.md`
- `knowledge/reference/`

## Local machine overrides

Machine-specific paths and environment details must stay out of the public repo.

- If present, consult `.github/copilot-local.md` for local-only overrides before falling back to generic setup assumptions.
- Treat `.github/copilot-local.md` as optional, higher priority than generic environment guesses, and never commit its machine-specific contents.
- Use `.github/copilot-local.example.md` as the tracked template for the expected format.
- Current intended use: local tool paths such as an explicit Windows `cargo.exe` path for this workstation.

## Done criteria

A task that changes public Vectrune behavior is not complete until the corresponding knowledge files have been reviewed and updated.
