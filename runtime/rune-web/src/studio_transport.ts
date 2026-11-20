import { audioSync } from './audio_sync';
import { studioBarTicks } from './studio_sequencer';
import type { RuneApp, Scope } from './types';

function studioDuration(state: Scope): number {
  return studioBarTicks(String(state.time_signature)) * Number(state.bars) / 4;
}

export function paintStudioPlayhead(root: HTMLElement, state: Scope): void {
  const duration = studioDuration(state);
  const snapshot = audioSync.getSnapshot();
  const beat = state.is_playing && snapshot.isPlaying ? snapshot.currentBeat : Number(state.playback_beat) || 0;
  const beatsPerBar = studioBarTicks(String(state.time_signature)) / 4;
  const parked = Math.max(0, Math.min(duration - 0.000001, beat));
  const bar = Math.floor(parked / beatsPerBar) + 1;

  const ruler = root.querySelector<HTMLElement>('#ruler-playhead');
  if (ruler) ruler.style.left = parked / duration * 100 + '%';
  const rail = root.querySelector<HTMLElement>('[data-studio-seek="progress"]');
  rail?.setAttribute('aria-valuemax', String(duration));
  rail?.setAttribute('aria-valuenow', String(Math.round(parked * 100) / 100));
  rail?.setAttribute('aria-disabled', String(Boolean(state.is_playing)));

  const playhead = root.querySelector<HTMLElement>('#seq-playhead');
  const scroller = playhead?.parentElement;
  if (!playhead || !scroller) return;
  const viewBar = Number(scroller.dataset.syncViewBar) || 0;
  const pixelsPerBeat = Number(scroller.dataset.syncPixelsPerBeat) || 120;
  playhead.style.display = !viewBar || viewBar === bar ? 'block' : 'none';
  playhead.style.left = Math.round((parked - (viewBar ? (viewBar - 1) * beatsPerBar : 0)) * pixelsPerBeat) + 'px';
}

export function bindStudioTransport(app: RuneApp): void {
  let seek: { pointerId: number; mode: string; xOffset: number } | undefined;

  function parkAt(beat: number): void {
    const beatsPerBar = studioBarTicks(String(app.state.time_signature)) / 4;
    const end = studioDuration(app.state);
    const snapped = Math.max(0, Math.min(end - 0.25, Math.round(beat * 4) / 4));
    app.state.playback_beat = snapped;
    app.state.playback_bar = Math.floor(snapped / beatsPerBar) + 1;
    app.state.playback_progress = snapped / end * 100;
    app.state.playback_step_id = -1;
    // The current pointer target can change as the reactive view renders.
    const root = document.getElementById('app');
    if (root) paintStudioPlayhead(root, app.state);
  }

  function update(event: PointerEvent): void {
    if (!seek || seek.pointerId !== event.pointerId || app.state.is_playing) return;
    const x = event.clientX - seek.xOffset;
    if (seek.mode === 'progress') {
      const bounds = document.querySelector('[data-studio-seek="progress"]')?.getBoundingClientRect();
      if (bounds?.width) parkAt((x - bounds.left) / bounds.width * studioDuration(app.state));
    } else {
      const scroller = document.querySelector<HTMLElement>('[data-studio-scroll]');
      if (!scroller) return;
      const bar = Number(scroller.dataset.syncViewBar) || 0;
      const pixelsPerBeat = Number(scroller.dataset.syncPixelsPerBeat) || 120;
      const grid = scroller.querySelector('.matrix-grid-surface, .step-strip');
      if (!grid) return;
      const beat = (x - grid.getBoundingClientRect().left) / pixelsPerBeat;
      const beatsPerBar = studioBarTicks(String(app.state.time_signature)) / 4;
      parkAt(bar ? (bar - 1) * beatsPerBar + Math.max(0, Math.min(beatsPerBar - 0.25, beat)) : beat);
    }
  }

  document.addEventListener('click', event => {
    if (app.state.is_playing || !(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLElement>('[data-studio-seek-bar]');
    if (!button) return;
    const beatsPerBar = studioBarTicks(String(app.state.time_signature)) / 4;
    const current = Math.floor((Number(app.state.playback_beat) || 0) / beatsPerBar);
    const step = button.dataset.studioSeekBar;
    const bar = step === 'start' ? 0 : Math.max(0, Math.min(Number(app.state.bars) - 1, current + Number(step)));
    parkAt(bar * beatsPerBar);
    if (Number(app.state.selected_bar)) app.invokeAction('selectBar', [bar + 1]);
  });

  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || app.state.is_playing || !(event.target instanceof Element)) return;
    const target = event.target.closest<HTMLElement>('[data-studio-seek]');
    if (!target) return;
    const mode = target.dataset.studioSeek!;
    const xOffset = mode === 'beat' ? event.clientX - target.parentElement!.getBoundingClientRect().left : 0;
    seek = { pointerId: event.pointerId, mode, xOffset };
    document.documentElement.setPointerCapture(event.pointerId);
    event.preventDefault();
    update(event);
  });
  document.addEventListener('pointermove', update);
  document.addEventListener('pointerup', event => {
    if (event.pointerId !== seek?.pointerId) return;
    update(event);
    seek = undefined;
  });
  document.addEventListener('pointercancel', event => {
    if (event.pointerId === seek?.pointerId) seek = undefined;
  });
  window.addEventListener('blur', () => { seek = undefined; });

  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.isContentEditable || target?.closest('input, textarea, select')) return;
    if (event.code === 'Space') {
      if (target?.closest('[data-studio-seek-bar]')) return;
      event.preventDefault();
      if (!event.repeat) app.invokeAction(app.state.is_playing ? 'pauseTrack' : 'playTrack', []);
      return;
    }
    if (target?.dataset.studioSeek !== 'progress' || app.state.is_playing) return;
    const beat = Number(app.state.playback_beat) || 0;
    const wanted = { ArrowLeft: beat - 0.25, ArrowRight: beat + 0.25, Home: 0, End: studioDuration(app.state) };
    const position = wanted[event.key as keyof typeof wanted];
    if (typeof position === 'number') {
      event.preventDefault();
      parkAt(position);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-studio-seek="progress"]')?.focus());
    }
  });
}
