import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('min builtin', () => {
  it('finds min of an array and assigns to variable', () => {
    const locals = createLocals();
    locals.arr = [2, 10, 6];
    const result = runBuiltin('min arr as minimum', locals);
    expect(result).toBe(2);
    expect(readPath(locals, 'minimum')).toBe(2);
  });

  it('finds min without as returns number', () => {
    const locals = createLocals();
    locals.arr = [10, -5, 20];
    const result = runBuiltin('min arr', locals);
    expect(result).toBe(-5);
  });

  it('returns false for empty array', () => {
    const locals = createLocals();
    locals.arr = [];
    expect(runBuiltin('min arr', locals)).toBe(false);
  });
});
