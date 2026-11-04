# One-line reports with `summarize`

`summarize` groups a list of records and calculates a count plus an optional numeric aggregate. It runs in native `.rune` execution steps and the browser emulator.

```rune
sales = csv.read "sales_report.csv"
report = summarize sales by region sum amount
respond 200 report
```

For the [sample CSV](../../examples/sales_report.csv), the report is:

```json
[
  { "group": "West", "count": 2, "sum": 150 },
  { "group": "East", "count": 2, "sum": 100 },
  { "group": "South", "count": 1, "sum": 30 }
]
```

## Syntax

```rune
report = summarize records by group_path
report = summarize records by group_path sum value_path
report = summarize records by group_path avg value_path
report = summarize records by group_path min value_path
report = summarize records by group_path max value_path
```

- The source must resolve to a list of objects. Source paths such as `body.orders` work.
- Group and value selectors are literal field names or dotted object paths, such as `customer.region` and `price.net`. They are not expressions or array selectors.
- Every output record has `group` and `count`. An aggregate adds one field named `sum`, `avg`, `min`, or `max`.
- Groups follow their first appearance in the input. Input records are never changed.
- Group values may be strings, numbers, booleans, or null. Types stay distinct: the number `1` and string `"1"` are separate groups. Numerically equal values such as `1` and `1.0` share a group.
- Missing group values join the null group. An object or list cannot be a group value.

## Numeric values and CSV files

Numeric aggregates accept finite numbers and decimal numeric strings, including signed values and scientific notation. CSV columns can be summarized without a conversion loop.

Missing values, null, and blank strings are ignored by the numeric aggregate. `count` still includes those rows. `avg` divides by the number of numeric values, rather than the number of rows.

If a group has no numeric values, `sum` is zero and `avg`, `min`, and `max` are null. An empty source list returns an empty report.

Nonnumeric values, booleans, and non-finite numbers cause an error; they are not silently converted to zero. Sum or average overflow also causes an error. Calculations use the runtime's floating-point numbers.

## JSON requests

```rune
@Route/POST /report
run:
    parse-json
    report = summarize body by region sum amount
    respond 200 report
```

A malformed invocation or invalid data stops the step sequence with the normal builtin error response (HTTP 500 in REST handlers). The builtin validates the whole report before replacing the assigned variable or `___last_exec_result___`.

## Try it

```sh
vectrune examples/sales_report.rune
curl http://127.0.0.1:3000/report
curl http://127.0.0.1:3000/averages
curl http://127.0.0.1:3000/counts
curl -H 'Content-Type: application/json' -d '[{"region":"Online","amount":20},{"region":"Online","amount":5}]' http://127.0.0.1:3000/report
```

The teaching site's Builtin Library also includes an editable, self-contained `summarize` demo.

Sources and tests:
- [Native implementation](../../src/builtins/builtin/summarize.rs)
- [Browser implementation](../../runtime/rune-emulator/src/engine/summarize.ts)
- [Shared semantic fixtures](../../tests/fixtures/summarize.json)
- [Native route tests](../../tests/summarize_builtin.rs)
- [Browser tests](../../runtime/rune-emulator/tests/summarize.test.ts)
