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

  // src/testing/index.ts
  var index_exports = {};
  __export(index_exports, {
    boot: () => boot,
    invoke: () => invoke,
    snapshot: () => snapshot
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

  // src/globals.ts
  function getWindowProp(key) {
    return window[key];
  }

  // src/utils.ts
  function hostingPrefix() {
    if (typeof document === "undefined") return "";
    return (document.querySelector('meta[name="rune-base-path"]')?.getAttribute("content") || "").replace(/\/$/, "");
  }
  function hostedUrl(value) {
    const prefix = hostingPrefix();
    if (!prefix || !value.startsWith("/") || value.startsWith("//") || value === prefix || value.startsWith(prefix + "/")) return value;
    return prefix + value;
  }
  function includesTopLevel(input, delimiter) {
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
    const config2 = context.navigator;
    if (!config2) {
      updateSeoMetadata(route);
      return;
    }
    const cleanRoute = String(route || "").trim();
    if (cleanRoute === lastKnownRoute) return;
    lastKnownRoute = cleanRoute;
    const mode = config2.mode || "auto";
    const param = config2.param || "page";
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
        url.searchParams.delete(config2.bind);
        if (url.hash && !url.hash.startsWith("#/")) {
          url.hash = "";
        }
        const finalUrl = newPath + (url.search ? url.search : "") + (url.hash ? url.hash : "");
        const stateObj = { [config2.bind]: cleanRoute };
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
      const stateObj = { [config2.bind]: cleanRoute };
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
    const config2 = context.navigator;
    if (!config2 || prop !== config2.bind) return;
    updateNavigatorUrl(String(value ?? ""));
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
  function buildScope(locals) {
    const c = ctx();
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
    if (obj === null || typeof obj !== "object") return obj;
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
        const rawValue = value !== null && typeof value === "object" && value.__raw ? value.__raw : value;
        if (target[prop] === rawValue) return true;
        target[prop] = rawValue;
        if (typeof prop === "string" && context.navigator && prop === context.navigator.bind) {
          handleNavigatorStateChange(prop, rawValue);
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
    proxyCache.set(obj, proxy);
    return proxy;
  }

  // src/storage.ts
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
      const val = browserStorage()?.getItem(key);
      if (val != null) return val;
    } catch {
    }
    return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
  }
  function setStorageItem(key, val) {
    memoryStorage[key] = val;
    try {
      browserStorage()?.setItem(key, val);
    } catch {
    }
  }
  function removeStorageItem(key) {
    delete memoryStorage[key];
    try {
      browserStorage()?.removeItem(key);
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

  // src/expression.ts
  var MAX_DEPTH = 64;
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
    (helper.params || []).forEach((param, index) => {
      helperLocals[param] = args[index];
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
  function evaluateExpression(expr, scope, depth) {
    if ((depth || 0) > MAX_DEPTH) return void 0;
    const nextDepth = (depth || 0) + 1;
    let trimmed = String(expr || "").trim();
    if (!trimmed) return void 0;
    if (trimmed.startsWith('"')) {
      try {
        const literal = JSON.parse(trimmed);
        if (typeof literal === "string") return literal;
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
      if (selector && typeof document !== "undefined") {
        const el = document.querySelector(selector);
        if (el) {
          if (!rest) return el;
          if (rest.startsWith(".")) {
            return resolvePath(rest.slice(1), el);
          }
        }
        return void 0;
      }
    }
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
    }
    if (trimmed.startsWith("!")) {
      return !Boolean(
        evaluateExpression(trimmed.slice(1).trim(), scope, nextDepth)
      );
    }
    if (trimmed.startsWith("collide(") && trimmed.endsWith(")")) {
      const argsStr = trimmed.slice(8, -1);
      const parts = splitTopLevel(argsStr, ",");
      if (parts.length >= 2) {
        const a = evaluateExpression(parts[0], scope, nextDepth);
        const b = evaluateExpression(parts[1], scope, nextDepth);
        const w = parts.length >= 3 ? Number(evaluateExpression(parts[2], scope, nextDepth)) : 20;
        const h = parts.length >= 4 ? Number(evaluateExpression(parts[3], scope, nextDepth)) : w;
        if (a && b && typeof a === "object" && typeof b === "object" && a.x !== void 0 && a.y !== void 0 && b.x !== void 0 && b.y !== void 0) {
          return Math.abs(Number(a.x) - Number(b.x)) < w && Math.abs(Number(a.y) - Number(b.y)) < h;
        }
      }
      return false;
    }
    if (trimmed.startsWith("clamp(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(6, -1), ",");
      if (parts.length === 3) {
        const v = Number(evaluateExpression(parts[0], scope, nextDepth));
        const min = Number(evaluateExpression(parts[1], scope, nextDepth));
        const max = Number(evaluateExpression(parts[2], scope, nextDepth));
        return Math.min(Math.max(v, min), max);
      }
    }
    if (trimmed.startsWith("abs(") && trimmed.endsWith(")")) {
      const val = Number(evaluateExpression(trimmed.slice(4, -1), scope, nextDepth));
      return Math.abs(val);
    }
    if (trimmed.startsWith("random(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(7, -1), ",");
      if (parts.length >= 2) {
        const min = Number(evaluateExpression(parts[0], scope, nextDepth));
        const max = Number(evaluateExpression(parts[1], scope, nextDepth));
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }
    }
    if (trimmed.startsWith("min(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(4, -1), ",");
      const nums = parts.map((p) => Number(evaluateExpression(p, scope, nextDepth)));
      return Math.min(...nums);
    }
    if (trimmed.startsWith("max(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(4, -1), ",");
      const nums = parts.map((p) => Number(evaluateExpression(p, scope, nextDepth)));
      return Math.max(...nums);
    }
    if (trimmed.startsWith("storage.get(") || trimmed.startsWith("local_storage.get(") || trimmed.startsWith("localStorage.get(")) {
      const callEnd = trimmed.lastIndexOf(")");
      const callPart = trimmed.slice(0, callEnd + 1);
      const trailingProp = trimmed.slice(callEnd + 1).trim();
      const inner = callPart.slice(callPart.indexOf("(") + 1, -1);
      const parts = splitTopLevel(inner, ",");
      const key = String(evaluateExpression(parts[0], scope, nextDepth));
      const defVal = parts.length > 1 ? evaluateExpression(parts[1], scope, nextDepth) : null;
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
    }
    if (trimmed.startsWith("storage.has(") || trimmed.startsWith("local_storage.has(") || trimmed.startsWith("localStorage.has(")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const key = String(evaluateExpression(inner, scope, nextDepth));
      return hasStorageItem(key);
    }
    const helperCall = parseHelperCall(trimmed);
    if (helperCall) {
      return callHelper(
        helperCall.name,
        helperCall.args.map((arg) => evaluateExpression(arg, scope, nextDepth)),
        scope,
        nextDepth
      );
    }
    const methodMatch = trimmed.match(
      /^(.+?)\.(any|mask|filter|find|max)(?:\((.*)\)|\s+(.+?))(?:\.(length))?$/
    );
    if (methodMatch) {
      const [, receiver, method, parenArgs, spaceArgs, trailingProp] = methodMatch;
      const argsStr = (parenArgs !== void 0 ? parenArgs : spaceArgs).trim();
      const collection = evaluateExpression(receiver, scope, nextDepth);
      let result = void 0;
      if (method === "mask" && Array.isArray(collection)) {
        const player = valueToString(
          evaluateExpression(argsStr, scope, nextDepth)
        );
        result = collection.reduce(
          (acc, cell, i) => {
            return valueToString(cell) === player ? acc | 1 << i : acc;
          },
          0
        );
      } else if ((method === "any" || method === "find" || method === "filter" || method === "max") && Array.isArray(collection)) {
        const arrowMatch = argsStr.match(/^(\w+)\s*=>\s*(.+)$/);
        const [paramName, predExpr] = arrowMatch ? [arrowMatch[1], arrowMatch[2]] : ["it", argsStr];
        if (method === "any") {
          result = collection.some((item) => {
            const innerScope = Object.assign({}, scope, {
              [paramName]: item
            });
            return Boolean(
              evaluateExpression(predExpr, innerScope, nextDepth)
            );
          });
        } else if (method === "filter") {
          result = collection.filter((item) => {
            const innerScope = Object.assign({}, scope, {
              [paramName]: item
            });
            return Boolean(
              evaluateExpression(predExpr, innerScope, nextDepth)
            );
          });
        } else if (method === "find") {
          result = collection.find((item) => {
            const innerScope = Object.assign({}, scope, {
              [paramName]: item
            });
            return Boolean(
              evaluateExpression(predExpr, innerScope, nextDepth)
            );
          });
        } else if (method === "max") {
          result = collection.reduce(
            (max, item) => {
              const innerScope = Object.assign({}, scope, {
                [paramName]: item
              });
              const val = evaluateExpression(predExpr, innerScope, nextDepth);
              return max === void 0 || val > max ? val : max;
            },
            void 0
          );
        }
      }
      if (trailingProp === "length" && result !== void 0 && result.length !== void 0) {
        return result.length;
      }
      return result;
    }
    if (includesTopLevel(trimmed, " ? ")) {
      const parts = splitTopLevel(trimmed, " ? ");
      const condition = parts[0];
      const rest = parts.slice(1).join(" ? ");
      if (includesTopLevel(rest, " : ")) {
        const colonParts = splitTopLevel(rest, " : ");
        const trueExpr = colonParts[0];
        const falseExpr = colonParts.slice(1).join(" : ");
        return Boolean(evaluateExpression(condition, scope, nextDepth)) ? evaluateExpression(trueExpr, scope, nextDepth) : evaluateExpression(falseExpr, scope, nextDepth);
      }
    }
    if (includesTopLevel(trimmed, " ?? ")) {
      const parts = splitTopLevel(trimmed, " ?? ");
      const leftRaw = parts[0].trim();
      let left = evaluateExpression(leftRaw, scope, nextDepth);
      if (typeof left === "string" && left === leftRaw && resolvePath(leftRaw, scope) === void 0 && tryParseLiteral(leftRaw, scope) === void 0) {
        left = void 0;
      }
      if (left !== void 0 && left !== null && left !== "") {
        return left;
      }
      return evaluateExpression(parts.slice(1).join(" ?? "), scope, nextDepth);
    }
    if (includesTopLevel(trimmed, " or ")) {
      return splitTopLevel(trimmed, " or ").some(
        (part) => Boolean(evaluateExpression(part, scope, nextDepth))
      );
    }
    if (includesTopLevel(trimmed, " || ")) {
      return splitTopLevel(trimmed, " || ").some(
        (part) => Boolean(evaluateExpression(part, scope, nextDepth))
      );
    }
    if (includesTopLevel(trimmed, " and ")) {
      return splitTopLevel(trimmed, " and ").every(
        (part) => Boolean(evaluateExpression(part, scope, nextDepth))
      );
    }
    if (includesTopLevel(trimmed, " && ")) {
      return splitTopLevel(trimmed, " && ").every(
        (part) => Boolean(evaluateExpression(part, scope, nextDepth))
      );
    }
    if (includesTopLevel(trimmed, " != ")) {
      const [left, right] = splitTopLevel(trimmed, " != ");
      return valueToString(evaluateExpression(left, scope, nextDepth)) !== valueToString(evaluateExpression(right, scope, nextDepth));
    }
    if (includesTopLevel(trimmed, " == ")) {
      const [left, right] = splitTopLevel(trimmed, " == ");
      return valueToString(evaluateExpression(left, scope, nextDepth)) === valueToString(evaluateExpression(right, scope, nextDepth));
    }
    if (includesTopLevel(trimmed, " >= ")) {
      const [left, right] = splitTopLevel(trimmed, " >= ");
      return evaluateExpression(left, scope, nextDepth) >= evaluateExpression(right, scope, nextDepth);
    }
    if (includesTopLevel(trimmed, " <= ")) {
      const [left, right] = splitTopLevel(trimmed, " <= ");
      return evaluateExpression(left, scope, nextDepth) <= evaluateExpression(right, scope, nextDepth);
    }
    if (includesTopLevel(trimmed, " > ")) {
      const [left, right] = splitTopLevel(trimmed, " > ");
      return evaluateExpression(left, scope, nextDepth) > evaluateExpression(right, scope, nextDepth);
    }
    if (includesTopLevel(trimmed, " < ")) {
      const [left, right] = splitTopLevel(trimmed, " < ");
      return evaluateExpression(left, scope, nextDepth) < evaluateExpression(right, scope, nextDepth);
    }
    if (includesTopLevel(trimmed, " + ")) {
      return splitTopLevel(trimmed, " + ").reduce(
        (acc, part, index) => {
          const value = evaluateExpression(part, scope, nextDepth);
          if (index === 0) return value;
          if (typeof acc === "number" && typeof value === "number")
            return acc + value;
          return `${valueToString(acc)}${valueToString(value)}`;
        },
        void 0
      );
    }
    if (includesTopLevel(trimmed, " - ")) {
      const parts = splitTopLevel(trimmed, " - ");
      const first = Number(evaluateExpression(parts[0], scope, nextDepth));
      return parts.slice(1).reduce((acc, part) => {
        return acc - Number(evaluateExpression(part, scope, nextDepth));
      }, first);
    }
    if (includesTopLevel(trimmed, " * ")) {
      return splitTopLevel(trimmed, " * ").reduce(
        (acc, part, idx) => {
          const val = Number(evaluateExpression(part, scope, nextDepth));
          return idx === 0 ? val : acc * val;
        },
        1
      );
    }
    if (includesTopLevel(trimmed, " / ")) {
      const parts = splitTopLevel(trimmed, " / ");
      const first = Number(evaluateExpression(parts[0], scope, nextDepth));
      return parts.slice(1).reduce((acc, part) => {
        return acc / Number(evaluateExpression(part, scope, nextDepth));
      }, first);
    }
    if (includesTopLevel(trimmed, " % ")) {
      const parts = splitTopLevel(trimmed, " % ");
      const first = Number(evaluateExpression(parts[0], scope, nextDepth));
      return parts.slice(1).reduce((acc, part) => {
        return acc % Number(evaluateExpression(part, scope, nextDepth));
      }, first);
    }
    if (trimmed.startsWith("swap ")) {
      const tokens = trimmed.split(/\s+/);
      const current = valueToString(
        evaluateExpression(tokens[1], scope, nextDepth)
      );
      const left = valueToString(
        evaluateExpression(tokens[2], scope, nextDepth)
      );
      const right = valueToString(
        evaluateExpression(tokens[3], scope, nextDepth)
      );
      return current === left ? right : left;
    }
    if (trimmed.startsWith("full ")) {
      const collection = evaluateExpression(
        trimmed.slice(5),
        scope,
        nextDepth
      );
      return Array.isArray(collection) && collection.every((item) => valueToString(item) !== "");
    }
    if (includesTopLevel(trimmed, " & ")) {
      const parts = splitTopLevel(trimmed, " & ");
      if (parts.length === 2) {
        return evaluateExpression(parts[0], scope, nextDepth) & evaluateExpression(parts[1], scope, nextDepth);
      }
    }
    if (trimmed.startsWith("-") && !trimmed.startsWith("--")) {
      const operand = trimmed.slice(1).trim();
      if (operand) {
        const val = evaluateExpression(operand, scope, nextDepth);
        if (typeof val === "number") {
          return -val;
        }
        const num = Number(val);
        if (!Number.isNaN(num)) {
          return -num;
        }
      }
    }
    return resolveValue(trimmed, scope);
  }

  // src/testing/host.ts
  var mock = {
    storage: {},
    downloads: [],
    clipboard: [],
    audio: []
  };
  function downloadText(filename, content) {
    mock.downloads.push({ filename, content });
  }
  function copyText(text) {
    mock.clipboard.push(text);
  }
  var record = (operation, args) => {
    mock.audio.push({ operation, args });
  };
  var playSound = (...args) => record("sound.play", args);
  var playMusic = (...args) => record("music.play", args);
  var stopMusic = () => record("music.stop", []);
  var pauseMusic = () => record("music.pause", []);
  var resumeMusic = () => record("music.resume", []);
  var setMusicTempo = (...args) => record("music.tempo", args);
  var setMusicVolume = (...args) => record("music.volume", args);
  var registerMusic = (...args) => record("music.register", args);
  function installHost() {
    const storage = /* @__PURE__ */ new Map();
    let frames = [];
    const unsupported = () => {
      throw new Error("This browser API is not supported by logic tests");
    };
    Object.assign(globalThis, {
      window: globalThis,
      // DOM, fetch, timers, and WebAudio are deliberately unavailable in this prototype.
      fetch: unsupported,
      setTimeout: unsupported,
      setInterval: unsupported,
      requestAnimationFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
        clear: () => storage.clear()
      },
      console: { log() {
      }, warn() {
      }, error() {
      } }
    });
    return () => {
      let budget = 100;
      while (frames.length) {
        if (--budget === 0) throw new Error("Too many queued logic renders");
        const current = frames;
        frames = [];
        current.forEach((callback) => callback(0));
      }
      mock.storage = Object.fromEntries([...storage].map(([key, value]) => {
        try {
          return [key, JSON.parse(value)];
        } catch {
          return [key, value];
        }
      }));
    };
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
      const shuffled = arr.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      if (varName) {
        assignPath(varName, shuffled, locals);
      }
      return shuffled;
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
    const app2 = ctx().app;
    if (app2.startTimer) {
      app2.startTimer(action, ms);
    }
    return true;
  }
  function handleStopTimer(statement, _locals) {
    const trimmed = statement.trim();
    if (trimmed !== "stop-timer" && trimmed !== "clear-timer" && trimmed !== "clear-interval") return void 0;
    const app2 = ctx().app;
    if (app2.stopTimer) {
      app2.stopTimer();
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
        return;
      }
    } else {
      current = ctx().app.state[baseKey];
      if (segments.length === 1) {
        ctx().app.state[baseKey] = value;
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
    const scopeValue = buildScope(locals);
    if (Array.isArray(current) && finalRawKey.startsWith("[].(") && finalRawKey.endsWith(")")) {
      const condition = finalRawKey.slice(4, -1);
      const index = current.findIndex((item) => {
        const innerScope = Object.assign({}, scopeValue, { it: item });
        return Boolean(evaluateExpression(condition, innerScope, 0));
      });
      if (index !== -1) {
        current[index] = value;
      }
      return;
    } else if (finalRawKey.startsWith("[") && finalRawKey.endsWith("]")) {
      const innerExpr = finalRawKey.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scopeValue, 0);
      const finalKey = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
      current[finalKey] = value;
    } else {
      current[finalRawKey] = value;
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
      const index = current.findIndex((item) => {
        const innerScope = Object.assign({}, scopeValue, { it: item });
        return Boolean(evaluateExpression(condition, innerScope, 0));
      });
      if (index !== -1) {
        current.splice(index, 1);
      }
    } else if (finalRawKey.startsWith("[") && finalRawKey.endsWith("]")) {
      const innerExpr = finalRawKey.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scopeValue, 0);
      const finalKey = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
      if (Array.isArray(current) && typeof finalKey === "number") {
        current.splice(finalKey, 1);
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
  }
  function executeStatement(statement, locals) {
    const trimmed = String(statement || "").trim();
    if (!trimmed) return true;
    if (trimmed.startsWith("sound ") || trimmed.startsWith("sound.") || trimmed.startsWith("play_sound(")) {
      let soundName = "";
      let argVal = void 0;
      if (trimmed.startsWith("sound.play(") && trimmed.endsWith(")")) {
        const inner = trimmed.slice(11, -1);
        const parts = splitTopLevel(inner, ",");
        soundName = String(evaluateExpression(parts[0], buildScope(locals)) || "");
        if (parts.length > 1) {
          argVal = evaluateExpression(parts[1], buildScope(locals));
        }
      } else if (trimmed.startsWith("play_sound(") && trimmed.endsWith(")")) {
        const inner = trimmed.slice(11, -1);
        const parts = splitTopLevel(inner, ",");
        soundName = String(evaluateExpression(parts[0], buildScope(locals)) || "");
        if (parts.length > 1) {
          argVal = evaluateExpression(parts[1], buildScope(locals));
        }
      } else if (trimmed.startsWith("sound.play ")) {
        soundName = String(evaluateExpression(trimmed.slice(11), buildScope(locals)) || "");
      } else if (trimmed.startsWith("sound.")) {
        soundName = trimmed.slice(6).trim();
      } else {
        soundName = String(evaluateExpression(trimmed.slice(6), buildScope(locals)) || "");
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
        const val = Number(evaluateExpression(expr, buildScope(locals)));
        if (!isNaN(val)) setMusicTempo(val);
        return true;
      }
      if (trimmed.startsWith("music.volume =") || trimmed.startsWith("music.volume=")) {
        const expr = trimmed.slice(trimmed.indexOf("=") + 1).trim();
        const val = Number(evaluateExpression(expr, buildScope(locals)));
        if (!isNaN(val)) setMusicVolume(val);
        return true;
      }
      if (trimmed.startsWith("music.compose(") || trimmed.startsWith("music.register(")) {
        const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
        const parts = splitTopLevel(inner, ",");
        if (parts.length >= 4) {
          const name = String(evaluateExpression(parts[0], buildScope(locals)));
          const tempo = Number(evaluateExpression(parts[1], buildScope(locals))) || 128;
          const lead = String(evaluateExpression(parts[2], buildScope(locals)));
          const bass = String(evaluateExpression(parts[3], buildScope(locals)));
          const drums = parts.length > 4 ? String(evaluateExpression(parts[4], buildScope(locals))) : "";
          const timeSig = parts.length > 5 ? String(evaluateExpression(parts[5], buildScope(locals))) : "4/4";
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
          const name = String(evaluateExpression(parts[0], buildScope(locals)));
          const songConfig = evaluateExpression(parts[1], buildScope(locals));
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
          trackName = String(evaluateExpression(trimmed.slice(11, -1), buildScope(locals)) || "");
        } else if (trimmed.startsWith("play_music(") && trimmed.endsWith(")")) {
          trackName = String(evaluateExpression(trimmed.slice(11, -1), buildScope(locals)) || "");
        } else if (trimmed.startsWith("music.play ")) {
          trackName = String(evaluateExpression(trimmed.slice(11), buildScope(locals)) || "");
        } else if (trimmed.startsWith("music ")) {
          trackName = String(evaluateExpression(trimmed.slice(6), buildScope(locals)) || "");
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
      const id = Number(evaluateExpression(inner, buildScope(locals)));
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
      const id = Number(evaluateExpression(inner, buildScope(locals)));
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
      const id = Number(evaluateExpression(parts[0], buildScope(locals)));
      const delta = parts.length > 1 ? Number(evaluateExpression(parts[1], buildScope(locals))) : 1;
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
      const note = String(evaluateExpression(parts[0], buildScope(locals)));
      const dur = parts[1] ? String(evaluateExpression(parts[1], buildScope(locals))) : ":8";
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
      const barNum = Number(evaluateExpression(inner, buildScope(locals))) || 1;
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
      const barNum = Number(evaluateExpression(inner, buildScope(locals))) || 1;
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
        const key = String(evaluateExpression(parts[0], buildScope(locals)));
        const val = evaluateExpression(parts[1], buildScope(locals));
        const serialized = typeof val === "string" ? val : JSON.stringify(val);
        setStorageItem(key, serialized);
      }
      return true;
    }
    if (trimmed.startsWith("storage.set ") || trimmed.startsWith("storage.save ")) {
      const rest = trimmed.slice(12).trim();
      const parts = splitTopLevel(rest, ",");
      if (parts.length >= 2) {
        const key = String(evaluateExpression(parts[0], buildScope(locals)));
        const val = evaluateExpression(parts[1], buildScope(locals));
        const serialized = typeof val === "string" ? val : JSON.stringify(val);
        setStorageItem(key, serialized);
      }
      return true;
    }
    if (trimmed.startsWith("storage.remove(") || trimmed.startsWith("storage.delete(") || trimmed.startsWith("local_storage.remove(")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const key = String(evaluateExpression(inner, buildScope(locals)));
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
        const filename = String(evaluateExpression(parts[0], buildScope(locals)));
        const content = String(evaluateExpression(parts[1], buildScope(locals)));
        downloadText(filename, content);
      }
      return true;
    }
    if (trimmed.startsWith("download ")) {
      const rest = trimmed.slice(9).trim();
      const parts = splitTopLevel(rest, ",");
      if (parts.length >= 2) {
        const filename = String(evaluateExpression(parts[0], buildScope(locals)));
        const content = String(evaluateExpression(parts[1], buildScope(locals)));
        downloadText(filename, content);
      }
      return true;
    }
    if ((trimmed.startsWith("clipboard.copy(") || trimmed.startsWith("copy(")) && trimmed.endsWith(")")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const text = String(evaluateExpression(inner, buildScope(locals)));
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
        const app2 = ctx().app;
        if (typeof app2?.state !== "undefined") {
          app2.state.is_fullscreen = shouldEnter;
          if (typeof app2.render === "function") {
            app2.render();
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
      const scope = buildScope(locals);
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
      const targetVal = evaluateExpression(targetPath, buildScope(locals));
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
      const rightVal = evaluateExpression(right, buildScope(locals));
      const leftVal = evaluateExpression(left, buildScope(locals));
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
        const value = builtinVal !== void 0 ? builtinVal : evaluateExpression(right, buildScope(locals));
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
      const collection = evaluateExpression(path, buildScope(locals));
      if (Array.isArray(collection)) {
        const val = evaluateExpression(arg, buildScope(locals));
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
          (arg) => evaluateExpression(arg, buildScope(locals))
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
            buildScope(locals)
          )
        )) {
          if (!executeSteps(conditional.steps || [], locals)) return false;
        }
      }
      if (Object.prototype.hasOwnProperty.call(step, "ForLoop")) {
        const loop = step.ForLoop;
        const collection = evaluateExpression(
          loop.collection,
          buildScope(locals)
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
        (def.params || []).forEach((param, index) => {
          scopedLocals[param] = args[index];
        });
        executeSteps(def.steps || [], scopedLocals);
      }
    };
  }

  // src/testing/index.ts
  var app;
  var config;
  var flush;
  function boot(options) {
    config = options;
    flush = installHost();
    app = createLogicApp(function() {
      this.computeDerived();
    });
    initContext({
      pageTree: config.pageTree,
      derivedDefinitions: config.derivedDefinitions,
      helperDefinitions: config.helperDefinitions,
      actionDefinitions: config.actionDefinitions,
      i18nData: config.i18nData,
      app,
      isRendering: false,
      memorySubscriptions: {},
      initialState: JSON.parse(JSON.stringify(config.stateJson)),
      emitters: config.emitters || {},
      loadedChunks: {},
      loadingChunks: {}
    });
    app.state = makeReactive({ ...config.stateJson, i18n: config.i18nData });
    if (typeof app.state.active_voice === "string") {
      app.state.active_steps = parseTrackToSteps(String(app.state[`${app.state.active_voice}_track`] || ""), Number(app.state.selected_step_id ?? -1), String(app.state.time_signature || "4/4"), Number(app.state.selected_bar ?? 0));
    }
    app.computeDerived();
    flush();
  }
  function invoke(name, args) {
    if (!Object.prototype.hasOwnProperty.call(config.actionDefinitions, name)) {
      throw new Error(`Unknown Rune-Web action: ${name}`);
    }
    app.invokeAction(name, args);
    flush();
    app.computeDerived();
  }
  function snapshot() {
    flush();
    return JSON.stringify({ state: app.state, derived: app.derived, mock });
  }
  return __toCommonJS(index_exports);
})();
