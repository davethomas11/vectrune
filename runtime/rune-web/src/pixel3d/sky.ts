export interface Sky {
  seed: number;
  zenith: number;
  horizon: number;
  cloud: number;
  speed: number;
}

function noise(x: number, y: number, seed: number): number {
  let n = ((x & 63) * 374761393 + y * 668265263 + seed) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function mix(a: number, b: number, t: number): number {
  let color = 0xff000000;
  for (const shift of [0, 8, 16]) {
    color |= Math.floor(((a >>> shift) & 255) * (1 - t) + ((b >>> shift) & 255) * t) << shift;
  }
  return color >>> 0;
}

/** Periodic, world-aligned clouds: no panorama assets or random frame flicker. */
export function skyPixel(sky: Sky, longitude: number, altitude: number, time: number): number {
  // Below-horizon voxel rays clamp to altitude zero. Clouds have zero weight
  // there, so their noise/interpolation cannot affect the opaque horizon color.
  if (altitude === 0) return (0xff000000 | sky.horizon) >>> 0;
  const u = ((longitude / (2 * Math.PI) * 64 + time * sky.speed) % 64 + 64) % 64;
  const v = altitude * 12;
  const x = Math.floor(u), y = Math.floor(v);
  const fx = u - x, fy = v - y;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = noise(x, y, sky.seed) * (1 - sx) + noise(x + 1, y, sky.seed) * sx;
  const b = noise(x, y + 1, sky.seed) * (1 - sx) + noise(x + 1, y + 1, sky.seed) * sx;
  const density = Math.max(0, Math.min(1, (a * (1 - sy) + b * sy - 0.5) * 4));
  const band = Math.floor(altitude * 16) / 16;
  return mix(mix(sky.horizon, sky.zenith, band), sky.cloud, density * Math.min(1, altitude * 5));
}
