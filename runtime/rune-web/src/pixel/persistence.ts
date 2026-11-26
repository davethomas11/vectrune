import { getStorageItem, setStorageItem, storageIsPersistent } from '../storage';
export interface Persistence { key: string; state: string; interval_ticks?: number; revision?: string }
/** Restore only the declared shape. Unknown keys and mismatched types never enter state. */
export function restore(defaults: any, saved: any): any {
  if (Array.isArray(defaults)) return Array.isArray(saved) && saved.length <= 128 && saved.every(v => typeof v === typeof defaults[0]) ? saved.slice() : defaults.slice();
  if (defaults && typeof defaults === 'object') return Object.fromEntries(Object.keys(defaults).map(key => [key,restore(defaults[key], saved?.[key])]));
  return typeof defaults === typeof saved && (typeof saved !== 'number' || Number.isSafeInteger(saved)) ? saved : defaults;
}
export class GameSave {
  status: 'saved' | 'session' | 'recovered' = 'session';
  private previous = '';
  private elapsed = 0;
  private previousValue: unknown;
  private previousRevision: number | undefined;
  constructor(readonly config: Persistence) {
    if (config.interval_ticks !== undefined &&
        (!Number.isInteger(config.interval_ticks) || config.interval_ticks < 1 || config.interval_ticks > 3600)) {
      throw new Error('Persistence interval_ticks must be an integer from 1 to 3600');
    }
    if (config.revision !== undefined && !/^[A-Za-z_]\w*$/.test(config.revision)) {
      throw new Error('Persistence revision must name a state field');
    }
  }
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
  tick(value: unknown, revision?: number): void {
    this.checkRevision(revision);
    if (++this.elapsed >= (this.config.interval_ticks ?? 1)) this.flush(value, revision);
  }
  persist(state: Record<string, unknown>, immediate = true): void {
    const revision = this.config.revision ? state[this.config.revision] : undefined;
    if (revision !== undefined && typeof revision !== 'number') throw new Error('Persistence revision must be a number');
    if (immediate) this.flush(state[this.config.state], revision);
    else this.tick(state[this.config.state], revision);
  }
  private checkRevision(revision: number | undefined): void {
    if (this.config.revision !== undefined &&
        (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0)) throw new Error('Persistence revision must be a nonnegative safe integer');
  }
  flush(value: unknown, revision?: number): void {
    this.checkRevision(revision);
    this.elapsed = 0;
    if (this.config.revision !== undefined && value === this.previousValue && revision === this.previousRevision) return;
    const json = JSON.stringify({version:1,data:value});
    this.previousValue = value;
    this.previousRevision = revision;
    if (json === this.previous) return;
    setStorageItem('rune-pixel-' + this.config.key,json);
    this.previous = json;
    if (this.status !== 'recovered') this.status = storageIsPersistent() ? 'saved' : 'session';
  }
}
