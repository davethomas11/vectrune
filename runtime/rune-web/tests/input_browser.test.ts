import { afterEach, expect, it, vi } from 'vitest';
import { mountControls } from '../src/input/browser';
import { GameControls } from '../src/input/game';

afterEach(() => vi.unstubAllGlobals());

it('delivers both mouse axes over an unlocked canvas only after capture is unavailable', () => {
  const canvas = new EventTarget() as HTMLCanvasElement;
  const document = Object.assign(new EventTarget(), {
    activeElement: canvas as Element | null,
    pointerLockElement: undefined as Element | null | undefined,
    hasFocus: () => false,
  });
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', new EventTarget());

  const game = { paused: false, muted: false, app: { state: {} }, start() {}, invoke() {} };
  const controls = new GameControls({
    keys: {}, commands: {}, mouse: { MoveX: 'look_x', MoveY: 'look_y' }, gamepad: {},
  }, game);
  let captureUnavailable = false;
  const browser = mountControls(canvas, controls, {
    playing: () => true, paused: () => game.paused, lockedMouse: true,
    unlockedCanvasLook: () => captureUnavailable, resume() {}, advance() {}, fullscreen() {}, interact() {},
  });
  function move(target: EventTarget) {
    const event = Object.assign(new Event('mousemove'), { movementX: 6, movementY: -4 });
    Object.defineProperty(event, 'target', { value: target });
    document.dispatchEvent(event);
    return browser.sample(1 / 30);
  }

  try {
    expect(move(canvas)).toEqual({});
    captureUnavailable = true;
    expect(move(document)).toEqual({});
    expect(move(canvas)).toEqual({ look_x: 6, look_y: -4 });
    expect(browser.sample(1 / 30)).toEqual({ look_x: 0, look_y: 0 });

    document.activeElement = null;
    expect(move(canvas)).toEqual({ look_x: 0, look_y: 0 });
    document.pointerLockElement = canvas;
    captureUnavailable = false;
    expect(move(document)).toEqual({ look_x: 6, look_y: -4 });
    game.paused = true;
    expect(move(document)).toEqual({ look_x: 0, look_y: 0 });
  } finally {
    browser.dispose();
  }
});
