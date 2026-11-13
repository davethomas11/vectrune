import { withContext, type RuneContext } from '../context';
import { createLogicApp } from '../logic';
import { registerSounds, registerMusic } from '../audio';
import type { RuneApp, RuneWebConfig } from '../types';

export interface Sprite { width: number; height: number; origin: number[]; colors: (number | null)[]; pixels: number[] }
export interface PixelConfig {
  width: number; height: number; tickRate: number; background: number;
  sprites: Record<string, Sprite>;
  animations: Record<string, { frames: string[]; fps: number }>;
  layers: string[];
  keys?: Record<string,string>;
  hud?: { title: string; score: string; health: string; max_health: number };
  overlays?: Record<string,string>;
  rects: { x: number; y: number; width: number; height: number; color: string }[];
}
export interface Input { [action: string]: boolean | undefined }
interface Entity { x: number; y: number; sprite: string; scale?: number; visible?: boolean; flip?: boolean }

// Tiny portable bitmap font: the same HUD is rendered by every presentation host.
const FONT: Record<string, string> = {
 A:'010101111101101', B:'110101110101110', C:'011100100100011', D:'110101101101110',
 E:'111100110100111', F:'111100110100100', G:'011100101101011', H:'101101111101101',
 I:'111010010010111', J:'001001001101010', K:'101101110101101', L:'100100100100111',
 M:'101111111101101', N:'101111111111101', O:'010101101101010', P:'110101110100100',
 Q:'010101101111011', R:'110101110101101', S:'011100010001110', T:'111010010010010',
 U:'101101101101111', V:'101101101101010', W:'101101111111101', X:'101101010101101',
 Y:'101101010010010', Z:'111001010100111',
 '0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110',
 '4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010',
 '8':'111101111101111','9':'111101111001110', ':':'000010000010000', '-':'000000111000000',
};
const packed = (rgb: number) => (0xff000000 | ((rgb & 255) << 16) | (rgb & 0xff00) | ((rgb >>> 16) & 255)) >>> 0;

export class PixelEngine {
  readonly app: RuneApp;
  readonly buffer: Uint32Array;
  private readonly context: RuneContext;
  paused = false;
  ticks = 0;
  constructor(readonly config: PixelConfig, options: RuneWebConfig) {
    // Browser globals used by the shared expression runtime have no host powers in QuickJS.
    if (typeof window === 'undefined') Object.assign(globalThis, { window: globalThis });
    this.buffer = new Uint32Array(config.width * config.height);
    this.app = createLogicApp(function (this: RuneApp) { this.computeDerived(); });
    this.context = { ...options, app: this.app, isRendering: false, memorySubscriptions: {},
      initialState: JSON.parse(JSON.stringify(options.stateJson)), loadedChunks: {}, loadingChunks: {}, navigator: null };
    // Game state deliberately avoids the DOM reactive proxy. The game clock owns rendering.
    this.app.state = JSON.parse(JSON.stringify(options.stateJson));
    registerSounds(options.sounds); registerMusic(options.music);
    withContext(this.context, () => this.app.computeDerived());
  }
  start(): void { this.paused = false; this.ticks = 0; withContext(this.context, () => { this.app.invokeAction('start', []); this.app.computeDerived(); }); }
  step(input: Input = {}): void {
    if (input.start) { this.start(); return; }
    if (this.paused) return;
    withContext(this.context, () => { this.app.invokeAction('tick', [input]); this.app.computeDerived(); });
    this.ticks++;
  }
  rect(x: number, y: number, width: number, height: number, color: number): void {
    const c = packed(color), w = this.config.width, h = this.config.height;
    const left = Math.min(w, Math.max(0, Math.floor(x))), top = Math.max(0, Math.floor(y));
    const right = Math.min(w, Math.floor(x + width)), bottom = Math.min(h, Math.floor(y + height));
    for (let row = top; row < bottom; row++) this.buffer.fill(c, row * w + left, row * w + Math.max(left, right));
  }
  text(text: string, x: number, y: number, color = 0xf5e9cc, scale = 1): void {
    for (const char of text.toUpperCase()) {
      const glyph = FONT[char];
      if (glyph) for (let p = 0; p < glyph.length; p++) if (glyph[p] === '1') this.rect(x + (p % 3) * scale, y + Math.floor(p / 3) * scale, scale, scale, color);
      x += 4 * scale;
    }
  }
  sprite(entity: Entity): void {
    if (entity.visible === false) return;
    let name = entity.sprite;
    const animation = this.config.animations[name];
    if (animation) name = animation.frames[Math.floor(this.ticks * animation.fps / this.config.tickRate) % animation.frames.length];
    const sprite = this.config.sprites[name];
    if (!sprite) throw new Error(`Unknown pixel sprite: ${name}`);
    const scale = Math.max(1, Math.min(8, Math.floor(entity.scale || 1)));
    const x = entity.x - sprite.origin[0] * scale, y = entity.y - sprite.origin[1] * scale;
    for (let row = 0; row < sprite.height; row++) for (let col = 0; col < sprite.width; col++) {
      const color = sprite.colors[sprite.pixels[row * sprite.width + col]];
      if (color !== null) this.rect(x + (entity.flip ? sprite.width - 1 - col : col) * scale, y + row * scale, scale, scale, color);
    }
  }
  frame(): Uint32Array {
    this.buffer.fill(packed(this.config.background));
    for (const r of this.config.rects) this.rect(r.x, r.y, r.width, r.height, parseInt(r.color.slice(1), 16));
    const state = this.app.state as Record<string, any>;
    for (const path of this.config.layers) {
      const value = path.split('.').reduce((value: any, part) => value?.[part], state);
      if (value) for (const entity of Array.isArray(value) ? value : [value]) this.sprite(entity);
    }
    // HUD bindings and overlay copy belong to the scene, rather than the engine.
    const hud = this.config.hud;
    if (hud) {
      const width = this.config.width;
      this.rect(0, 0, width, 23, 0x10131d);
      this.text(hud.title, 10, 9, 0xa6f282);
      this.text('SCORE ' + String(state[hud.score] || 0).padStart(5, '0'), width - 156, 9);
      this.rect(width - 54, 9, 43, 5, 0x403447);
      this.rect(width - 54, 9, Math.max(0, Math.min(43, Number(state[hud.health] || 0) * 43 / hud.max_health)), 5, 0xff8966);
    }
    const title = this.paused ? 'PAUSED' : this.config.overlays?.[String(state.status)];
    if (title) {
      const center = this.config.width / 2, top = this.config.height / 2 - 38;
      this.rect(center - 124, top, 248, 70, 0x111824);
      this.rect(center - 124, top, 248, 2, 0xa6f282);
      this.text(title, center - title.length * 4, top + 18, 0xa6f282, 2);
      const hint = this.paused ? 'PRESS P TO RESUME' : 'PRESS ENTER TO START';
      this.text(hint, center - hint.length * 2, top + 50);
    }
    return this.buffer;
  }
}
