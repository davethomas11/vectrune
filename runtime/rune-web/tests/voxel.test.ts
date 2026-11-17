import { describe, expect, it } from 'vitest';
import { compileExpression } from '../src/expression';
import { voxelGenerate, voxelGet, voxelMove, voxelRay, voxelMine, validateWorld, voxelRead, voxelFill, prepareVoxelChunks } from '../src/pixel3d/voxel';
import { Raycaster3D, type Texture } from '../src/pixel3d/raycaster';
import { renderModel } from '../src/pixel3d/model';

describe('voxel worlds', () => {
  it('skips empty regions without reading their individual cells', () => {
    const world = { ...voxelGenerate(1), width:48, height:40, depth:20, cells:Array(48*40*20).fill(0) };
    world.cells[(10*40+30)*48+40] = 2;
    const chunks = prepareVoxelChunks(world);
    let reads = 0;
    world.cells = new Proxy(world.cells, { get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
      return Reflect.get(target,key,receiver);
    } });
    const origin = {x:1.5,y:2.5,z:15.5};
    const ray: [number,number,number] = [39,28,-5];
    const original = voxelRay(world, origin, ray, 100);
    const originalReads = reads;
    reads = 0;
    expect(voxelRay(world, origin, ray, 100, undefined, chunks)).toEqual(original);
    expect(original).toMatchObject({x:40,y:30,z:10,block:2});
    expect(reads).toBeLessThan(originalReads / 2);
    reads = 0;
    expect(voxelRay(world, origin, [-1,-.2,.1], 100, undefined, chunks)).toBeNull();
    expect(reads).toBe(0);
  });
  it('keeps accelerated hits bit-exact across seeded sparse worlds and boundary rays', () => {
    let seed = 731;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (const [width, height, depth] of [[1,1,1], [7,9,6], [20,20,10], [48,40,20]]) {
      const world = { ...voxelGenerate(1), width, height, depth,
        cells: Array.from({length:width * height * depth}, () => random() < .035 ? 2 : 0) };
      const chunks = prepareVoxelChunks(world);
      for (let test = 0; test < 3000; test++) {
        const origin = {x:random()*width, y:random()*height, z:random()*depth};
        const ray: [number,number,number] = [random()*2-1, random()*2-1, random()*2-1];
        if (test % 3 === 0) origin.x = Math.floor(origin.x);
        if (test % 5 === 0) origin.y = Math.floor(origin.y / 4) * 4;
        if (test % 7 === 0) ray[1] = ray[0];
        if (test % 11 === 0) ray[2] = 0;
        if (test % 13 === 0) ray[0] = 1e-12;
        if (test % 17 === 0) { ray[0] = 1; ray[1] = -1; ray[2] = 1; }
        const distance = test % 2 === 0 ? random()*30 : 100;
        expect(voxelRay(world, origin, ray, distance, undefined, chunks))
          .toEqual(voxelRay(world, origin, ray, distance));
      }
      // Partial edge chunks must not admit rays starting outside the volume.
      const outside = {x:width + .1,y:.5,z:.5};
      expect(voxelRay(world, outside, [-1,0,0], 100, undefined, chunks)).toBeNull();
    }
  });
  it('refreshes chunk occupancy after fills, mining, direct edits and cell-array replacement', () => {
    const world = voxelGenerate(1);
    voxelFill(world, [0,0,0], [20,20,10], 0);
    const first = prepareVoxelChunks(world);
    expect(first.count).toBe(0);
    voxelFill(world, [6,5,4], [1,1,1], 2);
    expect(prepareVoxelChunks(world)).toBe(first);
    expect(first.count).toBe(1);
    const cast = () => voxelRay(world, {x:2.5,y:5.5,z:4.5}, [1,0,0], 20, undefined, prepareVoxelChunks(world));
    expect(cast()).toMatchObject({x:6,y:5,z:4,block:2});
    world.cells[(4*20+5)*20+6] = 0;
    expect(cast()).toBeNull();
    world.cells = Array(4000).fill(0);
    world.cells[(4*20+5)*20+10] = 2;
    expect(cast()).toMatchObject({x:10,block:2});
    // A real mine removes the only occupied cell in its chunk.
    voxelMine(world, {x:8.5,y:5.5,z:3.25,angle:0,pitch:0,vz:0});
    expect(cast()).toBeNull();
    expect(first.count).toBe(0);
    world.width = 19;
    world.cells = Array(19*20*10).fill(0);
    world.cells[(4*20+5)*19+6] = 3;
    expect(cast()).toMatchObject({x:6,block:3});
  });
  it('traverses positive/negative axes and tied cell edges with independently owned gameplay hits', () => {
    const world = voxelGenerate(319);
    voxelFill(world, [0, 0, 0], [20, 20, 10], 0);
    voxelFill(world, [6, 5, 4], [1, 1, 1], 2);
    const cases: Array<[{x: number; y: number; z: number}, [number, number, number], number, number]> = [
      [{x:2.5,y:5.5,z:4.5}, [1,0,0], 3.5, 0],
      [{x:9.5,y:5.5,z:4.5}, [-1,0,0], 2.5, 0],
      [{x:6.5,y:1.5,z:4.5}, [0,1,0], 3.5, 1],
      [{x:6.5,y:9.5,z:4.5}, [0,-1,0], 3.5, 1],
      [{x:6.5,y:5.5,z:1.5}, [0,0,1], 2.5, 2],
      [{x:6.5,y:5.5,z:8.5}, [0,0,-1], 3.5, 2],
    ];
    const scratch = {x:0,y:0,z:0,block:0,distance:0,face:0};
    for (const [origin, ray, distance, face] of cases) {
      const retained = voxelRay(world, origin, ray, 20)!;
      expect(retained).toEqual({x:6,y:5,z:4,block:2,distance,face});
      expect(voxelRay(world, origin, ray, 20, scratch)).toBe(scratch);
      expect(scratch).toEqual(retained);
      scratch.x = 0;
      expect(retained.x).toBe(6);
      expect(voxelRay(world, origin, ray, distance - .01)).toBeNull();
    }
    voxelFill(world, [6, 6, 6], [1, 1, 1], 3);
    expect(voxelRay(world, {x:2.5,y:2.5,z:2.5}, [1,1,1], 20))
      .toEqual({x:6,y:6,z:6,block:3,distance:3.5,face:0});
    expect(voxelRay(world, {x:6.5,y:6.5,z:6.5}, [1,0,0], 20))
      .toMatchObject({distance:0,block:3});
  });
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
    expect(() => compileExpression('voxel_move(world, player)')).toThrow('4-6');
  });
  it('supports platformer jumps across elevated gaps without automatic stepping', () => {
    const world = voxelGenerate(319);
    voxelFill(world, [0, 0, 0], [20, 20, 10], 0);
    voxelFill(world, [2, 4, 2], [5, 4, 1], 3);
    voxelFill(world, [9, 4, 3], [5, 4, 1], 3);
    const tuning = { jumpSpeed: .44, gravity: .035, autoStep: false };
    let p = { ...world.spawn, x: 6.3, y: 5.5, z: 3 };
    let peak = p.z;
    for (let tick = 0; tick < 30; tick++) {
      p = voxelMove(world, p, tick < 25 ? .18 : 0, 0, tick === 0, tuning);
      peak = Math.max(peak, p.z);
    }
    expect(peak).toBeGreaterThan(5);
    expect(p.x).toBeGreaterThan(9.25);
    expect(p.z).toBe(4);
    // A wall one tile high requires an actual jump in the platformer profile.
    p = { ...world.spawn, x: 9.5, y: 5.5, z: 4 };
    voxelFill(world, [10, 4, 4], [1, 4, 1], 2);
    expect(voxelMove(world, p, .5, 0, false, tuning).z).toBe(4);
    expect(voxelMove(world, p, .5, 0).z).toBe(5);
    expect(compileExpression('voxel_move(world, player, 0, 0, true, {"jumpSpeed":0.44,"autoStep":false})')({world, player:p}).vz).toBeCloseTo(.405);
    for (const options of [null, [], { jumpSpeed: 2 }, { gravity: 0 }, { autoStep: 1 }, { typo: true }]) {
      expect(() => voxelMove(world, p, 0, 0, false, options)).toThrow('Voxel movement');
    }
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
