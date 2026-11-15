import type { GameControls } from './game';
import { mountControlTouch } from './touch';

/** Physical browser devices feed the same controller used by native hosts. */
export function mountControls(canvas: HTMLCanvasElement, controls: GameControls, options: {
  playing(): boolean; paused(): boolean; resume(): void; advance(): void;
  fullscreen(): void; interact(): void; lockedMouse?: boolean;
  expanded?(): boolean;
  menuKey?(code: string): boolean;
  advanceInputs?: string[];
}) {
  const abort = new AbortController();
  let lastTouch = 0;
  const send = (event: Parameters<GameControls['event']>[0]) => {
    if (controls.event(event) === 'host.fullscreen') options.fullscreen();
  };
  function listen(target: EventTarget, name: string, handler: (event: any) => void) { target.addEventListener(name, handler, { signal: abort.signal }); }
  listen(canvas, 'keydown', (e: KeyboardEvent) => {
    options.interact();
    if (Object.prototype.hasOwnProperty.call(controls.profile.keys, e.code) || Object.prototype.hasOwnProperty.call(controls.profile.commands, e.code)) e.preventDefault();
    if (!options.playing() && !controls.profile.commands[e.code]) {
      const binding = controls.profile.keys[e.code];
      const input = typeof binding === 'string' ? binding : binding?.input;
      if (input && options.advanceInputs?.includes(input)) { if (!e.repeat) options.advance(); return; }
      if (!e.repeat && options.menuKey?.(e.code)) return;
    }
    send({ device: 'keyboard', code: e.code, value: true });
  });
  listen(document, 'keyup', (e: KeyboardEvent) => send({ device: 'keyboard', code: e.code, value: false }));
  const mouseCode = (button: number) => ['Left', 'Middle', 'Right', 'Back', 'Forward'][button];
  listen(canvas, 'mousedown', (e: MouseEvent) => {
    if (Date.now() - lastTouch < 700 || !options.playing()) return;
    options.interact(); canvas.focus(); const code = mouseCode(e.button);
    if (code) send({ device: 'mouse', code, value: true });
  });
  listen(document, 'mouseup', (e: MouseEvent) => {
    const code = mouseCode(e.button);
    if (code) send({ device: 'mouse', code, value: false });
  });
  listen(canvas, 'contextmenu', (e: Event) => { if (controls.profile.mouse.Right) e.preventDefault(); });
  listen(document, 'mousemove', (e: MouseEvent) => {
    if (!options.playing() || (options.lockedMouse ? document.pointerLockElement !== canvas : document.activeElement !== canvas)) return;
    send({ device: 'mouse', code: 'MoveX', value: e.movementX }); send({ device: 'mouse', code: 'MoveY', value: e.movementY });
  });
  canvas.addEventListener('wheel', e => {
    if (document.activeElement !== canvas || !options.playing()) return;
    if (controls.profile.mouse.WheelX || controls.profile.mouse.WheelY) e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
    send({ device: 'mouse', code: 'WheelX', value: e.deltaX * unit }); send({ device: 'mouse', code: 'WheelY', value: e.deltaY * unit });
  }, { signal: abort.signal, passive: false });
  const touch = controls.profile.touch && controls.profile.touch.enabled !== false ? mountControlTouch(canvas, controls, controls.profile.touch, {
    ...options, interact() { lastTouch = Date.now(); options.interact(); },
  }) : undefined;
  function clear() { touch?.reset(); controls.clear(); }
  listen(canvas, 'blur', clear); listen(window, 'blur', clear);
  listen(document, 'visibilitychange', () => { if (document.hidden) clear(); });
  return {
    clear,
    recentTouch: () => Date.now() - lastTouch < 700,
    update() { touch?.update(); },
    sample(dt: number) {
      // Only the focused game polls controllers; disconnected pads release their sources.
      let pads: (Gamepad | null)[] = [];
      try { if (document.hasFocus() && document.activeElement === canvas) pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []; } catch { /* Permission policy may disable gamepads. */ }
      for (const command of controls.gamepads(pads)) if (command === 'host.fullscreen') options.fullscreen();
      return controls.sample(dt);
    },
    dispose() { clear(); touch?.dispose(); abort.abort(); },
  };
}
