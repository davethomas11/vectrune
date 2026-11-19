// Canonical expression AST shared by Rune-Web, the emulator and native Vect scripts.
import { entitiesChanged } from './pixel3d/entities';
// Host-specific commands stay in their adapters; math uses Rune's degree convention.
export type Expr =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'id'; value: string }
  | { kind: 'unary'; value: string; items: [Expr] }
  | { kind: 'binary'; value: string; items: [Expr, Expr] }
  | { kind: 'lambda'; value: string; items: [Expr] }
  | { kind: 'array'; items: Expr[] }
  | { kind: 'object'; items: [string, Expr][] }
  | { kind: 'member'; items: [Expr, Expr] }
  | { kind: 'lookup'; value: string; items: [Expr] }
  | { kind: 'overlay'; items: [Expr, Expr] }
  | { kind: 'generate'; props: string[]; items: [Expr, Expr, Expr, Expr] }
  | { kind: 'grid'; items: [Expr, Expr, Expr, Expr, Expr, Expr, Expr] }
  | { kind: 'call'; items: [Expr, ...Expr[]] }
  | { kind: 'ternary'; items: [Expr, Expr, Expr] };
type Token = { value: string; kind: string };
const precedence: Record<string, number> = {
  '??': 1, or: 2, '||': 2, and: 3, '&&': 3,
  '==': 4, '!=': 4, contains: 4, '<': 5, '>': 5, '<=': 5, '>=': 5,
  '+': 6, '-': 6, '*': 7, '/': 7, '%': 7,
};
export const coreFunctions: Record<string, (...args: any[]) => any> = {
  abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  min: Math.min, max: Math.max, sqrt: Math.sqrt, pow: Math.pow,
  sin: x => Math.sin(x * Math.PI / 180), cos: x => Math.cos(x * Math.PI / 180),
  clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
  range: (start: number, end?: number, step = 1) => {
    if (end === undefined) { end = start; start = 0; }
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step === 0)
      throw new Error('range requires finite bounds and a nonzero step');
    const n = Math.max(0, Math.ceil((end - start) / step));
    if (n > 1_000_000) throw new Error('range exceeds 1000000 items');
    return Array.from({ length: n }, (_, i) => start + i * step);
  },
  len: x => x.length, keys: Object.keys, values: Object.values,
  repeat: (value, n) => {
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new Error('invalid repeat count');
    return Array.from({ length: n }, () => value);
  },
  hex: (n, width = 0) => Math.trunc(n).toString(16).padStart(width, '0'),
  'json.stringify': JSON.stringify, 'json.parse': JSON.parse,
};
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
export function safeKey(key: any): string {
  key = String(key);
  if (forbidden.has(key)) throw new Error(`Invalid member: ${key}`);
  return key;
}
function tokenize(source: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) { i++; continue; }
    const tail = source.slice(i);
    const number = tail.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) { out.push({ kind: 'number', value: number[0] }); i += number[0].length; continue; }
    if (source[i] === '"' || source[i] === "'") {
      const quote = source[i++]; let value = ''; let closed = false;
      while (i < source.length) {
        const c = source[i++];
        if (c === quote) { closed = true; break; }
        if (c === '\\') {
          const e = source[i++];
          const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '/': '/', '\\': '\\', '"': '"', "'": "'" };
          if (e === 'u') {
            const hex = source.slice(i, i + 4);
            if (!/^[\da-fA-F]{4}$/.test(hex)) throw new Error('Invalid Unicode escape');
            value += String.fromCharCode(parseInt(hex, 16)); i += 4; continue;
          }
          if (!(e in escapes)) throw new Error('Invalid string escape');
          value += escapes[e];
        } else value += c;
      }
      if (!closed) throw new Error('Unclosed string');
      out.push({ kind: 'string', value }); continue;
    }
    const id = tail.match(/^[A-Za-z_$][\w$]*/);
    if (id) { out.push({ kind: 'id', value: id[0] }); i += id[0].length; continue; }
    const op = tail.match(/^(?:\?\?|&&|\|\||==|!=|<=|>=|=>|[+*/%<>()\[\]{},.:?!-])/);
    if (!op) throw new Error(`Unexpected token: ${tail.slice(0, 20)}`);
    out.push({ kind: 'op', value: op[0] }); i += op[0].length;
  }
  out.push({ kind: 'eof', value: '' }); return out;
}
export function parseCoreExpression(source: string): Expr {
  const tokens = tokenize(source); let pos = 0, depth = 0;
  const peek = () => tokens[pos].value;
  const take = () => tokens[pos++];
  const expect = (s: string) => { if (take().value !== s) throw new Error(`Expected ${s}`); };
  function expression(min = 0): Expr {
    if (++depth > 128) throw new Error('Expression nesting exceeds 128');
    const t = take(); let left: Expr;
    if (t.kind === 'number') left = { kind: 'literal', value: Number(t.value) };
    else if (t.kind === 'string') left = { kind: 'literal', value: t.value };
    else if (['true', 'false', 'null'].includes(t.value)) left = { kind: 'literal', value: JSON.parse(t.value) };
    else if (['-', '+', '!', 'not'].includes(t.value)) left = { kind: 'unary', value: t.value, items: [expression(8)] };
    else if (t.value === '(') { left = expression(); expect(')'); }
    else if (t.value === 'grid' && !['', '.', '['].includes(peek())) {
      const cols = expression(8); expect('x'); const rows = expression(8);
      if (!['at', 'from'].includes(take().value)) throw new Error('Expected at or from');
      expect('('); const x = expression(); expect(','); const y = expression(); expect(')');
      expect('step'); expect('('); const dx = expression(); expect(','); const dy = expression(); expect(')');
      let overrides: Expr = { kind: 'object', items: [] };
      if (peek() === 'with') { take(); overrides = expression(8); }
      left = { kind: 'grid', items: [cols, rows, x, y, dx, dy, overrides] };
    } else if (t.value === '[') {
      const items: Expr[] = [];
      while (peek() !== ']') { items.push(expression()); if (peek() !== ',') break; take(); }
      expect(']'); left = { kind: 'array', items };
    } else if (t.value === '{') {
      const items: [string, Expr][] = [];
      while (peek() !== '}') {
        const key = take(); if (!['id', 'string'].includes(key.kind)) throw new Error('Invalid object key');
        let value: Expr;
        if (peek() === ':') { take(); value = expression(); }
        else if (key.kind === 'id' && [',', '}'].includes(peek())) value = { kind: 'id', value: key.value };
        else throw new Error('Expected : after object key');
        items.push([safeKey(key.value), value]);
        if (peek() !== ',') break; take();
      }
      expect('}'); left = { kind: 'object', items };
    } else if (t.kind === 'id') {
      if (peek() === '=>') { take(); left = { kind: 'lambda', value: t.value, items: [expression()] }; }
      else left = { kind: 'id', value: t.value };
    } else throw new Error(`Expected expression, got ${t.value || 'end of input'}`);
    while (true) {
      if (peek() === '.') {
        take(); const key = take(); if (key.kind !== 'id') throw new Error('Expected member name');
        left = { kind: 'member', items: [left, { kind: 'literal', value: safeKey(key.value) }] }; continue;
      }
      if (peek() === '[') {
        take();
        if (peek() === ']') {
          take(); const key = take(); if (key.kind !== 'id') throw new Error('Expected lookup property after []');
          left = { kind: 'lookup', value: safeKey(key.value), items: [left] };
        } else { const key = expression(); expect(']'); left = { kind: 'member', items: [left, key] }; }
        continue;
      }
      if (peek() === '(') {
        take(); const args: Expr[] = [];
        while (peek() !== ')') { args.push(expression()); if (peek() !== ',') break; take(); }
        expect(')'); left = { kind: 'call', items: [left, ...args] }; continue;
      }
      if (min <= 0 && ['with', 'all'].includes(peek())) {
        take(); left = { kind: 'overlay', items: [left, expression(8)] }; continue;
      }
      // Object replication binds like multiplication; its count/step are unary
      // expressions, so grouped arithmetic remains unambiguous.
      if (peek() === '*' && min <= 7 && left.kind === 'object') {
        take(); const count = expression(8); const props: string[] = [];
        let step: Expr = { kind: 'literal', value: 0 };
        if (peek() === 'inc') {
          take(); const parens = peek() === '('; if (parens) take();
          do {
            const key = take(); if (!['id', 'string'].includes(key.kind)) throw new Error('Expected increment property');
            props.push(safeKey(key.value));
            if (peek() !== ',') break; take();
          } while (true);
          if (parens) expect(')'); expect('by'); step = expression(8);
        }
        let overrides: Expr = { kind: 'object', items: [] };
        if (peek() === 'with') { take(); overrides = expression(8); }
        left = { kind: 'generate', props, items: [left, count, step, overrides] }; continue;
      }
      const op = peek(), rank = precedence[op];
      if (rank === undefined || rank < min) break;
      take(); left = { kind: 'binary', value: op, items: [left, expression(rank + 1)] };
    }
    if (min === 0 && peek() === '?') {
      take(); const yes = expression(); expect(':'); left = { kind: 'ternary', items: [left, yes, expression()] };
    }
    depth--; return left;
  }
  const ast = expression();
  if (tokens[pos].kind !== 'eof') throw new Error(`Unexpected token: ${peek()}`);
  return ast;
}
function callName(e: Expr): string | undefined {
  if (e.kind === 'id') return e.value;
  if (e.kind === 'member' && e.items![1].kind === 'literal') {
    const parent = callName(e.items[0]); if (parent) return parent + '.' + e.items[1].value;
  }
  return undefined;
}
export function evaluateCoreExpression(e: Expr, scope: Record<string, any>, functions = coreFunctions): any {
  const ev = (n: Expr) => evaluateCoreExpression(n, scope, functions);
  switch (e.kind) {
    case 'literal': return e.value;
    case 'id': return scope[e.value];
    case 'array': return e.items.flatMap(item => {
      const value = ev(item);
      return expandsCollection(item) && Array.isArray(value) ? value : [value];
    });
    case 'object': return Object.fromEntries(e.items!.map(([k, v]) => [k, ev(v)]));
    case 'member': return ev(e.items[0])?.[safeKey(ev(e.items[1]))];
    case 'lookup': {
      const source = ev(e.items[0]);
      if (scope[e.value] === undefined) return undefined;
      return Array.isArray(source) ? source.find(item => String(item?.[e.value]) === String(scope[e.value])) : undefined;
    }
    case 'overlay': {
      const [source, overrides] = e.items;
      const value = source.kind === 'id' && !Object.prototype.hasOwnProperty.call(scope, source.value)
        ? scope[`${source.value}_batch`]
        : ev(source);
      return overlay(value, ev(overrides));
    }
    case 'generate': {
      const count = collectionCount(ev(e.items[1]));
      const step = finiteNumber(ev(e.items[2]));
      return Array.from({ length: count }, (_, i) => {
        const local = { ...scope, i };
        const item = cloneData(evaluateCoreExpression(e.items[0], local, functions));
        for (const prop of e.props) if (typeof item[prop] === 'number') item[prop] += i * step;
        return overlay(item, evaluateCoreExpression(e.items[3], local, functions));
      });
    }
    case 'grid': {
      const [cols, rows] = e.items.slice(0, 2).map(item => collectionCount(ev(item)));
      const count = collectionCount(cols * rows);
      const [x, y, dx, dy] = e.items.slice(2, 6).map(item => finiteNumber(ev(item)));
      return Array.from({ length: count }, (_, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const item = { x: x + col * dx, y: y + row * dy, start_x: x + col * dx, start_y: y + row * dy, col, row };
        return overlay(item, evaluateCoreExpression(e.items[6], { ...scope, i, col, row, c: col, r: row }, functions));
      });
    }
    case 'unary': { const v = ev(e.items[0]); return e.value === '-' ? -v : e.value === '+' ? +v : !v; }
    case 'ternary': return ev(e.items[0]) ? ev(e.items[1]) : ev(e.items[2]);
    case 'lambda': return (value: any) => evaluateCoreExpression(e.items[0], { ...scope, [e.value]: value }, functions);
    case 'call': {
      const a = e.items[0];
      const name = callName(a); const args = e.items.slice(1).map(ev);
      if (name && Object.prototype.hasOwnProperty.call(functions, name)) return functions[name](...args);
      if (a.kind === 'member') {
        const receiver = ev(a.items![0]), key = safeKey(ev(a.items![1]));
        const arrays = ['push', 'pop', 'join', 'slice', 'map', 'filter', 'find', 'some', 'every', 'includes', 'indexOf'];
        const strings = ['join', 'slice', 'includes', 'indexOf', 'split', 'toLowerCase', 'toUpperCase', 'padStart'];
        if ((Array.isArray(receiver) && arrays.includes(key)) || (typeof receiver === 'string' && strings.includes(key))){
          const result=(receiver as any)[key](...args);
          if(key==='push'||key==='pop')entitiesChanged(receiver);
          return result;
        }
      }
      throw new Error(`Unknown function: ${name || 'expression'}`);
    }
    case 'binary': {
      const [a, b] = e.items;
      const x = ev(a);
      if (e.value === '??') return x === null || x === undefined || x === '' ? ev(b) : x;
      if (['and', '&&'].includes(e.value)) return Boolean(x) && Boolean(ev(b));
      if (['or', '||'].includes(e.value)) return Boolean(x) || Boolean(ev(b));
      const y = ev(b);
      switch (e.value) {
        case '+': return x + y; case '-': return x - y; case '*': return x * y;
        case '/': return x / y; case '%': return x % y;
        case '==': return String(x) === String(y); case '!=': return String(x) !== String(y);
        case '<': return x < y; case '>': return x > y; case '<=': return x <= y; case '>=': return x >= y;
        case 'contains': return String(x).toLowerCase().includes(String(y).toLowerCase());
      }
    }
  }
  throw new Error('Unknown expression');
}
function expandsCollection(e: Expr): boolean {
  return e.kind === 'generate' || e.kind === 'grid' || e.kind === 'overlay';
}
function collectionCount(value: any): number {
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) throw new Error('Invalid generator count (0..1000000)');
  return value;
}
function finiteNumber(value: any): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Generator coordinates and steps must be finite numbers');
  return value;
}
function cloneData(value: any): any {
  if (Array.isArray(value)) return value.map(cloneData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [safeKey(k), cloneData(v)]));
  return value;
}
function overlay(source: any, overrides: any): any {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw new Error('with/all requires an object');
  const copy = (item: any) => item && typeof item === 'object' && !Array.isArray(item)
    ? { ...cloneData(item), ...cloneData(overrides) } : item;
  if (Array.isArray(source)) return source.map(copy);
  if (!source || typeof source !== 'object') throw new Error('with/all requires an object or array');
  return copy(source);
}

/** Assignment shares lookup parsing with reads, including replacing a match. */
export function assignCoreTarget(target: Expr, value: any, scope: Record<string, any>, functions = coreFunctions): void {
  if (target.kind === 'id') { scope[safeKey(target.value)] = value; return; }
  if (target.kind === 'lookup') {
    const source = evaluateCoreExpression(target.items[0], scope, functions);
    if (!Array.isArray(source)) throw new Error('Lookup requires an array');
    if (scope[target.value] === undefined) return;
    const index = source.findIndex(item => String(item?.[target.value]) === String(scope[target.value]));
    if (index >= 0) { source[index] = value; entitiesChanged(source); }
    return;
  }
  if (target.kind !== 'member') throw new Error('Invalid assignment target');
  const parent = evaluateCoreExpression(target.items[0], scope, functions);
  if (parent == null && containsLookup(target)) return;
  if (parent == null) throw new Error('Missing assignment receiver');
  parent[safeKey(evaluateCoreExpression(target.items[1], scope, functions))] = value;
}
function containsLookup(e: Expr): boolean {
  return e.kind === 'lookup' || (e.kind === 'member' && containsLookup(e.items[0]));
}
// A conservative rollout in existing web apps: unsupported game/helper syntax
// stays with the established evaluator. Vect's typed expressions are strict.
export function compileCoreExpression(source: string): ((scope: Record<string, any>) => any) | null {
  try {
    const ast = parseCoreExpression(source);
    function supported(e: Expr): boolean {
      if (e.kind === 'call' && !Object.prototype.hasOwnProperty.call(coreFunctions, callName(e.items![0]) || '')) {
        const callee = e.items![0];
        if (callee.kind !== 'member' || callee.items![1].kind !== 'literal') return false;
        const method = String(callee.items[1].value);
        if (!['join', 'slice', 'map', 'filter', 'find', 'some', 'every', 'includes', 'indexOf', 'split', 'toLowerCase', 'toUpperCase', 'padStart'].includes(method)) return false;
        if (['map', 'filter', 'find', 'some', 'every'].includes(method) && e.items![1]?.kind !== 'lambda') return false;
      }
      if (e.kind === 'object') return e.items.every(([, value]) => supported(value));
      return !('items' in e) || e.items.every(supported);
    }
    if (!supported(ast)) return null;
    return scope => evaluateCoreExpression(ast, scope);
  } catch { return null; }
}
