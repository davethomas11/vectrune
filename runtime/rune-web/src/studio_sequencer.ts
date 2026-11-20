// Studio scores are edited in sixteenth-note ticks and projected into fixed measures.
const TICKS_PER_WHOLE = 16;
export const STUDIO_TICK_WIDTH = 30;
export const STUDIO_STRIP_TICK_WIDTH = 48;

export function studioBarTicks(timeSignature: string): number {
  return timeSignature === '3/4' ? 12 : 16;
}

export function studioTokenTicks(token: string, barTicks: number): number {
  const denominator = Number(token.match(/:([\d.]+)$/)?.[1]) || 8;
  return denominator === 1 ? barTicks : Math.max(1, Math.round(TICKS_PER_WHOLE / denominator));
}

function withTicks(token: string, ticks: number): string {
  return token.replace(/:[\d.]+$/, '') + ':' + TICKS_PER_WHOLE / ticks;
}

export function isStudioRest(token: string): boolean {
  return /^(?:-|rest|r|_)(?::|$)/i.test(token);
}

// Explicit separators anchor a measure even if an older score overfills it.
// Older continuous scores acquire measure boundaries from their note onsets.
function scoreMeasures(score: string, barTicks: number): string[][] {
  const clean = score.replace(/^\s*#.*$/gm, '').replace(/\s+#.*$/gm, '');
  const tokens = (part: string) => part.trim().match(/\[[^\]]*\](?::[^\s]+)?|\S+/g) ?? [];
  if (clean.includes('|')) return clean.split('|').map(tokens);

  const measures: string[][] = [[]];
  let tick = 0;
  for (const token of tokens(clean)) {
    if (tick >= barTicks) {
      measures.push([]);
      tick = 0;
    }
    measures[measures.length - 1].push(token);
    tick += studioTokenTicks(token, barTicks);
  }
  return measures;
}

interface StudioSpan {
  token: string;
  tick: number;
  ticks: number;
}

function measureSpans(tokens: string[], barTicks: number, clip: boolean): StudioSpan[] {
  const spans: StudioSpan[] = [];
  let tick = 0;
  for (const token of tokens) {
    if (clip && tick >= barTicks) break;
    const duration = studioTokenTicks(token, barTicks);
    const ticks = clip ? Math.min(duration, barTicks - tick) : duration;
    if (!isStudioRest(token)) spans.push({ token, tick, ticks });
    tick += ticks;
  }
  return spans;
}

function appendRests(tokens: string[], ticks: number): void {
  for (const length of [16, 8, 4, 2, 1]) {
    while (ticks >= length) {
      tokens.push(withTicks('-', length));
      ticks -= length;
    }
  }
}

function serializeMeasure(spans: StudioSpan[], barTicks: number, pad: boolean): string {
  const tokens: string[] = [];
  let tick = 0;
  for (const span of spans) {
    appendRests(tokens, span.tick - tick);
    tokens.push(withTicks(span.token.replace(/\s+/g, ''), span.ticks));
    tick = span.tick + span.ticks;
  }
  if (pad) appendRests(tokens, barTicks - tick);
  return tokens.join(' ');
}

export function studioTrackPattern(score: string, barTicks: number, bars: number): string {
  const measures = scoreMeasures(score, barTicks);
  return Array.from({ length: bars }, (_, index) =>
    serializeMeasure(measureSpans(measures[index] ?? [], barTicks, true), barTicks, true),
  ).join(' | ');
}

export function editStudioTrack(
  score: string,
  barTicks: number,
  bars: number,
  edit: { kind: string; bar: number; tick?: number },
): { score: string; bar: number; tick: number } | undefined {
  const measures = scoreMeasures(score, barTicks);
  while (measures.length < bars) measures.push([]);
  if (edit.kind === 'addBar' || edit.kind === 'duplicateBar' || edit.kind === 'deleteBar') {
    if (edit.kind === 'deleteBar') measures.splice(edit.bar - 1, 1);
    else measures.splice(bars, 0, edit.kind === 'duplicateBar' ? measures[edit.bar - 1] : []);
    return { score: measures.map(tokens => tokens.join(' ')).join(' | '), bar: 0, tick: -1 };
  }

  if (edit.kind === 'delete' && edit.tick !== undefined) {
    const spans = measureSpans(measures[edit.bar - 1] ?? [], barTicks, false);
    const index = spans.findIndex(span => span.tick === edit.tick);
    if (index < 0) return;
    spans.splice(index, 1);
    measures[edit.bar - 1] = [serializeMeasure(spans, barTicks, false)];
    return { score: measures.map(tokens => tokens.join(' ')).join(' | ').trim(), bar: edit.bar, tick: edit.tick };
  }
}

export function studioStretchTicks(ticks: number, delta: number, limit: number): number {
  const lengths = [...new Set([1, 2, 4, 8, limit])].filter(length => length > 0 && length <= limit)
    .sort((a, b) => a - b);
  if (delta > 0) return lengths.find(length => length > ticks) ?? ticks;
  return lengths.filter(length => length < ticks).pop() ?? ticks;
}

export const STUDIO_STEP_IDS_PER_VOICE = 1000;

function tokenPitches(token: string): string[] {
  return token.replace(/:[\d.]+$/, '').replace(/[\[\]]/g, '').split(/[,+]/);
}

export function studioScoreLanes(score: string, barTicks: number): string[] {
  return score.split('\n').flatMap(line => {
    if (!/[\[+,]/.test(line)) return [line];
    const measures = scoreMeasures(line, barTicks).map(tokens => measureSpans(tokens, barTicks, false));
    const count = Math.max(1, ...measures.flatMap(spans => spans.map(span => tokenPitches(span.token).length)));
    return Array.from({ length: count }, (_, index) => measures.map(spans => {
      const part = [];
      for (const span of spans) {
        const pitch = tokenPitches(span.token)[index];
        if (pitch) part.push({ ...span, token: pitch });
      }
      return serializeMeasure(part, barTicks, false);
    }).join(' | '));
  });
}

export function studioTrackPatterns(score: string, barTicks: number, bars: number): string[] {
  return studioScoreLanes(score, barTicks).map(lane => studioTrackPattern(lane, barTicks, bars));
}

function pitchKey(pitch: string): string {
  const match = /^([A-G])([#b]?)(\d+)$/i.exec(pitch);
  if (!match) return pitch.toLowerCase();
  const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const accidental = match[2] === '#' ? 1 : match[2] ? -1 : 0;
  return String(Number(match[3]) * 12 + semitones[match[1].toUpperCase()] + accidental);
}

export interface StudioNotePlacement {
  bar: number;
  tick: number;
  pitch: string;
  ticks?: number;
  source?: { bar: number; tick: number; lane: number };
  resizeBy?: number;
}

export function placeStudioNote(score: string, barTicks: number, bars: number, edit: StudioNotePlacement) {
  const { bar, tick, source, resizeBy } = edit;
  if (bar < 1 || bar > bars || tick < 0 || tick >= barTicks) return;
  const lanes = studioScoreLanes(score, barTicks).map(lane => scoreMeasures(lane, barTicks));
  for (const lane of lanes) while (lane.length < bars) lane.push([]);
  const sourceSpans = source ? measureSpans(lanes[source.lane]?.[source.bar - 1] ?? [], barTicks, false) : undefined;
  const original = sourceSpans?.find(span => span.tick === source?.tick);
  if (source && !original) return;
  const originalTicks = original && source ? Math.min(original.ticks, barTicks - source.tick) : 0;
  const targetSpans = lanes.map((lane, index) => {
    const spans = measureSpans(lane[bar - 1] ?? [], barTicks, false);
    return source?.bar === bar && source.lane === index ? spans.filter(span => span.tick !== source.tick) : spans;
  });
  const samePitch = targetSpans.flat().filter(span => pitchKey(tokenPitches(span.token)[0]) === pitchKey(edit.pitch));
  const next = Math.min(barTicks, ...samePitch.filter(span => span.tick > tick).map(span => span.tick));
  const requested = source ? originalTicks + (resizeBy ?? 0) : edit.ticks ?? 1;
  const ticks = !source || resizeBy !== undefined ? Math.max(1, Math.min(next - tick, requested)) : requested;
  const overlaps = (span: StudioSpan) => tick < span.tick + span.ticks && span.tick < tick + ticks;

  if (tick + ticks > barTicks || samePitch.some(overlaps)) return { ticks, valid: false };
  if (source && source.bar === bar && source.tick === tick && original && tokenPitches(original.token)[0] === edit.pitch &&
      ticks === originalTicks) return { ticks, valid: true, lane: source.lane };

  const preferred = source?.lane ?? 0;
  let lane = targetSpans[preferred] && !targetSpans[preferred].some(overlaps)
    ? preferred
    : targetSpans.findIndex(spans => !spans.some(overlaps));
  if (lane === -1) {
    lane = lanes.length;
    lanes.push(Array.from({ length: bars }, () => []));
    targetSpans.push([]);
  }
  if (source && sourceSpans) {
    const remaining = sourceSpans.filter(span => span.tick !== source.tick);
    lanes[source.lane][source.bar - 1] = [serializeMeasure(remaining, barTicks, false)];
  }
  const target = targetSpans[lane];
  target.push({ token: edit.pitch, tick, ticks });
  target.sort((a, b) => a.tick - b.tick);
  lanes[lane][bar - 1] = [serializeMeasure(target, barTicks, false)];

  const joined = lanes.map(measures => Array.from(measures, tokens => tokens?.join(' ') || '').join(' | ').trim());
  while (joined.length > 1 && !/[^|\s]/.test(joined[joined.length - 1])) joined.pop();
  return { ticks, valid: true, lane, score: joined.join('\n') };
}
