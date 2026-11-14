// Canonical expression AST shared by Rune-Web and native Vect scripts.
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
          const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', '\\': '\\', '"': '"', "'": "'" };
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
  const tokens = tokenize(source); let pos = 0;
  const peek = () => tokens[pos].value;
  const take = () => tokens[pos++];
  const expect = (s: string) => { if (take().value !== s) throw new Error(`Expected ${s}`); };
  function expression(min = 0): Expr {
    const t = take(); let left: Expr;
    if (t.kind === 'number') left = { kind: 'literal', value: Number(t.value) };
    else if (t.kind === 'string') left = { kind: 'literal', value: t.value };
    else if (['true', 'false', 'null'].includes(t.value)) left = { kind: 'literal', value: JSON.parse(t.value) };
    else if (['-', '+', '!', 'not'].includes(t.value)) left = { kind: 'unary', value: t.value, items: [expression(8)] };
    else if (t.value === '(') { left = expression(); expect(')'); }
    else if (t.value === '[') {
      const items: Expr[] = [];
      while (peek() !== ']') { items.push(expression()); if (peek() !== ',') break; take(); }
      expect(']'); left = { kind: 'array', items };
    } else if (t.value === '{') {
      const items: [string, Expr][] = [];
      while (peek() !== '}') {
        const key = take(); if (!['id', 'string'].includes(key.kind)) throw new Error('Invalid object key');
        expect(':'); items.push([safeKey(key.value), expression()]);
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
      if (peek() === '[') { take(); const key = expression(); expect(']'); left = { kind: 'member', items: [left, key] }; continue; }
      if (peek() === '(') {
        take(); const args: Expr[] = [];
        while (peek() !== ')') { args.push(expression()); if (peek() !== ',') break; take(); }
        expect(')'); left = { kind: 'call', items: [left, ...args] }; continue;
      }
      const op = peek(), rank = precedence[op];
      if (rank === undefined || rank < min) break;
      take(); left = { kind: 'binary', value: op, items: [left, expression(rank + 1)] };
    }
    if (min === 0 && peek() === '?') {
      take(); const yes = expression(); expect(':'); left = { kind: 'ternary', items: [left, yes, expression()] };
    }
    return left;
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
}
export function evaluateCoreExpression(e: Expr, scope: Record<string, any>, functions = coreFunctions): any {
  const ev = (n: Expr) => evaluateCoreExpression(n, scope, functions);
  switch (e.kind) {
    case 'literal': return e.value;
    case 'id': return scope[e.value];
    case 'array': return e.items!.map(ev);
    case 'object': return Object.fromEntries(e.items!.map(([k, v]) => [k, ev(v)]));
    case 'member': return ev(e.items[0])?.[safeKey(ev(e.items[1]))];
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
        if ((Array.isArray(receiver) && arrays.includes(key)) || (typeof receiver === 'string' && strings.includes(key)))
          return (receiver as any)[key](...args);
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
