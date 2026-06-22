// ============================================================================
// Executor — run a sequence of RunStep[] against a RequestContext
// ============================================================================

import type { RunStep, AssignmentStep, BuiltinStep, IfStep } from '../types';
import type { RequestContext } from './context';
import { buildScopeFromContext } from './context';
import { evaluateExpression, resolvePath, splitPathSegments, valueToString } from './evaluate';
import { executeBuiltin, RESPONDED, isBuiltin } from './builtins';

// ---------------------------------------------------------------------------
// Assign a value into context state at a dotted/bracketed path
// ---------------------------------------------------------------------------

function assignPath(pathExpr: string, value: unknown, ctx: RequestContext): void {
  const scope = buildScopeFromContext(ctx);
  const segments = splitPathSegments(pathExpr);
  if (!segments.length) return;
  const baseKey = segments[0];

  if (segments.length === 1) {
    ctx.state[baseKey] = value;
    return;
  }

  if (ctx.state[baseKey] === undefined) ctx.state[baseKey] = {};
  let current: unknown = ctx.state[baseKey];

  for (let i = 1; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg.startsWith('[') && seg.endsWith(']')) {
      const lookup = evaluateExpression(seg.slice(1, -1), scope);
      const key = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
      if ((current as Record<string, unknown>)[key as string] === undefined) {
        (current as Record<string, unknown>)[key as string] = {};
      }
      current = (current as Record<string, unknown>)[key as string];
    } else {
      if ((current as Record<string, unknown>)[seg] === undefined) {
        (current as Record<string, unknown>)[seg] = {};
      }
      current = (current as Record<string, unknown>)[seg];
    }
  }

  const finalKey = segments[segments.length - 1];
  if (finalKey.startsWith('[') && finalKey.endsWith(']')) {
    const lookup = evaluateExpression(finalKey.slice(1, -1), scope);
    const key = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
    (current as Record<string, unknown>)[key as string] = value;
  } else {
    (current as Record<string, unknown>)[finalKey] = value;
  }
}

// ---------------------------------------------------------------------------
// Execute a single assignment step
// ---------------------------------------------------------------------------

function executeAssignment(step: AssignmentStep, ctx: RequestContext): boolean {
  const rhs = step.rhs;
  const firstToken = rhs.split(/\s+/)[0];

  // RHS is a builtin call — e.g. "user = csv.read users.csv"
  if (isBuiltin(firstToken)) {
    const restStr = rhs.slice(firstToken.length).trim();
    // Parse args from rest string
    const args = restStr ? restStr.split(/\s+/) : [];
    const result = executeBuiltin(firstToken, args, ctx, step.lhs);
    if (result === RESPONDED) return false;
    if (result !== undefined) {
      ctx.state[step.lhs] = result;
    }
    return true;
  }

  // Array push: lhs.push(expr) — detected by RHS ending in )
  const pushMatch = rhs.match(/^(.+?)\.push\((.+)\)$/);
  if (pushMatch) {
    const scope = buildScopeFromContext(ctx);
    const collectionPath = pushMatch[1].trim();
    const argExpr = pushMatch[2].trim();
    const collection = resolvePath(collectionPath, { ...ctx.state, ...ctx.pathParams });
    if (Array.isArray(collection)) {
      const val = evaluateExpression(argExpr, scope);
      collection.push(val);
      assignPath(collectionPath, collection, ctx);
    }
    return true;
  }

  // Standard expression evaluation
  const scope = buildScopeFromContext(ctx);
  const value = evaluateExpression(rhs, scope);
  assignPath(step.lhs, value, ctx);
  return true;
}

// ---------------------------------------------------------------------------
// Execute a single builtin step
// ---------------------------------------------------------------------------

function executeBuiltinStep(step: BuiltinStep, ctx: RequestContext): boolean {
  const result = executeBuiltin(step.name, step.args, ctx);
  return result !== RESPONDED;
}

// ---------------------------------------------------------------------------
// Execute an if step
// ---------------------------------------------------------------------------

function executeIfStep(step: IfStep, ctx: RequestContext): boolean {
  const scope = buildScopeFromContext(ctx);
  const condResult = evaluateExpression(step.condition, scope);
  if (Boolean(condResult)) {
    return executeSteps(step.body, ctx);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Execute a raw step (push / other expressions)
// ---------------------------------------------------------------------------

function executeRawStep(text: string, ctx: RequestContext): boolean {
  // Array push: path.push(expr)
  const pushMatch = text.match(/^(.+?)\.push\((.+)\)$/);
  if (pushMatch) {
    const scope = buildScopeFromContext(ctx);
    const collectionPath = pushMatch[1].trim();
    const argExpr = pushMatch[2].trim();
    const collection = evaluateExpression(collectionPath, scope);
    if (Array.isArray(collection)) {
      const val = evaluateExpression(argExpr, scope);
      collection.push(val);
      assignPath(collectionPath, collection, ctx);
    }
    return true;
  }

  // Try as a standalone builtin call
  const firstToken = text.split(/\s+/)[0];
  if (isBuiltin(firstToken)) {
    const restStr = text.slice(firstToken.length).trim();
    const args = restStr ? restStr.split(/\s+/) : [];
    const result = executeBuiltin(firstToken, args, ctx);
    return result !== RESPONDED;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Main step runner
// ---------------------------------------------------------------------------

export function executeSteps(steps: RunStep[], ctx: RequestContext): boolean {
  for (const step of steps) {
    if (ctx.response) return false; // respond already called

    switch (step.kind) {
      case 'assignment':
        if (!executeAssignment(step, ctx)) return false;
        break;
      case 'builtin':
        if (!executeBuiltinStep(step, ctx)) return false;
        break;
      case 'if':
        if (!executeIfStep(step, ctx)) return false;
        break;
      case 'raw':
        if (!executeRawStep(step.text, ctx)) return false;
        break;
    }
  }
  return true;
}
