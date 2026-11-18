/** The embedding page waits for a usable game, rather than an iframe load event. */
export function beginGameLoading(): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.runeGameState = 'loading';
}

export function markGameReady(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined' ||
      document.documentElement.dataset.runeGameState === 'ready') return;
  document.documentElement.dataset.runeGameState = 'ready';
  if (window.parent !== window) window.parent.postMessage({ type: 'rune-game-ready' }, '*');
}
