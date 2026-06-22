// ============================================================================
// Types — shared document/AST types for rune-emulator
// ============================================================================

// ---------------------------------------------------------------------------
// Parsed .rune document
// ---------------------------------------------------------------------------

export interface RuneDocument {
  /** Whether the file started with #!RUNE */
  shebang: boolean;
  /** Declared imports (file paths) */
  imports: string[];
  /** @App section */
  app: AppSection | null;
  /** @Schema/<name> sections keyed by schema name */
  schemas: Record<string, SchemaSection>;
  /** @Route/<METHOD> <path> sections in order */
  routes: RouteSection[];
  /** Any other @<SectionType>/<name> sections, raw key-value data */
  rawSections: Record<string, Record<string, unknown>>;
}

export interface AppSection {
  name: string;
  type: string;  // 'REST' | 'GraphQL' | 'WebSocket' | 'Frontend' | ...
  version?: string;
  run: RunStep[];
  [key: string]: unknown;
}

export interface SchemaSection {
  /** Maps field name → type string, e.g. "id" → "number" */
  fields: Record<string, string>;
}

export interface RouteSection {
  /** HTTP method: GET, POST, PUT, DELETE, PATCH */
  method: string;
  /** Path pattern, e.g. /users/{id} */
  path: string;
  /** Schema name for expected request body, e.g. "User" */
  expect?: string;
  /** Steps in the run: block */
  run: RunStep[];
  /** Other key-value pairs on the route section */
  meta: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Run steps — the AST for run: blocks
// ---------------------------------------------------------------------------

export type RunStep =
  | AssignmentStep
  | BuiltinStep
  | IfStep
  | RawStep;

export interface AssignmentStep {
  kind: 'assignment';
  /** Left-hand side path (e.g. "user", "state.players.[id].score") */
  lhs: string;
  /** Right-hand side expression or builtin call */
  rhs: string;
}

export interface BuiltinStep {
  kind: 'builtin';
  /** Builtin name (e.g. "log", "respond", "parse-json") */
  name: string;
  /** Arguments as raw strings */
  args: string[];
}

export interface IfStep {
  kind: 'if';
  /** Condition expression */
  condition: string;
  body: RunStep[];
}

export interface RawStep {
  kind: 'raw';
  text: string;
}
