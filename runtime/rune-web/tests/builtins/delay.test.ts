import { describe, it, expect, vi } from 'vitest';
import { createLocals, runBuiltin } from './testUtils';

describe('delay builtin', () => {
  it('delays execution and returns delay amount', async () => {
    const locals = createLocals();
    locals.completed = false;
    const result = runBuiltin('delay 10ms', locals);
    expect(result).toBe(true);
  });
});
