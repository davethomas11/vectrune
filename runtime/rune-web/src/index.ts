// ============================================================================
// Rune-Web Runtime — entry point
//
// This module is the single export of the bundled runtime library.
// It exposes boot(config) which initializes the entire application.
// ============================================================================

import { initContext, ctx } from './context';
import { evaluateExpression, resolveValue } from './expression';
import { getWindowProp, setWindowProp } from './globals';
import { buildScope, makeReactive } from './scope';
import { normalizeLiteral, valueToString } from './utils';
import { renderNode } from './rendering';
import { executeSteps } from './statement';
import { bindEvent, setupMemoryUpdateListener } from './events';
import type { RuneWebConfig, RuneApp } from './types';

/**
 * Boot the Rune-Web application.
 *
 * Called by the generated HTML with page-specific configuration
 * (page tree, state, actions, derived definitions, etc).
 */
export function boot(config: RuneWebConfig): RuneApp {
  // Build the app object first (render will be set after context init)
  const app: RuneApp = {
    state: {} as Record<string, unknown>,
    derived: {},
    computeDerived() {
      const context = ctx();
      const baseScope = buildScope({});
      for (const [name, def] of Object.entries(
        context.derivedDefinitions,
      )) {
        const sourceValue = resolveValue(def.source, baseScope);
        const sourceKey = valueToString(sourceValue);
        let resolved: unknown = undefined;

        for (const currentCase of def.cases || []) {
          const matcher = normalizeLiteral(currentCase.matcher);
          if (matcher === '_' || matcher === sourceKey) {
            resolved = evaluateExpression(
              currentCase.value,
              buildScope({}),
            );
            break;
          }
        }

        this.derived[name] = resolved;
      }
    },
    render() {
      const context = ctx();
      if (context.isRendering) return;
      context.isRendering = true;
      try {
        this.computeDerived();
        const root = document.getElementById('app');
        if (!root) return;
        root.innerHTML = renderNode(context.pageTree, {});
      } finally {
        context.isRendering = false;
      }
    },
    invokeAction(
      name: string,
      args: unknown[],
      locals?: Record<string, unknown>,
    ) {
      const context = ctx();
      const def = context.actionDefinitions[name];
      if (!def) {
        if (typeof window !== 'undefined' && typeof (window as any)[name] === 'function') {
          (window as any)[name](...args);
        }
        return;
      }
      const scopedLocals: Record<string, unknown> = Object.assign(
        {},
        locals || {},
      );
      (def.params || []).forEach((param, index) => {
        scopedLocals[param] = args[index];
      });
      executeSteps(def.steps || [], scopedLocals);
    },
  };

  // Initialize the context singleton
  initContext({
    pageTree: config.pageTree,
    derivedDefinitions: config.derivedDefinitions,
    helperDefinitions: config.helperDefinitions,
    actionDefinitions: config.actionDefinitions,
    i18nData: config.i18nData,
    app,
    isRendering: false,
    memorySubscriptions: {},
  });

  // Create reactive state (must happen after context init since makeReactive uses ctx())
  app.state = makeReactive(
    Object.assign({}, config.stateJson, { i18n: config.i18nData }),
  );

  // Wrap render to track rendering component
  const originalRender = app.render;
  app.render = function () {
    setWindowProp('__renderingComponent', 'app');
    originalRender.call(this);
    setWindowProp('__renderingComponent', null);
  };

  // Wire up events
  setupMemoryUpdateListener();
  bindEvent('click');
  bindEvent('change');

  // Set up WebSocket if endpoint provided
  if (config.wsEndpoint) {
    setupWebSocket(config.wsEndpoint, app);
  }

  // Expose globally and do initial render
  setWindowProp('runeWebApp', app);
  app.render();

  return app;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function setupWebSocket(endpoint: string, app: RuneApp): void {
  setWindowProp('__runeWebEmit', function (
    eventName: string,
    payload?: unknown,
  ) {
    const ws = getWindowProp('__runeWebSocket') as WebSocket;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected');
      return;
    }
    ws.send(JSON.stringify({ type: eventName, payload: payload || {} }));
  });

  const ws = new WebSocket(endpoint);
  setWindowProp('__runeWebSocket', ws);
  ws.onmessage = function (event: MessageEvent) {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'memory_update') {
        app.state[message.key] = message.value;
        app.render();
      }
    } catch (_err) {
      // Ignore malformed messages
    }
  };
  ws.onerror = function (error: Event) {
    console.error('WebSocket error:', error);
  };
}
