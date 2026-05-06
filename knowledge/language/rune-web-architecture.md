# Rune-Web: Frontend Architecture & Design

## Overview

Rune-Web is an integrated frontend authoring system that allows developers to define HTML, CSS, and client-side logic directly in `.rune` files alongside server-side application code. It bridges the declarative Rune language with compiled client-side web interfaces.

**Status**: Experimental (Phase 3 runtime rendering implementation)

## Core Concept

Traditional web development separates concerns across separate languages and files:
- HTML with templating engines
- CSS with preprocessors or frameworks
- JavaScript with frameworks and build tools

Rune-Web minimizes this fragmentation by allowing frontend declarations as colocated sections within the same `.rune` file as the server application:

```rune
@App
name = My App
type = REST

@Frontend
type = rune-web
path = %ROOT%
page = home

@Component/HeroBanner
view:
    section .hero:
        h1 "Welcome"

@Page/home
title = Home
style = themed
logic = stateful
view:
    main .container:
        HeroBanner
        button .primary click=greet "Say Hello"

@Style/themed
tokens:
    brand-color = #3b82f6
rules:
    body:
        bg = {brand-color}

@Logic/stateful
state:
    count = 0
action greet():
    count = count + 1
```

## Architecture Layers

### 1. Parsing Layer (`parser.rs`)

**Responsibility**: Extract and normalize `@Page`, `@Component`, `@Style`, and `@Logic` sections into internal AST structures.

**Key Components**:
`parse_rune_web_frontend()` - Main entry point, orchestrates extraction of all frontend section types
- `parse_page_section()` - Extracts view trees from `@Page` definitions
- `parse_component_section()` - Extracts reusable view trees from `@Component` definitions
- `parse_style_section()` - Normalizes CSS tokens, presets, and rules
- `parse_logic_section()` - Parses state, derived values, and action definitions
- `parse_i18n_section()` - Extracts translation groups from `@I18N/<locale>` definitions

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
- `I18nSection` - Translation groups for a specific locale
- `ActionDefinition` - Named action with parameters and structured runtime steps

**Design Decision**: AST types are independent of rendering; multiple rendering targets (HTML, native, server-side) could theoretically use the same AST.

### Reusable Components

`@Component/<name>` provides a parse-time reuse mechanism for repeated view fragments.

```rune
@Component/ScoreBadge
view:
    span .score "{cell}"

@Page/home
view:
    div .scoreboard:
        ScoreBadge <- (cell, index) in board
```

Current behavior:
- component references are expanded during parsing, so renderers only see ordinary `ViewNode`s
- components can reference other components
- recursive component references are rejected with a parse error
- component invocations currently support loop bindings, but do not yet support props, slots, or invocation-site attributes/classes/events

### Internationalization (i18n)

`@I18N/<locale>` defines translation bundles for content localization.

```rune
@I18N/en_us
Nav {
    home = "Home"
    about = "About"
}
Hero {
    headline = "Welcome to Vectrune"
}

@I18N/fr_fr
Nav {
    home = "Accueil"
    about = "À propos"
}
Hero {
    headline = "Bienvenue sur Vectrune"
}

@Frontend
type = rune-web
path = %ROOT%
page = home
locale = en_us

@Page/home
view:
    div:
        h1 "%i18n.Hero.headline%"
        nav:
            a "%i18n.Nav.home%"
            a "%i18n.Nav.about%"
```

**Translation Reference Syntax**:
- `%i18n.Group.key%` - Percent-delimited syntax converted to `{i18n.Group.key}` at render time
- `{i18n.Group.key}` - Direct curly-brace syntax also supported

**Locale Selection**:
- Request override: `?locale=fr_fr` on the mounted frontend URL
- Explicit: `locale = fr_fr` on `@Frontend` section
- Default: First defined locale by alphabetical order of section definition

**Rendering**:
- **SSR**: Translations resolved at server render time from the request locale override or active frontend locale
- **JavaScript**: Translation bundle injected into `app.state.i18n` for client-side access

**Current Behavior**:
- Translation groups are flat maps of key-value strings
- Missing translation keys render as empty strings (no fallback chain)
- All locales are active in the browser runtime (`app.state.i18n` contains full bundle)

### 3. Compilation Layer

#### CSS Compiler (`css.rs`)

**Responsibility**: Transform style definitions into optimized CSS that respects token substitution and preset inheritance.

**Key Operations**:
- **Token Resolution**: `{token-name}` → CSS custom property reference
- **Preset Flattening**: `use = (preset)` → recursively expand and compose presets
- **Cycle Detection**: Warn on circular preset references
- **Property Normalization**: Rune shorthand (`bg`) → standard CSS (`background-color`)

**Example**:
```rune
@Style/design
tokens:
    primary = #3b82f6

presets:
    button-base:
        pad = 10px 16px
        border = 0

    button-primary:
        use = (button-base)
        bg = {primary}
        color = white

rules:
    .btn-primary:
        use = (button-primary)
        cursor = pointer
```

Produces:
```css
:root {
  --primary: #3b82f6;
}
.btn-primary {
  padding: 10px 16px;
  border: 0;
  background-color: #3b82f6;
  color: white;
  cursor: pointer;
}
```

#### JavaScript Code Generator (`jscodegen.rs`)

**Responsibility**: Transform logic definitions and the already-expanded page AST into functional JavaScript that manages state and handles events.

**Key Operations**:
- **State Initialization**: Emit typed JavaScript object matching Rune state
- **Derived Evaluation**: Compute `derive:` definitions before each render
- **Page AST Rendering**: Re-render `#app` from the serialized `ViewNode` tree
- **Event Binding**: Use delegated `data-on-*` handlers plus `data-rune-scope` loop locals
- **Helper Emission**: Serialize `func ...` helpers per `@Logic` block into the page runtime
- **Action Interpretation**: Execute a small subset of Rune-style action steps in the browser

**Example**:
```rune
@Logic/counter
state:
    count = 0

action increment():
    count = count + 1
```

Produces (simplified):
```javascript
const app = {
  state: {
    count: 0
  },
  actions: {
    increment: function() {
      this.state.count += 1;
      app.render();
    }
  },
  render: function() { /* ... */ }
};
```

### 4. Rendering Layer (`mod.rs`)

**Responsibility**: Orchestrate compilation and render complete HTML document for client delivery.

**Key Functions**:
- `render_frontend_shell()` - Compose DOCTYPE, head (meta, title, styles), body (app div, server-rendered preview HTML, logic script); also resolves active locale and injects i18n bundle
- `render_view_node()` - Recursively render AST view tree to HTML with interpolation, loops, and conditions
- `render_styles()` - Compile styles to `<style>` tag
- `render_logic()` - Compile the expanded page AST + logic + i18n bundle to a browser runtime script
- `expand_percent_i18n()` - Pre-process `%i18n.Group.key%` syntax to `{i18n.Group.key}` before interpolation

**Output**: Complete, self-contained HTML document ready for HTTP delivery

### 5. Routing Layer (`mod.rs`)

**Responsibility**: Mount compiled frontend as a web route within the parent REST/GraphQL application.

**Key Functions**:
- `build_rune_web_router()` - Extract frontend metadata and build Axum router
- Mount at path (e.g., `/` for root, `/app` for nested)

## Design Decisions

### Why Separate Parsing from Rendering?

**Decision**: Multiple distinct modules rather than single pass-through.

**Rationale**:
- Parsing is deterministic and testable in isolation
- AST enables multiple rendering targets (HTML, docs, Swagger schema generation, etc.)
- Compilation phases can be optimized independently
- Errors during parsing/compilation can be caught before server starts

### Why CSS Custom Properties for Tokens?

**Decision**: Represent `{token-name}` as `var(--token-name)` in generated CSS rather than inlining values.

**Rationale**:
- Tokens can be overridden at runtime (CSS cascade)
- Reduces CSS size when tokens are used many times
- Enables CSS-in-JS interop for future JavaScript-based theming

### Why `data-on-*` Attributes for Event Binding?

**Decision**: Store event handlers in HTML attributes rather than inline `onclick` attributes.

**Rationale**:
- Separates content (HTML) from behavior (JavaScript)
- Avoids global namespace pollution
- Supports event delegation and late binding
- Compatible with Content Security Policy (CSP) strict mode

### Why Interpret a Small Action Subset in the Browser?

**Decision**: The browser runtime interprets a limited subset of action steps instead of trying to transpile all Rune semantics.

**Rationale**:
- Frontend actions mostly need local state mutation and simple branching
- An interpreter is easier to evolve than a full code generator while the syntax is still changing
- Complex server-oriented semantics can remain out of scope for `rune-web`
- This supports examples like Tic Tac Toe without forcing a separate frontend DSL

## Current Limitations

### Template Expression Evaluation

The runtime now supports path-based interpolation and simple conditions, but not arbitrary expressions:

```rune
@Page/example
view:
    button click=play(index) "{cell}"    # {cell} renders as literal "{cell}"
    <- (cell, index) in board             # Loop renders as HTML comment
```

**Current scope**:
1. `{variable}` and `{obj.prop}` interpolation
2. `{board.[index]}` style indexed access
3. element-level `for_each` loops and classic loop nodes
4. full-page rerendering after actions
5. zero-argument actions in either `action reset:` or `action reset():` form
6. escaped string sequences in page text and attributes such as `\n`, `\t`, `\"`, `\\`, `\{`, and `\}`
7. parse-time component expansion from `@Component/<name>` references
8. i18n translation bundles with `%i18n.Group.key%` or `{i18n.Group.key}` reference syntax

**Still deferred**:
- arbitrary inline expressions inside `{...}`
- dependency tracking and partial DOM patching

Escaped sequences are decoded at render time before interpolation. This makes multiline code samples practical inside `@Page` definitions without forcing separate HTML files:

```rune
@Page/docs
view:
    pre:
        code .language-rune "@App\nname = Demo\nrun:\n    log \"ok\""
```

### Derived Values

The `@Logic` section supports `derive:` blocks that are now evaluated both for the initial HTML preview and in the browser before each rerender:

```rune
derive:
    status_text from winner:
        "X" then "Winner: X"
        "O" then "Winner: O"
```

Derived support is currently intentionally narrow: one `from` source plus ordered `matcher then value` cases.

### Event Handler Implementation

Action handlers now execute through a small interpreter and can receive evaluated loop arguments:

```rune
action play(index):
    board.[index] = turn
```

Supported action features currently include assignment, increment, `stop`, `stop when`, predicate blocks, `+`, equality checks, boolean `or/and`, scoped helper calls, and the generic builtins `full` and `swap`.

Game-specific rules such as Tic Tac Toe win detection should live in `func` helpers inside the page's own `@Logic` block rather than inside the shared `rune_web` library runtime.

### Server Binding

Rune-Web is still **client-only** today. No server communication is generated from event handlers.

**Potential Phase 3**: WebSocket/fetch API generation to call back to server.

## Testing Strategy

### Unit Tests

- **Parser** (`tests/`: parse actual `@Style` and `@Logic` sections, verify AST structure
- **CSS Compiler** (`css.rs`: verify token substitution, preset flattening, error handling
- **JS Codegen** (`jscodegen.rs`: verify generated code structure for various state shapes

### Integration Tests

- **Rendering** (`tests/integration_app.rs`): parse complete `.rune` file, render HTML to completion, verify structure and content
- **Browser Tests** (future): compile to static HTML, serve, and verify JavaScript execution in real/headless browser

### Example-Based Tests

- Verify Tic Tac Toe example compiles and produces syntactically valid HTML+CSS+JS
- Verify example patterns from knowledge base render correctly

## Future Enhancements

### Template Syntax Completion
- Variable interpolation: `{variable}`, `{obj.prop.nested}`, `{arr.[0]}`
- Expressions: `{count > 0 ? "many" : "none"}`
- Filters: `{timestamp | format_date}`

### Reactive State Management
- Track template dependencies on state properties
- Auto-update DOM subtrees when dependencies change
- Batch updates across handler execution

### Type Safety
- Infer state types from initial values
- Validate action code references valid state paths
- Generate TypeScript definitions for JavaScript bundlers

### Build Integration
- Generate static assets for production bundlers (Webpack, Vite, etc.)
- Support CSS preprocessing (custom properties, nesting, etc.)
- Minify and optimize generated code

### Server Communication
- WebSocket mode for real-time state sync
- REST API binding for fetch-based actions
- GraphQL subscriptions for reactive updates

## References

- **Parser Implementation**: `src/apps/rune_web/parser.rs`
- **CSS Compiler**: `src/apps/rune_web/css.rs`
- **JS Codegen**: `src/apps/rune_web/jscodegen.rs`
- **Router Integration**: `src/apps/rune_web/mod.rs`
- **Example**: `examples/tic_tac_toe/tic_tac_toe.rune`
- **Tests**: `tests/integration_app.rs`

