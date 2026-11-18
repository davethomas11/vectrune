import {voxelWorld,voxelFill,validateWorld} from '../../runtime/rune-web/src/pixel3d/voxel';
import {chunkStore} from '../../runtime/rune-web/src/pixel3d/chunks';
import {entityGroup,nearby} from '../../runtime/rune-web/src/pixel3d/entities';
import {Raycaster3D} from '../../runtime/rune-web/src/pixel3d/raycaster';

const stats=(times:number[])=>{const sorted=times.slice().sort((a,b)=>a-b);return {median_ms:sorted[Math.floor(sorted.length*.5)],p95_ms:sorted[Math.floor(sorted.length*.95)]};};
const hash=(values:ArrayLike<number>)=>{let h=2166136261;for(let i=0;i<values.length;i++)h=Math.imul(h^values[i],16777619);return h>>>0;};
export function benchmark(){
 const terrain=[];
 for(const width of [256,1024,4096]){
  const world=voxelWorld(width,32,32,['stone'],{renderDistance:48});
  voxelFill(world,[0,0,0],[32,16,2],1);
  voxelFill(world,[width-16,0,0],[16,16,2],1);
  const renderer=new Raycaster3D({width:128,height:80,world,textures:{stone:{width:1,height:1,pixels:new Uint32Array([0xff8899aa])}},sprites:{},map:{width:1,height:1,grid:[0],floor:0,ceiling:0}});
  const camera={x:12.5,y:8.5,z:3,angle:0,pitch:0};
  for(let i=0;i<10;i++)renderer.render(camera);
  const times=[];
  for(let i=0;i<50;i++){const before=performance.now();renderer.render(camera);times.push(performance.now()-before);}
  const before=performance.now();for(let i=0;i<1000;i++)validateWorld(world);
  terrain.push({width,logical_cells:world.cells.length,resident_chunks:chunkStore(world)!.raw.size,render_cache_cells:chunkStore(world)!.renderCells?.length??0,validation_1000_ms:performance.now()-before,...stats(times),pixels:hash(renderer.buffer),depth:hash(new Uint32Array(renderer.pixelDepth.buffer))});
 }
 const entities=[];
 for(const count of [10000,100000]){
  const actors=entityGroup(Array.from({length:count},(_,i)=>({x:i*2,y:0,z:0})));
  nearby(actors,{x:0,y:0,z:0},28);
  const times=[];let maxActive=0;
  for(let frame=0;frame<200;frame++){
   const before=performance.now(),awake=nearby(actors,{x:0,y:0,z:0},28);
   for(const actor of awake)actor.y=frame%2;
   times.push(performance.now()-before);maxActive=Math.max(maxActive,awake.length);
  }
  entities.push({count,max_active:maxActive,...stats(times)});
 }
 return {terrain,entities};
}
