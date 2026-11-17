import { describe, expect, it } from 'vitest';
import { compileMusicArrangement } from '../src/music_arrangement';
import { parseTrackPattern } from '../src/audio';
import type { MusicDefinition } from '../src/types';

const song: MusicDefinition = {
  sections: {
    verse: { bars: 1, lead: 'D5:2 A4:4', bass: 'D3:1' },
    chorus: { bars: 2, lead: 'A5:1 D5:1', bells: 'D6:2' },
    bridge: { bars: 1, bass: 'G3:2 A3:2' },
  },
  arrangement: ['verse', { section: 'chorus', repeat: 2 }, { section: 'bridge', repeat: 2 }, 'chorus'],
};
const beats = (events: ReturnType<typeof parseTrackPattern>) => events.reduce((sum, e) => sum + e.beats, 0);

describe('reusable music sections', () => {
  it('repeats verse/chorus/bridge in order, aligned across absent and short channels', () => {
    const original = JSON.stringify(song);
    const score = compileMusicArrangement(song, parseTrackPattern)!;
    expect(score.bars).toBe(9);
    expect(score.sections.map(s => [s.name, s.startBeat])).toEqual([
      ['verse', 0], ['chorus', 4], ['chorus', 12], ['bridge', 20], ['bridge', 24], ['chorus', 28],
    ]);
    for (const channel of Object.values(score.tracks)) expect(beats(channel)).toBe(36);
    expect(score.tracks.lead[2]).toMatchObject({ isRest: true, beats: 1 });
    expect(score.tracks.bells[0]).toMatchObject({ isRest: true, beats: 4 });
    expect(JSON.stringify(song)).toBe(original);
    // Instances are independent so future playback edits cannot mutate repetitions.
    expect(score.tracks.lead[3]).not.toBe(score.tracks.lead[5]);
  });
  it('aligns waltz sections and leaves legacy scores alone', () => {
    expect(compileMusicArrangement({ lead: 'D5:4' }, parseTrackPattern)).toBeNull();
    const result = compileMusicArrangement({ time_signature: '3/4', sections: { verse: { bars: 1, lead: 'D5:2' } }, arrangement: ['verse', 'verse'] }, parseTrackPattern)!;
    expect(beats(result.tracks.lead)).toBe(6);
    expect(result.sections[1].startBeat).toBe(3);
  });
  it('rejects unknown cues, overlong phrases, invalid repeats and ambiguous song forms', () => {
    for (const def of [
      { ...song, arrangement: ['missing'] },
      { ...song, arrangement: [{ section: 'verse', repeat: 0 }] },
      { ...song, arrangement: [{ section: 'verse', repeat: 1.5 }] },
      { ...song, arrangement: [{ section: 'verse', repeat: 17 }] },
      { ...song, bars: 4 },
      { ...song, lead: 'D5:4' },
      { ...song, time_signature: '6/8' },
      { ...song, sections: { verse: { bars: 1, lead: 'D5:1 D5:4' } }, arrangement: ['verse'] },
      { ...song, sections: { verse: { bars: 0, lead: 'D5:4' } }, arrangement: ['verse'] },
      { ...song, sections: { verse: { bars: 64, lead: 'D5:4' } }, arrangement: [{ section: 'verse', repeat: 16 }] },
    ]) expect(() => compileMusicArrangement(def, parseTrackPattern)).toThrow();
  });
});
