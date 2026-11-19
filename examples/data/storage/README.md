# Rune DB and Vect Event

Build the CLI from this checkout. Run commands from the repository root; replace
`vectrune` with `cargo run --` if the checkout's binary is not on your PATH.
The site guide at `/docs/storage/` also offers a ZIP of this directory. For the
downloaded bundle, replace `examples/data/storage/` below with `rune_storage/`.

## Server-side database with a Rune-Web frontend

The recommended version runs the frontend and database in **one server**:

```sh
vectrune examples/data/storage/fullstack/single-server.rune
```

Open **http://127.0.0.1:3000** (or `http://localhost:3000`). One `@App` of type
`rune-db` owns the file and serves `@Frontend type = rune-web` on the same port.
The browser provider uses `mode = remote` with `endpoint = /`, so requests go
back to the current origin. Changing the listening port needs no frontend URL
or CORS changes.

For **two separate listeners in one process**, use:

```sh
vectrune examples/data/storage/fullstack/app.rune --secondary-app examples/data/storage/fullstack/database.rune
```

This serves the frontend on port 3000 and the database on 7333. Repeat
`--secondary-app` for more independent apps. Each keeps its own document,
routes and configured port; `--port`/`--host` override only the primary app.
Ctrl-C stops the whole group. `--watch` reloads the group when its source changes.
All listeners must bind successfully before any app starts serving.

The original two-terminal commands also work: run `app.rune` and `database.rune`
separately. Avoid combining their positional paths: multiple positional Rune
paths merge documents rather than launch independent apps.

In either version, edit the title and save, add a view, reload, and
load the note again. A second browser can load the same note. The data lives in
the database server's `fullstack/.vectrune/notes.rdb`, rather than IndexedDB.
Both versions import `ui.rune` and `style.rune`, sharing the same interface.
Stop one version before starting another: they use the same native file.

Saving commits the note and a `note.saved` event together and resets views to
zero. **Add one view** increments the stored number atomically; save first.
**Read new events** reads up to 20 events and advances the UI cursor. **Replay
events** reads the first page from position zero. The cursor resets on reload;
the events persist on the server. These buttons perform manual reads.

Inspect that same data from another terminal (use port 7333 for the split version):

```sh
vectrune db get notes hello --endpoint http://127.0.0.1:3000
vectrune events read notes --after 0 --endpoint http://127.0.0.1:3000
vectrune events tail '$changes' --endpoint http://127.0.0.1:3000
```

The split database example uses `allow_origins` to allow both
`http://127.0.0.1:3000` and `http://localhost:3000`. If you change its frontend
port, update that list too. Origins match exactly; a hostname and its IP are
different origins. Single-server mode needs no CORS configuration.
Both versions bind to loopback for this local example.
External deployment needs server authentication, HTTPS termination and suitable
application authorization. Browser credentials belong in runtime session state,
not in downloaded source. Ports 3000 are shared with other web examples; run
one frontend example at a time.

## Atomic checkout and a resumable event consumer

These scripts need no server and use their own `local.rune` providers:

```sh
vectrune examples/data/storage/checkout.vect
vectrune examples/data/storage/replay.vect
vectrune examples/data/storage/replay.vect
```

Checkout intentionally seeds demo stock at 10 on each invocation, then commits
a stock decrement and `purchase.completed` event in one batch. It prints stock
9 and matching document/event commit positions. The expected revision detects
conflicting updates and rejects the whole batch.

Replay prints a page of purchases, then saves its string cursor in a consumer
record. The second replay prints zero events if nothing was appended. Run
checkout again and replay to see it resume. Repeat replay for additional pages.
The cursor is saved after processing, so a crash can repeat events; consumers
should tolerate duplicates. Run this simple consumer sequentially.

## A standalone database and stream

```sh
vectrune examples/data/storage/db-server.rune
```

In another terminal:

```sh
vectrune db put notes hello --value '{"title":"Hello","count":0}' --endpoint http://localhost:7331
vectrune db increment notes hello --path '["count"]' --by 1 --endpoint http://localhost:7331
vectrune db get notes hello --endpoint http://localhost:7331
vectrune db scan notes --prefix h --limit 20 --endpoint http://localhost:7331
vectrune events tail '$changes' --endpoint http://localhost:7331
```

The increment returns the changed field and revision, without retransmitting the
whole note. `$changes` is recorded atomically with each document mutation.
Stop tail with Ctrl-C.

The database host also exposes domain streams. For a server restricted to stream
operations, start `event-server.rune` on port 7332 instead:

```sh
vectrune examples/data/storage/event-server.rune
vectrune events append orders order.created --value '{"id":"order-1"}' --endpoint http://localhost:7332
vectrune events read orders --after 0 --endpoint http://localhost:7332
```

Run the append/read commands in a second terminal. The two server examples use
separate files. Stop a server before opening its file directly; redb uses one
owning process per file. Repeated network operations reuse the server's open store.

## Embed the same providers in an app or script

`api.rune` imports `data.rune`, retains `@App type = REST`, and calls the engine
directly:

```sh
vectrune examples/data/storage/api.rune
curl -X POST http://localhost:3000/notes/hello -H 'Content-Type: application/json' -d '{"title":"Embedded"}'
curl http://localhost:3000/notes/hello
curl http://localhost:3000/changes
```

Stop `db-server.rune` before this example: they intentionally share the same file.
`client.vect` uses a remote provider and can run alongside `db-server.rune`:

```sh
vectrune examples/data/storage/client.vect
```

Without a server, the CLI can open an embedded provider directly:

```sh
vectrune db get notes hello --config examples/data/storage/data.rune --source main
```

## Persistent browser data

```sh
vectrune examples/data/storage/web.rune
```

Open `http://localhost:3000/`. Save a note, reload, and load it again. This uses
IndexedDB in that browser origin; it does not replicate to the native database.
Both hosts use the same operation packets. Browser I/O resumes the remaining
action steps after the transaction completes; `catch failed` handles errors.

For details, limits, atomic batches and the benchmark, see
[the storage reference](../../../knowledge/runtime/storage.md).
