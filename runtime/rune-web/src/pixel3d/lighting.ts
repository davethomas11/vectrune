export interface PointLight3D {
  x: number;
  y: number;
  z: number;
  color: number;
  radius: number;
  intensity: number;
}

export function validatePointLights(value: unknown): PointLight3D[] {
  if (!Array.isArray(value) || value.length > 8) throw new Error('Pixel-3d lights needs an array of up to 8 point lights');
  return value.map(light => {
    if (!light || typeof light !== 'object') throw new Error('Pixel-3d point light must be an object');
    const { x, y, z, radius, intensity, color } = light;
    const rgb = typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? parseInt(color.slice(1), 16) : color;
    if (![x, y, z, radius, intensity].every(Number.isFinite) || radius <= 0 || radius > 64 ||
        intensity < 0 || intensity > 1 || !Number.isInteger(rgb) || rgb < 0 || rgb > 0xffffff) {
      throw new Error('Pixel-3d point light needs finite x/y/z, radius in (0, 64], intensity in [0, 1], and an RGB color');
    }
    return { x, y, z, radius, intensity, color: rgb };
  });
}

/** Use the same perspective rays as voxel rendering. Pixels without scene depth receive no light. */
export function lightFrame(lights: readonly PointLight3D[], buffer: Uint32Array, depth: Float64Array,
  width: number, height: number, camera: { x: number; y: number; height?: number; pitch?: number },
  dirX: number, dirY: number, fovScale: number, rowOrigin = height / 2): void {
  const eye = camera.height ?? .5;
  const pitch = (camera.pitch ?? 0) * Math.PI / 180;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const columnStep = 2 * fovScale / width;
  for (const light of lights) {
    if (light.intensity <= 0) continue;
    const dx = light.x - camera.x, dy = light.y - camera.y, dz = light.z - eye;
    const heading = dx * dirX + dy * dirY;
    const forward = heading * cp + dz * sp;
    const up = dz * cp - heading * sp;
    const side = -dx * dirY + dy * dirX;
    const radius = light.radius, near = forward - radius, far = forward + radius;
    if (far <= 0) continue;
    let left = 0, right = width, top = 0, bottom = height;
    if (near > 0) {
      // Project the camera-aligned bounds of the sphere conservatively.
      const xMin = (side - radius) / (side - radius < 0 ? near : far);
      const xMax = (side + radius) / (side + radius > 0 ? near : far);
      const yMin = (up - radius) / (up - radius < 0 ? near : far);
      const yMax = (up + radius) / (up + radius > 0 ? near : far);
      left = Math.max(0, Math.floor((xMin / fovScale + 1) * width / 2));
      right = Math.min(width, Math.ceil((xMax / fovScale + 1) * width / 2) + 1);
      top = Math.max(0, Math.floor(rowOrigin - yMax * height - .5));
      bottom = Math.min(height, Math.ceil(rowOrigin - yMin * height - .5) + 1);
    }
    const radiusSquared = radius * radius;
    const red = (light.color >>> 16) * light.intensity;
    const green = ((light.color >>> 8) & 255) * light.intensity;
    const blue = (light.color & 255) * light.intensity;
    for (let y = top; y < bottom; y++) {
      const rayUp = (rowOrigin - y - .5) / height;
      for (let x = left; x < right; x++) {
        const i = y * width + x, distance = depth[i];
        if (!Number.isFinite(distance) || distance < near || distance > far) continue;
        const atSide = distance * (x * columnStep - fovScale) - side;
        const atUp = distance * rayUp - up;
        const atForward = distance - forward;
        const distanceSquared = atSide * atSide + atUp * atUp + atForward * atForward;
        if (distanceSquared >= radiusSquared) continue;
        const edge = 1 - distanceSquared / radiusSquared, amount = edge * edge;
        const color = buffer[i];
        const r = Math.min(255, (color & 255) + red * amount) | 0;
        const g = Math.min(255, ((color >>> 8) & 255) + green * amount) | 0;
        const b = Math.min(255, ((color >>> 16) & 255) + blue * amount) | 0;
        buffer[i] = (0xff000000 | b << 16 | g << 8 | r) >>> 0;
      }
    }
  }
}
