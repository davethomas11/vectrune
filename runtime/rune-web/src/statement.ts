// ============================================================================
// Statement execution — actions, assignments, mutations
// ============================================================================

import { ctx } from './context';
import { evaluateExpression } from './expression';
import { getWindowProp } from './globals';
import { interpolate } from './interpolation';
import { splitPathSegments, buildScope } from './scope';
import { handleBuiltin } from "./builtins";
import { splitTopLevel, valueToString, normalizeLiteral } from './utils';
import { playSound, playMusic, stopMusic, pauseMusic, resumeMusic, setMusicTempo, setMusicVolume } from './audio';
import type { ActionStep, Scope } from './types';
import { NO_ACTION, STOP } from './builtins/command';

// ---------------------------------------------------------------------------
// assignPath — set a value at a dotted/bracketed path
// ---------------------------------------------------------------------------

export function assignPath(
  pathExpr: string,
  value: unknown,
  locals: Record<string, unknown>,
): void {
  const segments = splitPathSegments(pathExpr);
  if (!segments.length) return;
  const baseKey = segments[0];

  let current: unknown;
  if (
    locals &&
    Object.prototype.hasOwnProperty.call(locals, baseKey)
  ) {
    current = locals[baseKey];
    if (segments.length === 1) {
      locals[baseKey] = value;
      return;
    }
  } else {
    current = ctx().app.state[baseKey];
    if (segments.length === 1) {
      ctx().app.state[baseKey] = value;
      return;
    }
  }

  for (let i = 1; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const scopeValue = buildScope(locals);

    if (
      Array.isArray(current) &&
      segment.startsWith('[].(') &&
      segment.endsWith(')')
    ) {
      const condition = segment.slice(4, -1);
      const match = (current as unknown[]).find((item: unknown) => {
        const innerScope = Object.assign({}, scopeValue, { it: item });
        return Boolean(evaluateExpression(condition, innerScope, 0));
      });
      if (match !== undefined) {
        current = match;
        continue;
      } else return;
    } else if (segment.startsWith('[') && segment.endsWith(']')) {
      const innerExpr = segment.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scopeValue, 0);
      const key = Array.isArray(current)
        ? Number(lookup)
        : valueToString(lookup);
      if ((current as Record<string, unknown>)[key as string] === undefined) {
        (current as Record<string, unknown>)[key as string] = {};
      }
      current = (current as Record<string, unknown>)[key as string];
    } else {
      const key = segment;
      if ((current as Record<string, unknown>)[key] === undefined) {
        (current as Record<string, unknown>)[key] = {};
      }
      current = (current as Record<string, unknown>)[key];
    }
  }

  const finalRawKey = segments[segments.length - 1];
  const scopeValue = buildScope(locals);

  if (
    Array.isArray(current) &&
    finalRawKey.startsWith('[].(') &&
    finalRawKey.endsWith(')')
  ) {
    const condition = finalRawKey.slice(4, -1);
    const index = (current as unknown[]).findIndex((item: unknown) => {
      const innerScope = Object.assign({}, scopeValue, { it: item });
      return Boolean(evaluateExpression(condition, innerScope, 0));
    });
    if (index !== -1) {
      (current as unknown[])[index] = value;
    }
    return;
  } else if (finalRawKey.startsWith('[') && finalRawKey.endsWith(']')) {
    const innerExpr = finalRawKey.slice(1, -1);
    const lookup = evaluateExpression(innerExpr, scopeValue, 0);
    const finalKey = Array.isArray(current)
      ? Number(lookup)
      : valueToString(lookup);
    (current as Record<string, unknown>)[finalKey as string] = value;
  } else {
    (current as Record<string, unknown>)[finalRawKey] = value;
  }
}

// ---------------------------------------------------------------------------
// deletePath — remove an element from an array or key from an object
// ---------------------------------------------------------------------------

export function deletePath(
  pathExpr: string,
  locals: Record<string, unknown>,
): void {
  const segments = splitPathSegments(pathExpr);
  if (!segments.length) return;
  const baseKey = segments[0];

  let current: unknown;
  if (
    locals &&
    Object.prototype.hasOwnProperty.call(locals, baseKey)
  ) {
    current = locals[baseKey];
    if (segments.length === 1) {
      delete locals[baseKey];
      return;
    }
  } else {
    current = ctx().app.state[baseKey];
    if (segments.length === 1) {
      delete ctx().app.state[baseKey];
      return;
    }
  }

  for (let i = 1; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    const scopeValue = buildScope(locals);

    if (
      Array.isArray(current) &&
      segment.startsWith('[].(') &&
      segment.endsWith(')')
    ) {
      const condition = segment.slice(4, -1);
      const match = (current as unknown[]).find((item: unknown) => {
        const innerScope = Object.assign({}, scopeValue, { it: item });
        return Boolean(evaluateExpression(condition, innerScope, 0));
      });
      if (match !== undefined) {
        current = match;
        continue;
      } else return;
    } else if (segment.startsWith('[') && segment.endsWith(']')) {
      const innerExpr = segment.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scopeValue, 0);
      const key = Array.isArray(current)
        ? Number(lookup)
        : valueToString(lookup);
      if ((current as Record<string, unknown>)[key as string] === undefined) return;
      current = (current as Record<string, unknown>)[key as string];
    } else {
      const key = segment;
      if ((current as Record<string, unknown>)[key] === undefined) return;
      current = (current as Record<string, unknown>)[key];
    }
  }

  const finalRawKey = segments[segments.length - 1];
  const scopeValue = buildScope(locals);

  if (
    Array.isArray(current) &&
    finalRawKey.startsWith('[].(') &&
    finalRawKey.endsWith(')')
  ) {
    const condition = finalRawKey.slice(4, -1);
    const index = (current as unknown[]).findIndex((item: unknown) => {
      const innerScope = Object.assign({}, scopeValue, { it: item });
      return Boolean(evaluateExpression(condition, innerScope, 0));
    });
    if (index !== -1) {
      (current as unknown[]).splice(index, 1);
    }
  } else if (finalRawKey.startsWith('[') && finalRawKey.endsWith(']')) {
    const innerExpr = finalRawKey.slice(1, -1);
    const lookup = evaluateExpression(innerExpr, scopeValue, 0);
    const finalKey = Array.isArray(current)
      ? Number(lookup)
      : valueToString(lookup);
    if (Array.isArray(current) && typeof finalKey === 'number') {
      (current as unknown[]).splice(finalKey, 1);
    } else {
      delete (current as Record<string, unknown>)[finalKey as string];
    }
  } else {
    if (Array.isArray(current) && !isNaN(Number(finalRawKey))) {
      (current as unknown[]).splice(Number(finalRawKey), 1);
    } else {
      delete (current as Record<string, unknown>)[finalRawKey];
    }
  }
}

// ---------------------------------------------------------------------------
// executeStatement — interpret a single action statement
// ---------------------------------------------------------------------------

export function executeStatement(
  statement: string,
  locals: Record<string, unknown>,
): boolean {
  const trimmed = String(statement || '').trim();
  if (!trimmed) return true;

  // Retro audio playback: sound "laser", sound.play("laser"), sound.explosion
  if (trimmed.startsWith('sound ') || trimmed.startsWith('sound.') || trimmed.startsWith('play_sound(')) {
    let soundName = '';
    let argVal: unknown = undefined;
    if (trimmed.startsWith('sound.play(') && trimmed.endsWith(')')) {
      const inner = trimmed.slice(11, -1);
      const parts = splitTopLevel(inner, ',');
      soundName = String(evaluateExpression(parts[0], buildScope(locals)) || '');
      if (parts.length > 1) {
        argVal = evaluateExpression(parts[1], buildScope(locals));
      }
    } else if (trimmed.startsWith('play_sound(') && trimmed.endsWith(')')) {
      const inner = trimmed.slice(11, -1);
      const parts = splitTopLevel(inner, ',');
      soundName = String(evaluateExpression(parts[0], buildScope(locals)) || '');
      if (parts.length > 1) {
        argVal = evaluateExpression(parts[1], buildScope(locals));
      }
    } else if (trimmed.startsWith('sound.play ')) {
      soundName = String(evaluateExpression(trimmed.slice(11), buildScope(locals)) || '');
    } else if (trimmed.startsWith('sound.')) {
      soundName = trimmed.slice(6).trim();
    } else {
      soundName = String(evaluateExpression(trimmed.slice(6), buildScope(locals)) || '');
    }
    soundName = normalizeLiteral(soundName);
    playSound(soundName, argVal);
    return true;
  }

  // Retro chiptune music playback:
  // music "vectraiders", music.play("vectraiders"), music.stop, music.pause, music.resume, music.tempo = 150
  if (trimmed.startsWith('music ') || trimmed.startsWith('music.') || trimmed.startsWith('play_music(')) {
    if (trimmed === 'music.stop' || trimmed === 'music.stop()' || trimmed === 'stop_music()') {
      stopMusic();
      return true;
    }
    if (trimmed === 'music.pause' || trimmed === 'music.pause()' || trimmed === 'pause_music()') {
      pauseMusic();
      return true;
    }
    if (trimmed === 'music.resume' || trimmed === 'music.resume()' || trimmed === 'resume_music()') {
      resumeMusic();
      return true;
    }
    if (trimmed.startsWith('music.tempo =') || trimmed.startsWith('music.tempo=')) {
      const expr = trimmed.slice(trimmed.indexOf('=') + 1).trim();
      const val = Number(evaluateExpression(expr, buildScope(locals)));
      if (!isNaN(val)) setMusicTempo(val);
      return true;
    }
    if (trimmed.startsWith('music.volume =') || trimmed.startsWith('music.volume=')) {
      const expr = trimmed.slice(trimmed.indexOf('=') + 1).trim();
      const val = Number(evaluateExpression(expr, buildScope(locals)));
      if (!isNaN(val)) setMusicVolume(val);
      return true;
    }
    let trackName = '';
    if (trimmed.startsWith('music.play(') && trimmed.endsWith(')')) {
      trackName = String(evaluateExpression(trimmed.slice(11, -1), buildScope(locals)) || '');
    } else if (trimmed.startsWith('play_music(') && trimmed.endsWith(')')) {
      trackName = String(evaluateExpression(trimmed.slice(11, -1), buildScope(locals)) || '');
    } else if (trimmed.startsWith('music.play ')) {
      trackName = String(evaluateExpression(trimmed.slice(11), buildScope(locals)) || '');
    } else {
      trackName = String(evaluateExpression(trimmed.slice(6), buildScope(locals)) || '');
    }
    trackName = normalizeLiteral(trackName);
    playMusic(trackName);
    return true;
  }

  // Particle emitters (declared in state as `name = emitter { ... }`):
  //   <emitter>.burst(x, y, [count, color, speed])
  //   <emitter>.step()
  const emitterMatch = trimmed.match(/^([A-Za-z_][\w]*)\.(burst|step)\((.*)\)$/);
  if (emitterMatch && ctx().emitters && Object.prototype.hasOwnProperty.call(ctx().emitters, emitterMatch[1])) {
    const name = emitterMatch[1];
    const method = emitterMatch[2];
    const cfg = ctx().emitters![name] || {};
    const scope = buildScope(locals);
    const existing = evaluateExpression(name, scope);
    const current = Array.isArray(existing) ? (existing as Array<Record<string, unknown>>) : [];

    if (method === 'step') {
      if (current.length === 0) return true;
      const friction = cfg.friction ?? 0.92;
      const gravity = cfg.gravity ?? 0;
      const surviving: Array<Record<string, unknown>> = [];
      const rawCurrent = ((current as unknown as Record<string, unknown>).__raw as Array<Record<string, unknown>>) || current;
      for (let i = 0; i < rawCurrent.length; i += 1) {
        const item = rawCurrent[i];
        if (!item || typeof item !== 'object') continue;
        const p = ((item as Record<string, unknown>).__raw as Record<string, unknown>) || item;
        const life = Number(p.life || 0) - 1;
        if (life <= 0) continue;
        const vx = Number(p.vx || 0) * friction;
        const vy = Number(p.vy || 0) * friction + gravity;
        p.x = Math.round((Number(p.x || 0) + Number(p.vx || 0)) * 10) / 10;
        p.y = Math.round((Number(p.y || 0) + Number(p.vy || 0)) * 10) / 10;
        p.vx = vx;
        p.vy = vy;
        p.life = life;
        surviving.push(p);
      }
      assignPath(name, surviving, locals);
      return true;
    }

    const parts = emitterMatch[3].trim() ? splitTopLevel(emitterMatch[3], ',') : [];
    if (parts.length < 2) {
      console.warn(`[rune-web] ${name}.burst(x, y, [count, color, speed]) needs at least x and y`);
      return true;
    }
    const arg = (i: number) => (parts.length > i ? evaluateExpression(parts[i], scope) : undefined);
    const xVal = Math.round(Number(arg(0) || 0) * 10) / 10;
    const yVal = Math.round(Number(arg(1) || 0) * 10) / 10;
    const countVal = Number(arg(2) ?? cfg.count ?? 8);
    const colorVal = arg(3) !== undefined ? valueToString(arg(3)) : (cfg.color ?? '#ffffff');
    const speedVal = Number(arg(4) ?? cfg.speed ?? 7);
    const life = cfg.life ?? 14;
    const maxParticles = (cfg as Record<string, unknown>).max !== undefined ? Number((cfg as Record<string, unknown>).max) : 36;
    const [minSize, maxSize] = Array.isArray(cfg.size)
      ? cfg.size
      : [cfg.size ?? 3, cfg.size ?? 5];

    const rawCurrent = ((current as unknown as Record<string, unknown>).__raw as Array<Record<string, unknown>>) || current;
    const newParticles: Array<Record<string, unknown>> = [];
    for (let i = 0; i < countVal; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = (Math.random() * 0.7 + 0.3) * speedVal;
      newParticles.push({
        x: xVal,
        y: yVal,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life,
        max_life: life,
        color: colorVal,
        size: minSize + Math.floor(Math.random() * (maxSize - minSize + 1)),
      });
    }
    const combined = rawCurrent.concat(newParticles);
    const capped = combined.length > maxParticles ? combined.slice(combined.length - maxParticles) : combined;
    assignPath(name, capped, locals);
    return true;
  }

  // Entity / collection restore shorthand: restore <path>, reset <path>, <path>.restore(), <path>.reset()
  const restoreMatch = trimmed.match(/^(?:restore|reset)\s+([a-zA-Z0-9_.[\]'"]+)$/) ||
                       trimmed.match(/^([a-zA-Z0-9_.[\]'"]+)\.(?:restore|reset)\(\)$/);
  if (restoreMatch) {
    const targetPath = restoreMatch[1].trim();
    const initial = ctx().initialState;
    if (initial && Object.prototype.hasOwnProperty.call(initial, targetPath)) {
      assignPath(targetPath, JSON.parse(JSON.stringify(initial[targetPath])), locals);
      return true;
    }
    const targetVal = evaluateExpression(targetPath, buildScope(locals));
    if (Array.isArray(targetVal)) {
      for (const item of targetVal) {
        if (item && typeof item === 'object') {
          for (const key of Object.keys(item)) {
            if (key.startsWith('start_')) {
              const baseProp = key.slice(6);
              (item as Record<string, unknown>)[baseProp] = (item as Record<string, unknown>)[key];
            }
          }
          if ('alive' in item) {
            (item as Record<string, unknown>).alive = true;
          }
        }
      }
      assignPath(targetPath, targetVal, locals);
      return true;
    } else if (targetVal && typeof targetVal === 'object') {
      const item = targetVal as Record<string, unknown>;
      for (const key of Object.keys(item)) {
        if (key.startsWith('start_')) {
          item[key.slice(6)] = item[key];
        }
      }
      if ('alive' in item) {
        item.alive = true;
      }
      assignPath(targetPath, item, locals);
      return true;
    }
    return true;
  }

  // Compound assignment handling (+=, -=, *=, /=)
  const compoundMatch = trimmed.match(/^([a-zA-Z0-9_.[\]'"]+)\s*(\+|\-|\*|\/)=\s*(.+)$/);
  if (compoundMatch) {
    const left = compoundMatch[1].trim();
    const op = compoundMatch[2];
    const right = compoundMatch[3].trim();
    const rightVal = evaluateExpression(right, buildScope(locals));
    const leftVal = evaluateExpression(left, buildScope(locals));
    let newVal: unknown;
    if (op === '+') {
      if (typeof leftVal === 'number' && typeof rightVal === 'number') {
        newVal = leftVal + rightVal;
      } else {
        newVal = `${valueToString(leftVal)}${valueToString(rightVal)}`;
      }
    } else if (op === '-') {
      newVal = Number(leftVal) - Number(rightVal);
    } else if (op === '*') {
      newVal = Number(leftVal) * Number(rightVal);
    } else if (op === '/') {
      newVal = Number(leftVal) / Number(rightVal);
    }
    assignPath(left, newVal, locals);
    return true;
  }

  // Assignment handling – placed before builtin processing so RHS can be a builtin expression
  // Exclude push syntax which is handled separately
  if (trimmed.includes('=') && !trimmed.match(/^.+?\.push\(/)) {
    const assignmentMatch = trimmed.match(/^(.*?)(?<![!<>=])=(?!=)(.*)$/);
    if (assignmentMatch) {
      const left = assignmentMatch[1].trim();
      const right = assignmentMatch[2].trim();

      // Try builtin expression first
      const builtinVal = handleBuiltin(right, locals);
      if (builtinVal == STOP) {
        return false;
      }
      if (builtinVal == NO_ACTION) {
        return true;
      }
      const value = builtinVal !== undefined ? builtinVal : evaluateExpression(right, buildScope(locals));
      assignPath(left, value, locals);
      return true;
    }
  }

  // Built‑in command handling (including `as` syntax)
  const cmdResult = handleBuiltin(trimmed, locals);
  if (cmdResult) {
    if (cmdResult == STOP) {
      return false;
    }
    return true;
  }

  // Array push syntax
  const pushMatch = trimmed.match(/^(.+?)\.push\((.+)\)$/);
  if (pushMatch) {
    const path = pushMatch[1].trim();
    const arg = pushMatch[2].trim();
    const collection = evaluateExpression(path, buildScope(locals));
    if (Array.isArray(collection)) {
      const val = evaluateExpression(arg, buildScope(locals));
      collection.push(val);
      assignPath(path, collection, locals);
    }
    return true;
  }

  // Function‑call style builtins (e.g., window.__runeWebEmit)
  if (trimmed.includes('(') && trimmed.endsWith(')')) {
    const parenIndex = trimmed.indexOf('(');
    const funcName = trimmed.slice(0, parenIndex).trim();
    const argsStr = trimmed.slice(parenIndex + 1, -1);

    if (funcName === 'window.__runeWebEmit') {
      const args = argsStr
        ? splitTopLevel(argsStr, ',').map((arg) =>
          evaluateExpression(arg, buildScope(locals)),
        )
        : [];
      const emitFn = getWindowProp('__runeWebEmit');
      if (emitFn && typeof emitFn === 'function') {
        (emitFn as Function).apply(null, args);
      }
      return true;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// executeSteps — run an array of action steps (Statement / Conditional / ForLoop)
// ---------------------------------------------------------------------------

export function executeSteps(
  steps: ActionStep[],
  locals: Record<string, unknown>,
): boolean {
  for (const step of steps) {
    if (Object.prototype.hasOwnProperty.call(step, 'Statement')) {
      if (!executeStatement(step.Statement!, locals)) return false;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(step, 'Conditional')) {
      const conditional = step.Conditional!;
      if (
        Boolean(
          evaluateExpression(
            conditional.condition,
            buildScope(locals),
          ),
        )
      ) {
        if (!executeSteps(conditional.steps || [], locals)) return false;
      }
    }

    if (Object.prototype.hasOwnProperty.call(step, 'ForLoop')) {
      const loop = step.ForLoop!;
      const collection = evaluateExpression(
        loop.collection,
        buildScope(locals),
      );
      if (Array.isArray(collection)) {
        for (let i = 0; i < collection.length; i++) {
          const item = collection[i];
          const childLocals: Record<string, unknown> = Object.assign(
            {},
            locals || {},
          );
          childLocals[loop.item_name] = item;
          if (loop.index_name) {
            childLocals[loop.index_name] = i;
          }
          if (!executeSteps(loop.steps || [], childLocals)) {
            break;
          }
        }
      }
    }
  }
  return true;
}
