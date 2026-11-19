# Rune DB and Vect Event

Status: experimental native and browser implementation. Requires a build from
this checkout. Data branching, replication and the proposed `commit` language
block are not implemented.

`rune-db` is a persistent key/value document store. `vect-event` is a durable,
ordered stream view over the same engine. Named `@DataSource` providers compose
with existing apps; standalone `@App` hosts expose the same operations over HTTP.
`@Datasource` is also accepted for these provider declarations.

## Declare once, choose a host

```rune
@DataSource/main
type = rune-db
database = workshop
native_path = .vectrune/workshop.rdb

@DataSource/activity
type = vect-event
store = main
```

Native storage uses **redb 5**, with immediate durable commits, a 16-MiB page
cache per database and a single owning process per file. Values, records, event
payloads and network packets use **MessagePack**. MessagePack is the encoding;
redb supplies persistence and transactions. There is no SQL or general query
language in this API.

Providers open lazily and are shared for the host lifetime, with a maximum of
64 open database paths. Relative native paths resolve beside the declaring Rune
file. Without `native_path`, the default is `.vectrune/data/<database>.rdb`;
`database` defaults to the provider name.
Database names use 1–128 ASCII letters, numbers, underscores or hyphens.

In Rune-Web, an embedded `rune-db` provider uses IndexedDB named
`rune-db:<database>`, requesting strict transaction durability. Native paths and
token environment variables are excluded from generated browser configuration.
IndexedDB is local to the browser origin and remains subject to browser storage
policies. It does not automatically replicate to a native server. Failed
persistence is an error; it does not silently fall back to memory.

An embedded `vect-event` provider references a `rune-db` provider with `store`.
This shares its transaction boundary and avoids a separate database/broker
dual-write. It accepts append, read/tail and append-only batches.

## Standalone servers and clients

```rune
import "data.rune"

@App
type = rune-db
source = main
host = 127.0.0.1
port = 7331
```

Run with `vectrune db-server.rune`. The database server supports the complete
record/stream protocol. `type = vect-event` with `source = activity` exposes only
stream operations. It is another host over the same core, not a second event
implementation. Do not start two owning processes on the same file; use the
network adapter to connect to its owner.

```sh
vectrune db put notes hello --value '{"count":0}' --endpoint http://localhost:7331
vectrune db increment notes hello --path '["count"]' --by 1 --endpoint http://localhost:7331
vectrune db get notes hello --endpoint http://localhost:7331
vectrune db get-many notes hello second --endpoint http://localhost:7331
vectrune db scan notes --prefix h --limit 20 --endpoint http://localhost:7331
vectrune events tail '$changes' --endpoint http://localhost:7331
```

`db query` is an alias for `db scan`, not SQL or a property-filter expression.
`db get-many` reads 1–256 keys from one collection in a single read snapshot.
It returns records in the requested order, repeats duplicate keys, and puts
`null` in each missing slot. The MessagePack response is limited to 4 MiB.

```rune
packet = { op: "get_many", collection: "notes", keys: ["hello", "second"] }
records = db main packet
```

The same packet works with native and remote Rune DB and Rune-Web IndexedDB.
`events read <stream>` returns one bounded page; `events tail <stream>` prints
events as newline-delimited JSON, updates its cursor, and waits for new commits.
Use `--after <sequence>` to replay strictly after a saved position. Ctrl-C stops
tail. The network tail uses bounded long polling, not a separate socket protocol.

Instead of `--endpoint`, use `--file <path>` for direct local access, or
`--config <file.rune> --source <name>` to load a named embedded or remote provider.
Stop the owning server before direct access to its file.

Remote provider configuration:

```rune
@DataSource/main
type = rune-db
mode = remote
endpoint = http://localhost:7331
```

Native remote providers optionally read `token_env`; CLI remote commands accept
`--token-env`. Servers use `@App token_env` and require at least 16 token bytes.
Non-loopback binds require authentication. Use HTTPS termination for external
traffic. `allow_origin = https://example.com` enables one exact browser origin.
Alternatively, `allow_origins = ["http://127.0.0.1:3000", "http://localhost:3000"]`
allows a list; use one setting at a time. CORS is disabled by default. Origins
match exactly, including hostname and port. Browser applications can set an in-memory session
token with `__RuneWeb.setDataSourceToken(source, token)`. Never put a privileged
server token into downloadable source.

## One operation contract

All operations are JSON-shaped objects with an `op` discriminator. CLI arguments
use JSON for inspection; native clients use MessagePack on the network.

| Operation | Required fields | Optional fields | Result |
| --- | --- | --- | --- |
| `get` | `collection`, `key` | — | `{key,value,revision}` or `null` for absent key |
| `put` | `collection`, `key`, `value` | `expected` | Commit receipt with the stored record |
| `delete` | `collection`, `key` | `expected` | Commit receipt with deletion status |
| `increment` | `collection`, `key`, numeric `by` | `path`, `expected` | Commit receipt with the changed field/patch, not the full document |
| `scan` | `collection` | `prefix`, `after`, `limit` | `{items,next}` ordered by UTF-8 key bytes |
| `append` | `stream`, `kind`, `value` | — | Commit receipt with the committed event |
| `read` | `stream` | `after`, `limit`, `wait_ms` | `{events,next}` in stream order |
| `batch` | `operations` | — | One atomic commit receipt for all mutations |

Mutation receipts are `{commit,results}`. Revisions, commit positions and stream
positions are decimal **strings**, avoiding JavaScript integer precision loss.
A stored `null` is returned inside a record and is distinct from an absent key.
`expected` is an optimistic revision check; use `"0"` for create-only. Conflicts
reject the entire batch. An increment requires an existing numeric target.

A path is an array of field names, indexes or first-match selectors:

```json
{"op":"increment","collection":"orders","key":"order-1","path":["items",{"field":"sku","equals":"B"},"qty"],"by":4}
```

Selectors use JSON value equality, including type: a numeric ID and string ID
are distinct in a packet selector. This is a storage protocol operation, unlike
the language's string-coercing `objects[]id` shorthand. No arbitrary program is
uploaded or executed. The server reads/modifies/writes atomically, and returns
only the changed field and revision for increments.

Batch document mutations and domain events in one store:

```json
{"op":"batch","operations":[{"op":"increment","collection":"orders","key":"order-1","path":["total"],"by":4},{"op":"append","stream":"orders","kind":"total.changed","value":{"id":"order-1"}}]}
```

Pass this array of operations to `vectrune db batch --value '<array>' ...`;
the packet form wraps the array with `op` and `operations` as above. Public
transactions are fixed operation lists, not arbitrary callbacks.

## Use from Rune and Vect

For a complete **server-side database + Rune-Web frontend**, use one server:

```sh
vectrune examples/data/storage/fullstack/single-server.rune
```

The same document declares `@App type = rune-db`, its native datasource, and
`@Frontend type = rune-web`. The UI's remote provider uses `endpoint = /`,
which follows the current origin, including a `--port` override. It never opens
IndexedDB. The database protocol stays at `/v1/execute`; the frontend is at `/`.
No CORS settings are needed for this same-origin setup. The storage host mounts
the compiled frontend without exposing the source directory or database files.

To keep two listeners while launching them with one command:

```sh
vectrune examples/data/storage/fullstack/app.rune --secondary-app examples/data/storage/fullstack/database.rune
```

The primary frontend uses port 3000 and the secondary database uses 7333.
`--secondary-app` is repeatable. Each app keeps its own document/routes;
`--host`/`--port` override only the primary. Ctrl-C stops all listeners and
`--watch` reloads the group. Multiple positional inputs still merge documents.
The split example allows both loopback browser origins on port 3000. Update
`allow_origins` when changing that frontend port.

Open `http://127.0.0.1:3000` or `http://localhost:3000`. Save a note, add a
view, reload and load it again. Another browser and the CLI see the same server
record. The database process owns the redb file; the browser uses a remote
provider, rather than IndexedDB. Saving the note and appending `note.saved`
share one batch. Event read/replay buttons page through the durable server log.
The frontend cursor is in memory and resets on reload.

```sh
vectrune db get notes hello --endpoint http://127.0.0.1:3000
vectrune events read notes --after 0 --endpoint http://127.0.0.1:3000
```

See the [example walkthrough](../../examples/data/storage/README.md) for the
complete configuration, local atomic checkout and a persisted replay cursor.

Backend `run:` blocks:

```rune
packet = { op: "get", collection: "notes", key: id }
record = db main packet
packet = { op: "read", stream: "$changes", limit: 20 }
changes = events activity packet
```

The same assignment forms work as **top-level Rune-Web action steps**, suspending
and resuming after completion. Use `record = db main packet catch failed` to
invoke `action failed(error)` on failure; remaining steps do not run. Storage
I/O inside `if`/`for` or synchronous expressions is not supported yet. Pure
expressions remain synchronous.

Native extended `.vect` scripts use a host adapter that loads provider settings
relative to the script:

```rune
packet = { op: "get", collection: "notes", key: "hello" }
record = db.request("remote.rune", "main", packet)
stdio -> "{json.stringify(record)}"
```

The browser JavaScript API is
`__RuneWeb.requestDataSource(name, packet, {signal})`, returning a promise.
The browser adapter accepts JSON values and JavaScript numeric precision; native
integer operations additionally enforce checked integer overflow. Binary values
as a distinct user data type are outside this first slice.

## Persistence and bounds

- Document mutations atomically append to the reserved `$changes` stream in the
  same commit. It records put/delete data and resolved increment patches.
- Explicit appends to `$changes` are rejected. Domain streams remain separate.
- Sequence allocation, document revisions and appends roll back together.
- Notify tailers only after commit. Tail registers before reading and rechecks
  after wakeups, avoiding gaps at replay/live handoff. Browser tabs use
  BroadcastChannel notifications plus a bounded polling fallback.
- Reconnection can replay duplicates; callers keep their last processed cursor.
  There are no exactly-once, consumer-group or automatic retry guarantees.
- Maximum packet/response: 8 MiB. Maximum encoded value: 1 MiB. Maximum batch:
  256 mutations. Maximum path: 32 segments. Page limit: 1–1000, default 100;
  pages stop near 4 MiB and return a continuation position. Names: 1–256 UTF-8
  bytes. Keys: at most 4096 bytes. Long-poll wait: at most 30 seconds.
- Native storage admits eight concurrent operations per store, returning busy
  when saturated. Transactions never wait on network I/O. Slow tail clients
  request the next bounded page rather than accumulating an unbounded queue.
- History is append-only in v1. Retention, compaction policy, backup tools,
  automatic synchronization, branches and secondary indexes remain future work.
  There is no distributed transaction across different stores or servers.
- Native headless game/logic hosts do not provide IndexedDB. Browser persistence
  is tested through the browser adapter and real browser, not a memory fallback
  in the QuickJS logic runner.

## Network protocol

`POST /v1/execute` accepts one operation packet. Use `application/msgpack` or JSON
and request `application/msgpack` in `Accept` for binary replies. Success returns
`{ok:true,data:...}`. Errors return `{ok:false,error:{code,message}}`; authorization,
revision conflicts and admission limits use HTTP 401, 409 and 429 respectively.
`GET /health` returns `OK`. Remote requests use persistent HTTP connections,
disable redirects and have bounded response bodies and a 40-second timeout.

No public SQL endpoint, arbitrary Rune evaluation or implicit file/network
access is provided by a packet. TLS and remote identity remain transport concerns.

## Evidence and examples

- [Runnable examples](../../examples/data/storage/README.md): standalone hosts,
  embedded REST API, remote Vect client and IndexedDB web UI.
- [Native engine comparison](../../documents/feature/rune_storage/benchmark.md)
  and `tools/storage-bench/`: optimized, reproducible raw-engine measurements.
- Shared operations: `tests/conformance/storage.json`, native
  `tests/storage_core.rs` and `runtime/rune-web/tests/datasource.test.ts`.
- Native protocol/authentication/CLI integration: `tests/storage_network.rs`.

The operation packet is the implemented first step toward portable intent
execution. The higher-level `commit orders:` syntax in the architecture proposal
is still a design for later compiler work.
