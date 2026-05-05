# Vectrune Language Support for VS Code

Adds syntax highlighting and language features for Vectrune (`.rune`) files.

## Features

- ✨ Syntax highlighting for `.rune` files
- 📁 Proper indentation support for Rune syntax
- 🎨 Color-coded keywords, sections, strings, and comments
- 🔍 Template interpolation highlighting for `{variable}` syntax

## Installation

### From VS Code Marketplace (future)

This extension will be available on the [VS Code Marketplace](https://marketplace.visualstudio.com/) soon.

### Local Installation (now)

1. Clone the [Vectrune repository](https://github.com/davethomas11/vectrune)
2. Copy the `rune-vscode` folder to your VS Code extensions directory:
   - **macOS**: `~/.vscode/extensions/`
   - **Linux**: `~/.vscode/extensions/`
   - **Windows**: `%USERPROFILE%\.vscode\extensions\`
3. Rename the folder to `vectrune.rune-<version>` (e.g., `vectrune.rune-0.1.0`)
4. Reload VS Code

Or install directly from the repo:

```bash
cd ~/.vscode/extensions
git clone https://github.com/davethomas11/vectrune.git
cd vectrune/rune-vscode
npm install
```

## Syntax Highlighting

The extension highlights:

- **Sections**: `@App`, `@Route`, `@Page`, `@Logic`, `@Style`, etc.
- **Keywords**: `if`, `then`, `else`, `for`, `in`, `return`, `stop`, `action`, `func`, `derive`, `from`, `use`, etc.
- **Strings**: Double-quoted literals
- **Numbers**: Integers and floats
- **Comments**: Lines starting with `#`
- **Template variables**: `{variable}`, `{obj.prop}`, `{array.[0]}`
- **Operators**: All Rune operators

## Development

To develop the extension locally:

```bash
# Install VS Code DEV tool (if not already installed)
npm install -g @vscode/vsce

# Package the extension
vsce package

# This creates a .vsix file you can install manually in VS Code
```

## Contributing

Found a syntax highlighting issue? Please [open an issue](https://github.com/davethomas11/vectrune/issues) in the main Vectrune repository.

## License

This extension is part of the Vectrune project and follows the same license.


