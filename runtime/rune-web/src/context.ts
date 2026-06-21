// ============================================================================
// Shared runtime context — singleton set during boot()
// ============================================================================

import type {
  RuneApp,
  ViewNode,
  DerivedDefinition,
  HelperDefinition,
  ActionDefinition,
} from './types';

/** Holds all shared state for the runtime. */
export interface RuneContext {
  pageTree: ViewNode;
  derivedDefinitions: Record<string, DerivedDefinition>;
  helperDefinitions: Record<string, HelperDefinition>;
  actionDefinitions: Record<string, ActionDefinition>;
  i18nData: Record<string, string>;
  app: RuneApp;
  isRendering: boolean;
  memorySubscriptions: Record<string, Set<string>>;
}

let _ctx: RuneContext | null = null;

/** Initialize the global runtime context. Called once during boot(). */
export function initContext(context: RuneContext): void {
  _ctx = context;
}

/** Get the current runtime context. Throws if boot() hasn't been called. */
export function ctx(): RuneContext {
  if (!_ctx) throw new Error('RuneWeb context not initialized — call boot() first');
  return _ctx;
}
