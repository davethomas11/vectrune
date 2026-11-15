import { mountControls } from '../input/browser';
import { Pixel3DEngine, type Pixel3DConfig, type Input3D } from './engine';
import { unlockAudio } from '../audio';
import { mountTouch, STYLE } from './touch';
import { createFullscreen } from './fullscreen';
import type { RuneWebConfig } from '../types';

let settings: Pixel3DConfig;
export function configure(config: Pixel3DConfig): void {
  settings = config;
}

export function boot(options: RuneWebConfig): Pixel3DEngine {
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

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This game needs Canvas 2D support');
  context.imageSmoothingEnabled = false;

  const image = new ImageData(
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

  const abort = new AbortController();
  const listen = (
    element: EventTarget,
    name: string,
    callback: EventListener
  ) => element.addEventListener(name, callback, { signal: abort.signal });

  const clear = () => {
    input = {};
    mouseFire = false;
    pendingFire = false;
    pendingUse = false;
    lookAccumX = 0;
    lookAccumY = 0;
    touch?.reset();
    mapped?.clear();
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
  for (const button of Array.from(document.querySelectorAll('[data-pixel-start]'))) {
    listen(button, 'click', start);
  }
  for (const button of Array.from(document.querySelectorAll('[data-pixel-pause]'))) {
    listen(button, 'click', () => {
      canvas.focus();
      clear();
      game.paused = !game.paused;
    });
  }
  for (const button of Array.from(document.querySelectorAll('[data-pixel-mute]'))) {
    listen(button, 'click', () => {
      game.muted = !game.muted;
    });
  }
  const surface = canvas.parentElement || canvas;
  const fullscreen = createFullscreen(surface, () => { clear(); touch?.update(); });
  for (const button of Array.from(document.querySelectorAll('[data-pixel-fullscreen]'))) {
    listen(button, 'click', () => { void fullscreen.toggle().catch(() => {}); });
  }
  mapped = game.controls ? mountControls(canvas, game.controls, {
    playing: () => game.app.state.status === 'playing', paused: () => game.paused,
    resume: () => { clear(); game.paused = false; },
    advance: () => { clear(); if (['title', 'story', 'gameover', 'won'].includes(String(game.app.state.status))) game.invoke('advance'); else start(); },
    fullscreen: () => { void fullscreen.toggle().catch(() => {}); },
    interact: unlockAudio, lockedMouse: true, advanceInputs: ['fire', 'use'], expanded: fullscreen.expanded,
  }) : undefined;
  const mappedStyle = mapped ? document.createElement('style') : undefined;
  if (mappedStyle) { mappedStyle.textContent = STYLE; document.head.append(mappedStyle); surface.classList.add('rune-pixel3d-surface'); }
  touch = mapped ? undefined : mountTouch(canvas, surface, {
    playing: () => game.app.state.status === 'playing',
    paused: () => game.paused,
    interact: () => { lastTouchAt = Date.now(); unlockAudio(); },
    advance: () => {
      clear();
      if (['title', 'story', 'gameover', 'won'].includes(String(game.app.state.status))) game.invoke('advance');
      else start();
    },
    resume: () => { clear(); game.paused = false; },
    move: (x, y) => { moveX = x; moveY = y; },
    look: delta => { lookAccumX += delta; },
    fire: (held, pulse, cancel) => { touchFire = held; if (pulse) pendingFire = true; if (cancel) pendingFire = false; },
    use: (held, pulse, cancel) => { touchUse = held; if (pulse) pendingUse = true; if (cancel) pendingUse = false; },
    fullscreen: () => { void fullscreen.toggle().catch(() => {}); },
    expanded: fullscreen.expanded,
    pause: () => { clear(); game.paused = !game.paused; },
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
  listen(document, 'pointerlockchange', () => {
    if (document.pointerLockElement !== canvas) {
      // The browser queues this event: keep keys pressed after Escape intact.
      mouseFire = false;
      pendingFire = false;
      lookAccumX = 0;
      lookAccumY = 0;
    }
  });

  // Pointer lock for FPS mouse look
  listen(canvas, 'click', () => {
    if (Date.now() - lastTouchAt < 700 || mapped?.recentTouch()) return;
    unlockAudio();
    canvas.focus();
    if (game.app.state.status !== 'playing') {
      if (game.app.state.status === 'title' || game.app.state.status === 'story') {
        game.invoke('advance');
        return;
      }
      start();
      return;
    }
    if (document.pointerLockElement !== canvas) {
      const lock = canvas.requestPointerLock?.();
      // Shooting still works when embedding or browser policy denies mouse lock.
      lock?.catch(() => {});
    }
  });

  listen(document, 'mousemove', ((event: MouseEvent) => {
    if (mapped) return;
    if (document.pointerLockElement === canvas) {
      lookAccumX += event.movementX;
      lookAccumY += event.movementY;
    }
  }) as EventListener);

  listen(canvas, 'keydown', ((event: KeyboardEvent) => {
    if (mapped && event.code !== 'Escape') return;
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
    clear();
    game.paused = true;
  });

  listen(document, 'visibilitychange', () => {
    if (document.hidden) { clear(); game.paused = true; }
  });

  listen(window, 'focus', () => {
    if (game.app.state.status !== 'playing') game.paused = false;
  });

  const frame = (now: number) => {
    if (stopped) return;
    if (previous) accumulator += Math.min(now - previous, (1000 / tickRate) * 5);
    previous = now;

    while (accumulator >= 1000 / tickRate) {
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

      game.step(mapped ? mapped.sample(1 / tickRate) : controls);
      if (game.app.state.status !== 'playing') clear();
      accumulator -= 1000 / tickRate;
    }

    touch?.update();
    mapped?.update();
    game.frame();
    context.putImageData(image, 0, 0);

    const state = game.app.state as Record<string, any>;
    const announce = document.querySelector<HTMLElement>('[data-pixel-status]');
    if (announce) {
      const status = game.paused
        ? 'Paused — tap Resume or press P'
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
    if (state.status !== 'playing' && document.pointerLockElement === canvas) {
      document.exitPointerLock?.();
    }

    frameId = requestAnimationFrame(frame);
  };

  frameId = requestAnimationFrame(frame);

  const dispose = () => {
    stopped = true;
    game.paused = true;
    cancelAnimationFrame(frameId);
    fullscreen.dispose();
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

