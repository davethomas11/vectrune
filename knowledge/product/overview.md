# Vectrune Overview

Vectrune is a small DSL and runtime for structured data, HTTP applications, automation, and data transformation.

## Positioning

Vectrune combines:
- a declarative `.rune` document format
- a lightweight execution model for route handlers and workflows
- a runtime with builtins for IO, validation, memory, and response handling
- app hosting modes such as REST, GraphQL, WebSocket, static frontend hosting, and AWS Lambda packaging/runtime support

## What users do with it today

Common use cases in this repository include:
- building REST APIs from `.rune` route definitions
- serving GraphQL APIs
- working with CSV and JSON-backed data flows
- using schema validation in request handlers
- packaging Vectrune apps for AWS Lambda
- building interactive or stateful examples such as worm-game style flows

## Product mental model

At a high level, users:
1. write a `.rune` file with sections such as `@App`, `@Route`, and `@Schema`
2. run it with the `vectrune` CLI or package it for another runtime
3. rely on the Vectrune runtime to populate context like `body` or `path.params`
4. compose builtin commands inside `run:` blocks to produce responses or mutate state

## Current capability areas

- Core language: sections, kv pairs, series, records, inline objects, inline lists
- Runtime/context: assignment, path resolution, arithmetic, conditional execution, builtin dispatch
- App types: REST, GraphQL, WebSocket, static/frontend hosting, Lambda-oriented deployment paths
- CLI: script execution, transform/calculate/merge helpers, AI prompt integration, Lambda/SAM tooling
- Utilities: logging, validation, CSV/JSON IO, memory helpers, docs generation hooks

## Important limits of this page

This page is a high-level orientation only.
For behavior details, prefer the focused pages and structured reference files in this directory:
- `../language/core-language.md`
- `../runtime/cli.md`
- `../reference/builtins.yaml`
- `../reference/runtime-context.yaml`
- `../reference/app-types.yaml`
