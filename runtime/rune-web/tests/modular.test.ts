import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ctx, initContext } from '../src/context';
import { createLogicApp } from '../src/logic';
import { clearExpressionCache, evaluateExpression } from '../src/expression';
import { assignPath, deletePath, executeStatement } from '../src/statement';
import { buildScope } from '../src/scope';
import { parseHandlerSpec } from '../src/events';
import { inLogicScope } from '../src/modular';
import type { ActionDefinition } from '../src/types';

const statement = (line: string, scope?: string, params: string[] = [], privateMember = false): ActionDefinition =>
  ({ params, steps: [{ Statement: line }], scope, private: privateMember });

function setup() {
  const app = createLogicApp(() => {});
  app.state = { count: 99, wallet: { count: 10 }, second: { count: 20 }, pet: null };
  initContext({
    app, pageTree: { Text: '' }, derivedDefinitions: {}, i18nData: {},
    memorySubscriptions: {}, isRendering: false,
    actionDefinitions: {
      'wallet.add': statement('call hidden amount', 'wallet', ['amount']),
      'wallet.hidden': statement('count += amount', 'wallet', ['amount'], true),
      'second.add': statement('count += amount', 'second', ['amount']),
      'Life.advance': statement('age += seconds', '@Life', ['seconds']),
      'Pet.advance': statement('call care.advance seconds', '@Pet', ['seconds']),
      make: statement('pet = Pet("pet-1")'),
    },
    helperDefinitions: {
      Life: { params: ['id', 'fields'], body: [], entity: { age: '0', hunger: '0' } },
      Pet: { params: ['id', 'fields'], body: [], entity: { name: '"Pebble"', care: 'Life(id+"-life")' } },
      'wallet.balance': { params: [], body: ['return count'], scope: 'wallet' },
      'second.balance': { params: [], body: ['return count'], scope: 'second' },
    },
  });
  return app;
}

describe('logic modules and composed entities', () => {
  beforeEach(clearExpressionCache);
  afterEach(() => vi.unstubAllGlobals());

  it('reuses the existing context for unscoped actions and helpers, including nested calls', () => {
    const app = setup();
    const context = ctx();
    context.actionDefinitions.legacy = statement('call legacyInner amount', undefined, ['amount']);
    context.actionDefinitions.legacyInner = statement('count += legacyValue(amount)', undefined, ['amount']);
    context.helperDefinitions.legacyValue = { params: ['amount'], body: ['return amount+bonus'] };
    let reads = 0;
    Object.defineProperty(app.state, 'count', {
      enumerable: true,
      get() { expect(ctx()).toBe(context); reads++; return 99; },
      set(value) { expect(ctx()).toBe(context); expect(value).toBe(106); },
    });
    app.invokeAction('legacy', [3], { bonus: 4 });
    expect(reads).toBeGreaterThan(0);
    expect(ctx()).toBe(context);
    expect(() => inLogicScope('legacy', statement(''), undefined, () => {
      expect(ctx()).toBe(context);
      throw new Error('legacy failure');
    })).toThrow('legacy failure');
    expect(ctx()).toBe(context);
  });

  it('isolates state and caller locals, allows private internal calls, and restores scope', () => {
    const app = setup();
    app.invokeAction('wallet.add', [3], { count: 1000 });
    expect(app.state.wallet).toEqual({ count: 13 });
    expect(app.state.count).toBe(99);
    expect(ctx().logicOwner).toBeUndefined();
    expect(() => app.invokeAction('wallet.hidden', [1])).toThrow('Private');
    expect(() => assignPath('wallet.count', 1, {})).toThrow('read-only');
    expect(() => executeStatement('call wallet.missing', {})).toThrow('Unknown');
    expect(ctx().logicOwner).toBeUndefined();
    expect(evaluateExpression('wallet.balance()', buildScope({}))).toBe(13);
    expect(evaluateExpression('second.balance()', buildScope({}))).toBe(20);
    expect(parseHandlerSpec('wallet.add(2)')?.name).toBe('wallet.add');
  });

  it('creates independent plain-data instances and dispatches nested composed methods', () => {
    const app = setup();
    app.invokeAction('make', []);
    app.invokeAction('pet.advance', [5]);
    expect(app.state.pet).toEqual({
      id: 'pet-1', __type: 'Pet', name: 'Pebble',
      care: { id: 'pet-1-life', __type: 'Life', age: 5, hunger: 0 },
    });
    const other = evaluateExpression('Pet("pet-2", {"name":"Shelly"})', buildScope({}));
    expect(other).toMatchObject({ id: 'pet-2', name: 'Shelly', care: { age: 0 } });
    // JSON restores method dispatch without serializing functions or prototypes.
    app.state.pet = JSON.parse(JSON.stringify(app.state.pet));
    app.invokeAction('pet.advance', [2]);
    expect(app.state.pet).toMatchObject({ care: { age: 7 } });
    expect(() => evaluateExpression('Life("")', buildScope({}))).toThrow('stable');
    expect(() => evaluateExpression('Life("x", null)', buildScope({}))).toThrow('record');
    expect(() => evaluateExpression('Life("x", {}, 1)', buildScope({}))).toThrow('accepts');
    expect(() => evaluateExpression('Life("x", {"typo":1})', buildScope({}))).toThrow('Unknown Life field');
    expect(() => app.invokeAction('Life.advance', [1])).toThrow('receiver');
  });

  it('separates compilation caches across app helper registries', () => {
    setup();
    evaluateExpression('probe()', buildScope({}));
    setup();
    ctx().helperDefinitions.probe = { params: [], body: ['return 23'] };
    expect(evaluateExpression('probe()', buildScope({}))).toBe(23);
  });

  it('reports recursive composition and allows construction after the failure', () => {
    setup();
    ctx().helperDefinitions.Loop = { params: ['id'], body: [], entity: { child: 'Loop(id)' } };
    expect(() => evaluateExpression('Loop("x")', buildScope({}))).toThrow('cyclic');
    expect(evaluateExpression('Life("ok")', buildScope({}))).toMatchObject({ id: 'ok', age: 0 });
  });

  it('protects module objects and arrays even through aliases and exported helpers', () => {
    const app = setup();
    app.state.wallet.items = [{ value: 1 }];
    ctx().helperDefinitions['wallet.snapshot'] = { params: [], body: ['return items'], scope: 'wallet' };
    const scope = buildScope({});
    const wallet = evaluateExpression('wallet', scope) as Record<string, unknown>;
    expect(() => assignPath('alias.count', 2, { alias: wallet })).toThrow('read-only');
    expect(() => deletePath('alias.count', { alias: wallet })).toThrow('read-only');
    expect(() => executeStatement('wallet.items.push(2)', {})).toThrow('read-only');
    const items = evaluateExpression('wallet.snapshot()', scope) as unknown[];
    expect(() => items.push(2)).toThrow('read-only');
    expect(app.state.wallet.items).toEqual([{ value: 1 }]);
    ctx().actionDefinitions['wallet.append'] = statement('list.push(2)', 'wallet', ['list']);
    app.invokeAction('wallet.append', [items]);
    expect(app.state.wallet.items).toEqual([{ value: 1 }, 2]);
  });

  it('preserves identity on computed assignments and deletions after JSON restore', () => {
    const app = setup();
    app.invokeAction('make', []);
    app.state.pet = JSON.parse(JSON.stringify(app.state.pet));
    for (const path of ['pet.id', 'pet["id"]', 'pet.__type', 'pet["__type"]']) {
      expect(() => assignPath(path, 'changed', {})).toThrow('immutable');
      expect(() => deletePath(path, {})).toThrow('immutable');
    }
    ctx().actionDefinitions['Pet.breakIdentity'] = statement('id = "changed"', '@Pet');
    expect(() => app.invokeAction('pet.breakIdentity', [])).toThrow('immutable');
    expect(ctx().logicOwner).toBeUndefined();
    expect(app.state.pet.id).toBe('pet-1');
  });

  it('dispatches internal type calls on the same receiver and forbids implicit root calls', () => {
    const app = setup();
    ctx().actionDefinitions['Life.twice'] = statement('call advance seconds*2', '@Life', ['seconds']);
    ctx().actionDefinitions['wallet.escape'] = statement('call make', 'wallet');
    app.invokeAction('make', []);
    app.invokeAction('pet.care.twice', [3]);
    expect(app.state.pet.care.age).toBe(6);
    expect(() => app.invokeAction('wallet.escape', [])).toThrow('unscoped');
    expect(ctx().logicOwner).toBeUndefined();
  });

  it.each(['assignment', 'callback'])('keeps module and app ownership through asynchronous fetch %s', async (mode) => {
    const app = setup();
    app.state.wallet.result = null;
    ctx().actionDefinitions['wallet.receive'] = statement('count += result.amount', 'wallet', ['result'], true);
    ctx().actionDefinitions['wallet.load'] = {
      scope: 'wallet', params: [],
      steps: mode === 'assignment'
        ? [{ Statement: 'result = fetch-json "https://example.test/data"' }, { Statement: 'call receive result' }]
        : [{ Statement: 'fetch-json "https://example.test/data" then receive' }],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"amount":4}')));
    app.invokeAction('wallet.load', []);
    const other = setup();
    await vi.waitFor(() => expect(app.state.wallet.count).toBe(14));
    expect(other.state.wallet.count).toBe(10);
    expect(ctx().app).toBe(other);
    expect(ctx().logicOwner).toBeUndefined();
  });
});
