import type { MusicDefinition } from './types';
import type { ParsedNoteEvent } from './audio';

export interface MusicArrangement {
  bars: number;
  tracks: Record<string, ParsedNoteEvent[]>;
  sections: Array<{ name: string; startBeat: number; beats: number }>;
}

/** Expand once at registration, padding every channel to identical section boundaries. */
export function compileMusicArrangement(def: MusicDefinition, parse: (notes: string) => ParsedNoteEvent[]): MusicArrangement | null {
  if (!Object.keys(def.sections ?? {}).length && !def.arrangement?.length) return null;
  const parts = def.sections ?? {}, form = def.arrangement ?? [];
  if (!Object.keys(parts).length || Object.keys(parts).length > 32 || !form.length || form.length > 128)
    throw new Error('Music needs 1-32 sections and 1-128 arrangement entries');
  if (def.lead || def.bass || def.drums || Object.keys(def.tracks ?? {}).length || def.bars != null)
    throw new Error('Arranged music declares bars and note tracks inside sections');
  if (!['4/4', '3/4'].includes(def.time_signature ?? '4/4')) throw new Error('Arranged music supports 4/4 or 3/4 time');
  const beatsPerBar = def.time_signature === '3/4' ? 3 : 4;
  const channels = new Set<string>();
  const parsed: Record<string, Record<string, ParsedNoteEvent[]>> = Object.create(null);
  for (const [name, part] of Object.entries(parts)) {
    const tracks = Object.entries(part).filter(([key]) => key !== 'bars');
    if (!name || !Number.isInteger(part.bars) || part.bars < 1 || part.bars > 64 || !tracks.length || tracks.length > 16)
      throw new Error(`Music section ${name} needs 1-64 integer bars and 1-16 tracks`);
    parsed[name] = Object.create(null);
    for (const [channel, notes] of tracks) {
      if (typeof notes !== 'string') throw new Error(`Music section ${name}/${channel} needs note text`);
      const events = parse(notes);
      const duration = events.reduce((sum, e) => sum + e.beats, 0);
      if (!Number.isFinite(duration) || duration > part.bars * beatsPerBar + 1e-8)
        throw new Error(`Music section ${name}/${channel} exceeds its declared bars`);
      parsed[name][channel] = events;
      channels.add(channel);
    }
  }
  const result: MusicArrangement = { bars: 0, tracks: Object.create(null), sections: [] };
  for (const channel of channels) result.tracks[channel] = [];
  for (const cue of form) {
    const name = typeof cue === 'string' ? cue : cue.section;
    const repeat = typeof cue === 'string' ? 1 : cue.repeat;
    if (!Object.prototype.hasOwnProperty.call(parts, name)) throw new Error(`Unknown music section: ${name}`);
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > 16) throw new Error('Music section repeat must be an integer from 1 to 16');
    for (let i = 0; i < repeat; i++) {
      const beats = parts[name].bars * beatsPerBar;
      if (result.bars + parts[name].bars > 512) throw new Error('Music arrangement exceeds 512 bars');
      result.sections.push({ name, startBeat: result.bars * beatsPerBar, beats });
      result.bars += parts[name].bars;
      for (const channel of channels) {
        const events = parsed[name][channel] ?? [];
        const duration = events.reduce((sum, e) => sum + e.beats, 0);
        const offset = result.tracks[channel].length;
        result.tracks[channel].push(...events.map((e, index) => ({ ...e, stepId: offset + index })));
        if (duration < beats) result.tracks[channel].push({ stepId: -1, pitch: 0, beats: beats - duration, isRest: true, isDrum: false });
      }
    }
  }
  return result;
}
