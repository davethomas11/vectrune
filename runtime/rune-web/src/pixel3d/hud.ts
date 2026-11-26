import type { Sprite } from '../pixel/engine';
import { validateKeyboard, type OnScreenKeyboardConfig } from './on_screen_keyboard';

export interface HudButton {
  icon: 'menu' | 'feed' | 'fish' | 'sound' | 'flower' | 'critter';
  label: string;
  anchor: 'top-right' | 'bottom-left';
  offset?: number;
  size?: number;
  action: string;
  disabled?: boolean;
  selected?: boolean;
}
export interface HudCallout {
  title: string;
  lines: string[];
  target: { x: number; y: number; z: number };
  width?: number;
  actions: Array<{ label: string; action: string }>;
  screen?: { x: number; y: number };
  selected?: number;
  dismissAction?: string;
}

export interface HudMeter {
  label: string;
  value: number;
  max: number;
  color: number;
  icon?: string;
  emptyIcon?: string;
  display?: 'counter' | 'pips' | 'bar';
  showValue?: boolean;
}
export interface HudPanel {
  title: string;
  body: string;
  choices: string[];
  selected: number;
  footer: string;
  choiceActions?: Array<{ action: string; args?: unknown[] }>;
}
export interface HudGridItem {
  label: string;
  sub?: string;
  badge?: string;
  color?: number;
  selected?: boolean;
  disabled?: boolean;
  action?: string;
  args?: unknown[];
}
export interface HudGrid {
  layout?: 'sidebar';
  subtitle?: string;
  dismissAction?: string;
  moveAction?: string;
  closeOnActivate?: boolean;
  width?: number;
  rowHeight?: number;
  gap?: number;
  padding?: number;
  textScale?: 1 | 2;
  title?: string;
  columns: number;
  items: HudGridItem[];
  footer?: string;
}
export interface HudSlot {
  label: string;
  color: number;
  selected?: boolean;
  locked?: boolean;
  action?: string;
  args?: unknown[];
}
export interface HudHitRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  action: string;
  args: unknown[];
}
export interface HudWheelItem {
  label: string;
  sub?: string;
  color: number;
  selected?: boolean;
  locked?: boolean;
  action?: string;
  args?: unknown[];
}
export interface HudWheel {
  title?: string;
  items: HudWheelItem[];
  selected?: number;
  active?: boolean;
}
export interface CinemaHud {
  lines: string[];
  offset: number;
  top?: number;
  bottom?: number;
  scale?: 1 | 2;
  spacing?: number;
  fade?: number;
}
export interface HudTheme {
  background?: number;
  surface?: number;
  selected?: number;
  border?: number;
  text?: number;
  muted?: number;
  accent?: number;
  focus?: number;
  radius?: number;
}
export interface GameHud {
  buttons?: HudButton[];
  callout?: HudCallout;
  keyboard?: OnScreenKeyboardConfig;
  theme?: HudTheme;
  cinema?: CinemaHud;
  countdown?: number;
  reticle?: boolean;
  map?: HudMap;
  grid?: HudGrid;
  slots?: HudSlot[];
  wheel?: HudWheel;
  damageDirection?: -1 | 0 | 1;
  style?: 'floating';
  noticeIcon?: string;
  heading?: string;
  textScale?: 1 | 2;
  meters: HudMeter[];
  objective: string;
  detail: string;
  prompt: string;
  notice: string;
  panel: HudPanel | null;
}
export interface HudMap {
  current: string;
  expanded: boolean;
  nodes: Array<{id:string;label:string;x:number;y:number;visited:boolean;locked:boolean}>;
  links: Array<{from:string;to:string;shortcut?:boolean}>;
}

export function validateHud(value: unknown, sprites: Record<string, Sprite> = {}): GameHud {
  if (!value || typeof value !== 'object') throw new Error('Pixel-3d ui must be a HUD object');
  const hud = value as GameHud;
  if ((hud.keyboard || hud.buttons || hud.callout) && hud.style !== 'floating') throw new Error('Pixel-3d keyboard, buttons and callouts require a floating HUD');
  if (hud.keyboard !== undefined) validateKeyboard(hud.keyboard);
  if (hud.buttons !== undefined && (!Array.isArray(hud.buttons) || hud.buttons.length > 8 ||
      hud.buttons.some(b => !b || !['menu', 'feed', 'fish', 'sound', 'flower', 'critter'].includes(b.icon) ||
        !['top-right', 'bottom-left'].includes(b.anchor) || typeof b.label !== 'string' || !b.label ||
        typeof b.action !== 'string' || !b.action ||
        (b.offset !== undefined && (!Number.isInteger(b.offset) || b.offset < 0 || b.offset > 640)) ||
        (b.size !== undefined && (!Number.isInteger(b.size) || b.size < 24 || b.size > 64)) ||
        (b.disabled !== undefined && typeof b.disabled !== 'boolean') ||
        (b.selected !== undefined && typeof b.selected !== 'boolean')))) throw new Error('Pixel-3d HUD buttons need valid icons, anchors, actions and bounded sizes');
  if (hud.callout !== undefined) {
    const c = hud.callout;
    if (!c || typeof c.title !== 'string' || !Array.isArray(c.lines) || c.lines.length > 6 ||
        !c.lines.every(line => typeof line === 'string') || !c.target ||
        ![c.target.x, c.target.y, c.target.z].every(Number.isFinite) ||
        (c.screen !== undefined && (!c.screen || ![c.screen.x, c.screen.y].every(Number.isFinite))) ||
        (c.dismissAction !== undefined && (typeof c.dismissAction !== 'string' || !c.dismissAction)) ||
        (c.width !== undefined && (!Number.isInteger(c.width) || c.width < 140 || c.width > 400)) ||
        !Array.isArray(c.actions) || c.actions.length > 3 ||
        !c.actions.every(a => a && typeof a.label === 'string' && typeof a.action === 'string' && a.action)) {
      throw new Error('Pixel-3d HUD callout needs a world target, text and up to three actions');
    }
  }
  if (hud.theme !== undefined) {
    const theme = hud.theme;
    if (!theme || typeof theme !== 'object' || Array.isArray(theme) ||
        Object.entries(theme).some(([key, color]) => key === 'radius'
          ? !Number.isInteger(color) || color < 0 || color > 12
          : !['background', 'surface', 'selected', 'border', 'text', 'muted', 'accent', 'focus'].includes(key) ||
            !Number.isInteger(color) || color < 0 || color > 0xffffff)) {
      throw new Error('HUD theme needs RGB integer colors and an optional radius from 0 to 12');
    }
  }
  if(hud.cinema){
    const c=hud.cinema;
    if(!Array.isArray(c.lines)||c.lines.length>64||!c.lines.every(line=>typeof line==='string'&&line.length<=80)||
      !Number.isFinite(c.offset)||Math.abs(c.offset)>10000||![1,2].includes(c.scale??2)||
      !Number.isFinite(c.top??.55)||!Number.isFinite(c.bottom??.94)||(c.top??.55)<0||(c.bottom??.94)>1||(c.top??.55)>=(c.bottom??.94)||
      !Number.isFinite(c.spacing??18)||(c.spacing??18)<12||(c.spacing??18)>48||!Number.isFinite(c.fade??0)||(c.fade??0)<0||(c.fade??0)>1)throw new Error('HUD cinema needs bounded text, scroll offset, viewport, scale and fade');
  }
  if (hud.damageDirection !== undefined && ![-1,0,1].includes(hud.damageDirection)) throw new Error('HUD damageDirection must be -1, 0 or 1');
  if (hud.map !== undefined) {
    const map = hud.map;
    if (!map || typeof map.current !== 'string' || typeof map.expanded !== 'boolean' ||
        !Array.isArray(map.nodes) || map.nodes.length > 24 || !Array.isArray(map.links) || map.links.length > 48 ||
        !map.nodes.every(n=>n && typeof n.id==='string' && typeof n.label==='string' &&
          Number.isFinite(n.x) && n.x>=0 && n.x<=100 && Number.isFinite(n.y) && n.y>=0 && n.y<=100 &&
          typeof n.visited==='boolean' && typeof n.locked==='boolean') ||
        new Set(map.nodes.map(n=>n.id)).size !== map.nodes.length ||
        !map.nodes.some(n=>n.id===map.current) ||
        !map.links.every(l=>l && (l.shortcut===undefined || typeof l.shortcut==='boolean') && map.nodes.some(n=>n.id===l.from) && map.nodes.some(n=>n.id===l.to))) throw new Error('HUD map needs unique positioned nodes, valid links and a current room');
  }
  if (hud.style !== undefined && hud.style !== 'floating') throw new Error('Pixel-3d ui style must be floating');
  if (hud.reticle !== undefined && typeof hud.reticle !== 'boolean') throw new Error('HUD reticle must be a boolean');
  if (hud.countdown !== undefined &&
      (hud.style !== 'floating' || !Number.isFinite(hud.countdown) || hud.countdown < 0 || hud.countdown > 3599)) {
    throw new Error('Pixel-3d countdown needs floating HUD style and seconds from 0 to 3599');
  }
  if (hud.heading !== undefined && typeof hud.heading !== 'string') throw new Error('Pixel-3d ui heading must be a string');
  if (hud.textScale !== undefined && hud.textScale !== 1 && hud.textScale !== 2) {
    throw new Error('Pixel-3d ui textScale must be 1 or 2');
  }
  if (!Array.isArray(hud.meters) || hud.meters.length > 3 ||
      !hud.meters.every(m => m && typeof m.label === 'string' && Number.isFinite(m.value) &&
        Number.isFinite(m.max) && m.max > 0 && Number.isInteger(m.color) && m.color >= 0 && m.color <= 0xffffff &&
        (m.showValue === undefined || typeof m.showValue === 'boolean') &&
        (m.display === undefined || ['counter', 'pips', 'bar'].includes(m.display)) &&
        (m.display !== 'pips' || (Number.isInteger(m.max) && m.max <= 16 && m.icon !== undefined && m.emptyIcon !== undefined))) ||
      !['objective', 'detail', 'prompt', 'notice'].every(k => typeof Reflect.get(hud, k) === 'string')) {
    throw new Error('Pixel-3d ui needs up to three valid meters and objective/detail/prompt/notice strings');
  }
  for (const name of [hud.noticeIcon, ...hud.meters.flatMap(m => [m.icon, m.emptyIcon])]) {
    if (name === undefined) continue;
    if (typeof name !== 'string' || !name || !Object.prototype.hasOwnProperty.call(sprites, name)) {
      throw new Error(`Pixel-3d ui references unknown sprite: ${String(name)}`);
    }
  }
  if (hud.panel !== null) {
    const p = hud.panel;
    if (!p || !['title', 'body', 'footer'].every(k => typeof Reflect.get(p, k) === 'string') ||
        !Array.isArray(p.choices) || p.choices.length > 5 || !p.choices.every(c => typeof c === 'string') ||
        !Number.isInteger(p.selected) || p.selected < 0 || p.selected >= Math.max(1, p.choices.length)) {
      throw new Error('Pixel-3d ui panel needs title/body/footer, up to five choices, and a valid selected index');
    }
  }
  if (hud.grid !== undefined) {
    const g = hud.grid;
    if (!g || (g.layout !== undefined && g.layout !== 'sidebar') ||
        !Number.isInteger(g.columns) || g.columns < 1 || g.columns > 8 ||
        !Array.isArray(g.items) || g.items.length > 24 ||
        (g.layout === 'sidebar' && (g.columns !== 1 || g.items.length > 10)) ||
        (g.textScale !== undefined && g.textScale !== 1 && g.textScale !== 2) ||
        (g.closeOnActivate !== undefined && (typeof g.closeOnActivate !== 'boolean' || g.layout !== 'sidebar' || (g.closeOnActivate && !g.dismissAction))) ||
        Object.entries({ width: g.width, rowHeight: g.rowHeight, gap: g.gap, padding: g.padding })
          .some(([key, n]) => n !== undefined && (!Number.isInteger(n) || n < (key === 'gap' ? 0 : key === 'padding' ? 4 : key === 'width' ? 120 : 18) ||
            n > (key === 'width' ? 640 : key === 'rowHeight' ? 64 : 24))) ||
        ['subtitle', 'dismissAction', 'moveAction'].some(key => {
          const entry = Reflect.get(g, key);
          return entry !== undefined && (typeof entry !== 'string' || (key !== 'subtitle' && !entry));
        }) ||
        ((g.dismissAction !== undefined || g.moveAction !== undefined) && g.layout !== 'sidebar') ||
        !g.items.every(it => it && typeof it.label === 'string')) {
      throw new Error('Pixel-3d ui grid needs columns (1-8) and up to 24 labeled items');
    }
  }
  if (hud.slots !== undefined) {
    if (!Array.isArray(hud.slots) || hud.slots.length > 12 ||
        !hud.slots.every(s => s && typeof s.label === 'string' && Number.isInteger(s.color) && s.color >= 0 && s.color <= 0xffffff)) {
      throw new Error('Pixel-3d ui slots needs up to 12 slots with label and color');
    }
  }
  if (hud.wheel !== undefined && hud.wheel !== null) {
    const w = hud.wheel;
    if (!w || !Array.isArray(w.items) || w.items.length > 12 ||
        !w.items.every(it => it && typeof it.label === 'string' && Number.isInteger(it.color) && it.color >= 0 && it.color <= 0xffffff)) {
      throw new Error('Pixel-3d ui wheel needs up to 12 items with label and color');
    }
  }
  return hud;
}

export interface CanvasHud {
  width: number;
  height: number;
  rect(x: number, y: number, w: number, h: number, color: number): void;
  text(text: string, x: number, y: number, color?: number, scale?: number, clip?: {top:number;bottom:number}): void;
}

export function wrapText(text: string, columns: number): string[] {
  if (!Number.isInteger(columns) || columns < 1) throw new Error('HUD wrap columns must be a positive integer');
  const lines: string[] = [];
  for (const paragraph of text.split('|')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      if (line && line.length + word.length + 1 > columns) { lines.push(line); line = ''; }
      let rest = word;
      while (rest.length > columns) {
        if (line) { lines.push(line); line = ''; }
        lines.push(rest.slice(0, columns)); rest = rest.slice(columns);
      }
      line += (line ? ' ' : '') + rest;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function floatingPanelLayout(width: number, height: number, ui: GameHud, status: string, top: number) {
  const p = ui.panel!;
  const maxWidth = status === 'title' ? 320 : status === 'playing' ? 360 : width - 48;
  const bw = Math.min(width - 32, Math.max(180, maxWidth));
  const panelColumns = Math.max(1, Math.floor((bw - 20) / 4));
  const body = wrapText(p.body, panelColumns).slice(0, 4);
  const bh = 38 + body.length * 9 + p.choices.length * 13;
  const bx = Math.floor((width - bw) / 2);
  const y = status === 'title'
    ? Math.max(top + 28, height - bh - 28)
    : p.choices.length <= 1
      ? Math.max(top + 8, Math.floor(height * 0.16))
      : Math.max(top + 28, Math.floor((height - bh - 12) / 2));
  return { panelColumns, body, bh, bw, bx, y };
}

/** Pixel icons and outlined lettering float directly over the world, in every host. */
function renderFloatingHud(canvas: CanvasHud, ui: GameHud, status: string, paused: boolean, sprites: Record<string, Sprite>): void {
  const W = canvas.width, H = canvas.height, ink = ui.theme?.background ?? 0x172b3d, gold = ui.theme?.accent ?? 0xffda85;
  const text = (value: string, x: number, y: number, color = ui.theme?.text ?? 0xffffff, scale = 1) => {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) canvas.text(value, x + dx, y + dy, ink, scale);
    canvas.text(value, x, y, color, scale);
  };
  const asset = (name: string): Sprite => {
    if (!Object.prototype.hasOwnProperty.call(sprites, name)) throw new Error(`Pixel-3d ui references unknown sprite: ${name}`);
    return sprites[name];
  };
  const icon = (name: string, x: number, y: number, scale = 2) => {
    const sprite = asset(name);
    for (let sy = 0; sy < sprite.height; sy++) for (let sx = 0; sx < sprite.width; sx++) {
      const color = sprite.colors[sprite.pixels[sy * sprite.width + sx]];
      if (color !== null && color !== undefined) canvas.rect(x + sx * scale, y + sy * scale, scale, scale, color);
    }
  };
  let metersBottom = 32;
  let meterOffset = 0, splitMeters = false;
  if (ui.countdown !== undefined) {
    const remaining = ui.countdown;
    const seconds = Math.ceil(remaining);
    const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const pulse = remaining <= 10 ? .5 + .5 * Math.cos(remaining * 2 * Math.PI) : 0;
    const desiredScale = remaining > 20 ? 3 : pulse > .58 ? 5 : 4;
    const scale = Math.min(desiredScale, Math.max(1, Math.floor((W - 16) / (4 * clock.length - 1))));
    const width = (4 * clock.length - 1) * scale;
    const x = Math.floor((W - width) / 2), bottom = 13 + 5 * scale;
    const color = remaining > 10 ? 0xffe3a6 : 0xff0000 | Math.floor(78 + 79 * pulse) << 8 | Math.floor(94 + 67 * pulse);
    canvas.rect(x - 7, 4, width + 14, bottom - 4, 0x090418);
    canvas.rect(x - 7, bottom, width + 14, 2, color);
    text(clock, x, 8, color, scale);
    splitMeters = ui.meters.length <= 2 && Math.floor((W - 16) / 3) >= width + 18;
    if (!splitMeters) meterOffset = bottom + 3;
    metersBottom = Math.max(bottom + 2, 32 + meterOffset);
  }
  const slot = Math.floor((W - 16) / (splitMeters ? 3 : Math.max(1, ui.meters.length)));
  ui.meters.forEach((meter, i) => {
    const x = splitMeters && i === 1 ? W - 8 - slot : 8 + i * slot;
    const columns = Math.max(1, Math.floor((slot - 4) / 4));
    const iconTop = meterOffset + (meter.label ? 14 : 8);
    if (meter.label) text(meter.label.slice(0, columns), x, meterOffset + 6, gold);
    if (meter.display === 'pips') {
      const full = asset(meter.icon!), empty = asset(meter.emptyIcon!);
      const count = Math.ceil(meter.max), pipWidth = Math.max(full.width, empty.width);
      const scale = slot >= count * (pipWidth * 2 + 3) ? 2 : 1;
      const perRow = Math.max(1, Math.floor((slot - 1) / (scale * pipWidth + 3)));
      const rowHeight = scale * Math.max(full.height, empty.height) + 3;
      for (let pip = 0; pip < count; pip++) icon(pip < Math.ceil(meter.value) ? meter.icon! : meter.emptyIcon!, x + pip % perRow * (scale * pipWidth + 3), iconTop + Math.floor(pip / perRow) * rowHeight, scale);
      metersBottom = Math.max(metersBottom, iconTop + Math.ceil(count / perRow) * rowHeight);
    } else {
      if (meter.icon) icon(meter.icon, x, iconTop);
      const left = x + (meter.icon ? asset(meter.icon).width * 2 + 7 : 0);
      if (meter.showValue !== false) {
        const number = `${Math.max(0, Math.ceil(meter.value))}/${Math.ceil(meter.max)}`;
        const scale = number.length * 8 <= slot - (left - x) - 4 ? 2 : 1;
        text(number, left, iconTop + 4, 0xfff2cf, scale);
      }
      if (meter.display === 'bar') {
        const barWidth = Math.max(0, slot - (left - x) - 4);
        const fill = Math.max(0, Math.min(1, meter.value / meter.max));
        if (meter.showValue === false) {
          const width = Math.min(48, barWidth);
          canvas.rect(left, iconTop + 9, width, 4, ink);
          canvas.rect(left + 1, iconTop + 10, Math.floor(Math.max(0, width - 2) * fill), 2, meter.color);
        } else {
          canvas.rect(left, iconTop + 16, barWidth, 2, ink);
          canvas.rect(left, iconTop + 16, Math.floor(barWidth * fill), 2, meter.color);
        }
      }
    }
  });
  const columns = Math.max(1, Math.floor((W - 16) / 4));
  const top = ui.meters.length ? Math.max(39, metersBottom + 5) : 8;
  if (ui.detail) text(ui.detail.slice(0, columns), 8, top, ui.theme?.muted ?? 0xbcebdc);
  if (ui.objective) text(ui.objective.slice(0, columns), 8, top + 10, gold);
  if (ui.heading && (status !== 'playing' || paused)) {
    const heading = ui.heading.slice(0, Math.max(1, Math.floor((W - 32) / 8)));
    text(heading, Math.floor((W - heading.length * 8) / 2), top + 26, gold, 2);
  }
  if (ui.panel) {
    const p = ui.panel;
    const { panelColumns, body, bh, bw, bx, y } = floatingPanelLayout(W, H, ui, status, top);
    canvas.rect(bx, y, bw, bh, 0x090418);
    canvas.rect(bx, y, bw, 2, 0xff1e9b);
    canvas.rect(bx, y + bh - 2, bw, 2, 0x00f5ff);
    canvas.rect(bx, y, 2, bh, 0x00f5ff);
    canvas.rect(bx + bw - 2, y, 2, bh, 0xff1e9b);
    text(p.title.slice(0, panelColumns), bx + 10, y + 7, gold);
    body.forEach((line, i) => text(line, bx + 10, y + 18 + i * 9, 0xe3eee9));
    p.choices.forEach((choice, i) => {
      const cy = y + 22 + body.length * 9 + i * 13;
      if (i === p.selected) canvas.rect(bx + 8, cy - 2, bw - 16, 10, 0x2a1454);
      text(`${i === p.selected ? '>' : ' '} ${choice}`.slice(0, panelColumns), bx + 10, cy, i === p.selected ? 0x00f5ff : 0xe3eee9);
    });
    if (p.footer) text(p.footer.slice(0, panelColumns), bx + 10, y + bh - 11, 0x8af1cf);
  } else if (ui.grid) {
    renderHudGrid(canvas, ui.grid, W, H, top, text, ui.theme);
  } else if (ui.notice) {
    const lines = wrapText(ui.notice, columns - 5).slice(0, 2);
    const y = top + 25;
    if (ui.noticeIcon) icon(ui.noticeIcon, 8, y - 2, 1);
    const left = ui.noticeIcon ? 8 + asset(ui.noticeIcon).width + 6 : 8;
    lines.forEach((line, i) => text(line, left, y + i * 9, gold));
  }
  if (ui.wheel && ui.wheel.active !== false && ui.wheel.items && ui.wheel.items.length > 0 && !ui.panel && !ui.grid) {
    renderHudWheel(canvas, ui.wheel, W, H, text);
  } else if (ui.slots && ui.slots.length > 0 && !ui.panel && !ui.grid) {
    renderHudSlots(canvas, ui.slots, W, H, text, ui.theme);
  }
  if (ui.prompt) text(ui.prompt.slice(0, columns), 8, H - 12, ui.theme?.muted ?? 0xe3eee9);
}

function gridLayout(grid: HudGrid, W: number, H: number) {
  const cols = Math.max(1, grid.columns);
  const rows = Math.max(1, Math.ceil(grid.items.length / cols));
  const sidebar = grid.layout === 'sidebar';
  if (sidebar) {
    const padding = grid.padding ?? 10, margin = 10, gap = grid.gap ?? 4;
    const panelW = Math.min(grid.width ?? 220, W - margin * 2);
    const panelX = W - margin - panelW, padX = panelX + padding;
    const headerH = (grid.title ? (grid.textScale ?? 1) * 5 + 12 : 4) + (grid.subtitle ? 13 : 0);
    const footerH = grid.footer ? 18 : 4;
    const available = H - margin * 2 - padding * 2 - headerH - footerH - (rows - 1) * gap;
    const cellH = Math.max(1, Math.min(grid.rowHeight ?? 24, Math.floor(available / rows)));
    const totalH = padding * 2 + headerH + rows * cellH + (rows - 1) * gap + footerH;
    const y0 = Math.max(margin, Math.floor((H - totalH) / 2));
    return { cols, rows, padX, gap, cellW: panelW - padding * 2, cellH,
      headerH: headerH + padding, footerH, totalH, y0, panelW, panelX, padding };
  }
  const panelW = W - 16;
  const padX = 12, gap = 4;
  const cellW = Math.floor((W - padX * 2 - gap * (cols - 1)) / cols);
  const cellH = rows <= 2 ? 22 : 18;
  const headerH = grid.title ? 12 : 4;
  const footerH = grid.footer ? 11 : 4;
  const totalH = headerH + rows * cellH + (rows - 1) * gap + footerH + 6;
  const y0 = Math.max(44, H - totalH - 16);
  return { cols, rows, padX, gap, cellW, cellH, headerH, footerH, totalH, y0, panelW, panelX: padX - 4, padding: 4 };
}

export function roundedRect(canvas: CanvasHud, x: number, y: number, w: number, h: number, radius: number, color: number): void {
  const r = Math.max(0, Math.min(radius, Math.floor(w / 2), Math.floor(h / 2)));
  canvas.rect(x + r, y, w - r * 2, h, color);
  canvas.rect(x, y + r, w, h - r * 2, color);
  for (let row = 0; row < r; row++) {
    const inset = Math.ceil(r - Math.sqrt(r * r - (r - row - .5) ** 2));
    canvas.rect(x + inset, y + row, w - inset * 2, 1, color);
    canvas.rect(x + inset, y + h - row - 1, w - inset * 2, 1, color);
  }
}

function buttonLayout(button: HudButton, W: number, H: number) {
  const size = button.size ?? 30, offset = button.offset ?? 0;
  return { x: button.anchor === 'top-right' ? W - 10 - size - offset : 10 + offset,
    y: button.anchor === 'top-right' ? 10 : H - 10 - size, w: size, h: size };
}

export function hudButtonAt(ui: GameHud | undefined, width: number, height: number, x: number, y: number): boolean {
  return (ui?.buttons ?? []).some(button => {
    const box = buttonLayout(button, width, height);
    return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
  });
}

function calloutLayout(callout: HudCallout, W: number) {
  return { x: 10, y: 44, w: Math.min(callout.width ?? 240, W - 20),
    h: 42 + callout.lines.length * 12 + (callout.actions.length ? 30 : 0) };
}

function renderWidgets(canvas: CanvasHud, ui: GameHud): void {
  const theme = ui.theme;
  const ink = theme?.text ?? 0xf1fbf7, accent = theme?.accent ?? 0x7ce4cc;
  for (const button of ui.buttons ?? []) {
    const { x, y, w, h } = buttonLayout(button, canvas.width, canvas.height);
    const color = button.disabled ? theme?.muted ?? 0xa2bdc7 : accent;
    roundedRect(canvas, x, y, w, h, theme?.radius ?? 6, color);
    roundedRect(canvas, x + 1, y + 1, w - 2, h - 2, theme?.radius ?? 6, theme?.surface ?? 0x18394a);
    const cx = Math.floor(x + w / 2), cy = Math.floor(y + h / 2);
    if (button.icon === 'menu') {
      for (const dy of [-5, 0, 5]) canvas.rect(cx - 7, cy + dy, 14, 2, color);
    } else if (button.icon === 'feed') {
      canvas.rect(cx - 7, cy + 2, 14, 3, color);
      canvas.rect(cx - 5, cy + 5, 10, 3, color);
      for (const [dx, dy] of [[-4, -6], [3, -4], [-1, -1]]) canvas.rect(cx + dx, cy + dy, 2, 2, 0xffe076);
    } else if (button.icon === 'fish') {
      roundedRect(canvas, cx - 8, cy - 4, 13, 9, 4, color);
      canvas.rect(cx + 5, cy - 5, 3, 11, color);
      canvas.rect(cx - 5, cy - 1, 2, 2, theme?.background ?? 0x0d2233);
    } else if (button.icon === 'flower') {
      canvas.rect(cx - 1, cy, 2, 9, color);
      canvas.rect(cx + 1, cy + 4, 5, 2, color);
      for (const [dx, dy] of [[-5, -4], [2, -4], [-2, -8], [-2, -1]]) {
        roundedRect(canvas, cx + dx, cy + dy, 5, 5, 2, color);
      }
      canvas.rect(cx - 1, cy - 4, 3, 3, 0xffe076);
    } else if (button.icon === 'critter') {
      roundedRect(canvas, cx - 5, cy - 3, 10, 7, 3, color);
      for (const dx of [-7, 5]) {
        canvas.rect(cx + dx, cy - 6, 2, 5, color);
        for (const dy of [0, 4, 7]) canvas.rect(cx + dx, cy + dy, 3, 1, color);
      }
      canvas.rect(cx - 3, cy - 2, 1, 1, ink);
      canvas.rect(cx + 2, cy - 2, 1, 1, ink);
    } else {
      canvas.rect(cx - 7, cy - 3, 4, 6, color);
      canvas.rect(cx - 3, cy - 6, 4, 12, color);
      canvas.rect(cx + 5, cy - 4, 2, 8, color);
      if (button.selected) canvas.rect(cx - 8, cy, 17, 2, ink);
    }
  }
  const callout = ui.callout;
  if (!callout) return;
  const { x, y, w, h } = calloutLayout(callout, canvas.width);
  if (callout.screen) {
    const tx = Math.max(0, Math.min(canvas.width - 1, Math.round(callout.screen.x)));
    const ty = Math.max(0, Math.min(canvas.height - 1, Math.round(callout.screen.y)));
    const sx = x + w, sy = y + h / 2, count = Math.ceil(Math.max(Math.abs(tx - sx), Math.abs(ty - sy)));
    for (let i = 0; i <= count; i++) canvas.rect(Math.round(sx + (tx - sx) * i / Math.max(1, count)),
      Math.round(sy + (ty - sy) * i / Math.max(1, count)), 1, 1, accent);
    canvas.rect(tx - 2, ty - 2, 5, 5, accent);
  }
  roundedRect(canvas, x, y, w, h, theme?.radius ?? 6, accent);
  roundedRect(canvas, x + 1, y + 1, w - 2, h - 2, theme?.radius ?? 6, theme?.background ?? 0x0d2233);
  canvas.text(callout.title.slice(0, Math.floor((w - 20) / 8)), x + 10, y + 10, ink, 2);
  callout.lines.forEach((line, i) => canvas.text(line.slice(0, Math.floor((w - 20) / 4)), x + 10, y + 29 + i * 12, theme?.muted ?? 0xa2bdc7));
  const buttonW = Math.floor((w - 20) / Math.max(1, callout.actions.length));
  callout.actions.forEach((a, i) => {
    canvas.rect(x + 10 + i * buttonW, y + h - 28, buttonW - 4, 20,
      callout.selected === i ? theme?.selected ?? 0x265765 : theme?.surface ?? 0x18394a);
    canvas.text(a.label.slice(0, Math.floor((buttonW - 10) / 4)), x + 14 + i * buttonW, y + h - 21, accent);
  });
}

function renderHudGrid(
  canvas: CanvasHud,
  grid: HudGrid,
  W: number,
  H: number,
  _top: number,
  text: (value: string, x: number, y: number, color?: number, scale?: number) => void,
  theme?: HudTheme
): void {
  const { cols, padX, gap, cellW, cellH, headerH, totalH, y0, panelW, panelX, padding } = gridLayout(grid, W, H);
  if (grid.layout === 'sidebar') {
    const colors = {
      background: 0x0d2233, surface: 0x18394a, selected: 0x265765,
      border: 0x365568, text: 0xf1fbf7, muted: 0xa2bdc7, accent: 0x7ce4cc, focus: 0xc3ffe8, ...theme,
    };
    const radius = theme?.radius ?? 5;
    roundedRect(canvas, panelX - 3, y0 + 4, panelW + 6, totalH, radius + 1, 0x07121e);
    roundedRect(canvas, panelX, y0, panelW, totalH, radius, colors.border);
    roundedRect(canvas, panelX + 1, y0 + 1, panelW - 2, totalH - 2, radius, colors.background);
    const labelScale = Math.min(grid.textScale ?? 1, cellH >= 28 ? 2 : 1);
    const closeW = grid.dismissAction ? 26 : 0;
    if (grid.title) text(grid.title.slice(0, Math.max(1, Math.floor((cellW - closeW) / (4 * labelScale)))),
      padX, y0 + padding + 2, colors.text, labelScale);
    if (grid.subtitle) text(grid.subtitle.slice(0, Math.floor(cellW / 4)), padX,
      y0 + padding + labelScale * 5 + 9, colors.accent);
    if (grid.dismissAction) {
      roundedRect(canvas, panelX + panelW - padding - 22, y0 + padding - 2, 22, 22, 4, colors.surface);
      text('X', panelX + panelW - padding - 14, y0 + padding + 5, colors.muted, 2);
    }
    grid.items.forEach((item, i) => {
      const x = padX, y = y0 + headerH + i * (cellH + gap);
      const focus = item.selected === true;
      roundedRect(canvas, x, y, cellW, cellH, radius, focus ? colors.focus : colors.surface);
      if (focus) roundedRect(canvas, x + 2, y + 2, cellW - 4, cellH - 4, Math.max(0, radius - 1), colors.selected);
      const accent = item.disabled ? colors.muted : item.color ?? colors.accent;
      canvas.rect(x + 7, y + 7, 2, Math.max(1, cellH - 14), accent);
      const left = x + 17, maxChars = Math.max(1, Math.floor((cellW - 27) / (4 * labelScale)));
      text(item.label.slice(0, maxChars), left, y + 6, item.disabled ? colors.muted : colors.text, labelScale);
      const sub = item.sub || item.badge;
      if (sub && cellH >= 22) text(sub.slice(0, Math.floor((cellW - 27) / 4)), left,
        y + 6 + labelScale * 5 + 5, item.disabled ? colors.muted : colors.accent);
    });
    if (grid.footer) text(grid.footer.slice(0, Math.floor(cellW / 4)), padX, y0 + totalH - padding - 7, colors.muted);
    return;
  }
  canvas.rect(padX - 4, y0, panelW, totalH, 0x090418);
  canvas.rect(padX - 4, y0, panelW, 1, 0x00f5ff);
  canvas.rect(padX - 4, y0 + totalH - 1, panelW, 1, 0xff1e9b);
  if (grid.title) {
    text(grid.title.slice(0, Math.floor((panelW - 8) / 4)), padX, y0 + 4, 0x00f5ff);
  }
  const maxChars = Math.max(1, Math.floor((cellW - 6) / 4));
  grid.items.forEach((item, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = padX + col * (cellW + gap);
    const y = y0 + headerH + row * (cellH + gap);
    const accent = item.color ?? 0x00f5ff;
    const bg = item.selected ? 0x26124d : item.disabled ? 0x0e081c : 0x130a29;
    const border = item.selected ? 0xffe600 : item.disabled ? 0x3b2c68 : accent;
    canvas.rect(x, y, cellW, cellH, bg);
    canvas.rect(x, y, cellW, 1, border);
    canvas.rect(x, y + cellH - 1, cellW, 1, border);
    canvas.rect(x, y, 1, cellH, border);
    canvas.rect(x + cellW - 1, y, 1, cellH, border);
    if (item.selected) canvas.rect(x + 1, y + 1, cellW - 2, 1, accent);
    const textColor = item.selected ? 0xffe600 : item.disabled ? 0x665299 : 0xf4f7ff;
    text(item.label.slice(0, maxChars), x + 3, y + 4, textColor);
    if (item.sub) {
      text(item.sub.slice(0, maxChars), x + 3, y + 12, item.selected ? 0x00f5ff : accent);
    } else if (item.badge) {
      text(item.badge.slice(0, maxChars), x + 3, y + 12, item.selected ? 0x00f5ff : accent);
    }
  });
  if (grid.footer) {
    text(grid.footer.slice(0, Math.floor((panelW - 8) / 4)), padX, y0 + totalH - 9, 0xffe600);
  }
}

function slotsLayout(slots: HudSlot[], W: number, H: number) {
  const gap = 3, margin = 8;
  const totalW = W - margin * 2;
  const slotW = Math.floor((totalW - gap * (slots.length - 1)) / slots.length);
  const slotH = 12;
  const y = H - 27;
  return { gap, margin, slotW, slotH, y };
}

function renderHudSlots(
  canvas: CanvasHud,
  slots: HudSlot[],
  W: number,
  H: number,
  text: (value: string, x: number, y: number, color?: number, scale?: number) => void,
  theme?: HudTheme
): void {
  const { gap, margin, slotW, slotH, y } = slotsLayout(slots, W, H);
  const maxChars = Math.max(1, Math.floor((slotW - 4) / 4));
  slots.forEach((slot, i) => {
    const x = margin + i * (slotW + gap);
    const bg = slot.selected ? theme?.selected ?? 0x26124d : slot.locked ? theme?.background ?? 0x090418 : theme?.surface ?? 0x130a29;
    const border = slot.selected ? theme?.focus ?? 0xffe600 : slot.locked ? theme?.border ?? 0x2c204d : theme?.border ?? slot.color;
    canvas.rect(x, y, slotW, slotH, bg);
    canvas.rect(x, y, slotW, 1, border);
    canvas.rect(x, y + slotH - 1, slotW, 1, border);
    canvas.rect(x, y, 1, slotH, border);
    canvas.rect(x + slotW - 1, y, 1, slotH, border);
    const labelColor = slot.selected ? theme?.focus ?? 0xffe600 : slot.locked ? theme?.muted ?? 0x52427a : theme?.text ?? slot.color;
    const label = slot.label.slice(0, maxChars);
    const tx = x + Math.max(2, Math.floor((slotW - label.length * 4) / 2));
    text(label, tx, y + 4, labelColor);
  });
}

function wheelLayout(wheel: HudWheel, W: number, H: number) {
  const items = wheel.items || [];
  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2) - 6;
  const radius = Math.min(88, Math.floor(H * 0.28));
  const itemW = 56;
  const itemH = 18;
  const hubW = 108;
  const hubH = 34;
  return { items, cx, cy, radius, itemW, itemH, hubW, hubH };
}

function renderHudWheel(
  canvas: CanvasHud,
  wheel: HudWheel,
  W: number,
  H: number,
  text: (value: string, x: number, y: number, color?: number, scale?: number) => void
): void {
  const { items, cx, cy, radius, itemW, itemH, hubW, hubH } = wheelLayout(wheel, W, H);
  if (!items.length) return;

  const bgPad = radius + 38;
  canvas.rect(cx - bgPad, cy - radius - 20, bgPad * 2, (radius + 20) * 2, 0x060312);
  canvas.rect(cx - bgPad, cy - radius - 20, bgPad * 2, 1, 0x1b113b);
  canvas.rect(cx - bgPad, cy + radius + 20 - 1, bgPad * 2, 1, 0x1b113b);
  canvas.rect(cx - bgPad, cy - radius - 20, 1, (radius + 20) * 2, 0x1b113b);
  canvas.rect(cx + bgPad - 1, cy - radius - 20, 1, (radius + 20) * 2, 0x1b113b);

  const selectedItem = items.find(it => it.selected) || items[0];

  // Draw radial connecting spokes
  items.forEach((item, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / items.length;
    const nx = Math.round(cx + Math.cos(angle) * radius);
    const ny = Math.round(cy + Math.sin(angle) * radius);
    const spokeColor = item.selected ? 0x00f5ff : (item.locked ? 0x190f33 : 0x373463);
    const steps = 8;
    for (let s = 2; s < steps; s++) {
      const t = s / steps;
      const sx = Math.round(cx + (nx - cx) * t);
      const sy = Math.round(cy + (ny - cy) * t);
      canvas.rect(sx, sy, 1, 1, spokeColor);
    }
  });

  // Center Hub
  const hubBorder = selectedItem ? (selectedItem.selected ? 0xffe600 : selectedItem.color) : 0x00f5ff;
  canvas.rect(cx - hubW / 2, cy - hubH / 2, hubW, hubH, 0x140b2b);
  canvas.rect(cx - hubW / 2, cy - hubH / 2, hubW, 1, hubBorder);
  canvas.rect(cx - hubW / 2, cy + hubH / 2 - 1, hubW, 1, hubBorder);
  canvas.rect(cx - hubW / 2, cy - hubH / 2, 1, hubH, hubBorder);
  canvas.rect(cx + hubW / 2 - 1, cy - hubH / 2, 1, hubH, hubBorder);
  if (selectedItem?.selected) {
    canvas.rect(cx - hubW / 2 + 1, cy - hubH / 2 + 1, hubW - 2, 1, 0x00f5ff);
  }

  const titleText = (wheel.title || 'WEAPON WHEEL').slice(0, 20);
  const titleX = cx - Math.floor((titleText.length * 4) / 2);
  text(titleText, titleX, cy - hubH / 2 + 3, 0x00f5ff);

  const selName = (selectedItem ? selectedItem.label : '').slice(0, 20);
  const selX = cx - Math.floor((selName.length * 4) / 2);
  text(selName, selX, cy - 2, 0xffe600);

  const subPrompt = '[TAB/Q/E] SELECT'.slice(0, 20);
  const subX = cx - Math.floor((subPrompt.length * 4) / 2);
  text(subPrompt, subX, cy + hubH / 2 - 9, 0x8af1cf);

  // Radial Item Badges
  const maxChars = Math.max(1, Math.floor((itemW - 4) / 4));
  items.forEach((item, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / items.length;
    const nx = Math.round(cx + Math.cos(angle) * radius);
    const ny = Math.round(cy + Math.sin(angle) * radius);
    const x = nx - Math.floor(itemW / 2);
    const y = ny - Math.floor(itemH / 2);

    const bg = item.selected ? 0x2e1859 : item.locked ? 0x0a0517 : 0x140b2b;
    const border = item.selected ? 0xffe600 : item.locked ? 0x2c204d : item.color;
    canvas.rect(x, y, itemW, itemH, bg);
    canvas.rect(x, y, itemW, 1, border);
    canvas.rect(x, y + itemH - 1, itemW, 1, border);
    canvas.rect(x, y, 1, itemH, border);
    canvas.rect(x + itemW - 1, y, 1, itemH, border);
    if (item.selected) {
      canvas.rect(x + 1, y + 1, itemW - 2, 1, 0x00f5ff);
      canvas.rect(x - 2, y - 2, itemW + 4, 1, 0xffe600);
      canvas.rect(x - 2, y + itemH + 1, itemW + 4, 1, 0xffe600);
    }
    const labelColor = item.selected ? 0xffe600 : item.locked ? 0x554477 : item.color;
    const label = item.label.slice(0, maxChars);
    const tx = x + Math.max(2, Math.floor((itemW - label.length * 4) / 2));
    text(label, tx, y + 3, labelColor);

    const sub = item.locked ? 'LOCKED' : (item.sub || (item.selected ? 'EQUIPPED' : 'READY'));
    const subColor = item.selected ? 0x00f5ff : item.locked ? 0x3d3059 : 0x8af1cf;
    const sx = x + Math.max(2, Math.floor((itemW - sub.slice(0, maxChars).length * 4) / 2));
    text(sub.slice(0, maxChars), sx, y + 10, subColor);
  });
}

export function collectHudHitRegions(
  width: number,
  height: number,
  ui: GameHud | undefined,
  status: string,
  paused: boolean
): HudHitRegion[] {
  if (!ui) return [];
  const regions: HudHitRegion[] = [];
  for (const button of ui.buttons ?? []) {
    if (!button.disabled) regions.push({ ...buttonLayout(button, width, height), action: button.action, args: [] });
  }
  if (ui.callout) {
    const c = ui.callout, { x, y, w, h } = calloutLayout(c, width);
    const bw = Math.floor((w - 20) / Math.max(1, c.actions.length));
    c.actions.forEach((a, i) => regions.push({ x: x + 10 + i * bw, y: y + h - 28, w: bw - 4, h: 20, action: a.action, args: [] }));
    if (c.dismissAction) {
      for (const [rx, ry, rw, rh] of [[0, 0, x, height], [x + w, 0, width - x - w, height],
        [x, 0, w, y], [x, y + h, w, height - y - h]]) {
        if (rw > 0 && rh > 0) regions.push({ x: rx, y: ry, w: rw, h: rh, action: c.dismissAction, args: [] });
      }
    }
    return regions;
  }
  if (ui.panel && ui.panel.choiceActions?.length) {
    const p = ui.panel;
    const top = ui.meters.length ? 44 : 8;
    const { body, bw, bx, y } = floatingPanelLayout(width, height, ui, status, top);
    p.choices.forEach((_, i) => {
      const ca = p.choiceActions?.[i];
      if (!ca) return;
      const cy = y + 22 + body.length * 9 + i * 13;
      regions.push({ x: bx + 8, y: cy - 3, w: bw - 16, h: 12, action: ca.action, args: ca.args ?? [] });
    });
  } else if (ui.grid) {
    const { cols, padX, gap, cellW, cellH, headerH, y0, panelW, panelX, totalH, padding } = gridLayout(ui.grid, width, height);
    ui.grid.items.forEach((item, i) => {
      if (!item.action || item.disabled) return;
      const col = i % cols, row = Math.floor(i / cols);
      regions.push({
        x: padX + col * (cellW + gap),
        y: y0 + headerH + row * (cellH + gap),
        w: cellW,
        h: cellH,
        action: item.action,
        args: item.args ?? [],
      });
    });
    if (ui.grid.layout === 'sidebar') {
      const action = ui.grid.dismissAction;
      if (action) {
        regions.push({ x: panelX + panelW - padding - 22, y: y0 + padding - 2, w: 22, h: 22, action, args: [] });
        for (const [x, y, w, h] of [
          [0, 0, panelX, height], [panelX + panelW, 0, width - panelX - panelW, height],
          [panelX, 0, panelW, y0], [panelX, y0 + totalH, panelW, height - y0 - totalH],
        ]) if (w > 0 && h > 0) regions.push({ x, y, w, h, action, args: [] });
      }
      return regions;
    }
  }
  if (ui.wheel && ui.wheel.active !== false && ui.wheel.items && ui.wheel.items.length > 0 && status === 'playing' && !paused) {
    const { items, cx, cy, radius, itemW, itemH } = wheelLayout(ui.wheel, width, height);
    items.forEach((item, i) => {
      if (!item.action || item.locked) return;
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / items.length;
      const nx = Math.round(cx + Math.cos(angle) * radius);
      const ny = Math.round(cy + Math.sin(angle) * radius);
      regions.push({
        x: nx - Math.floor(itemW / 2),
        y: ny - Math.floor(itemH / 2),
        w: itemW,
        h: itemH,
        action: item.action,
        args: item.args ?? [],
      });
    });
  } else if (ui.slots && ui.slots.length > 0 && status === 'playing' && !paused) {
    const { gap, margin, slotW, slotH, y } = slotsLayout(ui.slots, width, height);
    ui.slots.forEach((slot, i) => {
      if (!slot.action || slot.locked) return;
      regions.push({
        x: margin + i * (slotW + gap),
        y,
        w: slotW,
        h: slotH,
        action: slot.action,
        args: slot.args ?? [],
      });
    });
  }
  return regions;
}

export function renderHud(canvas: CanvasHud, ui: GameHud, status: string, paused: boolean, sprites: Record<string, Sprite> = {}): void {
  if(ui.cinema){
    const c=ui.cinema,W=canvas.width,H=canvas.height,scale=c.scale??2;
    canvas.rect(0,0,W,Math.floor(H*.1),0x030713);
    canvas.rect(0,Math.floor(H*.96),W,H,0x030713);
    const centered=(line:string,y:number,color:number,size=1,clip?:{top:number;bottom:number})=>canvas.text(line,Math.floor((W-(line.length*4-1)*size)/2),y,color,size,clip);
    if(ui.heading)centered(ui.heading,10,0x9ceadd);
    const clip={top:Math.floor(H*(c.top??.55)),bottom:Math.floor(H*(c.bottom??.94))};
    c.lines.forEach((line,i)=>{
      const y=Math.floor(clip.bottom-c.offset+i*(c.spacing??18));
      if(y+5*scale>clip.top&&y<clip.bottom)centered(line,y,0xe4eee9,scale,clip);
    });
    if(ui.prompt)centered(ui.prompt,H-8,0x8dabb8);
    return;
  }

  if (ui.reticle && status === 'playing' && !paused) {
    const x = Math.floor(canvas.width / 2), y = Math.floor(canvas.height / 2);
    canvas.rect(x - 7, y - 1, 5, 3, 0x09101c);
    canvas.rect(x + 3, y - 1, 5, 3, 0x09101c);
    canvas.rect(x - 1, y - 7, 3, 5, 0x09101c);
    canvas.rect(x - 1, y + 3, 3, 5, 0x09101c);
    canvas.rect(x - 6, y, 3, 1, 0xb9f5ff);
    canvas.rect(x + 4, y, 3, 1, 0xb9f5ff);
    canvas.rect(x, y - 6, 1, 3, 0xb9f5ff);
    canvas.rect(x, y + 4, 1, 3, 0xb9f5ff);
  }
  if (ui.damageDirection && status === 'playing' && !paused) {
    const x=ui.damageDirection<0?4:canvas.width-8, y=Math.floor(canvas.height*.55);
    canvas.rect(x,y-13,4,26,0xf06b82);
    canvas.rect(x+(ui.damageDirection<0?4:-4),y-7,4,14,0xffc187);
  }
  if (ui.map) renderMap(canvas,ui.map);
  if (ui.style === 'floating') {
    renderFloatingHud(canvas, ui, status, paused, sprites);
    renderWidgets(canvas, ui);
    return;
  }
  if (ui.textScale === 2) {
    renderLargeHud(canvas, ui, status, paused);
    return;
  }
  const W = canvas.width, H = canvas.height;
  const columns = Math.max(1, Math.floor((W - 12) / 4));
  const panelColumns = Math.max(1, Math.floor((W - 48) / 4));
  const width = Math.floor((W - 16) / Math.max(1, ui.meters.length));
  const topHeight = ui.detail ? 25 : (ui.meters.length ? 18 : 0);
  if (topHeight) canvas.rect(0, 0, W, topHeight, 0x0b111b);
  ui.meters.forEach((m, i) => {
    const x = 6 + i * width;
    canvas.text(`${m.label} ${Math.ceil(m.value)}/${Math.ceil(m.max)}`, x, 3, m.color);
    canvas.rect(x, 11, width - 6, 5, 0x273445);
    canvas.rect(x, 11, Math.floor((width - 6) * Math.max(0, Math.min(1, m.value / m.max))), 5, m.color);
  });
  canvas.text(ui.detail.slice(0, columns), 6, 19, 0xb5c9de);
  if (ui.objective) {
    canvas.rect(0, topHeight, W, 11, 0x172133);
    canvas.text(ui.objective.slice(0, columns), 6, topHeight + 3, 0xf2d58a);
  }
  const heading = (status !== 'playing' || paused) && ui.heading ? ui.heading.slice(0, Math.max(1, Math.floor((W - 32) / 12))) : '';
  if (heading) {
    canvas.rect(16, 40, W - 32, 26, 0x0b111b);
    canvas.text(heading, Math.floor((W - heading.length * 12) / 2), 44, 0xf2d58a, 3);
  }

  function renderLargeHud(canvas: CanvasHud, ui: GameHud, status: string, paused: boolean): void {
    const W = canvas.width, H = canvas.height;
    const columns = Math.max(1, Math.floor((W - 12) / 8));
    const text = (value: string, x: number, y: number, color = 0xffffff) =>
      canvas.text(value, x, y, color, 2);
    let top = 0;
    if (ui.meters.length) {
      const width = Math.floor((W - 12) / ui.meters.length);
      canvas.rect(0, 0, W, 23, 0x0b111b);
      ui.meters.forEach((meter, i) => {
        const x = 6 + i * width;
        const label = `${meter.label} ${Math.ceil(meter.value)}/${Math.ceil(meter.max)}`;
        const available = Math.max(1, Math.floor((width - 6) / 8));
        const short = `${meter.label.slice(0, 1)} ${Math.ceil(meter.value)}/${Math.ceil(meter.max)}`;
        text((label.length <= available ? label : short).slice(0, available), x, 3, meter.color);
        canvas.rect(x, 16, width - 6, 4, 0x273445);
        canvas.rect(x, 16, Math.floor((width - 6) * Math.max(0, Math.min(1, meter.value / meter.max))), 4, meter.color);
      });
      top = 23;
    }
    const strip = (value: string, color: number) => {
      if (!value) return;
      const lines = wrapText(value, columns).slice(0, 2);
      canvas.rect(0, top, W, lines.length * 12 + 6, 0x172133);
      lines.forEach((line, i) => text(line, 6, top + 3 + i * 12, color));
      top += lines.length * 12 + 6;
    };
    strip(ui.objective, 0xf2d58a);
    if (ui.heading && (status !== 'playing' || paused)) strip(ui.heading, 0xf2d58a);
    // Detail is secondary; leave the centre clear when combat has three meters.
    if (ui.meters.length < 3 && !ui.panel) strip(ui.detail, 0xb5c9de);
    const prompt = paused && !ui.heading ? 'PAUSED - P TO RESUME' : ui.prompt;
    const promptLines = wrapText(prompt, columns).slice(0, 2);
    const bottom = H - promptLines.length * 12 - 6;
    if (ui.panel) {
      const panel = ui.panel;
      const rows = Math.max(0, Math.floor((bottom - top - 8) / 12));
      const title = wrapText(panel.title, columns).slice(0, 1);
      const footer = wrapText(panel.footer, columns).slice(0, 1);
      const choices = panel.choices.map((choice, i) =>
        `${i === panel.selected ? '>' : ' '} ${i + 1} ${choice}`.slice(0, columns));
      const bodyRows = Math.max(0, rows - title.length - footer.length - choices.length);
      const lines = [...title, ...wrapText(panel.body, columns).slice(0, bodyRows), ...choices, ...footer].slice(0, rows);
      canvas.rect(0, top, W, lines.length * 12 + 8, 0x0b111b);
      lines.forEach((line, i) => text(line, 6, top + 4 + i * 12, i === 0 ? 0xf2d58a : 0xb5c9de));
    } else {
      const noticeRows = Math.max(0, Math.min(2, Math.floor((bottom - top - 40) / 12)));
      const lines = wrapText(ui.notice, columns).slice(0, noticeRows);
      if (lines.length) {
        canvas.rect(0, top, W, lines.length * 12 + 6, 0x172133);
        lines.forEach((line, i) => text(line, 6, top + 3 + i * 12, 0xf2d58a));
      }
      if (status === 'playing' && !paused) {
        const x = W >> 1, y = H >> 1;
        canvas.rect(x - 3, y, 7, 1, 0xffffff);
        canvas.rect(x, y - 3, 1, 7, 0xffffff);
      }
    }
    canvas.rect(0, bottom, W, H - bottom, 0x0b111b);
    promptLines.forEach((line, i) => text(line, 6, bottom + 3 + i * 12));
  }
  if (ui.notice && !ui.panel) {
    const noticeY = heading ? 70 : 40;
    const lines = wrapText(ui.notice, Math.max(1, Math.floor((W - 32) / 4))).slice(0, 2);
    canvas.rect(12, noticeY, W - 24, lines.length * 8 + 8, 0x172133);
    lines.forEach((line, i) => canvas.text(line, 16, noticeY + 4 + i * 8, 0xf2d58a));
  }
  if (ui.panel) {
    const p = ui.panel;
    const camp = status !== 'playing' || paused;
    const body = wrapText(p.body, panelColumns).slice(0, camp ? 3 : 2);
    const bh = 35 + body.length * 8 + p.choices.length * 12;
    const by = camp ? heading ? 70 : 44 : H - bh - 18;
    canvas.rect(16, by, W - 32, bh, 0x0b111b);
    canvas.rect(16, by, W - 32, 2, 0xf2d58a);
    canvas.text(p.title.slice(0, panelColumns), 24, by + 7, 0xf2d58a);
    body.forEach((line, i) => canvas.text(line, 24, by + 18 + i * 8, 0xb5c9de));
    p.choices.forEach((choice, i) => {
      const y = by + 22 + body.length * 8 + i * 12;
      if (i === p.selected) canvas.rect(22, y - 2, W - 44, 10, 0x30445c);
      canvas.text(`${i === p.selected ? '>' : ' '} ${i + 1} ${choice}`.slice(0, panelColumns), 24, y, i === p.selected ? 0xffffff : 0xb5c9de);
    });
    canvas.text(p.footer.slice(0, panelColumns), 24, by + bh - 8, 0x7ed6ac);
  } else if (!ui.map) {
    const x = W >> 1, y = H >> 1;
    canvas.rect(x - 3, y, 2, 1, 0xffffff);
    canvas.rect(x + 2, y, 2, 1, 0xffffff);
    canvas.rect(x, y - 3, 1, 2, 0xffffff);
    canvas.rect(x, y + 2, 1, 2, 0xffffff);
  }
  const prompt = paused && !ui.heading ? 'PAUSED - P OR PAUSE BUTTON TO RESUME' : ui.prompt;
  if (prompt) {
    canvas.rect(0, H - 14, W, 14, 0x0b111b);
    canvas.text(prompt.slice(0, columns), 6, H - 9, 0xffffff);
  }
}

function renderMap(canvas: CanvasHud, map: HudMap): void {
  const width=map.expanded?canvas.width-48:124, height=map.expanded?canvas.height-126:67;
  const x=map.expanded?24:canvas.width-width-8, y=map.expanded?91:90;
  canvas.rect(x-3,y-10,width+6,height+15,0x0b1726);
  canvas.text('EXPLORATION MAP',x,y-7,0xa4efd0);
  const point=(n:HudMap['nodes'][number])=>({x:x+8+n.x*(width-24)/100,y:y+8+n.y*(height-24)/100});
  for (const link of map.links) {
    const from=map.nodes.find(n=>n.id===link.from)!, to=map.nodes.find(n=>n.id===link.to)!;
    if (!from.visited && !to.visited) continue;
    const a=point(from),b=point(to),color=link.shortcut?0x58efd5:from.locked||to.locked?0x8e5268:0x456a75;
    if (link.shortcut) {
      for(let px=Math.min(a.x,b.x);px<=Math.max(a.x,b.x);px+=5) canvas.rect(px,a.y,2,1,color);
      for(let py=Math.min(a.y,b.y);py<=Math.max(a.y,b.y);py+=5) canvas.rect(b.x,py,1,2,color);
    } else {
      canvas.rect(Math.min(a.x,b.x),a.y,Math.abs(b.x-a.x)+1,1,color);
      canvas.rect(b.x,Math.min(a.y,b.y),1,Math.abs(b.y-a.y)+1,color);
    }
  }
  for (const node of map.nodes) {
    const p=point(node), current=node.id===map.current;
    const color=current?0x58efd5:node.locked?0xf06b82:node.visited?0x6dce8c:0x536582;
    canvas.rect(p.x-3,p.y-2,7,5,color);
    if (current) canvas.rect(p.x-1,p.y-1,3,3,0xffffff);
    if (map.expanded) canvas.text(node.visited||node.locked?node.label:'???',p.x-8,p.y+5,color);
  }
}
