// ============================================================================
// Mock API router — matches requests to @Route sections and executes them
// ============================================================================

import type { RouteSection, SchemaSection } from '../types';
import type { MockRequest, MockResponse } from './context';
import { createRequestContext } from './context';
import { executeSteps } from './executor';

// ---------------------------------------------------------------------------
// Path matching — extract params from /users/{id} style patterns
// ---------------------------------------------------------------------------

/**
 * Returns extracted path params if the request path matches the route pattern,
 * or null if it doesn't match.
 *
 * e.g. pattern = "/users/{id}", path = "/users/42" → { id: "42" }
 */
export function matchPath(
  pattern: string,
  requestPath: string,
): Record<string, string> | null {
  // Normalize trailing slashes
  const normPattern = pattern.replace(/\/$/, '') || '/';
  const normRequest = requestPath.split('?')[0].replace(/\/$/, '') || '/';

  const patternParts = normPattern.split('/');
  const requestParts = normRequest.split('/');

  if (patternParts.length !== requestParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const pat = patternParts[i];
    const req = requestParts[i];

    if (pat.startsWith('{') && pat.endsWith('}')) {
      // Dynamic segment — extract param
      const paramName = pat.slice(1, -1);
      params[paramName] = req;
    } else if (pat.toLowerCase() !== req.toLowerCase()) {
      // Static segment mismatch
      return null;
    }
  }

  return params;
}

// ---------------------------------------------------------------------------
// Find the matching route
// ---------------------------------------------------------------------------

export function findMatchingRoute(
  routes: RouteSection[],
  req: MockRequest,
): { route: RouteSection; params: Record<string, string> } | null {
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

// ---------------------------------------------------------------------------
// Execute a matched route
// ---------------------------------------------------------------------------

export function executeRoute(
  route: RouteSection,
  pathParams: Record<string, string>,
  req: MockRequest,
  schemas: Record<string, SchemaSection>,
  fileStore: Record<string, unknown[]>,
  memoryStore: Record<string, unknown>,
): MockResponse {
  const ctx = createRequestContext(req, pathParams, schemas, fileStore, memoryStore);
  executeSteps(route.run, ctx);

  // If no respond was called, default to 200 with null body
  return ctx.response ?? { status: 200, body: null, logs: ctx.logs };
}

// ---------------------------------------------------------------------------
// Main handleRequest entry point
// ---------------------------------------------------------------------------

export interface AppState {
  routes: RouteSection[];
  schemas: Record<string, SchemaSection>;
  fileStore: Record<string, unknown[]>;
  memoryStore: Record<string, unknown>;
}

export function handleRequest(state: AppState, req: MockRequest): MockResponse {
  const match = findMatchingRoute(state.routes, req);

  if (!match) {
    return {
      status: 404,
      body: `Route not found: ${req.method.toUpperCase()} ${req.path}`,
      logs: [],
    };
  }

  return executeRoute(
    match.route,
    match.params,
    req,
    state.schemas,
    state.fileStore,
    state.memoryStore,
  );
}
