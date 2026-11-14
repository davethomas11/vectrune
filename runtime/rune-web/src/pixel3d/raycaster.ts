import { fastSin, fastCos } from './math';
import type { Sprite } from '../pixel/engine';

export interface Texture {
  width: number;
  height: number;
  pixels: Uint32Array; // 0xAABBGGRR / packed format
}

export interface MapData {
  width: number;
  height: number;
  grid: number[]; // 0 = empty, >0 = texture index or door
  floor: number | Texture; // color number (packed) or Texture
  ceiling: number | Texture; // color number (packed) or Texture
  doors?: Record<number, { open: number; texture: number }>;
}

export interface Camera3D {
  x: number;
  y: number;
  angle: number; // in degrees
  height?: number; // default 0.5
}

export interface Thing3D {
  x: number;
  y: number;
  sprite: string;
  scale?: number;
  visible?: boolean;
}

export interface ViewmodelWeapon {
  sprite: string;
  x?: number; // screen offset
  y?: number;
  bob?: number;
  flash?: boolean;
}

export interface Stats3D {
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

export interface RaycasterConfig {
  width: number;
  height: number;
  fov?: number; // degrees, default 66
  textures: Record<string, Texture>;
  sprites: Record<string, Sprite>;
  map: MapData;
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
  '/': '001010010010100', '.': '000000000000010', ',': '000000000010010', '?': '110001010000010',
  '|': '010010010010010', '+': '000010111010000', '_': '000000000000111', '>': '100010001010100',
  '<': '001010100010001',
  ' ': '000000000000000',
};

export class Raycaster3D {
  readonly width: number;
  readonly height: number;
  readonly buffer: Uint32Array;
  readonly zBuffer: Float64Array;
  readonly fov: number;

  constructor(readonly config: RaycasterConfig) {
    this.width = config.width;
    this.height = config.height;
    this.fov = config.fov || 66;
    this.buffer = new Uint32Array(this.width * this.height);
    this.zBuffer = new Float64Array(this.width);
  }

  setMap(map: MapData): void {
    this.config.map = map;
  }

  render(
    camera: Camera3D,
    things: Thing3D[] = [],
    weapon?: ViewmodelWeapon,
    flash: number = 0,
    stats?: Stats3D
  ): Uint32Array {
    const W = this.width;
    const H = this.height;
    const halfH = H >> 1;
    const map = this.config.map;
    const px = camera.x;
    const py = camera.y;
    const ang = camera.angle;

    // View direction vector and camera plane
    const dirX = fastCos(ang);
    const dirY = fastSin(ang);
    // plane is perpendicular to dir, length determines FOV
    const fovScale = Math.tan(((this.fov / 2) * Math.PI) / 180);
    const planeX = -dirY * fovScale;
    const planeY = dirX * fovScale;

    // 1. Floor & Ceiling casting
    this.renderFloorAndCeiling(px, py, dirX, dirY, planeX, planeY);

    // 2. Wall casting (DDA)
    this.renderWalls(px, py, dirX, dirY, planeX, planeY);

    // 3. Billboards (Sprites / Things) sorted by distance
    if (things && things.length > 0) {
      this.renderThings(px, py, dirX, dirY, planeX, planeY, things);
    }

    // 4. Viewmodel Weapon (screen space, bottom-center)
    if (weapon && weapon.sprite) {
      this.renderWeapon(weapon);
    }

    // 5. Screen tint (e.g. damage flash or muzzle flash)
    if (flash > 0) {
      this.applyFlash(flash);
    }

    // 6. Retro HUD and status banners
    if (stats) {
      this.renderHUD(stats);
    }

    return this.buffer;
  }

  rect(x: number, y: number, width: number, height: number, color: number): void {
    const c = packed(color);
    const left = Math.min(this.width, Math.max(0, Math.floor(x)));
    const top = Math.max(0, Math.floor(y));
    const right = Math.min(this.width, Math.floor(x + width));
    const bottom = Math.min(this.height, Math.floor(y + height));
    for (let row = top; row < bottom; row++) {
      this.buffer.fill(c, row * this.width + left, row * this.width + Math.max(left, right));
    }
  }

  text(str: string, x: number, y: number, color = 0xf5e9cc, scale = 1): void {
    let curX = Math.floor(x);
    const curY = Math.floor(y);
    for (const char of str.toUpperCase()) {
      const glyph = FONT[char];
      if (glyph) {
        for (let p = 0; p < glyph.length; p++) {
          if (glyph[p] === '1') {
            this.rect(curX + (p % 3) * scale, curY + Math.floor(p / 3) * scale, scale, scale, color);
          }
        }
      }
      curX += 4 * scale;
    }
  }

  private renderHUD(stats: Stats3D) {
    const W = this.width;
    const H = this.height;

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
    planeY: number
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

    if (!floorIsTex && !ceilIsTex) {
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

    for (let y = halfH + 1; y < H; y++) {
      const p = y - halfH;
      const posZ = 0.5 * H;
      const rowDistance = posZ / p;

      const floorStepX = (rowDistance * (planeX * 2)) / W;
      const floorStepY = (rowDistance * (planeY * 2)) / W;

      let floorX = px + rowDistance * (dirX - planeX);
      let floorY = py + rowDistance * (dirY - planeY);

      const rowFloorIdx = y * W;
      const rowCeilIdx = (H - y - 1) * W;

      for (let x = 0; x < W; x++) {
        if (floorTex) {
          const tx = ((Math.floor(floorX * floorTex.width)) & (floorTex.width - 1));
          const ty = ((Math.floor(floorY * floorTex.height)) & (floorTex.height - 1));
          this.buffer[rowFloorIdx + x] = floorTex.pixels[ty * floorTex.width + tx];
        } else {
          this.buffer[rowFloorIdx + x] = floorColor;
        }

        if (ceilTex) {
          const tx = ((Math.floor(floorX * ceilTex.width)) & (ceilTex.width - 1));
          const ty = ((Math.floor(floorY * ceilTex.height)) & (ceilTex.height - 1));
          this.buffer[rowCeilIdx + x] = ceilTex.pixels[ty * ceilTex.width + tx];
        } else {
          this.buffer[rowCeilIdx + x] = ceilColor;
        }

        floorX += floorStepX;
        floorY += floorStepY;
      }
    }
  }

  private renderWalls(
    px: number,
    py: number,
    dirX: number,
    dirY: number,
    planeX: number,
    planeY: number
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
      const drawStart = Math.max(0, Math.floor(-lineHeight / 2 + halfH));
      const drawEnd = Math.min(H - 1, Math.floor(lineHeight / 2 + halfH));

      // Select texture
      const tex = textureList[(hit - 1) % textureList.length] || textureList[0];
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
      let texPos = (drawStart - halfH + lineHeight / 2) * step;

      for (let y = drawStart; y <= drawEnd; y++) {
        const texY = Math.min(tex.height - 1, Math.max(0, Math.floor(texPos)));
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
            if (color !== null && color !== undefined) {
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

