import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { clearStorage, getStorageItem, hasStorageItem, removeStorageItem, setStorageItem } from '../src/storage';

beforeEach(() => {
  const frame = {};
  Object.defineProperty(frame, 'localStorage', {
    get() { throw new DOMException('Opaque origin', 'SecurityError'); },
  });
  vi.stubGlobal('window', frame);
  clearStorage();
});
afterEach(() => vi.unstubAllGlobals());

it('supports save, load and remove when the iframe storage getter throws', () => {
  setStorageItem('song', 'E4:8');
  expect(getStorageItem('song')).toBe('E4:8');
  expect(hasStorageItem('song')).toBe(true);
  removeStorageItem('song');
  expect(getStorageItem('song')).toBeNull();
});

it('clears the session fallback without accessing unavailable browser storage', () => {
  setStorageItem('song', 'E4:8');
  clearStorage();
  expect(hasStorageItem('song')).toBe(false);
});
