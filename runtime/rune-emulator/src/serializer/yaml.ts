// ============================================================================
// YAML serializer — hand-rolled, no external dependencies
// Handles: null, booleans, numbers, strings, arrays, plain objects
// ============================================================================

export function toYaml(value: unknown, indent = 0): string {
  const prefix = '  '.repeat(indent);

  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    return formatYamlString(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => {
        const rendered = toYaml(item, indent + 1);
        // If the rendered value is multi-line (object/array), indent it
        if (rendered.includes('\n')) {
          return `${prefix}- \n${addIndent(rendered, indent + 1)}`;
        }
        return `${prefix}- ${rendered}`;
      })
      .join('\n');
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    return keys
      .map((key) => {
        const val = obj[key];
        const renderedVal = toYaml(val, indent + 1);
        if (
          val !== null &&
          typeof val === 'object' &&
          !Array.isArray(val) &&
          Object.keys(val as object).length > 0
        ) {
          return `${prefix}${key}:\n${addIndent(renderedVal, indent + 1)}`;
        }
        if (Array.isArray(val) && val.length > 0) {
          return `${prefix}${key}:\n${addIndent(renderedVal, indent + 1)}`;
        }
        return `${prefix}${key}: ${renderedVal}`;
      })
      .join('\n');
  }

  return String(value);
}

function addIndent(yaml: string, indent: number): string {
  const prefix = '  '.repeat(indent);
  return yaml
    .split('\n')
    .map((line) => (line.trim() ? `${prefix}${line.trimStart()}` : line))
    .join('\n');
}

function formatYamlString(s: string): string {
  // Strings that need quoting
  if (
    s === '' ||
    s === 'null' || s === 'true' || s === 'false' ||
    /^\d/.test(s) || // starts with a digit
    s.includes(':') || s.includes('#') ||
    s.includes('\n') || s.includes('"') ||
    s.startsWith('{') || s.startsWith('[') ||
    s.startsWith('- ') || s.startsWith('  ')
  ) {
    // Use double-quote style with escaping
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return s;
}
