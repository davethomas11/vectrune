# Vectrune Merge Ability

The `--merge-with` flag allows you to merge data from a primary input document into a base document using a powerful path-based selector. This is particularly useful for updating configuration files with dynamic data (like IP lists, environment variables, etc.).

## Syntax

```bash
vectrune -i <input_format> <input_file> --merge-with '<base_file>@<selector>' -o <output_format>
```

### Selector Syntax

The selector follows a dot-notation path with support for:
- **Literal paths**: `environment.dev`
- **Groupings**: `(preview|prod)` matches either `preview` or `prod`.
- **Wildcards**: `[]` matches each array item or object value; chain them as `[][].` to traverse arrays of arrays.
- **Merge Instructions**: `(KEY_FIELD=TARGET on VAL_FIELD from SOURCE)`
- **Direct field updates**: `(FIELD from SOURCE)` assigns a value to the selected object.

#### Merge Instructions Explained
`(KEY_FIELD=TARGET on VAL_FIELD from SOURCE)`
- `KEY_FIELD`: The field name used to identify an object in a list (e.g., `name` or `id`).
- `TARGET`: The value of the `KEY_FIELD` to match (e.g., `allowedIps`).
- `VAL_FIELD`: The field in the matched object that should be updated (e.g., `value` or `data`).
- `SOURCE`: A root-relative key path in the **input document** (for example `Ips` or `api.keys`).

Merge instructions replace the destination value; they do not append to it. An existing destination must have the same JSON type as the source, otherwise the merge fails with a type-conflict error. A destination field may be absent and will be created. Group alternatives or wildcard items that do not match are skipped, but the selector must update at least one target. An empty source array is valid; a missing source path is an error. For an empty object base, a root-level instruction such as `(settings from settings)` creates the destination field.

Malformed selectors, missing source paths, and selectors that match no targets return explicit errors. Base files may be Rune, JSON, YAML, or XML; the input and output formats are selected independently using the regular `-i` and `-o` options. XML treats the outer element as a document wrapper, repeated sibling elements as arrays, leaf text as strings, empty elements as null, attributes as `@name` fields, and mixed element text as `$text`.

## Examples

### 1. Merging into a list-of-objects (YAML)

**Base Document (`config.yaml`):**
```yaml
environment:
 preview:
  - name: url
    value: preview.com
  - name: allowedIps
    value: []
```

**Input Document (`ip-list.yaml`):**
```yaml
Ips:
 - 12.12.12.10
 - 12.12.12.13
```

**Command:**
```bash
vectrune -i yaml examples/merge/ip-list.yaml --merge-with 'examples/merge/config.yaml@environment.preview.[].(name=allowedIps on value from Ips)' -o yaml
```

### 2. Custom Field Names

If your config uses different field names:

**Base Document (`config_alt.yaml`):**
```yaml
environment:
 preview:
  - id: allowedIps
    data: []
```

**Command:**
```bash
vectrune -i yaml examples/merge/ip-list.yaml --merge-with 'examples/merge/config_alt.yaml@environment.preview.[].(id=allowedIps on data from Ips)' -o yaml
```

### 3. Merging into multiple environments

Using groupings and wildcards:
```bash
vectrune -i yaml examples/merge/ip-list.yaml --merge-with 'examples/merge/config.yaml@environment.(preview|prod).[].(name=allowedIps on value from Ips)' -o yaml
```

### 4. Rune-to-Rune Merge

Update permissions in a Rune document using data from another Rune document.

**Base (`base.rune`):**
```rune
@Roles
- name: "admin"
  permissions: []
```

**Patch (`patch.rune`):**
```rune
@AdminPerms
perms:
 - "read"
 - "write"
```

**Command:**
```bash
vectrune examples/merge/patch.rune --merge-with 'examples/merge/base.rune@Roles.[].(name=admin on permissions from perms)' -o rune
```

### 5. JSON-to-YAML Merge

Merge API keys from a JSON file into a YAML config.

**Command:**
```bash
vectrune -i json examples/merge/external_data.json --merge-with 'examples/merge/config.yaml@api_config.(keys from api_keys)' -o yaml
```

## Additional Supported Cases

Nested paths and nested arrays can be traversed to any depth. For example, `services.[].regions.[].(name=allowedIps on value from Ips)` updates matching entries within nested arrays. The merge tests also cover 10,000-element source arrays, partial matches, empty sources and bases, type conflicts, malformed selectors, and Rune/JSON/YAML/XML base files.
