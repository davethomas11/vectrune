// ============================================================================
// Builtins — emulate server-side Vectrune built-in commands
// ============================================================================

import type { RequestContext } from './context';
import { buildScopeFromContext } from './context';
import { evaluateExpression, resolvePath, splitPathSegments, valueToString } from './evaluate';

// Sentinel returned when a builtin calls respond (halts execution)
export const RESPONDED = Symbol('RESPONDED');

// ---------------------------------------------------------------------------
// Placeholder expansion (for log messages)
// ---------------------------------------------------------------------------

function expandPlaceholders(template: string, scope: Record<string, unknown>): string {
  return template.replace(/\{([^}]+)\}/g, (_match, expr) => {
    const val = evaluateExpression(expr.trim(), scope);
    return val !== undefined ? valueToString(val) : `{${expr}}`;
  });
}

// ---------------------------------------------------------------------------
// Path assignment helper (mirrors rune-web assignPath)
// ---------------------------------------------------------------------------

function assignPath(
  pathExpr: string,
  value: unknown,
  ctx: RequestContext,
): void {
  const scope = buildScopeFromContext(ctx);
  const segments = splitPathSegments(pathExpr);
  if (!segments.length) return;
  const baseKey = segments[0];

  // Write to ctx.state
  if (segments.length === 1) {
    ctx.state[baseKey] = value;
    return;
  }

  let current: unknown = ctx.state[baseKey];
  if (current === undefined) {
    current = {};
    ctx.state[baseKey] = current;
  }

  for (let i = 1; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg.startsWith('[') && seg.endsWith(']')) {
      const innerExpr = seg.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scope);
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
    const innerExpr = finalKey.slice(1, -1);
    const lookup = evaluateExpression(innerExpr, scope);
    const key = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
    (current as Record<string, unknown>)[key as string] = value;
  } else {
    (current as Record<string, unknown>)[finalKey] = value;
  }
}

// ---------------------------------------------------------------------------
// Validate builtin
// ---------------------------------------------------------------------------

function validate(args: string[], ctx: RequestContext): void {
  // Forms:
  //   validate body #Schema
  //   validate body.field == "value" "Custom message"
  if (!args.length) return;

  const firstArg = args[0];
  const scope = buildScopeFromContext(ctx);

  // Schema validation: validate <expr> #SchemaName
  const schemaRef = args.find(a => a.startsWith('#'));
  if (schemaRef) {
    const schemaName = schemaRef.slice(1);
    const schema = ctx.schemas[schemaName];
    const dataExpr = args.filter(a => !a.startsWith('#')).join(' ');
    const data = evaluateExpression(dataExpr || firstArg, scope) as Record<string, unknown>;
    if (!schema || !data || typeof data !== 'object') {
      ctx.response = {
        status: 400,
        body: schema ? `Invalid data for schema ${schemaName}` : `Unknown schema: ${schemaName}`,
        logs: ctx.logs,
      };
      return;
    }
    for (const [field, fieldType] of Object.entries(schema.fields)) {
      if (!(field in data)) {
        ctx.response = {
          status: 400,
          body: `Missing required field: ${field}`,
          logs: ctx.logs,
        };
        return;
      }
      const val = data[field];
      if (fieldType === 'number' && typeof val !== 'number' && isNaN(Number(val))) {
        ctx.response = {
          status: 400,
          body: `Field ${field} must be a number`,
          logs: ctx.logs,
        };
        return;
      }
    }
    return;
  }

  // Conditional validation: validate <condition> "message"
  const msgArg = args.find(a => a.startsWith('"') || a.startsWith("'"));
  const conditionParts = args.filter(a => a !== msgArg);
  const condition = conditionParts.join(' ');
  const message = msgArg ? msgArg.slice(1, -1) : 'Validation failed';

  if (!Boolean(evaluateExpression(condition, scope))) {
    ctx.response = {
      status: 400,
      body: message,
      logs: ctx.logs,
    };
  }
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function parseCsvKey(arg: string): string {
  return arg.replace(/^["']|["']$/g, '');
}

// ---------------------------------------------------------------------------
// Main builtin dispatcher
// ---------------------------------------------------------------------------

/**
 * Execute a builtin command.
 * Returns RESPONDED if respond was called (executor should stop),
 * or a value if the builtin was used as an expression on the RHS of an assignment.
 * Returns undefined for builtins that produce no expression value.
 */
export function executeBuiltin(
  name: string,
  args: string[],
  ctx: RequestContext,
  assignTarget?: string,
): typeof RESPONDED | unknown {
  const scope = buildScopeFromContext(ctx);

  // -------------------------------------------------------------------------
  // log
  // -------------------------------------------------------------------------
  if (name === 'log') {
    const raw = args.map(a => a.replace(/^["']|["']$/g, '')).join(' ');
    const expanded = expandPlaceholders(raw, scope);
    ctx.logs.push(expanded);
    return undefined;
  }

  // -------------------------------------------------------------------------
  // respond / return
  // -------------------------------------------------------------------------
  if (name === 'respond' || name === 'return') {
    let status = 200;
    let bodyExpr: string;

    if (args.length >= 2 && /^\d{3}$/.test(args[0])) {
      status = Number(args[0]);
      bodyExpr = args.slice(1).join(' ');
    } else {
      bodyExpr = args.join(' ');
    }

    const body = evaluateExpression(bodyExpr, scope);
    ctx.response = { status, body, logs: ctx.logs };
    return RESPONDED;
  }

  // -------------------------------------------------------------------------
  // parse-json
  // -------------------------------------------------------------------------
  if (name === 'parse-json') {
    const sourceExpr = args[0];
    let rawStr: string;

    if (sourceExpr) {
      const val = evaluateExpression(sourceExpr, scope);
      rawStr = typeof val === 'string' ? val : JSON.stringify(val);
    } else {
      rawStr = ctx.body ?? '';
    }

    let parsed: unknown;
    try { parsed = JSON.parse(rawStr); } catch (_) { parsed = rawStr; }

    if (assignTarget) {
      ctx.state[assignTarget] = parsed;
    } else {
      ctx.parsedBody = parsed;
      ctx.state['body'] = parsed;
    }
    return parsed;
  }

  // -------------------------------------------------------------------------
  // validate
  // -------------------------------------------------------------------------
  if (name === 'validate') {
    validate(args, ctx);
    if (ctx.response) return RESPONDED;
    return undefined;
  }

  // -------------------------------------------------------------------------
  // csv.read
  // -------------------------------------------------------------------------
  if (name === 'csv.read') {
    const filename = parseCsvKey(args[0] ?? '');
    const data = ctx.fileStore[filename] ?? [];
    if (assignTarget) ctx.state[assignTarget] = data;
    return data;
  }

  // -------------------------------------------------------------------------
  // csv.write
  // -------------------------------------------------------------------------
  if (name === 'csv.write') {
    const filename = parseCsvKey(args[0] ?? '');
    const dataExpr = args[1] ?? '';
    const data = evaluateExpression(dataExpr, scope);
    ctx.fileStore[filename] = Array.isArray(data) ? data as unknown[] : [];
    return undefined;
  }

  // -------------------------------------------------------------------------
  // csv.append
  // -------------------------------------------------------------------------
  if (name === 'csv.append') {
    const filename = parseCsvKey(args[0] ?? '');
    const dataExpr = args.slice(1).join(' ');
    const row = evaluateExpression(dataExpr, scope);
    if (!ctx.fileStore[filename]) ctx.fileStore[filename] = [];
    ctx.fileStore[filename].push(row);
    return undefined;
  }

  // -------------------------------------------------------------------------
  // json.read
  // -------------------------------------------------------------------------
  if (name === 'json.read') {
    const filename = parseCsvKey(args[0] ?? '');
    const data = ctx.fileStore[filename] ?? null;
    if (assignTarget) ctx.state[assignTarget] = data;
    return data;
  }

  // -------------------------------------------------------------------------
  // memory.set / set-memory
  // -------------------------------------------------------------------------
  if (name === 'memory.set' || name === 'set-memory') {
    if (args.length >= 2) {
      const key = args[0];
      const val = evaluateExpression(args.slice(1).join(' '), scope);
      ctx.memoryStore[key] = val;
    } else if (args.length === 1) {
      // set-memory varName — stores ctx.state[varName] under key varName
      const key = args[0];
      const val = ctx.state[key];
      ctx.memoryStore[key] = val;
    }
    return undefined;
  }

  // -------------------------------------------------------------------------
  // memory.get / get-memory
  // -------------------------------------------------------------------------
  if (name === 'memory.get' || name === 'get-memory') {
    const key = args[0];
    const val = ctx.memoryStore[key];
    if (assignTarget) ctx.state[assignTarget] = val;
    return val;
  }

  // -------------------------------------------------------------------------
  // memory.del / del-memory
  // -------------------------------------------------------------------------
  if (name === 'memory.del' || name === 'del-memory') {
    const key = args[0];
    delete ctx.memoryStore[key];
    return undefined;
  }

  // -------------------------------------------------------------------------
  // memory.clear / clear-memory
  // -------------------------------------------------------------------------
  if (name === 'memory.clear' || name === 'clear-memory') {
    for (const k of Object.keys(ctx.memoryStore)) {
      delete ctx.memoryStore[k];
    }
    return undefined;
  }

  // -------------------------------------------------------------------------
  // append / memory.append
  // -------------------------------------------------------------------------
  if (name === 'append' || name === 'memory.append') {
    const targetExpr = args[0];
    const val = evaluateExpression(args.slice(1).join(' '), scope);
    const target = resolvePath(targetExpr, { ...ctx.state, ...ctx.pathParams });
    if (Array.isArray(target)) {
      target.push(val);
    }
    return undefined;
  }

  // -------------------------------------------------------------------------
  // is-set
  // -------------------------------------------------------------------------
  if (name === 'is-set') {
    const pathExpr = args.join(' ');
    const val = evaluateExpression(pathExpr, scope);
    const result = val !== undefined && val !== null;
    if (assignTarget) ctx.state[assignTarget] = result;
    return result;
  }

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------
  if (name === 'delete') {
    const segments = splitPathSegments(args.join(' '));
    if (segments.length === 1) {
      delete ctx.state[segments[0]];
    } else {
      // Traverse to parent and delete final key
      const parentExpr = segments.slice(0, -1).join('.');
      const parent = resolvePath(parentExpr, scope) as Record<string, unknown>;
      if (parent && typeof parent === 'object') {
        const finalKey = segments[segments.length - 1];
        if (Array.isArray(parent) && !isNaN(Number(finalKey))) {
          (parent as unknown[]).splice(Number(finalKey), 1);
        } else {
          delete (parent as Record<string, unknown>)[finalKey];
        }
      }
    }
    return undefined;
  }

  // -------------------------------------------------------------------------
  // stop
  // -------------------------------------------------------------------------
  if (name === 'stop') {
    ctx.response = { status: 200, body: null, logs: ctx.logs };
    return RESPONDED;
  }

  // -------------------------------------------------------------------------
  // load-rune (stub — returns empty in emulator)
  // -------------------------------------------------------------------------
  if (name === 'load-rune') {
    if (assignTarget) ctx.state[assignTarget] = null;
    return null;
  }

  // Unknown builtin — log a warning and continue
  ctx.logs.push(`[emulator] Unknown builtin: ${name}`);
  return undefined;
}

// ---------------------------------------------------------------------------
// Check if a first-token string is a known builtin
// ---------------------------------------------------------------------------

const KNOWN_BUILTINS = new Set([
  'log', 'respond', 'return',
  'parse-json',
  'validate',
  'csv.read', 'csv.write', 'csv.append',
  'json.read', 'json.write',
  'memory.set', 'memory.get', 'memory.clear', 'memory.del',
  'set-memory', 'get-memory', 'clear-memory', 'del-memory',
  'append', 'memory.append',
  'load-rune',
  'is-set',
  'delete',
  'stop',
]);

export function isBuiltin(name: string): boolean {
  return KNOWN_BUILTINS.has(name);
}
