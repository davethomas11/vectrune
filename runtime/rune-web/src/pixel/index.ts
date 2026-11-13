import { PixelEngine, type PixelConfig, type Input } from './engine';
import { getAudioContext } from '../audio';
import type { RuneWebConfig } from '../types';
let settings: PixelConfig;
export function configure(config: PixelConfig): void { settings = config; }
export function boot(options: RuneWebConfig): PixelEngine {
  const game = new PixelEngine(settings, options);
  Object.assign(globalThis, { __RunePixel: game });
  if (typeof document !== 'undefined') {
    let active: HTMLCanvasElement | null = null;
    let dispose: (() => void) | undefined;
    const attach = () => {
      const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-rune-pixel]');
      if (canvas === active) return;
      dispose?.(); active = canvas;
      dispose = canvas ? mount(game, canvas) : undefined;
    };
    attach();
    // Rune-Web may replace a page after navigation or a shell state change.
    const observer = new MutationObserver(attach);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('pagehide', () => { observer.disconnect(); dispose?.(); }, { once: true });
  }
  return game;
}

export function mount(game: PixelEngine, canvas: HTMLCanvasElement): () => void {
  const { width, height, tickRate } = game.config;
  const keys = game.config.keys || { ArrowLeft:'left',ArrowRight:'right',KeyA:'left',KeyD:'right',Space:'smash' };
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('This game needs Canvas 2D support');
  context.imageSmoothingEnabled = false;
  const image = new ImageData(new Uint8ClampedArray(game.buffer.buffer as ArrayBuffer), width, height);
  let input: Input = {}, previous = 0, accumulator = 0, stopped = false, frameId = 0;
  const abort = new AbortController();
  const listen = (element: EventTarget, name: string, callback: EventListener) => element.addEventListener(name, callback, { signal: abort.signal });
  const pending = new Set<string>();
  const clear = () => { input = {}; pending.clear(); };
  const pause = () => { getAudioContext(); game.paused = !game.paused; clear(); previous = 0; accumulator = 0; };
  const start = () => { getAudioContext(); clear(); game.start(); previous = 0; accumulator = 0; canvas.focus(); };
  const mute = () => { canvas.focus(); game.muted = !game.muted; };
  const fullscreen = () => {
    const surface = canvas.closest<HTMLElement>('.game-surface') || canvas;
    const result = document.fullscreenElement ? document.exitFullscreen() : surface.requestFullscreen?.();
    result?.catch(() => { /* The browser may deny fullscreen; the game keeps working. */ });
  };
  listen(canvas, 'keydown', ((event: KeyboardEvent) => {
    if (keys[event.code] || ['Enter','KeyP','KeyF','KeyM'].includes(event.code)) event.preventDefault();
    if (keys[event.code]) { input[keys[event.code]] = true; pending.add(keys[event.code]); }
    if (!event.repeat && event.code === 'Enter') start();
    if (!event.repeat && event.code === 'KeyP') pause();
    if (!event.repeat && event.code === 'KeyF') fullscreen();
    if (!event.repeat && event.code === 'KeyM') mute();
  }) as EventListener);
  listen(canvas, 'keyup', ((event: KeyboardEvent) => {
    if (keys[event.code]) input[keys[event.code]] = false;
  }) as EventListener);
  listen(canvas, 'blur', ((event: FocusEvent) => {
    clear();
    const next = event.relatedTarget;
    if (next instanceof Element && next.closest('[data-pixel-pause],[data-pixel-start],[data-pixel-fullscreen],[data-pixel-input],[data-pixel-mute]')) return;
    if (game.app.state.status === 'playing') game.paused = true;
  }) as EventListener);
  listen(window, 'blur', () => { clear(); if (game.app.state.status === 'playing') game.paused = true; });
  listen(document, 'visibilitychange', () => { if (document.hidden) { clear(); game.paused = true; } previous = 0; accumulator = 0; });
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-pixel-input]'))) {
    const key = button.dataset.pixelInput!;
    listen(button, 'pointerdown', ((event: PointerEvent) => { event.preventDefault(); canvas.focus(); game.paused = false; button.setPointerCapture(event.pointerId); input[key] = true; pending.add(key); }) as EventListener);
    for (const event of ['pointerup','lostpointercapture']) listen(button,event,() => { input[key] = false; });
    listen(button,'pointercancel',() => { input[key] = false; pending.delete(key); });
  }
  for (const button of Array.from(document.querySelectorAll('[data-pixel-start]'))) listen(button,'click',start);
  for (const button of Array.from(document.querySelectorAll('[data-pixel-pause]'))) listen(button,'click',() => { canvas.focus(); pause(); });
  for (const button of Array.from(document.querySelectorAll('[data-pixel-mute]'))) listen(button,'click',mute);
  for (const button of Array.from(document.querySelectorAll('[data-pixel-fullscreen]'))) listen(button,'click',fullscreen);
  const resize = () => {
    const surface = canvas.parentElement;
    if (!surface) return;
    const style = getComputedStyle(surface);
    const available = surface.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const full = !!document.fullscreenElement;
    const scale = Math.max(1, Math.floor(Math.min(available / width, full ? innerHeight / height : Infinity)));
    const displayWidth = Math.min(available, width * scale);
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayWidth * height / width + 'px';
  };
  const observer = new ResizeObserver(resize);
  if (canvas.parentElement) observer.observe(canvas.parentElement);
  listen(document, 'fullscreenchange', resize);
  resize();
  const announce = document.querySelector<HTMLElement>('[data-pixel-status]');
  let lastStatus = '';
  const frame = (now: number) => {
    if (stopped) return;
    if (previous) accumulator += Math.min(now - previous, 1000 / tickRate * 5);
    previous = now;
    while (accumulator >= 1000 / tickRate) {
      const controls = { ...input };
      for (const key of pending) controls[key] = true;
      pending.clear();
      game.step(controls); accumulator -= 1000 / tickRate;
    }
    game.frame(); context.putImageData(image, 0, 0);
    const state = game.app.state;
    const status = game.paused ? 'Paused — press P to resume' : state.status === 'won' ? 'City conquered! Play again?' : state.status === 'gameover' ? 'Monster down. Try another rampage!' : state.status === 'ready' ? 'Ready to make a big entrance?' : 'Smash buildings. Watch out for the army!';
    if (announce && status !== lastStatus) { announce.textContent = status; lastStatus = status; }
    for (const button of Array.from(document.querySelectorAll('[data-pixel-pause]'))) { const label = game.paused ? 'Resume' : 'Pause'; if (button.textContent !== label) button.textContent = label; button.setAttribute('aria-pressed',String(game.paused)); }
    for (const button of Array.from(document.querySelectorAll('[data-pixel-mute]'))) {
      const label = game.muted ? 'Sound off' : 'Sound on';
      if (button.textContent !== label) button.textContent = label;
      button.setAttribute('aria-pressed',String(game.muted));
    }
    frameId = requestAnimationFrame(frame);
  };
  frameId = requestAnimationFrame(frame);
  const dispose = () => { stopped = true; game.paused = true; cancelAnimationFrame(frameId); abort.abort(); observer.disconnect(); clear(); };
  listen(window,'pagehide',dispose);
  return dispose;
}
