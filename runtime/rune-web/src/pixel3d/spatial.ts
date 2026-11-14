import { fastSin, fastCos, fastAtan2Deg } from './math';

export interface SpatialMap {
  width: number;
  height: number;
  grid: number[]; // 0 = empty, >0 = wall/door id
  doors?: Record<number, { open: number; state: 'closed' | 'opening' | 'open' | 'closing' }>;
}

let activeMap: SpatialMap | null = null;

export function setActiveMap(map: SpatialMap | null): void {
  activeMap = map;
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).__RuneSpatialMap = map;
  }
}

export function getActiveMap(): SpatialMap | null {
  return (
    activeMap ||
    (typeof globalThis !== 'undefined'
      ? (globalThis as any).__RuneSpatialMap
      : null) ||
    null
  );
}

export function isWallAt(x: number, y: number, map: SpatialMap | null = getActiveMap()): boolean {
  const m = map || getActiveMap();
  if (!m) return false;
  const mx = Math.floor(x);
  const my = Math.floor(y);
  if (mx < 0 || mx >= m.width || my < 0 || my >= m.height) return true;
  const cell = m.grid[my * m.width + mx];
  if (cell === 0) return false;
  if (m.doors && m.doors[cell]) {
    return m.doors[cell].open < 0.8;
  }
  return true;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(fromX: number, fromY: number, toX: number, toY: number): number {
  return fastAtan2Deg(toY - fromY, toX - fromX);
}

/**
 * Checks whether a circle at (x, y) with the given radius intersects any solid map wall/door.
 */
export function collidesWithWall(
  x: number,
  y: number,
  radius: number,
  map: SpatialMap
): boolean {
  const minX = Math.floor(x - radius);
  const maxX = Math.floor(x + radius);
  const minY = Math.floor(y - radius);
  const maxY = Math.floor(y + radius);

  for (let my = minY; my <= maxY; my++) {
    for (let mx = minX; mx <= maxX; mx++) {
      if (mx < 0 || mx >= map.width || my < 0 || my >= map.height) {
        return true;
      }
      const cell = map.grid[my * map.width + mx];
      let isWall = cell !== 0;
      if (cell !== 0 && map.doors && map.doors[cell]) {
        isWall = map.doors[cell].open < 0.8;
      }
      if (isWall) {
        // Find closest point on tile [mx, mx+1] x [my, my+1] to (x, y)
        const cx = Math.max(mx, Math.min(mx + 1, x));
        const cy = Math.max(my, Math.min(my + 1, y));
        const distX = x - cx;
        const distY = y - cy;
        // Collision threshold with tiny epsilon to prevent sticking
        const r = radius - 0.001;
        if (distX * distX + distY * distY < r * r) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Slide entity against grid walls with a radius cylinder.
 * Performs independent axis collision checks for smooth sliding along wall surfaces.
 * Returns { x, y }
 */
export function slide(
  px: number,
  py: number,
  dx: number,
  dy: number,
  radius: number = 0.25,
  map: SpatialMap | null = getActiveMap()
): { x: number; y: number } {
  if (
    Number.isNaN(px) ||
    Number.isNaN(py) ||
    Number.isNaN(dx) ||
    Number.isNaN(dy)
  ) {
    return { x: px, y: py };
  }

  const effectiveMap = map || getActiveMap();
  if (!effectiveMap) return { x: px + dx, y: py + dy };

  let newX = px;
  let newY = py;

  // 1. Try X movement alone
  if (dx !== 0) {
    const tryX = px + dx;
    if (!collidesWithWall(tryX, py, radius, effectiveMap)) {
      newX = tryX;
    }
  }

  // 2. Try Y movement alone or combined with newX
  if (dy !== 0) {
    const tryY = py + dy;
    if (!collidesWithWall(newX, tryY, radius, effectiveMap)) {
      newY = tryY;
    } else if (newX !== px && !collidesWithWall(px, tryY, radius, effectiveMap)) {
      // Corner collision: combined (newX, tryY) hit a corner, but moving on Y alone is clear
      newY = tryY;
      newX = px;
    }
  }

  return { x: newX, y: newY };
}

/**
 * Check line of sight between two points.
 */
export function sees(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  map: SpatialMap | null = getActiveMap()
): boolean {
  const m = map || getActiveMap();
  if (!m) return true;
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return true;

  const steps = Math.max(2, Math.ceil(dist * 8)); // sample every ~0.12 units
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + dx * t;
    const y = ay + dy * t;
    if (isWallAt(x, y, m)) return false;
  }
  return true;
}

export interface RayHit {
  hit: boolean;
  distance: number;
  x: number;
  y: number;
  kind: 'wall' | 'thing';
  index?: number;
  target?: any;
}

/**
 * Cast a ray from origin at an angle (degrees) up to maxDist.
 * Checks walls and optionally an array of things.
 */
export function castRay(
  fromX: number,
  fromY: number,
  angleDeg: number,
  maxDist: number = 20,
  things?: any[],
  thingRadius: number = 0.4,
  map: SpatialMap | null = activeMap
): RayHit | null {
  const cos = fastCos(angleDeg);
  const sin = fastSin(angleDeg);

  // First check DDA against map walls
  let wallDist = maxDist;
  let wallX = fromX + cos * maxDist;
  let wallY = fromY + sin * maxDist;
  let hitWall = false;

  if (map) {
    let mx = Math.floor(fromX);
    let my = Math.floor(fromY);
    const ddx = Math.abs(1 / (cos === 0 ? 1e-6 : cos));
    const ddy = Math.abs(1 / (sin === 0 ? 1e-6 : sin));
    let stx = cos < 0 ? -1 : 1;
    let sty = sin < 0 ? -1 : 1;
    let sdx = cos < 0 ? (fromX - mx) * ddx : (mx + 1 - fromX) * ddx;
    let sdy = sin < 0 ? (fromY - my) * ddy : (my + 1 - fromY) * ddy;
    let side = 0;

    while (true) {
      if (sdx < sdy) {
        sdx += ddx;
        mx += stx;
        side = 0;
      } else {
        sdy += ddy;
        my += sty;
        side = 1;
      }
      if (mx < 0 || mx >= map.width || my < 0 || my >= map.height) break;
      const d = side === 0 ? sdx - ddx : sdy - ddy;
      if (d > maxDist) break;
      if (isWallAt(mx + 0.5, my + 0.5, map)) {
        wallDist = d;
        wallX = fromX + cos * d;
        wallY = fromY + sin * d;
        hitWall = true;
        break;
      }
    }
  }

  // Next, check things closer than wallDist
  let closestThing: { index: number; target: any; dist: number } | null = null;
  if (Array.isArray(things)) {
    for (let i = 0; i < things.length; i++) {
      const t = things[i];
      if (!t || t.hp <= 0 || t.visible === false) continue;
      // Vector from ray origin to thing
      const tx = t.x - fromX;
      const ty = t.y - fromY;
      // Projection along ray direction
      const proj = tx * cos + ty * sin;
      if (proj <= 0.1 || proj >= wallDist) continue;
      // Perpendicular distance to ray
      const perp = Math.abs(-sin * tx + cos * ty);
      if (perp <= thingRadius) {
        if (!closestThing || proj < closestThing.dist) {
          closestThing = { index: i, target: t, dist: proj };
        }
      }
    }
  }

  if (closestThing) {
    return {
      hit: true,
      distance: closestThing.dist,
      x: fromX + cos * closestThing.dist,
      y: fromY + sin * closestThing.dist,
      kind: 'thing',
      index: closestThing.index,
      target: closestThing.target,
    };
  }

  if (hitWall) {
    return {
      hit: true,
      distance: wallDist,
      x: wallX,
      y: wallY,
      kind: 'wall',
    };
  }

  return null;
}

