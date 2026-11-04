# One-line reports with `summarize`

`summarize` groups a list of records and calculates a count plus an optional aggregate. It runs in native `.rune` execution steps and the browser emulator.

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
report = summarize records by group_path median value_path
report = summarize records by group_path distinct value_path
report = summarize records by group_path first value_path
report = summarize records by group_path last value_path
```

- The source must resolve to a list of objects. Source paths such as `body.orders` work.
- Group and value selectors are literal field names or dotted object paths, such as `customer.region` and `price.net`. They are not expressions or array selectors.
- Every output record has `group` and `count`. An aggregate adds one field named after the operation.
- Groups follow their first appearance in the input. Input records are never changed.
- Group values may be strings, numbers, booleans, or null. Types stay distinct: the number `1` and string `"1"` are separate groups. Numerically equal values such as `1` and `1.0` share a group.
- Missing group values join the null group. An object or list cannot be a group value.

## Numeric values and CSV files

`sum`, `avg`, `min`, `max`, and `median` accept finite numbers and decimal numeric strings, including signed values and scientific notation. CSV columns can be summarized without a conversion loop.

Missing values, null, and blank strings are ignored by the numeric aggregate. `count` still includes those rows. `avg` divides by the number of numeric values, rather than the number of rows.

If a group has no numeric values, `sum` is zero and `avg`, `min`, `max`, and `median` are null. An empty source list returns an empty report.

For numeric operations, nonnumeric values, booleans, and non-finite numbers cause an error; they are not silently converted to zero. Sum or average overflow also causes an error. Calculations use the runtime's floating-point numbers.

## Median, distinct values, and first/last

| Operation | Result | Missing/null values |
| --- | --- | --- |
| `median amount` | Middle numeric value, or the midpoint of the two central values | Ignored, along with blank numeric cells |
| `distinct customer` | Count of unique scalar values, preserving types | Ignored; a blank string is a value |
| `first customer` | Field from the first row in that group | Returned as null when missing; an explicit null is preserved |
| `last customer` | Field from the last row in that group | Returned as null when missing; an explicit null is preserved |

`first` and `last` follow input order, not sorting by the selected field. They preserve JSON types, including false, blank strings, objects, and arrays. Returned values are independent copies. Numeric CSV text stays text for these operations; `distinct` also keeps `"1"` separate from `1`.

`median` sorts a private list of the group's numeric values. Its even-length midpoint avoids overflow for large finite values. It takes O(n log n) time and stores the numeric cells; `distinct` stores unique keys. Other operations scan without retaining each row's value.

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
curl http://127.0.0.1:3000/medians
curl http://127.0.0.1:3000/customers
curl http://127.0.0.1:3000/first-customers
curl http://127.0.0.1:3000/last-customers
curl -H 'Content-Type: application/json' -d '[{"region":"Online","amount":20},{"region":"Online","amount":5}]' http://127.0.0.1:3000/report
```

The teaching site's Builtin Library also includes an editable, self-contained `summarize` demo.

Sources and tests:
- [Native implementation](../../src/builtins/builtin/summarize.rs)
- [Browser implementation](../../runtime/rune-emulator/src/engine/summarize.ts)
- [Shared semantic fixtures](../../tests/fixtures/summarize.json)
- [Native route tests](../../tests/summarize_builtin.rs)
- [Browser tests](../../runtime/rune-emulator/tests/summarize.test.ts)
