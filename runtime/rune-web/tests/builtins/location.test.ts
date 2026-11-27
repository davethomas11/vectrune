import { afterEach, describe, expect, it, vi } from 'vitest';
import { ctx } from '../../src/context';
import { runBuiltin } from './testUtils';

afterEach(() => vi.unstubAllGlobals());

describe('browser location commands', () => {
  it('delivers the position to the success action', () => {
    const app = ctx().app;
    app.invokeAction = vi.fn();
    app.render = vi.fn();
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: { latitude: 49.28, longitude: -123.12, accuracy: 30, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
      timestamp: 123,
    }));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    expect(runBuiltin('location.current then located catch failed', {})).toBe(true);
    expect(app.invokeAction).toHaveBeenCalledWith('located', [{ latitude: 49.28, longitude: -123.12, accuracy: 30, timestamp: 123 }]);
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    expect(app.render).toHaveBeenCalled();
  });

  it.each([[1, 'denied'], [2, 'unavailable'], [3, 'timeout']])('reports location error %i', (code, expected) => {
    const app = ctx().app;
    app.invokeAction = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => error({ code, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) } });
    runBuiltin('location.current then located catch failed', {});
    expect(app.invokeAction).toHaveBeenCalledWith('failed', [expect.objectContaining({ code: expected })]);
  });

  it.each(['prompt', 'denied'])('does not request location when permission is %s', async state => {
    const app = ctx().app;
    app.invokeAction = vi.fn();
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { permissions: { query: vi.fn().mockResolvedValue({ state }) }, geolocation: { getCurrentPosition } });
    runBuiltin('location.if-granted then located catch failed', {});
    await vi.waitFor(() => expect(app.invokeAction).toHaveBeenCalledWith('failed', [expect.objectContaining({ code: state })]));
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('requests location when permission is already granted', async () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { permissions: { query: vi.fn().mockResolvedValue({ state: 'granted' }) }, geolocation: { getCurrentPosition } });
    runBuiltin('location.if-granted then located catch failed', {});
    await vi.waitFor(() => expect(getCurrentPosition).toHaveBeenCalledOnce());
  });

  it('passes a snapshot of action locals to an asynchronous callback', () => {
    const app = ctx().app;
    app.invokeAction = vi.fn();
    let success: PositionCallback | undefined;
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (callback: PositionCallback) => { success = callback; } } });
    const locals = { token: 1 };
    runBuiltin('location.current then located catch failed', locals);
    locals.token = 2;
    success!({
      coords: { latitude: 1, longitude: 2, accuracy: 3, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
      timestamp: 4,
    });
    expect(app.invokeAction).toHaveBeenCalledWith('located', [expect.objectContaining({ latitude: 1 })], { token: 1 });
  });

  it('reports an unavailable permissions API without requesting location', () => {
    const app = ctx().app;
    app.invokeAction = vi.fn();
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    runBuiltin('location.if-granted then located catch failed', {});
    expect(app.invokeAction).toHaveBeenCalledWith('failed', [expect.objectContaining({ code: 'unavailable' })]);
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
});
