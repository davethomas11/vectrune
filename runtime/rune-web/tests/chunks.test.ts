import {makeReactive} from '../src/scope';
import {initContext} from '../src/context';
import {describe,it,expect,vi} from 'vitest';
import {voxelWorld,validateWorld,voxelFill,voxelGet,voxelRay,voxelMine,voxelGenerate,prepareVoxelChunks} from '../src/pixel3d/voxel';
import {chunkStore} from '../src/pixel3d/chunks';
import {Raycaster3D,type Texture} from '../src/pixel3d/raycaster';
import {compileExpression} from '../src/expression';

describe('owned sparse voxel worlds',()=>{
 it('allocates only occupied chunks in a large world and validates without scanning logical cells',()=>{
  const w=voxelWorld(4096,2048,64,['a','b']);
  expect(w.cells.length).toBe(536870912);expect(Array.isArray(w.cells)).toBe(true);
  expect(chunkStore(w)!.raw.size).toBe(0);
  chunkStore(w)!.prepareRenderCells();expect(chunkStore(w)!.renderCells).toBeUndefined();
  voxelFill(w,[3500,1000,3],[8,4,1],2);
  expect(chunkStore(w)!.raw.size).toBe(2);
  const read=vi.spyOn(chunkStore(w)!,'readFlat');
  for(let i=0;i<20;i++)expect(validateWorld(w)).toBe(w);
  expect(read).not.toHaveBeenCalled();
  const alias=w.cells,idx=(4*w.height+1000)*w.width+3501;
  alias[idx]=1;expect(voxelGet(w,3501,1000,4)).toBe(1);
  expect(()=>{alias[idx]=99;}).toThrow('block ID');expect(alias[idx]).toBe(1);
  const saved=JSON.stringify(w);expect(saved.length).toBeLessThan(5000);expect(saved).not.toContain('"cells"');
  const restored=validateWorld(JSON.parse(saved));expect(voxelGet(restored,3501,1000,4)).toBe(1);
  expect(prepareVoxelChunks(restored).count).toBe(3);
  voxelFill(w,[0,0,0],[w.width,w.height,w.depth],0);
  expect(chunkStore(w)!.raw.size).toBe(0);expect(Object.keys(chunkStore(w)!.occupied)).toHaveLength(0);
  expect(()=>voxelFill(w,[0,0,0],[1024,1024,1],1)).toThrow('budget');
  expect(chunkStore(w)!.raw.size).toBe(0);
 });
 it('tracks public chunk edits and frees empty chunks, including retained views',()=>{
  const w=voxelWorld(16,16,16,['a','b']);w.cells[0]=1;
  const store=chunkStore(w)!;store.prepareRenderCells();expect(store.renderCells![0]).toBe(1);
  const view=w.chunks!['0'];view.fill(0);expect(prepareVoxelChunks(w).count).toBe(0);
  view[1]=2;expect(store.renderCells![0]).toBe(0);expect(store.renderCells![1]).toBe(2);expect(w.cells[1]).toBe(2);expect(view[1]).toBe(2);
  const payload=Array(64).fill(0);payload[2]=1;w.chunks!['0']=payload;payload[2]=2;
  expect(w.cells[2]).toBe(1);
  expect(store.renderCells![2]).toBe(1);delete w.chunks!['0'];expect(w.cells[2]).toBe(0);expect(store.renderCells![2]).toBe(0);
  expect(()=>{w.chunks!['1']=Array(63).fill(0);}).toThrow('64');
  expect(()=>{w.chunks!['1']=Array(64);}).toThrow('block ID');
  w.cells[0]=2;w.materials=['a'];expect(()=>validateWorld(w)).toThrow('block ID');
  w.materials=['a','b'];validateWorld(w);
  w.width=15;expect(()=>validateWorld(w)).toThrow('resize');
 });
 it('rejects invalid dimensions, partial-edge solids and unknown storage options',()=>{
  expect(()=>voxelWorld(4097,1,1,['a'])).toThrow('width');
  expect(()=>voxelWorld(4096,4096,256,['a'])).toThrow('logical');
  expect(()=>voxelWorld(5,5,5,['a'],{renderDistance:Infinity})).toThrow('renderDistance');
  expect(()=>voxelWorld(5,5,5,['a'],{typo:true})).toThrow('option');
  const w=voxelWorld(5,5,5,['a']);const edge=Array(64).fill(0);edge[63]=1;
  expect(()=>{w.chunks!['7']=edge;}).toThrow('outside');expect(prepareVoxelChunks(w).count).toBe(0);
  expect(()=>{w.cells[-1]=1;}).toThrow();expect(()=>{w.cells.length=1;}).toThrow('fixed');
 });
 it('preserves fine/coarse ray hits and rendering against dense terrain, including edits',()=>{
  const dense=voxelGenerate(319),sparse=voxelWorld(20,20,10,dense.materials);
  dense.cells.forEach((v,i)=>{if(v)sparse.cells[i]=v;});
  let seed=71;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<2000;i++){
   const origin={x:rnd()*20,y:rnd()*20,z:rnd()*10};const ray:[number,number,number]=[rnd()*2-1,rnd()*2-1,rnd()*2-1];
   expect(voxelRay(sparse,origin,ray,100,undefined,prepareVoxelChunks(sparse))).toEqual(voxelRay(dense,origin,ray,100));
  }
  const textures:Record<string,Texture>=Object.fromEntries(dense.materials.map((n,i)=>[n,{width:1,height:1,pixels:new Uint32Array([0xff102030+i*0x101010])}]));
  const config={width:80,height:50,textures,sprites:{},map:{width:1,height:1,grid:[0],floor:0,ceiling:0}};
  const a=new Raycaster3D({...config,world:dense}),b=new Raycaster3D({...config,world:sparse});
  for(const [angle,pitch] of [[0,0],[123,-15],[270,0]]){
   const camera={...dense.spawn,x:5.5,angle,pitch};a.render(camera);b.render(camera);
   expect(b.buffer).toEqual(a.buffer);expect(b.pixelDepth).toEqual(a.pixelDepth);
  }
  const player={...dense.spawn,x:5.5};expect(voxelMine(sparse,player)).toEqual(voxelMine(dense,player));
 });
 it('traverses beyond the old fixed iteration cap and exposes sparse creation to Rune',()=>{
  const w=voxelWorld(2048,4,4,['a']);voxelFill(w,[1500,1,1],[1,1,1],1);
  const origin={x:1024.5,y:1.5,z:1.5};
  expect(voxelRay(w,origin,[1,0,0],1000)).toMatchObject({x:1500,distance:475.5});
  expect(voxelRay(w,origin,[1,0,0],1000,undefined,prepareVoxelChunks(w))).toEqual(voxelRay(w,origin,[1,0,0],1000));
  const rune=compileExpression('voxel_world(1024, 16, 24, ["a"], {"renderDistance":96})')({});
  expect(rune.width).toBe(1024);expect(rune.storage).toBe('chunked');
 });
});


it('preserves chunk storage across reactive state and JSON restore boundaries',()=>{
 vi.stubGlobal("window",{});
 initContext({app:{state:{},derived:{}},helperDefinitions:{},actionDefinitions:{},derivedDefinitions:{}} as any);
 const world=voxelWorld(32,16,8,['stone']);
 const state=makeReactive({world});
 expect(state.world).toBe(world);voxelFill(state.world,[1,1,1],[2,2,1],1);
 const restored=makeReactive({world:JSON.parse(JSON.stringify(world))});
 expect(voxelGet(validateWorld(restored.world),1,1,1)).toBe(1);
 voxelFill(restored.world,[1,1,1],[1,1,1],0);
 expect(voxelGet(validateWorld(restored.world),1,1,1)).toBe(0);
 vi.unstubAllGlobals();
});
