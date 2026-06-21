import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('clone builtin', () => {
  it('clones an object and assigns to destination', () => {
    const locals = createLocals();
    locals.obj = { a: 1, b: [2] };
    const result = runBuiltin('clone obj to newObj', locals);
    expect(result).toEqual({ a: 1, b: [2] });
    expect(readPath(locals, 'newObj')).toEqual({ a: 1, b: [2] });
    // Verify it's a deep copy
    expect(readPath(locals, 'newObj')).not.toBe(locals.obj);
    expect(readPath(locals, 'newObj').b).not.toBe(locals.obj.b);
  });

  it('clones without destination returns copied value', () => {
    const locals = createLocals();
    locals.arr = [1, 2];
    const result = runBuiltin('clone arr', locals) as any;
    expect(result).toEqual([1, 2]);
    expect(result).not.toBe(locals.arr);
  });
});
