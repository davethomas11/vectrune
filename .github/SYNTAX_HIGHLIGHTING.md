# Rune Syntax Highlighting Setup

This repository includes syntax highlighting support for `.rune` files on GitLab, GitHub, and other platforms that use Linguist.

## Files

- `.gitattributes` - Tells Linguist to recognize `.rune` files as the "Rune" language
- `languages.yml` - Language definition metadata
- `.github/linguist/rune.tmLanguage` - TextMate grammar for syntax highlighting

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

## How it works

1. When you push to GitLab or GitHub, the platform runs Linguist to detect the language
2. Linguist reads `.gitattributes` to find custom language definitions
3. It applies the TextMate grammar rules to provide syntax highlighting

## Testing

To test locally, you can:

1. Clone the repository to your local machine
2. View `.rune` files in the examples directory
3. Push to GitLab/GitHub and verify syntax highlighting appears

## Notes

- The TextMate grammar (`.tmLanguage`) is XML-based and uses regex patterns
- Colors and styling are applied by the hosting platform's theme
- This works automatically on GitHub and GitLab without additional configuration
- VS Code and other editors can also use these grammar files with appropriate extensions

## References

- [Linguist Language Definitions](https://github.com/github-linguist/linguist)
- [TextMate Grammar Guide](https://macromates.com/manual/en/language_grammars)
- [GitLab Syntax Highlighting](https://docs.gitlab.com/ee/user/project/repository/syntax_highlighting.html)

