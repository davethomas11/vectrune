import { describe, expect, it } from 'vitest';
import { Raycaster3D } from '../src/pixel3d/raycaster';
import { tetherPieces, validateTether, type Tether3D } from '../src/pixel3d/tether';

const rope: Tether3D = { points: [[5, -1, 1], [5, 1, 1]], radius: .12, color: 0xfce0a0 };

describe('Pixel 3D tethers', () => {
  it('preserves both anchors and applies the authored sag at the midpoint', () => {
    const pieces = [...tetherPieces({ ...rope, slack: .4 })];
    const joints = pieces.filter(p => p.joint);
    expect(joints).toHaveLength(9);
    expect(joints[0]).toMatchObject({ x: 5, y: -1, z: 1 });
    expect(joints[4]).toMatchObject({ x: 5, y: 0, z: .6 });
    expect(joints[8]).toMatchObject({ x: 5, y: 1, z: 1 });
    expect([...tetherPieces({ ...rope, points: [[5,-1,1], [5,-1,1]], visible: true })]).toHaveLength(0);
  });

  it('rejects invalid coordinates and sag on an explicit multi-point curve', () => {
    expect(validateTether(rope)).toBe(rope);
    expect(() => validateTether({ ...rope, points: [[0, 0, 0], [1, 1, NaN]] })).toThrow('finite');
    expect(() => validateTether({ ...rope, points: [...rope.points, [6, 1, 1]], slack: 1 })).toThrow('exactly two');
  });

  it('draws an oriented span continuously and occludes it behind a closer model', () => {
    const rc = new Raycaster3D({
      width: 80, height: 60, textures: {}, sprites: {},
      map: { width: 1, height: 1, grid: [0], floor: 0xff252525, ceiling: 0xff151515 },
      models: { screen: { blocks: [{ from: [-1,-.5,-1], size: [2,1,2], color: 0xff0000ff }] } },
    });
    const camera = { x: 0, y: 0, angle: 0, height: 1 };
    const center = 30 * 80 + 40;
    const draw = (solid: boolean, ropeVisible: boolean) => rc.render(camera,
      solid ? [{ x: 3, y: 0, z: 1, model: 'screen' }] : [], undefined, 0, undefined, [], 0, undefined,
      ropeVisible ? [rope] : []).slice();
    const without = draw(false, false);
    const withRope = draw(false, true);
    const depth = rc.pixelDepth[center];
    expect(depth).toBeGreaterThan(4.8);
    expect(depth).toBeLessThan(5.1);
    expect(withRope[center]).not.toBe(without[center]);
    expect(withRope.slice(center - 7, center + 8).every((color, i) => color !== without[center - 7 + i])).toBe(true);
    const screen = draw(true, false);
    expect(draw(true, true)[center]).toBe(screen[center]);
    expect(rc.pixelDepth[center]).toBeLessThan(depth);
  });
});
