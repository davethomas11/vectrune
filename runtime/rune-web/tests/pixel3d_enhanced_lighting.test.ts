import { describe, expect, it } from 'vitest';
import { EnhancedLighting } from '../src/pixel3d/enhanced_lighting';
import { Raycaster3D } from '../src/pixel3d/raycaster';
import { voxelFill, voxelWorld } from '../src/pixel3d/voxel';

const dark = 0xff242020;
const map = { width: 4, height: 4, grid: Array(16).fill(0), floor: dark, ceiling: dark };

describe('Enhanced Pixel 3D lighting', () => {
  it('blooms only visible marked model surfaces and restores Standard pixels', () => {
    const light = { from: [-.18, -.1, -.18] as [number,number,number],
      size: [.36, .2, .36] as [number,number,number], color: 0xfff4a015 };
    const ray = new Raycaster3D({ width: 64, height: 48, map, textures: {}, sprites: {}, models: {
      lamp: { blocks: [{ ...light, emissive: true }] }, plain: { blocks: [light] },
      cover: { blocks: [{ from: [-1,-.1,-1], size: [2,.2,2], color: dark }] },
    } });
    const camera = { x: 2, y: 3, angle: 270, height: 1 };
    const lamp = { x: 2, y: 1, z: 1, model: 'lamp' };
    const plain = { ...lamp, model: 'plain' };
    const standard = ray.render(camera, [lamp]).slice();
    const depth = ray.pixelDepth.slice();
    ray.setEnhancedLighting(true);
    const halo = ray.render(camera, [lamp]).slice();
    expect(ray.pixelDepth).toEqual(depth);
    expect(halo.some((pixel, i) => pixel !== standard[i] && depth[i] > 4)).toBe(true);
    expect(ray.render(camera, [plain])).toEqual(standard);
    const cover = { x: 2, y: 2, z: 1, model: 'cover' };
    expect(ray.render(camera, [lamp, cover]).slice()).toEqual(ray.render(camera, [cover]));
    ray.setEnhancedLighting(false);
    expect(ray.render(camera, [lamp])).toEqual(standard);
  });

  it('tints through a glass pane while solid geometry in front keeps its color', () => {
    const effects = new EnhancedLighting(), width = 48, height = 40;
    const buffer = new Uint32Array(width * height).fill(dark);
    const depth = new Float64Array(buffer.length).fill(Infinity);
    effects.begin(width, height);
    effects.rememberGlass({ x: 2, y: 2, z: 2, pitch: -90 }, { blocks: [], glass: [3,3] });
    const center = 20 * width + 24;
    depth[center] = 1;
    effects.finish(buffer, depth, { x: 4, y: 2, height: 2, angle: 180 }, -1, 0, .7, 20, undefined, [], {});
    expect(buffer[center]).toBe(dark);
    expect(buffer[center + 1]).not.toBe(dark);
    expect(depth[center + 1]).toBe(Infinity);
  });

  it('darkens a small patch of supporting floor without touching depth', () => {
    const world = voxelWorld(8, 8, 8, ['floor']);
    voxelFill(world, [0, 0, 0], [8, 8, 1], 1);
    const models = { actor: { blocks: [], contactShadow: 0.8 } };
    const ray = new Raycaster3D({ width: 72, height: 52, world, map, models, sprites: {},
      textures: { floor: { width: 1, height: 1, pixels: new Uint32Array([0xffc89988]) } } });
    const camera = {x: 4, y: 6, z: 2.8, angle: 270, pitch: -50};
    const actor = { x: 4, y: 4, z: 1, model: 'actor' };
    const standard = ray.render(camera, [actor]).slice(), depth = ray.pixelDepth.slice();
    ray.setEnhancedLighting(true);
    const shadow = ray.render(camera, [actor]);
    expect(shadow.some((pixel, i) => (pixel & 255) < (standard[i] & 255))).toBe(true);
    expect(ray.pixelDepth).toEqual(depth);
  });

  it('keeps nearby surfaces clear while mixing distance haze into a corridor', () => {
    const effects = new EnhancedLighting(), width = 16, height = 16;
    const world = voxelWorld(4, 4, 4, ['floor']);
    const buffer = new Uint32Array(width * height).fill(dark);
    const depth = new Float64Array(buffer.length).fill(6);
    depth[1] = 48;
    depth[2] = Infinity;
    effects.begin(width, height);
    effects.finish(buffer, depth, { x: 1, y: 1, height: 2, angle: 0 }, 1, 0, .7, 8, world, [], {}, 0xffbc2566);
    expect(buffer[0]).toBe(dark);
    expect(buffer[1]).not.toBe(dark);
    expect(buffer[2]).toBe(dark);
  });
});
