// Deterministic integer-indexed trigonometry for pixel-3d.
// Quantizes angles into TABLE_SIZE steps (4096).
// One full turn = 360 degrees = 4096 units.

export const ANGLE_UNITS = 4096;
const DEG_TO_INDEX = ANGLE_UNITS / 360;
const RAD_TO_INDEX = ANGLE_UNITS / (Math.PI * 2);

export const SIN_TABLE = new Float64Array(ANGLE_UNITS);
export const COS_TABLE = new Float64Array(ANGLE_UNITS);

for (let i = 0; i < ANGLE_UNITS; i++) {
  const rad = (i * 2 * Math.PI) / ANGLE_UNITS;
  SIN_TABLE[i] = Math.sin(rad);
  COS_TABLE[i] = Math.cos(rad);
}

/** Normalized angle in degrees -> table index [0, 4095] */
export function degToIndex(degrees: number): number {
  const raw = Math.round(degrees * DEG_TO_INDEX) % ANGLE_UNITS;
  return raw < 0 ? raw + ANGLE_UNITS : raw;
}

export function radToIndex(radians: number): number {
  const raw = Math.round(radians * RAD_TO_INDEX) % ANGLE_UNITS;
  return raw < 0 ? raw + ANGLE_UNITS : raw;
}

export function fastSin(degrees: number): number {
  return SIN_TABLE[degToIndex(degrees)];
}

export function fastCos(degrees: number): number {
  return COS_TABLE[degToIndex(degrees)];
}

export function fastAtan2Deg(dy: number, dx: number): number {
  const rad = Math.atan2(dy, dx);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

