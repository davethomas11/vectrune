export interface Block {
  from: [number, number, number];
  size: [number, number, number];
  color: number;
  shape?: 'box' | 'sphere' | 'cylinder' | 'ramp';
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

/** Analytic box, sphere, cylinder and wedge hits share the raycaster's depth convention. */
export function renderModel(
  model: BlockModel, instance: ModelInstance,
  camera: { x: number; y: number; height?: number; pitch?: number }, dirX: number, dirY: number, fovScale: number,
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
  const eye = camera.height ?? .5, pitch = (camera.pitch ?? 0) * Math.PI / 180;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const c = Math.cos(angle), s = Math.sin(angle);
  const ox = camera.x - instance.x, oy = camera.y - instance.y;
  const origin = [(ox * c + oy * s) / scale, (-ox * s + oy * c) / scale, (eye - (instance.z ?? 0)) / scale];
  for (const block of model.blocks) {
    const max = block.from.map((v, i) => v + block.size[i]);
    const center = block.from.map((v, i) => v + block.size[i] / 2);
    let left = width, right = 0, top = height, bottom = 0, clipped = false, frontCorners = 0;
    let outsideLeft = 0, outsideRight = 0, outsideTop = 0, outsideBottom = 0;
    for (let corner = 0; corner < 8; corner++) {
      const lx = (corner & 1 ? max[0] : block.from[0]) * scale;
      const ly = (corner & 2 ? max[1] : block.from[1]) * scale;
      const z = (corner & 4 ? max[2] : block.from[2]) * scale + (instance.z ?? 0);
      const x = instance.x + lx * c - ly * s - camera.x;
      const y = instance.y + lx * s + ly * c - camera.y;
      const forward = x * dirX + y * dirY;
      const d = forward * cp + (z - eye) * sp;
      const side = -x * dirY + y * dirX;
      const up = (z - eye) * cp - forward * sp;
      // Test homogeneous frustum planes before perspective division. This also
      // rejects off-screen boxes crossing the near plane, whose projected bounds
      // otherwise conservatively cover the whole framebuffer.
      if (side < -d * fovScale - 1e-9) outsideLeft++;
      if (side > d * fovScale + 1e-9) outsideRight++;
      if (up > d * ((height >> 1) / height) + 1e-9) outsideTop++;
      if (up < -d * ((height - (height >> 1)) / height) - 1e-9) outsideBottom++;
      if (d <= 0.001) { clipped = true; continue; }
      frontCorners++;
      const sx = width / 2 * (1 + side / (d * fovScale));
      const sy = (height >> 1) - up * height / d;
      left = Math.min(left, sx); right = Math.max(right, sx);
      top = Math.min(top, sy); bottom = Math.max(bottom, sy);
    }
    // A box wholly behind the near plane cannot contribute a visible hit.
    // Only boxes crossing that plane need the conservative full-screen bounds.
    if (frontCorners === 0 || outsideLeft === 8 || outsideRight === 8 || outsideTop === 8 || outsideBottom === 8) continue;
    const colorX = shade(block.color, .8), colorY = shade(block.color, .65), colorZ = shade(block.color, 1);
    const x0 = clipped ? 0 : Math.max(0, Math.floor(left));
    const x1 = clipped ? width : Math.min(width, Math.ceil(right));
    const y0 = clipped ? 0 : Math.max(0, Math.floor(top));
    const y1 = clipped ? height : Math.min(height, Math.ceil(bottom));
    for (let x = x0; x < x1; x++) {
      const cx = 2 * x / width - 1;
      for (let y = y0; y < y1; y++) {
        // Stable two-pixel fragments share one mask across all faces, leaving real depth holes.
        if (dissolve > 0 && fragmentNoise(x, y) < dissolve) continue;
        const v = ((height >> 1) - y - .5) / height;
        const rx = dirX * cp - dirY * fovScale * cx - dirX * sp * v;
        const ry = dirY * cp + dirX * fovScale * cx - dirY * sp * v;
        const rayX = (rx * c + ry * s) / scale;
        const rayY = (-rx * s + ry * c) / scale;
        const rayZ = (sp + cp * v) / scale;
        let near = -Infinity, far = Infinity, face = 0, exitFace = 0, valid = true;
        for (let axis = 0; axis < 3; axis++) {
          const component = axis === 0 ? rayX : axis === 1 ? rayY : rayZ;
          if (Math.abs(component) < 1e-12) {
            if (origin[axis] < block.from[axis] || origin[axis] > max[axis]) valid = false;
          } else {
            const a = (block.from[axis] - origin[axis]) / component;
            const b = (max[axis] - origin[axis]) / component;
            const entry = Math.min(a, b);
            if (entry > near) { near = entry; face = axis; }
            if (Math.max(a, b) < far) { far = Math.max(a, b); exitFace = axis; }
          }
        }
        let curvedShade: number | undefined;
        if (block.shape === 'sphere' || block.shape === 'cylinder') {
          const px = origin[0]-center[0], py = origin[1]-center[1], pz = origin[2]-center[2];
          const sphere = block.shape === 'sphere', radius = block.size[0]/2;
          const a = rayX*rayX + rayY*rayY + (sphere ? rayZ*rayZ : 0);
          const b = px*rayX + py*rayY + (sphere ? pz*rayZ : 0);
          const k = px*px + py*py + (sphere ? pz*pz : 0) - radius*radius;
          if (a < 1e-20) { if (k > 0) valid = false; }
          else {
            const discriminant = b*b - a*k;
            if (discriminant < 0) valid = false;
            else {
              const root = Math.sqrt(discriminant);
              near = Math.max(near, (-b-root)/a);
              far = Math.min(far, (-b+root)/a);
            }
          }
          const distance = near > .001 ? near : far;
          const nx = px+rayX*distance, ny = py+rayY*distance, nz = pz+rayZ*distance;
          const cap = !sphere && Math.abs(Math.abs(nz)-block.size[2]/2) < 1e-7;
          const normalLength = sphere ? radius : Math.hypot(nx, ny);
          const light = cap ? (nz > 0 ? .75 : -.75) : (-.4*nx-.5*ny+(sphere ? .75*nz : 0))/normalLength;
          curvedShade = .55 + .45*Math.max(0, light);
        } else if (block.shape === 'ramp') {
          // Convex wedge: the top rises along local +X. Instance angle rotates it.
          const slope = block.size[2]/block.size[0];
          const offset = origin[2]-block.from[2]-slope*(origin[0]-block.from[0]);
          const rate = rayZ-slope*rayX;
          if (Math.abs(rate) < 1e-12) { if (offset > 0) valid = false; }
          else if (rate < 0 && -offset/rate > near) { near = -offset/rate; face = 3; }
          else if (rate > 0 && -offset/rate < far) { far = -offset/rate; exitFace = 3; }
        }
        const index = y * width + x;
        const hit = near > 0.001 ? near : far;
        if (near <= 0.001) face = exitFace;
        if (valid && far >= near && hit > 0.001 && hit < depth[index]) {
          depth[index] = hit;
          buffer[index] = curvedShade !== undefined ? shade(block.color, curvedShade)
            : face === 3 ? shade(block.color, .9) : face === 2 ? colorZ : face === 0 ? colorX : colorY;
        }
      }
    }
  }
}
