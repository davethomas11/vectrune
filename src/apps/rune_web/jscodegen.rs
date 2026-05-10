/// JavaScript code generation for Rune-Web client-side logic.
///
/// This module emits a compact browser runtime that can:
/// - bootstrap state from `@Logic`
/// - render a serialized `@Page` AST into `#app`
/// - interpolate `{path}` templates against state, derived values, and loop locals
/// - dispatch `data-on-*` events with evaluated arguments
/// - execute a small interpreted subset of action steps

use super::ast::{LogicDefinition, ViewNode};
use std::collections::HashMap;

/// JavaScript code generator from a page + logic definition.
pub struct JsCodegen {
    page: ViewNode,
    logic: LogicDefinition,
    i18n_json: String,
    ws_endpoint: Option<String>,
    /// Memory values pre-fetched at request time, seeded into initial JS state.
    memory_seed: HashMap<String, serde_json::Value>,
}

impl JsCodegen {
    /// Create a new code generator from a page tree, logic definition, and i18n JSON.
    pub fn new(page: ViewNode, logic: LogicDefinition, i18n_json: String, ws_endpoint: Option<String>, memory_seed: HashMap<String, serde_json::Value>) -> Self {
        JsCodegen { page, logic, i18n_json, ws_endpoint, memory_seed }
    }

    /// Generate complete JavaScript application code.
    pub fn generate(&self) -> String {
        let state_json = self.generate_state_json();
        let derived_json = serde_json::to_string(&self.logic.derived)
            .unwrap_or_else(|_| "{}".to_string());
        let helper_json = serde_json::to_string(&self.logic.helpers)
            .unwrap_or_else(|_| "{}".to_string());
        let actions_json = serde_json::to_string(&self.logic.actions)
            .unwrap_or_else(|_| "{}".to_string());
        let page_json = serde_json::to_string(&self.page)
            .unwrap_or_else(|_| "{}".to_string());
        let i18n_json = &self.i18n_json;

        format!(
            r#"(function() {{
  const pageTree = {page_json};
  const derivedDefinitions = {derived_json};
  const helperDefinitions = {helper_json};
  const actionDefinitions = {actions_json};
  const i18nData = {i18n_json};

  function escapeHtml(value) {{
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }}

  function includesTopLevel(input, delimiter) {{
    let depth = 0;
    let inQuotes = false;
    let quoteChar = '';
    for (let i = 0; i < input.length; i += 1) {{
      const ch = input[i];
      if ((ch === '"' || ch === '\'') && input[i - 1] !== '\\') {{
        if (inQuotes && ch === quoteChar) {{ inQuotes = false; quoteChar = ''; }}
        else if (!inQuotes) {{ inQuotes = true; quoteChar = ch; }}
        continue;
      }}
      if (!inQuotes) {{
        if (ch === '(' || ch === '[' || ch === '{{') depth += 1;
        if (ch === ')' || ch === ']' || ch === '}}') depth -= 1;
        if (depth === 0 && input.slice(i, i + delimiter.length) === delimiter) return true;
      }}
    }}
    return false;
  }}

  function splitTopLevel(input, delimiter) {{
    const parts = [];
    let current = '';
    let depth = 0;
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < input.length; i += 1) {{
      const ch = input[i];
      if ((ch === '"' || ch === '\'') && input[i - 1] !== '\\') {{
        if (inQuotes && ch === quoteChar) {{
          inQuotes = false;
          quoteChar = '';
        }} else if (!inQuotes) {{
          inQuotes = true;
          quoteChar = ch;
        }}
        current += ch;
        continue;
      }}

      if (!inQuotes) {{
        if (ch === '[' || ch === '{{' || ch === '(') depth += 1;
        if (ch === ']' || ch === '}}' || ch === ')') depth -= 1;
        if (depth === 0 && input.slice(i, i + delimiter.length) === delimiter) {{
          parts.push(current.trim());
          current = '';
          i += delimiter.length - 1;
          continue;
        }}
      }}

      current += ch;
    }}

    if (current.trim().length > 0) {{
      parts.push(current.trim());
    }}

    return parts;
  }}

  function normalizeLiteral(value) {{
    const trimmed = String(value || '').trim();
    if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\'')))) {{
      return trimmed.slice(1, -1);
    }}
    return trimmed;
  }}

  function decodeEscapes(value) {{
    const OPEN = '\uE000';
    const CLOSE = '\uE001';
    const input = String(value || '');
    let output = '';

    for (let i = 0; i < input.length; i += 1) {{
      const ch = input[i];
      if (ch === '\\' && i + 1 < input.length) {{
        i += 1;
        const next = input[i];
        if (next === 'n') output += '\n';
        else if (next === 'r') output += '\r';
        else if (next === 't') output += '\t';
        else if (next === '"') output += '"';
        else if (next === '\'') output += '\'';
        else if (next === '\\') output += '\\';
        else if (next === '{{') output += OPEN;
        else if (next === '}}') output += CLOSE;
        else output += next;
        continue;
      }}

      output += ch;
    }}

    return output;
  }}

  function expandPercentI18n(value) {{
    const input = String(value || '');
    let output = '';

    for (let i = 0; i < input.length; i += 1) {{
      const ch = input[i];
      if (ch !== '%') {{
        output += ch;
        continue;
      }}

      let inner = '';
      let closed = false;
      for (i += 1; i < input.length; i += 1) {{
        if (input[i] === '%') {{
          closed = true;
          break;
        }}
        inner += input[i];
      }}

      if (closed && inner.startsWith('i18n.')) {{
        output += `{{${{inner}}}}`;
      }} else {{
        output += `%${{inner}}`;
        if (closed) output += '%';
      }}
    }}

    return output;
  }}

  function tryParseLiteral(expr) {{
    const trimmed = String(expr || '').trim();
    if (trimmed === '') return undefined;
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (!Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {{
      return normalizeLiteral(trimmed);
    }}
    if (trimmed.startsWith('[') || trimmed.startsWith('{{')) {{
      try {{
        return (new Function(`return (${{trimmed}});`))();
      }} catch (_err) {{
        return undefined;
      }}
    }}
    return undefined;
  }}

  function splitPathSegments(expr) {{
    const segments = [];
    let current = '';
    let inBrackets = false;

    for (const ch of String(expr || '')) {{
      if (ch === '.' && !inBrackets) {{
        if (current.trim()) segments.push(current.trim());
        current = '';
        continue;
      }}
      if (ch === '[') {{
        if (current.trim()) segments.push(current.trim());
        current = '';
        inBrackets = true;
        continue;
      }}
      if (ch === ']') {{
        if (current.trim()) segments.push(current.trim());
        current = '';
        inBrackets = false;
        continue;
      }}
      current += ch;
    }}

    if (current.trim()) segments.push(current.trim());
    return segments;
  }}

  function valueToString(value) {{
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {{
      return JSON.stringify(value);
    }} catch (_err) {{
      return '';
    }}
  }}

  const app = {{
    state: Object.assign({{}}, {state_json}, {{ i18n: i18nData }}),
    derived: {{}},
    computeDerived: function() {{
      const baseScope = Object.assign({{}}, this.state, this.derived);
      for (const [name, def] of Object.entries(derivedDefinitions)) {{
        const sourceValue = resolveValue(def.source, baseScope);
        const sourceKey = valueToString(sourceValue);
        let resolved = '';

        for (const currentCase of def.cases || []) {{
          const matcher = normalizeLiteral(currentCase.matcher);
          if (matcher === '_' || matcher === sourceKey) {{
            resolved = interpolate(normalizeLiteral(currentCase.value), Object.assign({{}}, this.state, this.derived));
            break;
          }}
        }}

        this.derived[name] = resolved;
      }}
    }},
    render: function() {{
      this.computeDerived();
      const root = document.getElementById('app');
      if (!root) return;
      root.innerHTML = renderNode(pageTree, {{}});
    }},
    invokeAction: function(name, args, locals) {{
      const def = actionDefinitions[name];
      if (!def) return;
      const scopedLocals = Object.assign({{}}, locals || {{}});
      (def.params || []).forEach((param, index) => {{
        scopedLocals[param] = args[index];
      }});
      executeSteps(def.steps || [], scopedLocals);
      this.render();
    }}
  }};

  function buildScope(locals) {{
    return Object.assign({{}}, app.state, app.derived, locals || {{}});
  }}

  function resolvePath(expr, scope) {{
    const segments = splitPathSegments(expr);
    if (!segments.length) return undefined;

    let current = Object.prototype.hasOwnProperty.call(scope, segments[0]) ? scope[segments[0]] : undefined;
    if (current === undefined) return undefined;

    for (let i = 1; i < segments.length; i += 1) {{
      const segment = segments[i];
      const lookup = Object.prototype.hasOwnProperty.call(scope, segment) ? scope[segment] : segment;
      if (Array.isArray(current)) {{
        const index = Number(lookup);
        current = Number.isInteger(index) ? current[index] : undefined;
      }} else if (current && typeof current === 'object') {{
        current = current[valueToString(lookup)];
      }} else {{
        return undefined;
      }}
    }}

    return current;
  }}

  function resolveValue(expr, scope) {{
    const literal = tryParseLiteral(expr);
    if (literal !== undefined) return literal;
    const pathValue = resolvePath(expr, scope);
    if (pathValue !== undefined) return pathValue;
    return normalizeLiteral(expr);
  }}

  function parseHelperCall(expr) {{
    const trimmed = String(expr || '').trim();
    if (!trimmed) return null;

    const parenMatch = trimmed.match(/^([A-Za-z_][\w-]*)\((.*)\)$/);
    if (parenMatch && helperDefinitions[parenMatch[1]]) {{
      return {{
        name: parenMatch[1],
        args: parenMatch[2] ? splitTopLevel(parenMatch[2], ',') : []
      }};
    }}

    const firstSpace = trimmed.indexOf(' ');
    if (firstSpace > 0) {{
      const name = trimmed.slice(0, firstSpace);
      if (helperDefinitions[name]) {{
        return {{
          name,
          args: trimmed.slice(firstSpace + 1).split(/\s+/).filter(Boolean)
        }};
      }}
    }}

    if (helperDefinitions[trimmed]) {{
      return {{ name: trimmed, args: [] }};
    }}

    return null;
  }}

  function callHelper(name, args, scope, depth) {{
    const helper = helperDefinitions[name];
    if (!helper) return undefined;

    const helperLocals = Object.assign({{}}, scope || {{}});
    (helper.params || []).forEach((param, index) => {{
      helperLocals[param] = args[index];
    }});

    for (const line of helper.body || []) {{
      const trimmed = String(line || '').trim();
      if (trimmed.startsWith('return ')) {{
        return evaluateExpression(trimmed.slice(7), buildScope(helperLocals), depth);
      }}
    }}

    return undefined;
  }}

  function evaluateExpression(expr, scope, depth) {{
    if ((depth || 0) > 64) return undefined;
    const nextDepth = (depth || 0) + 1;
    let trimmed = String(expr || '').trim();
    if (!trimmed) return undefined;

    // Strip matched outer parentheses
    while (trimmed.startsWith('(') && trimmed.endsWith(')')) {{
      let d = 0;
      let matched = true;
      for (let i = 0; i < trimmed.length - 1; i += 1) {{
        if (trimmed[i] === '(') d += 1;
        if (trimmed[i] === ')') d -= 1;
        if (d === 0) {{ matched = false; break; }}
      }}
      if (!matched) break;
      trimmed = trimmed.slice(1, -1).trim();
    }}

    const helperCall = parseHelperCall(trimmed);
    if (helperCall) {{
      return callHelper(
        helperCall.name,
        helperCall.args.map((arg) => evaluateExpression(arg, scope, nextDepth)),
        scope,
        nextDepth
      );
    }}

    if (includesTopLevel(trimmed, ' or ')) {{
      return splitTopLevel(trimmed, ' or ').some((part) => Boolean(evaluateExpression(part, scope, nextDepth)));
    }}
    if (includesTopLevel(trimmed, ' and ')) {{
      return splitTopLevel(trimmed, ' and ').every((part) => Boolean(evaluateExpression(part, scope, nextDepth)));
    }}
    if (includesTopLevel(trimmed, ' != ')) {{
      const [left, right] = splitTopLevel(trimmed, ' != ');
      return valueToString(evaluateExpression(left, scope, nextDepth)) !== valueToString(evaluateExpression(right, scope, nextDepth));
    }}
    if (includesTopLevel(trimmed, ' == ')) {{
      const [left, right] = splitTopLevel(trimmed, ' == ');
      return valueToString(evaluateExpression(left, scope, nextDepth)) === valueToString(evaluateExpression(right, scope, nextDepth));
    }}
    if (includesTopLevel(trimmed, ' + ')) {{
      return splitTopLevel(trimmed, ' + ').reduce((acc, part, index) => {{
        const value = evaluateExpression(part, scope, nextDepth);
        if (index === 0) return value;
        if (typeof acc === 'number' && typeof value === 'number') return acc + value;
        return `${{valueToString(acc)}}${{valueToString(value)}}`;
      }}, undefined);
    }}
    if (trimmed.startsWith('swap ')) {{
      const tokens = trimmed.split(/\s+/);
      const current = valueToString(evaluateExpression(tokens[1], scope, nextDepth));
      const left = valueToString(evaluateExpression(tokens[2], scope, nextDepth));
      const right = valueToString(evaluateExpression(tokens[3], scope, nextDepth));
      return current === left ? right : left;
    }}
    if (trimmed.startsWith('full ')) {{
      const collection = evaluateExpression(trimmed.slice(5), scope, nextDepth);
      return Array.isArray(collection) && collection.every((item) => valueToString(item) !== '');
    }}

    // Bitwise AND: expr & expr
    if (includesTopLevel(trimmed, ' & ')) {{
      const parts = splitTopLevel(trimmed, ' & ');
      if (parts.length === 2) {{
        return (evaluateExpression(parts[0], scope, nextDepth) & evaluateExpression(parts[1], scope, nextDepth));
      }}
    }}

    // Method calls: collection.any(item => expr) and array.mask(valueExpr)
    const methodMatch = trimmed.match(/^(.+?)\.(any|mask)\((.+)\)$/);
    if (methodMatch) {{
      const [, receiver, method, argsStr] = methodMatch;
      const collection = evaluateExpression(receiver, scope, nextDepth);

      if (method === 'mask' && Array.isArray(collection)) {{
        // board.mask(player): build a bitmask where bit i is set if collection[i] === player
        const player = valueToString(evaluateExpression(argsStr, scope, nextDepth));
        return collection.reduce((acc, cell, i) => {{
          return valueToString(cell) === player ? (acc | (1 << i)) : acc;
        }}, 0);
      }}

      if (method === 'any' && Array.isArray(collection)) {{
        // array.any(item => expr): true if any element satisfies the predicate
        const arrowMatch = argsStr.match(/^(\w+)\s*=>\s*(.+)$/);
        if (arrowMatch) {{
          const [, paramName, predExpr] = arrowMatch;
          return collection.some((item) => {{
            const innerScope = Object.assign({{}}, scope, {{ [paramName]: item }});
            return Boolean(evaluateExpression(predExpr, innerScope, nextDepth));
          }});
        }}
      }}
    }}

    return resolveValue(trimmed, scope);
  }}

  function interpolate(template, scope) {{
    const OPEN = '\uE000';
    const CLOSE = '\uE001';
    return expandPercentI18n(decodeEscapes(String(template || '')))
      .replace(/\{{([^}}]+)\}}/g, function(_match, expr) {{
      const resolved = valueToString(evaluateExpression(expr, scope));
      return resolved.includes('{{') && resolved.includes('}}') ? interpolate(resolved, scope) : resolved;
      }})
      .replace(new RegExp(OPEN, 'g'), '{{')
      .replace(new RegExp(CLOSE, 'g'), '}}');
  }}

  function assignPath(pathExpr, value, locals) {{
    const segments = splitPathSegments(pathExpr);
    if (!segments.length) return;
    const baseKey = segments[0];

    if (segments.length === 1) {{
      app.state[baseKey] = value;
      return;
    }}

    let current = app.state[baseKey];
    for (let i = 1; i < segments.length - 1; i += 1) {{
      const rawKey = segments[i];
      const scopeValue = buildScope(locals);
      const lookup = Object.prototype.hasOwnProperty.call(scopeValue, rawKey) ? scopeValue[rawKey] : rawKey;
      const key = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
      if (current[key] === undefined) {{
        current[key] = {{}};
      }}
      current = current[key];
    }}

    const finalRawKey = segments[segments.length - 1];
    const scopeValue = buildScope(locals);
    const lookup = Object.prototype.hasOwnProperty.call(scopeValue, finalRawKey) ? scopeValue[finalRawKey] : finalRawKey;
    const finalKey = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
    current[finalKey] = value;
  }}

  function executeStatement(statement, locals) {{
    const trimmed = String(statement || '').trim();
    if (!trimmed) return true;
    if (trimmed === 'stop') return false;
    if (trimmed.endsWith('++')) {{
      const path = trimmed.slice(0, -2).trim();
      const current = Number(evaluateExpression(path, buildScope(locals)) || 0);
      assignPath(path, current + 1, locals);
      return true;
    }}
    if (trimmed.startsWith('stop when ')) {{
      return !Boolean(evaluateExpression(trimmed.slice(10), buildScope(locals)));
    }}
    if (trimmed.startsWith('swap ')) {{
      const tokens = trimmed.split(/\s+/);
      if (tokens.length >= 4) {{
        const nextValue = evaluateExpression(trimmed, buildScope(locals));
        assignPath(tokens[1], nextValue, locals);
      }}
      return true;
    }}
    // Handle function calls like window.__runeWebEmit(arg1, arg2)
    if (trimmed.includes('(') && trimmed.endsWith(')')) {{
      const parenIndex = trimmed.indexOf('(');
      const funcName = trimmed.slice(0, parenIndex).trim();
      const argsStr = trimmed.slice(parenIndex + 1, -1);

      // Check for window.__runeWebEmit or other function calls
      if (funcName === 'window.__runeWebEmit') {{
        const args = argsStr ? splitTopLevel(argsStr, ',').map(arg => evaluateExpression(arg, buildScope(locals))) : [];
        if (window.__runeWebEmit && typeof window.__runeWebEmit === 'function') {{
          window.__runeWebEmit.apply(null, args);
        }}
        return true;
      }}
    }}
    if (trimmed.includes('=')) {{
      const eqIndex = trimmed.indexOf('=');
      const left = trimmed.slice(0, eqIndex).trim();
      const right = trimmed.slice(eqIndex + 1).trim();
      const value = evaluateExpression(right, buildScope(locals));
      assignPath(left, value, locals);
      return true;
    }}
    return true;
  }}

  function executeSteps(steps, locals) {{
    for (const step of steps) {{
      if (Object.prototype.hasOwnProperty.call(step, 'Statement')) {{
        if (!executeStatement(step.Statement, locals)) return false;
        continue;
      }}

      if (Object.prototype.hasOwnProperty.call(step, 'Conditional')) {{
        const conditional = step.Conditional;
        if (Boolean(evaluateExpression(conditional.condition, buildScope(locals)))) {{
          if (!executeSteps(conditional.steps || [], locals)) return false;
        }}
      }}
    }}
    return true;
  }}

  function renderNode(node, locals) {{
    if (node.Element) {{
      const element = node.Element;
      if (element.for_each) {{
        const collection = evaluateExpression(element.for_each.collection, buildScope(locals));
        if (!Array.isArray(collection)) return '';
        return collection.map((item, index) => {{
          const childLocals = Object.assign({{}}, locals || {{}});
          childLocals[element.for_each.item_name] = item;
          if (element.for_each.index_name) childLocals[element.for_each.index_name] = index;
          return renderElement(element, childLocals);
        }}).join('');
      }}
      return renderElement(element, locals);
    }}

    if (node.Loop) {{
      const loop = node.Loop;
      const collection = evaluateExpression(loop.collection, buildScope(locals));
      if (!Array.isArray(collection)) return '';
      return collection.map((item, index) => {{
        const childLocals = Object.assign({{}}, locals || {{}});
        childLocals[loop.item_name] = item;
        if (loop.index_name) childLocals[loop.index_name] = index;
        return (loop.body || []).map((child) => renderNode(child, childLocals)).join('');
      }}).join('');
    }}

    if (node.Conditional) {{
      const conditional = node.Conditional;
      if (!Boolean(evaluateExpression(conditional.condition, buildScope(locals)))) return '';
      return (conditional.body || []).map((child) => renderNode(child, locals)).join('');
    }}

    if (node.ComponentScope) {{
      const scope = node.ComponentScope;
      // Merge props into the app state for rendering, but not into loop locals (locals
      // are reserved for loop-level data-rune-scope emission).
      const prevState = Object.assign({{}}, app.state);
      for (const [key, value] of Object.entries(scope.props || {{}})) {{
        app.state[key] = interpolate(value, buildScope(locals));
      }}
      const result = renderNode(scope.body, locals);
      // Restore state to avoid permanent mutation
      Object.assign(app.state, prevState);
      for (const key of Object.keys(scope.props || {{}})) {{
        if (!(key in prevState)) delete app.state[key];
      }}
      return result;
    }}

    if (node.MemoryBinding) {{
      const binding = node.MemoryBinding;
      // Reading from app.state (the proxy) registers this component as a subscriber
      // so re-renders fire automatically when this memory key updates via WebSocket.
      const memValue = app.state[binding.key];
      const childLocals = Object.assign({{}}, locals || {{}}, {{ [binding.var]: memValue }});
      return (binding.body || []).map((child) => renderNode(child, childLocals)).join('');
    }}

    if (node.Text !== undefined) {{
      return escapeHtml(interpolate(node.Text, buildScope(locals)));
    }}

    if (node.Comment !== undefined) {{
      return `<!--${{interpolate(node.Comment, buildScope(locals))}}-->`;
    }}

    return '';
  }}

  function renderElement(element, locals) {{
    const scope = buildScope(locals);
    let attrs = '';
    if (element.id) attrs += ` id="${{escapeHtml(interpolate(element.id, scope))}}"`;
    if (element.classes && element.classes.length) attrs += ` class="${{element.classes.join(' ')}}"`;

    for (const [key, value] of Object.entries(element.attrs || {{}})) {{
      attrs += ` ${{key}}="${{escapeHtml(interpolate(value, scope))}}"`;
    }}
    if (locals && Object.keys(locals).length) {{
      attrs += ` data-rune-scope="${{escapeHtml(JSON.stringify(locals))}}"`;
    }}
    for (const [eventName, handler] of Object.entries(element.events || {{}})) {{
      attrs += ` data-on-${{eventName}}="${{escapeHtml(handler)}}"`;
    }}

    const text = element.text ? escapeHtml(interpolate(element.text, scope)) : '';
    const children = (element.children || []).map((child) => renderNode(child, locals)).join('');
    return `<${{element.tag}}${{attrs}}>${{text}}${{children}}</${{element.tag}}>`;
  }}

  function parseHandlerSpec(spec) {{
    const trimmed = String(spec || '').trim();
    const match = trimmed.match(/^([A-Za-z_][\w-]*)(?:\((.*)\))?$/);
    if (!match) return null;
    const args = match[2] ? splitTopLevel(match[2], ',') : [];
    return {{ name: match[1], args }};
  }}

  function readScope(element) {{
    const raw = element.getAttribute('data-rune-scope');
    if (!raw) return {{}};
    try {{
      return JSON.parse(raw);
    }} catch (_err) {{
      return {{}};
    }}
  }}

  function bindEvent(eventName) {{
    document.addEventListener(eventName, function(event) {{
      const selector = `[data-on-${{eventName}}]`;
      const element = event.target && event.target.closest ? event.target.closest(selector) : null;
      if (!element) return;
      const spec = parseHandlerSpec(element.getAttribute(`data-on-${{eventName}}`));
      if (!spec) return;
      const locals = readScope(element);
      const scope = buildScope(locals);
      const args = spec.args.map((arg) => evaluateExpression(arg, scope));
      app.invokeAction(spec.name, args, locals);
    }});
  }}

  // ============================================================
  // Memory Subscription System
  // ============================================================
  // Track which components are subscribed to memory keys
  const memorySubscriptions = {{}};

  // Store original state as the memory-backed state
  const memoryState = Object.assign({{}}, app.state);

  // Override app.state property to intercept reads and register subscriptions
  const stateProxy = new Proxy(memoryState, {{
    get(target, prop) {{
      // If this is being accessed during a render, register subscription
      if (window.__renderingComponent && typeof prop === 'string') {{
        if (!memorySubscriptions[prop]) {{
          memorySubscriptions[prop] = new Set();
        }}
        memorySubscriptions[prop].add(window.__renderingComponent);
      }}
      return target[prop];
    }},
    set(target, prop, value) {{
      target[prop] = value;
      return true;
    }}
  }});

  // Replace app.state with the proxy
  Object.defineProperty(app, 'state', {{
    get: function() {{ return stateProxy; }},
    set: function(val) {{ Object.assign(memoryState, val); }},
    configurable: true
  }});

  // Override render to track which component is being rendered
  const originalRender = app.render;
  app.render = function() {{
    window.__renderingComponent = 'app';
    originalRender.call(this);
    window.__renderingComponent = null;
  }};

  // Factory for component-specific renders
  function createComponentRender(componentId) {{
    return function() {{
      window.__renderingComponent = componentId;
      app.computeDerived();
      const elem = document.getElementById(componentId);
      if (elem) {{
        const newHtml = renderNode(pageTree, {{}});
        elem.innerHTML = newHtml;
      }}
      window.__renderingComponent = null;
    }};
  }}

  // WebSocket listener for memory updates from the server
  function setupMemoryUpdateListener() {{
    // Try to connect to the server for memory updates
    // This assumes a WebSocket is available via window.__ws or we establish one
    if (window.__ws && window.__ws.addEventListener) {{
      window.__ws.addEventListener('message', function(event) {{
        try {{
          const data = JSON.parse(event.data);
          if (data.type === 'memory_update' && data.key) {{
            // Update the memory state
            memoryState[data.key] = data.value;

            // Find all components subscribed to this key
            if (memorySubscriptions[data.key]) {{
              memorySubscriptions[data.key].forEach((componentId) => {{
                // Schedule a re-render for this component
                if (componentId === 'app') {{
                  requestAnimationFrame(app.render.bind(app));
                }} else {{
                  const componentRender = createComponentRender(componentId);
                  requestAnimationFrame(componentRender);
                }}
              }});
            }} else {{
              // If no specific subscribers, re-render the whole app
              requestAnimationFrame(app.render.bind(app));
            }}
          }}
        }} catch (_err) {{
          // Silently ignore parse errors
        }}
      }});
    }}
  }}

  // Initialize memory subscriptions
  setupMemoryUpdateListener();

  bindEvent('click');
  bindEvent('change');
  window.runeWebApp = app;

  // Initialize WebSocket emit functionality if endpoint configured
  {ws_setup}

  app.render();
}})();"#,
            state_json = state_json,
            derived_json = derived_json,
            helper_json = helper_json,
            actions_json = actions_json,
            page_json = page_json,
            ws_setup = if self.ws_endpoint.is_some() {
                format!(r#"
  window.__runeWebEmit = function(eventName, payload) {{
    const ws = window.__runeWebSocket;
    if (!ws || ws.readyState !== WebSocket.OPEN) {{
      console.warn('WebSocket not connected');
      return;
    }}
    ws.send(JSON.stringify({{ type: eventName, payload: payload || {{}} }}));
  }};

  // Connect to WebSocket for bidirectional updates
  window.__runeWebSocket = new WebSocket('{endpoint}');
  window.__runeWebSocket.onmessage = function(event) {{
    try {{
      const message = JSON.parse(event.data);
      if (message.type === 'memory_update') {{
        // Update local state if memory changed
        app.state[message.key] = message.value;
        app.render();
      }}
    }} catch (_err) {{
      // Silently ignore parse errors
    }}
  }};
  window.__runeWebSocket.onerror = function(error) {{
    console.error('WebSocket error:', error);
  }};
"#, endpoint = self.ws_endpoint.as_ref().unwrap()
                )
            } else {
                String::new()
            }
        )
    }

    fn generate_state_json(&self) -> String {
        let mut normalized = serde_json::Map::new();
        for (key, val) in &self.logic.state {
            normalized.insert(key.clone(), self.parse_value(val));
        }
        // Overlay pre-fetched memory values — these are live server values that
        // MemoryBinding nodes read from app.state[key], so they must be in initial state.
        for (key, val) in &self.memory_seed {
            normalized.insert(key.clone(), val.clone());
        }
        serde_json::Value::Object(normalized).to_string()
    }

    /// Parse a Rune value literal to JSON.
    fn parse_value(&self, val: &str) -> serde_json::Value {
        let trimmed = val.trim();

        if let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) {
            return value;
        }
        if trimmed == "true" {
            return serde_json::Value::Bool(true);
        }
        if trimmed == "false" {
            return serde_json::Value::Bool(false);
        }
        if trimmed == "null" {
            return serde_json::Value::Null;
        }
        if let Ok(number) = trimmed.parse::<f64>() {
            if let Some(number) = serde_json::Number::from_f64(number) {
                return serde_json::Value::Number(number);
            }
        }
        serde_json::Value::String(normalize_literal(trimmed))
    }
}

fn normalize_literal(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() >= 2
        && ((trimmed.starts_with('"') && trimmed.ends_with('"'))
            || (trimmed.starts_with('\'') && trimmed.ends_with('\'')))
    {
        trimmed[1..trimmed.len() - 1].to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::apps::rune_web::ast::{
        ActionDefinition, ActionStep, DerivedCase, DerivedDefinition, HelperDefinition,
    };
    use std::collections::HashMap;

    #[test]
    fn generates_page_bootstrap_and_runtime_hooks() {
        let logic = LogicDefinition {
            state: [("count".to_string(), "0".to_string())]
                .iter()
                .cloned()
                .collect(),
            derived: HashMap::from([(
                "label".to_string(),
                DerivedDefinition {
                    source: "count".to_string(),
                    cases: vec![DerivedCase {
                        matcher: "_".to_string(),
                        value: "Value: {count}".to_string(),
                    }],
                },
            )]),
            helpers: HashMap::from([(
                "is_even".to_string(),
                HelperDefinition {
                    params: vec!["value".to_string()],
                    body: vec!["return value == 0".to_string()],
                },
            )]),
            actions: HashMap::from([(
                "increment".to_string(),
                ActionDefinition {
                    params: vec![],
                    steps: vec![ActionStep::Statement("count = count + 1".to_string())],
                },
            )]),
        };
        let page = ViewNode::Element {
            tag: "main".to_string(),
            classes: vec![],
            id: None,
            attrs: HashMap::new(),
            events: HashMap::new(),
            text: None,
            for_each: None,
            children: vec![ViewNode::Element {
                tag: "p".to_string(),
                classes: vec![],
                id: None,
                attrs: HashMap::new(),
                events: HashMap::new(),
                text: Some("{label}".to_string()),
                for_each: None,
                children: vec![],
            }],
        };

        let gen = JsCodegen::new(page, logic, "{}".to_string(), None);
        let code = gen.generate();
        assert!(code.contains("const pageTree ="));
        assert!(code.contains("const helperDefinitions ="));
        assert!(code.contains("window.runeWebApp = app"));
        assert!(code.contains("app.render();"));
        assert!(code.contains("executeSteps"));
        assert!(!code.contains("trimmed.startsWith('win ')"));
    }

    #[test]
    fn generates_bitmask_array_any_support() {
        let logic = LogicDefinition {
            state: HashMap::new(),
            derived: HashMap::new(),
            helpers: HashMap::from([(
                "win".to_string(),
                HelperDefinition {
                    params: vec!["board".to_string(), "player".to_string()],
                    body: vec![
                        "return WINS.any(mask => (board.mask(player) & mask) == mask)".to_string(),
                    ],
                },
            )]),
            actions: HashMap::new(),
        };
        let gen = JsCodegen::new(ViewNode::Text("".to_string()), logic, "{}".to_string(), None);
        let code = gen.generate();
        // bitwise AND operator
        assert!(code.contains("' & '"));
        // .mask() method support
        assert!(code.contains("method === 'mask'"));
        // .any() method with arrow function support
        assert!(code.contains("method === 'any'"));
        assert!(code.contains("arrowMatch"));
    }

    #[test]
    fn parses_value_literals_to_json() {
        let logic = LogicDefinition {
            state: HashMap::new(),
            derived: HashMap::new(),
            helpers: HashMap::new(),
            actions: HashMap::new(),
        };
        let gen = JsCodegen::new(ViewNode::Text("hi".to_string()), logic, "{}".to_string(), None);
        assert_eq!(gen.parse_value("\"hello\""), serde_json::Value::String("hello".to_string()));
        assert_eq!(gen.parse_value("42"), serde_json::json!(42));
        assert_eq!(gen.parse_value("true"), serde_json::json!(true));
        assert_eq!(gen.parse_value("[1,2,3]"), serde_json::json!([1, 2, 3]));
    }
}





