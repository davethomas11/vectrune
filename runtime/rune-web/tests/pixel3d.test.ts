import { describe, expect, it } from 'vitest';
import { Raycaster3D, type RaycasterConfig, type Texture } from '../src/pixel3d/raycaster';
import { fastSin, fastCos, degToIndex, ANGLE_UNITS } from '../src/pixel3d/math';
import { slide, sees, castRay, setActiveMap, type SpatialMap } from '../src/pixel3d/spatial';
import { Pixel3DEngine, type Pixel3DConfig } from '../src/pixel3d/engine';
import type { RuneWebConfig } from '../src/types';

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
});

