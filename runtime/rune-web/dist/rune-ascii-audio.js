"use strict";
var __RuneAsciiAudio = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/ascii_audio.ts
  var ascii_audio_exports = {};
  __export(ascii_audio_exports, {
    pause: () => pauseMusic,
    play: () => playMusic,
    register: () => register,
    resume: () => resumeMusic,
    stop: () => stopMusic
  });

  // src/music_clock.ts
  var MusicClock = class {
    constructor(time, bpm, beat = 0) {
      this.marks = [{ time, bpm, beat }];
    }
    at(position, key) {
      let i = this.marks.length - 1;
      while (i > 0 && this.marks[i][key] > position) i--;
      return this.marks[i];
    }
    beatAt(time) {
      const mark = this.at(time, "time");
      return mark.beat + (time - mark.time) / (60 / mark.bpm);
    }
    timeAt(beat) {
      const mark = this.at(beat, "beat");
      return mark.time + (beat - mark.beat) * (60 / mark.bpm);
    }
    tempoAt(time) {
      return this.at(time, "time").bpm;
    }
    changeAfter(bpm, scheduledUntil) {
      while (this.marks.length > 1 && this.marks[this.marks.length - 1].time > scheduledUntil) {
        this.marks.pop();
      }
      if (this.tempoAt(scheduledUntil) === bpm) return;
      const beat = Math.max(Math.floor(this.beatAt(scheduledUntil)) + 1, this.marks[0].beat);
      this.marks.push({ beat, time: this.timeAt(beat), bpm });
    }
  };

  // src/studio_sequencer.ts
  var STUDIO_STEP_IDS_PER_VOICE = 1e3;

  // src/audio_sync.ts
  var AudioSyncEngine = class {
    constructor() {
      this.scheduledNotes = [];
      this.listeners = /* @__PURE__ */ new Set();
      this.animFrameId = null;
      this.isPlaying = false;
      this.isPaused = false;
      this.activeTrackName = null;
      this.tempoBpm = 128;
      this.timeSignature = "4/4";
      this.totalBars = 4;
      this.totalBeats = 16;
      this.clock = new MusicClock(0, 128);
      this.parkedBeat = 0;
      this.syncPage = true;
      this.getAudioCtx = null;
      this.lastActiveStepId = -1;
      this.lastActiveStepIds = [];
      this.lastActiveBar = -1;
      this.channelStepIds = {};
    }
    /**
     * Configure the audio context provider and track metadata.
     */
    configure(options) {
      this.getAudioCtx = options.getAudioContext;
      this.syncPage = options.syncPage ?? true;
    }
    /**
     * Subscribe a callback to audio sync updates.
     */
    subscribe(listener) {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }
    /**
     * Record a scheduled note with its precise Web Audio hardware timestamp.
     */
    enqueueNote(note) {
      this.scheduledNotes.push(note);
    }
    /**
     * Notify sync engine that playback has started or resumed.
     */
    onPlay(params) {
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
    onPause(beat = this.getSnapshot().currentBeat) {
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
    onStop() {
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
    getSnapshot() {
      const ctx = this.getAudioCtx ? this.getAudioCtx() : null;
      const outputLatency = ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0;
      const visualTime = ctx ? Math.max(0, ctx.currentTime - outputLatency) : 0;
      const beat = this.isPlaying && !this.isPaused && this.totalBeats > 0 ? Math.max(this.parkedBeat, this.clock.beatAt(visualTime)) % this.totalBeats : this.parkedBeat;
      const beatsPerBar = this.timeSignature.startsWith("3/") ? 3 : 4;
      const currentBeat = beat;
      const currentBar = Math.min(this.totalBars, Math.floor(currentBeat / beatsPerBar) + 1);
      const progressPercent = this.totalBeats > 0 ? currentBeat / this.totalBeats * 100 : 0;
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
        channelStepIds: { ...this.channelStepIds }
      };
    }
    startLoop() {
      if (typeof window === "undefined") return;
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
    stopLoop() {
      if (typeof window === "undefined") return;
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
    }
    updateFrame() {
      const ctx = this.getAudioCtx ? this.getAudioCtx() : null;
      if (!ctx) return;
      const outputLatency = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
      const visualTime = ctx.currentTime - outputLatency;
      this.scheduledNotes = this.scheduledNotes.filter((n) => n.endTime >= visualTime - 0.5);
      const activeVoice = this.getActiveVoice();
      const currentStepIds = [];
      this.channelStepIds = {};
      for (const note of this.scheduledNotes) {
        if (visualTime < note.startTime || visualTime >= note.endTime) continue;
        this.channelStepIds[note.channel] = note.stepId;
        if (note.channel === activeVoice) currentStepIds.push(note.stepId);
        else if (note.channel.startsWith(activeVoice + "_studio_")) {
          const lane = Number(note.channel.slice(activeVoice.length + "_studio_".length));
          if (Number.isInteger(lane) && lane > 0) currentStepIds.push(note.stepId + lane * STUDIO_STEP_IDS_PER_VOICE);
        }
      }
      const currentStepId = currentStepIds[0] ?? -1;
      const changedSteps = currentStepIds.length !== this.lastActiveStepIds.length || currentStepIds.some((id, index) => id !== this.lastActiveStepIds[index]);
      const elapsedBeat = Math.max(this.parkedBeat, this.clock.beatAt(visualTime));
      const beatsPerBar = this.timeSignature.startsWith("3/") ? 3 : 4;
      const currentBeat = this.totalBeats > 0 ? elapsedBeat % this.totalBeats : elapsedBeat;
      const currentBar = Math.min(this.totalBars, Math.floor(currentBeat / beatsPerBar) + 1);
      const progressPercent = this.totalBeats > 0 ? currentBeat / this.totalBeats * 100 : 0;
      if (this.syncPage && typeof document !== "undefined" && document.documentElement) {
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty("--music-beat", currentBeat.toFixed(3));
        rootStyle.setProperty("--music-bar", String(currentBar));
        rootStyle.setProperty("--music-progress", `${progressPercent.toFixed(2)}%`);
        rootStyle.setProperty("--music-seq-left", `${Math.round(currentBeat * 120)}px`);
        rootStyle.setProperty("--music-playing", this.isPlaying ? "1" : "0");
      }
      if (this.syncPage) this.updateDeclarativeDom(currentBeat, progressPercent, currentBar, currentStepIds, changedSteps);
      if (changedSteps || currentBar !== this.lastActiveBar) {
        this.lastActiveStepIds = currentStepIds;
        this.lastActiveStepId = currentStepId;
        this.lastActiveBar = currentBar;
        this.updatePageState(currentBeat, currentBar, progressPercent, currentStepId);
        this.broadcastSnapshot();
      }
    }
    updatePageState(beat, bar, progress, step) {
      if (!this.syncPage || typeof window === "undefined") return;
      try {
        const state = window?.__RuneWeb?.ctx?.()?.app?.state;
        if (state) {
          state.playback_step_id = step;
          state.playback_bar = bar;
          state.playback_beat = beat;
          state.playback_progress = progress;
          state.playback_playing = this.isPlaying && !this.isPaused;
        }
      } catch (_) {
      }
    }
    updateDeclarativeDom(currentBeat, progressPercent, currentBar, currentStepIds, changedSteps) {
      if (typeof document === "undefined") return;
      const progressPlayheads = document.querySelectorAll(
        '[data-sync-playhead="progress"], #ruler-playhead'
      );
      progressPlayheads.forEach((el) => {
        el.style.left = `${Math.min(100, Math.max(0, progressPercent))}%`;
        el.style.display = "block";
      });
      const beatPlayheads = document.querySelectorAll(
        '[data-sync-playhead="beat"], #seq-playhead'
      );
      const beatPosition = (el) => {
        const bar = Number(el.dataset.syncViewBar) || 0;
        if (bar && currentBar !== bar) return;
        const beatsPerBar = this.timeSignature.startsWith("3/") ? 3 : 4;
        const beat = bar ? currentBeat - (bar - 1) * beatsPerBar : currentBeat;
        return Math.round(beat * (Number(el.dataset.syncPixelsPerBeat) || 120));
      };
      beatPlayheads.forEach((el) => {
        const pxLeft = beatPosition(el.parentElement ?? el);
        el.style.display = pxLeft === void 0 ? "none" : "block";
        if (pxLeft !== void 0) el.style.left = `${pxLeft}px`;
      });
      const scrollContainers = document.querySelectorAll(
        '[data-sync-scroll="beat"], .matrix-timeline-scroll'
      );
      scrollContainers.forEach((container) => {
        const pxLeft = beatPosition(container);
        if (pxLeft === void 0) return;
        if (pxLeft > container.scrollLeft + container.clientWidth - 140) {
          container.scrollLeft = pxLeft - 60;
        } else if (pxLeft < container.scrollLeft) {
          container.scrollLeft = Math.max(0, pxLeft - 60);
        }
      });
      if (currentBar !== this.lastActiveBar) {
        document.querySelectorAll(".playing-bar, [data-sync-playing-bar]").forEach((el) => {
          el.classList.remove("playing-bar");
          el.removeAttribute("data-sync-playing-bar");
        });
        document.querySelectorAll(
          `[data-sync-bar="${currentBar}"], .ruler-bar-item[data-bar-num="${currentBar}"]`
        ).forEach((el) => {
          el.classList.add("playing-bar");
          el.setAttribute("data-sync-playing-bar", "true");
        });
      }
      if (changedSteps) {
        document.querySelectorAll(".playing-step-now, [data-sync-playing-step]").forEach((el) => {
          el.classList.remove("playing-step-now");
          el.removeAttribute("data-sync-playing-step");
        });
      }
      for (const id of currentStepIds) {
        document.querySelectorAll(`[data-sync-step="${id}"], [data-step-idx="${id}"]`).forEach((el) => {
          el.classList.add("playing-step-now");
          el.setAttribute("data-sync-playing-step", "true");
        });
      }
    }
    clearVisuals() {
      if (!this.syncPage || typeof document === "undefined") return;
      if (document.documentElement) {
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty("--music-beat", "0");
        rootStyle.setProperty("--music-bar", "1");
        rootStyle.setProperty("--music-progress", "0%");
        rootStyle.setProperty("--music-seq-left", "0px");
        rootStyle.setProperty("--music-playing", "0");
      }
      document.querySelectorAll(".playing-bar, [data-sync-playing-bar]").forEach((el) => {
        el.classList.remove("playing-bar");
        el.removeAttribute("data-sync-playing-bar");
      });
      document.querySelectorAll(".playing-step-now, [data-sync-playing-step]").forEach((el) => {
        el.classList.remove("playing-step-now");
        el.removeAttribute("data-sync-playing-step");
      });
      const rulerPlayhead = document.getElementById("ruler-playhead");
      if (rulerPlayhead) {
        rulerPlayhead.style.left = "0%";
      }
      const seqPlayhead = document.getElementById("seq-playhead");
      if (seqPlayhead) {
        seqPlayhead.style.left = "0px";
      }
      try {
        const appState = window?.__RuneWeb?.ctx?.()?.app?.state;
        if (appState) {
          appState.playback_step_id = -1;
          appState.playback_bar = 1;
          appState.playback_beat = 0;
          appState.playback_progress = 0;
          appState.playback_playing = false;
        }
      } catch (_) {
      }
    }
    broadcastSnapshot() {
      const snapshot = this.getSnapshot();
      for (const listener of this.listeners) {
        try {
          listener(snapshot);
        } catch (err) {
          console.error("[AudioSyncEngine] Listener error:", err);
        }
      }
      if (typeof window !== "undefined") {
        try {
          window.dispatchEvent(new CustomEvent("rune:music-sync", { detail: snapshot }));
        } catch (_) {
        }
      }
    }
    getActiveVoice() {
      if (!this.syncPage) return "lead";
      try {
        const voice = window?.__RuneWeb?.ctx?.()?.app?.state?.active_voice;
        return String(voice || "lead");
      } catch {
        return "lead";
      }
    }
  };
  var audioSync = new AudioSyncEngine();

  // src/music_arrangement.ts
  function compileMusicArrangement(def, parse) {
    if (!Object.keys(def.sections ?? {}).length && !def.arrangement?.length) return null;
    const parts = def.sections ?? {}, form = def.arrangement ?? [];
    if (!Object.keys(parts).length || Object.keys(parts).length > 32 || !form.length || form.length > 128)
      throw new Error("Music needs 1-32 sections and 1-128 arrangement entries");
    if (def.lead || def.bass || def.drums || Object.keys(def.tracks ?? {}).length || def.bars != null)
      throw new Error("Arranged music declares bars and note tracks inside sections");
    if (!["4/4", "3/4"].includes(def.time_signature ?? "4/4")) throw new Error("Arranged music supports 4/4 or 3/4 time");
    const beatsPerBar = def.time_signature === "3/4" ? 3 : 4;
    const channels = /* @__PURE__ */ new Set();
    const parsed = /* @__PURE__ */ Object.create(null);
    for (const [name, part] of Object.entries(parts)) {
      const tracks = Object.entries(part).filter(([key]) => key !== "bars");
      if (!name || !Number.isInteger(part.bars) || part.bars < 1 || part.bars > 64 || !tracks.length || tracks.length > 16)
        throw new Error(`Music section ${name} needs 1-64 integer bars and 1-16 tracks`);
      parsed[name] = /* @__PURE__ */ Object.create(null);
      for (const [channel, notes] of tracks) {
        if (typeof notes !== "string") throw new Error(`Music section ${name}/${channel} needs note text`);
        const events = parse(notes);
        const duration = events.reduce((sum, e) => sum + e.beats, 0);
        if (!Number.isFinite(duration) || duration > part.bars * beatsPerBar + 1e-8)
          throw new Error(`Music section ${name}/${channel} exceeds its declared bars`);
        parsed[name][channel] = events;
        channels.add(channel);
      }
    }
    const result = { bars: 0, tracks: /* @__PURE__ */ Object.create(null), sections: [] };
    for (const channel of channels) result.tracks[channel] = [];
    for (const cue of form) {
      const name = typeof cue === "string" ? cue : cue.section;
      const repeat = typeof cue === "string" ? 1 : cue.repeat;
      if (!Object.prototype.hasOwnProperty.call(parts, name)) throw new Error(`Unknown music section: ${name}`);
      if (!Number.isInteger(repeat) || repeat < 1 || repeat > 16) throw new Error("Music section repeat must be an integer from 1 to 16");
      for (let i = 0; i < repeat; i++) {
        const beats = parts[name].bars * beatsPerBar;
        if (result.bars + parts[name].bars > 512) throw new Error("Music arrangement exceeds 512 bars");
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

  // src/audio.ts
  var audioCtx = null;
  var masterGain = null;
  var audioMuted = false;
  var syncPageAudio = true;
  var playbackUnlocked = true;
  var pendingMusic = null;
  function configureAudioHost(options) {
    syncPageAudio = options.syncPage;
    playbackUnlocked = !options.deferPlayback;
    pendingMusic = null;
    audioSync.configure({ getAudioContext: () => audioCtx, syncPage: syncPageAudio });
  }
  function audioOutput(ctx) {
    if (!masterGain) {
      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(audioMuted ? 0 : 1, ctx.currentTime);
      masterGain.connect(ctx.destination);
    }
    return masterGain;
  }
  var registeredMusic = {};
  var arrangements = /* @__PURE__ */ new Map();
  function registerMusic(definitions) {
    if (!definitions) return;
    for (const [key, val] of Object.entries(definitions)) {
      const name = key.toLowerCase();
      const arrangement = compileMusicArrangement(val, parseTrackPattern);
      if (arrangement) arrangements.set(name, arrangement);
      else arrangements.delete(name);
      registeredMusic[name] = arrangement ? { ...val, bars: arrangement.bars } : val;
    }
  }
  function getAudioContext() {
    if (!playbackUnlocked || typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {
      });
    }
    return audioCtx;
  }
  var NOTE_OFFSETS = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  };
  function parseNoteToFreq(noteStr) {
    const trimmed = noteStr.trim();
    const num = Number(trimmed);
    if (!isNaN(num) && num > 0) return num;
    const match = trimmed.toUpperCase().match(/^([A-G])([#B]?)([0-8])$/);
    if (!match) return 440;
    const [, letter, accidental, octaveStr] = match;
    let semitone = NOTE_OFFSETS[letter] || 0;
    if (accidental === "#") semitone += 1;
    else if (accidental === "B") semitone -= 1;
    const octave = parseInt(octaveStr, 10);
    const midi = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  var activeMusicTrackName = null;
  var musicSchedulerTimer = null;
  var musicMasterGain = null;
  var musicEffectsBus = null;
  var clearFadingMusic;
  var musicVolume = 0.2;
  var musicTempoBpm = 128;
  var musicLoop = true;
  var isMusicPaused = false;
  var MUSIC_LOOKAHEAD = 0.25;
  var musicClock = null;
  var musicPausedBeat = 0;
  var tracksState = {};
  function parseTrackPattern(patternStr) {
    const events = [];
    const clean = patternStr.replace(/^\s*#.*$/gm, "").replace(/\s+#.*$/gm, "");
    const tokens = clean.split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === "|") {
        continue;
      }
      let noteToken = token;
      let durationNum = 8;
      if (token.startsWith("[") && token.includes("]")) {
        const closeIdx = token.indexOf("]");
        noteToken = token.slice(1, closeIdx);
        const after = token.slice(closeIdx + 1);
        if (after.startsWith(":")) {
          durationNum = Number(after.slice(1)) || 8;
        }
      } else {
        const parts = token.split(":");
        noteToken = parts[0].trim();
        durationNum = parts.length > 1 ? Number(parts[1].trim()) : 8;
      }
      const beats = durationNum > 0 ? 4 / durationNum : 0.5;
      if (noteToken === "-" || noteToken.toUpperCase() === "R" || noteToken === "_") {
        events.push({ stepId: i, pitch: 0, beats, isRest: true, isDrum: false });
        continue;
      }
      const subNotes = noteToken.split(/[,+]/).map((s) => s.trim()).filter(Boolean);
      const drumNames = ["kick", "snare", "hihat", "crash", "tom"];
      if (subNotes.length > 1) {
        const isAnyDrum = subNotes.some((s) => drumNames.includes(s.toLowerCase()));
        const pitches = subNotes.map((s) => {
          if (drumNames.includes(s.toLowerCase())) return s.toLowerCase();
          return parseNoteToFreq(s);
        });
        events.push({
          stepId: i,
          pitch: pitches[0],
          pitches,
          beats,
          isRest: false,
          isDrum: isAnyDrum
        });
      } else {
        const s = subNotes[0] || noteToken;
        if (drumNames.includes(s.toLowerCase())) {
          events.push({ stepId: i, pitch: s.toLowerCase(), beats, isRest: false, isDrum: true });
        } else {
          events.push({ stepId: i, pitch: parseNoteToFreq(s), beats, isRest: false, isDrum: false });
        }
      }
    }
    return events;
  }
  function playMusic(trackName, startBeat = 0, fadeSeconds = 0) {
    if (!playbackUnlocked) {
      pendingMusic = { track: trackName, beat: startBeat };
      return;
    }
    const ctx = getAudioContext();
    if (!ctx) return;
    const key = String(trackName || "").trim().toLowerCase();
    const def = registeredMusic[key];
    if (!def) {
      return;
    }
    const fade = Number.isFinite(fadeSeconds) ? Math.min(5, Math.max(0, fadeSeconds)) : 0;
    const outgoing = fade > 0 && musicMasterGain ? { gain: musicMasterGain, effects: musicEffectsBus } : null;
    if (outgoing) {
      musicMasterGain = null;
      musicEffectsBus = null;
    }
    stopMusic();
    activeMusicTrackName = key;
    musicTempoBpm = def.tempo || 128;
    musicLoop = def.loop_track !== false;
    musicVolume = def.volume !== void 0 ? def.volume : 0.2;
    isMusicPaused = false;
    tracksState = {};
    if (def.lead) {
      tracksState.lead = { events: parseTrackPattern(def.lead), index: 0, nextBeat: 0, instrument: "square" };
    }
    if (def.bass) {
      tracksState.bass = { events: parseTrackPattern(def.bass), index: 0, nextBeat: 0, instrument: "triangle" };
    }
    if (def.drums) {
      tracksState.drums = { events: parseTrackPattern(def.drums), index: 0, nextBeat: 0, instrument: "drums" };
    }
    if (def.tracks) {
      for (const [tName, tVal] of Object.entries(def.tracks)) {
        if (!tVal) continue;
        if (typeof tVal === "string") {
          tracksState[tName] = {
            events: parseTrackPattern(tVal),
            index: 0,
            nextBeat: 0,
            instrument: "sawtooth"
          };
        } else if (typeof tVal === "object" && tVal.notes) {
          tracksState[tName] = {
            events: parseTrackPattern(tVal.notes),
            index: 0,
            nextBeat: 0,
            instrument: tVal.instrument || "sawtooth",
            volume: tVal.volume,
            pan: tVal.pan,
            muted: tVal.muted
          };
        }
      }
    }
    const arrangement = arrangements.get(key);
    if (arrangement) {
      tracksState = /* @__PURE__ */ Object.create(null);
      for (const [channel, events] of Object.entries(arrangement.tracks)) {
        tracksState[channel] = {
          events,
          index: 0,
          nextBeat: 0,
          instrument: channel === "drums" ? "drums" : channel === "bass" ? "triangle" : "square"
        };
      }
    }
    for (const [channel, instrument] of Object.entries(def.instruments ?? {})) {
      if (Object.prototype.hasOwnProperty.call(tracksState, channel)) tracksState[channel].instrument = instrument;
    }
    const startTime = ctx.currentTime + 0.05;
    startMusicAtBeat(ctx, key, startBeat, startTime, outgoing ? fade : 0);
    if (outgoing) fadeOutMusic(ctx, outgoing, startTime, fade);
  }
  function musicTiming(track) {
    const def = registeredMusic[track];
    const timeSignature = def?.time_signature || "4/4";
    const beatsPerBar = timeSignature.startsWith("3/") ? 3 : 4;
    const maxTrackBeats = Math.max(0, ...Object.values(tracksState).map(
      (state) => state.events.reduce((sum, event) => sum + event.beats, 0)
    ));
    const appBars = syncPageAudio ? Number(window?.__RuneWeb?.ctx?.()?.app?.state?.bars) : 0;
    const totalBars = appBars > 0 ? appBars : def?.bars || (maxTrackBeats ? Math.ceil(maxTrackBeats / beatsPerBar) : 4);
    return { timeSignature, totalBars, totalBeats: Math.max(maxTrackBeats, totalBars * beatsPerBar) };
  }
  function generateReverbImpulse(ctx, decay = 1.5, preDelay = 0.01, reverse = false) {
    const sampleRate = ctx.sampleRate || 44100;
    const length = Math.max(128, Math.floor(sampleRate * Math.max(0.05, Math.min(10, decay))));
    const buffer = ctx.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const preDelaySamples = Math.floor(sampleRate * Math.max(0, preDelay));
    for (let i = 0; i < length; i++) {
      if (i < preDelaySamples) {
        left[i] = 0;
        right[i] = 0;
      } else {
        const idx = reverse ? length - 1 - i : i - preDelaySamples;
        const progress = idx / (length - preDelaySamples);
        const env = Math.exp(-3.5 * progress);
        left[i] = (Math.random() * 2 - 1) * env;
        right[i] = (Math.random() * 2 - 1) * env;
      }
    }
    return buffer;
  }
  function generateBitcrushCurve(bits = 8, drive = 0) {
    const n = 4096;
    const curve = new Float32Array(n);
    const clampedBits = Math.max(2, Math.min(16, bits));
    const steps = Math.pow(2, clampedBits);
    const driveGain = 1 + Math.max(0, Math.min(5, drive * 4));
    for (let i = 0; i < n; i++) {
      let x = i * 2 / (n - 1) - 1;
      if (drive > 0) {
        x = Math.tanh(x * driveGain);
      }
      if (clampedBits < 16) {
        x = Math.round(x * (steps / 2)) / (steps / 2);
      }
      curve[i] = Math.max(-1, Math.min(1, x));
    }
    return curve;
  }
  function buildMusicEffectsBus(ctx, def, channels, destination) {
    const fx = def.effects || {};
    const reverbConfig = fx.reverb || def.reverb;
    const delayConfig = fx.delay || def.delay;
    const filterConfig = fx.filter || def.filter;
    const crushConfig = fx.crush || fx.drive || def.crush;
    const chorusConfig = fx.chorus || def.chorus;
    const trackFx = def.track_effects || fx.tracks || {};
    if (!reverbConfig && !delayConfig && !filterConfig && !crushConfig && !chorusConfig && !Object.keys(trackFx).length) {
      return null;
    }
    const nodesToClean = [];
    const lfoNodes = [];
    const dryBus = ctx.createGain();
    dryBus.gain.setValueAtTime(1, ctx.currentTime);
    nodesToClean.push(dryBus);
    let insertHead = dryBus;
    if (filterConfig && typeof ctx.createBiquadFilter === "function") {
      const fNode = ctx.createBiquadFilter();
      fNode.type = filterConfig.type || "lowpass";
      const cutoff = filterConfig.cutoff || filterConfig.frequency || 4e3;
      fNode.frequency.setValueAtTime(Math.max(20, Math.min(2e4, cutoff)), ctx.currentTime);
      const q = filterConfig.q || filterConfig.resonance || 1;
      fNode.Q.setValueAtTime(Math.max(0.1, q), ctx.currentTime);
      insertHead.connect(fNode);
      insertHead = fNode;
      nodesToClean.push(fNode);
    }
    if (crushConfig && typeof ctx.createWaveShaper === "function") {
      const wsNode = ctx.createWaveShaper();
      const bits = crushConfig.bits !== void 0 ? crushConfig.bits : 8;
      const drive = crushConfig.drive !== void 0 ? crushConfig.drive : 0;
      wsNode.curve = generateBitcrushCurve(bits, drive);
      wsNode.oversample = "none";
      insertHead.connect(wsNode);
      insertHead = wsNode;
      nodesToClean.push(wsNode);
    }
    insertHead.connect(destination);
    let delayInput = null;
    if (delayConfig && typeof ctx.createDelay === "function") {
      delayInput = ctx.createGain();
      delayInput.gain.setValueAtTime(1, ctx.currentTime);
      nodesToClean.push(delayInput);
      const dNode = ctx.createDelay(5);
      const dTime = Math.max(0.01, Math.min(4, delayConfig.time ?? 0.25));
      dNode.delayTime.setValueAtTime(dTime, ctx.currentTime);
      const dampFilter = ctx.createBiquadFilter();
      dampFilter.type = "lowpass";
      const dampFreq = delayConfig.damping || delayConfig.filter || 2800;
      dampFilter.frequency.setValueAtTime(dampFreq, ctx.currentTime);
      const fbGain = ctx.createGain();
      const fbVal = Math.max(0, Math.min(0.92, delayConfig.feedback ?? 0.35));
      fbGain.gain.setValueAtTime(fbVal, ctx.currentTime);
      const delayWet = ctx.createGain();
      const dWetVal = Math.max(0, Math.min(1, delayConfig.wet ?? 0.25));
      delayWet.gain.setValueAtTime(dWetVal, ctx.currentTime);
      delayInput.connect(dNode);
      dNode.connect(dampFilter);
      dampFilter.connect(fbGain);
      fbGain.connect(dNode);
      dampFilter.connect(delayWet);
      delayWet.connect(destination);
      nodesToClean.push(dNode, dampFilter, fbGain, delayWet);
    }
    let revInput = null;
    if (reverbConfig && typeof ctx.createConvolver === "function") {
      revInput = ctx.createGain();
      revInput.gain.setValueAtTime(1, ctx.currentTime);
      nodesToClean.push(revInput);
      const conv = ctx.createConvolver();
      conv.buffer = generateReverbImpulse(
        ctx,
        reverbConfig.decay ?? 1.5,
        reverbConfig.pre_delay ?? 0.01,
        reverbConfig.reverse ?? false
      );
      revInput.connect(conv);
      nodesToClean.push(conv);
      let revOut = conv;
      if (reverbConfig.filter) {
        const rf = ctx.createBiquadFilter();
        rf.type = "lowpass";
        rf.frequency.setValueAtTime(reverbConfig.filter, ctx.currentTime);
        conv.connect(rf);
        revOut = rf;
        nodesToClean.push(rf);
      }
      const revWet = ctx.createGain();
      const wetVal = Math.max(0, Math.min(1, reverbConfig.wet ?? 0.25));
      revWet.gain.setValueAtTime(wetVal, ctx.currentTime);
      revOut.connect(revWet);
      revWet.connect(destination);
      nodesToClean.push(revWet);
    }
    let chorusInput = null;
    if (chorusConfig && typeof ctx.createDelay === "function" && typeof ctx.createOscillator === "function") {
      chorusInput = ctx.createGain();
      chorusInput.gain.setValueAtTime(1, ctx.currentTime);
      nodesToClean.push(chorusInput);
      const cd = ctx.createDelay(0.1);
      const baseDelay = chorusConfig.delay ?? 0.018;
      cd.delayTime.setValueAtTime(baseDelay, ctx.currentTime);
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      const rate = chorusConfig.rate ?? 1.2;
      lfo.frequency.setValueAtTime(rate, ctx.currentTime);
      const lfoGain = ctx.createGain();
      const depth = chorusConfig.depth ?? 25e-4;
      lfoGain.gain.setValueAtTime(depth, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(cd.delayTime);
      lfo.start(ctx.currentTime);
      lfoNodes.push(lfo);
      const chorusWet = ctx.createGain();
      const cWetVal = Math.max(0, Math.min(1, chorusConfig.wet ?? 0.3));
      chorusWet.gain.setValueAtTime(cWetVal, ctx.currentTime);
      chorusInput.connect(cd);
      cd.connect(chorusWet);
      chorusWet.connect(destination);
      nodesToClean.push(cd, lfoGain, chorusWet);
    }
    const masterInput = ctx.createGain();
    masterInput.gain.setValueAtTime(1, ctx.currentTime);
    masterInput.connect(dryBus);
    nodesToClean.push(masterInput);
    const channelGains = {};
    for (const ch of channels) {
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(1, ctx.currentTime);
      cg.connect(dryBus);
      nodesToClean.push(cg);
      const chFx = trackFx[ch] || {};
      if (delayInput) {
        let dSend = 0;
        if (chFx.delay !== void 0) {
          dSend = chFx.delay;
        } else if (delayConfig?.tracks) {
          dSend = delayConfig.tracks.includes(ch) ? 1 : 0;
        } else {
          dSend = ch === "drums" || ch === "bass" ? 0 : 1;
        }
        if (dSend > 0) {
          const sg = ctx.createGain();
          sg.gain.setValueAtTime(dSend, ctx.currentTime);
          cg.connect(sg);
          sg.connect(delayInput);
          nodesToClean.push(sg);
        }
      }
      if (revInput) {
        let rSend = 0;
        if (chFx.reverb !== void 0) {
          rSend = chFx.reverb;
        } else if (reverbConfig?.tracks) {
          rSend = reverbConfig.tracks.includes(ch) ? 1 : 0;
        } else {
          rSend = ch === "bass" ? 0.05 : ch === "drums" ? 0.25 : 1;
        }
        if (rSend > 0) {
          const sg = ctx.createGain();
          sg.gain.setValueAtTime(rSend, ctx.currentTime);
          cg.connect(sg);
          sg.connect(revInput);
          nodesToClean.push(sg);
        }
      }
      if (chorusInput) {
        let cSend = 0;
        if (chFx.chorus !== void 0) {
          cSend = chFx.chorus;
        } else {
          cSend = ch === "drums" || ch === "bass" ? 0 : 0.8;
        }
        if (cSend > 0) {
          const sg = ctx.createGain();
          sg.gain.setValueAtTime(cSend, ctx.currentTime);
          cg.connect(sg);
          sg.connect(chorusInput);
          nodesToClean.push(sg);
        }
      }
      channelGains[ch] = cg;
    }
    const cleanup = () => {
      for (const lfo of lfoNodes) {
        try {
          lfo.stop();
        } catch {
        }
        try {
          lfo.disconnect();
        } catch {
        }
      }
      for (const n of nodesToClean) {
        try {
          n.disconnect?.();
        } catch {
        }
      }
    };
    return {
      masterInput,
      channelGains,
      lfoNodes,
      cleanup
    };
  }
  function startMusicAtBeat(ctx, trackName, startBeat, startTime = ctx.currentTime + 0.05, fade = 0) {
    const timing = musicTiming(trackName);
    const beat = Math.max(0, Math.min(timing.totalBeats - 1e-6, Number.isFinite(startBeat) ? startBeat : 0));
    for (const track of Object.values(tracksState)) {
      let onset = 0;
      track.index = track.events.findIndex((event) => {
        if (onset + event.beats > beat) return true;
        onset += event.beats;
        return false;
      });
      if (track.index < 0) track.index = track.events.length;
      track.nextBeat = track.index === track.events.length ? onset : beat;
      track.elapsedInNote = track.index === track.events.length ? 0 : beat - onset;
    }
    musicMasterGain = ctx.createGain();
    if (fade > 0) {
      musicMasterGain.gain.setValueAtTime(0, startTime);
      musicMasterGain.gain.linearRampToValueAtTime(musicVolume, startTime + fade);
    } else {
      musicMasterGain.gain.setValueAtTime(musicVolume, ctx.currentTime);
    }
    musicMasterGain.connect(audioOutput(ctx));
    const def = registeredMusic[trackName];
    musicEffectsBus = def ? buildMusicEffectsBus(ctx, def, Object.keys(tracksState), musicMasterGain) : null;
    musicClock = new MusicClock(startTime, musicTempoBpm, beat);
    audioSync.configure({ getAudioContext: () => audioCtx, syncPage: syncPageAudio });
    audioSync.onPlay({ ...timing, track: trackName, tempo: musicTempoBpm, startTime, startBeat: beat, clock: musicClock });
    scheduleMusicTicks();
    musicSchedulerTimer = setInterval(scheduleMusicTicks, 25);
  }
  function stopMusic() {
    pendingMusic = null;
    audioSync.onStop();
    if (musicSchedulerTimer) {
      clearInterval(musicSchedulerTimer);
      musicSchedulerTimer = null;
    }
    activeMusicTrackName = null;
    musicPausedBeat = 0;
    isMusicPaused = false;
    tracksState = {};
    musicClock = null;
    clearFadingMusic?.();
    disconnectMusicGain();
  }
  function fadeOutMusic(ctx, outgoing, startTime, fade) {
    const gain = outgoing.gain.gain;
    const volume = gain.value;
    gain.cancelScheduledValues(ctx.currentTime);
    gain.setValueAtTime(volume, startTime);
    const endTime = startTime + fade;
    gain.linearRampToValueAtTime(0, endTime);
    let timer;
    function dispose() {
      clearTimeout(timer);
      outgoing.effects?.cleanup();
      outgoing.gain.disconnect();
      clearFadingMusic = void 0;
    }
    function checkTail() {
      if (ctx.currentTime >= endTime) dispose();
      else timer = setTimeout(checkTail, Math.max(25, (endTime - ctx.currentTime) * 1e3));
    }
    timer = setTimeout(checkTail, (endTime - ctx.currentTime) * 1e3);
    clearFadingMusic = dispose;
  }
  function disconnectMusicGain() {
    if (musicEffectsBus) {
      musicEffectsBus.cleanup();
      musicEffectsBus = null;
    }
    if (!musicMasterGain) return;
    musicMasterGain.disconnect();
    musicMasterGain = null;
  }
  function pauseMusic() {
    if (isMusicPaused || !activeMusicTrackName) return;
    musicPausedBeat = audioSync.getSnapshot().currentBeat;
    isMusicPaused = true;
    if (musicSchedulerTimer) {
      clearInterval(musicSchedulerTimer);
      musicSchedulerTimer = null;
    }
    clearFadingMusic?.();
    disconnectMusicGain();
    audioSync.onPause(musicPausedBeat);
  }
  function resumeMusic() {
    const ctx = getAudioContext();
    if (!ctx || !isMusicPaused || !activeMusicTrackName) return;
    isMusicPaused = false;
    startMusicAtBeat(ctx, activeMusicTrackName, musicPausedBeat);
  }
  function scheduleMusicTicks() {
    const ctx = getAudioContext();
    const clock = musicClock;
    if (!ctx || !clock || !musicMasterGain || isMusicPaused || !activeMusicTrackName) return;
    const lookaheadWindow = ctx.currentTime + MUSIC_LOOKAHEAD;
    const { totalBeats: songTotalBeats } = musicTiming(activeMusicTrackName);
    let allFinished = true;
    for (const [trackKey, track] of Object.entries(tracksState)) {
      if (!track || !track.events.length || track.muted) continue;
      while (true) {
        if (track.index >= track.events.length) {
          if (musicLoop) {
            if (songTotalBeats > 0) {
              const currentIteration = Math.floor((track.nextBeat - 1e-4) / songTotalBeats);
              track.nextBeat = (currentIteration + 1) * songTotalBeats;
            }
            track.index = 0;
          } else {
            break;
          }
        }
        const eventTime = clock.timeAt(track.nextBeat);
        if (eventTime >= lookaheadWindow) break;
        const event = track.events[track.index];
        const remainingBeats = event.beats - (track.elapsedInNote ?? 0);
        const eventDurationSec = clock.timeAt(track.nextBeat + remainingBeats) - eventTime;
        if (!event.isRest && eventTime >= ctx.currentTime - 0.05) {
          const targetDest = musicEffectsBus ? musicEffectsBus.channelGains[trackKey] || musicEffectsBus.masterInput : musicMasterGain;
          scheduleTrackNote(ctx, trackKey, event, eventTime, eventDurationSec, targetDest, track.instrument);
        }
        track.nextBeat += remainingBeats;
        track.elapsedInNote = 0;
        track.index += 1;
      }
      if (track.index < track.events.length || musicLoop) {
        allFinished = false;
      }
    }
    if (allFinished && !musicLoop && ctx.currentTime >= clock.timeAt(songTotalBeats)) {
      stopMusic();
    }
  }
  function scheduleTrackNote(ctx, channel, event, time, durationSec, destination, instrumentOverride) {
    audioSync.enqueueNote({
      channel,
      stepId: event.stepId ?? -1,
      pitch: event.pitch,
      startTime: time,
      endTime: time + durationSec,
      beat: 0,
      bar: 1
    });
    playTrackNote(ctx, channel, event, time, durationSec, destination, instrumentOverride);
  }
  function playTrackNote(ctx, channel, event, time, durationSec, destination, instrumentOverride) {
    const isDrumChannel = channel === "drums" || instrumentOverride === "drums" || event.isDrum;
    const pitchesToPlay = event.pitches && event.pitches.length > 0 ? event.pitches : [event.pitch];
    const chordGainMultiplier = 1 / Math.sqrt(Math.max(1, pitchesToPlay.length));
    for (const p of pitchesToPlay) {
      if (isDrumChannel || typeof p === "string") {
        const drumType = String(p).toLowerCase();
        if (drumType === "kick") {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(130, time);
          osc2.frequency.exponentialRampToValueAtTime(32, time + Math.min(durationSec, 0.08));
          gain2.gain.setValueAtTime(0.4 * chordGainMultiplier, time);
          gain2.gain.exponentialRampToValueAtTime(1e-3, time + Math.min(durationSec, 0.08));
          osc2.connect(gain2);
          gain2.connect(destination);
          osc2.start(time);
          osc2.stop(time + Math.min(durationSec, 0.09));
        } else if (drumType === "snare") {
          playNoiseBurstToDestination(ctx, time, Math.min(durationSec, 0.09), 1600, 300, 0.3 * chordGainMultiplier, destination, "bandpass");
        } else if (drumType === "hihat") {
          playNoiseBurstToDestination(ctx, time, Math.min(durationSec, 0.04), 7e3, 5e3, 0.15 * chordGainMultiplier, destination, "highpass");
        } else if (drumType === "crash") {
          playNoiseBurstToDestination(ctx, time, Math.min(durationSec, 0.25), 5e3, 1e3, 0.2 * chordGainMultiplier, destination, "bandpass");
        } else if (drumType === "tom") {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(220, time);
          osc2.frequency.exponentialRampToValueAtTime(70, time + Math.min(durationSec, 0.12));
          gain2.gain.setValueAtTime(0.35 * chordGainMultiplier, time);
          gain2.gain.exponentialRampToValueAtTime(1e-3, time + Math.min(durationSec, 0.12));
          osc2.connect(gain2);
          gain2.connect(destination);
          osc2.start(time);
          osc2.stop(time + Math.min(durationSec, 0.13));
        }
        continue;
      }
      const freq = typeof p === "number" ? p : parseNoteToFreq(p);
      if (freq <= 0) continue;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const inst = instrumentOverride || (channel === "bass" ? "triangle" : "square");
      if (inst === "brass" || inst === "strings" || inst === "bell") {
        const isBell = inst === "bell";
        const isStrings = inst === "strings";
        const length = Math.max(0.06, durationSec * (isBell ? 1.25 : 1));
        const attack = Math.min(length * 0.25, isStrings ? 0.06 : 0.018);
        osc.type = inst === "brass" ? "sawtooth" : isStrings ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, time);
        const peak = (isStrings ? 0.13 : 0.23) * chordGainMultiplier;
        gain.gain.setValueAtTime(1e-3, time);
        gain.gain.linearRampToValueAtTime(peak, time + attack);
        if (isBell) {
          gain.gain.exponentialRampToValueAtTime(1e-3, time + length);
        } else {
          const sustainLevel = peak * 0.82;
          const releaseTime = Math.min(0.04, durationSec * 0.08);
          const sustainEnd = time + Math.max(attack, durationSec - releaseTime);
          gain.gain.linearRampToValueAtTime(sustainLevel, time + attack + 0.04);
          gain.gain.setValueAtTime(sustainLevel, sustainEnd);
          gain.gain.exponentialRampToValueAtTime(1e-3, time + durationSec);
        }
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(Math.min(9e3, freq * (inst === "brass" ? 5 : 3)), time);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + (isBell ? length : durationSec) + 0.015);
      } else if (inst === "sawtooth" || inst === "synth") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);
        const releaseTime = Math.min(0.035, durationSec * 0.08);
        const sustainEnd = time + Math.max(0.02, durationSec - releaseTime);
        const peak = 0.18 * chordGainMultiplier;
        gain.gain.setValueAtTime(peak, time);
        if (sustainEnd > time + 0.04) {
          gain.gain.setValueAtTime(peak * 0.85, sustainEnd);
        }
        gain.gain.exponentialRampToValueAtTime(2e-3, time + durationSec);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + durationSec + 0.01);
      } else if (inst === "triangle" || inst === "bass") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = durationSec * 0.9;
        const peak = 0.28 * chordGainMultiplier;
        gain.gain.setValueAtTime(peak, time);
        const sustainEnd = time + durationSec * 0.82;
        if (sustainEnd > time + 0.04) {
          gain.gain.setValueAtTime(peak * 0.9, sustainEnd);
        }
        gain.gain.exponentialRampToValueAtTime(3e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      } else if (inst === "sine") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time);
        const releaseTime = Math.min(0.03, durationSec * 0.08);
        const sustainEnd = time + Math.max(0.02, durationSec - releaseTime);
        const peak = 0.25 * chordGainMultiplier;
        gain.gain.setValueAtTime(peak, time);
        if (sustainEnd > time + 0.04) {
          gain.gain.setValueAtTime(peak * 0.9, sustainEnd);
        }
        gain.gain.exponentialRampToValueAtTime(2e-3, time + durationSec);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + durationSec + 0.01);
      } else if (inst === "pluck") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = Math.min(durationSec * 0.85, 0.45);
        gain.gain.setValueAtTime(0.3 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(1e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      } else {
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, time);
        const releaseTime = Math.min(0.03, durationSec * 0.08);
        const sustainEnd = time + Math.max(0.02, durationSec - releaseTime);
        const peak = 0.2 * chordGainMultiplier;
        gain.gain.setValueAtTime(peak, time);
        if (sustainEnd > time + 0.04) {
          gain.gain.setValueAtTime(peak * 0.85, sustainEnd);
        }
        gain.gain.exponentialRampToValueAtTime(2e-3, time + durationSec);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + durationSec + 0.01);
      }
    }
  }
  function playNoiseBurstToDestination(ctx, now, duration, filterStart, filterEnd, volume, destination, filterType = "lowpass") {
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(20, filterStart), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), now + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise.start(now);
    noise.stop(now + duration + 0.01);
  }

  // src/ascii_audio.ts
  function register(definitions) {
    configureAudioHost({ syncPage: false });
    for (const [name, definition] of Object.entries(definitions)) {
      const patterns = [
        definition.lead,
        definition.bass,
        definition.drums,
        ...Object.values(definition.tracks ?? {})
      ];
      let count = 0;
      for (const pattern of patterns) {
        if (!pattern) continue;
        if (typeof pattern !== "string") throw new Error(`AsciiMusic/${name}: tracks must be note strings`);
        const tokens = pattern.split(/\s+/).filter(Boolean);
        const pitch = "(?:[A-Ga-g][#bB]?[0-8]|kick|snare|hihat|crash|tom)";
        const chord = `${pitch}(?:[,+]${pitch}){0,7}`;
        const token = new RegExp(`^(?:${chord}|\\[${chord}\\]|-|R|_)(?::(?:1|2|4|8|16|32))?$`);
        for (const value of tokens) {
          if (value !== "|" && !token.test(value)) throw new Error(`AsciiMusic/${name}: invalid note ${value}`);
        }
        count += parseTrackPattern(pattern).length;
      }
      if (count < 1 || count > 4096) throw new Error(`AsciiMusic/${name}: needs 1-4096 note/rest events`);
    }
    registerMusic(definitions);
  }
  return __toCommonJS(ascii_audio_exports);
})();
