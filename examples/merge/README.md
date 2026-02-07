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
- **Wildcards**: `[]` matches all elements at that level.
- **Merge Instructions**: `(KEY_FIELD=TARGET on VAL_FIELD from SOURCE)`

#### Merge Instructions Explained
`(KEY_FIELD=TARGET on VAL_FIELD from SOURCE)`
- `KEY_FIELD`: The field name used to identify an object in a list (e.g., `name` or `id`).
- `TARGET`: The value of the `KEY_FIELD` to match (e.g., `allowedIps`).
- `VAL_FIELD`: The field in the matched object that should be updated (e.g., `value` or `data`).
- `SOURCE`: The key in the **input document** from which to pull values.

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

## Future Testing Ideas

To further validate and improve the merge functionality, consider the following test scenarios:

1.  **Deep Nesting**: Test merging into documents with 5+ levels of nesting.
2.  **Array of Arrays**: Test how the selector handles nested lists.
3.  **Conflict Resolution**: Define behavior when the target field already exists but has a different type (e.g., merging a list into a string field).
4.  **Empty Documents**: Verify behavior when merging into an empty base document or using an empty input document.
5.  **Partial Matches**: Test selectors that match multiple locations but not all of them contain the target fields.
6.  **Performance**: Test merging large IP lists (10,000+) into large configuration files.
7.  **Format Cross-Compatibility**: Rigorous testing of merging between all supported formats (Rune, YAML, JSON, XML).
8.  **Malformed Selectors**: Ensure clear error messages are provided for invalid selector syntax.
