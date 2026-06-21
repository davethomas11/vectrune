import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('push builtin', () => {
  it('pushes value onto array', () => {
    const locals = createLocals();
    locals.arr = [1, 2];
    locals.val = 3;
    const result = runBuiltin('push arr val', locals);
    expect(result).toBe(true);
    expect(locals.arr).toEqual([1, 2, 3]);
  });

  it('pushes literal value onto array', () => {
    const locals = createLocals();
    locals.arr = [];
    const result = runBuiltin('push arr "hello"', locals);
    expect(result).toBe(true);
    expect(locals.arr).toEqual(["hello"]);
  });
});
