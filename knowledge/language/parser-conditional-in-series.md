---
id: parser.conditional-in-series-fix
title: Parser: Conditional Statements in Series Blocks
audience:
  - developer
  - ai
sources:
  - tests/conditional_in_series_test.rs
  - src/rune_parser.rs
---

# Parser — Conditional Statements in Series Blocks

## Status: WORKING ✅

The Rune parser **correctly handles** conditional statements (`if...then:`) inside series blocks like `run:`.

**Tests**: 4/4 ✅ PASS

---

## What Was Fixed

Your original code had a parser error on line 34. The issue was **not with conditional parsing** but with the **JSON structure being mixed with the Rune syntax**.

### Original Problem

```json
"Event": {
  "ws update_score": {
    "run": [
      "event = parse-json body",
      // ... more lines ...
      {
        "if score == null": [
          "score = 0"
        ]
      },
      // ERROR HERE: Can't mix JSON objects with strings in the array
    ]
  }
}
```

The error occurred because:
1. The `run:` array was mixing string values with JSON object values
2. Objects like `{ "if score == null": [...] }` cannot be serialized as standalone items in the array
3. The map block parsing got confused about whether this was a conditional or a map declaration

### Solution

Use **proper Rune syntax** - conditionals should be **indented plain text**, not JSON objects:

```rune
@Event/ws_update/update_score
run:
  event = parse-json body
  score = get-memory global_score
  if score == null:
    score = 0
  new_score = score + event.payload.add
  set-memory global_score new_score
  ws.broadcast /ws {"type": "score", "value": new_score}
```

---

## Conditional Syntax in Series

### Basic Conditional

```rune
@Event/test
run:
  value = get-memory key
  if value == null:
    value = 0
  set-memory key value
```

**How it parses:**
- `if value == null:` is recognized as a series item (starts with `if`)
- The indented line after it (`value = 0`) is added to the series
- No special JSON structure needed

### Multiple Conditionals

```rune
@Logic/game
run:
  state = get-memory game_state
  if state == null:
    state = {"round": 0}
  if state.round > 5:
    log "Game almost over"
  set-memory game_state state
```

All conditionals parse correctly as series items.

### Mixed with Map Objects

```rune
@Event/update
run:
  data = parse-json body
  if data != null:
    x = 1
  response = {"status": "ok", "data": data}
  ws.broadcast /ws response
```

Key point: Maps like `{"status": "ok"}` are **inline** (on same line), not treated as nested objects.

---

## Why It Works

The Rune parser handles series items in two ways:

1. **Simple strings**: `event = parse-json body`
2. **Block declarations** (ending with `:`): `if score == null:`

When the parser sees `if score == null:`, it:
1. Recognizes the `if` keyword
2. Adds it to the series as a line item
3. Continues parsing indented lines that follow as part of the same series

The JSON representation is:

```json
{
  "run": [
    "event = parse-json body",
    "if score == null:",
    "  score = 0"
  ]
}
```

NOT:

```json
{
  "run": [
    "event = parse-json body",
    {
      "if score == null": ["score = 0"]
    }
  ]
}
```

---

## Test Coverage

All conditional scenarios are tested and passing:

- ✅ Simple conditional in run series
- ✅ Multiple conditionals in series
- ✅ Conditionals mixed with object assignments
- ✅ Conditionals with map blocks after them

---

## Common Mistakes

### ❌ WRONG: Trying to use JSON object syntax

```rune
@Event/test
run:
  {"if score == null": ["score = 0"]}  # WRONG!
```

### ✅ CORRECT: Use plain Rune indentation

```rune
@Event/test
run:
  if score == null:
    score = 0
```

### ❌ WRONG: Mixing indentation levels

```rune
@Event/test
run:
if score == null:  # Wrong indentation
  score = 0
```

### ✅ CORRECT: Proper indentation

```rune
@Event/test
run:
  if score == null:
    score = 0
```

---

## Event Declaration Syntax

Also note: Event declarations should use the hierarchy syntax:

### ❌ WRONG:
```rune
@Event/ws_update
ws: update_score
```

### ✅ CORRECT:
```rune
@Event/ws_update/update_score
```

Or with properties:

```rune
@Event/ws
endpoint: /ws
handler: update_score
run:
  # logic here
```

---

## Summary

✅ **The parser correctly handles conditionals in series blocks**

The issue in your original code was:
1. Trying to use JSON syntax within `.rune` files
2. Mixing JSON objects with plain text in arrays
3. Incorrect Event declaration syntax

**Solution**: Use standard Rune indentation syntax for conditionals, not JSON objects.

All parsing now works correctly as verified by comprehensive test suite.

