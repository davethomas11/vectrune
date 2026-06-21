import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('max builtin', () => {
  it('finds max of an array and assigns to variable', () => {
    const locals = createLocals();
    locals.arr = [2, 10, 6];
    const result = runBuiltin('max arr as maximum', locals);
    expect(result).toBe(10);
    expect(readPath(locals, 'maximum')).toBe(10);
  });

  it('finds max without as returns number', () => {
    const locals = createLocals();
    locals.arr = [10, -5, 20];
    const result = runBuiltin('max arr', locals);
    expect(result).toBe(20);
  });

  it('returns false for empty array', () => {
    const locals = createLocals();
    locals.arr = [];
    expect(runBuiltin('max arr', locals)).toBe(false);
  });
});
