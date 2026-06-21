import { describe, it, expect } from 'vitest';
import { createLocals, runBuiltin } from './testUtils';

describe('stop builtin', () => {
  it('returns stop signal', () => {
    const locals = createLocals();
    const result = runBuiltin('stop', locals);
    expect(result).toBe('stop');
  });
});
