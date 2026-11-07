// ============================================================================
// Scope management — path splitting, scope building, reactivity
// ============================================================================

import { ctx } from './context';
import { getWindowProp, setWindowProp } from './globals';
import { handleNavigatorStateChange } from './navigator';
import type { Scope } from './types';

/**
 * Split a dotted/bracketed path expression into segments.
 *
 * Handles:
 *  - `a.b.c` → ['a', 'b', 'c']
 *  - `a[].(it.x == y).z` → ['a', '[].(it.x == y)', 'z']
 *  - `a[expr]` → ['a', '[expr]']
 *  - `a[]id` → expanded to `a[].(it.id == id)` first
 */
export function splitPathSegments(expr: string): string[] {
  // Expand shorthand: todos[]id → todos[].(it.id == id)
  const str = String(expr || '').replace(/\[\]([a-zA-Z_$][\w$]*)/g, '[].(it.$1 == $1)');
  const segments: string[] = [];
  let current = '';
  let inBrackets = false;
  let inParens = 0;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(') inParens++;
    if (ch === ')') inParens = Math.max(0, inParens - 1);

    if (inParens > 0 && !(ch === '(' && str.slice(i - 3, i + 1) === '[].(')) {
      current += ch;
      continue;
    }

    if (ch === '.' && !inBrackets) {
      if (current.trim()) segments.push(current.trim());
      current = '';
      continue;
    }
    if (ch === '[') {
      if (str.slice(i, i + 4) === '[].(') {
        if (current.trim()) segments.push(current.trim());
        current = '[].(';
        i += 3;
        inParens++;
        continue;
      }
      if (current.trim()) segments.push(current.trim());
      current = '[';
      inBrackets = true;
      continue;
    }
    if (ch === ']') {
      if (inBrackets) {
        current += ']';
        segments.push(current.trim());
        current = '';
        inBrackets = false;
        continue;
      }
    }
    current += ch;
  }

  if (current.trim()) segments.push(current.trim());
  return segments;
}

/** Build a combined scope from app state, derived values, and local bindings. */
export function buildScope(locals: Record<string, unknown>): Scope {
  const c = ctx();
  return Object.assign({}, c.app.state, c.app.derived, locals || {});
}

const proxyCache = new WeakMap<object, Record<string, unknown>>();
let renderQueued = false;

function scheduleRender(): void {
  const context = ctx();
  if (context.isRendering || !context.app.render || renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    const currentCtx = ctx();
    if (!currentCtx.isRendering && currentCtx.app.render) {
      currentCtx.app.render();
    }
  });
}

/**
 * Wrap an object in a Proxy that triggers re-renders on mutation
 * and tracks memory subscriptions for granular updates.
 */
export function makeReactive(obj: Record<string, unknown>): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object') return obj;
  if ((obj as Record<string, unknown>).__isProxy) return obj;

  const cached = proxyCache.get(obj);
  if (cached) return cached;

  const context = ctx();

  const proxy = new Proxy(obj, {
    get(target: Record<string, unknown>, prop: string | symbol) {
      if (prop === '__isProxy') return true;
      if (prop === '__raw') return target;
      if (
        getWindowProp('__renderingComponent') &&
        typeof prop === 'string' &&
        !prop.startsWith('__')
      ) {
        if (!(context.memorySubscriptions[prop] instanceof Set)) {
          context.memorySubscriptions[prop] = new Set();
        }
        context.memorySubscriptions[prop].add(
          getWindowProp('__renderingComponent') as string,
        );
      }
      const val = target[prop as string];
      if (val !== null && typeof val === 'object' && !(val as Record<string, unknown>).__isProxy) {
        return makeReactive(val as Record<string, unknown>);
      }
      return val;
    },
    set(target: Record<string, unknown>, prop: string | symbol, value: unknown) {
      const rawValue =
        value !== null && typeof value === 'object' && (value as Record<string, unknown>).__raw
          ? (value as Record<string, unknown>).__raw
          : value;
      if (target[prop as string] === rawValue) return true;
      target[prop as string] = rawValue;
      if (typeof prop === 'string' && context.navigator && prop === context.navigator.bind) {
        handleNavigatorStateChange(prop, rawValue);
      }
      scheduleRender();
      return true;
    },
    deleteProperty(target: Record<string, unknown>, prop: string | symbol) {
      delete target[prop as string];
      scheduleRender();
      return true;
    },
  });

  proxyCache.set(obj, proxy);
  return proxy;
}
