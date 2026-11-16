import type { Camera3D } from './raycaster';

export interface CameraTrack {
  duration: number;
  loop: boolean;
  points: Camera3D[];
}

/** Periodic Catmull-Rom provides continuous position and angular velocity at the seam. */
export function sampleCamera(track: CameraTrack, seconds: number): Camera3D {
  const points = track.points, n = points.length;
  const progress = track.loop ? ((seconds / track.duration) % 1 + 1) % 1 : Math.max(0, Math.min(1, seconds / track.duration));
  const at = progress * (track.loop ? n : n - 1);
  const segment = Math.min(Math.floor(at), track.loop ? n - 1 : n - 2), t = at - segment;
  const point = (i: number) => points[track.loop ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  const result = {} as Camera3D;
  for (const key of ['x', 'y', 'height', 'angle', 'pitch'] as const) {
    const values = [-1, 0, 1, 2].map(i => point(segment + i)[key] ?? (key === 'height' ? .5 : 0));
    if (key === 'angle') {
      for (let i = 1; i < 4; i++) values[i] = values[i - 1] + ((values[i] - values[i - 1] + 540) % 360 + 360) % 360 - 180;
    }
    const [a, b, c, d] = values;
    result[key] = .5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  }
  // Cubic tracks can overshoot their control points; keep the eye and pitch valid.
  result.height = Math.max(.05, result.height!);
  result.pitch = Math.max(-85, Math.min(85, result.pitch!));
  return result;
}
