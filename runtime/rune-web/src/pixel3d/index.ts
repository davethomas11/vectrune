import { isPausableStatus } from '../input/game';
import { beginGameLoading, markGameReady } from '../game_ready';
import { mountControls } from '../input/browser';
import { Pixel3DEngine, type Pixel3DConfig, type Input3D } from './engine';
import { unlockAudio } from '../audio';
import { mountTouch, STYLE } from './touch';
import { createFullscreen, isStandaloneApp } from './fullscreen';
import { createWebGlRenderer } from './webgl';
import { createGpuLighting } from './gpu_lighting';
import { collectHudHitRegions, hudButtonAt, type GameHud } from './hud';
import type { RuneWebConfig } from '../types';
import { getStorageItem, setStorageItem } from '../storage';
export { createTvNavigation } from './tv';

let settings: Pixel3DConfig;
export function configure(config: Pixel3DConfig): void {
  settings = config;
}

export function boot(options: RuneWebConfig): Pixel3DEngine {
  const host = globalThis as typeof globalThis & { __runeTvMusic?: (music: RuneWebConfig['music']) => void };
  host.__runeTvMusic?.(options.music);
  beginGameLoading();
  const game = new Pixel3DEngine(settings, options);
  Object.assign(globalThis, { __RunePixel3D: game, __RunePixel: game });

  if (typeof document !== 'undefined') {
    let active: HTMLCanvasElement | null = null;
    let dispose: (() => void) | undefined;
    const attach = () => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        'canvas[data-rune-pixel-3d], canvas[data-rune-pixel]'
      );
      if (canvas === active) return;
      dispose?.();
      active = canvas;
      dispose = canvas ? mount(game, canvas) : undefined;
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    window.addEventListener(
      'pagehide',
      () => {
        observer.disconnect();
        dispose?.();
      },
      { once: true }
    );
  }
  return game;
}

export function mount(
  game: Pixel3DEngine,
  canvas: HTMLCanvasElement
): () => void {
  const { width, height, tickRate } = game.config;
  const keys = game.config.keys || {
    KeyW: 'forward',
    KeyS: 'back',
    KeyA: 'strafe_left',
    KeyD: 'strafe_right',
    ArrowLeft: 'turn_left',
    ArrowRight: 'turn_right',
    Space: 'fire',
    KeyE: 'use',
  };

  game.resizeViewport(width, height);
  canvas.width = width;
  canvas.height = height;
  const gpuToggle = document.querySelector<HTMLInputElement>('input[data-pixel-gpu]');
  const fps = document.querySelector<HTMLElement>('[data-pixel-fps]');
  const frameRate = document.querySelector<HTMLSelectElement>('select[data-pixel-frame-rate]');
  const context = canvas.getContext('2d', { alpha: gpuToggle !== null });
  if (!context) throw new Error('This game needs Canvas 2D support');
  context.imageSmoothingEnabled = false;

  let image = new ImageData(
    new Uint8ClampedArray(game.raycaster.buffer.buffer as ArrayBuffer),
    width,
    height
  );

  let input: Input3D = {};
  let mouseFire = false;
  let pendingFire = false;
  let pendingUse = false;
  let touchFire = false, touchUse = false, moveX = 0, moveY = 0;
  let lastTouchAt = 0;
  let touch: ReturnType<typeof mountTouch> | undefined;
  let mapped: ReturnType<typeof mountControls> | undefined;
  let lookAccumX = 0;
  let lookAccumY = 0;
  let previous = 0;
  let accumulator = 0;
  let stopped = false;
  let frameId = 0;
  let ready = false;
  let menuOpen = false;
  let fpsStart = 0, drawnFrames = 0;
  let gpu: ReturnType<typeof createWebGlRenderer>;
  let gpuLighting: ReturnType<typeof createGpuLighting>;
  let modelOnlyFrame = false;
  let gpuCanvas: HTMLCanvasElement | undefined;
  let paletteColors: number[] | undefined;
  const tickMs = 1000 / tickRate;
  let nextRenderAt: number | undefined;
  let overlayKey: string | undefined;

  const abort = new AbortController();
  const listen = (
    element: EventTarget,
    name: string,
    callback: EventListener
  ) => element.addEventListener(name, callback, { signal: abort.signal });

  const clear = (keepCommands = false) => {
    input = {};
    mouseFire = false;
    pendingFire = false;
    pendingUse = false;
    lookAccumX = 0;
    lookAccumY = 0;
    touch?.reset();
    mapped?.clear(keepCommands);
  };

  const start = () => {
    unlockAudio();
    clear();
    game.activate('start');
    previous = 0;
    accumulator = 0;
    canvas.focus();
  };

  // Toolbar button listeners
  for (const button of Array.from(document.querySelectorAll<HTMLElement>('[data-pixel-start]'))) {
    listen(button, 'click', () => {
      if (game.app.state.status === 'playing' && button.dataset.pixelConfirm && !window.confirm(button.dataset.pixelConfirm)) return;
      start();
    });
  }
  for (const form of Array.from(document.querySelectorAll<HTMLFormElement>('form[data-pixel-action]'))) {
    listen(form, 'submit', event => {
      event.preventDefault();
      unlockAudio();
      clear();
      const action = form.dataset.pixelAction;
      const previous = game.app.state.status;
      const fields: Record<string, string> = Object.create(null);
      new FormData(form).forEach((value, name) => {
        if (typeof value === 'string') fields[name] = value;
      });
      if (action) game.activate(action, [fields]);
      if (game.app.state.status !== previous) canvas.focus({ preventScroll: true });
    });
  }
  for (const button of Array.from(document.querySelectorAll<HTMLElement>('[data-pixel-action]:not(form)'))) {
    const args: unknown = JSON.parse(button.dataset.pixelArgs || '[]');
    if (!Array.isArray(args)) throw new Error('data-pixel-args must be a JSON array');
    listen(button, 'click', () => {
      unlockAudio();
      const action = button.dataset.pixelAction;
      clear();
      if (action) game.activate(action, args);
      canvas.focus({ preventScroll: true });
    });
  }
  for (const button of Array.from(document.querySelectorAll('[data-pixel-pause]'))) {
    listen(button, 'click', () => {
      canvas.focus();
      clear(true);
      game.paused = !game.paused;
    });
  }
  for (const button of Array.from(document.querySelectorAll('[data-pixel-restart]'))) {
    const action = game.config.restartAction;
    if (!action) throw new Error('data-pixel-restart needs Scene restart_action');
    listen(button, 'click', () => {
      unlockAudio();
      clear();
      game.invoke(action);
      canvas.focus({ preventScroll: true });
    });
  }
  for (const button of Array.from(document.querySelectorAll('[data-pixel-mute]'))) {
    listen(button, 'click', () => {
      unlockAudio();
      clear(true);
      game.muted = !game.muted;
      canvas.focus({ preventScroll: true });
    });
  }
  const surface = canvas.parentElement || canvas;
  const resolution = document.querySelector<HTMLSelectElement>('select[data-pixel-resolution]');
  const palette = document.querySelector<HTMLSelectElement>('select[data-pixel-palette]');
  const lighting = document.querySelector<HTMLSelectElement>('select[data-pixel-lighting]');
  const fullscreen = createFullscreen(surface, () => { fitViewport(); clear(true); touch?.update(); mapped?.update(); });
  function fitViewport() {
    let renderWidth = width, renderHeight = height;
    if (resolution) {
      const size = /^(\d+)x(\d+)$/.exec(resolution.value);
      if (!size) throw new Error('Pixel-3d resolution options must use WIDTHxHEIGHT');
      renderWidth = Number(size[1]);
      renderHeight = Number(size[2]);
      if (renderWidth * height !== renderHeight * width) {
        throw new Error('Pixel-3d resolution options must match the app aspect ratio');
      }
    }
    const hudScale = renderWidth / width;
    if (canvas.dataset.pixelFit === 'viewport' && fullscreen.expanded()) {
      const rect = surface.getBoundingClientRect();
      const aspect = Math.max(.25, Math.min(4, rect.width / Math.max(1, rect.height)));
      // Keep the selected pixel budget as the field of view grows to fit a phone.
      renderWidth = Math.round(Math.sqrt(renderWidth * renderHeight * aspect) / 2) * 2;
      renderHeight = Math.round(renderWidth / aspect);
    }
    game.resizeViewport(renderWidth, renderHeight, hudScale);
    if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
      canvas.width = renderWidth;
      canvas.height = renderHeight;
      context!.imageSmoothingEnabled = false;
      image = new ImageData(new Uint8ClampedArray(game.raycaster.buffer.buffer as ArrayBuffer), renderWidth, renderHeight);
      overlayKey = undefined;
    }
    if (gpuCanvas) {
      if (gpuCanvas.width !== renderWidth) gpuCanvas.width = renderWidth;
      if (gpuCanvas.height !== renderHeight) gpuCanvas.height = renderHeight;
      gpuCanvas.style.left = `${canvas.offsetLeft}px`;
      gpuCanvas.style.top = `${canvas.offsetTop}px`;
    }
  }
  function applyPalette() {
    const value = palette?.value;
    paletteColors = value && value !== 'original' ? value.split(',').map(hex => {
      if (!/^[\da-f]{6}$/i.test(hex)) throw new Error('Pixel-3d palette options need six-digit hex colors');
      return Number.parseInt(hex, 16);
    }) : undefined;
    const paletteOutline = palette?.selectedOptions[0]?.dataset.pixelOutline === 'true';
    game.raycaster.setPalette(paletteColors, paletteOutline);
    gpu?.setPalette(paletteColors);
    overlayKey = undefined;
    game.invalidateFrame();
  }
  if (resolution) {
    listen(resolution, 'change', fitViewport);
    fitViewport();
  }
  if (palette) {
    listen(palette, 'change', applyPalette);
    applyPalette();
  }
  function applyLighting() {
    game.raycaster.setEnhancedLighting(lighting?.value === 'enhanced');
    gpu?.resetInterpolation();
    overlayKey = undefined;
    resetFps();
    game.invalidateFrame();
  }
  if (lighting) {
    const key = 'rune-pixel-lighting-' + (game.config.persistence?.key ?? window.location.pathname);
    const saved = getStorageItem(key);
    if (saved === 'standard' || saved === 'enhanced') lighting.value = saved;
    listen(lighting, 'change', () => {
      applyLighting();
      setStorageItem(key, lighting.value);
    });
    applyLighting();
  }
  function resetFps() {
    drawnFrames = 0;
    fpsStart = 0;
    nextRenderAt = undefined;
    if (fps) fps.textContent = `${gpuToggle?.checked ? 'GPU' : 'CPU'} · — FPS`;
  }
  if (frameRate) {
    listen(frameRate, 'change', () => {
      resetFps();
      game.invalidateFrame();
    });
  }
  function cpuFallback(reason: string) {
    if (gpuToggle) {
      gpuToggle.checked = false;
      gpuToggle.disabled = true;
      gpuToggle.title = reason;
    }
    gpu?.dispose();
    gpuLighting?.dispose();
    gpuLighting = undefined;
    gpu = undefined;
    gpuCanvas?.remove();
    gpuCanvas = undefined;
    resetFps();
    game.invalidateFrame();
  }
  function toggleGpu() {
    if (gpuToggle?.checked && !gpu) {
      const layer = document.createElement('canvas');
      layer.dataset.pixelGpuSurface = 'true';
      layer.setAttribute('aria-hidden', 'true');
      layer.style.cssText = 'position:absolute;pointer-events:none';
      layer.hidden = true;
      try {
        gpu = createWebGlRenderer(layer, game.config.models);
        if (gpu) gpuLighting = createGpuLighting(layer);
      } catch (error) {
        console.warn('Pixel 3D WebGL setup failed', error);
      }
      if (!gpu || !gpuLighting) {
        cpuFallback('Accelerated WebGL 2 is unavailable. Using the CPU renderer.');
        return;
      }
      gpuCanvas = layer;
      gpu.setPalette(paletteColors);
      surface.prepend(layer);
      fitViewport();
      listen(layer, 'webglcontextlost', () => cpuFallback('WebGL context lost. Using the CPU renderer.'));
    }
    if (gpuCanvas && !gpuToggle?.checked) gpuCanvas.hidden = true;
    overlayKey = undefined;
    gpu?.resetInterpolation();
    resetFps();
    game.invalidateFrame();
  }
  if (gpuToggle) {
    listen(gpuToggle, 'change', toggleGpu);
    toggleGpu();
  }

  function drawFrame(extraFrames: boolean): boolean {
    if (gpu && gpuLighting && gpuCanvas && gpuToggle?.checked) {
      try {
        const changed = game.presentIfChanged(() => {
          const stats = game.renderState();
          const { map, world } = game.raycaster.config;
          modelOnlyFrame = !game.raycaster.enhancedLighting && !!map.sky && map.sky.below !== undefined &&
            !world && !stats.lights.length && !map.grid.some(Boolean) && !stats.weapon &&
            !stats.things.some(thing => thing.sprite || thing.title);
          if (!modelOnlyFrame) {
            game.frame(frame => gpuLighting!.draw(frame));
            context!.clearRect(0, 0, canvas.width, canvas.height);
            overlayKey = undefined;
            return;
          }
          if (!map.sky) throw new Error('Model rendering needs a sky');
          gpu!.capture(stats, map.sky, game.raycaster.fov, extraFrames);
          const hud = game.frameHud(stats);
          const key = JSON.stringify([hud, Array.from(game.keyboard.pressed)]);
          if (overlayKey !== key) {
            game.raycaster.renderOverlay(hud);
            context!.putImageData(image, 0, 0);
            overlayKey = key;
          }
        });
        if (!changed && (!extraFrames || !modelOnlyFrame)) return false;
        if (modelOnlyFrame) gpu.draw(extraFrames ? accumulator / tickMs : 1, game.raycaster.outlineRadius);
        gpuCanvas.hidden = false;
        return true;
      } catch (error) {
        console.warn('Pixel 3D WebGL frame failed', error);
        cpuFallback('This scene could not use WebGL. Using the CPU renderer.');
      }
    }
    if (gpuCanvas) gpuCanvas.hidden = true;
    if (!game.frameIfChanged()) {
      if (!extraFrames) return false;
      game.frame();
    }
    context!.putImageData(image, 0, 0);
    return true;
  }
  const viewportResize = new ResizeObserver(fitViewport);
  viewportResize.observe(surface);
  for (const button of Array.from(document.querySelectorAll('[data-pixel-fullscreen]'))) {
    listen(button, 'click', () => { void fullscreen.toggle().catch(() => {}); });
  }
  let pointerLockUnavailable = false;
  const activeHud = (): GameHud | undefined => game.paused && game.config.pauseUi && game.app.state.status === 'playing'
    ? (game.app.state as any)[game.config.pauseUi]
    : game.config.ui ? (game.app.state as any)[game.config.ui] : undefined;
  const activateHudAction = (action: string, args: unknown[] = []) => {
    unlockAudio();
    clear(true);
    if (action === 'host.keyboard') {
      game.keyboard.sync(activeHud()?.keyboard);
      game.keyboard.activate(String(args[0]), (a, values) => game.activate(a, values));
      game.invalidateFrame();
      canvas.focus({ preventScroll: true });
      return;
    }
    const grid = activeHud()?.grid;
    if (grid?.closeOnActivate && grid.dismissAction && action !== grid.moveAction && action !== grid.dismissAction) {
      game.activate(grid.dismissAction);
    }
    if (action === 'host.mute') {
      game.muted = !game.muted;
    } else if (action === 'host.fullscreen') {
      void fullscreen.toggle().catch(error => console.error('Pixel 3D fullscreen failed', error));
    } else {
      game.activate(action, args);
    }
    canvas.focus({ preventScroll: true });
  };
  canvas.addEventListener('keydown', event => {
    if (activeHud()?.keyboard) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      game.keyboardKey(event.key, true, event.repeat);
      unlockAudio(); clear(true);
      event.preventDefault(); event.stopImmediatePropagation();
      return;
    }
    if (game.hudKey(event.code, true, event.repeat)) {
      unlockAudio(); clear(true);
      if (game.consumeUiFullscreen()) void fullscreen.toggle().catch(error => console.error('Pixel 3D fullscreen failed', error));
      event.preventDefault(); event.stopImmediatePropagation();
      return;
    }
    const grid = activeHud()?.grid;
    if (grid?.layout !== 'sidebar') return;
    let action: string | undefined, args: unknown[] = [];
    if (grid.moveAction && ['ArrowUp', 'ArrowDown'].includes(event.code)) {
      action = grid.moveAction;
      args = [event.code === 'ArrowUp' ? -1 : 1];
    } else if (grid.moveAction && ['Enter', 'Space'].includes(event.code)) {
      const item = grid.items.find(item => item.selected);
      if (item && !item.disabled) { action = item.action; args = item.args ?? []; }
    } else if (grid.dismissAction && ['Escape', 'Backspace'].includes(event.code)) {
      action = grid.dismissAction;
    } else return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (action && (!event.repeat || ['ArrowUp', 'ArrowDown'].includes(event.code))) activateHudAction(action, args);
  }, { capture: true, signal: abort.signal });
  document.addEventListener('keyup', event => {
    if (activeHud()?.keyboard) {
      game.keyboardKey(event.key, false);
      event.stopImmediatePropagation();
    }
  }, { capture: true, signal: abort.signal });
  const handleMenuKey = (code: string): boolean => {
    const p = activeHud()?.panel;
    if (!p?.choiceActions?.length) return false;
    if ((code === 'ArrowUp' || code === 'KeyW') && game.hasAction('menu_move')) {
      game.invoke('menu_move', [-1]);
      return true;
    }
    if ((code === 'ArrowDown' || code === 'KeyS') && game.hasAction('menu_move')) {
      game.invoke('menu_move', [1]);
      return true;
    }
    if (game.paused && (code === 'Enter' || code === 'Space')) {
      const ca = p.choiceActions[p.selected ?? 0];
      if (ca) {
        clear(true);
        game.activate(ca.action, ca.args ?? []);
        return true;
      }
    }
    return false;
  };
  mapped = game.controls ? mountControls(canvas, game.controls, {
    state: () => game.app.state,
    playing: () => game.app.state.status === 'playing', paused: () => game.paused,
    resume: () => { clear(true); game.paused = false; },
    advance: () => { clear(); if (['title', 'story', 'escape_retry', 'gameover', 'won'].includes(String(game.app.state.status))) game.invoke('advance'); else start(); },
    fullscreen: () => { void fullscreen.toggle().catch(() => {}); },
    interact: unlockAudio, lockedMouse: true, unlockedCanvasLook: () => pointerLockUnavailable,
    advanceInputs: ['fire', 'use'], expanded: fullscreen.expanded,
    menuKey: handleMenuKey,
    tapToAdvance: game.config.clickToStart,
  }) : undefined;
  const mappedStyle = mapped ? document.createElement('style') : undefined;
  if (mappedStyle) { mappedStyle.textContent = STYLE; document.head.append(mappedStyle); surface.classList.add('rune-pixel3d-surface'); }
  touch = mapped ? undefined : mountTouch(canvas, surface, {
    playing: () => game.app.state.status === 'playing',
    paused: () => game.paused,
    interact: () => { lastTouchAt = Date.now(); unlockAudio(); },
    advance: () => {
      if (game.config.clickToStart === false && game.app.state.status !== 'playing') return;
      clear();
      if (['title', 'story', 'escape_retry', 'gameover', 'won'].includes(String(game.app.state.status))) game.invoke('advance');
      else start();
    },
    resume: () => { clear(true); game.paused = false; },
    move: (x, y) => { moveX = x; moveY = y; },
    look: delta => { lookAccumX += delta; },
    fire: (held, pulse, cancel) => { touchFire = held; if (pulse) pendingFire = true; if (cancel) pendingFire = false; },
    use: (held, pulse, cancel) => { touchUse = held; if (pulse) pendingUse = true; if (cancel) pendingUse = false; },
    fullscreen: () => { void fullscreen.toggle().catch(() => {}); },
    expanded: fullscreen.expanded,
    pause: () => { clear(true); game.paused = !game.paused; },
  });

  // Queue short clicks until a simulation tick; keep mouse and keyboard holds separate.
  listen(canvas, 'mousedown', ((event: MouseEvent) => {
    if (mapped) return;
    if (Date.now() - lastTouchAt < 700 || event.button !== 0 || game.app.state.status !== 'playing') return;
    unlockAudio();
    canvas.focus();
    mouseFire = true;
    pendingFire = true;
  }) as EventListener);
  listen(document, 'mouseup', ((event: MouseEvent) => {
    if (event.button === 0) mouseFire = false;
  }) as EventListener);
  listen(document, 'pointerlockerror', () => {
    if (document.activeElement === canvas && game.config.mouseLook !== false) pointerLockUnavailable = true;
  });
  listen(document, 'pointerlockchange', () => {
    if (document.pointerLockElement === canvas) pointerLockUnavailable = false;
    if (!game.paused && document.pointerLockElement !== canvas) {
      // The browser queues this event: keep keys pressed after Escape intact.
      mouseFire = false;
      pendingFire = false;
      lookAccumX = 0;
      lookAccumY = 0;
    }
  });

  const activateHudAt = (clientX: number, clientY: number): boolean => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const scale = resolution ? Number(resolution.value.split('x')[0]) / width : 1;
    const hudWidth = Math.floor(canvas.width / scale), hudHeight = Math.floor(canvas.height / scale);
    const cx = (clientX - rect.left) * hudWidth / rect.width;
    const cy = (clientY - rect.top) * hudHeight / rect.height;
    game.keyboard.sync(activeHud()?.keyboard);
    const regions = activeHud()?.keyboard ? game.keyboard.hits(hudWidth, hudHeight) :
      collectHudHitRegions(hudWidth, hudHeight, activeHud(), String(game.app.state.status ?? 'playing'), game.paused);
    const hit = regions
      .find(r => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h);
    if (!hit) {
      if (activeHud()?.keyboard || activeHud()?.callout || activeHud()?.grid?.layout === 'sidebar') return true;
      const path = canvas.dataset.pixelPick;
      if (path) {
        const index = game.pickThing(path, (clientX - rect.left) * canvas.width / rect.width,
          (clientY - rect.top) * canvas.height / rect.height);
        if (index >= 0) {
          activateHudAction(canvas.dataset.pixelPickAction!, [index]);
          return true;
        }
      }
      return false;
    }
    activateHudAction(hit.action, hit.args);
    return true;
  };
  if (canvas.dataset.pixelPick && (!canvas.dataset.pixelPickAction || !game.hasAction(canvas.dataset.pixelPickAction))) {
    throw new Error('data-pixel-pick requires a valid data-pixel-pick-action');
  }
  const dragAction = canvas.dataset.pixelDragAction;
  if (dragAction && !game.hasAction(dragAction)) throw new Error('data-pixel-drag-action requires a valid action');
  let drag: {id:number;startX:number;startY:number;lastX:number;moved:boolean} | undefined;
  let suppressDragClick = false;
  let hudTouch: { id: number; x: number; y: number; sidebar: boolean } | undefined;
  const consumesHudPointer = (clientX: number, clientY: number): boolean => {
    const hud = activeHud();
    if (hud?.keyboard || hud?.callout || hud?.grid?.layout === 'sidebar') return true;
    const rect = canvas.getBoundingClientRect(), scale = game.raycaster.hudScale;
    if (rect.width <= 0 || rect.height <= 0) return false;
    return hudButtonAt(hud, Math.floor(canvas.width / scale), Math.floor(canvas.height / scale),
      (clientX - rect.left) * canvas.width / scale / rect.width,
      (clientY - rect.top) * canvas.height / scale / rect.height);
  };
  canvas.addEventListener('mousedown', event => {
    if (consumesHudPointer(event.clientX, event.clientY)) event.stopImmediatePropagation();
  }, { capture: true, signal: abort.signal });
  canvas.addEventListener('pointerdown', event => {
    const sidebar = consumesHudPointer(event.clientX, event.clientY);
    if (dragAction && !sidebar && !game.paused && event.button === 0 && !drag) {
      drag = {id:event.pointerId,startX:event.clientX,startY:event.clientY,lastX:event.clientX,moved:false};
      suppressDragClick = false;
      canvas.setPointerCapture(event.pointerId);
    }
    if (event.pointerType === 'touch') hudTouch = { id: event.pointerId, x: event.clientX, y: event.clientY, sidebar };
    if (sidebar) {
      unlockAudio();
      clear(true);
      canvas.focus({ preventScroll: true });
      event.stopImmediatePropagation();
    }
  }, { capture: true, signal: abort.signal });
  listen(canvas, 'pointermove', ((event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>8) drag.moved = true;
    if (!drag.moved) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && !game.paused && !consumesHudPointer(event.clientX,event.clientY)) {
      game.invoke(dragAction!, [(event.clientX-drag.lastX)*180/rect.width]);
    }
    drag.lastX = event.clientX;
    event.preventDefault();
  }) as EventListener);
  listen(canvas, 'pointercancel', () => { hudTouch = undefined; drag = undefined; suppressDragClick = false; });
  canvas.addEventListener('pointerup', event => {
    if (drag?.id === event.pointerId) {
      suppressDragClick = drag.moved;
      drag = undefined;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (suppressDragClick) {
        hudTouch = undefined;
        if (event.pointerType === 'touch') lastTouchAt = Date.now();
        event.stopImmediatePropagation();
        return;
      }
    }
    const touch = hudTouch;
    hudTouch = undefined;
    if (touch?.sidebar) event.stopImmediatePropagation();
    if (event.pointerType !== 'touch' || touch?.id !== event.pointerId ||
        Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 12) return;
    lastTouchAt = Date.now();
    activateHudAt(event.clientX, event.clientY);
  }, { capture: true, signal: abort.signal });

  // Pointer lock for FPS mouse look & in-engine HUD clicks
  listen(canvas, 'click', ((event: MouseEvent) => {
    if (suppressDragClick) { suppressDragClick = false; return; }
    if (Date.now() - lastTouchAt < 700 || mapped?.recentTouch()) return;
    unlockAudio();
    canvas.focus();
    if (activateHudAt(event.clientX, event.clientY)) return;
    if (game.app.state.status !== 'playing') {
      if (game.config.clickToStart === false) return;
      if (game.app.state.status === 'title' || game.app.state.status === 'story' || game.app.state.status === 'select' || game.app.state.status === 'stage_clear' || game.app.state.status === 'boss_victory') {
        const panel = activeHud()?.panel;
        if (panel?.choiceActions && panel.choiceActions.length > 1) return;
        game.invoke('advance');
        return;
      }
      start();
      return;
    }
    if (game.config.mouseLook !== false && document.pointerLockElement !== canvas) {
      if (!canvas.requestPointerLock) {
        pointerLockUnavailable = true;
        return;
      }
      try {
        canvas.requestPointerLock()?.catch(() => { pointerLockUnavailable = true; });
      } catch {
        pointerLockUnavailable = true;
      }
    }
  }) as EventListener);

  listen(document, 'mousemove', ((event: MouseEvent) => {
    if (mapped) return;
    if (document.pointerLockElement === canvas) {
      lookAccumX += event.movementX;
      lookAccumY += event.movementY;
    }
  }) as EventListener);

  listen(canvas, 'keydown', ((event: KeyboardEvent) => {
    if (mapped && event.code !== 'Escape') return;
    if (event.code === 'Escape' && !event.repeat) {
      const menu = document.querySelector<HTMLElement>('[data-pixel-menu]:not([hidden])');
      if (menu?.dataset.pixelMenuClose) {
        event.preventDefault();
        clear();
        game.activate(menu.dataset.pixelMenuClose);
        return;
      }
      if (document.pointerLockElement === canvas) {
        event.preventDefault();
        document.exitPointerLock?.();
        clear();
        return;
      }
      if (isPausableStatus(game.app.state.status) && (game.config.pauseUi || document.querySelector('[data-pixel-paused]'))) {
        event.preventDefault();
        clear(true);
        game.paused = !game.paused;
        return;
      }
      if (game.app.state.status !== 'playing') {
        if (game.hasAction('back')) {
          event.preventDefault();
          clear(true);
          game.activate('back');
          return;
        }
        if (game.app.state.status !== 'title' && game.config.restartAction) {
          event.preventDefault();
          clear(true);
          game.activate(game.config.restartAction);
          return;
        }
      }
    }
    unlockAudio();
    if (keys[event.code] || ['Enter', 'KeyP', 'KeyM', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (game.app.state.status !== 'playing' &&
        (event.code === 'Enter' || keys[event.code] === 'fire' || keys[event.code] === 'use')) {
      if (!event.repeat) {
        clear();
        game.invoke('advance');
      }
      return;
    }
    if (keys[event.code]) input[keys[event.code]] = true;
    if (keys[event.code] === 'use' && !event.repeat) pendingUse = true;
    if (!event.repeat && event.code === 'Escape' && document.pointerLockElement === canvas) {
      document.exitPointerLock?.();
      clear();
    }
    if (!event.repeat && event.code === 'KeyP') {
      game.paused = !game.paused;
    }
    if (!event.repeat && event.code === 'KeyM') {
      game.muted = !game.muted;
    }
  }) as EventListener);

  listen(document, 'keyup', ((event: KeyboardEvent) => {
    if (mapped) return;
    if (keys[event.code]) {
      input[keys[event.code]] = false;
    }
  }) as EventListener);

  listen(window, 'blur', () => {
    game.flushSave();
    clear();
    game.paused = true;
  });

  listen(document, 'visibilitychange', () => {
    if (document.hidden) { game.flushSave(); clear(); game.paused = true; }
  });

  listen(window, 'focus', () => {
    if (game.app.state.status !== 'playing') game.paused = false;
  });

  const frame = (now: number) => {
    if (stopped) return;
    if (previous) accumulator += Math.min(now - previous, tickMs * 5);
    previous = now;
    const keyboardOpen = Boolean(activeHud()?.keyboard || activeHud()?.callout || activeHud()?.grid?.layout === 'sidebar');
    if (keyboardOpen) {
      clear(true);
      if (document.hasFocus() && document.activeElement === canvas && navigator.getGamepads) {
        game.hudPads(Array.from(navigator.getGamepads()));
        if (game.consumeUiFullscreen()) void fullscreen.toggle().catch(error => console.error('Pixel 3D fullscreen failed', error));
      }
    }

    while (accumulator >= tickMs) {
      const controls: Input3D = {
        ...input,
        fire: Boolean(input.fire || mouseFire || touchFire || pendingFire),
        use: Boolean(input.use || touchUse || pendingUse),
        move_x: moveX,
        move_y: moveY,
      };
      pendingFire = false;
      pendingUse = false;
      controls.look_x = lookAccumX;
      controls.look_y = lookAccumY;
      lookAccumX = 0;
      lookAccumY = 0;

      game.step(keyboardOpen ? {} : mapped ? mapped.sample(1 / tickRate) : controls);
      if (game.app.state.status !== 'playing') clear(true);
      accumulator -= tickMs;
    }

    touch?.update();
    mapped?.update();
    const capped = frameRate?.value === '60';
    const extraFrames = !game.paused && (capped || frameRate?.value === 'display');
    // Keep the render deadline independent of simulation and tolerate a rounded refresh timestamp.
    const renderDue = !capped || nextRenderAt === undefined || now + .5 >= nextRenderAt;
    if (capped && renderDue) {
      const deadline = nextRenderAt ?? now;
      const interval = 1000 / 60;
      nextRenderAt = deadline + Math.max(1, Math.floor((now - deadline) / interval) + 1) * interval;
    }
    if (renderDue && drawFrame(extraFrames)) {
      drawnFrames++;
      if (!ready) { ready = true; markGameReady(); }
    }
    if (fps) {
      if (!fpsStart) fpsStart = now;
      const seconds = (now - fpsStart) / 1000;
      if (seconds >= .5) {
        const renderer = gpuCanvas && !gpuCanvas.hidden ? 'GPU' : 'CPU';
        fps.textContent = `${renderer} · ${game.paused ? 'Paused' : `${Math.round(drawnFrames / seconds)} FPS`}`;
        fpsStart = now;
        drawnFrames = 0;
      }
    }

    const state = game.app.state as Record<string, any>;
    for (const button of Array.from(document.querySelectorAll<HTMLElement>('[data-pixel-mute]'))) {
      button.setAttribute('aria-pressed', String(game.muted));
    }
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-pixel-paused]'))) {
      element.hidden = !game.paused || !isPausableStatus(state.status);
    }
    for (const button of Array.from(document.querySelectorAll<HTMLElement>('[data-pixel-pause]'))) {
      button.textContent = game.paused ? 'Resume / P' : 'Pause / P';
    }
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-pixel-text], [data-pixel-disabled], [data-pixel-selected], [data-pixel-hidden]'))) {
      const resolve = (path: string) => path.split('.').reduce((v, key) => v?.[key], state);
      if (element.dataset.pixelText) {
        const value = resolve(element.dataset.pixelText);
        if (value === undefined) throw new Error(`Unknown data-pixel-text state: ${element.dataset.pixelText}`);
        const text = String(value);
        if (element.textContent !== text) element.textContent = text;
      }
      if (element.dataset.pixelDisabled && element instanceof HTMLButtonElement) {
        const value = resolve(element.dataset.pixelDisabled);
        if (typeof value !== 'boolean') throw new Error('data-pixel-disabled must reference boolean state');
        element.disabled = value;
      }
      if (element.dataset.pixelSelected) {
        const value = resolve(element.dataset.pixelSelected);
        if (typeof value !== 'boolean') throw new Error('data-pixel-selected must reference boolean state');
        element.setAttribute('aria-pressed', String(value));
      }
      if (element.dataset.pixelHidden) {
        const value = resolve(element.dataset.pixelHidden);
        if (typeof value !== 'boolean') throw new Error('data-pixel-hidden must reference boolean state');
        element.hidden = value;
      }
    }
    const nextMenuOpen = document.querySelector('[data-pixel-menu]:not([hidden])') !== null;
    if (nextMenuOpen !== menuOpen) {
      // Keep held command edges latched across pause/menu DOM changes.
      clear(true);
      menuOpen = nextMenuOpen;
      if (!menuOpen) canvas.focus({ preventScroll: true });
    }
    const announce = document.querySelector<HTMLElement>('[data-pixel-status]');
    if (announce) {
      const status = game.paused
        ? 'Paused — tap Resume or press P'
        : game.config.presentation
        ? `${game.config.presentation.title} — ${game.config.ui ? state[game.config.ui].prompt : state.message || game.config.presentation.objective}${game.saveStatus ? ` — Progress: ${game.saveStatus}` : ''}`
        : state.status === 'title'
        ? 'Vect Breach — Tap/click the game or press Enter/Space to commence mission.'
        : state.status === 'story'
        ? 'Incoming Transmission — Tap/click the game or press Enter/Space to engage.'
        : state.status === 'won'
        ? 'Mission Accomplished! All Sectors Cleared. Tap the game, or press Space/Enter to replay.'
        : state.status === 'gameover'
        ? 'Agent Terminated! Tap the game, or press Space/Enter to restart.'
        : state.status === 'ready'
        ? 'Click canvas or press Enter to begin mission.'
        : navigator.maxTouchPoints > 0
        ? 'Left stick: move. Drag the game: aim. FIRE: shoot. USE: terminal / elevator.'
        : 'Click canvas to lock mouse look. WASD to move, left click / Space to fire, E to use switch.';
      if (announce.textContent !== status) {
        announce.textContent = status;
      }
    }
    if ((state.status !== 'playing' || game.paused || menuOpen) && document.pointerLockElement === canvas) {
      document.exitPointerLock?.();
    }

    frameId = requestAnimationFrame(frame);
  };

  if (canvas.dataset.pixelAppFullscreen === 'true' && isStandaloneApp()) fullscreen.startStandalone();
  // Paint before yielding: WebKit may suspend animation callbacks for a
  // covered iframe, while the host is waiting for this initial ready signal.
  frame(performance.now());

  const dispose = () => {
    game.flushSave();
    stopped = true;
    game.paused = true;
    cancelAnimationFrame(frameId);
    fullscreen.dispose();
    gpu?.dispose();
    gpuLighting?.dispose();
    gpuCanvas?.remove();
    viewportResize.disconnect();
    touch?.dispose();
    mapped?.dispose();
    mappedStyle?.remove();
    if (mapped) surface.classList.remove('rune-pixel3d-surface');
    abort.abort();
    clear();
  };

  listen(window, 'pagehide', dispose);
  return dispose;
}
