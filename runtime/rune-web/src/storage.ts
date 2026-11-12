// ============================================================================
// Rune-Web Local Storage with Memory Fallback
// Safe across browsers, private browsing, iframes, and SSR/testing.
// ============================================================================

const memoryStorage: Record<string, string> = {};

function browserStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    // Accessing the property itself can throw in an opaque-origin iframe.
    return null;
  }
}

export function getStorageItem(key: string): string | null {
  try {
    const val = browserStorage()?.getItem(key);
    if (val != null) return val;
  } catch { /* Fall through to session storage. */ }
  return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
}

export function setStorageItem(key: string, val: string): void {
  memoryStorage[key] = val;
  try { browserStorage()?.setItem(key, val); } catch { /* Session fallback is already saved. */ }
}

export function removeStorageItem(key: string): void {
  delete memoryStorage[key];
  try { browserStorage()?.removeItem(key); } catch { /* Session fallback is already removed. */ }
}

export function clearStorage(): void {
  for (const k of Object.keys(memoryStorage)) {
    delete memoryStorage[k];
  }
  try { browserStorage()?.clear(); } catch { /* Session fallback is already cleared. */ }
}

export function hasStorageItem(key: string): boolean {
  return getStorageItem(key) !== null;
}

