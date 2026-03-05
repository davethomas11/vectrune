# Walkthrough: memory_api.rune Example

This walkthrough explains the core features of Vectrune using the `memory_api.rune` example.

## 1. App Declaration
```rune
@App
name = Memory Example API
version = 1.0
type = REST
run:
    skaters = load-rune skateboarders.rune
    set-memory skaters
```
- Declares the app name, version, type (REST), and an initialization block that loads data and stores it in memory.

## 2. Schema Definition
```rune
@Schema/Skater
fields:
    name: String
    age: Integer
    style: String
```
- Defines a schema for validation and structure.

## 3. REST Routes
```rune
@Route/GET /Skaters
run:
    skaters = get-memory skaters
    return skaters

@Route/PUT /Skaters
run:
    skaters = get-memory skaters
    new-skater = parse-json body
    validate new-skater #Skater
    append skaters.Skateboarder.record new-skater
    set-memory skaters
    return skaters
```
- GET returns the current list of skaters from memory.
- PUT parses a new skater from the request, validates it, appends it, updates memory, and returns the new list.

## 4. Key Builtins Used
- `load-rune`, `set-memory`, `get-memory`, `parse-json`, `validate`, `append`, `return`

## 5. Try it in the Playground
- Edit and run this example in the playground to see how memory/state and validation work in Vectrune.
