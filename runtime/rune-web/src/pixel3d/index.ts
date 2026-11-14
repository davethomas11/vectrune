import { Pixel3DEngine, type Pixel3DConfig, type Input3D } from './engine';
import { unlockAudio } from '../audio';
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
    lookAccumX = 0;
    lookAccumY = 0;
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
      game.paused = !game.paused;
    });
  }
  for (const button of Array.from(document.querySelectorAll('[data-pixel-mute]'))) {
    listen(button, 'click', () => {
      game.muted = !game.muted;
    });
  }
  for (const button of Array.from(document.querySelectorAll('[data-pixel-fullscreen]'))) {
    listen(button, 'click', () => {
      const surface = canvas.parentElement || canvas;
      if (!document.fullscreenElement) {
        surface.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });
  }

  // Pointer lock for FPS mouse look
  listen(canvas, 'click', () => {
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
      canvas.requestPointerLock?.();
    }
  });

  listen(document, 'mousemove', ((event: MouseEvent) => {
    if (document.pointerLockElement === canvas) {
      lookAccumX += event.movementX;
      lookAccumY += event.movementY;
    }
  }) as EventListener);

  listen(canvas, 'keydown', ((event: KeyboardEvent) => {
    unlockAudio();
    if (keys[event.code] || ['Enter', 'KeyP', 'KeyM', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (keys[event.code]) {
      input[keys[event.code]] = true;
    }
    if (!event.repeat && event.code === 'Enter') {
      if (game.app.state.status === 'title' || game.app.state.status === 'story') {
        game.invoke('advance');
      } else if (game.app.state.status !== 'playing') {
        start();
      }
    }
    if (!event.repeat && event.code === 'Space') {
      if (game.app.state.status === 'title' || game.app.state.status === 'story') {
        game.invoke('advance');
      }
    }
    if (!event.repeat && event.code === 'KeyP') {
      game.paused = !game.paused;
    }
    if (!event.repeat && event.code === 'KeyM') {
      game.muted = !game.muted;
    }
  }) as EventListener);

  listen(canvas, 'keyup', ((event: KeyboardEvent) => {
    if (keys[event.code]) {
      input[keys[event.code]] = false;
    }
  }) as EventListener);

  listen(window, 'blur', () => {
    clear();
    game.paused = true;
  });

  listen(window, 'focus', () => {
    if (game.app.state.status !== 'playing') game.paused = false;
  });

  const frame = (now: number) => {
    if (stopped) return;
    if (previous) accumulator += Math.min(now - previous, (1000 / tickRate) * 5);
    previous = now;

    while (accumulator >= 1000 / tickRate) {
      const controls: Input3D = { ...input };
      controls.look_x = lookAccumX;
      controls.look_y = lookAccumY;
      lookAccumX = 0;
      lookAccumY = 0;

      game.step(controls);
      accumulator -= 1000 / tickRate;
    }

    game.frame();
    context.putImageData(image, 0, 0);

    const state = game.app.state as Record<string, any>;
    const announce = document.querySelector<HTMLElement>('[data-pixel-status]');
    if (announce) {
      const status = game.paused
        ? 'Paused — press P to resume'
        : state.status === 'title'
        ? 'Vect Breach — Click canvas or press Enter/Space to commence mission.'
        : state.status === 'story'
        ? 'Incoming Transmission — Click canvas or press Enter/Space to engage.'
        : state.status === 'won'
        ? 'Mission Accomplished! All Sectors Cleared. Press Space, Click, or Enter to replay.'
        : state.status === 'gameover'
        ? 'Agent Terminated! Press Space, Click, or Enter to restart.'
        : state.status === 'ready'
        ? 'Click canvas or press Enter to begin mission.'
        : 'Click canvas to lock mouse look. WASD to move, Space to fire, E to use switch.';
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
    abort.abort();
    clear();
  };

  listen(window, 'pagehide', dispose);
  return dispose;
}

