# Curated Examples

These examples are the first recommended teaching set for both humans and AI systems.

They were chosen because they are small, high-signal, and already connected to existing docs, tests, or common workflows.

## 1. Minimal REST app

- Source: `examples/beginner/app.rune`
- Why it matters:
  - smallest complete `@App` + `@Route` example
  - shows `run:` blocks, `log`, `parse-json`, and `respond`
  - good first example for route-oriented teaching

Use this example when explaining:
- what a Vectrune app looks like
- how REST routes are declared
- how builtins are used in steps

## 2. Structured data document

- Source: `examples/beginner/skateboarders.rune`
- Why it matters:
  - simplest example of sectioned data records
  - useful for parser/AST explanations and CLI transform/calculate workflows
  - low cognitive overhead for new users

Use this example when explaining:
- records and repeated data entries
- data extraction and transformation workflows
- section-based data modeling

## 3. REST API with schemas and path params

- Source: `examples/api/user_api.rune`
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

- Source: `examples/api/book_graphql.rune`
- Why it matters:
  - demonstrates GraphQL queries and mutations
  - uses `@Memory` data, `memory.get`, `memory.append`, `books.max`, and object creation
  - connects to Lambda packaging examples and tests in this repository

Use this example when explaining:
- GraphQL app shape in Vectrune
- in-memory data workflows
- mutation logic and derived IDs

## 5. WebSocket worm game

- Source: `examples/games/worm_game/worm_game.rune`
- Companion: `examples/games/worm_game/assets/index.html`
- Why it matters:
  - demonstrates `@Websocket` and `@Event` flow with JSON message dispatch
  - shows `json.read`, `ws.id`, `ws.send`, `ws.broadcast`, memory-backed state, and bracket-path mutation
  - now includes rotating player colors, score display, and growth capped at 10 segments

Use this example when explaining:
- websocket event routing
- real-time shared state updates
- syncing frontend UI with authoritative runtime state
- simple gameplay/state-machine patterns in `.rune`

## 6. Portable object syntax across hosts

- Sources: `examples/language/objects/objects.vect`, `objects-api.rune` and
  `objects-web.rune` in the same folder.
- Instructions and expected results: `examples/language/objects/README.md`.
- Demonstrates `{ name, score }` shorthand, replication and grid generators,
  local templates, `with`/`all` overlays, nested `[]id` lookups and compound updates.
- Shows that copies have independent nested data and only the first matching ID
  changes. Missing IDs leave the batch untouched.
- Run `vectrune test examples/language/objects` for native API and headless web tests.

Use these examples when moving a familiar Rune-Web construction pattern into a
Vect script or a backend `run:` block, or when teaching which object forms are
shared across hosts.

## 7. Rune DB with a Rune-Web frontend and durable events

- Run `vectrune examples/data/storage/fullstack/single-server.rune`, then open
  `http://127.0.0.1:3000`. The database and frontend share one server and origin.
- For two listeners in one process, run `fullstack/app.rune` with
  `--secondary-app examples/data/storage/fullstack/database.rune`.
- The browser and CLI share server-side records. Save a note, increment its
  views, reload, and read the same value from a separate browser session.
- Saving a note and its domain event uses one atomic batch. Replay buttons show
  bounded stream pages and an exclusive cursor.
- `examples/data/storage/checkout.vect` demonstrates a revision-checked stock
  mutation plus event; `replay.vect` persists a consumer cursor between runs.
- `web.rune` in that folder demonstrates browser-local IndexedDB separately.
- Instructions: `examples/data/storage/README.md`; browser and native workflow
  verification: `tests/browser/storage.py`.

Use these examples to teach reusable datasource declarations, embedded versus
remote providers, shared server persistence and atomic document/event commits.

## Selection guidance

When expanding this curated set, prefer examples that are:
- referenced by tests
- small enough to teach one or two concepts clearly
- representative of real user workflows
- stable relative to the current runtime implementation

## Suggested next additions

Once the starter set is stable, likely next candidates are:
- memory-oriented REST examples
- auth examples
- the multi-file `examples/games/tic_tac_toe/` rune-web proposal for teaching imports and frontend-oriented sections
