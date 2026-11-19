"use strict";
var __RuneVect = (() => {
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

  // src/vect.ts
  var vect_exports = {};
  __export(vect_exports, {
    run: () => run
  });

  // src/pixel3d/entities.ts
  var active;
  var groups = /* @__PURE__ */ new WeakMap();
  var movementLog = Array(4096);
  function entitiesChanged(value) {
    if (value && typeof value === "object") {
      const group = groups.get(value);
      if (group) group.version++;
    }
    if (Array.isArray(value)) for (const index of active?.indices.get(value)?.values() ?? []) index.dirty = true;
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
            const escapes = { n: "\n", r: "\r", t: "	", b: "\b", f: "\f", "/": "/", "\\": "\\", '"': '"', "'": "'" };
            if (e === "u") {
              const hex = source.slice(i, i + 4);
              if (!/^[\da-fA-F]{4}$/.test(hex)) throw new Error("Invalid Unicode escape");
              value += String.fromCharCode(parseInt(hex, 16));
              i += 4;
              continue;
            }
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
    let pos = 0, depth = 0;
    const peek = () => tokens[pos].value;
    const take = () => tokens[pos++];
    const expect = (s) => {
      if (take().value !== s) throw new Error(`Expected ${s}`);
    };
    function expression(min = 0) {
      if (++depth > 128) throw new Error("Expression nesting exceeds 128");
      const t = take();
      let left;
      if (t.kind === "number") left = { kind: "literal", value: Number(t.value) };
      else if (t.kind === "string") left = { kind: "literal", value: t.value };
      else if (["true", "false", "null"].includes(t.value)) left = { kind: "literal", value: JSON.parse(t.value) };
      else if (["-", "+", "!", "not"].includes(t.value)) left = { kind: "unary", value: t.value, items: [expression(8)] };
      else if (t.value === "(") {
        left = expression();
        expect(")");
      } else if (t.value === "grid" && !["", ".", "["].includes(peek())) {
        const cols = expression(8);
        expect("x");
        const rows = expression(8);
        if (!["at", "from"].includes(take().value)) throw new Error("Expected at or from");
        expect("(");
        const x = expression();
        expect(",");
        const y = expression();
        expect(")");
        expect("step");
        expect("(");
        const dx = expression();
        expect(",");
        const dy = expression();
        expect(")");
        let overrides = { kind: "object", items: [] };
        if (peek() === "with") {
          take();
          overrides = expression(8);
        }
        left = { kind: "grid", items: [cols, rows, x, y, dx, dy, overrides] };
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
          let value;
          if (peek() === ":") {
            take();
            value = expression();
          } else if (key.kind === "id" && [",", "}"].includes(peek())) value = { kind: "id", value: key.value };
          else throw new Error("Expected : after object key");
          items.push([safeKey(key.value), value]);
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
          if (peek() === "]") {
            take();
            const key = take();
            if (key.kind !== "id") throw new Error("Expected lookup property after []");
            left = { kind: "lookup", value: safeKey(key.value), items: [left] };
          } else {
            const key = expression();
            expect("]");
            left = { kind: "member", items: [left, key] };
          }
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
        if (min <= 0 && ["with", "all"].includes(peek())) {
          take();
          left = { kind: "overlay", items: [left, expression(8)] };
          continue;
        }
        if (peek() === "*" && min <= 7 && left.kind === "object") {
          take();
          const count = expression(8);
          const props = [];
          let step = { kind: "literal", value: 0 };
          if (peek() === "inc") {
            take();
            const parens = peek() === "(";
            if (parens) take();
            do {
              const key = take();
              if (!["id", "string"].includes(key.kind)) throw new Error("Expected increment property");
              props.push(safeKey(key.value));
              if (peek() !== ",") break;
              take();
            } while (true);
            if (parens) expect(")");
            expect("by");
            step = expression(8);
          }
          let overrides = { kind: "object", items: [] };
          if (peek() === "with") {
            take();
            overrides = expression(8);
          }
          left = { kind: "generate", props, items: [left, count, step, overrides] };
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
      depth--;
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
    return void 0;
  }
  function evaluateCoreExpression(e, scope, functions = coreFunctions) {
    const ev = (n) => evaluateCoreExpression(n, scope, functions);
    switch (e.kind) {
      case "literal":
        return e.value;
      case "id":
        return scope[e.value];
      case "array":
        return e.items.flatMap((item) => {
          const value = ev(item);
          return expandsCollection(item) && Array.isArray(value) ? value : [value];
        });
      case "object":
        return Object.fromEntries(e.items.map(([k, v]) => [k, ev(v)]));
      case "member":
        return ev(e.items[0])?.[safeKey(ev(e.items[1]))];
      case "lookup": {
        const source = ev(e.items[0]);
        if (scope[e.value] === void 0) return void 0;
        return Array.isArray(source) ? source.find((item) => String(item?.[e.value]) === String(scope[e.value])) : void 0;
      }
      case "overlay":
        return overlay(ev(e.items[0]), ev(e.items[1]));
      case "generate": {
        const count = collectionCount(ev(e.items[1]));
        const step = finiteNumber(ev(e.items[2]));
        return Array.from({ length: count }, (_, i) => {
          const local = { ...scope, i };
          const item = cloneData(evaluateCoreExpression(e.items[0], local, functions));
          for (const prop of e.props) if (typeof item[prop] === "number") item[prop] += i * step;
          return overlay(item, evaluateCoreExpression(e.items[3], local, functions));
        });
      }
      case "grid": {
        const [cols, rows] = e.items.slice(0, 2).map((item) => collectionCount(ev(item)));
        const count = collectionCount(cols * rows);
        const [x, y, dx, dy] = e.items.slice(2, 6).map((item) => finiteNumber(ev(item)));
        return Array.from({ length: count }, (_, i) => {
          const col = i % cols, row = Math.floor(i / cols);
          const item = { x: x + col * dx, y: y + row * dy, start_x: x + col * dx, start_y: y + row * dy, col, row };
          return overlay(item, evaluateCoreExpression(e.items[6], { ...scope, i, col, row, c: col, r: row }, functions));
        });
      }
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
  function expandsCollection(e) {
    return e.kind === "generate" || e.kind === "grid" || e.kind === "overlay";
  }
  function collectionCount(value) {
    if (!Number.isInteger(value) || value < 0 || value > 1e6) throw new Error("Invalid generator count (0..1000000)");
    return value;
  }
  function finiteNumber(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Generator coordinates and steps must be finite numbers");
    return value;
  }
  function cloneData(value) {
    if (Array.isArray(value)) return value.map(cloneData);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [safeKey(k), cloneData(v)]));
    return value;
  }
  function overlay(source, overrides) {
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) throw new Error("with/all requires an object");
    const copy = (item) => item && typeof item === "object" && !Array.isArray(item) ? { ...cloneData(item), ...cloneData(overrides) } : item;
    if (Array.isArray(source)) return source.map(copy);
    if (!source || typeof source !== "object") throw new Error("with/all requires an object or array");
    return copy(source);
  }
  function assignCoreTarget(target, value, scope, functions = coreFunctions) {
    if (target.kind === "id") {
      scope[safeKey(target.value)] = value;
      return;
    }
    if (target.kind === "lookup") {
      const source = evaluateCoreExpression(target.items[0], scope, functions);
      if (!Array.isArray(source)) throw new Error("Lookup requires an array");
      if (scope[target.value] === void 0) return;
      const index = source.findIndex((item) => String(item?.[target.value]) === String(scope[target.value]));
      if (index >= 0) {
        source[index] = value;
        entitiesChanged(source);
      }
      return;
    }
    if (target.kind !== "member") throw new Error("Invalid assignment target");
    const parent = evaluateCoreExpression(target.items[0], scope, functions);
    if (parent == null && containsLookup(target)) return;
    if (parent == null) throw new Error("Missing assignment receiver");
    parent[safeKey(evaluateCoreExpression(target.items[1], scope, functions))] = value;
  }
  function containsLookup(e) {
    return e.kind === "lookup" || e.kind === "member" && containsLookup(e.items[0]);
  }

  // src/vect.ts
  var text = (v) => v === null || v === void 0 ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  function run(program, host, scriptDir = ".") {
    const globals = { script_dir: scriptDir };
    const actions = /* @__PURE__ */ Object.create(null);
    const cache = /* @__PURE__ */ new Map();
    const statements = /* @__PURE__ */ new Map();
    let depth = 0, budget = 1e8;
    const functions = { ...coreFunctions };
    const ast = (s) => {
      let ast2 = cache.get(s);
      if (!ast2) {
        ast2 = parseCoreExpression(s);
        cache.set(s, ast2);
      }
      return ast2;
    };
    const expr = (s, scope) => evaluateCoreExpression(ast(s), scope, functions);
    const interpolate = (s, scope) => s.replace(/\{([^{}]+)\}/g, (match, key) => {
      try {
        const value = expr(key, scope);
        return value === void 0 ? match : text(value);
      } catch {
        return match;
      }
    });
    const assign = (target, value, scope) => {
      assignCoreTarget(ast(target), value, scope, functions);
    };
    function block(stmts, scope) {
      for (const stmt of stmts) {
        if (--budget <= 0) throw new Error("Vect execution budget exceeded");
        const [kind, s] = Object.entries(stmt)[0];
        try {
          switch (kind) {
            case "Action":
              actions[s.name] = s;
              break;
            case "Print":
              host.print(interpolate(s.text, scope));
              break;
            case "ReadInput":
              assign(s.var_name, host.read(), scope);
              break;
            case "Set": {
              const value = interpolate(s.value, scope);
              let decoded = value;
              if (/^-?\d+(\.\d+)?$/.test(value)) decoded = Number(value);
              else if (["true", "false"].includes(value)) decoded = value === "true";
              assign(s.var_name, decoded, scope);
              break;
            }
            case "Expression": {
              let compiled = statements.get(s.source);
              if (!compiled) {
                const source = s.source.replace(/^(?:local|let)\s+/, "");
                const m = source.match(/^([\w$]+(?:\.[\w$]+|\[\][\w$]+|\[[^\n]+\])*)\s*([+*/%-]?=)(?!=)\s*([\s\S]+)$/);
                compiled = m ? { target: m[1], value: ast(m[2] === "=" ? m[3] : `${m[1]} ${m[2][0]} (${m[3]})`) } : { value: ast(s.source) };
                statements.set(s.source, compiled);
              }
              const value = evaluateCoreExpression(compiled.value, scope, functions);
              if (compiled.target) assign(compiled.target, value, scope);
              break;
            }
            case "IfChain": {
              const branch = s.branches.find((b) => expr(b.condition, scope));
              const flow2 = block(branch ? branch.body : s.else_body, scope);
              if (flow2) return flow2;
              break;
            }
            case "For": {
              const collection = expr(s.collection, scope);
              if (!Array.isArray(collection) && typeof collection !== "string") throw new Error("for requires a collection");
              for (let i = 0; i < collection.length; i++) {
                scope[s.item_name] = collection[i];
                if (s.index_name) scope[s.index_name] = i;
                if (--budget <= 0) throw new Error("Vect execution budget exceeded");
                const flow2 = block(s.body, scope);
                if (flow2?.type === "break") break;
                if (flow2 && flow2.type !== "continue") return flow2;
              }
              break;
            }
            case "While": {
              while (expr(s.condition, scope)) {
                if (--budget <= 0) throw new Error("Vect execution budget exceeded");
                const flow2 = block(s.body, scope);
                if (flow2?.type === "break") break;
                if (flow2 && flow2.type !== "continue") return flow2;
              }
              break;
            }
            case "Return":
              return { type: "return", value: s.value ? expr(s.value, scope) : void 0 };
            case "Break":
              return { type: "break" };
            case "Continue":
              return { type: "continue" };
            case "Stop":
              if (s.message) host.print(interpolate(s.message, scope));
              return { type: "stop" };
            case "Builtin": {
              const args = s.args.map((arg) => Object.prototype.hasOwnProperty.call(scope, arg) ? scope[arg] : interpolate(arg, scope));
              let result;
              if (s.name === "log") {
                result = args.join(" ");
                host.print(result);
              } else if (s.name === "parse-json") result = JSON.parse(scope[s.args[0] || "body"]);
              else if (s.name === "is-set") result = Object.prototype.hasOwnProperty.call(scope, s.args[0]);
              else if (s.name === "delete") {
                delete scope[s.args[0]];
                break;
              } else if (s.name === "to-number") result = Number(args[0]);
              else if (s.name === "to-string") result = text(args[0]);
              else if (s.name === "to-bool") result = args[0] === true || args[0] === 1 || args[0] === "1" || String(args[0]).toLowerCase() === "true";
              else throw new Error(`Unsupported Vect builtin: ${s.name}`);
              if (s.assign_to) scope[s.assign_to] = result;
              else if (s.name === "parse-json") scope[s.args[0] || "body"] = result;
              else scope.___result___ = result;
              break;
            }
            default:
              throw new Error(`Unsupported Vect statement: ${kind}`);
          }
        } catch (e) {
          throw new Error(`Vect line ${s.line_no}: ${e.message}`);
        }
      }
    }
    for (const stmt of program.statements) if (stmt.Action) actions[stmt.Action.name] = stmt.Action;
    for (const name of Object.keys(actions)) functions[name] = (...args) => {
      if (++depth > 128) {
        depth--;
        throw new Error("Vect action recursion exceeds 128 calls");
      }
      const action = actions[name], locals = Object.create(globals);
      action.params.forEach((key, i) => {
        locals[key] = args[i];
      });
      try {
        const flow2 = block(action.body, locals);
        if (flow2 && flow2.type !== "return") throw new Error(`${flow2.type} cannot escape an action`);
        return flow2?.value;
      } finally {
        depth--;
      }
    };
    functions["file.write"] = (path, contents) => host.write(String(path), text(contents));
    functions["db.request"] = (config, source, packet) => {
      if (!host.request) throw new Error("This Vect host does not provide storage access");
      return JSON.parse(host.request(String(config), String(source), JSON.stringify(packet)));
    };
    const flow = block(program.statements, globals);
    if (flow && flow.type !== "stop") throw new Error(`${flow.type} outside action or loop`);
  }
  return __toCommonJS(vect_exports);
})();
