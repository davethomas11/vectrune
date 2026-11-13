/** Pure seeded random tools: identical results in browsers and native QuickJS. */
export function seededRandom(seed: number): number {
  if (!Number.isFinite(seed)) throw new Error('Random seed must be finite');
  let n = (Math.trunc(seed) + 0x6d2b79f5) | 0;
  n = Math.imul(n ^ n >>> 15, n | 1);
  n ^= n + Math.imul(n ^ n >>> 7, n | 61);
  return ((n ^ n >>> 14) >>> 0) / 4294967296;
}
export function randomInt(min: number, max: number, seed?: number): number {
  min = Math.ceil(min); max = Math.floor(max);
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) throw new Error('Invalid random integer range');
  return min + Math.floor((seed === undefined ? Math.random() : seededRandom(seed)) * (max - min + 1));
}
export function shuffled<T>(values: T[], seed: number): T[] {
  const result = values.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0,i,seed + i);
    [result[i],result[j]] = [result[j],result[i]];
  }
  return result;
}
