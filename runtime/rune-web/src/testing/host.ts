// Fresh module state per QuickJS runtime: no browser, network, or disk access.
export const mock = {
  storage: {} as Record<string, unknown>,
  downloads: [] as { filename: string; content: string }[],
  clipboard: [] as string[],
  audio: [] as { operation: string; args: unknown[] }[],
};

export function downloadText(filename: string, content: string): void {
  mock.downloads.push({ filename, content });
}
export function copyText(text: string): void { mock.clipboard.push(text); }
const record = (operation: string, args: unknown[]) => { mock.audio.push({ operation, args }); };
export const playSound = (...args: unknown[]) => record('sound.play', args);
export const playMusic = (...args: unknown[]) => record('music.play', args);
export const stopMusic = () => record('music.stop', []);
export const pauseMusic = () => record('music.pause', []);
export const resumeMusic = () => record('music.resume', []);
export const setMusicTempo = (...args: unknown[]) => record('music.tempo', args);
export const setMusicVolume = (...args: unknown[]) => record('music.volume', args);
export const registerSounds = (..._args: unknown[]) => {};
export const registerMusic = (...args: unknown[]) => record('music.register', args);

export function installHost(): () => void {
  const storage = new Map<string, string>();
  let frames: FrameRequestCallback[] = [];
  const unsupported = () => { throw new Error('This browser API is not supported by logic tests'); };
  Object.assign(globalThis, {
    window: globalThis,
    // DOM, fetch, timers, and WebAudio are deliberately unavailable in this prototype.
    fetch: unsupported,
    setTimeout: unsupported,
    setInterval: unsupported,
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
      clear: () => storage.clear(),
    },
    console: { log() {}, warn() {}, error() {} },
  });
  return () => {
    // Reactive renders are synchronous checkpoints, not a simulated browser event loop.
    let budget = 100;
    while (frames.length) {
      if (--budget === 0) throw new Error('Too many queued logic renders');
      const current = frames;
      frames = [];
      current.forEach(callback => callback(0));
    }
    mock.storage = Object.fromEntries([...storage].map(([key, value]) => {
      try { return [key, JSON.parse(value)]; } catch { return [key, value]; }
    }));
  };
}
