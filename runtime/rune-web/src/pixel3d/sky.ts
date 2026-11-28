export interface Sky {
  seed: number;
  zenith: number;
  horizon: number;
  cloud: number;
  speed: number;
  below?: number;
  cloud_wave?: number;
  cloud_glow?: number;
}

function noise(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed) >>> 0;
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

function cloudDensity(u: number, v: number, seed: number, wrap = 63): number {
  const x = Math.floor(u), y = Math.floor(v);
  const fx = u - x, fy = v - y;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const left = x & wrap, right = (x + 1) & wrap;
  const a = noise(left, y, seed) * (1 - sx) + noise(right, y, seed) * sx;
  const b = noise(left, y + 1, seed) * (1 - sx) + noise(right, y + 1, seed) * sx;
  return Math.max(0, Math.min(1, (a * (1 - sy) + b * sy - 0.5) * 4));
}

/** Periodic, world-aligned clouds: no panorama assets or random frame flicker. */
export function skyPixel(sky: Sky, longitude: number, altitude: number, time: number): number {
  const u = longitude / (2 * Math.PI) * 64;
  const drift = time * sky.speed;
  if (altitude < 0 && sky.below !== undefined) {
    const depth = -altitude;
    const gradient = mix(sky.horizon, sky.below, Math.floor(Math.sqrt(depth) * 32) / 32);
    // Large low clouds drift past a finer bank, with both fading at the horizon.
    const far = cloudDensity(u + drift * .35, depth * 23, sky.seed);
    const near = cloudDensity(u / 2 + drift, depth * 14 + 13, sky.seed + 719, 31);
    return mix(gradient, sky.cloud, (far * .18 + near * .42) * Math.min(1, depth * 7));
  }
  if (altitude <= 0) return (0xff000000 | sky.horizon) >>> 0;
  const wave = sky.cloud_wave ? sky.cloud_wave * Math.sin(longitude * 3 + time * .35) : 0;
  const density = cloudDensity(((u + drift) % 64 + 64) % 64, altitude * 12 + wave, sky.seed);
  const band = Math.floor(altitude * 16) / 16;
  const fade = Math.min(1, altitude * 5);
  const base = mix(mix(sky.horizon, sky.zenith, band), sky.cloud, density * fade);
  return sky.cloud_glow ? mix(base, 0xffffffff, sky.cloud_glow * density * density * fade * .5) : base;
}
