interface TempoMark {
  beat: number;
  time: number;
  bpm: number;
}

/** Beat/time mapping shared by the scheduler and the audible playhead. */
export class MusicClock {
  private readonly marks: TempoMark[];

  constructor(time: number, bpm: number, beat = 0) {
    this.marks = [{ time, bpm, beat }];
  }

  private at(position: number, key: 'beat' | 'time'): TempoMark {
    let i = this.marks.length - 1;
    while (i > 0 && this.marks[i][key] > position) i--;
    return this.marks[i];
  }

  beatAt(time: number): number {
    const mark = this.at(time, 'time');
    return mark.beat + (time - mark.time) / (60 / mark.bpm);
  }

  timeAt(beat: number): number {
    const mark = this.at(beat, 'beat');
    return mark.time + (beat - mark.beat) * (60 / mark.bpm);
  }

  tempoAt(time: number): number {
    return this.at(time, 'time').bpm;
  }

  changeAfter(bpm: number, scheduledUntil: number): void {
    // Already submitted voices keep their timestamps. Replace any change
    // beyond lookahead and place the new tempo on the next whole beat.
    while (this.marks.length > 1 && this.marks[this.marks.length - 1].time > scheduledUntil) {
      this.marks.pop();
    }
    if (this.tempoAt(scheduledUntil) === bpm) return;
    const beat = Math.max(Math.floor(this.beatAt(scheduledUntil)) + 1, this.marks[0].beat);
    this.marks.push({ beat, time: this.timeAt(beat), bpm });
  }
}
