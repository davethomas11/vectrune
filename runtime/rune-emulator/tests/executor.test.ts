import { describe, it, expect } from 'vitest';
import { createRequestContext } from '../src/engine/context';
import { executeSteps } from '../src/engine/executor';
import type { RunStep } from '../src/types';

function makeCtx(body?: string, pathParams?: Record<string, string>) {
  return createRequestContext(
    { method: 'GET', path: '/test', body },
    pathParams ?? {},
    {},
    {},
    {},
  );
}

// ---------------------------------------------------------------------------
// log builtin
// ---------------------------------------------------------------------------

describe('executor — log', () => {
  it('appends a plain message to logs', () => {
    const ctx = makeCtx();
    const steps: RunStep[] = [
      { kind: 'builtin', name: 'log', args: ['"Hello world"'] },
    ];
    executeSteps(steps, ctx);
    expect(ctx.logs).toContain('Hello world');
  });

  it('expands {placeholder} in log messages', () => {
    const ctx = makeCtx(undefined, { id: '42' });
    const steps: RunStep[] = [
      { kind: 'builtin', name: 'log', args: ['"Fetching', 'user', 'ID:', '{id}"'] },
    ];
    executeSteps(steps, ctx);
    expect(ctx.logs[0]).toContain('42');
  });
});

// ---------------------------------------------------------------------------
// respond builtin
// ---------------------------------------------------------------------------

describe('executor — respond', () => {
  it('sets response with status and body', () => {
    const ctx = makeCtx();
    const steps: RunStep[] = [
      { kind: 'builtin', name: 'respond', args: ['200', '"OK"'] },
    ];
    executeSteps(steps, ctx);
    expect(ctx.response).not.toBeNull();
    expect(ctx.response!.status).toBe(200);
    expect(ctx.response!.body).toBe('OK');
  });

  it('stops execution after respond', () => {
    const ctx = makeCtx();
    const steps: RunStep[] = [
      { kind: 'builtin', name: 'respond', args: ['200', '"First"'] },
      { kind: 'builtin', name: 'log', args: ['"Should not run"'] },
    ];
    executeSteps(steps, ctx);
    expect(ctx.logs).toHaveLength(0);
  });

  it('supports 404 respond', () => {
    const ctx = makeCtx();
    const steps: RunStep[] = [
      { kind: 'builtin', name: 'respond', args: ['404', '"Not found"'] },
    ];
    executeSteps(steps, ctx);
    expect(ctx.response!.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// parse-json builtin
// ---------------------------------------------------------------------------

describe('executor — parse-json', () => {
  it('parses body string into object', () => {
    const ctx = makeCtx('{"name":"Alice","email":"a@ex.com"}');
    const steps: RunStep[] = [
      { kind: 'builtin', name: 'parse-json', args: [] },
    ];
    executeSteps(steps, ctx);
    expect(ctx.parsedBody).toMatchObject({ name: 'Alice', email: 'a@ex.com' });
  });

  it('parsed body accessible as body in expressions', () => {
    const ctx = makeCtx('{"score":99}');
    const steps: RunStep[] = [
      { kind: 'builtin', name: 'parse-json', args: [] },
      { kind: 'assignment', lhs: 'score', rhs: 'body.score' },
    ];
    executeSteps(steps, ctx);
    expect(ctx.state['score']).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

describe('executor — assignments', () => {
  it('assigns a literal number', () => {
    const ctx = makeCtx();
    const steps: RunStep[] = [
      { kind: 'assignment', lhs: 'count', rhs: '42' },
    ];
    executeSteps(steps, ctx);
    expect(ctx.state['count']).toBe(42);
  });

  it('assigns result of arithmetic expression', () => {
    const ctx = makeCtx();
    const steps: RunStep[] = [
      { kind: 'assignment', lhs: 'a', rhs: '10' },
      { kind: 'assignment', lhs: 'b', rhs: '5' },
      { kind: 'assignment', lhs: 'result', rhs: 'a + b' },
    ];
    executeSteps(steps, ctx);
    expect(ctx.state['result']).toBe(15);
  });

  it('assigns subtraction result (emulator extension)', () => {
    const ctx = makeCtx();
    const steps: RunStep[] = [
      { kind: 'assignment', lhs: 'x', rhs: '10 - 3' },
    ];
    executeSteps(steps, ctx);
    expect(ctx.state['x']).toBe(7);
  });

  it('resolves path reference', () => {
    const ctx = makeCtx();
    ctx.state['users'] = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
    const steps: RunStep[] = [
      { kind: 'assignment', lhs: 'user', rhs: 'users.find it.id == 1' },
    ];
    executeSteps(steps, ctx);
    expect(ctx.state['user']).toMatchObject({ id: 1, name: 'Alice' });
  });
});

// ---------------------------------------------------------------------------
// if conditionals
// ---------------------------------------------------------------------------

describe('executor — if', () => {
  it('executes body when condition is true', () => {
    const ctx = makeCtx();
    ctx.state['x'] = 5;
    const steps: RunStep[] = [
      {
        kind: 'if',
        condition: 'x == 5',
        body: [{ kind: 'builtin', name: 'log', args: ['"hit"'] }],
      },
    ];
    executeSteps(steps, ctx);
    expect(ctx.logs).toContain('hit');
  });

  it('skips body when condition is false', () => {
    const ctx = makeCtx();
    ctx.state['x'] = 0;
    const steps: RunStep[] = [
      {
        kind: 'if',
        condition: 'x == 5',
        body: [{ kind: 'builtin', name: 'log', args: ['"hit"'] }],
      },
    ];
    executeSteps(steps, ctx);
    expect(ctx.logs).toHaveLength(0);
  });

  it('if with respond stops execution', () => {
    const ctx = makeCtx();
    ctx.state['found'] = null;
    const steps: RunStep[] = [
      {
        kind: 'if',
        condition: 'found == null',
        body: [{ kind: 'builtin', name: 'respond', args: ['404', '"Not found"'] }],
      },
      { kind: 'builtin', name: 'log', args: ['"after if"'] },
    ];
    executeSteps(steps, ctx);
    expect(ctx.response!.status).toBe(404);
    expect(ctx.logs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// csv builtins
// ---------------------------------------------------------------------------

describe('executor — csv builtins', () => {
  it('csv.read returns seeded data', () => {
    const seeded = [{ id: 1, name: 'Alice' }];
    const ctx = createRequestContext(
      { method: 'GET', path: '/users' },
      {},
      {},
      { 'users.csv': seeded },
      {},
    );
    const steps: RunStep[] = [
      { kind: 'assignment', lhs: 'users', rhs: 'csv.read "users.csv"' },
    ];
    executeSteps(steps, ctx);
    expect(ctx.state['users']).toEqual(seeded);
  });

  it('csv.append adds a record', () => {
    const ctx = createRequestContext(
      { method: 'POST', path: '/users' },
      {},
      {},
      { 'users.csv': [{ id: 1, name: 'Alice' }] },
      {},
    );
    ctx.parsedBody = { id: 2, name: 'Bob' };
    ctx.state['body'] = ctx.parsedBody;
    const steps: RunStep[] = [
      { kind: 'builtin', name: 'csv.append', args: ['"users.csv"', 'body'] },
    ];
    executeSteps(steps, ctx);
    expect(ctx.fileStore['users.csv']).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// memory builtins
// ---------------------------------------------------------------------------

describe('executor — memory builtins', () => {
  it('memory.set and memory.get round-trip', () => {
    const ctx = makeCtx();
    const steps: RunStep[] = [
      { kind: 'assignment', lhs: 'items', rhs: '["a","b","c"]' },
      { kind: 'builtin', name: 'memory.set', args: ['items', 'items'] },
    ];
    executeSteps(steps, ctx);
    expect(ctx.memoryStore['items']).toEqual(['a', 'b', 'c']);

    const ctx2 = createRequestContext({ method: 'GET', path: '/' }, {}, {}, {}, ctx.memoryStore);
    const steps2: RunStep[] = [
      { kind: 'assignment', lhs: 'result', rhs: 'memory.get items' },
    ];
    executeSteps(steps2, ctx2);
    expect(ctx2.state['result']).toEqual(['a', 'b', 'c']);
  });
});
