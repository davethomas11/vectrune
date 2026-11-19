import type { BlockModel, ModelInstance } from './model';

export type Point3D = [number, number, number];

export interface Tether3D {
  points: Point3D[];
  radius: number;
  color: number; // RGB, like other authored UI colors
  slack?: number;
  visible?: boolean;
}

export interface TetherPiece extends ModelInstance {
  joint: boolean;
}

export function validateTether(value: unknown): Tether3D {
  const validPoint = (p: unknown) => Array.isArray(p) && p.length === 3 &&
    p.every(n => Number.isFinite(n) && Math.abs(n) <= 1e6);
  const tether = value as Tether3D;
  if (!tether || !Array.isArray(tether.points) || tether.points.length < 2 ||
      tether.points.length > 32 || !tether.points.every(validPoint)) {
    throw new Error('Pixel-3d tether needs 2 to 32 finite [x,y,z] points within one million tiles');
  }
  if (!Number.isFinite(tether.radius) || tether.radius < .002 || tether.radius > 2 ||
      !Number.isInteger(tether.color) || tether.color < 0 || tether.color > 0xffffff ||
      (tether.visible !== undefined && typeof tether.visible !== 'boolean')) {
    throw new Error('Pixel-3d tether needs a radius from .002 to 2, an RGB color, and an optional boolean visible');
  }
  const slack = tether.slack ?? 0;
  if (!Number.isFinite(slack) || slack < 0 || slack > 32 || (slack > 0 && tether.points.length !== 2)) {
    throw new Error('Pixel-3d tether slack must be 0 to 32 and needs exactly two points when nonzero');
  }
  return tether;
}

export function tetherModel(joint: boolean, color = 0xffffffff): BlockModel {
  return { blocks: [{ from: [-.5, -.5, -.5], size: [1, 1, 1], shape: joint ? 'sphere' : 'cylinder', color }] };
}

/** Sample a slack span and use cylinders with rounded joints for both renderers. */
export function* tetherPieces(tether: Tether3D): Generator<TetherPiece> {
  if (tether.visible === false) return;
  let points = tether.points;
  if (tether.slack) {
    const [a, b] = points;
    const slack = tether.slack;
    points = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t - 4 * slack * t * (1 - t)];
    });
  }
  const scale = tether.radius * 2;
  let lastJoint: Point3D | undefined;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const length = Math.hypot(dx, dy, dz);
    if (length < 1e-6) continue;
    if (!lastJoint) yield { x: a[0], y: a[1], z: a[2], scale, joint: true };
    yield {
      x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, z: (a[2] + b[2]) / 2,
      angle: Math.atan2(dy, dx) * 180 / Math.PI, scale, joint: false,
      axisTilt: Math.atan2(Math.hypot(dx, dy), dz), axialScale: length / scale,
    };
    yield { x: b[0], y: b[1], z: b[2], scale, joint: true };
    lastJoint = b;
  }
}
