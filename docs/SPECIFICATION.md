# Vectrune Language Specification (Draft v1.0)

This document serves as the canonical formal language specification for the Vectrune ecosystem. It standardizes lexical structure, expression evaluation, operator precedence, statement semantics, and document shapes across all runtime targets (Rust Core, Rust Backend, Rune-Web, Browser Emulator, REPL, and Mobile).

---

## 1. Lexical Grammar & Tokens

### 1.1 Source Encoding & Shebang
A Vectrune source file is UTF-8 encoded text. An optional shebang may appear as the very first line:
- `#!RUNE` for general declarative and full-stack documents.
- `#!VECT` for imperative standalone scripts.

### 1.2 Comments
- Full-line or trailing comments start with `#` (unless `#` is part of a hex color `#39ff14` or schema type reference `#User`).
- Block comments are not currently standard; repeated `#` lines are used.

### 1.3 Identifiers
- Identifiers match `[a-zA-Z_][a-zA-Z0-9_-]*`.
- In path expressions, nested properties use dot-syntax (`a.b.c`) or bracket notation (`items[0]`, `state[key]`).

### 1.4 Literals
- **Numeric**: Integers (`42`, `-10`), floating point (`3.14159`, `-0.5`).
- **Boolean**: `true`, `false`.
- **Null**: `null`.
- **Strings**: Double-quoted (`"hello\nworld"`) or single-quoted (`'hello'`).
  - Supports standard escapes: `\"`, `\'`, `\\`, `\n`, `\t`, `\r`.
  - Supports embedded interpolation `{expression}` inside string bodies.
  - Multi-line strings preserve line breaks when defined under multiline keys or triple-quotes.
- **Collections**:
  - Array literals: `[1, 2, "three", true]`.
  - Object / Map literals: `{ "x": 10, "y": 20 }` or `{ x: 10, y: 20 }`.

---

## 2. Expressions & Operator Precedence

Expressions are evaluated according to standard operator precedence (from highest binding power to lowest):

| Precedence Level | Category | Operators | Associativity | Description |
|---|---|---|---|---|
| **1 (Highest)** | Primary | `(...)`, literals, identifiers | N/A | Grouping and atomic values |
| **2** | Postfix / Member | `.prop`, `[expr]`, `call(...)` | Left | Field access, index lookup, function invocation |
| **3** | Unary | `-`, `!`, `not` | Right | Arithmetic negation, logical NOT |
| **4** | Multiplicative | `*`, `/`, `%` | Left | Multiplication, division, modulo |
| **5** | Additive | `+`, `-` | Left | Addition, string concatenation, subtraction |
| **6** | Relational | `<`, `<=`, `>`, `>=` | Left | Numeric and string ordering comparisons |
| **7** | Equality | `==`, `!=`, `contains` | Left | Value equality, case-insensitive substring search |
| **8** | Logical AND | `and`, `&&` | Left | Short-circuit boolean conjunction |
| **9** | Logical OR | `or`, `\|\|` | Left | Short-circuit boolean disjunction |
| **10** | Nullish Coalescing | `??` | Left | Fallback if LHS is `null`, `undefined`, or empty string |
| **11 (Lowest)**| Conditional / Ternary | `cond ? true_val : false_val` | Right | Inline ternary branching |

### 2.1 Collection Pipeline Methods
Collections support method chaining on arrays:
- `.filter(it => condition)` or `.filter(item => condition)`
- `.find(it => condition)`
- `.any(it => condition)`
- `.max(it => score_expr)`
- `.length`

### 2.2 Standard Math & Spatial Primitives
- `clamp(val, min, max)`: Restricts value within `[min, max]`.
- `collide(box_a, box_b, width, height)`: Axis-aligned 2D AABB bounding check.
- `abs(val)`: Absolute value.
- `random(min, max)`: Pseudo-random integer between `min` and `max` inclusive.
- `min(a, b, ...)` / `max(a, b, ...)`: Minimum or maximum of given operands.

---

## 3. Statement Grammar

### 3.1 Assignments
- **Simple Assignment**: `<path> = <expression>`
- **Compound Assignment**: `<path> += <expr>`, `<path> -= <expr>`, `<path> *= <expr>`, `<path> /= <expr>`

### 3.2 Control Flow
- **Conditional**:
  ```rune
  if condition:
      # steps
  else if other_condition:
      # steps
  else:
      # steps
  ```
- **Loop**:
  ```rune
  for item in collection:
      # steps
  for item, index in collection:
      # steps
  ```
- **While Loop**:
  ```rune
  while condition:
      # steps
  ```
- **Pattern Matching**:
  ```rune
  match expression:
      "matcher_a" -> actionA
      "matcher_b" -> actionB
      _           -> fallbackAction
  ```
- **Early Exit**:
  - `stop`: Terminates the current execution block / action.
  - `stop when condition`: Guards against execution when condition is true.

---

## 4. Document Structure & Metamodel

### 4.1 Section Headers (`@Section`)
A section header begins with `@` at column 0:
- `@App`
- `@Page/<slug>`
- `@Component/<Name>`
- `@Logic/<Name>`
- `@Style/<Name>`
- `@Route/<METHOD> <path>`
- `@Schema/<Name>`
- `@I18N/<locale>`
- `@Navigator`

### 4.2 Key-Value Pairs
Simple assignment at root of section or record:
```rune
title = VectWorms
version = 1.0
```

### 4.3 Series & Blocks
Key followed by colon and indented child elements:
```rune
view:
    main .container:
        h1 "Hello"
```

### 4.4 Records (`+`)
Repeated data rows within a section:
```rune
+ name: "Alice"
  role: "Engineer"
+ name: "Bob"
  role: "Designer"
```

### 4.5 State Generators
Declarative replication of data items:
- 1D Generator: `{ template } * N inc (props) by STEP with { overrides }`
- 2D Grid: `grid COLS x ROWS at (X, Y) step (DX, DY) with { overrides }`
- Local Templates: `local template_name = { ... }`
- Batch Modifiers: `all { prop = val }`
