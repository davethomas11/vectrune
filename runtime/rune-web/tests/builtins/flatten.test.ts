import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('flatten builtin', () => {
  it('flattens an array and assigns to variable', () => {
    const locals = createLocals();
    locals.arr = [1, [2, [3, 4]]];
    const result = runBuiltin('flatten arr as flat', locals);
    expect(result).toEqual([1, 2, 3, 4]);
    expect(readPath(locals, 'flat')).toEqual([1, 2, 3, 4]);
  });

  it('flattens without as returns array', () => {
    const locals = createLocals();
    locals.arr = [[1, 2], [3, 4]];
    const result = runBuiltin('flatten arr', locals);
    expect(result).toEqual([1, 2, 3, 4]);
  });

  it('returns false for non-array', () => {
    const locals = createLocals();
    locals.val = "string";
    expect(runBuiltin('flatten val', locals)).toBe(false);
  });
});
