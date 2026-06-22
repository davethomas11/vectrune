// ============================================================================
// In-memory store — emulates memory.set / memory.get / memory.clear / memory.del
// ============================================================================

export class MemoryStore {
  private store: Record<string, unknown> = {};

  set(key: string, value: unknown): void {
    this.store[key] = value;
  }

  get(key: string): unknown {
    return this.store[key];
  }

  del(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.store, key);
  }

  snapshot(): Record<string, unknown> {
    return Object.assign({}, this.store);
  }

  load(data: Record<string, unknown>): void {
    this.store = Object.assign({}, data);
  }
}

// Singleton instance shared across all requests for a given app
export const globalMemory = new MemoryStore();
