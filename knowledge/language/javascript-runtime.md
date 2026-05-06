# JavaScript Runtime & Client-Side Logic

## Overview

Rune-Web generates self-contained JavaScript that manages client-side state and event handling. The runtime provides:

1. **State Management** - Centralized reactive state object
2. **Event Binding** - Automatic wiring of click/change handlers to actions
3. **Action Dispatch** - Named action handlers that mutate state
4. **Re-rendering** - Automatic DOM updates when state changes

`@Component/<name>` sections are expanded before JavaScript generation. The browser runtime does not have a separate component system yet; it renders the already-expanded page tree.

## State Declaration

State is declared in the `@Logic` section's `state:` block:

```rune
@Logic/game
state:
    board = ["", "", "", "", "", "", "", "", ""]
    turn = X
    winner = ""
    score = { "X": 0, "O": 0, "draws": 0 }
```

### State Types

The compiler infers JavaScript types from initial values:

| Rune Literal | Inferred JS Type | Example |
|---|---|---|
| `0`, `42` | `number` | `count = 0` |
| `"text"` | `string` | `name = "Player"` |
| `true`, `false` | `boolean` | `active = true` |
| `[]` | `array` | `items = []` |
| `{}` | `object` | `config = {}` |

### Generated JavaScript

```javascript
const app = {
  state: {
    board: ["", "", "", "", "", "", "", "", ""],
    turn: "X",
    winner: "",
    score: { "X": 0, "O": 0, "draws": 0 }
  },
  // ... actions and utilities
};
```

## Actions & Event Handlers

Actions are named functions that respond to user events:

```rune
@Logic/game
state:
    board = ["", "", "", "", "", "", "", "", ""]
    turn = X

action play(index):
    # Mutate state
    board.[index] = turn

action reset():
    board = ["", "", "", "", "", "", "", "", ""]
    turn = X
```

Zero-argument actions may also omit parentheses:

```rune
action reset:
    winner = ""
```

### Event Binding

Events are bound using `click=action_name(args)` syntax in the view:

```rune
@Page/game
view:
    button .cell click=play(index) "{cell}"
    button .reset click=reset "Play Again"
```

This compiles to:

```html
<button class="cell" data-on-click="play(index)">X</button>
<button class="reset" data-on-click="reset">Play Again</button>
```

And the JavaScript runtime attaches listeners:

```javascript
document.addEventListener('click', function(e) {
  const target = e.target;
  
  // Check for data-on-* attributes
  for (const attr of target.attributes) {
    if (attr.name.startsWith('data-on-')) {
      const eventName = attr.name.substring(8);
      const handlerName = attr.value;
      
      if (app.actions[handlerName]) {
        app.actions[handlerName].call(app);
      }
    }
  }
});
```

### Action Parameters

Actions can accept parameters:

```rune
action play(index):
    board.[index] = turn

# Called with data-on-click="play(0)"
```

The runtime now parses handler signatures like `play(index)` and evaluates arguments from the current render scope.

For repeated elements, Rune-Web emits a `data-rune-scope` payload so loop locals such as `cell` and `index` are available during event dispatch.

## Derived Values

Derived values are computed values that should update whenever their dependencies change.

### Syntax

```rune
derive:
    computed_name from dependency1, dependency2:
        value_matcher then result
        another_matcher then another_result
```

### Example

```rune
@Logic/game
state:
    board = ["", "", "", "", "", "", "", "", ""]
    turn = X
    winner = ""

derive:
    status_text from winner:
        "X" then "Winner: X"
        "O" then "Winner: O"
        "draw" then "Draw game"
        "" then "Turn: {turn}"
```

When `winner` changes, `status_text` is automatically recomputed.

### Generated JavaScript

```javascript
const app = {
  state: {
    // ...
    winner: "",
  },
  
  derived: {
    status_text: function() {
      switch(this.state.winner) {
        case "X": return "Winner: X";
        case "O": return "Winner: O";
        case "draw": return "Draw game";
        default: return `Turn: ${this.state.turn}`;
      }
    }
  },
  
  // ...
};
```

**Current Status**: Derived values are evaluated in the browser before each render and are also used during the initial server-rendered preview.

## Helper Functions

`@Logic` blocks can define scoped helpers with `func name(args):`.

These helpers are carried into the generated browser runtime and are only available to the page that references that logic block.

Example:

```rune
@Logic/game
state:
    WINS = [7, 56, 448, 73, 146, 292, 273, 84]

func win(board, player):
    return WINS.any(mask => (board.mask(player) & mask) == mask)

action play(index):
    win board turn:
        winner = turn
```

The `win` helper uses bitmasking to detect winning lines efficiently:

- `board.mask(player)` — builds an integer bitmask where bit `i` is set if `board[i] === player`
- `WINS.any(mask => expr)` — returns `true` if any element in the array satisfies the arrow-function predicate
- `expr & mask` — bitwise AND of two integers

### Current Helper Scope

Supported right now:

- helper signatures with parameters
- a helper body made of plain lines
- `return <expression>` lines evaluated by the browser runtime
- helper invocation in prefix form such as `win board turn`
- helper invocation in paren form such as `win(board, turn)`
- bitwise AND operator (`&`) in expressions
- `.mask(player)` method on arrays: produces a bitmask where bit `i` is set if `array[i] === player`
- `.any(item => expr)` method on arrays: returns `true` if any element satisfies the predicate

Helpers are **not** global library functions. They are emitted from the current `@Logic` block, which keeps game-specific logic like `win` out of the shared runtime.

## Template Interpolation

Templates can reference state variables and computed values using `{variable}` syntax:

```rune
@Page/game
view:
    p "{status_text}"
    div .board:
        button .cell "{cell}"
```

### Supported Syntax

| Syntax | Example | Returns |
|---|---|---|
| Simple variable | `{count}` | `state.count` |
| Object property | `{score.X}` | `state.score["X"]` |
| Array access | `{board.[0]}` | `state.board[0]` |
| Nested paths | `{config.theme.primary}` | `state.config.theme.primary` |

### Current Behavior

Template interpolation is executed for:

- state paths like `{turn}`
- object lookups like `{score.X}`
- array/index lookups like `{board.[index]}`
- derived values like `{status_text}`

Rune-Web currently rerenders the full `#app` tree after an action completes instead of tracking per-node dependencies.

## Loops in Templates

Loops dynamically repeat DOM elements based on collections:

```rune
@Page/game
view:
    div .board:
        button .cell <- (cell, index) in board:
            "{cell}"
```

### Loop Syntax

```rune
element <- (item, index) in collection:
    content
```

- `item` - Loop variable (current element)
- `index` - Loop variable (current index)
- `collection` - Expression evaluating to an array

### Current Behavior

Loops now render repeated elements both:

- in the initial server-rendered preview HTML
- in the browser runtime during `app.render()`

Supported forms currently include:

```rune
button .cell click=play(index) "{cell}" <- (cell, index) in board
span .score <- ["X {score.X}", "O {score.O}"]
```

Loop locals are preserved in emitted HTML via `data-rune-scope` so event handlers can reuse values such as `index`.

## Conditional Rendering

Conditionals show/hide content based on state predicates:

```rune
@Page/game
view:
    if winner != "":
        div .winner:
            p "{status_text}"
```

### Syntax

```rune
if condition:
    content_when_true
```

Conditions are evaluated as JavaScript expressions:

| Rune Condition | JavaScript |
|---|---|
| `count > 0` | `state.count > 0` |
| `winner != ""` | `state.winner !== ""` |
| `active` | `state.active` |
| `board.[0] == X` | `state.board[0] === "X"` |

### Current Behavior

Conditionals are evaluated during server-side preview rendering and during browser rerenders.

Supported condition operators are intentionally small for now:

- `==`
- `!=`
- `or`
- `and`
- truthy path checks

## Re-rendering Strategy

The current runtime uses a simple whole-app strategy:

1. Recompute derived values
2. Re-render the full `@Page` AST into `#app`
3. Reuse delegated event listeners attached to `document`

This is less efficient than subtree patching, but it keeps the runtime deterministic and makes loop/event scopes straightforward.

### Example

```rune
<button>{count}</button>  <!-- Depends on state.count -->
<button click=increment>+</button>

# When action increment() runs:
state.count += 1;
// Only the text node "{count}" updates
// The button's class/attributes unchanged
```

## Global App Object

The generated application is exposed as `window.runeWebApp` for debugging and external control:

```javascript
// Access state
console.log(window.runeWebApp.state);

// Trigger action
window.runeWebApp.actions.play();

// Access derived values
console.log(window.runeWebApp.derived.status_text());
```

This is useful for:
- Browser DevTools debugging
- External JavaScript integration
- Testing and automation
- Server communication in future versions

## Current Implementation Status

### ✅ Implemented
- State initialization from Rune literals
- Event attribute binding with argument evaluation
- Global app object exposure
- Derived value evaluation
- Template interpolation for paths and loop locals
- Full-app rerendering into `#app`
- Server-rendered preview HTML for initial state

### ⚠️ Partial
- Action execution supports a small interpreted subset (`=`, `++`, `stop`, `stop when`, predicate blocks, `+`, `==`, `!=`, `or`, `and`, `&`, helper calls, and generic builtins such as `full`, `swap`, `.any()`, and `.mask()`)
- Rendering currently replaces the full `#app` contents on each action

### ❌ Not Yet Implemented
- Arbitrary expression parsing inside templates
- Fine-grained DOM diffing or dependency tracking
- `else` branches and richer control-flow in actions
- Network-aware client actions or server round-trips

## Testing

### Manual Testing

Compile a Rune-Web app and inspect the browser:

```javascript
// In browser console
window.runeWebApp.state           // Check initial state
window.runeWebApp.actions.play()  // Trigger action
window.runeWebApp.render()        // Force re-render
```

### Automated Testing (Future)

```javascript
// Example test structure (Phase 2)
const app = runeApp.create(logic);
assert.deepEqual(app.state, { count: 0 });

app.actions.increment();
assert.equal(app.state.count, 1);
```

## Best Practices

### 1. Immutability Mindset

While JavaScript allows mutation, prefer clear, predictable state changes:

```rune
# ✅ Clear state update
action increment():
    count = count + 1

# Avoid complex mutations
action setScore():
    score.X = score.X + 1
    score.total = score.X + score.O
```

### 2. Action Naming

Use descriptive action names that reflect user intent:

```rune
action play(index):      # ✅ User action
action handleClick():    # ❌ Too generic
action toggleActive():   # ✅ Clear intent
```

### 3. Derived Value Scope

Keep derived values synchronized with their dependencies:

```rune
derive:
    isWinner from winner:  # ✅ Clear dependency
        "" then false
        _ then true

# Avoid deriving from multiple unrelated state
```

## Integration with Server

**Currently**: Rune-Web logic runs entirely client-side.

**Future**: Phase 3 will add server communication:

```rune
action play(index):
    board.[index] = turn
    # Planned: send to server for validation
    # fetch("/api/game/move", { index })
```

## References

- **JS Code Generator**: `src/apps/rune_web/jscodegen.rs`
- **Parser**: `src/apps/rune_web/parser.rs` - action parsing
- **AST Types**: `src/apps/rune_web/ast.rs` - `LogicDefinition`, `ActionDefinition`
- **Example**: `examples/tic_tac_toe/parts/logic.rune`
- **Integration Tests**: `tests/integration_app.rs`

