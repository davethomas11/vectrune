// src/parser/lexer.ts
var SECTION_RE = /^@([A-Za-z][A-Za-z0-9_/-]*)(.*)$/;
var SHEBANG_RE = /^#!RUNE\s*$/;
var COMMENT_RE = /^#/;
var IMPORT_RE = /^import\s+"(.+)"\s*$/;
var KV_RE = /^([A-Za-z_][\w.-]*)\s*=\s*(.*)$/;
var BLOCK_HEADER_RE = /^([A-Za-z_][\w-]*):\s*(?:#.*)?$/;
function countLeadingSpaces(line) {
  let i = 0;
  while (i < line.length && line[i] === " ") i++;
  return i;
}
function tokenize(source) {
  const lines = source.split(/\r?\n/);
  const tokens = [];
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNum = i + 1;
    const indent = countLeadingSpaces(rawLine);
    const trimmed = rawLine.slice(indent);
    if (trimmed === "") {
      tokens.push({ kind: "Blank", raw: rawLine, indent, line: lineNum });
      continue;
    }
    if (indent === 0) {
      if (SHEBANG_RE.test(trimmed)) {
        tokens.push({ kind: "Shebang", raw: trimmed, indent: 0, line: lineNum });
        continue;
      }
      if (COMMENT_RE.test(trimmed)) {
        tokens.push({ kind: "Comment", raw: trimmed, indent: 0, line: lineNum });
        continue;
      }
      const importMatch = trimmed.match(IMPORT_RE);
      if (importMatch) {
        tokens.push({ kind: "Import", raw: importMatch[1], indent: 0, line: lineNum });
        continue;
      }
      const sectionMatch = trimmed.match(SECTION_RE);
      if (sectionMatch) {
        tokens.push({ kind: "Section", raw: trimmed, indent: 0, line: lineNum });
        continue;
      }
      if (BLOCK_HEADER_RE.test(trimmed)) {
        tokens.push({ kind: "BlockHeader", raw: trimmed, indent: 0, line: lineNum });
        continue;
      }
      if (KV_RE.test(trimmed)) {
        tokens.push({ kind: "KeyValue", raw: trimmed, indent: 0, line: lineNum });
        continue;
      }
      tokens.push({ kind: "BlockLine", raw: trimmed, indent: 0, line: lineNum });
      continue;
    }
    if (BLOCK_HEADER_RE.test(trimmed)) {
      tokens.push({ kind: "BlockHeader", raw: trimmed, indent, line: lineNum });
      continue;
    }
    tokens.push({ kind: "BlockLine", raw: trimmed, indent, line: lineNum });
  }
  return tokens;
}

// src/parser/section-parser.ts
var BUILTIN_NAMES = /* @__PURE__ */ new Set([
  "log",
  "respond",
  "return",
  "parse-json",
  "validate",
  "csv.read",
  "csv.write",
  "csv.append",
  "json.read",
  "json.write",
  "memory.set",
  "memory.get",
  "memory.clear",
  "memory.del",
  "set-memory",
  "get-memory",
  "clear-memory",
  "del-memory",
  "append",
  "memory.append",
  "load-rune",
  "is-set",
  "delete",
  "ws.id",
  "ws.send",
  "ws.broadcast",
  "broadcast-websocket",
  "stop"
]);
function parseRunSteps(lines, baseIndent) {
  const steps = [];
  let i = 0;
  while (i < lines.length) {
    const { text, indent } = lines[i];
    if (indent < baseIndent) break;
    if (indent > baseIndent) {
      i++;
      continue;
    }
    i++;
    if (text.startsWith("if ") && text.endsWith(":")) {
      const condition = text.slice(3, -1).trim();
      const bodyLines = [];
      while (i < lines.length && lines[i].indent > baseIndent) {
        bodyLines.push(lines[i]);
        i++;
      }
      const bodyIndent = bodyLines.length > 0 ? bodyLines[0].indent : baseIndent + 4;
      const body = parseRunSteps(bodyLines, bodyIndent);
      const step = { kind: "if", condition, body };
      steps.push(step);
      continue;
    }
    const assignMatch = text.match(/^(.+?)(?<![!<>=])=(?!=)(.*)$/);
    if (assignMatch && !text.match(/^.+?\.push\(/)) {
      const lhs = assignMatch[1].trim();
      const rhs = assignMatch[2].trim();
      if (/^[A-Za-z_][\w.\-[\]()]*$/.test(lhs) && !lhs.includes(" ")) {
        const rhsFirst = rhs.split(/\s+/)[0];
        if (BUILTIN_NAMES.has(rhsFirst)) {
          const builtinArgs = rhs.slice(rhsFirst.length).trim();
          const step = {
            kind: "assignment",
            lhs,
            rhs: builtinArgs ? `${rhsFirst} ${builtinArgs}` : rhsFirst
          };
          steps.push(step);
        } else {
          const step = { kind: "assignment", lhs, rhs };
          steps.push(step);
        }
        continue;
      }
    }
    const pushMatch = text.match(/^(.+?)\.push\((.+)\)$/);
    if (pushMatch) {
      steps.push({ kind: "raw", text });
      continue;
    }
    const firstToken = text.split(/\s+/)[0];
    if (BUILTIN_NAMES.has(firstToken)) {
      const rest = text.slice(firstToken.length).trim();
      const args = parseBuiltinArgs(rest);
      const step = { kind: "builtin", name: firstToken, args };
      steps.push(step);
      continue;
    }
    steps.push({ kind: "raw", text });
  }
  return steps;
}
function parseBuiltinArgs(raw) {
  if (!raw) return [];
  const args = [];
  let current = "";
  let inString = false;
  let stringChar = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      current += ch;
      if (ch === stringChar) inString = false;
    } else if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      current += ch;
    } else if (ch === " " || ch === "	") {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}
function parseKeyValue(raw) {
  const eqIdx = raw.indexOf("=");
  if (eqIdx === -1) return [raw.trim(), ""];
  const key = raw.slice(0, eqIdx).trim();
  const valStr = raw.slice(eqIdx + 1).trim();
  if (valStr.startsWith("{") || valStr.startsWith("[")) {
    try {
      return [key, JSON.parse(valStr)];
    } catch (_) {
    }
  }
  return [key, valStr];
}
function parseSections(source) {
  const tokens = tokenize(source);
  const doc = {
    shebang: false,
    imports: [],
    app: null,
    schemas: {},
    routes: [],
    rawSections: {}
  };
  const sectionBoundaries = [];
  let preambleEnd = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.kind === "Shebang") {
      doc.shebang = true;
      preambleEnd = i + 1;
      continue;
    }
    if (tok.kind === "Import") {
      doc.imports.push(tok.raw);
      preambleEnd = i + 1;
      continue;
    }
    if (tok.kind === "Comment" || tok.kind === "Blank") {
      if (sectionBoundaries.length === 0) preambleEnd = i + 1;
      continue;
    }
    if (tok.kind === "Section") {
      if (sectionBoundaries.length > 0) {
        sectionBoundaries[sectionBoundaries.length - 1].endIdx = i;
      }
      sectionBoundaries.push({ sectionRaw: tok.raw, startIdx: i + 1, endIdx: tokens.length });
    }
  }
  for (const boundary of sectionBoundaries) {
    const sectionLine = boundary.sectionRaw;
    const sectionTokens = tokens.slice(boundary.startIdx, boundary.endIdx).filter((t) => t.kind !== "Blank" && t.kind !== "Comment");
    const sectionMatch = sectionLine.match(/^@([A-Za-z][A-Za-z0-9_-]*)(?:\/(.+))?$/);
    if (!sectionMatch) continue;
    const sectionType = sectionMatch[1];
    const sectionSub = sectionMatch[2]?.trim() ?? "";
    if (sectionType === "App") {
      doc.app = parseAppSection(sectionTokens);
    } else if (sectionType === "Schema") {
      const schemaName = sectionSub;
      doc.schemas[schemaName] = parseSchemaSection(sectionTokens);
    } else if (sectionType === "Route") {
      const route = parseRouteSection(sectionSub, sectionTokens);
      if (route) doc.routes.push(route);
    } else {
      const kvData = {};
      for (const tok of sectionTokens) {
        if (tok.kind === "KeyValue") {
          const [k, v] = parseKeyValue(tok.raw);
          kvData[k] = v;
        }
      }
      const key = sectionSub ? `${sectionType}/${sectionSub}` : sectionType;
      doc.rawSections[key] = kvData;
    }
  }
  return doc;
}
function parseAppSection(tokens) {
  const app = {
    name: "",
    type: "REST",
    run: []
  };
  let inRunBlock = false;
  let runBlockIndent = -1;
  const runLines = [];
  for (const tok of tokens) {
    if (tok.kind === "BlockHeader" && tok.raw.replace(/:.*/, "") === "run") {
      inRunBlock = true;
      runBlockIndent = -1;
      continue;
    }
    if (inRunBlock && tok.kind === "BlockLine") {
      if (runBlockIndent === -1) runBlockIndent = tok.indent;
      runLines.push({ text: tok.raw, indent: tok.indent });
      continue;
    }
    if (tok.kind === "KeyValue" && !inRunBlock) {
      const [k, v] = parseKeyValue(tok.raw);
      if (k === "name") app.name = String(v);
      else if (k === "type") app.type = String(v);
      else if (k === "version") app.version = String(v);
      else app[k] = v;
    }
  }
  if (runLines.length > 0) {
    app.run = parseRunSteps(runLines, runBlockIndent === -1 ? runLines[0]?.indent ?? 4 : runBlockIndent);
  }
  return app;
}
function parseSchemaSection(tokens) {
  const schema = { fields: {} };
  let inFieldsBlock = false;
  for (const tok of tokens) {
    if (tok.kind === "BlockHeader" && tok.raw.replace(/:.*/, "") === "fields") {
      inFieldsBlock = true;
      continue;
    }
    if (inFieldsBlock && tok.kind === "BlockLine") {
      const colonMatch = tok.raw.match(/^([A-Za-z_]\w*)\s*:\s*(.+)$/);
      if (colonMatch) {
        schema.fields[colonMatch[1]] = colonMatch[2].trim();
      }
      continue;
    }
    if (tok.kind === "KeyValue") {
      const eqIdx = tok.raw.indexOf("=");
      if (eqIdx !== -1) {
        const fieldName = tok.raw.slice(0, eqIdx).trim();
        const fieldType = tok.raw.slice(eqIdx + 1).trim();
        schema.fields[fieldName] = fieldType;
      }
    }
  }
  return schema;
}
function parseRouteSection(subPath, tokens) {
  const parts = subPath.match(/^([A-Z]+)\s+(.+)$/);
  if (!parts) return null;
  const method = parts[1];
  const path = parts[2].trim();
  const route = {
    method,
    path,
    run: [],
    meta: {}
  };
  let inRunBlock = false;
  let runBlockIndent = -1;
  const runLines = [];
  for (const tok of tokens) {
    if (tok.kind === "BlockHeader" && tok.raw.replace(/:.*/, "") === "run") {
      inRunBlock = true;
      runBlockIndent = -1;
      continue;
    }
    if (inRunBlock) {
      if (tok.kind === "BlockLine" || tok.kind === "BlockHeader") {
        if (runBlockIndent === -1) runBlockIndent = tok.indent;
        runLines.push({ text: tok.raw, indent: tok.indent });
        continue;
      }
    }
    if (!inRunBlock && tok.kind === "KeyValue") {
      const eqIdx = tok.raw.indexOf("=");
      if (eqIdx !== -1) {
        const k = tok.raw.slice(0, eqIdx).trim();
        const v = tok.raw.slice(eqIdx + 1).trim();
        if (k === "expect") route.expect = v;
        else route.meta[k] = v;
      }
    }
  }
  if (runLines.length > 0) {
    route.run = parseRunSteps(runLines, runBlockIndent === -1 ? runLines[0]?.indent ?? 4 : runBlockIndent);
  }
  return route;
}

// src/engine/context.ts
function createRequestContext(req, pathParams, schemas, fileStore, memoryStore) {
  return {
    method: req.method,
    path: req.path,
    pathParams,
    body: req.body ?? null,
    parsedBody: null,
    state: {},
    logs: [],
    response: null,
    schemas,
    fileStore,
    memoryStore
  };
}
function buildScopeFromContext(ctx) {
  return {
    ...ctx.state,
    body: ctx.parsedBody ?? ctx.body,
    path: {
      params: ctx.pathParams
    },
    // Also expose path params at the top level (e.g. {id} in the path)
    ...ctx.pathParams
  };
}

// src/engine/evaluate.ts
var MAX_DEPTH = 64;
function valueToString(v) {
  if (v === null || v === void 0) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function normalizeLiteral(s) {
  const t = s.trim();
  if (t.startsWith('"') && t.endsWith('"') || t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1);
  }
  return t;
}
function splitTopLevel(s, delim) {
  const results = [];
  let depth = 0;
  let inStr = false;
  let strChar = "";
  let start = 0;
  const dLen = delim.length;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === strChar) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = true;
      strChar = ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      depth--;
      continue;
    }
    if (depth === 0 && s.slice(i, i + dLen) === delim) {
      results.push(s.slice(start, i));
      start = i + dLen;
      i += dLen - 1;
    }
  }
  results.push(s.slice(start));
  return results;
}
function includesTopLevel(s, delim) {
  return splitTopLevel(s, delim).length > 1;
}
function splitPathSegments(expr) {
  const segs = [];
  let i = 0;
  let current = "";
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === ".") {
      if (expr.slice(i, i + 4) === "[].(") {
        if (current) {
          segs.push(current);
          current = "";
        }
        const close = expr.indexOf(")", i + 4);
        if (close !== -1) {
          segs.push(expr.slice(i + 1, close + 1));
          i = close + 1;
        } else {
          i++;
        }
        continue;
      }
      if (current) {
        segs.push(current);
        current = "";
      }
      i++;
      continue;
    }
    if (ch === "[") {
      if (current) {
        segs.push(current);
        current = "";
      }
      const close = expr.indexOf("]", i + 1);
      if (close !== -1) {
        segs.push(expr.slice(i, close + 1));
        i = close + 1;
      } else {
        i++;
      }
      continue;
    }
    current += ch;
    i++;
  }
  if (current) segs.push(current);
  return segs;
}
function resolvePath(expr, scope) {
  const segments = splitPathSegments(expr);
  if (!segments.length) return void 0;
  let current = scope[segments[0]];
  if (current === void 0) return void 0;
  for (let i = 1; i < segments.length; i++) {
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
function tryParseLiteral(expr) {
  const t = expr.trim();
  if (t === "") return void 0;
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (!Number.isNaN(Number(t)) && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t.startsWith('"') && t.endsWith('"') || t.startsWith("'") && t.endsWith("'")) {
    return normalizeLiteral(t);
  }
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      return JSON.parse(t);
    } catch (_) {
      return void 0;
    }
  }
  return void 0;
}
function resolveValue(expr, scope) {
  const lit = tryParseLiteral(expr);
  if (lit !== void 0) return lit;
  const path = resolvePath(expr, scope);
  if (path !== void 0) return path;
  return normalizeLiteral(expr);
}
function evaluateExpression(expr, scope, depth = 0) {
  if (depth > MAX_DEPTH) return void 0;
  const next = depth + 1;
  let t = String(expr ?? "").trim();
  if (!t) return void 0;
  while (t.startsWith("(") && t.endsWith(")")) {
    let d = 0;
    let matched = true;
    for (let i = 0; i < t.length - 1; i++) {
      if (t[i] === "(") d++;
      if (t[i] === ")") d--;
      if (d === 0) {
        matched = false;
        break;
      }
    }
    if (!matched) break;
    t = t.slice(1, -1).trim();
  }
  if (t.startsWith("!")) {
    return !Boolean(evaluateExpression(t.slice(1).trim(), scope, next));
  }
  const methodMatch = t.match(
    /^(.+?)\.(any|filter|find|find-index|max|min|sum|mask)(?:\(([^)]*)\)|\s+(.+?))(?:\.(length))?$/
  );
  if (methodMatch) {
    const [, receiver, method, parenArgs, spaceArgs, trailingProp] = methodMatch;
    const argsStr = (parenArgs !== void 0 ? parenArgs : spaceArgs ?? "").trim();
    const collection = evaluateExpression(receiver, scope, next);
    let result = void 0;
    if (Array.isArray(collection)) {
      if (method === "mask") {
        const player = valueToString(evaluateExpression(argsStr, scope, next));
        result = collection.reduce((acc, cell, i) => {
          return valueToString(cell) === player ? acc | 1 << i : acc;
        }, 0);
      } else if (method === "any" || method === "filter" || method === "find" || method === "find-index") {
        const arrowMatch = argsStr.match(/^(\w+)\s*=>\s*(.+)$/);
        const [paramName, predExpr] = arrowMatch ? [arrowMatch[1], arrowMatch[2]] : ["it", argsStr];
        if (method === "any") {
          result = collection.some((item) => {
            return Boolean(evaluateExpression(predExpr, Object.assign({}, scope, { [paramName]: item }), next));
          });
        } else if (method === "filter") {
          result = collection.filter((item) => {
            return Boolean(evaluateExpression(predExpr, Object.assign({}, scope, { [paramName]: item }), next));
          });
        } else if (method === "find") {
          result = collection.find((item) => {
            return Boolean(evaluateExpression(predExpr, Object.assign({}, scope, { [paramName]: item }), next));
          }) ?? null;
        } else if (method === "find-index") {
          result = collection.findIndex((item) => {
            return Boolean(evaluateExpression(predExpr, Object.assign({}, scope, { [paramName]: item }), next));
          });
        }
      } else if (method === "max") {
        result = collection.reduce((max, item) => {
          const val = evaluateExpression(argsStr, Object.assign({}, scope, { it: item }), next);
          return max === void 0 || val > max ? val : max;
        }, void 0);
      } else if (method === "min") {
        result = collection.reduce((min, item) => {
          const val = evaluateExpression(argsStr, Object.assign({}, scope, { it: item }), next);
          return min === void 0 || val < min ? val : min;
        }, void 0);
      } else if (method === "sum") {
        result = collection.reduce((sum, item) => {
          return sum + Number(evaluateExpression(argsStr, Object.assign({}, scope, { it: item }), next) ?? 0);
        }, 0);
      }
    }
    if (trailingProp === "length" && result !== void 0 && typeof result.length !== "undefined") {
      return result.length;
    }
    return result;
  }
  if (includesTopLevel(t, " ? ")) {
    const parts = splitTopLevel(t, " ? ");
    const condition = parts[0];
    const rest = parts.slice(1).join(" ? ");
    if (includesTopLevel(rest, " : ")) {
      const colonParts = splitTopLevel(rest, " : ");
      return Boolean(evaluateExpression(condition, scope, next)) ? evaluateExpression(colonParts[0], scope, next) : evaluateExpression(colonParts.slice(1).join(" : "), scope, next);
    }
  }
  if (includesTopLevel(t, " or ")) {
    return splitTopLevel(t, " or ").some((p) => Boolean(evaluateExpression(p, scope, next)));
  }
  if (includesTopLevel(t, " and ")) {
    return splitTopLevel(t, " and ").every((p) => Boolean(evaluateExpression(p, scope, next)));
  }
  if (includesTopLevel(t, " != ")) {
    const [l, r] = splitTopLevel(t, " != ");
    return valueToString(evaluateExpression(l, scope, next)) !== valueToString(evaluateExpression(r, scope, next));
  }
  if (includesTopLevel(t, " == ")) {
    const [l, r] = splitTopLevel(t, " == ");
    return valueToString(evaluateExpression(l, scope, next)) === valueToString(evaluateExpression(r, scope, next));
  }
  if (includesTopLevel(t, " >= ")) {
    const [l, r] = splitTopLevel(t, " >= ");
    return evaluateExpression(l, scope, next) >= evaluateExpression(r, scope, next);
  }
  if (includesTopLevel(t, " <= ")) {
    const [l, r] = splitTopLevel(t, " <= ");
    return evaluateExpression(l, scope, next) <= evaluateExpression(r, scope, next);
  }
  if (includesTopLevel(t, " > ")) {
    const [l, r] = splitTopLevel(t, " > ");
    return evaluateExpression(l, scope, next) > evaluateExpression(r, scope, next);
  }
  if (includesTopLevel(t, " < ")) {
    const [l, r] = splitTopLevel(t, " < ");
    return evaluateExpression(l, scope, next) < evaluateExpression(r, scope, next);
  }
  if (includesTopLevel(t, " + ")) {
    return splitTopLevel(t, " + ").reduce((acc, part, idx) => {
      const val = evaluateExpression(part, scope, next);
      if (idx === 0) return val;
      if (typeof acc === "number" && typeof val === "number") return acc + val;
      return `${valueToString(acc)}${valueToString(val)}`;
    }, void 0);
  }
  if (includesTopLevel(t, " - ")) {
    const parts = splitTopLevel(t, " - ");
    const first = evaluateExpression(parts[0], scope, next);
    return parts.slice(1).reduce((acc, p) => acc - evaluateExpression(p, scope, next), first);
  }
  if (includesTopLevel(t, " * ")) {
    const parts = splitTopLevel(t, " * ");
    return parts.reduce((acc, p, idx) => {
      const val = evaluateExpression(p, scope, next);
      return idx === 0 ? val : acc * val;
    }, 1);
  }
  if (includesTopLevel(t, " / ")) {
    const parts = splitTopLevel(t, " / ");
    const first = evaluateExpression(parts[0], scope, next);
    return parts.slice(1).reduce((acc, p) => acc / evaluateExpression(p, scope, next), first);
  }
  if (includesTopLevel(t, " & ")) {
    const parts = splitTopLevel(t, " & ");
    if (parts.length === 2) {
      return evaluateExpression(parts[0], scope, next) & evaluateExpression(parts[1], scope, next);
    }
  }
  if (t.startsWith("full ")) {
    const collection = evaluateExpression(t.slice(5), scope, next);
    return Array.isArray(collection) && collection.every((item) => valueToString(item) !== "");
  }
  if (t.startsWith("swap ")) {
    const tokens = t.split(/\s+/);
    const current = valueToString(evaluateExpression(tokens[1], scope, next));
    const left = valueToString(evaluateExpression(tokens[2], scope, next));
    const right = valueToString(evaluateExpression(tokens[3], scope, next));
    return current === left ? right : left;
  }
  return resolveValue(t, scope);
}

// src/engine/builtins.ts
var RESPONDED = Symbol("RESPONDED");
function expandPlaceholders(template, scope) {
  return template.replace(/\{([^}]+)\}/g, (_match, expr) => {
    const val = evaluateExpression(expr.trim(), scope);
    return val !== void 0 ? valueToString(val) : `{${expr}}`;
  });
}
function validate(args, ctx) {
  if (!args.length) return;
  const firstArg = args[0];
  const scope = buildScopeFromContext(ctx);
  const schemaRef = args.find((a) => a.startsWith("#"));
  if (schemaRef) {
    const schemaName = schemaRef.slice(1);
    const schema = ctx.schemas[schemaName];
    const dataExpr = args.filter((a) => !a.startsWith("#")).join(" ");
    const data = evaluateExpression(dataExpr || firstArg, scope);
    if (!schema || !data || typeof data !== "object") {
      ctx.response = {
        status: 400,
        body: schema ? `Invalid data for schema ${schemaName}` : `Unknown schema: ${schemaName}`,
        logs: ctx.logs
      };
      return;
    }
    for (const [field, fieldType] of Object.entries(schema.fields)) {
      if (!(field in data)) {
        ctx.response = {
          status: 400,
          body: `Missing required field: ${field}`,
          logs: ctx.logs
        };
        return;
      }
      const val = data[field];
      if (fieldType === "number" && typeof val !== "number" && isNaN(Number(val))) {
        ctx.response = {
          status: 400,
          body: `Field ${field} must be a number`,
          logs: ctx.logs
        };
        return;
      }
    }
    return;
  }
  const msgArg = args.find((a) => a.startsWith('"') || a.startsWith("'"));
  const conditionParts = args.filter((a) => a !== msgArg);
  const condition = conditionParts.join(" ");
  const message = msgArg ? msgArg.slice(1, -1) : "Validation failed";
  if (!Boolean(evaluateExpression(condition, scope))) {
    ctx.response = {
      status: 400,
      body: message,
      logs: ctx.logs
    };
  }
}
function parseCsvKey(arg) {
  return arg.replace(/^["']|["']$/g, "");
}
function executeBuiltin(name, args, ctx, assignTarget) {
  const scope = buildScopeFromContext(ctx);
  if (name === "log") {
    const raw = args.map((a) => a.replace(/^["']|["']$/g, "")).join(" ");
    const expanded = expandPlaceholders(raw, scope);
    ctx.logs.push(expanded);
    return void 0;
  }
  if (name === "respond" || name === "return") {
    let status = 200;
    let bodyExpr;
    if (args.length >= 2 && /^\d{3}$/.test(args[0])) {
      status = Number(args[0]);
      bodyExpr = args.slice(1).join(" ");
    } else {
      bodyExpr = args.join(" ");
    }
    const body = evaluateExpression(bodyExpr, scope);
    ctx.response = { status, body, logs: ctx.logs };
    return RESPONDED;
  }
  if (name === "parse-json") {
    const sourceExpr = args[0];
    let rawStr;
    if (sourceExpr) {
      const val = evaluateExpression(sourceExpr, scope);
      rawStr = typeof val === "string" ? val : JSON.stringify(val);
    } else {
      rawStr = ctx.body ?? "";
    }
    let parsed;
    try {
      parsed = JSON.parse(rawStr);
    } catch (_) {
      parsed = rawStr;
    }
    if (assignTarget) {
      ctx.state[assignTarget] = parsed;
    } else {
      ctx.parsedBody = parsed;
      ctx.state["body"] = parsed;
    }
    return parsed;
  }
  if (name === "validate") {
    validate(args, ctx);
    if (ctx.response) return RESPONDED;
    return void 0;
  }
  if (name === "csv.read") {
    const filename = parseCsvKey(args[0] ?? "");
    const data = ctx.fileStore[filename] ?? [];
    if (assignTarget) ctx.state[assignTarget] = data;
    return data;
  }
  if (name === "csv.write") {
    const filename = parseCsvKey(args[0] ?? "");
    const dataExpr = args[1] ?? "";
    const data = evaluateExpression(dataExpr, scope);
    ctx.fileStore[filename] = Array.isArray(data) ? data : [];
    return void 0;
  }
  if (name === "csv.append") {
    const filename = parseCsvKey(args[0] ?? "");
    const dataExpr = args.slice(1).join(" ");
    const row = evaluateExpression(dataExpr, scope);
    if (!ctx.fileStore[filename]) ctx.fileStore[filename] = [];
    ctx.fileStore[filename].push(row);
    return void 0;
  }
  if (name === "json.read") {
    const filename = parseCsvKey(args[0] ?? "");
    const data = ctx.fileStore[filename] ?? null;
    if (assignTarget) ctx.state[assignTarget] = data;
    return data;
  }
  if (name === "memory.set" || name === "set-memory") {
    if (args.length >= 2) {
      const key = args[0];
      const val = evaluateExpression(args.slice(1).join(" "), scope);
      ctx.memoryStore[key] = val;
    } else if (args.length === 1) {
      const key = args[0];
      const val = ctx.state[key];
      ctx.memoryStore[key] = val;
    }
    return void 0;
  }
  if (name === "memory.get" || name === "get-memory") {
    const key = args[0];
    const val = ctx.memoryStore[key];
    if (assignTarget) ctx.state[assignTarget] = val;
    return val;
  }
  if (name === "memory.del" || name === "del-memory") {
    const key = args[0];
    delete ctx.memoryStore[key];
    return void 0;
  }
  if (name === "memory.clear" || name === "clear-memory") {
    for (const k of Object.keys(ctx.memoryStore)) {
      delete ctx.memoryStore[k];
    }
    return void 0;
  }
  if (name === "append" || name === "memory.append") {
    const targetExpr = args[0];
    const val = evaluateExpression(args.slice(1).join(" "), scope);
    const target = resolvePath(targetExpr, { ...ctx.state, ...ctx.pathParams });
    if (Array.isArray(target)) {
      target.push(val);
    }
    return void 0;
  }
  if (name === "is-set") {
    const pathExpr = args.join(" ");
    const val = evaluateExpression(pathExpr, scope);
    const result = val !== void 0 && val !== null;
    if (assignTarget) ctx.state[assignTarget] = result;
    return result;
  }
  if (name === "delete") {
    const segments = splitPathSegments(args.join(" "));
    if (segments.length === 1) {
      delete ctx.state[segments[0]];
    } else {
      const parentExpr = segments.slice(0, -1).join(".");
      const parent = resolvePath(parentExpr, scope);
      if (parent && typeof parent === "object") {
        const finalKey = segments[segments.length - 1];
        if (Array.isArray(parent) && !isNaN(Number(finalKey))) {
          parent.splice(Number(finalKey), 1);
        } else {
          delete parent[finalKey];
        }
      }
    }
    return void 0;
  }
  if (name === "stop") {
    ctx.response = { status: 200, body: null, logs: ctx.logs };
    return RESPONDED;
  }
  if (name === "load-rune") {
    if (assignTarget) ctx.state[assignTarget] = null;
    return null;
  }
  ctx.logs.push(`[emulator] Unknown builtin: ${name}`);
  return void 0;
}
var KNOWN_BUILTINS = /* @__PURE__ */ new Set([
  "log",
  "respond",
  "return",
  "parse-json",
  "validate",
  "csv.read",
  "csv.write",
  "csv.append",
  "json.read",
  "json.write",
  "memory.set",
  "memory.get",
  "memory.clear",
  "memory.del",
  "set-memory",
  "get-memory",
  "clear-memory",
  "del-memory",
  "append",
  "memory.append",
  "load-rune",
  "is-set",
  "delete",
  "stop"
]);
function isBuiltin(name) {
  return KNOWN_BUILTINS.has(name);
}

// src/engine/executor.ts
function assignPath(pathExpr, value, ctx) {
  const scope = buildScopeFromContext(ctx);
  const segments = splitPathSegments(pathExpr);
  if (!segments.length) return;
  const baseKey = segments[0];
  if (segments.length === 1) {
    ctx.state[baseKey] = value;
    return;
  }
  if (ctx.state[baseKey] === void 0) ctx.state[baseKey] = {};
  let current = ctx.state[baseKey];
  for (let i = 1; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg.startsWith("[") && seg.endsWith("]")) {
      const lookup = evaluateExpression(seg.slice(1, -1), scope);
      const key = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
      if (current[key] === void 0) {
        current[key] = {};
      }
      current = current[key];
    } else {
      if (current[seg] === void 0) {
        current[seg] = {};
      }
      current = current[seg];
    }
  }
  const finalKey = segments[segments.length - 1];
  if (finalKey.startsWith("[") && finalKey.endsWith("]")) {
    const lookup = evaluateExpression(finalKey.slice(1, -1), scope);
    const key = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
    current[key] = value;
  } else {
    current[finalKey] = value;
  }
}
function executeAssignment(step, ctx) {
  const rhs = step.rhs;
  const firstToken = rhs.split(/\s+/)[0];
  if (isBuiltin(firstToken)) {
    const restStr = rhs.slice(firstToken.length).trim();
    const args = restStr ? restStr.split(/\s+/) : [];
    const result = executeBuiltin(firstToken, args, ctx, step.lhs);
    if (result === RESPONDED) return false;
    if (result !== void 0) {
      ctx.state[step.lhs] = result;
    }
    return true;
  }
  const pushMatch = rhs.match(/^(.+?)\.push\((.+)\)$/);
  if (pushMatch) {
    const scope2 = buildScopeFromContext(ctx);
    const collectionPath = pushMatch[1].trim();
    const argExpr = pushMatch[2].trim();
    const collection = resolvePath(collectionPath, { ...ctx.state, ...ctx.pathParams });
    if (Array.isArray(collection)) {
      const val = evaluateExpression(argExpr, scope2);
      collection.push(val);
      assignPath(collectionPath, collection, ctx);
    }
    return true;
  }
  const scope = buildScopeFromContext(ctx);
  const value = evaluateExpression(rhs, scope);
  assignPath(step.lhs, value, ctx);
  return true;
}
function executeBuiltinStep(step, ctx) {
  const result = executeBuiltin(step.name, step.args, ctx);
  return result !== RESPONDED;
}
function executeIfStep(step, ctx) {
  const scope = buildScopeFromContext(ctx);
  const condResult = evaluateExpression(step.condition, scope);
  if (Boolean(condResult)) {
    return executeSteps(step.body, ctx);
  }
  return true;
}
function executeRawStep(text, ctx) {
  const pushMatch = text.match(/^(.+?)\.push\((.+)\)$/);
  if (pushMatch) {
    const scope = buildScopeFromContext(ctx);
    const collectionPath = pushMatch[1].trim();
    const argExpr = pushMatch[2].trim();
    const collection = evaluateExpression(collectionPath, scope);
    if (Array.isArray(collection)) {
      const val = evaluateExpression(argExpr, scope);
      collection.push(val);
      assignPath(collectionPath, collection, ctx);
    }
    return true;
  }
  const firstToken = text.split(/\s+/)[0];
  if (isBuiltin(firstToken)) {
    const restStr = text.slice(firstToken.length).trim();
    const args = restStr ? restStr.split(/\s+/) : [];
    const result = executeBuiltin(firstToken, args, ctx);
    return result !== RESPONDED;
  }
  return true;
}
function executeSteps(steps, ctx) {
  for (const step of steps) {
    if (ctx.response) return false;
    switch (step.kind) {
      case "assignment":
        if (!executeAssignment(step, ctx)) return false;
        break;
      case "builtin":
        if (!executeBuiltinStep(step, ctx)) return false;
        break;
      case "if":
        if (!executeIfStep(step, ctx)) return false;
        break;
      case "raw":
        if (!executeRawStep(step.text, ctx)) return false;
        break;
    }
  }
  return true;
}

// src/engine/mock-api.ts
function matchPath(pattern, requestPath) {
  const normPattern = pattern.replace(/\/$/, "") || "/";
  const normRequest = requestPath.split("?")[0].replace(/\/$/, "") || "/";
  const patternParts = normPattern.split("/");
  const requestParts = normRequest.split("/");
  if (patternParts.length !== requestParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pat = patternParts[i];
    const req = requestParts[i];
    if (pat.startsWith("{") && pat.endsWith("}")) {
      const paramName = pat.slice(1, -1);
      params[paramName] = req;
    } else if (pat.toLowerCase() !== req.toLowerCase()) {
      return null;
    }
  }
  return params;
}
function findMatchingRoute(routes, req) {
  const method = req.method.toUpperCase();
  for (const route of routes) {
    if (route.method.toUpperCase() !== method) continue;
    const params = matchPath(route.path, req.path);
    if (params !== null) {
      return { route, params };
    }
  }
  return null;
}
function executeRoute(route, pathParams, req, schemas, fileStore, memoryStore) {
  const ctx = createRequestContext(req, pathParams, schemas, fileStore, memoryStore);
  executeSteps(route.run, ctx);
  return ctx.response ?? { status: 200, body: null, logs: ctx.logs };
}
function handleRequest(state, req) {
  const match = findMatchingRoute(state.routes, req);
  if (!match) {
    return {
      status: 404,
      body: `Route not found: ${req.method.toUpperCase()} ${req.path}`,
      logs: []
    };
  }
  return executeRoute(
    match.route,
    match.params,
    req,
    state.schemas,
    state.fileStore,
    state.memoryStore
  );
}

// src/serializer/json.ts
function toJson(value, pretty = true) {
  return JSON.stringify(value, null, pretty ? 2 : void 0) ?? "null";
}

// src/serializer/yaml.ts
function toYaml(value, indent = 0) {
  const prefix = "  ".repeat(indent);
  if (value === null || value === void 0) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return formatYamlString(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value.map((item) => {
      const rendered = toYaml(item, indent + 1);
      if (rendered.includes("\n")) {
        return `${prefix}- 
${addIndent(rendered, indent + 1)}`;
      }
      return `${prefix}- ${rendered}`;
    }).join("\n");
  }
  if (typeof value === "object") {
    const obj = value;
    const keys = Object.keys(obj);
    if (keys.length === 0) return "{}";
    return keys.map((key) => {
      const val = obj[key];
      const renderedVal = toYaml(val, indent + 1);
      if (val !== null && typeof val === "object" && !Array.isArray(val) && Object.keys(val).length > 0) {
        return `${prefix}${key}:
${addIndent(renderedVal, indent + 1)}`;
      }
      if (Array.isArray(val) && val.length > 0) {
        return `${prefix}${key}:
${addIndent(renderedVal, indent + 1)}`;
      }
      return `${prefix}${key}: ${renderedVal}`;
    }).join("\n");
  }
  return String(value);
}
function addIndent(yaml, indent) {
  const prefix = "  ".repeat(indent);
  return yaml.split("\n").map((line) => line.trim() ? `${prefix}${line.trimStart()}` : line).join("\n");
}
function formatYamlString(s) {
  if (s === "" || s === "null" || s === "true" || s === "false" || /^\d/.test(s) || // starts with a digit
  s.includes(":") || s.includes("#") || s.includes("\n") || s.includes('"') || s.startsWith("{") || s.startsWith("[") || s.startsWith("- ") || s.startsWith("  ")) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  }
  return s;
}

// src/serializer/xml.ts
function toXml(value, rootTag = "root", indent = 0) {
  const pad = "  ".repeat(indent);
  if (value === null || value === void 0) {
    return `${pad}<${rootTag} nil="true"/>`;
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return `${pad}<${rootTag}>${escapeXml(String(value))}</${rootTag}>`;
  }
  if (typeof value === "string") {
    return `${pad}<${rootTag}>${escapeXml(value)}</${rootTag}>`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${pad}<${rootTag}/>`;
    }
    const itemTag = deriveItemTag(rootTag);
    const children = value.map((item) => toXml(item, itemTag, indent + 1)).join("\n");
    return `${pad}<${rootTag}>
${children}
${pad}</${rootTag}>`;
  }
  if (typeof value === "object") {
    const obj = value;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return `${pad}<${rootTag}/>`;
    }
    const children = keys.map((key) => toXml(obj[key], sanitizeTag(key), indent + 1)).join("\n");
    return `${pad}<${rootTag}>
${children}
${pad}</${rootTag}>`;
  }
  return `${pad}<${rootTag}>${escapeXml(String(value))}</${rootTag}>`;
}
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function sanitizeTag(tag) {
  const clean = tag.replace(/[^A-Za-z0-9_.-]/g, "_");
  return /^[A-Za-z_]/.test(clean) ? clean : `_${clean}`;
}
function deriveItemTag(pluralTag) {
  if (pluralTag.endsWith("ies")) return pluralTag.slice(0, -3) + "y";
  if (pluralTag.endsWith("ses") || pluralTag.endsWith("xes") || pluralTag.endsWith("zes")) {
    return pluralTag.slice(0, -2);
  }
  if (pluralTag.endsWith("s") && pluralTag.length > 2) return pluralTag.slice(0, -1);
  return "item";
}

// src/serializer/index.ts
function serialize(value, format, rootTag = "root") {
  switch (format) {
    case "json":
      return toJson(value);
    case "yaml":
      return toYaml(value);
    case "xml":
      return toXml(value, rootTag);
    default:
      return String(value);
  }
}

// src/index.ts
function parse(source) {
  return parseSections(source);
}
function createApp(doc, seed = {}) {
  const fileStore = Object.assign({}, seed.files ?? {});
  const memoryStore = Object.assign({}, seed.memory ?? {});
  if (doc.app && doc.app.run.length > 0) {
    const mockReq = { method: "INTERNAL", path: "/_init" };
    const ctx = createRequestContext(mockReq, {}, doc.schemas, fileStore, memoryStore);
    executeSteps(doc.app.run, ctx);
  }
  return {
    document: doc,
    fileStore,
    memoryStore,
    request(req) {
      return handleRequest(
        {
          routes: doc.routes,
          schemas: doc.schemas,
          fileStore,
          memoryStore
        },
        req
      );
    }
  };
}
function serialize2(value, format, rootTag = "root") {
  return serialize(value, format, rootTag);
}
function toDocument(doc) {
  const result = {};
  if (doc.app) {
    const appData = { ...doc.app };
    if (appData.run && appData.run.length === 0) delete appData.run;
    result["App"] = appData;
  }
  if (Object.keys(doc.schemas).length > 0) {
    result["Schema"] = {};
    for (const [name, schema] of Object.entries(doc.schemas)) {
      result["Schema"][name] = schema.fields;
    }
  }
  if (doc.routes.length > 0) {
    result["Route"] = {};
    for (const route of doc.routes) {
      if (!result["Route"][route.method]) {
        result["Route"][route.method] = {};
      }
      const parts = route.path.split("/").filter((p) => p.length > 0);
      let current = result["Route"][route.method];
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current[part]) current[part] = {};
        current = current[part];
      }
      if (route.expect) current.expect = route.expect;
      for (const [k, v] of Object.entries(route.meta)) {
        current[k] = v;
      }
      const formatStep = (step) => {
        if (step.kind === "raw") return step.text;
        if (step.kind === "builtin") return `${step.name} ${step.args.map((a) => a.includes(" ") && !a.startsWith('"') ? '"' + a + '"' : a).join(" ")}`.trim();
        if (step.kind === "assignment") return `${step.lhs} = ${step.rhs}`;
        if (step.kind === "if") return { [`if ${step.condition}`]: step.body.map(formatStep) };
        return JSON.stringify(step);
      };
      if (route.run.length > 0) {
        current.run = route.run.map(formatStep);
      }
    }
  }
  for (const [key, value] of Object.entries(doc.rawSections)) {
    const [type, sub] = key.split("/");
    if (sub) {
      if (!result[type]) result[type] = {};
      result[type][sub] = value;
    } else {
      result[type] = value;
    }
  }
  return result;
}
export {
  createApp,
  parse,
  serialize2 as serialize,
  toDocument,
  toJson,
  toXml,
  toYaml
};
//# sourceMappingURL=rune-emulator.js.map
