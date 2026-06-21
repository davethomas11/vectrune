import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('count builtin', () => {
  it('counts an array and assigns to variable', () => {
    const locals = createLocals();
    locals.arr = [1, 2, 3];
    const result = runBuiltin('count arr as cnt', locals);
    expect(result).toBe(3);
    expect(readPath(locals, 'cnt')).toBe(3);
  });

  it('counts without as returns number', () => {
    const locals = createLocals();
    locals.arr = [1, 2];
    const result = runBuiltin('count arr', locals);
    expect(result).toBe(2);
  });

  it('returns 0 for non-array/object', () => {
    const locals = createLocals();
    locals.val = null;
    expect(runBuiltin('count val', locals)).toBe(0);
  });
});
