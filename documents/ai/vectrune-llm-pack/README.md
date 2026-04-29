# Vectrune LLM Pack

This directory is a starter AI-facing export derived from the shared knowledge source in `knowledge/`.

## Purpose

The pack is intended to help AI systems quickly learn:
- core Vectrune concepts
- common builtins and their side effects
- runtime context behavior
- app/runtime types
- curated, high-signal examples from the repository

## Relationship to `knowledge/`

`knowledge/` is the source-of-truth explainer/reference layer.
This pack is a downstream export snapshot intended for retrieval, prompting, and future AI tooling.

## Included files

- `manifest.yaml` — inventory of the pack contents and upstream sources
- `builtins.json` — starter builtin reference export
- `runtime-context.json` — runtime context and lookup behavior export
- `app-types.json` — app/runtime type export
- `examples.jsonl` — curated example records for retrieval and prompting

## Maintenance

When user-facing language/runtime behavior changes:
1. update `knowledge/` first
2. refresh the relevant pack files here
3. keep examples and tests aligned

## Scope note

This is a starter pack, not yet a full generated pipeline.
It is intentionally small and hand-curated so it stays easy to review while the content model stabilizes.
