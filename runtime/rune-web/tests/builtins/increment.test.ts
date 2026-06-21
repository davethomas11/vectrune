import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('increment builtin', () => {
  it('increments variable with ++ syntax', () => {
    const locals = createLocals();
    locals.val = 5;
    const result = runBuiltin('val++', locals);
    expect(result).toBe(6);
    expect(locals.val).toBe(6);
  });

  it('increments variable with increment <path> by <n>', () => {
    const locals = createLocals();
    locals.val = 10;
    const result = runBuiltin('increment val by 5', locals);
    expect(result).toBe(15);
    expect(locals.val).toBe(15);
  });

  it('increments undefined variable to 1 with ++', () => {
    const locals = createLocals();
    const result = runBuiltin('counter++', locals);
    expect(result).toBe(1);
    expect(readPath(locals, 'counter')).toBe(1);
  });
});
