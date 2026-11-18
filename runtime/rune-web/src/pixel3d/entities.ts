import {ownValue,rawValue} from '../ownership';
// Collections are registered once per synchronous game pass. Local queries
// reuse buckets; Rune position writes relocate indexed entries immediately.
type Entity=Record<string,any>;
interface Row {entity:Entity;key:string;x:number;y:number;z:number;scale:number}
interface Session {indices:WeakMap<object,Map<number,EntityIndex>>;members:WeakMap<object,Set<EntityIndex>>}
let active:Session|undefined;
const groups=new WeakMap<object,{version:number;indices:Map<number,{version:number;index:EntityIndex}>}>();
const ownedEntities=new WeakSet<object>();
let movementSequence=0;
const movementLog:Array<{version:number;entity:Entity}>=Array(4096);
function ownEntity(value:unknown,importedEntities:WeakMap<object,Entity>):Entity {
  value=rawValue(value);
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('entity_group expects entity objects');
  if(ownedEntities.has(value))return value as Entity;
  const known=importedEntities.get(value);if(known)return known;
  const raw={...value};
  const proxy=new Proxy(raw,{
    set:(target,key,next)=>{Reflect.set(target,key,next);if(['x','y','z','visible','scale'].includes(String(key)))entityMoved(proxy);return true;},
    deleteProperty:(target,key)=>{Reflect.deleteProperty(target,key);entityMoved(proxy);return true;},
    defineProperty:()=>{throw new Error('Entity descriptors cannot be redefined');},
  });
  ownValue(proxy);ownedEntities.add(proxy);importedEntities.set(value,proxy);return proxy;
}
/** Owned collections retain their buckets across ticks without scanning sleeping actors. */
export function entityGroup(values:unknown=[]):Entity[] {
  values=rawValue(values);
  if(!Array.isArray(values)||values.length>1000000)throw new Error('entity_group needs an array');
  if(groups.has(values))return values;
  const importedEntities=new WeakMap<object,Entity>();
  const target=values.map(value=>ownEntity(value,importedEntities));
  const proxy=new Proxy(target,{
    set:(array,key,value)=>{
      if(key==='length'){if(!Number.isInteger(value)||value<0||value>array.length)throw new Error('Grow entity groups with push or indexed writes');Reflect.set(array,key,value);}
      else if(typeof key==='string'&&/^\d+$/.test(key)){const i=Number(key);if(i>array.length||i>=1000000)throw new Error('Entity group indices must be contiguous');Reflect.set(array,key,ownEntity(value,importedEntities));}
      else throw new Error('Invalid entity group property');
      entitiesChanged(proxy);return true;
    },
    deleteProperty:(array,key)=>{Reflect.deleteProperty(array,key);entitiesChanged(proxy);return true;},
    defineProperty:()=>{throw new Error('Entity group descriptors cannot be redefined');},
  });
  ownValue(proxy);groups.set(proxy,{version:0,indices:new Map()});return proxy;
}
const session=():Session=>({indices:new WeakMap(),members:new WeakMap()});
export function withEntityQueries<T>(run:()=>T):T {
  const previous=active;active=active??session();try{return run();}finally{active=previous;}
}
class EntityIndex {
  readonly buckets=new Map<string,Set<number>>();
  readonly rows=new Map<number,Row>();
  readonly positions=new Map<object,number[]>();
  readonly scales=new Map<number,number>();
  maxScale=1;
  dirty=false;
  private revision=0;
  constructor(readonly source:Entity[],readonly dimensions:number,readonly owner?:Session){this.rebuild();}
  private key(x:number,y:number,z:number):string{return `${Math.floor(x/16)},${Math.floor(y/16)},${this.dimensions===3?Math.floor(z/16):0}`;}
  rebuild():void {
    this.buckets.clear();this.rows.clear();this.positions.clear();this.scales.clear();this.maxScale=1;this.dirty=false;
    this.source.forEach((entity,i)=>{
      if(!entity||typeof entity!=='object')throw new Error('nearby expects entity objects');
      const positions=this.positions.get(entity)??[];positions.push(i);this.positions.set(entity,positions);
      if(this.owner){const memberships=this.owner.members.get(entity)??new Set();memberships.add(this);this.owner.members.set(entity,memberships);}
      this.place(i,entity);
    });
    this.revision=movementSequence;
  }
  private place(i:number,entity:Entity):void {
    if(entity.visible===false)return;
    const x=entity.x,y=entity.y,z=this.dimensions===3?(entity.z??0):0;
    if(![x,y,z].every(Number.isFinite))throw new Error('nearby entity coordinates must be finite');
    const key=this.key(x,y,z),bucket=this.buckets.get(key)??new Set<number>();
    bucket.add(i);this.buckets.set(key,bucket);const scale=Number.isFinite(entity.scale)&&entity.scale>0?entity.scale:1;
    this.scales.set(scale,(this.scales.get(scale)??0)+1);this.maxScale=Math.max(this.maxScale,scale);
    this.rows.set(i,{entity,key,x,y,z,scale});
  }
  move(entity:Entity):void {
    if(this.dirty)return;
    for(const i of this.positions.get(entity)??[]){
      const row=this.rows.get(i);
      if(row){const bucket=this.buckets.get(row.key)!;bucket.delete(i);if(!bucket.size)this.buckets.delete(row.key);this.rows.delete(i);
        const count=this.scales.get(row.scale)!-1;if(count)this.scales.set(row.scale,count);else this.scales.delete(row.scale);
        if(row.scale===this.maxScale&&!count){this.maxScale=1;for(const scale of this.scales.keys())this.maxScale=Math.max(this.maxScale,scale);}
      }
      this.place(i,entity);
    }
  }
  query(origin:Entity,radius:number,padding=0):Entity[] {
    if(this.dirty)this.rebuild();
    if(!this.owner&&this.revision!==movementSequence){
      if(movementSequence-this.revision>movementLog.length)this.rebuild();
      else{
        const changed=new Set<Entity>();
        for(let version=this.revision+1;version<=movementSequence;version++)changed.add(movementLog[version%movementLog.length].entity);
        for(const entity of changed)if(this.positions.has(entity))this.move(entity);
        this.revision=movementSequence;
      }
    }
    radius+=padding*this.maxScale;
    const minX=Math.floor((origin.x-radius)/16),maxX=Math.floor((origin.x+radius)/16);
    const minY=Math.floor((origin.y-radius)/16),maxY=Math.floor((origin.y+radius)/16);
    const minZ=this.dimensions===3?Math.floor((origin.z-radius)/16):0,maxZ=this.dimensions===3?Math.floor((origin.z+radius)/16):0;
    const matches:number[]=[];
    const inside=(row:Row)=>Math.hypot(row.x-origin.x,row.y-origin.y,this.dimensions===3?row.z-origin.z:0)<=radius;
    if((maxX-minX+1)*(maxY-minY+1)*(maxZ-minZ+1)>this.rows.size*2){
      for(const [i,row] of this.rows)if(inside(row))matches.push(i);
    }else for(let z=minZ;z<=maxZ;z++)for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      for(const i of this.buckets.get(`${x},${y},${z}`)??[])if(inside(this.rows.get(i)!))matches.push(i);
    }
    matches.sort((a,b)=>a-b);return matches.map(i=>this.source[i]);
  }
}
export function nearby<T>(source:T[],origin:unknown,radius:unknown):T[];
export function nearby(source:unknown,origin:unknown,radius:unknown):Entity[];
export function nearby(source:unknown,origin:unknown,radius:unknown):Entity[] {
  return query(source,origin,radius);
}
/** Renderer padding accounts for the largest live scale without rescanning managed groups. */
export function nearbyForRender(source:unknown,origin:unknown,radius:number,padding:number):Entity[] {
  return query(source,origin,radius,padding);
}
function query(source:unknown,origin:unknown,radius:unknown,padding=0):Entity[] {
  source=rawValue(source);
  if(!Array.isArray(source)||source.length>1000000||!origin||typeof origin!=='object'||
    typeof radius!=='number'||!Number.isFinite(radius)||radius<0)throw new Error('nearby needs a collection, position and finite nonnegative radius');
  const point=origin as Entity,dimensions=point.z===undefined?2:3;
  if(![point.x,point.y,...(dimensions===3?[point.z]:[])].every(Number.isFinite))throw new Error('nearby origin must have finite coordinates');
  const group=groups.get(source);
  if(group){
    let indexed=group.indices.get(dimensions);
    if(!indexed||indexed.version!==group.version){indexed={version:group.version,index:new EntityIndex(source,dimensions)};group.indices.set(dimensions,indexed);}
    return indexed.index.query(point,radius,padding);
  }
  const owner=active??session(),indices=owner.indices.get(source)??new Map<number,EntityIndex>();
  let index=indices.get(dimensions);if(!index){index=new EntityIndex(source,dimensions,owner);indices.set(dimensions,index);owner.indices.set(source,indices);}
  return index.query(point,radius,padding);
}
export function entityMoved(value:unknown):void {
  if(value&&typeof value==='object'&&ownedEntities.has(value)){
    movementSequence++;movementLog[movementSequence%movementLog.length]={version:movementSequence,entity:value as Entity};
  }
  if(value&&typeof value==='object')for(const index of active?.members.get(value)??[])index.move(value as Entity);
}
export function entitiesChanged(value:unknown):void {
  if(value&&typeof value==='object'){const group=groups.get(value);if(group)group.version++;}
  if(Array.isArray(value))for(const index of active?.indices.get(value)?.values()??[])index.dirty=true;
}
