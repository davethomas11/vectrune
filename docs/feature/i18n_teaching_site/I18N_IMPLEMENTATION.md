# Vectrune I18N (Internationalization) Engine - Implementation Summary

## Overview

The i18n engine provides a first-class translation system integrated with Rune-Web frontends. Translations are defined in `@I18N/<locale>` sections and referenced using `%i18n.Group.key%` or `{i18n.Group.key}` syntax throughout view templates.

## Features

### 1. Translation Definition

Define locale-specific translation bundles using the `@I18N/<locale>` section:

```rune
@I18N/en_us
Nav {
    home = "Home"
    about = "About Us"
}
Hero {
    headline = "Welcome to Vectrune"
}

@I18N/es
Nav {
    home = "Inicio"
    about = "Acerca de Nosotros"
}
Hero {
    headline = "Bienvenido a Vectrune"
}
```

Translation groups are flat maps of key-value string pairs. Any number of groups can be defined per locale.

### 2. Locale Selection

**Explicit selection** via `@Frontend` section:
```rune
@Frontend
type = rune-web
locale = es
```

**Default**: First locale by alphabetical order of definition

### 3. Translation Reference Syntax

Both syntaxes are supported:

- Percent-delimited: `%i18n.Group.key%`
- Curly-braced: `{i18n.Group.key}`

Example:
```rune
@Page/home
view:
    h1 "%i18n.Hero.headline%"
    nav:
        a "%i18n.Nav.home%"
        a "%i18n.Nav.about%"
```

### 4. Rendering Pipeline

**Server-side (SSR)**:
1. Parse active locale from `@Frontend` section
2. Look up translations from active locale's `I18nSection`
3. Resolve `%i18n.X.Y%` → `{i18n.X.Y}` in pre-pass
4. Interpolate `{i18n.X.Y}` expressions during template rendering
5. Emit fully-resolved HTML to browser

**Client-side (JavaScript)**:
1. Active locale bundle injected into `app.state.i18n` as nested object
2. JavaScript interpolation (`interpolate()` function) resolves `{i18n.X.Y}` paths
3. Full translation data available for dynamic or client-side locale switching (future)

## Architecture

### Data Structures

**`I18nSection`** (in `src/apps/rune_web/ast.rs`):
```rust
pub struct I18nSection {
    pub groups: HashMap<String, HashMap<String, String>>,
}
```

**Integration with `RuneWebFrontend`**:
```rust
pub struct RuneWebFrontend {
    // ... existing fields ...
    pub i18n_sections: HashMap<String, I18nSection>,
}
```

### Parsing

**`parse_i18n_section()`** (in `src/apps/rune_web/parser.rs`):
- Iterates over `section.kv` entries
- Each `Value::Map` is treated as a translation group
- Groups are collected into the `I18nSection.groups` map

### Rendering

**`render_frontend_shell()`** (in `src/apps/rune_web/mod.rs`):
1. Resolves active locale (explicit or default)
2. Builds nested `i18n` JSON object: `{ GroupName: { key: "value" } }`
3. Inserts into `runtime_data` map before SSR
4. Passes i18n JSON to JavaScript code generator

**`expand_percent_i18n()`** (in `src/apps/rune_web/mod.rs`):
- Pre-processes templates to rewrite `%i18n.X.Y%` → `{i18n.X.Y}`
- Ensures unrecognized `%...%` tokens pass through unchanged

**`interpolate_template()`** (in `src/apps/rune_web/mod.rs`):
- Calls `expand_percent_i18n()` before parsing template expressions
- Resolves `{i18n.X.Y}` paths via existing `resolve_path_value()` mechanism

### JavaScript Injection

**`JsCodegen`** (in `src/apps/rune_web/jscodegen.rs`):
- Constructor updated to accept `i18n_json: String`
- Generated code includes `const i18nData = {...}` at runtime initialization
- `app.state` is initialized with merged properties: `Object.assign({...}, state, { i18n: i18nData })`

## Testing

### New Integration Tests

All tests in `tests/integration_app.rs`:

1. **`rune_web_i18n_resolves_translations_in_ssr_output`**
   - Verifies `%i18n.X.Y%` syntax resolved in HTML output
   - Confirms translations from active locale appear in rendered HTML

2. **`rune_web_i18n_active_locale_selected_by_frontend_kv`**
   - Tests explicit locale selection via `locale = xx` on `@Frontend`
   - Verifies correct locale bundle is used over default

3. **`rune_web_i18n_injects_translations_into_js_runtime`**
   - Confirms i18n bundle is serialized as `const i18nData` in JavaScript
   - Verifies bundle is merged into `app.state.i18n`

### Coverage

- ✅ SSR translation resolution
- ✅ Locale selection (explicit + default)
- ✅ Missing translation keys (render as empty)
- ✅ JavaScript runtime injection
- ✅ Percent-delimited syntax parsing
- ✅ Multiple translation groups per locale

## Example

See `examples/i18n_demo.rune` for a complete multi-language demo with:
- 3 locales (en_us, es, fr)
- Multiple translation groups (Common, Nav, Hero, CTA)
- Component references using i18n strings
- Locale switching via `@Frontend locale = xx`

## Future Enhancements

1. **Fallback chains**: `en_US` → `en` → `en_us` (configurable policy)
2. **Client-side locale switching**: Runtime ability to change active locale without server request
3. **Plural/gender forms**: Extended syntax for `{i18n.key:plural(count)}`
4. **Parameter interpolation**: `{i18n.greeting|user.name}`
5. **Missing key handling**: Options for fallback behavior (empty, key name, error)
6. **Lazy loading**: Split translations by route or component
7. **RTL support**: Inject directional context based on locale

## Implementation Timeline

- **Phase 1** (✅ Complete): Basic i18n section parsing, SSR resolution, JS injection
- **Phase 2** (Future): Client fallback chains and dynamic locale switching
- **Phase 3** (Future): Advanced templating (plurals, gender, parameters)

