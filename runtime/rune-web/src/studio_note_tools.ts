import { syncSequencerState } from './statement';
import { pasteStudioNotes, STUDIO_TICK_WIDTH, studioBarTicks, type StudioCopiedNote } from './studio_sequencer';
import type { Scope } from './types';

const GRID = '.matrix-grid-surface';
const NOTE = '[data-studio-note]';

function notesInView(state: Scope): Scope[] {
  const bar = Number(state.selected_bar) || 0;
  return ((state.active_steps as Scope[] | undefined) ?? []).filter(step =>
    !step.is_bar && !step.is_rest && (!bar || step.bar_num === bar));
}

function selection(state: Scope): number[] {
  const group = state.studio_selected_notes as Record<string, boolean>;
  return notesInView(state).filter(step => group?.[String(step.id)] || step.id === state.selected_step_id)
    .map(step => Number(step.id));
}

function select(state: Scope, ids: number[]): void {
  const unique = [...new Set(ids)];
  state.selected_step_id = -1;
  state.studio_selected_notes = Object.fromEntries(unique.map(id => [id, true]));
  state.studio_selection_count = unique.length;
}

function position(step: Scope, barTicks: number): number {
  return (Number(step.bar_num) - 1) * barTicks + Math.round(Number(step.matrix_bar_left) / STUDIO_TICK_WIDTH);
}

function pitch(step: Scope): string {
  return (step.chord_notes as string[])[0];
}

export function bindStudioNoteTools(state: Scope): void {
  let clipboard: { notes: StudioCopiedNote[]; percussion: boolean } | undefined;
  let marquee: { pointerId: number; x: number; y: number; additive: boolean; box?: HTMLElement } | undefined;

  function copy(): boolean {
    const ids = new Set(selection(state));
    const selected = notesInView(state).filter(step => ids.has(Number(step.id)));
    if (!selected.length) return false;
    const barTicks = studioBarTicks(String(state.time_signature));
    const start = Math.min(...selected.map(step => position(step, barTicks)));
    clipboard = {
      notes: selected.map(step => ({
        offset: position(step, barTicks) - start,
        pitch: pitch(step),
        ticks: Math.round(Number(step.beats) * 4),
      })),
      percussion: state.active_voice === 'drums',
    };
    state.studio_clipboard_count = selected.length;
    state.status_message = 'Copied ' + selected.length + (selected.length === 1 ? ' note' : ' notes');
    return true;
  }

  function armPaste(): boolean {
    if (!clipboard) return false;
    if (clipboard.percussion !== (state.active_voice === 'drums')) {
      state.status_message = 'Paste pitched notes into a pitched voice, or drum hits into Drums.';
      return true;
    }
    state.studio_note_tool = state.studio_note_tool === 'paste' ? 'edit' : 'paste';
    return true;
  }

  function paste(grid: HTMLElement, x: number): void {
    if (!clipboard) return;
    if (clipboard.percussion !== (state.active_voice === 'drums')) {
      state.status_message = 'Paste pitched notes into a pitched voice, or drum hits into Drums.';
      return;
    }
    const barTicks = studioBarTicks(String(state.time_signature));
    const start = Math.floor((x - grid.getBoundingClientRect().left) / STUDIO_TICK_WIDTH) +
      Math.max(0, Number(state.selected_bar) - 1) * barTicks;
    const key = String(state.active_voice) + '_track';
    const result = pasteStudioNotes(String(state[key] || ''), barTicks, Number(state.bars), start, clipboard.notes);
    if ('error' in result) {
      state.status_message = result.error === 'overlap'
        ? 'A pasted note overlaps an existing note at the same pitch. Choose another step.'
        : 'The pasted notes must fit inside the existing bars. Choose another step or add a bar.';
      return;
    }
    const pasted = new Set(clipboard.notes.map(note => (start + note.offset) + ':' + note.pitch));
    state[key] = result.score;
    syncSequencerState(state);
    select(state, notesInView(state).filter(step => pasted.has(position(step, barTicks) + ':' + pitch(step)))
      .map(step => Number(step.id)));
    state.studio_note_tool = 'select';
    state.status_message = 'Pasted ' + clipboard.notes.length + (clipboard.notes.length === 1 ? ' note' : ' notes');
  }

  document.addEventListener('click', event => {
    if (state.editor_mode !== 'matrix' || !(event.target instanceof Element)) return;
    const tool = event.target.closest<HTMLElement>('[data-studio-note-tool]')?.dataset.studioNoteTool;
    if (tool === 'select') state.studio_note_tool = state.studio_note_tool === 'select' ? 'edit' : 'select';
    if (tool === 'copy') copy();
    if (tool === 'paste') armPaste();

    const grid = event.target.closest<HTMLElement>(GRID);
    if (!grid || (state.studio_note_tool === 'edit' && !event.shiftKey)) return;
    // The ordinary grid and note click actions insert and audition. In tool mode
    // the same surface selects notes or supplies the paste destination instead.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (state.studio_note_tool === 'paste') {
      paste(grid, event.clientX);
      return;
    }
    const note = event.target.closest<HTMLElement>(NOTE);
    if (!note) {
      if (!event.shiftKey) select(state, []);
      return;
    }
    const id = Number(note.dataset.stepIdx);
    const ids = selection(state);
    select(state, ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
  }, true);

  document.addEventListener('contextmenu', event => {
    if (state.studio_note_tool === 'edit' || !(event.target instanceof Element) || !event.target.closest(GRID)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary ||
        (state.studio_note_tool !== 'select' && !(state.studio_note_tool === 'edit' && event.shiftKey)) ||
        !(event.target instanceof Element) || !event.target.closest(GRID)) return;
    marquee = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, additive: event.shiftKey };
  });

  function rectangle(event: PointerEvent) {
    const scroller = document.querySelector('.matrix-container');
    const viewport = scroller?.getBoundingClientRect();
    if (!marquee || !viewport) return;
    const keys = scroller?.querySelector('.matrix-keys-column')?.getBoundingClientRect();
    const x = Math.max(keys?.right ?? viewport.left, Math.min(viewport.right, event.clientX));
    const y = Math.max(viewport.top, Math.min(viewport.bottom, event.clientY));
    return {
      left: Math.min(x, marquee.x), right: Math.max(x, marquee.x),
      top: Math.min(y, marquee.y), bottom: Math.max(y, marquee.y),
    };
  }

  document.addEventListener('pointermove', event => {
    if (event.pointerId !== marquee?.pointerId) return;
    if (!marquee.box && Math.max(Math.abs(event.clientX - marquee.x), Math.abs(event.clientY - marquee.y)) < 5) return;
    const bounds = rectangle(event);
    if (!bounds) return;
    if (!marquee.box) {
      document.documentElement.setPointerCapture(event.pointerId);
      marquee.box = document.createElement('div');
      marquee.box.className = 'studio-note-marquee';
      marquee.box.setAttribute('aria-hidden', 'true');
      (document.fullscreenElement ?? document.body).append(marquee.box);
    }
    Object.assign(marquee.box.style, {
      left: bounds.left + 'px', top: bounds.top + 'px',
      width: bounds.right - bounds.left + 'px', height: bounds.bottom - bounds.top + 'px',
    });
  });

  function clearMarquee(): void {
    marquee?.box?.remove();
    marquee = undefined;
  }

  document.addEventListener('pointerup', event => {
    if (event.pointerId !== marquee?.pointerId) return;
    const bounds = marquee.box && rectangle(event);
    if (bounds) {
      const ids = marquee.additive ? selection(state) : [];
      document.querySelectorAll<HTMLElement>(GRID + ' ' + NOTE).forEach(note => {
        const rect = note.getBoundingClientRect();
        if (rect.left < bounds.right && rect.right > bounds.left && rect.top < bounds.bottom && rect.bottom > bounds.top) {
          ids.push(Number(note.dataset.stepIdx));
        }
      });
      select(state, ids);
    }
    clearMarquee();
  });
  document.addEventListener('pointercancel', event => {
    if (event.pointerId === marquee?.pointerId) clearMarquee();
  });
  window.addEventListener('blur', clearMarquee);

  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || state.editor_mode !== 'matrix' || event.altKey) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.isContentEditable || target?.closest('input, textarea, select')) return;
    if (event.key === 'Escape') {
      clearMarquee();
      state.studio_note_tool = 'edit';
      select(state, []);
      return;
    }
    if ((!event.ctrlKey && !event.metaKey) || event.shiftKey) return;
    const key = event.key.toLowerCase();
    if (key === 'c' && window.getSelection()?.isCollapsed !== false && copy()) event.preventDefault();
    if (key === 'v' && armPaste()) event.preventDefault();
    if (key === 'a') {
      event.preventDefault();
      select(state, notesInView(state).map(step => Number(step.id)));
      state.studio_note_tool = 'select';
    }
  });
}
