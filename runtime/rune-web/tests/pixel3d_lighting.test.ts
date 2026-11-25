import { expect, it } from 'vitest';
import { lightFrame, validatePointLights } from '../src/pixel3d/lighting';

const lamp = { x: 4, y: 0, z: 2.25, radius: 1.5, intensity: .75, color: '#20e9ff' };

it('validates the bounded world-space light records', () => {
  expect(validatePointLights([lamp])[0].color).toBe(0x20e9ff);
  expect(validatePointLights([{ ...lamp, color: 0xff2060 }])[0].color).toBe(0xff2060);
  expect(() => validatePointLights(Array(9).fill(lamp))).toThrow('up to 8');
  for (const invalid of [{ x: NaN }, { radius: 0 }, { radius: 65 }, { intensity: 1.1 }, { color: '#123' }]) {
    expect(() => validatePointLights([{ ...lamp, ...invalid }])).toThrow('Pixel-3d point light');
  }
});

it('lights nearby surfaces by depth, preserving distant surfaces and the sky', () => {
  const dark = 0xff151515;
  const colors = new Uint32Array(4 * 3).fill(dark);
  const depth = new Float64Array(colors.length).fill(Infinity);
  depth[2] = 4; // Near the edge of the light's radius.
  depth[5] = 4; // Laterally outside the light.
  depth[6] = 4; // At the center of the light.
  depth[10] = 8; // Same column, beyond the light.
  lightFrame(validatePointLights([lamp]), colors, depth, 4, 3, { x: 0, y: 0, height: 2.25 }, 1, 0, 1);
  expect(colors[6]).toBe(0xffd4c32d);
  expect(colors[2]).toBeGreaterThan(dark);
  expect(colors[2]).toBeLessThan(colors[6]);
  for (const index of [1, 5, 10]) expect(colors[index]).toBe(dark);
});
