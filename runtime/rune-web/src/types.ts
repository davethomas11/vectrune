// ============================================================================
// Type definitions for the Rune-Web runtime
// ============================================================================

/** A node in the view tree (page AST). */
export interface ViewNode {
  Element?: ElementNode;
  Loop?: LoopNode;
  ComponentScope?: ComponentScopeNode;
  MemoryBinding?: MemoryBindingNode;
  Conditional?: ConditionalNode;
  Match?: MatchNode;
  Text?: string;
  Comment?: string;
}

export interface ElementNode {
  tag: string;
  classes: string[];
  id: string | null;
  attrs: Record<string, string>;
  events: Record<string, string>;
  text: string | null;
  for_each: ForEachDef | null;
  children: ViewNode[];
}

export interface LoopNode {
  item_name: string;
  index_name: string | null;
  collection: string;
  body: ViewNode[];
}

export interface ComponentScopeNode {
  props: Record<string, string>;
  body: ViewNode;
}

export interface MemoryBindingNode {
  key: string;
  var: string;
  body: ViewNode[];
}

export interface ConditionalNode {
  condition: string;
  body: ViewNode[];
}

export interface MatchCase {
  matcher: string;
  body: ViewNode[];
}

export interface MatchNode {
  expression: string;
  cases: MatchCase[];
}

export interface ForEachDef {
  item_name: string;
  index_name: string | null;
  collection: string;
}

export interface DerivedCase {
  matcher: string;
  value: string;
}

export interface DerivedDefinition {
  source: string;
  cases: DerivedCase[];
}

export interface HelperDefinition {
  params: string[];
  body: string[];
}

export interface ActionStep {
  Statement?: string;
  Conditional?: {
    condition: string;
    steps: ActionStep[];
  };
  ForLoop?: {
    item_name: string;
    index_name: string | null;
    collection: string;
    steps: ActionStep[];
  };
}

export interface ActionDefinition {
  params: string[];
  steps: ActionStep[];
}

/** Configuration passed to boot(). */
export interface RuneWebConfig {
  pageTree: ViewNode;
  derivedDefinitions: Record<string, DerivedDefinition>;
  helperDefinitions: Record<string, HelperDefinition>;
  actionDefinitions: Record<string, ActionDefinition>;
  i18nData: Record<string, string>;
  stateJson: Record<string, unknown>;
  wsEndpoint?: string;
}

/** The application object exposed as window.runeWebApp. */
export interface RuneApp {
  state: Record<string, unknown>;
  derived: Record<string, unknown>;
  computeDerived: () => void;
  render: () => void;
  invokeAction: (name: string, args: unknown[], locals?: Record<string, unknown>) => void;
}

/** A scope is just a flat object of key→value bindings. */
export type Scope = Record<string, unknown>;
