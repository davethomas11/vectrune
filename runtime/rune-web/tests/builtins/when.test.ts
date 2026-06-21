import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin } from './testUtils';
import { NO_ACTION } from '../../src/builtins/command';

describe('when builtin suffix', () => {
  it('executes command when condition is true', () => {
    const locals = createLocals();
    locals.flag = true;
    locals.count = 0;
    const result = runBuiltin('count++ when flag == true', locals);
    expect(locals.count).toBe(1);
    expect(result).toBe(1);
  });

  it('skips command when condition is false', () => {
    const locals = createLocals();
    locals.flag = false;
    locals.count = 0;
    const result = runBuiltin('count++ when flag == true', locals);
    expect(locals.count).toBe(0);
    expect(result).toBe(NO_ACTION); // when returns true if skipped
  });
});
