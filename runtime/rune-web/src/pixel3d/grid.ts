import type { Camera3D, MapData, Texture, WallOverride, Thing3D } from './raycaster';
import type { Sprite } from '../pixel/engine';
import { skyPixel } from './sky';

const shade = (c: number, f: number) => (0xff000000 | Math.floor((c & 255) * f) |
  Math.floor(((c >>> 8) & 255) * f) << 8 | Math.floor(((c >>> 16) & 255) * f) << 16) >>> 0;
const pack = (c: number) => (0xff000000 | (c & 255) << 16 | c & 0xff00 | (c >>> 16) & 255) >>> 0;
function sample(surface: number | Texture, u: number, v: number): number {
  if (typeof surface === 'number') return (surface | 0xff000000) >>> 0;
  const x = Math.floor(u * surface.width) & (surface.width - 1);
  const y = Math.floor(v * surface.height) & (surface.height - 1);
  return surface.pixels[y * surface.width + x];
}

/** Full pitched rays against finite-height grid columns, including exposed wall tops. */
export function renderGrid(map: MapData, camera: Camera3D, textures: Texture[], overrides: WallOverride[],
  things: Thing3D[], sprites: Record<string, Sprite>, fov: number, width: number, height: number,
  buffer: Uint32Array, depth: Float64Array, time: number): void {
  const eye = camera.height ?? .5, pitch = (camera.pitch ?? 0) * Math.PI / 180;
  if (![camera.x, camera.y, camera.angle, eye, pitch].every(Number.isFinite) || eye <= 0 || Math.abs(pitch) > 85 * Math.PI / 180) {
    throw new Error('Grid camera must be finite, above the floor, with pitch between -85 and 85 degrees');
  }
  const angle = camera.angle * Math.PI / 180, dx = Math.cos(angle), dy = Math.sin(angle);
  const cp = Math.cos(pitch), sp = Math.sin(pitch), scale = Math.tan(fov * Math.PI / 360);
  const top = map.ceilingHeight ?? 1;
  const tiles = new Map(overrides.map(o => [o.y * map.width + o.x, o.texture]));
  const billboards = things.filter(t => t.sprite && !t.model && t.visible !== false);
  for (let y = 0; y < height; y++) {
    const v = ((height >> 1) - y - .5) / height;
    for (let x = 0; x < width; x++) {
      const u = (2 * x / width - 1) * scale;
      const rx = dx * (cp - sp * v) - dy * u, ry = dy * (cp - sp * v) + dx * u, rz = sp + cp * v;
      let hit = Infinity;
      let color = sample(map.ceiling, 0, 0);
      const plane = rz < -1e-10 ? -eye / rz : !map.sky && rz > 1e-10 ? (top - eye) / rz : Infinity;
      if (plane > 0 && Number.isFinite(plane)) {
        hit = plane;
        color = sample(rz < 0 ? map.floor : map.ceiling, camera.x + rx * hit, camera.y + ry * hit);
      }
      let mx = Math.floor(camera.x), my = Math.floor(camera.y), enter = 0, side = 2;
      const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
      const tx = Math.abs(1 / rx), ty = Math.abs(1 / ry);
      let nextX = rx === 0 ? Infinity : (rx < 0 ? camera.x - mx : mx + 1 - camera.x) * tx;
      let nextY = ry === 0 ? Infinity : (ry < 0 ? camera.y - my : my + 1 - camera.y) * ty;
      for (let steps = 0; steps < map.width + map.height + 4 && enter < hit; steps++) {
        if (mx < 0 || my < 0 || mx >= map.width || my >= map.height) break;
        const cell = my * map.width + mx, wall = map.grid[cell];
        const exit = Math.min(nextX, nextY);
        if (wall > 0) {
          const a = rz === 0 ? -Infinity : (0 - eye) / rz;
          const b = rz === 0 ? Infinity : (top - eye) / rz;
          const near = Math.max(enter, Math.min(a, b), .0001);
          const far = Math.min(exit, Math.max(a, b));
          if ((rz !== 0 || eye <= top) && near <= far && near < hit) {
            hit = near;
            const hx = camera.x + rx * hit, hy = camera.y + ry * hit, hz = eye + rz * hit;
            const face = near > enter + 1e-8 ? 2 : side;
            const tex = textures[tiles.get(cell) ?? wall - 1];
            color = tex ? shade(sample(tex, face === 0 ? hy : hx, face === 2 ? hy : 1 - hz), face === 2 ? 1 : face === 0 ? 1 : .75) : 0xff333333;
            break;
          }
        }
        if (nextX < nextY) { enter = nextX; nextX += tx; mx += sx; side = 0; }
        else { enter = nextY; nextY += ty; my += sy; side = 1; }
      }
      if (!Number.isFinite(hit) && map.sky) {
        color = skyPixel(map.sky, Math.atan2(ry, rx), Math.max(0, Math.min(1, rz * 2)), time);
      }
      // Vertical yaw-facing planes keep sprites grounded under true camera pitch.
      for (const thing of billboards) {
        const sprite = sprites[thing.sprite!];
        if (!sprite) continue;
        const forward = (thing.x - camera.x) * dx + (thing.y - camera.y) * dy;
        const t = forward / (rx * dx + ry * dy);
        if (t <= .001 || t >= hit) continue;
        const size = thing.scale ?? 1;
        const across = (camera.x + rx * t - thing.x) * -dy + (camera.y + ry * t - thing.y) * dx;
        const su = across / (size * sprite.width / sprite.height) + .5;
        const sv = 1 - (eye + rz * t - (thing.z ?? 0)) / size;
        if (su < 0 || su >= 1 || sv < 0 || sv >= 1) continue;
        const c = sprite.colors[sprite.pixels[Math.floor(sv * sprite.height) * sprite.width + Math.floor(su * sprite.width)]];
        if (c !== null && c !== undefined) { color = pack(c); hit = t; }
      }
      const index = y * width + x;
      buffer[index] = color;
      depth[index] = hit;
    }
  }
}
