import { describe, it, expect } from 'vitest';
import {
  parseNoteToFreq,
  parseTrackPattern,
  registerSounds,
  registerMusic,
  playSound,
  playMusic,
  stopMusic,
  pauseMusic,
  resumeMusic,
  setMusicTempo,
  setMusicVolume,
} from '../src/audio';

describe('Web Audio Synthesizer & Music Sequencer', () => {
  it('parses musical note names to standard frequencies (A4 = 440 Hz)', () => {
    expect(parseNoteToFreq('A4')).toBe(440);
    expect(parseNoteToFreq('C4')).toBeCloseTo(261.63, 1);
    expect(parseNoteToFreq('D4')).toBeCloseTo(293.66, 1);
    expect(parseNoteToFreq('E4')).toBeCloseTo(329.63, 1);
    expect(parseNoteToFreq('G4')).toBeCloseTo(392.0, 1);
    expect(parseNoteToFreq('C5')).toBeCloseTo(523.25, 1);
    expect(parseNoteToFreq('A5')).toBe(880);

    // Direct number string fallback
    expect(parseNoteToFreq('120')).toBe(120);
    expect(parseNoteToFreq('880')).toBe(880);
  });

  it('parses music track patterns into timed note events', () => {
    const pattern = 'C4:8 D4:8 E4:4 | -:8 G4:8 kick:4 snare:4';
    const events = parseTrackPattern(pattern);

    expect(events.length).toBe(7);

    // C4:8 -> 0.5 beat
    expect(events[0].isRest).toBe(false);
    expect(events[0].isDrum).toBe(false);
    expect(events[0].beats).toBe(0.5);
    expect(events[0].pitch).toBeCloseTo(261.63, 1);

    // E4:4 -> 1 beat
    expect(events[2].beats).toBe(1);

    // -:8 -> Rest, 0.5 beat
    expect(events[3].isRest).toBe(true);
    expect(events[3].beats).toBe(0.5);

    // kick:4 -> Drum
    expect(events[5].isDrum).toBe(true);
    expect(events[5].pitch).toBe('kick');
    expect(events[5].beats).toBe(1);

    // snare:4 -> Drum
    expect(events[6].isDrum).toBe(true);
    expect(events[6].pitch).toBe('snare');
    expect(events[6].beats).toBe(1);
  });

  it('parses multi-line bars with inline comments', () => {
    const pattern = `
      C4:8 D4:8 E4:8 G4:8 # Bar 1: Intro
      A4:8 G4:8 E4:8 D4:8 # Bar 2: Response
      C4:2 -:2            # Bar 3: Resolution
    `;
    const events = parseTrackPattern(pattern);
    expect(events.length).toBe(10);
    expect(events[0].pitch).toBeCloseTo(261.63, 1);
    expect(events[4].pitch).toBe(440);
    expect(events[9].isRest).toBe(true);
  });

  it('parses polyphonic chords with bracket notation and plus notation', () => {
    const pattern = '[C4,E4,G4]:4 [F4,A4,C5]:2 C4+E4+G4:8 [kick,hihat]:4';
    const events = parseTrackPattern(pattern);

    expect(events.length).toBe(4);

    // [C4,E4,G4]:4 -> 1 beat chord with 3 pitches
    expect(events[0].beats).toBe(1);
    expect(events[0].pitches?.length).toBe(3);
    expect(events[0].pitches![0]).toBeCloseTo(261.63, 1);
    expect(events[0].pitches![1]).toBeCloseTo(329.63, 1);
    expect(events[0].pitches![2]).toBeCloseTo(392.00, 1);

    // [F4,A4,C5]:2 -> 2 beats chord
    expect(events[1].beats).toBe(2);
    expect(events[1].pitches?.length).toBe(3);

    // C4+E4+G4:8 -> 0.5 beat chord
    expect(events[2].beats).toBe(0.5);
    expect(events[2].pitches?.length).toBe(3);

    // [kick,hihat]:4 -> Drum chord
    expect(events[3].isDrum).toBe(true);
    expect(events[3].pitches).toEqual(['kick', 'hihat']);
  });

  it('registers custom @Sound definitions and plays without throwing', () => {
    registerSounds({
      laser_canon: {
        wave: 'sawtooth',
        freq_start: 900,
        freq_end: 150,
        duration: 0.1,
        volume: 0.3,
        curve: 'exponential',
      },
      mega_blast: {
        wave: 'noise',
        filter: {
          filter_type: 'lowpass',
          start_freq: 900,
          end_freq: 80,
        },
        duration: 0.4,
        volume: 0.5,
      },
    });

    expect(() => playSound('laser_canon')).not.toThrow();
    expect(() => playSound('mega_blast')).not.toThrow();
  });

  it('registers custom @Music definitions and controls playback safely', () => {
    registerMusic({
      arcade_theme: {
        music_type: '8bit',
        tempo: 140,
        loop_track: true,
        volume: 0.2,
        lead: 'C4:8 E4:8 G4:8 C5:8',
        bass: 'C2:4 G2:4',
        drums: 'kick:4 snare:4',
      },
    });

    expect(() => playMusic('arcade_theme')).not.toThrow();
    expect(() => pauseMusic()).not.toThrow();
    expect(() => resumeMusic()).not.toThrow();
    expect(() => setMusicTempo(160)).not.toThrow();
    expect(() => setMusicVolume(0.3)).not.toThrow();
    expect(() => stopMusic()).not.toThrow();
  });
});

