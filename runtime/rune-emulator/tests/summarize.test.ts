import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { summarize } from '../src/engine/summarize';
import { executeBuiltin, RESPONDED } from '../src/engine/builtins';
import { createRequestContext } from '../src/engine/context';
import { createApp, parse } from '../src/index';

interface Fixture {
  name: string; rows: unknown; group: string; operation?: string; value?: string;
  expected?: unknown; error?: string;
}
const fixtures: Fixture[] = JSON.parse(readFileSync(new URL('../../../tests/fixtures/summarize.json', import.meta.url), 'utf8'));

describe('summarize — shared native/browser semantics', () => {
  it.each(fixtures)('$name', fixture => {
    const original = JSON.stringify(fixture.rows);
    const run = () => summarize(fixture.rows, fixture.group, fixture.operation, fixture.value);
    if (fixture.error) expect(run).toThrow(fixture.error);
    else expect(run()).toEqual(fixture.expected);
    expect(JSON.stringify(fixture.rows)).toBe(original);
  });
});

it('errors stop execution without overwriting previous results', () => {
  const ctx = createRequestContext({ method: 'GET', path: '/' }, {}, {}, {}, {});
  ctx.state = { rows: [{ region: 'A', amount: false }], report: 'previous', ___last_exec_result___: 'last' };
  const before = structuredClone(ctx.state);
  expect(executeBuiltin('summarize', ['rows', 'by', 'region', 'sum', 'amount'], ctx, 'report')).toBe(RESPONDED);
  expect(ctx.response?.status).toBe(500);
  expect(ctx.state).toEqual(before);
});

it.each([[], ['rows', 'region'], ['rows', 'with', 'region'], ['rows', 'by', 'region', 'sum']])('rejects malformed arguments %o', (...args) => {
  const ctx = createRequestContext({ method: 'GET', path: '/' }, {}, {}, {}, {});
  expect(executeBuiltin('summarize', args as string[], ctx)).toBe(RESPONDED);
  expect(ctx.response?.body).toContain('summarize: expected');
});

it('distinguishes an undefined source from a defined non-list', () => {
  const ctx = createRequestContext({ method: 'GET', path: '/' }, {}, {}, {}, {});
  executeBuiltin('summarize', ['missing', 'by', 'region'], ctx);
  expect(ctx.response?.body).toBe("summarize: source 'missing' was not found");
});

it.each([NaN, Infinity, -Infinity])('rejects non-finite group values: %s', value => {
  expect(() => summarize([{ region: value }], 'region')).toThrow('group field');
});

it('runs the complete CSV report example and parses a POST body', () => {
  const source = readFileSync(new URL('../../../examples/sales_report.rune', import.meta.url), 'utf8');
  const csv = readFileSync(new URL('../../../examples/sales_report.csv', import.meta.url), 'utf8').trim().split('\n');
  const headers = csv.shift()!.split(',');
  const rows = csv.map(line => Object.fromEntries(line.split(',').map((value, index) => [headers[index], value])));
  const app = createApp(parse(source), { files: { 'sales_report.csv': rows } });
  expect(app.request({ method: 'GET', path: '/report' }).body).toEqual([
    { group: 'West', count: 2, sum: 150 },
    { group: 'East', count: 2, sum: 100 },
    { group: 'South', count: 1, sum: 30 },
  ]);
  expect(app.request({ method: 'GET', path: '/averages' }).body).toEqual([
    { group: 'West', count: 2, avg: 75 },
    { group: 'East', count: 2, avg: 50 },
    { group: 'South', count: 1, avg: 30 },
  ]);
  for (const [path, metric, values] of [
    ['/medians', 'median', [75, 50, 30]],
    ['/customers', 'distinct', [1, 2, 1]],
    ['/first-customers', 'first', ['alice', 'bob', 'dave']],
    ['/last-customers', 'last', ['alice', 'carol', 'dave']],
  ] as const) {
    const result = app.request({ method: 'GET', path });
    expect(result.status).toBe(200);
    expect(result.body).toEqual(['West', 'East', 'South'].map((group, index) => ({
      group, count: index === 2 ? 1 : 2, [metric]: values[index],
    })));
  }
  const response = app.request({ method: 'POST', path: '/report', body: JSON.stringify([{ region: 'Online', amount: 20 }, { region: 'Online', amount: 5 }]) });
  expect(response.status).toBe(200);
  expect(response.body).toEqual([{ group: 'Online', count: 2, sum: 25 }]);
  expect(app.request({ method: 'POST', path: '/report', body: '[{"region":"A","amount":"bad"}]' }).status).toBe(500);
});

it.each(['first', 'last'])('%s returns independent JSON values', operation => {
  const rows = [{ region: 'A', data: { items: [1, 2] } }];
  const report = summarize(rows, 'region', operation, 'data') as Record<string, unknown>[];
  (report[0][operation] as { items: number[] }).items.push(3);
  expect(rows[0].data.items).toEqual([1, 2]);
});

it.each(['first', 'last'])('%s rejects non-finite JSON values', operation => {
  for (const value of [NaN, Infinity, -Infinity, { nested: Infinity }]) {
    expect(() => summarize([{ region: 'A', value }], 'region', operation, 'value'))
      .toThrow('must contain only finite JSON numbers');
  }
});
