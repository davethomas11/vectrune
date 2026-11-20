import { describe, expect, it } from 'vitest';
import { pasteStudioNotes, studioTrackPatterns } from '../src/studio_sequencer';

describe('Studio note paste', () => {
  it('keeps source notes and preserves the copied chord, offsets, and lengths', () => {
    const result = pasteStudioNotes('A4:8 |', 16, 2, 16, [
      { offset: 0, pitch: 'E4', ticks: 4 },
      { offset: 0, pitch: 'G4', ticks: 2 },
      { offset: 3, pitch: 'F4', ticks: 1 },
    ]);
    expect(result).toHaveProperty('score');
    if ('score' in result) {
      expect(studioTrackPatterns(result.score, 16, 2)).toEqual([
        'A4:8 -:2 -:4 -:8 | E4:4 -:2 -:4',
        '-:1 | G4:8 -:16 F4:16 -:2 -:4',
      ]);
    }
  });

  it('rejects the whole paste if a later note reaches across a bar line', () => {
    expect(pasteStudioNotes('', 16, 2, 13, [
      { offset: 0, pitch: 'E4', ticks: 1 },
      { offset: 2, pitch: 'G4', ticks: 4 },
    ])).toEqual({ error: 'bars' });
  });

  it('treats enharmonic pitches as the same note for overlap checks', () => {
    expect(pasteStudioNotes('Bb4:4', 16, 1, 0, [
      { offset: 0, pitch: 'C4', ticks: 2 },
      { offset: 1, pitch: 'A#4', ticks: 2 },
    ])).toEqual({ error: 'overlap' });
  });
});
