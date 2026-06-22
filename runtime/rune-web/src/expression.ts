// ============================================================================
// Expression evaluation engine
// ============================================================================

import { ctx } from './context';
import { splitPathSegments, buildScope } from './scope';
import {
  includesTopLevel,
  splitTopLevel,
  normalizeLiteral,
  valueToString,
} from './utils';
import type { Scope } from './types';

const MAX_DEPTH = 64;

// ---------------------------------------------------------------------------
// tryParseLiteral — attempt to parse expr as a literal value
// ---------------------------------------------------------------------------

export function tryParseLiteral(expr: string, scope?: Scope): unknown {
  const trimmed = String(expr || '').trim();
  if (trimmed === '') return undefined;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (!Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed))
    return Number(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return normalizeLiteral(trimmed);
  }
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const keys = scope
        ? Object.keys(scope).filter(
            (k) => k !== 'this' && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(k),
          )
        : [];
      const vals = keys.map((k) => scope![k]);
      return new Function(...keys, `return (${trimmed});`)(...vals);
    } catch (_err) {
      return undefined;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// resolvePath — walk a dotted/bracketed path against a scope
// ---------------------------------------------------------------------------

export function resolvePath(expr: string, scope: Scope): unknown {
  const segments = splitPathSegments(expr);
  if (!segments.length) return undefined;

  let current: unknown = (scope as Record<string, unknown>)[segments[0]];
  if (current === undefined) return undefined;

  for (let i = 1; i < segments.length; i += 1) {
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
// resolveValue — try literal, then path, then normalized literal fallback
// ---------------------------------------------------------------------------

export function resolveValue(expr: string, scope: Scope): unknown {
  const literal = tryParseLiteral(expr, scope);
  if (literal !== undefined) return literal;
  const pathValue = resolvePath(expr, scope);
  if (pathValue !== undefined) return pathValue;
  return normalizeLiteral(expr);
}

// ---------------------------------------------------------------------------
// parseHelperCall / callHelper
// ---------------------------------------------------------------------------

export function parseHelperCall(
  expr: string,
): { name: string; args: string[] } | null {
  const trimmed = String(expr || '').trim();
  if (!trimmed) return null;

  const { helperDefinitions } = ctx();

  const parenMatch = trimmed.match(/^([A-Za-z_][\w-]*)\((.*)?\)$/);
  if (parenMatch && helperDefinitions[parenMatch[1]]) {
    return {
      name: parenMatch[1],
      args: parenMatch[2] ? splitTopLevel(parenMatch[2], ',') : [],
    };
  }

  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace > 0) {
    const name = trimmed.slice(0, firstSpace);
    if (helperDefinitions[name]) {
      return {
        name,
        args: trimmed
          .slice(firstSpace + 1)
          .split(/\s+/)
          .filter(Boolean),
      };
    }
  }

  if (helperDefinitions[trimmed]) {
    return { name: trimmed, args: [] };
  }

  return null;
}

export function callHelper(
  name: string,
  args: unknown[],
  scope: Scope,
  depth: number,
): unknown {
  const { helperDefinitions } = ctx();
  const helper = helperDefinitions[name];
  if (!helper) return undefined;

  const helperLocals: Record<string, unknown> = Object.assign({}, scope || {});
  (helper.params || []).forEach((param, index) => {
    helperLocals[param] = args[index];
  });

  for (const line of helper.body || []) {
    const trimmed = String(line || '').trim();
    if (trimmed.startsWith('return ')) {
      return evaluateExpression(
        trimmed.slice(7),
        buildScope(helperLocals),
        depth,
      );
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// evaluateExpression — the main expression evaluator
// ---------------------------------------------------------------------------

export function evaluateExpression(
  expr: string,
  scope: Scope,
  depth?: number,
): unknown {
  if ((depth || 0) > MAX_DEPTH) return undefined;
  const nextDepth = (depth || 0) + 1;
  let trimmed = String(expr || '').trim();
  if (!trimmed) return undefined;

  // --- @selector syntax ---
  if (trimmed.startsWith('@')) {
    let selector = '';
    let rest = '';
    if (trimmed.startsWith('@[')) {
      const closeIdx = trimmed.indexOf(']');
      if (closeIdx > 1) {
        selector = trimmed.slice(2, closeIdx);
        rest = trimmed.slice(closeIdx + 1);
      }
    } else {
      const match = trimmed.match(/^@([\w-]+)(.*)$/);
      if (match) {
        selector = '.' + match[1];
        rest = match[2];
      }
    }

    if (selector && typeof document !== 'undefined') {
      const el = document.querySelector(selector);
      if (el) {
        if (!rest) return el;
        if (rest.startsWith('.')) {
          return resolvePath(rest.slice(1), el as unknown as Scope);
        }
      }
      return undefined;
    }
  }

  // --- Strip balanced outer parens ---
  while (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    let d = 0;
    let matched = true;
    for (let i = 0; i < trimmed.length - 1; i += 1) {
      if (trimmed[i] === '(') d += 1;
      if (trimmed[i] === ')') d -= 1;
      if (d === 0) {
        matched = false;
        break;
      }
    }
    if (!matched) break;
    trimmed = trimmed.slice(1, -1).trim();
  }

  // --- Negation ---
  if (trimmed.startsWith('!')) {
    return !Boolean(
      evaluateExpression(trimmed.slice(1).trim(), scope, nextDepth),
    );
  }

  // --- Helper call ---
  const helperCall = parseHelperCall(trimmed);
  if (helperCall) {
    return callHelper(
      helperCall.name,
      helperCall.args.map((arg) => evaluateExpression(arg, scope, nextDepth)),
      scope,
      nextDepth,
    );
  }

  // --- Collection methods: any, mask, filter, find, max (+ trailing .length) ---
  const methodMatch = trimmed.match(
    /^(.+?)\.(any|mask|filter|find|max)(?:\((.*)\)|\s+(.+?))(?:\.(length))?$/,
  );
  if (methodMatch) {
    const [, receiver, method, parenArgs, spaceArgs, trailingProp] =
      methodMatch;
    const argsStr = (
      parenArgs !== undefined ? parenArgs : spaceArgs
    ).trim();
    const collection = evaluateExpression(receiver, scope, nextDepth);

    let result: unknown = undefined;
    if (method === 'mask' && Array.isArray(collection)) {
      const player = valueToString(
        evaluateExpression(argsStr, scope, nextDepth),
      );
      result = (collection as unknown[]).reduce(
        (acc: number, cell: unknown, i: number) => {
          return valueToString(cell) === player ? acc | (1 << i) : acc;
        },
        0,
      );
    } else if (
      (method === 'any' ||
        method === 'find' ||
        method === 'filter' ||
        method === 'max') &&
      Array.isArray(collection)
    ) {
      const arrowMatch = argsStr.match(/^(\w+)\s*=>\s*(.+)$/);
      const [paramName, predExpr] = arrowMatch
        ? [arrowMatch[1], arrowMatch[2]]
        : ['it', argsStr];

      if (method === 'any') {
        result = collection.some((item: unknown) => {
          const innerScope = Object.assign({}, scope, {
            [paramName]: item,
          });
          return Boolean(
            evaluateExpression(predExpr, innerScope, nextDepth),
          );
        });
      } else if (method === 'filter') {
        result = collection.filter((item: unknown) => {
          const innerScope = Object.assign({}, scope, {
            [paramName]: item,
          });
          return Boolean(
            evaluateExpression(predExpr, innerScope, nextDepth),
          );
        });
      } else if (method === 'find') {
        result = collection.find((item: unknown) => {
          const innerScope = Object.assign({}, scope, {
            [paramName]: item,
          });
          return Boolean(
            evaluateExpression(predExpr, innerScope, nextDepth),
          );
        });
      } else if (method === 'max') {
        result = collection.reduce(
          (max: unknown, item: unknown) => {
            const innerScope = Object.assign({}, scope, {
              [paramName]: item,
            });
            const val = evaluateExpression(predExpr, innerScope, nextDepth);
            return max === undefined || (val as number) > (max as number)
              ? val
              : max;
          },
          undefined as unknown,
        );
      }
    }

    if (
      trailingProp === 'length' &&
      result !== undefined &&
      (result as unknown[]).length !== undefined
    ) {
      return (result as unknown[]).length;
    }
    return result;
  }

  // --- Ternary ---
  if (includesTopLevel(trimmed, ' ? ')) {
    const parts = splitTopLevel(trimmed, ' ? ');
    const condition = parts[0];
    const rest = parts.slice(1).join(' ? ');
    if (includesTopLevel(rest, ' : ')) {
      const colonParts = splitTopLevel(rest, ' : ');
      const trueExpr = colonParts[0];
      const falseExpr = colonParts.slice(1).join(' : ');
      return Boolean(evaluateExpression(condition, scope, nextDepth))
        ? evaluateExpression(trueExpr, scope, nextDepth)
        : evaluateExpression(falseExpr, scope, nextDepth);
    }
  }

  // --- Nullish coalescing ---
  if (includesTopLevel(trimmed, ' ?? ')) {
    const parts = splitTopLevel(trimmed, ' ?? ');
    const leftRaw = parts[0].trim();
    let left = evaluateExpression(leftRaw, scope, nextDepth);
    if (typeof left === 'string' && left === leftRaw && resolvePath(leftRaw, scope) === undefined && tryParseLiteral(leftRaw, scope) === undefined) {
      left = undefined;
    }
    if (left !== undefined && left !== null && left !== '') {
      return left;
    }
    return evaluateExpression(parts.slice(1).join(' ?? '), scope, nextDepth);
  }

  // --- Logical operators ---
  if (includesTopLevel(trimmed, ' or ')) {
    return splitTopLevel(trimmed, ' or ').some((part) =>
      Boolean(evaluateExpression(part, scope, nextDepth)),
    );
  }
  if (includesTopLevel(trimmed, ' and ')) {
    return splitTopLevel(trimmed, ' and ').every((part) =>
      Boolean(evaluateExpression(part, scope, nextDepth)),
    );
  }

  // --- Comparison ---
  if (includesTopLevel(trimmed, ' != ')) {
    const [left, right] = splitTopLevel(trimmed, ' != ');
    return (
      valueToString(evaluateExpression(left, scope, nextDepth)) !==
      valueToString(evaluateExpression(right, scope, nextDepth))
    );
  }
  if (includesTopLevel(trimmed, ' == ')) {
    const [left, right] = splitTopLevel(trimmed, ' == ');
    return (
      valueToString(evaluateExpression(left, scope, nextDepth)) ===
      valueToString(evaluateExpression(right, scope, nextDepth))
    );
  }

  // --- Addition / concatenation ---
  if (includesTopLevel(trimmed, ' + ')) {
    return splitTopLevel(trimmed, ' + ').reduce(
      (acc: unknown, part: string, index: number) => {
        const value = evaluateExpression(part, scope, nextDepth);
        if (index === 0) return value;
        if (typeof acc === 'number' && typeof value === 'number')
          return acc + value;
        return `${valueToString(acc)}${valueToString(value)}`;
      },
      undefined as unknown,
    );
  }

  // --- Comparison operators (> < >= <=) ---
  if (includesTopLevel(trimmed, ' > ')) {
    const [left, right] = splitTopLevel(trimmed, ' > ');
    return (
      (evaluateExpression(left, scope, nextDepth) as number) >
      (evaluateExpression(right, scope, nextDepth) as number)
    );
  }

  // --- Swap ---
  if (trimmed.startsWith('swap ')) {
    const tokens = trimmed.split(/\s+/);
    const current = valueToString(
      evaluateExpression(tokens[1], scope, nextDepth),
    );
    const left = valueToString(
      evaluateExpression(tokens[2], scope, nextDepth),
    );
    const right = valueToString(
      evaluateExpression(tokens[3], scope, nextDepth),
    );
    return current === left ? right : left;
  }

  // --- Full (all items truthy) ---
  if (trimmed.startsWith('full ')) {
    const collection = evaluateExpression(
      trimmed.slice(5),
      scope,
      nextDepth,
    );
    return (
      Array.isArray(collection) &&
      collection.every((item: unknown) => valueToString(item) !== '')
    );
  }

  // --- Bitwise AND ---
  if (includesTopLevel(trimmed, ' & ')) {
    const parts = splitTopLevel(trimmed, ' & ');
    if (parts.length === 2) {
      return (
        (evaluateExpression(parts[0], scope, nextDepth) as number) &
        (evaluateExpression(parts[1], scope, nextDepth) as number)
      );
    }
  }

  // --- Fallback: resolve as a value ---
  return resolveValue(trimmed, scope);
}
