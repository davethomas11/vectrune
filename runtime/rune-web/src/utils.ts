// ============================================================================
// Pure utility functions — no dependencies on other runtime modules
// ============================================================================

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Check whether `delimiter` appears at the top level of `input`
 * (i.e. not inside quotes, parens, brackets, or braces).
 */
export function includesTopLevel(input: string, delimiter: string): boolean {
  let depth = 0;
  let inQuotes = false;
  let quoteChar = '';
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if ((ch === '"' || ch === "'") && input[i - 1] !== '\\') {
      if (inQuotes && ch === quoteChar) { inQuotes = false; quoteChar = ''; }
      else if (!inQuotes) { inQuotes = true; quoteChar = ch; }
      continue;
    }
    if (!inQuotes) {
      if (ch === '(' || ch === '[' || ch === '{') depth += 1;
      if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
      if (depth === 0 && input.slice(i, i + delimiter.length) === delimiter) return true;
    }
  }
  return false;
}

/**
 * Split `input` on `delimiter` but only at the top level
 * (respecting quotes, parens, brackets, braces).
 */
export function splitTopLevel(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if ((ch === '"' || ch === "'") && input[i - 1] !== '\\') {
      if (inQuotes && ch === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes) {
        inQuotes = true;
        quoteChar = ch;
      }
      current += ch;
      continue;
    }

    if (!inQuotes) {
      if (ch === '[' || ch === '{' || ch === '(') depth += 1;
      if (ch === ']' || ch === '}' || ch === ')') depth -= 1;
      if (depth === 0 && input.slice(i, i + delimiter.length) === delimiter) {
        parts.push(current.trim());
        current = '';
        i += delimiter.length - 1;
        continue;
      }
    }

    current += ch;
  }

  if (current.trim().length > 0) {
    parts.push(current.trim());
  }

  return parts;
}

/** Strip surrounding quotes from a literal value. */
export function normalizeLiteral(value: string): string {
  const trimmed = String(value || '').trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/** Convert any value to a display string. */
export function valueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch (_err) {
    return '';
  }
}

/** Process escape sequences in a template string (\\n, \\{, \\}, etc). */
export function decodeEscapes(value: string): string {
  const OPEN = '\uE000';
  const CLOSE = '\uE001';
  const input = String(value || '');
  let output = '';

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '\\' && i + 1 < input.length) {
      i += 1;
      const next = input[i];
      if (next === 'n') output += '\n';
      else if (next === 'r') output += '\r';
      else if (next === 't') output += '\t';
      else if (next === '"') output += '"';
      else if (next === "'") output += "'";
      else if (next === '\\') output += '\\';
      else if (next === '{') output += OPEN;
      else if (next === '}') output += CLOSE;
      else output += next;
      continue;
    }
    output += ch;
  }

  return output;
}

/** Expand %i18n.key% markers into {i18n.key} interpolation expressions. */
export function expandPercentI18n(value: string): string {
  const input = String(value || '');
  let output = '';

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch !== '%') {
      output += ch;
      continue;
    }

    let inner = '';
    let closed = false;
    for (i += 1; i < input.length; i += 1) {
      if (input[i] === '%') {
        closed = true;
        break;
      }
      inner += input[i];
    }

    if (closed && inner.startsWith('i18n.')) {
      output += `{${inner}}`;
    } else {
      output += `%${inner}`;
      if (closed) output += '%';
    }
  }

  return output;
}
