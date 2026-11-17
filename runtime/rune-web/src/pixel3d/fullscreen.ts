// Fullscreen and orientation belong to the presentation host, not game rules.
export function createFullscreen(surface: HTMLElement, changed: () => void) {
  const doc = surface.ownerDocument as Document & {
    webkitFullscreenElement?: Element;
    webkitExitFullscreen?: () => Promise<void> | void;
  };
  const element = surface as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> };
  let fallback = false, locked = false, busy = false, disposed = false, exitRequested = false;
  const expanded = () => fallback || doc.fullscreenElement === surface || doc.webkitFullscreenElement === surface;
  const notifyParent = (value: boolean) => {
    if (window.parent !== window) window.parent.postMessage({ type: 'toggle_fullscreen', is_fullscreen: value }, '*');
  };
  const unlock = () => {
    if (locked) { try { orientation?.unlock?.(); } catch { /* The document may already be inactive. */ } locked = false; }
  };
  const fallbackMode = (value: boolean) => {
    fallback = value;
    surface.classList.toggle('rune-pixel3d-expanded', value);
    doc.documentElement.classList.toggle('rune-pixel3d-expanded-page', value);
    notifyParent(value);
  };
  const onChange = () => {
    if (!expanded()) unlock();
    changed();
  };
  doc.addEventListener('fullscreenchange', onChange);
  doc.addEventListener('webkitfullscreenchange', onChange);
  async function exit() {
    if (doc.pointerLockElement && surface.contains(doc.pointerLockElement)) doc.exitPointerLock?.();
    if (fallback) fallbackMode(false);
    if (doc.fullscreenElement === surface) await doc.exitFullscreen();
    else if (doc.webkitFullscreenElement === surface) await doc.webkitExitFullscreen?.();
    unlock();
    changed();
  }
  const onEscape = (event: KeyboardEvent) => {
    if (event.code !== 'Escape' || event.repeat || (!expanded() && !busy)) return;
    exitRequested = true;
    event.preventDefault();
    event.stopPropagation();
    // Capture at the document so Escape also works with toolbar/menu focus,
    // and so canvas menu or pointer-lock handlers cannot consume it first.
    void exit().catch(() => { unlock(); changed(); });
  };
  doc.addEventListener('keydown', onEscape, true);
  return {
    expanded,
    async toggle(): Promise<void> {
      if (busy || disposed) return;
      busy = true;
      exitRequested = false;
      try {
        if (expanded()) { await exit(); return; }
        try {
          if (element.requestFullscreen) await element.requestFullscreen({ navigationUI: 'hide' });
          else if (element.webkitRequestFullscreen) await element.webkitRequestFullscreen();
          else fallbackMode(true);
        } catch { if (!disposed && !exitRequested) fallbackMode(true); }
        if (disposed || exitRequested) { await exit(); return; }
        // Browsers may require fullscreen and may decline orientation locking.
        try { if (orientation?.lock) { await orientation.lock('landscape'); locked = true; } } catch { /* Rotation hint remains available. */ }
        if (!expanded()) unlock();
        if (disposed) await exit();
        changed();
      } finally { busy = false; }
    },
    dispose() {
      disposed = true;
      doc.removeEventListener('fullscreenchange', onChange);
      doc.removeEventListener('webkitfullscreenchange', onChange);
      doc.removeEventListener('keydown', onEscape, true);
      void exit().catch(() => { unlock(); fallbackMode(false); });
    },
  };
}
