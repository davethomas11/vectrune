import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import fixtures from '../../../tests/conformance/storage.json';
import { configureDataSources, requestDataSource, type Packet } from '../src/datasource';
import { initContext } from '../src/context';
import { executeSteps } from '../src/statement';
import type { RuneApp } from '../src/types';

let serial = 0;
beforeEach(() => { configureDataSources({ main: { type: 'rune-db', database: `test-${Date.now()}-${serial++}` }, events: { type: 'vect-event', store: 'main' } }); });
describe('persistent datasource contract', () => {
  it('rolls back before a write receipt would exceed the response bound', async () => {
    await expect(requestDataSource('main', { op: 'batch', operations: [
      { op: 'put', collection: 'notes', key: 'one', value: '\0'.repeat(800000) },
      { op: 'put', collection: 'notes', key: 'two', value: '\0'.repeat(800000) },
    ] })).rejects.toThrow('response exceeds');
    expect(await requestDataSource('main', { op: 'get', collection: 'notes', key: 'one' })).toBeNull();
    expect((await requestDataSource('main', { op: 'put', collection: 'notes', key: 'next', value: 1 })).commit).toBe('1');
  });
  it('suspends action I/O until commit and resumes with the receipt', async () => {
    const app: RuneApp = { state: { status: 'waiting' }, derived: {}, render: vi.fn(), computeDerived() {}, invokeAction: vi.fn() };
    initContext({ app, pageTree: { Text: '' }, derivedDefinitions: {}, helperDefinitions: {}, actionDefinitions: {}, i18nData: {}, isRendering: false, memorySubscriptions: {}, loadedChunks: {}, loadingChunks: {} });
    executeSteps([
      { Statement: 'packet = { op: "put", collection: "notes", key: "one", value: { title: "Hello" } }' },
      { Statement: 'receipt = db main packet' },
      { Statement: 'status = "committed"' },
    ], {});
    expect(app.state.status).toBe('waiting');
    await vi.waitFor(() => expect(app.state.status).toBe('committed'));
    expect((app.state.receipt as any).commit).toBe('1');
    expect((await requestDataSource('main', { op: 'get', collection: 'notes', key: 'one' })).value.title).toBe('Hello');
    executeSteps([{ Statement: 'receipt = db missing packet catch failed' }, { Statement: 'status = "incorrect"' }], {});
    await vi.waitFor(() => expect(app.invokeAction).toHaveBeenCalledWith('failed', [expect.objectContaining({ message: expect.stringContaining('unknown datasource') })], {}));
    expect(app.state.status).toBe('committed');
  });
  it('runs the native contract including atomic rollback and nested intent', async () => {
    for (const fixture of fixtures) {
      const result = requestDataSource('main', fixture.request as Packet);
      if ('error' in fixture) await expect(result).rejects.toThrow();
      else expect(await result).toEqual(fixture.expected);
    }
  });
  it('serializes concurrent increments and records committed changes', async () => {
    await requestDataSource('main', { op: 'put', collection: 'counter', key: 'one', value: { count: 0 } });
    await Promise.all(Array.from({ length: 20 }, () => requestDataSource('main', { op: 'increment', collection: 'counter', key: 'one', path: ['count'], by: 1 })));
    expect((await requestDataSource('main', { op: 'get', collection: 'counter', key: 'one' })).value.count).toBe(20);
    expect((await requestDataSource('main', { op: 'read', stream: '$changes' })).events).toHaveLength(21);
  });
  it('replays and follows an event committed after the read starts', async () => {
    const pending = requestDataSource('events', { op: 'read', stream: 'orders', wait_ms: 1000 });
    await requestDataSource('events', { op: 'append', stream: 'orders', kind: 'created', value: { id: 1 } });
    expect((await pending).events[0].value).toEqual({ id: 1 });
    await expect(requestDataSource('events', { op: 'get', collection: 'x', key: 'x' })).rejects.toThrow('only event');
  });
  it('orders UTF-8 key pages like the native adapter', async () => {
    for (const key of ['a/😀', 'b/1', 'a/é', 'a/1']) await requestDataSource('main', { op: 'put', collection: 'notes', key, value: key });
    const first = await requestDataSource('main', { op: 'scan', collection: 'notes', prefix: 'a/', limit: 2 });
    expect(first.items.map((v: any) => v.key)).toEqual(['a/1', 'a/é']);
    const second = await requestDataSource('main', { op: 'scan', collection: 'notes', prefix: 'a/', after: first.next, limit: 2 });
    expect(second.items.map((v: any) => v.key)).toEqual(['a/😀']); expect(second.next).toBeNull();
  });
});
