// Rune DB / Vect Event adapter. IndexedDB is persistent storage, never a silent
// in-memory fallback. Expressions stay synchronous; action I/O resumes on commit.
// Load the codec only when storage is used. Native QuickJS game hosts do not
// provide TextEncoder/TextDecoder, and must still load ordinary game logic.
let encode: typeof import('@msgpack/msgpack').encode;
let decode: typeof import('@msgpack/msgpack').decode;
let codec: Promise<void> | undefined;
function loadCodec(): Promise<void> { return codec ??= import('@msgpack/msgpack').then(module => { encode = module.encode; decode = module.decode; }); }
export interface DataSource { type: 'rune-db' | 'vect-event'; mode?: 'embedded' | 'remote'; database?: string; endpoint?: string; store?: string }
export type Packet = { op: string; [key: string]: any };
const MAX_PACKET = 8 * 1024 * 1024, MAX_PAGE = 4 * 1024 * 1024, MAX_VALUE = 1024 * 1024;
const own = (value: object, key: PropertyKey): boolean => Object.prototype.hasOwnProperty.call(value, key);
const CHANGES = '$changes', MAX_SEQUENCE = 18446744073709551615n;
const databases = new Map<string, Promise<IDBDatabase>>();
const listeners = new Map<string, Set<() => void>>();
const channels = new Map<string, BroadcastChannel>();
let definitions: Record<string, DataSource> = {};
const tokens = new Map<string, string>();
export function configureDataSources(config: Record<string, DataSource> = {}): void { definitions = config; tokens.clear(); }
export function setDataSourceToken(source: string, token: string): void { tokens.set(source, token); }
function check(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function jsonValue(value: any, depth = 0): void {
  check(depth <= 100, 'JSON nesting exceeds 100');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    check(Number.isFinite(value), 'JSON values must be finite');
    check(!Number.isInteger(value) || Number.isSafeInteger(value), 'integer exceeds portable browser precision'); return;
  }
  check(value && typeof value === 'object' && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null), 'storage accepts JSON values only');
  for (const item of Object.values(value)) jsonValue(item, depth + 1);
}
function unpack(bytes: Uint8Array): any { const value = decode(bytes); jsonValue(value); return value; }
function utf8(value: string): ArrayBuffer { return new TextEncoder().encode(value).buffer as ArrayBuffer; }
function name(value: any): void { check(typeof value === 'string' && value.length > 0 && utf8(value).byteLength <= 256 && !value.includes('\0'), 'invalid name (1..256 UTF-8 bytes required)'); }
function key(value: any): void { check(typeof value === 'string' && utf8(value).byteLength <= 4096, 'key exceeds 4096 bytes'); }
function cursor(value: any): bigint { check(typeof value === 'string' && /^\d+$/.test(value), 'invalid cursor'); const n = BigInt(value); check(n <= MAX_SEQUENCE, 'invalid cursor'); return n; }
function padded(value: string): string { return cursor(value).toString().padStart(20, '0'); }
function next(value: string): string { const n = cursor(value) + 1n; check(n <= MAX_SEQUENCE, 'sequence counter exhausted'); return n.toString(); }
function request<T>(value: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); }); }
function finished(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('storage transaction aborted')); tx.onerror = () => {}; }); }
function wake(database: string): void { for (const listener of listeners.get(database) ?? []) listener(); }
function notify(database: string): void { wake(database); channels.get(database)?.postMessage('commit'); }
function open(database: string): Promise<IDBDatabase> {
  name(database);
  let db = databases.get(database);
  if (!db) {
    check(typeof indexedDB !== 'undefined', 'IndexedDB is unavailable in this host');
    check(databases.size < 64, 'host limit of 64 open databases reached');
    db = new Promise((resolve, reject) => {
      const opening = indexedDB.open(`rune-db:${database}`, 1);
      opening.onupgradeneeded = () => { for (const table of ['records', 'events', 'meta']) opening.result.createObjectStore(table); };
      opening.onerror = () => reject(opening.error);
      opening.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
      opening.onsuccess = () => {
        const db = opening.result;
        db.onversionchange = () => { db.close(); databases.delete(database); };
        if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' && !channels.has(database)) {
          const channel = new BroadcastChannel(`rune-db:${database}`);
          channel.onmessage = () => wake(database); channels.set(database, channel);
        }
        resolve(db);
      };
    });
    databases.set(database, db);
    db.catch(() => databases.delete(database));
  }
  return db;
}
function packedValue(value: any): Uint8Array { const bytes = encode(value); check(bytes.length <= MAX_VALUE, 'value exceeds 1 MiB'); return bytes; }
function numericAdd(a: any, b: any): number {
  check(typeof a === 'number' && typeof b === 'number', 'increment requires numeric operands');
  const value = a + b; check(Number.isFinite(value), 'numeric overflow');
  check(!Number.isInteger(value) || Number.isSafeInteger(value), 'integer exceeds portable browser precision'); return value;
}
function increment(record: any, path: any[], by: any): any {
  check(Array.isArray(path) && path.length <= 32, 'mutation path exceeds 32 segments');
  const box = { value: record }; let parent: any = box, property: string | number = 'value';
  for (const segment of path) {
    parent = parent[property]; check(parent != null, 'mutation target not found');
    if (typeof segment === 'string') { check(!Array.isArray(parent) && own(parent, segment), 'mutation target not found'); property = segment; }
    else if (Number.isInteger(segment) && segment >= 0) { check(Array.isArray(parent) && segment < parent.length, 'mutation target not found'); property = segment; }
    else {
      check(segment && typeof segment.field === 'string' && Array.isArray(parent), 'invalid selector');
      property = parent.findIndex((v: any) => v && own(v, segment.field) && JSON.stringify(v[segment.field]) === JSON.stringify(segment.equals));
      check(property !== -1, 'mutation target not found');
    }
  }
  parent[property] = numericAdd(parent[property], by);
  return { value: box.value, changed: parent[property] };
}
function validate(packet: Packet): void {
  const fields: Record<string, string[]> = { get: ['collection', 'key'], scan: ['collection', 'prefix', 'after', 'limit'],
    put: ['collection', 'key', 'value', 'expected'], delete: ['collection', 'key', 'expected'], increment: ['collection', 'key', 'path', 'by', 'expected'],
    append: ['stream', 'kind', 'value'], read: ['stream', 'after', 'limit', 'wait_ms'], batch: ['operations'] };
  check(packet && typeof packet === 'object' && own(fields, packet.op), 'unknown storage operation');
  for (const field of Object.keys(packet)) check(field === 'op' || fields[packet.op].includes(field), `unknown packet field: ${field}`);
  if (['get', 'scan', 'put', 'delete', 'increment'].includes(packet.op)) name(packet.collection);
  if (['get', 'put', 'delete', 'increment'].includes(packet.op)) key(packet.key);
  if (['put', 'append'].includes(packet.op)) { check(own(packet, 'value'), 'value required'); packedValue(packet.value); }
  if (packet.op === 'increment') check(typeof packet.by === 'number' && Number.isFinite(packet.by), 'increment must be numeric');
  if (packet.expected != null) cursor(packet.expected);
  if (['scan', 'read'].includes(packet.op)) check(Number.isInteger(packet.limit ?? 100) && (packet.limit ?? 100) >= 1 && (packet.limit ?? 100) <= 1000, 'limit must be 1..1000');
  if (packet.op === 'read') { name(packet.stream); cursor(packet.after ?? '0'); check(Number.isInteger(packet.wait_ms ?? 0) && (packet.wait_ms ?? 0) >= 0 && (packet.wait_ms ?? 0) <= 30000, 'wait_ms exceeds 30000'); }
  if (packet.op === 'scan') { key(packet.prefix ?? ''); if (packet.after != null) { key(packet.after); check(packet.after.startsWith(packet.prefix ?? ''), 'scan cursor does not match prefix'); } }
  if (packet.op === 'append') { name(packet.stream); name(packet.kind); check(packet.stream !== CHANGES, '$changes is reserved'); }
  if (packet.op === 'batch') { check(Array.isArray(packet.operations) && packet.operations.length > 0 && packet.operations.length <= 256, 'batch requires 1..256 mutations'); for (const op of packet.operations) { check(['put', 'delete', 'increment', 'append'].includes(op.op), 'batch accepts only mutations'); validate(op); } }
}
async function page(store: IDBObjectStore, range: IDBKeyRange, match: (key: IDBValidKey) => boolean, limit: number): Promise<{ values: any[]; more: boolean }> {
  return new Promise((resolve, reject) => {
    const values: any[] = []; let size = 0;
    const opening = store.openCursor(range);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const cursor = opening.result;
      if (!cursor || !match(cursor.key)) { resolve({ values, more: false }); return; }
      const bytes = cursor.value as Uint8Array;
      if (values.length === limit || (values.length > 0 && size + bytes.length > MAX_PAGE)) { resolve({ values, more: true }); return; }
      values.push(unpack(bytes)); size += bytes.length; cursor.continue();
    };
  });
}
async function local(database: string, packet: Packet): Promise<any> {
  const db = await open(database);
  const read = ['get', 'scan', 'read'].includes(packet.op);
  const tx = db.transaction(read ? [packet.op === 'read' ? 'events' : 'records'] : ['records', 'events', 'meta'], read ? 'readonly' : 'readwrite', read ? undefined : { durability: 'strict' });
  const done = finished(tx);
  // Observe rejection immediately; semantic validation can fail before IDB aborts.
  done.catch(() => {});
  const records = () => tx.objectStore('records');
  const events = () => tx.objectStore('events');
  const meta = () => tx.objectStore('meta');
  const recordKey = (op: Packet): IDBValidKey => [op.collection, utf8(op.key)];
  try {
    let result: any;
    if (packet.op === 'get') { const value = await request(records().get(recordKey(packet))); result = value == null ? null : unpack(value); }
    else if (packet.op === 'scan') {
      const prefix = packet.prefix ?? '', start = packet.after ?? prefix;
      const resultPage = await page(records(), IDBKeyRange.lowerBound([packet.collection, utf8(start)], packet.after != null), k => {
        const [collection, key] = k as [string, ArrayBuffer]; return collection === packet.collection && new TextDecoder().decode(key).startsWith(prefix);
      }, packet.limit ?? 100);
      result = { items: resultPage.values, next: resultPage.more ? resultPage.values[resultPage.values.length - 1]?.key ?? null : null };
    } else if (packet.op === 'read') {
      const after = packet.after ?? '0';
      const resultPage = await page(events(), IDBKeyRange.lowerBound([packet.stream, padded(after)], true), k => (k as any[])[0] === packet.stream, packet.limit ?? 100);
      result = { events: resultPage.values, next: resultPage.values[resultPage.values.length - 1]?.sequence ?? after };
    } else {
      const commit = next(await request(meta().get('commit')) ?? '0');
      const operations = packet.op === 'batch' ? packet.operations : [packet];
      const results = [];
      const append = async (stream: string, kind: string, value: any) => {
        const sequence = next(await request(meta().get(`stream:${stream}`)) ?? '0');
        const event = { stream, sequence, commit, kind, value };
        await request(events().put(encode(event), [stream, padded(sequence)])); await request(meta().put(sequence, `stream:${stream}`)); return event;
      };
      for (const op of operations as Packet[]) {
        if (op.op === 'append') { results.push(await append(op.stream, op.kind, op.value)); continue; }
        const bytes = await request(records().get(recordKey(op)));
        const current: any = bytes == null ? null : unpack(bytes);
        if (op.expected != null) check((current?.revision ?? '0') === op.expected, `conflict: expected revision ${op.expected}, found ${current?.revision ?? '0'}`);
        let value = op.value, patch: any = null;
        if (op.op === 'increment') {
          check(current, 'mutation record not found');
          const changed = increment(current.value, op.path ?? [], op.by); value = changed.value;
          patch = { path: op.path ?? [], by: op.by, value: changed.changed };
        }
        let receipt: any;
        if (op.op === 'delete') { await request(records().delete(recordKey(op))); receipt = { key: op.key, deleted: current != null, revision: commit }; }
        else {
          packedValue(value); const record = { key: op.key, value, revision: commit };
          await request(records().put(encode(record), recordKey(op)));
          receipt = op.op === 'increment' ? { key: op.key, revision: commit, patch } : record;
        }
        const change = op.op === 'increment' ? { collection: op.collection, key: op.key, revision: commit, patch } : { collection: op.collection, key: op.key, record: receipt };
        await append(CHANGES, op.op, change); results.push(receipt);
      }
      result = { commit, results };
      check(new TextEncoder().encode(JSON.stringify(result)).length <= MAX_PACKET - 256, 'commit response exceeds 8 MiB');
      await request(meta().put(commit, 'commit'));
    }
    await done; if (!read) notify(database); return result;
  } catch (error) { try { tx.abort(); } catch {} await done.catch(() => {}); throw error; }
}
function resolve(source: string, seen = new Set<string>()): { config: DataSource; eventsOnly: boolean } {
  check(!seen.has(source), 'datasource cycle'); seen.add(source);
  const config = definitions[source]; check(config, `unknown datasource: ${source}`);
  check(['rune-db', 'vect-event'].includes(config.type), 'unsupported storage provider');
  if (config.type === 'vect-event' && config.mode !== 'remote') {
    check(config.store, 'vect-event requires store'); const parent = resolve(config.store, seen);
    check(!parent.eventsOnly, 'vect-event store must be rune-db'); return { config: parent.config, eventsOnly: true };
  }
  check(config.mode == null || ['embedded', 'remote'].includes(config.mode), 'invalid datasource mode');
  const database = config.database ?? source;
  if (config.mode !== 'remote') check(/^[A-Za-z0-9_-]{1,128}$/.test(database), 'database name must contain only letters, numbers, _ or -');
  return { config: { ...config, database }, eventsOnly: config.type === 'vect-event' };
}
function eventsOnly(packet: Packet): boolean { return ['append', 'read'].includes(packet.op) || (packet.op === 'batch' && packet.operations.every(eventsOnly)); }
export async function requestDataSource(source: string, packet: Packet, options: { signal?: AbortSignal; kind?: 'db' | 'events' } = {}): Promise<any> {
  const { config, eventsOnly: restricted } = resolve(source);
  if (options.kind) check(restricted === (options.kind === 'events'), 'use db with rune-db and events with vect-event');
  check(config.mode === 'remote' ? typeof fetch !== 'undefined' : typeof indexedDB !== 'undefined', 'This host does not provide the requested datasource adapter');
  await loadCodec();
  jsonValue(packet);
  const bytes = encode(packet); check(bytes.length <= MAX_PACKET, 'packet exceeds 8 MiB');
  packet = decode(bytes) as Packet; validate(packet);
  check(!restricted || eventsOnly(packet), 'vect-event accepts only event operations');
  if (config.mode === 'remote') {
    check(config.endpoint, 'remote datasource requires endpoint');
    const url = new URL(config.endpoint, typeof location !== 'undefined' ? location.href : undefined);
    check(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash, 'invalid storage endpoint');
    const headers: Record<string, string> = { 'content-type': 'application/msgpack', accept: 'application/msgpack' };
    const token = tokens.get(source); if (token) headers.authorization = `Bearer ${token}`;
    const timeout = new AbortController(); const timer = setTimeout(() => timeout.abort(), 40000);
    const abort = () => timeout.abort(); options.signal?.addEventListener('abort', abort, { once: true });
    try {
      if (options.signal?.aborted) timeout.abort();
      const response = await fetch(url.href.replace(/\/$/, '') + '/v1/execute', { method: 'POST', headers, body: bytes as BodyInit, signal: timeout.signal, redirect: 'error' });
      const reader = response.body?.getReader(); check(reader, 'storage response has no body');
      const chunks = []; let length = 0;
      while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > MAX_PACKET) { await reader.cancel(); throw new Error('storage response exceeds 8 MiB'); } chunks.push(value); }
      const body = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
      const reply: any = response.headers.get('content-type')?.startsWith('application/msgpack') ? unpack(body) : JSON.parse(new TextDecoder().decode(body));
      check(response.ok && reply.ok, reply.error?.message ?? 'storage request failed'); return reply.data;
    } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
  }
  const database = config.database!;
  const deadline = Date.now() + (packet.op === 'read' ? packet.wait_ms ?? 0 : 0);
  do {
    if (options.signal?.aborted) throw new Error('storage request aborted');
    let cleanup = () => {};
    const changed = new Promise<void>(resolve => {
      const set = listeners.get(database) ?? new Set(); listeners.set(database, set);
      const wake = () => { cleanup(); resolve(); };
      const timer = setTimeout(wake, Math.max(0, Math.min(200, deadline - Date.now())));
      cleanup = () => { clearTimeout(timer); set.delete(wake); options.signal?.removeEventListener('abort', wake); };
      set.add(wake); options.signal?.addEventListener('abort', wake, { once: true });
    });
    const result = await local(database, packet).catch(error => { cleanup(); throw error; });
    if (packet.op !== 'read' || result.events.length || Date.now() >= deadline) { cleanup(); return result; }
    await changed;
  } while (true);
}
