"use strict";
var __RuneWeb = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    audioSync: () => audioSync,
    boot: () => boot,
    pauseMusic: () => pauseMusic,
    playMusic: () => playMusic,
    playSound: () => playSound,
    registerMusic: () => registerMusic,
    registerSounds: () => registerSounds,
    resumeMusic: () => resumeMusic,
    setMusicTempo: () => setMusicTempo,
    setMusicVolume: () => setMusicVolume,
    stopMusic: () => stopMusic
  });

  // src/context.ts
  var _ctx = null;
  function initContext(context) {
    _ctx = context;
  }
  function ctx() {
    if (!_ctx) throw new Error("RuneWeb context not initialized \u2014 call boot() first");
    return _ctx;
  }

  // src/ownership.ts
  var ownedValues = /* @__PURE__ */ new WeakSet();
  var reactiveTargets = /* @__PURE__ */ new WeakMap();
  function ownValue(value) {
    ownedValues.add(value);
    return value;
  }
  function isOwnedValue(value) {
    return ownedValues.has(value);
  }
  function registerReactive(proxy, target) {
    reactiveTargets.set(proxy, target);
  }
  function rawValue(value) {
    if (value && typeof value === "object") return reactiveTargets.get(value) ?? value;
    return value;
  }

  // src/pixel3d/entities.ts
  var active;
  var groups = /* @__PURE__ */ new WeakMap();
  var ownedEntities = /* @__PURE__ */ new WeakSet();
  var movementSequence = 0;
  var movementLog = Array(4096);
  function ownEntity(value, importedEntities) {
    value = rawValue(value);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("entity_group expects entity objects");
    if (ownedEntities.has(value)) return value;
    const known = importedEntities.get(value);
    if (known) return known;
    const raw = { ...value };
    const proxy = new Proxy(raw, {
      set: (target, key, next) => {
        Reflect.set(target, key, next);
        if (["x", "y", "z", "visible", "scale"].includes(String(key))) entityMoved(proxy);
        return true;
      },
      deleteProperty: (target, key) => {
        Reflect.deleteProperty(target, key);
        entityMoved(proxy);
        return true;
      },
      defineProperty: () => {
        throw new Error("Entity descriptors cannot be redefined");
      }
    });
    ownValue(proxy);
    ownedEntities.add(proxy);
    importedEntities.set(value, proxy);
    return proxy;
  }
  function entityGroup(values = []) {
    values = rawValue(values);
    if (!Array.isArray(values) || values.length > 1e6) throw new Error("entity_group needs an array");
    if (groups.has(values)) return values;
    const importedEntities = /* @__PURE__ */ new WeakMap();
    const target = values.map((value) => ownEntity(value, importedEntities));
    const proxy = new Proxy(target, {
      set: (array, key, value) => {
        if (key === "length") {
          if (!Number.isInteger(value) || value < 0 || value > array.length) throw new Error("Grow entity groups with push or indexed writes");
          Reflect.set(array, key, value);
        } else if (typeof key === "string" && /^\d+$/.test(key)) {
          const i = Number(key);
          if (i > array.length || i >= 1e6) throw new Error("Entity group indices must be contiguous");
          Reflect.set(array, key, ownEntity(value, importedEntities));
        } else throw new Error("Invalid entity group property");
        entitiesChanged(proxy);
        return true;
      },
      deleteProperty: (array, key) => {
        Reflect.deleteProperty(array, key);
        entitiesChanged(proxy);
        return true;
      },
      defineProperty: () => {
        throw new Error("Entity group descriptors cannot be redefined");
      }
    });
    ownValue(proxy);
    groups.set(proxy, { version: 0, indices: /* @__PURE__ */ new Map() });
    return proxy;
  }
  var session = () => ({ indices: /* @__PURE__ */ new WeakMap(), members: /* @__PURE__ */ new WeakMap() });
  var EntityIndex = class {
    constructor(source, dimensions, owner) {
      this.source = source;
      this.dimensions = dimensions;
      this.owner = owner;
      this.buckets = /* @__PURE__ */ new Map();
      this.rows = /* @__PURE__ */ new Map();
      this.positions = /* @__PURE__ */ new Map();
      this.scales = /* @__PURE__ */ new Map();
      this.maxScale = 1;
      this.dirty = false;
      this.revision = 0;
      this.rebuild();
    }
    key(x, y, z) {
      return `${Math.floor(x / 16)},${Math.floor(y / 16)},${this.dimensions === 3 ? Math.floor(z / 16) : 0}`;
    }
    rebuild() {
      this.buckets.clear();
      this.rows.clear();
      this.positions.clear();
      this.scales.clear();
      this.maxScale = 1;
      this.dirty = false;
      this.source.forEach((entity, i) => {
        if (!entity || typeof entity !== "object") throw new Error("nearby expects entity objects");
        const positions = this.positions.get(entity) ?? [];
        positions.push(i);
        this.positions.set(entity, positions);
        if (this.owner) {
          const memberships = this.owner.members.get(entity) ?? /* @__PURE__ */ new Set();
          memberships.add(this);
          this.owner.members.set(entity, memberships);
        }
        this.place(i, entity);
      });
      this.revision = movementSequence;
    }
    place(i, entity) {
      if (entity.visible === false) return;
      const x = entity.x, y = entity.y, z = this.dimensions === 3 ? entity.z ?? 0 : 0;
      if (![x, y, z].every(Number.isFinite)) throw new Error("nearby entity coordinates must be finite");
      const key = this.key(x, y, z), bucket = this.buckets.get(key) ?? /* @__PURE__ */ new Set();
      bucket.add(i);
      this.buckets.set(key, bucket);
      const scale = Number.isFinite(entity.scale) && entity.scale > 0 ? entity.scale : 1;
      this.scales.set(scale, (this.scales.get(scale) ?? 0) + 1);
      this.maxScale = Math.max(this.maxScale, scale);
      this.rows.set(i, { entity, key, x, y, z, scale });
    }
    move(entity) {
      if (this.dirty) return;
      for (const i of this.positions.get(entity) ?? []) {
        const row = this.rows.get(i);
        if (row) {
          const bucket = this.buckets.get(row.key);
          bucket.delete(i);
          if (!bucket.size) this.buckets.delete(row.key);
          this.rows.delete(i);
          const count = this.scales.get(row.scale) - 1;
          if (count) this.scales.set(row.scale, count);
          else this.scales.delete(row.scale);
          if (row.scale === this.maxScale && !count) {
            this.maxScale = 1;
            for (const scale of this.scales.keys()) this.maxScale = Math.max(this.maxScale, scale);
          }
        }
        this.place(i, entity);
      }
    }
    query(origin, radius, padding = 0) {
      if (this.dirty) this.rebuild();
      if (!this.owner && this.revision !== movementSequence) {
        if (movementSequence - this.revision > movementLog.length) this.rebuild();
        else {
          const changed = /* @__PURE__ */ new Set();
          for (let version = this.revision + 1; version <= movementSequence; version++) changed.add(movementLog[version % movementLog.length].entity);
          for (const entity of changed) if (this.positions.has(entity)) this.move(entity);
          this.revision = movementSequence;
        }
      }
      radius += padding * this.maxScale;
      const minX = Math.floor((origin.x - radius) / 16), maxX = Math.floor((origin.x + radius) / 16);
      const minY = Math.floor((origin.y - radius) / 16), maxY = Math.floor((origin.y + radius) / 16);
      const minZ = this.dimensions === 3 ? Math.floor((origin.z - radius) / 16) : 0, maxZ = this.dimensions === 3 ? Math.floor((origin.z + radius) / 16) : 0;
      const matches = [];
      const inside = (row) => Math.hypot(row.x - origin.x, row.y - origin.y, this.dimensions === 3 ? row.z - origin.z : 0) <= radius;
      if ((maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1) > this.rows.size * 2) {
        for (const [i, row] of this.rows) if (inside(row)) matches.push(i);
      } else for (let z = minZ; z <= maxZ; z++) for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        for (const i of this.buckets.get(`${x},${y},${z}`) ?? []) if (inside(this.rows.get(i))) matches.push(i);
      }
      matches.sort((a, b) => a - b);
      return matches.map((i) => this.source[i]);
    }
  };
  function nearby(source, origin, radius) {
    return query(source, origin, radius);
  }
  function query(source, origin, radius, padding = 0) {
    source = rawValue(source);
    if (!Array.isArray(source) || source.length > 1e6 || !origin || typeof origin !== "object" || typeof radius !== "number" || !Number.isFinite(radius) || radius < 0) throw new Error("nearby needs a collection, position and finite nonnegative radius");
    const point = origin, dimensions = point.z === void 0 ? 2 : 3;
    if (![point.x, point.y, ...dimensions === 3 ? [point.z] : []].every(Number.isFinite)) throw new Error("nearby origin must have finite coordinates");
    const group = groups.get(source);
    if (group) {
      let indexed = group.indices.get(dimensions);
      if (!indexed || indexed.version !== group.version) {
        indexed = { version: group.version, index: new EntityIndex(source, dimensions) };
        group.indices.set(dimensions, indexed);
      }
      return indexed.index.query(point, radius, padding);
    }
    const owner = active ?? session(), indices = owner.indices.get(source) ?? /* @__PURE__ */ new Map();
    let index2 = indices.get(dimensions);
    if (!index2) {
      index2 = new EntityIndex(source, dimensions, owner);
      indices.set(dimensions, index2);
      owner.indices.set(source, indices);
    }
    return index2.query(point, radius, padding);
  }
  function entityMoved(value) {
    if (value && typeof value === "object" && ownedEntities.has(value)) {
      movementSequence++;
      movementLog[movementSequence % movementLog.length] = { version: movementSequence, entity: value };
    }
    if (value && typeof value === "object") for (const index2 of active?.members.get(value) ?? []) index2.move(value);
  }
  function entitiesChanged(value) {
    if (value && typeof value === "object") {
      const group = groups.get(value);
      if (group) group.version++;
    }
    if (Array.isArray(value)) for (const index2 of active?.indices.get(value)?.values() ?? []) index2.dirty = true;
  }

  // src/core_expression.ts
  var precedence = {
    "??": 1,
    or: 2,
    "||": 2,
    and: 3,
    "&&": 3,
    "==": 4,
    "!=": 4,
    contains: 4,
    "<": 5,
    ">": 5,
    "<=": 5,
    ">=": 5,
    "+": 6,
    "-": 6,
    "*": 7,
    "/": 7,
    "%": 7
  };
  var coreFunctions = {
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    min: Math.min,
    max: Math.max,
    sqrt: Math.sqrt,
    pow: Math.pow,
    sin: (x) => Math.sin(x * Math.PI / 180),
    cos: (x) => Math.cos(x * Math.PI / 180),
    clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
    range: (start, end, step = 1) => {
      if (end === void 0) {
        end = start;
        start = 0;
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step === 0)
        throw new Error("range requires finite bounds and a nonzero step");
      const n = Math.max(0, Math.ceil((end - start) / step));
      if (n > 1e6) throw new Error("range exceeds 1000000 items");
      return Array.from({ length: n }, (_, i) => start + i * step);
    },
    len: (x) => x.length,
    keys: Object.keys,
    values: Object.values,
    repeat: (value, n) => {
      if (!Number.isInteger(n) || n < 0 || n > 1e6) throw new Error("invalid repeat count");
      return Array.from({ length: n }, () => value);
    },
    hex: (n, width = 0) => Math.trunc(n).toString(16).padStart(width, "0"),
    "json.stringify": JSON.stringify,
    "json.parse": JSON.parse
  };
  var forbidden = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  function safeKey(key) {
    key = String(key);
    if (forbidden.has(key)) throw new Error(`Invalid member: ${key}`);
    return key;
  }
  function tokenize(source) {
    const out = [];
    let i = 0;
    while (i < source.length) {
      if (/\s/.test(source[i])) {
        i++;
        continue;
      }
      const tail = source.slice(i);
      const number = tail.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (number) {
        out.push({ kind: "number", value: number[0] });
        i += number[0].length;
        continue;
      }
      if (source[i] === '"' || source[i] === "'") {
        const quote = source[i++];
        let value = "";
        let closed = false;
        while (i < source.length) {
          const c = source[i++];
          if (c === quote) {
            closed = true;
            break;
          }
          if (c === "\\") {
            const e = source[i++];
            const escapes = { n: "\n", r: "\r", t: "	", "\\": "\\", '"': '"', "'": "'" };
            if (!(e in escapes)) throw new Error("Invalid string escape");
            value += escapes[e];
          } else value += c;
        }
        if (!closed) throw new Error("Unclosed string");
        out.push({ kind: "string", value });
        continue;
      }
      const id = tail.match(/^[A-Za-z_$][\w$]*/);
      if (id) {
        out.push({ kind: "id", value: id[0] });
        i += id[0].length;
        continue;
      }
      const op = tail.match(/^(?:\?\?|&&|\|\||==|!=|<=|>=|=>|[+*/%<>()\[\]{},.:?!-])/);
      if (!op) throw new Error(`Unexpected token: ${tail.slice(0, 20)}`);
      out.push({ kind: "op", value: op[0] });
      i += op[0].length;
    }
    out.push({ kind: "eof", value: "" });
    return out;
  }
  function parseCoreExpression(source) {
    const tokens = tokenize(source);
    let pos = 0;
    const peek = () => tokens[pos].value;
    const take = () => tokens[pos++];
    const expect = (s) => {
      if (take().value !== s) throw new Error(`Expected ${s}`);
    };
    function expression(min = 0) {
      const t = take();
      let left;
      if (t.kind === "number") left = { kind: "literal", value: Number(t.value) };
      else if (t.kind === "string") left = { kind: "literal", value: t.value };
      else if (["true", "false", "null"].includes(t.value)) left = { kind: "literal", value: JSON.parse(t.value) };
      else if (["-", "+", "!", "not"].includes(t.value)) left = { kind: "unary", value: t.value, items: [expression(8)] };
      else if (t.value === "(") {
        left = expression();
        expect(")");
      } else if (t.value === "[") {
        const items = [];
        while (peek() !== "]") {
          items.push(expression());
          if (peek() !== ",") break;
          take();
        }
        expect("]");
        left = { kind: "array", items };
      } else if (t.value === "{") {
        const items = [];
        while (peek() !== "}") {
          const key = take();
          if (!["id", "string"].includes(key.kind)) throw new Error("Invalid object key");
          expect(":");
          items.push([safeKey(key.value), expression()]);
          if (peek() !== ",") break;
          take();
        }
        expect("}");
        left = { kind: "object", items };
      } else if (t.kind === "id") {
        if (peek() === "=>") {
          take();
          left = { kind: "lambda", value: t.value, items: [expression()] };
        } else left = { kind: "id", value: t.value };
      } else throw new Error(`Expected expression, got ${t.value || "end of input"}`);
      while (true) {
        if (peek() === ".") {
          take();
          const key = take();
          if (key.kind !== "id") throw new Error("Expected member name");
          left = { kind: "member", items: [left, { kind: "literal", value: safeKey(key.value) }] };
          continue;
        }
        if (peek() === "[") {
          take();
          const key = expression();
          expect("]");
          left = { kind: "member", items: [left, key] };
          continue;
        }
        if (peek() === "(") {
          take();
          const args = [];
          while (peek() !== ")") {
            args.push(expression());
            if (peek() !== ",") break;
            take();
          }
          expect(")");
          left = { kind: "call", items: [left, ...args] };
          continue;
        }
        const op = peek(), rank = precedence[op];
        if (rank === void 0 || rank < min) break;
        take();
        left = { kind: "binary", value: op, items: [left, expression(rank + 1)] };
      }
      if (min === 0 && peek() === "?") {
        take();
        const yes = expression();
        expect(":");
        left = { kind: "ternary", items: [left, yes, expression()] };
      }
      return left;
    }
    const ast = expression();
    if (tokens[pos].kind !== "eof") throw new Error(`Unexpected token: ${peek()}`);
    return ast;
  }
  function callName(e) {
    if (e.kind === "id") return e.value;
    if (e.kind === "member" && e.items[1].kind === "literal") {
      const parent = callName(e.items[0]);
      if (parent) return parent + "." + e.items[1].value;
    }
  }
  function evaluateCoreExpression(e, scope, functions = coreFunctions) {
    const ev = (n) => evaluateCoreExpression(n, scope, functions);
    switch (e.kind) {
      case "literal":
        return e.value;
      case "id":
        return scope[e.value];
      case "array":
        return e.items.map(ev);
      case "object":
        return Object.fromEntries(e.items.map(([k, v]) => [k, ev(v)]));
      case "member":
        return ev(e.items[0])?.[safeKey(ev(e.items[1]))];
      case "unary": {
        const v = ev(e.items[0]);
        return e.value === "-" ? -v : e.value === "+" ? +v : !v;
      }
      case "ternary":
        return ev(e.items[0]) ? ev(e.items[1]) : ev(e.items[2]);
      case "lambda":
        return (value) => evaluateCoreExpression(e.items[0], { ...scope, [e.value]: value }, functions);
      case "call": {
        const a = e.items[0];
        const name = callName(a);
        const args = e.items.slice(1).map(ev);
        if (name && Object.prototype.hasOwnProperty.call(functions, name)) return functions[name](...args);
        if (a.kind === "member") {
          const receiver = ev(a.items[0]), key = safeKey(ev(a.items[1]));
          const arrays = ["push", "pop", "join", "slice", "map", "filter", "find", "some", "every", "includes", "indexOf"];
          const strings = ["join", "slice", "includes", "indexOf", "split", "toLowerCase", "toUpperCase", "padStart"];
          if (Array.isArray(receiver) && arrays.includes(key) || typeof receiver === "string" && strings.includes(key)) {
            const result = receiver[key](...args);
            if (key === "push" || key === "pop") entitiesChanged(receiver);
            return result;
          }
        }
        throw new Error(`Unknown function: ${name || "expression"}`);
      }
      case "binary": {
        const [a, b] = e.items;
        const x = ev(a);
        if (e.value === "??") return x === null || x === void 0 || x === "" ? ev(b) : x;
        if (["and", "&&"].includes(e.value)) return Boolean(x) && Boolean(ev(b));
        if (["or", "||"].includes(e.value)) return Boolean(x) || Boolean(ev(b));
        const y = ev(b);
        switch (e.value) {
          case "+":
            return x + y;
          case "-":
            return x - y;
          case "*":
            return x * y;
          case "/":
            return x / y;
          case "%":
            return x % y;
          case "==":
            return String(x) === String(y);
          case "!=":
            return String(x) !== String(y);
          case "<":
            return x < y;
          case ">":
            return x > y;
          case "<=":
            return x <= y;
          case ">=":
            return x >= y;
          case "contains":
            return String(x).toLowerCase().includes(String(y).toLowerCase());
        }
      }
    }
    throw new Error("Unknown expression");
  }
  function compileCoreExpression(source) {
    try {
      let supported2 = function(e) {
        if (e.kind === "call" && !Object.prototype.hasOwnProperty.call(coreFunctions, callName(e.items[0]) || "")) {
          const callee = e.items[0];
          if (callee.kind !== "member" || callee.items[1].kind !== "literal") return false;
          const method = String(callee.items[1].value);
          if (!["join", "slice", "map", "filter", "find", "some", "every", "includes", "indexOf", "split", "toLowerCase", "toUpperCase", "padStart"].includes(method)) return false;
          if (["map", "filter", "find", "some", "every"].includes(method) && e.items[1]?.kind !== "lambda") return false;
        }
        if (e.kind === "object") return e.items.every(([, value]) => supported2(value));
        return !("items" in e) || e.items.every(supported2);
      };
      var supported = supported2;
      const ast = parseCoreExpression(source);
      if (!supported2(ast)) return null;
      return (scope) => evaluateCoreExpression(ast, scope);
    } catch {
      return null;
    }
  }

  // src/random.ts
  function seededRandom(seed) {
    if (!Number.isFinite(seed)) throw new Error("Random seed must be finite");
    let n = Math.trunc(seed) + 1831565813 | 0;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  }
  function randomInt(min, max, seed) {
    min = Math.ceil(min);
    max = Math.floor(max);
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) throw new Error("Invalid random integer range");
    return min + Math.floor((seed === void 0 ? Math.random() : seededRandom(seed)) * (max - min + 1));
  }
  function shuffled(values, seed) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = randomInt(0, i, seed + i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // src/globals.ts
  function getWindowProp(key) {
    return window[key];
  }
  function setWindowProp(key, value) {
    window[key] = value;
  }

  // src/utils.ts
  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function hostingPrefix() {
    if (typeof document === "undefined") return "";
    return (document.querySelector('meta[name="rune-base-path"]')?.getAttribute("content") || "").replace(/\/$/, "");
  }
  function hostedUrl(value) {
    const prefix = hostingPrefix();
    if (!prefix || !value.startsWith("/") || value.startsWith("//") || value === prefix || value.startsWith(prefix + "/")) return value;
    return prefix + value;
  }
  var operatorCache = /* @__PURE__ */ new Map();
  function includesTopLevel(input, delimiter) {
    const key = delimiter + "\0" + input;
    if (operatorCache.has(key)) return operatorCache.get(key);
    const result = scanTopLevel(input, delimiter);
    if (input.length <= 2048) {
      if (operatorCache.size >= 8192) operatorCache.delete(operatorCache.keys().next().value);
      operatorCache.set(key, result);
    }
    return result;
  }
  function scanTopLevel(input, delimiter) {
    let depth = 0;
    let inQuotes = false;
    let quoteChar = "";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if ((ch === '"' || ch === "'") && input[i - 1] !== "\\") {
        if (inQuotes && ch === quoteChar) {
          inQuotes = false;
          quoteChar = "";
        } else if (!inQuotes) {
          inQuotes = true;
          quoteChar = ch;
        }
        continue;
      }
      if (!inQuotes) {
        if (ch === "(" || ch === "[" || ch === "{") depth += 1;
        if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
        if (depth === 0 && input.slice(i, i + delimiter.length) === delimiter) return true;
      }
    }
    return false;
  }
  function splitTopLevel(input, delimiter) {
    const parts = [];
    let current = "";
    let depth = 0;
    let inQuotes = false;
    let quoteChar = "";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if ((ch === '"' || ch === "'") && input[i - 1] !== "\\") {
        if (inQuotes && ch === quoteChar) {
          inQuotes = false;
          quoteChar = "";
        } else if (!inQuotes) {
          inQuotes = true;
          quoteChar = ch;
        }
        current += ch;
        continue;
      }
      if (!inQuotes) {
        if (ch === "[" || ch === "{" || ch === "(") depth += 1;
        if (ch === "]" || ch === "}" || ch === ")") depth -= 1;
        if (depth === 0 && input.slice(i, i + delimiter.length) === delimiter) {
          parts.push(current.trim());
          current = "";
          i += delimiter.length - 1;
          continue;
        }
      }
      current += ch;
    }
    if (current.trim().length > 0) {
      parts.push(current.trim());
    }
    return parts;
  }
  function normalizeLiteral(value) {
    const trimmed = String(value || "").trim();
    if (trimmed.length >= 2 && (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
  function valueToString(value) {
    if (value === null || value === void 0) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value);
    } catch (_err) {
      return "";
    }
  }
  function decodeEscapes(value) {
    const OPEN = "\uE000";
    const CLOSE = "\uE001";
    const input = String(value || "");
    let output = "";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (ch === "\\" && i + 1 < input.length) {
        i += 1;
        const next = input[i];
        if (next === "n") output += "\n";
        else if (next === "r") output += "\r";
        else if (next === "t") output += "	";
        else if (next === '"') output += '"';
        else if (next === "'") output += "'";
        else if (next === "\\") output += "\\";
        else if (next === "{") output += OPEN;
        else if (next === "}") output += CLOSE;
        else output += next;
        continue;
      }
      output += ch;
    }
    return output;
  }
  function expandPercentI18n(value) {
    const input = String(value || "");
    let output = "";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (ch !== "%") {
        output += ch;
        continue;
      }
      let inner = "";
      let closed = false;
      for (i += 1; i < input.length; i += 1) {
        if (input[i] === "%") {
          closed = true;
          break;
        }
        inner += input[i];
      }
      if (closed && inner.startsWith("i18n.")) {
        output += `{${inner}}`;
      } else {
        output += `%${inner}`;
        if (closed) output += "%";
      }
    }
    return output;
  }

  // src/interpolation.ts
  function interpolate(template, scope) {
    const OPEN = "\uE000";
    const CLOSE = "\uE001";
    return expandPercentI18n(decodeEscapes(String(template || ""))).replace(/\{([^}]+)\}/g, function(_match, expr) {
      const resolved = valueToString(evaluateExpression(expr, scope));
      return resolved.includes("{") && resolved.includes("}") ? interpolate(resolved, scope) : resolved;
    }).replace(new RegExp(OPEN, "g"), "{").replace(new RegExp(CLOSE, "g"), "}");
  }

  // src/navigator.ts
  var isNavigatingFromUrl = false;
  var lastKnownRoute = null;
  function readNavigatorUrl(config) {
    if (typeof window === "undefined" || !window.location) return null;
    const param = config.param || "page";
    const mode = config.mode || "auto";
    if (mode === "path" || mode === "auto") {
      try {
        const url = new URL(window.location.href);
        const prefix = hostingPrefix();
        const pathname = prefix && (url.pathname === prefix || url.pathname.startsWith(prefix + "/")) ? url.pathname.slice(prefix.length) : url.pathname;
        const cleanPath = pathname.replace(/^\/+|\/+$/g, "");
        const parts = cleanPath.split("/").filter(Boolean);
        if (parts[0] === "es" || parts[0] === "fr") parts.shift();
        if (parts.length > 0) {
          const route = decodeURIComponent(parts.join("/"));
          if (route && route !== "index.html") {
            return route;
          }
        }
      } catch (_err) {
      }
    }
    if (mode === "query" || mode === "auto" || mode === "path") {
      try {
        const url = new URL(window.location.href);
        const val = url.searchParams.get(param) || url.searchParams.get("p") || url.searchParams.get(config.bind);
        if (val && val.trim()) {
          return val.trim();
        }
      } catch (_err) {
      }
    }
    if (mode === "hash" || mode === "auto") {
      const rawHash = window.location.hash || "";
      if (rawHash) {
        let slug = "";
        if (rawHash.startsWith("#/")) {
          slug = rawHash.slice(2);
        } else if (rawHash.startsWith("#!/")) {
          slug = rawHash.slice(3);
        } else if (rawHash.startsWith("#!") || rawHash.startsWith("#?")) {
          slug = rawHash.slice(2);
        } else if (mode === "hash" && rawHash.startsWith("#") && rawHash !== "#app" && rawHash !== "#") {
          slug = rawHash.slice(1);
        }
        slug = decodeURIComponent(slug.trim());
        if (slug && slug !== "app") {
          return slug;
        }
      }
    }
    return null;
  }
  function setMetaTag(attr, key, content) {
    if (typeof document === "undefined") return;
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }
  function updateSeoMetadata(route) {
    if (typeof document === "undefined") return;
    let context;
    try {
      context = ctx();
    } catch (_err) {
      return;
    }
    const seo = context.seo;
    if (!seo) return;
    const rawRoute = (route || "").trim();
    const cleanRoute = rawRoute.toLowerCase();
    const routeConfig = seo.routes?.[rawRoute] || seo.routes?.[cleanRoute] || seo.routes?.[cleanRoute.replace(/[-_]/g, "")];
    const rawTitle = routeConfig?.title || (cleanRoute && cleanRoute !== "home" ? `${rawRoute.charAt(0).toUpperCase() + rawRoute.slice(1)} \u2014 ${seo.title || "Vectrune"}` : seo.title);
    const rawDescription = routeConfig?.description || seo.description;
    const rawImage = routeConfig?.image || seo.image;
    const scope = { i18n: context.i18nData || {} };
    if (rawTitle) {
      const title = interpolate(rawTitle, scope);
      document.title = title;
      setMetaTag("property", "og:title", title);
      setMetaTag("name", "twitter:title", title);
    }
    if (rawDescription) {
      const description = interpolate(rawDescription, scope);
      setMetaTag("name", "description", description);
      setMetaTag("property", "og:description", description);
      setMetaTag("name", "twitter:description", description);
    }
    if (rawImage) {
      const image = hostedUrl(interpolate(rawImage, scope));
      setMetaTag("property", "og:image", image);
      setMetaTag("name", "twitter:image", image);
    }
    if (typeof window !== "undefined" && window.location) {
      setMetaTag("property", "og:url", window.location.href);
    }
  }
  function updateNavigatorUrl(route, replace = false) {
    if (typeof window === "undefined" || isNavigatingFromUrl) return;
    const context = ctx();
    const config = context.navigator;
    if (!config) {
      updateSeoMetadata(route);
      return;
    }
    const cleanRoute = String(route || "").trim();
    if (cleanRoute === lastKnownRoute) return;
    lastKnownRoute = cleanRoute;
    const mode = config.mode || "auto";
    const param = config.param || "page";
    if (mode === "hash") {
      const targetHash = cleanRoute ? "#/" + encodeURIComponent(cleanRoute) : "";
      if (window.location.hash !== targetHash) {
        if (replace) {
          window.location.replace(targetHash || "#/");
        } else {
          window.location.hash = targetHash || "#/";
        }
      }
      updateSeoMetadata(cleanRoute);
      return;
    }
    if (mode === "path") {
      try {
        const url = new URL(window.location.href);
        const base = hostingPrefix();
        const pathname = url.pathname.slice(base.length);
        let prefix = base;
        if (pathname.startsWith("/es/") || pathname === "/es") prefix += "/es";
        if (pathname.startsWith("/fr/") || pathname === "/fr") prefix += "/fr";
        let newPath = "";
        if (!cleanRoute || cleanRoute === "home") {
          newPath = prefix ? `${prefix}/` : "/";
        } else {
          newPath = prefix ? `${prefix}/${encodeURIComponent(cleanRoute)}` : `/${encodeURIComponent(cleanRoute)}`;
        }
        url.searchParams.delete(param);
        url.searchParams.delete("p");
        url.searchParams.delete(config.bind);
        if (url.hash && !url.hash.startsWith("#/")) {
          url.hash = "";
        }
        const finalUrl = newPath + (url.search ? url.search : "") + (url.hash ? url.hash : "");
        const stateObj = { [config.bind]: cleanRoute };
        if (replace) {
          window.history.replaceState(stateObj, "", finalUrl);
        } else {
          window.history.pushState(stateObj, "", finalUrl);
        }
      } catch (_err) {
      }
      updateSeoMetadata(cleanRoute);
      return;
    }
    try {
      const url = new URL(window.location.href);
      if (!cleanRoute || cleanRoute === "home") {
        url.searchParams.delete(param);
      } else {
        url.searchParams.set(param, cleanRoute);
      }
      if (url.hash && !url.hash.startsWith("#/")) {
        url.hash = "";
      }
      const newUrl = url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : "");
      const stateObj = { [config.bind]: cleanRoute };
      if (replace) {
        window.history.replaceState(stateObj, "", newUrl);
      } else {
        window.history.pushState(stateObj, "", newUrl);
      }
    } catch (_err) {
    }
    updateSeoMetadata(cleanRoute);
  }
  function handleNavigatorStateChange(prop, value) {
    if (isNavigatingFromUrl) return;
    const context = ctx();
    const config = context.navigator;
    if (!config || prop !== config.bind) return;
    updateNavigatorUrl(String(value ?? ""));
  }
  function setupNavigator(config, app) {
    if (typeof window === "undefined") return;
    const boundVar = config.bind;
    if (!boundVar) return;
    const initialUrlRoute = readNavigatorUrl(config);
    if (initialUrlRoute) {
      app.state[boundVar] = initialUrlRoute;
      lastKnownRoute = initialUrlRoute;
    } else {
      lastKnownRoute = String(app.state[boundVar] || "home");
    }
    updateSeoMetadata(lastKnownRoute);
    window.navigate = function(target) {
      if (typeof app.state[boundVar] !== "undefined") {
        app.state[boundVar] = target;
        if (app.render) app.render();
        updateSeoMetadata(target);
      }
    };
    window.addEventListener("popstate", (_event) => {
      const currentRoute = readNavigatorUrl(config) || "home";
      if (currentRoute !== app.state[boundVar]) {
        isNavigatingFromUrl = true;
        try {
          lastKnownRoute = currentRoute;
          app.state[boundVar] = currentRoute;
          if (app.render) app.render();
          updateSeoMetadata(currentRoute);
        } finally {
          isNavigatingFromUrl = false;
        }
      }
    });
    window.addEventListener("hashchange", (_event) => {
      const currentRoute = readNavigatorUrl(config);
      if (currentRoute && currentRoute !== app.state[boundVar]) {
        isNavigatingFromUrl = true;
        try {
          lastKnownRoute = currentRoute;
          app.state[boundVar] = currentRoute;
          if (app.render) app.render();
          updateSeoMetadata(currentRoute);
        } finally {
          isNavigatingFromUrl = false;
        }
      }
    });
  }

  // src/scope.ts
  function splitPathSegments(expr) {
    const str = String(expr || "").replace(/\[\]([a-zA-Z_$][\w$]*)/g, "[].(it.$1 == $1)");
    const segments = [];
    let current = "";
    let inBrackets = false;
    let inParens = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === "(") inParens++;
      if (ch === ")") inParens = Math.max(0, inParens - 1);
      if (inParens > 0 && !(ch === "(" && str.slice(i - 3, i + 1) === "[].(")) {
        current += ch;
        continue;
      }
      if (ch === "." && !inBrackets) {
        if (current.trim()) segments.push(current.trim());
        current = "";
        continue;
      }
      if (ch === "[") {
        if (str.slice(i, i + 4) === "[].(") {
          if (current.trim()) segments.push(current.trim());
          current = "[].(";
          i += 3;
          inParens++;
          continue;
        }
        if (current.trim()) segments.push(current.trim());
        current = "[";
        inBrackets = true;
        continue;
      }
      if (ch === "]") {
        if (inBrackets) {
          current += "]";
          segments.push(current.trim());
          current = "";
          inBrackets = false;
          continue;
        }
      }
      current += ch;
    }
    if (current.trim()) segments.push(current.trim());
    return segments;
  }
  var expressionNames = /* @__PURE__ */ new Map();
  function buildScope(locals, expression) {
    const c = ctx();
    if (c.compactScopes && expression !== void 0 && Object.keys(c.helperDefinitions).length === 0) {
      let names = expressionNames.get(expression);
      if (!names) {
        names = [...new Set(expression.match(/[A-Za-z_$][\w$]*/g) || [])];
        if (expressionNames.size >= 4096) expressionNames.clear();
        expressionNames.set(expression, names);
      }
      const scope = {};
      for (const name of names) {
        for (const source of [locals, c.app.derived, c.app.state]) {
          if (source && Object.prototype.propertyIsEnumerable.call(source, name)) {
            scope[name] = source[name];
            break;
          }
        }
      }
      return scope;
    }
    return Object.assign({}, c.app.state, c.app.derived, locals || {});
  }
  var proxyCache = /* @__PURE__ */ new WeakMap();
  var renderQueued = false;
  function scheduleRender() {
    const context = ctx();
    if (context.isRendering || !context.app.render || renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      const currentCtx = ctx();
      if (!currentCtx.isRendering && currentCtx.app.render) {
        currentCtx.app.render();
      }
    });
  }
  function makeReactive(obj) {
    if (obj === null || typeof obj !== "object" || isOwnedValue(obj)) return obj;
    if (obj.__isProxy) return obj;
    const cached = proxyCache.get(obj);
    if (cached) return cached;
    const context = ctx();
    const proxy = new Proxy(obj, {
      get(target, prop) {
        if (prop === "__isProxy") return true;
        if (prop === "__raw") return target;
        if (getWindowProp("__renderingComponent") && typeof prop === "string" && !prop.startsWith("__")) {
          if (!(context.memorySubscriptions[prop] instanceof Set)) {
            context.memorySubscriptions[prop] = /* @__PURE__ */ new Set();
          }
          context.memorySubscriptions[prop].add(
            getWindowProp("__renderingComponent")
          );
        }
        const val = target[prop];
        if (val !== null && typeof val === "object" && !val.__isProxy) {
          return makeReactive(val);
        }
        return val;
      },
      set(target, prop, value) {
        const rawValue2 = value !== null && typeof value === "object" && value.__raw ? value.__raw : value;
        if (target[prop] === rawValue2) return true;
        target[prop] = rawValue2;
        if (typeof prop === "string" && context.navigator && prop === context.navigator.bind) {
          handleNavigatorStateChange(prop, rawValue2);
        }
        scheduleRender();
        return true;
      },
      deleteProperty(target, prop) {
        delete target[prop];
        scheduleRender();
        return true;
      }
    });
    registerReactive(proxy, obj);
    proxyCache.set(obj, proxy);
    return proxy;
  }

  // src/storage.ts
  var persistent = false;
  var native = () => globalThis;
  var memoryStorage = {};
  function browserStorage() {
    try {
      return typeof window !== "undefined" ? window.localStorage : null;
    } catch {
      return null;
    }
  }
  function getStorageItem(key) {
    try {
      const store = browserStorage();
      const val = native().__runeStoreGet ? native().__runeStoreGet(key) : store?.getItem(key);
      persistent = !!native().__runeStoreGet || !!store;
      if (val != null) return val;
    } catch {
    }
    return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
  }
  function setStorageItem(key, val) {
    memoryStorage[key] = val;
    try {
      const store = browserStorage();
      if (native().__runeStoreSet) native().__runeStoreSet(key, val);
      else store?.setItem(key, val);
      persistent = !!native().__runeStoreSet || !!store;
    } catch {
      persistent = false;
    }
  }
  function removeStorageItem(key) {
    delete memoryStorage[key];
    try {
      if (native().__runeStoreRemove) native().__runeStoreRemove(key);
      else browserStorage()?.removeItem(key);
    } catch {
    }
  }
  function clearStorage() {
    for (const k of Object.keys(memoryStorage)) {
      delete memoryStorage[k];
    }
    try {
      browserStorage()?.clear();
    } catch {
    }
  }
  function hasStorageItem(key) {
    return getStorageItem(key) !== null;
  }

  // src/pixel3d/math.ts
  var ANGLE_UNITS = 4096;
  var DEG_TO_INDEX = ANGLE_UNITS / 360;
  var RAD_TO_INDEX = ANGLE_UNITS / (Math.PI * 2);
  var SIN_TABLE = new Float64Array(ANGLE_UNITS);
  var COS_TABLE = new Float64Array(ANGLE_UNITS);
  for (let i = 0; i < ANGLE_UNITS; i++) {
    const rad = i * 2 * Math.PI / ANGLE_UNITS;
    SIN_TABLE[i] = Math.sin(rad);
    COS_TABLE[i] = Math.cos(rad);
  }

  // src/pixel3d/spatial.ts
  var activeMap = null;
  function getActiveMap() {
    return activeMap || (typeof globalThis !== "undefined" ? globalThis.__RuneSpatialMap : null) || null;
  }
  function isWallAt(x, y, map = getActiveMap()) {
    const m = map || getActiveMap();
    if (!m) return false;
    const mx = Math.floor(x);
    const my = Math.floor(y);
    if (mx < 0 || mx >= m.width || my < 0 || my >= m.height) return true;
    const cell = m.grid[my * m.width + mx];
    if (cell === 0) return false;
    if (m.doors && m.doors[cell]) {
      return m.doors[cell].open < 0.8;
    }
    return true;
  }
  function collidesWithWall(x, y, radius, map) {
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minY = Math.floor(y - radius);
    const maxY = Math.floor(y + radius);
    for (let my = minY; my <= maxY; my++) {
      for (let mx = minX; mx <= maxX; mx++) {
        if (mx < 0 || mx >= map.width || my < 0 || my >= map.height) {
          return true;
        }
        const cell = map.grid[my * map.width + mx];
        let isWall = cell !== 0;
        if (cell !== 0 && map.doors && map.doors[cell]) {
          isWall = map.doors[cell].open < 0.8;
        }
        if (isWall) {
          const cx = Math.max(mx, Math.min(mx + 1, x));
          const cy = Math.max(my, Math.min(my + 1, y));
          const distX = x - cx;
          const distY = y - cy;
          const r = radius - 1e-3;
          if (distX * distX + distY * distY < r * r) {
            return true;
          }
        }
      }
    }
    return false;
  }
  function slide(px, py, dx, dy, radius = 0.25, map = getActiveMap()) {
    if (Number.isNaN(px) || Number.isNaN(py) || Number.isNaN(dx) || Number.isNaN(dy)) {
      return { x: px, y: py };
    }
    const effectiveMap = map || getActiveMap();
    if (!effectiveMap) return { x: px + dx, y: py + dy };
    let newX = px;
    let newY = py;
    if (dx !== 0) {
      const tryX = px + dx;
      if (!collidesWithWall(tryX, py, radius, effectiveMap)) {
        newX = tryX;
      }
    }
    if (dy !== 0) {
      const tryY = py + dy;
      if (!collidesWithWall(newX, tryY, radius, effectiveMap)) {
        newY = tryY;
      } else if (newX !== px && !collidesWithWall(px, tryY, radius, effectiveMap)) {
        newY = tryY;
        newX = px;
      }
    }
    return { x: newX, y: newY };
  }
  function sees(ax, ay, bx, by, map = getActiveMap()) {
    const m = map || getActiveMap();
    if (!m) return true;
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-3) return true;
    const steps = Math.max(2, Math.ceil(dist * 8));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = ax + dx * t;
      const y = ay + dy * t;
      if (isWallAt(x, y, m)) return false;
    }
    return true;
  }
  function mapSpawn(name) {
    const map = globalThis.__RuneSpatialMaps?.[name];
    if (!map?.spawn) throw new Error(`Map ${name} has no spawn`);
    return { ...map.spawn };
  }

  // src/pixel3d/chunks.ts
  var MAX_WORLD_AXIS = 4096;
  var MAX_WORLD_DEPTH = 256;
  var MAX_RESIDENT_CHUNKS = 16384;
  var ChunkStore = class {
    constructor(world, imported = {}) {
      this.world = world;
      this.raw = /* @__PURE__ */ new Map();
      this.populations = /* @__PURE__ */ new Map();
      this.revision = 0;
      this.proxies = /* @__PURE__ */ new Map();
      this.dimensions = [world.width, world.height, world.depth];
      this.cw = Math.ceil(world.width / 4);
      this.ch = Math.ceil(world.height / 4);
      this.cd = Math.ceil(world.depth / 4);
      this.occupied = this.cw * this.ch * this.cd <= 65536 ? new Uint8Array(this.cw * this.ch * this.cd) : /* @__PURE__ */ Object.create(null);
      this.materialCount = world.materials.length;
      this.publicChunks = new Proxy(/* @__PURE__ */ Object.create(null), {
        get: (_t, key) => typeof key === "string" && /^\d+$/.test(key) ? this.proxies.get(Number(key)) : void 0,
        ownKeys: () => [...this.raw.keys()].map(String),
        getOwnPropertyDescriptor: (_t, key) => this.raw.has(Number(key)) ? { enumerable: true, configurable: true } : void 0,
        set: (_t, key, value) => {
          this.replace(Number(key), value);
          return true;
        },
        deleteProperty: (_t, key) => {
          this.remove(Number(key));
          return true;
        },
        defineProperty: () => {
          throw new Error("Chunk descriptors cannot be redefined");
        }
      });
      const volume = world.width * world.height * world.depth;
      const target = [];
      target.length = volume;
      this.cells = new Proxy(target, {
        get: (t, key, receiver) => key === "length" ? volume : typeof key === "string" && /^\d+$/.test(key) ? this.readFlat(Number(key)) : Reflect.get(t, key, receiver),
        set: (_t, key, value) => {
          if (typeof key !== "string" || !/^\d+$/.test(key)) throw new Error("Chunked cells have a fixed length; write a cell index");
          this.writeFlat(Number(key), value);
          return true;
        },
        has: (t, key) => typeof key === "string" && /^\d+$/.test(key) ? Number(key) < volume : Reflect.has(t, key),
        deleteProperty: (_t, key) => {
          this.writeFlat(Number(key), 0);
          return true;
        },
        defineProperty: () => {
          throw new Error("Chunked cells cannot be redefined");
        }
      });
      const entries = Object.entries(imported);
      if (entries.length > MAX_RESIDENT_CHUNKS) throw new Error("Chunked world exceeds resident chunk budget");
      for (const [key, values] of entries) this.replace(Number(key), values);
    }
    /** Bounded render accelerator; large worlds retain sparse lookup. */
    prepareRenderCells() {
      const volume = this.world.width * this.world.height * this.world.depth;
      if (this.renderCells || volume > 65536) return;
      this.renderCells = new Uint16Array(volume);
      for (const [id, values] of this.raw) this.mirror(id, values);
    }
    mirror(id, values) {
      if (!this.renderCells) return;
      const bx = id % this.cw * 4, by = Math.floor(id / this.cw) % this.ch * 4, bz = Math.floor(id / (this.cw * this.ch)) * 4;
      for (let i = 0; i < 64; i++) {
        const x = bx + (i & 3), y = by + (i >> 2 & 3), z = bz + (i >> 4);
        if (x < this.world.width && y < this.world.height && z < this.world.depth) this.renderCells[(z * this.world.height + y) * this.world.width + x] = values?.[i] ?? 0;
      }
    }
    id(value) {
      if (!Number.isInteger(value) || value < 0 || value >= this.cw * this.ch * this.cd) throw new Error("Invalid voxel chunk index");
    }
    block(value) {
      if (!Number.isInteger(value) || value < 0 || value > this.world.materials.length) throw new Error("Invalid voxel block ID");
    }
    cell(id, cell, value) {
      this.block(value);
      if (value && (id % this.cw * 4 + (cell & 3) >= this.world.width || Math.floor(id / this.cw) % this.ch * 4 + (cell >> 2 & 3) >= this.world.height || Math.floor(id / (this.cw * this.ch)) * 4 + (cell >> 4) >= this.world.depth)) throw new Error("Solid chunk cell outside world");
    }
    replace(id, values) {
      this.id(id);
      if (!Array.isArray(values) || values.length !== 64) throw new Error("Voxel chunks need exactly 64 block IDs");
      for (let cell = 0; cell < 64; cell++) this.cell(id, cell, values[cell]);
      const count = values.reduce((n, v) => n + (v !== 0 ? 1 : 0), 0);
      if (!count) {
        this.remove(id);
        return;
      }
      if (!this.raw.has(id) && this.raw.size >= MAX_RESIDENT_CHUNKS) throw new Error("Chunked world exceeds resident chunk budget");
      const raw = values.slice();
      this.raw.set(id, raw);
      this.populations.set(id, count);
      this.occupied[id] = 1;
      this.mirror(id, raw);
      this.proxies.set(id, new Proxy(raw, {
        get: (t, key, receiver) => typeof key === "string" && /^\d+$/.test(key) ? this.raw.get(id)?.[Number(key)] ?? 0 : Reflect.get(t, key, receiver),
        set: (_t, key, value) => {
          if (typeof key !== "string" || !/^\d+$/.test(key) || Number(key) >= 64) throw new Error("Voxel chunks have fixed length");
          this.writeChunk(id, Number(key), value);
          return true;
        },
        deleteProperty: (_t, key) => {
          const cell = Number(key);
          if (!Number.isInteger(cell) || cell < 0 || cell >= 64) throw new Error("Invalid chunk cell");
          this.writeChunk(id, cell, 0);
          return true;
        },
        defineProperty: () => {
          throw new Error("Chunk cells cannot be redefined");
        }
      }));
      this.revision++;
    }
    remove(id) {
      this.id(id);
      if (this.raw.delete(id)) {
        this.mirror(id);
        this.proxies.delete(id);
        this.populations.delete(id);
        if (this.occupied instanceof Uint8Array) this.occupied[id] = 0;
        else delete this.occupied[id];
        this.revision++;
      }
    }
    writeChunk(id, cell, value) {
      this.cell(id, cell, value);
      let raw = this.raw.get(id);
      if (!raw) {
        if (!value) return;
        this.replace(id, Array(64).fill(0).map((_, i) => i === cell ? value : 0));
        return;
      }
      const previous = raw[cell];
      if (previous === value) return;
      raw[cell] = value;
      if (this.renderCells) {
        const x = id % this.cw * 4 + (cell & 3), y = Math.floor(id / this.cw) % this.ch * 4 + (cell >> 2 & 3), z = Math.floor(id / (this.cw * this.ch)) * 4 + (cell >> 4);
        this.renderCells[(z * this.world.height + y) * this.world.width + x] = value;
      }
      const count = this.populations.get(id) + (value ? 1 : 0) - (previous ? 1 : 0);
      if (!count) this.remove(id);
      else {
        this.populations.set(id, count);
        this.revision++;
      }
    }
    /** Fill only intersecting chunks; preflight capacity before changing terrain. */
    fill(from, size, block) {
      const end = from.map((v, i) => v + size[i]), lo = from.map((v) => v >> 2), hi = end.map((v) => v - 1 >> 2);
      let ids;
      if (block === 0) ids = [...this.raw.keys()];
      else {
        if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > MAX_RESIDENT_CHUNKS) throw new Error("Chunked world exceeds resident chunk budget");
        ids = [];
        let count = this.raw.size;
        for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) {
          const id = (z * this.ch + y) * this.cw + x;
          ids.push(id);
          if (!this.raw.has(id) && ++count > MAX_RESIDENT_CHUNKS) throw new Error("Chunked world exceeds resident chunk budget");
        }
      }
      for (const id of ids) {
        const bx = id % this.cw * 4, by = Math.floor(id / this.cw) % this.ch * 4, bz = Math.floor(id / (this.cw * this.ch)) * 4;
        for (let z = Math.max(from[2], bz); z < Math.min(end[2], bz + 4); z++)
          for (let y = Math.max(from[1], by); y < Math.min(end[1], by + 4); y++)
            for (let x = Math.max(from[0], bx); x < Math.min(end[0], bx + 4); x++) this.writeChunk(id, ((z & 3) * 4 + (y & 3)) * 4 + (x & 3), block);
      }
    }
    readFlat(i) {
      const { width, height, depth } = this.world;
      if (!Number.isInteger(i) || i < 0 || i >= width * height * depth) return void 0;
      const x = i % width, yz = Math.floor(i / width), y = yz % height, z = Math.floor(yz / height);
      return this.raw.get(((z >> 2) * this.ch + (y >> 2)) * this.cw + (x >> 2))?.[((z & 3) * 4 + (y & 3)) * 4 + (x & 3)] ?? 0;
    }
    writeFlat(i, value) {
      const { width, height, depth } = this.world;
      if (!Number.isInteger(i) || i < 0 || i >= width * height * depth) throw new Error("Voxel cell index outside world");
      const x = i % width, yz = Math.floor(i / width), y = yz % height, z = Math.floor(yz / height);
      this.writeChunk(((z >> 2) * this.ch + (y >> 2)) * this.cw + (x >> 2), ((z & 3) * 4 + (y & 3)) * 4 + (x & 3), value);
    }
    validate() {
      if (this.world.width !== this.dimensions[0] || this.world.height !== this.dimensions[1] || this.world.depth !== this.dimensions[2]) throw new Error("Recreate chunked worlds to resize them");
      if (this.materialCount !== this.world.materials.length) {
        for (const raw of this.raw.values()) for (const block of raw) this.block(block);
        this.materialCount = this.world.materials.length;
      }
      if (this.world.cells !== this.cells || this.world.chunks !== this.publicChunks) throw new Error("Use cell writes or recreate a chunked world to replace its storage");
    }
  };
  var stores = /* @__PURE__ */ new WeakMap();
  function chunkStore(world) {
    return stores.get(world) ?? stores.get(rawValue(world));
  }
  function ownChunks(world) {
    world = rawValue(world);
    let store = stores.get(world);
    if (store) return store;
    store = new ChunkStore(world, world.chunks);
    stores.set(world, store);
    ownValue(world);
    ownValue(store.publicChunks);
    ownValue(store.cells);
    world.chunks = store.publicChunks;
    Object.defineProperty(world, "cells", { value: store.cells, writable: true, configurable: true, enumerable: false });
    return store;
  }

  // src/pixel3d/voxel.ts
  var worldSnapshots = /* @__PURE__ */ new WeakMap();
  function inspectWorld(world) {
    let snapshot = worldSnapshots.get(world);
    const width = Math.ceil(world.width / 4), height = Math.ceil(world.height / 4);
    const length = width * height * Math.ceil(world.depth / 4);
    if (!snapshot || snapshot.width !== world.width || snapshot.height !== world.height || snapshot.depth !== world.depth) {
      snapshot = {
        width: world.width,
        height: world.height,
        depth: world.depth,
        materialCount: -1,
        cells: new Uint16Array(world.cells.length),
        populations: new Uint8Array(length),
        chunks: { width, height, depth: Math.ceil(world.depth / 4), occupied: new Uint8Array(length), count: 0 }
      };
      worldSnapshots.set(world, snapshot);
    }
    const { cells, populations, chunks } = snapshot, limit = world.materials.length;
    const validateAll = snapshot.materialCount !== limit;
    for (let i = 0; i < world.cells.length; i++) {
      const block = world.cells[i], previous = cells[i];
      if (block === previous && !validateAll) continue;
      if (!Number.isInteger(block) || block < 0 || block > limit) {
        worldSnapshots.delete(world);
        throw new Error("Voxel world needs material names and an exactly sized array of valid block IDs");
      }
      if (!!block !== !!previous) {
        const x = i % world.width, yz = Math.floor(i / world.width);
        const y = yz % world.height, z = Math.floor(yz / world.height);
        const chunk = ((z >> 2) * height + (y >> 2)) * width + (x >> 2);
        populations[chunk] += block ? 1 : -1;
        if (populations[chunk] === 1 && block) {
          chunks.occupied[chunk] = 1;
          chunks.count++;
        }
        if (populations[chunk] === 0 && !block) {
          chunks.occupied[chunk] = 0;
          chunks.count--;
        }
      }
      cells[i] = block;
    }
    snapshot.materialCount = limit;
    return chunks;
  }
  function integer(value, min, max, label) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${label} must be an integer from ${min} to ${max}`);
    }
    return value;
  }
  function validateWorld(value) {
    if (!value || typeof value !== "object") throw new Error("Voxel world must be an object");
    const world = rawValue(value);
    if (chunkStore(world) && world.storage !== "chunked") throw new Error("Chunked world storage cannot be changed");
    integer(world.width, 1, MAX_WORLD_AXIS, "Voxel width");
    integer(world.height, 1, MAX_WORLD_AXIS, "Voxel height");
    integer(world.depth, 1, world.storage === "chunked" ? MAX_WORLD_DEPTH : 24, "Voxel depth");
    if (world.renderDistance !== void 0 && (!Number.isFinite(world.renderDistance) || world.renderDistance <= 0 || world.renderDistance > 4096)) throw new Error("Voxel renderDistance must be in (0, 4096]");
    if (world.storage !== "chunked" && world.width * world.height * world.depth > 48 * 48 * 24) {
      throw new Error("Voxel world must contain at most 55296 cells");
    }
    if (!Array.isArray(world.materials) || world.materials.length < 1 || world.materials.length > 256 || !world.materials.every((name) => typeof name === "string" && name.length > 0)) {
      throw new Error("Voxel world needs material names and an exactly sized array of valid block IDs");
    }
    if (world.storage === "chunked") {
      if (world.width * world.height * world.depth > 2147483647) throw new Error("Chunked world exceeds logical cell limit");
      if (world.chunks !== void 0 && (!world.chunks || typeof world.chunks !== "object" || Array.isArray(world.chunks))) throw new Error("Chunked world chunks must be a record");
      (chunkStore(world) ?? ownChunks(world)).validate();
      return world;
    }
    if (world.storage !== void 0) throw new Error("Unknown voxel storage");
    if (!Array.isArray(world.cells) || world.cells.length !== world.width * world.height * world.depth) throw new Error("Voxel world needs material names and an exactly sized array of valid block IDs");
    inspectWorld(world);
    return world;
  }
  function voxelWorld(width, height, depth, materials, options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Voxel world options must be an object");
    const opts = options;
    if (Object.keys(opts).some((k) => !["seed", "biome", "spawn", "renderDistance"].includes(k))) throw new Error("Unknown voxel world option");
    const world = {
      width,
      height,
      depth,
      materials: Array.isArray(materials) ? materials.slice() : materials,
      seed: opts.seed ?? 0,
      biome: opts.biome ?? "meadow",
      spawn: opts.spawn ?? { x: 0.5, y: 0.5, z: 1, angle: 0, pitch: 0, vz: 0 },
      storage: "chunked",
      chunks: {},
      renderDistance: opts.renderDistance ?? 128
    };
    return validateWorld(world);
  }
  function index(world, x, y, z) {
    return (z * world.height + y) * world.width + x;
  }
  function voxelGet(world, x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= world.width || y >= world.height || z >= world.depth) return 0;
    const store = chunkStore(world);
    return store ? store.readFlat(index(world, x, y, z)) : world.cells[index(world, x, y, z)];
  }
  function voxelRead(worldValue, xValue, yValue, zValue) {
    const world = validateWorld(worldValue);
    const x = integer(xValue, 0, world.width - 1, "Voxel x");
    const y = integer(yValue, 0, world.height - 1, "Voxel y");
    const z = integer(zValue, 0, world.depth - 1, "Voxel z");
    return voxelGet(world, x, y, z);
  }
  function voxelFill(worldValue, fromValue, sizeValue, blockValue) {
    const world = validateWorld(worldValue);
    if (!Array.isArray(fromValue) || !Array.isArray(sizeValue) || fromValue.length !== 3 || sizeValue.length !== 3) {
      throw new Error("Voxel fill needs from and size arrays with three integers");
    }
    const limits = [world.width, world.height, world.depth];
    const from = fromValue.map((v, i) => integer(v, 0, limits[i] - 1, "Voxel fill origin"));
    const size = sizeValue.map((v, i) => integer(v, 1, limits[i] - from[i], "Voxel fill size"));
    const block = integer(blockValue, 0, world.materials.length, "Voxel fill block");
    const store = chunkStore(world);
    if (store) {
      store.fill(from, size, block);
      return world;
    }
    for (let z = from[2]; z < from[2] + size[2]; z++) for (let y = from[1]; y < from[1] + size[1]; y++) {
      for (let x = from[0]; x < from[0] + size[0]; x++) world.cells[index(world, x, y, z)] = block;
    }
    return world;
  }
  function noise(x, y, seed) {
    let hash = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ seed;
    hash = Math.imul(hash ^ hash >>> 13, 1274126177);
    return (hash >>> 0) / 4294967296;
  }
  function voxelGenerate(seedValue, biomeValue = "meadow") {
    const seed = integer(seedValue, 0, 4294967295, "Voxel seed");
    if (biomeValue !== "meadow" && biomeValue !== "ember") throw new Error("Voxel biome must be meadow or ember");
    const world = {
      width: 20,
      height: 20,
      depth: 10,
      seed,
      biome: biomeValue,
      materials: [
        "miners/bedrock",
        "miners/stone",
        biomeValue === "ember" ? "miners/ash" : "miners/grass",
        "miners/wood",
        "miners/copper",
        biomeValue === "ember" ? "miners/ember" : "miners/leaves"
      ],
      cells: Array(4e3).fill(0),
      spawn: { x: 4.5, y: 4.5, z: 3, angle: 0, pitch: 0, vz: 0 }
    };
    const set = (x, y, z, block) => {
      world.cells[index(world, x, y, z)] = block;
    };
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const camp = x < 9 && y < 9;
      const top = camp ? 3 : 3 + Math.floor(noise(Math.floor(x / 3), Math.floor(y / 3), seed + (biomeValue === "ember" ? 137 : 0)) * 3);
      for (let z = 0; z < top; z++) set(x, y, z, z === 0 ? 1 : z === top - 1 ? 3 : noise(x + z * 13, y, seed) > 0.87 ? 5 : 2);
      if (!camp && x > 1 && y > 1 && x < 18 && y < 18 && noise(x, y, seed + 1) > 0.94) {
        for (let z = top; z < top + 2; z++) set(x, y, z, 4);
        set(x, y, top + 2, 6);
      }
    }
    for (let x = 8; x < 19; x++) for (let y = 9; y <= 14; y++) {
      const floor = x < 10 ? 3 : x < 12 ? 2 : 1;
      for (let z = floor; z <= (x < 12 ? 8 : 3); z++) set(x, y, z, 0);
      if (x >= 12) set(x, y, 4, 2);
    }
    for (let x = 12; x < 19; x++) {
      set(x, 8, 2, noise(x, 8, seed) > 0.4 ? 5 : 2);
      set(x, 15, 2, noise(x, 15, seed) > 0.4 ? 5 : 2);
    }
    for (let y = 9; y <= 14; y++) for (let z = 1; z <= 4; z++) set(19, y, z, 2);
    for (let x = 3; x <= 5; x++) for (let y = 3; y <= 5; y++) set(x, y, 2, 1);
    for (const [x, y, z, block] of [
      [7, 4, 3, 4],
      [7, 4, 4, 4],
      [7, 5, 3, 4],
      [8, 6, 3, 2],
      [8, 6, 4, 2],
      [8, 7, 3, 2],
      [9, 6, 3, 5],
      [9, 7, 3, 5]
    ]) set(x, y, z, block);
    return world;
  }
  function chunkEntry(chunks, x, y, z, tx, ty, tz, dx, dy, dz, sx, sy, sz, maxDistance) {
    let ex = Number.isFinite(tx) ? tx + (sx > 0 ? 3 - (x & 3) : x & 3) * dx : Infinity;
    let ey = Number.isFinite(ty) ? ty + (sy > 0 ? 3 - (y & 3) : y & 3) * dy : Infinity;
    let ez = Number.isFinite(tz) ? tz + (sz > 0 ? 3 - (z & 3) : z & 3) * dz : Infinity;
    x >>= 2;
    y >>= 2;
    z >>= 2;
    const width = chunks.width, height = chunks.height, depth = chunks.depth;
    const stepX = dx * 4, stepY = dy * 4, stepZ = dz * 4;
    const exitX = sx > 0 ? width : -1, exitY = sy > 0 ? height : -1, exitZ = sz > 0 ? depth : -1;
    let cellIndex = (z * height + y) * width + x;
    let entry = 0;
    while (true) {
      if (chunks.occupied[cellIndex]) return entry;
      const axis = ex < ey && ex < ez ? 0 : ey < ez ? 1 : 2;
      const next = axis === 0 ? ex : axis === 1 ? ey : ez;
      if (!Number.isFinite(next) || next > maxDistance) return Infinity;
      const tolerance = 1e-9 * Math.max(1, next);
      if (axis === 0 ? ey - next <= tolerance || ez - next <= tolerance : axis === 1 ? ex - next <= tolerance || ez - next <= tolerance : ex - next <= tolerance || ey - next <= tolerance) return entry;
      entry = next;
      if (axis === 0) {
        x += sx;
        ex += stepX;
        cellIndex += sx;
        if (x === exitX) return Infinity;
      } else if (axis === 1) {
        y += sy;
        ey += stepY;
        cellIndex += sy * width;
        if (y === exitY) return Infinity;
      } else {
        z += sz;
        ez += stepZ;
        cellIndex += sz * width * height;
        if (z === exitZ) return Infinity;
      }
    }
  }
  function voxelRay(world, origin, ray, maxDistance, output, chunks) {
    return traceVoxelRay(
      world,
      origin,
      ray[0],
      ray[1],
      ray[2],
      Math.abs(1 / ray[0]),
      Math.abs(1 / ray[1]),
      Math.abs(1 / ray[2]),
      maxDistance,
      output,
      chunks
    );
  }
  function traceVoxelRay(world, origin, rx, ry, rz, dx, dy, dz, maxDistance, output, chunks, crossings, column = 0, row = 0) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const width = world.width, height = world.height, depth = world.depth;
    const sourceStore = chunkStore(world), cells = sourceStore?.renderCells ?? world.cells;
    const store = sourceStore?.renderCells ? void 0 : sourceStore;
    let lastChunk = -1, blocks;
    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return null;
    const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1, sz = rz < 0 ? -1 : 1;
    const stepY = sy * width, stepZ = sz * width * height;
    let cellIndex = (z * height + y) * width + x;
    let tx = rx === 0 ? Infinity : (sx < 0 ? origin.x - x : x + 1 - origin.x) * dx;
    let ty = ry === 0 ? Infinity : (sy < 0 ? origin.y - y : y + 1 - origin.y) * dy;
    let tz = rz === 0 ? Infinity : (sz < 0 ? origin.z - z : z + 1 - origin.z) * dz;
    if (chunks && (rx !== 0 || ry !== 0 || rz !== 0)) {
      const entry = chunkEntry(chunks, x, y, z, tx, ty, tz, dx, dy, dz, sx, sy, sz, maxDistance);
      if (!Number.isFinite(entry)) return null;
      const beforeEntry = entry - 1e-9 * Math.max(1, entry);
      if (crossings) {
        if (tx < beforeEntry) {
          const offset = column * crossings.strideX;
          const count = crossingBefore(crossings.x, offset, crossings.strideX, beforeEntry, dx);
          x += sx * count;
          tx = crossings.x[offset + count];
        }
        if (ty < beforeEntry) {
          const offset = column * crossings.strideY;
          const count = crossingBefore(crossings.y, offset, crossings.strideY, beforeEntry, dy);
          y += sy * count;
          ty = crossings.y[offset + count];
        }
        if (tz < beforeEntry) {
          const offset = row * crossings.strideZ;
          const count = crossingBefore(crossings.z, offset, crossings.strideZ, beforeEntry, dz);
          z += sz * count;
          tz = crossings.z[offset + count];
        }
      } else {
        while (tx < beforeEntry) {
          x += sx;
          tx += dx;
        }
        while (ty < beforeEntry) {
          y += sy;
          ty += dy;
        }
        while (tz < beforeEntry) {
          z += sz;
          tz += dz;
        }
      }
      cellIndex = (z * height + y) * width + x;
    }
    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return null;
    const exitX = sx > 0 ? width : -1, exitY = sy > 0 ? height : -1, exitZ = sz > 0 ? depth : -1;
    let distance = 0, face = 2;
    for (let iteration = 0; iteration < width + height + depth + 3 && distance <= maxDistance; iteration++) {
      let block;
      if (store) {
        const chunk = ((z >> 2) * store.ch + (y >> 2)) * store.cw + (x >> 2);
        if (chunk !== lastChunk) {
          blocks = store.raw.get(chunk);
          lastChunk = chunk;
        }
        block = blocks?.[((z & 3) * 4 + (y & 3)) * 4 + (x & 3)] ?? 0;
      } else block = cells[cellIndex];
      if (block) {
        if (!output) return { x, y, z, block, distance, face };
        output.x = x;
        output.y = y;
        output.z = z;
        output.block = block;
        output.distance = distance;
        output.face = face;
        return output;
      }
      if (tx < ty && tx < tz) {
        face = 0;
        distance = tx;
        tx += dx;
        x += sx;
        cellIndex += sx;
        if (x === exitX) break;
      } else if (ty < tz) {
        face = 1;
        distance = ty;
        ty += dy;
        y += sy;
        cellIndex += stepY;
        if (y === exitY) break;
      } else {
        face = 2;
        distance = tz;
        tz += dz;
        z += sz;
        cellIndex += stepZ;
        if (z === exitZ) break;
      }
    }
    return null;
  }
  function voxelTarget(worldValue, playerValue) {
    const world = validateWorld(worldValue), player = validatePlayer(playerValue, world);
    const a = player.angle * Math.PI / 180, p = player.pitch * Math.PI / 180;
    return voxelRay(
      world,
      { x: player.x, y: player.y, z: player.z + 1.25 },
      [Math.cos(a) * Math.cos(p), Math.sin(a) * Math.cos(p), Math.sin(p)],
      3
    );
  }
  function validatePlayer(value, world) {
    if (!value || typeof value !== "object") throw new Error("Voxel player must be an object");
    const player = value;
    if (![player.x, player.y, player.z, player.angle, player.pitch, player.vz].every(Number.isFinite)) {
      throw new Error("Voxel player needs finite x, y, z, angle, pitch and vz");
    }
    if (player.x < 0.25 || player.y < 0.25 || player.x > world.width - 0.25 || player.y > world.height - 0.25 || player.z < 1 || player.z + 1.6 > world.depth || Math.abs(player.vz) > 1 || Math.abs(player.pitch) > 90) {
      throw new Error("Voxel player must be inside movement bounds, with pitch within 90 degrees and vz within 1");
    }
    return player;
  }
  function voxelMine(worldValue, playerValue) {
    const world = validateWorld(worldValue);
    const hit = voxelTarget(world, playerValue);
    if (!hit || hit.block === 1) return { block: 0, hit };
    world.cells[index(world, hit.x, hit.y, hit.z)] = 0;
    return { block: hit.block, hit };
  }
  function clearBody(world, x, y, z) {
    if (x < 0.25 || y < 0.25 || x > world.width - 0.25 || y > world.height - 0.25 || z < 1 || z + 1.6 > world.depth) return false;
    for (const dx of [-0.24, 0.24]) for (const dy of [-0.24, 0.24]) {
      for (let bz = Math.floor(z + 1e-3); bz <= Math.floor(z + 1.599); bz++) {
        if (voxelGet(world, Math.floor(x + dx), Math.floor(y + dy), bz)) return false;
      }
    }
    return true;
  }
  function voxelMove(worldValue, playerValue, dxValue, dyValue, jumpValue = false, movementValue = {}) {
    const world = validateWorld(worldValue), p = { ...validatePlayer(playerValue, world) };
    if (!movementValue || typeof movementValue !== "object" || Array.isArray(movementValue) || Object.keys(movementValue).some((key) => !["jumpSpeed", "gravity", "autoStep"].includes(key))) {
      throw new Error("Voxel movement options accept jumpSpeed, gravity and autoStep");
    }
    const { jumpSpeed = 0.28, gravity = 0.035, autoStep = true } = movementValue;
    if (!Number.isFinite(jumpSpeed) || jumpSpeed <= 0 || jumpSpeed > 1 || !Number.isFinite(gravity) || gravity <= 0 || gravity > 0.3 || typeof autoStep !== "boolean") {
      throw new Error("Voxel movement needs jumpSpeed in (0, 1], gravity in (0, 0.3] and boolean autoStep");
    }
    if (typeof dxValue !== "number" || typeof dyValue !== "number" || !Number.isFinite(dxValue) || !Number.isFinite(dyValue) || Math.hypot(dxValue, dyValue) > 1 || typeof jumpValue !== "boolean") {
      throw new Error("Voxel movement needs finite deltas of at most one tile and a boolean jump");
    }
    const grounded = !clearBody(world, p.x, p.y, p.z - 0.05);
    if (jumpValue && grounded) p.vz = jumpSpeed;
    p.vz = Math.max(-0.3, p.vz - gravity);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dxValue), Math.abs(dyValue), Math.abs(p.vz)) / 0.05));
    for (let i = 0; i < steps; i++) {
      for (const [axis, delta] of [["x", dxValue / steps], ["y", dyValue / steps]]) {
        const x = p.x + (axis === "x" ? delta : 0), y = p.y + (axis === "y" ? delta : 0);
        if (clearBody(world, x, y, p.z)) p[axis] += delta;
        else if (autoStep && grounded && delta !== 0 && clearBody(world, x, y, Math.floor(p.z) + 1)) {
          p.z = Math.floor(p.z) + 1;
          p[axis] += delta;
          p.vz = 0;
        }
      }
      if (clearBody(world, p.x, p.y, p.z + p.vz / steps)) p.z += p.vz / steps;
      else {
        if (p.vz < 0) p.z = Math.round(p.z);
        p.vz = 0;
      }
    }
    return p;
  }
  function crossingBefore(values, offset, stride, before, delta) {
    let count = Math.max(0, Math.min(stride - 1, Math.ceil((before - values[offset]) / delta)));
    while (count < stride - 1 && values[offset + count] < before) count++;
    while (count > 0 && values[offset + count - 1] >= before) count--;
    return count;
  }

  // src/expression.ts
  var MAX_DEPTH = 64;
  var voxelFunctions = {
    voxel_world: (width, height, depth, materials, options) => voxelWorld(width, height, depth, materials, options),
    nearby: (entities, position, radius) => nearby(entities, position, radius),
    entity_group: (entities) => entityGroup(entities),
    voxel_generate: (seed, biome) => voxelGenerate(seed, biome),
    voxel_move: (world, player, dx, dy, jump, movement) => voxelMove(world, player, dx, dy, jump, movement),
    voxel_target: (world, player) => voxelTarget(world, player),
    voxel_mine: (world, player) => voxelMine(world, player),
    voxel_get: (world, x, y, z) => voxelRead(world, x, y, z),
    voxel_fill: (world, from, size, block) => voxelFill(world, from, size, block)
  };
  var voxelArity = {
    voxel_world: [4, 5],
    nearby: [3, 3],
    entity_group: [0, 1],
    voxel_generate: [1, 2],
    voxel_move: [4, 6],
    voxel_target: [2, 2],
    voxel_mine: [2, 2],
    voxel_get: [4, 4],
    voxel_fill: [4, 4]
  };
  function tryParseLiteral(expr, scope) {
    const trimmed = String(expr || "").trim();
    if (trimmed === "") return void 0;
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    if (!Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed))
      return Number(trimmed);
    if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
      if (trimmed.startsWith('"')) {
        try {
          return JSON.parse(trimmed);
        } catch (_) {
        }
      }
      return normalizeLiteral(trimmed);
    }
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const keys = scope ? Object.keys(scope).filter(
          (k) => k !== "this" && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(k)
        ) : [];
        const vals = keys.map((k) => scope[k]);
        return new Function(...keys, `return (${trimmed});`)(...vals);
      } catch (_err) {
        return void 0;
      }
    }
    return void 0;
  }
  function resolvePath(expr, scope) {
    const segments = splitPathSegments(expr);
    if (!segments.length) return void 0;
    let current = scope[segments[0]];
    if (current === void 0) return void 0;
    for (let i = 1; i < segments.length; i += 1) {
      const segment = segments[i];
      if (current === null || current === void 0) return void 0;
      if (Array.isArray(current) && segment === "length") {
        current = current.length;
      } else if (Array.isArray(current) && segment.startsWith("[].(") && segment.endsWith(")")) {
        const condition = segment.slice(4, -1);
        const match = current.find((item) => {
          const innerScope = Object.assign({}, scope, { it: item });
          return Boolean(evaluateExpression(condition, innerScope, 0));
        });
        if (match !== void 0) current = match;
        else return void 0;
      } else if (segment.startsWith("[") && segment.endsWith("]")) {
        const innerExpr = segment.slice(1, -1);
        const lookup = evaluateExpression(innerExpr, scope, 0);
        current = current[valueToString(lookup)];
      } else {
        current = current[segment];
      }
    }
    return current;
  }
  function resolveValue(expr, scope) {
    const literal = tryParseLiteral(expr, scope);
    if (literal !== void 0) return literal;
    const pathValue = resolvePath(expr, scope);
    if (pathValue !== void 0) return pathValue;
    if (expr.includes(".") || expr.includes("[")) return void 0;
    return normalizeLiteral(expr);
  }
  function parseHelperCall(expr) {
    const trimmed = String(expr || "").trim();
    if (!trimmed) return null;
    const { helperDefinitions } = ctx();
    const parenMatch = trimmed.match(/^([A-Za-z_][\w-]*)\((.*)?\)$/);
    if (parenMatch && helperDefinitions[parenMatch[1]]) {
      return {
        name: parenMatch[1],
        args: parenMatch[2] ? splitTopLevel(parenMatch[2], ",") : []
      };
    }
    const firstSpace = trimmed.indexOf(" ");
    if (firstSpace > 0) {
      const name = trimmed.slice(0, firstSpace);
      if (helperDefinitions[name]) {
        return {
          name,
          args: trimmed.slice(firstSpace + 1).split(/\s+/).filter(Boolean)
        };
      }
    }
    if (helperDefinitions[trimmed]) {
      return { name: trimmed, args: [] };
    }
    return null;
  }
  function callHelper(name, args, scope, depth) {
    const { helperDefinitions } = ctx();
    const helper = helperDefinitions[name];
    if (!helper) return void 0;
    const helperLocals = Object.assign({}, scope || {});
    (helper.params || []).forEach((param, index2) => {
      helperLocals[param] = args[index2];
    });
    for (const line of helper.body || []) {
      const trimmed = String(line || "").trim();
      if (trimmed.startsWith("return ")) {
        return evaluateExpression(
          trimmed.slice(7),
          buildScope(helperLocals),
          depth
        );
      }
    }
    return void 0;
  }
  var exprCache = /* @__PURE__ */ new Map();
  var MAX_CACHE_SIZE = 8192;
  function compilePath(expr) {
    const segments = splitPathSegments(expr);
    if (!segments.length) return () => void 0;
    if (segments.length === 1 && !segments[0].includes("[")) {
      const key = segments[0];
      return (scope) => scope?.[key];
    }
    if (segments.length === 2 && !segments[0].includes("[") && !segments[1].includes("[")) {
      const k0 = segments[0];
      const k1 = segments[1];
      if (k1 === "length") {
        return (scope) => {
          const obj = scope?.[k0];
          return Array.isArray(obj) ? obj.length : obj?.length;
        };
      }
      return (scope) => {
        const obj = scope?.[k0];
        return obj?.[k1];
      };
    }
    if (segments.length === 3 && !segments[0].includes("[") && !segments[1].includes("[") && !segments[2].includes("[")) {
      const k0 = segments[0];
      const k1 = segments[1];
      const k2 = segments[2];
      if (k2 === "length") {
        return (scope) => {
          const o0 = scope?.[k0];
          const obj = o0?.[k1];
          return Array.isArray(obj) ? obj.length : obj?.length;
        };
      }
      return (scope) => {
        const o0 = scope?.[k0];
        const o1 = o0?.[k1];
        return o1?.[k2];
      };
    }
    const compiledSteps = segments.map((segment) => {
      if (segment === "length") {
        return (current) => Array.isArray(current) ? current.length : current?.length;
      }
      if (segment.startsWith("[].(") && segment.endsWith(")")) {
        const cond = compileExpression(segment.slice(4, -1));
        return (current, scope) => {
          if (!Array.isArray(current)) return void 0;
          return current.find((item) => {
            const innerScope = Object.assign({}, scope, { it: item });
            return Boolean(cond(innerScope));
          });
        };
      }
      if (segment.startsWith("[") && segment.endsWith("]")) {
        const inner = compileExpression(segment.slice(1, -1));
        return (current, scope) => {
          if (current === null || current === void 0) return void 0;
          const lookup = inner(scope);
          return current[valueToString(lookup)];
        };
      }
      return (current) => {
        if (current === null || current === void 0) return void 0;
        return current[segment];
      };
    });
    return (scope) => {
      let current = scope;
      for (let i = 0; i < compiledSteps.length; i++) {
        if (current === null || current === void 0) return void 0;
        current = compiledSteps[i](current, scope);
      }
      return current;
    };
  }
  function compileResolveValue(expr) {
    const trimmed = expr.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      return (scope) => resolveValue(trimmed, scope);
    }
    const literal = tryParseLiteral(trimmed);
    if (literal !== void 0) {
      return () => literal;
    }
    if (trimmed.includes(".") || trimmed.includes("[")) {
      const pathFn = compilePath(trimmed);
      return (scope) => pathFn(scope);
    }
    const fallback = normalizeLiteral(trimmed);
    return (scope) => {
      if (scope && scope[trimmed] !== void 0) {
        return scope[trimmed];
      }
      return fallback;
    };
  }
  function compileExpression(expr, depth = 0) {
    if (depth > MAX_DEPTH) return () => void 0;
    const nextDepth = depth + 1;
    let trimmed = String(expr || "").trim();
    if (!trimmed) return () => void 0;
    if (trimmed === "true") return () => true;
    if (trimmed === "false") return () => false;
    if (trimmed === "null") return () => null;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed);
      return () => n;
    }
    if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\])*$/.test(trimmed)) {
      const pathFn = compilePath(trimmed);
      if (!trimmed.includes(".") && !trimmed.includes("[")) {
        const fallback = normalizeLiteral(trimmed);
        return (scope) => {
          const val = pathFn(scope);
          return val !== void 0 ? val : fallback;
        };
      }
      return (scope) => pathFn(scope);
    }
    const core = compileCoreExpression(trimmed);
    if (core) return core;
    if (trimmed.startsWith('"')) {
      try {
        const literal = JSON.parse(trimmed);
        if (typeof literal === "string") return () => literal;
      } catch (_) {
      }
    }
    if (trimmed.startsWith("@")) {
      let selector = "";
      let rest = "";
      if (trimmed.startsWith("@[")) {
        const closeIdx = trimmed.indexOf("]");
        if (closeIdx > 1) {
          selector = trimmed.slice(2, closeIdx);
          rest = trimmed.slice(closeIdx + 1);
        }
      } else {
        const match = trimmed.match(/^@([\w-]+)(.*)$/);
        if (match) {
          selector = "." + match[1];
          rest = match[2];
        }
      }
      if (selector) {
        const cRest = rest ? compilePath(rest.startsWith(".") ? rest.slice(1) : rest) : null;
        return () => {
          if (typeof document !== "undefined") {
            const el = document.querySelector(selector);
            if (el) {
              if (!cRest) return el;
              return cRest(el);
            }
          }
          return void 0;
        };
      }
    }
    let parenStripped = false;
    while (trimmed.startsWith("(") && trimmed.endsWith(")")) {
      let d = 0;
      let matched = true;
      for (let i = 0; i < trimmed.length - 1; i += 1) {
        if (trimmed[i] === "(") d += 1;
        if (trimmed[i] === ")") d -= 1;
        if (d === 0) {
          matched = false;
          break;
        }
      }
      if (!matched) break;
      trimmed = trimmed.slice(1, -1).trim();
      parenStripped = true;
    }
    if (parenStripped) {
      return compileExpression(trimmed, nextDepth);
    }
    if (trimmed.startsWith("!")) {
      const inner = compileExpression(trimmed.slice(1).trim(), nextDepth);
      return (scope) => !Boolean(inner(scope));
    }
    for (const [name, fn] of Object.entries(voxelFunctions)) {
      if (trimmed.startsWith(name + "(") && trimmed.endsWith(")")) {
        const parts = splitTopLevel(trimmed.slice(name.length + 1, -1), ",");
        const [required, maximum] = voxelArity[name];
        if (parts.length < required || parts.length > maximum) throw new Error(`${name} needs ${required}-${maximum} arguments`);
        const args = parts.map((part) => compileExpression(part, nextDepth));
        return (scope) => fn(...args.map((arg) => arg(scope)));
      }
    }
    if (trimmed.startsWith("map_spawn(") && trimmed.endsWith(")")) {
      const name = compileExpression(trimmed.slice(10, -1), nextDepth);
      return (scope) => mapSpawn(String(name(scope)));
    }
    if (trimmed.startsWith("collide(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(8, -1), ",");
      if (parts.length >= 2) {
        const cA = compileExpression(parts[0], nextDepth);
        const cB = compileExpression(parts[1], nextDepth);
        const cW = parts.length >= 3 ? compileExpression(parts[2], nextDepth) : null;
        const cH = parts.length >= 4 ? compileExpression(parts[3], nextDepth) : null;
        return (scope) => {
          const a = cA(scope);
          const b = cB(scope);
          const w = cW ? Number(cW(scope)) : 20;
          const h = cH ? Number(cH(scope)) : w;
          if (a && b && typeof a === "object" && typeof b === "object" && a.x !== void 0 && a.y !== void 0 && b.x !== void 0 && b.y !== void 0) {
            return Math.abs(Number(a.x) - Number(b.x)) < w && Math.abs(Number(a.y) - Number(b.y)) < h;
          }
          return false;
        };
      }
    }
    if (trimmed.startsWith("clamp(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(6, -1), ",");
      if (parts.length === 3) {
        const cV = compileExpression(parts[0], nextDepth);
        const cMin = compileExpression(parts[1], nextDepth);
        const cMax = compileExpression(parts[2], nextDepth);
        return (scope) => {
          const v = Number(cV(scope));
          const min = Number(cMin(scope));
          const max = Number(cMax(scope));
          return Math.min(Math.max(v, min), max);
        };
      }
    }
    if (trimmed.startsWith("abs(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(4, -1), nextDepth);
      return (scope) => Math.abs(Number(cVal(scope)));
    }
    if (trimmed.startsWith("floor(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(6, -1), nextDepth);
      return (scope) => Math.floor(Number(cVal(scope)));
    }
    if (trimmed.startsWith("sqrt(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(5, -1), nextDepth);
      return (scope) => Math.sqrt(Number(cVal(scope)));
    }
    if (trimmed.startsWith("sin(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(4, -1), nextDepth);
      return (scope) => Math.sin(Number(cVal(scope)) * Math.PI / 180);
    }
    if (trimmed.startsWith("cos(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(4, -1), nextDepth);
      return (scope) => Math.cos(Number(cVal(scope)) * Math.PI / 180);
    }
    if (trimmed.startsWith("atan2(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(6, -1), ",");
      if (parts.length === 2) {
        const cDy = compileExpression(parts[0], nextDepth);
        const cDx = compileExpression(parts[1], nextDepth);
        return (scope) => {
          const dy = Number(cDy(scope));
          const dx = Number(cDx(scope));
          let deg = Math.atan2(dy, dx) * 180 / Math.PI;
          if (deg < 0) deg += 360;
          return deg;
        };
      }
    }
    if (trimmed.startsWith("distance(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(9, -1), ",");
      if (parts.length === 2) {
        const cA = compileExpression(parts[0], nextDepth);
        const cB = compileExpression(parts[1], nextDepth);
        return (scope) => {
          const a = cA(scope);
          const b = cB(scope);
          if (a && b && typeof a === "object" && typeof b === "object" && a.x !== void 0 && a.y !== void 0 && b.x !== void 0 && b.y !== void 0) {
            const dx = Number(a.x) - Number(b.x);
            const dy = Number(a.y) - Number(b.y);
            return Math.sqrt(dx * dx + dy * dy);
          }
          return 0;
        };
      } else if (parts.length === 4) {
        const cAx = compileExpression(parts[0], nextDepth);
        const cAy = compileExpression(parts[1], nextDepth);
        const cBx = compileExpression(parts[2], nextDepth);
        const cBy = compileExpression(parts[3], nextDepth);
        return (scope) => {
          const dx = Number(cAx(scope)) - Number(cBx(scope));
          const dy = Number(cAy(scope)) - Number(cBy(scope));
          return Math.sqrt(dx * dx + dy * dy);
        };
      }
    }
    if (trimmed.startsWith("angle_to(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(9, -1), ",");
      if (parts.length === 2) {
        const cA = compileExpression(parts[0], nextDepth);
        const cB = compileExpression(parts[1], nextDepth);
        return (scope) => {
          const a = cA(scope);
          const b = cB(scope);
          if (a && b && typeof a === "object" && typeof b === "object" && a.x !== void 0 && a.y !== void 0 && b.x !== void 0 && b.y !== void 0) {
            let deg = Math.atan2(Number(b.y) - Number(a.y), Number(b.x) - Number(a.x)) * 180 / Math.PI;
            if (deg < 0) deg += 360;
            return deg;
          }
          return 0;
        };
      }
    }
    if (trimmed.startsWith("slide(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(6, -1), ",");
      if (parts.length >= 4) {
        const cPx = compileExpression(parts[0], nextDepth);
        const cPy = compileExpression(parts[1], nextDepth);
        const cDx = compileExpression(parts[2], nextDepth);
        const cDy = compileExpression(parts[3], nextDepth);
        const cR = parts.length >= 5 ? compileExpression(parts[4], nextDepth) : null;
        return (scope) => {
          const px = Number(cPx(scope));
          const py = Number(cPy(scope));
          const dx = Number(cDx(scope));
          const dy = Number(cDy(scope));
          const r = cR ? Number(cR(scope)) : 0.25;
          return slide(px, py, dx, dy, r);
        };
      }
    }
    if (trimmed.startsWith("sees(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(5, -1), ",");
      if (parts.length === 2) {
        const cA = compileExpression(parts[0], nextDepth);
        const cB = compileExpression(parts[1], nextDepth);
        return (scope) => {
          const a = cA(scope);
          const b = cB(scope);
          if (!a || !b) return false;
          return sees(Number(a.x), Number(a.y), Number(b.x), Number(b.y));
        };
      } else if (parts.length >= 4) {
        const cX1 = compileExpression(parts[0], nextDepth);
        const cY1 = compileExpression(parts[1], nextDepth);
        const cX2 = compileExpression(parts[2], nextDepth);
        const cY2 = compileExpression(parts[3], nextDepth);
        return (scope) => {
          return sees(
            Number(cX1(scope)),
            Number(cY1(scope)),
            Number(cX2(scope)),
            Number(cY2(scope))
          );
        };
      }
    }
    if (trimmed.startsWith("random(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(7, -1), ",");
      if (parts.length >= 2) {
        const cMin = compileExpression(parts[0], nextDepth);
        const cMax = compileExpression(parts[1], nextDepth);
        const cSeed = parts.length >= 3 ? compileExpression(parts[2], nextDepth) : null;
        return (scope) => {
          const min = Number(cMin(scope));
          const max = Number(cMax(scope));
          return randomInt(min, max, cSeed ? Number(cSeed(scope)) : void 0);
        };
      }
    }
    for (const name of ["shuffle", "pick"]) {
      if (trimmed.startsWith(name + "(") && trimmed.endsWith(")")) {
        const parts = splitTopLevel(trimmed.slice(name.length + 1, -1), ",");
        const cValues = compileExpression(parts[0], nextDepth);
        const cSeed = parts.length > 1 ? compileExpression(parts[1], nextDepth) : null;
        return (scope) => {
          const values = cValues(scope);
          if (!Array.isArray(values)) return void 0;
          const seed = cSeed ? Number(cSeed(scope)) : randomInt(0, 2147483647);
          return name === "shuffle" ? shuffled(values, seed) : values.length ? values[randomInt(0, values.length - 1, seed)] : null;
        };
      }
    }
    if (trimmed.startsWith("min(") && trimmed.endsWith(")")) {
      const cParts = splitTopLevel(trimmed.slice(4, -1), ",").map((p) => compileExpression(p, nextDepth));
      return (scope) => Math.min(...cParts.map((fn) => Number(fn(scope))));
    }
    if (trimmed.startsWith("max(") && trimmed.endsWith(")")) {
      const cParts = splitTopLevel(trimmed.slice(4, -1), ",").map((p) => compileExpression(p, nextDepth));
      return (scope) => Math.max(...cParts.map((fn) => Number(fn(scope))));
    }
    if (trimmed.startsWith("storage.get(") || trimmed.startsWith("local_storage.get(") || trimmed.startsWith("localStorage.get(")) {
      const callEnd = trimmed.lastIndexOf(")");
      const callPart = trimmed.slice(0, callEnd + 1);
      const trailingProp = trimmed.slice(callEnd + 1).trim();
      const inner = callPart.slice(callPart.indexOf("(") + 1, -1);
      const parts = splitTopLevel(inner, ",");
      const cKey = compileExpression(parts[0], nextDepth);
      const cDef = parts.length > 1 ? compileExpression(parts[1], nextDepth) : null;
      return (scope) => {
        const key = String(cKey(scope));
        const defVal = cDef ? cDef(scope) : null;
        const item = getStorageItem(key);
        let result = defVal;
        if (item !== null) {
          try {
            result = JSON.parse(item);
          } catch {
            result = item;
          }
        }
        if (trailingProp.startsWith(".") && result && typeof result === "object") {
          const prop = trailingProp.slice(1);
          return result[prop];
        }
        return result;
      };
    }
    if (trimmed.startsWith("storage.has(") || trimmed.startsWith("local_storage.has(") || trimmed.startsWith("localStorage.has(")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const cKey = compileExpression(inner, nextDepth);
      return (scope) => hasStorageItem(String(cKey(scope)));
    }
    const helperCall = parseHelperCall(trimmed);
    if (helperCall) {
      const cArgs = helperCall.args.map((arg) => compileExpression(arg, nextDepth));
      const name = helperCall.name;
      return (scope) => callHelper(name, cArgs.map((fn) => fn(scope)), scope, nextDepth);
    }
    const methodMatch = trimmed.match(
      /^(.+?)\.(any|mask|filter|find|max)(?:\((.*)\)|\s+(.+?))(?:\.(length))?$/
    );
    if (methodMatch) {
      const [, receiver, method, parenArgs, spaceArgs, trailingProp] = methodMatch;
      const argsStr = (parenArgs !== void 0 ? parenArgs : spaceArgs).trim();
      const cReceiver = compileExpression(receiver, nextDepth);
      if (method === "mask") {
        const cArg = compileExpression(argsStr, nextDepth);
        return (scope) => {
          const collection = cReceiver(scope);
          if (!Array.isArray(collection)) return void 0;
          const player = valueToString(cArg(scope));
          return collection.reduce(
            (acc, cell, i) => {
              return valueToString(cell) === player ? acc | 1 << i : acc;
            },
            0
          );
        };
      }
      const arrowMatch = argsStr.match(/^(\w+)\s*=>\s*(.+)$/);
      const [paramName, predExpr] = arrowMatch ? [arrowMatch[1], arrowMatch[2]] : ["it", argsStr];
      const cPred = compileExpression(predExpr, nextDepth);
      return (scope) => {
        const collection = cReceiver(scope);
        if (!Array.isArray(collection)) return void 0;
        let result = void 0;
        if (method === "any") {
          result = collection.some((item) => {
            const innerScope = Object.assign({}, scope, { [paramName]: item });
            return Boolean(cPred(innerScope));
          });
        } else if (method === "filter") {
          result = collection.filter((item) => {
            const innerScope = Object.assign({}, scope, { [paramName]: item });
            return Boolean(cPred(innerScope));
          });
        } else if (method === "find") {
          result = collection.find((item) => {
            const innerScope = Object.assign({}, scope, { [paramName]: item });
            return Boolean(cPred(innerScope));
          });
        } else if (method === "max") {
          result = collection.reduce(
            (max, item) => {
              const innerScope = Object.assign({}, scope, { [paramName]: item });
              const val = cPred(innerScope);
              return max === void 0 || val > max ? val : max;
            },
            void 0
          );
        }
        if (trailingProp === "length" && result !== void 0 && result.length !== void 0) {
          return result.length;
        }
        return result;
      };
    }
    if (includesTopLevel(trimmed, " ? ")) {
      const parts = splitTopLevel(trimmed, " ? ");
      const condition = parts[0];
      const rest = parts.slice(1).join(" ? ");
      if (includesTopLevel(rest, " : ")) {
        const colonParts = splitTopLevel(rest, " : ");
        const cCond = compileExpression(condition, nextDepth);
        const cTrue = compileExpression(colonParts[0], nextDepth);
        const cFalse = compileExpression(colonParts.slice(1).join(" : "), nextDepth);
        return (scope) => Boolean(cCond(scope)) ? cTrue(scope) : cFalse(scope);
      }
    }
    if (includesTopLevel(trimmed, " ?? ")) {
      const parts = splitTopLevel(trimmed, " ?? ");
      const leftRaw = parts[0].trim();
      const cLeft = compileExpression(leftRaw, nextDepth);
      const cRight = compileExpression(parts.slice(1).join(" ?? "), nextDepth);
      return (scope) => {
        let left = cLeft(scope);
        if (typeof left === "string" && left === leftRaw && resolvePath(leftRaw, scope) === void 0 && tryParseLiteral(leftRaw, scope) === void 0) {
          left = void 0;
        }
        if (left !== void 0 && left !== null && left !== "") {
          return left;
        }
        return cRight(scope);
      };
    }
    if (includesTopLevel(trimmed, " or ")) {
      const cParts = splitTopLevel(trimmed, " or ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.some((fn) => Boolean(fn(scope)));
    }
    if (includesTopLevel(trimmed, " || ")) {
      const cParts = splitTopLevel(trimmed, " || ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.some((fn) => Boolean(fn(scope)));
    }
    if (includesTopLevel(trimmed, " and ")) {
      const cParts = splitTopLevel(trimmed, " and ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.every((fn) => Boolean(fn(scope)));
    }
    if (includesTopLevel(trimmed, " && ")) {
      const cParts = splitTopLevel(trimmed, " && ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.every((fn) => Boolean(fn(scope)));
    }
    if (includesTopLevel(trimmed, " != ")) {
      const [left, right] = splitTopLevel(trimmed, " != ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => valueToString(cL(scope)) !== valueToString(cR(scope));
    }
    if (includesTopLevel(trimmed, " == ")) {
      const [left, right] = splitTopLevel(trimmed, " == ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => valueToString(cL(scope)) === valueToString(cR(scope));
    }
    if (includesTopLevel(trimmed, " >= ")) {
      const [left, right] = splitTopLevel(trimmed, " >= ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) >= cR(scope);
    }
    if (includesTopLevel(trimmed, " <= ")) {
      const [left, right] = splitTopLevel(trimmed, " <= ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) <= cR(scope);
    }
    if (includesTopLevel(trimmed, " > ")) {
      const [left, right] = splitTopLevel(trimmed, " > ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) > cR(scope);
    }
    if (includesTopLevel(trimmed, " < ")) {
      const [left, right] = splitTopLevel(trimmed, " < ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) < cR(scope);
    }
    if (includesTopLevel(trimmed, " + ")) {
      const cParts = splitTopLevel(trimmed, " + ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.reduce((acc, fn, index2) => {
        const value = fn(scope);
        if (index2 === 0) return value;
        if (typeof acc === "number" && typeof value === "number") return acc + value;
        return `${valueToString(acc)}${valueToString(value)}`;
      }, void 0);
    }
    if (includesTopLevel(trimmed, " - ")) {
      const parts = splitTopLevel(trimmed, " - ");
      const cFirst = compileExpression(parts[0], nextDepth);
      const cRest = parts.slice(1).map((p) => compileExpression(p, nextDepth));
      return (scope) => {
        const first = Number(cFirst(scope));
        return cRest.reduce((acc, fn) => acc - Number(fn(scope)), first);
      };
    }
    if (includesTopLevel(trimmed, " * ")) {
      const cParts = splitTopLevel(trimmed, " * ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.reduce((acc, fn, idx) => {
        const val = Number(fn(scope));
        return idx === 0 ? val : acc * val;
      }, 1);
    }
    if (includesTopLevel(trimmed, " / ")) {
      const parts = splitTopLevel(trimmed, " / ");
      const cFirst = compileExpression(parts[0], nextDepth);
      const cRest = parts.slice(1).map((p) => compileExpression(p, nextDepth));
      return (scope) => {
        const first = Number(cFirst(scope));
        return cRest.reduce((acc, fn) => acc / Number(fn(scope)), first);
      };
    }
    if (includesTopLevel(trimmed, " % ")) {
      const parts = splitTopLevel(trimmed, " % ");
      const cFirst = compileExpression(parts[0], nextDepth);
      const cRest = parts.slice(1).map((p) => compileExpression(p, nextDepth));
      return (scope) => {
        const first = Number(cFirst(scope));
        return cRest.reduce((acc, fn) => acc % Number(fn(scope)), first);
      };
    }
    if (trimmed.startsWith("swap ")) {
      const tokens = trimmed.split(/\s+/);
      const cCurr = compileExpression(tokens[1], nextDepth);
      const cL = compileExpression(tokens[2], nextDepth);
      const cR = compileExpression(tokens[3], nextDepth);
      return (scope) => {
        const current = valueToString(cCurr(scope));
        const left = valueToString(cL(scope));
        const right = valueToString(cR(scope));
        return current === left ? right : left;
      };
    }
    if (trimmed.startsWith("full ")) {
      const cColl = compileExpression(trimmed.slice(5), nextDepth);
      return (scope) => {
        const collection = cColl(scope);
        return Array.isArray(collection) && collection.every((item) => valueToString(item) !== "");
      };
    }
    if (includesTopLevel(trimmed, " & ")) {
      const [left, right] = splitTopLevel(trimmed, " & ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) & cR(scope);
    }
    if (trimmed.startsWith("-") && !trimmed.startsWith("--")) {
      const operand = trimmed.slice(1).trim();
      if (operand) {
        const cOp = compileExpression(operand, nextDepth);
        return (scope) => {
          const val = cOp(scope);
          if (typeof val === "number") return -val;
          const num = Number(val);
          if (!Number.isNaN(num)) return -num;
          return void 0;
        };
      }
    }
    return compileResolveValue(trimmed);
  }
  function evaluateExpression(expr, scope, depth) {
    if ((depth || 0) > MAX_DEPTH) return void 0;
    const trimmed = String(expr || "").trim();
    if (!trimmed) return void 0;
    let compiled = exprCache.get(trimmed);
    if (!compiled) {
      compiled = compileExpression(trimmed, depth || 0);
      if (exprCache.size >= MAX_CACHE_SIZE) {
        exprCache.clear();
      }
      exprCache.set(trimmed, compiled);
    }
    return compiled(scope);
  }

  // src/effects.ts
  function downloadText(filename, content) {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function copyText(text) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {
      });
    }
  }

  // src/builtins/command.ts
  var STOP = "stop";
  var NO_ACTION = "do_not_action";

  // src/builtins/log.ts
  function handleLog(statement, locals) {
    if (!statement.startsWith("log ")) return void 0;
    const msg = interpolate(statement.slice(4), buildScope(locals));
    console.log(msg);
    return msg;
  }
  var logCommand = {
    prefix: ["log"],
    signature: "log <expression>",
    description: "Logs the interpolated expression to the console",
    handler: handleLog
  };

  // src/builtins/delete.ts
  function handleDelete(statement, locals) {
    if (!statement.startsWith("delete ")) return void 0;
    const path = statement.slice(7).trim();
    deletePath(path, locals);
    return true;
  }
  var deleteCommand = {
    prefix: ["delete", "del", "rm", "remove", "rmv", "destroy"],
    signature: "delete <path>",
    description: "Deletes a value at the given path from locals",
    handler: handleDelete
  };

  // src/builtins/invert.ts
  function handleInvert(statement, locals) {
    if (!statement.startsWith("invert ")) return void 0;
    const path = statement.slice(7).trim();
    const current = Boolean(evaluateExpression(path, buildScope(locals)));
    assignPath(path, !current, locals);
    return !current;
  }
  var invertCommand = {
    prefix: ["invert"],
    signature: "invert <path>",
    description: "Inverts a boolean value at the given path",
    handler: handleInvert
  };

  // src/builtins/increment.ts
  function handleIncrement(statement, locals) {
    if (statement.startsWith("increment") || statement.startsWith("inc")) {
      const trimmed = statement.replace("increment ", "").replace("inc ", "");
      const tokens = trimmed.split(" ");
      if (tokens.length != 3) return void 0;
      if (tokens[1] != "by") return void 0;
      const path2 = tokens[0];
      const valueExpression = tokens[2];
      const value = evaluateExpression(valueExpression, buildScope(locals));
      return incrementBy(path2, Number(value), locals);
    }
    if (!statement.endsWith("++")) return void 0;
    const path = statement.slice(0, -2).trim();
    return incrementBy(path, 1, locals);
  }
  function incrementBy(path, value, locals) {
    let evaled = evaluateExpression(path, buildScope(locals));
    if (evaled === path) evaled = 0;
    let current = Number(evaled);
    if (isNaN(current)) current = 0;
    const newValue = current + value;
    assignPath(path, newValue, locals);
    return newValue;
  }
  var incrementCommand = {
    prefix: ["increment", "inc"],
    postfix: ["++"],
    signature: "<path>++ | increment <path> by <number> | inc <path> by <number>",
    description: "Increments a numeric value at the given path",
    handler: handleIncrement
  };

  // src/builtins/decrement.ts
  function handleDecrement(statement, locals) {
    if (statement.startsWith("decrement") || statement.startsWith("dec")) {
      const trimmed = statement.replace("decrement ", "").replace("dec ", "");
      const tokens = trimmed.split(" ");
      if (tokens.length != 3) return void 0;
      if (tokens[1] != "by") return void 0;
      const path2 = tokens[0];
      const valueExpression = tokens[2];
      const value = evaluateExpression(valueExpression, buildScope(locals));
      return decrementBy(path2, Number(value), locals);
    }
    if (!statement.endsWith("--")) return void 0;
    const path = statement.slice(0, -2).trim();
    return decrementBy(path, 1, locals);
  }
  function decrementBy(path, value, locals) {
    let evaled = evaluateExpression(path, buildScope(locals));
    if (evaled === path) evaled = 0;
    let current = Number(evaled);
    if (isNaN(current)) current = 0;
    const newValue = current - value;
    assignPath(path, newValue, locals);
    return newValue;
  }
  var decrementCommand = {
    postfix: ["--"],
    prefix: ["decrement", "dec"],
    signature: "<path>-- or decrement <path> by <value> or dec <path> by <value>",
    description: "Decrements a numeric value at the given path",
    handler: handleDecrement
  };

  // src/builtins/swap.ts
  function handleSwap(statement, locals) {
    if (!statement.startsWith("swap ")) return void 0;
    const tokens = statement.split(/\s+/);
    if (tokens.length < 3) return void 0;
    const targetPath = tokens[1];
    if (tokens.length === 3) {
      const val = evaluateExpression(tokens[2], buildScope(locals));
      assignPath(targetPath, val, locals);
      return true;
    }
    const aExpr = tokens[2];
    const bExpr = tokens[3];
    const aValue = evaluateExpression(aExpr, buildScope(locals));
    const bValue = evaluateExpression(bExpr, buildScope(locals));
    const current = evaluateExpression(targetPath, buildScope(locals));
    if (current === aValue) {
      assignPath(targetPath, bValue, locals);
    } else {
      assignPath(targetPath, aValue, locals);
    }
    return true;
  }
  var swapCommand = {
    prefix: ["swap"],
    signature: "swap <path> <A> <B>",
    description: "Swaps the values of A and B at path",
    handler: handleSwap
  };

  // src/builtins/stop.ts
  function handleStop(statement, locals) {
    if (statement.trim() !== STOP) return void 0;
    return STOP;
  }
  var stopCommand = {
    prefix: [STOP],
    signature: STOP,
    description: "Stops execution of the current script",
    handler: handleStop
  };

  // src/builtins/push.ts
  function handlePush(statement, locals) {
    if (!statement.startsWith("push ")) return void 0;
    const tokens = statement.split(/\s+/);
    if (tokens.length < 3) return void 0;
    const targetPath = tokens[1];
    const valueExpr = tokens.slice(2).join(" ");
    const collection = evaluateExpression(targetPath, buildScope(locals));
    if (!Array.isArray(collection)) return void 0;
    const value = evaluateExpression(valueExpr, buildScope(locals));
    collection.push(value);
    assignPath(targetPath, collection, locals);
    return true;
  }
  var pushCommand = {
    prefix: ["push"],
    signature: "push <path> <valueExpression>",
    description: "Pushes a value onto the array at the given path",
    handler: handlePush
  };

  // src/builtins/max.ts
  function handleMax(statement, locals) {
    if (!statement.startsWith("max ")) return void 0;
    const rest = statement.slice(4).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr) || arr.length === 0) return void 0;
    const maxVal = Math.max(...arr.map((v) => Number(v)));
    if (varPart) {
      assignPath(varPart, maxVal, locals);
    }
    return maxVal;
  }
  var maxCommand = {
    prefix: ["max"],
    signature: "max <arrayPath> as <var>",
    description: "Finds maximum numeric value in an array",
    handler: handleMax
  };

  // src/builtins/min.ts
  function handleMin(statement, locals) {
    if (!statement.startsWith("min ")) return void 0;
    const rest = statement.slice(4).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr) || arr.length === 0) return void 0;
    const minVal = Math.min(...arr.map((v) => Number(v)));
    if (varPart) {
      assignPath(varPart, minVal, locals);
    }
    return minVal;
  }
  var minCommand = {
    prefix: ["min"],
    signature: "min <arrayPath> as <var>",
    description: "Finds minimum numeric value in an array",
    handler: handleMin
  };

  // src/builtins/delay.ts
  function handleDelay(statement, locals) {
    if (!statement.startsWith("delay ")) return void 0;
    const rest = statement.slice(6).trim();
    const msMatch = rest.match(/^([0-9]*\.?[0-9]+)\s*(ms|s)?$/i);
    if (!msMatch) return void 0;
    let ms = Number(msMatch[1]);
    const unit = msMatch[2] ? msMatch[2].toLowerCase() : "ms";
    if (unit === "s") ms *= 1e3;
    const start = Date.now();
    while (Date.now() - start < ms) {
    }
    return true;
  }
  var delayCommand = {
    prefix: ["delay"],
    signature: "delay <duration>ms",
    description: "Pauses execution for a given number of milliseconds",
    handler: handleDelay
  };

  // src/builtins/unique.ts
  function handleUnique(statement, locals) {
    if (!statement.startsWith("unique ")) return void 0;
    const rest = statement.slice(7).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr)) return void 0;
    const uniq = Array.from(new Set(arr));
    if (varPart) {
      assignPath(varPart, uniq, locals);
    }
    return uniq;
  }
  var uniqueCommand = {
    prefix: ["unique"],
    signature: "unique <arrayPath> as <var>",
    description: "Removes duplicate entries from an array",
    handler: handleUnique
  };

  // src/builtins/sum.ts
  function handleSum(statement, locals) {
    if (!statement.startsWith("sum ")) return void 0;
    const rest = statement.slice(4).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr)) return void 0;
    const total = arr.reduce((acc, cur) => acc + Number(cur), 0);
    if (varPart) {
      assignPath(varPart, total, locals);
    }
    return total;
  }
  var sumCommand = {
    prefix: ["sum"],
    signature: "sum <arrayPath> as <var>",
    description: "Sums numeric values in an array and stores the result",
    handler: handleSum
  };

  // src/builtins/randomize.ts
  function handleRandomize(statement, locals) {
    if (!statement.startsWith("randomize ")) return void 0;
    const rest = statement.slice(9).trim();
    const parts = rest.split(/\s+/);
    if (parts.length >= 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
      const min = Number(parts[0]);
      const max = Number(parts[1]);
      let varName;
      if (parts.length > 3 && parts[2] === "as") {
        varName = parts[3];
      }
      const rand = Math.floor(Math.random() * (max - min + 1)) + min;
      if (varName) {
        assignPath(varName, rand, locals);
      }
      return rand;
    }
    const asIndex = parts.indexOf("as");
    if (parts.length >= 1) {
      const pathExpr = parts.slice(0, asIndex).join(" ");
      const varName = parts[asIndex + 1];
      const arr = evaluateExpression(pathExpr, buildScope(locals));
      if (!Array.isArray(arr)) return void 0;
      const shuffled2 = arr.slice();
      for (let i = shuffled2.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled2[i], shuffled2[j]] = [shuffled2[j], shuffled2[i]];
      }
      if (varName) {
        assignPath(varName, shuffled2, locals);
      }
      return shuffled2;
    }
    return void 0;
  }
  var randomizeCommand = {
    prefix: ["randomize"],
    signature: "randomize <min> <max> as <var> | randomize <arrayPath> as <var>",
    description: "Generates a random number in a range or shuffles an array",
    handler: handleRandomize
  };

  // src/builtins/count.ts
  function handleCount(statement, locals) {
    if (!statement.startsWith("count ")) return void 0;
    const rest = statement.slice(6).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const value = evaluateExpression(pathPart, buildScope(locals));
    let count;
    if (Array.isArray(value)) {
      count = value.length;
    } else if (value && typeof value === "object") {
      count = Object.keys(value).length;
    } else {
      count = 0;
    }
    if (varPart) {
      assignPath(varPart, count, locals);
    }
    return count;
  }
  var countCommand = {
    prefix: ["count"],
    signature: "count <path> as <var>",
    description: "Stores the length of an array or object keys count into a variable",
    handler: handleCount
  };

  // src/builtins/flatten.ts
  function handleFlatten(statement, locals) {
    if (!statement.startsWith("flatten ")) return void 0;
    const rest = statement.slice(8).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const value = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(value)) return void 0;
    const flatten = (arr) => {
      const out = [];
      for (const item of arr) {
        if (Array.isArray(item)) {
          out.push(...flatten(item));
        } else {
          out.push(item);
        }
      }
      return out;
    };
    const flat = flatten(value);
    if (varPart) {
      assignPath(varPart, flat, locals);
    }
    return flat;
  }
  var flattenCommand = {
    prefix: ["flatten"],
    signature: "flatten <arrayPath> as <var>",
    description: "Flattens a nested array into a one\u2011dimensional array",
    handler: handleFlatten
  };

  // src/builtins/avg.ts
  function handleAvg(statement, locals) {
    if (!statement.startsWith("avg ")) return void 0;
    const rest = statement.slice(4).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr) || arr.length === 0) return void 0;
    const total = arr.reduce((acc, cur) => acc + Number(cur), 0);
    const avg = total / arr.length;
    if (varPart) {
      assignPath(varPart, avg, locals);
    }
    return avg;
  }
  var avgCommand = {
    prefix: ["avg"],
    signature: "avg <arrayPath> as <var>",
    description: "Computes average of numeric array values",
    handler: handleAvg
  };

  // src/builtins/clone.ts
  function handleClone(statement, locals) {
    if (!statement.startsWith("clone ")) return void 0;
    const rest = statement.slice(6).trim();
    const match = rest.match(/^(.*?)\s+to\s+(.*)$/);
    let src;
    let dest = null;
    if (!match) {
      src = rest;
    } else {
      src = match[1].trim();
      dest = match[2].trim();
    }
    if (!src) return void 0;
    const value = evaluateExpression(src, buildScope(locals));
    const copy = JSON.parse(JSON.stringify(value));
    if (dest) {
      assignPath(dest, copy, locals);
    }
    return copy;
  }
  var cloneCommand = {
    prefix: ["clone"],
    signature: "clone <srcPath> to <destPath>",
    description: "Deep\u2011copies a value from source to destination",
    handler: handleClone
  };

  // src/builtins/timer.ts
  function handleStartTimer(statement, _locals) {
    if (!statement.startsWith("start-timer ") && !statement.startsWith("interval ")) return void 0;
    const rest = statement.startsWith("start-timer ") ? statement.slice(12).trim() : statement.slice(9).trim();
    const match = rest.match(/^([A-Za-z_][\w-]*)\s*([0-9]*\.?[0-9]+)\s*(ms|s)?$/i);
    if (!match) return void 0;
    const action = match[1];
    let ms = Number(match[2]);
    if (match[3]?.toLowerCase() === "s") ms *= 1e3;
    const app = ctx().app;
    if (app.startTimer) {
      app.startTimer(action, ms);
    }
    return true;
  }
  function handleStopTimer(statement, _locals) {
    const trimmed = statement.trim();
    if (trimmed !== "stop-timer" && trimmed !== "clear-timer" && trimmed !== "clear-interval") return void 0;
    const app = ctx().app;
    if (app.stopTimer) {
      app.stopTimer();
    }
    return true;
  }
  var startTimerCommand = {
    prefix: ["start-timer", "interval"],
    signature: "start-timer <action> <duration>ms",
    description: "Starts a periodic timer calling the named action",
    handler: handleStartTimer
  };
  var stopTimerCommand = {
    prefix: ["stop-timer", "clear-timer", "clear-interval"],
    signature: "stop-timer",
    description: "Stops the active periodic timer",
    handler: handleStopTimer
  };

  // src/builtins/index.ts
  var postfixMap = {};
  var prefixMap = {};
  var infixMap = {};
  function registerCommand(cmd) {
    for (const name of cmd.prefix || []) {
      prefixMap[name] = cmd;
    }
    for (const name of cmd.postfix || []) {
      postfixMap[name] = cmd;
    }
    for (const name of cmd.infix || []) {
      infixMap[name] = cmd;
    }
  }
  registerCommand(logCommand);
  registerCommand(deleteCommand);
  registerCommand(invertCommand);
  registerCommand(incrementCommand);
  registerCommand(decrementCommand);
  registerCommand(swapCommand);
  registerCommand(stopCommand);
  registerCommand(pushCommand);
  registerCommand(maxCommand);
  registerCommand(minCommand);
  registerCommand(delayCommand);
  registerCommand(uniqueCommand);
  registerCommand(sumCommand);
  registerCommand(randomizeCommand);
  registerCommand(countCommand);
  registerCommand(flattenCommand);
  registerCommand(avgCommand);
  registerCommand(cloneCommand);
  registerCommand(startTimerCommand);
  registerCommand(stopTimerCommand);
  function handleWhen(statement, locals) {
    const whenIndex = statement.lastIndexOf(" when ");
    if (whenIndex === -1) return statement;
    const conditionExpr = statement.slice(whenIndex + 6).trim();
    const commandPart = statement.slice(0, whenIndex).trim();
    const condResult = Boolean(evaluateExpression(conditionExpr, buildScope(locals)));
    return condResult ? commandPart : null;
  }
  function handleBuiltin(statement, locals) {
    const cmd = getPrefixCmd(statement, locals) || getInfixCmd(statement, locals) || getPostfixCmd(statement, locals);
    if (!cmd) return void 0;
    const processed = handleWhen(statement, locals);
    if (processed === null) return NO_ACTION;
    const result = cmd.handler(processed, locals);
    return result !== void 0 ? result : false;
  }
  function getPrefixCmd(statement, locals) {
    const trimmed = statement.trim();
    const firstSpace = trimmed.indexOf(" ");
    const cmdName = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
    return prefixMap[cmdName];
  }
  function getInfixCmd(statement, locals) {
    const whenIdx = statement.lastIndexOf(" when ");
    const everythingBeforeWhen = whenIdx !== -1 ? statement.slice(0, whenIdx) : statement;
    const parts = everythingBeforeWhen.split(" ");
    for (const part of parts) {
      if (infixMap[part]) {
        return infixMap[part];
      }
    }
    return void 0;
  }
  function getPostfixCmd(statement, locals) {
    const whenIdx = statement.lastIndexOf(" when ");
    const everythingBeforeWhen = whenIdx !== -1 ? statement.slice(0, whenIdx).trim() : statement.trim();
    for (const cmd of Object.values(postfixMap)) {
      if (cmd.postfix?.some((cmd2) => everythingBeforeWhen.endsWith(cmd2))) {
        return cmd;
      }
    }
    return void 0;
  }

  // src/audio_sync.ts
  var AudioSyncEngine = class {
    constructor() {
      this.scheduledNotes = [];
      this.listeners = /* @__PURE__ */ new Set();
      this.animFrameId = null;
      this.isPlaying = false;
      this.isPaused = false;
      this.activeTrackName = null;
      this.tempoBpm = 128;
      this.timeSignature = "4/4";
      this.totalBars = 4;
      this.totalBeats = 16;
      this.musicStartTime = 0;
      this.syncPage = true;
      this.getAudioCtx = null;
      this.lastActiveStepId = -1;
      this.lastActiveBar = -1;
      this.channelStepIds = {};
    }
    /**
     * Configure the audio context provider and track metadata.
     */
    configure(options) {
      this.getAudioCtx = options.getAudioContext;
      this.syncPage = options.syncPage ?? true;
    }
    /**
     * Subscribe a callback to audio sync updates.
     */
    subscribe(listener) {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }
    /**
     * Record a scheduled note with its precise Web Audio hardware timestamp.
     */
    enqueueNote(note) {
      this.scheduledNotes.push(note);
    }
    /**
     * Notify sync engine that playback has started or resumed.
     */
    onPlay(params) {
      this.isPlaying = true;
      this.isPaused = false;
      this.activeTrackName = params.track;
      this.tempoBpm = params.tempo;
      this.timeSignature = params.timeSignature;
      this.totalBars = params.totalBars;
      this.totalBeats = params.totalBeats;
      this.musicStartTime = params.startTime;
      this.scheduledNotes = [];
      this.lastActiveStepId = -1;
      this.lastActiveBar = -1;
      this.channelStepIds = {};
      this.startLoop();
    }
    /**
     * Notify sync engine that playback has paused.
     */
    onPause() {
      this.isPaused = true;
      this.stopLoop();
      this.broadcastSnapshot();
    }
    /**
     * Notify sync engine that playback has stopped.
     */
    onStop() {
      this.isPlaying = false;
      this.isPaused = false;
      this.activeTrackName = null;
      this.scheduledNotes = [];
      this.channelStepIds = {};
      this.lastActiveStepId = -1;
      this.lastActiveBar = -1;
      this.stopLoop();
      this.clearVisuals();
      this.broadcastSnapshot();
    }
    /**
     * Get current snapshot of the audio sync state.
     */
    getSnapshot() {
      const ctx2 = this.getAudioCtx ? this.getAudioCtx() : null;
      const outputLatency = ctx2 ? (ctx2.outputLatency || 0) + (ctx2.baseLatency || 0) : 0;
      const visualTime = ctx2 ? Math.max(0, ctx2.currentTime - outputLatency) : 0;
      const secondsPerBeat = 60 / Math.max(20, this.tempoBpm);
      const elapsedSec = this.isPlaying && !this.isPaused ? Math.max(0, visualTime - this.musicStartTime) : 0;
      const beatsPerBar = this.timeSignature.startsWith("3/") ? 3 : 4;
      const currentBeat = this.totalBeats > 0 ? elapsedSec / secondsPerBeat % this.totalBeats : 0;
      const currentBar = Math.min(this.totalBars, Math.floor(currentBeat / beatsPerBar) + 1);
      const progressPercent = this.totalBeats > 0 ? currentBeat / this.totalBeats * 100 : 0;
      return {
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        track: this.activeTrackName,
        tempo: this.tempoBpm,
        timeSignature: this.timeSignature,
        currentBeat,
        currentBar,
        totalBars: this.totalBars,
        totalBeats: this.totalBeats,
        progressPercent,
        activeStepId: this.lastActiveStepId,
        activeBar: currentBar,
        channelStepIds: { ...this.channelStepIds }
      };
    }
    startLoop() {
      if (typeof window === "undefined") return;
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      const tick = () => {
        if (!this.isPlaying || this.isPaused) {
          return;
        }
        this.updateFrame();
        this.animFrameId = requestAnimationFrame(tick);
      };
      this.animFrameId = requestAnimationFrame(tick);
    }
    stopLoop() {
      if (typeof window === "undefined") return;
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
    }
    updateFrame() {
      const ctx2 = this.getAudioCtx ? this.getAudioCtx() : null;
      if (!ctx2) return;
      const outputLatency = (ctx2.outputLatency || 0) + (ctx2.baseLatency || 0);
      const visualTime = ctx2.currentTime - outputLatency;
      this.scheduledNotes = this.scheduledNotes.filter((n) => n.endTime >= visualTime - 0.5);
      const activeVoice = this.getActiveVoice();
      let currentStepId = -1;
      this.channelStepIds = {};
      for (const note of this.scheduledNotes) {
        if (visualTime >= note.startTime && visualTime < note.endTime) {
          this.channelStepIds[note.channel] = note.stepId;
          if (note.channel === activeVoice) {
            currentStepId = note.stepId;
          }
        }
      }
      const secondsPerBeat = 60 / Math.max(20, this.tempoBpm);
      const elapsedSec = Math.max(0, visualTime - this.musicStartTime);
      const beatsPerBar = this.timeSignature.startsWith("3/") ? 3 : 4;
      const currentBeat = this.totalBeats > 0 ? elapsedSec / secondsPerBeat % this.totalBeats : elapsedSec / secondsPerBeat;
      const currentBar = Math.min(this.totalBars, Math.floor(currentBeat / beatsPerBar) + 1);
      const progressPercent = this.totalBeats > 0 ? currentBeat / this.totalBeats * 100 : 0;
      if (this.syncPage && typeof document !== "undefined" && document.documentElement) {
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty("--music-beat", currentBeat.toFixed(3));
        rootStyle.setProperty("--music-bar", String(currentBar));
        rootStyle.setProperty("--music-progress", `${progressPercent.toFixed(2)}%`);
        rootStyle.setProperty("--music-seq-left", `${Math.round(currentBeat * 120)}px`);
        rootStyle.setProperty("--music-playing", this.isPlaying ? "1" : "0");
      }
      if (this.syncPage) this.updateDeclarativeDom(currentBeat, progressPercent, currentBar, currentStepId);
      if (currentStepId !== this.lastActiveStepId || currentBar !== this.lastActiveBar) {
        this.lastActiveStepId = currentStepId;
        this.lastActiveBar = currentBar;
        try {
          const appState = this.syncPage ? window?.__RuneWeb?.ctx?.()?.app?.state : null;
          if (appState) {
            appState.playback_step_id = currentStepId;
            appState.playback_bar = currentBar;
            appState.playback_beat = currentBeat;
            appState.playback_progress = progressPercent;
            appState.playback_playing = this.isPlaying;
          }
        } catch (_) {
        }
        this.broadcastSnapshot();
      }
    }
    updateDeclarativeDom(currentBeat, progressPercent, currentBar, currentStepId) {
      if (typeof document === "undefined") return;
      const progressPlayheads = document.querySelectorAll(
        '[data-sync-playhead="progress"], #ruler-playhead'
      );
      progressPlayheads.forEach((el) => {
        el.style.left = `${Math.min(100, Math.max(0, progressPercent))}%`;
        el.style.display = "block";
      });
      const beatPlayheads = document.querySelectorAll(
        '[data-sync-playhead="beat"], #seq-playhead'
      );
      const pxLeft = Math.round(currentBeat * 120);
      beatPlayheads.forEach((el) => {
        el.style.left = `${pxLeft}px`;
        el.style.display = "block";
      });
      const scrollContainers = document.querySelectorAll(
        '[data-sync-scroll="beat"], .matrix-timeline-scroll'
      );
      scrollContainers.forEach((container) => {
        if (pxLeft > container.scrollLeft + container.clientWidth - 140) {
          container.scrollLeft = pxLeft - 60;
        } else if (pxLeft < container.scrollLeft) {
          container.scrollLeft = Math.max(0, pxLeft - 60);
        }
      });
      if (currentBar !== this.lastActiveBar) {
        document.querySelectorAll(".playing-bar, [data-sync-playing-bar]").forEach((el) => {
          el.classList.remove("playing-bar");
          el.removeAttribute("data-sync-playing-bar");
        });
        document.querySelectorAll(
          `[data-sync-bar="${currentBar}"], .ruler-bar-item[data-bar-num="${currentBar}"]`
        ).forEach((el) => {
          el.classList.add("playing-bar");
          el.setAttribute("data-sync-playing-bar", "true");
        });
      }
      if (currentStepId !== this.lastActiveStepId) {
        document.querySelectorAll(".playing-step-now, [data-sync-playing-step]").forEach((el) => {
          el.classList.remove("playing-step-now");
          el.removeAttribute("data-sync-playing-step");
        });
        if (currentStepId >= 0) {
          document.querySelectorAll(
            `[data-sync-step="${currentStepId}"], .step-chip[data-step-idx="${currentStepId}"], .matrix-note-block[data-step-idx="${currentStepId}"]`
          ).forEach((el) => {
            el.classList.add("playing-step-now");
            el.setAttribute("data-sync-playing-step", "true");
          });
        }
      }
    }
    clearVisuals() {
      if (!this.syncPage || typeof document === "undefined") return;
      if (document.documentElement) {
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty("--music-beat", "0");
        rootStyle.setProperty("--music-bar", "1");
        rootStyle.setProperty("--music-progress", "0%");
        rootStyle.setProperty("--music-seq-left", "0px");
        rootStyle.setProperty("--music-playing", "0");
      }
      document.querySelectorAll(".playing-bar, [data-sync-playing-bar]").forEach((el) => {
        el.classList.remove("playing-bar");
        el.removeAttribute("data-sync-playing-bar");
      });
      document.querySelectorAll(".playing-step-now, [data-sync-playing-step]").forEach((el) => {
        el.classList.remove("playing-step-now");
        el.removeAttribute("data-sync-playing-step");
      });
      const rulerPlayhead = document.getElementById("ruler-playhead");
      if (rulerPlayhead) {
        rulerPlayhead.style.left = "0%";
      }
      const seqPlayhead = document.getElementById("seq-playhead");
      if (seqPlayhead) {
        seqPlayhead.style.left = "0px";
      }
      try {
        const appState = window?.__RuneWeb?.ctx?.()?.app?.state;
        if (appState) {
          appState.playback_step_id = -1;
          appState.playback_bar = 1;
          appState.playback_beat = 0;
          appState.playback_progress = 0;
          appState.playback_playing = false;
        }
      } catch (_) {
      }
    }
    broadcastSnapshot() {
      const snapshot = this.getSnapshot();
      for (const listener of this.listeners) {
        try {
          listener(snapshot);
        } catch (err) {
          console.error("[AudioSyncEngine] Listener error:", err);
        }
      }
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(new CustomEvent("rune:music-sync", { detail: snapshot }));
        } catch (_) {
        }
      }
    }
    getActiveVoice() {
      if (!this.syncPage) return "lead";
      try {
        const voice = window?.__RuneWeb?.ctx?.()?.app?.state?.active_voice;
        return String(voice || "lead");
      } catch {
        return "lead";
      }
    }
  };
  var audioSync = new AudioSyncEngine();

  // src/music_arrangement.ts
  function compileMusicArrangement(def, parse) {
    if (!Object.keys(def.sections ?? {}).length && !def.arrangement?.length) return null;
    const parts = def.sections ?? {}, form = def.arrangement ?? [];
    if (!Object.keys(parts).length || Object.keys(parts).length > 32 || !form.length || form.length > 128)
      throw new Error("Music needs 1-32 sections and 1-128 arrangement entries");
    if (def.lead || def.bass || def.drums || Object.keys(def.tracks ?? {}).length || def.bars != null)
      throw new Error("Arranged music declares bars and note tracks inside sections");
    if (!["4/4", "3/4"].includes(def.time_signature ?? "4/4")) throw new Error("Arranged music supports 4/4 or 3/4 time");
    const beatsPerBar = def.time_signature === "3/4" ? 3 : 4;
    const channels = /* @__PURE__ */ new Set();
    const parsed = /* @__PURE__ */ Object.create(null);
    for (const [name, part] of Object.entries(parts)) {
      const tracks = Object.entries(part).filter(([key]) => key !== "bars");
      if (!name || !Number.isInteger(part.bars) || part.bars < 1 || part.bars > 64 || !tracks.length || tracks.length > 16)
        throw new Error(`Music section ${name} needs 1-64 integer bars and 1-16 tracks`);
      parsed[name] = /* @__PURE__ */ Object.create(null);
      for (const [channel, notes] of tracks) {
        if (typeof notes !== "string") throw new Error(`Music section ${name}/${channel} needs note text`);
        const events = parse(notes);
        const duration = events.reduce((sum, e) => sum + e.beats, 0);
        if (!Number.isFinite(duration) || duration > part.bars * beatsPerBar + 1e-8)
          throw new Error(`Music section ${name}/${channel} exceeds its declared bars`);
        parsed[name][channel] = events;
        channels.add(channel);
      }
    }
    const result = { bars: 0, tracks: /* @__PURE__ */ Object.create(null), sections: [] };
    for (const channel of channels) result.tracks[channel] = [];
    for (const cue of form) {
      const name = typeof cue === "string" ? cue : cue.section;
      const repeat = typeof cue === "string" ? 1 : cue.repeat;
      if (!Object.prototype.hasOwnProperty.call(parts, name)) throw new Error(`Unknown music section: ${name}`);
      if (!Number.isInteger(repeat) || repeat < 1 || repeat > 16) throw new Error("Music section repeat must be an integer from 1 to 16");
      for (let i = 0; i < repeat; i++) {
        const beats = parts[name].bars * beatsPerBar;
        if (result.bars + parts[name].bars > 512) throw new Error("Music arrangement exceeds 512 bars");
        result.sections.push({ name, startBeat: result.bars * beatsPerBar, beats });
        result.bars += parts[name].bars;
        for (const channel of channels) {
          const events = parsed[name][channel] ?? [];
          const duration = events.reduce((sum, e) => sum + e.beats, 0);
          const offset = result.tracks[channel].length;
          result.tracks[channel].push(...events.map((e, index2) => ({ ...e, stepId: offset + index2 })));
          if (duration < beats) result.tracks[channel].push({ stepId: -1, pitch: 0, beats: beats - duration, isRest: true, isDrum: false });
        }
      }
    }
    return result;
  }

  // src/audio.ts
  var audioCtx = null;
  var stepIndex = 0;
  var masterGain = null;
  var audioMuted = false;
  var syncPageAudio = true;
  var playbackUnlocked = true;
  var pendingMusic = null;
  function audioOutput(ctx2) {
    if (!masterGain) {
      masterGain = ctx2.createGain();
      masterGain.gain.setValueAtTime(audioMuted ? 0 : 1, ctx2.currentTime);
      masterGain.connect(ctx2.destination);
    }
    return masterGain;
  }
  var registeredSounds = {};
  var registeredMusic = {};
  var arrangements = /* @__PURE__ */ new Map();
  function registerSounds(definitions) {
    if (!definitions) return;
    for (const [key, val] of Object.entries(definitions)) {
      registeredSounds[key.toLowerCase()] = val;
    }
  }
  function registerMusic(definitions) {
    if (!definitions) return;
    for (const [key, val] of Object.entries(definitions)) {
      const name = key.toLowerCase();
      const arrangement = compileMusicArrangement(val, parseTrackPattern);
      if (arrangement) arrangements.set(name, arrangement);
      else arrangements.delete(name);
      registeredMusic[name] = arrangement ? { ...val, bars: arrangement.bars } : val;
    }
  }
  function getAudioContext() {
    if (!playbackUnlocked || typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {
      });
    }
    return audioCtx;
  }
  var NOTE_OFFSETS = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  };
  function parseNoteToFreq(noteStr) {
    const trimmed = noteStr.trim();
    const num = Number(trimmed);
    if (!isNaN(num) && num > 0) return num;
    const match = trimmed.toUpperCase().match(/^([A-G])([#B]?)([0-8])$/);
    if (!match) return 440;
    const [, letter, accidental, octaveStr] = match;
    let semitone = NOTE_OFFSETS[letter] || 0;
    if (accidental === "#") semitone += 1;
    else if (accidental === "B") semitone -= 1;
    const octave = parseInt(octaveStr, 10);
    const midi = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function playSound(type, arg) {
    if (audioMuted) return;
    const ctx2 = getAudioContext();
    if (!ctx2) return;
    const now = ctx2.currentTime;
    const soundName = String(type || "").trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(registeredSounds, soundName)) {
      playCustomSound(ctx2, registeredSounds[soundName], now, arg);
      return;
    }
    switch (soundName) {
      case "laser":
      case "pew":
      case "fire": {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(audioOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.13);
        break;
      }
      case "hit":
      case "damage": {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.09);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
        osc.connect(gain);
        gain.connect(audioOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case "explosion":
      case "boom": {
        playNoiseBurst(ctx2, now, 0.35, 800, 60, 0.45);
        break;
      }
      case "step":
      case "move": {
        const steps = [110, 98, 87, 82];
        const freq = steps[stepIndex % steps.length];
        stepIndex += 1;
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(audioOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }
      case "coin":
      case "powerup": {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.connect(gain);
        gain.connect(audioOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.29);
        break;
      }
      case "gameover": {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.linearRampToValueAtTime(293, now + 0.15);
        osc.frequency.linearRampToValueAtTime(261, now + 0.3);
        osc.frequency.linearRampToValueAtTime(196, now + 0.55);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.connect(gain);
        gain.connect(audioOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.62);
        break;
      }
      case "victory":
      case "win": {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const start = now + idx * 0.12;
          const osc = ctx2.createOscillator();
          const gain = ctx2.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.25, start);
          gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15);
          osc.connect(gain);
          gain.connect(audioOutput(ctx2));
          osc.start(start);
          osc.stop(start + 0.16);
        });
        break;
      }
      case "tone": {
        const freq = typeof arg === "number" ? arg : 440;
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(audioOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }
      default:
        break;
    }
  }
  function playNoiseBurst(ctx2, now, duration, filterStart, filterEnd, volume, filterType = "lowpass") {
    const bufferSize = Math.max(1, Math.floor(ctx2.sampleRate * duration));
    const buffer = ctx2.createBuffer(1, bufferSize, ctx2.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise2 = ctx2.createBufferSource();
    noise2.buffer = buffer;
    const filter = ctx2.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(20, filterStart), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), now + duration);
    const gain = ctx2.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + duration);
    noise2.connect(filter);
    filter.connect(gain);
    gain.connect(audioOutput(ctx2));
    noise2.start(now);
    noise2.stop(now + duration + 0.01);
  }
  function playCustomSound(ctx2, def, now, arg) {
    const duration = def.duration || 0.12;
    const volume = def.volume !== void 0 ? def.volume : 0.25;
    const wave = (def.wave || "square").toLowerCase();
    if (wave === "noise") {
      const fStart = def.filter?.start_freq || 800;
      const fEnd = def.filter?.end_freq || 60;
      const fType = def.filter?.filter_type || "lowpass";
      playNoiseBurst(ctx2, now, duration, fStart, fEnd, volume, fType);
      return;
    }
    if (def.sequence && def.sequence.length > 0) {
      let offset = 0;
      for (const [freq, noteDur] of def.sequence) {
        const start = now + offset;
        const osc2 = ctx2.createOscillator();
        const gain2 = ctx2.createGain();
        osc2.type = wave || "square";
        osc2.frequency.setValueAtTime(freq, start);
        gain2.gain.setValueAtTime(volume, start);
        gain2.gain.exponentialRampToValueAtTime(0.01, start + noteDur);
        osc2.connect(gain2);
        gain2.connect(audioOutput(ctx2));
        osc2.start(start);
        osc2.stop(start + noteDur + 0.01);
        offset += noteDur;
      }
      return;
    }
    let startFreq = def.freq_start || 440;
    if (def.notes && def.notes.length > 0) {
      startFreq = def.notes[stepIndex % def.notes.length];
      stepIndex += 1;
    } else if (typeof arg === "number") {
      startFreq = arg;
    }
    const endFreq = def.freq_end !== null && def.freq_end !== void 0 ? def.freq_end : startFreq;
    const osc = ctx2.createOscillator();
    const gain = ctx2.createGain();
    osc.type = wave || "square";
    osc.frequency.setValueAtTime(Math.max(1, startFreq), now);
    if (endFreq !== startFreq) {
      if (def.curve === "linear") {
        osc.frequency.linearRampToValueAtTime(Math.max(1, endFreq), now + duration);
      } else {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
      }
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + duration);
    osc.connect(gain);
    gain.connect(audioOutput(ctx2));
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }
  var activeMusicTrackName = null;
  var musicSchedulerTimer = null;
  var musicMasterGain = null;
  var musicVolume = 0.2;
  var musicTempoBpm = 128;
  var musicLoop = true;
  var isMusicPaused = false;
  var musicStartTime = 0;
  var musicPauseTime = 0;
  var musicPausedElapsed = 0;
  var nextScheduleTime = 0;
  var tracksState = {};
  function parseTrackPattern(patternStr) {
    const events = [];
    const clean = patternStr.replace(/^\s*#.*$/gm, "").replace(/\s+#.*$/gm, "");
    const tokens = clean.split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === "|") {
        continue;
      }
      let noteToken = token;
      let durationNum = 8;
      if (token.startsWith("[") && token.includes("]")) {
        const closeIdx = token.indexOf("]");
        noteToken = token.slice(1, closeIdx);
        const after = token.slice(closeIdx + 1);
        if (after.startsWith(":")) {
          durationNum = Number(after.slice(1)) || 8;
        }
      } else {
        const parts = token.split(":");
        noteToken = parts[0].trim();
        durationNum = parts.length > 1 ? Number(parts[1].trim()) : 8;
      }
      const beats = durationNum > 0 ? 4 / durationNum : 0.5;
      if (noteToken === "-" || noteToken.toUpperCase() === "R" || noteToken === "_") {
        events.push({ stepId: i, pitch: 0, beats, isRest: true, isDrum: false });
        continue;
      }
      const subNotes = noteToken.split(/[,+]/).map((s) => s.trim()).filter(Boolean);
      const drumNames = ["kick", "snare", "hihat", "crash", "tom"];
      if (subNotes.length > 1) {
        const isAnyDrum = subNotes.some((s) => drumNames.includes(s.toLowerCase()));
        const pitches = subNotes.map((s) => {
          if (drumNames.includes(s.toLowerCase())) return s.toLowerCase();
          return parseNoteToFreq(s);
        });
        events.push({
          stepId: i,
          pitch: pitches[0],
          pitches,
          beats,
          isRest: false,
          isDrum: isAnyDrum
        });
      } else {
        const s = subNotes[0] || noteToken;
        if (drumNames.includes(s.toLowerCase())) {
          events.push({ stepId: i, pitch: s.toLowerCase(), beats, isRest: false, isDrum: true });
        } else {
          events.push({ stepId: i, pitch: parseNoteToFreq(s), beats, isRest: false, isDrum: false });
        }
      }
    }
    return events;
  }
  function playMusic(trackName) {
    if (!playbackUnlocked) {
      pendingMusic = trackName;
      return;
    }
    const ctx2 = getAudioContext();
    if (!ctx2) return;
    const key = String(trackName || "").trim().toLowerCase();
    const def = registeredMusic[key];
    if (!def) {
      return;
    }
    stopMusic();
    activeMusicTrackName = key;
    musicTempoBpm = def.tempo || 128;
    musicLoop = def.loop_track !== false;
    musicVolume = def.volume !== void 0 ? def.volume : 0.2;
    isMusicPaused = false;
    musicMasterGain = ctx2.createGain();
    musicMasterGain.gain.setValueAtTime(musicVolume, ctx2.currentTime);
    musicMasterGain.connect(audioOutput(ctx2));
    tracksState = {};
    if (def.lead) {
      tracksState.lead = { events: parseTrackPattern(def.lead), index: 0, nextBeat: 0, instrument: "square" };
    }
    if (def.bass) {
      tracksState.bass = { events: parseTrackPattern(def.bass), index: 0, nextBeat: 0, instrument: "triangle" };
    }
    if (def.drums) {
      tracksState.drums = { events: parseTrackPattern(def.drums), index: 0, nextBeat: 0, instrument: "drums" };
    }
    if (def.tracks) {
      for (const [tName, tVal] of Object.entries(def.tracks)) {
        if (!tVal) continue;
        if (typeof tVal === "string") {
          tracksState[tName] = {
            events: parseTrackPattern(tVal),
            index: 0,
            nextBeat: 0,
            instrument: "sawtooth"
          };
        } else if (typeof tVal === "object" && tVal.notes) {
          tracksState[tName] = {
            events: parseTrackPattern(tVal.notes),
            index: 0,
            nextBeat: 0,
            instrument: tVal.instrument || "sawtooth",
            volume: tVal.volume,
            pan: tVal.pan,
            muted: tVal.muted
          };
        }
      }
    }
    const arrangement = arrangements.get(key);
    if (arrangement) {
      tracksState = /* @__PURE__ */ Object.create(null);
      for (const [channel, events] of Object.entries(arrangement.tracks)) {
        tracksState[channel] = {
          events,
          index: 0,
          nextBeat: 0,
          instrument: channel === "drums" ? "drums" : channel === "bass" ? "triangle" : "square"
        };
      }
    }
    for (const [channel, instrument] of Object.entries(def.instruments ?? {})) {
      if (Object.prototype.hasOwnProperty.call(tracksState, channel)) tracksState[channel].instrument = instrument;
    }
    const beatsPerBar = def.time_signature?.startsWith("3/") ? 3 : 4;
    let maxTrackBeats = 0;
    for (const track of Object.values(tracksState)) {
      if (track && track.events && track.events.length > 0) {
        const trackBeats = track.events.reduce((sum, e) => sum + (e.beats || 0), 0);
        if (trackBeats > maxTrackBeats) maxTrackBeats = trackBeats;
      }
    }
    const appStateBars = syncPageAudio ? Number(window?.__RuneWeb?.ctx?.()?.app?.state?.bars) : 0;
    const totalBars = appStateBars > 0 ? appStateBars : def.bars || (maxTrackBeats > 0 ? Math.ceil(maxTrackBeats / beatsPerBar) : 4);
    const totalBeats = Math.max(maxTrackBeats, totalBars * beatsPerBar);
    musicStartTime = ctx2.currentTime + 0.05;
    nextScheduleTime = musicStartTime;
    musicPauseTime = 0;
    musicPausedElapsed = 0;
    audioSync.configure({ getAudioContext: () => audioCtx, syncPage: syncPageAudio });
    audioSync.onPlay({
      track: key,
      tempo: musicTempoBpm,
      timeSignature: def.time_signature || "4/4",
      totalBars,
      totalBeats,
      startTime: musicStartTime
    });
    scheduleMusicTicks();
    musicSchedulerTimer = setInterval(scheduleMusicTicks, 25);
  }
  function stopMusic() {
    pendingMusic = null;
    audioSync.onStop();
    if (musicSchedulerTimer) {
      clearInterval(musicSchedulerTimer);
      musicSchedulerTimer = null;
    }
    activeMusicTrackName = null;
    musicPauseTime = 0;
    musicPausedElapsed = 0;
    isMusicPaused = false;
    tracksState = {};
    if (musicMasterGain) {
      try {
        musicMasterGain.disconnect();
      } catch {
      }
      musicMasterGain = null;
    }
  }
  function pauseMusic() {
    const ctx2 = getAudioContext();
    if (!ctx2 || isMusicPaused || !activeMusicTrackName) return;
    isMusicPaused = true;
    if (musicSchedulerTimer) {
      clearInterval(musicSchedulerTimer);
      musicSchedulerTimer = null;
    }
    musicPauseTime = ctx2.currentTime;
    musicPausedElapsed = Math.max(0, musicPauseTime - musicStartTime);
    if (musicMasterGain) {
      try {
        musicMasterGain.gain.setValueAtTime(0, ctx2.currentTime);
      } catch (_) {
      }
    }
    audioSync.onPause();
  }
  function resumeMusic() {
    const ctx2 = getAudioContext();
    if (!ctx2 || !isMusicPaused || !activeMusicTrackName) return;
    const pausedDuration = ctx2.currentTime - musicPauseTime;
    musicStartTime += pausedDuration;
    const secondsPerBeat = 60 / musicTempoBpm;
    const currentBeat = musicPausedElapsed / secondsPerBeat;
    for (const track of Object.values(tracksState)) {
      if (!track || !track.events.length) continue;
      let accum = 0;
      track.index = 0;
      track.nextBeat = 0;
      for (let i = 0; i < track.events.length; i++) {
        const ev = track.events[i];
        if (accum + ev.beats > currentBeat) {
          track.index = i;
          track.nextBeat = accum;
          break;
        }
        accum += ev.beats;
      }
    }
    if (musicMasterGain) {
      try {
        musicMasterGain.gain.setValueAtTime(musicVolume, ctx2.currentTime);
      } catch (_) {
      }
    }
    isMusicPaused = false;
    const def = registeredMusic[activeMusicTrackName];
    const beatsPerBar = def?.time_signature?.startsWith("3/") ? 3 : 4;
    let maxTrackBeats = 0;
    for (const track of Object.values(tracksState)) {
      if (track && track.events && track.events.length > 0) {
        const trackBeats = track.events.reduce((sum, e) => sum + (e.beats || 0), 0);
        if (trackBeats > maxTrackBeats) maxTrackBeats = trackBeats;
      }
    }
    const appStateBars = syncPageAudio ? Number(window?.__RuneWeb?.ctx?.()?.app?.state?.bars) : 0;
    const totalBars = appStateBars > 0 ? appStateBars : def?.bars || (maxTrackBeats > 0 ? Math.ceil(maxTrackBeats / beatsPerBar) : 4);
    const totalBeats = Math.max(maxTrackBeats, totalBars * beatsPerBar);
    audioSync.onPlay({
      track: activeMusicTrackName,
      tempo: musicTempoBpm,
      timeSignature: def?.time_signature || "4/4",
      totalBars,
      totalBeats,
      startTime: musicStartTime
    });
    scheduleMusicTicks();
    musicSchedulerTimer = setInterval(scheduleMusicTicks, 25);
  }
  function setMusicTempo(bpm) {
    if (bpm > 20 && bpm < 400) {
      musicTempoBpm = bpm;
    }
  }
  function setMusicVolume(vol) {
    musicVolume = Math.max(0, Math.min(1, vol));
    if (musicMasterGain && audioCtx) {
      musicMasterGain.gain.setValueAtTime(musicVolume, audioCtx.currentTime);
    }
  }
  function scheduleMusicTicks() {
    const ctx2 = getAudioContext();
    if (!ctx2 || !musicMasterGain || isMusicPaused || !activeMusicTrackName) return;
    const secondsPerBeat = 60 / musicTempoBpm;
    const lookaheadWindow = ctx2.currentTime + 0.25;
    const def = registeredMusic[activeMusicTrackName];
    const beatsPerBar = def?.time_signature?.startsWith("3/") ? 3 : 4;
    let maxTrackBeats = 0;
    for (const t of Object.values(tracksState)) {
      if (t && t.events && t.events.length > 0) {
        const tb = t.events.reduce((sum, e) => sum + (e.beats || 0), 0);
        if (tb > maxTrackBeats) maxTrackBeats = tb;
      }
    }
    const appStateBars = syncPageAudio ? Number(window?.__RuneWeb?.ctx?.()?.app?.state?.bars) : 0;
    const totalBars = appStateBars > 0 ? appStateBars : def?.bars || (maxTrackBeats > 0 ? Math.ceil(maxTrackBeats / beatsPerBar) : 4);
    const songTotalBeats = Math.max(maxTrackBeats, totalBars * beatsPerBar);
    let allFinished = true;
    for (const [trackKey, track] of Object.entries(tracksState)) {
      if (!track || !track.events.length || track.muted) continue;
      while (musicStartTime + track.nextBeat * secondsPerBeat < lookaheadWindow) {
        if (track.index >= track.events.length) {
          if (musicLoop) {
            if (songTotalBeats > 0) {
              const currentIteration = Math.floor((track.nextBeat - 1e-4) / songTotalBeats);
              track.nextBeat = (currentIteration + 1) * songTotalBeats;
            }
            track.index = 0;
          } else {
            break;
          }
        }
        const event = track.events[track.index];
        const eventTime = musicStartTime + track.nextBeat * secondsPerBeat;
        const eventDurationSec = event.beats * secondsPerBeat;
        if (!event.isRest && eventTime >= ctx2.currentTime - 0.05) {
          scheduleTrackNote(ctx2, trackKey, event, eventTime, eventDurationSec, musicMasterGain, track.instrument);
        }
        track.nextBeat += event.beats;
        track.index += 1;
      }
      if (track.index < track.events.length || musicLoop) {
        allFinished = false;
      }
    }
    if (allFinished && !musicLoop && ctx2.currentTime >= musicStartTime + songTotalBeats * secondsPerBeat) {
      stopMusic();
    }
  }
  function scheduleTrackNote(ctx2, channel, event, time, durationSec, destination, instrumentOverride) {
    audioSync.enqueueNote({
      channel,
      stepId: event.stepId ?? -1,
      pitch: event.pitch,
      startTime: time,
      endTime: time + durationSec,
      beat: 0,
      bar: 1
    });
    const isDrumChannel = channel === "drums" || instrumentOverride === "drums" || event.isDrum;
    const pitchesToPlay = event.pitches && event.pitches.length > 0 ? event.pitches : [event.pitch];
    const chordGainMultiplier = 1 / Math.sqrt(Math.max(1, pitchesToPlay.length));
    for (const p of pitchesToPlay) {
      if (isDrumChannel || typeof p === "string") {
        const drumType = String(p).toLowerCase();
        if (drumType === "kick") {
          const osc2 = ctx2.createOscillator();
          const gain2 = ctx2.createGain();
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(130, time);
          osc2.frequency.exponentialRampToValueAtTime(32, time + Math.min(durationSec, 0.08));
          gain2.gain.setValueAtTime(0.4 * chordGainMultiplier, time);
          gain2.gain.exponentialRampToValueAtTime(1e-3, time + Math.min(durationSec, 0.08));
          osc2.connect(gain2);
          gain2.connect(destination);
          osc2.start(time);
          osc2.stop(time + Math.min(durationSec, 0.09));
        } else if (drumType === "snare") {
          playNoiseBurstToDestination(ctx2, time, Math.min(durationSec, 0.09), 1600, 300, 0.3 * chordGainMultiplier, destination, "bandpass");
        } else if (drumType === "hihat") {
          playNoiseBurstToDestination(ctx2, time, Math.min(durationSec, 0.04), 7e3, 5e3, 0.15 * chordGainMultiplier, destination, "highpass");
        } else if (drumType === "crash") {
          playNoiseBurstToDestination(ctx2, time, Math.min(durationSec, 0.25), 5e3, 1e3, 0.2 * chordGainMultiplier, destination, "bandpass");
        } else if (drumType === "tom") {
          const osc2 = ctx2.createOscillator();
          const gain2 = ctx2.createGain();
          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(220, time);
          osc2.frequency.exponentialRampToValueAtTime(70, time + Math.min(durationSec, 0.12));
          gain2.gain.setValueAtTime(0.35 * chordGainMultiplier, time);
          gain2.gain.exponentialRampToValueAtTime(1e-3, time + Math.min(durationSec, 0.12));
          osc2.connect(gain2);
          gain2.connect(destination);
          osc2.start(time);
          osc2.stop(time + Math.min(durationSec, 0.13));
        }
        continue;
      }
      const freq = typeof p === "number" ? p : parseNoteToFreq(p);
      if (freq <= 0) continue;
      const osc = ctx2.createOscillator();
      const gain = ctx2.createGain();
      const inst = instrumentOverride || (channel === "bass" ? "triangle" : "square");
      if (inst === "brass" || inst === "strings" || inst === "bell") {
        const length = Math.max(0.06, durationSec * (inst === "bell" ? 1.25 : 0.94));
        const attack = Math.min(length * 0.25, inst === "strings" ? 0.09 : 0.018);
        osc.type = inst === "brass" ? "sawtooth" : inst === "strings" ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(1e-3, time);
        gain.gain.linearRampToValueAtTime((inst === "strings" ? 0.11 : 0.23) * chordGainMultiplier, time + attack);
        gain.gain.exponentialRampToValueAtTime(1e-3, time + length);
        const filter = ctx2.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(Math.min(9e3, freq * (inst === "brass" ? 5 : 3)), time);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + length + 0.015);
      } else if (inst === "sawtooth" || inst === "synth") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = Math.min(durationSec * 0.88, 0.4);
        gain.gain.setValueAtTime(0.18 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(5e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      } else if (inst === "triangle" || inst === "bass") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = Math.min(durationSec * 0.9, 0.45);
        gain.gain.setValueAtTime(0.28 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(5e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      } else if (inst === "sine") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = Math.min(durationSec * 0.9, 0.5);
        gain.gain.setValueAtTime(0.25 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(2e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      } else if (inst === "pluck") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = Math.min(durationSec * 0.6, 0.15);
        gain.gain.setValueAtTime(0.3 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(1e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      } else {
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = Math.min(durationSec * 0.85, 0.35);
        gain.gain.setValueAtTime(0.2 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(5e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      }
    }
  }
  function playNoiseBurstToDestination(ctx2, now, duration, filterStart, filterEnd, volume, destination, filterType = "lowpass") {
    const bufferSize = Math.max(1, Math.floor(ctx2.sampleRate * duration));
    const buffer = ctx2.createBuffer(1, bufferSize, ctx2.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise2 = ctx2.createBufferSource();
    noise2.buffer = buffer;
    const filter = ctx2.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(20, filterStart), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), now + duration);
    const gain = ctx2.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + duration);
    noise2.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise2.start(now);
    noise2.stop(now + duration + 0.01);
  }

  // src/statement.ts
  function assignPath(pathExpr, value, locals) {
    const segments = splitPathSegments(pathExpr);
    if (!segments.length) return;
    const baseKey = segments[0];
    let current;
    if (locals && Object.prototype.hasOwnProperty.call(locals, baseKey)) {
      current = locals[baseKey];
      if (segments.length === 1) {
        locals[baseKey] = value;
        entitiesChanged(value);
        return;
      }
    } else {
      current = ctx().app.state[baseKey];
      if (segments.length === 1) {
        ctx().app.state[baseKey] = value;
        entitiesChanged(value);
        return;
      }
    }
    for (let i = 1; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const scopeValue2 = buildScope(locals, pathExpr);
      if (Array.isArray(current) && segment.startsWith("[].(") && segment.endsWith(")")) {
        const condition = segment.slice(4, -1);
        const match = current.find((item) => {
          const innerScope = Object.assign({}, scopeValue2, { it: item });
          return Boolean(evaluateExpression(condition, innerScope, 0));
        });
        if (match !== void 0) {
          current = match;
          continue;
        } else return;
      } else if (segment.startsWith("[") && segment.endsWith("]")) {
        const innerExpr = segment.slice(1, -1);
        const lookup = evaluateExpression(innerExpr, scopeValue2, 0);
        const key = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
        if (current[key] === void 0) {
          current[key] = {};
        }
        current = current[key];
      } else {
        const key = segment;
        if (current[key] === void 0) {
          current[key] = {};
        }
        current = current[key];
      }
    }
    const finalRawKey = segments[segments.length - 1];
    const scopeValue = buildScope(locals, pathExpr);
    if (Array.isArray(current) && finalRawKey.startsWith("[].(") && finalRawKey.endsWith(")")) {
      const condition = finalRawKey.slice(4, -1);
      const index2 = current.findIndex((item) => {
        const innerScope = Object.assign({}, scopeValue, { it: item });
        return Boolean(evaluateExpression(condition, innerScope, 0));
      });
      if (index2 !== -1) {
        current[index2] = value;
        entitiesChanged(current);
      }
      return;
    } else if (finalRawKey.startsWith("[") && finalRawKey.endsWith("]")) {
      const innerExpr = finalRawKey.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scopeValue, 0);
      const finalKey = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
      current[finalKey] = value;
      entitiesChanged(current);
      entityMoved(current);
    } else {
      current[finalRawKey] = value;
      if (["x", "y", "z", "visible", "scale"].includes(finalRawKey)) entityMoved(current);
    }
  }
  function deletePath(pathExpr, locals) {
    const segments = splitPathSegments(pathExpr);
    if (!segments.length) return;
    const baseKey = segments[0];
    let current;
    if (locals && Object.prototype.hasOwnProperty.call(locals, baseKey)) {
      current = locals[baseKey];
      if (segments.length === 1) {
        delete locals[baseKey];
        return;
      }
    } else {
      current = ctx().app.state[baseKey];
      if (segments.length === 1) {
        delete ctx().app.state[baseKey];
        return;
      }
    }
    for (let i = 1; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const scopeValue2 = buildScope(locals);
      if (Array.isArray(current) && segment.startsWith("[].(") && segment.endsWith(")")) {
        const condition = segment.slice(4, -1);
        const match = current.find((item) => {
          const innerScope = Object.assign({}, scopeValue2, { it: item });
          return Boolean(evaluateExpression(condition, innerScope, 0));
        });
        if (match !== void 0) {
          current = match;
          continue;
        } else return;
      } else if (segment.startsWith("[") && segment.endsWith("]")) {
        const innerExpr = segment.slice(1, -1);
        const lookup = evaluateExpression(innerExpr, scopeValue2, 0);
        const key = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
        if (current[key] === void 0) return;
        current = current[key];
      } else {
        const key = segment;
        if (current[key] === void 0) return;
        current = current[key];
      }
    }
    const finalRawKey = segments[segments.length - 1];
    const scopeValue = buildScope(locals);
    if (Array.isArray(current) && finalRawKey.startsWith("[].(") && finalRawKey.endsWith(")")) {
      const condition = finalRawKey.slice(4, -1);
      const index2 = current.findIndex((item) => {
        const innerScope = Object.assign({}, scopeValue, { it: item });
        return Boolean(evaluateExpression(condition, innerScope, 0));
      });
      if (index2 !== -1) {
        current.splice(index2, 1);
        entitiesChanged(current);
      }
    } else if (finalRawKey.startsWith("[") && finalRawKey.endsWith("]")) {
      const innerExpr = finalRawKey.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scopeValue, 0);
      const finalKey = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
      if (Array.isArray(current) && typeof finalKey === "number") {
        current.splice(finalKey, 1);
        entitiesChanged(current);
      } else {
        delete current[finalKey];
      }
    } else {
      if (Array.isArray(current) && !isNaN(Number(finalRawKey))) {
        current.splice(Number(finalRawKey), 1);
      } else {
        delete current[finalRawKey];
      }
    }
    entitiesChanged(current);
    entityMoved(current);
  }
  function executeStatement(statement, locals) {
    const trimmed = String(statement || "").trim();
    if (!trimmed) return true;
    if (trimmed.startsWith("call ")) {
      const rest = trimmed.slice(5).trim();
      const match = rest.match(/^([a-zA-Z_][\w]*)(?:\s+(.*))?$/);
      if (!match || !Object.prototype.hasOwnProperty.call(ctx().actionDefinitions, match[1])) {
        throw new Error(`Unknown Rune-Web action: ${rest}`);
      }
      const args = match[2] ? splitTopLevel(match[2], ",").map((arg) => evaluateExpression(arg, buildScope(locals, trimmed))) : [];
      ctx().app.invokeAction(match[1], args, locals);
      return true;
    }
    if (trimmed.startsWith("sound ") || trimmed.startsWith("sound.") || trimmed.startsWith("play_sound(")) {
      let soundName = "";
      let argVal = void 0;
      if (trimmed.startsWith("sound.play(") && trimmed.endsWith(")")) {
        const inner = trimmed.slice(11, -1);
        const parts = splitTopLevel(inner, ",");
        soundName = String(evaluateExpression(parts[0], buildScope(locals, trimmed)) || "");
        if (parts.length > 1) {
          argVal = evaluateExpression(parts[1], buildScope(locals, trimmed));
        }
      } else if (trimmed.startsWith("play_sound(") && trimmed.endsWith(")")) {
        const inner = trimmed.slice(11, -1);
        const parts = splitTopLevel(inner, ",");
        soundName = String(evaluateExpression(parts[0], buildScope(locals, trimmed)) || "");
        if (parts.length > 1) {
          argVal = evaluateExpression(parts[1], buildScope(locals, trimmed));
        }
      } else if (trimmed.startsWith("sound.play ")) {
        soundName = String(evaluateExpression(trimmed.slice(11), buildScope(locals, trimmed)) || "");
      } else if (trimmed.startsWith("sound.")) {
        soundName = trimmed.slice(6).trim();
      } else {
        soundName = String(evaluateExpression(trimmed.slice(6), buildScope(locals, trimmed)) || "");
      }
      soundName = normalizeLiteral(soundName);
      playSound(soundName, argVal);
      return true;
    }
    if (trimmed.startsWith("music ") || trimmed.startsWith("music.") || trimmed.startsWith("play_music(")) {
      if (trimmed === "music.stop" || trimmed === "music.stop()" || trimmed === "stop_music()") {
        stopMusic();
        return true;
      }
      if (trimmed === "music.pause" || trimmed === "music.pause()" || trimmed === "pause_music()") {
        pauseMusic();
        return true;
      }
      if (trimmed === "music.resume" || trimmed === "music.resume()" || trimmed === "resume_music()") {
        resumeMusic();
        return true;
      }
      if (trimmed.startsWith("music.tempo =") || trimmed.startsWith("music.tempo=")) {
        const expr = trimmed.slice(trimmed.indexOf("=") + 1).trim();
        const val = Number(evaluateExpression(expr, buildScope(locals, trimmed)));
        if (!isNaN(val)) setMusicTempo(val);
        return true;
      }
      if (trimmed.startsWith("music.volume =") || trimmed.startsWith("music.volume=")) {
        const expr = trimmed.slice(trimmed.indexOf("=") + 1).trim();
        const val = Number(evaluateExpression(expr, buildScope(locals, trimmed)));
        if (!isNaN(val)) setMusicVolume(val);
        return true;
      }
      if (trimmed.startsWith("music.compose(") || trimmed.startsWith("music.register(")) {
        const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
        const parts = splitTopLevel(inner, ",");
        if (parts.length >= 4) {
          const name = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
          const tempo = Number(evaluateExpression(parts[1], buildScope(locals, trimmed))) || 128;
          const lead = String(evaluateExpression(parts[2], buildScope(locals, trimmed)));
          const bass = String(evaluateExpression(parts[3], buildScope(locals, trimmed)));
          const drums = parts.length > 4 ? String(evaluateExpression(parts[4], buildScope(locals, trimmed))) : "";
          const timeSig = parts.length > 5 ? String(evaluateExpression(parts[5], buildScope(locals, trimmed))) : "4/4";
          const songBars = Number(ctx().app?.state?.bars) || 4;
          registerMusic({
            [name]: {
              music_type: "8bit",
              tempo,
              time_signature: timeSig,
              bars: songBars,
              loop_track: true,
              volume: 0.2,
              lead,
              bass,
              drums
            }
          });
        }
        return true;
      }
      if (trimmed.startsWith("music.compose_song(") || trimmed.startsWith("music.register_song(")) {
        const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
        const parts = splitTopLevel(inner, ",");
        if (parts.length >= 2) {
          const name = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
          const songConfig = evaluateExpression(parts[1], buildScope(locals, trimmed));
          if (songConfig && typeof songConfig === "object") {
            registerMusic({
              [name]: songConfig
            });
          }
        }
        return true;
      }
      if (trimmed === "music.play" || trimmed === "music.play()" || trimmed.startsWith("music.play(") || trimmed.startsWith("music.play ") || trimmed.startsWith("play_music(") || trimmed.startsWith("music ") && !trimmed.startsWith("music.tempo") && !trimmed.startsWith("music.volume")) {
        let trackName = "";
        if (trimmed.startsWith("music.play(") && trimmed.endsWith(")")) {
          trackName = String(evaluateExpression(trimmed.slice(11, -1), buildScope(locals, trimmed)) || "");
        } else if (trimmed.startsWith("play_music(") && trimmed.endsWith(")")) {
          trackName = String(evaluateExpression(trimmed.slice(11, -1), buildScope(locals, trimmed)) || "");
        } else if (trimmed.startsWith("music.play ")) {
          trackName = String(evaluateExpression(trimmed.slice(11), buildScope(locals, trimmed)) || "");
        } else if (trimmed.startsWith("music ")) {
          trackName = String(evaluateExpression(trimmed.slice(6), buildScope(locals, trimmed)) || "");
        }
        trackName = normalizeLiteral(trackName);
        if (trackName) playMusic(trackName);
        return true;
      }
    }
    if (trimmed === "music.sync_steps" || trimmed === "music.sync_steps()") {
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "");
        const selectedId = Number(state.selected_step_id ?? -1);
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        state.active_steps = parseTrackToSteps(score, selectedId, timeSig, selectedBar);
        if (typeof ctx().app.render === "function") {
          ctx().app.render();
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.select_step(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(18, -1);
      const id = Number(evaluateExpression(inner, buildScope(locals, trimmed)));
      const state = ctx().app?.state;
      if (state) {
        state.selected_step_id = id;
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "");
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        state.active_steps = parseTrackToSteps(score, id, timeSig, selectedBar);
        const step = state.active_steps.find((s) => s.id === id);
        if (step && !step.is_bar && !step.is_rest) {
          state.selected_note = step.note;
          if (step.is_chord && step.chord_notes && step.chord_notes.length > 0) {
            for (const cn of step.chord_notes) {
              if (voice === "drums" || ["kick", "snare", "hihat"].includes(cn)) {
                playSound("drum_" + cn);
              } else if (voice === "bass") {
                playSound("key_bass");
              } else {
                playSound("key_lead");
              }
            }
          } else {
            if (voice === "drums") {
              playSound("drum_" + step.note);
            } else if (voice === "bass") {
              playSound("key_bass");
            } else {
              playSound("key_lead");
            }
          }
        }
        if (typeof ctx().app.render === "function") {
          ctx().app.render();
        }
      }
      return true;
    }
    function syncMusicState(state) {
      if (!state || !state.selected_song) return;
      const name = String(state.selected_song);
      const tempo = Number(state.tempo) || 128;
      const timeSig = String(state.time_signature || "4/4");
      const bars = Number(state.bars) || 4;
      const lead = String(state.lead_track || "");
      const bass = String(state.bass_track || "");
      const drums = String(state.drums_track || "");
      registerMusic({
        [name]: {
          music_type: "8bit",
          tempo,
          time_signature: timeSig,
          bars,
          loop_track: true,
          volume: 0.2,
          lead,
          bass,
          drums
        }
      });
    }
    if (trimmed.startsWith("music.delete_step(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(18, -1);
      const id = Number(evaluateExpression(inner, buildScope(locals, trimmed)));
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "");
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const tokens = score.trim().split(/\s+/).filter(Boolean);
        if (id >= 0 && id < tokens.length) {
          tokens.splice(id, 1);
          state[voice + "_track"] = tokens.join(" ");
          state.selected_step_id = -1;
          state.active_steps = parseTrackToSteps(state[voice + "_track"], -1, timeSig, selectedBar);
          syncMusicState(state);
          if (typeof ctx().app.render === "function") {
            ctx().app.render();
          }
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.stretch_step(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(19, -1);
      const parts = splitTopLevel(inner, ",");
      const id = Number(evaluateExpression(parts[0], buildScope(locals, trimmed)));
      const delta = parts.length > 1 ? Number(evaluateExpression(parts[1], buildScope(locals, trimmed))) : 1;
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "");
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const tokens = score.trim().split(/\s+/).filter(Boolean);
        if (id >= 0 && id < tokens.length) {
          const raw = tokens[id];
          if (raw !== "|") {
            const DURS = [":16", ":8", ":4", ":2", ":1"];
            let currentDur = ":8";
            let prefix = raw;
            if (raw.startsWith("[") && raw.includes("]")) {
              const closeIdx = raw.indexOf("]");
              prefix = raw.slice(0, closeIdx + 1);
              currentDur = raw.slice(closeIdx + 1) || ":8";
            } else {
              const colonIdx = raw.indexOf(":");
              prefix = colonIdx !== -1 ? raw.slice(0, colonIdx) : raw;
              currentDur = colonIdx !== -1 ? raw.slice(colonIdx) : ":8";
            }
            let durIdx = DURS.indexOf(currentDur);
            if (durIdx === -1) durIdx = 1;
            const newDurIdx = Math.max(0, Math.min(DURS.length - 1, durIdx + delta));
            tokens[id] = `${prefix}${DURS[newDurIdx]}`;
            state[voice + "_track"] = tokens.join(" ");
            state.active_steps = parseTrackToSteps(state[voice + "_track"], id, timeSig, selectedBar);
            syncMusicState(state);
            if (typeof ctx().app.render === "function") {
              ctx().app.render();
            }
          }
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.stack_chord_note(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(23, -1);
      const parts = splitTopLevel(inner, ",");
      const note = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
      const dur = parts[1] ? String(evaluateExpression(parts[1], buildScope(locals, trimmed))) : ":8";
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "").trim();
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const tokens = score.length > 0 ? score.split(/\s+/).filter(Boolean) : [];
        if (tokens.length > 0) {
          const lastToken = tokens[tokens.length - 1];
          if (lastToken.startsWith("[") && lastToken.includes("]")) {
            const closeIdx = lastToken.indexOf("]");
            const currentNotes = lastToken.slice(1, closeIdx).split(/[,+]/).map((s) => s.trim()).filter(Boolean);
            const currentDur = lastToken.slice(closeIdx + 1) || dur;
            if (!currentNotes.includes(note)) {
              currentNotes.push(note);
              tokens[tokens.length - 1] = `[${currentNotes.join(",")}]${currentDur}`;
            }
          } else {
            tokens.push(`[${note}]${dur}`);
          }
        } else {
          tokens.push(`[${note}]${dur}`);
        }
        state[voice + "_track"] = tokens.join(" ");
        state.selected_note = note;
        state.active_steps = parseTrackToSteps(state[voice + "_track"], tokens.length - 1, timeSig, selectedBar);
        syncMusicState(state);
        if (typeof ctx().app.render === "function") {
          ctx().app.render();
        }
      }
      return true;
    }
    if (trimmed === "music.add_bar" || trimmed === "music.add_bar()") {
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "").trim();
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        state[voice + "_track"] = score.length > 0 ? `${score} |` : "|";
        state.active_steps = parseTrackToSteps(state[voice + "_track"], -1, timeSig, selectedBar);
        syncMusicState(state);
        if (typeof ctx().app.render === "function") {
          ctx().app.render();
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.duplicate_bar(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(20, -1);
      const barNum = Number(evaluateExpression(inner, buildScope(locals, trimmed))) || 1;
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "").trim();
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const bars = score.split("|").map((b) => b.trim());
        const barIdx = Math.max(0, Math.min(bars.length - 1, barNum - 1));
        if (bars[barIdx] !== void 0) {
          bars.push(bars[barIdx]);
          state[voice + "_track"] = bars.join(" | ");
          state.active_steps = parseTrackToSteps(state[voice + "_track"], -1, timeSig, selectedBar);
          syncMusicState(state);
          if (typeof ctx().app.render === "function") {
            ctx().app.render();
          }
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.delete_bar(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(17, -1);
      const barNum = Number(evaluateExpression(inner, buildScope(locals, trimmed))) || 1;
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "").trim();
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const bars = score.split("|").map((b) => b.trim());
        const barIdx = Math.max(0, Math.min(bars.length - 1, barNum - 1));
        if (bars.length > 1 && bars[barIdx] !== void 0) {
          bars.splice(barIdx, 1);
          state[voice + "_track"] = bars.join(" | ");
          state.active_steps = parseTrackToSteps(state[voice + "_track"], -1, timeSig, selectedBar);
          syncMusicState(state);
          if (typeof ctx().app.render === "function") {
            ctx().app.render();
          }
        }
      }
      return true;
    }
    if (trimmed.startsWith("storage.set(") || trimmed.startsWith("storage.save(") || trimmed.startsWith("local_storage.set(") || trimmed.startsWith("localStorage.set(")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const parts = splitTopLevel(inner, ",");
      if (parts.length >= 2) {
        const key = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
        const val = evaluateExpression(parts[1], buildScope(locals, trimmed));
        const serialized = typeof val === "string" ? val : JSON.stringify(val);
        setStorageItem(key, serialized);
      }
      return true;
    }
    if (trimmed.startsWith("storage.set ") || trimmed.startsWith("storage.save ")) {
      const rest = trimmed.slice(12).trim();
      const parts = splitTopLevel(rest, ",");
      if (parts.length >= 2) {
        const key = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
        const val = evaluateExpression(parts[1], buildScope(locals, trimmed));
        const serialized = typeof val === "string" ? val : JSON.stringify(val);
        setStorageItem(key, serialized);
      }
      return true;
    }
    if (trimmed.startsWith("storage.remove(") || trimmed.startsWith("storage.delete(") || trimmed.startsWith("local_storage.remove(")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const key = String(evaluateExpression(inner, buildScope(locals, trimmed)));
      removeStorageItem(key);
      return true;
    }
    if (trimmed === "storage.clear()" || trimmed === "storage.clear" || trimmed === "local_storage.clear()") {
      clearStorage();
      return true;
    }
    if (trimmed.startsWith("download(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(9, -1);
      const parts = splitTopLevel(inner, ",");
      if (parts.length >= 2) {
        const filename = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
        const content = String(evaluateExpression(parts[1], buildScope(locals, trimmed)));
        downloadText(filename, content);
      }
      return true;
    }
    if (trimmed.startsWith("download ")) {
      const rest = trimmed.slice(9).trim();
      const parts = splitTopLevel(rest, ",");
      if (parts.length >= 2) {
        const filename = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
        const content = String(evaluateExpression(parts[1], buildScope(locals, trimmed)));
        downloadText(filename, content);
      }
      return true;
    }
    if ((trimmed.startsWith("clipboard.copy(") || trimmed.startsWith("copy(")) && trimmed.endsWith(")")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const text = String(evaluateExpression(inner, buildScope(locals, trimmed)));
      copyText(text);
      return true;
    }
    if (trimmed === "fullscreen.toggle()" || trimmed === "fullscreen.toggle" || trimmed === "fullscreen()" || trimmed === "fullscreen" || trimmed === "toggle_fullscreen()" || trimmed === "fullscreen.enter()" || trimmed === "fullscreen.exit()") {
      if (typeof document !== "undefined") {
        const doc = document;
        const docEl = document.documentElement;
        const isFs = Boolean(
          doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement || doc.body.getAttribute("data-fullscreen") === "true" || doc.body.classList.contains("fullscreen")
        );
        const shouldEnter = trimmed === "fullscreen.enter()" ? true : trimmed === "fullscreen.exit()" ? false : !isFs;
        if (shouldEnter) {
          if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(() => {
            });
          } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
          } else if (docEl.msRequestFullscreen) {
            docEl.msRequestFullscreen();
          }
          doc.body.setAttribute("data-fullscreen", "true");
          doc.body.classList.add("fullscreen");
        } else {
          if (doc.exitFullscreen) {
            doc.exitFullscreen().catch(() => {
            });
          } else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
          } else if (doc.msExitFullscreen) {
            doc.msExitFullscreen();
          }
          doc.body.removeAttribute("data-fullscreen");
          doc.body.classList.remove("fullscreen");
        }
        if (typeof window !== "undefined" && window.parent && window.parent !== window) {
          try {
            window.parent.postMessage({ type: "toggle_fullscreen", is_fullscreen: shouldEnter }, "*");
          } catch (_) {
          }
        }
        const app = ctx().app;
        if (typeof app?.state !== "undefined") {
          app.state.is_fullscreen = shouldEnter;
          if (typeof app.render === "function") {
            app.render();
          }
        }
      }
      return true;
    }
    const emitterMatch = trimmed.match(/^([A-Za-z_][\w]*)\.(burst|step)\((.*)\)$/);
    if (emitterMatch && ctx().emitters && Object.prototype.hasOwnProperty.call(ctx().emitters, emitterMatch[1])) {
      const name = emitterMatch[1];
      const method = emitterMatch[2];
      const cfg = ctx().emitters[name] || {};
      const scope = buildScope(locals, trimmed);
      const existing = evaluateExpression(name, scope);
      const current = Array.isArray(existing) ? existing : [];
      if (method === "step") {
        if (current.length === 0) return true;
        const friction = cfg.friction ?? 0.92;
        const gravity = cfg.gravity ?? 0;
        const surviving = [];
        const rawCurrent2 = current.__raw || current;
        for (let i = 0; i < rawCurrent2.length; i += 1) {
          const item = rawCurrent2[i];
          if (!item || typeof item !== "object") continue;
          const p = item.__raw || item;
          const life2 = Number(p.life || 0) - 1;
          if (life2 <= 0) continue;
          const vx = Number(p.vx || 0) * friction;
          const vy = Number(p.vy || 0) * friction + gravity;
          p.x = Math.round((Number(p.x || 0) + Number(p.vx || 0)) * 10) / 10;
          p.y = Math.round((Number(p.y || 0) + Number(p.vy || 0)) * 10) / 10;
          p.vx = vx;
          p.vy = vy;
          p.life = life2;
          surviving.push(p);
        }
        assignPath(name, surviving, locals);
        return true;
      }
      const parts = emitterMatch[3].trim() ? splitTopLevel(emitterMatch[3], ",") : [];
      if (parts.length < 2) {
        console.warn(`[rune-web] ${name}.burst(x, y, [count, color, speed]) needs at least x and y`);
        return true;
      }
      const arg = (i) => parts.length > i ? evaluateExpression(parts[i], scope) : void 0;
      const xVal = Math.round(Number(arg(0) || 0) * 10) / 10;
      const yVal = Math.round(Number(arg(1) || 0) * 10) / 10;
      const countVal = Number(arg(2) ?? cfg.count ?? 8);
      const colorVal = arg(3) !== void 0 ? valueToString(arg(3)) : cfg.color ?? "#ffffff";
      const speedVal = Number(arg(4) ?? cfg.speed ?? 7);
      const life = cfg.life ?? 14;
      const maxParticles = cfg.max !== void 0 ? Number(cfg.max) : 36;
      const [minSize, maxSize] = Array.isArray(cfg.size) ? cfg.size : [cfg.size ?? 3, cfg.size ?? 5];
      const rawCurrent = current.__raw || current;
      const newParticles = [];
      for (let i = 0; i < countVal; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = (Math.random() * 0.7 + 0.3) * speedVal;
        newParticles.push({
          x: xVal,
          y: yVal,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life,
          max_life: life,
          color: colorVal,
          size: minSize + Math.floor(Math.random() * (maxSize - minSize + 1))
        });
      }
      const combined = rawCurrent.concat(newParticles);
      const capped = combined.length > maxParticles ? combined.slice(combined.length - maxParticles) : combined;
      assignPath(name, capped, locals);
      return true;
    }
    const restoreMatch = trimmed.match(/^(?:restore|reset)\s+([a-zA-Z0-9_.[\]'"]+)$/) || trimmed.match(/^([a-zA-Z0-9_.[\]'"]+)\.(?:restore|reset)\(\)$/);
    if (restoreMatch) {
      const targetPath = restoreMatch[1].trim();
      const initial = ctx().initialState;
      if (initial && Object.prototype.hasOwnProperty.call(initial, targetPath)) {
        assignPath(targetPath, JSON.parse(JSON.stringify(initial[targetPath])), locals);
        return true;
      }
      const targetVal = evaluateExpression(targetPath, buildScope(locals, trimmed));
      if (Array.isArray(targetVal)) {
        for (const item of targetVal) {
          if (item && typeof item === "object") {
            for (const key of Object.keys(item)) {
              if (key.startsWith("start_")) {
                const baseProp = key.slice(6);
                item[baseProp] = item[key];
              }
            }
            if ("alive" in item) {
              item.alive = true;
            }
          }
        }
        assignPath(targetPath, targetVal, locals);
        return true;
      } else if (targetVal && typeof targetVal === "object") {
        const item = targetVal;
        for (const key of Object.keys(item)) {
          if (key.startsWith("start_")) {
            item[key.slice(6)] = item[key];
          }
        }
        if ("alive" in item) {
          item.alive = true;
        }
        assignPath(targetPath, item, locals);
        return true;
      }
      return true;
    }
    const compoundMatch = trimmed.match(/^([a-zA-Z0-9_.[\]'"]+)\s*(\+|\-|\*|\/)=\s*(.+)$/);
    if (compoundMatch) {
      const left = compoundMatch[1].trim();
      const op = compoundMatch[2];
      const right = compoundMatch[3].trim();
      const rightVal = evaluateExpression(right, buildScope(locals, trimmed));
      const leftVal = evaluateExpression(left, buildScope(locals, trimmed));
      let newVal;
      if (op === "+") {
        if (typeof leftVal === "number" && typeof rightVal === "number") {
          newVal = leftVal + rightVal;
        } else {
          newVal = `${valueToString(leftVal)}${valueToString(rightVal)}`;
        }
      } else if (op === "-") {
        newVal = Number(leftVal) - Number(rightVal);
      } else if (op === "*") {
        newVal = Number(leftVal) * Number(rightVal);
      } else if (op === "/") {
        newVal = Number(leftVal) / Number(rightVal);
      }
      assignPath(left, newVal, locals);
      return true;
    }
    if (trimmed.includes("=") && !trimmed.match(/^.+?\.push\(/)) {
      const assignmentMatch = trimmed.match(/^(.*?)(?<![!<>=])=(?!=)(.*)$/);
      if (assignmentMatch) {
        const left = assignmentMatch[1].trim();
        const right = assignmentMatch[2].trim();
        const builtinVal = handleBuiltin(right, locals);
        if (builtinVal == STOP) {
          return false;
        }
        if (builtinVal == NO_ACTION) {
          return true;
        }
        const value = builtinVal !== void 0 ? builtinVal : evaluateExpression(right, buildScope(locals, trimmed));
        assignPath(left, value, locals);
        return true;
      }
    }
    const cmdResult = handleBuiltin(trimmed, locals);
    if (cmdResult) {
      if (cmdResult == STOP) {
        return false;
      }
      return true;
    }
    const pushMatch = trimmed.match(/^(.+?)\.push\((.+)\)$/);
    if (pushMatch) {
      const path = pushMatch[1].trim();
      const arg = pushMatch[2].trim();
      const collection = evaluateExpression(path, buildScope(locals, trimmed));
      if (Array.isArray(collection)) {
        const val = evaluateExpression(arg, buildScope(locals, trimmed));
        collection.push(val);
        assignPath(path, collection, locals);
      }
      return true;
    }
    if (trimmed.includes("(") && trimmed.endsWith(")")) {
      const parenIndex = trimmed.indexOf("(");
      const funcName = trimmed.slice(0, parenIndex).trim();
      const argsStr = trimmed.slice(parenIndex + 1, -1);
      if (funcName === "window.__runeWebEmit") {
        const args = argsStr ? splitTopLevel(argsStr, ",").map(
          (arg) => evaluateExpression(arg, buildScope(locals, trimmed))
        ) : [];
        const emitFn = getWindowProp("__runeWebEmit");
        if (emitFn && typeof emitFn === "function") {
          emitFn.apply(null, args);
        }
        return true;
      }
    }
    return true;
  }
  function executeSteps(steps, locals) {
    for (const step of steps) {
      if (Object.prototype.hasOwnProperty.call(step, "Statement")) {
        if (!executeStatement(step.Statement, locals)) return false;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(step, "Conditional")) {
        const conditional = step.Conditional;
        if (Boolean(
          evaluateExpression(
            conditional.condition,
            buildScope(locals, conditional.condition)
          )
        )) {
          if (!executeSteps(conditional.steps || [], locals)) return false;
        }
      }
      if (Object.prototype.hasOwnProperty.call(step, "ForLoop")) {
        const loop = step.ForLoop;
        const collection = evaluateExpression(
          loop.collection,
          buildScope(locals, loop.collection)
        );
        if (Array.isArray(collection)) {
          for (let i = 0; i < collection.length; i++) {
            const item = collection[i];
            const childLocals = Object.assign(
              {},
              locals || {}
            );
            childLocals[loop.item_name] = item;
            if (loop.index_name) {
              childLocals[loop.index_name] = i;
            }
            if (!executeSteps(loop.steps || [], childLocals)) {
              break;
            }
          }
        }
      }
    }
    return true;
  }
  var PITCH_ROWS = {
    "C5": 0,
    "B4": 1,
    "A#4": 2,
    "BB4": 2,
    "A4": 3,
    "G#4": 4,
    "AB4": 4,
    "G4": 5,
    "F#4": 6,
    "GB4": 6,
    "F4": 7,
    "E4": 8,
    "D#4": 9,
    "EB4": 9,
    "D4": 10,
    "C#4": 11,
    "DB4": 11,
    "C4": 12,
    "B3": 13,
    "A#3": 14,
    "BB3": 14,
    "A3": 15,
    "G#3": 16,
    "AB3": 16,
    "G3": 17,
    "F#3": 18,
    "GB3": 18,
    "F3": 19,
    "E3": 20,
    "D#3": 21,
    "EB3": 21,
    "D3": 22,
    "C#3": 23,
    "DB3": 23,
    "C3": 24,
    "B2": 25,
    "A#2": 26,
    "BB2": 26,
    "A2": 27,
    "G#2": 28,
    "AB2": 28,
    "G2": 29,
    "F#2": 30,
    "GB2": 30,
    "F2": 31,
    "E2": 32,
    "D2": 33,
    "C2": 34,
    "A1": 35,
    // Drums
    "hihat": 0,
    "snare": 1,
    "kick": 2
  };
  function getPitchRow(pitch, isDrum) {
    if (isDrum) {
      const p = pitch.toLowerCase();
      if (p.includes("hihat") || p.includes("crash")) return 0;
      if (p.includes("snare") || p.includes("tom")) return 1;
      return 2;
    }
    const clean = pitch.toUpperCase().trim();
    if (clean in PITCH_ROWS) return PITCH_ROWS[clean];
    const match = clean.match(/^([A-G][#B]?)([0-8])$/);
    if (match) {
      const oct = parseInt(match[2], 10);
      if (oct >= 5) return 0;
      if (oct === 4) return 8;
      if (oct === 3) return 15;
      if (oct <= 2) return 27;
    }
    return 12;
  }
  function parseTrackToSteps(scoreStr, selectedIdx, timeSignature = "4/4", selectedBar = 0) {
    if (!scoreStr) return [];
    const tokens = String(scoreStr).trim().split(/\s+/).filter(Boolean);
    const steps = [];
    const beatsPerBar = timeSignature.startsWith("3/") ? 3 : 4;
    let barNum = 1;
    let currentBeatInBar = 0;
    let totalBeatOffset = 0;
    let stepInBar = 1;
    for (let i = 0; i < tokens.length; i++) {
      const raw = tokens[i];
      if (raw === "|") {
        const totalLeft2 = Math.round(totalBeatOffset * 120);
        const barLeft2 = Math.round(currentBeatInBar * 120);
        steps.push({
          id: i,
          raw,
          note: "|",
          duration: "",
          len_label: "BAR " + barNum,
          beats: 0,
          is_bar: true,
          is_chord: false,
          is_rest: false,
          is_selected: i === selectedIdx,
          bar_num: barNum,
          step_num: stepInBar,
          pitch_class: "step-bar",
          matrix_top: 0,
          matrix_left: selectedBar > 0 ? barLeft2 : totalLeft2,
          matrix_total_left: totalLeft2,
          matrix_bar_left: barLeft2,
          matrix_width: 8,
          strip_width: 54,
          can_stretch: false,
          can_shorten: false
        });
        barNum += 1;
        currentBeatInBar = 0;
        stepInBar = 1;
        continue;
      }
      let pitch = raw;
      let dur = ":8";
      let isChord = false;
      let chordNotes = [];
      if (raw.startsWith("[") && raw.includes("]")) {
        const closeIdx = raw.indexOf("]");
        pitch = raw.slice(1, closeIdx);
        const after = raw.slice(closeIdx + 1);
        dur = after.startsWith(":") ? after : ":8";
        isChord = true;
        chordNotes = pitch.split(/[,+]/).map((s) => s.trim()).filter(Boolean);
      } else {
        const colonIdx = raw.indexOf(":");
        pitch = colonIdx !== -1 ? raw.slice(0, colonIdx) : raw;
        dur = colonIdx !== -1 ? raw.slice(colonIdx) : ":8";
        if (pitch.includes("+")) {
          isChord = true;
          chordNotes = pitch.split("+").map((s) => s.trim()).filter(Boolean);
        }
      }
      const isRest = pitch === "-" || pitch.toLowerCase() === "rest";
      let lenLabel = "1/8";
      let beats = 0.5;
      if (dur === ":16") {
        lenLabel = "1/16";
        beats = 0.25;
      } else if (dur === ":8") {
        lenLabel = "1/8";
        beats = 0.5;
      } else if (dur === ":4") {
        lenLabel = "1/4";
        beats = 1;
      } else if (dur === ":2") {
        lenLabel = "1/2";
        beats = 2;
      } else if (dur === ":1") {
        lenLabel = "1/1";
        beats = beatsPerBar;
      }
      let pitchClass = "step-note";
      if (isRest) pitchClass = "step-rest";
      else if (isChord) pitchClass = "step-chord";
      else if (pitch.includes("2") || pitch.includes("1")) pitchClass = "step-bass";
      else if (pitch.includes("3")) pitchClass = "step-mid-low";
      else if (pitch.includes("4")) pitchClass = "step-mid";
      else if (pitch.includes("5")) pitchClass = "step-high";
      else if (pitch === "kick") pitchClass = "step-kick";
      else if (pitch === "snare") pitchClass = "step-snare";
      else if (pitch === "hihat") pitchClass = "step-hihat";
      const rootPitch = isChord && chordNotes.length > 0 ? chordNotes[0] : pitch;
      const isDrumPitch = ["kick", "snare", "hihat", "crash", "tom"].includes(rootPitch.toLowerCase());
      const row = getPitchRow(rootPitch, isDrumPitch);
      const rowHeight = isDrumPitch ? 48 : 28;
      const matrixTop = row * rowHeight + 2;
      const totalLeft = Math.round(totalBeatOffset * 120);
      const barLeft = Math.round(currentBeatInBar * 120);
      const matrixLeft = selectedBar > 0 ? barLeft : totalLeft;
      const matrixWidth = Math.max(34, Math.round(beats * 120) - 4);
      const stripWidth = Math.max(54, Math.round(beats * 140));
      const displayNote = isRest ? "REST" : isChord ? pitch.startsWith("[") ? pitch : `[${pitch}]` : pitch;
      steps.push({
        id: i,
        raw,
        note: displayNote,
        chord_notes: isChord ? chordNotes : [pitch],
        duration: dur,
        len_label: lenLabel,
        beats,
        is_bar: false,
        is_chord: isChord,
        is_rest: isRest,
        is_selected: i === selectedIdx,
        bar_num: barNum,
        step_num: stepInBar,
        pitch_class: pitchClass,
        pitch_row: row,
        matrix_top: matrixTop,
        matrix_left: matrixLeft,
        matrix_total_left: totalLeft,
        matrix_bar_left: barLeft,
        matrix_width: matrixWidth,
        strip_width: stripWidth,
        can_stretch: beats < 4,
        can_shorten: beats > 0.25
      });
      totalBeatOffset += beats;
      currentBeatInBar += beats;
      stepInBar += 1;
      if (currentBeatInBar >= beatsPerBar && !tokens.includes("|")) {
        barNum += 1;
        currentBeatInBar = 0;
        stepInBar = 1;
      }
    }
    return steps;
  }

  // src/logic.ts
  function createLogicApp(render) {
    return {
      state: {},
      derived: {},
      playSound,
      playMusic,
      stopMusic,
      pauseMusic,
      resumeMusic,
      computeDerived() {
        const context = ctx();
        const baseScope = buildScope({});
        for (const [name, def] of Object.entries(
          context.derivedDefinitions
        )) {
          const sourceValue = resolveValue(def.source, baseScope);
          const sourceKey = valueToString(sourceValue);
          let resolved = void 0;
          for (const currentCase of def.cases || []) {
            const matcher = normalizeLiteral(currentCase.matcher);
            if (matcher === "_" || matcher === sourceKey) {
              resolved = evaluateExpression(
                currentCase.value,
                buildScope({})
              );
              break;
            }
          }
          this.derived[name] = resolved;
        }
      },
      render,
      invokeAction(name, args, locals) {
        const context = ctx();
        const def = context.actionDefinitions[name];
        if (!def) {
          if (typeof window !== "undefined" && typeof window[name] === "function") {
            window[name](...args);
          }
          return;
        }
        const scopedLocals = Object.assign(
          {},
          locals || {}
        );
        (def.params || []).forEach((param, index2) => {
          scopedLocals[param] = args[index2];
        });
        executeSteps(def.steps || [], scopedLocals);
      }
    };
  }

  // src/rendering.ts
  function renderNode(node, locals) {
    if (node.Element) {
      const element = node.Element;
      if (element.for_each) {
        const collection = evaluateExpression(
          element.for_each.collection,
          buildScope(locals)
        );
        if (!Array.isArray(collection)) return "";
        return collection.map((item, index2) => {
          const childLocals = Object.assign(
            {},
            locals || {}
          );
          childLocals[element.for_each.item_name] = item;
          if (element.for_each.index_name)
            childLocals[element.for_each.index_name] = index2;
          return renderElement(element, childLocals);
        }).join("");
      }
      return renderElement(element, locals);
    }
    if (node.Loop) {
      const loop = node.Loop;
      const collection = evaluateExpression(
        loop.collection,
        buildScope(locals)
      );
      if (!Array.isArray(collection)) return "";
      return collection.map((item, index2) => {
        const childLocals = Object.assign(
          {},
          locals || {}
        );
        childLocals[loop.item_name] = item;
        if (loop.index_name) childLocals[loop.index_name] = index2;
        return (loop.body || []).map((child) => renderNode(child, childLocals)).join("");
      }).join("");
    }
    if (node.Conditional) {
      const conditional = node.Conditional;
      if (Boolean(
        evaluateExpression(
          conditional.condition,
          buildScope(locals)
        )
      )) {
        return (conditional.body || []).map((child) => renderNode(child, locals)).join("");
      }
      return "";
    }
    if (node.Match) {
      const match = node.Match;
      const value = String(evaluateExpression(match.expression, buildScope(locals)));
      for (const caseDef of match.cases) {
        let matcher = normalizeLiteral(caseDef.matcher);
        if (matcher === "_" || matcher === value) {
          return (caseDef.body || []).map((child) => renderNode(child, locals)).join("");
        }
      }
      return "";
    }
    if (node.ComponentScope) {
      const scope = node.ComponentScope;
      const childLocals = Object.assign(
        {},
        locals || {}
      );
      for (const [key, value] of Object.entries(scope.props || {})) {
        const valStr = String(value ?? "").trim();
        if (valStr.startsWith("{") && valStr.endsWith("}")) {
          const exprStr = valStr.slice(1, -1).trim();
          childLocals[key] = evaluateExpression(
            exprStr,
            buildScope(locals)
          );
        } else {
          const parsed = tryParseLiteral(valStr, buildScope(locals));
          childLocals[key] = parsed !== void 0 ? parsed : valStr;
        }
      }
      return renderNode(scope.body, childLocals);
    }
    if (node.MemoryBinding) {
      const binding = node.MemoryBinding;
      const memValue = ctx().app.state[binding.key];
      const childLocals = Object.assign(
        {},
        locals || {},
        { [binding.var]: memValue }
      );
      return (binding.body || []).map((child) => renderNode(child, childLocals)).join("");
    }
    if (node.Text !== void 0) {
      return escapeHtml(interpolate(node.Text, buildScope(locals)));
    }
    if (node.Comment !== void 0) {
      return `<!--${interpolate(node.Comment, buildScope(locals))}-->`;
    }
    if (node.LazyRoute) {
      const lazy = node.LazyRoute;
      const context = ctx();
      const app = context.app;
      const cleanRoute = lazy.route.toLowerCase();
      if (context.loadedChunks && context.loadedChunks[cleanRoute]) {
        const chunk = context.loadedChunks[cleanRoute];
        if (Array.isArray(chunk)) {
          return chunk.map((c) => renderNode(c, locals)).join("");
        }
        return renderNode(chunk, locals);
      }
      if (app && app.loadChunk) {
        app.loadChunk(cleanRoute, lazy.chunk_url);
      }
      if (lazy.fallback && lazy.fallback.length > 0) {
        return lazy.fallback.map((c) => renderNode(c, locals)).join("");
      }
      return `<div class="rune-lazy-placeholder" data-route="${escapeHtml(lazy.route)}"></div>`;
    }
    return "";
  }
  function renderElement(element, locals) {
    const scope = buildScope(locals);
    let attrs = "";
    if (element.id)
      attrs += ` id="${escapeHtml(interpolate(element.id, scope))}"`;
    if (element.classes && element.classes.length) {
      const renderedClasses = element.classes.map((c) => interpolate(c, scope)).filter((c) => c.length > 0);
      if (renderedClasses.length)
        attrs += ` class="${renderedClasses.join(" ")}"`;
    }
    for (const [key, value] of Object.entries(element.attrs || {})) {
      const interpolated = interpolate(value, scope);
      const renderedValue = key === "src" || key === "href" ? hostedUrl(interpolated) : interpolated;
      if (renderedValue === "false" || renderedValue === "undefined" || renderedValue === "null") {
        const boolAttrs = [
          "checked",
          "disabled",
          "readonly",
          "selected",
          "hidden",
          "required",
          "multiple",
          "autofocus"
        ];
        if (boolAttrs.includes(key)) continue;
      }
      attrs += ` ${key}="${escapeHtml(renderedValue)}"`;
    }
    const eventEntries = Object.entries(element.events || {});
    if (eventEntries.length > 0 && locals && Object.keys(locals).length) {
      attrs += ` data-rune-scope="${escapeHtml(JSON.stringify(locals))}"`;
    }
    for (const [eventName, handler] of eventEntries) {
      attrs += ` data-on-${eventName}="${escapeHtml(interpolate(handler, scope))}"`;
    }
    const text = element.text ? escapeHtml(interpolate(element.text, scope)) : "";
    const children = (element.children || []).map((child) => renderNode(child, locals)).join("");
    return `<${element.tag}${attrs}>${text}${children}</${element.tag}>`;
  }

  // src/events.ts
  function parseHandlerSpec(spec) {
    const trimmed = String(spec || "").trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^([A-Za-z_][\w-]*)(?:\((.*)\))?$/);
    if (match) {
      const args = match[2] ? splitTopLevel(match[2], ",") : [];
      return { name: match[1], args, raw: trimmed };
    }
    return { name: "", args: [], raw: trimmed };
  }
  function readScope(element) {
    const raw = element.getAttribute("data-rune-scope");
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return {};
    }
  }
  function bindEvent(eventName) {
    document.addEventListener(eventName, function(event) {
      const selector = `[data-on-${eventName}]`;
      const element = event.target && event.target.closest ? event.target.closest(selector) : null;
      if (!element) return;
      const linkClick = eventName === "click" && element.tagName === "A";
      const mouse = event;
      if (linkClick && (mouse.ctrlKey || mouse.metaKey || mouse.shiftKey || mouse.altKey || mouse.button > 0 || element.getAttribute("target") === "_blank")) return;
      const href = linkClick ? element.getAttribute("href") : null;
      if (linkClick && element.getAttribute("data-route-link") === "true") {
        event.preventDefault();
      }
      const spec = parseHandlerSpec(
        element.getAttribute(`data-on-${eventName}`) || ""
      );
      if (!spec) return;
      if (typeof event.stopPropagation === "function") {
        event.stopPropagation();
      }
      const locals = readScope(element);
      if (spec.name) {
        const scope = buildScope(
          Object.assign({}, locals, { this: element })
        );
        const args = spec.args.map(
          (arg) => evaluateExpression(arg, scope)
        );
        ctx().app.invokeAction(spec.name, args, locals);
      } else {
        executeStatement(spec.raw, locals);
      }
      if (href?.startsWith("#") && href.length > 1 && !event.defaultPrevented) {
        requestAnimationFrame(() => {
          let id = href.slice(1);
          try {
            id = decodeURIComponent(id);
          } catch (_) {
          }
          document.getElementById(id)?.scrollIntoView();
        });
      }
    });
  }
  function createComponentRender(componentId) {
    return function() {
      const context = ctx();
      setWindowProp("__renderingComponent", componentId);
      context.app.computeDerived();
      const elem = document.getElementById(componentId);
      if (elem) {
        const newHtml = renderNode(context.pageTree, {});
        elem.innerHTML = newHtml;
      }
      setWindowProp("__renderingComponent", null);
    };
  }
  function setupMemoryUpdateListener() {
    const context = ctx();
    const ws = getWindowProp("__ws");
    if (ws && ws.addEventListener) {
      ws.addEventListener("message", function(event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "memory_update" && data.key) {
            context.app.state[data.key] = data.value;
            if (context.memorySubscriptions[data.key]) {
              context.memorySubscriptions[data.key].forEach(
                (componentId) => {
                  if (componentId === "app") {
                    requestAnimationFrame(
                      context.app.render.bind(context.app)
                    );
                  } else {
                    const componentRender = createComponentRender(componentId);
                    requestAnimationFrame(componentRender);
                  }
                }
              );
            } else {
              requestAnimationFrame(context.app.render.bind(context.app));
            }
          }
        } catch (_err) {
        }
      });
    }
  }

  // src/index.ts
  function boot(config) {
    registerSounds(config.sounds);
    registerMusic(config.music);
    const app = createLogicApp(function() {
      const context = ctx();
      if (context.isRendering) return;
      context.isRendering = true;
      try {
        this.computeDerived();
        const root = document.getElementById("app");
        if (!root) return;
        root.innerHTML = renderNode(context.pageTree, {});
      } finally {
        context.isRendering = false;
      }
    });
    const loadedChunks = {};
    const loadingChunks = {};
    app.loadedChunks = loadedChunks;
    app.loadChunk = function(route, chunkUrl) {
      const cleanRoute = route.toLowerCase();
      if (loadedChunks[cleanRoute]) {
        return Promise.resolve(loadedChunks[cleanRoute]);
      }
      if (cleanRoute in loadingChunks) {
        return loadingChunks[cleanRoute];
      }
      if (typeof fetch === "undefined") {
        return Promise.resolve(null);
      }
      const promise = fetch(hostedUrl(chunkUrl)).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching route chunk ${chunkUrl}`);
        return res.json();
      }).then((data) => {
        loadedChunks[cleanRoute] = data;
        delete loadingChunks[cleanRoute];
        app.render();
        return data;
      }).catch((err) => {
        delete loadingChunks[cleanRoute];
        console.warn(`[RuneWeb] Failed to load route chunk '${route}':`, err);
        return null;
      });
      loadingChunks[cleanRoute] = promise;
      return promise;
    };
    app.preloadChunks = function() {
      if (typeof window === "undefined" || typeof fetch === "undefined") return;
      const context = ctx();
      const opt = context.optimizer;
      if (!opt || !opt.pre_load) return;
      const chunksToPreload = [];
      function collectLazy(n) {
        if (!n) return;
        if (n.LazyRoute) {
          chunksToPreload.push({ route: n.LazyRoute.route, chunk_url: n.LazyRoute.chunk_url });
        }
        if (n.Element?.children) n.Element.children.forEach(collectLazy);
        if (n.Loop?.body) n.Loop.body.forEach(collectLazy);
        if (n.Conditional?.body) n.Conditional.body.forEach(collectLazy);
        if (n.Match?.cases) n.Match.cases.forEach((c) => (c.body || []).forEach(collectLazy));
        if (n.ComponentScope?.body) collectLazy(n.ComponentScope.body);
        if (n.MemoryBinding?.body) n.MemoryBinding.body.forEach(collectLazy);
      }
      collectLazy(context.pageTree);
      const runPreload = () => {
        chunksToPreload.forEach(({ route, chunk_url }) => {
          const cleanRoute = route.toLowerCase();
          if (!loadedChunks[cleanRoute] && !loadingChunks[cleanRoute]) {
            fetch(hostedUrl(chunk_url)).then((r) => r.json()).then((data) => {
              loadedChunks[cleanRoute] = data;
            }).catch(() => {
            });
          }
        });
      };
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(runPreload, { timeout: 2e3 });
      } else {
        setTimeout(runPreload, 300);
      }
    };
    initContext({
      pageTree: config.pageTree,
      derivedDefinitions: config.derivedDefinitions,
      helperDefinitions: config.helperDefinitions,
      actionDefinitions: config.actionDefinitions,
      i18nData: config.i18nData,
      app,
      isRendering: false,
      memorySubscriptions: {},
      navigator: config.navigator || null,
      initialState: JSON.parse(JSON.stringify(config.stateJson || {})),
      emitters: config.emitters || {},
      seo: config.seo || null,
      optimizer: config.optimizer || null,
      loadedChunks,
      loadingChunks
    });
    app.state = makeReactive(
      Object.assign({}, config.stateJson, { i18n: config.i18nData })
    );
    if (config.navigator) {
      setupNavigator(config.navigator, app);
    } else if (config.seo) {
      updateSeoMetadata("home");
    }
    if (config.optimizer?.pre_load && app.preloadChunks) {
      app.preloadChunks();
    }
    const originalRender = app.render;
    app.render = function() {
      setWindowProp("__renderingComponent", "app");
      originalRender.call(this);
      setWindowProp("__renderingComponent", null);
    };
    let activeTimerId = null;
    app.startTimer = function(action, ms) {
      if (activeTimerId !== null) clearInterval(activeTimerId);
      activeTimerId = setInterval(() => {
        app.invokeAction(action, []);
      }, ms);
    };
    app.stopTimer = function() {
      if (activeTimerId !== null) {
        clearInterval(activeTimerId);
        activeTimerId = null;
      }
    };
    setupMemoryUpdateListener();
    bindEvent("click");
    bindEvent("change");
    bindEvent("input");
    bindEvent("pointerdown");
    bindEvent("pointerup");
    bindEvent("pointerleave");
    bindEvent("pointercancel");
    bindEvent("touchstart");
    bindEvent("touchend");
    if (config.keys && typeof window !== "undefined") {
      window.addEventListener("keydown", (event) => {
        const keyMap = config.keys;
        const action = keyMap[event.code] || keyMap[event.key] || keyMap[event.key.toLowerCase()] || keyMap[event.code.toLowerCase()];
        if (action) {
          event.preventDefault();
          app.invokeAction(action, []);
        }
      });
    }
    if (config.timer) {
      const match = String(config.timer).trim().match(/^([A-Za-z_][\w-]*)\s*([0-9]*\.?[0-9]+)\s*(ms|s)?$/i);
      if (match) {
        const action = match[1];
        let ms = Number(match[2]);
        if (match[3]?.toLowerCase() === "s") ms *= 1e3;
        app.startTimer(action, ms);
      }
    }
    if (config.wsEndpoint) {
      setupWebSocket(config.wsEndpoint, app);
    }
    setWindowProp("runeWebApp", app);
    setWindowProp("audioSync", audioSync);
    setWindowProp("playSound", playSound);
    setWindowProp("playMusic", playMusic);
    setWindowProp("stopMusic", stopMusic);
    setWindowProp("pauseMusic", pauseMusic);
    setWindowProp("resumeMusic", resumeMusic);
    setWindowProp("registerSounds", registerSounds);
    setWindowProp("registerMusic", registerMusic);
    if (typeof window !== "undefined") {
      window.__RuneWeb = {
        ctx,
        app,
        audioSync
      };
    }
    if (typeof document !== "undefined") {
      document.addEventListener("fullscreenchange", () => {
        const isFs = Boolean(
          document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement
        );
        if (isFs) {
          document.body.setAttribute("data-fullscreen", "true");
          document.body.classList.add("fullscreen");
        } else {
          document.body.removeAttribute("data-fullscreen");
          document.body.classList.remove("fullscreen");
        }
        if (typeof app.state?.is_fullscreen !== "undefined") {
          app.state.is_fullscreen = isFs;
          app.render();
        }
      });
    }
    if (app.state && app.state.active_voice) {
      const voice = String(app.state.active_voice);
      const score = app.state[voice + "_track"];
      if (score && !app.state.active_steps) {
        const timeSig = String(app.state.time_signature || "4/4");
        const selectedBar = Number(app.state.selected_bar ?? 0);
        app.state.active_steps = parseTrackToSteps(String(score), Number(app.state.selected_step_id ?? -1), timeSig, selectedBar);
      }
    }
    app.render();
    return app;
  }
  function setupWebSocket(endpoint, app) {
    setWindowProp("__runeWebEmit", function(eventName, payload) {
      const ws2 = getWindowProp("__runeWebSocket");
      if (!ws2 || ws2.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket not connected");
        return;
      }
      ws2.send(JSON.stringify({ type: eventName, payload: payload || {} }));
    });
    const ws = new WebSocket(endpoint);
    setWindowProp("__runeWebSocket", ws);
    ws.onmessage = function(event) {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "memory_update") {
          app.state[message.key] = message.value;
          if (app.state && app.state.active_voice) {
            const voice = String(app.state.active_voice);
            const score = app.state[voice + "_track"];
            if (score && !app.state.active_steps) {
              const timeSig = String(app.state.time_signature || "4/4");
              const selectedBar = Number(app.state.selected_bar ?? 0);
              app.state.active_steps = parseTrackToSteps(String(score), Number(app.state.selected_step_id ?? -1), timeSig, selectedBar);
            }
          }
          app.render();
        }
      } catch (_err) {
      }
    };
    ws.onerror = function(error) {
      console.error("WebSocket error:", error);
    };
  }
  return __toCommonJS(index_exports);
})();
