# Mass Adoption Strategy

This page captures the current product strategy for taking Vectrune toward mass adoption while the language and runtime continue to evolve.

## Strategy summary

Vectrune aims to become easy to learn, easy to trust, and easy to ship for common real-world application workflows.

Near-term decisions should favor:
- a fast time-to-first-success for new users
- readable `.rune` files and generated output
- predictable runtime behavior and safe defaults
- examples and templates users can copy into real projects
- low-friction setup across common developer environments

## Target users

Current priority users:
- developers who want to build a small API quickly
- teams building internal tools or prototypes with structured data flows
- users evaluating a declarative alternative to hand-written server boilerplate
- early adopters exploring Vectrune for small frontend or full-stack experiments

## Core jobs to win

Vectrune should become meaningfully good at these jobs before expanding further:
1. define and run a useful REST API quickly
2. validate input and shape output with minimal boilerplate
3. connect simple data sources such as JSON or CSV-backed flows
4. inspect generated docs or output with confidence
5. evolve from a starter example into a small real project without rewriting everything

## Primary adoption wedge

The primary wedge is fast, clear API development.

Why this comes first:
- the value is easy to explain
- first success is measurable in minutes
- examples stay compact and teachable
- generated Swagger/OpenAPI and predictable route behavior increase trust

Secondary wedge:
- small interactive Rune-Web apps that demonstrate the same clarity benefits on the frontend

Later wedge:
- deployment-oriented serverless and Lambda workflows once the onboarding and runtime stories are simpler

## Adoption blockers to reduce

Current blocker themes to watch:
- unclear setup or too many ways to get started
- syntax or runtime behavior that feels surprising
- examples that are impressive but not reusable
- missing editor support or weak syntax highlighting
- generated output that is hard to inspect or trust
- docs that explain features without showing the fastest workflow

## Product principles for adoption

Prefer:
- obvious over clever
- consistent over highly flexible
- one blessed path over many partial paths
- copy-pasteable examples over abstract explanations
- readable generated output over opaque internals
- gradual teaching flow over large conceptual dumps

Avoid:
- niche optimizations that complicate the common path
- syntax sugar that increases ambiguity
- public features without examples and docs
- hidden runtime behavior that new users cannot predict

## Priority themes

### P0: onboarding and first success
- sharpen the main README around a 5-minute success path
- curate a short list of starter examples
- keep install and run steps simple and copyable
- improve error messages and setup guidance

### P1: trust and reuse
- make generated output and runtime behavior easier to inspect
- strengthen safe defaults
- provide realistic templates users can extend
- tighten docs around expected workflows and constraints

### P2: distribution and environment fit
- strengthen VS Code and IntelliJ support
- improve syntax highlighting across platforms where possible
- document common local workflows clearly for Windows, macOS, and Linux
- make examples easy to clone, run, and adapt

### P3: feedback loops and community growth
- turn polished examples into shareable tutorials
- add comparison content such as when to use Vectrune
- collect issues from onboarding friction and convert them into backlog items
- create a repeatable loop between examples, docs, and future teaching assets

## How to use this page

Use this page when deciding:
- which feature direction is easiest for new users to understand
- which docs or examples should be polished next
- whether a workflow supports adoption or adds avoidable friction
- what to prioritize when multiple valid improvements are available

Execution-oriented backlog details live under `documents/feature/growth_backlog/`.

