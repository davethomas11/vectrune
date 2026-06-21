import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('invert builtin', () => {
  it('inverts a boolean variable', () => {
    const locals = createLocals();
    locals.flag = true;
    const result = runBuiltin('invert flag', locals);
    expect(result).toBe(false);
    expect(locals.flag).toBe(false);
  });

  it('inverts a falsy variable to true', () => {
    const locals = createLocals();
    locals.flag = 0; // falsy
    const result = runBuiltin('invert flag', locals);
    expect(result).toBe(true);
    expect(locals.flag).toBe(true);
  });
});
