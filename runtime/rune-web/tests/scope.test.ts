import { describe, it, expect, beforeEach, vi } from 'vitest';
import { splitPathSegments, buildScope, makeReactive } from '../src/scope';
import { initContext, ctx } from '../src/context';
import * as globals from '../src/globals';
import type { RuneApp } from '../src/types';

function setupTestContext(state: Record<string, unknown> = {}, derived: Record<string, unknown> = {}) {
  const app: RuneApp = {
    state: { ...state },
    derived: { ...derived },
    computeDerived: () => {},
    render: vi.fn(),
    invokeAction: () => {},
  };
  initContext({
    pageTree: { Text: '' },
    derivedDefinitions: {},
    helperDefinitions: {},
    actionDefinitions: {},
    i18nData: {},
    app,
    isRendering: false,
    memorySubscriptions: {},
  });
  return app;
}

describe('splitPathSegments', () => {
  it('splits simple dotted paths', () => {
    expect(splitPathSegments('a.b.c')).toEqual(['a', 'b', 'c']);
  });

  it('handles bracket notation', () => {
    expect(splitPathSegments('a[b][c]')).toEqual(['a', '[b]', '[c]']);
  });

  it('handles array filter notation', () => {
    expect(splitPathSegments('todos[].(it.id == id).text')).toEqual([
      'todos',
      '[].(it.id == id)',
      'text',
    ]);
  });

  it('expands []id shorthand', () => {
    expect(splitPathSegments('todos[]id.text')).toEqual([
      'todos',
      '[].(it.id == id)',
      'text',
    ]);
  });
});

describe('buildScope', () => {
  it('merges state, derived, and locals', () => {
    setupTestContext({ a: 1 }, { b: 2 });
    const scope = buildScope({ c: 3, a: 10 }); // locals override state
    expect(scope).toEqual({ a: 10, b: 2, c: 3 });
  });
});

describe('makeReactive', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: Function) => cb());
    vi.spyOn(globals, 'getWindowProp').mockImplementation((key) => {
      if (key === '__renderingComponent') return 'componentA';
      return undefined;
    });
  });

  it('returns proxy for objects', () => {
    const obj = { a: 1 };
    const proxy = makeReactive(obj);
    expect(proxy).not.toBe(obj);
    expect(proxy.a).toBe(1);
    expect((proxy as any).__isProxy).toBe(true);
  });

  it('does not double wrap', () => {
    const obj = { a: 1 };
    const proxy1 = makeReactive(obj);
    const proxy2 = makeReactive(proxy1 as any);
    expect(proxy1).toBe(proxy2);
  });

  it('tracks subscriptions on get', () => {
    const app = setupTestContext({ a: 1 });
    const proxy = makeReactive({ a: 1 });
    proxy.a; // Access property
    
    // Check if subscription was recorded
    const { memorySubscriptions } = ctx();
    expect(memorySubscriptions['a'].has('componentA')).toBe(true);
  });

  it('triggers render on set', () => {
    const app = setupTestContext();
    const proxy = makeReactive({ a: 1 });
    proxy.a = 2;
    expect(app.render).toHaveBeenCalled();
  });

  it('triggers render on delete', () => {
    const app = setupTestContext();
    const proxy = makeReactive({ a: 1 });
    delete proxy.a;
    expect(app.render).toHaveBeenCalled();
  });
});
