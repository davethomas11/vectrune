import type { GameControls } from './game';
import type { TouchControls } from './types';

/** Profile-authored buttons and stick; each pointer owns an independent input source. */
export function mountControlTouch(canvas: HTMLCanvasElement, controls: GameControls, profile: TouchControls, options: {
  state?(): Record<string, unknown>;
  playing(): boolean; paused(): boolean; resume(): void; advance(): void; interact(): void; fullscreen(): void; expanded?(): boolean; tapToAdvance?: boolean;
}) {
  const surface = canvas.parentElement || canvas;
  const padding = Math.max(0, Math.min(24, Number(canvas.dataset.pixelTouchPadding) || 0));
  const style = document.createElement('style');
  style.textContent = `.rune-control-touch{position:absolute;z-index:6;pointer-events:none;display:none;user-select:none;-webkit-user-select:none;touch-action:none}@media(pointer:coarse),(hover:none){.rune-control-touch{display:block}}.rune-control-touch.is-touch{display:block}.rune-control-touch[hidden]{display:none}.rune-control-touch button{position:absolute;pointer-events:auto;touch-action:none;color:#fff;background:#172c42bb;border:2px solid #efca6a99;border-radius:50%;font:bold 11px ui-monospace,monospace;padding:4px;box-sizing:border-box;min-width:44px;min-height:44px}.rune-control-touch button:focus-visible{outline:3px solid white}.rune-control-touch .control-thumb{position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;background:#efca6aaa;pointer-events:none}`;
  document.head.append(style);
  const overlay = document.createElement('div'); overlay.className = 'rune-control-touch';
  surface.append(overlay);
  const position = getComputedStyle(surface).position;
  if (position === 'static') surface.style.position = 'relative';
  const oldTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';
  const hint = document.createElement('div'); hint.className = 'rune-control-rotate';
  hint.setAttribute('role', 'status'); hint.setAttribute('aria-live', 'polite');
  const cramped = document.createElement('strong'); cramped.textContent = "It's cramped in here";
  const rotate = document.createElement('span'); rotate.textContent = 'Please rotate your phone to landscape.';
  hint.append(cramped, rotate); surface.append(hint);
  style.textContent += '.rune-control-rotate{position:absolute;z-index:7;top:calc(max(12px,env(safe-area-inset-top)) + 68px);left:50%;transform:translateX(-50%);width:min(300px,calc(100% - 32px));padding:12px;box-sizing:border-box;border:1px solid #627b98;border-radius:8px;background:#142432ed;color:white;text-align:center;font:14px system-ui,sans-serif;pointer-events:none;user-select:none;-webkit-user-select:none}.rune-control-rotate strong,.rune-control-rotate span{display:block}.rune-control-rotate span{margin-top:6px;font-size:12px}.rune-control-rotate[hidden]{display:none!important}';
  const abort = new AbortController();
  function listen(target: EventTarget, name: string, fn: (e: PointerEvent) => void) { target.addEventListener(name, fn as EventListener, { signal: abort.signal, passive: false }); }
  type Pointer = { target: HTMLElement; needsOverlay?: boolean; move?(e: PointerEvent): void; end(cancel: boolean): void };
  const pointers = new Map<number, Pointer>();
  const occupied = new Set<HTMLElement>();
  const visibility = new Map<HTMLElement, string>();
  const starters = new Map<HTMLElement, (e: PointerEvent) => void>();
  function bind(target: HTMLElement, start: (e: PointerEvent) => void) {
    starters.set(target, start); listen(target, 'pointerdown', start);
  }
  function visible(path: string | undefined): boolean {
    if (path === undefined) return true;
    let value: unknown = options.state?.();
    for (const key of path.split('.')) {
      value = value && typeof value === 'object' ? Reflect.get(value, key) : undefined;
    }
    if (typeof value !== 'boolean') throw new Error(`Touch visible must reference boolean state: ${path}`);
    return value;
  }
  function activate(e: PointerEvent) {
    e.preventDefault(); e.stopPropagation(); options.interact(); overlay.classList.add('is-touch'); canvas.focus({ preventScroll: true });
    if (!options.playing()) { if (options.tapToAdvance !== false) options.advance(); return false; }
    if (options.paused()) { options.resume(); return false; }
    return true;
  }
  function capture(target: HTMLElement, e: PointerEvent, pointer: Pointer) {
    occupied.add(target); pointers.set(e.pointerId, pointer);
    try { target.setPointerCapture(e.pointerId); } catch { /* Document listeners still clean up. */ }
  }
  function emit(id: string, input: string, value: boolean | number, mode: 'button' | 'value' | 'delta', cancel = false) {
    controls.event({ device: 'virtual', code: id, source: `touch:${id}`, input, value, mode, cancel });
  }
  function button(label: string, id: string, anchor: string, offset: [number, number], size: number) {
    const element = document.createElement('button'); element.type = 'button'; element.textContent = label;
    element.dataset.controlTouch = id; element.setAttribute('aria-label', label);
    const [vertical, horizontal] = anchor.split('-');
    element.style[horizontal as 'left' | 'right'] = `max(${offset[0]}px,env(safe-area-inset-${horizontal}))`;
    element.style[vertical as 'top' | 'bottom'] = `max(${offset[1]}px,env(safe-area-inset-${vertical}))`;
    element.style.width = element.style.height = `${size}px`; overlay.append(element); return element;
  }
  if (profile.joystick) {
    const def = profile.joystick;
    const stick = button('MOVE', 'joystick', def.anchor || 'bottom-left', [12, 12], def.size || 96);
    if (def.visible !== undefined) visibility.set(stick, def.visible);
    stick.dataset.gameplay = 'true'; stick.setAttribute('aria-label', 'Move joystick');
    const thumb = document.createElement('span'); thumb.className = 'control-thumb'; stick.append(thumb);
    function move(e?: PointerEvent, cancel = false) {
      const rect = stick.getBoundingClientRect(), radius = rect.width * .36;
      let x = e ? (e.clientX - rect.left - rect.width / 2) / radius : 0;
      let y = e ? -(e.clientY - rect.top - rect.height / 2) / radius : 0;
      const length = Math.hypot(x, y), deadzone = def.deadzone ?? .15;
      const strength = Math.min(1, Math.max(0, (length - deadzone) / (1 - deadzone)));
      x = length ? x / length * strength : 0; y = length ? y / length * strength : 0;
      thumb.style.transform = e ? `translate(${x * radius}px,${-y * radius}px)` : '';
      if (def.x) emit('stick:x', def.x, x, 'value', cancel);
      if (def.y) emit('stick:y', def.y, y, 'value', cancel);
      for (const [direction, amount] of [['left', -x], ['right', x], ['up', y], ['down', -y]] as const) {
        if (def[direction]) emit(`stick:${direction}`, def[direction]!, amount > .35, 'button', cancel);
      }
    }
    bind(stick, e => {
      if (occupied.has(stick) || !activate(e)) return;
      capture(stick, e, { target: stick, move, end: cancel => move(undefined, cancel) }); move(e);
    });
  }
  for (const [index, def] of (profile.buttons || []).entries()) {
    const target = button(def.label, def.id, def.anchor || 'bottom-right', def.offset || [12 + index * 68, 12], def.size || 56);
    if (def.visible !== undefined) visibility.set(target, def.visible);
    target.classList.add('touch-' + def.id);
    if (def.aria_label) target.setAttribute('aria-label', def.aria_label);
    if (def.input) target.dataset.gameplay = 'true';
    bind(target, e => {
      if (def.command) {
        e.preventDefault(); e.stopPropagation(); options.interact(); canvas.focus({ preventScroll: true });
        if (controls.command(def.command) === 'host.fullscreen') options.fullscreen();
        return;
      }
      if (occupied.has(target) || !activate(e)) return;
      let lastX = e.clientX;
      emit(def.id, def.input!, true, 'button');
      capture(target, e, { target, move: e => {
        if (def.drag_x) emit(`${def.id}:look`, def.drag_x, (e.clientX - lastX) * 1200 / Math.max(1, canvas.getBoundingClientRect().width) * (profile.look?.sensitivity ?? 1), 'delta');
        lastX = e.clientX;
      }, end: cancel => emit(def.id, def.input!, false, 'button', cancel) });
    });
    target.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); }, { signal: abort.signal });
  }
  if (padding > 0) {
    let assistedClickUntil = 0;
    const guardedTouches = new Set<number>();
    // Exiting fullscreen moves the page under the finger. Consume that touch's
    // compatibility click so it cannot hit the toolbar and immediately reenter.
    document.addEventListener('pointerdown', e => { assistedClickUntil = 0; guardedTouches.delete(e.pointerId); }, { signal: abort.signal, capture: true });
    document.addEventListener('pointerup', e => {
      assistedClickUntil = guardedTouches.delete(e.pointerId) ? Date.now() + 700 : 0;
    }, { signal: abort.signal, capture: true });
    document.addEventListener('pointercancel', e => { guardedTouches.delete(e.pointerId); }, { signal: abort.signal, capture: true });
    document.addEventListener('click', e => {
      if (e.isTrusted && e.detail !== 0 && Date.now() < assistedClickUntil) {
        assistedClickUntil = 0; e.preventDefault(); e.stopImmediatePropagation();
      }
    }, { signal: abort.signal, capture: true });
    function available(button: HTMLButtonElement): boolean {
      const css = getComputedStyle(button);
      return !button.disabled && button.getClientRects().length > 0 && css.visibility !== 'hidden' && css.pointerEvents !== 'none';
    }
    function distance(button: HTMLElement, x: number, y: number): number {
      const r = button.getBoundingClientRect();
      return Math.hypot(Math.max(r.left-x, 0, x-r.right), Math.max(r.top-y, 0, y-r.bottom));
    }
    surface.addEventListener('pointerdown', e => {
      if (!['touch', 'pen'].includes(e.pointerType)) return;
      overlay.classList.add('is-touch');
      const direct = e.target instanceof Element ? e.target.closest('button') : null;
      if (direct) {
        if (starters.has(direct)) { guardedTouches.add(e.pointerId); e.preventDefault(); }
        return;
      }
      // Empty space is inert. Only a near miss on a visible control is assisted.
      guardedTouches.add(e.pointerId);
      e.preventDefault(); e.stopImmediatePropagation();
      let nearest: HTMLButtonElement | undefined, best = Infinity, center = Infinity;
      for (const button of Array.from(surface.querySelectorAll<HTMLButtonElement>('button'))) {
        if (!available(button)) continue;
        const d = distance(button, e.clientX, e.clientY), r = button.getBoundingClientRect();
        const c = Math.hypot(e.clientX-r.left-r.width/2, e.clientY-r.top-r.height/2);
        if (d <= padding && (d < best || (d === best && c < center))) { nearest = button; best = d; center = c; }
      }
      if (!nearest) return;
      const start = starters.get(nearest);
      if (start) { start(e); return; }
      if (occupied.has(surface)) return;
      const button = nearest;
      let inside = true;
      // Menu/exit buttons commit on release, preserving the browser's user gesture.
      capture(surface, e, { target: surface, needsOverlay: false, move: p => { inside = distance(button, p.clientX, p.clientY) <= padding; },
        end: cancel => {
          if (!cancel && inside && button.isConnected && available(button)) {
            button.click();
          }
        } });
    }, { signal: abort.signal, capture: true, passive: false });
    const suppress = (e: Event) => { e.preventDefault(); };
    for (const name of ['contextmenu', 'selectstart', 'dragstart', 'dblclick', 'gesturestart', 'gesturechange', 'gestureend']) {
      surface.addEventListener(name, suppress, { signal: abort.signal, passive: false });
    }
    surface.addEventListener('touchmove', suppress, { signal: abort.signal, passive: false });
    surface.addEventListener('click', e => {
      if (!(e.target instanceof Element && e.target.closest('button'))) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, { signal: abort.signal, capture: true });
  }
  listen(canvas, 'pointerdown', e => {
    if (!['touch', 'pen'].includes(e.pointerType) || occupied.has(canvas)) return;
    if (!activate(e) || !profile.look) return;
    let lastX = e.clientX, lastY = e.clientY;
    capture(canvas, e, { target: canvas, move: e => {
      emit('aim', profile.look!.x, (e.clientX - lastX) * 1200 / Math.max(1, canvas.getBoundingClientRect().width) * (profile.look!.sensitivity ?? 1), 'delta'); lastX = e.clientX;
      if (profile.look!.y) emit('aim:y', profile.look!.y, (e.clientY - lastY) * 1200 / Math.max(1, canvas.getBoundingClientRect().height) * (profile.look!.sensitivity ?? 1), 'delta');
      lastY = e.clientY;
    }, end: cancel => {
      if (cancel) {
        emit('aim', profile.look!.x, 0, 'delta', true);
        if (profile.look!.y) emit('aim:y', profile.look!.y, 0, 'delta', true);
      }
    } });
  });
  listen(document, 'pointermove', e => { const pointer = pointers.get(e.pointerId); if (pointer) { e.preventDefault(); pointer.move?.(e); } });
  function end(e: PointerEvent) {
    const pointer = pointers.get(e.pointerId); if (!pointer) return;
    pointers.delete(e.pointerId); occupied.delete(pointer.target); pointer.end(e.type !== 'pointerup');
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(document, name, end);
  function reset(keepMenu = false) {
    const active = [...pointers];
    for (const [id, pointer] of active) {
      if (keepMenu && pointer.needsOverlay === false) continue;
      pointers.delete(id); occupied.delete(pointer.target);
      pointer.end(true); try { pointer.target.releasePointerCapture(id); } catch { /* Already released. */ }
    }
  }
  function update() {
    const rect = canvas.getBoundingClientRect(), parent = surface.getBoundingClientRect();
    Object.assign(overlay.style, { left: `${rect.left - parent.left - surface.clientLeft}px`, top: `${rect.top - parent.top - surface.clientTop}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    overlay.hidden = !visible(profile.visible);
    for (const element of Array.from(overlay.querySelectorAll<HTMLButtonElement>('button'))) {
      element.hidden = (element.dataset.gameplay === 'true' && !options.playing()) || !visible(visibility.get(element));
    }
    for (const [id, pointer] of [...pointers]) {
      if ((overlay.hidden && pointer.needsOverlay !== false) || pointer.target.hidden) {
        pointers.delete(id); occupied.delete(pointer.target); pointer.end(true);
        try { pointer.target.releasePointerCapture(id); } catch { /* Already released. */ }
      }
    }
    const expanded = options.expanded?.() || false;
    hint.hidden = !expanded || innerWidth >= innerHeight;
    for (const def of profile.buttons || []) {
      const target = Array.from(overlay.querySelectorAll<HTMLButtonElement>('button')).find(b => b.dataset.controlTouch === def.id)!;
      if (def.command === 'host.pause') { target.textContent = options.paused() ? 'RESUME' : def.label; target.setAttribute('aria-label', options.paused() ? 'Resume game' : (def.aria_label || def.label)); }
      if (def.command === 'host.fullscreen') target.textContent = expanded ? 'EXIT' : def.label;
    }
  }
  const resize = new ResizeObserver(update); resize.observe(canvas); resize.observe(surface); update();
  return { reset, update, dispose() { reset(); abort.abort(); resize.disconnect(); overlay.remove(); hint.remove(); style.remove(); canvas.style.touchAction = oldTouchAction; if (position === 'static') surface.style.position = ''; } };
}
