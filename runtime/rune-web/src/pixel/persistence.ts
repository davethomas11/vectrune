import { getStorageItem, setStorageItem, storageIsPersistent } from '../storage';
export interface Persistence { key: string; state: string }
/** Restore only the declared shape. Unknown keys and mismatched types never enter state. */
export function restore(defaults: any, saved: any): any {
  if (Array.isArray(defaults)) return Array.isArray(saved) && saved.length <= 128 && saved.every(v => typeof v === typeof defaults[0]) ? saved.slice() : defaults.slice();
  if (defaults && typeof defaults === 'object') return Object.fromEntries(Object.keys(defaults).map(key => [key,restore(defaults[key], saved?.[key])]));
  return typeof defaults === typeof saved && (typeof saved !== 'number' || Number.isSafeInteger(saved)) ? saved : defaults;
}
export class GameSave {
  status: 'saved' | 'session' | 'recovered' = 'session';
  private previous = '';
  constructor(readonly config: Persistence) {}
  load(defaults: unknown): unknown {
    const raw = getStorageItem('rune-pixel-' + this.config.key);
    if (!raw) return defaults;
    try {
      if (raw.length > 16384) throw new Error('Save too large');
      const data = JSON.parse(raw);
      if (data.version !== 1 || !data.data || typeof data.data !== 'object') throw new Error('Unknown save format');
      return restore(defaults,data.data);
    } catch { this.status = 'recovered'; return defaults; }
  }
  flush(value: unknown): void {
    const json = JSON.stringify({version:1,data:value});
    if (json === this.previous) return;
    setStorageItem('rune-pixel-' + this.config.key,json);
    this.previous = json;
    if (this.status !== 'recovered') this.status = storageIsPersistent() ? 'saved' : 'session';
  }
}
