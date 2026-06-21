import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('sum builtin', () => {
  it('sums an array and assigns to variable', () => {
    const locals = createLocals();
    locals.arr = [1, 2, 3, 4];
    const result = runBuiltin('sum arr as total', locals);
    expect(result).toBe(10);
    expect(readPath(locals, 'total')).toBe(10);
  });

  it('sums without as returns number', () => {
    const locals = createLocals();
    locals.arr = [5, 5];
    const result = runBuiltin('sum arr', locals);
    expect(result).toBe(10);
  });

  it('returns 0 for empty array', () => {
    const locals = createLocals();
    locals.arr = [];
    expect(runBuiltin('sum arr', locals)).toBe(0);
  });

  it('returns false for non-array', () => {
    const locals = createLocals();
    locals.val = 10;
    expect(runBuiltin('sum val', locals)).toBe(false);
  });
});
