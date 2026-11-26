// Terminal music shares the production note parser, scheduler and synth.
import { configureAudioHost, registerMusic, playMusic, stopMusic, pauseMusic, resumeMusic,
  parseTrackPattern } from './audio';
import type { MusicDefinition } from './types';

export function register(definitions: Record<string, MusicDefinition>): void {
  configureAudioHost({ syncPage: false });
  for (const [name, definition] of Object.entries(definitions)) {
    const patterns = [definition.lead, definition.bass, definition.drums,
      ...Object.values(definition.tracks ?? {})];
    let count = 0;
    for (const pattern of patterns) {
      if (!pattern) continue;
      if (typeof pattern !== 'string') throw new Error(`AsciiMusic/${name}: tracks must be note strings`);
      const tokens = pattern.split(/\s+/).filter(Boolean);
      const pitch = '(?:[A-Ga-g][#bB]?[0-8]|kick|snare|hihat|crash|tom)';
      const chord = `${pitch}(?:[,+]${pitch}){0,7}`;
      const token = new RegExp(`^(?:${chord}|\\[${chord}\\]|-|R|_)(?::(?:1|2|4|8|16|32))?$`);
      for (const value of tokens) {
        if (value !== '|' && !token.test(value)) throw new Error(`AsciiMusic/${name}: invalid note ${value}`);
      }
      count += parseTrackPattern(pattern).length;
    }
    if (count < 1 || count > 4096) throw new Error(`AsciiMusic/${name}: needs 1-4096 note/rest events`);
  }
  registerMusic(definitions);
}

export { playMusic as play, stopMusic as stop, pauseMusic as pause, resumeMusic as resume };
