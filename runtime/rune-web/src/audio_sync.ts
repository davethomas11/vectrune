import { MusicClock } from './music_clock';
import { STUDIO_STEP_IDS_PER_VOICE } from './studio_sequencer';

// ============================================================================
// Internal Audio Sync Engine for VectRune / Rune-Web
//
// Decoupled, hardware-clock accurate audio synchronization system.
// Coordinates Web Audio hardware timestamps with UI visuals:
// - Manages scheduled visual note queues with sample-level precision
// - Exposes reactive state updates (active step, current bar, playhead)
// - Updates CSS custom properties (--music-beat, --music-bar, --music-progress)
// - Supports declarative data-attributes ([data-sync-step], [data-sync-bar], etc.)
// - Emits window custom events ('rune:music-sync') and supports subscriber listeners
// ============================================================================

export interface ScheduledVisualNote {
  channel: string;
  stepId: number;
  pitch: string | number;
  startTime: number;
  endTime: number;
  beat: number;
  bar: number;
}

export interface AudioSyncSnapshot {
  isPlaying: boolean;
  isPaused: boolean;
  track: string | null;
  tempo: number;
  timeSignature: string;
  currentBeat: number;
  currentBar: number;
  totalBars: number;
  totalBeats: number;
  progressPercent: number;
  activeStepId: number;
  activeBar: number;
  channelStepIds: Record<string, number>;
}

export type AudioSyncListener = (snapshot: AudioSyncSnapshot) => void;

class AudioSyncEngine {
  private scheduledNotes: ScheduledVisualNote[] = [];
  private listeners: Set<AudioSyncListener> = new Set();
  private animFrameId: any = null;

  private isPlaying = false;
  private isPaused = false;
  private activeTrackName: string | null = null;
  private tempoBpm = 128;
  private timeSignature = '4/4';
  private totalBars = 4;
  private totalBeats = 16;
  private clock = new MusicClock(0, 128);
  private parkedBeat = 0;
  private syncPage = true;
  private getAudioCtx: (() => AudioContext | null) | null = null;

  private lastActiveStepId = -1;
  private lastActiveStepIds: number[] = [];
  private lastActiveBar = -1;
  private channelStepIds: Record<string, number> = {};

  /**
   * Configure the audio context provider and track metadata.
   */
  public configure(options: {
    getAudioContext: () => AudioContext | null;
    syncPage?: boolean;
  }): void {
    this.getAudioCtx = options.getAudioContext;
    this.syncPage = options.syncPage ?? true;
  }

  /**
   * Subscribe a callback to audio sync updates.
   */
  public subscribe(listener: AudioSyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Record a scheduled note with its precise Web Audio hardware timestamp.
   */
  public enqueueNote(note: ScheduledVisualNote): void {
    this.scheduledNotes.push(note);
  }

  /**
   * Notify sync engine that playback has started or resumed.
   */
  public onPlay(params: {
    track: string;
    tempo: number;
    timeSignature: string;
    totalBars: number;
    totalBeats: number;
    startTime: number;
    startBeat?: number;
    clock?: MusicClock;
  }): void {
    this.isPlaying = true;
    this.isPaused = false;
    this.activeTrackName = params.track;
    this.tempoBpm = params.tempo;
    this.timeSignature = params.timeSignature;
    this.totalBars = params.totalBars;
    this.totalBeats = params.totalBeats;
    this.clock = params.clock ?? new MusicClock(params.startTime, params.tempo);
    this.parkedBeat = params.startBeat ?? 0;
    this.scheduledNotes = [];
    this.lastActiveStepId = -1;
    this.lastActiveStepIds = [];
    this.lastActiveBar = -1;
    this.channelStepIds = {};

    this.startLoop();
  }

  /**
   * Notify sync engine that playback has paused.
   */
  public onPause(beat = this.getSnapshot().currentBeat): void {
    this.tempoBpm = this.getSnapshot().tempo;
    this.parkedBeat = beat;
    this.isPaused = true;
    this.stopLoop();
    const snapshot = this.getSnapshot();
    this.updatePageState(snapshot.currentBeat, snapshot.currentBar, snapshot.progressPercent, snapshot.activeStepId);
    this.broadcastSnapshot();
  }

  /**
   * Notify sync engine that playback has stopped.
   */
  public onStop(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.activeTrackName = null;
    this.parkedBeat = 0;
    this.scheduledNotes = [];
    this.channelStepIds = {};
    this.lastActiveStepId = -1;
    this.lastActiveStepIds = [];
    this.lastActiveBar = -1;

    this.stopLoop();
    this.clearVisuals();
    this.broadcastSnapshot();
  }

  /**
   * Get current snapshot of the audio sync state.
   */
  public getSnapshot(): AudioSyncSnapshot {
    const ctx = this.getAudioCtx ? this.getAudioCtx() : null;
    const outputLatency = ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0;
    const visualTime = ctx ? Math.max(0, ctx.currentTime - outputLatency) : 0;
    const beat = this.isPlaying && !this.isPaused && this.totalBeats > 0
      ? Math.max(this.parkedBeat, this.clock.beatAt(visualTime)) % this.totalBeats
      : this.parkedBeat;

    const beatsPerBar = this.timeSignature.startsWith('3/') ? 3 : 4;
    const currentBeat = beat;
    const currentBar = Math.min(this.totalBars, Math.floor(currentBeat / beatsPerBar) + 1);
    const progressPercent = this.totalBeats > 0 ? (currentBeat / this.totalBeats) * 100 : 0;

    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      track: this.activeTrackName,
      tempo: this.isPlaying && !this.isPaused ? this.clock.tempoAt(visualTime) : this.tempoBpm,
      timeSignature: this.timeSignature,
      currentBeat,
      currentBar,
      totalBars: this.totalBars,
      totalBeats: this.totalBeats,
      progressPercent,
      activeStepId: this.lastActiveStepId,
      activeBar: currentBar,
      channelStepIds: { ...this.channelStepIds },
    };
  }

  private startLoop(): void {
    if (typeof window === 'undefined') return;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const tick = () => {
      if (!this.isPlaying || this.isPaused) {
        return;
      }
      this.updateFrame();
      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (typeof window === 'undefined') return;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private updateFrame(): void {
    const ctx = this.getAudioCtx ? this.getAudioCtx() : null;
    if (!ctx) return;

    // Sample-accurate output sync: audio latency compensation
    const outputLatency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    const visualTime = ctx.currentTime - outputLatency;

    // Housekeeping: remove old scheduled notes that have passed
    this.scheduledNotes = this.scheduledNotes.filter((n) => n.endTime >= visualTime - 0.5);

    // Find sounding step for each channel right now
    const activeVoice = this.getActiveVoice();
    const currentStepIds: number[] = [];
    this.channelStepIds = {};

    for (const note of this.scheduledNotes) {
      if (visualTime < note.startTime || visualTime >= note.endTime) continue;
      this.channelStepIds[note.channel] = note.stepId;
      if (note.channel === activeVoice) currentStepIds.push(note.stepId);
      else if (note.channel.startsWith(activeVoice + '_studio_')) {
        const lane = Number(note.channel.slice(activeVoice.length + '_studio_'.length));
        if (Number.isInteger(lane) && lane > 0) currentStepIds.push(note.stepId + lane * STUDIO_STEP_IDS_PER_VOICE);
      }
    }
    const currentStepId = currentStepIds[0] ?? -1;
    const changedSteps = currentStepIds.length !== this.lastActiveStepIds.length ||
      currentStepIds.some((id, index) => id !== this.lastActiveStepIds[index]);

    // Calculate current beat and bar based on exact hardware audio clock
    const elapsedBeat = Math.max(this.parkedBeat, this.clock.beatAt(visualTime));
    const beatsPerBar = this.timeSignature.startsWith('3/') ? 3 : 4;
    const currentBeat = this.totalBeats > 0 ? elapsedBeat % this.totalBeats : elapsedBeat;
    const currentBar = Math.min(this.totalBars, Math.floor(currentBeat / beatsPerBar) + 1);
    const progressPercent = this.totalBeats > 0 ? (currentBeat / this.totalBeats) * 100 : 0;

    // 1. Update CSS Custom Properties (Zero-overhead, 60fps GPU rendering)
    if (this.syncPage && typeof document !== 'undefined' && document.documentElement) {
      const rootStyle = document.documentElement.style;
      rootStyle.setProperty('--music-beat', currentBeat.toFixed(3));
      rootStyle.setProperty('--music-bar', String(currentBar));
      rootStyle.setProperty('--music-progress', `${progressPercent.toFixed(2)}%`);
      rootStyle.setProperty('--music-seq-left', `${Math.round(currentBeat * 120)}px`);
      rootStyle.setProperty('--music-playing', this.isPlaying ? '1' : '0');
    }

    // 2. Update generic declarative DOM data attributes
    if (this.syncPage) this.updateDeclarativeDom(currentBeat, progressPercent, currentBar, currentStepIds, changedSteps);

    // 3. Update reactive state if app is present (on note/bar transitions)
    if (changedSteps || currentBar !== this.lastActiveBar) {
      this.lastActiveStepIds = currentStepIds;
      this.lastActiveStepId = currentStepId;
      this.lastActiveBar = currentBar;

      this.updatePageState(currentBeat, currentBar, progressPercent, currentStepId);

      this.broadcastSnapshot();
    }
  }

  private updatePageState(beat: number, bar: number, progress: number, step: number): void {
    if (!this.syncPage || typeof window === 'undefined') return;
    try {
      const state = (window as any)?.__RuneWeb?.ctx?.()?.app?.state;
      if (state) {
        state.playback_step_id = step;
        state.playback_bar = bar;
        state.playback_beat = beat;
        state.playback_progress = progress;
        state.playback_playing = this.isPlaying && !this.isPaused;
      }
    } catch (_) {}
  }

  private updateDeclarativeDom(
    currentBeat: number,
    progressPercent: number,
    currentBar: number,
    currentStepIds: number[],
    changedSteps: boolean,
  ): void {
    if (typeof document === 'undefined') return;

    // Declarative playhead elements: [data-sync-playhead="progress"] or #ruler-playhead
    const progressPlayheads = document.querySelectorAll<HTMLElement>(
      '[data-sync-playhead="progress"], #ruler-playhead',
    );
    progressPlayheads.forEach((el) => {
      el.style.left = `${Math.min(100, Math.max(0, progressPercent))}%`;
      el.style.display = 'block';
    });

    // Declarative beat playhead elements: [data-sync-playhead="beat"] or #seq-playhead
    const beatPlayheads = document.querySelectorAll<HTMLElement>(
      '[data-sync-playhead="beat"], #seq-playhead',
    );
    const beatPosition = (el: HTMLElement): number | undefined => {
      const bar = Number(el.dataset.syncViewBar) || 0;
      if (bar && currentBar !== bar) return;
      const beatsPerBar = this.timeSignature.startsWith('3/') ? 3 : 4;
      const beat = bar ? currentBeat - (bar - 1) * beatsPerBar : currentBeat;
      return Math.round(beat * (Number(el.dataset.syncPixelsPerBeat) || 120));
    };
    beatPlayheads.forEach((el) => {
      const pxLeft = beatPosition(el.parentElement ?? el);
      el.style.display = pxLeft === undefined ? 'none' : 'block';
      if (pxLeft !== undefined) el.style.left = `${pxLeft}px`;
    });

    // Auto-scroll sync container: [data-sync-scroll="beat"] or .matrix-timeline-scroll
    const scrollContainers = document.querySelectorAll<HTMLElement>(
      '[data-sync-scroll="beat"], .matrix-timeline-scroll',
    );
    scrollContainers.forEach((container) => {
      const pxLeft = beatPosition(container);
      if (pxLeft === undefined) return;
      if (pxLeft > container.scrollLeft + container.clientWidth - 140) {
        container.scrollLeft = pxLeft - 60;
      } else if (pxLeft < container.scrollLeft) {
        container.scrollLeft = Math.max(0, pxLeft - 60);
      }
    });

    // Bar highlights: [data-sync-bar="X"] or [data-bar-num="X"]
    if (currentBar !== this.lastActiveBar) {
      document.querySelectorAll('.playing-bar, [data-sync-playing-bar]').forEach((el) => {
        el.classList.remove('playing-bar');
        el.removeAttribute('data-sync-playing-bar');
      });
      document
        .querySelectorAll(
          `[data-sync-bar="${currentBar}"], .ruler-bar-item[data-bar-num="${currentBar}"]`,
        )
        .forEach((el) => {
          el.classList.add('playing-bar');
          el.setAttribute('data-sync-playing-bar', 'true');
        });
    }

    // Apply all sounding steps. Reactive rendering may have replaced the note DOM.
    if (changedSteps) {
      document.querySelectorAll('.playing-step-now, [data-sync-playing-step]').forEach(el => {
        el.classList.remove('playing-step-now');
        el.removeAttribute('data-sync-playing-step');
      });
    }
    for (const id of currentStepIds) {
      document.querySelectorAll(`[data-sync-step="${id}"], [data-step-idx="${id}"]`).forEach(el => {
        el.classList.add('playing-step-now');
        el.setAttribute('data-sync-playing-step', 'true');
      });
    }
  }

  private clearVisuals(): void {
    if (!this.syncPage || typeof document === 'undefined') return;

    if (document.documentElement) {
      const rootStyle = document.documentElement.style;
      rootStyle.setProperty('--music-beat', '0');
      rootStyle.setProperty('--music-bar', '1');
      rootStyle.setProperty('--music-progress', '0%');
      rootStyle.setProperty('--music-seq-left', '0px');
      rootStyle.setProperty('--music-playing', '0');
    }

    document.querySelectorAll('.playing-bar, [data-sync-playing-bar]').forEach((el) => {
      el.classList.remove('playing-bar');
      el.removeAttribute('data-sync-playing-bar');
    });

    document.querySelectorAll('.playing-step-now, [data-sync-playing-step]').forEach((el) => {
      el.classList.remove('playing-step-now');
      el.removeAttribute('data-sync-playing-step');
    });

    const rulerPlayhead = document.getElementById('ruler-playhead');
    if (rulerPlayhead) {
      rulerPlayhead.style.left = '0%';
    }
    const seqPlayhead = document.getElementById('seq-playhead');
    if (seqPlayhead) {
      seqPlayhead.style.left = '0px';
    }

    try {
      const appState = (window as any)?.__RuneWeb?.ctx?.()?.app?.state;
      if (appState) {
        appState.playback_step_id = -1;
        appState.playback_bar = 1;
        appState.playback_beat = 0;
        appState.playback_progress = 0;
        appState.playback_playing = false;
      }
    } catch (_) {}
  }

  private broadcastSnapshot(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[AudioSyncEngine] Listener error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('rune:music-sync', { detail: snapshot }));
      } catch (_) {}
    }
  }

  private getActiveVoice(): string {
    if (!this.syncPage) return 'lead';
    try {
      const voice = (window as any)?.__RuneWeb?.ctx?.()?.app?.state?.active_voice;
      return String(voice || 'lead');
    } catch {
      return 'lead';
    }
  }
}

export const audioSync = new AudioSyncEngine();

