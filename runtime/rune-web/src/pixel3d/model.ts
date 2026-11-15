export interface Block {
  from: [number, number, number];
  size: [number, number, number];
  color: number;
}

export interface BlockModel {
  blocks: Block[];
}

export interface ModelInstance {
  x: number;
  y: number;
  z?: number;
  angle?: number;
  scale?: number;
  dissolve?: number;
}

function shade(color: number, factor: number): number {
  return (0xff000000 |
    (Math.floor((color & 255) * factor)) |
    (Math.floor(((color >>> 8) & 255) * factor) << 8) |
    (Math.floor(((color >>> 16) & 255) * factor) << 16)) >>> 0;
}

function fragmentNoise(x: number, y: number): number {
  const hash = Math.imul(Math.floor(x / 2), 73856093) ^ Math.imul(Math.floor(y / 2), 19349663);
  return (Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0) / 4294967296;
}

/** Ray/box rendering keeps block faces pixel crisp and uses the raycaster's depth convention. */
export function renderModel(
  model: BlockModel, instance: ModelInstance,
  camera: { x: number; y: number }, dirX: number, dirY: number, fovScale: number,
  width: number, height: number, buffer: Uint32Array, depth: Float64Array
): void {
  const scale = instance.scale ?? 1;
  const dissolve = instance.dissolve ?? 0;
  if (!Number.isFinite(dissolve) || dissolve < 0 || dissolve > 1) throw new Error('Model dissolve must be between 0 and 1');
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Model scale must be finite and positive');
  if (![instance.x, instance.y, instance.z ?? 0, instance.angle ?? 0].every(Number.isFinite)) {
    throw new Error('Model position and angle must be finite');
  }
  if (dissolve === 1) return;
  const angle = (instance.angle ?? 0) * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  const ox = camera.x - instance.x, oy = camera.y - instance.y;
  const origin = [(ox * c + oy * s) / scale, (-ox * s + oy * c) / scale, (0.5 - (instance.z ?? 0)) / scale];
  for (const block of model.blocks) {
    const max = block.from.map((v, i) => v + block.size[i]);
    let left = width, right = 0, top = height, bottom = 0, clipped = false;
    for (let corner = 0; corner < 8; corner++) {
      const lx = (corner & 1 ? max[0] : block.from[0]) * scale;
      const ly = (corner & 2 ? max[1] : block.from[1]) * scale;
      const z = (corner & 4 ? max[2] : block.from[2]) * scale + (instance.z ?? 0);
      const x = instance.x + lx * c - ly * s - camera.x;
      const y = instance.y + lx * s + ly * c - camera.y;
      const d = x * dirX + y * dirY;
      if (d <= 0.001) { clipped = true; continue; }
      const sx = width / 2 * (1 + (-x * dirY + y * dirX) / (d * fovScale));
      const sy = (height >> 1) - (z - 0.5) * height / d;
      left = Math.min(left, sx); right = Math.max(right, sx);
      top = Math.min(top, sy); bottom = Math.max(bottom, sy);
    }
    const x0 = clipped ? 0 : Math.max(0, Math.floor(left));
    const x1 = clipped ? width : Math.min(width, Math.ceil(right));
    const y0 = clipped ? 0 : Math.max(0, Math.floor(top));
    const y1 = clipped ? height : Math.min(height, Math.ceil(bottom));
    for (let x = x0; x < x1; x++) {
      const cx = 2 * x / width - 1;
      const rx = dirX - dirY * fovScale * cx, ry = dirY + dirX * fovScale * cx;
      for (let y = y0; y < y1; y++) {
        // Stable two-pixel fragments share one mask across all faces, leaving real depth holes.
        if (dissolve > 0 && fragmentNoise(x, y) < dissolve) continue;
        const ray = [(rx * c + ry * s) / scale, (-rx * s + ry * c) / scale, ((height >> 1) - y - 0.5) / (height * scale)];
        let near = -Infinity, far = Infinity, face = 0, exitFace = 0, valid = true;
        for (let axis = 0; axis < 3; axis++) {
          if (Math.abs(ray[axis]) < 1e-12) {
            if (origin[axis] < block.from[axis] || origin[axis] > max[axis]) valid = false;
          } else {
            const a = (block.from[axis] - origin[axis]) / ray[axis];
            const b = (max[axis] - origin[axis]) / ray[axis];
            const entry = Math.min(a, b);
            if (entry > near) { near = entry; face = axis; }
            if (Math.max(a, b) < far) { far = Math.max(a, b); exitFace = axis; }
          }
        }
        const index = y * width + x;
        const hit = near > 0.001 ? near : far;
        if (near <= 0.001) face = exitFace;
        if (valid && far >= near && hit > 0.001 && hit < depth[index]) {
          depth[index] = hit;
          buffer[index] = shade(block.color, face === 2 ? 1 : face === 0 ? 0.8 : 0.65);
        }
      }
    }
  }
}
