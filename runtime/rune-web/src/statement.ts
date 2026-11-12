import { downloadText, copyText } from './effects';
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
import { playSound, playMusic, stopMusic, pauseMusic, resumeMusic, setMusicTempo, setMusicVolume, registerMusic, registerSounds } from './audio';
import { setStorageItem, removeStorageItem, clearStorage } from './storage';
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
    if (trimmed.startsWith('music.compose(') || trimmed.startsWith('music.register(')) {
      const inner = trimmed.slice(trimmed.indexOf('(') + 1, -1);
      const parts = splitTopLevel(inner, ',');
      if (parts.length >= 4) {
        const name = String(evaluateExpression(parts[0], buildScope(locals)));
        const tempo = Number(evaluateExpression(parts[1], buildScope(locals))) || 128;
        const lead = String(evaluateExpression(parts[2], buildScope(locals)));
        const bass = String(evaluateExpression(parts[3], buildScope(locals)));
        const drums = parts.length > 4 ? String(evaluateExpression(parts[4], buildScope(locals))) : '';
        const timeSig = parts.length > 5 ? String(evaluateExpression(parts[5], buildScope(locals))) : '4/4';
        const songBars = Number((ctx().app as any)?.state?.bars) || 4;
        registerMusic({
          [name]: {
            music_type: '8bit',
            tempo,
            time_signature: timeSig,
            bars: songBars,
            loop_track: true,
            volume: 0.2,
            lead,
            bass,
            drums,
          },
        });
      }
      return true;
    }

    if (trimmed.startsWith('music.compose_song(') || trimmed.startsWith('music.register_song(')) {
      const inner = trimmed.slice(trimmed.indexOf('(') + 1, -1);
      const parts = splitTopLevel(inner, ',');
      if (parts.length >= 2) {
        const name = String(evaluateExpression(parts[0], buildScope(locals)));
        const songConfig = evaluateExpression(parts[1], buildScope(locals)) as any;
        if (songConfig && typeof songConfig === 'object') {
          registerMusic({
            [name]: songConfig,
          });
        }
      }
      return true;
    }
    if (
      trimmed === 'music.play' ||
      trimmed === 'music.play()' ||
      trimmed.startsWith('music.play(') ||
      trimmed.startsWith('music.play ') ||
      trimmed.startsWith('play_music(') ||
      (trimmed.startsWith('music ') && !trimmed.startsWith('music.tempo') && !trimmed.startsWith('music.volume'))
    ) {
      let trackName = '';
      if (trimmed.startsWith('music.play(') && trimmed.endsWith(')')) {
        trackName = String(evaluateExpression(trimmed.slice(11, -1), buildScope(locals)) || '');
      } else if (trimmed.startsWith('play_music(') && trimmed.endsWith(')')) {
        trackName = String(evaluateExpression(trimmed.slice(11, -1), buildScope(locals)) || '');
      } else if (trimmed.startsWith('music.play ')) {
        trackName = String(evaluateExpression(trimmed.slice(11), buildScope(locals)) || '');
      } else if (trimmed.startsWith('music ')) {
        trackName = String(evaluateExpression(trimmed.slice(6), buildScope(locals)) || '');
      }
      trackName = normalizeLiteral(trackName);
      if (trackName) playMusic(trackName);
      return true;
    }
  }

  // Music Step Sequencer Helpers: music.sync_steps, music.select_step(id), music.delete_step(id)
  if (trimmed === 'music.sync_steps' || trimmed === 'music.sync_steps()') {
    const state = (ctx().app as any)?.state;
    if (state) {
      const voice = String(state.active_voice || 'lead');
      const score = String(state[voice + '_track'] || '');
      const selectedId = Number(state.selected_step_id ?? -1);
      const timeSig = String(state.time_signature || '4/4');
      const selectedBar = Number(state.selected_bar ?? 0);
      state.active_steps = parseTrackToSteps(score, selectedId, timeSig, selectedBar);
      if (typeof (ctx().app as any).render === 'function') {
        (ctx().app as any).render();
      }
    }
    return true;
  }

  if (trimmed.startsWith('music.select_step(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(18, -1);
    const id = Number(evaluateExpression(inner, buildScope(locals)));
    const state = (ctx().app as any)?.state;
    if (state) {
      state.selected_step_id = id;
      const voice = String(state.active_voice || 'lead');
      const score = String(state[voice + '_track'] || '');
      const timeSig = String(state.time_signature || '4/4');
      const selectedBar = Number(state.selected_bar ?? 0);
      state.active_steps = parseTrackToSteps(score, id, timeSig, selectedBar);
      const step = (state.active_steps as Array<any>).find((s: any) => s.id === id);
      if (step && !step.is_bar && !step.is_rest) {
        state.selected_note = step.note;
        if (step.is_chord && step.chord_notes && step.chord_notes.length > 0) {
          for (const cn of step.chord_notes) {
            if (voice === 'drums' || ['kick', 'snare', 'hihat'].includes(cn)) {
              playSound('drum_' + cn);
            } else if (voice === 'bass') {
              playSound('key_bass');
            } else {
              playSound('key_lead');
            }
          }
        } else {
          if (voice === 'drums') {
            playSound('drum_' + step.note);
          } else if (voice === 'bass') {
            playSound('key_bass');
          } else {
            playSound('key_lead');
          }
        }
      }
      if (typeof (ctx().app as any).render === 'function') {
        (ctx().app as any).render();
      }
    }
    return true;
  }

function syncMusicState(state: any): void {
  if (!state || !state.selected_song) return;
  const name = String(state.selected_song);
  const tempo = Number(state.tempo) || 128;
  const timeSig = String(state.time_signature || '4/4');
  const bars = Number(state.bars) || 4;
  const lead = String(state.lead_track || '');
  const bass = String(state.bass_track || '');
  const drums = String(state.drums_track || '');
  registerMusic({
    [name]: {
      music_type: '8bit',
      tempo,
      time_signature: timeSig,
      bars,
      loop_track: true,
      volume: 0.2,
      lead,
      bass,
      drums,
    },
  });
}

  if (trimmed.startsWith('music.delete_step(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(18, -1);
    const id = Number(evaluateExpression(inner, buildScope(locals)));
    const state = (ctx().app as any)?.state;
    if (state) {
      const voice = String(state.active_voice || 'lead');
      const score = String(state[voice + '_track'] || '');
      const timeSig = String(state.time_signature || '4/4');
      const selectedBar = Number(state.selected_bar ?? 0);
      const tokens = score.trim().split(/\s+/).filter(Boolean);
      if (id >= 0 && id < tokens.length) {
        tokens.splice(id, 1);
        state[voice + '_track'] = tokens.join(' ');
        state.selected_step_id = -1;
        state.active_steps = parseTrackToSteps(state[voice + '_track'], -1, timeSig, selectedBar);
        syncMusicState(state);
        if (typeof (ctx().app as any).render === 'function') {
          (ctx().app as any).render();
        }
      }
    }
    return true;
  }

  if (trimmed.startsWith('music.stretch_step(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(19, -1);
    const parts = splitTopLevel(inner, ',');
    const id = Number(evaluateExpression(parts[0], buildScope(locals)));
    const delta = parts.length > 1 ? Number(evaluateExpression(parts[1], buildScope(locals))) : 1;
    const state = (ctx().app as any)?.state;
    if (state) {
      const voice = String(state.active_voice || 'lead');
      const score = String(state[voice + '_track'] || '');
      const timeSig = String(state.time_signature || '4/4');
      const selectedBar = Number(state.selected_bar ?? 0);
      const tokens = score.trim().split(/\s+/).filter(Boolean);
      if (id >= 0 && id < tokens.length) {
        const raw = tokens[id];
        if (raw !== '|') {
          const DURS = [':16', ':8', ':4', ':2', ':1'];
          let currentDur = ':8';
          let prefix = raw;
          if (raw.startsWith('[') && raw.includes(']')) {
            const closeIdx = raw.indexOf(']');
            prefix = raw.slice(0, closeIdx + 1);
            currentDur = raw.slice(closeIdx + 1) || ':8';
          } else {
            const colonIdx = raw.indexOf(':');
            prefix = colonIdx !== -1 ? raw.slice(0, colonIdx) : raw;
            currentDur = colonIdx !== -1 ? raw.slice(colonIdx) : ':8';
          }
          let durIdx = DURS.indexOf(currentDur);
          if (durIdx === -1) durIdx = 1;
          const newDurIdx = Math.max(0, Math.min(DURS.length - 1, durIdx + delta));
          tokens[id] = `${prefix}${DURS[newDurIdx]}`;
          state[voice + '_track'] = tokens.join(' ');
          state.active_steps = parseTrackToSteps(state[voice + '_track'], id, timeSig, selectedBar);
          syncMusicState(state);
          if (typeof (ctx().app as any).render === 'function') {
            (ctx().app as any).render();
          }
        }
      }
    }
    return true;
  }

  if (trimmed.startsWith('music.stack_chord_note(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(23, -1);
    const parts = splitTopLevel(inner, ',');
    const note = String(evaluateExpression(parts[0], buildScope(locals)));
    const dur = parts[1] ? String(evaluateExpression(parts[1], buildScope(locals))) : ':8';
    const state = (ctx().app as any)?.state;
    if (state) {
      const voice = String(state.active_voice || 'lead');
      const score = String(state[voice + '_track'] || '').trim();
      const timeSig = String(state.time_signature || '4/4');
      const selectedBar = Number(state.selected_bar ?? 0);
      const tokens = score.length > 0 ? score.split(/\s+/).filter(Boolean) : [];
      if (tokens.length > 0) {
        const lastToken = tokens[tokens.length - 1];
        if (lastToken.startsWith('[') && lastToken.includes(']')) {
          const closeIdx = lastToken.indexOf(']');
          const currentNotes = lastToken.slice(1, closeIdx).split(/[,+]/).map(s => s.trim()).filter(Boolean);
          const currentDur = lastToken.slice(closeIdx + 1) || dur;
          if (!currentNotes.includes(note)) {
            currentNotes.push(note);
            tokens[tokens.length - 1] = `[${currentNotes.join(',')}]${currentDur}`;
          }
        } else {
          tokens.push(`[${note}]${dur}`);
        }
      } else {
        tokens.push(`[${note}]${dur}`);
      }
      state[voice + '_track'] = tokens.join(' ');
      state.selected_note = note;
      state.active_steps = parseTrackToSteps(state[voice + '_track'], tokens.length - 1, timeSig, selectedBar);
      syncMusicState(state);
      if (typeof (ctx().app as any).render === 'function') {
        (ctx().app as any).render();
      }
    }
    return true;
  }

  if (trimmed === 'music.add_bar' || trimmed === 'music.add_bar()') {
    const state = (ctx().app as any)?.state;
    if (state) {
      const voice = String(state.active_voice || 'lead');
      const score = String(state[voice + '_track'] || '').trim();
      const timeSig = String(state.time_signature || '4/4');
      const selectedBar = Number(state.selected_bar ?? 0);
      state[voice + '_track'] = score.length > 0 ? `${score} |` : '|';
      state.active_steps = parseTrackToSteps(state[voice + '_track'], -1, timeSig, selectedBar);
      syncMusicState(state);
      if (typeof (ctx().app as any).render === 'function') {
        (ctx().app as any).render();
      }
    }
    return true;
  }

  if (trimmed.startsWith('music.duplicate_bar(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(20, -1);
    const barNum = Number(evaluateExpression(inner, buildScope(locals))) || 1;
    const state = (ctx().app as any)?.state;
    if (state) {
      const voice = String(state.active_voice || 'lead');
      const score = String(state[voice + '_track'] || '').trim();
      const timeSig = String(state.time_signature || '4/4');
      const selectedBar = Number(state.selected_bar ?? 0);
      const bars = score.split('|').map(b => b.trim());
      const barIdx = Math.max(0, Math.min(bars.length - 1, barNum - 1));
      if (bars[barIdx] !== undefined) {
        bars.push(bars[barIdx]);
        state[voice + '_track'] = bars.join(' | ');
        state.active_steps = parseTrackToSteps(state[voice + '_track'], -1, timeSig, selectedBar);
        syncMusicState(state);
        if (typeof (ctx().app as any).render === 'function') {
          (ctx().app as any).render();
        }
      }
    }
    return true;
  }

  if (trimmed.startsWith('music.delete_bar(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(17, -1);
    const barNum = Number(evaluateExpression(inner, buildScope(locals))) || 1;
    const state = (ctx().app as any)?.state;
    if (state) {
      const voice = String(state.active_voice || 'lead');
      const score = String(state[voice + '_track'] || '').trim();
      const timeSig = String(state.time_signature || '4/4');
      const selectedBar = Number(state.selected_bar ?? 0);
      const bars = score.split('|').map(b => b.trim());
      const barIdx = Math.max(0, Math.min(bars.length - 1, barNum - 1));
      if (bars.length > 1 && bars[barIdx] !== undefined) {
        bars.splice(barIdx, 1);
        state[voice + '_track'] = bars.join(' | ');
        state.active_steps = parseTrackToSteps(state[voice + '_track'], -1, timeSig, selectedBar);
        syncMusicState(state);
        if (typeof (ctx().app as any).render === 'function') {
          (ctx().app as any).render();
        }
      }
    }
    return true;
  }

  // Local storage statements: storage.set(key, val), storage.save(key, val), storage.remove(key), storage.clear()
  if (
    trimmed.startsWith('storage.set(') ||
    trimmed.startsWith('storage.save(') ||
    trimmed.startsWith('local_storage.set(') ||
    trimmed.startsWith('localStorage.set(')
  ) {
    const inner = trimmed.slice(trimmed.indexOf('(') + 1, -1);
    const parts = splitTopLevel(inner, ',');
    if (parts.length >= 2) {
      const key = String(evaluateExpression(parts[0], buildScope(locals)));
      const val = evaluateExpression(parts[1], buildScope(locals));
      const serialized = typeof val === 'string' ? val : JSON.stringify(val);
      setStorageItem(key, serialized);
    }
    return true;
  }

  if (trimmed.startsWith('storage.set ') || trimmed.startsWith('storage.save ')) {
    const rest = trimmed.slice(12).trim();
    const parts = splitTopLevel(rest, ',');
    if (parts.length >= 2) {
      const key = String(evaluateExpression(parts[0], buildScope(locals)));
      const val = evaluateExpression(parts[1], buildScope(locals));
      const serialized = typeof val === 'string' ? val : JSON.stringify(val);
      setStorageItem(key, serialized);
    }
    return true;
  }

  if (
    trimmed.startsWith('storage.remove(') ||
    trimmed.startsWith('storage.delete(') ||
    trimmed.startsWith('local_storage.remove(')
  ) {
    const inner = trimmed.slice(trimmed.indexOf('(') + 1, -1);
    const key = String(evaluateExpression(inner, buildScope(locals)));
    removeStorageItem(key);
    return true;
  }

  if (
    trimmed === 'storage.clear()' ||
    trimmed === 'storage.clear' ||
    trimmed === 'local_storage.clear()'
  ) {
    clearStorage();
    return true;
  }

  // File download helper: download(filename, content) or download filename, content
  if (trimmed.startsWith('download(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(9, -1);
    const parts = splitTopLevel(inner, ',');
    if (parts.length >= 2) {
      const filename = String(evaluateExpression(parts[0], buildScope(locals)));
      const content = String(evaluateExpression(parts[1], buildScope(locals)));
      downloadText(filename, content);
    }
    return true;
  }

  if (trimmed.startsWith('download ')) {
    const rest = trimmed.slice(9).trim();
    const parts = splitTopLevel(rest, ',');
    if (parts.length >= 2) {
      const filename = String(evaluateExpression(parts[0], buildScope(locals)));
      const content = String(evaluateExpression(parts[1], buildScope(locals)));
      downloadText(filename, content);
    }
    return true;
  }

  // Clipboard copy helper: clipboard.copy(text) or copy(text)
  if (
    (trimmed.startsWith('clipboard.copy(') || trimmed.startsWith('copy(')) &&
    trimmed.endsWith(')')
  ) {
    const inner = trimmed.slice(trimmed.indexOf('(') + 1, -1);
    const text = String(evaluateExpression(inner, buildScope(locals)));
    copyText(text);
    return true;
  }

  // Fullscreen helper: fullscreen.toggle(), fullscreen.enter(), fullscreen.exit(), fullscreen()
  if (
    trimmed === 'fullscreen.toggle()' ||
    trimmed === 'fullscreen.toggle' ||
    trimmed === 'fullscreen()' ||
    trimmed === 'fullscreen' ||
    trimmed === 'toggle_fullscreen()' ||
    trimmed === 'fullscreen.enter()' ||
    trimmed === 'fullscreen.exit()'
  ) {
    if (typeof document !== 'undefined') {
      const doc = document as any;
      const docEl = document.documentElement as any;
      const isFs = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement ||
        doc.body.getAttribute('data-fullscreen') === 'true' ||
        doc.body.classList.contains('fullscreen')
      );
      const shouldEnter = trimmed === 'fullscreen.enter()' ? true : trimmed === 'fullscreen.exit()' ? false : !isFs;
      if (shouldEnter) {
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          docEl.msRequestFullscreen();
        }
        doc.body.setAttribute('data-fullscreen', 'true');
        doc.body.classList.add('fullscreen');
      } else {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
        doc.body.removeAttribute('data-fullscreen');
        doc.body.classList.remove('fullscreen');
      }
      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        try {
          window.parent.postMessage({ type: 'toggle_fullscreen', is_fullscreen: shouldEnter }, '*');
        } catch (_) {}
      }
      const app = (ctx().app as any);
      if (typeof app?.state !== 'undefined') {
        app.state.is_fullscreen = shouldEnter;
        if (typeof app.render === 'function') {
          app.render();
        }
      }
    }
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

const PITCH_ROWS: Record<string, number> = {
  'C5': 0,
  'B4': 1,
  'A#4': 2, 'BB4': 2,
  'A4': 3,
  'G#4': 4, 'AB4': 4,
  'G4': 5,
  'F#4': 6, 'GB4': 6,
  'F4': 7,
  'E4': 8,
  'D#4': 9, 'EB4': 9,
  'D4': 10,
  'C#4': 11, 'DB4': 11,
  'C4': 12,
  'B3': 13,
  'A#3': 14, 'BB3': 14,
  'A3': 15,
  'G#3': 16, 'AB3': 16,
  'G3': 17,
  'F#3': 18, 'GB3': 18,
  'F3': 19,
  'E3': 20,
  'D#3': 21, 'EB3': 21,
  'D3': 22,
  'C#3': 23, 'DB3': 23,
  'C3': 24,
  'B2': 25,
  'A#2': 26, 'BB2': 26,
  'A2': 27,
  'G#2': 28, 'AB2': 28,
  'G2': 29,
  'F#2': 30, 'GB2': 30,
  'F2': 31,
  'E2': 32,
  'D2': 33,
  'C2': 34,
  'A1': 35,
  // Drums
  'hihat': 0,
  'snare': 1,
  'kick': 2,
};

function getPitchRow(pitch: string, isDrum: boolean): number {
  if (isDrum) {
    const p = pitch.toLowerCase();
    if (p.includes('hihat') || p.includes('crash')) return 0;
    if (p.includes('snare') || p.includes('tom')) return 1;
    return 2;
  }
  const clean = pitch.toUpperCase().trim();
  if (clean in PITCH_ROWS) return PITCH_ROWS[clean];

  const match = clean.match(/^([A-G][#B]?)([0-8])$/);
  if (match) {
    const oct = parseInt(match[2], 10);
    if (oct >= 5) return 0;
    if (oct === 4) return 8;
    if (oct === 3) return 15;
    if (oct <= 2) return 27;
  }
  return 12;
}

export function parseTrackToSteps(
  scoreStr: string,
  selectedIdx: number,
  timeSignature: string = '4/4',
  selectedBar: number = 0,
): Array<Record<string, unknown>> {
  if (!scoreStr) return [];
  const tokens = String(scoreStr).trim().split(/\s+/).filter(Boolean);
  const steps: Array<Record<string, unknown>> = [];

  // Time signature beats per bar: e.g. "4/4" -> 4 beats, "3/4" -> 3 beats
  const beatsPerBar = timeSignature.startsWith('3/') ? 3 : 4;
  let barNum = 1;
  let currentBeatInBar = 0;
  let totalBeatOffset = 0;
  let stepInBar = 1;

  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    if (raw === '|') {
      const totalLeft = Math.round(totalBeatOffset * 120);
      const barLeft = Math.round(currentBeatInBar * 120);
      steps.push({
        id: i,
        raw,
        note: '|',
        duration: '',
        len_label: 'BAR ' + barNum,
        beats: 0,
        is_bar: true,
        is_chord: false,
        is_rest: false,
        is_selected: i === selectedIdx,
        bar_num: barNum,
        step_num: stepInBar,
        pitch_class: 'step-bar',
        matrix_top: 0,
        matrix_left: selectedBar > 0 ? barLeft : totalLeft,
        matrix_total_left: totalLeft,
        matrix_bar_left: barLeft,
        matrix_width: 8,
        strip_width: 54,
        can_stretch: false,
        can_shorten: false,
      });
      barNum += 1;
      currentBeatInBar = 0;
      stepInBar = 1;
      continue;
    }

    let pitch = raw;
    let dur = ':8';
    let isChord = false;
    let chordNotes: string[] = [];

    if (raw.startsWith('[') && raw.includes(']')) {
      const closeIdx = raw.indexOf(']');
      pitch = raw.slice(1, closeIdx);
      const after = raw.slice(closeIdx + 1);
      dur = after.startsWith(':') ? after : ':8';
      isChord = true;
      chordNotes = pitch.split(/[,+]/).map(s => s.trim()).filter(Boolean);
    } else {
      const colonIdx = raw.indexOf(':');
      pitch = colonIdx !== -1 ? raw.slice(0, colonIdx) : raw;
      dur = colonIdx !== -1 ? raw.slice(colonIdx) : ':8';
      if (pitch.includes('+')) {
        isChord = true;
        chordNotes = pitch.split('+').map(s => s.trim()).filter(Boolean);
      }
    }

    const isRest = pitch === '-' || pitch.toLowerCase() === 'rest';
    let lenLabel = '1/8';
    let beats = 0.5;
    if (dur === ':16') { lenLabel = '1/16'; beats = 0.25; }
    else if (dur === ':8') { lenLabel = '1/8'; beats = 0.5; }
    else if (dur === ':4') { lenLabel = '1/4'; beats = 1.0; }
    else if (dur === ':2') { lenLabel = '1/2'; beats = 2.0; }
    else if (dur === ':1') { lenLabel = '1/1'; beats = beatsPerBar; }

    let pitchClass = 'step-note';
    if (isRest) pitchClass = 'step-rest';
    else if (isChord) pitchClass = 'step-chord';
    else if (pitch.includes('2') || pitch.includes('1')) pitchClass = 'step-bass';
    else if (pitch.includes('3')) pitchClass = 'step-mid-low';
    else if (pitch.includes('4')) pitchClass = 'step-mid';
    else if (pitch.includes('5')) pitchClass = 'step-high';
    else if (pitch === 'kick') pitchClass = 'step-kick';
    else if (pitch === 'snare') pitchClass = 'step-snare';
    else if (pitch === 'hihat') pitchClass = 'step-hihat';

    const rootPitch = isChord && chordNotes.length > 0 ? chordNotes[0] : pitch;
    const isDrumPitch = ['kick', 'snare', 'hihat', 'crash', 'tom'].includes(rootPitch.toLowerCase());
    const row = getPitchRow(rootPitch, isDrumPitch);
    const rowHeight = isDrumPitch ? 48 : 28;
    const matrixTop = row * rowHeight + 2;
    const totalLeft = Math.round(totalBeatOffset * 120);
    const barLeft = Math.round(currentBeatInBar * 120);
    const matrixLeft = selectedBar > 0 ? barLeft : totalLeft;
    const matrixWidth = Math.max(34, Math.round(beats * 120) - 4);
    const stripWidth = Math.max(54, Math.round(beats * 140));

    const displayNote = isRest ? 'REST' : isChord ? (pitch.startsWith('[') ? pitch : `[${pitch}]`) : pitch;

    steps.push({
      id: i,
      raw,
      note: displayNote,
      chord_notes: isChord ? chordNotes : [pitch],
      duration: dur,
      len_label: lenLabel,
      beats,
      is_bar: false,
      is_chord: isChord,
      is_rest: isRest,
      is_selected: i === selectedIdx,
      bar_num: barNum,
      step_num: stepInBar,
      pitch_class: pitchClass,
      pitch_row: row,
      matrix_top: matrixTop,
      matrix_left: matrixLeft,
      matrix_total_left: totalLeft,
      matrix_bar_left: barLeft,
      matrix_width: matrixWidth,
      strip_width: stripWidth,
      can_stretch: beats < 4.0,
      can_shorten: beats > 0.25,
    });

    totalBeatOffset += beats;
    currentBeatInBar += beats;
    stepInBar += 1;
    // Auto-advance bar if beat threshold is reached and track does not use manual |
    if (currentBeatInBar >= beatsPerBar && !tokens.includes('|')) {
      barNum += 1;
      currentBeatInBar = 0;
      stepInBar = 1;
    }
  }
  return steps;
}
