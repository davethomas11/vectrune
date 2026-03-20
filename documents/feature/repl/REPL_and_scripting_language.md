# Vectrune REPL and Scripting Language Format

## Feature Overview

This feature introduces a Read-Eval-Print Loop (REPL) for Vectrune, allowing users to interactively execute commands, inspect memory, and test scripts. Additionally, it defines a procedural scripting language format for writing and executing scripts in Vectrune.

---

### REPL

- Interactive shell for Vectrune
- Supports command execution, memory inspection, and script testing
- Provides immediate feedback and error reporting
- Useful for rapid prototyping and debugging

#### Example Usage

```
vectrune repl
> memory.get "books"
[ { id: 1, title: "The Rust Book" }, ... ]
> books = memory.get "books"
> books.max it.id
2
> exit
```

---

### Procedural Scripting Language Format

- Scripts are written in .rune files
- No section headers (@Script, run:) required
- Each line is a command, assignment, or expression
- Executed top-to-bottom, like traditional scripting languages
- Can be executed via CLI or REPL
- Scripts can indicate Vectrune scripting language with a shebang line

#### Example Script

```
#!/usr/bin/env vectrune
# Load books
books = json.load books.json
# Find max id
max_id = books.max it.id
# Add new book
new_book = { id: max_id + 1, title: "New Book" }
memory.append "books" new_book
print books as xml
```

---

## Next Steps

- Implement REPL command in CLI
- Extend parser to support procedural scripting format (no section headers)
- Add documentation and examples
