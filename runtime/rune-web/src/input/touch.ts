import type { GameControls } from './game';
import type { TouchControls } from './types';

/** Profile-authored buttons and stick; each pointer owns an independent input source. */
export function mountControlTouch(canvas: HTMLCanvasElement, controls: GameControls, profile: TouchControls, options: {
  state?(): Record<string, unknown>;
  playing(): boolean; paused(): boolean; resume(): void; advance(): void; interact(): void; fullscreen(): void; expanded?(): boolean; tapToAdvance?: boolean;
}) {
  const surface = canvas.parentElement || canvas;
  const style = document.createElement('style');
  style.textContent = `.rune-control-touch{position:absolute;z-index:6;pointer-events:none;display:none;user-select:none;-webkit-user-select:none;touch-action:none}@media(pointer:coarse),(hover:none){.rune-control-touch{display:block}}.rune-control-touch.is-touch{display:block}.rune-control-touch[hidden]{display:none}.rune-control-touch button{position:absolute;pointer-events:auto;touch-action:none;color:#fff;background:#172c42bb;border:2px solid #efca6a99;border-radius:50%;font:bold 11px ui-monospace,monospace;padding:4px;box-sizing:border-box;min-width:44px;min-height:44px}.rune-control-touch button:focus-visible{outline:3px solid white}.rune-control-touch .control-thumb{position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;background:#efca6aaa;pointer-events:none}`;
  document.head.append(style);
  const overlay = document.createElement('div'); overlay.className = 'rune-control-touch';
  surface.append(overlay);
  const position = getComputedStyle(surface).position;
  if (position === 'static') surface.style.position = 'relative';
  const oldTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';
  const hint = document.createElement('span'); hint.className = 'rotate-hint'; hint.textContent = 'Rotate your device for landscape play'; overlay.append(hint);
  const abort = new AbortController();
  function listen(target: EventTarget, name: string, fn: (e: PointerEvent) => void) { target.addEventListener(name, fn as EventListener, { signal: abort.signal, passive: false }); }
  type Pointer = { target: HTMLElement; move?(e: PointerEvent): void; end(cancel: boolean): void };
  const pointers = new Map<number, Pointer>();
  const occupied = new Set<HTMLElement>();
  const visibility = new Map<HTMLElement, string>();
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
    listen(stick, 'pointerdown', e => {
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
    listen(target, 'pointerdown', e => {
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
  function reset() {
    const active = [...pointers]; pointers.clear(); occupied.clear();
    for (const [id, pointer] of active) {
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
      if (overlay.hidden || pointer.target.hidden) {
        pointers.delete(id); occupied.delete(pointer.target); pointer.end(true);
        try { pointer.target.releasePointerCapture(id); } catch { /* Already released. */ }
      }
    }
    const expanded = options.expanded?.() || false;
    hint.style.cssText = 'position:absolute;left:25%;bottom:calc(100% + 12px);width:50%;text-align:center;color:white;background:#142432dd;font:12px monospace;padding:8px';
    hint.hidden = !expanded || innerWidth >= innerHeight;
    for (const def of profile.buttons || []) {
      const target = Array.from(overlay.querySelectorAll<HTMLButtonElement>('button')).find(b => b.dataset.controlTouch === def.id)!;
      if (def.command === 'host.pause') { target.textContent = options.paused() ? 'RESUME' : def.label; target.setAttribute('aria-label', options.paused() ? 'Resume game' : (def.aria_label || def.label)); }
      if (def.command === 'host.fullscreen') target.textContent = expanded ? 'EXIT' : def.label;
    }
  }
  const resize = new ResizeObserver(update); resize.observe(canvas); resize.observe(surface); update();
  return { reset, update, dispose() { reset(); abort.abort(); resize.disconnect(); overlay.remove(); style.remove(); canvas.style.touchAction = oldTouchAction; if (position === 'static') surface.style.position = ''; } };
}
