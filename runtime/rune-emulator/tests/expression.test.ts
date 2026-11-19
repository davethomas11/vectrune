import { describe, expect, it } from 'vitest';
import fixtures from '../../../tests/conformance/expressions.json';
import objects from '../../../tests/conformance/objects.json';
import programs from '../../../tests/conformance/object_programs.json';
import { evaluateExpression } from '../src/engine/evaluate';
import { createApp, parse } from '../src/index';

describe('shared expression conformance', () => {
  for (const fixture of fixtures) it(fixture.category, () => {
    expect(evaluateExpression(fixture.expr, fixture.context)).toEqual(fixture.expected);
  });
  for (const fixture of objects) it(fixture.category, () => {
    expect(evaluateExpression(fixture.expr, fixture.context)).toEqual(fixture.expected);
  });
  for (const fixture of programs) it(fixture.category, () => {
    const source = fixture.statements.join('\n').split('\n').map(s => `    ${s}`).join('\n');
    const app = createApp(parse(`@App\ntype = REST\n@Route/GET /test\nrun:\n${source}\n    respond 200 result\n`));
    expect(app.request({ method: 'GET', path: '/test' })).toMatchObject({ status: 200, body: fixture.expected });
  });

  it('reuses compiled expressions with the current request scope', () => {
    expect(evaluateExpression('score * 2 + 1', { score: 3 })).toBe(7);
    expect(evaluateExpression('score * 2 + 1', { score: 8 })).toBe(17);
  });

  it('preserves bare text and emulator collection shorthand', () => {
    const scope = { users: [{ id: 1 }, { id: 2 }], cells: ['X', '', 'X'] };
    expect(evaluateExpression('hello world', scope)).toBe('hello world');
    expect(evaluateExpression('hello', scope)).toBe('hello');
    expect(evaluateExpression('users.find it.id == 2', scope)).toEqual({ id: 2 });
    expect(evaluateExpression('users.filter(it.id > 1).length', scope)).toBe(1);
    expect(evaluateExpression('cells.mask("X")', scope)).toBe(5);
    expect(evaluateExpression('full cells', scope)).toBe(false);
    expect(evaluateExpression('swap "X" "X" "O"', scope)).toBe('O');
  });

  it('evaluates canonical expressions through parsed REST route steps', () => {
    const app = createApp(parse(`#!RUNE
@App
type = REST
@Route/GET /test
run:
    values = [1, 2, 3, 4]
    selected = values.filter(n => n > 2).map(n => n * 2)
    score = 24 / 3 * 2
    label = body.missing ?? "fallback"
    if not false and score == 16:
        respond 200 { selected: selected, label: label, delta: -score, result: score > 10 ? "high" : "low" }
`));
    expect(app.request({ method: 'GET', path: '/test' })).toMatchObject({
      status: 200,
      body: { selected: [6, 8], label: 'fallback', delta: -16, result: 'high' },
    });
  });
});
