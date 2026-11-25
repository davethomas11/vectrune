import type { Camera3D, Thing3D } from './raycaster';
import type { BlockModel } from './model';
import { voxelGet, type VoxelWorld } from './voxel';

const TILE = 4;
const GLASS_TINT = 0xf0c981; // Packed BGR: pale cyan.
const FALLBACK_HAZE = 0x49383a;

export interface EmissionBuffer {
  width: number;
  pixels: Int32Array;
  depths: Float64Array;
  colors: Uint32Array;
}

interface Plane {
  x: number; y: number; z: number;
  ax: number; ay: number; az: number;
  bx: number; by: number;
  halfA: number; halfB: number;
  scale: number;
}

interface View {
  x: number; y: number; z: number;
  dirX: number; dirY: number; cp: number; sp: number;
  fov: number; rowOrigin: number;
}

function viewOf(camera: Camera3D, dirX: number, dirY: number, fov: number, rowOrigin: number): View {
  const pitch = (camera.pitch ?? 0) * Math.PI / 180;
  return { x: camera.x, y: camera.y, z: camera.height ?? 0.5, dirX, dirY,
    cp: Math.cos(pitch), sp: Math.sin(pitch), fov, rowOrigin };
}

export function blendColor(color: number, tint: number, alpha: number): number {
  const red = color & 255, green = (color >>> 8) & 255, blue = (color >>> 16) & 255;
  return (0xff000000 | (red + ((tint & 255) - red) * alpha) |
    (green + (((tint >>> 8) & 255) - green) * alpha) << 8 |
    (blue + (((tint >>> 16) & 255) - blue) * alpha) << 16) >>> 0;
}

function addColor(color: number, glow: number): number {
  return (0xff000000 | Math.min(255, (color & 255) + (glow & 255)) |
    Math.min(255, ((color >>> 8) & 255) + ((glow >>> 8) & 255)) << 8 |
    Math.min(255, ((color >>> 16) & 255) + (glow >>> 16)) << 16) >>> 0;
}

function mixGlow(a: number, b: number, weight: number): number {
  const other = 4 - weight;
  return (((a & 0xff00ff) * other + (b & 0xff00ff) * weight) >>> 2 & 0xff00ff) |
    (((a & 0xff00) * other + (b & 0xff00) * weight) >>> 2 & 0xff00);
}

/** Uniform five-tap blur. A second separable pass makes the small halo fall off towards its edges. */
function blur(source: Uint32Array, target: Uint32Array, width: number, height: number, horizontal: boolean): void {
  const stride = horizontal ? 1 : width;
  const length = horizontal ? width : height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x, position = horizontal ? x : y;
      const a = position > 1 ? source[i - 2 * stride] : 0;
      const b = position > 0 ? source[i - stride] : 0;
      const c = source[i];
      const d = position + 1 < length ? source[i + stride] : 0;
      const e = position + 2 < length ? source[i + 2 * stride] : 0;
      // Accumulate two lanes at once, leaving enough space for the weights.
      const rb = ((a & 0xff00ff) + 2 * (b & 0xff00ff) + 4 * (c & 0xff00ff) +
        2 * (d & 0xff00ff) + (e & 0xff00ff)) >>> 0;
      const green = ((a >>> 8 & 255) + 2 * (b >>> 8 & 255) + 4 * (c >>> 8 & 255) +
        2 * (d >>> 8 & 255) + (e >>> 8 & 255)) / 10;
      target[i] = (rb & 0xffff) / 10 | (green | 0) << 8 | ((rb >>> 16) / 10 | 0) << 16;
    }
  }
}

function makeGlass(thing: Thing3D, size: readonly [number,number]): Plane {
  const angle = (thing.angle ?? 0) * Math.PI / 180;
  const pitch = (thing.pitch ?? 0) * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const scale = thing.scale ?? 1;
  return { x: thing.x, y: thing.y, z: thing.z ?? 0, ax: c * cp, ay: s * cp, az: -sp,
    bx: -s, by: c, halfA: size[0] * scale / 2, halfB: size[1] * scale / 2, scale };
}

export class EnhancedLighting {
  private tileWidth = 0;
  private tileHeight = 0;
  private width = 0;
  private height = 0;
  private scratch = new Uint32Array(0);
  private glow = new Uint32Array(0);
  private paneDepth = new Float64Array(0);
  private paneAlpha = new Uint8Array(0);
  private readonly panes: Plane[] = [];
  private emission: EmissionBuffer = { width: 0, pixels: new Int32Array(0), depths: new Float64Array(0), colors: new Uint32Array(0) };

  begin(width: number, height: number): EmissionBuffer {
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
      this.tileWidth = Math.ceil(width / TILE);
      this.tileHeight = Math.ceil(height / TILE);
      const count = this.tileWidth * this.tileHeight;
      this.emission = { width: this.tileWidth, pixels: new Int32Array(count),
        depths: new Float64Array(count), colors: new Uint32Array(count) };
      this.scratch = new Uint32Array(count);
      this.glow = new Uint32Array(count);
      this.paneDepth = new Float64Array(count);
      this.paneAlpha = new Uint8Array(count);
    }
    this.panes.length = 0;
    this.paneDepth.fill(Infinity);
    this.paneAlpha.fill(0);
    this.emission.colors.fill(0);
    return this.emission;
  }

  rememberGlass(thing: Thing3D, model: BlockModel): void {
    if (model.glass && (thing.dissolve ?? 0) < 1) this.panes.push(makeGlass(thing, model.glass));
  }

  /** The backdrop is composed while its own depth is still available. */
  backdrop(buffer: Uint32Array, depth: Float64Array): void {
    if (this.buildGlow(depth)) this.combine(buffer, depth, true, 0);
    this.emission.colors.fill(0);
  }

  private buildGlow(depth: Float64Array): boolean {
    const {colors, pixels, depths} = this.emission;
    let any = false;
    for (let i = 0; i < colors.length; i++) {
      if (!colors[i]) continue;
      if (depth[pixels[i]] !== depths[i]) colors[i] = 0;
      else any = true;
    }
    if (!any) return false;
    blur(colors, this.scratch, this.tileWidth, this.tileHeight, true);
    blur(this.scratch, this.glow, this.tileWidth, this.tileHeight, false);
    return true;
  }

  finish(buffer: Uint32Array, depth: Float64Array, camera: Camera3D, dirX: number, dirY: number,
    fov: number, rowOrigin: number, world: VoxelWorld | undefined, things: readonly Thing3D[],
    models: Record<string, BlockModel>, horizon?: number): void {
    const view = viewOf(camera, dirX, dirY, fov, rowOrigin);
    if (world) this.shadows(buffer, depth, view, world, things, models);
    for (const pane of this.panes) this.tintPane(view, pane);
    // Across-the-level views already haze the distant skyline models. Use
    // depth haze on the terrain when looking along the route instead.
    const haze = world ? Math.max(0, Math.min(1, (Math.abs(dirX) - .35) / .4)) *
      Math.max(0, Math.min(1, (0.8 - Math.abs(view.sp)) / .25)) : 0;
    this.combine(buffer, depth, this.buildGlow(depth), haze, horizon);
  }

  private combine(buffer: Uint32Array, depth: Float64Array, bloom: boolean, haze: number, horizon?: number): void {
    const width = this.width, height = this.height;
    const hazeTint = horizon ?? FALLBACK_HAZE;
    const glass = this.panes.length > 0;
    if (!glass && !bloom && !haze) return;
    const tileWidth = this.tileWidth;
    for (let y = 0; y < height; y++) {
      const row = y * width, blockY = y >> 2, tileRow = blockY * tileWidth;
      const nextRow = Math.min(this.tileHeight - 1, blockY + 1) * tileWidth;
      const yWeight = y & 3;
      let nearGlow = bloom ? mixGlow(this.glow[tileRow], this.glow[nextRow], yWeight) : 0;
      for (let left = 0; left < width; left += TILE) {
        const blockX = left >> 2, tile = tileRow + blockX;
        const nextX = Math.min(tileWidth - 1, blockX + 1);
        const startGlow = nearGlow;
        const farGlow = bloom ? mixGlow(this.glow[tileRow + nextX], this.glow[nextRow + nextX], yWeight) : 0;
        nearGlow = farGlow;
        const tint = glass ? this.paneAlpha[tile] : 0;
        if (!startGlow && !farGlow && !tint && !haze) continue;
        const paneDepth = tint ? this.paneDepth[tile] : Infinity;
        const end = row + Math.min(width, left + TILE);
        for (let i = row + left; i < end; i++) {
          let pixel = buffer[i];
          const distance = depth[i];
          if (haze && distance > 22 && distance < Infinity) {
            pixel = blendColor(pixel, hazeTint, haze * Math.min(.30, (distance - 22) * .008));
          }
          if (distance > paneDepth) pixel = blendColor(pixel, GLASS_TINT, tint / 255);
          const glow = startGlow || farGlow ? mixGlow(startGlow, farGlow, i - row - left) : 0;
          buffer[i] = glow ? addColor(pixel, glow) : pixel;
        }
      }
    }
  }

  private bounds(view: View, plane: Plane, cell: number): [number, number, number, number] | undefined {
    const corners: Array<[number,number,number]> = [];
    for (const [a,b] of [[-1,-1], [1,-1], [1,1], [-1,1]]) {
      const dx = plane.x - view.x + a * plane.ax * plane.halfA + b * plane.bx * plane.halfB;
      const dy = plane.y - view.y + a * plane.ay * plane.halfA + b * plane.by * plane.halfB;
      const dz = plane.z - view.z + a * plane.az * plane.halfA;
      const heading = dx * view.dirX + dy * view.dirY;
      corners.push([-dx * view.dirY + dy * view.dirX, dz * view.cp - heading * view.sp, heading * view.cp + dz * view.sp]);
    }
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    const near = .10;
    for (let i = 0; i < 4; i++) {
      let [side, up, forward] = corners[i];
      if (forward < near) continue;
      for (let neighbor = -1; neighbor <= 1; neighbor += 2) {
        left = Math.min(left, this.width / 2 * (1 + side / (forward * view.fov)));
        right = Math.max(right, this.width / 2 * (1 + side / (forward * view.fov)));
        top = Math.min(top, view.rowOrigin - up / forward * this.height - .5);
        bottom = Math.max(bottom, view.rowOrigin - up / forward * this.height - .5);
        const [nextSide, nextUp, nextForward] = corners[(i + neighbor + 4) % 4];
        if (nextForward >= near) continue;
        const t = (near - forward) / (nextForward - forward);
        side += (nextSide - side) * t;
        up += (nextUp - up) * t;
        forward = near;
        left = Math.min(left, this.width / 2 * (1 + side / (forward * view.fov)));
        right = Math.max(right, this.width / 2 * (1 + side / (forward * view.fov)));
        top = Math.min(top, view.rowOrigin - up / forward * this.height - .5);
        bottom = Math.max(bottom, view.rowOrigin - up / forward * this.height - .5);
        [side, up, forward] = corners[i];
      }
    }
    const x0 = Math.max(0, Math.floor(left / cell));
    const y0 = Math.max(0, Math.floor(top / cell));
    const x1 = Math.min(Math.ceil(this.width / cell), Math.ceil(right / cell) + 1);
    const y1 = Math.min(Math.ceil(this.height / cell), Math.ceil(bottom / cell) + 1);
    if (x0 < x1 && y0 < y1) return [x0, y0, x1, y1];
  }

  private tintPane(view: View, plane: Plane): void {
    const bounds = this.bounds(view, plane, TILE);
    if (!bounds) return;
    const [left, top, right, bottom] = bounds;
    const nx = -plane.az * plane.by, ny = plane.az * plane.bx;
    const nz = plane.ax * plane.by - plane.ay * plane.bx;
    const ox = view.x - plane.x, oy = view.y - plane.y, oz = view.z - plane.z;
    const offset = -(ox * nx + oy * ny + oz * nz);
    const startA = ox * plane.ax + oy * plane.ay + oz * plane.az;
    const startB = ox * plane.bx + oy * plane.by;
    const edgeWidth = .26 * plane.scale;
    for (let y = top; y < bottom; y++) {
      const up = (view.rowOrigin - (y * TILE + TILE / 2) - .5) / this.height;
      const heading = view.cp - view.sp * up, rz = view.sp + view.cp * up;
      for (let x = left; x < right; x++) {
        const side = (2 * (x * TILE + TILE / 2) / this.width - 1) * view.fov;
        const rx = view.dirX * heading - view.dirY * side, ry = view.dirY * heading + view.dirX * side;
        const rate = rx * nx + ry * ny + rz * nz;
        const distance = offset / rate;
        const i = y * this.tileWidth + x;
        if (!(distance > .10 && distance < this.paneDepth[i])) continue;
        const a = startA + distance * (rx * plane.ax + ry * plane.ay + rz * plane.az);
        const b = startB + distance * (rx * plane.bx + ry * plane.by);
        const edge = Math.min(plane.halfA - Math.abs(a), plane.halfB - Math.abs(b));
        if (edge < 0) continue;
        const grazing = Math.max(0, 1 - Math.abs(rate));
        const rim = Math.max(0, 1 - edge / edgeWidth);
        this.paneDepth[i] = distance;
        this.paneAlpha[i] = 10 + 23 * grazing * grazing + (22 + 28 * grazing) * rim;
      }
    }
  }

  private shadows(buffer: Uint32Array, depth: Float64Array, view: View, world: VoxelWorld,
    things: readonly Thing3D[], models: Record<string, BlockModel>): void {
    for (const thing of things) {
      const radius = thing.model && models[thing.model]?.contactShadow;
      if (!radius || thing.visible === false || (thing.dissolve ?? 0) >= 1 || thing.z === undefined) continue;
      let floor: number | undefined, onGlass = false;
      for (const pane of this.panes) {
        if (Math.abs(pane.az) > .01 || thing.z < pane.z - .05 || thing.z > pane.z + 1.65) continue;
        const dx = thing.x - pane.x, dy = thing.y - pane.y;
        if (Math.abs(dx * pane.ax + dy * pane.ay) <= pane.halfA &&
            Math.abs(dx * pane.bx + dy * pane.by) <= pane.halfB) {
          floor = pane.z + .02;
          onGlass = true;
          break;
        }
      }
      if (floor === undefined && !this.panes.length) {
        const below = Math.floor(thing.z - .05);
        for (let z = below; z >= Math.max(0, below - 2); z--) {
          if (voxelGet(world, Math.floor(thing.x), Math.floor(thing.y), z)) {
            floor = z + 1;
            break;
          }
        }
      }
      if (floor === undefined) continue;
      const scale = thing.scale ?? 1, halfA = radius * scale, halfB = halfA * .77;
      const bounds = this.bounds(view, {x:thing.x, y:thing.y, z:floor, ax:1, ay:0, az:0, bx:0, by:1,
        halfA, halfB, scale}, 1);
      if (!bounds) continue;
      const [left, top, right, bottom] = bounds;
      const strength = .33 * Math.max(0, 1 - (thing.z - floor) * .6) * (1 - (thing.dissolve ?? 0));
      for (let y = top; y < bottom; y++) {
        const up = (view.rowOrigin - y - .5) / this.height;
        const rz = view.sp + view.cp * up;
        const distance = (floor - view.z) / rz;
        if (!(distance > .10)) continue;
        const heading = view.cp - view.sp * up;
        for (let x = left; x < right; x++) {
          const i = y * this.width + x;
          if (onGlass ? depth[i] < distance - .02 : Math.abs(depth[i] - distance) > .055) continue;
          const side = (2 * x / this.width - 1) * view.fov;
          const dx = (view.x - thing.x + distance * (view.dirX * heading - view.dirY * side)) / halfA;
          const dy = (view.y - thing.y + distance * (view.dirY * heading + view.dirX * side)) / halfB;
          const fade = 1 - dx * dx - dy * dy;
          if (fade > 0) buffer[i] = blendColor(buffer[i], 0x10090b, fade * strength);
        }
      }
    }
  }
}
