import { describe, expect, it } from 'vitest';
import fixtures from '../../../tests/conformance/objects.json';
import programs from '../../../tests/conformance/object_programs.json';
import { evaluateCoreExpression, parseCoreExpression } from '../src/core_expression';
import { evaluateExpression } from '../src/expression';
import { executeStatement } from '../src/statement';
import { initContext } from '../src/context';
import { run } from '../src/vect';
import type { RuneApp } from '../src/types';

describe('portable object syntax', () => {
  for (const fixture of fixtures) it(fixture.category, () => {
    expect(evaluateExpression(fixture.expr, fixture.context)).toEqual(fixture.expected);
    expect(evaluateCoreExpression(parseCoreExpression(fixture.expr), fixture.context)).toEqual(fixture.expected);
  });

  for (const fixture of programs) it(fixture.category, () => {
    const app: RuneApp = { state: {}, derived: {}, render() {}, computeDerived() {}, invokeAction() {} };
    initContext({ app, pageTree: { Text: '' }, derivedDefinitions: {}, helperDefinitions: {}, actionDefinitions: {},
      i18nData: {}, isRendering: false, memorySubscriptions: {} });
    const locals = {};
    for (const statement of fixture.statements) executeStatement(statement, locals);
    expect(app.state.result).toEqual(fixture.expected);

    const output: string[] = [];
    run({ statements: [
      ...fixture.statements.map((source, i) => ({ Expression: { source, line_no: i + 1 } })),
      { Print: { text: '{json.stringify(result)}', line_no: fixture.statements.length + 1 } },
    ] }, { print: value => output.push(value), read() { throw new Error('Unexpected read'); }, write() { throw new Error('Unexpected write'); } });
    expect(JSON.parse(output[0])).toEqual(fixture.expected);
  });

  it('rejects invalid generators and members', () => {
    for (const expression of ['{x: 1} * -1', '{x: 1} * 1.5', '{x: 1} * "2"', '{x: 1} * 2 inc x by "1"', '{x: 1} * 1000001',
      'grid 1000000 x 2 at (0, 0) step (1, 1)', '{} with []', '{constructor: 1}', '{x: 1} * 2 garbage', '{"quoted"}'])
      expect(() => evaluateCoreExpression(parseCoreExpression(expression), {}), expression).toThrow();
  });
});
