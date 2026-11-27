import { ctx, withContext } from '../context';
import type { BuiltinCommand, CommandResult } from './command';

type LocationFailure = { code: string; message: string };

function failure(error: GeolocationPositionError): LocationFailure {
  switch (error.code) {
    case 1: return { code: 'denied', message: 'Location permission was denied.' };
    case 2: return { code: 'unavailable', message: 'Location is unavailable.' };
    case 3: return { code: 'timeout', message: 'Location request timed out.' };
    default: return { code: 'unavailable', message: 'Location is unavailable.' };
  }
}

function deliver(action: string, value: unknown, locals: Record<string, unknown>): void {
  const app = ctx().app;
  if (Object.keys(locals).length) app.invokeAction(action, [value], locals);
  else app.invokeAction(action, [value]);
  app.render();
}

function report(action: string | undefined, error: LocationFailure, locals: Record<string, unknown>): void {
  if (action) deliver(action, error, locals);
  else console.warn(`location: ${error.message}`);
}

function requestLocation(onSuccess: string, onError: string | undefined, locals: Record<string, unknown>): void {
  const context = ctx();
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    report(onError, { code: 'unavailable', message: 'Location is unavailable in this browser.' }, locals);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    position => withContext(context, () => deliver(onSuccess, {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
    }, locals)),
    error => withContext(context, () => report(onError, failure(error), locals)),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
  );
}

function locationHandler(statement: string, actionLocals: Record<string, unknown>): CommandResult {
  const locals = { ...actionLocals };
  const match = statement.trim().match(
    /^location\.(current|if-granted)\s+then\s+([A-Za-z_][\w.-]*)(?:\s+catch\s+([A-Za-z_][\w.-]*))?$/,
  );
  if (!match) throw new Error('Use location.current then <action> [catch <action>] or location.if-granted then <action> [catch <action>]');
  const [, mode, success, onError] = match;
  if (mode === 'current') {
    requestLocation(success, onError, locals);
  } else {
    const context = ctx();
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      report(onError, { code: 'unavailable', message: 'Location permission status is unavailable.' }, locals);
      return true;
    }
    navigator.permissions.query({ name: 'geolocation' }).then(
      permission => withContext(context, () => {
        if (permission.state === 'granted') requestLocation(success, onError, locals);
        else report(onError, { code: permission.state, message: 'Location permission has not been granted.' }, locals);
      }),
      () => withContext(context, () => report(onError, {
        code: 'unavailable', message: 'Location permission status is unavailable.',
      }, locals)),
    );
  }
  return true;
}

export const locationCommand: BuiltinCommand = {
  prefix: ['location.current', 'location.if-granted'],
  signature: 'location.current then <action> [catch <action>]',
  description: 'Request browser location or use it only if permission is already granted.',
  handler: locationHandler,
};
