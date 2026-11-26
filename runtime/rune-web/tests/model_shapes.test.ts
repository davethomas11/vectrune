import { describe, expect, it } from 'vitest';
import { renderModel, type Block } from '../src/pixel3d/model';

function draw(shape: Block['shape'], camera: {x: number; y: number; height: number; pitch?: number} = { x: 0, y: 0, height: .5 }, dissolve = 0) {
  const width = 64, height = 48;
  const buffer = new Uint32Array(width * height).fill(0xff112233);
  const depth = new Float64Array(width * height).fill(Infinity);
  renderModel({blocks: [{from: [-.5, -.5, 0], size: [1, 1, 1], color: 0xff80a0ff, shape}]},
    {x: 3, y: 0, z: 0, dissolve}, camera, 1, 0, Math.tan(Math.PI/6), width, height, buffer, depth);
  return {buffer, depth};
}

describe('analytic model shapes', () => {
  it('reuses block geometry without retaining stale dimensions, colors or frame buffers', () => {
    const block: Block = {from:[-.5,-.5,0],size:[1,1,1],color:0xff80a0ff,shape:'sphere'};
    const model = {blocks:[block]};
    const buffer = new Uint32Array(64*48), depth = new Float64Array(64*48);
    const render = (fresh: boolean) => {
      buffer.fill(0xff112233);depth.fill(Infinity);
      renderModel(fresh ? {blocks:[{...block,from:[...block.from],size:[...block.size]}]} : model,
        {x:3,y:0}, {x:0,y:0,height:.5}, 1,0,Math.tan(Math.PI/6),64,48,buffer,depth);
      return {buffer:buffer.slice(),depth:depth.slice()};
    };
    expect(render(false)).toEqual(render(true));
    block.from[0] = -.75;
    block.size[0] = 1.5;
    block.color = 0xff1122ee;
    block.shape = 'box';
    expect(render(false)).toEqual(render(true));
    expect(render(false)).toEqual(render(false));
  });
  for (const shape of ['sphere', 'cylinder', 'ramp'] as const) {
    it(`${shape} has finite front and inside exit hits and honors dissolve`, () => {
      const image = draw(shape);
      expect(image.depth[23*64+32]).toBeGreaterThanOrEqual(2.5);
      expect(image.depth[23*64+32]).toBeLessThan(3.1);
      expect(image.buffer.some(pixel => pixel !== 0xff112233)).toBe(true);
      expect(image.buffer.every(pixel => pixel >>> 24 === 255)).toBe(true);
      const inside = draw(shape, {x:3, y:0, height:.25});
      expect(inside.depth[23*64+32]).toBeGreaterThan(0);
      expect(inside.depth[23*64+32]).toBeLessThan(1);
      expect(draw(shape, undefined, 1).depth.every(d => d === Infinity)).toBe(true);
    });
  }
  it('spheres keep a round silhouette and curved shading rather than filling a box', () => {
    const sphere = draw('sphere'), box = draw('box');
    expect(sphere.depth.filter(Number.isFinite).length).toBeLessThan(box.depth.filter(Number.isFinite).length);
    expect(new Set(sphere.buffer).size).toBeGreaterThan(12);
  });
  it('cylinder caps handle a camera looking down the cylinder axis', () => {
    const {depth} = draw('cylinder', {x:3, y:0, height:2, pitch:-90});
    expect(depth.every(d => !Number.isNaN(d))).toBe(true);
    expect(depth[23*64+32]).toBeCloseTo(1, 6);
  });
  it('ramps expose a sloping top whose height changes with the ray origin', () => {
    const low = draw('ramp', {x:0, y:0, height:.25}).depth[23*64+32];
    const high = draw('ramp', {x:0, y:0, height:.75}).depth[23*64+32];
    expect(high).toBeGreaterThan(low);
  });
});
