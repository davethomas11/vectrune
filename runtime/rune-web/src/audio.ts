// ============================================================================
// Retro Web Audio Synthesizer & 8-Bit Chiptune Sequencer
// Zero external assets, zero download overhead, pure Web Audio synthesis.
// ============================================================================

import type { SoundDefinition, MusicDefinition } from './types';
import { audioSync } from './audio_sync';

let audioCtx: AudioContext | null = null;
let stepIndex = 0;
let masterGain: GainNode | null = null;
let audioMuted = false;
let syncPageAudio = true;

/** Canvas hosts can use the synthesizer without touching their Rune-Web shell. */
export function configureAudioHost(options: { syncPage: boolean }): void {
  syncPageAudio = options.syncPage;
  audioSync.configure({ getAudioContext: () => getAudioContext(), syncPage: syncPageAudio });
}

/** Mute music and effects together while the game clock keeps advancing. */
export function setAudioMuted(muted: boolean): void {
  audioMuted = muted;
  if (masterGain && audioCtx) masterGain.gain.setValueAtTime(muted ? 0 : 1, audioCtx.currentTime);
}

function audioOutput(ctx: AudioContext): GainNode {
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(audioMuted ? 0 : 1, ctx.currentTime);
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

const registeredSounds: Record<string, SoundDefinition> = {};
const registeredMusic: Record<string, MusicDefinition> = {};

export function registerSounds(definitions?: Record<string, SoundDefinition>): void {
  if (!definitions) return;
  for (const [key, val] of Object.entries(definitions)) {
    registeredSounds[key.toLowerCase()] = val;
  }
}

export function registerMusic(definitions?: Record<string, MusicDefinition>): void {
  if (!definitions) return;
  for (const [key, val] of Object.entries(definitions)) {
    registeredMusic[key.toLowerCase()] = val;
  }
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => { /* A later user gesture can unlock audio. */ });
  }
  return audioCtx;
}

// ---------------------------------------------------------------------------
// Note / Pitch parsing: "C4" -> 261.63, "A4" -> 440, etc.
// ---------------------------------------------------------------------------

const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export function parseNoteToFreq(noteStr: string): number {
  const trimmed = noteStr.trim();
  const num = Number(trimmed);
  if (!isNaN(num) && num > 0) return num;

  const match = trimmed.toUpperCase().match(/^([A-G])([#B]?)([0-8])$/);
  if (!match) return 440;

  const [, letter, accidental, octaveStr] = match;
  let semitone = NOTE_OFFSETS[letter] || 0;
  if (accidental === '#') semitone += 1;
  else if (accidental === 'B') semitone -= 1;

  const octave = parseInt(octaveStr, 10);
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ---------------------------------------------------------------------------
// Sound Effect Playback
// ---------------------------------------------------------------------------

export function playSound(type: string, arg?: unknown): void {
  if (audioMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const soundName = String(type || '').trim().toLowerCase();

  // 1. Check custom user-defined sound from @Sound
  if (Object.prototype.hasOwnProperty.call(registeredSounds, soundName)) {
    playCustomSound(ctx, registeredSounds[soundName], now, arg);
    return;
  }

  // 2. Built-in retro presets fallback
  switch (soundName) {
    case 'laser':
    case 'pew':
    case 'fire': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.connect(gain);
      gain.connect(audioOutput(ctx));
      osc.start(now);
      osc.stop(now + 0.13);
      break;
    }

    case 'hit':
    case 'damage': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.09);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

      osc.connect(gain);
      gain.connect(audioOutput(ctx));
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    }

    case 'explosion':
    case 'boom': {
      playNoiseBurst(ctx, now, 0.35, 800, 60, 0.45);
      break;
    }

    case 'step':
    case 'move': {
      const steps = [110, 98, 87, 82];
      const freq = steps[stepIndex % steps.length];
      stepIndex += 1;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(audioOutput(ctx));
      osc.start(now);
      osc.stop(now + 0.09);
      break;
    }

    case 'coin':
    case 'powerup': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

      osc.connect(gain);
      gain.connect(audioOutput(ctx));
      osc.start(now);
      osc.stop(now + 0.29);
      break;
    }

    case 'gameover': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.linearRampToValueAtTime(293, now + 0.15);
      osc.frequency.linearRampToValueAtTime(261, now + 0.3);
      osc.frequency.linearRampToValueAtTime(196, now + 0.55);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

      osc.connect(gain);
      gain.connect(audioOutput(ctx));
      osc.start(now);
      osc.stop(now + 0.62);
      break;
    }

    case 'victory':
    case 'win': {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.25, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15);

        osc.connect(gain);
        gain.connect(audioOutput(ctx));
        osc.start(start);
        osc.stop(start + 0.16);
      });
      break;
    }

    case 'tone': {
      const freq = typeof arg === 'number' ? arg : 440;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

      osc.connect(gain);
      gain.connect(audioOutput(ctx));
      osc.start(now);
      osc.stop(now + 0.16);
      break;
    }

    default:
      break;
  }
}

function playNoiseBurst(
  ctx: AudioContext,
  now: number,
  duration: number,
  filterStart: number,
  filterEnd: number,
  volume: number,
  filterType: BiquadFilterType = 'lowpass',
): void {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(Math.max(20, filterStart), now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), now + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioOutput(ctx));
  noise.start(now);
  noise.stop(now + duration + 0.01);
}

function playCustomSound(
  ctx: AudioContext,
  def: SoundDefinition,
  now: number,
  arg?: unknown,
): void {
  const duration = def.duration || 0.12;
  const volume = def.volume !== undefined ? def.volume : 0.25;
  const wave = (def.wave || 'square').toLowerCase();

  // Noise waveform generator
  if (wave === 'noise') {
    const fStart = def.filter?.start_freq || 800;
    const fEnd = def.filter?.end_freq || 60;
    const fType = (def.filter?.filter_type as BiquadFilterType) || 'lowpass';
    playNoiseBurst(ctx, now, duration, fStart, fEnd, volume, fType);
    return;
  }

  // Sequence arpeggios: [[freq, duration], ...]
  if (def.sequence && def.sequence.length > 0) {
    let offset = 0;
    for (const [freq, noteDur] of def.sequence) {
      const start = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = (wave as OscillatorType) || 'square';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + noteDur);

      osc.connect(gain);
      gain.connect(audioOutput(ctx));
      osc.start(start);
      osc.stop(start + noteDur + 0.01);
      offset += noteDur;
    }
    return;
  }

  // Rotating pitch notes list: [freq1, freq2, ...]
  let startFreq = def.freq_start || 440;
  if (def.notes && def.notes.length > 0) {
    startFreq = def.notes[stepIndex % def.notes.length];
    stepIndex += 1;
  } else if (typeof arg === 'number') {
    startFreq = arg;
  }

  const endFreq = def.freq_end !== null && def.freq_end !== undefined ? def.freq_end : startFreq;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = (wave as OscillatorType) || 'square';

  osc.frequency.setValueAtTime(Math.max(1, startFreq), now);
  if (endFreq !== startFreq) {
    if (def.curve === 'linear') {
      osc.frequency.linearRampToValueAtTime(Math.max(1, endFreq), now + duration);
    } else {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
    }
  }

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(audioOutput(ctx));
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

// ============================================================================
// 8-Bit Chiptune Background Music Sequencer
// ============================================================================

export interface ParsedNoteEvent {
  stepId: number;
  pitch: string | number;
  pitches?: Array<string | number>;
  beats: number;
  isRest: boolean;
  isDrum: boolean;
}

export interface TrackPlaybackState {
  events: ParsedNoteEvent[];
  index: number;
  nextBeat: number;
  instrument?: string;
  volume?: number;
  pan?: number;
  muted?: boolean;
}

let activeMusicTrackName: string | null = null;
let musicSchedulerTimer: any = null;
let musicMasterGain: GainNode | null = null;
let musicVolume = 0.2;
let musicTempoBpm = 128;
let musicLoop = true;
let isMusicPaused = false;
let musicStartTime = 0;
let musicPauseTime = 0;
let musicPausedElapsed = 0;
let nextScheduleTime = 0;
let tracksState: Record<string, TrackPlaybackState> = {};

export function parseTrackPattern(patternStr: string): ParsedNoteEvent[] {
  const events: ParsedNoteEvent[] = [];
  // Strip inline comments (\s+#... or ^#...) without breaking sharp notes like D#4 or C#5
  const clean = patternStr.replace(/^\s*#.*$/gm, '').replace(/\s+#.*$/gm, '');
  const tokens = clean.split(/\s+/).filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '|') {
      // Bar marker: preserves token indexing alignment with parseTrackToSteps
      continue;
    }

    let noteToken = token;
    let durationNum = 8; // Default 8th note

    // Check if bracketed chord with duration, e.g. [C4,E4,G4]:4 or [C4,E4]:8
    if (token.startsWith('[') && token.includes(']')) {
      const closeIdx = token.indexOf(']');
      noteToken = token.slice(1, closeIdx);
      const after = token.slice(closeIdx + 1);
      if (after.startsWith(':')) {
        durationNum = Number(after.slice(1)) || 8;
      }
    } else {
      const parts = token.split(':');
      noteToken = parts[0].trim();
      durationNum = parts.length > 1 ? Number(parts[1].trim()) : 8;
    }

    // In 4/4 time: :4 is 1 beat, :8 is 0.5 beat, :16 is 0.25 beat, :2 is 2 beats, :1 is 4 beats
    const beats = durationNum > 0 ? 4 / durationNum : 0.5;

    if (noteToken === '-' || noteToken.toUpperCase() === 'R' || noteToken === '_') {
      events.push({ stepId: i, pitch: 0, beats, isRest: true, isDrum: false });
      continue;
    }

    // Split chord by comma or plus: e.g. "C4,E4,G4" or "C4+E4+G4"
    const subNotes = noteToken.split(/[,+]/).map(s => s.trim()).filter(Boolean);
    const drumNames = ['kick', 'snare', 'hihat', 'crash', 'tom'];

    if (subNotes.length > 1) {
      const isAnyDrum = subNotes.some(s => drumNames.includes(s.toLowerCase()));
      const pitches: Array<string | number> = subNotes.map(s => {
        if (drumNames.includes(s.toLowerCase())) return s.toLowerCase();
        return parseNoteToFreq(s);
      });
      events.push({
        stepId: i,
        pitch: pitches[0],
        pitches,
        beats,
        isRest: false,
        isDrum: isAnyDrum,
      });
    } else {
      const s = subNotes[0] || noteToken;
      if (drumNames.includes(s.toLowerCase())) {
        events.push({ stepId: i, pitch: s.toLowerCase(), beats, isRest: false, isDrum: true });
      } else {
        events.push({ stepId: i, pitch: parseNoteToFreq(s), beats, isRest: false, isDrum: false });
      }
    }
  }

  return events;
}

export function playMusic(trackName: string): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const key = String(trackName || '').trim().toLowerCase();
  const def = registeredMusic[key];
  if (!def) {
    return;
  }

  stopMusic();

  activeMusicTrackName = key;
  musicTempoBpm = def.tempo || 128;
  musicLoop = def.loop_track !== false;
  musicVolume = def.volume !== undefined ? def.volume : 0.2;
  isMusicPaused = false;

  musicMasterGain = ctx.createGain();
  musicMasterGain.gain.setValueAtTime(musicVolume, ctx.currentTime);
  musicMasterGain.connect(audioOutput(ctx));

  tracksState = {};
  if (def.lead) {
    tracksState.lead = { events: parseTrackPattern(def.lead), index: 0, nextBeat: 0, instrument: 'square' };
  }
  if (def.bass) {
    tracksState.bass = { events: parseTrackPattern(def.bass), index: 0, nextBeat: 0, instrument: 'triangle' };
  }
  if (def.drums) {
    tracksState.drums = { events: parseTrackPattern(def.drums), index: 0, nextBeat: 0, instrument: 'drums' };
  }

  // Register any dynamic tracks
  if (def.tracks) {
    for (const [tName, tVal] of Object.entries(def.tracks)) {
      if (!tVal) continue;
      if (typeof tVal === 'string') {
        tracksState[tName] = {
          events: parseTrackPattern(tVal),
          index: 0,
          nextBeat: 0,
          instrument: 'sawtooth',
        };
      } else if (typeof tVal === 'object' && tVal.notes) {
        tracksState[tName] = {
          events: parseTrackPattern(tVal.notes),
          index: 0,
          nextBeat: 0,
          instrument: tVal.instrument || 'sawtooth',
          volume: tVal.volume,
          pan: tVal.pan,
          muted: tVal.muted,
        };
      }
    }
  }

  const beatsPerBar = def.time_signature?.startsWith('3/') ? 3 : 4;
  let maxTrackBeats = 0;
  for (const track of Object.values(tracksState)) {
    if (track && track.events && track.events.length > 0) {
      const trackBeats = track.events.reduce((sum, e) => sum + (e.beats || 0), 0);
      if (trackBeats > maxTrackBeats) maxTrackBeats = trackBeats;
    }
  }

  const appStateBars = syncPageAudio ? Number((window as any)?.__RuneWeb?.ctx?.()?.app?.state?.bars) : 0;
  const totalBars = appStateBars > 0 ? appStateBars : (def.bars || (maxTrackBeats > 0 ? Math.ceil(maxTrackBeats / beatsPerBar) : 4));
  const totalBeats = Math.max(maxTrackBeats, totalBars * beatsPerBar);

  musicStartTime = ctx.currentTime + 0.05;
  nextScheduleTime = musicStartTime;
  musicPauseTime = 0;
  musicPausedElapsed = 0;

  audioSync.configure({ getAudioContext: () => getAudioContext(), syncPage: syncPageAudio });
  audioSync.onPlay({
    track: key,
    tempo: musicTempoBpm,
    timeSignature: def.time_signature || '4/4',
    totalBars,
    totalBeats,
    startTime: musicStartTime,
  });

  scheduleMusicTicks();
  musicSchedulerTimer = setInterval(scheduleMusicTicks, 25);
}

export function startPlaybackAnimation(): void {
  // Visual animation handled by AudioSyncEngine
}

export function stopPlaybackAnimation(_keepParked = false): void {
  audioSync.onStop();
}

export function stopMusic(): void {
  audioSync.onStop();
  if (musicSchedulerTimer) {
    clearInterval(musicSchedulerTimer);
    musicSchedulerTimer = null;
  }
  activeMusicTrackName = null;
  musicPauseTime = 0;
  musicPausedElapsed = 0;
  isMusicPaused = false;
  tracksState = {};
  if (musicMasterGain) {
    try {
      musicMasterGain.disconnect();
    } catch {
      // Ignore
    }
    musicMasterGain = null;
  }
}

export function pauseMusic(): void {
  const ctx = getAudioContext();
  if (!ctx || isMusicPaused || !activeMusicTrackName) return;
  isMusicPaused = true;
  if (musicSchedulerTimer) { clearInterval(musicSchedulerTimer); musicSchedulerTimer = null; }
  musicPauseTime = ctx.currentTime;
  musicPausedElapsed = Math.max(0, musicPauseTime - musicStartTime);
  if (musicMasterGain) {
    try {
      musicMasterGain.gain.setValueAtTime(0, ctx.currentTime);
    } catch (_) {}
  }
  audioSync.onPause();
}

export function resumeMusic(): void {
  const ctx = getAudioContext();
  if (!ctx || !isMusicPaused || !activeMusicTrackName) return;

  const pausedDuration = ctx.currentTime - musicPauseTime;
  musicStartTime += pausedDuration;

  const secondsPerBeat = 60 / musicTempoBpm;
  const currentBeat = musicPausedElapsed / secondsPerBeat;

  for (const track of Object.values(tracksState)) {
    if (!track || !track.events.length) continue;
    let accum = 0;
    track.index = 0;
    track.nextBeat = 0;
    for (let i = 0; i < track.events.length; i++) {
      const ev = track.events[i];
      if (accum + ev.beats > currentBeat) {
        track.index = i;
        track.nextBeat = accum;
        break;
      }
      accum += ev.beats;
    }
  }

  if (musicMasterGain) {
    try {
      musicMasterGain.gain.setValueAtTime(musicVolume, ctx.currentTime);
    } catch (_) {}
  }

  isMusicPaused = false;

  const def = registeredMusic[activeMusicTrackName];
  const beatsPerBar = def?.time_signature?.startsWith('3/') ? 3 : 4;
  let maxTrackBeats = 0;
  for (const track of Object.values(tracksState)) {
    if (track && track.events && track.events.length > 0) {
      const trackBeats = track.events.reduce((sum, e) => sum + (e.beats || 0), 0);
      if (trackBeats > maxTrackBeats) maxTrackBeats = trackBeats;
    }
  }
  const appStateBars = syncPageAudio ? Number((window as any)?.__RuneWeb?.ctx?.()?.app?.state?.bars) : 0;
  const totalBars = appStateBars > 0 ? appStateBars : (def?.bars || (maxTrackBeats > 0 ? Math.ceil(maxTrackBeats / beatsPerBar) : 4));
  const totalBeats = Math.max(maxTrackBeats, totalBars * beatsPerBar);

  audioSync.onPlay({
    track: activeMusicTrackName,
    tempo: musicTempoBpm,
    timeSignature: def?.time_signature || '4/4',
    totalBars,
    totalBeats,
    startTime: musicStartTime,
  });
  scheduleMusicTicks();
  musicSchedulerTimer = setInterval(scheduleMusicTicks, 25);
}

export function setMusicTempo(bpm: number): void {
  if (bpm > 20 && bpm < 400) {
    musicTempoBpm = bpm;
  }
}

export function setMusicVolume(vol: number): void {
  musicVolume = Math.max(0, Math.min(1, vol));
  if (musicMasterGain && audioCtx) {
    musicMasterGain.gain.setValueAtTime(musicVolume, audioCtx.currentTime);
  }
}

export function setTrackInstrument(channel: string, instrument: string): void {
  if (tracksState[channel]) {
    tracksState[channel].instrument = instrument;
  }
}

export function setTrackMute(channel: string, muted: boolean): void {
  if (tracksState[channel]) {
    tracksState[channel].muted = muted;
  }
}

function scheduleMusicTicks(): void {
  const ctx = getAudioContext();
  if (!ctx || !musicMasterGain || isMusicPaused || !activeMusicTrackName) return;

  const secondsPerBeat = 60 / musicTempoBpm;
  const lookaheadWindow = ctx.currentTime + 0.25;

  const def = registeredMusic[activeMusicTrackName];
  const beatsPerBar = def?.time_signature?.startsWith('3/') ? 3 : 4;
  let maxTrackBeats = 0;
  for (const t of Object.values(tracksState)) {
    if (t && t.events && t.events.length > 0) {
      const tb = t.events.reduce((sum, e) => sum + (e.beats || 0), 0);
      if (tb > maxTrackBeats) maxTrackBeats = tb;
    }
  }
  const appStateBars = syncPageAudio ? Number((window as any)?.__RuneWeb?.ctx?.()?.app?.state?.bars) : 0;
  const totalBars = appStateBars > 0 ? appStateBars : (def?.bars || (maxTrackBeats > 0 ? Math.ceil(maxTrackBeats / beatsPerBar) : 4));
  const songTotalBeats = Math.max(maxTrackBeats, totalBars * beatsPerBar);

  let allFinished = true;

  for (const [trackKey, track] of Object.entries(tracksState)) {
    if (!track || !track.events.length || track.muted) continue;

    while (musicStartTime + track.nextBeat * secondsPerBeat < lookaheadWindow) {
      if (track.index >= track.events.length) {
        if (musicLoop) {
          if (songTotalBeats > 0) {
            const currentIteration = Math.floor((track.nextBeat - 0.0001) / songTotalBeats);
            track.nextBeat = (currentIteration + 1) * songTotalBeats;
          }
          track.index = 0;
        } else {
          break;
        }
      }

      const event = track.events[track.index];
      const eventTime = musicStartTime + track.nextBeat * secondsPerBeat;
      const eventDurationSec = event.beats * secondsPerBeat;

      if (!event.isRest && eventTime >= ctx.currentTime - 0.05) {
        scheduleTrackNote(ctx, trackKey, event, eventTime, eventDurationSec, musicMasterGain, track.instrument);
      }

      track.nextBeat += event.beats;
      track.index += 1;
    }

    if (track.index < track.events.length || musicLoop) {
      allFinished = false;
    }
  }

  if (allFinished && !musicLoop) {
    stopMusic();
  }
}

function scheduleTrackNote(
  ctx: AudioContext,
  channel: string,
  event: ParsedNoteEvent,
  time: number,
  durationSec: number,
  destination: GainNode,
  instrumentOverride?: string,
): void {
  // Enqueue precise Web Audio hardware timestamp for sample-accurate visual sync
  audioSync.enqueueNote({
    channel,
    stepId: event.stepId ?? -1,
    pitch: event.pitch,
    startTime: time,
    endTime: time + durationSec,
    beat: 0,
    bar: 1,
  });

  const isDrumChannel = channel === 'drums' || instrumentOverride === 'drums' || event.isDrum;

  // Single pitch or array of chord pitches
  const pitchesToPlay: Array<string | number> = event.pitches && event.pitches.length > 0
    ? event.pitches
    : [event.pitch];

  // Headroom scaling for polyphonic chords
  const chordGainMultiplier = 1 / Math.sqrt(Math.max(1, pitchesToPlay.length));

  for (const p of pitchesToPlay) {
    if (isDrumChannel || typeof p === 'string') {
      const drumType = String(p).toLowerCase();
      if (drumType === 'kick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(130, time);
        osc.frequency.exponentialRampToValueAtTime(32, time + Math.min(durationSec, 0.08));

        gain.gain.setValueAtTime(0.4 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + Math.min(durationSec, 0.08));

        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + Math.min(durationSec, 0.09));
      } else if (drumType === 'snare') {
        playNoiseBurstToDestination(ctx, time, Math.min(durationSec, 0.09), 1600, 300, 0.3 * chordGainMultiplier, destination, 'bandpass');
      } else if (drumType === 'hihat') {
        playNoiseBurstToDestination(ctx, time, Math.min(durationSec, 0.04), 7000, 5000, 0.15 * chordGainMultiplier, destination, 'highpass');
      } else if (drumType === 'crash') {
        playNoiseBurstToDestination(ctx, time, Math.min(durationSec, 0.25), 5000, 1000, 0.2 * chordGainMultiplier, destination, 'bandpass');
      } else if (drumType === 'tom') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, time);
        osc.frequency.exponentialRampToValueAtTime(70, time + Math.min(durationSec, 0.12));
        gain.gain.setValueAtTime(0.35 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + Math.min(durationSec, 0.12));
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + Math.min(durationSec, 0.13));
      }
      continue;
    }

    const freq = typeof p === 'number' ? p : parseNoteToFreq(p);
    if (freq <= 0) continue;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const inst = instrumentOverride || (channel === 'bass' ? 'triangle' : 'square');

    if (inst === 'sawtooth' || inst === 'synth') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      const noteSoundLen = Math.min(durationSec * 0.88, 0.4);
      gain.gain.setValueAtTime(0.18 * chordGainMultiplier, time);
      gain.gain.exponentialRampToValueAtTime(0.005, time + noteSoundLen);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(time);
      osc.stop(time + noteSoundLen + 0.01);
    } else if (inst === 'triangle' || inst === 'bass') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      const noteSoundLen = Math.min(durationSec * 0.9, 0.45);
      gain.gain.setValueAtTime(0.28 * chordGainMultiplier, time);
      gain.gain.exponentialRampToValueAtTime(0.005, time + noteSoundLen);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(time);
      osc.stop(time + noteSoundLen + 0.01);
    } else if (inst === 'sine') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      const noteSoundLen = Math.min(durationSec * 0.9, 0.5);
      gain.gain.setValueAtTime(0.25 * chordGainMultiplier, time);
      gain.gain.exponentialRampToValueAtTime(0.002, time + noteSoundLen);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(time);
      osc.stop(time + noteSoundLen + 0.01);
    } else if (inst === 'pluck') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      const noteSoundLen = Math.min(durationSec * 0.6, 0.15);
      gain.gain.setValueAtTime(0.3 * chordGainMultiplier, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + noteSoundLen);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(time);
      osc.stop(time + noteSoundLen + 0.01);
    } else {
      // Default: 8-bit pulse / square lead
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, time);
      const noteSoundLen = Math.min(durationSec * 0.85, 0.35);
      gain.gain.setValueAtTime(0.2 * chordGainMultiplier, time);
      gain.gain.exponentialRampToValueAtTime(0.005, time + noteSoundLen);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(time);
      osc.stop(time + noteSoundLen + 0.01);
    }
  }
}

function playNoiseBurstToDestination(
  ctx: AudioContext,
  now: number,
  duration: number,
  filterStart: number,
  filterEnd: number,
  volume: number,
  destination: GainNode,
  filterType: BiquadFilterType = 'lowpass',
): void {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(Math.max(20, filterStart), now);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), now + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  noise.start(now);
  noise.stop(now + duration + 0.01);
}
