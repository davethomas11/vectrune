import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('swap builtin', () => {
  it('swaps variable to a new value', () => {
    const locals = createLocals();
    locals.val = 10;
    const result = runBuiltin('swap val 20', locals);
    expect(result).toBe(true);
    expect(locals.val).toBe(20);
  });
});
