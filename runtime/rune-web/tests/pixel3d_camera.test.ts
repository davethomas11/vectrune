import { describe, it, expect } from 'vitest';
import { sampleCamera, type CameraTrack } from '../src/pixel3d/camera';
import { Raycaster3D, type MapData, type Texture } from '../src/pixel3d/raycaster';

const sky = { seed: 1, zenith: 0xff080808, horizon: 0xff080808, cloud: 0xff080808, speed: 0 };
const wall: Texture = { width: 8, height: 8, pixels: new Uint32Array(64).fill(0xff0000ff) };
const map: MapData = { width: 7, height: 7, grid: Array(49).fill(0), floor: 0xff008800,
  ceiling: 0xff880000, sky };
map.grid[3 * 7 + 3] = 1;
const create = (m = map) => new Raycaster3D({ width: 80, height: 60, map: m, textures: { wall }, sprites: {} });

describe('declarative camera tracks', () => {
  const track: CameraTrack = { duration: 8, loop: true, points: [
    { x: 1, y: 1, angle: 350, height: 3, pitch: -20 },
    { x: 3, y: 1, angle: 10, height: 2, pitch: -10 },
    { x: 3, y: 3, angle: 90, height: 4, pitch: -40 },
    { x: 1, y: 3, angle: 200, height: 5, pitch: -30 },
  ] };
  it('wraps smoothly in position and takes the short angular route', () => {
    expect(sampleCamera(track, 8)).toEqual(sampleCamera(track, 0));
    expect(sampleCamera(track, 1).angle).toBeGreaterThan(350);
    expect(sampleCamera(track, 1).angle).toBeLessThan(370);
    const before = sampleCamera(track, 8 - .001), after = sampleCamera(track, .001);
    expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(.01);
    expect(Math.abs(before.pitch! - after.pitch!)).toBeLessThan(.1);
    expect(sampleCamera({ ...track, loop: false }, 100)).toEqual(track.points[3]);
  });
});

describe('elevated pitched grid rendering', () => {
  it('looks over a wall and sees its top from above, with per-pixel depth', () => {
    const rc = create();
    rc.render({ x: 1.5, y: 3.5, angle: 0, height: 3, pitch: 0 });
    expect(rc.pixelDepth[30 * 80 + 40]).toBeGreaterThan(10);
    rc.render({ x: 1.5, y: 3.5, angle: 0, height: 3, pitch: -45 });
    expect(rc.buffer[29 * 80 + 40]).toBe(0xff0000ff);
    expect(rc.pixelDepth[29 * 80 + 40]).toBeGreaterThan(2);
    expect(rc.pixelDepth[29 * 80 + 40]).toBeLessThan(3);
  });
  it('keeps an opaque ceiling when no sky is declared', () => {
    const rc = create({ ...map, sky: undefined });
    rc.render({ x: 1.5, y: 3.5, angle: 0, height: .7, pitch: 35 });
    expect(rc.buffer[30 * 80 + 40]).toBe(0xff880000);
    expect(rc.pixelDepth[30 * 80 + 40]).toBeLessThan(1);
  });
  it('drifts clouds behind models below the horizon when the sky replaces the floor', () => {
    const rc = create({ ...map, sky: { ...sky, below: 0xff804020, cloud: 0xffc09080, speed: .2 } });
    const camera = { x: 1.5, y: 1.5, angle: 0, height: 3, pitch: -36 };
    const center = 30 * 80 + 40;
    const before = rc.render(camera).slice();
    expect(rc.pixelDepth[center]).toBe(Infinity);
    expect(before[center]).not.toBe(map.floor);
    expect(rc.render(camera, [], undefined, 0, undefined, [], 10)).not.toEqual(before);

    rc.config.models = { platform: { blocks: [{ from: [-1, -1, 0], size: [2, 2, 1], color: 0xffffffff }] } };
    rc.render(camera, [{ x: 7.5, y: 1.5, z: -2, model: 'platform' }]);
    expect(rc.pixelDepth[center]).toBeLessThan(10);
    expect(rc.buffer[center]).toBe(0xffffffff);
  });
  it('outlines model silhouettes without tinting distant sky or the model interior', () => {
    const light = 0xffeeeeee;
    const rc = create({ ...map, grid: map.grid.map(() => 0),
      sky: { ...sky, horizon: light, zenith: light, cloud: light, below: light } });
    rc.config.models = { platform: { blocks: [{ from: [-1, -1, 0], size: [2, 2, 1], color: light }] } };
    const camera = { x: 1.5, y: 1.5, angle: 0, height: 3, pitch: -36 };
    const things = [{ x: 7.5, y: 1.5, z: -2, model: 'platform' }];
    rc.setPalette([0, 0xffffff]);
    const plain = rc.render(camera, things).slice();
    rc.setPalette([0, 0xffffff], true);
    const outline = rc.render(camera, things);
    expect(outline[0]).toBe(plain[0]);
    expect(outline[30 * 80 + 40]).toBe(plain[30 * 80 + 40]);
    expect(outline.some((color, i) => color === 0xff000000 && plain[i] !== color &&
      rc.pixelDepth[i] === Infinity)).toBe(true);
  });
  it('occludes grounded billboards behind walls and shows them from above', () => {
    const rc = create();
    rc.config.sprites.test = { width: 1, height: 1, origin: [0, 1], colors: [0xffffff], pixels: [0] };
    const things = [{ x: 5, y: 3.5, sprite: 'test' }];
    rc.render({ x: 1.5, y: 3.5, angle: 0, height: .6, pitch: -2 }, things);
    expect(Array.from(rc.buffer).filter(c => c === 0xffffffff)).toHaveLength(0);
    rc.render({ x: 1.5, y: 3.5, angle: 0, height: 4, pitch: -45 }, things);
    expect(Array.from(rc.buffer).filter(c => c === 0xffffffff).length).toBeGreaterThan(0);
  });
  it('rejects invalid camera poses', () => {
    for (const patch of [{ height: NaN }, { height: -1 }, { pitch: 90 }, { x: Infinity }]) {
      expect(() => create().render({ x: 1, y: 1, angle: 0, height: 2, ...patch })).toThrow('Grid camera');
    }
  });
});

it('depth-tests models against the same pitched wall and floor rays', () => {
  const rc = create();
  rc.config.models = { cube: { blocks: [{ from: [-.35, -.35, 0], size: [.7, .7, 1], color: 0xffffffff }] } };
  const things = [{ x: 5, y: 3.5, model: 'cube' }];
  rc.render({ x: 1.5, y: 3.5, angle: 0, height: .6, pitch: -2 }, things);
  expect(Array.from(rc.buffer).some(c => c === 0xffcccccc || c === 0xffffffff || c === 0xffa5a5a5)).toBe(false);
  rc.render({ x: 1.5, y: 3.5, angle: 0, height: 4, pitch: -45 }, things);
  expect(Array.from(rc.buffer).some(c => c === 0xffffffff)).toBe(true);
});
