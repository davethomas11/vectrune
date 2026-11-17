import type { Texture, Camera3D } from './raycaster';
import { skyPixel, type Sky } from './sky';

export interface VoxelWorld {
  width: number;
  height: number;
  depth: number;
  seed: number;
  biome: 'meadow' | 'ember';
  materials: string[];
  cells: number[];
  spawn: VoxelPlayer;
}
export interface VoxelPlayer {
  x: number; y: number; z: number; angle: number; pitch: number; vz: number;
}
export interface VoxelHit {
  x: number; y: number; z: number; block: number; distance: number; face: number;
}

/** Rebuilt per rendered frame: arbitrary Rune cell writes remain immediately visible. */
export interface VoxelChunks {
  width: number;
  height: number;
  occupied: Uint8Array;
  count: number;
}
const chunkScratch = new WeakMap<VoxelWorld, VoxelChunks>();
export function prepareVoxelChunks(world: VoxelWorld): VoxelChunks {
  const width = Math.ceil(world.width / 4), height = Math.ceil(world.height / 4);
  const length = width * height * Math.ceil(world.depth / 4);
  let chunks = chunkScratch.get(world);
  if (!chunks || chunks.width !== width || chunks.height !== height || chunks.occupied.length !== length) {
    chunks = { width, height, occupied: new Uint8Array(length), count: 0 };
    chunkScratch.set(world, chunks);
  }
  chunks.occupied.fill(0);
  chunks.count = 0;
  let cell = 0;
  for (let z = 0; z < world.depth; z++) for (let y = 0; y < world.height; y++) {
    const row = ((z >> 2) * height + (y >> 2)) * width;
    for (let x = 0; x < world.width; x++, cell++) {
      if (world.cells[cell] && !chunks.occupied[row + (x >> 2)]) {
        chunks.occupied[row + (x >> 2)] = 1;
        chunks.count++;
      }
    }
  }
  return chunks;
}

function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return value;
}
export function validateWorld(value: unknown): VoxelWorld {
  if (!value || typeof value !== 'object') throw new Error('Voxel world must be an object');
  const world = value as VoxelWorld;
  integer(world.width, 1, 48, 'Voxel width');
  integer(world.height, 1, 48, 'Voxel height');
  integer(world.depth, 1, 24, 'Voxel depth');
  if (!Array.isArray(world.materials) || world.materials.length < 1 || world.materials.length > 256 ||
      !world.materials.every(name => typeof name === 'string' && name.length > 0) ||
      !Array.isArray(world.cells) || world.cells.length !== world.width * world.height * world.depth ||
      !world.cells.every(block => Number.isInteger(block) && block >= 0 && block <= world.materials.length)) {
    throw new Error('Voxel world needs material names and an exactly sized array of valid block IDs');
  }
  return world;
}
function index(world: VoxelWorld, x: number, y: number, z: number): number {
  return (z * world.height + y) * world.width + x;
}
export function voxelGet(world: VoxelWorld, x: number, y: number, z: number): number {
  if (x < 0 || y < 0 || z < 0 || x >= world.width || y >= world.height || z >= world.depth) return 0;
  return world.cells[index(world, x, y, z)];
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
  const width = chunks.width, height = chunks.height, depth = chunks.occupied.length / (width * height);
  const stepX = dx * 4, stepY = dy * 4, stepZ = dz * 4;
  let entry = 0;
  while (x >= 0 && y >= 0 && z >= 0 && x < width && y < height && z < depth) {
    if (chunks.occupied[(z * height + y) * width + x]) return entry;
    const next = Math.min(ex, ey, ez);
    if (!Number.isFinite(next) || next > maxDistance) return Infinity;
    const tolerance = 1e-9 * Math.max(1, next);
    // A grazing ray can touch several chunks at once. Hand those boundaries to
    // the original traversal rather than risk discarding an edge-touching voxel.
    if ((Math.abs(ex - next) <= tolerance ? 1 : 0) +
        (Math.abs(ey - next) <= tolerance ? 1 : 0) +
        (Math.abs(ez - next) <= tolerance ? 1 : 0) > 1) return entry;
    entry = next;
    if (ex < ey && ex < ez) { x += sx; ex += stepX; }
    else if (ey < ez) { y += sy; ey += stepY; }
    else { z += sz; ez += stepZ; }
  }
  return Infinity;
}

export function voxelRay(world: VoxelWorld, origin: { x: number; y: number; z: number },
  ray: [number, number, number], maxDistance: number, output?: VoxelHit, chunks?: VoxelChunks): VoxelHit | null {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const width = world.width, height = world.height, depth = world.depth, cells = world.cells;
  const sx = ray[0] < 0 ? -1 : 1, sy = ray[1] < 0 ? -1 : 1, sz = ray[2] < 0 ? -1 : 1;
  const stepY = sy * width, stepZ = sz * width * height;
  let cellIndex = (z * height + y) * width + x;
  const dx = Math.abs(1 / ray[0]), dy = Math.abs(1 / ray[1]), dz = Math.abs(1 / ray[2]);
  let tx = ray[0] === 0 ? Infinity : (sx < 0 ? origin.x - x : x + 1 - origin.x) * dx;
  let ty = ray[1] === 0 ? Infinity : (sy < 0 ? origin.y - y : y + 1 - origin.y) * dy;
  let tz = ray[2] === 0 ? Infinity : (sz < 0 ? origin.z - z : z + 1 - origin.z) * dz;
  if (chunks && (ray[0] !== 0 || ray[1] !== 0 || ray[2] !== 0)) {
    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return null;
    const entry = chunkEntry(chunks, x, y, z, tx, ty, tz, dx, dy, dz, sx, sy, sz, maxDistance);
    if (!Number.isFinite(entry)) return null;
    // Stop conservatively before the first potentially occupied chunk. Repeated
    // additions retain fine-DDA distance bits; fine traversal resolves entry faces.
    const beforeEntry = entry - 1e-9 * Math.max(1, entry);
    while (tx < beforeEntry) { x += sx; tx += dx; }
    while (ty < beforeEntry) { y += sy; ty += dy; }
    while (tz < beforeEntry) { z += sz; tz += dz; }
    cellIndex = (z * height + y) * width + x;
  }
  let distance = 0, face = 2;
  for (let iteration = 0; iteration < 256 && distance <= maxDistance; iteration++) {
    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) break;
    const block = cells[cellIndex];
    if (block) {
      if (!output) return { x, y, z, block, distance, face };
      output.x = x; output.y = y; output.z = z;
      output.block = block; output.distance = distance; output.face = face;
      return output;
    }
    if (tx < ty && tx < tz) { face = 0; distance = tx; tx += dx; x += sx; cellIndex += sx; }
    else if (ty < tz) { face = 1; distance = ty; ty += dy; y += sy; cellIndex += stepY; }
    else { face = 2; distance = tz; tz += dz; z += sz; cellIndex += stepZ; }
  }
  return null;
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

export function renderVoxels(world: VoxelWorld, camera: Camera3D, textures: Record<string, Texture>,
  sky: Sky | null | undefined, fov: number, width: number, height: number,
  buffer: Uint32Array, depth: Float64Array, time: number): void {
  const eye = (camera.z ?? 0) + 1.25, a = camera.angle * Math.PI / 180, p = (camera.pitch ?? 0) * Math.PI / 180;
  const ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(p), sp = Math.sin(p);
  const scale = Math.tan(fov * Math.PI / 360);
  const materialTextures = world.materials.map(name => {
    const texture = textures[name];
    if (!texture) throw new Error(`Unknown voxel material texture: ${name}`);
    return texture;
  });
  if (![camera.x, camera.y, eye, camera.angle, camera.pitch ?? 0].every(Number.isFinite) ||
      camera.x < 0 || camera.y < 0 || camera.x >= world.width || camera.y >= world.height ||
      eye < 0 || eye >= world.depth || Math.abs(camera.pitch ?? 0) > 85) {
    throw new Error('Voxel camera must be finite, inside the world, with pitch between -85 and 85 degrees');
  }
  const origin = { x: camera.x, y: camera.y, z: eye }, ray: [number, number, number] = [0, 0, 0];
  // The renderer consumes each hit immediately; gameplay queries still receive
  // independent objects. Avoid allocating an object for every terrain pixel.
  const hitOutput: VoxelHit = { x: 0, y: 0, z: 0, block: 0, distance: 0, face: 0 };
  const maxDistance = Math.hypot(world.width, world.height, world.depth);
  const occupancy = prepareVoxelChunks(world);
  // Dense volumes retain ordinary DDA; sparse floating islands benefit most.
  const chunks = occupancy.count < occupancy.occupied.length * .6 ? occupancy : undefined;
  const horizon = sky ? (0xff000000 | sky.horizon) >>> 0 : 0xff342820;
  // Adjacent pixels write adjacent color/depth entries rather than striding rows.
  for (let y = 0; y < height; y++) {
    const v = (height / 2 - y - .5) / height;
    for (let x = 0; x < width; x++) {
      const u = (2 * x / width - 1) * scale;
      ray[0] = ca * cp - sa * u - ca * sp * v;
      ray[1] = sa * cp + ca * u - sa * sp * v;
      ray[2] = sp + cp * v;
      const i = y * width + x;
      const hit = occupancy.count === 0 ? null : voxelRay(world, origin, ray, maxDistance, hitOutput, chunks);
      if (!hit) {
        depth[i] = Infinity;
        buffer[i] = sky && ray[2] > 0
          ? skyPixel(sky, Math.atan2(ray[1], ray[0]), Math.min(1, ray[2]), time) : horizon;
      } else {
        depth[i] = hit.distance;
        const texture = materialTextures[hit.block - 1];
        const pointU = hit.face === 0 ? camera.y + ray[1] * hit.distance : camera.x + ray[0] * hit.distance;
        const pointV = hit.face === 2 ? camera.y + ray[1] * hit.distance : eye + ray[2] * hit.distance;
        const tx = Math.floor((pointU % 1 + 1) % 1 * texture.width);
        const ty = Math.floor((pointV % 1 + 1) % 1 * texture.height);
        const color = texture.pixels[ty * texture.width + tx], factor = hit.face === 2 ? 1 : hit.face === 0 ? .8 : .65;
        buffer[i] = (0xff000000 | Math.floor((color & 255) * factor) |
          Math.floor(((color >>> 8) & 255) * factor) << 8 | Math.floor(((color >>> 16) & 255) * factor) << 16) >>> 0;
      }
    }
  }
}
