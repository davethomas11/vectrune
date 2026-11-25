import { voxelWorld, voxelFill, type VoxelWorld } from './voxel';
import { entityGroup } from './entities';

export interface SideMapLegendEntry {
  voxel?: number;
  center_voxel?: number;
  depth?: [number, number]; // [yStart, ySpan]
  model?: string;
  y?: number;
  zOffset?: number;
  scale?: number;
  angle?: number;
  spawn?: boolean;
  entity?: string;
  role?: string;
  barrier?: string;
  hazard?: string;
  ladder?: boolean;
  boss_door?: boolean;
  checkpoint?: boolean;
  pickup?: string;
  hp?: number;
  tag?: string;
}

export interface SideMapData {
  width: number;
  height: number;
  planeY?: number;
  depthY?: number;
  materials?: string[];
  legend: Record<string, SideMapLegendEntry>;
  rows: string[];
}

export interface SideLevelOptions {
  plane_y?: number;
  depth_y?: number;
  margin_z?: number;
  seed?: number;
  biome?: 'meadow' | 'ember';
  render_distance?: number;
  materials?: string[];
}

function getSideMap(name: string): SideMapData {
  const maps = (globalThis as any).__RuneSideMaps as Record<string, SideMapData> | undefined;
  const map = maps?.[name];
  if (!map) throw new Error(`Unknown @SideMap/${name}`);
  return map;
}

/**
 * Build a chunked pixel-3d side-scrolling level from a foreground @SideMap
 * and an optional background @SideMap.
 */
export function sideLevel(
  fgNameValue: unknown,
  bgNameValue?: unknown,
  optionsValue?: unknown
): Record<string, unknown> {
  if (typeof fgNameValue !== 'string' || !fgNameValue) {
    throw new Error('side_level requires a foreground @SideMap name');
  }
  const fg = getSideMap(fgNameValue);
  const bg = typeof bgNameValue === 'string' && bgNameValue.length > 0 ? getSideMap(bgNameValue) : undefined;
  const opts = (optionsValue && typeof optionsValue === 'object' && !Array.isArray(optionsValue)
    ? optionsValue
    : {}) as SideLevelOptions;

  const width = fg.width;
  const height = fg.height;
  const planeY = opts.plane_y ?? fg.planeY ?? 7;
  const depthY = opts.depth_y ?? fg.depthY ?? 20;
  const marginZ = opts.margin_z ?? 4;
  const materials = opts.materials ?? fg.materials;
  if (!Array.isArray(materials) || materials.length === 0) {
    throw new Error(`@SideMap/${fgNameValue} needs materials = [...]`);
  }
  for (const [symbol, entry] of Object.entries(fg.legend)) {
    const center = entry?.center_voxel;
    if (center === undefined) continue;
    if (!Number.isInteger(center) || center < 1 || center > materials.length ||
        !(entry.voxel && entry.voxel > 0) || (entry.depth?.[1] ?? 4) < 2 ||
        entry.boss_door || entry.barrier || entry.hazard) {
      throw new Error(`@SideMap/${fgNameValue} legend ${symbol}: center_voxel needs a valid material and a solid span of at least two tiles`);
    }
  }

  let spawn = { x: 4.5, y: planeY, z: 3, angle: 0, pitch: 0, vz: 0 };
  const world: VoxelWorld = voxelWorld(width, depthY, height + marginZ, materials, {
    seed: opts.seed ?? 701,
    biome: opts.biome ?? 'meadow',
    spawn,
    renderDistance: opts.render_distance ?? 128,
  });

  const sceneryRaw: Array<Record<string, unknown>> = [];
  const entities: Array<Record<string, unknown>> = [];
  const barriers: Array<Record<string, unknown>> = [];
  const hazards: Array<Record<string, unknown>> = [];
  const ladders: Array<Record<string, unknown>> = [];
  const bossDoors: Array<Record<string, unknown>> = [];
  const checkpoints: Array<Record<string, unknown>> = [];
  const pickups: Array<Record<string, unknown>> = [];
  let boss: Record<string, unknown> | null = null;

  // 1. Parse foreground map (row 0 = top of level, last row = z = 0)
  for (let row = 0; row < height; row++) {
    const z = height - 1 - row;
    const line = fg.rows[row];
    let runVoxel = 0;
    let runCenter = 0;
    let runY0 = 0;
    let runYSpan = 0;
    let runStart = 0;

    const flushRun = (endX: number) => {
      if (runVoxel > 0 && endX > runStart) {
        voxelFill(world, [runStart, runY0, z], [endX - runStart, runYSpan, 1], runVoxel);
        if (runCenter) {
          const centerY = runY0 + Math.floor((runYSpan - 2) / 2);
          voxelFill(world, [runStart, centerY, z], [endX - runStart, 2, 1], runCenter);
        }
      }
      runVoxel = 0;
    };

    for (let x = 0; x < width; x++) {
      const ch = line[x];
      const entry = fg.legend[ch];
      if (!entry) {
        flushRun(x);
        continue;
      }

      if (entry.voxel && entry.voxel > 0 && !entry.boss_door) {
        const y0 = entry.depth ? entry.depth[0] : Math.max(0, Math.floor(planeY) - 2);
        const ySpan = entry.depth ? entry.depth[1] : 4;
        const center = entry.center_voxel ?? 0;
        if (runVoxel === entry.voxel && runY0 === y0 && runYSpan === ySpan && runCenter === center) {
          // continue run
        } else {
          flushRun(x);
          runVoxel = entry.voxel;
          runCenter = center;
          runY0 = y0;
          runYSpan = ySpan;
          runStart = x;
        }
      } else {
        flushRun(x);
      }

      if (entry.spawn) {
        spawn = { x: x + 0.5, y: planeY, z, angle: 0, pitch: 0, vz: 0 };
        world.spawn = spawn;
      }

      if (entry.barrier) {
        const y0 = entry.depth ? entry.depth[0] : Math.max(0, Math.floor(planeY) - 2);
        const ySpan = entry.depth ? entry.depth[1] : 4;
        barriers.push({
          x,
          z,
          y_start: y0,
          y_span: ySpan,
          kind: entry.barrier,
          voxel: entry.voxel ?? 0,
          open: false,
          model: entry.model ?? '',
          tag: entry.tag ?? entry.barrier,
        });
      }

      if (entry.hazard) {
        hazards.push({
          x,
          z,
          kind: entry.hazard,
          frozen: false,
          model: entry.model ?? '',
        });
      }

      if (entry.ladder) {
        ladders.push({
          x: x + 0.5,
          y: entry.y ?? planeY,
          z,
        });
        if (entry.model) {
          sceneryRaw.push({
            x: x + 0.5,
            y: entry.y ?? planeY,
            z: z + (entry.zOffset ?? 0),
            model: entry.model,
            scale: entry.scale ?? 1,
            angle: entry.angle ?? 0,
          });
        }
      }

      if (entry.boss_door) {
        const y0 = entry.depth ? entry.depth[0] : Math.max(0, Math.floor(planeY) - 2);
        const ySpan = entry.depth ? entry.depth[1] : 4;
        bossDoors.push({
          x,
          z,
          y_start: y0,
          y_span: ySpan,
          voxel: entry.voxel ?? 4,
        });
        if (entry.model) {
          sceneryRaw.push({
            x: x + 0.5,
            y: entry.y ?? planeY,
            z: z + (entry.zOffset ?? 0),
            model: entry.model,
            scale: entry.scale ?? 1,
            angle: entry.angle ?? 0,
          });
        }
      }

      if (entry.checkpoint) {
        checkpoints.push({
          x: x + 0.5,
          y: entry.y ?? planeY,
          z: z + (entry.zOffset ?? 0),
          active: false,
          model: entry.model ?? '',
        });
      }

      if (entry.pickup) {
        pickups.push({
          x: x + 0.5,
          y: entry.y ?? planeY,
          z: z + (entry.zOffset ?? 0.35),
          base: z + (entry.zOffset ?? 0.35),
          kind: entry.pickup,
          model: entry.model ?? '',
          visible: true,
        });
      }

      if (entry.entity) {
        const item: Record<string, unknown> = {
          x: x + 0.5,
          y: entry.y ?? planeY,
          z: z + (entry.zOffset ?? 0),
          home_x: x + 0.5,
          home_z: z + (entry.zOffset ?? 0),
          kind: entry.entity,
          model: entry.model ?? '',
          hp: entry.hp ?? 3,
          max_hp: entry.hp ?? 3,
          dir: -1,
          cd: 20,
          alive: true,
          visible: true,
        };
        if (entry.role === 'boss' || entry.entity === 'boss') {
          boss = item;
        } else {
          entities.push(item);
        }
      } else if (entry.model && !entry.barrier && !entry.hazard && !entry.ladder && !entry.boss_door && !entry.checkpoint && !entry.pickup) {
        sceneryRaw.push({
          x: x + 0.5,
          y: entry.y ?? planeY,
          z: z + (entry.zOffset ?? 0),
          model: entry.model,
          scale: entry.scale ?? 1,
          angle: entry.angle ?? 0,
        });
      }
    }
    flushRun(width);
  }

  // 2. Parse background map (3D parallax architecture & billboards behind the playable plane)
  if (bg) {
    const xScale = width / Math.max(1, bg.width);
    for (let row = 0; row < bg.height; row++) {
      const z = bg.height - 1 - row;
      const line = bg.rows[row];
      for (let bx = 0; bx < bg.width; bx++) {
        const ch = line[bx];
        const entry = bg.legend[ch];
        if (!entry) continue;
        const wx = Math.floor(bx * xScale);
        if (entry.voxel && entry.voxel > 0 && !entry.boss_door) {
          const y0 = entry.depth ? entry.depth[0] : 0;
          const ySpan = entry.depth ? entry.depth[1] : 2;
          if (wx >= 0 && wx < width && z >= 0 && z < height + marginZ) {
            voxelFill(world, [wx, y0, z], [Math.max(1, Math.min(width - wx, Math.round(xScale))), ySpan, 1], entry.voxel);
          }
        }
        if (entry.model) {
          sceneryRaw.push({
            x: (bx + 0.5) * xScale,
            y: entry.y ?? bg.planeY ?? 2.5,
            z: z + (entry.zOffset ?? 0),
            model: entry.model,
            scale: entry.scale ?? 1,
            angle: entry.angle ?? 0,
          });
        }
      }
    }
  }

  return {
    world,
    width,
    height,
    plane_y: planeY,
    spawn,
    scenery: entityGroup(sceneryRaw),
    entities,
    barriers,
    hazards,
    ladders,
    boss_doors: bossDoors,
    checkpoints,
    pickups,
    boss,
  };
}
