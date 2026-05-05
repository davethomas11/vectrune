# CSS Tokens & Presets in Rune-Web

## Overview

Rune-Web brings design token management and reusable style composition to CSS through `@Style` sections. This system allows developers to:

1. Define **tokens** - Single, reusable design values (colors, sizes, spacing)
2. Define **presets** - Reusable groups of CSS properties (button styles, layout patterns)
3. Define **rules** - CSS rules that can reference tokens and compose presets

## Tokens

Tokens are design constants that represent single values and are compiled to CSS custom properties (variables).

### Syntax

```rune
@Style/theme
tokens:
    token-name = value
    another-token = another-value
```

### Examples

```rune
@Style/design
tokens:
    # Colors
    color-primary = #3b82f6
    color-accent = #ef4444
    color-text = #1f2937
    color-bg = #ffffff

    # Spacing
    spacing-xs = 4px
    spacing-sm = 8px
    spacing-md = 16px
    spacing-lg = 24px

    # Typography
    font-family = -apple-system, system-ui, sans-serif
    font-size-sm = 12px
    font-size-md = 16px
    font-size-lg = 20px
```

### Usage in Rules

Reference tokens in CSS rules using `{token-name}` syntax:

```rune
rules:
    body:
        font-family = {font-family}
        font-size = {font-size-md}
        color = {color-text}
        bg = {color-bg}

    h1:
        font-size = {font-size-lg}
        color = {color-primary}
```

### Compilation

Tokens are emitted as CSS custom properties at `:root` scope:

```css
:root {
  --color-primary: #3b82f6;
  --color-accent: #ef4444;
  --color-text: #1f2937;
  --color-bg: #ffffff;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --font-family: -apple-system, system-ui, sans-serif;
  --font-size-sm: 12px;
  --font-size-md: 16px;
  --font-size-lg: 20px;
}
```

Token references in rules are compiled to `var(--token-name)`:

```css
body {
  font-family: var(--font-family);
  font-size: var(--font-size-md);
  color: var(--color-text);
  background-color: var(--color-bg);
}

h1 {
  font-size: var(--font-size-lg);
  color: var(--color-primary);
}
```

### Runtime Modification

Because tokens are CSS custom properties, they can be modified at runtime:

```javascript
// Override token at runtime
document.documentElement.style.setProperty('--color-primary', '#10b981');
```

## Presets

Presets are named groups of CSS properties that can be reused in rules and composed with other presets.

### Basic Syntax

```rune
presets:
    preset-name:
        property = value
        property2 = value2
```

### Single-Level Preset

```rune
@Style/buttons
presets:
    button-base:
        border = none
        padding = 8px 12px
        border-radius = 4px
        cursor = pointer
        font-weight = 600
```

### Preset Inheritance with `use`

Presets can inherit properties from other presets using `use = (parent-preset)`:

```rune
presets:
    button-base:
        border = none
        padding = 8px 12px
        border-radius = 4px
        cursor = pointer

    button-primary:
        use = (button-base)
        background-color = {color-primary}
        color = white

    button-danger:
        use = (button-base)
        background-color = {color-accent}
        color = white
```

When `button-primary` is composed into a rule, its properties are flattened:

```css
/* Properties from button-base are inherited */
border: none;
padding: 8px 12px;
border-radius: 4px;
cursor: pointer;

/* Plus properties from button-primary */
background-color: var(--color-primary);
color: white;
```

### Using Presets in Rules

Reference a preset in a rule using `use = (preset-name)`:

```rune
rules:
    .btn-primary:
        use = (button-primary)
        # Can add additional properties
        transition = all 0.2s ease

    .btn-primary:hover:
        opacity = 0.9
```

### Preset Composition Flow

1. **Inheritance Resolution**: Recursively flatten all `use = (...)` references
2. **Token Substitution**: Replace `{token-name}` with `var(--token-name)`
3. **Property Merging**: Parent properties are overridable by child properties
4. **Cycle Detection**: Warn if circular references are detected

### Circular Reference Detection

The CSS compiler detects and warns about circular preset references:

```rune
presets:
    preset-a:
        use = (preset-b)

    preset-b:
        use = (preset-a)  # ERROR: Circular reference detected
```

**Error Message**:
```
Circular preset reference detected: preset-a -> preset-b -> preset-a
```

## Property Name Normalization

Rune-Web supports shorthand CSS property names that are normalized during compilation:

| Rune Shorthand | Standard CSS |
|---|---|
| `bg` | `background-color` |
| `pad` | `padding` |
| `margin` | `margin` |
| `gap` | `gap` |
| `round` | `border-radius` |
| `size` | `width` and `height` |
| `weight` | `font-weight` |
| `text-size` | `font-size` |
| `border` | `border` |

### Example

```rune
presets:
    card:
        bg = white
        pad = 16px
        round = 8px
        text-size = 14px
        weight = 500
```

Compiles to:

```css
.card {
  background-color: white;
  padding: 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}
```

## Best Practices

### Naming Conventions

Use hierarchical naming for organizational clarity:

```rune
tokens:
    # Color hierarchy
    color-brand-primary = #3b82f6
    color-brand-dark = #1e40af
    color-brand-light = #dbeafe

    # Functional colors
    color-success = #10b981
    color-warning = #f59e0b
    color-error = #ef4444

    # Spacing scale
    spacing-1 = 4px
    spacing-2 = 8px
    spacing-3 = 12px
    spacing-4 = 16px
```

### Preset Organization

Group related presets together and layer them:

```rune
presets:
    # Base styles
    button-base:
        border = none
        cursor = pointer

    # Variants
    button-primary:
        use = (button-base)
        bg = {color-brand-primary}

    button-secondary:
        use = (button-base)
        bg = {color-gray-200}

    # States
    button-primary-disabled:
        use = (button-primary)
        opacity = 0.5
        cursor = not-allowed
```

### Avoid Over-Composition

While inheritance is powerful, deep nesting reduces maintainability:

```rune
# Good: 2-3 levels
presets:
    button-base:
        # Common properties
    
    button-primary:
        use = (button-base)
        # Specialization

# Avoid: Deep nesting
presets:
    a:
        use = (b)
    b:
        use = (c)
    c:
        use = (d)
    d:
        # ...
```

### Use Tokens, Not Hardcoded Values

✅ **Recommended**
```rune
buttons:
    button-primary:
        bg = {color-primary}
        color = {color-white}
```

❌ **Avoid**
```rune
buttons:
    button-primary:
        bg = #3b82f6
        color = white
```

Hardcoded values prevent easy theme switching and make maintenance harder.

## Current Limitations

### No Multi-Preset Composition

Currently, `use` supports a single parent preset:

```rune
# ❌ Not supported (yet)
card-interactive:
    use = (card, interactive)
```

**Workaround**: Create intermediate presets

```rune
# ✅ Workaround: chain inheritance
card:
    bg = white
    pad = 16px

card-interactive:
    use = (card)
    cursor = pointer
```

### No Selector Nesting

Unlike SCSS, presets don't support nested selectors for pseudo-classes:

```rune
# ❌ Can't nest :hover in preset
button-primary:
    bg = blue
    :hover:
        bg = darker-blue
```

**Workaround**: Define separate rules for states

```rune
# ✅ Workaround: separate rules
rules:
    .btn-primary:
        use = (button-primary)

    .btn-primary:hover:
        opacity = 0.9
```

## Phase 2 Enhancements

Future versions will support:

- **SCSS-like nesting** for pseudo-classes and media queries
- **Multi-parent composition** with `use = (preset1, preset2)`
- **Computed tokens** (e.g., derived dark mode colors)
- **CSS Grid/Flexbox templates** (predefined layouts)
- **Type-safe property validation** during compilation

## References

- **CSS Compiler**: `src/apps/rune_web/css.rs`
- **AST Types**: `src/apps/rune_web/ast.rs` - `StyleDefinition`
- **Example**: `examples/tic_tac_toe/parts/style.rune`
- **Tests**: `tests/` - CSS token and preset tests

