// ============================================================================
// Statement execution — actions, assignments, mutations
// ============================================================================

import { ctx } from './context';
import { evaluateExpression } from './expression';
import { getWindowProp } from './globals';
import { interpolate } from './interpolation';
import { splitPathSegments, buildScope } from './scope';
import { handleBuiltin } from "./builtins";
import { splitTopLevel, valueToString } from './utils';
import type { ActionStep, Scope } from './types';
import { NO_ACTION, STOP } from './builtins/command';

// ---------------------------------------------------------------------------
// assignPath — set a value at a dotted/bracketed path
// ---------------------------------------------------------------------------

export function assignPath(
  pathExpr: string,
  value: unknown,
  locals: Record<string, unknown>,
): void {
  const segments = splitPathSegments(pathExpr);
  if (!segments.length) return;
  const baseKey = segments[0];

  let current: unknown;
  if (
    locals &&
    Object.prototype.hasOwnProperty.call(locals, baseKey)
  ) {
    current = locals[baseKey];
    if (segments.length === 1) {
      locals[baseKey] = value;
      return;
    }
  } else {
    current = ctx().app.state[baseKey];
    if (segments.length === 1) {
      ctx().app.state[baseKey] = value;
      return;
    }
  }

  for (let i = 1; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const scopeValue = buildScope(locals);

    if (
      Array.isArray(current) &&
      segment.startsWith('[].(') &&
      segment.endsWith(')')
    ) {
      const condition = segment.slice(4, -1);
      const match = (current as unknown[]).find((item: unknown) => {
        const innerScope = Object.assign({}, scopeValue, { it: item });
        return Boolean(evaluateExpression(condition, innerScope, 0));
      });
      if (match !== undefined) {
        current = match;
        continue;
      } else return;
    } else if (segment.startsWith('[') && segment.endsWith(']')) {
      const innerExpr = segment.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scopeValue, 0);
      const key = Array.isArray(current)
        ? Number(lookup)
        : valueToString(lookup);
      if ((current as Record<string, unknown>)[key as string] === undefined) {
        (current as Record<string, unknown>)[key as string] = {};
      }
      current = (current as Record<string, unknown>)[key as string];
    } else {
      const key = segment;
      if ((current as Record<string, unknown>)[key] === undefined) {
        (current as Record<string, unknown>)[key] = {};
      }
      current = (current as Record<string, unknown>)[key];
    }
  }

  const finalRawKey = segments[segments.length - 1];
  const scopeValue = buildScope(locals);

  if (
    Array.isArray(current) &&
    finalRawKey.startsWith('[].(') &&
    finalRawKey.endsWith(')')
  ) {
    const condition = finalRawKey.slice(4, -1);
    const index = (current as unknown[]).findIndex((item: unknown) => {
      const innerScope = Object.assign({}, scopeValue, { it: item });
      return Boolean(evaluateExpression(condition, innerScope, 0));
    });
    if (index !== -1) {
      (current as unknown[])[index] = value;
    }
    return;
  } else if (finalRawKey.startsWith('[') && finalRawKey.endsWith(']')) {
    const innerExpr = finalRawKey.slice(1, -1);
    const lookup = evaluateExpression(innerExpr, scopeValue, 0);
    const finalKey = Array.isArray(current)
      ? Number(lookup)
      : valueToString(lookup);
    (current as Record<string, unknown>)[finalKey as string] = value;
  } else {
    (current as Record<string, unknown>)[finalRawKey] = value;
  }
}

// ---------------------------------------------------------------------------
// deletePath — remove an element from an array or key from an object
// ---------------------------------------------------------------------------

export function deletePath(
  pathExpr: string,
  locals: Record<string, unknown>,
): void {
  const segments = splitPathSegments(pathExpr);
  if (!segments.length) return;
  const baseKey = segments[0];

  let current: unknown;
  if (
    locals &&
    Object.prototype.hasOwnProperty.call(locals, baseKey)
  ) {
    current = locals[baseKey];
    if (segments.length === 1) {
      delete locals[baseKey];
      return;
    }
  } else {
    current = ctx().app.state[baseKey];
    if (segments.length === 1) {
      delete ctx().app.state[baseKey];
      return;
    }
  }

  for (let i = 1; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const scopeValue = buildScope(locals);

    if (
      Array.isArray(current) &&
      segment.startsWith('[].(') &&
      segment.endsWith(')')
    ) {
      const condition = segment.slice(4, -1);
      const match = (current as unknown[]).find((item: unknown) => {
        const innerScope = Object.assign({}, scopeValue, { it: item });
        return Boolean(evaluateExpression(condition, innerScope, 0));
      });
      if (match !== undefined) {
        current = match;
        continue;
      } else return;
    } else if (segment.startsWith('[') && segment.endsWith(']')) {
      const innerExpr = segment.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scopeValue, 0);
      const key = Array.isArray(current)
        ? Number(lookup)
        : valueToString(lookup);
      if ((current as Record<string, unknown>)[key as string] === undefined) return;
      current = (current as Record<string, unknown>)[key as string];
    } else {
      const key = segment;
      if ((current as Record<string, unknown>)[key] === undefined) return;
      current = (current as Record<string, unknown>)[key];
    }
  }

  const finalRawKey = segments[segments.length - 1];
  const scopeValue = buildScope(locals);

  if (
    Array.isArray(current) &&
    finalRawKey.startsWith('[].(') &&
    finalRawKey.endsWith(')')
  ) {
    const condition = finalRawKey.slice(4, -1);
    const index = (current as unknown[]).findIndex((item: unknown) => {
      const innerScope = Object.assign({}, scopeValue, { it: item });
      return Boolean(evaluateExpression(condition, innerScope, 0));
    });
    if (index !== -1) {
      (current as unknown[]).splice(index, 1);
    }
  } else if (finalRawKey.startsWith('[') && finalRawKey.endsWith(']')) {
    const innerExpr = finalRawKey.slice(1, -1);
    const lookup = evaluateExpression(innerExpr, scopeValue, 0);
    const finalKey = Array.isArray(current)
      ? Number(lookup)
      : valueToString(lookup);
    if (Array.isArray(current) && typeof finalKey === 'number') {
      (current as unknown[]).splice(finalKey, 1);
    } else {
      delete (current as Record<string, unknown>)[finalKey as string];
    }
  } else {
    if (Array.isArray(current) && !isNaN(Number(finalRawKey))) {
      (current as unknown[]).splice(Number(finalRawKey), 1);
    } else {
      delete (current as Record<string, unknown>)[finalRawKey];
    }
  }
}

// ---------------------------------------------------------------------------
// executeStatement — interpret a single action statement
// ---------------------------------------------------------------------------

export function executeStatement(
  statement: string,
  locals: Record<string, unknown>,
): boolean {
  const trimmed = String(statement || '').trim();
  if (!trimmed) return true;

  // Assignment handling – placed before builtin processing so RHS can be a builtin expression
  // Exclude push syntax which is handled separately
  if (trimmed.includes('=') && !trimmed.match(/^.+?\.push\(/)) {
    const assignmentMatch = trimmed.match(/^(.*?)(?<![!<>=])=(?!=)(.*)$/);
    if (assignmentMatch) {
      const left = assignmentMatch[1].trim();
      const right = assignmentMatch[2].trim();

      // Try builtin expression first
      const builtinVal = handleBuiltin(right, locals);
      if (builtinVal == STOP) {
        return false;
      }
      if (builtinVal == NO_ACTION) {
        return true;
      }
      const value = builtinVal !== undefined ? builtinVal : evaluateExpression(right, buildScope(locals));
      assignPath(left, value, locals);
      return true;
    }
  }

  // Built‑in command handling (including `as` syntax)
  const cmdResult = handleBuiltin(trimmed, locals);
  if (cmdResult) {
    if (cmdResult == STOP) {
      return false;
    }
    return true;
  }

  // Array push syntax
  const pushMatch = trimmed.match(/^(.+?)\.push\((.+)\)$/);
  if (pushMatch) {
    const path = pushMatch[1].trim();
    const arg = pushMatch[2].trim();
    const collection = evaluateExpression(path, buildScope(locals));
    if (Array.isArray(collection)) {
      const val = evaluateExpression(arg, buildScope(locals));
      collection.push(val);
      assignPath(path, collection, locals);
    }
    return true;
  }

  // Function‑call style builtins (e.g., window.__runeWebEmit)
  if (trimmed.includes('(') && trimmed.endsWith(')')) {
    const parenIndex = trimmed.indexOf('(');
    const funcName = trimmed.slice(0, parenIndex).trim();
    const argsStr = trimmed.slice(parenIndex + 1, -1);

    if (funcName === 'window.__runeWebEmit') {
      const args = argsStr
        ? splitTopLevel(argsStr, ',').map((arg) =>
          evaluateExpression(arg, buildScope(locals)),
        )
        : [];
      const emitFn = getWindowProp('__runeWebEmit');
      if (emitFn && typeof emitFn === 'function') {
        (emitFn as Function).apply(null, args);
      }
      return true;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// executeSteps — run an array of action steps (Statement / Conditional / ForLoop)
// ---------------------------------------------------------------------------

export function executeSteps(
  steps: ActionStep[],
  locals: Record<string, unknown>,
): boolean {
  for (const step of steps) {
    if (Object.prototype.hasOwnProperty.call(step, 'Statement')) {
      if (!executeStatement(step.Statement!, locals)) return false;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(step, 'Conditional')) {
      const conditional = step.Conditional!;
      if (
        Boolean(
          evaluateExpression(
            conditional.condition,
            buildScope(locals),
          ),
        )
      ) {
        if (!executeSteps(conditional.steps || [], locals)) return false;
      }
    }

    if (Object.prototype.hasOwnProperty.call(step, 'ForLoop')) {
      const loop = step.ForLoop!;
      const collection = evaluateExpression(
        loop.collection,
        buildScope(locals),
      );
      if (Array.isArray(collection)) {
        for (let i = 0; i < collection.length; i++) {
          const item = collection[i];
          const childLocals: Record<string, unknown> = Object.assign(
            {},
            locals || {},
          );
          childLocals[loop.item_name] = item;
          if (loop.index_name) {
            childLocals[loop.index_name] = i;
          }
          if (!executeSteps(loop.steps || [], childLocals)) {
            break;
          }
        }
      }
    }
  }
  return true;
}
