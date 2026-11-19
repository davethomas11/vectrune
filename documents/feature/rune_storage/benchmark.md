# Initial native engine comparison

This is a local development measurement, not a production throughput claim for
Rune DB or Vect Event. Reproduce with:

```sh
cargo run --release --manifest-path tools/storage-bench/Cargo.toml
```

The tool is a small separate crate, so benchmarking does not optimize/build the
entire application stack. It compares redb 5.0.0 Immediate durability with SQLite
WAL, `synchronous=FULL`, `fullfsync=ON` and `checkpoint_fullfsync=ON`. Both have
16-MiB configured caches and store identical MessagePack bytes in ordered B-trees.
SQLite uses a `WITHOUT ROWID` primary-key table. See `benchmark-native.json` for
all observed values and the SQLite version.

The `fullfsync` settings matter on macOS: the initial comparison without them
gave SQLite a large apparent durable-write advantage. Those incomparable
results were discarded. No relaxed-durability result is used for selection.

The workload covers three payload sizes and batches of 1, 32 and 256. Every case
has 32 committed append-insert batches followed by 1000 warm point reads with
MessagePack decoding. Commit percentiles describe whole batch transactions.
File size includes live files, including SQLite's open WAL.

On this machine, with the matched flush settings, redb generally led warm point
reads and the larger batches; single-write commit rates were close. The 1-KiB
case at batch 256 measured roughly 46,500 committed records/s for redb and
26,000 for SQLite. This supports redb as the initial small-store/stream adapter;
it does not establish universal superiority or an end-to-end service rate.

Limits of this sample: fixed engine order, one writer, warm reads, only 32 commit
samples per case, no cold-cache control, no mixed-load/memory profiling, no crash
or power-loss injection, and no Rune change-log or network overhead. A full Rune
mutation writes both the materialized value and its change entry, which this raw
KV comparison deliberately does not measure. Follow-up workload benchmarks
should include those costs and vary concurrency before setting performance SLOs.

Tests separately verify that an atomic increment of a large document returns a
small patch receipt. That demonstrates reduced response bytes; it is not a
claim that the engine avoids decoding/re-encoding the document internally.
