import {rawValue} from '../ownership';
import type { Texture, Camera3D } from './raycaster';
import { skyPixel, type Sky } from './sky';
import { chunkStore, ownChunks, MAX_WORLD_AXIS, MAX_WORLD_DEPTH, type ChunkStore } from './chunks';

export interface VoxelWorld {
  width: number;
  height: number;
  depth: number;
  seed: number;
  biome: 'meadow' | 'ember';
  materials: string[];
  cells: number[];
  spawn: VoxelPlayer;
  storage?: 'chunked';
  chunks?: Record<string,number[]>;
  renderDistance?: number;
}
export interface VoxelPlayer {
  x: number; y: number; z: number; angle: number; pitch: number; vz: number;
}
export interface VoxelHit {
  x: number; y: number; z: number; block: number; distance: number; face: number;
}

export interface VoxelTerrainPose {
  world: VoxelWorld;
  pivot: [number, number];
  position: [number, number];
  angle: number;
}

/** Occupancy is updated only for changed cells; snapshots detect even raw array writes. */
export interface VoxelChunks {
  width: number;
  height: number;
  depth: number;
  occupied: Uint8Array | Record<number,number>;
  count: number;
}
interface WorldSnapshot {
  width: number; height: number; depth: number; materialCount: number;
  cells: Uint16Array; populations: Uint8Array; chunks: VoxelChunks;
}
const worldSnapshots = new WeakMap<VoxelWorld, WorldSnapshot>();
function inspectWorld(world: VoxelWorld): VoxelChunks {
  let snapshot = worldSnapshots.get(world);
  const width = Math.ceil(world.width/4), height = Math.ceil(world.height/4);
  const length = width*height*Math.ceil(world.depth/4);
  if (!snapshot || snapshot.width !== world.width || snapshot.height !== world.height || snapshot.depth !== world.depth) {
    snapshot = {width:world.width,height:world.height,depth:world.depth,materialCount:-1,
      cells:new Uint16Array(world.cells.length),populations:new Uint8Array(length),
      chunks:{width,height,depth:Math.ceil(world.depth/4),occupied:new Uint8Array(length),count:0}};
    worldSnapshots.set(world,snapshot);
  }
  const {cells,populations,chunks} = snapshot, limit = world.materials.length;
  const validateAll = snapshot.materialCount !== limit;
  for (let i=0;i<world.cells.length;i++) {
    const block = world.cells[i], previous = cells[i];
    if (block === previous && !validateAll) continue;
    if (!Number.isInteger(block) || block < 0 || block > limit) {
      // A failed validation cannot leave a partially updated snapshot trusted.
      worldSnapshots.delete(world);
      throw new Error('Voxel world needs material names and an exactly sized array of valid block IDs');
    }
    if (!!block !== !!previous) {
      const x = i%world.width, yz = Math.floor(i/world.width);
      const y = yz%world.height, z = Math.floor(yz/world.height);
      const chunk = ((z>>2)*height+(y>>2))*width+(x>>2);
      populations[chunk] += block ? 1 : -1;
      if (populations[chunk] === 1 && block) {chunks.occupied[chunk]=1;chunks.count++;}
      if (populations[chunk] === 0 && !block) {chunks.occupied[chunk]=0;chunks.count--;}
    }
    cells[i] = block;
  }
  snapshot.materialCount = limit;
  return chunks;
}
export function prepareVoxelChunks(world: VoxelWorld): VoxelChunks {
  if(world.storage==='chunked'&&!chunkStore(world))validateWorld(world);
  const store=chunkStore(world);
  if(store)return sparseMetadata(store);
  return inspectWorld(world);
}
const sparseChunks=new WeakMap<ChunkStore,VoxelChunks>();
function sparseMetadata(store:ChunkStore):VoxelChunks {
  let chunks=sparseChunks.get(store);
  if(!chunks){chunks={width:store.cw,height:store.ch,depth:store.cd,occupied:store.occupied,count:0};sparseChunks.set(store,chunks);}
  chunks.count=store.raw.size;return chunks;
}
/** Only consume immediately after validateWorld, in the same synchronous frame. */
export function validatedVoxelChunks(world: VoxelWorld): VoxelChunks | undefined {
  const store=chunkStore(world);
  return store?sparseMetadata(store):worldSnapshots.get(world)?.chunks;
}

function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return value;
}
export function validateWorld(value: unknown): VoxelWorld {
  if (!value || typeof value !== 'object') throw new Error('Voxel world must be an object');
  const world = rawValue(value) as VoxelWorld;
  if(chunkStore(world)&&world.storage!=='chunked')throw new Error('Chunked world storage cannot be changed');
  integer(world.width, 1, MAX_WORLD_AXIS, 'Voxel width');
  integer(world.height, 1, MAX_WORLD_AXIS, 'Voxel height');
  integer(world.depth, 1, world.storage==='chunked'?MAX_WORLD_DEPTH:24, 'Voxel depth');
  if(world.renderDistance!==undefined&&(!Number.isFinite(world.renderDistance)||world.renderDistance<=0||world.renderDistance>4096))throw new Error('Voxel renderDistance must be in (0, 4096]');
  // Long corridors may trade breadth for length without raising the cell budget.
  if (world.storage!=='chunked' && world.width * world.height * world.depth > 48 * 48 * 24) {
    throw new Error('Voxel world must contain at most 55296 cells');
  }
  if (!Array.isArray(world.materials) || world.materials.length < 1 || world.materials.length > 256 ||
      !world.materials.every(name => typeof name === 'string' && name.length > 0)) {
    throw new Error('Voxel world needs material names and an exactly sized array of valid block IDs');
  }
  if(world.storage==='chunked'){
    if(world.width*world.height*world.depth>2147483647)throw new Error('Chunked world exceeds logical cell limit');
    if(world.chunks!==undefined&&(!world.chunks||typeof world.chunks!=='object'||Array.isArray(world.chunks)))throw new Error('Chunked world chunks must be a record');
    (chunkStore(world)??ownChunks(world)).validate();return world;
  }
  if(world.storage!==undefined)throw new Error('Unknown voxel storage');
  if(!Array.isArray(world.cells)||world.cells.length!==world.width*world.height*world.depth)throw new Error('Voxel world needs material names and an exactly sized array of valid block IDs');
  inspectWorld(world);
  return world;
}
/** Sparse, serializable world with owned, revision-tracked cell/chunk views. */
export function voxelWorld(width:unknown,height:unknown,depth:unknown,materials:unknown,options:unknown={}):VoxelWorld {
  if(!options||typeof options!=='object'||Array.isArray(options))throw new Error('Voxel world options must be an object');
  const opts=options as Record<string,any>;
  if(Object.keys(opts).some(k=>!['seed','biome','spawn','renderDistance'].includes(k)))throw new Error('Unknown voxel world option');
  const world={width,height,depth,materials:Array.isArray(materials)?materials.slice():materials,
    seed:opts.seed??0,biome:opts.biome??'meadow',spawn:opts.spawn??{x:.5,y:.5,z:1,angle:0,pitch:0,vz:0},
    storage:'chunked',chunks:{},renderDistance:opts.renderDistance??128} as VoxelWorld;
  return validateWorld(world);
}
function index(world: VoxelWorld, x: number, y: number, z: number): number {
  return (z * world.height + y) * world.width + x;
}
export function voxelGet(world: VoxelWorld, x: number, y: number, z: number): number {
  if (x < 0 || y < 0 || z < 0 || x >= world.width || y >= world.height || z >= world.depth) return 0;
  const store=chunkStore(world);
  return store?store.readFlat(index(world,x,y,z)):world.cells[index(world, x, y, z)];
}
export function voxelRead(worldValue: unknown, xValue: unknown, yValue: unknown, zValue: unknown): number {
  const world = validateWorld(worldValue);
  const x = integer(xValue, 0, world.width - 1, 'Voxel x');
  const y = integer(yValue, 0, world.height - 1, 'Voxel y');
  const z = integer(zValue, 0, world.depth - 1, 'Voxel z');
  return voxelGet(world, x, y, z);
}
export function voxelFill(worldValue: unknown, fromValue: unknown, sizeValue: unknown, blockValue: unknown): VoxelWorld {
  const world = validateWorld(worldValue);
  if (!Array.isArray(fromValue) || !Array.isArray(sizeValue) || fromValue.length !== 3 || sizeValue.length !== 3) {
    throw new Error('Voxel fill needs from and size arrays with three integers');
  }
  const limits = [world.width, world.height, world.depth];
  const from = fromValue.map((v, i) => integer(v, 0, limits[i] - 1, 'Voxel fill origin'));
  const size = sizeValue.map((v, i) => integer(v, 1, limits[i] - from[i], 'Voxel fill size'));
  const block = integer(blockValue, 0, world.materials.length, 'Voxel fill block');
  const store=chunkStore(world);
  if(store){store.fill(from,size,block);return world;}
  for (let z = from[2]; z < from[2] + size[2]; z++) for (let y = from[1]; y < from[1] + size[1]; y++) {
    for (let x = from[0]; x < from[0] + size[0]; x++) world.cells[index(world, x, y, z)] = block;
  }
  return world;
}
function noise(x: number, y: number, seed: number): number {
  let hash = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ seed;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return (hash >>> 0) / 4294967296;
}

/** A bounded starter biome with a safe camp and a terraced entrance into a generated cave. */
export function voxelGenerate(seedValue: unknown, biomeValue: unknown = 'meadow'): VoxelWorld {
  const seed = integer(seedValue, 0, 4294967295, 'Voxel seed');
  if (biomeValue !== 'meadow' && biomeValue !== 'ember') throw new Error('Voxel biome must be meadow or ember');
  const world: VoxelWorld = {
    width: 20, height: 20, depth: 10, seed, biome: biomeValue,
    materials: ['miners/bedrock', 'miners/stone', biomeValue === 'ember' ? 'miners/ash' : 'miners/grass',
      'miners/wood', 'miners/copper', biomeValue === 'ember' ? 'miners/ember' : 'miners/leaves'],
    cells: Array(4000).fill(0), spawn: { x: 4.5, y: 4.5, z: 3, angle: 0, pitch: 0, vz: 0 },
  };
  const set = (x: number, y: number, z: number, block: number) => { world.cells[index(world, x, y, z)] = block; };
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const camp = x < 9 && y < 9;
    const top = camp ? 3 : 3 + Math.floor(noise(Math.floor(x / 3), Math.floor(y / 3), seed + (biomeValue === 'ember' ? 137 : 0)) * 3);
    for (let z = 0; z < top; z++) set(x, y, z, z === 0 ? 1 : z === top - 1 ? 3 : noise(x + z * 13, y, seed) > .87 ? 5 : 2);
    if (!camp && x > 1 && y > 1 && x < 18 && y < 18 && noise(x, y, seed + 1) > .94) {
      for (let z = top; z < top + 2; z++) set(x, y, z, 4);
      set(x, y, top + 2, 6);
    }
  }
  // The playable slice guarantees a reachable mine rather than leaving progression to chance.
  for (let x = 8; x < 19; x++) for (let y = 9; y <= 14; y++) {
    const floor = x < 10 ? 3 : x < 12 ? 2 : 1;
    for (let z = floor; z <= (x < 12 ? 8 : 3); z++) set(x, y, z, 0);
    if (x >= 12) set(x, y, 4, 2);
  }
  for (let x = 12; x < 19; x++) {
    set(x, 8, 2, noise(x, 8, seed) > .4 ? 5 : 2);
    set(x, 15, 2, noise(x, 15, seed) > .4 ? 5 : 2);
  }
  for (let y = 9; y <= 14; y++) for (let z = 1; z <= 4; z++) set(19, y, z, 2);
  for (let x = 3; x <= 5; x++) for (let y = 3; y <= 5; y++) set(x, y, 2, 1);
  for (const [x, y, z, block] of [[7,4,3,4],[7,4,4,4],[7,5,3,4],
    [8,6,3,2],[8,6,4,2],[8,7,3,2],[9,6,3,5],[9,7,3,5]]) set(x,y,z,block);
  return world;
}


/** Coarse traversal is conservative around tied boundaries; fine DDA owns hits. */
function chunkEntry(chunks: VoxelChunks, x: number, y: number, z: number,
  tx: number, ty: number, tz: number, dx: number, dy: number, dz: number,
  sx: number, sy: number, sz: number, maxDistance: number): number {
  let ex = Number.isFinite(tx) ? tx + (sx > 0 ? 3 - (x & 3) : x & 3) * dx : Infinity;
  let ey = Number.isFinite(ty) ? ty + (sy > 0 ? 3 - (y & 3) : y & 3) * dy : Infinity;
  let ez = Number.isFinite(tz) ? tz + (sz > 0 ? 3 - (z & 3) : z & 3) * dz : Infinity;
  x >>= 2; y >>= 2; z >>= 2;
  const width = chunks.width, height = chunks.height, depth = chunks.depth;
  const stepX = dx * 4, stepY = dy * 4, stepZ = dz * 4;
  const exitX = sx > 0 ? width : -1, exitY = sy > 0 ? height : -1, exitZ = sz > 0 ? depth : -1;
  let cellIndex = (z * height + y) * width + x;
  let entry = 0;
  while (true) {
    if (chunks.occupied[cellIndex]) return entry;
    const axis = ex < ey && ex < ez ? 0 : (ey < ez ? 1 : 2);
    const next = axis === 0 ? ex : (axis === 1 ? ey : ez);
    if (!Number.isFinite(next) || next > maxDistance) return Infinity;
    const tolerance = 1e-9 * Math.max(1, next);
    // A grazing ray can touch several chunks at once. Hand those boundaries to
    // the original traversal rather than risk discarding an edge-touching voxel.
    if (axis === 0 ? ey-next <= tolerance || ez-next <= tolerance :
        (axis === 1 ? ex-next <= tolerance || ez-next <= tolerance : ex-next <= tolerance || ey-next <= tolerance)) return entry;
    entry = next;
    if (axis === 0) {
      x += sx; ex += stepX; cellIndex += sx;
      if (x === exitX) return Infinity;
    } else if (axis === 1) {
      y += sy; ey += stepY; cellIndex += sy * width;
      if (y === exitY) return Infinity;
    } else {
      z += sz; ez += stepZ; cellIndex += sz * width * height;
      if (z === exitZ) return Infinity;
    }
  }
}

export function voxelRay(world: VoxelWorld, origin: { x: number; y: number; z: number },
  ray: [number, number, number], maxDistance: number, output?: VoxelHit, chunks?: VoxelChunks): VoxelHit | null {
  const store = chunkStore(world);
  return traceVoxelRay(world, store?.renderCells ?? world.cells, store?.renderCells ? undefined : store,
    origin.x, origin.y, origin.z, ray[0], ray[1], ray[2],
    Math.abs(1 / ray[0]), Math.abs(1 / ray[1]), Math.abs(1 / ray[2]), maxDistance, output, chunks);
}

/** Rendering supplies cached ray components; gameplay keeps the tuple-based API. */
function traceVoxelRay(world: VoxelWorld, cells: ArrayLike<number>, store: ChunkStore | undefined,
  ox: number, oy: number, oz: number,
  rx: number, ry: number, rz: number, dx: number, dy: number, dz: number,
  maxDistance: number, output?: VoxelHit, chunks?: VoxelChunks,
  crossings?: RayCrossings, column = 0, row = 0, entryFace = 2): VoxelHit | null {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const width = world.width, height = world.height, depth = world.depth;
  let lastChunk=-1, blocks:number[]|undefined;
  if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return null;
  const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1, sz = rz < 0 ? -1 : 1;
  const stepY = sy * width, stepZ = sz * width * height;
  let cellIndex = (z * height + y) * width + x;
  let tx = rx === 0 ? Infinity : (sx < 0 ? ox - x : x + 1 - ox) * dx;
  let ty = ry === 0 ? Infinity : (sy < 0 ? oy - y : y + 1 - oy) * dy;
  let tz = rz === 0 ? Infinity : (sz < 0 ? oz - z : z + 1 - oz) * dz;
  if (chunks && (rx !== 0 || ry !== 0 || rz !== 0)) {
    const entry = chunkEntry(chunks, x, y, z, tx, ty, tz, dx, dy, dz, sx, sy, sz, maxDistance);
    if (!Number.isFinite(entry)) return null;
    // Stop conservatively before the first potentially occupied chunk. Repeated
    // additions retain fine-DDA distance bits; fine traversal resolves entry faces.
    const beforeEntry = entry - 1e-9 * Math.max(1, entry);
    if (crossings) {
      if (tx < beforeEntry) {
        const offset = column * crossings.strideX;
        const count = crossingBefore(crossings.x, offset, crossings.strideX, beforeEntry, dx);
        x += sx * count; tx = crossings.x[offset + count];
      }
      if (ty < beforeEntry) {
        const offset = column * crossings.strideY;
        const count = crossingBefore(crossings.y, offset, crossings.strideY, beforeEntry, dy);
        y += sy * count; ty = crossings.y[offset + count];
      }
      if (tz < beforeEntry) {
        const offset = row * crossings.strideZ;
        const count = crossingBefore(crossings.z, offset, crossings.strideZ, beforeEntry, dz);
        z += sz * count; tz = crossings.z[offset + count];
      }
    } else {
      while (tx < beforeEntry) { x += sx; tx += dx; }
      while (ty < beforeEntry) { y += sy; ty += dy; }
      while (tz < beforeEntry) { z += sz; tz += dz; }
    }
    cellIndex = (z * height + y) * width + x;
  }
  if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return null;
  const exitX = sx > 0 ? width : -1, exitY = sy > 0 ? height : -1, exitZ = sz > 0 ? depth : -1;
  let distance = 0, face = entryFace;
  while (distance <= maxDistance) {
    let block:number;
    if(store){
      const chunk=((z>>2)*store.ch+(y>>2))*store.cw+(x>>2);
      if(chunk!==lastChunk){blocks=store.raw.get(chunk);lastChunk=chunk;}
      block=blocks?.[((z&3)*4+(y&3))*4+(x&3)]??0;
    }else block=cells[cellIndex];
    if (block) {
      if (!output) return { x, y, z, block, distance, face };
      output.x = x; output.y = y; output.z = z;
      output.block = block; output.distance = distance; output.face = face;
      return output;
    }
    // Only the stepped coordinate can leave the volume. Keep the same crossing
    // order and repeated additions so boundary faces and depth stay bit-exact.
    if (tx < ty && tx < tz) {
      face = 0; distance = tx; tx += dx; x += sx; cellIndex += sx;
      if (x === exitX) break;
    } else if (ty < tz) {
      face = 1; distance = ty; ty += dy; y += sy; cellIndex += stepY;
      if (y === exitY) break;
    } else {
      face = 2; distance = tz; tz += dz; z += sz; cellIndex += stepZ;
      if (z === exitZ) break;
    }
  }
  return null;
}

const sideShade = Uint8Array.from({length: 256}, (_, channel) => Math.floor(channel * .8));
const frontShade = Uint8Array.from({length: 256}, (_, channel) => Math.floor(channel * .65));

function wrappedTexel(point: number, size: number): number {
  const wrapped = point - Math.trunc(point) + 1;
  return Math.floor((wrapped >= 1 ? wrapped - 1 : wrapped) * size);
}

function traceTerrainPose(world: VoxelWorld, cells: ArrayLike<number>, store: ChunkStore | undefined,
  origin: { x: number; y: number; z: number },
  rx: number, ry: number, rz: number, limit: number, output: VoxelHit, chunks?: VoxelChunks): VoxelHit | null {
  const { x, y, z } = origin;
  const enterX = terrainEntry(x, rx, world.width);
  const enterY = terrainEntry(y, ry, world.height);
  const enterZ = terrainEntry(z, rz, world.depth);
  const entry = Math.max(enterX, enterY, enterZ);
  if (entry > limit) return null;
  if (entry < 0) {
    return traceVoxelRay(world, cells, store, x, y, z, rx, ry, rz,
      Math.abs(1 / rx), Math.abs(1 / ry), Math.abs(1 / rz), limit, output, chunks);
  }
  const exit = Math.min(rx === 0 ? Infinity : ((rx > 0 ? world.width : 0) - x) / rx,
    ry === 0 ? Infinity : ((ry > 0 ? world.height : 0) - y) / ry,
    rz === 0 ? Infinity : ((rz > 0 ? world.depth : 0) - z) / rz);
  if (entry >= exit) return null;
  // Step just inside before DDA. Subtract the epsilon for a hit on the entry face.
  const start = entry + Math.min(1e-7, (exit - entry) / 2);
  const face = entry === enterX ? 0 : entry === enterY ? 1 : 2;
  const hit = traceVoxelRay(world, cells, store, x + rx * start, y + ry * start, z + rz * start,
    rx, ry, rz, Math.abs(1 / rx), Math.abs(1 / ry), Math.abs(1 / rz), limit - start, output, chunks, undefined, 0, 0, face);
  if (hit) hit.distance += hit.distance === 0 ? entry : start;
  return hit;
}

function terrainEntry(origin: number, direction: number, end: number): number {
  if (origin <= 0 && direction > 0) return -origin / direction;
  if (origin >= end && direction < 0) return (end - origin) / direction;
  return origin < 0 || origin >= end ? Infinity : -Infinity;
}

export function voxelTarget(worldValue: unknown, playerValue: unknown): VoxelHit | null {
  const world = validateWorld(worldValue), player = validatePlayer(playerValue, world);
  const a = player.angle * Math.PI / 180, p = player.pitch * Math.PI / 180;
  return voxelRay(world, { x: player.x, y: player.y, z: player.z + 1.25 },
    [Math.cos(a) * Math.cos(p), Math.sin(a) * Math.cos(p), Math.sin(p)], 3);
}
function validatePlayer(value: unknown, world: VoxelWorld): VoxelPlayer {
  if (!value || typeof value !== 'object') throw new Error('Voxel player must be an object');
  const player = value as VoxelPlayer;
  if (![player.x, player.y, player.z, player.angle, player.pitch, player.vz].every(Number.isFinite)) {
    throw new Error('Voxel player needs finite x, y, z, angle, pitch and vz');
  }
  if (player.x < .25 || player.y < .25 || player.x > world.width - .25 || player.y > world.height - .25 ||
      player.z < 1 || player.z + 1.6 > world.depth || Math.abs(player.vz) > 1 || Math.abs(player.pitch) > 90) {
    throw new Error('Voxel player must be inside movement bounds, with pitch within 90 degrees and vz within 1');
  }
  return player;
}
export function voxelMine(worldValue: unknown, playerValue: unknown): { block: number; hit: VoxelHit | null } {
  const world = validateWorld(worldValue);
  const hit = voxelTarget(world, playerValue);
  if (!hit || hit.block === 1) return { block: 0, hit };
  world.cells[index(world, hit.x, hit.y, hit.z)] = 0;
  return { block: hit.block, hit };
}
function clearBody(world: VoxelWorld, x: number, y: number, z: number): boolean {
  if (x < .25 || y < .25 || x > world.width - .25 || y > world.height - .25 || z < 1 || z + 1.6 > world.depth) return false;
  for (const dx of [-.24, .24]) for (const dy of [-.24, .24]) {
    for (let bz = Math.floor(z + .001); bz <= Math.floor(z + 1.599); bz++) {
      if (voxelGet(world, Math.floor(x + dx), Math.floor(y + dy), bz)) return false;
    }
  }
  return true;
}
/** Optional platformer tuning; legacy exploration movement keeps its defaults. */
export interface VoxelMovement {
  jumpSpeed?: number;
  gravity?: number;
  autoStep?: boolean;
}
export function voxelMove(worldValue: unknown, playerValue: unknown, dxValue: unknown, dyValue: unknown, jumpValue: unknown = false, movementValue: unknown = {}): VoxelPlayer {
  const world = validateWorld(worldValue), p = { ...validatePlayer(playerValue, world) };
  if (!movementValue || typeof movementValue !== 'object' || Array.isArray(movementValue) ||
      Object.keys(movementValue).some(key => !['jumpSpeed', 'gravity', 'autoStep'].includes(key))) {
    throw new Error('Voxel movement options accept jumpSpeed, gravity and autoStep');
  }
  const { jumpSpeed = .28, gravity = .035, autoStep = true } = movementValue as VoxelMovement;
  if (!Number.isFinite(jumpSpeed) || jumpSpeed <= 0 || jumpSpeed > 1 ||
      !Number.isFinite(gravity) || gravity <= 0 || gravity > .3 || typeof autoStep !== 'boolean') {
    throw new Error('Voxel movement needs jumpSpeed in (0, 1], gravity in (0, 0.3] and boolean autoStep');
  }
  if (typeof dxValue !== 'number' || typeof dyValue !== 'number' || !Number.isFinite(dxValue) ||
      !Number.isFinite(dyValue) || Math.hypot(dxValue, dyValue) > 1 || typeof jumpValue !== 'boolean') {
    throw new Error('Voxel movement needs finite deltas of at most one tile and a boolean jump');
  }
  const grounded = !clearBody(world, p.x, p.y, p.z - .05);
  if (jumpValue && grounded) p.vz = jumpSpeed;
  p.vz = Math.max(-.3, p.vz - gravity);
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dxValue), Math.abs(dyValue), Math.abs(p.vz)) / .05));
  for (let i = 0; i < steps; i++) {
    for (const [axis, delta] of [['x', dxValue / steps], ['y', dyValue / steps]] as const) {
      const x = p.x + (axis === 'x' ? delta : 0), y = p.y + (axis === 'y' ? delta : 0);
      if (clearBody(world, x, y, p.z)) p[axis] += delta;
      else if (autoStep && grounded && delta !== 0 && clearBody(world, x, y, Math.floor(p.z) + 1)) {
        p.z = Math.floor(p.z) + 1; p[axis] += delta; p.vz = 0;
      }
    }
    if (clearBody(world, p.x, p.y, p.z + p.vz / steps)) p.z += p.vz / steps;
    else { if (p.vz < 0) p.z = Math.round(p.z); p.vz = 0; }
  }
  return p;
}

interface CameraRays {
  width: number; height: number; angle: number; fov: number;
  columns: Float64Array; rows: Float64Array;
  longitudes: Float64Array;
}

interface RayCrossings {
  originX: number; originY: number; originZ: number;
  angle: number; fov: number; width: number; height: number;
  strideX: number; strideY: number; strideZ: number;
  x: Float64Array; y: Float64Array; z: Float64Array;
}
const crossingScratch = new WeakMap<Float64Array, RayCrossings>();

function fillCrossings(values: Float64Array, offset: number, stride: number,
  position: number, component: number, delta: number): void {
  const cell = Math.floor(position);
  let next = component === 0 ? Infinity : (component < 0 ? position-cell : cell+1-position) * delta;
  for (let i = 0; i < stride; i++) { values[offset+i] = next; next += delta; }
}

/** Estimate an index, then correct against the exact repeated-addition values. */
function crossingBefore(values: Float64Array, offset: number, stride: number, before: number, delta: number): number {
  let count = Math.max(0, Math.min(stride-1, Math.ceil((before-values[offset])/delta)));
  while (count < stride-1 && values[offset+count] < before) count++;
  while (count > 0 && values[offset+count-1] >= before) count--;
  return count;
}

function rayCrossings(world: VoxelWorld, origin: {x:number;y:number;z:number}, rays: CameraRays,
  owner: Float64Array): RayCrossings {
  const previous = crossingScratch.get(owner);
  const strideX = world.width+1, strideY = world.height+1, strideZ = world.depth+1;
  const sameRays = previous && previous.angle === rays.angle && previous.fov === rays.fov &&
    previous.width === rays.width && previous.height === rays.height;
  const x = previous?.x.length === rays.width*strideX ? previous.x : new Float64Array(rays.width*strideX);
  const y = previous?.y.length === rays.width*strideY ? previous.y : new Float64Array(rays.width*strideY);
  const z = previous?.z.length === rays.height*strideZ ? previous.z : new Float64Array(rays.height*strideZ);
  if (!sameRays || previous.originX !== origin.x || previous.strideX !== strideX) {
    for (let column=0;column<rays.width;column++)
      fillCrossings(x,column*strideX,strideX,origin.x,rays.columns[column*4],rays.columns[column*4+2]);
  }
  if (!sameRays || previous.originY !== origin.y || previous.strideY !== strideY) {
    for (let column=0;column<rays.width;column++)
      fillCrossings(y,column*strideY,strideY,origin.y,rays.columns[column*4+1],rays.columns[column*4+3]);
  }
  if (!sameRays || previous.originZ !== origin.z || previous.strideZ !== strideZ) {
    for (let row=0;row<rays.height;row++)
      fillCrossings(z,row*strideZ,strideZ,origin.z,rays.rows[row*2],rays.rows[row*2+1]);
  }
  const result = {originX:origin.x,originY:origin.y,originZ:origin.z,angle:rays.angle,fov:rays.fov,
    width:rays.width,height:rays.height,strideX,strideY,strideZ,x,y,z};
  crossingScratch.set(owner,result);
  return result;
}
// Unpitched camera rays separate into columns and rows: a few KiB per renderer,
// rather than a full-resolution table. Translation never invalidates this cache.
const cameraRayScratch = new WeakMap<Float64Array, CameraRays>();
function cameraRays(camera: Camera3D, fov: number, width: number, height: number, depth: Float64Array): CameraRays | null {
  // Pitched cameras retain the general path, including during continuous orbits.
  if ((camera.pitch ?? 0) !== 0) return null;
  const angle = camera.angle;
  let cached = cameraRayScratch.get(depth);
  if (cached && cached.width === width && cached.height === height && cached.angle === angle &&
      cached.fov === fov) return cached;
  const a = angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const scale = Math.tan(fov * Math.PI / 360);
  const columns = cached?.columns.length === width * 4 ? cached.columns : new Float64Array(width * 4);
  const rows = cached?.rows.length === height * 2 ? cached.rows : new Float64Array(height * 2);
  const longitudes = cached?.longitudes.length === width ? cached.longitudes : new Float64Array(width);
  for (let x = 0; x < width; x++) {
    const u = (2 * x / width - 1) * scale, i = x * 4;
    const rx = ca - sa * u, ry = sa + ca * u;
    columns[i] = rx; columns[i + 1] = ry;
    columns[i + 2] = Math.abs(1 / rx); columns[i + 3] = Math.abs(1 / ry);
    longitudes[x] = Math.atan2(ry, rx);
  }
  for (let y = 0; y < height; y++) {
    const rz = (height / 2 - y - .5) / height;
    rows[y * 2] = rz; rows[y * 2 + 1] = Math.abs(1 / rz);
  }
  cached = { width, height, angle, fov, columns, rows, longitudes };
  cameraRayScratch.set(depth, cached);
  return cached;
}

const chunkBoundsCache = new WeakMap<ChunkStore, { revision: number; bounds: number[] }>();
function solidChunkBounds(store: ChunkStore): number[] {
  const cached = chunkBoundsCache.get(store);
  if (cached?.revision === store.revision) return cached.bounds;
  const bounds: number[] = [];
  for (const [id, blocks] of store.raw) {
    let x0 = 4, y0 = 4, z0 = 4, x1 = 0, y1 = 0, z1 = 0;
    for (let i = 0; i < 64; i++) {
      if (!blocks[i]) continue;
      const x = i & 3, y = (i >> 2) & 3, z = i >> 4;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z);
      x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); z1 = Math.max(z1, z + 1);
    }
    const x = (id % store.cw) * 4;
    const y = (Math.floor(id / store.cw) % store.ch) * 4;
    const z = Math.floor(id / (store.cw * store.ch)) * 4;
    bounds.push(x + x0, y + y0, z + z0, x + x1, y + y1, z + z1);
  }
  chunkBoundsCache.set(store, { revision: store.revision, bounds });
  return bounds;
}

const visibilityScratch = new WeakMap<Float64Array, Uint8Array>();
function visibleVoxelTiles(store: ChunkStore, origin: { x: number; y: number; z: number },
  ca: number, sa: number, cp: number, sp: number, c: number, s: number, fovScale: number,
  width: number, height: number, depth: Float64Array): Uint8Array | undefined {
  const tileWidth = Math.ceil(width / 8), tileHeight = Math.ceil(height / 8);
  let tiles = visibilityScratch.get(depth);
  if (tiles?.length !== tileWidth * tileHeight) {
    tiles = new Uint8Array(tileWidth * tileHeight);
    visibilityScratch.set(depth, tiles);
  } else tiles.fill(0);
  const bounds = solidChunkBounds(store);
  for (let i = 0; i < bounds.length; i += 6) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let near = Infinity, far = -Infinity;
    let outside = 15;
    for (let corner = 0; corner < 8; corner++) {
      const x = bounds[i + (corner & 1 ? 3 : 0)] - origin.x;
      const localY = bounds[i + (corner & 2 ? 4 : 1)] - origin.y;
      const localZ = bounds[i + (corner & 4 ? 5 : 2)] - origin.z;
      const y = c * localY - s * localZ, z = s * localY + c * localZ;
      const heading = x * ca + y * sa;
      const forward = cp * heading + sp * z;
      near = Math.min(near, forward); far = Math.max(far, forward);
      const side = -sa * x + ca * y, up = cp * z - sp * heading;
      outside &= (side < -fovScale * forward - 1e-7 ? 1 : 0) |
        (side > fovScale * forward + 1e-7 ? 2 : 0) |
        (up < -.5 * forward - 1e-7 ? 4 : 0) |
        (up > .5 * forward + 1e-7 ? 8 : 0);
      if (forward <= 1e-7) continue;
      const px = (1 + side / (forward * fovScale)) * width / 2;
      const py = height / 2 - .5 - up / forward * height;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
    // Near-plane intersections can cover the whole screen. Keep scalar rays
    // in that case and pad projected boxes for grazing rays and rounding.
    if (outside || far < -1e-7) continue;
    if (near <= 1e-7) return undefined;
    const left = Math.max(0, Math.floor((minX - 1) / 8));
    const right = Math.min(tileWidth - 1, Math.floor((maxX + 1) / 8));
    const top = Math.max(0, Math.floor((minY - 1) / 8));
    const bottom = Math.min(tileHeight - 1, Math.floor((maxY + 1) / 8));
    if (left > right) continue;
    for (let row = top; row <= bottom; row++) {
      tiles.fill(1, row * tileWidth + left, row * tileWidth + right + 1);
    }
  }
  return tiles;
}

export function renderVoxels(world: VoxelWorld, camera: Camera3D, textures: Record<string, Texture>,
  sky: Sky | null | undefined, fov: number, width: number, height: number,
  buffer: Uint32Array, depth: Float64Array, time: number, preparedChunks?: VoxelChunks, preserveBackdrop = false): void {
  const pose = camera.terrainPose;
  const eye = (camera.z ?? 0) + 1.25, a = camera.angle * Math.PI / 180, p = (camera.pitch ?? 0) * Math.PI / 180;
  const ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(p), sp = Math.sin(p);
  const scale = Math.tan(fov * Math.PI / 360);
  if (![camera.x, camera.y, eye, camera.angle, camera.pitch ?? 0].every(Number.isFinite) ||
      camera.x < 0 || camera.y < 0 || camera.x >= world.width || camera.y >= world.height ||
      eye < 0 || eye >= world.depth || Math.abs(camera.pitch ?? 0) > 85) {
    throw new Error('Voxel camera must be finite, inside the world, with pitch between -85 and 85 degrees');
  }
  if (pose) {
    if (!Array.isArray(pose.pivot) || pose.pivot.length !== 2 || !Array.isArray(pose.position) ||
        pose.position.length !== 2 || ![...pose.pivot, ...pose.position, pose.angle].every(Number.isFinite)) {
      throw new Error('Voxel terrain pose needs finite Y/Z pivot and position pairs and an angle');
    }
    world = validateWorld(pose.world);
    preparedChunks = undefined;
  }
  const materialTextures = world.materials.map(name => {
    const texture = textures[name];
    if (!texture) throw new Error(`Unknown voxel material texture: ${name}`);
    return texture;
  });
  const sourceStore = chunkStore(world);
  sourceStore?.prepareRenderCells();
  const cells = sourceStore?.renderCells ?? world.cells;
  const sparseStore = sourceStore?.renderCells ? undefined : sourceStore;
  const origin = { x: camera.x, y: camera.y, z: eye };
  const theta = (pose?.angle ?? 0) * Math.PI / 180, c = Math.cos(theta), s = Math.sin(theta);
  if (pose) {
    const y = origin.y - pose.position[0], z = origin.z - pose.position[1];
    origin.y = pose.pivot[0] + c * y + s * z;
    origin.z = pose.pivot[1] - s * y + c * z;
  }
  const rays = cameraRays(camera, fov, width, height, depth);
  const needsTerrainEntry = pose && (origin.x <= 0 || origin.x >= world.width ||
    origin.y <= 0 || origin.y >= world.height || origin.z <= 0 || origin.z >= world.depth);
  // The renderer consumes each hit immediately; gameplay queries still receive
  // independent objects. Avoid allocating an object for every terrain pixel.
  const hitOutput: VoxelHit = { x: 0, y: 0, z: 0, block: 0, distance: 0, face: 0 };
  const maxDistance = Math.min(Math.hypot(world.width, world.height, world.depth),world.renderDistance??Infinity);
  const occupancy = preparedChunks ?? prepareVoxelChunks(world);
  // Dense volumes and thin posed terrain use fine DDA directly. Chunk
  // traversal pays off when a ray can skip many empty cells.
  const chunks = (!pose || Math.min(world.width, world.height, world.depth) > 8) &&
    occupancy.count < occupancy.width*occupancy.height*occupancy.depth*.6 ? occupancy : undefined;
  const crossings = !pose && rays && chunks && world.width<=256 && world.height<=256 ? rayCrossings(world, origin, rays, depth) : undefined;
  const visibleTiles = sourceStore && sourceStore.raw.size <= 1024
    ? visibleVoxelTiles(sourceStore, origin, ca, sa, cp, sp, c, s, scale, width, height, depth) : undefined;
  const tileWidth = Math.ceil(width / 8);
  const horizon = sky ? (0xff000000 | sky.horizon) >>> 0 : 0xff342820;
  // Adjacent pixels write adjacent color/depth entries rather than striding rows.
  for (let y = 0; y < height; y++) {
    const tileRow = (y >> 3) * tileWidth;
    const v = (height / 2 - y - .5) / height;
    const rz = rays ? rays.rows[y * 2] : sp + cp * v;
    const dz = rays ? rays.rows[y * 2 + 1] : Math.abs(1 / rz);
    for (let x = 0; x < width; x++) {
      const i = y * width + x, r = x * 4;
      const u = (2 * x / width - 1) * scale;
      const rx = rays ? rays.columns[r] : ca * cp - sa * u - ca * sp * v;
      const ry = rays ? rays.columns[r + 1] : sa * cp + ca * u - sa * sp * v;
      const dx = rays ? rays.columns[r + 2] : Math.abs(1 / rx);
      const dy = rays ? rays.columns[r + 3] : Math.abs(1 / ry);
      const localY = pose ? c * ry + s * rz : ry;
      const localZ = pose ? -s * ry + c * rz : rz;
      const hit = occupancy.count === 0 || (visibleTiles && !visibleTiles[tileRow + (x >> 3)]) ? null : needsTerrainEntry
        ? traceTerrainPose(world, cells, sparseStore, origin, rx, localY, localZ, maxDistance, hitOutput, chunks)
        : traceVoxelRay(world, cells, sparseStore, origin.x, origin.y, origin.z,
          rx, localY, localZ, dx, pose ? Math.abs(1 / localY) : dy, pose ? Math.abs(1 / localZ) : dz,
          maxDistance, hitOutput, chunks, crossings, x, y);
      if (!hit) {
        depth[i] = Infinity;
        if (!preserveBackdrop) {
          buffer[i] = sky && (rz > 0 || sky.below !== undefined)
            ? skyPixel(sky, rays ? rays.longitudes[x] : Math.atan2(ry, rx), Math.max(-1, Math.min(1, rz)), time) : horizon;
        }
      } else {
        depth[i] = hit.distance;
        const texture = materialTextures[hit.block - 1];
        const pointU = hit.face === 0 ? origin.y + localY * hit.distance : origin.x + rx * hit.distance;
        const pointV = hit.face === 2 ? origin.y + localY * hit.distance : origin.z + localZ * hit.distance;
        const tx = wrappedTexel(pointU, texture.width);
        const ty = wrappedTexel(pointV, texture.height);
        const color = texture.pixels[ty * texture.width + tx];
        const shade = hit.face === 0 ? sideShade : frontShade;
        buffer[i] = hit.face === 2 ? (0xff000000 | color) >>> 0 :
          (0xff000000 | shade[color & 255] | shade[(color >>> 8) & 255] << 8 | shade[(color >>> 16) & 255] << 16) >>> 0;
      }
    }
  }
}
