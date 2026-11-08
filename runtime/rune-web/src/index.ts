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
import { setupNavigator, updateSeoMetadata } from './navigator';
import { playSound } from './audio';
import type { RuneWebConfig, RuneApp } from './types';

export { playSound };

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
  const loadedChunks: Record<string, import('./types').ViewNode[] | import('./types').ViewNode> = {};
  const loadingChunks: Record<string, Promise<unknown>> = {};

  app.loadedChunks = loadedChunks;

  app.loadChunk = function (route: string, chunkUrl: string): Promise<unknown> {
    const cleanRoute = route.toLowerCase();
    if (loadedChunks[cleanRoute]) {
      return Promise.resolve(loadedChunks[cleanRoute]);
    }
    if (loadingChunks[cleanRoute]) {
      return loadingChunks[cleanRoute];
    }
    if (typeof fetch === 'undefined') {
      return Promise.resolve(null);
    }

    const promise = fetch(chunkUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching route chunk ${chunkUrl}`);
        return res.json();
      })
      .then((data: import('./types').ViewNode[] | import('./types').ViewNode) => {
        loadedChunks[cleanRoute] = data;
        delete loadingChunks[cleanRoute];
        app.render();
        return data;
      })
      .catch((err) => {
        delete loadingChunks[cleanRoute];
        console.warn(`[RuneWeb] Failed to load route chunk '${route}':`, err);
        return null;
      });

    loadingChunks[cleanRoute] = promise;
    return promise;
  };

  app.preloadChunks = function (): void {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
    const context = ctx();
    const opt = context.optimizer;
    if (!opt || !opt.pre_load) return;

    const chunksToPreload: Array<{ route: string; chunk_url: string }> = [];
    function collectLazy(n: import('./types').ViewNode) {
      if (!n) return;
      if (n.LazyRoute) {
        chunksToPreload.push({ route: n.LazyRoute.route, chunk_url: n.LazyRoute.chunk_url });
      }
      if (n.Element?.children) n.Element.children.forEach(collectLazy);
      if (n.Loop?.body) n.Loop.body.forEach(collectLazy);
      if (n.Conditional?.body) n.Conditional.body.forEach(collectLazy);
      if (n.Match?.cases) n.Match.cases.forEach((c) => (c.body || []).forEach(collectLazy));
      if (n.ComponentScope?.body) collectLazy(n.ComponentScope.body);
      if (n.MemoryBinding?.body) n.MemoryBinding.body.forEach(collectLazy);
    }
    collectLazy(context.pageTree);

    const runPreload = () => {
      chunksToPreload.forEach(({ route, chunk_url }) => {
        const cleanRoute = route.toLowerCase();
        if (!loadedChunks[cleanRoute] && !loadingChunks[cleanRoute]) {
          fetch(chunk_url)
            .then((r) => r.json())
            .then((data) => {
              loadedChunks[cleanRoute] = data;
            })
            .catch(() => {});
        }
      });
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(runPreload, { timeout: 2000 });
    } else {
      setTimeout(runPreload, 300);
    }
  };

  initContext({
    pageTree: config.pageTree,
    derivedDefinitions: config.derivedDefinitions,
    helperDefinitions: config.helperDefinitions,
    actionDefinitions: config.actionDefinitions,
    i18nData: config.i18nData,
    app,
    isRendering: false,
    memorySubscriptions: {},
    navigator: config.navigator || null,
    initialState: JSON.parse(JSON.stringify(config.stateJson || {})),
    emitters: config.emitters || {},
    seo: config.seo || null,
    optimizer: config.optimizer || null,
    loadedChunks,
    loadingChunks,
  });

  // Create reactive state (must happen after context init since makeReactive uses ctx())
  app.state = makeReactive(
    Object.assign({}, config.stateJson, { i18n: config.i18nData }),
  );

  // Set up URL navigation state synchronization if configured (@Navigator)
  if (config.navigator) {
    setupNavigator(config.navigator, app);
  } else if (config.seo) {
    updateSeoMetadata('home');
  }

  // Background preload route chunks if pre_load is enabled (@Optimizer)
  if (config.optimizer?.pre_load && app.preloadChunks) {
    app.preloadChunks();
  }

  // Wrap render to track rendering component
  const originalRender = app.render;
  app.render = function () {
    setWindowProp('__renderingComponent', 'app');
    originalRender.call(this);
    setWindowProp('__renderingComponent', null);
  };

  // Timer management
  let activeTimerId: ReturnType<typeof setInterval> | null = null;
  app.startTimer = function (action: string, ms: number) {
    if (activeTimerId !== null) clearInterval(activeTimerId);
    activeTimerId = setInterval(() => {
      app.invokeAction(action, []);
    }, ms);
  };
  app.stopTimer = function () {
    if (activeTimerId !== null) {
      clearInterval(activeTimerId);
      activeTimerId = null;
    }
  };

  // Wire up events
  setupMemoryUpdateListener();
  bindEvent('click');
  bindEvent('change');
  bindEvent('input');
  bindEvent('pointerdown');
  bindEvent('pointerup');
  bindEvent('pointerleave');
  bindEvent('pointercancel');
  bindEvent('touchstart');
  bindEvent('touchend');

  // Keybindings for games and interactive apps
  if (config.keys && typeof window !== 'undefined') {
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      const keyMap = config.keys!;
      const action = keyMap[event.code] || keyMap[event.key] || keyMap[event.key.toLowerCase()] || keyMap[event.code.toLowerCase()];
      if (action) {
        event.preventDefault();
        app.invokeAction(action, []);
      }
    });
  }

  // Set up periodic timer / game loop if configured in @Logic
  if (config.timer) {
    const match = String(config.timer).trim().match(/^([A-Za-z_][\w-]*)\s*([0-9]*\.?[0-9]+)\s*(ms|s)?$/i);
    if (match) {
      const action = match[1];
      let ms = Number(match[2]);
      if (match[3]?.toLowerCase() === 's') ms *= 1000;
      app.startTimer(action, ms);
    }
  }

  // Set up WebSocket if endpoint provided
  if (config.wsEndpoint) {
    setupWebSocket(config.wsEndpoint, app);
  }

  // Expose globally and do initial render
  setWindowProp('runeWebApp', app);
  setWindowProp('playSound', playSound);
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
