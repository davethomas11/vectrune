import { describe, expect, it } from 'vitest';
import { OnScreenKeyboard, validateKeyboard, type OnScreenKeyboardConfig } from '../src/pixel3d/on_screen_keyboard';
import { Raycaster3D } from '../src/pixel3d/raycaster';

const config: OnScreenKeyboardConfig = {
  title: 'Name your fish', value: '', maxLength: 24, submitAction: 'save', cancelAction: 'cancel',
  width: 480, keyHeight: 28, gap: 4, textScale: 2,
};

describe('on-screen keyboard', () => {
  it('preserves drafts across authored HUD refreshes and highlights physical keys', () => {
    const keyboard = new OnScreenKeyboard(), calls: unknown[] = [];
    const invoke = (a: string, args: unknown[]) => calls.push([a, args]);
    keyboard.sync(config);
    keyboard.physical('S', true, false, invoke);
    expect(keyboard.pressed.has('S')).toBe(true);
    keyboard.sync({ ...config });
    expect(keyboard.value).toBe('S');
    keyboard.physical('S', false, false, invoke);
    expect(keyboard.pressed.has('S')).toBe(false);
    keyboard.activate('P', invoke);
    keyboard.activate('SPACE', invoke);
    keyboard.activate('DELETE', invoke);
    expect(keyboard.value).toBe('Sp');
    keyboard.physical('Enter', true, false, invoke);
    expect(calls).toEqual([['save', [{ name: 'Sp' }]]]);
    keyboard.physical('Enter', true, true, invoke);
    expect(calls).toHaveLength(1);
    keyboard.sync(undefined);
    keyboard.sync(config);
    expect(keyboard.value).toBe('');
  });

  it('supports touch keys, bounded drafts, caps, cancellation and controller focus', () => {
    const keyboard = new OnScreenKeyboard(), calls: unknown[] = [];
    const invoke = (a: string, args: unknown[]) => calls.push([a, args]);
    keyboard.sync({ ...config, maxLength: 2 });
    keyboard.activate('SHIFT', invoke);
    keyboard.activate('Q', invoke);
    keyboard.activate('W', invoke);
    keyboard.activate('E', invoke);
    expect(keyboard.value).toBe('QW');
    keyboard.activate('DELETE', invoke);
    keyboard.move(1, 0);
    expect(keyboard.focus).toBe(1);
    const pad = (button: number) => [{ index: 0, axes: [0, 0], buttons: Array.from({ length: 16 }, (_, i) => ({ value: i === button ? 1 : 0 })) }];
    keyboard.controller(pad(0), invoke);
    expect(keyboard.value).toBe('QW');
    keyboard.controller(pad(0), invoke);
    expect(keyboard.value).toBe('QW');
    keyboard.controller(pad(-1), invoke);
    keyboard.controller(pad(1), invoke);
    expect(calls).toContainEqual(['cancel', []]);
    keyboard.move(0, -1);
    expect(keyboard.focus).toBeGreaterThanOrEqual(36);
  });

  it('shares themed layout geometry with hit regions at different viewport sizes', () => {
    const keyboard = new OnScreenKeyboard();
    keyboard.sync(config);
    for (const [width, height] of [[640, 400], [320, 200], [240, 180]]) {
      const colors = new Set<number>(), labels: Array<{ value: string; x: number; y: number }> = [];
      keyboard.render({ width, height, rect(_x, _y, _w, _h, color) { colors.add(color); },
        text(value, x, y) { labels.push({ value, x, y }); } }, { background: 0x123456, surface: 0x234567, focus: 0x345678 });
      for (const color of [0x123456, 0x234567, 0x345678]) expect(colors.has(color)).toBe(true);
      const hits = keyboard.hits(width, height);
      expect(hits).toHaveLength(43);
      for (const hit of hits) {
        expect(hit.x).toBeGreaterThanOrEqual(0);
        expect(hit.x + hit.w).toBeLessThanOrEqual(width);
        expect(hit.y + hit.h).toBeLessThanOrEqual(height);
        const label = hit.args[0] === "'" ? (hit.w >= 20 ? 'APOS' : 'AP') : hit.args[0];
        expect(labels.some(l => l.value.toUpperCase() === label && l.x >= hit.x && l.x < hit.x + hit.w && l.y >= hit.y && l.y < hit.y + hit.h)).toBe(true);
      }
    }
  });

  it('rejects invalid public configuration', () => {
    for (const bad of [{ maxLength: 0 }, { value: 3 }, { submitAction: '' }, { width: 20 }, { keyHeight: 90 }, { gap: 0 }, { textScale: 3 }]) {
      expect(() => validateKeyboard({ ...config, ...bad } as OnScreenKeyboardConfig)).toThrow('keyboard');
    }
  });

  it('draws the same keyboard into CPU frames and transparent GPU HUD overlays', () => {
    const keyboard = new OnScreenKeyboard();
    keyboard.sync(config);
    const ray = new Raycaster3D({ width: 640, height: 400, textures: {}, sprites: {},
      map: { width: 2, height: 2, grid: [0, 0, 0, 0], floor: 0, ceiling: 0 } });
    const hud = { keyboard, ui: { style: 'floating' as const, meters: [], objective: '', detail: '', prompt: '', notice: '', panel: null, keyboard: config } };
    ray.renderOverlay(hud);
    const overlay = ray.buffer.slice();
    expect(overlay.some(p => p !== 0)).toBe(true);
    ray.render({ x: .5, y: .5, angle: 0 }, [], undefined, 0, hud);
    const key = keyboard.hits(640, 400)[0];
    const index = Math.floor(key.y + key.h / 2) * 640 + Math.floor(key.x + key.w / 2);
    expect(ray.buffer[index]).toBe(overlay[index]);
    expect(ray.projectPoint({ x: .5, y: .5, angle: 0 }, { x: 2.5, y: .5, z: .5 })).toEqual({ x: 320, y: 200 });
  });
});
