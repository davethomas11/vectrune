// ============================================================================
// Retro Web Audio Synthesizer & 8-Bit Chiptune Sequencer
// Zero external assets, zero download overhead, pure Web Audio synthesis.
// ============================================================================

import type { SoundDefinition, MusicDefinition } from './types';

let audioCtx: AudioContext | null = null;
let stepIndex = 0;

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
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
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
      gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
        gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
  gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

// ============================================================================
// 8-Bit Chiptune Background Music Sequencer
// ============================================================================

interface ParsedNoteEvent {
  pitch: string | number;
  beats: number;
  isRest: boolean;
  isDrum: boolean;
}

interface TrackPlaybackState {
  events: ParsedNoteEvent[];
  index: number;
  nextBeat: number;
}

let activeMusicTrackName: string | null = null;
let musicSchedulerTimer: any = null;
let musicMasterGain: GainNode | null = null;
let musicVolume = 0.2;
let musicTempoBpm = 128;
let musicLoop = true;
let isMusicPaused = false;
let musicStartTime = 0;
let nextScheduleTime = 0;
let tracksState: {
  lead?: TrackPlaybackState;
  bass?: TrackPlaybackState;
  drums?: TrackPlaybackState;
} = {};

export function parseTrackPattern(patternStr: string): ParsedNoteEvent[] {
  const events: ParsedNoteEvent[] = [];
  // Tokenize ignoring measure bars '|'
  const tokens = patternStr.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    const parts = token.split(':');
    const noteToken = parts[0].trim();
    const durationNum = parts.length > 1 ? Number(parts[1].trim()) : 8; // Default 8th note
    // In 4/4 time: :4 is 1 beat, :8 is 0.5 beat, :16 is 0.25 beat, :2 is 2 beats, :1 is 4 beats
    const beats = durationNum > 0 ? 4 / durationNum : 0.5;

    if (noteToken === '-' || noteToken.toUpperCase() === 'R' || noteToken === '_') {
      events.push({ pitch: 0, beats, isRest: true, isDrum: false });
    } else if (
      noteToken.toLowerCase() === 'kick' ||
      noteToken.toLowerCase() === 'snare' ||
      noteToken.toLowerCase() === 'hihat'
    ) {
      events.push({ pitch: noteToken.toLowerCase(), beats, isRest: false, isDrum: true });
    } else {
      events.push({ pitch: parseNoteToFreq(noteToken), beats, isRest: false, isDrum: false });
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
  musicMasterGain.connect(ctx.destination);

  tracksState = {};
  if (def.lead) {
    tracksState.lead = { events: parseTrackPattern(def.lead), index: 0, nextBeat: 0 };
  }
  if (def.bass) {
    tracksState.bass = { events: parseTrackPattern(def.bass), index: 0, nextBeat: 0 };
  }
  if (def.drums) {
    tracksState.drums = { events: parseTrackPattern(def.drums), index: 0, nextBeat: 0 };
  }

  musicStartTime = ctx.currentTime + 0.05;
  nextScheduleTime = musicStartTime;

  scheduleMusicTicks();
  musicSchedulerTimer = setInterval(scheduleMusicTicks, 35);
}

export function stopMusic(): void {
  if (musicSchedulerTimer) {
    clearInterval(musicSchedulerTimer);
    musicSchedulerTimer = null;
  }
  activeMusicTrackName = null;
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
  isMusicPaused = true;
}

export function resumeMusic(): void {
  isMusicPaused = false;
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

function scheduleMusicTicks(): void {
  const ctx = getAudioContext();
  if (!ctx || !musicMasterGain || isMusicPaused || !activeMusicTrackName) return;

  const secondsPerBeat = 60 / musicTempoBpm;
  const lookaheadWindow = ctx.currentTime + 0.25;

  const trackKeys: (keyof typeof tracksState)[] = ['lead', 'bass', 'drums'];
  let allFinished = true;

  for (const trackKey of trackKeys) {
    const track = tracksState[trackKey];
    if (!track || !track.events.length) continue;

    while (musicStartTime + track.nextBeat * secondsPerBeat < lookaheadWindow) {
      if (track.index >= track.events.length) {
        if (musicLoop) {
          track.index = 0;
        } else {
          break;
        }
      }

      const event = track.events[track.index];
      const eventTime = musicStartTime + track.nextBeat * secondsPerBeat;
      const eventDurationSec = event.beats * secondsPerBeat;

      if (!event.isRest && eventTime >= ctx.currentTime - 0.05) {
        scheduleTrackNote(ctx, trackKey, event, eventTime, eventDurationSec, musicMasterGain);
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
  channel: 'lead' | 'bass' | 'drums',
  event: ParsedNoteEvent,
  time: number,
  durationSec: number,
  destination: GainNode,
): void {
  if (channel === 'drums' || event.isDrum) {
    const drumType = String(event.pitch).toLowerCase();
    if (drumType === 'kick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, time);
      osc.frequency.exponentialRampToValueAtTime(32, time + Math.min(durationSec, 0.08));

      gain.gain.setValueAtTime(0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + Math.min(durationSec, 0.08));

      osc.connect(gain);
      gain.connect(destination);
      osc.start(time);
      osc.stop(time + Math.min(durationSec, 0.09));
    } else if (drumType === 'snare') {
      playNoiseBurstToDestination(ctx, time, Math.min(durationSec, 0.09), 1600, 300, 0.3, destination, 'bandpass');
    } else if (drumType === 'hihat') {
      playNoiseBurstToDestination(ctx, time, Math.min(durationSec, 0.04), 7000, 5000, 0.15, destination, 'highpass');
    }
    return;
  }

  const freq = typeof event.pitch === 'number' ? event.pitch : parseNoteToFreq(event.pitch);
  if (freq <= 0) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (channel === 'lead') {
    // 8-bit pulse / square lead
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);

    const noteSoundLen = Math.min(durationSec * 0.85, 0.35);
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + noteSoundLen);

    osc.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + noteSoundLen + 0.01);
  } else if (channel === 'bass') {
    // 8-bit triangle bass pulse
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    const noteSoundLen = Math.min(durationSec * 0.9, 0.45);
    gain.gain.setValueAtTime(0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.005, time + noteSoundLen);

    osc.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + noteSoundLen + 0.01);
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
