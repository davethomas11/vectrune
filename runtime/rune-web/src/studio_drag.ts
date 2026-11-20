import { updateStudioNoteDrag } from './statement';
import { STUDIO_TICK_WIDTH } from './studio_sequencer';
import type { Scope } from './types';

interface NoteDrag {
  pointerId: number;
  stepId: number;
  resize: boolean;
  grid: HTMLElement;
  startX: number;
  startY: number;
  gridX: number;
  rowHeight: number;
  noteHeight: number;
  preview?: HTMLElement;
}

export function bindStudioNoteDrag(state: Scope): void {
  let drag: NoteDrag | undefined;

  document.addEventListener('pointerdown', (event: PointerEvent) => {
    if (drag || event.button !== 0 || !event.isPrimary || event.shiftKey ||
        state.studio_note_tool === 'select' || state.studio_note_tool === 'paste' || !(event.target instanceof Element)) return;
    const note = event.target.closest<HTMLElement>('[data-studio-note]');
    if (!note || event.target.closest('button')) return;
    const grid = note.closest<HTMLElement>('.matrix-grid-surface');
    if (!grid) return;
    drag = {
      pointerId: event.pointerId,
      stepId: Number(note.dataset.stepIdx),
      resize: Boolean(event.target.closest('[data-studio-resize]')),
      grid,
      startX: event.clientX,
      startY: event.clientY,
      gridX: grid.getBoundingClientRect().left,
      rowHeight: state.active_voice === 'drums' ? 48 : 28,
      noteHeight: note.offsetHeight,
    };
  });

  function update(event: PointerEvent, commit: boolean): void {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.preview) {
      if (commit || Math.max(Math.abs(dx), Math.abs(drag.resize ? 0 : dy)) < 5) return;
      // Capturing on the document element survives renders during playback and
      // directs the follow-up click away from notes and empty grid cells.
      document.documentElement.setPointerCapture(event.pointerId);
      drag.preview = document.createElement('div');
      drag.preview.className = 'studio-drag-preview';
      drag.preview.setAttribute('aria-hidden', 'true');
      (document.fullscreenElement ?? document.body).append(drag.preview);
    }

    const grid = drag.grid.isConnected ? drag.grid : document.querySelector<HTMLElement>('.matrix-grid-surface');
    if (!grid) return;
    const bounds = grid.getBoundingClientRect();
    const columnDelta = Math.round((dx + drag.gridX - bounds.left) / STUDIO_TICK_WIDTH);
    const rowDelta = Math.round(dy / drag.rowHeight);
    const result = updateStudioNoteDrag(state, drag.stepId, columnDelta, rowDelta, drag.resize, commit);
    if (!result || commit) return;

    const left = bounds.left + result.column * STUDIO_TICK_WIDTH;
    const top = bounds.top + result.row * drag.rowHeight + 2;
    const width = result.ticks * STUDIO_TICK_WIDTH - 4;
    const preview = drag.preview;
    const scroller = grid.closest<HTMLElement>('[data-studio-scroll]')?.getBoundingClientRect();
    preview.classList.toggle('studio-drag-blocked', !result.valid);
    Object.assign(preview.style, {
      left: left + 'px',
      top: top + 'px',
      width: width + 'px',
      height: drag.noteHeight + 'px',
      clipPath: scroller
        ? `inset(0 ${Math.max(0, left + width - scroller.right)}px 0 ${Math.max(0, scroller.left - left)}px)`
        : '',
    });
  }

  function stop(): void {
    if (!drag) return;
    drag.preview?.remove();
    drag = undefined;
  }

  document.addEventListener('pointermove', event => update(event, false));
  document.addEventListener('pointerup', event => {
    if (drag?.pointerId !== event.pointerId) return;
    update(event, true);
    stop();
  });
  document.addEventListener('pointercancel', event => {
    if (drag?.pointerId === event.pointerId) stop();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') stop();
  });
  window.addEventListener('blur', stop);
}
