// ============================================================================
// Rune-Web Local Storage with Memory Fallback
// Safe across browsers, private browsing, iframes, and SSR/testing.
// ============================================================================

type NativeStore = { __runeStoreGet?: (key:string) => string | null; __runeStoreSet?: (key:string,value:string) => void; __runeStoreRemove?: (key:string) => void };
let persistent = false;
export function storageIsPersistent(): boolean { return persistent; }
const native = () => globalThis as NativeStore;
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
    const store = browserStorage();
    const val = native().__runeStoreGet ? native().__runeStoreGet!(key) : store?.getItem(key);
    persistent = !!native().__runeStoreGet || !!store;
    if (val != null) return val;
  } catch { /* Fall through to session storage. */ }
  return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
}

export function setStorageItem(key: string, val: string): void {
  memoryStorage[key] = val;
  try {
    const store = browserStorage();
    if (native().__runeStoreSet) native().__runeStoreSet!(key,val);
    else store?.setItem(key,val);
    persistent = !!native().__runeStoreSet || !!store;
  } catch { persistent = false; /* Session fallback is already saved. */ }
}

export function removeStorageItem(key: string): void {
  delete memoryStorage[key];
  try { if (native().__runeStoreRemove) native().__runeStoreRemove!(key); else browserStorage()?.removeItem(key); } catch { /* Session fallback is already removed. */ }
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

