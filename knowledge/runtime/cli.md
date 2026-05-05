# Vectrune CLI Runtime

This page summarizes the current CLI surface visible from `src/main.rs` and user-facing docs.

## Primary usage

Common entrypoints include:
- `vectrune <script.rune>`
- `vectrune -` to read a script from STDIN
- `vectrune <script.rune> --calculate <expr>`
- `vectrune <script.rune> --transform <spec>`
- `vectrune <script.rune> --merge-with <spec>`
- `vectrune --ai <prompt>`

## Common flags

Current top-level flags include:
- `-i`, `--input` — input format
- `-o`, `--output` — output format
- `--calculate` — run a calculation expression
- `--transform` — run a transform expression
- `--merge-with` — merge another input/document
- `-l`, `--log-level` — set log level
- `--ai` — send a prompt to local AI integration
- `--model` — select the model for `--ai`
- `--host` — override app host for server runtimes
- `-p`, `--port` — override app port for server runtimes

## Rune file loading behavior

For Rune input, the CLI now performs an import-aware pre-parse load step.

Current behavior:
- a script path may point to a single `.rune` file or a directory of `.rune` files
- top-level `import "..."` declarations inside Rune files are resolved before parsing
- imported directories load direct child `.rune` files in sorted filename order
- imports are resolved relative to the importing file
- when sections overlap, imported content is merged first and the importing file is merged after it

## Output formats

The current CLI parser advertises these output format values:
- `text`
- `json`
- `rune`
- `xml`
- `yaml`
- `curl`

## Lambda subcommands

Current lambda tooling includes:
- `vectrune lambda launch`
- `vectrune lambda package`

The package command includes options such as:
- `--rune`
- `--config`
- `--binary`
- `--mode` (`zip` or `container`)
- `--output`
- `--image-name`

## SAM subcommands

Current SAM tooling includes:
- `vectrune sam generate`
- `vectrune sam local`

## Knowledge subcommands

Current knowledge tooling includes:
- `vectrune knowledge export`

This command regenerates starter docs and AI export artifacts from `knowledge/` into:
- `language/docs/data/`
- `documents/ai/vectrune-llm-pack/`

Optional usage:
- `vectrune knowledge export --root <workspace-path>`

Use this command after updating shared knowledge/reference files so the served docs data and AI pack stay aligned.

## AI integration notes

The repository README currently describes environment variables for AI integration:
- `VECTRUNE_OLLAMA_URL`
- `VECTRUNE_AI_MODEL`

These should stay aligned with the runtime implementation and user guidance.

## Docs maintenance notes

When CLI behavior changes:
- update this page
- update examples in `README.md` or `examples/` if common workflows changed
- update `language/docs/` if public docs nav or wording should change
- add tests for changed parsing/default behavior where practical
