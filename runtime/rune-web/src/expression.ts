// ============================================================================
// Expression evaluation engine
// ============================================================================

import { ctx } from './context';
import { randomInt, shuffled } from './random';
import { splitPathSegments, buildScope } from './scope';
import {
  includesTopLevel,
  splitTopLevel,
  normalizeLiteral,
  valueToString,
} from './utils';
import { getStorageItem, hasStorageItem } from './storage';
import { slide as spatialSlide, sees as spatialSees } from './pixel3d/spatial';
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
    // Compiler-provided source props are JSON strings, including escaped
    // newlines, quotes and backslashes. Decode once at the prop boundary.
    if (trimmed.startsWith('"')) {
      try { return JSON.parse(trimmed); } catch (_) { /* Rune literal fallback. */ }
    }
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
  if (expr.includes('.') || expr.includes('[')) return undefined;
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
// JIT Compiler & Expression Cache
// ---------------------------------------------------------------------------

export type CompiledExpr = (scope: Scope) => unknown;

const exprCache = new Map<string, CompiledExpr>();
const MAX_CACHE_SIZE = 8192;

export function clearExpressionCache(): void {
  exprCache.clear();
}

export function compilePath(expr: string): CompiledExpr {
  const segments = splitPathSegments(expr);
  if (!segments.length) return () => undefined;

  // Single identifier: e.g. `clock`, `health`
  if (segments.length === 1 && !segments[0].includes('[')) {
    const key = segments[0];
    return (scope: Scope) => (scope as Record<string, unknown>)?.[key];
  }

  // 2 segments: e.g. `player.x`, `player.angle`, `enemy.hp`, `weapon.sprite`
  if (segments.length === 2 && !segments[0].includes('[') && !segments[1].includes('[')) {
    const k0 = segments[0];
    const k1 = segments[1];
    if (k1 === 'length') {
      return (scope: Scope) => {
        const obj = (scope as Record<string, unknown>)?.[k0];
        return Array.isArray(obj) ? obj.length : (obj as any)?.length;
      };
    }
    return (scope: Scope) => {
      const obj = (scope as Record<string, unknown>)?.[k0] as Record<string, unknown>;
      return obj?.[k1];
    };
  }

  // 3 segments: e.g. `state.player.x`
  if (segments.length === 3 && !segments[0].includes('[') && !segments[1].includes('[') && !segments[2].includes('[')) {
    const k0 = segments[0];
    const k1 = segments[1];
    const k2 = segments[2];
    if (k2 === 'length') {
      return (scope: Scope) => {
        const o0 = (scope as Record<string, unknown>)?.[k0] as Record<string, unknown>;
        const obj = o0?.[k1];
        return Array.isArray(obj) ? obj.length : (obj as any)?.length;
      };
    }
    return (scope: Scope) => {
      const o0 = (scope as Record<string, unknown>)?.[k0] as Record<string, unknown>;
      const o1 = o0?.[k1] as Record<string, unknown>;
      return o1?.[k2];
    };
  }

  // Multi-segment with filter or bracket
  const compiledSteps: ((current: unknown, scope: Scope) => unknown)[] = segments.map((segment) => {
    if (segment === 'length') {
      return (current: unknown) => (Array.isArray(current) ? current.length : (current as any)?.length);
    }
    if (segment.startsWith('[].(') && segment.endsWith(')')) {
      const cond = compileExpression(segment.slice(4, -1));
      return (current: unknown, scope: Scope) => {
        if (!Array.isArray(current)) return undefined;
        return current.find((item: unknown) => {
          const innerScope = Object.assign({}, scope, { it: item });
          return Boolean(cond(innerScope));
        });
      };
    }
    if (segment.startsWith('[') && segment.endsWith(']')) {
      const inner = compileExpression(segment.slice(1, -1));
      return (current: unknown, scope: Scope) => {
        if (current === null || current === undefined) return undefined;
        const lookup = inner(scope);
        return (current as Record<string, unknown>)[valueToString(lookup)];
      };
    }
    return (current: unknown) => {
      if (current === null || current === undefined) return undefined;
      return (current as Record<string, unknown>)[segment];
    };
  });

  return (scope: Scope) => {
    let current: unknown = scope;
    for (let i = 0; i < compiledSteps.length; i++) {
      if (current === null || current === undefined) return undefined;
      current = compiledSteps[i](current, scope);
    }
    return current;
  };
}

function compileResolveValue(expr: string): CompiledExpr {
  const trimmed = expr.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    return (scope: Scope) => resolveValue(trimmed, scope);
  }
  const literal = tryParseLiteral(trimmed);
  if (literal !== undefined) {
    return () => literal;
  }
  if (trimmed.includes('.') || trimmed.includes('[')) {
    const pathFn = compilePath(trimmed);
    return (scope: Scope) => pathFn(scope);
  }
  const fallback = normalizeLiteral(trimmed);
  return (scope: Scope) => {
    if (scope && (scope as Record<string, unknown>)[trimmed] !== undefined) {
      return (scope as Record<string, unknown>)[trimmed];
    }
    return fallback;
  };
}

// ---------------------------------------------------------------------------
// compileExpression — compile a string expression into a reusable closure
// ---------------------------------------------------------------------------

export function compileExpression(expr: string, depth = 0): CompiledExpr {
  if (depth > MAX_DEPTH) return () => undefined;
  const nextDepth = depth + 1;
  let trimmed = String(expr || '').trim();
  if (!trimmed) return () => undefined;

  // 1. Literal constants
  if (trimmed === 'true') return () => true;
  if (trimmed === 'false') return () => false;
  if (trimmed === 'null') return () => null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    return () => n;
  }

  // 2. Pure identifiers / simple paths without operators
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\])*$/.test(trimmed)) {
    const pathFn = compilePath(trimmed);
    if (!trimmed.includes('.') && !trimmed.includes('[')) {
      const fallback = normalizeLiteral(trimmed);
      return (scope: Scope) => {
        const val = pathFn(scope);
        return val !== undefined ? val : fallback;
      };
    }
    return (scope: Scope) => pathFn(scope);
  }

  // 3. Raw source props (JSON strings)
  if (trimmed.startsWith('"')) {
    try {
      const literal = JSON.parse(trimmed);
      if (typeof literal === 'string') return () => literal;
    } catch (_) {
      // Quoted operand may also be part of a larger expression
    }
  }

  // 4. @selector syntax
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
    if (selector) {
      const cRest = rest ? compilePath(rest.startsWith('.') ? rest.slice(1) : rest) : null;
      return () => {
        if (typeof document !== 'undefined') {
          const el = document.querySelector(selector);
          if (el) {
            if (!cRest) return el;
            return cRest(el as unknown as Scope);
          }
        }
        return undefined;
      };
    }
  }

  // 5. Strip balanced outer parens
  let parenStripped = false;
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
    parenStripped = true;
  }
  if (parenStripped) {
    return compileExpression(trimmed, nextDepth);
  }

  // 6. Unary !
  if (trimmed.startsWith('!')) {
    const inner = compileExpression(trimmed.slice(1).trim(), nextDepth);
    return (scope: Scope) => !Boolean(inner(scope));
  }

  // 7. Spatial & Game functions
  if (trimmed.startsWith('collide(') && trimmed.endsWith(')')) {
    const parts = splitTopLevel(trimmed.slice(8, -1), ',');
    if (parts.length >= 2) {
      const cA = compileExpression(parts[0], nextDepth);
      const cB = compileExpression(parts[1], nextDepth);
      const cW = parts.length >= 3 ? compileExpression(parts[2], nextDepth) : null;
      const cH = parts.length >= 4 ? compileExpression(parts[3], nextDepth) : null;
      return (scope: Scope) => {
        const a = cA(scope) as any;
        const b = cB(scope) as any;
        const w = cW ? Number(cW(scope)) : 20;
        const h = cH ? Number(cH(scope)) : w;
        if (a && b && typeof a === 'object' && typeof b === 'object' && a.x !== undefined && a.y !== undefined && b.x !== undefined && b.y !== undefined) {
          return Math.abs(Number(a.x) - Number(b.x)) < w && Math.abs(Number(a.y) - Number(b.y)) < h;
        }
        return false;
      };
    }
  }

  if (trimmed.startsWith('clamp(') && trimmed.endsWith(')')) {
    const parts = splitTopLevel(trimmed.slice(6, -1), ',');
    if (parts.length === 3) {
      const cV = compileExpression(parts[0], nextDepth);
      const cMin = compileExpression(parts[1], nextDepth);
      const cMax = compileExpression(parts[2], nextDepth);
      return (scope: Scope) => {
        const v = Number(cV(scope));
        const min = Number(cMin(scope));
        const max = Number(cMax(scope));
        return Math.min(Math.max(v, min), max);
      };
    }
  }

  if (trimmed.startsWith('abs(') && trimmed.endsWith(')')) {
    const cVal = compileExpression(trimmed.slice(4, -1), nextDepth);
    return (scope: Scope) => Math.abs(Number(cVal(scope)));
  }

  if (trimmed.startsWith('floor(') && trimmed.endsWith(')')) {
    const cVal = compileExpression(trimmed.slice(6, -1), nextDepth);
    return (scope: Scope) => Math.floor(Number(cVal(scope)));
  }

  if (trimmed.startsWith('sqrt(') && trimmed.endsWith(')')) {
    const cVal = compileExpression(trimmed.slice(5, -1), nextDepth);
    return (scope: Scope) => Math.sqrt(Number(cVal(scope)));
  }

  if (trimmed.startsWith('sin(') && trimmed.endsWith(')')) {
    const cVal = compileExpression(trimmed.slice(4, -1), nextDepth);
    return (scope: Scope) => Math.sin((Number(cVal(scope)) * Math.PI) / 180);
  }

  if (trimmed.startsWith('cos(') && trimmed.endsWith(')')) {
    const cVal = compileExpression(trimmed.slice(4, -1), nextDepth);
    return (scope: Scope) => Math.cos((Number(cVal(scope)) * Math.PI) / 180);
  }

  if (trimmed.startsWith('atan2(') && trimmed.endsWith(')')) {
    const parts = splitTopLevel(trimmed.slice(6, -1), ',');
    if (parts.length === 2) {
      const cDy = compileExpression(parts[0], nextDepth);
      const cDx = compileExpression(parts[1], nextDepth);
      return (scope: Scope) => {
        const dy = Number(cDy(scope));
        const dx = Number(cDx(scope));
        let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (deg < 0) deg += 360;
        return deg;
      };
    }
  }

  if (trimmed.startsWith('distance(') && trimmed.endsWith(')')) {
    const parts = splitTopLevel(trimmed.slice(9, -1), ',');
    if (parts.length === 2) {
      const cA = compileExpression(parts[0], nextDepth);
      const cB = compileExpression(parts[1], nextDepth);
      return (scope: Scope) => {
        const a = cA(scope) as any;
        const b = cB(scope) as any;
        if (a && b && typeof a === 'object' && typeof b === 'object' && a.x !== undefined && a.y !== undefined && b.x !== undefined && b.y !== undefined) {
          const dx = Number(a.x) - Number(b.x);
          const dy = Number(a.y) - Number(b.y);
          return Math.sqrt(dx * dx + dy * dy);
        }
        return 0;
      };
    } else if (parts.length === 4) {
      const cAx = compileExpression(parts[0], nextDepth);
      const cAy = compileExpression(parts[1], nextDepth);
      const cBx = compileExpression(parts[2], nextDepth);
      const cBy = compileExpression(parts[3], nextDepth);
      return (scope: Scope) => {
        const dx = Number(cAx(scope)) - Number(cBx(scope));
        const dy = Number(cAy(scope)) - Number(cBy(scope));
        return Math.sqrt(dx * dx + dy * dy);
      };
    }
  }

  if (trimmed.startsWith('angle_to(') && trimmed.endsWith(')')) {
    const parts = splitTopLevel(trimmed.slice(9, -1), ',');
    if (parts.length === 2) {
      const cA = compileExpression(parts[0], nextDepth);
      const cB = compileExpression(parts[1], nextDepth);
      return (scope: Scope) => {
        const a = cA(scope) as any;
        const b = cB(scope) as any;
        if (a && b && typeof a === 'object' && typeof b === 'object' && a.x !== undefined && a.y !== undefined && b.x !== undefined && b.y !== undefined) {
          let deg = (Math.atan2(Number(b.y) - Number(a.y), Number(b.x) - Number(a.x)) * 180) / Math.PI;
          if (deg < 0) deg += 360;
          return deg;
        }
        return 0;
      };
    }
  }

  if (trimmed.startsWith('slide(') && trimmed.endsWith(')')) {
    const parts = splitTopLevel(trimmed.slice(6, -1), ',');
    if (parts.length >= 4) {
      const cPx = compileExpression(parts[0], nextDepth);
      const cPy = compileExpression(parts[1], nextDepth);
      const cDx = compileExpression(parts[2], nextDepth);
      const cDy = compileExpression(parts[3], nextDepth);
      const cR = parts.length >= 5 ? compileExpression(parts[4], nextDepth) : null;
      return (scope: Scope) => {
        const px = Number(cPx(scope));
        const py = Number(cPy(scope));
        const dx = Number(cDx(scope));
        const dy = Number(cDy(scope));
        const r = cR ? Number(cR(scope)) : 0.25;
        return spatialSlide(px, py, dx, dy, r);
      };
    }
  }

  if (trimmed.startsWith('sees(') && trimmed.endsWith(')')) {
    const parts = splitTopLevel(trimmed.slice(5, -1), ',');
    if (parts.length === 2) {
      const cA = compileExpression(parts[0], nextDepth);
      const cB = compileExpression(parts[1], nextDepth);
      return (scope: Scope) => {
        const a = cA(scope) as any;
        const b = cB(scope) as any;
        if (!a || !b) return false;
        return spatialSees(Number(a.x), Number(a.y), Number(b.x), Number(b.y));
      };
    } else if (parts.length >= 4) {
      const cX1 = compileExpression(parts[0], nextDepth);
      const cY1 = compileExpression(parts[1], nextDepth);
      const cX2 = compileExpression(parts[2], nextDepth);
      const cY2 = compileExpression(parts[3], nextDepth);
      return (scope: Scope) => {
        return spatialSees(
          Number(cX1(scope)),
          Number(cY1(scope)),
          Number(cX2(scope)),
          Number(cY2(scope))
        );
      };
    }
  }

  if (trimmed.startsWith('random(') && trimmed.endsWith(')')) {
    const parts = splitTopLevel(trimmed.slice(7, -1), ',');
    if (parts.length >= 2) {
      const cMin = compileExpression(parts[0], nextDepth);
      const cMax = compileExpression(parts[1], nextDepth);
      const cSeed = parts.length >= 3 ? compileExpression(parts[2], nextDepth) : null;
      return (scope: Scope) => {
        const min = Number(cMin(scope));
        const max = Number(cMax(scope));
        return randomInt(min, max, cSeed ? Number(cSeed(scope)) : undefined);
      };
    }
  }

  for (const name of ['shuffle', 'pick']) {
    if (trimmed.startsWith(name + '(') && trimmed.endsWith(')')) {
      const parts = splitTopLevel(trimmed.slice(name.length + 1, -1), ',');
      const cValues = compileExpression(parts[0], nextDepth);
      const cSeed = parts.length > 1 ? compileExpression(parts[1], nextDepth) : null;
      return (scope: Scope) => {
        const values = cValues(scope);
        if (!Array.isArray(values)) return undefined;
        const seed = cSeed ? Number(cSeed(scope)) : randomInt(0, 2147483647);
        return name === 'shuffle'
          ? shuffled(values, seed)
          : values.length ? values[randomInt(0, values.length - 1, seed)] : null;
      };
    }
  }

  if (trimmed.startsWith('min(') && trimmed.endsWith(')')) {
    const cParts = splitTopLevel(trimmed.slice(4, -1), ',').map((p) => compileExpression(p, nextDepth));
    return (scope: Scope) => Math.min(...cParts.map((fn) => Number(fn(scope))));
  }

  if (trimmed.startsWith('max(') && trimmed.endsWith(')')) {
    const cParts = splitTopLevel(trimmed.slice(4, -1), ',').map((p) => compileExpression(p, nextDepth));
    return (scope: Scope) => Math.max(...cParts.map((fn) => Number(fn(scope))));
  }

  // 8. Storage expressions
  if (
    trimmed.startsWith('storage.get(') ||
    trimmed.startsWith('local_storage.get(') ||
    trimmed.startsWith('localStorage.get(')
  ) {
    const callEnd = trimmed.lastIndexOf(')');
    const callPart = trimmed.slice(0, callEnd + 1);
    const trailingProp = trimmed.slice(callEnd + 1).trim();
    const inner = callPart.slice(callPart.indexOf('(') + 1, -1);
    const parts = splitTopLevel(inner, ',');
    const cKey = compileExpression(parts[0], nextDepth);
    const cDef = parts.length > 1 ? compileExpression(parts[1], nextDepth) : null;
    return (scope: Scope) => {
      const key = String(cKey(scope));
      const defVal = cDef ? cDef(scope) : null;
      const item = getStorageItem(key);
      let result: unknown = defVal;
      if (item !== null) {
        try {
          result = JSON.parse(item);
        } catch {
          result = item;
        }
      }
      if (trailingProp.startsWith('.') && result && typeof result === 'object') {
        const prop = trailingProp.slice(1);
        return (result as Record<string, unknown>)[prop];
      }
      return result;
    };
  }

  if (
    trimmed.startsWith('storage.has(') ||
    trimmed.startsWith('local_storage.has(') ||
    trimmed.startsWith('localStorage.has(')
  ) {
    const inner = trimmed.slice(trimmed.indexOf('(') + 1, -1);
    const cKey = compileExpression(inner, nextDepth);
    return (scope: Scope) => hasStorageItem(String(cKey(scope)));
  }

  // 9. Helper calls
  const helperCall = parseHelperCall(trimmed);
  if (helperCall) {
    const cArgs = helperCall.args.map((arg) => compileExpression(arg, nextDepth));
    const name = helperCall.name;
    return (scope: Scope) => callHelper(name, cArgs.map((fn) => fn(scope)), scope, nextDepth);
  }

  // 10. Collection methods (.any, .mask, .filter, .find, .max)
  const methodMatch = trimmed.match(
    /^(.+?)\.(any|mask|filter|find|max)(?:\((.*)\)|\s+(.+?))(?:\.(length))?$/,
  );
  if (methodMatch) {
    const [, receiver, method, parenArgs, spaceArgs, trailingProp] = methodMatch;
    const argsStr = (parenArgs !== undefined ? parenArgs : spaceArgs).trim();
    const cReceiver = compileExpression(receiver, nextDepth);

    if (method === 'mask') {
      const cArg = compileExpression(argsStr, nextDepth);
      return (scope: Scope) => {
        const collection = cReceiver(scope);
        if (!Array.isArray(collection)) return undefined;
        const player = valueToString(cArg(scope));
        return (collection as unknown[]).reduce(
          (acc: number, cell: unknown, i: number) => {
            return valueToString(cell) === player ? acc | (1 << i) : acc;
          },
          0,
        );
      };
    }

    const arrowMatch = argsStr.match(/^(\w+)\s*=>\s*(.+)$/);
    const [paramName, predExpr] = arrowMatch ? [arrowMatch[1], arrowMatch[2]] : ['it', argsStr];
    const cPred = compileExpression(predExpr, nextDepth);

    return (scope: Scope) => {
      const collection = cReceiver(scope);
      if (!Array.isArray(collection)) return undefined;
      let result: unknown = undefined;
      if (method === 'any') {
        result = collection.some((item: unknown) => {
          const innerScope = Object.assign({}, scope, { [paramName]: item });
          return Boolean(cPred(innerScope));
        });
      } else if (method === 'filter') {
        result = collection.filter((item: unknown) => {
          const innerScope = Object.assign({}, scope, { [paramName]: item });
          return Boolean(cPred(innerScope));
        });
      } else if (method === 'find') {
        result = collection.find((item: unknown) => {
          const innerScope = Object.assign({}, scope, { [paramName]: item });
          return Boolean(cPred(innerScope));
        });
      } else if (method === 'max') {
        result = collection.reduce(
          (max: unknown, item: unknown) => {
            const innerScope = Object.assign({}, scope, { [paramName]: item });
            const val = cPred(innerScope);
            return max === undefined || (val as number) > (max as number) ? val : max;
          },
          undefined as unknown,
        );
      }
      if (trailingProp === 'length' && result !== undefined && (result as unknown[]).length !== undefined) {
        return (result as unknown[]).length;
      }
      return result;
    };
  }

  // 11. Ternary ? :
  if (includesTopLevel(trimmed, ' ? ')) {
    const parts = splitTopLevel(trimmed, ' ? ');
    const condition = parts[0];
    const rest = parts.slice(1).join(' ? ');
    if (includesTopLevel(rest, ' : ')) {
      const colonParts = splitTopLevel(rest, ' : ');
      const cCond = compileExpression(condition, nextDepth);
      const cTrue = compileExpression(colonParts[0], nextDepth);
      const cFalse = compileExpression(colonParts.slice(1).join(' : '), nextDepth);
      return (scope: Scope) => Boolean(cCond(scope)) ? cTrue(scope) : cFalse(scope);
    }
  }

  // 12. Nullish coalescing ??
  if (includesTopLevel(trimmed, ' ?? ')) {
    const parts = splitTopLevel(trimmed, ' ?? ');
    const leftRaw = parts[0].trim();
    const cLeft = compileExpression(leftRaw, nextDepth);
    const cRight = compileExpression(parts.slice(1).join(' ?? '), nextDepth);
    return (scope: Scope) => {
      let left = cLeft(scope);
      if (typeof left === 'string' && left === leftRaw && resolvePath(leftRaw, scope) === undefined && tryParseLiteral(leftRaw, scope) === undefined) {
        left = undefined;
      }
      if (left !== undefined && left !== null && left !== '') {
        return left;
      }
      return cRight(scope);
    };
  }

  // 13. Logical operators (or, ||, and, &&)
  if (includesTopLevel(trimmed, ' or ')) {
    const cParts = splitTopLevel(trimmed, ' or ').map((p) => compileExpression(p, nextDepth));
    return (scope: Scope) => cParts.some((fn) => Boolean(fn(scope)));
  }
  if (includesTopLevel(trimmed, ' || ')) {
    const cParts = splitTopLevel(trimmed, ' || ').map((p) => compileExpression(p, nextDepth));
    return (scope: Scope) => cParts.some((fn) => Boolean(fn(scope)));
  }
  if (includesTopLevel(trimmed, ' and ')) {
    const cParts = splitTopLevel(trimmed, ' and ').map((p) => compileExpression(p, nextDepth));
    return (scope: Scope) => cParts.every((fn) => Boolean(fn(scope)));
  }
  if (includesTopLevel(trimmed, ' && ')) {
    const cParts = splitTopLevel(trimmed, ' && ').map((p) => compileExpression(p, nextDepth));
    return (scope: Scope) => cParts.every((fn) => Boolean(fn(scope)));
  }

  // 14. Comparison == and !=
  if (includesTopLevel(trimmed, ' != ')) {
    const [left, right] = splitTopLevel(trimmed, ' != ');
    const cL = compileExpression(left, nextDepth);
    const cR = compileExpression(right, nextDepth);
    return (scope: Scope) => valueToString(cL(scope)) !== valueToString(cR(scope));
  }
  if (includesTopLevel(trimmed, ' == ')) {
    const [left, right] = splitTopLevel(trimmed, ' == ');
    const cL = compileExpression(left, nextDepth);
    const cR = compileExpression(right, nextDepth);
    return (scope: Scope) => valueToString(cL(scope)) === valueToString(cR(scope));
  }

  // 15. Comparison operators (>=, <=, >, <)
  if (includesTopLevel(trimmed, ' >= ')) {
    const [left, right] = splitTopLevel(trimmed, ' >= ');
    const cL = compileExpression(left, nextDepth);
    const cR = compileExpression(right, nextDepth);
    return (scope: Scope) => (cL(scope) as number) >= (cR(scope) as number);
  }
  if (includesTopLevel(trimmed, ' <= ')) {
    const [left, right] = splitTopLevel(trimmed, ' <= ');
    const cL = compileExpression(left, nextDepth);
    const cR = compileExpression(right, nextDepth);
    return (scope: Scope) => (cL(scope) as number) <= (cR(scope) as number);
  }
  if (includesTopLevel(trimmed, ' > ')) {
    const [left, right] = splitTopLevel(trimmed, ' > ');
    const cL = compileExpression(left, nextDepth);
    const cR = compileExpression(right, nextDepth);
    return (scope: Scope) => (cL(scope) as number) > (cR(scope) as number);
  }
  if (includesTopLevel(trimmed, ' < ')) {
    const [left, right] = splitTopLevel(trimmed, ' < ');
    const cL = compileExpression(left, nextDepth);
    const cR = compileExpression(right, nextDepth);
    return (scope: Scope) => (cL(scope) as number) < (cR(scope) as number);
  }

  // 16. Addition / concatenation
  if (includesTopLevel(trimmed, ' + ')) {
    const cParts = splitTopLevel(trimmed, ' + ').map((p) => compileExpression(p, nextDepth));
    return (scope: Scope) => cParts.reduce((acc: unknown, fn, index: number) => {
      const value = fn(scope);
      if (index === 0) return value;
      if (typeof acc === 'number' && typeof value === 'number') return acc + value;
      return `${valueToString(acc)}${valueToString(value)}`;
    }, undefined);
  }

  // 17. Subtraction
  if (includesTopLevel(trimmed, ' - ')) {
    const parts = splitTopLevel(trimmed, ' - ');
    const cFirst = compileExpression(parts[0], nextDepth);
    const cRest = parts.slice(1).map((p) => compileExpression(p, nextDepth));
    return (scope: Scope) => {
      const first = Number(cFirst(scope));
      return cRest.reduce((acc: number, fn) => acc - Number(fn(scope)), first);
    };
  }

  // 18. Multiplication
  if (includesTopLevel(trimmed, ' * ')) {
    const cParts = splitTopLevel(trimmed, ' * ').map((p) => compileExpression(p, nextDepth));
    return (scope: Scope) => cParts.reduce((acc: number, fn, idx: number) => {
      const val = Number(fn(scope));
      return idx === 0 ? val : acc * val;
    }, 1);
  }

  // 19. Division
  if (includesTopLevel(trimmed, ' / ')) {
    const parts = splitTopLevel(trimmed, ' / ');
    const cFirst = compileExpression(parts[0], nextDepth);
    const cRest = parts.slice(1).map((p) => compileExpression(p, nextDepth));
    return (scope: Scope) => {
      const first = Number(cFirst(scope));
      return cRest.reduce((acc: number, fn) => acc / Number(fn(scope)), first);
    };
  }

  // 20. Modulo
  if (includesTopLevel(trimmed, ' % ')) {
    const parts = splitTopLevel(trimmed, ' % ');
    const cFirst = compileExpression(parts[0], nextDepth);
    const cRest = parts.slice(1).map((p) => compileExpression(p, nextDepth));
    return (scope: Scope) => {
      const first = Number(cFirst(scope));
      return cRest.reduce((acc: number, fn) => acc % Number(fn(scope)), first);
    };
  }

  // 21. Swap
  if (trimmed.startsWith('swap ')) {
    const tokens = trimmed.split(/\s+/);
    const cCurr = compileExpression(tokens[1], nextDepth);
    const cL = compileExpression(tokens[2], nextDepth);
    const cR = compileExpression(tokens[3], nextDepth);
    return (scope: Scope) => {
      const current = valueToString(cCurr(scope));
      const left = valueToString(cL(scope));
      const right = valueToString(cR(scope));
      return current === left ? right : left;
    };
  }

  // 22. Full (all items truthy)
  if (trimmed.startsWith('full ')) {
    const cColl = compileExpression(trimmed.slice(5), nextDepth);
    return (scope: Scope) => {
      const collection = cColl(scope);
      return Array.isArray(collection) && collection.every((item: unknown) => valueToString(item) !== '');
    };
  }

  // 23. Bitwise &
  if (includesTopLevel(trimmed, ' & ')) {
    const [left, right] = splitTopLevel(trimmed, ' & ');
    const cL = compileExpression(left, nextDepth);
    const cR = compileExpression(right, nextDepth);
    return (scope: Scope) => (cL(scope) as number) & (cR(scope) as number);
  }

  // 24. Unary negation
  if (trimmed.startsWith('-') && !trimmed.startsWith('--')) {
    const operand = trimmed.slice(1).trim();
    if (operand) {
      const cOp = compileExpression(operand, nextDepth);
      return (scope: Scope) => {
        const val = cOp(scope);
        if (typeof val === 'number') return -val;
        const num = Number(val);
        if (!Number.isNaN(num)) return -num;
        return undefined;
      };
    }
  }

  // 25. Fallback: resolve as a value
  return compileResolveValue(trimmed);
}

// ---------------------------------------------------------------------------
// evaluateExpression — the main expression evaluator (JIT cached)
// ---------------------------------------------------------------------------

export function evaluateExpression(
  expr: string,
  scope: Scope,
  depth?: number,
): unknown {
  if ((depth || 0) > MAX_DEPTH) return undefined;
  const trimmed = String(expr || '').trim();
  if (!trimmed) return undefined;

  let compiled = exprCache.get(trimmed);
  if (!compiled) {
    compiled = compileExpression(trimmed, depth || 0);
    if (exprCache.size >= MAX_CACHE_SIZE) {
      exprCache.clear();
    }
    exprCache.set(trimmed, compiled);
  }

  return compiled(scope);
}
