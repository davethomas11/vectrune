import { describe, expect, it } from 'vitest';
import { Raycaster3D, type RaycasterConfig, type Texture } from '../src/pixel3d/raycaster';
import { fastSin, fastCos, degToIndex, ANGLE_UNITS } from '../src/pixel3d/math';
import { slide, sees, castRay, setActiveMap, type SpatialMap } from '../src/pixel3d/spatial';
import { Pixel3DEngine, type Pixel3DConfig } from '../src/pixel3d/engine';
import type { RuneWebConfig } from '../src/types';
import { skyPixel, type Sky } from '../src/pixel3d/sky';
import { renderModel, type BlockModel } from '../src/pixel3d/model';
import { renderHud, validateHud, wrapText, type GameHud } from '../src/pixel3d/hud';

describe('structured pixel3d HUD', () => {
  const ui: GameHud = {
    meters: [{ label: 'HEALTH', value: 25, max: 100, color: 0x7ed6ac }],
    objective: 'CLEAR THE DEPTH', detail: 'KNIGHT', prompt: 'E: CLAIM', notice: 'REWARD',
    panel: null,
  };
  it('validates bounded choices, finite resources, and required text', () => {
    expect(validateHud(ui)).toBe(ui);
    for (const invalid of [
      null, {}, { ...ui, prompt: 1 }, { ...ui, heading: 42 }, { ...ui, meters: Array(4).fill(ui.meters[0]) },
      ...[NaN, Infinity, 0, -1].map(max => ({ ...ui, meters: [{ ...ui.meters[0], max }] })),
      { ...ui, meters: [{ ...ui.meters[0], value: Infinity }] },
      { ...ui, meters: [{ ...ui.meters[0], color: 0x1000000 }] },
      { ...ui, panel: { title: 'CHOOSE', body: '', choices: ['ONE'], selected: 1, footer: '' } },
    ]) expect(() => validateHud(invalid)).toThrow();
    expect(wrapText('short words | abcdefghijk', 5)).toEqual(['short', 'words', 'abcde', 'fghij', 'k']);
    expect(() => wrapText('text', 0)).toThrow('positive integer');
  });
  it('fills exact meter proportions, highlights selection, and keeps prompts separate', () => {
    const rc = new Raycaster3D({ width: 320, height: 200, textures: {}, sprites: {},
      map: { width: 1, height: 1, grid: [0], floor: 0, ceiling: 0 } });
    renderHud(rc, ui, 'playing', false);
    expect(rc.buffer[11 * 320 + 6 + 73]).toBe(0xffacd67e);
    expect(rc.buffer[11 * 320 + 6 + 74]).toBe(0xff453427);
    const prompt = Array.from(rc.buffer.slice(186 * 320));
    renderHud(rc, { ...ui, meters: [{ ...ui.meters[0], value: -5 }], panel: {
      title: 'SHRINE', body: '', choices: ['BLADE', 'RUNE', 'GUARD'], selected: 1, footer: '1 / 2 / 3: SELECT',
    } }, 'playing', false);
    expect(rc.buffer[11 * 320 + 6]).toBe(0xff453427);
    expect(rc.buffer[143 * 320 + 22]).toBe(0xff5c4430);
    expect(Array.from(rc.buffer.slice(186 * 320))).toEqual(prompt);
    renderHud(rc, ui, 'playing', true);
    expect(Array.from(rc.buffer.slice(186 * 320))).not.toEqual(prompt);
    renderHud(rc, { ...ui, meters: [{ ...ui.meters[0], value: 120 }] }, 'playing', false);
    expect(rc.buffer[11 * 320 + 6 + 297]).toBe(0xffacd67e);
  });
  it('renders a large title heading above class choices only outside play', () => {
    const calls: Array<{ text: string; y: number; scale?: number }> = [];
    const canvas = { width: 320, height: 200, rect() {},
      text(text: string, _x: number, y: number, _color?: number, scale?: number) { calls.push({ text, y, scale }); } };
    const title: GameHud = { ...ui, heading: 'RUNE CRYPT', panel: {
      title: 'CHOOSE YOUR CLASS', body: '', choices: ['KNIGHT'], selected: 0, footer: 'ENTER: BEGIN',
    } };
    renderHud(canvas, title, 'title', false);
    expect(calls).toContainEqual({ text: 'RUNE CRYPT', y: 44, scale: 3 });
    expect(calls).toContainEqual({ text: 'CHOOSE YOUR CLASS', y: 77, scale: undefined });
    calls.length = 0;
    renderHud(canvas, title, 'playing', false);
    expect(calls.some(c => c.text === 'RUNE CRYPT')).toBe(false);
    calls.length = 0;
    renderHud(canvas, { ...title, panel: null, notice: 'TITLE MUSIC' }, 'title', false);
    expect(calls).toContainEqual({ text: 'RUNE CRYPT', y: 44, scale: 3 });
    expect(calls).toContainEqual({ text: 'TITLE MUSIC', y: 74, scale: undefined });
    calls.length = 0;
    renderHud(canvas, { ...title, heading: 'PAUSED' }, 'playing', true);
    expect(calls).toContainEqual({ text: 'PAUSED', y: 44, scale: 3 });
    expect(calls).toContainEqual({ text: 'CHOOSE YOUR CLASS', y: 77, scale: undefined });
  });
});

describe('pixel3d deterministic math', () => {
  it('quantizes 360 degrees to 4096 angle units accurately', () => {
    expect(degToIndex(0)).toBe(0);
    expect(degToIndex(360)).toBe(0);
    expect(degToIndex(90)).toBe(1024);
    expect(degToIndex(180)).toBe(2048);
    expect(degToIndex(270)).toBe(3072);
    expect(degToIndex(-90)).toBe(3072);

    expect(Math.abs(fastSin(0))).toBe(0);
    expect(Math.abs(fastSin(90) - 1)).toBeLessThan(0.001);
    expect(Math.abs(fastCos(0) - 1)).toBeLessThan(0.001);
    expect(Math.abs(fastCos(90))).toBeLessThan(0.001);
  });
});

describe('pixel3d spatial builtins', () => {
  const map: SpatialMap = {
    width: 8,
    height: 8,
    // prettier-ignore
    grid: [
      1, 1, 1, 1, 1, 1, 1, 1,
      1, 0, 0, 0, 0, 0, 0, 1,
      1, 0, 1, 1, 0, 0, 0, 1,
      1, 0, 1, 0, 0, 0, 0, 1,
      1, 0, 0, 0, 0, 0, 0, 1,
      1, 0, 0, 0, 0, 1, 0, 1,
      1, 0, 0, 0, 0, 0, 0, 1,
      1, 1, 1, 1, 1, 1, 1, 1,
    ],
  };

  it('slides entity along walls without passing through', () => {
    setActiveMap(map);
    // Move into wall at (2, 2) from (1.5, 2.5) with dx=0.5, dy=0
    const res = slide(1.5, 2.5, 0.5, 0, 0.25, map);
    // Should be blocked along X
    expect(res.x).toBe(1.5);
    expect(res.y).toBe(2.5);

    // Free movement in open space
    const free = slide(3.5, 3.5, 0.1, 0.2, 0.25, map);
    expect(free.x).toBeCloseTo(3.6);
    expect(free.y).toBeCloseTo(3.7);
  });

  it('checks line of sight (sees)', () => {
    // Open path from (1.5, 1.5) to (5.5, 1.5)
    expect(sees(1.5, 1.5, 5.5, 1.5, map)).toBe(true);
    // Blocked by wall at (2, 2) from (1.5, 2.5) to (3.5, 2.5)
    expect(sees(1.5, 2.5, 3.5, 2.5, map)).toBe(false);
  });

  it('casts rays hitting walls and things', () => {
    const things = [
      { x: 3.5, y: 1.5, hp: 10, visible: true },
      { x: 5.5, y: 1.5, hp: 10, visible: true },
    ];
    // Ray east from (1.5, 1.5) along y=1.5
    const hitThing = castRay(1.5, 1.5, 0, 10, things, 0.4, map);
    expect(hitThing?.hit).toBe(true);
    expect(hitThing?.kind).toBe('thing');
    expect(hitThing?.index).toBe(0);

    // Ray west into outer wall
    const hitWall = castRay(1.5, 1.5, 180, 10, [], 0.4, map);
    expect(hitWall?.hit).toBe(true);
    expect(hitWall?.kind).toBe('wall');
    expect(hitWall?.distance).toBeCloseTo(0.5, 1);
  });
});

describe('pixel3d raycaster rendering', () => {
  it('raises walls and ceiling clipping while retaining floor, texture scale and collision depth', () => {
    const rc = new Raycaster3D({
      width: 64, height: 48, sprites: {},
      textures: { wall: { width: 8, height: 8,
        pixels: Uint32Array.from({ length: 64 }, (_, i) => 0xff000010 + Math.floor(i / 8)) } },
      map: { width: 8, height: 8, floor: 0xff111111, ceiling: 0xff333333,
        grid: Array.from({ length: 64 }, (_, i) => i < 8 || i >= 56 || i % 8 === 0 || i % 8 === 7 ? 1 : 0) },
      models: { high: { blocks: [{ from: [-0.5, -0.5, 1], size: [1, 1, 0.4], color: 0xff804020 }] } },
    });
    const camera = { x: 1.5, y: 1.5, angle: 0 };
    const low = Array.from(rc.render(camera));
    const depth = Array.from(rc.zBuffer);
    expect(low[12 * 64 + 32]).toBe(0xff333333);
    rc.setMap({ ...rc.config.map, ceilingHeight: 3 });
    rc.render(camera);
    expect(rc.buffer[12 * 64 + 32]).toBe(0xff000010);
    expect(Array.from(rc.zBuffer)).toEqual(depth);
    expect(Array.from(rc.buffer.slice(24 * 64))).toEqual(low.slice(24 * 64));
    rc.render(camera, [{ x: 4.5, y: 1.5, model: 'high' }]);
    expect(rc.buffer[12 * 64 + 32]).toBe(0xff663319);
    expect(rc.pixelDepth[12 * 64 + 32]).toBe(2.5);
    rc.setMap({ ...rc.config.map, ceilingHeight: 1 });
    rc.render(camera, [{ x: 4.5, y: 1.5, model: 'high' }]);
    expect(rc.buffer[12 * 64 + 32]).toBe(0xff333333);
    for (const height of [NaN, Infinity, 0.5, -1, 17]) {
      expect(() => rc.setMap({ ...rc.config.map, ceilingHeight: height })).toThrow('ceilingHeight');
    }
  });
  it('perspective-casts ceiling textures at their actual elevation', () => {
    const ceiling: Texture = { width: 8, height: 8,
      pixels: Uint32Array.from({ length: 64 }, (_, i) => 0xff000000 + i) };
    const rc = new Raycaster3D({ width: 64, height: 48, textures: {}, sprites: {},
      map: { width: 8, height: 8, grid: Array(64).fill(0), floor: 0xff111111, ceiling, ceilingHeight: 3 } });
    const camera = { x: 1.5, y: 1.5, angle: 0 };
    rc.render(camera);
    const distance = 2.5 * 48 / 11.5;
    const expected = ceiling.pixels[4 * 8 + (Math.floor((1.5 + distance) * 8) & 7)];
    expect(rc.buffer[12 * 64 + 32]).toBe(expected);
    const floor = Array.from(rc.buffer.slice(24 * 64));
    rc.setMap({ ...rc.config.map, ceilingHeight: 1 });
    rc.render(camera);
    expect(rc.buffer[12 * 64 + 32]).not.toBe(expected);
    expect(Array.from(rc.buffer.slice(24 * 64))).toEqual(floor);
  });
  const tex: Texture = {
    width: 4,
    height: 4,
    pixels: new Uint32Array(16).fill(0xff884422),
  };

  const config: RaycasterConfig = {
    width: 64,
    height: 48,
    textures: { wall: tex },
    sprites: {
      soldier: {
        width: 2,
        height: 2,
        origin: [1, 1],
        colors: [null, 0xff0000],
        pixels: [1, 1, 1, 1],
      },
    },
    map: {
      width: 4,
      height: 4,
      grid: [
        1, 1, 1, 1,
        1, 0, 0, 1,
        1, 0, 0, 1,
        1, 1, 1, 1,
      ],
      floor: 0xff222222,
      ceiling: 0xff111111,
    },
  };

  it('renders a 3D frame without throwing and populates buffer and zBuffer', () => {
    const rc = new Raycaster3D(config);
    const camera = { x: 1.5, y: 1.5, angle: 0 };
    const things = [{ x: 2.5, y: 1.5, sprite: 'soldier', visible: true }];
    const buf = rc.render(camera, things);

    expect(buf.length).toBe(64 * 48);
    expect(rc.zBuffer.length).toBe(64);
    // Ensure pixels were drawn (not all zero)
    expect(buf.some((p) => p !== 0)).toBe(true);
    // Wall in front at x=3 -> distance around 1.5
    expect(rc.zBuffer[32]).toBeGreaterThan(0.5);
    expect(rc.zBuffer[32]).toBeLessThan(3.0);
  });

  describe('pixel3d block models', () => {
    const model: BlockModel = { blocks: [{ from: [-0.5, -0.5, 0], size: [1, 1, 1], color: 0xff804020 }] };
    it('dissolves stable pixel fragments without leaving depth occlusion', () => {
      const render = (dissolve?: number) => {
        const buffer = new Uint32Array(64 * 48).fill(0xff112233);
        const depth = new Float64Array(64 * 48).fill(Infinity);
        renderModel(model, { x: 2, y: 0, dissolve }, { x: 0, y: 0 }, 1, 0,
          Math.tan(33 * Math.PI / 180), 64, 48, buffer, depth);
        return { buffer: Array.from(buffer), depth: Array.from(depth) };
      };
      const solid = render(), half = render(0.5), almost = render(0.8);
      expect(render(0)).toEqual(solid);
      expect(render(0.5)).toEqual(half);
      const count = (frame: ReturnType<typeof render>) => frame.depth.filter(Number.isFinite).length;
      expect(count(half) / count(solid)).toBeGreaterThan(0.4);
      expect(count(half) / count(solid)).toBeLessThan(0.6);
      expect(count(almost)).toBeLessThan(count(half));
      half.depth.forEach((d, i) => {
        if (!Number.isFinite(d)) expect(half.buffer[i]).toBe(0xff112233);
        if (Number.isFinite(almost.depth[i])) expect(Number.isFinite(d)).toBe(true);
      });
      expect(count(render(1))).toBe(0);
      for (const value of [-1, 1.1, NaN, Infinity]) expect(() => render(value)).toThrow('dissolve');
    });
    it('renders shaded faces with perspective depth and handles rotation/inside/behind cameras', () => {
      const buffer = new Uint32Array(64 * 48);
      const depth = new Float64Array(64 * 48).fill(Infinity);
      const camera = { x: 0, y: 0 };
      const render = (x: number, angle = 0) => renderModel(model, { x, y: 0, angle }, camera, 1, 0, Math.tan(33 * Math.PI / 180), 64, 48, buffer, depth);
      render(2);
      expect(depth[24 * 64 + 32]).toBe(1.5);
      expect(buffer[24 * 64 + 32]).toBe(0xff663319);
      depth.fill(1); buffer.fill(0); render(2);
      expect(buffer.every(p => p === 0)).toBe(true);
      depth.fill(Infinity); render(2, 90);
      expect(buffer[24 * 64 + 32]).toBe(0xff532914);
      depth.fill(Infinity); buffer.fill(0); render(-2);
      expect(buffer.every(p => p === 0)).toBe(true);
      render(0);
      expect(depth[24 * 64 + 32]).toBe(0.5);
      expect(buffer.every(p => p !== 0)).toBe(true);
      depth.fill(Infinity); buffer.fill(0);
      renderModel(model, { x: 2, y: 0, scale: 2 }, camera, 1, 0, Math.tan(33 * Math.PI / 180), 64, 48, buffer, depth);
      expect(depth[24 * 64 + 32]).toBe(1);
      depth.fill(Infinity); buffer.fill(0);
      renderModel(model, { x: 2, y: 0, z: 1 }, camera, 1, 0, Math.tan(33 * Math.PI / 180), 64, 48, buffer, depth);
      expect(buffer[24 * 64 + 32]).toBe(0);
      expect(buffer[10 * 64 + 32]).toBe(0xff804020);
      expect(() => renderModel(model, { x: 2, y: 0, scale: 0 }, camera, 1, 0, 1, 64, 48, buffer, depth)).toThrow('positive');
    });

    it('depth-tests against walls, other models, and sprites without hiding the whole column', () => {
      const rc = new Raycaster3D({
        width: 64, height: 48,
        textures: { wall: { width: 8, height: 8, pixels: new Uint32Array(64).fill(0xff222222) } },
        sprites: { foe: { width: 2, height: 2, origin: [1, 2], colors: [null, 0xff0000], pixels: [1, 1, 1, 1] } },
        models: { step: { blocks: [{ from: [-0.5, -0.5, 0], size: [1, 1, 0.5], color: 0xff804020 }] } },
        map: { width: 8, height: 8, floor: 0xff111111, ceiling: 0xff333333,
          grid: Array.from({ length: 64 }, (_, i) => i < 8 || i >= 56 || i % 8 === 0 || i % 8 === 7 ? 1 : 0) },
      });
      const camera = { x: 1.5, y: 1.5, angle: 0 };
      const step = { x: 3.5, y: 1.5, model: 'step' };
      const foe = { x: 4.5, y: 1.5, sprite: 'foe' };
      rc.render(camera, [step, foe]);
      expect(rc.buffer[20 * 64 + 32]).toBe(0xff0000ff);
      expect(rc.buffer[30 * 64 + 32]).toBe(0xff663319);
      expect(rc.pixelDepth[30 * 64 + 32]).toBe(1.5);
      expect(rc.zBuffer[32]).toBe(5.5);
      const frame = Array.from(rc.buffer);
      expect(Array.from(rc.render(camera, [foe, step]))).toEqual(frame);
      rc.config.models!.blue = { blocks: [{ from: [-0.5, -0.5, 0], size: [1, 1, 0.5], color: 0xffff0000 }] };
      const farStep = { ...step, x: 4.5, model: 'blue' };
      const models = Array.from(rc.render(camera, [step, farStep]));
      expect(Array.from(rc.render(camera, [farStep, step]))).toEqual(models);
      rc.render(camera, [step, { ...foe, x: 2.5 }]);
      expect(rc.buffer[30 * 64 + 32]).toBe(0xff0000ff);
      const walls = Array.from(rc.render(camera));
      expect(Array.from(rc.render(camera, [{ ...step, x: 8.5 }]))).toEqual(walls);
      expect(() => rc.render(camera, [{ ...step, model: 'missing' }])).toThrow('Unknown pixel-3d model');
      rc.config.sprites.bolt = { ...rc.config.sprites.foe, colors: [null, 0x00ff00] };
      rc.render(camera, [foe, { ...foe, sprite: 'bolt' }]);
      expect(rc.buffer[24 * 64 + 32]).toBe(0xff00ff00);
    });
  });
  it('overrides only the addressed wall texture while preserving wall depth', () => {
    const rc = new Raycaster3D({ ...config, textures: {
      ...config.textures,
      active: { width: 4, height: 4, pixels: new Uint32Array(16).fill(0xff00ff00) },
    } });
    const camera = { x: 1.5, y: 1.5, angle: 0 };
    const original = Array.from(rc.render(camera));
    const depth = Array.from(rc.zBuffer);
    rc.render(camera, [], undefined, 0, undefined, [{ x: 3, y: 1, texture: 1 }]);
    expect(rc.buffer[24 * 64 + 32]).toBe(0xff00ff00);
    expect(Array.from(rc.zBuffer)).toEqual(depth);
    expect(Array.from(rc.render(camera, [], undefined, 0, undefined, [{ x: 0, y: 0, texture: 1 }]))).toEqual(original);
    expect(Array.from(rc.render(camera, [], undefined, 0, undefined, [{ x: 3, y: 1, texture: 99 }]))).toEqual(original);
  });

  it('projects floor and ceiling textures, including horizon rows and negative coordinates', () => {
    const floor = { width: 8, height: 8, pixels: new Uint32Array(64).map((_, i) => 0xff000000 | i) };
    const ceiling = { width: 8, height: 8, pixels: new Uint32Array(64).fill(0xff8899aa) };
    const rc = new Raycaster3D({ ...config, map: { ...config.map, floor, ceiling } });
    const first = Array.from(rc.render({ x: 1.5, y: 1.5, angle: 0 }));
    expect(first[47 * 64 + 32]).toBe(floor.pixels[4 * 8 + 4]);
    expect(first[32]).toBe(0xff8899aa);
    expect(first.every(p => (p >>> 24) === 255)).toBe(true);
    rc.buffer.fill(0xdeadbeef);
    expect(Array.from(rc.render({ x: 1.5, y: 1.5, angle: 0 }))).toEqual(first);
    const moved = rc.render({ x: 1.6, y: 1.5, angle: 180 });
    expect(moved[47 * 64 + 32]).not.toBe(first[47 * 64 + 32]);
    expect(moved.every(p => (p >>> 24) === 255)).toBe(true);
  });

  it('generates animated, seeded sky without changing wall depth and switches indoors', () => {
    const sky: Sky = { seed: 731, zenith: 0xff552c20, horizon: 0xff838bbd, cloud: 0xffcfbdc0, speed: 0.35 };
    const rc = new Raycaster3D({ ...config, map: { ...config.map, sky } });
    const camera = { x: 1.5, y: 1.5, angle: 0 };
    const frame = Array.from(rc.render(camera));
    const depth = Array.from(rc.zBuffer);
    expect(Array.from(rc.render(camera))).toEqual(frame);
    expect(Array.from(rc.render(camera, [], undefined, 0, undefined, [], 12))).not.toEqual(frame);
    expect(Array.from(rc.zBuffer)).toEqual(depth);
    expect(skyPixel(sky, 0, 0, 0)).toBe(sky.horizon);
    expect(skyPixel(sky, -Math.PI, 0.7, 3)).toBe(skyPixel(sky, Math.PI, 0.7, 3));
    const panorama = (seed: number) => Array.from({ length: 64 }, (_, x) => skyPixel({ ...sky, seed }, x / 10, 0.7, 3));
    expect(panorama(19)).not.toEqual(panorama(731));
    expect([0, 0.3, 0.7, 1.5].map(a => skyPixel(sky, a, 0.7, 3))).toEqual([0xff634951, 0xff786067, 0xff80686e, 0xff634951]);
    rc.setMap(config.map);
    expect(Array.from(rc.render(camera))).toEqual(Array.from(new Raycaster3D(config).render(camera)));
  });

});
