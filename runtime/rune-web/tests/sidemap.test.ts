import { expect, it, vi } from 'vitest';
import { sideLevel, type SideMapData } from '../src/pixel3d/sidemap';
import { voxelGet, type VoxelWorld } from '../src/pixel3d/voxel';

const map: SideMapData = {
  width: 4,
  height: 1,
  depthY: 10,
  materials: ['edge', 'lane', 'alternate'],
  rows: ['aab.'],
  legend: {
    a: { voxel: 1, depth: [5, 4], center_voxel: 2 },
    b: { voxel: 1, depth: [5, 4], center_voxel: 3 },
  },
};

it('fills the middle two tiles of each contiguous run with its own center material', () => {
  vi.stubGlobal('__RuneSideMaps', { path: map });
  try {
    const world = sideLevel('path').world as VoxelWorld;
    const across = (x: number) => [4, 5, 6, 7, 8, 9].map(y => voxelGet(world, x, y, 0));
    expect(across(0)).toEqual([0, 1, 2, 2, 1, 0]);
    expect(across(1)).toEqual([0, 1, 2, 2, 1, 0]);
    expect(across(2)).toEqual([0, 1, 3, 3, 1, 0]);
    expect(across(3)).toEqual([0, 0, 0, 0, 0, 0]);
  } finally {
    vi.unstubAllGlobals();
  }
});

it('rejects center materials that cannot fit in an ordinary solid span', () => {
  for (const entry of [
    { voxel: 1, center_voxel: 2, depth: [5, 1] },
    { voxel: 1, center_voxel: 4 },
    { voxel: 1, center_voxel: 2, boss_door: true },
  ]) {
    vi.stubGlobal('__RuneSideMaps', { path: { ...map, legend: { a: entry } } });
    try {
      expect(() => sideLevel('path')).toThrow('center_voxel');
    } finally {
      vi.unstubAllGlobals();
    }
  }
});
