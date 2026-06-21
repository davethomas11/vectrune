import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('avg builtin', () => {
  it('averages an array and assigns to variable', () => {
    const locals = createLocals();
    locals.arr = [2, 4, 6];
    const result = runBuiltin('avg arr as average', locals);
    expect(result).toBe(4);
    expect(readPath(locals, 'average')).toBe(4);
  });

  it('averages without as returns number', () => {
    const locals = createLocals();
    locals.arr = [10, 20];
    const result = runBuiltin('avg arr', locals);
    expect(result).toBe(15);
  });

  it('returns false for empty array', () => {
    const locals = createLocals();
    locals.arr = [];
    expect(runBuiltin('avg arr', locals)).toBe(false);
  });

  it('returns false for non-array', () => {
    const locals = createLocals();
    locals.val = 10;
    expect(runBuiltin('avg val', locals)).toBe(false);
  });
});
