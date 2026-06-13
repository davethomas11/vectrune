# Rune-Web: Frontend Architecture & Design

## Overview

Rune-Web is an integrated frontend authoring system that allows developers to define HTML, CSS, and client-side logic directly in `.rune` files alongside server-side application code. It bridges the declarative Rune language with compiled client-side web interfaces.

**Status**: Stable (Phase 3 reactive runtime rendering implementation)

## Core Concept

Rune-Web is a comprehensive frontend framework that colocates HTML (Views), CSS (Styles), and JavaScript (Logic) within standard `.rune` files. It minimizes fragmentation by allowing frontend declarations as colocated sections within the same `.rune` file as the server application.

```rune
@Style/themed
tokens:
    brand = #3b82f6
rules:
    .badge:
        pad = 8px
        #color:
            .success = green
            _ = black
        &.large:
            font-size = 1.2rem

@Logic/stateful
state:
	todos = [{ "text": "Learn Rune", "done": false }]
derive:
	activeCount from todos:
		_ then "todos.filter it.done != true.length"
```

## Architecture Layers

### 1. Parsing Layer (`parser.rs`)

**Responsibility**: Extract and normalize `@Page`, `@Component`, `@Style`, and `@Logic` sections into internal AST structures.

**Key Components**:
- `parse_rune_web_frontend()` - Main entry point, orchestrates extraction of all frontend section types
- `parse_style_properties()` - **Recursive** parser for nested CSS rules
- `extract_indented_attributes()` - Detects indented KV pairs (e.g. `type = text`) at the start of view elements
- `parse_logic_section()` - Normalizes state, derived values, and action definitions

**Output**: `RuneWebFrontend` AST with typed page/component/style/logic/i18n maps

### 2. AST Layer (`ast.rs`)

**Responsibility**: Define normalized data structures that represent frontend state independent of serialization format.

**Key Types**:
- `RuneWebFrontend` - Root container for all frontend definitions
- `PageDefinition` - Represents a single page with title, style/logic refs, and view tree
- `ComponentDefinition` - Represents a reusable view tree that can be expanded into pages or other components
- `ViewNode` - Recursive enum for elements, loops, conditionals, text, and element-level `for_each` bindings
- `StyleDefinition` - Tokens, presets, CSS rules
- `LogicDefinition` - State, structured derived values, scoped helper functions, and action handlers

### 3. Compilation Layer

#### CSS Compiler (`css.rs`)

**Responsibility**: Transform style definitions into optimized CSS that respects token substitution and preset inheritance.

**Key Features**:
- **Selector Nesting**: Supports `&.class` blocks, flattening them to standard combined selectors (e.g., `.parent.class`).
- **Property Shorthand**: Supports `#property:` blocks for class-based variations.
- **Rule Merging**: Automatically merges properties from different nesting syntaxes (Standard, Nested, Shorthand) for the same selector into a single CSS rule.
- **Token Resolution**: `{token-name}` → CSS custom property reference
- **Property Normalization**: Rune shorthand (`bg`) → standard CSS (`background-color`)

#### JavaScript Code Generator (`jscodegen.rs`)

**Responsibility**: Transform logic definitions and the already-expanded page AST into functional, reactive JavaScript.

**Key Operations**:
- **Deep Reactivity**: Uses a recursive `Proxy` wrapper (`makeReactive`) to track mutations across arrays and objects, automatically scheduling re-renders.
- **Expression Evaluator**: A recursive interpreter for Rune expressions, including logical NOT (`!`), equality, and method calls.
- **Method Support**: Natively supports array methods like `.filter`, `.any`, `.find`, and `.max`, with support for the `it` keyword shorthand.
- **Path Resolution**: Handles deep object access and the `.length` property on arrays.
- **Event Binding**: Use delegated `data-on-*` handlers with automatically interpolated arguments.

## Reactive Engine Design

### Deep Mutation Detection
Unlike shallow state trackers, Rune-Web uses recursive proxies to detect changes deep within data structures.
```rune
action toggle(id):
    for todo in todos:
        if todo.id == id:
            todo.completed = !todo.completed # Proxy detects this mutation
```
Any mutation automatically schedules an efficient re-render via `requestAnimationFrame`.

### Scope Prioritization
The runtime uses a tiered scope for resolving variables during rendering and expression evaluation:
1.  **Locals**: Highest priority. Includes loop variables (e.g., `todo` in a `for` loop) or component props.
2.  **Derived**: Values computed in `derive:` blocks.
3.  **State**: Global application state.

## Current Scope

### Template Expression Evaluation
1. `{variable}` and `{obj.prop}` interpolation
2. Braced expression unwrapping: `todo={todo}` evaluates to the object, not a string
3. Recursive method chaining: `todos.filter it.done != true.length`
4. Space-based method syntax: `.filter it.active == true`
5. Escaped string sequences such as `\n`, `\t`, `\"`, `\\`, `\{`, and `\}`

### Event Handler Implementation
Action handlers execute through a reactive interpreter and are automatically interpolated:
```rune
button click=setFilter('{value}')  # Corrects to click=setFilter('all')
```
The interpreter supports:
- `this` context (e.g., `update(this.value)`)
- State mutation methods like `.push()`
- Assignment and increment (`++`)
- Boolean logic (`and`, `or`, `!`)
- Scoped helper calls
- Debugging via `log` statements

## References

- **Parser Implementation**: `src/apps/rune_web/parser.rs`
- **CSS Compiler**: `src/apps/rune_web/css.rs`
- **JS Codegen**: `src/apps/rune_web/jscodegen.rs`
- **Example**: `examples/web.rune`
- **Tests**: `src/apps/rune_web/parser.rs` (Unit), `tests/integration_app.rs` (Integration)
