# Knowledge Maintenance Guide

This file defines how contributors and AI assistants should maintain the shared Vectrune knowledge source under `knowledge/`.

## What this knowledge layer is for

`knowledge/` is meant to become the common content source for:
- AI retrieval and prompting
- generated reference exports
- the human docs site and related static docs assets

## Update triggers

Review and update `knowledge/` whenever a change affects:
- parser behavior or `.rune` syntax
- runtime evaluation semantics
- builtin names, aliases, inputs, outputs, or side effects
- path resolution rules
- request/runtime context values such as `body`, `path.params`, `id`, or `___last_exec_result___`
- REST, GraphQL, WebSocket, frontend/static, or Lambda app behavior
- CLI commands, flags, defaults, or environment variables
- examples users are expected to copy
- Swagger/OpenAPI output or docs generation behavior

## Minimum task checklist

Before closing a user-facing feature task:
1. Find the relevant source behavior in `src/`
2. Check whether tests/examples already capture it
3. Check `product/mass-adoption.md` if the task affects onboarding, trust, examples, or developer workflow fit
4. Update one or more files in `knowledge/`
5. Update `knowledge/manifest.yaml` if you add a new page or reference file
6. Add or update tests if behavior changed
7. If docs-site wording or nav should change, update or queue follow-up work in `language/docs/`
8. If the task changes adoption priorities or initiative planning, update `documents/feature/growth_backlog/`

## Authoring rules

- Prefer concise, factual statements over marketing copy
- Include source anchors or file references where practical
- State limitations clearly if support is partial or evolving
- Use small, composable pages instead of large duplicated explanations
- Prefer examples already validated by tests or the `examples/` directory
- Keep structured reference files deterministic and easy to diff

## Canonical evidence order

Use this order when deciding what is true:
1. `src/`
2. `tests/`
3. `examples/`
4. `knowledge/`
5. `language/docs/`

If any downstream docs disagree with runtime behavior, update `knowledge/` first and then reconcile the rendered docs.

## Starter content map

- `product/overview.md` — high-level positioning and capability summary
- `product/mass-adoption.md` — product strategy lens for onboarding, trust, and growth priorities
- `language/core-language.md` — language model, section syntax, evaluation model, and examples
- `runtime/cli.md` — CLI behavior and command surface
- `reference/builtins.yaml` — structured builtin catalog starter
- `reference/runtime-context.yaml` — runtime variables and path lookup behavior
- `reference/app-types.yaml` — supported app/runtime types

Related planning docs outside `knowledge/`:
- `documents/feature/growth_backlog/feature_plan.md` — prioritized adoption initiatives
- `documents/feature/growth_backlog/user_stories.md` — user-story view of adoption work

## Good change patterns

### Example: builtin behavior change
If `log` gains placeholder expansion:
- update `reference/builtins.yaml`
- update `reference/runtime-context.yaml` if lookup behavior changed
- add or update tests
- add a note/example in `language/core-language.md` if users should write code differently

### Example: new CLI flag
If `vectrune` gets a new CLI flag:
- update `runtime/cli.md`
- update examples if the flag changes common workflows
- update `manifest.yaml` only if a new page/reference file is introduced

### Example: docs generation change
If Swagger/OpenAPI output changes:
- update the relevant runtime/reference knowledge files
- update or queue matching human docs changes under `language/docs/`
- make sure an example or test demonstrates the new behavior

## Done criteria

A change with public user impact is not complete until the relevant `knowledge/` files have been reviewed and updated.
