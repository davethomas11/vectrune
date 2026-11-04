// ============================================================================
// Section parser — converts a token stream into a RuneDocument
// ============================================================================

import { tokenize } from './lexer';
import type {
  RuneDocument,
  AppSection,
  SchemaSection,
  RouteSection,
  RunStep,
  GraphqlField,
} from '../types';

// ---------------------------------------------------------------------------
// Known builtin names — used to distinguish "builtin call" from "assignment"
// ---------------------------------------------------------------------------

const BUILTIN_NAMES = new Set([
  'log', 'respond', 'return',
  'parse-json',
  'validate',
  'csv.read', 'csv.write', 'csv.append',
  'json.read', 'json.write',
  'memory.set', 'memory.get', 'memory.clear', 'memory.del',
  'set-memory', 'get-memory', 'clear-memory', 'del-memory',
  'append', 'memory.append',
  'load-rune',
  'is-set',
  'delete',
  'ws.id', 'ws.send', 'ws.broadcast', 'broadcast-websocket',
  'stop', 'to-number', 'to-string', 'to-bool', 'uuid.v4', 'uuid', 'now', 'summarize',
]);

// ---------------------------------------------------------------------------
// Parse a single indented block of run: lines into RunStep[]
// Each entry is a raw trimmed line with its indent level.
// ---------------------------------------------------------------------------

interface IndentedLine {
  text: string;
  indent: number;
}

function parseRunSteps(lines: IndentedLine[], baseIndent: number): RunStep[] {
  const steps: RunStep[] = [];
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
      const bodyLines: IndentedLine[] = [];
      while (i < lines.length && lines[i].indent > baseIndent) {
        bodyLines.push(lines[i]);
        i++;
      }
      const bodyIndent = bodyLines.length > 0 ? bodyLines[0].indent : baseIndent + 4;
      const body = parseRunSteps(bodyLines, bodyIndent);
      const step: RunStep = { kind: "if", condition, body };
      steps.push(step);
      continue;
    }
    const assignMatch = text.match(/^(.+?)(?<![!<>=])=(?!=)(.*)$/);
    if (assignMatch && !text.match(/^.+?\.push\(/)) {
      const lhs = assignMatch[1].trim();
      let rhs = assignMatch[2].trim();
      if (/^[A-Za-z_][\w.\-[\]()]*$/.test(lhs) && !lhs.includes(" ")) {
        // If rhs opens an object or array that isn't closed on this line, gather subsequent lines
        const countBraces = (s: string) => (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
        const countBrackets = (s: string) => (s.match(/\[/g) || []).length - (s.match(/\]/g) || []).length;
        let braceBalance = countBraces(rhs);
        let bracketBalance = countBrackets(rhs);
        while (i < lines.length && (braceBalance > 0 || bracketBalance > 0)) {
          const nextText = lines[i].text.trim();
          rhs += " " + nextText;
          braceBalance += countBraces(nextText);
          bracketBalance += countBrackets(nextText);
          i++;
        }

        const rhsFirst = rhs.split(/\s+/)[0];
        if (BUILTIN_NAMES.has(rhsFirst)) {
          const builtinArgs = rhs.slice(rhsFirst.length).trim();
          const step: RunStep = {
            kind: "assignment",
            lhs,
            rhs: builtinArgs ? `${rhsFirst} ${builtinArgs}` : rhsFirst
          };
          steps.push(step);
        } else {
          const step: RunStep = { kind: "assignment", lhs, rhs };
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
      let rest = text.slice(firstToken.length).trim();
      const countBraces = (s: string) => (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
      const countBrackets = (s: string) => (s.match(/\[/g) || []).length - (s.match(/\]/g) || []).length;
      let braceBalance = countBraces(rest);
      let bracketBalance = countBrackets(rest);
      while (i < lines.length && (braceBalance > 0 || bracketBalance > 0)) {
        const nextText = lines[i].text.trim();
        rest += " " + nextText;
        braceBalance += countBraces(nextText);
        bracketBalance += countBrackets(nextText);
        i++;
      }
      const args = parseBuiltinArgs(rest);
      const step: RunStep = { kind: "builtin", name: firstToken, args };
      steps.push(step);
      continue;
    }
    steps.push({ kind: "raw", text });
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Simple argument splitter respecting quoted strings
// ---------------------------------------------------------------------------

export function parseBuiltinArgs(raw: string): string[] {
  if (!raw) return [];
  const args = [];
  let current = "";
  let inString = false;
  let stringChar = "";
  let escaped = false;
  let depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        current += ch;
        escaped = false;
      } else if (ch === "\\") {
        current += ch;
        escaped = true;
      } else if (ch === stringChar) {
        current += ch;
        inString = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      current += ch;
    } else if (ch === "{" || ch === "[" || ch === "(") {
      depth++;
      current += ch;
    } else if (ch === "}" || ch === "]" || ch === ")") {
      if (depth > 0) depth--;
      current += ch;
    } else if ((ch === " " || ch === "\t") && depth === 0) {
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

// ---------------------------------------------------------------------------
// Parse key-value pairs — handles inline JSON objects/arrays
// ---------------------------------------------------------------------------

function parseKeyValue(raw: string): [string, unknown] {
  const eqIdx = raw.indexOf('=');
  if (eqIdx === -1) return [raw.trim(), ''];
  const key = raw.slice(0, eqIdx).trim();
  const valStr = raw.slice(eqIdx + 1).trim();

  // Try to parse as JSON object/array
  if ((valStr.startsWith('{') || valStr.startsWith('['))) {
    try {
      return [key, JSON.parse(valStr)];
    } catch (_) {
      // fall through to string
    }
  }

  return [key, valStr];
}

// ---------------------------------------------------------------------------
// Main parse function
// ---------------------------------------------------------------------------

export function parseSections(source: string): RuneDocument {
  const tokens = tokenize(source);

  const doc: RuneDocument = {
    shebang: false,
    imports: [],
    app: null,
    schemas: {},
    routes: [],
    rawSections: {},
    graphql: { types: {}, fields: [] },
  };

  // We'll process tokens section by section
  // First pass: identify section boundaries
  type SectionBoundary = {
    sectionRaw: string;
    startIdx: number;
    endIdx: number;
  };

  const sectionBoundaries: SectionBoundary[] = [];
  let preambleEnd = 0;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.kind === 'Shebang') {
      doc.shebang = true;
      preambleEnd = i + 1;
      continue;
    }
    if (tok.kind === 'Import') {
      doc.imports.push(tok.raw);
      preambleEnd = i + 1;
      continue;
    }
    if (tok.kind === 'Comment' || tok.kind === 'Blank') {
      if (sectionBoundaries.length === 0) preambleEnd = i + 1;
      continue;
    }
    if (tok.kind === 'Section') {
      if (sectionBoundaries.length > 0) {
        sectionBoundaries[sectionBoundaries.length - 1].endIdx = i;
      }
      sectionBoundaries.push({ sectionRaw: tok.raw, startIdx: i + 1, endIdx: tokens.length });
    }
  }

  // Process each section
  for (const boundary of sectionBoundaries) {
    const sectionLine = boundary.sectionRaw;
    const sectionTokens = tokens.slice(boundary.startIdx, boundary.endIdx)
      .filter(t => t.kind !== 'Blank' && t.kind !== 'Comment');

    // Parse section header: @Type/subpath or @Type rest
    const sectionMatch = sectionLine.match(/^@([A-Za-z][A-Za-z0-9_-]*)(?:\/(.+))?$/);
    if (!sectionMatch) continue;

    const sectionType = sectionMatch[1]; // App, Schema, Route, etc.
    const sectionSub = sectionMatch[2]?.trim() ?? '';  // GET /users/{id}, User, etc.

    if (sectionType === 'App') {
      doc.app = parseAppSection(sectionTokens);
    } else if (sectionType === 'Schema') {
      const schemaName = sectionSub;
      doc.schemas[schemaName] = parseSchemaSection(sectionTokens);
    } else if (sectionType === 'Type') {
      doc.graphql.types[sectionSub] = parseSchemaSection(sectionTokens);
    } else if (sectionType === 'GraphQL') {
      const [operation, type] = sectionSub.split('/');
      if (operation !== 'Query' && operation !== 'Mutation') {
        throw new Error(`Unsupported GraphQL section: ${sectionSub}`);
      }
      let field: GraphqlField | null = null;
      let body: IndentedLine[] = [];
      const finish = () => {
        if (field) {
          field.run = parseRunSteps(body, body[0]?.indent ?? 4);
          doc.graphql.fields.push(field);
        }
      };
      for (const token of sectionTokens) {
        if (token.indent === 0 && token.raw.endsWith(':')) {
          finish();
          field = parseGraphqlField(token.raw.slice(0, -1), operation === 'Query' ? 'query' : 'mutation', type);
          body = [];
        } else if (field) {
          body.push({ text: token.raw, indent: token.indent });
        }
      }
      finish();
    } else if (sectionType === 'Query' || sectionType === 'Mutation') {
      const field = parseGraphqlField(sectionSub, sectionType === 'Query' ? 'query' : 'mutation');
      const body = sectionTokens.filter(token => !(token.indent === 0 && token.raw === 'run:'));
      field.run = parseRunSteps(body.map(token => ({ text: token.raw, indent: token.indent })), body[0]?.indent ?? 4);
      doc.graphql.fields.push(field);
    } else if (sectionType === 'Route') {
      const route = parseRouteSection(sectionSub, sectionTokens);
      if (route) doc.routes.push(route);
    } else {
      // Generic section
      const kvData: Record<string, unknown> = {};
      let record: Record<string, unknown> | null = null;
      for (const tok of sectionTokens) {
        const startsRecord = tok.raw.startsWith('+ ');
        const raw = startsRecord ? tok.raw.slice(2).trim() : tok.raw;
        if (startsRecord) {
          record = {};
          (kvData.record ??= [] as unknown[]);
          (kvData.record as unknown[]).push(record);
        }
        if (raw.includes('=') && (record || tok.kind === 'KeyValue')) {
          const [key, value] = parseKeyValue(raw);
          let parsed = value;
          if (typeof value === 'string') {
            try { parsed = JSON.parse(value); } catch (_) { /* Unquoted Rune string. */ }
          }
          (record ?? kvData)[key] = parsed;
        }
      }
      const key = sectionSub ? `${sectionType}/${sectionSub}` : sectionType;
      doc.rawSections[key] = kvData;
    }
  }

  return doc;
}

function parseGraphqlField(signature: string, kind: GraphqlField['kind'], type?: string): GraphqlField {
  const match = signature.match(/^([_A-Za-z]\w*)(?:\((.*?)\))?\s*(?:->\s*(.+))?$/);
  if (!match) throw new Error(`Invalid GraphQL resolver: ${signature}`);
  const [, name, parameters, declaredType] = match;
  const args: Record<string, string> = {};
  for (const parameter of parameters?.split(',') ?? []) {
    if (!parameter.trim()) continue;
    const argument = parameter.trim().match(/^([_A-Za-z]\w*)\s*:\s*([\w[\]!]+)$/);
    if (!argument) throw new Error(`Invalid GraphQL argument: ${parameter}`);
    args[argument[1]] = argument[2];
  }
  const singular = name.endsWith('s') ? name.replace(/s+$/, '') : name;
  const inferred = singular.charAt(0).toUpperCase() + singular.slice(1);
  const returnType = declaredType ?? (type ? `${type}!` : kind === 'mutation' ? 'JSON' : name.endsWith('s') ? `[${inferred}!]!` : `${inferred}!`);
  return { kind, name, args, returnType, run: [] };
}

// ---------------------------------------------------------------------------
// App section parser
// ---------------------------------------------------------------------------

function parseAppSection(tokens: ReturnType<typeof tokenize>): AppSection {
  const app: AppSection = {
    name: '',
    type: 'REST',
    run: [],
  };

  let inRunBlock = false;
  let runBlockIndent = -1;
  const runLines: Array<{ text: string; indent: number }> = [];

  for (const tok of tokens) {
    if (tok.kind === 'BlockHeader' && tok.raw.replace(/:.*/, '') === 'run') {
      inRunBlock = true;
      runBlockIndent = -1;
      continue;
    }

    if (inRunBlock && tok.kind === 'BlockLine') {
      if (runBlockIndent === -1) runBlockIndent = tok.indent;
      runLines.push({ text: tok.raw, indent: tok.indent });
      continue;
    }

    if (tok.kind === 'KeyValue' && !inRunBlock) {
      const [k, v] = parseKeyValue(tok.raw);
      if (k === 'name') app.name = String(v);
      else if (k === 'type') app.type = String(v);
      else if (k === 'version') app.version = String(v);
      else app[k] = v;
    }
  }

  if (runLines.length > 0) {
    app.run = parseRunSteps(runLines, runBlockIndent === -1 ? runLines[0]?.indent ?? 4 : runBlockIndent);
  }

  return app;
}

// ---------------------------------------------------------------------------
// Schema section parser
// ---------------------------------------------------------------------------

function parseSchemaSection(tokens: ReturnType<typeof tokenize>): SchemaSection {
  const schema: SchemaSection = { fields: {} };
  let inFieldsBlock = false;

  for (const tok of tokens) {
    if (tok.kind === 'BlockHeader' && tok.raw.replace(/:.*/, '') === 'fields') {
      inFieldsBlock = true;
      continue;
    }

    if (inFieldsBlock && tok.kind === 'BlockLine') {
      // Support "name: String" style (colon-separated inside fields block)
      const colonMatch = tok.raw.match(/^([A-Za-z_]\w*)\s*:\s*(.+)$/);
      if (colonMatch) {
        schema.fields[colonMatch[1]] = colonMatch[2].trim();
      }
      continue;
    }

    // Also handle flat key = type style (like user_api.rune)
    if (tok.kind === 'KeyValue') {
      const eqIdx = tok.raw.indexOf('=');
      if (eqIdx !== -1) {
        const fieldName = tok.raw.slice(0, eqIdx).trim();
        const fieldType = tok.raw.slice(eqIdx + 1).trim();
        schema.fields[fieldName] = fieldType;
      }
    }
  }

  return schema;
}

// ---------------------------------------------------------------------------
// Route section parser
// ---------------------------------------------------------------------------

function parseRouteSection(
  subPath: string,
  tokens: ReturnType<typeof tokenize>,
): RouteSection | null {
  // subPath is like "GET /users/{id}" or "POST /users"
  const parts = subPath.match(/^([A-Z]+)\s+(.+)$/);
  if (!parts) return null;

  const method = parts[1];
  const path = parts[2].trim();

  const route: RouteSection = {
    method,
    path,
    run: [],
    meta: {},
  };

  let inRunBlock = false;
  let runBlockIndent = -1;
  const runLines: Array<{ text: string; indent: number }> = [];

  for (const tok of tokens) {
    if (tok.kind === 'BlockHeader' && tok.raw.replace(/:.*/, '') === 'run') {
      inRunBlock = true;
      runBlockIndent = -1;
      continue;
    }

    if (inRunBlock) {
      if (tok.kind === 'BlockLine' || tok.kind === 'BlockHeader') {
        if (runBlockIndent === -1) runBlockIndent = tok.indent;
        runLines.push({ text: tok.raw, indent: tok.indent });
        continue;
      }
    }

    if (!inRunBlock && tok.kind === 'KeyValue') {
      const eqIdx = tok.raw.indexOf('=');
      if (eqIdx !== -1) {
        const k = tok.raw.slice(0, eqIdx).trim();
        const v = tok.raw.slice(eqIdx + 1).trim();
        if (k === 'expect') route.expect = v;
        else route.meta[k] = v;
      }
    }
  }

  if (runLines.length > 0) {
    route.run = parseRunSteps(runLines, runBlockIndent === -1 ? runLines[0]?.indent ?? 4 : runBlockIndent);
  }

  return route;
}
