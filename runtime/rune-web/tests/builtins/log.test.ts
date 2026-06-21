import { describe, it, expect, vi } from 'vitest';
import { createLocals, runBuiltin } from './testUtils';

describe('log builtin', () => {
  it('logs interpolated string and returns it', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const locals = createLocals();
    locals.name = "world";
    const result = runBuiltin('log "hello {name}"', locals);
    
    expect(result).toBe('"hello world"');
    expect(consoleSpy).toHaveBeenCalledWith('"hello world"');
    
    consoleSpy.mockRestore();
  });
});
