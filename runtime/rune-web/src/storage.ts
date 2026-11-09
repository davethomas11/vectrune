// ============================================================================
// Rune-Web Local Storage with Memory Fallback
// Safe across browsers, private browsing, iframes, and SSR/testing.
// ============================================================================

const memoryStorage: Record<string, string> = {};

export function getStorageItem(key: string): string | null {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    } catch {
      // Fall through to memory storage
    }
  }
  return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
}

export function setStorageItem(key: string, val: string): void {
  memoryStorage[key] = val;
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(key, val);
    } catch {
      // Fall through
    }
  }
}

export function removeStorageItem(key: string): void {
  delete memoryStorage[key];
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Fall through
    }
  }
}

export function clearStorage(): void {
  for (const k of Object.keys(memoryStorage)) {
    delete memoryStorage[k];
  }
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.clear();
    } catch {
      // Fall through
    }
  }
}

export function hasStorageItem(key: string): boolean {
  return getStorageItem(key) !== null;
}

