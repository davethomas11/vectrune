export interface TouchBindings {
  playing: () => boolean;
  paused: () => boolean;
  interact: () => void;
  advance: () => void;
  resume: () => void;
  move: (x: number, y: number) => void;
  look: (delta: number) => void;
  fire: (held: boolean, pulse?: boolean, cancel?: boolean) => void;
  use: (held: boolean, pulse?: boolean, cancel?: boolean) => void;
  fullscreen: () => void;
  expanded: () => boolean;
  pause: () => void;
}

const STYLE = `
.rune-pixel3d-surface{position:relative;touch-action:none;isolation:isolate}
.rune-pixel3d-touch{position:absolute;pointer-events:none;display:none;z-index:5;user-select:none;-webkit-user-select:none;touch-action:none}
@media (pointer:coarse),(hover:none){.rune-pixel3d-touch{display:block}}
.rune-pixel3d-touch.is-touch{display:block}
.rune-pixel3d-touch button{pointer-events:auto;touch-action:none;box-sizing:border-box;color:#fff1ce;background:#142432bb;border:2px solid #f6cc4488;font:bold 11px ui-monospace,monospace;min-height:44px;padding:8px;box-shadow:0 2px 12px #0008;user-select:none;-webkit-user-select:none}
.rune-pixel3d-touch button:focus-visible{outline:3px solid #fff;outline-offset:2px}
.rune-pixel3d-touch [data-touch-play]{display:none}
.rune-pixel3d-touch[data-playing=true] [data-touch-play]{display:block}
.rune-pixel3d-touch .move-stick{position:absolute;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));width:clamp(72px,24vmin,112px);height:clamp(72px,24vmin,112px);border-radius:50%;padding:0;background:radial-gradient(circle,#28465788,#0d172588);opacity:.85}
.move-stick:before{content:'MOVE';position:absolute;left:0;right:0;top:8px;font-size:9px;letter-spacing:1px;color:#d1dce5}
.move-stick .stick-thumb{position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;background:#f6cc4499;border:2px solid #fff1b9;pointer-events:none;will-change:transform}
.rune-pixel3d-touch .touch-use{position:absolute;right:max(80px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));width:48px;height:48px;border-radius:50%;background:#455521bb}
.rune-pixel3d-touch .touch-fire{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));width:60px;height:60px;border-radius:50%;background:#8b302bbb;border-color:#ffa47c;font-size:12px}
.rune-pixel3d-touch .touch-top{position:absolute;right:max(8px,env(safe-area-inset-right));top:max(44px,env(safe-area-inset-top));display:flex;gap:6px;pointer-events:none}
.rune-pixel3d-touch .touch-top button{border-radius:6px;font-size:10px}
.rune-pixel3d-touch .rotate-hint{display:none;position:absolute;left:50%;bottom:calc(100% + 12px);transform:translateX(-50%);background:#0d1725dd;color:#fff1ce;border:1px solid #f6cc44;padding:10px;text-align:center;font:12px ui-monospace,monospace;max-width:70%}
.rune-pixel3d-expanded-page{overflow:hidden!important}
.rune-pixel3d-expanded{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;z-index:2147483646!important;margin:0!important;border:0!important}
.rune-pixel3d-surface:fullscreen,.rune-pixel3d-expanded{display:flex;align-items:center;justify-content:center;background:#060709}
.rune-pixel3d-surface:fullscreen canvas,.rune-pixel3d-expanded canvas{width:min(100vw,160dvh)!important;max-width:none!important;height:auto!important;max-height:100dvh!important;touch-action:none}
@media (orientation:portrait){.rune-pixel3d-touch[data-expanded=true] .rotate-hint{display:block}}
`;

export function mountTouch(canvas: HTMLCanvasElement, surface: HTMLElement, bindings: TouchBindings) {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);
  surface.classList.add('rune-pixel3d-surface');
  const overlay = document.createElement('div');
  overlay.className = 'rune-pixel3d-touch';
  overlay.innerHTML = `<button class="move-stick" data-touch-play aria-label="Move joystick"><span class="stick-thumb"></span></button>
    <button class="touch-fire" data-touch-play aria-label="Fire weapon">FIRE</button>
    <button class="touch-use" data-touch-play aria-label="Use terminal or elevator">USE</button>
    <div class="touch-top"><button data-touch-play class="touch-pause" aria-label="Pause game">PAUSE</button><button class="touch-fullscreen" aria-label="Toggle fullscreen">FULL</button></div>
    <span class="rotate-hint">Rotate your device for landscape play</span>`;
  surface.appendChild(overlay);
  const stick = overlay.querySelector<HTMLButtonElement>('.move-stick')!;
  const thumb = overlay.querySelector<HTMLElement>('.stick-thumb')!;
  const use = overlay.querySelector<HTMLButtonElement>('.touch-use')!;
  const fire = overlay.querySelector<HTMLButtonElement>('.touch-fire')!;
  const full = overlay.querySelector<HTMLButtonElement>('.touch-fullscreen')!;
  const pause = overlay.querySelector<HTMLButtonElement>('.touch-pause')!;
  const abort = new AbortController();
  function listen(target: EventTarget, name: string, handler: (event: any) => void) {
    target.addEventListener(name, handler, { signal: abort.signal, passive: false });
  }
  let moveId: number | null = null, aimId: number | null = null, useId: number | null = null, fireId: number | null = null;
  let aimX = 0, fireX = 0;
  function capture(target: HTMLElement, id: number) { try { target.setPointerCapture(id); } catch { /* Document listeners retain cleanup. */ } }
  function release(target: HTMLElement, id: number | null) { if (id !== null) try { target.releasePointerCapture(id); } catch { /* Capture may already have ended. */ } }
  function touch(event: PointerEvent) {
    return event.pointerType === 'touch' || event.pointerType === 'pen';
  }
  function activate(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    overlay.classList.add('is-touch');
    bindings.interact();
    canvas.focus({ preventScroll: true });
  }
  function moveStick(event: PointerEvent) {
    const rect = stick.getBoundingClientRect(), radius = rect.width * .36;
    let x = (event.clientX - rect.left - rect.width / 2) / radius;
    let y = (event.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length < .15) { x = 0; y = 0; }
    else { const strength = Math.min(1, (length - .15) / .85); x = x / length * strength; y = y / length * strength; }
    bindings.move(x, -y);
    thumb.style.transform = `translate(${x * radius}px,${y * radius}px)`;
  }
  listen(stick, 'pointerdown', (e: PointerEvent) => {
    if (moveId !== null || !bindings.playing()) return;
    activate(e); moveId = e.pointerId; capture(stick, moveId); moveStick(e);
  });
  listen(use, 'pointerdown', (e: PointerEvent) => {
    if (useId !== null || !bindings.playing()) return;
    activate(e); useId = e.pointerId; capture(use, useId); bindings.use(true, true);
  });
  listen(fire, 'pointerdown', (e: PointerEvent) => {
    if (fireId !== null || !bindings.playing()) return;
    activate(e);
    if (bindings.paused()) { bindings.resume(); return; }
    fireId = e.pointerId; fireX = e.clientX;
    capture(fire, fireId); bindings.fire(true, true);
  });
  listen(surface, 'pointerdown', (e: PointerEvent) => {
    if (!touch(e) || (e.target as Element).closest('button') || aimId !== null) return;
    activate(e);
    if (!bindings.playing()) { bindings.advance(); return; }
    if (bindings.paused()) { bindings.resume(); return; }
    aimId = e.pointerId; aimX = e.clientX; capture(surface, aimId);
  });
  listen(document, 'pointermove', (e: PointerEvent) => {
    if (e.pointerId === moveId) { e.preventDefault(); moveStick(e); }
    if (e.pointerId === aimId) {
      e.preventDefault();
      // Scale drag to the visible game width: one full swipe turns 180 degrees.
      bindings.look((e.clientX - aimX) * 1200 / Math.max(1, canvas.getBoundingClientRect().width));
      aimX = e.clientX;
    }
    if (e.pointerId === fireId) {
      e.preventDefault();
      bindings.look((e.clientX - fireX) * 1200 / Math.max(1, canvas.getBoundingClientRect().width));
      fireX = e.clientX;
    }
  });
  function end(e: PointerEvent) {
    if (e.pointerId === moveId) { moveId = null; bindings.move(0, 0); thumb.style.transform = ''; }
    if (e.pointerId === aimId) aimId = null;
    if (e.pointerId === fireId) { fireId = null; bindings.fire(false, false, e.type !== 'pointerup'); }
    if (e.pointerId === useId) { useId = null; bindings.use(false, false, e.type !== 'pointerup'); }
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(document, name, end);
  // Buttons consume their pointer without starting an aiming/firing gesture.
  for (const [button, action] of [[full, bindings.fullscreen], [pause, bindings.pause]] as const) {
    listen(button, 'pointerdown', (e: PointerEvent) => { activate(e); action(); });
    listen(button, 'click', (e: Event) => { e.preventDefault(); e.stopPropagation(); });
  }
  function position() {
    const frame = canvas.getBoundingClientRect(), parent = surface.getBoundingClientRect();
    overlay.style.left = `${frame.left - parent.left - surface.clientLeft}px`;
    overlay.style.top = `${frame.top - parent.top - surface.clientTop}px`;
    overlay.style.width = `${frame.width}px`;
    overlay.style.height = `${frame.height}px`;
  }
  const resize = new ResizeObserver(position);
  resize.observe(canvas); resize.observe(surface);
  position();
  function reset() {
    const m = moveId, a = aimId, u = useId, f = fireId;
    moveId = aimId = useId = fireId = null;
    release(stick, m); release(surface, a); release(use, u); release(fire, f);
    thumb.style.transform = '';
    bindings.move(0, 0); bindings.fire(false); bindings.use(false);
  }
  return {
    reset,
    update() {
      overlay.dataset.playing = String(bindings.playing());
      overlay.dataset.expanded = String(bindings.expanded());
      const paused = bindings.paused();
      pause.textContent = paused ? 'RESUME' : 'PAUSE';
      pause.setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
      full.textContent = bindings.expanded() ? 'EXIT' : 'FULL';
    },
    dispose() { reset(); abort.abort(); resize.disconnect(); overlay.remove(); style.remove(); surface.classList.remove('rune-pixel3d-surface'); },
  };
}
