// ============================================================================
// Rune Emulator — public API
//
// A browser-compatible TypeScript runtime that emulates Vectrune's server-side
// capabilities for teaching purposes (no WASM, no Rust binary required).
//
// Usage:
//   import { parse, createApp, serialize } from '@vectrune/rune-emulator';
//
//   const doc = parse(runeSource);
//   const app = createApp(doc, {
//     files: { 'users.csv': [{ id: 1, name: 'Alice', email: 'a@ex.com' }] },
//   });
//   const response = app.request({ method: 'GET', path: '/users' });
//   console.log(serialize(response.body, 'json'));
// ============================================================================

import { parseSections } from './parser/section-parser';
import { handleRequest } from './engine/mock-api';
import { executeSteps } from './engine/executor';
import { createRequestContext } from './engine/context';
import { serialize as _serialize } from './serializer/index';
import { createGraphqlEngine } from './engine/graphql';
import type { GraphqlRequest, GraphqlExample } from './engine/graphql';
export type { GraphqlRequest, GraphqlExample } from './engine/graphql';

export type { RuneDocument, AppSection, SchemaSection, RouteSection, RunStep } from './types';
export type { MockRequest, MockResponse } from './engine/context';
export type { SerializeFormat } from './serializer/index';

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

/**
 * Parse a raw `.rune` source string into a structured RuneDocument.
 *
 * @example
 * const doc = parse(`
 * @App
 * name = My API
 * type = REST
 *
 * @Route/GET /hello
 * run:
 *     respond 200 "Hello!"
 * `);
 */
export function parse(source: string) {
  return parseSections(source);
}

// ---------------------------------------------------------------------------
// createApp
// ---------------------------------------------------------------------------

export interface SeedData {
  /** Pre-populated file data accessible via csv.read / json.read builtins.
   *  Keys are file names (e.g. "users.csv"), values are arrays of records. */
  files?: Record<string, unknown[]>;
  /** Initial memory store values (for memory.get). */
  memory?: Record<string, unknown>;
}

export interface RuneEmulatorApp {
  /** The parsed document this app was created from */
  document: ReturnType<typeof parseSections>;
  /** Execute a mock HTTP request against this app */
  request(req: import('./engine/context').MockRequest): import('./engine/context').MockResponse;
  graphql(req: GraphqlRequest): import('./engine/context').MockResponse;
  graphqlInfo(): { schema: string; examples: GraphqlExample[] };
  /** Direct access to the mutable file store (for inspection / updates) */
  fileStore: Record<string, unknown[]>;
  /** Direct access to the mutable memory store */
  memoryStore: Record<string, unknown>;
}

/**
 * Create a runnable mock application from a parsed RuneDocument.
 *
 * @param doc     A RuneDocument produced by `parse()`
 * @param seed    Optional seed data — files and initial memory values
 *
 * @example
 * const app = createApp(doc, {
 *   files: {
 *     'users.csv': [
 *       { id: 1, name: 'Alice', email: 'alice@example.com' },
 *     ],
 *   },
 * });
 * const { status, body } = app.request({ method: 'GET', path: '/users' });
 */
export function createApp(
  doc: ReturnType<typeof parseSections>,
  seed: SeedData = {},
): RuneEmulatorApp {
  const fileStore: Record<string, unknown[]> = Object.assign({}, seed.files ?? {});
  const memoryStore: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(doc.rawSections)) {
    if (name.startsWith('Memory/')) {
      memoryStore[name.slice('Memory/'.length)] = JSON.parse(JSON.stringify(value.record ?? value));
    } else if (name === 'Memory') {
      Object.assign(memoryStore, JSON.parse(JSON.stringify(value)));
    }
  }
  Object.assign(memoryStore, seed.memory ?? {});
  let engine: ReturnType<typeof createGraphqlEngine> | undefined;
  const graphqlInfo = () => (engine ??= createGraphqlEngine(doc, fileStore, memoryStore)).info;
  const graphql = (req: GraphqlRequest): import('./engine/context').MockResponse => {
    try {
      if (!req || typeof req.query !== 'string') throw new Error('GraphQL requests need a query string.');
      if (req.variables !== undefined && (req.variables === null || typeof req.variables !== 'object' || Array.isArray(req.variables))) {
        throw new Error('GraphQL variables must be a JSON object.');
      }
      return (engine ??= createGraphqlEngine(doc, fileStore, memoryStore)).execute(req);
    } catch (error) {
      return { status: 400, body: { errors: [{ message: error instanceof Error ? error.message : String(error) }] }, logs: [] };
    }
  };

  // Run @App run: block if present (e.g. to seed memory from data)
  if (doc.app && doc.app.run.length > 0) {
    const mockReq = { method: 'INTERNAL', path: '/_init' };
    const ctx = createRequestContext(mockReq, {}, doc.schemas, fileStore, memoryStore);
    executeSteps(doc.app.run, ctx);
  }

  return {
    document: doc,
    fileStore,
    memoryStore,
    graphql,
    graphqlInfo,

    request(req) {
      if (doc.graphql.fields.length && req.method.toUpperCase() === 'POST' && req.path === '/graphql') {
        try {
          return graphql(JSON.parse(req.body ?? '{}'));
        } catch (_) {
          return { status: 400, body: { errors: [{ message: 'GraphQL request body must be valid JSON.' }] }, logs: [] };
        }
      }
      return handleRequest(
        {
          routes: doc.routes,
          schemas: doc.schemas,
          fileStore,
          memoryStore,
        },
        req,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// serialize
// ---------------------------------------------------------------------------

/**
 * Serialize any value to JSON, YAML, or XML.
 *
 * @param value    The value to serialize
 * @param format   'json' | 'yaml' | 'xml'
 * @param rootTag  Root element tag for XML output (default: 'root')
 *
 * @example
 * serialize([{ id: 1, name: 'Alice' }], 'yaml');
 * serialize(response.body, 'xml', 'users');
 */
export function serialize(
  value: unknown,
  format: 'json' | 'yaml' | 'xml',
  rootTag = 'root',
): string {
  return _serialize(value, format, rootTag);
}

// Re-export individual serializers for direct use
export { toJson, toYaml, toXml } from './serializer/index';

function formatDocumentStep(step: import('./types').RunStep): unknown {
  if (step.kind === 'raw') return step.text;
  if (step.kind === 'assignment') return `${step.lhs} = ${step.rhs}`;
  if (step.kind === 'if') return { [`if ${step.condition}`]: step.body.map(formatDocumentStep) };
  return `${step.name} ${step.args.map(arg => arg.includes(' ') && !arg.startsWith('"') ? '"' + arg + '"' : arg).join(' ')}`.trim();
}

// ---------------------------------------------------------------------------
// toDocument
// ---------------------------------------------------------------------------

/**
 * Converts the AST back into the structured data format output by the CLI `-o` command.
 */
export function toDocument(doc: import('./types').RuneDocument): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (doc.app) {
    const appData = { ...doc.app } as any;
    if (appData.run && appData.run.length === 0) delete appData.run;
    result['App'] = appData;
  }

  if (Object.keys(doc.schemas).length > 0) {
    const schemas: Record<string, unknown> = {};
    result.Schema = schemas;
    for (const [name, schema] of Object.entries(doc.schemas)) {
      schemas[name] = schema.fields;
    }
  }

  if (Object.keys(doc.graphql.types).length) result.Type = Object.fromEntries(Object.entries(doc.graphql.types).map(([name, type]) => [name, type.fields]));
  if (doc.graphql.fields.length) {
    const sections: Record<string, Record<string, unknown>> = {};
    for (const field of doc.graphql.fields) {
      const section = field.kind === 'query' ? 'Query' : 'Mutation';
      const args = Object.entries(field.args).map(([name, type]) => `${name}: ${type}`).join(', ');
      const signature = `${field.name}${args ? `(${args})` : ''} -> ${field.returnType}`;
      (sections[section] ??= {})[signature] = field.run.map(formatDocumentStep);
    }
    result.GraphQL = sections;
  }

  if (doc.routes.length > 0) {
    const routes: Record<string, Record<string, unknown>> = {};
    result.Route = routes;
    for (const route of doc.routes) {
      routes[route.method] ??= {};
      
      const parts = route.path.split('/').filter((p: string) => p.length > 0);
      let current = routes[route.method];
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current[part]) current[part] = {};
        current = current[part] as Record<string, unknown>;
      }
      
      if (route.expect) current.expect = route.expect;
      for (const [k, v] of Object.entries(route.meta)) {
        current[k] = v;
      }
      
      if (route.run.length > 0) {
         current.run = route.run.map(formatDocumentStep);
      }
    }
  }

  for (const [key, value] of Object.entries(doc.rawSections)) {
    const [type, sub] = key.split('/');
    if (sub) {
      if (!result[type]) result[type] = {};
      (result[type] as any)[sub] = value;
    } else {
      result[type] = value;
    }
  }

  return result;
}
