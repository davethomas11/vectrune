// ============================================================================
// XML serializer — hand-rolled, no external dependencies
// Converts plain JS values into well-formed XML.
//
// Convention:
//   - objects → each key becomes a child element
//   - arrays  → repeated <item> elements (or parent tag name repeated)
//   - primitives → text content
// ============================================================================

export function toXml(value: unknown, rootTag = 'root', indent = 0): string {
  const pad = '  '.repeat(indent);

  if (value === null || value === undefined) {
    return `${pad}<${rootTag} nil="true"/>`;
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return `${pad}<${rootTag}>${escapeXml(String(value))}</${rootTag}>`;
  }

  if (typeof value === 'string') {
    return `${pad}<${rootTag}>${escapeXml(value)}</${rootTag}>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${pad}<${rootTag}/>`;
    }
    // Derive a singular item tag from the root tag (strip trailing 's' or use 'item')
    const itemTag = deriveItemTag(rootTag);
    const children = value
      .map((item) => toXml(item, itemTag, indent + 1))
      .join('\n');
    return `${pad}<${rootTag}>\n${children}\n${pad}</${rootTag}>`;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return `${pad}<${rootTag}/>`;
    }
    const children = keys
      .map((key) => toXml(obj[key], sanitizeTag(key), indent + 1))
      .join('\n');
    return `${pad}<${rootTag}>\n${children}\n${pad}</${rootTag}>`;
  }

  return `${pad}<${rootTag}>${escapeXml(String(value))}</${rootTag}>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeTag(tag: string): string {
  // XML tag names must start with letter or underscore
  const clean = tag.replace(/[^A-Za-z0-9_.-]/g, '_');
  return /^[A-Za-z_]/.test(clean) ? clean : `_${clean}`;
}

function deriveItemTag(pluralTag: string): string {
  if (pluralTag.endsWith('ies')) return pluralTag.slice(0, -3) + 'y';
  if (pluralTag.endsWith('ses') || pluralTag.endsWith('xes') || pluralTag.endsWith('zes')) {
    return pluralTag.slice(0, -2);
  }
  if (pluralTag.endsWith('s') && pluralTag.length > 2) return pluralTag.slice(0, -1);
  return 'item';
}
