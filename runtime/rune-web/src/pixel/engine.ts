import { GameSave, type Persistence } from './persistence';
import { withContext, type RuneContext } from '../context';
import { createLogicApp } from '../logic';
import { registerSounds, registerMusic, configureAudioHost, setAudioMuted, stopMusic, pauseMusic, resumeMusic, playSound } from '../audio';
import { audioSync } from '../audio_sync';
import type { RuneApp, RuneWebConfig } from '../types';

export interface Sprite { width: number; height: number; origin: number[]; colors: (number | null)[]; pixels: number[] }
export interface PixelConfig {
  width: number; height: number; tickRate: number; background: number;
  sprites: Record<string, Sprite>;
  animations: Record<string, { frames: string[]; fps: number }>;
  layers: string[];
  keys?: Record<string,string>;
  commands?: Record<string,string>;
  persistence?: Persistence;
  menu?: string;
  menuSounds?: {move?:string; confirm?:string};
  hud?: { title: string; score: string; health: string; max_health: number; level?: string; coins?: string };
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
  private _paused = false;
  private _muted = false;
  get paused(): boolean { return this._paused; }
  set paused(value: boolean) {
    if (value === this._paused) return;
    this._paused = value;
    if (value) pauseMusic();
    setAudioMuted(this._muted || value);
    if (!value) resumeMusic();
  }
  get muted(): boolean { return this._muted; }
  set muted(value: boolean) { this._muted = value; setAudioMuted(value || this._paused); }
  get audioState() { return audioSync.getSnapshot(); }
  private background: Uint32Array;
  private spans = new Map<string, number[]>();
  private save?: GameSave;
  get saveStatus() { return this.save?.status; }
  private buttons: { x:number; y:number; width:number; height:number; action:string; args:unknown[] }[] = [];
  private selected = 0;
  private lastMenu = '';
  ticks = 0;
  constructor(readonly config: PixelConfig, options: RuneWebConfig) {
    // Browser globals used by the shared expression runtime have no host powers in QuickJS.
    if (typeof window === 'undefined') Object.assign(globalThis, { window: globalThis });
    this.buffer = new Uint32Array(config.width * config.height);
    this.buffer.fill(packed(config.background));
    for (const r of config.rects) this.rect(r.x,r.y,r.width,r.height,parseInt(r.color.slice(1),16));
    this.background = this.buffer.slice();
    this.app = createLogicApp(function (this: RuneApp) { this.computeDerived(); });
    this.context = { ...options, app: this.app, isRendering: false, memorySubscriptions: {},
      initialState: JSON.parse(JSON.stringify(options.stateJson)), loadedChunks: {}, loadingChunks: {}, navigator: null };
    // Game state deliberately avoids the DOM reactive proxy. The game clock owns rendering.
    this.app.state = JSON.parse(JSON.stringify(options.stateJson));
    configureAudioHost({ syncPage: false, deferPlayback: typeof document !== 'undefined' });
    registerSounds(options.sounds); registerMusic(options.music);
    if (config.persistence) {
      this.save = new GameSave(config.persistence);
      this.app.state[config.persistence.state] = this.save.load(this.app.state[config.persistence.state]);
    }
    withContext(this.context, () => {
      if (options.actionDefinitions.initialize) this.app.invokeAction('initialize', []);
      this.app.computeDerived();
    });
    this.persist();
  }
  start(): void { stopMusic(); this._paused = false; setAudioMuted(this._muted); this.ticks = 0; withContext(this.context, () => { this.app.invokeAction('start', []); this.app.computeDerived(); }); this.persist(); }
  step(input: Input = {}): void {
    if (input.start) { this.start(); return; }
    if (this.paused) return;
    withContext(this.context, () => { this.app.invokeAction('tick', [input]); this.app.computeDerived(); });
    this.ticks++;
    this.persist();
  }
  private persist(): void { if (this.save) this.save.flush(this.app.state[this.save.config.state]); }
  invoke(action: string, args: unknown[] = []): void {
    if (action === 'start') { this.start(); return; }
    this.paused = false; setAudioMuted(this._muted);
    withContext(this.context, () => { this.app.invokeAction(action,args); this.app.computeDerived(); });
    this.persist();
  }
  /** User-triggered menu choice; programmatic Rune actions remain silent. */
  activate(action: string,args: unknown[] = []): void {
    if(this.config.menuSounds?.confirm) playSound(this.config.menuSounds.confirm);
    this.invoke(action,args);
  }
  key(code: string): boolean {
    const command = this.config.commands?.[code];
    if (command) { this.activate(command); return true; }
    const menu = this.config.menu && this.app.state[this.config.menu] as any;
    if (!menu || this.paused) return false;
    const buttons=[...(menu.cards || []),...(menu.buttons || [])];
    if(!buttons.length) return false;
    if(this.lastMenu !== String(menu.id || menu.title)) { this.selected=0; this.lastMenu=String(menu.id || menu.title); }
    if (['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(code)) {
      this.selected = (this.selected + (code === 'ArrowLeft' || code === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
      if(this.config.menuSounds?.move) playSound(this.config.menuSounds.move);
      return true;
    }
    if (code === 'Enter' || code === 'Space') { const button = buttons[this.selected]; this.activate(button.action,button.args || []); return true; }
    return false;
  }
  click(x:number,y:number): void {
    this.frame();
    const i = this.buttons.findIndex(b => x >= b.x && y >= b.y && x < b.x+b.width && y < b.y+b.height);
    if (i >= 0) { this.selected = i; const b = this.buttons[i]; this.activate(b.action,b.args); }
  }
  private menuFrame(menu: any): void {
    const w = this.config.width, h = this.config.height;
    const identity = String(menu.id || menu.title);
    if (identity !== this.lastMenu) this.selected = 0;
    this.lastMenu = identity; this.buttons = [];
    this.rect(8,27,w-16,h-34,0x111c2b);
    this.rect(8,27,w-16,2,0xa6f282);
    this.text(menu.title,w/2-String(menu.id || menu.title).length*4,38,0xa6f282,2);
    this.text(menu.subtitle || '',w/2-String(menu.subtitle || '').length*2,56,0xeccc85);
    if(this.saveStatus === 'session') this.text('SESSION ONLY - SAVE STORAGE UNAVAILABLE',18,64,0xffb295);
    if(this.saveStatus === 'recovered') this.text('SAVE RECOVERED - USING A FRESH PROFILE',18,64,0xffb295);
    const cards = menu.cards || [];
    for (let i=0;i<cards.length;i++) {
      const cw=(w-36)/3-6, card=cards[i], x=18+((3-cards.length)/2+i)*(w-36)/3;
      this.rect(x,70,cw,92,0x25374a);
      this.sprite({x:x+cw/2-16,y:76,sprite:card.sprite,scale:2});
      this.text(card.name,x+cw/2-card.name.length*2,130,0xf5e9cc);
      this.text(card.detail,x+cw/2-card.detail.length*2,142,0xeccc85);
      this.buttons.push({x,y:70,width:cw,height:92,action:card.action,args:card.args || []});
    }
    const actions=menu.buttons || [];
    for(let i=0;i<actions.length;i++) {
      const button=actions[i], width=cards.length ? (w-36)/actions.length-6 : 156, x=cards.length ? 18+i*(w-36)/actions.length : w/2-width/2, y=cards.length ? 176 : 102+i*30;
      this.rect(x,y,width,22,0x304c40);
      this.text(button.label,x+width/2-button.label.length*2,y+8);
      this.buttons.push({x,y,width,height:22,action:button.action,args:button.args || []});
    }
    if (this.selected >= this.buttons.length) this.selected=0;
    const focus=this.buttons[this.selected];
    if(focus) { this.rect(focus.x,focus.y,focus.width,1,0xa6f282); this.rect(focus.x,focus.y+focus.height-1,focus.width,1,0xa6f282); }
    if(menu.note) this.text(menu.note,w/2-String(menu.note).length*2,cards.length ? 166 : 185,0xffb295);
    this.text('ARROWS SELECT  ENTER CHOOSE  B SHOP  T TITLE',w/2-82,h-10,0x9caeb7);
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
    const key = name + ':' + scale + ':' + !!entity.flip;
    let spans = this.spans.get(key);
    if (!spans) {
      spans = [];
      for (let row=0;row<sprite.height;row++) {
        let col=0;
        while(col<sprite.width) {
          const start=col, color=sprite.colors[sprite.pixels[row*sprite.width+(entity.flip ? sprite.width-1-col : col)]];
          while(++col<sprite.width && sprite.colors[sprite.pixels[row*sprite.width+(entity.flip ? sprite.width-1-col : col)]]===color) {}
          if(color !== null) spans.push(start*scale,row*scale,(col-start)*scale,packed(color));
        }
      }
      if(this.spans.size >= 256) this.spans.clear();
      this.spans.set(key,spans);
    }
    const x=Math.floor(entity.x-sprite.origin[0]*scale), y=Math.floor(entity.y-sprite.origin[1]*scale);
    const w=this.config.width,h=this.config.height;
    for(let i=0;i<spans.length;i+=4) {
      const left=Math.max(0,x+spans[i]), right=Math.min(w,x+spans[i]+spans[i+2]);
      if(left>=right) continue;
      const top=Math.max(0,y+spans[i+1]), bottom=Math.min(h,y+spans[i+1]+scale), color=spans[i+3];
      for(let row=top;row<bottom;row++) this.buffer.fill(color,row*w+left,row*w+right);
    }
  }
  frame(): Uint32Array {
    this.buffer.set(this.background);
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
      const coins = hud.coins?.split('.').reduce((value:any,part) => value?.[part],state);
      this.text(hud.level ? 'CITY ' + state[hud.level] + '  COINS ' + (coins || 0) : hud.title,10,9,0xa6f282);
      this.text('SCORE ' + String(state[hud.score] || 0).padStart(5, '0'), width - 156, 9);
      if (this.muted) this.text('MUTE',width - 76,9,0xffb295);
      this.rect(width - 54, 9, 43, 5, 0x403447);
      this.rect(width - 54, 9, Math.max(0, Math.min(43, Number(state[hud.health] || 0) * 43 / hud.max_health)), 5, 0xff8966);
    }
    this.buttons = [];
    const menu = this.config.menu && state[this.config.menu];
    if (menu && !this.paused) { this.menuFrame(menu); return this.buffer; }
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
