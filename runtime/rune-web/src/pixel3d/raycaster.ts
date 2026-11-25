import { fastSin, fastCos } from './math';
import { renderGrid } from './grid';
import type { Sprite } from '../pixel/engine';
import { skyPixel, type Sky } from './sky';
import { renderModel, type BlockModel } from './model';
import { renderHud, type GameHud } from './hud';
import { tetherModel, tetherPieces, type Tether3D } from './tether';
import { renderVoxels, type VoxelWorld, type VoxelChunks, type VoxelTerrainPose } from './voxel';
import { lightFrame, type PointLight3D } from './lighting';
import { EnhancedLighting, type EmissionBuffer } from './enhanced_lighting';

export interface Texture {
  width: number;
  height: number;
  pixels: Uint32Array; // 0xAABBGGRR / packed format
}

export interface MapData {
  spawn?: Camera3D;
  width: number;
  height: number;
  grid: number[]; // 0 = empty, >0 = texture index or door
  floor: number | Texture; // color number (packed) or Texture
  ceiling: number | Texture; // color number (packed) or Texture
  ceilingHeight?: number;
  sky?: Sky | null;
  doors?: Record<number, { open: number; texture: number }>;
}

export interface Camera3D {
  x: number;
  y: number;
  angle: number; // in degrees
  height?: number; // default 0.5
  z?: number; // voxel feet elevation
  pitch?: number;
  terrainPose?: VoxelTerrainPose;
  backdrop?: {
    x?: number;
    y: number;
    z: number;
    things: Thing3D[];
  };
}

export interface Thing3D {
  x: number;
  y: number;
  sprite?: string;
  model?: string;
  dissolve?: number;
  title?: string;
  titleHeight?: number;
  titleColor?: number;
  z?: number;
  angle?: number;
  pitch?: number;
  scale?: number;
  visible?: boolean;
}

export interface WallOverride {
  x: number;
  y: number;
  texture: number; // zero-based index in the compiled texture table
}

export interface ViewmodelWeapon {
  sprite: string;
  x?: number; // screen offset
  y?: number;
  bob?: number;
  flash?: boolean;
}

export interface Stats3D {
  titleScene?: { heading: string; subtitle: string; prompt: string };
  presentationTime?: number;
  ui?: GameHud;
  paused?: boolean;
  presentation?: Presentation;
  hudText?: string;
  heading?: number;
  status?: string;
  health?: number;
  ammo?: number;
  score?: number;
  kills?: number;
  level?: number;
  levelTitle?: string;
  storyTitle?: string;
  storyBody?: string;
  message?: string;
  switchActivated?: boolean;
}

export interface Presentation {
  title: string;
  subtitle: string;
  instructions: string[];
  objective: string;
  victory: string;
  defeat: string;
}

export interface RaycasterConfig {
  width: number;
  height: number;
  fov?: number; // degrees, default 66
  outline?: boolean;
  outlineColor?: number;
  textures: Record<string, Texture>;
  sprites: Record<string, Sprite>;
  models?: Record<string, BlockModel>;
  map: MapData;
  world?: VoxelWorld;
  fogColor?: number; // packed 0xAABBGGRR
  fogDist?: number; // max fog distance
}

const packed = (rgb: number) =>
  (0xff000000 | ((rgb & 255) << 16) | (rgb & 0xff00) | ((rgb >>> 16) & 255)) >>> 0;

const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '101111111111101', O: '010101101101010', P: '110101110100100',
  Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001110', ':': '000010000010000', '-': '000000111000000',
  '!': '010010010000010', '%': '101001010100101', '[': '011010010010011', ']': '110010010010110',
  '(': '010100100100010', ')': '010001001001010',
  '/': '001010010010100', '.': '000000000000010', ',': '000000000010010', '?': '110001010000010',
  '|': '010010010010010', '+': '000010111010000', '_': '000000000000111', '>': '100010001010100',
  '<': '001010100010001',
  ' ': '000000000000000',
};

export class Raycaster3D {
  width: number;
  height: number;
  buffer: Uint32Array;
  zBuffer: Float64Array;
  pixelDepth: Float64Array;
  fov: number;
  private hudScale = 1;
  private drawScale = 1;
  private palette?: Uint32Array;
  private silhouettes = false;
  private outlineColor = 0xff000000;
  private enhanced?: EnhancedLighting;

  get enhancedLighting(): boolean { return this.enhanced !== undefined; }

  setEnhancedLighting(enabled: boolean): void {
    if (enabled) this.enhanced ??= new EnhancedLighting();
    else this.enhanced = undefined;
  }

  get outlineRadius(): number {
    return this.silhouettes ? Math.max(1, Math.round(this.hudScale)) : 0;
  }

  constructor(readonly config: RaycasterConfig) {
    this.width = config.width;
    this.height = config.height;
    this.fov = config.fov || 66;
    this.silhouettes = Boolean(config.outline);
    if (config.outlineColor !== undefined) this.outlineColor = packed(config.outlineColor);
    this.buffer = new Uint32Array(this.width * this.height);
    this.zBuffer = new Float64Array(this.width);
    this.pixelDepth = new Float64Array(this.width * this.height);
    this.setMap(config.map);
  }

  setMap(map: MapData): void {
    const height = map.ceilingHeight ?? 1;
    if (!Number.isFinite(height) || height <= 0.5 || height > 16) {
      throw new Error('Map ceilingHeight must be greater than 0.5 and at most 16 tiles');
    }
    this.config.map = map;
  }

  resize(width: number, height: number, hudScale = 1): boolean {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
        width > 2048 || height > 2048 || width * height > 1048576) throw new Error('Invalid pixel3d viewport size');
    if (!Number.isFinite(hudScale) || hudScale <= 0) throw new Error('Invalid pixel3d HUD scale');
    const scaleChanged = this.hudScale !== hudScale;
    this.hudScale = hudScale;
    if (width === this.width && height === this.height) return scaleChanged;
    this.width = this.config.width = width;
    this.height = this.config.height = height;
    this.buffer = new Uint32Array(width * height);
    this.zBuffer = new Float64Array(width);
    this.pixelDepth = new Float64Array(width * height);
    return true;
  }

  setPalette(colors?: readonly number[], silhouettes = false): void {
    if (colors === undefined) {
      this.palette = undefined;
      this.silhouettes = silhouettes || Boolean(this.config.outline);
      return;
    }
    if (colors.length < 2 || colors.length > 16 ||
        !colors.every(color => Number.isInteger(color) && color >= 0 && color <= 0xffffff)) {
      throw new Error('Pixel-3d palette needs 2 to 16 RGB colors, from darkest to lightest');
    }
    this.palette = Uint32Array.from({ length: 256 }, (_, light) =>
      packed(colors[Math.floor(light * colors.length / 256)]));
    this.silhouettes = silhouettes || Boolean(this.config.outline);
  }

  render(
    camera: Camera3D,
    things: Thing3D[] = [],
    weapon?: ViewmodelWeapon,
    flash: number = 0,
    stats?: Stats3D,
    wallOverrides: WallOverride[] = [],
    time: number = 0,
    preparedChunks?: VoxelChunks,
    tethers: Tether3D[] = [],
    lights: readonly PointLight3D[] = []
  ): Uint32Array {
    const W = this.width;
    const H = this.height;
    const halfH = H >> 1;
    const map = this.config.map;
    const emission = this.enhanced?.begin(W, H);
    const px = camera.x;
    const py = camera.y;
    const ang = camera.angle;

    const pitched = !this.config.world && ((camera.height ?? .5) !== .5 || (camera.pitch ?? 0) !== 0 ||
      map.sky?.below !== undefined || lights.length > 0);
    // Pitched terrain and models use the same unquantized camera basis.
    const freeCamera = pitched || !!this.config.world;
    const dirX = freeCamera ? Math.cos(ang * Math.PI / 180) : fastCos(ang);
    const dirY = freeCamera ? Math.sin(ang * Math.PI / 180) : fastSin(ang);
    // plane is perpendicular to dir, length determines FOV
    const fovScale = Math.tan(((this.fov / 2) * Math.PI) / 180);
    const planeX = -dirY * fovScale;
    const planeY = dirX * fovScale;
    this.pixelDepth.fill(Infinity);
    if (!this.config.world && (tethers.length || things.some(t => t.model && t.visible !== false))) {
      for (let y = 0; y < H; y++) {
        if (y < halfH && map.sky) continue;
        const planeHeight = y < halfH ? (map.ceilingHeight ?? 1) - 0.5 : 0.5;
        const distance = planeHeight * H / Math.abs(halfH - y - 0.5);
        this.pixelDepth.fill(distance, y * W, (y + 1) * W);
      }
    }

    // 1. Floor & Ceiling casting
    const backdrop = this.config.world ? camera.backdrop : undefined;
    if (this.config.world) {
      if (backdrop) this.renderSideBackdrop(backdrop.x ?? camera.x, backdrop, fovScale, time, emission);
      renderVoxels(this.config.world, camera, this.config.textures, map.sky, this.fov,
        W, H, this.buffer, this.pixelDepth, time, preparedChunks, Boolean(backdrop));
      this.zBuffer.fill(Infinity);
    } else if (pitched) {
      renderGrid(map, camera, Object.values(this.config.textures), wallOverrides, things, this.config.sprites,
        this.fov, W, H, this.buffer, this.pixelDepth, time);
      this.zBuffer.fill(Infinity);
    } else {
      this.renderFloorAndCeiling(px, py, dirX, dirY, planeX, planeY, time);
      this.renderWalls(px, py, dirX, dirY, planeX, planeY, wallOverrides);
    }
    const modelCamera = this.config.world ? { ...camera, height: (camera.z ?? 0) + 1.25 } : camera;
    const backdropThings = backdrop && new Set(backdrop.things);
    for (const thing of things) {
      if (thing.visible === false || !thing.model || backdropThings?.has(thing)) continue;
      const model = this.config.models?.[thing.model];
      if (!model) throw new Error(`Unknown pixel-3d model: ${thing.model}`);
      this.enhanced?.rememberGlass(thing, model);
      const haze = emission && (!this.config.world || (!backdrop && thing.y < 4)) ? Math.min(.20, Math.max(0,
        ((thing.x - px) * dirX + (thing.y - py) * dirY - 11) * .025)) : 0;
      renderModel(model, thing, modelCamera, dirX, dirY, fovScale, W, H, this.buffer, this.pixelDepth,
        emission, haze, map.sky?.horizon);
    }
    for (const tether of tethers) {
      if (tether.visible === false) continue;
      const rod = tetherModel(false, packed(tether.color)), joint = tetherModel(true, packed(tether.color));
      for (const piece of tetherPieces(tether)) {
        renderModel(piece.joint ? joint : rod, piece, modelCamera, dirX, dirY, fovScale, W, H, this.buffer, this.pixelDepth);
      }
    }

    // 3. Billboards (Sprites / Things) sorted by distance
    if (!this.config.world && !pitched && things && things.length > 0) {
      this.renderThings(px, py, dirX, dirY, planeX, planeY, things);
    }

    if (lights.length) {
      lightFrame(lights, this.buffer, this.pixelDepth, W, H, modelCamera, dirX, dirY, fovScale,
        this.config.world ? H / 2 : halfH);
    }
    this.enhanced?.finish(this.buffer, this.pixelDepth, modelCamera, dirX, dirY, fovScale,
      this.config.world ? H / 2 : halfH, this.config.world, things, this.config.models ?? {}, map.sky?.horizon);
    if (this.silhouettes) this.drawSilhouettes();
    this.renderWorldTitles(camera, things, dirX, dirY, fovScale);

    // 4. Viewmodel Weapon (screen space, bottom-center)
    if (weapon && weapon.sprite) {
      this.renderWeapon(weapon);
    }

    // 5. Screen tint (e.g. damage flash or muzzle flash)
    if (flash > 0) {
      this.applyFlash(flash);
    }

    const fade=stats?.ui?.cinema?.fade??0;
    if(fade>0){
      const light=1-Math.min(1,fade);
      for(let i=0;i<this.buffer.length;i++){
        const c=this.buffer[i];this.buffer[i]=(0xff000000|Math.floor((c&255)*light)|Math.floor(((c>>>8)&255)*light)<<8|Math.floor(((c>>>16)&255)*light)<<16)>>>0;
      }
    }

    // 6. Retro HUD and status banners
    if (stats) this.drawHud(stats);
    this.applyPalette();
    return this.buffer;
  }

  private renderSideBackdrop(x: number, backdrop: NonNullable<Camera3D['backdrop']>, fovScale: number, time: number,
    emission?: EmissionBuffer): void {
    if (![x, backdrop.y, backdrop.z].every(Number.isFinite) || !Array.isArray(backdrop.things)) {
      throw new Error('Voxel backdrop needs a finite side camera position and a model list');
    }
    const { width, height, buffer, pixelDepth } = this;
    const sky = this.config.map.sky;
    buffer.fill(sky ? (0xff000000 | sky.horizon) >>> 0 : 0xff342820);
    if (sky) {
      const longitudes = Float64Array.from({ length: width }, (_, col) =>
        Math.atan2(-1, (2 * col / width - 1) * fovScale));
      const rows = sky.below === undefined ? height >> 1 : height;
      for (let row = 0; row < rows; row++) {
        const altitude = (height / 2 - row - .5) / height;
        for (let col = 0; col < width; col++) {
          buffer[row * width + col] = skyPixel(sky, longitudes[col], altitude, time);
        }
      }
    }
    const camera = { x, y: backdrop.y, height: backdrop.z + 1.25 };
    for (const thing of backdrop.things) {
      if (thing.visible === false || !thing.model) continue;
      const model = this.config.models?.[thing.model];
      if (!model) throw new Error(`Unknown pixel-3d model: ${thing.model}`);
      const haze = emission ? Math.min(.22, Math.max(0, (backdrop.y - thing.y - 10) * .027)) : 0;
      renderModel(model, thing, camera, 0, -1, fovScale, width, height, buffer, pixelDepth, emission, haze, sky?.horizon);
    }
    this.enhanced?.backdrop(buffer, pixelDepth);
    if (this.silhouettes) this.drawSilhouettes();
    pixelDepth.fill(Infinity);
  }

  /** Transparent HUD for the browser's model renderer. Uses the same layout and palette. */
  renderOverlay(stats: Stats3D): void {
    this.buffer.fill(0);
    this.drawHud(stats);
    this.applyPalette(true);
  }

  private drawHud(stats: Stats3D): void {
    this.drawScale = this.hudScale;
    try {
      this.renderHUD(stats);
    } finally {
      this.drawScale = 1;
    }
  }

  private applyPalette(transparent = false): void {
    const palette = this.palette;
    if (palette) {
      const pixels = this.buffer;
      for (let i = 0; i < pixels.length; i++) {
        const pixel = pixels[i];
        if (transparent && pixel === 0) continue;
        const light = ((pixel & 255) * 54 + ((pixel >>> 8) & 255) * 183 + ((pixel >>> 16) & 255) * 19) >>> 8;
        pixels[i] = palette[light];
      }
    }

  }

  private drawSilhouettes(): void {
    const { width, height, pixelDepth: depth, buffer } = this;
    const radius = this.outlineRadius;
    const diagonal = radius > 1 ? Math.max(1, Math.floor(radius / Math.SQRT2)) : 0;
    for (let y = 0; y < height; y++) {
      const row = y * width, above = Math.max(0, y - radius) * width, below = Math.min(height - 1, y + radius) * width;
      const upper = Math.max(0, y - diagonal) * width, lower = Math.min(height - 1, y + diagonal) * width;
      for (let x = 0; x < width; x++) {
        const i = row + x;
        let edge = Math.min(depth[row + Math.max(0, x - radius)], depth[row + Math.min(width - 1, x + radius)],
          depth[above + x], depth[below + x]);
        if (diagonal) {
          const left = Math.max(0, x - diagonal), right = Math.min(width - 1, x + diagonal);
          edge = Math.min(edge, depth[upper + left], depth[upper + right], depth[lower + left], depth[lower + right]);
        }
        if (depth[i] - edge > Math.max(.12, edge * .025)) buffer[i] = this.outlineColor;
      }
    }
  }

  /** Pixel-font plaques anchored above actors, using the same projection/depth as models. */
  private renderWorldTitles(camera:Camera3D,things:Thing3D[],dirX:number,dirY:number,fov:number):void {
    const eye=this.config.world?(camera.z??0)+1.25:(camera.height??.5);
    const pitch=(camera.pitch??0)*Math.PI/180,cp=Math.cos(pitch),sp=Math.sin(pitch);
    const labels:Array<{text:string;x:number;y:number;distance:number;color:number}>=[];
    for(const thing of things){
      if(thing.visible===false||thing.title===undefined||(thing.dissolve??0)>=1)continue;
      if(typeof thing.title!=='string'||!/^([\x20-\x7e]){1,48}$/.test(thing.title))throw new Error('Thing title must contain 1-48 printable characters');
      if(thing.titleHeight!==undefined&&(!Number.isFinite(thing.titleHeight)||thing.titleHeight<0||thing.titleHeight>64))throw new Error('Thing titleHeight must be in [0, 64]');
      if(thing.titleColor!==undefined&&(!Number.isInteger(thing.titleColor)||thing.titleColor<0||thing.titleColor>0xffffff))throw new Error('Thing titleColor must be an RGB integer');
      if(![thing.x,thing.y,thing.z??0,thing.scale??1].every(Number.isFinite)||(thing.scale??1)<=0)throw new Error('Titled thing position and scale must be finite and scale positive');
      let height=1;
      for(const block of this.config.models?.[thing.model??'']?.blocks??[])height=Math.max(height,block.from[2]+block.size[2]);
      const z=(thing.z??0)+(thing.titleHeight??(height*(thing.scale??1)+.4));
      const dx=thing.x-camera.x,dy=thing.y-camera.y,forward=dx*dirX+dy*dirY;
      const distance=forward*cp+(z-eye)*sp,side=-dx*dirY+dy*dirX,up=(z-eye)*cp-forward*sp;
      if(distance<=.1||distance>48)continue;
      const width=thing.title.length*4-1,x=Math.round(this.width/2*(1+side/(distance*fov))-width/2);
      const y=Math.round((this.height>>1)-up*this.height/distance)-5;
      if(x+width+3<0||x-3>=this.width||y+7<0||y-2>=this.height)continue;
      labels.push({text:thing.title.toUpperCase(),x,y,distance,color:thing.titleColor??0x9ceadd});
    }
    labels.sort((a,b)=>b.distance-a.distance);
    for(const label of labels){
      const width=label.text.length*4-1;
      const pixel=(x:number,y:number,color:number)=>{if(x>=0&&y>=0&&x<this.width&&y<this.height){const i=y*this.width+x;if(label.distance<this.pixelDepth[i])this.buffer[i]=packed(color);}};
      for(let y=-2;y<7;y++)for(let x=-3;x<width+3;x++)pixel(label.x+x,label.y+y,y===6?0x28616c:0x0b1b24);
      for(let c=0;c<label.text.length;c++){
        const glyph=FONT[label.text[c]];if(!glyph)continue;
        for(let i=0;i<glyph.length;i++)if(glyph[i]==='1')pixel(label.x+c*4+i%3,label.y+Math.floor(i/3),label.color);
      }
    }
  }

  rect(x: number, y: number, width: number, height: number, color: number): void {
    const c = packed(color);
    const scale = this.drawScale;
    const left = Math.min(this.width, Math.max(0, Math.floor(x * scale)));
    const top = Math.max(0, Math.floor(y * scale));
    const right = Math.min(this.width, Math.floor((x + width) * scale));
    const bottom = Math.min(this.height, Math.floor((y + height) * scale));
    for (let row = top; row < bottom; row++) {
      this.buffer.fill(c, row * this.width + left, row * this.width + Math.max(left, right));
    }
  }

  text(str: string, x: number, y: number, color = 0xf5e9cc, scale = 1, clip?:{top:number;bottom:number}): void {
    let curX = Math.floor(x);
    const curY = Math.floor(y);
    for (const char of str.toUpperCase()) {
      const glyph = FONT[char];
      if (glyph) {
        for (let p = 0; p < glyph.length; p++) {
          if (glyph[p] === '1') {
            const y=curY+Math.floor(p/3)*scale,top=Math.max(y,clip?.top??y),bottom=Math.min(y+scale,clip?.bottom??y+scale);
            if(bottom>top)this.rect(curX+(p%3)*scale,top,scale,bottom-top,color);
          }
        }
      }
      curX += 4 * scale;
    }
  }

  private renderHUD(stats: Stats3D) {
    const W = Math.floor(this.width / this.drawScale);
    const H = Math.floor(this.height / this.drawScale);
    if (stats.titleScene) {
      const title = stats.titleScene;
      const scale = Math.max(1, Math.min(4, Math.floor((W - 32) / (title.heading.length * 4))));
      const left = Math.floor((W - (title.heading.length * 4 - 1) * scale) / 2);
      const top = Math.floor(H * .18);
      const pulse = .6 + .4 * Math.sin((stats.presentationTime ?? 0) * 2);
      for (const [radius, color] of [[3, 0x102d3d], [2, 0x18536b], [1, 0x329cab]]) {
        for (const [ox, oy] of [[-radius, 0], [radius, 0], [0, -radius], [0, radius]]) {
          this.text(title.heading, left + ox, top + oy, color, scale);
        }
      }
      const channel = Math.floor(205 + 50 * pulse);
      this.text(title.heading, left, top, (channel << 16) | 0xffff, scale);
      const centered = (text: string, y: number, color: number) => this.text(text,
        Math.max(4, Math.floor((W - text.length * 4) / 2)), y, color);
      centered(title.subtitle, top + 5 * scale + 12, 0x9dc6d2);
      this.rect(0, H - 23, W, 23, 0x080f18);
      centered(title.prompt, H - 15, 0xa5e8ec);
      if (stats.ui?.panel) {
        const canvas = this.drawScale === 1 ? this : {
          width: W, height: H, rect: this.rect.bind(this), text: this.text.bind(this),
        };
        renderHud(canvas, { ...stats.ui, style: 'floating', heading: '', detail: '', objective: '', prompt: '' }, stats.status || 'title', false, this.config.sprites);
      }
      return;
    }
    if (stats.ui) {
      const canvas = this.drawScale === 1 ? this : {
        width: W, height: H, rect: this.rect.bind(this), text: this.text.bind(this),
      };
      renderHud(canvas, stats.ui, stats.status || 'playing', stats.paused || false, this.config.sprites);
      return;
    }
    if (stats.presentation) {
      const p = stats.presentation;
      this.rect(0, 0, W, 10, 0x0a0c0e);
      this.text(stats.hudText || p.title, 6, 2, 0xf6cc44);
      if (stats.status !== 'playing') {
        const bx = 18, by = 24;
        this.rect(bx, by, W - 36, H - 48, 0x10121c);
        this.rect(bx, by, W - 36, 2, 0xb29460);
        const title = stats.status === 'won' ? p.victory : stats.status === 'gameover' ? p.defeat : p.title;
        this.text(title, bx + 12, by + 14, 0xf6cc44, 2);
        this.text(p.subtitle, bx + 12, by + 34, 0xa0b6c7);
        p.instructions.forEach((line, i) => this.text(line, bx + 12, by + 52 + i * 13, 0xe4e0d4));
        this.text('ENTER / CLICK: BEGIN A NEW RUN', bx + 12, H - 44, 0x66aa44);
      }
      const message = stats.message || p.objective;
      this.rect(0, H - 12, W, 12, 0x0a0c0e);
      this.text(message, 6, H - 9, 0xe4e0d4);
      return;
    }

    // 1. Title Screen modal
    if (stats.status === 'title') {
      const bw = 280;
      const bh = 160;
      const bx = Math.floor((W - bw) / 2);
      const by = Math.floor((H - bh) / 2);

      this.rect(bx, by, bw, bh, 0x070c12);
      this.rect(bx, by, bw, 2, 0x3d7a8a);
      this.rect(bx, by + bh - 2, bw, 2, 0x3d7a8a);
      this.rect(bx, by, 2, bh, 0x3d7a8a);
      this.rect(bx + bw - 2, by, 2, bh, 0x3d7a8a);

      this.text('VECT BREACH', bx + 36, by + 16, 0xf6cc44, 3);
      this.text('CYBERNETIC SECTOR INFILTRATION', bx + 28, by + 46, 0x8899aa, 1);

      this.rect(bx + 20, by + 60, bw - 40, 1, 0x223344);

      this.text('WASD: MOVE / STRAFE       MOUSE: AIM', bx + 22, by + 72, 0xd49922, 1);
      this.text('SPACE / L-CLICK: FIRE     E: USE SWITCH', bx + 22, by + 86, 0xd49922, 1);
      this.text('PURGE GUARDS - UNLOCK ELEVATORS - SURVIVE', bx + 16, by + 102, 0x556677, 1);

      this.rect(bx + 20, by + 118, bw - 40, 1, 0x223344);

      this.text('PRESS ENTER OR CLICK TO BEGIN MISSION', bx + 18, by + 132, 0x66aa44, 1);
      return;
    }

    // 2. Story / Transmission Briefing modal
    if (stats.status === 'story') {
      const bw = 284;
      const bh = 164;
      const bx = Math.floor((W - bw) / 2);
      const by = Math.floor((H - bh) / 2);

      this.rect(bx, by, bw, bh, 0x06110a);
      this.rect(bx, by, bw, 2, 0x44aa33);
      this.rect(bx, by + bh - 2, bw, 2, 0x44aa33);
      this.rect(bx, by, 2, bh, 0x44aa33);
      this.rect(bx + bw - 2, by, 2, bh, 0x44aa33);

      this.text('// HIGH COMMAND TRANSMISSION //', bx + 28, by + 12, 0xf6cc44, 1);
      this.text(stats.levelTitle || stats.storyTitle || 'SECTOR BRIEFING', bx + 28, by + 26, 0x66aa44, 1);

      this.rect(bx + 16, by + 38, bw - 32, 1, 0x1b4025);

      const body = stats.storyBody || '';
      const lines = body.split('|');
      let textY = by + 48;
      for (const line of lines) {
        if (line.trim().length > 0) {
          this.text(line.trim(), bx + 20, textY, 0xe4e0d4, 1);
          textY += 14;
        }
      }

      this.rect(bx + 16, by + 124, bw - 32, 1, 0x1b4025);
      this.text('OBJECTIVE: LOCATE TERMINAL SWITCH & EXTRACT', bx + 18, by + 132, 0xd49922, 1);
      this.text('PRESS ENTER OR CLICK TO ENGAGE', bx + 42, by + 146, 0x66aa44, 1);
      return;
    }

    // 3. Top HUD bar during gameplay
    this.rect(0, 0, W, 9, 0x0a0c0e);
    const hp = stats.health ?? 100;
    const hpColor = hp > 30 ? 0x66aa44 : 0xdd3322;
    this.text(`SEC 0${stats.level ?? 1}`, 6, 2, 0x8899aa);
    this.text(`HP: ${hp}%`, 54, 2, hpColor);
    this.text(`AMMO: ${stats.ammo ?? 24}`, 114, 2, 0xf6cc44);
    this.text(`KILLS: ${stats.kills ?? 0}`, 174, 2, 0x8899aa);
    this.text(`SCORE: ${stats.score ?? 0}`, 230, 2, 0xe4e0d4);

    if (stats.switchActivated) {
      this.text('OVR', 296, 2, 0x66aa44);
    }

    if (stats.heading !== undefined) {
      const directions = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
      const direction = directions[Math.floor((((stats.heading % 360) + 360) % 360 + 22.5) / 45) % 8];
      this.rect(W - 48, 11, 46, 9, 0x0a0c0e);
      this.text(`FACING ${direction}`, W - 45, 13, 0xf6cc44);
    }

    // 4. In-game Interactive Message Banner
    if (stats.message && stats.message.length > 0) {
      const msgW = Math.min(W - 20, stats.message.length * 4 + 16);
      const msgX = Math.floor((W - msgW) / 2);
      this.rect(msgX, H - 24, msgW, 12, 0x0a0c0e);
      this.rect(msgX, H - 24, msgW, 1, 0xd49922);
      this.text(stats.message, msgX + 8, H - 21, 0xf6cc44, 1);
    }

    // 5. Grand Victory overlay
    if (stats.status === 'won') {
      const bw = 250;
      const bh = 68;
      const bx = Math.floor((W - bw) / 2);
      const by = Math.floor((H - bh) / 2) - 10;
      this.rect(bx, by, bw, bh, 0x0a140d);
      this.rect(bx, by, bw, 2, 0x66aa44);
      this.rect(bx, by + bh - 2, bw, 2, 0x66aa44);
      this.rect(bx, by, 2, bh, 0x66aa44);
      this.rect(bx + bw - 2, by, 2, bh, 0x66aa44);

      this.text('MISSION ACCOMPLISHED', bx + 26, by + 10, 0xf6cc44, 2);
      this.text('ALL 3 SECTORS SECURED // SYSTEM PURGED', bx + 16, by + 28, 0x66aa44, 1);
      this.text(`FINAL SCORE: ${stats.score ?? 0}  |  KILLS: ${stats.kills ?? 0}`, bx + 36, by + 40, 0x8899aa, 1);
      this.text('PRESS FIRE, CLICK OR ENTER TO REPLAY', bx + 20, by + 54, 0xe4e0d4, 1);
    }

    // 6. Game Over overlay
    if (stats.status === 'gameover') {
      const bw = 240;
      const bh = 60;
      const bx = Math.floor((W - bw) / 2);
      const by = Math.floor((H - bh) / 2) - 10;
      this.rect(bx, by, bw, bh, 0x1f0a0a);
      this.rect(bx, by, bw, 2, 0xdd3322);
      this.rect(bx, by + bh - 2, bw, 2, 0xdd3322);
      this.rect(bx, by, 2, bh, 0xdd3322);
      this.rect(bx + bw - 2, by, 2, bh, 0xdd3322);

      this.text('AGENT TERMINATED', bx + 38, by + 10, 0xdd3322, 2);
      this.text('CRITICAL VITALS LOST // SIGNAL LOST', bx + 30, by + 28, 0xdd3322, 1);
      this.text('PRESS FIRE, CLICK OR ENTER TO RETRY', bx + 14, by + 44, 0xf6cc44, 1);
    }
  }

  private renderFloorAndCeiling(
    px: number,
    py: number,
    dirX: number,
    dirY: number,
    planeX: number,
    planeY: number,
    time: number
  ) {
    const W = this.width;
    const H = this.height;
    const halfH = H >> 1;
    const map = this.config.map;

    const floorIsTex = typeof map.floor === 'object' && map.floor !== null;
    const ceilIsTex = typeof map.ceiling === 'object' && map.ceiling !== null;
    const floorColor = !floorIsTex
      ? typeof map.floor === 'number'
        ? ((map.floor & 0xff000000) === 0 ? (0xff000000 | map.floor) >>> 0 : map.floor >>> 0)
        : 0xff333333
      : 0;
    const ceilColor = !ceilIsTex
      ? typeof map.ceiling === 'number'
        ? ((map.ceiling & 0xff000000) === 0 ? (0xff000000 | map.ceiling) >>> 0 : map.ceiling >>> 0)
        : 0xff1a1a1a
      : 0;

    if (!floorIsTex && !ceilIsTex && !map.sky) {
      // Solid flat colors
      for (let y = 0; y < halfH; y++) {
        this.buffer.fill(ceilColor, y * W, (y + 1) * W);
      }
      for (let y = halfH; y < H; y++) {
        this.buffer.fill(floorColor, y * W, (y + 1) * W);
      }
      return;
    }

    const floorTex = floorIsTex ? (map.floor as Texture) : null;
    const ceilTex = ceilIsTex ? (map.ceiling as Texture) : null;

    // Initialize horizon rows too; textured surfaces must never retain old pixels.
    this.buffer.fill(ceilColor, 0, halfH * W);
    this.buffer.fill(floorColor, halfH * W);
    if (map.sky) {
      for (let x = 0; x < W; x++) {
        const cx = 2 * x / W - 1;
        const longitude = Math.atan2(dirY + planeY * cx, dirX + planeX * cx);
        for (let y = 0; y < halfH; y++) {
          this.buffer[y * W + x] = skyPixel(map.sky, longitude, (halfH - y) / halfH, time);
        }
      }
    }
    for (let y = halfH; y < H; y++) {
      const p = y - halfH + 0.5;
      const posZ = 0.5 * H;
      const rowDistance = posZ / p;

      const rowFloorIdx = y * W;
      const rowCeilIdx = (H - y - 1) * W;

      for (let x = 0; x < W; x++) {
        const cx = 2 * x / W - 1;
        const floorX = px + rowDistance * (dirX + planeX * cx);
        const floorY = py + rowDistance * (dirY + planeY * cx);
        if (floorTex) {
          const tx = ((Math.floor(floorX * floorTex.width)) & (floorTex.width - 1));
          const ty = ((Math.floor(floorY * floorTex.height)) & (floorTex.height - 1));
          this.buffer[rowFloorIdx + x] = floorTex.pixels[ty * floorTex.width + tx];
        } else {
          this.buffer[rowFloorIdx + x] = floorColor;
        }

        if (!map.sky && ceilTex) {
          const ceilingDistance = ((map.ceilingHeight ?? 1) - 0.5) * H / p;
          const ceilingX = px + ceilingDistance * (dirX + planeX * cx);
          const ceilingY = py + ceilingDistance * (dirY + planeY * cx);
          const tx = ((Math.floor(ceilingX * ceilTex.width)) & (ceilTex.width - 1));
          const ty = ((Math.floor(ceilingY * ceilTex.height)) & (ceilTex.height - 1));
          this.buffer[rowCeilIdx + x] = ceilTex.pixels[ty * ceilTex.width + tx];
        } else if (!map.sky) {
          this.buffer[rowCeilIdx + x] = ceilColor;
        }
      }
    }
  }

  private renderWalls(
    px: number,
    py: number,
    dirX: number,
    dirY: number,
    planeX: number,
    planeY: number,
    wallOverrides: WallOverride[]
  ) {
    const W = this.width;
    const H = this.height;
    const halfH = H >> 1;
    const map = this.config.map;
    const textureList = Object.values(this.config.textures);

    for (let x = 0; x < W; x++) {
      const cameraX = (2 * x) / W - 1;
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;

      let mapX = Math.floor(px);
      let mapY = Math.floor(py);

      const deltaDistX = Math.abs(1 / (rayDirX === 0 ? 1e-6 : rayDirX));
      const deltaDistY = Math.abs(1 / (rayDirY === 0 ? 1e-6 : rayDirY));

      let stepX: number;
      let stepY: number;
      let sideDistX: number;
      let sideDistY: number;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (px - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - px) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (py - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - py) * deltaDistY;
      }

      let hit = 0;
      let side = 0; // 0 for vertical NS wall, 1 for horizontal EW wall

      while (hit === 0) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }

        if (mapX < 0 || mapX >= map.width || mapY < 0 || mapY >= map.height) {
          hit = 1;
          break;
        }

        const cell = map.grid[mapY * map.width + mapX];
        if (cell > 0) {
          hit = cell;
        }
      }

      let perpWallDist: number;
      if (side === 0) {
        perpWallDist = sideDistX - deltaDistX;
      } else {
        perpWallDist = sideDistY - deltaDistY;
      }
      if (perpWallDist < 0.001) perpWallDist = 0.001;

      this.zBuffer[x] = perpWallDist;

      const lineHeight = Math.floor(H / perpWallDist);
      const drawStart = Math.max(0, Math.floor(-lineHeight * ((map.ceilingHeight ?? 1) - 0.5) + halfH));
      const drawEnd = Math.min(H - 1, Math.floor(lineHeight / 2 + halfH));

      // Select texture
      const override = wallOverrides.find(tile => tile.x === mapX && tile.y === mapY);
      const tex = (override ? textureList[override.texture] : undefined)
        || textureList[(hit - 1) % textureList.length] || textureList[0];
      if (!tex) continue;

      let wallX: number;
      if (side === 0) {
        wallX = py + perpWallDist * rayDirY;
      } else {
        wallX = px + perpWallDist * rayDirX;
      }
      wallX -= Math.floor(wallX);

      let texX = Math.floor(wallX * tex.width);
      if (side === 0 && rayDirX > 0) texX = tex.width - texX - 1;
      if (side === 1 && rayDirY < 0) texX = tex.width - texX - 1;
      texX = Math.max(0, Math.min(tex.width - 1, texX));

      const step = tex.height / lineHeight;
      const originalStart = Math.max(0, Math.floor(-lineHeight / 2 + halfH));
      let texPos = (drawStart - halfH + lineHeight / 2) * step;

      for (let y = drawStart; y <= drawEnd; y++) {
        if (y === originalStart) texPos = (originalStart - halfH + lineHeight / 2) * step;
        const texY = y < originalStart
          ? ((Math.floor(texPos) % tex.height) + tex.height) % tex.height
          : Math.min(tex.height - 1, Math.max(0, Math.floor(texPos)));
        texPos += step;
        let color = tex.pixels[texY * tex.width + texX] ?? 0xff000000;

        // Slight shadow on EW walls for depth perception
        if (side === 1) {
          const r = Math.floor((color & 0xff) * 0.75);
          const g = Math.floor(((color >> 8) & 0xff) * 0.75);
          const b = Math.floor(((color >> 16) & 0xff) * 0.75);
          color = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
        }

        this.buffer[y * W + x] = color;
        this.pixelDepth[y * W + x] = perpWallDist;
      }
    }
  }

  private renderThings(
    px: number,
    py: number,
    dirX: number,
    dirY: number,
    planeX: number,
    planeY: number,
    things: Thing3D[]
  ) {
    const W = this.width;
    const H = this.height;
    const halfH = H >> 1;

    // Sort things back-to-front
    const sorted = things
      .filter((t) => t.visible !== false)
      .map((t) => ({
        ...t,
        dist: (px - t.x) * (px - t.x) + (py - t.y) * (py - t.y),
      }))
      .sort((a, b) => b.dist - a.dist);

    const invDet = 1.0 / (planeX * dirY - dirX * planeY);

    for (const thing of sorted) {
      if (thing.model || !thing.sprite) continue;
      const sprite = this.config.sprites[thing.sprite];
      if (!sprite) continue;

      const spriteX = thing.x - px;
      const spriteY = thing.y - py;

      // Transform sprite with inverse camera matrix
      const transformX = invDet * (dirY * spriteX - dirX * spriteY);
      const transformY = invDet * (-planeY * spriteX + planeX * spriteY);

      if (transformY <= 0.1) continue; // Behind player

      const spriteScreenX = Math.floor((W / 2) * (1 + transformX / transformY));
      const scale = thing.scale || 1.0;
      const spriteH = Math.abs(Math.floor((H / transformY) * scale));
      const spriteW = Math.abs(Math.floor((H / transformY) * scale * (sprite.width / sprite.height)));

      const drawStartY = Math.max(0, Math.floor(-spriteH / 2 + halfH));
      const drawEndY = Math.min(H - 1, Math.floor(spriteH / 2 + halfH));
      const drawStartX = Math.max(0, Math.floor(-spriteW / 2 + spriteScreenX));
      const drawEndX = Math.min(W - 1, Math.floor(spriteW / 2 + spriteScreenX));

      for (let stripe = drawStartX; stripe <= drawEndX; stripe++) {
        if (transformY < this.zBuffer[stripe]) {
          const texX = Math.floor(((stripe - (-spriteW / 2 + spriteScreenX)) * sprite.width) / spriteW);
          if (texX < 0 || texX >= sprite.width) continue;

          for (let y = drawStartY; y <= drawEndY; y++) {
            const d = y - halfH + spriteH / 2;
            const texY = Math.floor((d * sprite.height) / spriteH);
            if (texY < 0 || texY >= sprite.height) continue;

            const colorIdx = sprite.pixels[texY * sprite.width + texX];
            const color = sprite.colors[colorIdx];
            if (color !== null && color !== undefined && transformY < this.pixelDepth[y * W + stripe]) {
              this.buffer[y * W + stripe] = packed(color);
            }
          }
        }
      }
    }
  }

  private renderWeapon(weapon: ViewmodelWeapon) {
    const sprite = this.config.sprites[weapon.sprite];
    if (!sprite) return;

    const W = this.width;
    const H = this.height;

    const scale = 2.5;
    const renderW = Math.floor(sprite.width * scale);
    const renderH = Math.floor(sprite.height * scale);

    const bobOffset = weapon.bob ? Math.sin(weapon.bob) * 4 : 0;
    const startX = Math.floor(W / 2 - renderW / 2 + (weapon.x || 0));
    const startY = Math.floor(H - renderH + (weapon.y || 0) + bobOffset);

    for (let sy = 0; sy < renderH; sy++) {
      const destY = startY + sy;
      if (destY < 0 || destY >= H) continue;
      const texY = Math.floor((sy * sprite.height) / renderH);

      for (let sx = 0; sx < renderW; sx++) {
        const destX = startX + sx;
        if (destX < 0 || destX >= W) continue;
        const texX = Math.floor((sx * sprite.width) / renderW);

        const colorIdx = sprite.pixels[texY * sprite.width + texX];
        const color = sprite.colors[colorIdx];
        if (color !== null && color !== undefined) {
          this.buffer[destY * W + destX] = packed(color);
        }
      }
    }
  }

  private applyFlash(amount: number) {
    // Red tint for damage
    const intensity = Math.min(1.0, amount * 0.12);
    const W = this.width;
    const H = this.height;
    for (let i = 0; i < W * H; i++) {
      const c = this.buffer[i];
      let r = c & 0xff; // In Uint32Array on little-endian, byte 0 is RED!
      let g = (c >> 8) & 0xff;
      let b = (c >> 16) & 0xff;
      r = Math.min(255, r + Math.floor(180 * intensity));
      g = Math.max(0, g - Math.floor(50 * intensity));
      b = Math.max(0, b - Math.floor(50 * intensity));
      this.buffer[i] = (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
    }
  }
}
