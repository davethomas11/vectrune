import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('randomize builtin', () => {
  it('generates random number in range and assigns to variable', () => {
    const locals = createLocals();
    const result = runBuiltin('randomize 1 10 as rnd', locals) as number;
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(10);
    expect(readPath(locals, 'rnd')).toBe(result);
  });

  it('generates random number without as', () => {
    const locals = createLocals();
    const result = runBuiltin('randomize 5 5', locals) as number;
    expect(result).toBe(5);
  });

  it('shuffles an array and assigns to variable', () => {
    const locals = createLocals();
    locals.arr = [1, 2, 3, 4, 5];
    const result = runBuiltin('randomize arr as shuffled', locals) as number[];
    expect(result.length).toBe(5);
    expect(result).toContain(1);
    expect(result).toContain(5);
    expect(readPath(locals, 'shuffled')).toEqual(result);
    // Note: It's theoretically possible it shuffles to the exact same order, but it works
  });
});
