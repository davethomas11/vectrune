# Rune Syntax Highlighting Setup

This repository includes syntax highlighting support for `.rune` files. The implementation works on multiple platforms with different approaches:

## Files

- `.gitattributes` - Tells Linguist to recognize `.rune` files as the "Rune" language
- `languages.yml` - Language definition metadata
- `.github/linguist/rune.tmLanguage` - TextMate grammar for syntax highlighting
- `rune-vscode/` - VS Code extension for local development and testing

## Features

The syntax highlighting includes:

- **Section headers**: `@App`, `@Route`, `@Page`, `@Logic`, `@Style`, etc.
- **Keywords**: `if`, `then`, `else`, `for`, `in`, `return`, `stop`, `action`, `func`, `derive`, `from`, `use`, `state`, `view`, `style`, etc.
- **Strings**: Double-quoted string literals with escape sequences
- **Numbers**: Integer and floating-point literals
- **Booleans/Null**: `true`, `false`, `null` constants
- **Comments**: Lines starting with `#`
- **Template interpolation**: `{variable}`, `{obj.prop}`, `{array.[index]}`
- **Operators**: `=`, `==`, `!=`, `+`, `-`, `*`, `/`, `&`, `|`, `?`, `:`

## Platform Support

### GitHub (Public Repositories)

**Status**: Limited by GitHub's policy - custom Linguist grammars in repositories are not automatically used.

**Workaround**: Use the **VS Code extension** (see below) or submit the grammar to the [Linguist repository](https://github.com/github-linguist/linguist).

### GitLab

**Status**: Works automatically via `.gitattributes` + custom grammar

1. The custom grammar in `.github/linguist/rune.tmLanguage` is used
2. `.gitattributes` tells GitLab to apply it
3. No additional steps needed

### Local Development (VS Code)

**Status**: Works out of the box with the included VS Code extension

See `rune-vscode/README.md` for installation instructions.

### VS Code Web (github.dev, gitpod, etc.)

The VS Code extension also works in web-based editors.

## How it works

1. **GitLab**: Reads `.gitattributes` and applies the TextMate grammar from `.github/linguist/`
2. **GitHub**: Limited - would require submission to Linguist project
3. **VS Code**: Loads the extension from `rune-vscode/` which references the grammar

## Testing Locally

1. Clone the repository
2. Install the VS Code extension from `rune-vscode/`:
   - Copy folder to `~/.vscode/extensions/vectrune.rune-0.1.0`
   - Or use `npm install` and package with vsce
3. Open any `.rune` file in VS Code
4. Syntax highlighting will appear automatically

## Next Steps

### To get GitHub syntax highlighting:

Option A: Submit grammar to Linguist
- Fork [github-linguist/linguist](https://github.com/github-linguist/linguist)
- Add to `languages.yml` in the Linguist repo
- Include `rune.tmLanguage` grammar
- Submit pull request
- Once merged, GitHub will use it automatically

Option B: Use VS Code (immediate)
- Install the extension from `rune-vscode/`
- View files with full syntax highlighting in VS Code
- Use github.dev for web-based editing with highlighting

## References

- [Linguist Language Definitions](https://github.com/github-linguist/linguist)
- [TextMate Grammar Guide](https://macromates.com/manual/en/language_grammars)
- [GitLab Syntax Highlighting](https://docs.gitlab.com/ee/user/project/repository/syntax_highlighting.html)
- [VS Code Language Extensions](https://code.visualstudio.com/api/language-extensions/overview)

