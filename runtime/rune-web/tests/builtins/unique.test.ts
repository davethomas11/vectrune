import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('unique builtin', () => {
  it('deduplicates an array and assigns to variable', () => {
    const locals = createLocals();
    locals.arr = [1, 2, 2, 3, 1, 4];
    const result = runBuiltin('unique arr as uniq', locals);
    expect(result).toEqual([1, 2, 3, 4]);
    expect(readPath(locals, 'uniq')).toEqual([1, 2, 3, 4]);
  });

  it('deduplicates without as returns array', () => {
    const locals = createLocals();
    locals.arr = ['a', 'b', 'a'];
    const result = runBuiltin('unique arr', locals);
    expect(result).toEqual(['a', 'b']);
  });

  it('returns false for non-array', () => {
    const locals = createLocals();
    locals.val = 42;
    expect(runBuiltin('unique val', locals)).toBe(false);
  });
});
