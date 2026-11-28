import {entityGroup} from '../src/pixel3d/entities';
import { describe, expect, it, vi } from 'vitest';
import { Raycaster3D, type RaycasterConfig, type Texture } from '../src/pixel3d/raycaster';
import { fastSin, fastCos, degToIndex, ANGLE_UNITS } from '../src/pixel3d/math';
import { slide, sees, castRay, setActiveMap, type SpatialMap } from '../src/pixel3d/spatial';
import { Pixel3DEngine, type Pixel3DConfig } from '../src/pixel3d/engine';
import type { RuneWebConfig } from '../src/types';
import { skyPixel, type Sky } from '../src/pixel3d/sky';
import { renderModel, type BlockModel } from '../src/pixel3d/model';
import { renderHud, validateHud, wrapText, type GameHud } from '../src/pixel3d/hud';

it('fits a wide viewport without stretching the world or increasing the authored pixel budget', () => {
  const engine = new Pixel3DEngine({width:432,height:270,tickRate:30,fov:72,camera:'camera',textures:{},sprites:{},
    map:{width:3,height:3,grid:Array(9).fill(0),floor:0,ceiling:0}},
    {stateJson:{camera:{x:1.5,y:1.5,angle:0},status:'playing'},derivedDefinitions:{},helperDefinitions:{},actionDefinitions:{}} as RuneWebConfig);
  const original = engine.frameIfChanged();
  engine.resizeViewport(502,232);
  const wide = engine.frameIfChanged();
  expect(wide).toHaveLength(502*232);
  expect(wide).not.toBe(original);
  expect(engine.raycaster.zBuffer).toHaveLength(502);
  expect(engine.raycaster.pixelDepth).toHaveLength(502*232);
  const verticalScale = Math.tan(engine.raycaster.fov*Math.PI/360)*232/502;
  expect(verticalScale).toBeCloseTo(Math.tan(72*Math.PI/360)*270/432,10);
  expect(engine.frameIfChanged()).toBeNull();
  engine.resizeViewport(502,232);
  expect(engine.frameIfChanged()).toBeNull();
  engine.resizeViewport(432,270);
  expect(engine.frameIfChanged()).toHaveLength(432*270);
  expect(engine.raycaster.fov).toBe(72);
  for (const [width,height] of [[NaN,270],[432,0],[432.5,270],[2048,2048]]) {
    expect(()=>engine.resizeViewport(width,height)).toThrow('viewport size');
  }
});

it('reuses presented pixels until a tick, action, pause or explicit invalidation changes them', () => {
  const engine=new Pixel3DEngine({width:40,height:30,tickRate:30,camera:'camera',textures:{},sprites:{},
    map:{width:3,height:3,grid:Array(9).fill(0),floor:0,ceiling:0}},
    {stateJson:{camera:{x:1.5,y:1.5,angle:0},status:'playing'},derivedDefinitions:{},helperDefinitions:{},actionDefinitions:{}} as RuneWebConfig);
  const render=vi.spyOn(engine.raycaster,'render');
  expect(engine.frameIfChanged()).not.toBeNull();
  expect(engine.frameIfChanged()).toBeNull();
  engine.step();expect(engine.frameIfChanged()).not.toBeNull();
  engine.paused=true;expect(engine.frameIfChanged()).not.toBeNull();
  engine.step();expect(engine.frameIfChanged()).toBeNull();
  engine.invoke('anything');expect(engine.frameIfChanged()).not.toBeNull();
  engine.invalidateFrame();expect(engine.frameIfChanged()).not.toBeNull();
  expect(render).toHaveBeenCalledTimes(5);
});

describe('structured pixel3d HUD', () => {
  it('picks visible model pixels, not hidden fish or empty space', () => {
    const ray = new Raycaster3D({
      width: 64, height: 48, textures: {}, sprites: {},
      models: { fish: { blocks: [{ from: [-.5, -.5, 0], size: [1, 1, 1], color: 0xffffff }] } },
      map: { width: 8, height: 8, grid: Array(64).fill(0), floor: 0, ceiling: 0 },
    });
    const camera = { x: 1, y: 2, angle: 0 };
    const front = { x: 3, y: 2, model: 'fish' }, back = { ...front, x: 5 };
    ray.render(camera, [front, back]);
    expect(ray.pickModels(camera, [back, front], 32, 24)).toBe(1);
    expect(ray.pickModels(camera, [back], 32, 24)).toBe(-1);
    expect(ray.pickModels(camera, [{ ...front, visible: false }], 32, 24)).toBe(-1);
    expect(ray.pickModels(camera, [front], 0, 0)).toBe(-1);
    expect(() => ray.pickModels(camera, [front], NaN, 24)).toThrow('coordinates');
  });
  const ui: GameHud = {
    meters: [{ label: 'HEALTH', value: 25, max: 100, color: 0x7ed6ac }],
    objective: 'CLEAR THE DEPTH', detail: 'KNIGHT', prompt: 'E: CLAIM', notice: 'REWARD',
    panel: null,
  };
  it('validates exploration links and draws current/locked rooms plus directional impact cues', () => {
    const map={current:'dock',expanded:true,nodes:[
      {id:'dock',label:'DOCK',x:10,y:60,visited:true,locked:false},
      {id:'vault',label:'VAULT',x:80,y:20,visited:false,locked:true}],links:[{from:'dock',to:'vault'}]};
    const hud:GameHud={...ui,style:'floating',map,damageDirection:-1};
    expect(validateHud(hud)).toBe(hud);
    expect(()=>validateHud({...hud,map:{...map,links:[{from:'dock',to:'missing'}]}})).toThrow('map');
    expect(()=>validateHud({...hud,map:{...map,nodes:[map.nodes[0],map.nodes[0]]}})).toThrow('map');
    expect(()=>validateHud({...hud,damageDirection:2})).toThrow('damageDirection');
    const labels:string[]=[],rects:number[][]=[];
    renderHud({width:432,height:270,text(t){labels.push(t);},rect(...r){rects.push(r);}},hud,'playing',false);
    expect(labels).toContain('DOCK');expect(labels).toContain('VAULT');
    expect(rects.some(r=>r[0]===4&&r[4]===0xf06b82)).toBe(true);
  });
  it('validates bounded choices, finite resources, and required text', () => {
    expect(validateHud(ui)).toBe(ui);
    for (const invalid of [
      null, {}, { ...ui, prompt: 1 }, { ...ui, heading: 42 }, { ...ui, meters: Array(4).fill(ui.meters[0]) },
      ...[0, 1.5, 3, '2', null].map(textScale => ({ ...ui, textScale })),
      ...[NaN, Infinity, 0, -1].map(max => ({ ...ui, meters: [{ ...ui.meters[0], max }] })),
      { ...ui, meters: [{ ...ui.meters[0], value: Infinity }] },
      { ...ui, meters: [{ ...ui.meters[0], color: 0x1000000 }] },
      { ...ui, style: 'unknown' }, { ...ui, meters: [{ ...ui.meters[0], icon: 'unknown' }] },
      { ...ui, panel: { title: 'CHOOSE', body: '', choices: ['ONE'], selected: 1, footer: '' } },
    ]) expect(() => validateHud(invalid)).toThrow();
    expect(wrapText('short words | abcdefghijk', 5)).toEqual(['short', 'words', 'abcde', 'fghij', 'k']);
    expect(() => wrapText('text', 0)).toThrow('positive integer');
  });
  it('floats heart icons over the world and empties one heart when health drops', () => {
    const sprites = {
      'custom/full': { width: 3, height: 2, origin: [0, 0], colors: [null, 0xff7192], pixels: [0, 1, 0, 1, 1, 1] },
      'custom/empty': { width: 3, height: 2, origin: [0, 0], colors: [null], pixels: [0, 0, 0, 0, 0, 0] },
    };
    const rc = new Raycaster3D({ width: 432, height: 270, textures: {}, sprites: {},
      map: { width: 1, height: 1, grid: [0], floor: 0, ceiling: 0 } });
    const floating: GameHud = { ...ui, style: 'floating', notice: '', objective: '', detail: '', prompt: '',
      meters: [{ label: 'NIX', icon: 'custom/full', emptyIcon: 'custom/empty', display: 'pips', value: 4, max: 4, color: 0x00ff00 }] };
    expect(validateHud(floating, sprites)).toBe(floating);
    expect(() => validateHud(floating)).toThrow('unknown sprite');
    expect(() => validateHud({ ...floating, noticeIcon: 'missing' }, sprites)).toThrow('missing');
    const draw = (health: number) => {
      rc.buffer.fill(0xff123456);
      renderHud(rc, { ...floating, meters: [{ ...floating.meters[0], value: health }] }, 'playing', false, sprites);
      expect(rc.buffer[0]).toBe(0xff123456);
      expect(rc.buffer[14 * 432 + 8]).toBe(0xff123456);
      expect(rc.buffer[35 * 432 + 10]).toBe(0xff123456);
      expect(rc.buffer[135 * 432 + 216]).toBe(0xff123456);
      return rc.buffer.filter(pixel => pixel === 0xff9271ff).length;
    };
    const full = draw(4), damaged = draw(3), empty = draw(0);
    expect(full).toBeGreaterThan(damaged);
    expect(damaged).toBeGreaterThan(0);
    expect(empty).toBe(0);
  });
  it('uses asset dimensions and palette colors for arbitrary counter and notice icons', () => {
    const rectangles: number[][] = [], labels: Array<[string, number]> = [];
    const sprites = { 'my/badge': { width: 11, height: 1, origin: [0, 0], colors: [null, 0x123abc], pixels: [...Array(10).fill(0), 1] } };
    const canvas = { width: 432, height: 270,
      rect(...args: number[]) { rectangles.push(args); },
      text(value: string, x: number) { labels.push([value, x]); } };
    const custom: GameHud = { ...ui, style: 'floating', noticeIcon: 'my/badge',
      meters: [{ label: 'BADGE', icon: 'my/badge', value: 1, max: 4, color: 0xff0000 }] };
    expect(validateHud(custom, sprites)).toBe(custom);
    renderHud(canvas, custom, 'playing', false, sprites);
    expect(rectangles).toContainEqual([28, 14, 2, 2, 0x123abc]);
    expect(rectangles).toContainEqual([18, 62, 1, 1, 0x123abc]);
    expect(labels).toContainEqual(['1/4', 37]);
  });
  it('wraps larger text inside the framebuffer and preserves all menu choices', () => {
    const calls: Array<{ text: string; x: number; y: number; scale: number }> = [];
    const canvas = { width: 320, height: 200, rect() {},
      text(text: string, x: number, y: number, _color?: number, scale = 1) { calls.push({ text, x, y, scale }); } };
    const enlarged: GameHud = { ...ui, textScale: 2, meters: [
      ui.meters[0], { ...ui.meters[0], label: 'GUARDIAN' }, { ...ui.meters[0], label: 'IMPACT' },
    ], objective: 'YOUR TURN', prompt: 'SHIFT GUARD / Q DODGE NOW!' };
    expect(validateHud(enlarged)).toBe(enlarged);
    renderHud(canvas, enlarged, 'playing', false);
    expect(calls.some(c => c.text.includes('GUARD'))).toBe(true);
    expect(calls.some(c => c.text.startsWith('I '))).toBe(true);
    expect(calls.every(c => c.scale === 2 && c.x >= 0 && c.x + c.text.length * 8 <= 320 && c.y >= 0 && c.y + 10 <= 200)).toBe(true);
    calls.length = 0;
    renderHud(canvas, { ...enlarged, meters: [ui.meters[0]], objective: 'WORKBENCH',
      panel: { title: 'RECIPES', body: 'A very long description '.repeat(30),
        choices: ['PICK', 'BLADE', 'MAIL'], selected: 1, footer: 'N NEXT / I CLOSE' },
    }, 'playing', false);
    for (const choice of ['1 PICK', '2 BLADE', '3 MAIL']) expect(calls.some(c => c.text.includes(choice))).toBe(true);
    expect(calls.every(c => c.y + 10 <= 200)).toBe(true);
  });
  it('does not draw empty objective or prompt strips in minimal HUDs', () => {
    const rectangles: number[][] = [];
    renderHud({ width: 320, height: 200, text() {},
      rect(...args: number[]) { rectangles.push(args); } },
    { ...ui, objective: '', detail: '', notice: '', prompt: '' }, 'playing', false);
    expect(rectangles.some(r => r[0] === 0 && r[1] === 0 && r[3] === 18)).toBe(true);
    expect(rectangles.some(r => r[0] === 0 && r[1] === 25)).toBe(false);
    expect(rectangles.some(r => r[0] === 0 && r[1] === 186)).toBe(false);
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
  it('returns the exact opaque horizon color at zero altitude for every sky time and heading', () => {
    const sky: Sky = {seed:731,zenith:0xff123456,horizon:0xffabcdef,cloud:0xff987654,speed:.3};
    for (const heading of [-Math.PI, 0, Math.PI/2, Math.PI]) {
      for (const time of [0, .5, 100, 100000]) expect(skyPixel(sky, heading, 0, time)).toBe(0xffabcdef);
    }
  });
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
    it('culls rear/off-screen boxes before scanning pixels and retains visible near-plane crossings', () => {
      let coordinateReads = 0;
      const from = new Proxy([-.5, -.5, 0] as [number, number, number], {
        get(target, key, receiver) {
          if (key === '0' || key === '1' || key === '2') coordinateReads++;
          return Reflect.get(target, key, receiver);
        },
      });
      const model: BlockModel = { blocks: [{ from, size: [1, 1, 1], color: 0xffabcdef }] };
      const buffer = new Uint32Array(64 * 48), depth = new Float64Array(64 * 48).fill(Infinity);
      const camera = { x: 0, y: 0, height: .5 };
      const draw = (x: number, y: number) => renderModel(model, { x, y }, camera,
        1, 0, Math.tan(33 * Math.PI / 180), 64, 48, buffer, depth);
      draw(-3, 0);
      expect(buffer.every(pixel => pixel === 0)).toBe(true);
      // Count geometry reads instead of asserting an unstable wall-clock threshold.
      expect(coordinateReads).toBeLessThan(100);
      for (const [x, y] of [[.2, 10], [.2, -10]]) {
        coordinateReads = 0;
        draw(x, y);
        expect(buffer.every(pixel => pixel === 0)).toBe(true);
        expect(coordinateReads).toBeLessThan(100);
      }
      draw(.2, .8);
      expect(buffer.some(pixel => pixel !== 0)).toBe(true);
      expect(buffer.some(pixel => pixel === 0)).toBe(true);
      buffer.fill(0); depth.fill(Infinity);
      draw(0, 0);
      expect(buffer.every(pixel => pixel !== 0)).toBe(true);
      expect(depth.every(distance => Number.isFinite(distance) && distance > 0)).toBe(true);
    });
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
    const aurora = { ...sky, speed: 0, cloud_wave: .8, cloud_glow: .45 };
    expect([0, .3, .7, 1.5].map(a => skyPixel(aurora, a, .7, 3)))
      .toEqual([0xffbaa7ac, 0xff978187, 0xff634951, 0xff634951]);
    const samples = (time: number) => Array.from({ length: 64 }, (_, x) => skyPixel(aurora, x / 10, .7, time));
    expect(samples(0)).not.toEqual(samples(10));
    expect(skyPixel(aurora, -Math.PI, .7, 3)).toBe(skyPixel(aurora, Math.PI, .7, 3));
    expect(samples(0)).not.toEqual(Array.from({ length: 64 }, (_, x) => skyPixel({...aurora, cloud_glow: 0}, x / 10, .7, 0)));
    rc.setMap(config.map);
    expect(Array.from(rc.render(camera))).toEqual(Array.from(new Raycaster3D(config).render(camera)));
  });

});


it('culls managed collections with scale-aware bounds and observes movement between renders',()=>{
 const config:Pixel3DConfig={width:40,height:30,tickRate:30,camera:'camera',things:['actors'],renderRadius:10,textures:{},sprites:{},
  models:{box:{blocks:[{from:[-1,-1,0],size:[2,2,2],color:0xffabcdef}]}},
  map:{width:3,height:3,grid:Array(9).fill(0),floor:0,ceiling:0}};
 const engine=new Pixel3DEngine(config,{stateJson:{camera:{x:0,y:0,z:0,angle:0},status:'playing',actors:[]},derivedDefinitions:{},helperDefinitions:{},actionDefinitions:{}} as RuneWebConfig);
 const actors=entityGroup([{x:1,y:0,z:0,model:'box'},{x:100,y:0,z:0,model:'box'}]);
 engine.app.state.actors=actors;
 expect(engine.renderState().things).toEqual([actors[0]]);
 actors[1].scale=50;expect(engine.renderState().things).toHaveLength(2);
 actors[1].scale=1;expect(engine.renderState().things).toHaveLength(1);
 actors[1].x=2;expect(engine.renderState().things).toHaveLength(2);
 actors[0].visible=false;expect(engine.renderState().things).toEqual([actors[1]]);
});


it('wraps expanded health pips inside their slot without covering the next meter',()=>{
 const full={width:12,height:6,origin:[0,0],colors:[0xabcdef],pixels:Array(72).fill(0)};
 const hud:GameHud={style:'floating',objective:'',detail:'',prompt:'',notice:'',panel:null,meters:[
  {label:'HP',value:16,max:16,color:0xabcdef,display:'pips',icon:'full',emptyIcon:'full'},
  {label:'BOSS',value:10,max:10,color:0x123456},{label:'CHARGE',value:1,max:24,color:0x234567}]};
 expect(validateHud(hud,{full})).toBe(hud);
 const rectangles:number[][]=[];
 const canvas={width:432,height:270,rect:(...args:number[])=>rectangles.push(args),text:()=>{}};
 renderHud(canvas,hud,'playing',false,{full});
 const pixels=rectangles.filter(row=>row[4]===0xabcdef);
 expect(pixels).toHaveLength(16*72);
 expect(pixels.every(([x,y,w,h])=>x>=8&&x+w<=146&&y>=14&&y+h<39)).toBe(true);
 expect(new Set(pixels.map(([,y])=>y)).size).toBe(12);
 expect(()=>validateHud({...hud,meters:[{...hud.meters[0],max:17}]},{full})).toThrow('valid meters');
});
