// Experimental model-only browser backend. Game rules and HUD stay shared.
import type { Pixel3DEngine } from './engine';
import type { BlockModel } from './model';
import type { Thing3D } from './raycaster';
import type { Sky } from './sky';

type Frame = ReturnType<Pixel3DEngine['renderState']>;
type Vec = [number, number, number];
type Pose = Pick<Thing3D, 'x' | 'y' | 'z' | 'angle' | 'scale' | 'model'>;
type CapturedFrame = {
  frame: Frame;
  camera: Frame['camera'];
  sky: Sky;
  fov: number;
  time: number;
  poses?: Map<Thing3D, Pose>;
};
type Batch = {
  vao: WebGLVertexArrayObject;
  mesh: WebGLBuffer;
  instances: WebGLBuffer;
  vertices: number;
  transforms: Float32Array;
  count: number;
  capacity: number;
};
const TAU = 2 * Math.PI;
const radians = (degrees: number) => degrees * Math.PI / 180;
const blend = (from: number, to: number, t: number) => from + (to - from) * t;
const blendAngle = (from: number, to: number, t: number) =>
  from + (((to - from + 180) % 360 + 360) % 360 - 180) * t;
const rgb = (value: number): Vec => [(value & 255) / 255, ((value >>> 8) & 255) / 255, ((value >>> 16) & 255) / 255];

function mesh(model: BlockModel): Float32Array {
  const data: number[] = [];
  for (const { from, size, color, shape } of model.blocks) {
    const [r, g, b] = rgb(color);
    const vertex = (p: Vec, shade: number, normal: Vec = [0, 0, 0]) => {
      data.push(from[0] + p[0] * size[0], from[1] + p[1] * size[1], from[2] + p[2] * size[2],
        r, g, b, ...normal, shade);
    };
    const quad = (a: Vec, b: Vec, c: Vec, d: Vec, shade: number) => {
      for (const p of [a, b, c, a, c, d]) vertex(p, shade);
    };
    if (shape === 'sphere') {
      const point = (row: number, col: number): Vec => {
        const phi = Math.PI * row / 16, theta = TAU * col / 24;
        return [Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
      };
      for (let row = 0; row < 16; row++) for (let col = 0; col < 24; col++) {
        const a = point(row, col), b = point(row + 1, col);
        const c = point(row + 1, col + 1), d = point(row, col + 1);
        for (const n of [a, b, c, a, c, d]) vertex([.5 + n[0] / 2, .5 + n[1] / 2, .5 + n[2] / 2], 0, n);
      }
    } else if (shape === 'cylinder') {
      for (let col = 0; col < 24; col++) {
        const a = TAU * col / 24, b = TAU * (col + 1) / 24;
        const n: Vec = [Math.cos(a), Math.sin(a), 0], m: Vec = [Math.cos(b), Math.sin(b), 0];
        const p = (v: Vec, z: number): Vec => [.5 + v[0] / 2, .5 + v[1] / 2, z];
        const a0 = p(n, 0), a1 = p(n, 1), b0 = p(m, 0), b1 = p(m, 1);
        vertex(a0, 0, n); vertex(b0, 0, m); vertex(b1, 0, m);
        vertex(a0, 0, n); vertex(b1, 0, m); vertex(a1, 0, n);
        for (const v of [a0, b0, [.5, .5, 0] as Vec]) vertex(v, .55);
        for (const v of [a1, b1, [.5, .5, 1] as Vec]) vertex(v, .8875);
      }
    } else {
      const a: Vec = [0, 0, 0], b: Vec = [1, 0, 0], c: Vec = [1, 1, 0], d: Vec = [0, 1, 0];
      const ramp = shape === 'ramp', low = ramp ? 0 : 1;
      const e: Vec = [0, 0, low], f: Vec = [1, 0, 1], g: Vec = [1, 1, 1], h: Vec = [0, 1, low];
      quad(a, b, c, d, 1);
      quad(e, f, g, h, ramp ? .9 : 1);
      quad(b, c, g, f, .8);
      if (!ramp) quad(a, d, h, e, .8);
      quad(a, b, f, e, .65);
      quad(d, c, g, h, .65);
    }
  }
  return new Float32Array(data);
}

const header = '#version 300 es\nprecision highp float;\nprecision highp int;\n';
const colorPass = `
uniform vec3 palette[16];
uniform int bands;
uniform float light;
uniform vec3 tint;
vec3 finishColor(vec3 color) {
  color = clamp(color + tint, 0.0, 1.0) * light;
  if (bands == 0) return color;
  float luma = dot(color, vec3(54.0, 183.0, 19.0)) / 256.0;
  return palette[min(bands - 1, int(luma * float(bands)))];
}
`;

const skyVertex = `
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(pos * 2.0 - 1.0, 0, 1);
}
`;
const skyFragment = `
uniform vec2 viewport, heading, tilt;
uniform float fov, drift;
uniform uint seed;
uniform vec3 horizon, zenith, cloud, below;
out vec4 painted;
float noise(ivec2 xy, uint salt) {
  uint n = uint(xy.x) * 374761393u + uint(xy.y) * 668265263u + salt;
  n = (n ^ (n >> 13u)) * 1274126177u;
  return float(n ^ (n >> 16u)) / 4294967295.0;
}
float density(vec2 p, uint salt, int mask) {
  ivec2 cell = ivec2(floor(p));
  vec2 f = smoothstep(0.0, 1.0, fract(p));
  int x = cell.x & mask, xx = (cell.x + 1) & mask;
  float a = mix(noise(ivec2(x, cell.y), salt), noise(ivec2(xx, cell.y), salt), f.x);
  float b = mix(noise(ivec2(x, cell.y+1), salt), noise(ivec2(xx, cell.y+1), salt), f.x);
  return clamp((mix(a, b, f.y) - 0.5) * 4.0, 0.0, 1.0);
}
void main() {
  vec2 p = gl_FragCoord.xy / viewport - 0.5;
  vec2 right = vec2(-heading.y, heading.x);
  vec2 dir = heading * (tilt.x - tilt.y * p.y) + right * (2.0 * fov * p.x);
  float u = atan(dir.y, dir.x) * (64.0 / 6.28318530718);
  float rz = tilt.y + tilt.x * p.y;
  vec3 color;
  if (rz < 0.0) {
    float depth = min(1.0, -rz);
    color = mix(horizon, below, floor(sqrt(depth) * 32.0) / 32.0);
    float farCloud = density(vec2(u + drift * 0.35, depth * 23.0), seed, 63);
    float nearCloud = density(vec2(u / 2.0 + drift, depth * 14.0 + 13.0), seed + 719u, 31);
    color = mix(color, cloud, (farCloud * 0.18 + nearCloud * 0.42) * min(1.0, depth * 7.0));
  } else {
    float h = min(1.0, rz * 2.0);
    color = mix(horizon, zenith, floor(h * 16.0) / 16.0);
    color = mix(color, cloud, density(vec2(u + drift, h * 12.0), seed, 63) * min(1.0, h * 5.0));
  }
  painted = vec4(finishColor(color), 1);
}
`;

const modelVertex = `
layout(location=0) in vec3 point;
layout(location=1) in vec3 color;
layout(location=2) in vec4 shade;
layout(location=3) in vec4 positionScale;
layout(location=4) in vec3 rotationDissolve;
uniform vec3 eye;
uniform vec2 heading, tilt;
uniform float fov;
out vec3 pigment;
out vec4 shading;
flat out float dissolve;
void main() {
  vec3 local = point * positionScale.w;
  vec2 rotation = rotationDissolve.xy;
  vec3 p = positionScale.xyz - eye + vec3(rotation.x*local.x - rotation.y*local.y,
    rotation.y*local.x + rotation.x*local.y, local.z);
  float forward = dot(p.xy, heading);
  float side = dot(p.xy, vec2(-heading.y, heading.x));
  float distance = forward*tilt.x + p.z*tilt.y;
  float up = p.z*tilt.x - forward*tilt.y;
  // Near 0.05 and far 1000, with perspective division by distance.
  gl_Position = vec4(side/fov, 2.0*up, 1.000100005*distance - 0.100005, distance);
  pigment = color;
  shading = shade;
  dissolve = rotationDissolve.z;
}
`;
const modelFragment = `
in vec3 pigment;
in vec4 shading;
flat in float dissolve;
uniform float height;
out vec4 painted;
void main() {
  if (dissolve > 0.0) {
    uvec2 p = uvec2(gl_FragCoord.x, height - gl_FragCoord.y) / 2u;
    uint hash = p.x * 73856093u ^ p.y * 19349663u;
    if (float((hash ^ (hash >> 13u)) * 1274126177u) / 4294967296.0 < dissolve) discard;
  }
  float shade = shading.w;
  if (shade == 0.0) shade = 0.55 + 0.45 * max(0.0, dot(normalize(shading.xyz), vec3(-0.4,-0.5,0.75)));
  painted = vec4(finishColor(floor(pigment * shade * 255.0) / 255.0), 1);
}
`;

const silhouetteFragment = `
uniform highp sampler2D sceneColor, sceneDepth;
uniform int radius, diagonal;
uniform vec3 ink;
out vec4 painted;
float distanceAt(ivec2 pixel) {
  ivec2 limit = textureSize(sceneDepth, 0) - 1;
  float depth = texelFetch(sceneDepth, clamp(pixel, ivec2(0), limit), 0).r;
  return 50.0 / (1000.0 - 999.95 * depth);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 x = ivec2(radius, 0), y = ivec2(0, radius);
  float edge = min(min(distanceAt(p-x), distanceAt(p+x)), min(distanceAt(p-y), distanceAt(p+y)));
  if (diagonal > 0) {
    ivec2 a = ivec2(diagonal, diagonal), b = ivec2(diagonal, -diagonal);
    edge = min(edge, min(min(distanceAt(p-a), distanceAt(p+a)), min(distanceAt(p-b), distanceAt(p+b))));
  }
  if (distanceAt(p) - edge > max(0.12, edge * 0.025)) painted = vec4(ink, 1);
  else painted = texelFetch(sceneColor, p, 0);
}
`;

export function createWebGlRenderer(canvas: HTMLCanvasElement, models: Record<string, BlockModel> = {}) {
  const context = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: true, failIfMajorPerformanceCaveat: true });
  if (!context) return undefined;
  const gl: WebGL2RenderingContext = context;
  gl.disable(gl.DITHER);

  const programs: WebGLProgram[] = [];
  const shaders: WebGLShader[] = [];
  const batches = new Map<string, Batch>();
  const skyVao = gl.createVertexArray();
  let target: {
    framebuffer: WebGLFramebuffer; color: WebGLTexture; depth: WebGLTexture;
    width: number; height: number;
  } | undefined;
  const clearTarget = () => {
    if (!target) return;
    gl.deleteFramebuffer(target.framebuffer);
    gl.deleteTexture(target.color);
    gl.deleteTexture(target.depth);
    target = undefined;
  };
  const dispose = () => {
    clearTarget();
    gl.deleteVertexArray(skyVao);
    for (const { vao, mesh, instances } of batches.values()) {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(mesh);
      gl.deleteBuffer(instances);
    }
    for (const p of programs) gl.deleteProgram(p);
    for (const s of shaders) gl.deleteShader(s);
  };

  const program = (vertex: string, fragment: string, names: string[]) => {
    const handle = gl.createProgram();
    if (!handle) throw new Error('Could not allocate a WebGL program');
    programs.push(handle);
    for (const [type, source] of [[gl.VERTEX_SHADER, header + vertex], [gl.FRAGMENT_SHADER, header + colorPass + fragment]] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Could not allocate a WebGL shader');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compile failed');
      gl.attachShader(handle, shader);
    }
    gl.linkProgram(handle);
    if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(handle) ?? 'Program link failed');
    const loc = Object.fromEntries([...names, 'bands', 'palette[0]', 'light', 'tint'].map(name => [name, gl.getUniformLocation(handle, name)]));
    return { handle, loc };
  };

  try {
    const skyProgram = program(skyVertex, skyFragment, ['viewport', 'heading', 'tilt', 'fov', 'drift', 'seed', 'horizon', 'zenith', 'cloud', 'below']);
    const modelProgram = program(modelVertex, modelFragment, ['eye', 'heading', 'tilt', 'fov', 'height']);
    let silhouetteProgram: ReturnType<typeof program> | undefined;
    function bindSilhouetteTarget() {
      const { width, height } = canvas;
      if (target?.width === width && target.height === height) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        return target;
      }
      clearTarget();
      const framebuffer = gl.createFramebuffer(), color = gl.createTexture(), depth = gl.createTexture();
      if (!framebuffer || !color || !depth) {
        gl.deleteFramebuffer(framebuffer);
        gl.deleteTexture(color);
        gl.deleteTexture(depth);
        throw new Error('Could not allocate a WebGL silhouette target');
      }
      target = { framebuffer, color, depth, width, height };
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      for (const [texture, format, attachment] of [
        [color, gl.RGBA8, gl.COLOR_ATTACHMENT0],
        [depth, gl.DEPTH_COMPONENT24, gl.DEPTH_ATTACHMENT],
      ] as const) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, texture, 0);
      }
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('WebGL silhouette target is incomplete');
      }
      return target;
    }
    const floatsPerInstance = 7;
    function batchFor(name: string): Batch {
      const cached = batches.get(name);
      if (cached) return cached;
      const vertices = mesh(models[name]);
      const buffer = gl.createBuffer(), instances = gl.createBuffer(), vao = gl.createVertexArray();
      if (!buffer || !instances || !vao) {
        gl.deleteBuffer(buffer);
        gl.deleteBuffer(instances);
        gl.deleteVertexArray(vao);
        throw new Error('Could not allocate a WebGL mesh');
      }
      const batch = {
        vao, mesh: buffer, instances, vertices: vertices.length / 10,
        transforms: new Float32Array(floatsPerInstance * 8), count: 0, capacity: 0,
      };
      batches.set(name, batch);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      [3, 3, 4].forEach((count, index) => {
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(index, count, gl.FLOAT, false, 40, index * 12);
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, instances);
      for (const [location, count, offset] of [[3, 4, 0], [4, 3, 16]]) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, count, gl.FLOAT, false, floatsPerInstance * 4, offset);
        gl.vertexAttribDivisor(location, 1);
      }
      return batch;
    }
    let palette: number[] = [];
    const setPalette = (colors?: number[]) => {
      palette = colors?.flatMap(c => [(c >>> 16) / 255, ((c >>> 8) & 255) / 255, (c & 255) / 255]) ?? [];
    };
    let captured: CapturedFrame | undefined, previous: CapturedFrame | undefined;
    const capture = (frame: Frame, sky: Sky, fov: number, interpolate: boolean) => {
      const time = frame.title_scene ? frame.presentation_time : frame.time;
      const old = captured;
      previous = interpolate && old?.poses && old.sky === sky && old.frame.status === frame.status &&
        old.frame.level === frame.level && time > old.time && time - old.time < .1 ? old : undefined;
      const poses = interpolate ? new Map<Thing3D, Pose>() : undefined;
      if (poses) for (const thing of frame.things) {
        if (thing.visible !== false && thing.model) {
          const { x, y, z, angle, scale, model } = thing;
          poses.set(thing, { x, y, z, angle, scale, model });
        }
      }
      captured = { frame, camera: { ...frame.camera }, sky, fov, time, poses };
    };
    const resetInterpolation = () => { captured = previous = undefined; };
    const draw = (alpha = 1, outlineRadius = 0) => {
      if (gl.isContextLost()) throw new Error('WebGL context lost');
      if (!captured) throw new Error('WebGL frame has not been prepared');
      const { frame, sky, fov: fovDegrees } = captured;
      const { things } = frame;
      const target = captured.camera;
      const oldCamera = previous?.camera;
      const t = Math.max(0, Math.min(1, alpha));
      const camera = oldCamera && t < 1 &&
        Math.hypot(target.x - oldCamera.x, target.y - oldCamera.y, (target.height ?? .5) - (oldCamera.height ?? .5)) < 4
        ? {
          x: blend(oldCamera.x, target.x, t),
          y: blend(oldCamera.y, target.y, t),
          height: blend(oldCamera.height ?? .5, target.height ?? .5, t),
          angle: blendAngle(oldCamera.angle, target.angle, t),
          pitch: blend(oldCamera.pitch ?? 0, target.pitch ?? 0, t),
        } : target;
      const yaw = radians(camera.angle), pitch = radians(camera.pitch ?? 0);
      const heading: [number, number] = [Math.cos(yaw), Math.sin(yaw)];
      const tilt: [number, number] = [Math.cos(pitch), Math.sin(pitch)];
      const fov = Math.tan(radians(fovDegrees) / 2);
      const light = Math.max(0, 1 - (frame.ui?.cinema?.fade ?? 0));
      const flash = Math.min(1, frame.flash * .12);
      const red = Math.floor(180 * flash) / 255, other = -Math.floor(50 * flash) / 255;
      const time = previous ? blend(previous.time, captured.time, t) : captured.time;
      const setup = ({ handle, loc }: typeof skyProgram) => {
        gl.useProgram(handle);
        gl.uniform2f(loc.heading, ...heading);
        gl.uniform2f(loc.tilt, ...tilt);
        gl.uniform1f(loc.fov, fov);
        gl.uniform1f(loc.light, light);
        gl.uniform3f(loc.tint, red, other, other);
        gl.uniform1i(loc.bands, palette.length / 3);
        if (palette.length) gl.uniform3fv(loc['palette[0]'], palette);
        return loc;
      };
      const outlineTarget = outlineRadius ? bindSilhouetteTarget() : undefined;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.disable(gl.DEPTH_TEST);
      const s = setup(skyProgram);
      gl.uniform2f(s.viewport, canvas.width, canvas.height);
      gl.uniform1f(s.drift, time * sky.speed);
      gl.uniform1ui(s.seed, sky.seed);
      gl.uniform3f(s.horizon, ...rgb(sky.horizon));
      gl.uniform3f(s.zenith, ...rgb(sky.zenith));
      gl.uniform3f(s.cloud, ...rgb(sky.cloud));
      gl.uniform3f(s.below, ...rgb(sky.below ?? sky.horizon));
      gl.bindVertexArray(skyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      const m = setup(modelProgram);
      gl.uniform3f(m.eye, camera.x, camera.y, camera.height ?? .5);
      gl.uniform1f(m.height, canvas.height);
      for (const batch of batches.values()) batch.count = 0;
      for (const thing of things) {
        if (!thing.model || thing.visible === false || thing.dissolve === 1) continue;
        let { x, y, z = 0, angle = 0, scale = 1 } = thing;
        const old = t < 1 ? previous?.poses?.get(thing) : undefined;
        if (old && old.model === thing.model && Math.hypot(x - old.x, y - old.y, z - (old.z ?? 0)) < 4) {
          x = blend(old.x, x, t);
          y = blend(old.y, y, t);
          z = blend(old.z ?? 0, z, t);
          angle = blendAngle(old.angle ?? 0, angle, t);
          scale = blend(old.scale ?? 1, scale, t);
        }
        const batch = batchFor(thing.model);
        const offset = batch.count++ * floatsPerInstance;
        if (offset === batch.transforms.length) {
          const resized = new Float32Array(batch.transforms.length * 2);
          resized.set(batch.transforms);
          batch.transforms = resized;
        }
        const data = batch.transforms, rotation = radians(angle);
        data[offset] = x;
        data[offset + 1] = y;
        data[offset + 2] = z;
        data[offset + 3] = scale;
        data[offset + 4] = Math.cos(rotation);
        data[offset + 5] = Math.sin(rotation);
        data[offset + 6] = thing.dissolve ?? 0;
      }
      for (const batch of batches.values()) {
        if (!batch.count) continue;
        gl.bindVertexArray(batch.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, batch.instances);
        if (batch.capacity !== batch.transforms.byteLength) {
          batch.capacity = batch.transforms.byteLength;
          gl.bufferData(gl.ARRAY_BUFFER, batch.capacity, gl.DYNAMIC_DRAW);
        }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.transforms, 0, batch.count * floatsPerInstance);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, batch.vertices, batch.count);
      }
      if (outlineTarget) {
        silhouetteProgram ??= program(skyVertex, silhouetteFragment, ['sceneColor', 'sceneDepth', 'radius', 'diagonal', 'ink']);
        const { handle, loc } = silhouetteProgram;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(handle);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, outlineTarget.color);
        gl.uniform1i(loc.sceneColor, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, outlineTarget.depth);
        gl.uniform1i(loc.sceneDepth, 1);
        gl.uniform1i(loc.radius, outlineRadius);
        gl.uniform1i(loc.diagonal, Math.floor(outlineRadius / Math.SQRT2));
        gl.uniform3f(loc.ink, palette[0], palette[1], palette[2]);
        gl.bindVertexArray(skyVao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
    return { capture, draw, resetInterpolation, setPalette, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
