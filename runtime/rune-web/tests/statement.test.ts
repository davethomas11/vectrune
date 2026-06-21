import { describe, it, expect, beforeEach } from 'vitest';
import { initContext } from '../src/context';
import { assignPath, deletePath, executeStatement } from '../src/statement';
import type { RuneApp } from '../src/types';

function setupTestContext(state: Record<string, unknown> = {}) {
  const app: RuneApp = {
    state: { ...state },
    derived: {},
    computeDerived: () => {},
    render: () => {},
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

describe('assignPath', () => {
  it('assigns to top-level state', () => {
    const app = setupTestContext({ count: 0 });
    assignPath('count', 5, {});
    expect(app.state.count).toBe(5);
  });

  it('assigns to nested path', () => {
    const app = setupTestContext({ user: { name: 'old' } });
    assignPath('user.name', 'new', {});
    expect((app.state.user as Record<string, unknown>).name).toBe('new');
  });

  it('assigns to locals when key exists in locals', () => {
    const app = setupTestContext({ x: 'state' });
    const locals: Record<string, unknown> = { x: 'local' };
    assignPath('x', 'updated', locals);
    expect(locals.x).toBe('updated');
    expect(app.state.x).toBe('state'); // state unchanged
  });
});

describe('deletePath', () => {
  it('deletes from array by filter', () => {
    const app = setupTestContext({
      todos: [
        { id: 1, text: 'a' },
        { id: 2, text: 'b' },
        { id: 3, text: 'c' },
      ],
    });
    deletePath('todos[].(it.id == id)', { id: 2 });
    expect((app.state.todos as unknown[]).length).toBe(2);
    expect(
      (app.state.todos as Array<{ id: number }>).find((t) => t.id === 2),
    ).toBeUndefined();
  });

  it('deletes from array using shorthand', () => {
    const app = setupTestContext({
      todos: [
        { id: 1, text: 'a' },
        { id: 2, text: 'b' },
      ],
    });
    // The shorthand []id gets expanded to [].(it.id == id)
    deletePath('todos[]id', { id: 1 });
    expect((app.state.todos as unknown[]).length).toBe(1);
  });
});

describe('executeStatement', () => {
  it('handles assignment', () => {
    const app = setupTestContext({ x: 0 });
    executeStatement('x = 5', {});
    expect(app.state.x).toBe(5);
  });

  it('handles increment', () => {
    const app = setupTestContext({ count: 3 });
    executeStatement('count++', {});
    expect(app.state.count).toBe(4);
  });

  it('handles invert', () => {
    const app = setupTestContext({ flag: true });
    executeStatement('invert flag', {});
    expect(app.state.flag).toBe(false);
  });

  it('handles stop', () => {
    setupTestContext({});
    expect(executeStatement('stop', {})).toBe(false);
  });

  it('handles push', () => {
    const app = setupTestContext({ items: [1, 2] });
    executeStatement('items.push(3)', {});
    expect(app.state.items).toEqual([1, 2, 3]);
  });

  it('handles delete', () => {
    const app = setupTestContext({
      todos: [
        { id: 1, text: 'a' },
        { id: 2, text: 'b' },
      ],
    });
    executeStatement('delete todos[].(it.id == id)', { id: 1 });
    expect((app.state.todos as unknown[]).length).toBe(1);
  });
});
