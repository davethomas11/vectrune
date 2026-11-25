// ============================================================================
// Retro Web Audio Synthesizer & 8-Bit Chiptune Sequencer
// Zero external assets, zero download overhead, pure Web Audio synthesis.
// ============================================================================

import type { SoundDefinition, MusicDefinition } from './types';
import { audioSync } from './audio_sync';
import { MusicClock } from './music_clock';
import { compileMusicArrangement, type MusicArrangement } from './music_arrangement';

let audioCtx: AudioContext | null = null;
let stepIndex = 0;
let masterGain: GainNode | null = null;
let audioMuted = false;
let syncPageAudio = true;
let playbackUnlocked = true;
let pendingMusic: { track: string; beat: number } | null = null;

/** Canvas hosts can use the synthesizer without touching their Rune-Web shell. */
export function configureAudioHost(options: { syncPage: boolean; deferPlayback?: boolean }): void {
  syncPageAudio = options.syncPage;
  playbackUnlocked = !options.deferPlayback;
  pendingMusic = null;
  audioSync.configure({ getAudioContext: () => audioCtx, syncPage: syncPageAudio });
}

/** Called only by a browser user gesture; native hosts start unlocked. */
export function unlockAudio(): AudioContext | null {
  playbackUnlocked = true;
  const context = getAudioContext();
  const track = pendingMusic; pendingMusic = null;
  if (track) playMusic(track.track, track.beat);
  return context;
}

/** Mute music and effects together while the game clock keeps advancing. */
export function setAudioMuted(muted: boolean): void {
  audioMuted = muted;
  if (masterGain && audioCtx) masterGain.gain.setValueAtTime(muted ? 0 : 1, audioCtx.currentTime);
}

let sfxMasterGain: GainNode | null = null;
function sfxOutput(ctx: AudioContext): GainNode {
  if (!sfxMasterGain) {
    sfxMasterGain = ctx.createGain();
    sfxMasterGain.gain.setValueAtTime(0.65, ctx.currentTime);
    sfxMasterGain.connect(audioOutput(ctx));
  }
  return sfxMasterGain;
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
const arrangements = new Map<string, MusicArrangement>();

export function registerSounds(definitions?: Record<string, SoundDefinition>): void {
  if (!definitions) return;
  for (const [key, val] of Object.entries(definitions)) {
    registeredSounds[key.toLowerCase()] = val;
  }
}

export function registerMusic(definitions?: Record<string, MusicDefinition>): void {
  if (!definitions) return;
  for (const [key, val] of Object.entries(definitions)) {
    const name = key.toLowerCase();
    const arrangement = compileMusicArrangement(val, parseTrackPattern);
    if (arrangement) arrangements.set(name, arrangement);
    else arrangements.delete(name);
    registeredMusic[name] = arrangement ? { ...val, bars: arrangement.bars } : val;
  }
}

export function getAudioContext(): AudioContext | null {
  if (!playbackUnlocked || typeof window === 'undefined') return null;
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
      gain.connect(sfxOutput(ctx));
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
      gain.connect(sfxOutput(ctx));
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
      gain.connect(sfxOutput(ctx));
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
      gain.connect(sfxOutput(ctx));
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
      gain.connect(sfxOutput(ctx));
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
        gain.connect(sfxOutput(ctx));
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
      gain.connect(sfxOutput(ctx));
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
  attack = 0,
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
  sweepEnvelope(gain.gain, now, duration, volume, attack);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(sfxOutput(ctx));
  noise.start(now);
  noise.stop(now + duration + 0.01);
}

function sweepEnvelope(gain: AudioParam, now: number, duration: number, volume: number, attack: number): void {
  if (attack > 0 && duration > 0 && volume > 0) {
    gain.setValueAtTime(0, now);
    gain.linearRampToValueAtTime(volume, now + Math.min(attack, duration * 0.98));
  } else {
    gain.setValueAtTime(volume, now);
  }
  gain.exponentialRampToValueAtTime(0.001, now + duration);
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
    playNoiseBurst(ctx, now, duration, fStart, fEnd, volume, fType, def.attack);
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
      gain.connect(sfxOutput(ctx));
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

  sweepEnvelope(gain.gain, now, duration, volume, def.attack ?? 0);

  osc.connect(gain);
  gain.connect(sfxOutput(ctx));
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
  elapsedInNote?: number;
  instrument?: string;
  volume?: number;
  pan?: number;
  muted?: boolean;
}

interface MusicEffectsBus {
  masterInput: GainNode;
  channelGains: Record<string, GainNode>;
  lfoNodes: OscillatorNode[];
  cleanup: () => void;
}

let activeMusicTrackName: string | null = null;
let musicSchedulerTimer: any = null;
let musicMasterGain: GainNode | null = null;
let musicEffectsBus: MusicEffectsBus | null = null;
let clearFadingMusic: (() => void) | undefined;
let musicVolume = 0.2;
let musicTempoBpm = 128;
let musicLoop = true;
let isMusicPaused = false;
const MUSIC_LOOKAHEAD = 0.25;
let musicClock: MusicClock | null = null;
let musicPausedBeat = 0;
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

export function playMusic(trackName: string, startBeat = 0, fadeSeconds = 0): void {
  if (!playbackUnlocked) { pendingMusic = { track: trackName, beat: startBeat }; return; }
  const ctx = getAudioContext();
  if (!ctx) return;

  const key = String(trackName || '').trim().toLowerCase();
  const def = registeredMusic[key];
  if (!def) {
    return;
  }

  const fade = Number.isFinite(fadeSeconds) ? Math.min(5, Math.max(0, fadeSeconds)) : 0;
  const outgoing = fade > 0 && musicMasterGain ? { gain: musicMasterGain, effects: musicEffectsBus } : null;
  if (outgoing) {
    // The scheduler will stop with the old track. Keep its submitted voices
    // and effects connected long enough to carry the tail across the handoff.
    musicMasterGain = null;
    musicEffectsBus = null;
  }
  stopMusic();

  activeMusicTrackName = key;
  musicTempoBpm = def.tempo || 128;
  musicLoop = def.loop_track !== false;
  musicVolume = def.volume !== undefined ? def.volume : 0.2;
  isMusicPaused = false;

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

  const arrangement = arrangements.get(key);
  if (arrangement) {
    tracksState = Object.create(null);
    for (const [channel, events] of Object.entries(arrangement.tracks)) {
      tracksState[channel] = { events, index: 0, nextBeat: 0,
        instrument: channel === 'drums' ? 'drums' : channel === 'bass' ? 'triangle' : 'square' };
    }
  }
  for (const [channel, instrument] of Object.entries(def.instruments ?? {})) {
    if (Object.prototype.hasOwnProperty.call(tracksState, channel)) tracksState[channel].instrument = instrument;
  }

  const startTime = ctx.currentTime + 0.05;
  startMusicAtBeat(ctx, key, startBeat, startTime, outgoing ? fade : 0);
  if (outgoing) fadeOutMusic(ctx, outgoing, startTime, fade);
}

function musicTiming(track: string) {
  const def = registeredMusic[track];
  const timeSignature = def?.time_signature || '4/4';
  const beatsPerBar = timeSignature.startsWith('3/') ? 3 : 4;
  const maxTrackBeats = Math.max(0, ...Object.values(tracksState).map(state =>
    state.events.reduce((sum, event) => sum + event.beats, 0),
  ));
  const appBars = syncPageAudio ? Number((window as any)?.__RuneWeb?.ctx?.()?.app?.state?.bars) : 0;
  const totalBars = appBars > 0 ? appBars : (def?.bars || (maxTrackBeats ? Math.ceil(maxTrackBeats / beatsPerBar) : 4));
  return { timeSignature, totalBars, totalBeats: Math.max(maxTrackBeats, totalBars * beatsPerBar) };
}

function generateReverbImpulse(ctx: AudioContext, decay = 1.5, preDelay = 0.01, reverse = false): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const length = Math.max(128, Math.floor(sampleRate * Math.max(0.05, Math.min(10, decay))));
  const buffer = ctx.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const preDelaySamples = Math.floor(sampleRate * Math.max(0, preDelay));

  for (let i = 0; i < length; i++) {
    if (i < preDelaySamples) {
      left[i] = 0;
      right[i] = 0;
    } else {
      const idx = reverse ? length - 1 - i : i - preDelaySamples;
      const progress = idx / (length - preDelaySamples);
      const env = Math.exp(-3.5 * progress);
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }
  }
  return buffer;
}

function generateBitcrushCurve(bits = 8, drive = 0): Float32Array {
  const n = 4096;
  const curve = new Float32Array(n);
  const clampedBits = Math.max(2, Math.min(16, bits));
  const steps = Math.pow(2, clampedBits);
  const driveGain = 1 + Math.max(0, Math.min(5, drive * 4));

  for (let i = 0; i < n; i++) {
    let x = (i * 2) / (n - 1) - 1;
    if (drive > 0) {
      x = Math.tanh(x * driveGain);
    }
    if (clampedBits < 16) {
      x = Math.round(x * (steps / 2)) / (steps / 2);
    }
    curve[i] = Math.max(-1, Math.min(1, x));
  }
  return curve;
}

function buildMusicEffectsBus(
  ctx: AudioContext,
  def: MusicDefinition,
  channels: string[],
  destination: GainNode,
): MusicEffectsBus | null {
  const fx = def.effects || {};
  const reverbConfig = fx.reverb || def.reverb;
  const delayConfig = fx.delay || def.delay;
  const filterConfig = fx.filter || def.filter;
  const crushConfig = fx.crush || fx.drive || def.crush;
  const chorusConfig = fx.chorus || def.chorus;
  const trackFx = def.track_effects || fx.tracks || {};

  if (!reverbConfig && !delayConfig && !filterConfig && !crushConfig && !chorusConfig && !Object.keys(trackFx).length) {
    return null;
  }

  const nodesToClean: (AudioNode | { disconnect: () => void })[] = [];
  const lfoNodes: OscillatorNode[] = [];

  const dryBus = ctx.createGain();
  dryBus.gain.setValueAtTime(1.0, ctx.currentTime);
  nodesToClean.push(dryBus);

  let insertHead: AudioNode = dryBus;
  if (filterConfig && typeof ctx.createBiquadFilter === 'function') {
    const fNode = ctx.createBiquadFilter();
    fNode.type = (filterConfig.type as BiquadFilterType) || 'lowpass';
    const cutoff = filterConfig.cutoff || filterConfig.frequency || 4000;
    fNode.frequency.setValueAtTime(Math.max(20, Math.min(20000, cutoff)), ctx.currentTime);
    const q = filterConfig.q || filterConfig.resonance || 1.0;
    fNode.Q.setValueAtTime(Math.max(0.1, q), ctx.currentTime);
    insertHead.connect(fNode);
    insertHead = fNode;
    nodesToClean.push(fNode);
  }

  if (crushConfig && typeof (ctx as any).createWaveShaper === 'function') {
    const wsNode = (ctx as any).createWaveShaper();
    const bits = crushConfig.bits !== undefined ? crushConfig.bits : 8;
    const drive = crushConfig.drive !== undefined ? crushConfig.drive : 0;
    wsNode.curve = generateBitcrushCurve(bits, drive);
    wsNode.oversample = 'none';
    insertHead.connect(wsNode);
    insertHead = wsNode;
    nodesToClean.push(wsNode);
  }
  insertHead.connect(destination);

  let delayInput: GainNode | null = null;
  if (delayConfig && typeof (ctx as any).createDelay === 'function') {
    delayInput = ctx.createGain();
    delayInput.gain.setValueAtTime(1.0, ctx.currentTime);
    nodesToClean.push(delayInput);

    const dNode = (ctx as any).createDelay(5.0);
    const dTime = Math.max(0.01, Math.min(4.0, delayConfig.time ?? 0.25));
    dNode.delayTime.setValueAtTime(dTime, ctx.currentTime);

    const dampFilter = ctx.createBiquadFilter();
    dampFilter.type = 'lowpass';
    const dampFreq = delayConfig.damping || delayConfig.filter || 2800;
    dampFilter.frequency.setValueAtTime(dampFreq, ctx.currentTime);

    const fbGain = ctx.createGain();
    const fbVal = Math.max(0, Math.min(0.92, delayConfig.feedback ?? 0.35));
    fbGain.gain.setValueAtTime(fbVal, ctx.currentTime);

    const delayWet = ctx.createGain();
    const dWetVal = Math.max(0, Math.min(1.0, delayConfig.wet ?? 0.25));
    delayWet.gain.setValueAtTime(dWetVal, ctx.currentTime);

    delayInput.connect(dNode);
    dNode.connect(dampFilter);
    dampFilter.connect(fbGain);
    fbGain.connect(dNode);
    dampFilter.connect(delayWet);
    delayWet.connect(destination);

    nodesToClean.push(dNode, dampFilter, fbGain, delayWet);
  }

  let revInput: GainNode | null = null;
  if (reverbConfig && typeof (ctx as any).createConvolver === 'function') {
    revInput = ctx.createGain();
    revInput.gain.setValueAtTime(1.0, ctx.currentTime);
    nodesToClean.push(revInput);

    const conv = (ctx as any).createConvolver();
    conv.buffer = generateReverbImpulse(
      ctx,
      reverbConfig.decay ?? 1.5,
      reverbConfig.pre_delay ?? 0.01,
      reverbConfig.reverse ?? false,
    );
    revInput.connect(conv);
    nodesToClean.push(conv);

    let revOut: AudioNode = conv;
    if (reverbConfig.filter) {
      const rf = ctx.createBiquadFilter();
      rf.type = 'lowpass';
      rf.frequency.setValueAtTime(reverbConfig.filter, ctx.currentTime);
      conv.connect(rf);
      revOut = rf;
      nodesToClean.push(rf);
    }

    const revWet = ctx.createGain();
    const wetVal = Math.max(0, Math.min(1.0, reverbConfig.wet ?? 0.25));
    revWet.gain.setValueAtTime(wetVal, ctx.currentTime);
    revOut.connect(revWet);
    revWet.connect(destination);
    nodesToClean.push(revWet);
  }

  let chorusInput: GainNode | null = null;
  if (chorusConfig && typeof (ctx as any).createDelay === 'function' && typeof ctx.createOscillator === 'function') {
    chorusInput = ctx.createGain();
    chorusInput.gain.setValueAtTime(1.0, ctx.currentTime);
    nodesToClean.push(chorusInput);

    const cd = (ctx as any).createDelay(0.1);
    const baseDelay = chorusConfig.delay ?? 0.018;
    cd.delayTime.setValueAtTime(baseDelay, ctx.currentTime);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    const rate = chorusConfig.rate ?? 1.2;
    lfo.frequency.setValueAtTime(rate, ctx.currentTime);

    const lfoGain = ctx.createGain();
    const depth = chorusConfig.depth ?? 0.0025;
    lfoGain.gain.setValueAtTime(depth, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(cd.delayTime);
    lfo.start(ctx.currentTime);
    lfoNodes.push(lfo);

    const chorusWet = ctx.createGain();
    const cWetVal = Math.max(0, Math.min(1.0, chorusConfig.wet ?? 0.3));
    chorusWet.gain.setValueAtTime(cWetVal, ctx.currentTime);

    chorusInput.connect(cd);
    cd.connect(chorusWet);
    chorusWet.connect(destination);
    nodesToClean.push(cd, lfoGain, chorusWet);
  }

  const masterInput = ctx.createGain();
  masterInput.gain.setValueAtTime(1.0, ctx.currentTime);
  masterInput.connect(dryBus);
  nodesToClean.push(masterInput);

  const channelGains: Record<string, GainNode> = {};
  for (const ch of channels) {
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(1.0, ctx.currentTime);
    cg.connect(dryBus);
    nodesToClean.push(cg);

    const chFx = trackFx[ch] || {};

    if (delayInput) {
      let dSend = 0;
      if (chFx.delay !== undefined) {
        dSend = chFx.delay;
      } else if (delayConfig?.tracks) {
        dSend = delayConfig.tracks.includes(ch) ? 1.0 : 0;
      } else {
        dSend = (ch === 'drums' || ch === 'bass') ? 0 : 1.0;
      }
      if (dSend > 0) {
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(dSend, ctx.currentTime);
        cg.connect(sg);
        sg.connect(delayInput);
        nodesToClean.push(sg);
      }
    }

    if (revInput) {
      let rSend = 0;
      if (chFx.reverb !== undefined) {
        rSend = chFx.reverb;
      } else if (reverbConfig?.tracks) {
        rSend = reverbConfig.tracks.includes(ch) ? 1.0 : 0;
      } else {
        rSend = ch === 'bass' ? 0.05 : ch === 'drums' ? 0.25 : 1.0;
      }
      if (rSend > 0) {
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(rSend, ctx.currentTime);
        cg.connect(sg);
        sg.connect(revInput);
        nodesToClean.push(sg);
      }
    }

    if (chorusInput) {
      let cSend = 0;
      if (chFx.chorus !== undefined) {
        cSend = chFx.chorus;
      } else {
        cSend = (ch === 'drums' || ch === 'bass') ? 0 : 0.8;
      }
      if (cSend > 0) {
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(cSend, ctx.currentTime);
        cg.connect(sg);
        sg.connect(chorusInput);
        nodesToClean.push(sg);
      }
    }

    channelGains[ch] = cg;
  }

  const cleanup = () => {
    for (const lfo of lfoNodes) {
      try { lfo.stop(); } catch {}
      try { lfo.disconnect(); } catch {}
    }
    for (const n of nodesToClean) {
      try { (n as any).disconnect?.(); } catch {}
    }
  };

  return {
    masterInput,
    channelGains,
    lfoNodes,
    cleanup,
  };
}

function startMusicAtBeat(ctx: AudioContext, trackName: string, startBeat: number,
  startTime = ctx.currentTime + 0.05, fade = 0): void {
  const timing = musicTiming(trackName);
  const beat = Math.max(0, Math.min(timing.totalBeats - 0.000001, Number.isFinite(startBeat) ? startBeat : 0));
  for (const track of Object.values(tracksState)) {
    let onset = 0;
    track.index = track.events.findIndex(event => {
      if (onset + event.beats > beat) return true;
      onset += event.beats;
      return false;
    });
    if (track.index < 0) track.index = track.events.length;
    track.nextBeat = track.index === track.events.length ? onset : beat;
    track.elapsedInNote = track.index === track.events.length ? 0 : beat - onset;
  }

  musicMasterGain = ctx.createGain();
  if (fade > 0) {
    musicMasterGain.gain.setValueAtTime(0, startTime);
    musicMasterGain.gain.linearRampToValueAtTime(musicVolume, startTime + fade);
  } else {
    musicMasterGain.gain.setValueAtTime(musicVolume, ctx.currentTime);
  }
  musicMasterGain.connect(audioOutput(ctx));
  const def = registeredMusic[trackName];
  musicEffectsBus = def ? buildMusicEffectsBus(ctx, def, Object.keys(tracksState), musicMasterGain) : null;
  musicClock = new MusicClock(startTime, musicTempoBpm, beat);
  audioSync.configure({ getAudioContext: () => audioCtx, syncPage: syncPageAudio });
  audioSync.onPlay({ ...timing, track: trackName, tempo: musicTempoBpm, startTime, startBeat: beat, clock: musicClock });
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
  pendingMusic = null;
  audioSync.onStop();
  if (musicSchedulerTimer) {
    clearInterval(musicSchedulerTimer);
    musicSchedulerTimer = null;
  }
  activeMusicTrackName = null;
  musicPausedBeat = 0;
  isMusicPaused = false;
  tracksState = {};
  musicClock = null;
  clearFadingMusic?.();
  disconnectMusicGain();
}

function fadeOutMusic(ctx: AudioContext, outgoing: {gain: GainNode; effects: MusicEffectsBus | null},
  startTime: number, fade: number): void {
  const gain = outgoing.gain.gain;
  const volume = gain.value;
  gain.cancelScheduledValues(ctx.currentTime);
  gain.setValueAtTime(volume, startTime);
  const endTime = startTime + fade;
  gain.linearRampToValueAtTime(0, endTime);

  let timer: ReturnType<typeof setTimeout>;
  function dispose(): void {
    clearTimeout(timer);
    outgoing.effects?.cleanup();
    outgoing.gain.disconnect();
    clearFadingMusic = undefined;
  }
  function checkTail(): void {
    if (ctx.currentTime >= endTime) dispose();
    else timer = setTimeout(checkTail, Math.max(25, (endTime - ctx.currentTime) * 1000));
  }
  timer = setTimeout(checkTail, (endTime - ctx.currentTime) * 1000);
  clearFadingMusic = dispose;
}

function disconnectMusicGain(): void {
  if (musicEffectsBus) {
    musicEffectsBus.cleanup();
    musicEffectsBus = null;
  }
  if (!musicMasterGain) return;
  musicMasterGain.disconnect();
  musicMasterGain = null;
}

export function pauseMusic(): void {
  if (isMusicPaused || !activeMusicTrackName) return;
  musicPausedBeat = audioSync.getSnapshot().currentBeat;
  isMusicPaused = true;
  if (musicSchedulerTimer) {
    clearInterval(musicSchedulerTimer);
    musicSchedulerTimer = null;
  }
  clearFadingMusic?.();
  disconnectMusicGain();
  audioSync.onPause(musicPausedBeat);
}

export function resumeMusic(): void {
  const ctx = getAudioContext();
  if (!ctx || !isMusicPaused || !activeMusicTrackName) return;
  isMusicPaused = false;
  startMusicAtBeat(ctx, activeMusicTrackName, musicPausedBeat);
}

export function setMusicTempo(bpm: number): void {
  if (!(bpm > 20 && bpm < 400) || bpm === musicTempoBpm) return;
  musicTempoBpm = bpm;
  if (audioCtx && activeMusicTrackName && !isMusicPaused) {
    musicClock?.changeAfter(bpm, audioCtx.currentTime + MUSIC_LOOKAHEAD);
  }
}

export function setMusicVolume(vol: number): void {
  musicVolume = Math.max(0, Math.min(1, vol));
  if (musicMasterGain && audioCtx) {
    musicMasterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    musicMasterGain.gain.setValueAtTime(musicVolume, audioCtx.currentTime);
  }
}

export function setTrackInstrument(channel: string, instrument: string, includeStudioLayers = false): void {
  for (const [name, track] of Object.entries(tracksState)) {
    if (name === channel || (includeStudioLayers && name.startsWith(channel + '_studio_'))) {
      track.instrument = instrument;
    }
  }
}

export function setTrackMute(channel: string, muted: boolean): void {
  if (tracksState[channel]) {
    tracksState[channel].muted = muted;
  }
}

function scheduleMusicTicks(): void {
  const ctx = getAudioContext();
  const clock = musicClock;
  if (!ctx || !clock || !musicMasterGain || isMusicPaused || !activeMusicTrackName) return;

  const lookaheadWindow = ctx.currentTime + MUSIC_LOOKAHEAD;

  const { totalBeats: songTotalBeats } = musicTiming(activeMusicTrackName);

  let allFinished = true;

  for (const [trackKey, track] of Object.entries(tracksState)) {
    if (!track || !track.events.length || track.muted) continue;

    while (true) {
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

      const eventTime = clock.timeAt(track.nextBeat);
      if (eventTime >= lookaheadWindow) break;
      const event = track.events[track.index];
      const remainingBeats = event.beats - (track.elapsedInNote ?? 0);
      const eventDurationSec = clock.timeAt(track.nextBeat + remainingBeats) - eventTime;

      if (!event.isRest && eventTime >= ctx.currentTime - 0.05) {
        const targetDest = musicEffectsBus ? (musicEffectsBus.channelGains[trackKey] || musicEffectsBus.masterInput) : musicMasterGain;
        scheduleTrackNote(ctx, trackKey, event, eventTime, eventDurationSec, targetDest, track.instrument);
      }

      track.nextBeat += remainingBeats;
      track.elapsedInNote = 0;
      track.index += 1;
    }

    if (track.index < track.events.length || musicLoop) {
      allFinished = false;
    }
  }

  // Scheduling the final note is not the end of its audible duration.
  if (allFinished && !musicLoop && ctx.currentTime >= clock.timeAt(songTotalBeats)) {
    stopMusic();
  }
}

export function auditionMusicNote(note: string, instrument: string): void {
  if (audioMuted) return;
  const event = parseTrackPattern(note)[0];
  if (!event || event.isRest) return;
  const ctx = getAudioContext();
  if (ctx) playTrackNote(ctx, '', event, ctx.currentTime, 0.24, audioOutput(ctx), instrument);
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

  playTrackNote(ctx, channel, event, time, durationSec, destination, instrumentOverride);
}

function playTrackNote(
  ctx: AudioContext,
  channel: string,
  event: ParsedNoteEvent,
  time: number,
  durationSec: number,
  destination: GainNode,
  instrumentOverride?: string,
): void {
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

    if (inst === 'brass' || inst === 'strings' || inst === 'bell') {
      // Portable voices: ordinary oscillators, filters and gain envelopes also
      // work through the native audio bridge. No samples or browser-only nodes.
      const isBell = inst === 'bell';
      const isStrings = inst === 'strings';
      const length = Math.max(.06, durationSec * (isBell ? 1.25 : 1.0));
      const attack = Math.min(length * .25, isStrings ? .06 : .018);
      osc.type = inst === 'brass' ? 'sawtooth' : isStrings ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, time);
      const peak = (isStrings ? .13 : .23) * chordGainMultiplier;
      gain.gain.setValueAtTime(.001, time);
      gain.gain.linearRampToValueAtTime(peak, time + attack);
      if (isBell) {
        gain.gain.exponentialRampToValueAtTime(.001, time + length);
      } else {
        const sustainLevel = peak * 0.82;
        const releaseTime = Math.min(0.04, durationSec * 0.08);
        const sustainEnd = time + Math.max(attack, durationSec - releaseTime);
        gain.gain.linearRampToValueAtTime(sustainLevel, time + attack + 0.04);
        gain.gain.setValueAtTime(sustainLevel, sustainEnd);
        gain.gain.exponentialRampToValueAtTime(.001, time + durationSec);
      }
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(9000, freq * (inst === 'brass' ? 5 : 3)), time);
      osc.connect(filter); filter.connect(gain); gain.connect(destination);
      osc.start(time); osc.stop(time + (isBell ? length : durationSec) + .015);
    } else if (inst === 'sawtooth' || inst === 'synth') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);
      const releaseTime = Math.min(0.035, durationSec * 0.08);
      const sustainEnd = time + Math.max(0.02, durationSec - releaseTime);
      const peak = 0.18 * chordGainMultiplier;
      gain.gain.setValueAtTime(peak, time);
      if (sustainEnd > time + 0.04) {
        gain.gain.setValueAtTime(peak * 0.85, sustainEnd);
      }
      gain.gain.exponentialRampToValueAtTime(0.002, time + durationSec);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(time);
      osc.stop(time + durationSec + 0.01);
    } else if (inst === 'triangle' || inst === 'bass') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      const noteSoundLen = durationSec * 0.9;
      const peak = 0.28 * chordGainMultiplier;
      gain.gain.setValueAtTime(peak, time);
      const sustainEnd = time + durationSec * 0.82;
      if (sustainEnd > time + 0.04) {
        gain.gain.setValueAtTime(peak * 0.9, sustainEnd);
      }
      gain.gain.exponentialRampToValueAtTime(0.003, time + noteSoundLen);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(time);
      osc.stop(time + noteSoundLen + 0.01);
    } else if (inst === 'sine') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      const releaseTime = Math.min(0.03, durationSec * 0.08);
      const sustainEnd = time + Math.max(0.02, durationSec - releaseTime);
      const peak = 0.25 * chordGainMultiplier;
      gain.gain.setValueAtTime(peak, time);
      if (sustainEnd > time + 0.04) {
        gain.gain.setValueAtTime(peak * 0.9, sustainEnd);
      }
      gain.gain.exponentialRampToValueAtTime(0.002, time + durationSec);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(time);
      osc.stop(time + durationSec + 0.01);
    } else if (inst === 'pluck') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      const noteSoundLen = Math.min(durationSec * 0.85, 0.45);
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
      const releaseTime = Math.min(0.03, durationSec * 0.08);
      const sustainEnd = time + Math.max(0.02, durationSec - releaseTime);
      const peak = 0.2 * chordGainMultiplier;
      gain.gain.setValueAtTime(peak, time);
      if (sustainEnd > time + 0.04) {
        gain.gain.setValueAtTime(peak * 0.85, sustainEnd);
      }
      gain.gain.exponentialRampToValueAtTime(0.002, time + durationSec);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(time);
      osc.stop(time + durationSec + 0.01);
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
