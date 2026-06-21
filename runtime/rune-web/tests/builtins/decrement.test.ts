import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('decrement builtin', () => {
  it('decrements variable with -- syntax', () => {
    const locals = createLocals();
    locals.val = 5;
    const result = runBuiltin('val--', locals);
    expect(result).toBe(4);
    expect(locals.val).toBe(4);
  });

  it('decrements variable with decrement <path> by <n>', () => {
    const locals = createLocals();
    locals.val = 10;
    const result = runBuiltin('decrement val by 3', locals);
    expect(result).toBe(7);
    expect(locals.val).toBe(7);
  });

  it('decrements undefined variable to -1 with --', () => {
    const locals = createLocals();
    const result = runBuiltin('counter--', locals);
    expect(result).toBe(-1);
    expect(readPath(locals, 'counter')).toBe(-1);
  });
});
