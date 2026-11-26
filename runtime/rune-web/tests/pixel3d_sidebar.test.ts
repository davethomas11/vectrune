import { describe, expect, it } from 'vitest';
import { collectHudHitRegions, hudButtonAt, renderHud, validateHud, type GameHud } from '../src/pixel3d/hud';
import { Pixel3DEngine } from '../src/pixel3d/engine';

const ui: GameHud = {
  style: 'floating', meters: [], objective: '', detail: '', prompt: '', notice: '', panel: null,
  grid: {
    layout: 'sidebar', columns: 1, title: 'CARE', footer: 'CLOSE',
    items: Array.from({ length: 9 }, (_, i) => ({
      label: `Action ${i}`, action: `action_${i}`, disabled: i === 3,
    })),
  },
};

describe('pixel-3d sidebar HUD', () => {
  it('renders floral and critter quick buttons inside their clickable bounds', () => {
    for (const icon of ['flower', 'critter'] as const) {
      const hud: GameHud = { ...ui, grid: undefined,
        buttons: [{ icon, label: icon, action: `open_${icon}`, anchor: 'bottom-left', offset: 76 }] };
      const pixels: number[][] = [];
      renderHud({ width: 640, height: 400, rect(...args) { pixels.push(args); }, text() {} },
        validateHud(hud), 'playing', false);
      const hit = collectHudHitRegions(640, 400, hud, 'playing', false)[0];
      expect(hit.action).toBe(`open_${icon}`);
      expect(pixels.length).toBeGreaterThan(30);
      expect(pixels.every(([x, y, w, h]) => x >= hit.x && y >= hit.y &&
        x + w <= hit.x + hit.w && y + h <= hit.y + hit.h)).toBe(true);
    }
  });
  it('renders anchored icons and a top-left connected callout with matching action hits', () => {
    const hud: GameHud = { ...ui, grid: undefined,
      buttons: [{ icon: 'menu', label: 'Menu', action: 'open', anchor: 'top-right' },
        { icon: 'feed', label: 'Feed', action: 'feed', anchor: 'bottom-left', disabled: true }],
      callout: { title: 'Sunny', lines: ['Clownfish', 'Age / 4 minutes'], target: { x: 3, y: 2, z: 1 },
        screen: { x: 400, y: 220 }, dismissAction: 'close', actions: [{ label: 'Rename', action: 'rename' }] },
    };
    const pixels: number[][] = [];
    renderHud({ width: 640, height: 400, rect(...args) { pixels.push(args); }, text() {} }, validateHud(hud), 'playing', false);
    expect(pixels.some(p => p[0] === 398 && p[1] === 218 && p[2] === 5 && p[3] === 5)).toBe(true);
    expect(hudButtonAt(hud, 640, 400, 25, 375)).toBe(true);
    expect(hudButtonAt(hud, 640, 400, 320, 200)).toBe(false);
    const hits = collectHudHitRegions(640, 400, hud, 'playing', false);
    expect(hits.some(h => h.action === 'feed')).toBe(false);
    expect(hits.some(h => h.action === 'open' && h.x === 600 && h.y === 10)).toBe(true);
    expect(hits.some(h => h.action === 'rename' && h.x === 20 && h.y < 150)).toBe(true);
    for (const invalid of [{ ...hud, style: undefined }, { ...hud, callout: { ...hud.callout, target: { x: NaN, y: 0, z: 0 } } }]) {
      expect(() => validateHud(invalid)).toThrow();
    }
  });
  it('draws clickable items on the right, matching its hit regions', () => {
    const labels: Array<{ value: string; x: number; y: number }> = [];
    renderHud({
      width: 480, height: 300, rect() {},
      text(value, x, y) { labels.push({ value, x, y }); },
    }, validateHud(ui), 'playing', false);
    const regions = collectHudHitRegions(480, 300, ui, 'playing', false);
    expect(regions).toHaveLength(8);
    expect(regions.some(r => r.action === 'action_3')).toBe(false);
    for (const r of regions) {
      expect(r.x).toBeGreaterThan(240);
      expect(r.y + r.h).toBeLessThan(300);
      expect(labels.some(t => t.value === `Action ${r.action.slice(-1)}` &&
        t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h)).toBe(true);
    }
  });

  it('rejects invalid sidebar layouts without changing standard grids', () => {
    for (const grid of [
      { ...ui.grid!, layout: 'left' },
      { ...ui.grid!, columns: 2 },
      { ...ui.grid!, items: Array(11).fill({ label: 'Too many' }) },
      { ...ui.grid!, items: null },
      { ...ui.grid!, width: 10 },
      { ...ui.grid!, rowHeight: 65 },
      { ...ui.grid!, padding: 3 },
      { ...ui.grid!, gap: -1 },
      { ...ui.grid!, textScale: 3 },
      { ...ui.grid!, dismissAction: '' },
      { ...ui.grid!, closeOnActivate: true },
      { ...ui.grid!, dismissAction: 'close', closeOnActivate: 'true' },
    ]) expect(() => validateHud({ ...ui, grid })).toThrow('grid');
    expect(validateHud({ ...ui, grid: { columns: 3, items: Array(24).fill({ label: 'Grid' }) } })).toBeTruthy();
    expect(validateHud({ ...ui, grid: { ...ui.grid!, dismissAction: 'close', closeOnActivate: true } })).toBeTruthy();
    expect(validateHud({ ...ui, grid: { ...ui.grid!, closeOnActivate: false } })).toBeTruthy();
  });

  it('fits ten aquarium actions with readable labels at 640 by 400', () => {
    const calls: Array<{ value: string; x: number; y: number; scale: number }> = [];
    const hud: GameHud = { ...ui, grid: {
      ...ui.grid!, title: 'Lagoon', subtitle: 'Pearls', width: 302,
      rowHeight: 28, padding: 10, gap: 2, textScale: 2,
      items: Array.from({ length: 10 }, (_, i) => ({ label: `Action ${i}`, sub: 'Care', action: `action_${i}` })),
    } };
    renderHud({ width: 640, height: 400, rect() {},
      text(value, x, y, _color, scale = 1) { calls.push({ value, x, y, scale }); },
    }, validateHud(hud), 'playing', false);
    const hits = collectHudHitRegions(640, 400, hud, 'playing', false);
    expect(hits).toHaveLength(10);
    for (const hit of hits) {
      expect(hit.h).toBe(28);
      expect(hit.y + hit.h).toBeLessThan(400);
      expect(calls.some(t => t.value === `Action ${hit.action.slice(-1)}` && t.scale === 2 &&
        t.x >= hit.x && t.y >= hit.y && t.y + 10 <= hit.y + hit.h)).toBe(true);
      expect(calls.some(t => t.value === 'Care' && t.y >= hit.y && t.y + 5 <= hit.y + hit.h)).toBe(true);
    }
  });

  it('uses custom colors and spacing while keeping scaled labels inside hit regions', () => {
    const calls: Array<{ value: string; x: number; y: number; scale: number }> = [];
    const colors = new Set<number>();
    const custom: GameHud = { ...ui,
      theme: { background: 0x123456, surface: 0x234567, focus: 0x345678, radius: 8 },
      grid: { ...ui.grid!, title: 'Lagoon', subtitle: 'A quiet moment', width: 302,
        rowHeight: 32, textScale: 2, padding: 12, gap: 5, dismissAction: 'close',
        items: ui.grid!.items.slice(0, 8).map((item, i) => ({ ...item, selected: i === 1 })) },
    };
    renderHud({
      width: 640, height: 400,
      rect(_x, _y, _w, _h, color) { colors.add(color); },
      text(value, x, y, _color, scale = 1) { calls.push({ value, x, y, scale }); },
    }, validateHud(custom), 'playing', false);
    for (const color of [0x123456, 0x234567, 0x345678]) expect(colors.has(color)).toBe(true);
    const regions = collectHudHitRegions(640, 400, custom, 'playing', false);
    for (const r of regions.filter(r => r.action.startsWith('action_'))) {
      expect(r.h).toBe(32);
      expect(r.w).toBe(278);
      expect(calls.some(t => t.value === `Action ${r.action.slice(-1)}` &&
        t.scale === 2 && t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h)).toBe(true);
    }
    const hit = (x: number, y: number) => regions.find(r => x >= r.x && x <= r.x+r.w && y >= r.y && y <= r.y+r.h);
    expect(hit(50, 200)?.action).toBe('close');
    expect(hit(607, 37)?.action).toBe('close');
    // Disabled row and the gaps inside the menu must never become backdrop clicks.
    expect(hit(479, 79 + 3 * 37)).toBeUndefined();
    expect(hit(479, 97)).toBeUndefined();
  });

  it('rejects invalid theme colors and corner radii', () => {
    for (const theme of [null, [], { text: '#ffffff' }, { surface: -1 }, { accent: 0x1000000 },
      { focus: NaN }, { radius: 13 }, { radius: .5 }, { unknown: 1 }]) {
      expect(() => validateHud({ ...ui, theme })).toThrow('theme');
    }
  });

  it('selects shared desktop rendering for themed gameplay and pause menus', () => {
    const engine = new Pixel3DEngine({
      width: 320, height: 200, tickRate: 30, camera: 'camera', ui: 'ui', pauseUi: 'pause_ui',
      textures: {}, sprites: {},
      map: { width: 2, height: 2, grid: [0, 0, 0, 0], floor: 0, ceiling: 0 },
    }, {
      stateJson: { camera: { x: .5, y: .5, angle: 0 }, status: 'playing', ui, pause_ui: { ...ui, grid: undefined } },
      derivedDefinitions: {}, helperDefinitions: {}, actionDefinitions: {},
    });
    expect(engine.usesSharedRenderer).toBe(true);
    engine.app.state.ui = { ...ui, grid: undefined };
    expect(engine.usesSharedRenderer).toBe(false);
    engine.app.state.pause_ui = { ...ui, grid: undefined, theme: { accent: 0x7ce4cc } };
    expect(engine.usesSharedRenderer).toBe(true);
    engine.app.state.pause_ui = { ...ui, grid: undefined };
    engine.app.state.ui = { ...ui, grid: undefined, theme: { text: 0xffffff } };
    expect(engine.usesSharedRenderer).toBe(true);
  });
});
