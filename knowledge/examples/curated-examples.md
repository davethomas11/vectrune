# Curated Examples

These examples are the first recommended teaching set for both humans and AI systems.

They were chosen because they are small, high-signal, and already connected to existing docs, tests, or common workflows.

## 1. Minimal REST app

- Source: `examples/app.rune`
- Why it matters:
  - smallest complete `@App` + `@Route` example
  - shows `run:` blocks, `log`, `parse-json`, and `respond`
  - good first example for route-oriented teaching

Use this example when explaining:
- what a Vectrune app looks like
- how REST routes are declared
- how builtins are used in steps

## 2. Structured data document

- Source: `examples/skateboarders.rune`
- Why it matters:
  - simplest example of sectioned data records
  - useful for parser/AST explanations and CLI transform/calculate workflows
  - low cognitive overhead for new users

Use this example when explaining:
- records and repeated data entries
- data extraction and transformation workflows
- section-based data modeling

## 3. REST API with schemas and path params

- Source: `examples/user_api.rune`
- Why it matters:
  - demonstrates `@Schema`, multiple REST routes, CRUD-style patterns, and request validation
  - shows `parse-json`, CSV storage, `path.params`, and route logging
  - currently includes Swagger-oriented configuration

Use this example when explaining:
- schema-backed request handling
- request body parsing and validation
- path parameter lookup
- route definitions for GET/POST/PUT/DELETE flows

## 4. GraphQL + memory-backed state

- Source: `examples/book_graphql.rune`
- Why it matters:
  - demonstrates GraphQL queries and mutations
  - uses `@Memory` data, `memory.get`, `memory.append`, `books.max`, and object creation
  - connects to Lambda packaging examples and tests in this repository

Use this example when explaining:
- GraphQL app shape in Vectrune
- in-memory data workflows
- mutation logic and derived IDs

## Selection guidance

When expanding this curated set, prefer examples that are:
- referenced by tests
- small enough to teach one or two concepts clearly
- representative of real user workflows
- stable relative to the current runtime implementation

## Suggested next additions

Once the starter set is stable, likely next candidates are:
- memory-oriented REST examples
- websocket/game-state examples such as worm-game
- auth examples
- datasource examples
