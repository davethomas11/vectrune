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

it('preserves an embedded source literal without evaluating its code or placeholders', () => {
  setupTestContext();
  const source = 'Count: {count}\nclick="count = count + 1"\n# a user\'s code\\n';
  expect(evaluateExpression(JSON.stringify(source), {})).toBe(source);
  expect(evaluateExpression('"hello" + " world"', {})).toBe('hello world');
});

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

  it('evaluates subtraction, multiplication, division, and modulo', () => {
    expect(evaluateExpression('100 - 30', buildScope({}))).toBe(70);
    expect(evaluateExpression('6 * 7', buildScope({}))).toBe(42);
    expect(evaluateExpression('100 / 4', buildScope({}))).toBe(25);
    expect(evaluateExpression('17 % 5', buildScope({}))).toBe(2);
  });

  it('evaluates numeric comparisons <, <=, >, >=', () => {
    expect(evaluateExpression('10 < 20', buildScope({}))).toBe(true);
    expect(evaluateExpression('20 < 10', buildScope({}))).toBe(false);
    expect(evaluateExpression('10 <= 10', buildScope({}))).toBe(true);
    expect(evaluateExpression('15 >= 15', buildScope({}))).toBe(true);
    expect(evaluateExpression('25 > 10', buildScope({}))).toBe(true);
  });

  it('evaluates spatial collide, clamp, abs, random, min, max', () => {
    const scope = buildScope({
      bullet: { x: 100, y: 150 },
      alien: { x: 105, y: 152 },
      farAlien: { x: 200, y: 300 },
    });
    expect(evaluateExpression('collide(bullet, alien, 20, 20)', scope)).toBe(true);
    expect(evaluateExpression('collide(bullet, farAlien, 20, 20)', scope)).toBe(false);
    expect(evaluateExpression('clamp(500, 10, 400)', scope)).toBe(400);
    expect(evaluateExpression('clamp(0, 10, 400)', scope)).toBe(10);
    expect(evaluateExpression('clamp(150, 10, 400)', scope)).toBe(150);
    expect(evaluateExpression('abs(0 - 25)', scope)).toBe(25);
    const rnd = evaluateExpression('random(5, 10)', scope) as number;
    expect(rnd).toBeGreaterThanOrEqual(5);
    expect(rnd).toBeLessThanOrEqual(10);
    expect(evaluateExpression('min(10, 5, 20)', scope)).toBe(5);
    expect(evaluateExpression('max(10, 5, 20)', scope)).toBe(20);
  });

  it('evaluates unary negation on variables and expressions', () => {
    const scope = buildScope({
      dir: 1,
      speed: 5,
    });
    expect(evaluateExpression('-dir', scope)).toBe(-1);
    expect(evaluateExpression('-1', scope)).toBe(-1);
    expect(evaluateExpression('-speed', scope)).toBe(-5);
  });
});
