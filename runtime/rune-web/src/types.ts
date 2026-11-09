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
  LazyRoute?: LazyRouteNode;
}

/** Lazy route node loaded on-demand via network request. */
export interface LazyRouteNode {
  route: string;
  chunk_url: string;
  fallback?: ViewNode[];
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

/** Navigator configuration for URL state synchronization. */
export interface NavigatorConfig {
  bind: string;
  mode?: 'auto' | 'query' | 'hash' | 'path';
  param?: string;
}

/** Particle emitter settings declared with `name = emitter { ... }` in state. */
export interface EmitterConfig {
  /** Ticks each particle lives (default 14). */
  life?: number;
  /** Velocity multiplier applied every step (default 0.92). */
  friction?: number;
  /** Added to vy every step (default 0). */
  gravity?: number;
  /** Particle size in px: a number or [min, max] (default [3, 5]). */
  size?: number | [number, number];
  /** Default burst speed (default 7). */
  speed?: number;
  /** Default particles per burst (default 8). */
  count?: number;
  /** Default particle color (default "#ffffff"). */
  color?: string;
}

/** SEO configuration for a specific route. */
export interface SeoRouteConfig {
  title?: string;
  description?: string;
  image?: string;
}

/** Global SEO configuration from `@SEO`. */
export interface SeoConfig {
  title?: string;
  description?: string;
  image?: string;
  routes?: Record<string, SeoRouteConfig>;
}

/** Optimizer configuration from `@Optimizer`. */
export interface OptimizerConfig {
  dynamic_xhr?: 'on' | 'auto' | 'lazy' | 'off' | string;
  pre_load?: boolean;
  chunk_path?: string;
}

/** Filter definition for sound effects. */
export interface SoundFilterConfig {
  filter_type: 'lowpass' | 'highpass' | 'bandpass' | string;
  start_freq: number;
  end_freq: number;
}

/** Programmable sound definition from `@Sound`. */
export interface SoundDefinition {
  wave?: 'sawtooth' | 'square' | 'triangle' | 'sine' | 'noise' | string;
  freq_start?: number | null;
  freq_end?: number | null;
  duration?: number;
  volume?: number;
  curve?: 'exponential' | 'linear' | string;
  filter?: SoundFilterConfig | null;
  notes?: number[];
  sequence?: [number, number][];
}

/** Background music definition from `@Music`. */
export interface MusicDefinition {
  music_type?: '8bit' | 'chiptune' | 'synth' | string;
  tempo?: number;
  time_signature?: string | null;
  bars?: number | null;
  loop_track?: boolean;
  volume?: number;
  lead?: string | null;
  bass?: string | null;
  drums?: string | null;
  tracks?: Record<string, string | { instrument?: string; notes?: string; volume?: number; pan?: number; muted?: boolean }> | null;
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
  timer?: string | null;
  keys?: Record<string, string>;
  navigator?: NavigatorConfig | null;
  emitters?: Record<string, EmitterConfig>;
  seo?: SeoConfig | null;
  optimizer?: OptimizerConfig | null;
  sounds?: Record<string, SoundDefinition>;
  music?: Record<string, MusicDefinition>;
}

/** The application object exposed as window.runeWebApp. */
export interface RuneApp {
  state: Record<string, unknown>;
  derived: Record<string, unknown>;
  loadedChunks?: Record<string, ViewNode[] | ViewNode>;
  loadChunk?: (route: string, chunkUrl: string) => Promise<unknown>;
  preloadChunks?: () => void;
  computeDerived: () => void;
  render: () => void;
  invokeAction: (name: string, args: unknown[], locals?: Record<string, unknown>) => void;
  startTimer?: (action: string, ms: number) => void;
  stopTimer?: () => void;
  playSound?: (type: string, arg?: unknown) => void;
  playMusic?: (track: string) => void;
  stopMusic?: () => void;
  pauseMusic?: () => void;
  resumeMusic?: () => void;
}

/** A scope is just a flat object of key→value bindings. */
export type Scope = Record<string, unknown>;
