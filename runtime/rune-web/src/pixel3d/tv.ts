import { collectHudHitRegions, roundedRect } from './hud';
import type { Pixel3DEngine } from './engine';

export type TvCommand = 'up' | 'down' | 'left' | 'right' | 'select' | 'back';
export interface TvProfile {
  initial_focus?: string;
  wrap: boolean;
  summary: Array<{ path: string; label: string }>;
  modes: TvMode[];
}
type TvMode = {
  id: string;
  label: string;
  action: string;
} & (
  | { kind: 'action'; bounds?: { origin: number[]; extent: number[]; scale?: string } }
  | { kind: 'cycle'; groups: string[]; targets: string }
);
type Region = { x: number; y: number; w: number; h: number };
type Entry = { id: string; label: string; region: Region; action?: string; mode?: TvMode };

function stateValue(state: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) =>
    value !== null && typeof value === 'object' ? Reflect.get(value, key) : undefined, state);
}

export function createTvNavigation(game: Pixel3DEngine) {
  const profile: TvProfile = game.config.tv ?? { wrap: true, summary: [], modes: [] };
  let focused = profile.initial_focus ?? '';
  let active: TvMode | undefined;
  let selected = 0;
  const size = () => ({ width: game.raycaster.width, height: game.raycaster.height });
  const modal = () => {
    const ui = game.keyboardHud();
    return Boolean(ui?.keyboard || ui?.callout || ui?.grid?.layout === 'sidebar');
  };
  function array(path: string): unknown[] {
    const value = stateValue(game.app.state, path);
    if (!Array.isArray(value)) throw new Error(`TV state ${path} must be an array`);
    return value;
  }
  const count = (mode: Extract<TvMode, { kind: 'cycle' }>) =>
    mode.groups.reduce((total, path) => total + array(path).length, 0);
  function buttons(): Entry[] {
    const { width, height } = size(), ui = game.keyboardHud();
    const hits = collectHudHitRegions(width, height, ui, String(game.app.state.status ?? 'playing'), game.paused);
    const entries = (ui?.buttons ?? []).flatMap((button, index) => {
      const region = !button.disabled && hits.find(hit => hit.action === button.action);
      return region && button.action !== 'host.fullscreen'
        ? [{ id: `button:${index}:${button.action}`, label: button.label, action: button.action, region }]
        : [];
    });
    const modes = profile.modes.filter(mode => mode.kind !== 'cycle' || count(mode) > 0);
    const buttonWidth = Math.min(100, Math.floor((width - 30) / Math.max(1, modes.length)) - 10);
    const start = Math.floor((width - modes.length * buttonWidth - Math.max(0, modes.length - 1) * 10) / 2);
    return [...entries, ...modes.map((mode, index) => ({
      id: `mode:${mode.id}`, label: mode.label, mode,
      region: { x: start + index * (buttonWidth + 10), y: height - 40, w: buttonWidth, h: 30 },
    }))];
  }
  function current(entries: Entry[]): Entry | undefined {
    const entry = entries.find(item => item.id === focused) ??
      entries.find(item => item.action === focused) ?? entries[0];
    focused = entry?.id ?? '';
    return entry;
  }
  function pad(command: TvCommand) {
    const pressed = ({ up: 12, down: 13, left: 14, right: 15, select: 0, back: 1 })[command];
    const buttons = Array.from({ length: 16 }, (_, index) => ({ value: index === pressed ? 1 : 0 }));
    game.hudPads([{ index: 0, buttons, axes: [] }]);
    game.hudPads([{ index: 0, buttons: buttons.map(() => ({ value: 0 })), axes: [] }]);
  }
  function navigate(command: Exclude<TvCommand, 'select' | 'back'>): boolean {
    const entries = buttons(), selectedEntry = current(entries);
    if (!selectedEntry) return false;
    const center = (r: Region) => [r.x + r.w / 2, r.y + r.h / 2];
    const [x, y] = center(selectedEntry.region), horizontal = command === 'left' || command === 'right';
    const row = entries.filter(entry => Math.abs(center(entry.region)[1] - y) < 24);
    const candidates = horizontal && row.length > 1 ? row : entries;
    let best: Entry | undefined, bestScore = Infinity;
    for (const entry of candidates) {
      if (entry === selectedEntry) continue;
      const [ex, ey] = center(entry.region), dx = ex - x, dy = ey - y;
      const primary = command === 'left' ? -dx : command === 'right' ? dx : command === 'up' ? -dy : dy;
      const cross = horizontal ? Math.abs(dy) : Math.abs(dx);
      if (primary > 0 && primary + cross * 2 < bestScore) {
        best = entry; bestScore = primary + cross * 2;
      }
    }
    if (!best && profile.wrap) {
      let extreme = -Infinity;
      for (const entry of candidates) {
        if (entry === selectedEntry) continue;
        const [ex, ey] = center(entry.region), dx = ex - x, dy = ey - y;
        const opposite = command === 'left' ? dx : command === 'right' ? -dx : command === 'up' ? dy : -dy;
        const score = opposite - (horizontal ? Math.abs(dy) : Math.abs(dx)) * 2;
        if (score > extreme) { best = entry; extreme = score; }
      }
    }
    if (!best) return false;
    focused = best.id;
    return true;
  }
  function input(command: TvCommand): boolean {
    if (modal()) { pad(command); return true; }
    if (active) {
      if (command === 'back') { focused = `mode:${active.id}`; active = undefined; return true; }
      if (active.kind === 'cycle') {
        const total = count(active);
        if (!total) { focused = `mode:${active.id}`; active = undefined; return true; }
        selected %= total;
        if (command === 'left' || command === 'right') {
          selected = (selected + (command === 'left' ? -1 : 1) + total) % total;
          return true;
        }
        if (command === 'select') { game.activate(active.action, [selected]); return true; }
      } else if (command === 'left' || command === 'right') {
        game.activate(active.action, [command === 'left' ? -1 : 1]); return true;
      }
      return false;
    }
    if (command === 'back') {
      const entry = buttons().find(item => item.action === profile.initial_focus);
      if (!entry || entry.id === focused) return false;
      focused = entry.id; return true;
    }
    if (command !== 'select') return navigate(command);
    const entry = current(buttons());
    if (!entry) return false;
    if (entry.mode) { active = entry.mode; selected = 0; }
    else if (entry.action === 'host.mute') game.muted = !game.muted;
    else if (entry.action) game.activate(entry.action);
    return true;
  }
  function overlay(camera: Parameters<Pixel3DEngine['raycaster']['projectPoint']>[0], time: number): void {
    const ray = game.raycaster, { width, height } = size();
    if (profile.summary.length) {
      const summary = profile.summary.map(item => {
        const value = stateValue(game.app.state, item.path);
        if (typeof value !== 'string' && typeof value !== 'number')
          throw new Error(`TV summary ${item.path} must be text or a number`);
        return `${value} ${item.label}`;
      }).join('  ').toUpperCase().slice(0, Math.max(0, Math.floor((width - 30) / 8)));
      roundedRect(ray, 6, 6, Math.min(width - 12, summary.length * 8 + 16), 20, 5, 0x0d2233);
      ray.text(summary, 14, 11, 0xc3ffe8, 2);
    }
    if (modal()) return;
    const pulse = (Math.sin(time * 2) + 1) * 0.5;
    const color = (Math.round(100 + pulse * 34) << 16) | (Math.round(180 + pulse * 31) << 8) | Math.round(169 + pulse * 30);
    const bracket = (x: number, y: number, w: number, h: number, shade: number) => {
      for (const [px, py, dx, dy] of [[x,y,1,1],[x+w-1,y,-1,1],[x,y+h-1,1,-1],[x+w-1,y+h-1,-1,-1]]) {
        ray.rect(dx > 0 ? px : px-8, py, 9, 2, shade);
        ray.rect(px, dy > 0 ? py : py-8, 2, 9, shade);
      }
    };
    const ring = (r: Region) => {
      bracket(r.x-5, r.y-5, r.w+10, r.h+10, 0x153b47);
      bracket(r.x-4, r.y-4, r.w+8, r.h+8, color);
    };
    if (!active) {
      const entries = buttons(), entry = current(entries);
      for (const item of entries.filter(item => item.mode)) {
        const { x, y, w, h } = item.region, selected = item.id === focused;
        roundedRect(ray, x, y, w, h, 6, selected ? 0x7ce4cc : 0x365568);
        roundedRect(ray, x+2, y+2, w-4, h-4, 5, selected ? 0x265765 : 0x18394a);
        const label = item.label.toUpperCase().slice(0, Math.max(0, Math.floor((w - 8) / 8)));
        ray.text(label, x + Math.floor((w-label.length*8)/2), y+10, 0xf1fbf7, 2);
      }
      if (entry) {
        ring(entry.region);
        const label = entry.label.toUpperCase().slice(0, Math.max(0, Math.floor((width - 30) / 8)));
        const w = Math.min(width - 12, Math.max(100, label.length*8+20));
        const x = Math.floor((width-w)/2);
        roundedRect(ray, x, height-67, w, 19, 5, 0x0d2233);
        ray.text(label, x+10, height-62, 0xc3ffe8, 2);
      }
    } else {
      if (active.kind === 'cycle') {
        const total = count(active);
        if (!total) { focused = `mode:${active.id}`; active = undefined; return; }
        selected %= total;
        const target = array(active.targets)[selected];
        if (!target || typeof target !== 'object' || !['x','y','z'].every(key => {
          const value = Reflect.get(target, key); return typeof value === 'number' && Number.isFinite(value);
        })) throw new Error(`TV target ${active.targets}[${selected}] must have finite x, y, z`);
        const point = ray.projectPoint(camera, target as { x: number; y: number; z: number });
        if (point && point.x >= 0 && point.x < width && point.y >= 0 && point.y < height)
          ring({ x: Math.round(point.x)-19, y: Math.round(point.y)-19, w: 38, h: 38 });
      } else if (active.bounds) {
        const { origin, extent, scale: scalePath } = active.bounds;
        const scale = scalePath ? stateValue(game.app.state, scalePath) : 1;
        if (typeof scale !== 'number' || !Number.isFinite(scale) || scale < 0)
          throw new Error(`TV bounds scale ${scalePath} must be a nonnegative number`);
        const points = [-1,1].flatMap(x => [-1,1].flatMap(y => [0,1].map(z => ray.projectPoint(camera, {
          x: origin[0]+x*extent[0]*scale, y: origin[1]+y*extent[1]*scale, z: origin[2]+z*extent[2]*scale,
        }))));
        if (points.every(point => point !== undefined)) {
          const valid = points.filter(point => point !== undefined);
          const left = Math.max(5, Math.floor(Math.min(...valid.map(point => point.x)))-8);
          const top = Math.max(5, Math.floor(Math.min(...valid.map(point => point.y)))-8);
          const right = Math.min(width-5, Math.ceil(Math.max(...valid.map(point => point.x)))+8);
          const bottom = Math.min(height-5, Math.ceil(Math.max(...valid.map(point => point.y)))+8);
          if (right-left > 20 && bottom-top > 20) ring({x:left,y:top,w:right-left,h:bottom-top});
        }
      }
      const text = active.kind === 'cycle' ? 'LEFT RIGHT: CYCLE  OK: SELECT  BACK: HUD' : 'LEFT RIGHT: MOVE  BACK: HUD';
      const w = Math.min(width-12, Math.max(100, text.length*8+20));
      const x = Math.floor((width-w)/2);
      roundedRect(ray, x, height-46, w, 36, 6, 0x0d2233);
      ray.text(active.label.toUpperCase().slice(0, Math.floor((w-20)/8)), x+10, height-41, 0xc3ffe8, 2);
      ray.text(text.slice(0, Math.floor((w-20)/8)), x+10, height-25, 0xa2bdc7, 2);
    }
  }
  return { input, overlay, compactHud: profile.summary.length > 0 };
}
