# Vectrune Knowledge Source

This directory is the canonical, repo-owned knowledge layer for Vectrune.

It is intended to support two downstream consumers:
1. AI assistants and retrieval pipelines
2. Human-facing documentation, including the docs site

## Goals

- Keep public language/runtime behavior documented close to the codebase
- Reduce drift between examples, tests, AI prompts, and docs pages
- Make Vectrune easier to teach to both humans and AI systems
- Support future generation of docs-site assets from structured reference data

## Structure

- `manifest.yaml` — inventory of pages/reference data and their purpose
- `agents/maintenance.md` — detailed maintenance rules for AI and contributors
- `product/` — high-level product framing and capability overview
- `language/` — syntax and runtime language semantics
- `runtime/` — CLI and execution behavior
- `examples/` — curated teaching examples and example guidance
- `reference/` — structured reference files for builtins, app types, runtime context, and related concepts

## Strategy and backlog ownership

- `product/overview.md` captures the high-level framing for what Vectrune is and where it is currently focused.
- `product/mass-adoption.md` captures the current strategy lens for making Vectrune easier to adopt.
- `documents/feature/growth_backlog/` holds execution-oriented backlog notes that can evolve faster than the canonical knowledge pages.

Keep stable product framing in `knowledge/` and keep initiative-level planning in `documents/feature/`.

## Source-of-truth workflow

Use this flow when making public changes:

```text
src/ + tests/ + examples/ -> knowledge/ -> docs site + AI pack
```

That means:
- runtime and tests define real behavior
- `knowledge/` captures the canonical explainer/reference layer
- generated or static docs should follow `knowledge/`, not drift independently

## Downstream exports

The starter AI export pack lives under:

- `documents/ai/vectrune-llm-pack/`

The docs site may also consume generated JSON assets under:

- `language/docs/data/`

The current refresh command is:

- `vectrune knowledge export`

That export should be treated as a downstream artifact derived from `knowledge/`.
When you update concepts, examples, or reference behavior here, make sure the export pack is refreshed as part of the same work when relevant.

## Current status

This is a starter implementation.
It intentionally focuses on the highest-value concepts first:
- what Vectrune is
- core language model
- CLI surface area
- app types
- runtime context
- common builtins
- curated starter examples

It can be expanded incrementally as features evolve.
