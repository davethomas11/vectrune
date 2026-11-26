import { describe, expect, it } from 'vitest';
import { compileExpression } from '../src/expression';
import { voxelGenerate, voxelGet, voxelMove, voxelRay, voxelMine, validateWorld, voxelRead, voxelWorld, voxelFill, prepareVoxelChunks, renderVoxels } from '../src/pixel3d/voxel';
import { Raycaster3D, type Texture } from '../src/pixel3d/raycaster';
import { renderModel } from '../src/pixel3d/model';

describe('voxel worlds', () => {
  it('renders entry faces from outside each side of an unposed world and misses outward rays', () => {
    const world = voxelWorld(8,8,8,['wall']);
    voxelFill(world,[0,0,0],[8,8,8],1);
    const textures = {wall:{width:1,height:1,pixels:new Uint32Array([0xff4040ff])}};
    const buffer = new Uint32Array(41*41),depth = new Float64Array(buffer.length);
    const center = 20*41+20;
    for (const camera of [
      {x:-2,y:4,z:2.75,angle:0},{x:10,y:4,z:2.75,angle:180},
      {x:4,y:-2,z:2.75,angle:90},{x:4,y:10,z:2.75,angle:270},
      {x:0,y:4,z:2.75,angle:0},{x:8,y:4,z:2.75,angle:180},
    ]) {
      renderVoxels(world,camera,textures,null,66,41,41,buffer,depth,0);
      expect(depth[center]).toBeCloseTo(camera.x===0 || camera.x===8 ? 0 : 2);
      renderVoxels(world,{...camera,angle:camera.angle+180},textures,null,66,41,41,buffer,depth,0);
      expect(depth[center]).toBe(Infinity);
    }
  });

  it('casts against hinged terrain even when the camera is outside the posed volume', () => {
    const world = voxelWorld(8, 8, 8, ['wall']);
    const terrain = voxelWorld(8, 2, 4, ['wall']);
    voxelFill(terrain, [3, 0, 0], [2, 2, 1], 1);
    const wall: Texture = { width: 1, height: 1, pixels: new Uint32Array([0xff4040ff]) };
    const buffer = new Uint32Array(41 * 41), depth = new Float64Array(buffer.length);
    const camera = { x: 4, y: 7, z: 2, angle: 270, terrainPose: {
      world: terrain, pivot: [2, 0] as [number, number], position: [2, 2] as [number, number], angle: 0,
    } };
    const center = 20 * 41 + 20;
    renderVoxels(world, camera, { wall }, null, 66, 41, 41, buffer, depth, 0);
    expect(depth[center]).toBe(Infinity);
    camera.terrainPose.angle = -45;
    renderVoxels(world, camera, { wall }, null, 66, 41, 41, buffer, depth, 0);
    expect(depth[center]).toBeGreaterThan(4);
    expect(depth[center]).toBeLessThan(7);
    camera.terrainPose.angle = -90;
    renderVoxels(world, camera, { wall }, null, 66, 41, 41, buffer, depth, 0);
    expect(depth[center]).toBeCloseTo(4);
    expect(voxelGet(world, 4, 2, 3)).toBe(0);
  });

  it('keeps chunk visibility conservative through edits and terrain rotation', () => {
    const terrain = voxelWorld(24, 5, 14, ['wall']);
    const plainTerrain = {
      ...voxelGenerate(1), width: 24, height: 5, depth: 14, materials: terrain.materials,
      cells: Array(24 * 5 * 14).fill(0),
    };
    const view = voxelWorld(24, 24, 30, ['wall']);
    const textures = { wall: { width: 2, height: 2, pixels: new Uint32Array([
      0xff4040ff, 0xffa08080, 0xffaabbcc, 0xff25abcd,
    ]) } };
    const pixels = new Uint32Array(81 * 45), depth = new Float64Array(pixels.length);
    const reference = pixels.slice(), referenceDepth = depth.slice();
    for (const [from, size, block] of [
      [[3, 1, 2], [17, 3, 1], 1],
      [[13, 0, 6], [2, 3, 3], 1],
      [[3, 1, 2], [17, 3, 1], 0],
    ] as const) {
      voxelFill(terrain, [...from], [...size], block);
      voxelFill(plainTerrain, [...from], [...size], block);
      for (const [x, y, z, pitch, angle] of [
        [12, 15, 9, 0, 0], [12, 12, 12, -35, -45],
        [14.5, 5, 12, -85, -90], [14.5, 3, 5.75, 0, 0],
      ]) {
        const pose = { pivot: [4, 0] as [number, number], position: [4, 0] as [number, number], angle };
        const camera = { x, y, z, angle: 270, pitch };
        renderVoxels(view, { ...camera, terrainPose: { ...pose, world: terrain } },
          textures, null, 70, 81, 45, pixels, depth, 0);
        renderVoxels(view, { ...camera, terrainPose: { ...pose, world: plainTerrain } },
          textures, null, 70, 81, 45, reference, referenceDepth, 0);
        expect(pixels).toEqual(reference);
        expect(depth).toEqual(referenceDepth);
      }
    }
  });

  it('detects aliased raw writes and material-range changes after snapshot validation', () => {
    const world=voxelGenerate(1), alias=world.cells;
    validateWorld(world);
    const chunks=prepareVoxelChunks(world);
    alias[(7*20+7)*20+7]=2;
    expect(validateWorld(world)).toBe(world);
    expect(prepareVoxelChunks(world)).toBe(chunks);
    expect(voxelRay(world,{x:7.5,y:7.5,z:8.5},[0,0,-1],20,undefined,chunks)).toMatchObject({z:7,block:2});
    alias[0]=99;
    expect(()=>validateWorld(world)).toThrow('valid block IDs');
    alias[0]=1;
    expect(validateWorld(world)).toBe(world);
    world.materials=['only-one'];
    expect(()=>validateWorld(world)).toThrow('valid block IDs');
  });
  it('keeps cached crossing depths identical to scalar rays while moving and changing worlds', () => {
    const buffer = new Uint32Array(40*31), depths = new Float64Array(40*31);
    const fov = 72, scale = Math.tan(fov*Math.PI/360);
    for (const [width,height,depth] of [[13,17,9],[17,13,7]]) {
      const world = {...voxelGenerate(1),width,height,depth,cells:Array(width*height*depth).fill(0)};
      voxelFill(world,[2,3,1],[8,5,1],2);
      voxelFill(world,[5,8,2],[1,2,3],3);
      voxelFill(world,[9,6,3],[1,3,2],4);
      const textures: Record<string, Texture> = Object.fromEntries(world.materials.map(name =>
        [name,{width:1,height:1,pixels:new Uint32Array([0xff4080c0])}]));
      for (const [x,y,z,angle] of [[4,11,4,270],[4.25,11.25,4.2,270],[4.25,11.25,3.1,270],
        [4.25,11.25,3.1,0],[4,8,2,90],[8,4,3,35],[7,4,3,180],[3,3,4,225]]) {
        const camera = {x,y,z,angle,pitch:0};
        renderVoxels(world,camera,textures,null,fov,40,31,buffer,depths,0);
        const a=angle*Math.PI/180, ca=Math.cos(a), sa=Math.sin(a);
        const origin={x,y,z:z+1.25};
        for (let row=0;row<31;row++) for (let column=0;column<40;column++) {
          const u=(2*column/40-1)*scale, v=(31/2-row-.5)/31;
          const hit=voxelRay(world,origin,[ca-sa*u,sa+ca*u,v],Math.hypot(width,height,depth));
          expect(depths[row*40+column]).toBe(hit?.distance ?? Infinity);
        }
      }
    }
  });
  it('refreshes camera rays for rotation, pitch, FOV and same-length framebuffer resizing', () => {
    const world = voxelGenerate(319);
    const textures: Record<string, Texture> = Object.fromEntries(world.materials.map((name, i) =>
      [name, { width:1, height:1, pixels:new Uint32Array([0xff102030 + i * 0x101010]) }]));
    const buffer = new Uint32Array(4000), depth = new Float64Array(4000);
    const camera = { ...world.spawn, x:5.5 };
    const sky = {seed:1,zenith:0x102030,horizon:0x203040,cloud:0x405060,speed:.1};
    // Each result must agree with a renderer that has no cached orientation.
    for (const [x,y,z,angle,pitch,fov,width,height] of [
      [5.5,4.5,3,0,0,66,80,50], [6,5,4,0,0,66,80,50],
      [6,5,4,270,0,66,80,50], [6,5,4,270,-35,66,80,50],
      [6,5,4,270,-35,85,80,50], [6,5,4,270,-35,85,100,40],
      [6,5,4,0,28,72,80,50], [5.5,4.5,3,0,0,66,80,50],
    ]) {
      Object.assign(camera, {x,y,z,angle,pitch});
      // Warm-up also covers reuse with a previous renderer's camera object.
      renderVoxels(world,camera,textures,sky,fov,width,height,buffer,depth,1);
      renderVoxels(world,camera,textures,sky,fov,width,height,buffer,depth,1);
      const expected = new Uint32Array(4000), expectedDepth = new Float64Array(4000);
      renderVoxels(world,camera,textures,sky,fov,width,height,expected,expectedDepth,1);
      expect(buffer).toEqual(expected);
      expect(depth).toEqual(expectedDepth);
    }
    // Cached rays must not cache geometry or hide arbitrary cell edits.
    const before = buffer.slice();
    voxelFill(world,[6,4,3],[1,1,3],2);
    renderVoxels(world,camera,textures,sky,66,80,50,buffer,depth,1);
    expect(buffer).not.toEqual(before);
  });
  it('supports long station corridors within the existing cell budget', () => {
    const world = { ...voxelGenerate(1), width:112, height:20, depth:22,
      cells:Array(112*20*22).fill(0) };
    expect(validateWorld(world)).toBe(world);
    voxelFill(world, [100,5,2], [8,4,1], 2);
    const player = {x:104,y:7,z:3,angle:0,pitch:0,vz:0};
    expect(voxelMove(world, player, .2, 0).x).toBeCloseTo(104.2);
    const hit = voxelRay(world, {x:104,y:7,z:6}, [0,0,-1], 10,
      undefined, prepareVoxelChunks(world));
    expect(hit).toMatchObject({x:104,y:7,z:2,block:2});
    expect(() => validateWorld({...world,width:128,height:128})).toThrow('55296');
    expect(() => validateWorld({...world,width:4097})).toThrow('Voxel width');
    expect(() => validateWorld({...world,height:4097})).toThrow('Voxel height');
    const boundary = {...world,width:128,height:18,depth:24,cells:Array(55296).fill(0)};
    expect(validateWorld(boundary)).toBe(boundary);
  });
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
    expect(() => renderer.render({ ...camera, x: -1 })).not.toThrow();
  });
});
