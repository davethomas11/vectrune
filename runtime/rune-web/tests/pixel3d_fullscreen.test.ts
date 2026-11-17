import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFullscreen } from '../src/pixel3d/fullscreen';

function setup(native = true, lockFails = false) {
  const listeners: Record<string, (event?: KeyboardEvent) => void> = {};
  const toggle = vi.fn();
  const doc = { fullscreenElement: null as unknown, pointerLockElement: null as unknown,
    exitPointerLock: vi.fn(() => { doc.pointerLockElement = null; }),
    documentElement: { classList: { toggle } },
    addEventListener: (n: string, f: () => void) => { listeners[n] = f; },
    removeEventListener: vi.fn((n: string) => { delete listeners[n]; }),
    exitFullscreen: vi.fn(async () => { doc.fullscreenElement = null; listeners.fullscreenchange?.(); }),
  };
  const surface = { ownerDocument: doc, classList: { toggle }, contains: (node: unknown): boolean => node === surface,
    requestFullscreen: native ? vi.fn(async () => { doc.fullscreenElement = surface; listeners.fullscreenchange?.(); }) : undefined };
  const lock = lockFails ? vi.fn(async () => { throw new Error('Not supported'); }) : vi.fn(async () => {});
  const unlock = vi.fn();
  const postMessage = vi.fn();
  const window = { parent: { postMessage } };
  vi.stubGlobal('window', window);
  vi.stubGlobal('screen', { orientation: { lock, unlock } });
  const changed = vi.fn();
  const control = createFullscreen(surface as unknown as HTMLElement, changed);
  return { control, surface, doc, lock, unlock, toggle, postMessage, changed, listeners };
}
function pressEscape(s: ReturnType<typeof setup>, repeat = false) {
  const event = { code: 'Escape', repeat, preventDefault: vi.fn(), stopPropagation: vi.fn() };
  s.listeners.keydown?.(event as unknown as KeyboardEvent);
  return event;
}
afterEach(() => vi.unstubAllGlobals());
describe('pixel3d fullscreen presentation', () => {
  it('exits fallback fullscreen on Escape independently of canvas focus', async () => {
    const s = setup(false);
    await s.control.toggle();
    s.doc.pointerLockElement = s.surface;
    const event = pressEscape(s);
    expect(s.control.expanded()).toBe(false);
    expect(s.toggle).toHaveBeenCalledWith('rune-pixel3d-expanded-page', false);
    expect(s.postMessage).toHaveBeenLastCalledWith({ type: 'toggle_fullscreen', is_fullscreen: false }, '*');
    expect(s.unlock).toHaveBeenCalled();
    expect(s.doc.exitPointerLock).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    s.control.dispose();
    expect(s.doc.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);
  });
  it('exits native fullscreen on Escape and leaves normal-page Escape alone', async () => {
    const s = setup();
    expect(pressEscape(s).preventDefault).not.toHaveBeenCalled();
    await s.control.toggle();
    pressEscape(s, true);
    expect(s.control.expanded()).toBe(true);
    pressEscape(s);
    await Promise.resolve();
    expect(s.doc.exitFullscreen).toHaveBeenCalled();
    expect(s.control.expanded()).toBe(false);
  });
  it('does not enter fallback fullscreen after Escape cancels a pending native request', async () => {
    const s = setup();
    let reject!: (error: Error) => void;
    s.surface.requestFullscreen!.mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
    const entering = s.control.toggle();
    pressEscape(s);
    reject(new Error('User cancelled'));
    await entering;
    expect(s.control.expanded()).toBe(false);
    expect(s.toggle).not.toHaveBeenCalledWith('rune-pixel3d-expanded', true);
  });
  it('exits while orientation locking is pending and unlocks a late result', async () => {
    const s = setup(false);
    let resolve!: () => void;
    s.lock.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    const entering = s.control.toggle();
    pressEscape(s);
    expect(s.control.expanded()).toBe(false);
    resolve();
    await entering;
    expect(s.unlock).toHaveBeenCalled();
    expect(s.control.expanded()).toBe(false);
  });
  it('enters fullscreen before locking landscape and unlocks on exit', async () => {
    const s = setup();
    await s.control.toggle();
    expect(s.surface.requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });
    expect(s.lock).toHaveBeenCalledWith('landscape');
    expect(s.control.expanded()).toBe(true);
    await s.control.toggle();
    expect(s.doc.exitFullscreen).toHaveBeenCalled();
    expect(s.unlock).toHaveBeenCalled();
    expect(s.control.expanded()).toBe(false);
    s.control.dispose();
  });
  it('keeps fullscreen usable if orientation lock is refused', async () => {
    const s = setup(true, true);
    await s.control.toggle();
    expect(s.control.expanded()).toBe(true);
    await s.control.toggle();
    expect(s.control.expanded()).toBe(false);
    expect(s.unlock).not.toHaveBeenCalled();
  });
  it('expands embedded previews when the native API is unavailable and cleans up', async () => {
    const s = setup(false, true);
    await s.control.toggle();
    expect(s.postMessage).toHaveBeenCalledWith({ type: 'toggle_fullscreen', is_fullscreen: true }, '*');
    expect(s.toggle).toHaveBeenCalledWith('rune-pixel3d-expanded', true);
    s.control.dispose();
    await Promise.resolve();
    expect(s.control.expanded()).toBe(false);
    expect(s.postMessage).toHaveBeenLastCalledWith({ type: 'toggle_fullscreen', is_fullscreen: false }, '*');
  });
  it('falls back when native fullscreen rejects', async () => {
    const s = setup();
    s.surface.requestFullscreen!.mockRejectedValueOnce(new Error('Denied'));
    await s.control.toggle();
    expect(s.toggle).toHaveBeenCalledWith('rune-pixel3d-expanded', true);
    await s.control.toggle();
    expect(s.control.expanded()).toBe(false);
  });
  it('unlocks if the browser leaves fullscreen while the lock request is pending', async () => {
    const s = setup();
    let resolve!: () => void;
    s.lock.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    const entering = s.control.toggle();
    await Promise.resolve();
    s.doc.fullscreenElement = null;
    resolve();
    await entering;
    expect(s.unlock).toHaveBeenCalled();
    expect(s.control.expanded()).toBe(false);
    s.control.dispose();
  });

});
