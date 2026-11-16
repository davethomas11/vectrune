import { describe, expect, it } from 'vitest';
import { compileExpression } from '../src/expression';
import { voxelGenerate, voxelGet, voxelMove, voxelRay, voxelMine, validateWorld, voxelRead, voxelFill } from '../src/pixel3d/voxel';
import { Raycaster3D, type Texture } from '../src/pixel3d/raycaster';
import { renderModel } from '../src/pixel3d/model';

describe('voxel worlds', () => {
  it('generates deterministic terrain, distinct seeds and two biome material sets', () => {
    const world = voxelGenerate(319);
    expect(world).toEqual(voxelGenerate(319));
    expect(world.cells).not.toEqual(voxelGenerate(320).cells);
    expect(world.materials).not.toEqual(voxelGenerate(319, 'ember').materials);
    expect(world.cells).toHaveLength(4000);
    expect(voxelGet(world, 4, 4, 2)).toBe(1);
    expect(new Set(world.cells)).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]));
    expect(validateWorld(world)).toBe(world);
    expect(() => voxelGenerate(NaN)).toThrow('seed');
    expect(() => voxelGenerate(1, 'unknown')).toThrow('biome');
    expect(() => validateWorld({ ...world, cells: [0] })).toThrow('exactly sized');
    expect(() => validateWorld({ ...world, cells: world.cells.map((v, i) => i === 100 ? 7 : v) })).toThrow();
  });
  it('keeps camp and cave traversable across seeds with descending and ascending elevation', () => {
    for (const seed of [1, 2, 17, 319, 731, 2147483646]) {
      const world = voxelGenerate(seed);
      let player = { ...world.spawn };
      for (let i = 0; i < 50; i++) player = voxelMove(world, player, 0, .08);
      for (let i = 0; i < 50; i++) player = voxelMove(world, player, .08, 0);
      expect(player.x).toBeCloseTo(8.5);
      for (let i = 0; i < 50; i++) player = voxelMove(world, player, 0, .08);
      expect(player.y).toBeCloseTo(12.5);
      for (let i = 0; i < 100; i++) player = voxelMove(world, player, .08, 0);
      for (let i = 0; i < 15; i++) player = voxelMove(world, player, 0, 0);
      expect(player.x).toBeCloseTo(16.5);
      expect(player.z).toBe(1);
      expect(voxelGet(world, 16, 12, 4)).toBe(2);
      for (let i = 0; i < 100; i++) player = voxelMove(world, player, -.08, 0);
      expect(player.x).toBeCloseTo(8.5);
      expect(player.z).toBe(3);
      for (let i = 0; i < 50; i++) player = voxelMove(world, player, 0, -.08);
      for (let i = 0; i < 50; i++) player = voxelMove(world, player, -.08, 0);
      for (let i = 0; i < 50; i++) player = voxelMove(world, player, 0, -.08);
      expect(player.y).toBeCloseTo(4.5);
    }
  });
  it('jumps, respects solid boundaries and does not tunnel through a block', () => {
    const world = voxelGenerate(319), spawn = { ...world.spawn };
    const jumped = voxelMove(world, spawn, 0, 0, true);
    expect(jumped.z).toBeGreaterThan(3);
    let p = { ...spawn };
    for (let i = 0; i < 90; i++) p = voxelMove(world, p, -.1, 0);
    expect(p.x).toBeGreaterThanOrEqual(.25);
    expect(() => voxelMove(world, spawn, 10, 0)).toThrow('at most one tile');
    expect(() => voxelMove(world, { ...spawn, z: NaN }, 0, 0)).toThrow('finite');
    const rockIndex = (4 * world.height + 4) * world.width + 6;
    world.cells[rockIndex] = 2;
    p = voxelMove(world, { ...spawn, x: 5.5 }, 1, 0);
    expect(p.x).toBeLessThan(6);
    expect(p.z).toBe(3);
  });
  it('targets actual 3D blocks, removes one block and protects bedrock', () => {
    const world = voxelGenerate(319), player = { ...world.spawn, x: 5.5 };
    const hit = voxelMine(world, player);
    expect(hit.block).toBe(4);
    expect(hit.hit).toMatchObject({ x: 7, y: 4, z: 4, face: 0 });
    expect(voxelGet(world, 7, 4, 4)).toBe(0);
    expect(voxelMine(world, player).block).toBe(0);
    const floor = voxelRay(world, { x: 2.5, y: 2.5, z: 4.25 }, [0, 0, -1], 10);
    expect(floor).toMatchObject({ z: 2, block: 3, face: 2, distance: 1.25 });
    for (let z = 1; z < 3; z++) world.cells[(z * 20 + 4) * 20 + 4] = 0;
    expect(voxelMine(world, { ...player, x: 4.5, z: 1, pitch: -90 }).block).toBe(0);
    expect(voxelGet(world, 4, 4, 0)).toBe(1);
  });
  it('exposes validated generation and mutation to Rune expressions', () => {
    const world = compileExpression('voxel_generate(319, "meadow")')({});
    expect(world).toEqual(voxelGenerate(319));
    const player = { ...voxelGenerate(319).spawn, x: 5.5 };
    expect(compileExpression('voxel_mine(world, player)')({ world, player })).toMatchObject({ block: 4 });
    expect(() => compileExpression('voxel_move(world, player)')).toThrow('4-5');
  });
  it('fills solid volumes or carves air with atomic bounds validation', () => {
    const world = voxelGenerate(319);
    const original = [...world.cells];
    expect(() => voxelFill(world, [19, 19, 9], [2, 1, 1], 2)).toThrow();
    expect(world.cells).toEqual(original);
    expect(() => voxelRead(world, -.1, 0, 0)).toThrow('Voxel x');
    expect(voxelFill(world, [12, 10, 2], [3, 2, 1], 5)).toBe(world);
    for (let x = 12; x < 15; x++) for (let y = 10; y < 12; y++) expect(voxelRead(world, x, y, 2)).toBe(5);
    expect(compileExpression('voxel_get(world, 12, 10, 2)')({ world })).toBe(5);
    compileExpression('voxel_fill(world, [12,10,2], [3,2,1], 0)')({ world });
    expect(voxelRead(world, 12, 10, 2)).toBe(0);
  });
  it('renders mined holes, cave ceilings and elevated/pitched model occlusion', () => {
    const world = voxelGenerate(319);
    const textures: Record<string, Texture> = Object.fromEntries(world.materials.map((name, i) =>
      [name, { width: 1, height: 1, pixels: new Uint32Array([0xff102030 + i * 0x101010]) }]));
    const renderer = new Raycaster3D({ width: 80, height: 50, world, textures, sprites: {},
      map: { width: 1, height: 1, grid: [0], floor: 0, ceiling: 0 } });
    const camera = { ...world.spawn, x: 5.5 };
    renderer.render(camera);
    const before = Array.from(renderer.buffer);
    voxelMine(world, camera);
    renderer.render(camera);
    expect(Array.from(renderer.buffer)).not.toEqual(before);
    const caveCamera = { ...camera, x: 14.5, y: 12.5, z: 1 };
    renderer.render(caveCamera);
    expect(renderer.pixelDepth[10 * 80 + 40]).toBeLessThan(Infinity);
    const model = { blocks: [{ from: [-.25, -.25, 0] as [number, number, number],
      size: [.5, .5, 1.5] as [number, number, number], color: 0xff00ff00 }] };
    const instance = { x: 16, y: 12.5, z: 1, model: 'test' };
    const buffer = new Uint32Array(4000), depth = new Float64Array(4000).fill(Infinity);
    renderModel(model, instance, { x: 14.5, y: 12.5, height: 2.25, pitch: -10 },
      1, 0, Math.tan(Math.PI / 6), 80, 50, buffer, depth);
    const count = buffer.filter(v => v !== 0).length;
    expect(count).toBeGreaterThan(20);
    depth.fill(.1); buffer.fill(0);
    renderModel(model, instance, { x: 14.5, y: 12.5, height: 2.25, pitch: -10 },
      1, 0, Math.tan(Math.PI / 6), 80, 50, buffer, depth);
    expect(buffer.every(v => v === 0)).toBe(true);
    expect(() => renderer.render({ ...camera, pitch: NaN })).toThrow('camera');
    expect(() => renderer.render({ ...camera, x: -1 })).toThrow('camera');
  });
});
