// ============================================================================
// Rune-Web Runtime — entry point
//
// This module is the single export of the bundled runtime library.
// It exposes boot(config) which initializes the entire application.
// ============================================================================

import { createLogicApp } from './logic';
import { configureDataSources } from './datasource';
export { requestDataSource, setDataSourceToken } from './datasource';
import { beginGameLoading, markGameReady } from './game_ready';
import { initContext, ctx } from './context';
import { getWindowProp, setWindowProp } from './globals';
import { makeReactive } from './scope';
import { hostedUrl } from './utils';
import { renderNode } from './rendering';
import { createMapManager } from './map';
import { syncSequencerState } from './statement';
import { bindStudioNoteDrag } from './studio_drag';
import { bindStudioNoteTools } from './studio_note_tools';
import { bindStudioTransport, paintStudioPlayhead } from './studio_transport';
import { bindEvent, setupMemoryUpdateListener } from './events';
import { setupNavigator, updateSeoMetadata } from './navigator';
import {
  registerSounds,
  registerMusic,
  playSound,
  playMusic,
  stopMusic,
  pauseMusic,
  resumeMusic,
  setMusicTempo,
  setMusicVolume,
} from './audio';
import { audioSync } from './audio_sync';
import type { RuneWebConfig, RuneApp } from './types';

export {
  registerSounds,
  registerMusic,
  playSound,
  playMusic,
  stopMusic,
  pauseMusic,
  resumeMusic,
  setMusicTempo,
  setMusicVolume,
  audioSync,
};

/**
 * Boot the Rune-Web application.
 *
 * Called by the generated HTML with page-specific configuration
 * (page tree, state, actions, derived definitions, etc).
 */
export function boot(config: RuneWebConfig): RuneApp {
  const maps = createMapManager();
  configureDataSources(config.dataSources);
  beginGameLoading();
  // Register programmable audio definitions from @Sound and @Music
  registerSounds(config.sounds);
  registerMusic(config.music);

  const app = createLogicApp(function (this: RuneApp) {
    const context = ctx();
    if (context.isRendering) return;
    context.isRendering = true;
    try {
      this.computeDerived();
      const root = document.getElementById('app');
      if (!root) return;
      const studio = this.state.studio_fixed_bars === true;
      const previousTimeline = studio ? root.querySelector<HTMLElement>('[data-studio-scroll]') : null;
      const left = previousTimeline?.scrollLeft ?? 0;
      const top = previousTimeline?.scrollTop ?? 0;
      const title = studio ? root.querySelector<HTMLInputElement>('[data-studio-song-title]:focus') : null;
      const start = title?.selectionStart ?? 0;
      const end = title?.selectionEnd ?? start;
      const focusedInput = root.querySelector<HTMLInputElement>('input[id]:focus:not([value])');
      const inputValue = focusedInput?.value;
      const inputStart = focusedInput?.selectionStart;
      const inputEnd = focusedInput?.selectionEnd;
      const savedMaps = maps.detach(root);
      root.innerHTML = renderNode(context.pageTree, {});
      maps.restore(root, savedMaps, this);
      if (focusedInput && inputValue !== undefined) {
        const nextInput = document.getElementById(focusedInput.id);
        if (nextInput instanceof HTMLInputElement && root.contains(nextInput) && !nextInput.hasAttribute('value')) {
          nextInput.value = inputValue;
          nextInput.focus({ preventScroll: true });
          if (inputStart !== null && inputStart !== undefined && inputEnd !== null && inputEnd !== undefined) {
            nextInput.setSelectionRange(inputStart, inputEnd);
          }
        }
      }
      if (studio) {
        paintStudioPlayhead(root, this.state);
        const timeline = root.querySelector<HTMLElement>('[data-studio-scroll]');
        if (previousTimeline && timeline) {
          if (timeline.dataset.studioScroll === previousTimeline.dataset.studioScroll) timeline.scrollLeft = left;
        }
        if (timeline?.dataset.studioVoice) {
          if (previousTimeline?.dataset.studioViewportReady && timeline.dataset.studioVoice === previousTimeline.dataset.studioVoice) {
            timeline.scrollTop = top;
          } else {
            const firstNote = timeline.querySelector<HTMLElement>('.matrix-note-block');
            timeline.scrollTop = (firstNote?.offsetTop ?? 8 * 28) - timeline.clientHeight * 0.19;
          }
          timeline.dataset.studioViewportReady = 'true';
        }
        const nextTitle = root.querySelector<HTMLInputElement>('[data-studio-song-title]');
        if (nextTitle) {
          nextTitle.value = String(this.state.song_title ?? '');
          if (title && nextTitle.dataset.studioSongTitle === title.dataset.studioSongTitle) {
            nextTitle.focus({ preventScroll: true });
            nextTitle.setSelectionRange(start, end);
          }
        }
      }
    } finally {
      context.isRendering = false;
    }
  });

  // Initialize the context singleton
  const loadedChunks: Record<string, import('./types').ViewNode[] | import('./types').ViewNode> = {};
  const loadingChunks: Record<string, Promise<unknown>> = {};

  app.loadedChunks = loadedChunks;

  app.loadChunk = function (route: string, chunkUrl: string): Promise<unknown> {
    const cleanRoute = route.toLowerCase();
    if (loadedChunks[cleanRoute]) {
      return Promise.resolve(loadedChunks[cleanRoute]);
    }
    if (cleanRoute in loadingChunks) {
      return loadingChunks[cleanRoute];
    }
    if (typeof fetch === 'undefined') {
      return Promise.resolve(null);
    }

    const promise = fetch(hostedUrl(chunkUrl))
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
          fetch(hostedUrl(chunk_url))
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
  bindEvent('contextmenu');
  if (app.state.studio_fixed_bars === true) {
    bindStudioNoteDrag(app.state);
    bindStudioNoteTools(app.state);
    bindStudioTransport(app);
  }
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
  setWindowProp('audioSync', audioSync);
  setWindowProp('playSound', playSound);
  setWindowProp('playMusic', playMusic);
  setWindowProp('stopMusic', stopMusic);
  setWindowProp('pauseMusic', pauseMusic);
  setWindowProp('resumeMusic', resumeMusic);
  setWindowProp('registerSounds', registerSounds);
  setWindowProp('registerMusic', registerMusic);

  if (typeof window !== 'undefined') {
    (window as any).__RuneWeb = {
      ctx,
      app,
      audioSync,
    };
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', () => {
      const isFs = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (isFs) {
        document.body.setAttribute('data-fullscreen', 'true');
        document.body.classList.add('fullscreen');
      } else {
        document.body.removeAttribute('data-fullscreen');
        document.body.classList.remove('fullscreen');
      }
      if (typeof app.state?.is_fullscreen !== 'undefined') {
        app.state.is_fullscreen = isFs;
        app.render();
      }
    });
  }

  if (app.state?.active_voice && !app.state.active_steps) syncSequencerState(app.state);
  if (app.state.studio_fixed_bars === true && config.actionDefinitions.loadSongLibrary) {
    app.invokeAction('loadSongLibrary', []);
  }

  app.render();
  if (config.onMount) app.invokeAction(config.onMount, []);

  // DOM games are usable after render; pixel shells signal after drawing their canvas.
  if (typeof document !== 'undefined' &&
      !document.querySelector('canvas[data-rune-pixel], canvas[data-rune-pixel-3d]')) markGameReady();

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
        if (app.state?.active_voice && !app.state.active_steps) syncSequencerState(app.state);
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
