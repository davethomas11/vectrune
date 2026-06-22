// ============================================================================
// Request execution context
// ============================================================================

import type { SchemaSection } from '../types';

/** A mock HTTP request coming into the emulator */
export interface MockRequest {
  method: string;
  path: string;
  body?: string;
  headers?: Record<string, string>;
}

/** The response produced by executing a route */
export interface MockResponse {
  status: number;
  body: unknown;
  /** Expanded log messages produced during execution */
  logs: string[];
}

/** Internal per-request mutable execution state */
export interface RequestContext {
  method: string;
  path: string;
  /** Extracted path parameters, e.g. { id: "42" } */
  pathParams: Record<string, string>;
  /** Raw request body string (or null) */
  body: string | null;
  /** Parsed body after parse-json */
  parsedBody: unknown;
  /** Local variables set during execution */
  state: Record<string, unknown>;
  /** Accumulated log messages */
  logs: string[];
  /** Set once respond is called — stops further execution */
  response: MockResponse | null;
  /** Schema definitions from the document */
  schemas: Record<string, SchemaSection>;
  /** In-memory file store (for csv.read / json.read) */
  fileStore: Record<string, unknown[]>;
  /** Shared memory store */
  memoryStore: Record<string, unknown>;
}

/** Build a fresh request context */
export function createRequestContext(
  req: MockRequest,
  pathParams: Record<string, string>,
  schemas: Record<string, SchemaSection>,
  fileStore: Record<string, unknown[]>,
  memoryStore: Record<string, unknown>,
): RequestContext {
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
    memoryStore,
  };
}

/** Build the expression scope from a RequestContext */
export function buildScopeFromContext(ctx: RequestContext): Record<string, unknown> {
  return {
    ...ctx.state,
    body: ctx.parsedBody ?? ctx.body,
    path: {
      params: ctx.pathParams,
    },
    // Also expose path params at the top level (e.g. {id} in the path)
    ...ctx.pathParams,
  };
}
