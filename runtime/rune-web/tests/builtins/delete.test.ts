import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin, readPath } from './testUtils';

describe('delete builtin', () => {
  it('deletes a variable from locals', () => {
    const locals = createLocals();
    locals.val = 42;
    const result = runBuiltin('delete val', locals);
    expect(result).toBe(true);
    expect(locals.val).toBeUndefined();
  });

  it('deletes a nested property', () => {
    const locals = createLocals();
    locals.obj = { inner: 42 };
    const result = runBuiltin('delete obj.inner', locals);
    expect(result).toBe(true);
    expect(locals.obj.inner).toBeUndefined();
  });
});
