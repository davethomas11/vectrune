import { describe, it, expect } from 'vitest';
import fixtures from '../../../tests/conformance/expressions.json';
import { evaluateExpression } from '../src/expression';
import { parseCoreExpression, evaluateCoreExpression } from '../src/core_expression';
import { run } from '../src/vect';

describe('shared expression conformance', () => {
  for (const fixture of fixtures) it(fixture.category, () => {
    expect(evaluateExpression(fixture.expr, fixture.context)).toEqual(fixture.expected);
    expect(evaluateCoreExpression(parseCoreExpression(fixture.expr), fixture.context)).toEqual(fixture.expected);
  });
  it('rejects malformed expressions and dangerous member keys', () => {
    for (const source of ['1 +', '[1, 2', '"unfinished', 'a.constructor', '{__proto__: 1}'])
      expect(() => parseCoreExpression(source)).toThrow();
  });
  it('follows Rune nullish fallback including empty strings', () => {
    expect(evaluateCoreExpression(parseCoreExpression('null ?? 3'), {})).toBe(3);
    expect(evaluateCoreExpression(parseCoreExpression('0 ?? 3'), {})).toBe(0);
    expect(evaluateCoreExpression(parseCoreExpression('"" ?? 3'), {})).toBe(3);
  });
  it('reports host write failures with the Vect line', () => {
    expect(() => run({ statements: [{ Expression: { line_no: 7, source: 'file.write("out", "data")' } }] },
      { print() {}, read() { return ''; }, write() { throw new Error('disk full'); } })).toThrow('Vect line 7: disk full');
  });
});
