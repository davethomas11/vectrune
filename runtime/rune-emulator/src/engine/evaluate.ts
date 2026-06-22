// ============================================================================
// Expression evaluator — standalone, no DOM or ctx() dependency
//
// Adapted from rune-web/src/expression.ts but takes a plain scope object
// rather than relying on the global context singleton.
// ============================================================================

export type Scope = Record<string, unknown>;

const MAX_DEPTH = 64;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function valueToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function normalizeLiteral(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/** Split on a delimiter only at paren/bracket depth === 0 */
export function splitTopLevel(s: string, delim: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let inStr = false;
  let strChar = '';
  let start = 0;
  const dLen = delim.length;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === strChar) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = true; strChar = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { depth--; continue; }
    if (depth === 0 && s.slice(i, i + dLen) === delim) {
      results.push(s.slice(start, i));
      start = i + dLen;
      i += dLen - 1;
    }
  }
  results.push(s.slice(start));
  return results;
}

export function includesTopLevel(s: string, delim: string): boolean {
  return splitTopLevel(s, delim).length > 1;
}

// ---------------------------------------------------------------------------
// Path segment splitter (supports [bracket] and [].(filter) segments)
// ---------------------------------------------------------------------------

export function splitPathSegments(expr: string): string[] {
  const segs: string[] = [];
  let i = 0;
  let current = '';

  while (i < expr.length) {
    const ch = expr[i];
    if (ch === '.') {
      // Check for [].(filter) shorthand
      if (expr.slice(i, i + 4) === '[].(') {
        if (current) { segs.push(current); current = ''; }
        const close = expr.indexOf(')', i + 4);
        if (close !== -1) {
          segs.push(expr.slice(i + 1, close + 1));
          i = close + 1;
        } else {
          i++;
        }
        continue;
      }
      if (current) { segs.push(current); current = ''; }
      i++;
      continue;
    }
    if (ch === '[') {
      if (current) { segs.push(current); current = ''; }
      const close = expr.indexOf(']', i + 1);
      if (close !== -1) {
        segs.push(expr.slice(i, close + 1));
        i = close + 1;
      } else {
        i++;
      }
      continue;
    }
    current += ch;
    i++;
  }
  if (current) segs.push(current);
  return segs;
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

export function resolvePath(expr: string, scope: Scope): unknown {
  const segments = splitPathSegments(expr);
  if (!segments.length) return undefined;

  let current: unknown = (scope as Record<string, unknown>)[segments[0]];
  if (current === undefined) return undefined;

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (current === null || current === undefined) return undefined;

    if (Array.isArray(current) && segment === 'length') {
      current = current.length;
    } else if (
      Array.isArray(current) &&
      segment.startsWith('[].(') &&
      segment.endsWith(')')
    ) {
      const condition = segment.slice(4, -1);
      const match = current.find((item: unknown) => {
        const innerScope = Object.assign({}, scope, { it: item });
        return Boolean(evaluateExpression(condition, innerScope, 0));
      });
      if (match !== undefined) current = match;
      else return undefined;
    } else if (segment.startsWith('[') && segment.endsWith(']')) {
      const innerExpr = segment.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scope, 0);
      current = (current as Record<string, unknown>)[valueToString(lookup)];
    } else {
      current = (current as Record<string, unknown>)[segment];
    }
  }

  return current;
}

// ---------------------------------------------------------------------------
// Literal parser
// ---------------------------------------------------------------------------

export function tryParseLiteral(expr: string): unknown {
  const t = expr.trim();
  if (t === '') return undefined;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (!Number.isNaN(Number(t)) && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return normalizeLiteral(t);
  }
  if (t.startsWith('[') || t.startsWith('{')) {
    try { return JSON.parse(t); } catch (_) { return undefined; }
  }
  return undefined;
}

export function resolveValue(expr: string, scope: Scope): unknown {
  const lit = tryParseLiteral(expr);
  if (lit !== undefined) return lit;
  const path = resolvePath(expr, scope);
  if (path !== undefined) return path;
  return normalizeLiteral(expr);
}

// ---------------------------------------------------------------------------
// Main evaluateExpression
// ---------------------------------------------------------------------------

export function evaluateExpression(expr: string, scope: Scope, depth = 0): unknown {
  if (depth > MAX_DEPTH) return undefined;
  const next = depth + 1;
  let t = String(expr ?? '').trim();
  if (!t) return undefined;

  // Strip balanced outer parens
  while (t.startsWith('(') && t.endsWith(')')) {
    let d = 0;
    let matched = true;
    for (let i = 0; i < t.length - 1; i++) {
      if (t[i] === '(') d++;
      if (t[i] === ')') d--;
      if (d === 0) { matched = false; break; }
    }
    if (!matched) break;
    t = t.slice(1, -1).trim();
  }

  // Negation
  if (t.startsWith('!')) {
    return !Boolean(evaluateExpression(t.slice(1).trim(), scope, next));
  }

  // Collection methods: any, filter, find, max, find-index
  const methodMatch = t.match(
    /^(.+?)\.(any|filter|find|find-index|max|min|sum|mask)(?:\(([^)]*)\)|\s+(.+?))(?:\.(length))?$/,
  );
  if (methodMatch) {
    const [, receiver, method, parenArgs, spaceArgs, trailingProp] = methodMatch;
    const argsStr = (parenArgs !== undefined ? parenArgs : spaceArgs ?? '').trim();
    const collection = evaluateExpression(receiver, scope, next);

    let result: unknown = undefined;

    if (Array.isArray(collection)) {
      if (method === 'mask') {
        const player = valueToString(evaluateExpression(argsStr, scope, next));
        result = (collection as unknown[]).reduce((acc: number, cell: unknown, i: number) => {
          return valueToString(cell) === player ? acc | (1 << i) : acc;
        }, 0);
      } else if (method === 'any' || method === 'filter' || method === 'find' || method === 'find-index') {
        const arrowMatch = argsStr.match(/^(\w+)\s*=>\s*(.+)$/);
        const [paramName, predExpr] = arrowMatch ? [arrowMatch[1], arrowMatch[2]] : ['it', argsStr];

        if (method === 'any') {
          result = collection.some((item: unknown) => {
            return Boolean(evaluateExpression(predExpr, Object.assign({}, scope, { [paramName]: item }), next));
          });
        } else if (method === 'filter') {
          result = collection.filter((item: unknown) => {
            return Boolean(evaluateExpression(predExpr, Object.assign({}, scope, { [paramName]: item }), next));
          });
        } else if (method === 'find') {
          result = collection.find((item: unknown) => {
            return Boolean(evaluateExpression(predExpr, Object.assign({}, scope, { [paramName]: item }), next));
          }) ?? null;
        } else if (method === 'find-index') {
          result = collection.findIndex((item: unknown) => {
            return Boolean(evaluateExpression(predExpr, Object.assign({}, scope, { [paramName]: item }), next));
          });
        }
      } else if (method === 'max') {
        result = collection.reduce((max: unknown, item: unknown) => {
          const val = evaluateExpression(argsStr, Object.assign({}, scope, { it: item }), next);
          return max === undefined || (val as number) > (max as number) ? val : max;
        }, undefined as unknown);
      } else if (method === 'min') {
        result = collection.reduce((min: unknown, item: unknown) => {
          const val = evaluateExpression(argsStr, Object.assign({}, scope, { it: item }), next);
          return min === undefined || (val as number) < (min as number) ? val : min;
        }, undefined as unknown);
      } else if (method === 'sum') {
        result = collection.reduce((sum: number, item: unknown) => {
          return sum + Number(evaluateExpression(argsStr, Object.assign({}, scope, { it: item }), next) ?? 0);
        }, 0);
      }
    }

    if (trailingProp === 'length' && result !== undefined && typeof (result as unknown[]).length !== 'undefined') {
      return (result as unknown[]).length;
    }
    return result;
  }

  // Ternary
  if (includesTopLevel(t, ' ? ')) {
    const parts = splitTopLevel(t, ' ? ');
    const condition = parts[0];
    const rest = parts.slice(1).join(' ? ');
    if (includesTopLevel(rest, ' : ')) {
      const colonParts = splitTopLevel(rest, ' : ');
      return Boolean(evaluateExpression(condition, scope, next))
        ? evaluateExpression(colonParts[0], scope, next)
        : evaluateExpression(colonParts.slice(1).join(' : '), scope, next);
    }
  }

  // Logical
  if (includesTopLevel(t, ' or ')) {
    return splitTopLevel(t, ' or ').some(p => Boolean(evaluateExpression(p, scope, next)));
  }
  if (includesTopLevel(t, ' and ')) {
    return splitTopLevel(t, ' and ').every(p => Boolean(evaluateExpression(p, scope, next)));
  }

  // Comparisons
  if (includesTopLevel(t, ' != ')) {
    const [l, r] = splitTopLevel(t, ' != ');
    return valueToString(evaluateExpression(l, scope, next)) !== valueToString(evaluateExpression(r, scope, next));
  }
  if (includesTopLevel(t, ' == ')) {
    const [l, r] = splitTopLevel(t, ' == ');
    return valueToString(evaluateExpression(l, scope, next)) === valueToString(evaluateExpression(r, scope, next));
  }
  if (includesTopLevel(t, ' >= ')) {
    const [l, r] = splitTopLevel(t, ' >= ');
    return (evaluateExpression(l, scope, next) as number) >= (evaluateExpression(r, scope, next) as number);
  }
  if (includesTopLevel(t, ' <= ')) {
    const [l, r] = splitTopLevel(t, ' <= ');
    return (evaluateExpression(l, scope, next) as number) <= (evaluateExpression(r, scope, next) as number);
  }
  if (includesTopLevel(t, ' > ')) {
    const [l, r] = splitTopLevel(t, ' > ');
    return (evaluateExpression(l, scope, next) as number) > (evaluateExpression(r, scope, next) as number);
  }
  if (includesTopLevel(t, ' < ')) {
    const [l, r] = splitTopLevel(t, ' < ');
    return (evaluateExpression(l, scope, next) as number) < (evaluateExpression(r, scope, next) as number);
  }

  // Arithmetic: +, -, *, /
  if (includesTopLevel(t, ' + ')) {
    return splitTopLevel(t, ' + ').reduce((acc: unknown, part: string, idx: number) => {
      const val = evaluateExpression(part, scope, next);
      if (idx === 0) return val;
      if (typeof acc === 'number' && typeof val === 'number') return acc + val;
      return `${valueToString(acc)}${valueToString(val)}`;
    }, undefined as unknown);
  }
  if (includesTopLevel(t, ' - ')) {
    const parts = splitTopLevel(t, ' - ');
    const first = evaluateExpression(parts[0], scope, next) as number;
    return parts.slice(1).reduce((acc: number, p: string) => acc - (evaluateExpression(p, scope, next) as number), first);
  }
  if (includesTopLevel(t, ' * ')) {
    const parts = splitTopLevel(t, ' * ');
    return parts.reduce((acc: number, p: string, idx: number) => {
      const val = evaluateExpression(p, scope, next) as number;
      return idx === 0 ? val : acc * val;
    }, 1);
  }
  if (includesTopLevel(t, ' / ')) {
    const parts = splitTopLevel(t, ' / ');
    const first = evaluateExpression(parts[0], scope, next) as number;
    return parts.slice(1).reduce((acc: number, p: string) => acc / (evaluateExpression(p, scope, next) as number), first);
  }

  // Bitwise AND
  if (includesTopLevel(t, ' & ')) {
    const parts = splitTopLevel(t, ' & ');
    if (parts.length === 2) {
      return (evaluateExpression(parts[0], scope, next) as number) & (evaluateExpression(parts[1], scope, next) as number);
    }
  }

  // full (all items truthy)
  if (t.startsWith('full ')) {
    const collection = evaluateExpression(t.slice(5), scope, next);
    return Array.isArray(collection) && collection.every((item: unknown) => valueToString(item) !== '');
  }

  // swap
  if (t.startsWith('swap ')) {
    const tokens = t.split(/\s+/);
    const current = valueToString(evaluateExpression(tokens[1], scope, next));
    const left = valueToString(evaluateExpression(tokens[2], scope, next));
    const right = valueToString(evaluateExpression(tokens[3], scope, next));
    return current === left ? right : left;
  }

  // Fallback
  return resolveValue(t, scope);
}
