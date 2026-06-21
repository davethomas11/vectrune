import { describe, it, expect, beforeEach } from 'vitest';
import { initContext } from '../src/context';
import {
  evaluateExpression,
  resolvePath,
  resolveValue,
  tryParseLiteral,
} from '../src/expression';
import { buildScope } from '../src/scope';
import type { RuneApp } from '../src/types';

// Create a minimal context for testing
function setupTestContext(
  state: Record<string, unknown> = {},
  helpers: Record<string, { params: string[]; body: string[] }> = {},
) {
  const app: RuneApp = {
    state,
    derived: {},
    computeDerived: () => {},
    render: () => {},
    invokeAction: () => {},
  };
  initContext({
    pageTree: { Text: '' },
    derivedDefinitions: {},
    helperDefinitions: helpers,
    actionDefinitions: {},
    i18nData: {},
    app,
    isRendering: false,
    memorySubscriptions: {},
  });
  return app;
}

describe('tryParseLiteral', () => {
  it('parses booleans', () => {
    expect(tryParseLiteral('true')).toBe(true);
    expect(tryParseLiteral('false')).toBe(false);
  });

  it('parses numbers', () => {
    expect(tryParseLiteral('42')).toBe(42);
    expect(tryParseLiteral('3.14')).toBe(3.14);
  });

  it('parses quoted strings', () => {
    expect(tryParseLiteral('"hello"')).toBe('hello');
  });

  it('parses null', () => {
    expect(tryParseLiteral('null')).toBe(null);
  });

  it('returns undefined for unrecognized', () => {
    expect(tryParseLiteral('someVar')).toBe(undefined);
  });
});

describe('resolvePath', () => {
  beforeEach(() => {
    setupTestContext();
  });

  it('resolves simple property', () => {
    const scope = { name: 'Dave' };
    expect(resolvePath('name', scope)).toBe('Dave');
  });

  it('resolves nested path', () => {
    const scope = { user: { name: 'Dave' } };
    expect(resolvePath('user.name', scope)).toBe('Dave');
  });

  it('resolves array length', () => {
    const scope = { items: [1, 2, 3] };
    expect(resolvePath('items.length', scope)).toBe(3);
  });

  it('resolves array filter', () => {
    const scope = {
      todos: [
        { id: 1, text: 'a' },
        { id: 2, text: 'b' },
      ],
      id: 2,
    };
    expect(resolvePath('todos[].(it.id == id).text', scope)).toBe('b');
  });
});

describe('evaluateExpression', () => {
  beforeEach(() => {
    setupTestContext({
      count: 5,
      name: 'Dave',
      items: [1, 2, 3],
      todos: [
        { id: 1, text: 'Learn', completed: false },
        { id: 2, text: 'Build', completed: true },
        { id: 3, text: 'Deploy', completed: false },
      ],
    });
  });

  it('resolves state variables', () => {
    expect(evaluateExpression('count', buildScope({}))).toBe(5);
    expect(evaluateExpression('name', buildScope({}))).toBe('Dave');
  });

  it('handles equality', () => {
    expect(evaluateExpression('count == 5', buildScope({}))).toBe(true);
    expect(evaluateExpression('count == 6', buildScope({}))).toBe(false);
  });

  it('handles inequality', () => {
    expect(evaluateExpression('count != 6', buildScope({}))).toBe(true);
  });

  it('handles negation', () => {
    expect(evaluateExpression('!false', buildScope({}))).toBe(true);
    expect(evaluateExpression('!true', buildScope({}))).toBe(false);
  });

  it('handles addition', () => {
    expect(evaluateExpression('count + 1', buildScope({}))).toBe(6);
  });

  it('handles string concatenation', () => {
    expect(evaluateExpression('name + " T"', buildScope({}))).toBe('Dave T');
  });

  it('handles ternary', () => {
    expect(
      evaluateExpression("count == 5 ? 'yes' : 'no'", buildScope({})),
    ).toBe('yes');
  });

  it('handles filter method', () => {
    const result = evaluateExpression(
      'todos.filter it.completed == true',
      buildScope({}),
    );
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(1);
  });

  it('handles filter.length', () => {
    const result = evaluateExpression(
      'todos.filter it.completed == true.length',
      buildScope({}),
    );
    expect(result).toBe(1);
  });

  it('handles array length via path', () => {
    expect(evaluateExpression('items.length', buildScope({}))).toBe(3);
    expect(evaluateExpression('todos.length', buildScope({}))).toBe(3);
  });

  it('handles logical or', () => {
    expect(evaluateExpression('false or true', buildScope({}))).toBe(true);
    expect(evaluateExpression('false or false', buildScope({}))).toBe(false);
  });

  it('handles logical and', () => {
    expect(evaluateExpression('true and true', buildScope({}))).toBe(true);
    expect(evaluateExpression('true and false', buildScope({}))).toBe(false);
  });

  it('handles swap', () => {
    expect(
      evaluateExpression("swap name Dave Thomas", buildScope({})),
    ).toBe('Thomas');
  });

  it('resolves literals', () => {
    expect(evaluateExpression('42', buildScope({}))).toBe(42);
    expect(evaluateExpression('"hello"', buildScope({}))).toBe('hello');
    expect(evaluateExpression('true', buildScope({}))).toBe(true);
  });

  it('handles depth limit', () => {
    expect(evaluateExpression('count', buildScope({}), 100)).toBe(undefined);
  });
});
