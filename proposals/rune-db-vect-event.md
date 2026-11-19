# Rune DB and Vect Event

Status: initial core path implemented, November 18, 2026. The authoritative
implemented API, limits and examples are in
[the storage reference](../knowledge/runtime/storage.md). The architectural
experiments below, including `commit` blocks and branching, remain proposals.
The rest of this file preserves the design rationale and future performance work.

## Architectural ideas for discussion

These are research directions to review with the user before implementation.
Their combination could distinguish Rune; their individual storage techniques
have precedents. None carries a performance claim until measured.

### One commit, several views

Give every committed mutation a position and atomically update both its current
value and durable change record. `rune-db` exposes current values; `vect-event`
exposes ordered changes; a Rune-Web binding consumes a bounded live view of those
same changes. A writer does not have to separately update a database and publish
an event. Domain events remain distinguishable from automatic change records.

Keep current values materialized so point reads do not replay the log. Change
records can carry compact resolved mutations rather than a second full document.
Measure write amplification and tail latency: sharing a commit is a consistency
benefit, not proof that writing history is free. Decide whether change recording
is enabled per namespace before finalizing persistence semantics.

### Compile mutations into intent packets

Explore a small `commit` block that compiles Rune's object/path updates into a
bounded operation packet. For example, this proposed source:

```rune
commit orders:
    orders[]id.items[]sku.qty += 4
```

could carry a collection/key binding, selector arguments, an increment operation
and an optional expected revision. A native embedded host executes it directly;
a network client sends the same packet to the server. The server performs the
read/modify/write atomically and returns the changed fields and commit position.
The CLI is another producer of the same packet.

This can avoid fetching, decoding and retransmitting a full document just to
change one value. It does not mean arbitrary selectors are free: require a key
binding or bounded prefix range, limit nested scans and operation count, and
support a fixed opcode set with no loops or uploaded general-purpose code.
Pure expressions stay free of hidden I/O; `commit` is an explicit asynchronous
execution boundary. Replay records the committed change and resolved revisions,
not an instruction to rerun a nondeterministic user expression later.

### Fork a dataset to preview a change

Explore optional named branches for previewing data edits or running tests:
read from a pinned base version and write only branch changes. The same branch
can be inspected through the CLI, a web UI or its event stream. Promotion checks
that affected base revisions still match and otherwise returns explicit conflicts.
It does not silently merge edits or promise conflict-free offline synchronization.

This is the most speculative direction. Cheap creation requires an adapter that
can retain an appropriate snapshot or versioned base; layered lookups, pinned
history and cleanup can add real cost. Benchmark branch depth, read amplification
and reclamation before promising inexpensive forks. Keep it optional and outside
the minimum v1 engine until it proves its value.

Recommended experiment: prove the shared commit plus intent-packet path first,
then prototype branches separately. Start with a point increment on a 16-KiB
document and compare embedded execution, a remote get/modify/put cycle and one
remote intent packet under equal durability and concurrency. Check correctness
under concurrent increments as well as latency and transferred bytes.

## Direction

Build a small persistent key/value database (`rune-db`) and durable append-only
stream (`vect-event`). Speed, predictable latency, bounded memory and a small
implementation take priority over feature breadth.

Support three modes with the same operation contract:

| Mode | Declaration / caller | Execution |
| --- | --- | --- |
| Embedded | Named `@DataSource` inside another app or script | Direct calls to the local engine; no loopback HTTP |
| Standalone server | `@App type = rune-db` or `vect-event` | Thin network host over the same providers |
| Remote client | CLI, named remote datasource, or SDK | Versioned network API to a standalone server |

An existing REST, GraphQL or game app keeps its own `@App`. Storage and streams
are named resources, so multiple providers can coexist. Standalone app types are
convenience hosts, not separate implementations of the database or event log.

The current code recognizes the spelling `@DataSource/<name>` in
`src/core/mod.rs`. Preserve it as canonical and add `@Datasource/<name>` as an
alias during implementation. Names are required so apps can choose providers.

## Storage and encoding

MessagePack and Protocol Buffers are serialization formats, not storage engines.
They do not supply transactions, persistence, ordered scans or live delivery.
[MessagePack](https://msgpack.org/) fits Rune's dynamic objects; [Protocol
Buffers](https://protobuf.dev/overview/) is worth considering later for an
explicitly schema-driven protocol, rather than making it a v1 dependency.

Use a compact, versioned MessagePack representation for document values and
event payloads. Keep keys and event sequence metadata separately addressable:
looking up a key or finding a stream position should not require decoding all
records. JSON remains a CLI input/output format for inspection and shell tools.
Encoding is an internal choice, not a collection of user-facing tuning knobs.

The leading native storage candidate is **redb**, a Rust embedded transactional
key/value store using copy-on-write B+trees. Its documented features include ACID
transactions, concurrent readers and crash safety. These are capabilities, not
evidence that it is faster for Rune's workload. Compare it against **SQLite WAL**
using the same logical operations and durability before selecting the adapter.
[redb documentation](https://docs.rs/redb/latest/redb/),
[SQLite WAL documentation](https://sqlite.org/wal.html).

For the browser, use **IndexedDB** first. It already provides asynchronous
transactions, keyed records and cursors. Store MessagePack values with separate
sortable metadata. Preserve the same key and cursor ordering in both adapters;
test UTF-8 keys and large sequence values explicitly. Browser storage is local to
its origin and subject to quota and eviction policies; it does not automatically
sync with a server. [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API),
[browser storage policies](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

SQLite WASM with OPFS is a possible later browser adapter if measurements justify
the extra runtime and deployment requirements. It is outside v1.
[SQLite browser persistence](https://sqlite.org/wasm/doc/trunk/persistence.md).

## Small v1 API

| Provider | Operations | Contract |
| --- | --- | --- |
| `rune-db` | `get`, `put`, `delete`, `scan` | Named collections, string keys, Rune object values, bounded ordered prefix scans |
| `vect-event` | `append`, `read`, `tail` | Named streams, ordered durable entries, bounded replay and live following |
| Shared engine | `batch` | Commit a fixed list of puts, deletes and appends atomically against one local store |

`put` replaces one value. `get` returns a record or a missing result, keeping a
stored `null` distinct from an absent key. `scan` uses a limit and continuation
cursor; it is not a property-filter query engine. Cursors and sequence numbers
are opaque strings to callers, avoiding JavaScript integer precision loss.

`batch` is a list of operations, not a transaction callback that can execute
arbitrary code or wait for network requests while holding a write transaction.
It permits document changes and related event appends to commit together when
they use the same engine. Separate remote servers do not create a distributed
transaction.

Keep v1 free of SQL, joins, secondary indexes, ORM mapping, consumer groups,
automatic retries, replication, automatic offline sync and automatic retention.
Add a capability only when a measured workload needs it.

## Composable configuration

Keep provider declarations separate from server wrappers, so importing storage
into an existing app never imports an unwanted `@App` section.

Proposed `data.rune`:

```rune
@DataSource/main
type = rune-db
mode = embedded
database = workshop
native_path = ./data/workshop.rdb

@DataSource/activity
type = vect-event
store = main
```

In a native host, `main` opens a local persistent store. In a browser host, the
embedded provider uses an IndexedDB database named `workshop`; the native path
is not browser configuration. `activity` reuses the same store and transaction
boundary instead of maintaining a second copy of events in another database.

An ordinary app imports this file and retains its existing application type.
Provider handles are opened once per host lifetime and shared across requests;
individual operations do not reopen the file or create a fresh HTTP client.

Proposed `db-server.rune`:

```rune
import "data.rune"

@App
type = rune-db
source = main
host = 127.0.0.1
port = 7331
```

The initial database host serves the complete database/stream packet protocol.
The vect-event wrapper below restricts access to stream operations.

For a standalone event server, use the same declarations with this wrapper:

```rune
import "data.rune"

@App
type = vect-event
source = activity
host = 127.0.0.1
port = 7332
```

That mode hosts only the stream API. Initially require one owning process per
native store, irrespective of additional concurrency modes an engine supports.
Run one combined server when both capabilities share a file; independently
running servers use distinct stores or a remote connection to the owner.
Browser hosts provide local client storage, not standalone listening servers.

## CLI and network adapters

Proposed commands, with JSON at the terminal and compact values internally:

```sh
vectrune db-server.rune

# In another terminal:
vectrune db put notes note-1 --value '{"title":"Hello","done":false}' --endpoint http://localhost:7331
vectrune db get notes note-1 --endpoint http://localhost:7331
vectrune db scan notes --prefix note- --limit 100 --endpoint http://localhost:7331
vectrune events append activity notes.changed --value '{"id":"note-1"}' --endpoint http://localhost:7331
vectrune events tail activity --after 0 --endpoint http://localhost:7331
```

CLI commands can alternatively use `--config data.rune --source main` for direct
embedded database access, or `--source activity` for local stream operations.
Do not allow a second process to open a store already owned by a running server;
use `--endpoint` in that case. An optional raw/binary CLI output mode can follow
if end-to-end measurements justify it; JSON inspection remains available.

Proposed remote declarations in another Rune app:

```rune
@DataSource/notes
type = rune-db
mode = remote
endpoint = http://localhost:7331

@DataSource/updates
type = vect-event
mode = remote
endpoint = http://localhost:7331
stream = activity
```

Use one small versioned HTTP API, keep connections alive, support batches and
streamed responses. Start with HTTP rather than a custom TCP protocol; measure
transport overhead before adding another protocol. CLI, browser clients, Rune
adapters and eventual SDKs call the same operation handlers and normalize the
same errors. Streams use documented framing so clients handle partial network
chunks correctly. Network reads never execute submitted Rune or arbitrary code.

Standalone servers bind to loopback by default. Remote deployments configure
authentication and HTTPS at the transport boundary. Browser configuration must
contain only browser-safe connection details, never native credentials.

## Persistence and streaming semantics

- A successful write/append acknowledgement follows the selected adapter's
  transaction commit. Batch/group commit amortizes durable writes; any relaxed
  durability mode must be explicit and benchmarked separately.
- Sequence allocation and append occur in one transaction. Ordering is per
  stream; there is no global cross-stream ordering promise.
- `read` replays entries strictly after a supplied cursor. `tail` replays and
  follows subsequent commits without a gap at the replay/live boundary.
- Publish wakeups only after commit. Notifications prompt another log read;
  the stored log is the authority. In-browser tab notifications can use
  BroadcastChannel with reconciliation on reconnect/resume. They are not a
  substitute for persisted events.
- Tailers use bounded buffers and bounded replay pages. A slow reader can be
  disconnected with a resumable cursor rather than growing memory indefinitely.
- Reconnection/retry can cause duplicates. Stable event positions allow clients
  to deduplicate; v1 makes no exactly-once delivery promise.
- Expose quota, full-store and transaction failures. Do not silently replace a
  failed persistent database with temporary memory. Optional memory-only test
  adapters must identify themselves explicitly.

## Runtime integration

Current integration points are `src/core/mod.rs::extract_data_sources`,
`src/builtins/builtin/data_source.rs` and `src/apps/mod.rs`. Existing SQL
datasources assume a connection string and MySQL/Postgres dispatch; a provider
registry should select by type before those SQL-specific checks. Preserve
existing declarations and SQL behavior.

Pure expressions remain synchronous. IndexedDB and remote operations suspend
execution at an I/O statement and resume after completion, following the
existing browser fetch-assignment model. Do not insert unresolved promises into
state or block a browser game tick while waiting for storage. Native Vect's
current synchronous host bridge needs an explicit I/O adapter as well; registering
two datasource names alone would not deliver language parity.

Use shared operation fixtures for embedded native, native server plus CLI,
browser IndexedDB and browser/network clients. Verify restart persistence,
binary round trips, scan ordering, atomic batches, concurrent appends, cancellation
and replay/live handoff before advertising those guarantees.

## Performance gate and implementation order

1. Benchmark redb and SQLite WAL behind the same tiny storage interface.
2. Implement the selected native key/value and stream engine, then the CLI.
3. Add the two thin standalone hosts and remote adapter over the same operations.
4. Add IndexedDB and asynchronous Rune-Web bindings with the same fixtures.
5. Publish runnable examples, library entries and man pages with measured limits.

Compare 128-byte, 1-KiB and 16-KiB payloads; point reads, ordered scans, appends
and writes; batches of 1, 32 and 256; and mixed reader/writer loads. Report warm
and cold behavior, p50/p95/p99 latency, throughput, memory, file growth and restart
recovery. Keep durability and batching equal between engines. Measure encoding,
storage and network costs separately, then measure the complete CLI/app path.
Do not label a buffered or memory-only result as durable performance.

The initial product promise is a small, efficient embedded store and durable
stream that can also be served and queried remotely. Broader database or broker
features require evidence that they improve that core workload.
