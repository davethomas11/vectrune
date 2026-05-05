# Tic Tac Toe Frontend Example

This folder contains a runnable Rune-Web frontend example demonstrating client-side interactivity with state management, event handling, and derived values.

## Files

- `tic_tac_toe.rune` — root Rune file that imports the frontend parts directory
- `parts/style.rune` — proposed multi-file style definition
- `parts/logic.rune` — proposed multi-file client logic definition
- `preview.html` — hand-written HTML/CSS/JS target for the same example

## What the example is trying to prove

The proposal keeps current Vectrune patterns:
- `@Section`-based authoring
- simple metadata with `key = value`
- indentation for nesting
- `if ...:` for readable conditionals
- placeholder interpolation like `{status_text}`

It adds three frontend-oriented sections:
- `@Page/<name>` — concise HTML-like structure
- `@Style/<name>` — concise CSS-like rules
- `@Logic/<name>` — concise client behavior

The style proposal uses:
- `tokens:` for repeated values like colors, sizes, and radii
- `presets:` for repeated groups of properties like badges, buttons, and page layout

The example also now demonstrates the proposed import declaration:
- `import "parts"` loads the direct child `.rune` files from the `parts/` directory before parsing the root file

## Why tic tac toe

Tic tac toe is a good first test because it needs:
- nested UI structure
- repeating cells
- click handlers
- small local state
- derived status text
- readable win/draw logic

## Related design notes

See `documents/feature/frontend_language/rune_frontend_format.md` for the full proposal and rationale.





