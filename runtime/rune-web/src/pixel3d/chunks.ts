import {ownValue,rawValue} from '../ownership';
// Owned sparse terrain: 4x4x4 cells per chunk, allocated on the first solid write.
// The virtual cells array preserves indexed Rune access without a dense allocation.
export const MAX_WORLD_AXIS = 4096;
export const MAX_WORLD_DEPTH = 256;
export const MAX_RESIDENT_CHUNKS = 16384;
const MAX_RENDER_MIRROR_CELLS = 131072;
export interface ChunkWorld {
  width:number; height:number; depth:number; materials:string[]; cells:number[];
  storage?:string; chunks?:Record<string,number[]>; renderDistance?:number;
  seed?:number; biome?:string; spawn?:unknown;
}
export class ChunkStore {
  readonly raw = new Map<number,number[]>();
  readonly occupied:Record<number,number>|Uint8Array;
  readonly populations = new Map<number,number>();
  readonly publicChunks:Record<string,number[]>;
  readonly cells:number[];
  revision=0;
  renderCells:Uint16Array|undefined;
  /** Bounded render accelerator; large worlds retain sparse lookup. */
  prepareRenderCells():void {
    const volume=this.world.width*this.world.height*this.world.depth;
    if(this.renderCells||volume>MAX_RENDER_MIRROR_CELLS)return;
    this.renderCells=new Uint16Array(volume);
    for(const [id,values] of this.raw)this.mirror(id,values);
  }
  private mirror(id:number,values?:number[]):void {
    if(!this.renderCells)return;
    const bx=(id%this.cw)*4,by=(Math.floor(id/this.cw)%this.ch)*4,bz=Math.floor(id/(this.cw*this.ch))*4;
    for(let i=0;i<64;i++){
      const x=bx+(i&3),y=by+((i>>2)&3),z=bz+(i>>4);
      if(x<this.world.width&&y<this.world.height&&z<this.world.depth)this.renderCells[(z*this.world.height+y)*this.world.width+x]=values?.[i]??0;
    }
  }
  private readonly proxies = new Map<number,number[]>();
  private materialCount:number;
  readonly cw:number; readonly ch:number; readonly cd:number;
  private readonly dimensions:number[];
  constructor(readonly world:ChunkWorld, imported:Record<string,number[]> = {}) {
    this.dimensions=[world.width,world.height,world.depth];
    this.cw=Math.ceil(world.width/4);this.ch=Math.ceil(world.height/4);this.cd=Math.ceil(world.depth/4);
    this.occupied=this.cw*this.ch*this.cd<=65536?new Uint8Array(this.cw*this.ch*this.cd):Object.create(null);
    this.materialCount=world.materials.length;
    this.publicChunks=new Proxy(Object.create(null),{
      get:(_t,key)=>typeof key==='string'&&/^\d+$/.test(key)?this.proxies.get(Number(key)):undefined,
      ownKeys:()=>[...this.raw.keys()].map(String),
      getOwnPropertyDescriptor:(_t,key)=>this.raw.has(Number(key))?{enumerable:true,configurable:true}:undefined,
      set:(_t,key,value)=>{this.replace(Number(key),value);return true;},
      deleteProperty:(_t,key)=>{this.remove(Number(key));return true;},
      defineProperty:()=>{throw new Error('Chunk descriptors cannot be redefined');},
    });
    const volume=world.width*world.height*world.depth;
    const target:number[]=[];target.length=volume;
    this.cells=new Proxy(target,{
      get:(t,key,receiver)=>key==='length'?volume:typeof key==='string'&&/^\d+$/.test(key)?this.readFlat(Number(key)):Reflect.get(t,key,receiver),
      set:(_t,key,value)=>{
        if(typeof key!=='string'||!/^\d+$/.test(key))throw new Error('Chunked cells have a fixed length; write a cell index');
        this.writeFlat(Number(key),value);return true;
      },
      has:(t,key)=>typeof key==='string'&&/^\d+$/.test(key)?Number(key)<volume:Reflect.has(t,key),
      deleteProperty:(_t,key)=>{this.writeFlat(Number(key),0);return true;},
      defineProperty:()=>{throw new Error('Chunked cells cannot be redefined');},
    });
    const entries=Object.entries(imported);
    if(entries.length>MAX_RESIDENT_CHUNKS)throw new Error('Chunked world exceeds resident chunk budget');
    for(const [key,values] of entries)this.replace(Number(key),values);
  }
  private id(value:number):void {
    if(!Number.isInteger(value)||value<0||value>=this.cw*this.ch*this.cd)throw new Error('Invalid voxel chunk index');
  }
  private block(value:number):void {
    if(!Number.isInteger(value)||value<0||value>this.world.materials.length)throw new Error('Invalid voxel block ID');
  }
  private cell(id:number,cell:number,value:number):void {
    this.block(value);
    if(value && ((id%this.cw)*4+(cell&3)>=this.world.width ||
      (Math.floor(id/this.cw)%this.ch)*4+((cell>>2)&3)>=this.world.height ||
      Math.floor(id/(this.cw*this.ch))*4+(cell>>4)>=this.world.depth))throw new Error('Solid chunk cell outside world');
  }
  private replace(id:number,values:number[]):void {
    this.id(id);
    if(!Array.isArray(values)||values.length!==64)throw new Error('Voxel chunks need exactly 64 block IDs');
    for(let cell=0;cell<64;cell++)this.cell(id,cell,values[cell]);
    const count=values.reduce((n,v)=>n+(v!==0?1:0),0);
    if(!count){this.remove(id);return;}
    if(!this.raw.has(id)&&this.raw.size>=MAX_RESIDENT_CHUNKS)throw new Error('Chunked world exceeds resident chunk budget');
    // Copy caller data so all live mutations go through a tracked view.
    const raw=values.slice();this.raw.set(id,raw);this.populations.set(id,count);this.occupied[id]=1;this.mirror(id,raw);
    this.proxies.set(id,new Proxy(raw,{
      get:(t,key,receiver)=>typeof key==='string'&&/^\d+$/.test(key)?this.raw.get(id)?.[Number(key)]??0:Reflect.get(t,key,receiver),
      set:(_t,key,value)=>{if(typeof key!=='string'||!/^\d+$/.test(key)||Number(key)>=64)throw new Error('Voxel chunks have fixed length');this.writeChunk(id,Number(key),value);return true;},
      deleteProperty:(_t,key)=>{const cell=Number(key);if(!Number.isInteger(cell)||cell<0||cell>=64)throw new Error('Invalid chunk cell');this.writeChunk(id,cell,0);return true;},
      defineProperty:()=>{throw new Error('Chunk cells cannot be redefined');},
    }));
    this.revision++;
  }
  private remove(id:number):void {
    this.id(id);if(this.raw.delete(id)){this.mirror(id);this.proxies.delete(id);this.populations.delete(id);if(this.occupied instanceof Uint8Array)this.occupied[id]=0;else delete this.occupied[id];this.revision++;}
  }
  private writeChunk(id:number,cell:number,value:number):void {
    this.cell(id,cell,value);
    let raw=this.raw.get(id);
    if(!raw){if(!value)return;this.replace(id,Array(64).fill(0).map((_,i)=>i===cell?value:0));return;}
    const previous=raw[cell];if(previous===value)return;
    raw[cell]=value;
    if(this.renderCells){const x=(id%this.cw)*4+(cell&3),y=(Math.floor(id/this.cw)%this.ch)*4+((cell>>2)&3),z=Math.floor(id/(this.cw*this.ch))*4+(cell>>4);this.renderCells[(z*this.world.height+y)*this.world.width+x]=value;}
    const count=this.populations.get(id)!+(value?1:0)-(previous?1:0);
    if(!count)this.remove(id);else{this.populations.set(id,count);this.revision++;}
  }
  /** Fill only intersecting chunks; preflight capacity before changing terrain. */
  fill(from:number[],size:number[],block:number):void {
    const end=from.map((v,i)=>v+size[i]),lo=from.map(v=>v>>2),hi=end.map(v=>(v-1)>>2);
    let ids:number[];
    if(block===0)ids=[...this.raw.keys()];
    else {
      if((hi[0]-lo[0]+1)*(hi[1]-lo[1]+1)*(hi[2]-lo[2]+1)>MAX_RESIDENT_CHUNKS)throw new Error('Chunked world exceeds resident chunk budget');
      ids=[];let count=this.raw.size;
      for(let z=lo[2];z<=hi[2];z++)for(let y=lo[1];y<=hi[1];y++)for(let x=lo[0];x<=hi[0];x++){
        const id=(z*this.ch+y)*this.cw+x;ids.push(id);
        if(!this.raw.has(id)&&++count>MAX_RESIDENT_CHUNKS)throw new Error('Chunked world exceeds resident chunk budget');
      }
    }
    for(const id of ids){
      const bx=(id%this.cw)*4,by=(Math.floor(id/this.cw)%this.ch)*4,bz=Math.floor(id/(this.cw*this.ch))*4;
      for(let z=Math.max(from[2],bz);z<Math.min(end[2],bz+4);z++)
        for(let y=Math.max(from[1],by);y<Math.min(end[1],by+4);y++)
          for(let x=Math.max(from[0],bx);x<Math.min(end[0],bx+4);x++)this.writeChunk(id,((z&3)*4+(y&3))*4+(x&3),block);
    }
  }
  readFlat(i:number):number {
    const {width,height,depth}=this.world;
    if(!Number.isInteger(i)||i<0||i>=width*height*depth)return undefined as unknown as number;
    const x=i%width,yz=Math.floor(i/width),y=yz%height,z=Math.floor(yz/height);
    return this.raw.get(((z>>2)*this.ch+(y>>2))*this.cw+(x>>2))?.[((z&3)*4+(y&3))*4+(x&3)]??0;
  }
  writeFlat(i:number,value:number):void {
    const {width,height,depth}=this.world;
    if(!Number.isInteger(i)||i<0||i>=width*height*depth)throw new Error('Voxel cell index outside world');
    const x=i%width,yz=Math.floor(i/width),y=yz%height,z=Math.floor(yz/height);
    this.writeChunk(((z>>2)*this.ch+(y>>2))*this.cw+(x>>2),((z&3)*4+(y&3))*4+(x&3),value);
  }
  validate():void {
    if(this.world.width!==this.dimensions[0]||this.world.height!==this.dimensions[1]||this.world.depth!==this.dimensions[2])throw new Error('Recreate chunked worlds to resize them');
    if(this.materialCount!==this.world.materials.length){for(const raw of this.raw.values())for(const block of raw)this.block(block);this.materialCount=this.world.materials.length;}
    if(this.world.cells!==this.cells||this.world.chunks!==this.publicChunks)throw new Error('Use cell writes or recreate a chunked world to replace its storage');
  }
}
const stores=new WeakMap<object,ChunkStore>();
export function chunkStore(world:object):ChunkStore|undefined{return stores.get(world)??stores.get(rawValue(world));}
export function ownChunks<T extends ChunkWorld>(world:T):ChunkStore {
  world=rawValue(world);
  let store=stores.get(world);if(store)return store;
  store=new ChunkStore(world,world.chunks);stores.set(world,store);
  ownValue(world);ownValue(store.publicChunks);ownValue(store.cells);
  world.chunks=store.publicChunks;
  Object.defineProperty(world,'cells',{value:store.cells,writable:true,configurable:true,enumerable:false});
  return store;
}
