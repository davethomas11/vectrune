import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class Param {
  value = 0;
  setValueAtTime = vi.fn((value: number, _time: number) => { this.value = value; });
  exponentialRampToValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}
class Node {
  gain = new Param(); frequency = new Param(); Q = new Param(); delayTime = new Param();
  connect = vi.fn(); disconnect = vi.fn(); start = vi.fn(); stop = vi.fn();
  type = 'square'; buffer: unknown; curve: unknown; oversample = 'none';
}
class Context {
  static instances: Context[] = [];
  state = 'running'; currentTime = 0; sampleRate = 8000;
  destination = {}; gains: Node[] = []; oscillators: Node[] = [];
  constructor() { Context.instances.push(this); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createGain() { const node = new Node(); this.gains.push(node); return node; }
  createOscillator() { const node = new Node(); this.oscillators.push(node); return node; }
  createBufferSource() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createDelay(_max?: number) { return new Node(); }
  createConvolver() { return new Node(); }
  createWaveShaper() { return new Node(); }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
}

let audio: typeof import('../src/audio');
let sync: typeof import('../src/audio_sync');
let host: Record<string, unknown>;
let readHost: ReturnType<typeof vi.fn>;
let frames: FrameRequestCallback[];

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); Context.instances = []; frames = []; host = { bars:4 };
  readHost = vi.fn(() => ({app:{state:host}}));
  vi.stubGlobal('window',{AudioContext:Context,__RuneWeb:{ctx:readHost},dispatchEvent:vi.fn()});
  vi.stubGlobal('requestAnimationFrame',vi.fn((callback: FrameRequestCallback) => { frames.push(callback); return frames.length; }));
  vi.stubGlobal('cancelAnimationFrame',vi.fn());
  audio = await import('../src/audio'); sync = await import('../src/audio_sync');
  audio.registerMusic({march:{music_type:'8bit',tempo:120,volume:0.1,loop_track:true,lead:'E4:4 G4:4',bass:'E2:4 B1:4'}});
});
afterEach(() => { audio.stopMusic(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('shared audio lifecycle', () => {
  it('keeps the outgoing tail connected while the incoming track fades in', () => {
    audio.configureAudioHost({syncPage:false});
    audio.playMusic('march');
    const context = Context.instances[0], outgoing = context.gains[0];
    audio.registerMusic({return_run:{tempo:132,volume:0.06,lead:'E4:1',loop_track:true}});
    context.currentTime = 0.25;
    const before = context.gains.length;
    audio.playMusic('return_run', 0, 0.45);
    const incoming = context.gains[before];
    expect(outgoing.disconnect).not.toHaveBeenCalled();
    expect(outgoing.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.75);
    expect(incoming.gain.setValueAtTime).toHaveBeenCalledWith(0, 0.3);
    expect(incoming.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.06, 0.75);
    expect(sync.audioSync.getSnapshot().track).toBe('return_run');
    context.currentTime = 0.76;
    vi.advanceTimersByTime(500);
    expect(outgoing.disconnect).toHaveBeenCalledOnce();
    expect(incoming.disconnect).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    context.currentTime = 0.8;
    audio.playMusic('march', 0, 0.45);
    audio.pauseMusic();
    expect(incoming.disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ramps a rising sound from silence to full gain before its release', () => {
    audio.registerSounds({lift:{wave:'triangle',freq_start:82,freq_end:179,
      duration:2.5,attack:2.15,volume:0.044}});
    audio.playSound('lift');
    const gain = Context.instances[0].gains[0].gain;
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.044, 2.15);
    expect(gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 2.5);
  });

  it('lets the final arranged note ring out before stopping a one-shot song', () => {
    audio.configureAudioHost({syncPage:false});
    audio.registerMusic({fanfare:{tempo:120,loop_track:false,
      sections:{verse:{bars:1,lead:'D5:1'},coda:{bars:1,lead:'A5:1'}},arrangement:['verse','coda']}});
    audio.playMusic('fanfare');
    Context.instances[0].currentTime=1.9; vi.advanceTimersByTime(25);
    expect(sync.audioSync.getSnapshot().isPlaying).toBe(true);
    Context.instances[0].currentTime=4.1; vi.advanceTimersByTime(25);
    expect(sync.audioSync.getSnapshot().isPlaying).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('plays arranged brass/strings/bells, and keeps section boundaries through pause and looping', () => {
    audio.configureAudioHost({syncPage:false});
    audio.registerMusic({odyssey:{tempo:120,loop_track:true,
      sections:{verse:{bars:1,lead:'D5:1',harmony:'[D4,F#4,A4]:1'},bridge:{bars:1,lead:'A5:1',bells:'D6:1'}},
      arrangement:['verse',{section:'bridge',repeat:2},'verse'],
      instruments:{lead:'brass',harmony:'strings',bells:'bell'}}});
    audio.playMusic('odyssey');
    const context=Context.instances[0];
    expect(sync.audioSync.getSnapshot().totalBars).toBe(4);
    expect(context.oscillators.some(o=>o.type==='sawtooth')).toBe(true);
    expect(context.oscillators.some(o=>o.type==='triangle')).toBe(true);
    context.currentTime=1.9; vi.advanceTimersByTime(25);
    expect(context.oscillators.some(o=>o.type==='sine')).toBe(true);
    audio.pauseMusic(); context.currentTime=3.1; audio.resumeMusic();
    expect(vi.getTimerCount()).toBe(1);
    context.currentTime=9.2; vi.advanceTimersByTime(25);
    expect(sync.audioSync.getSnapshot().isPlaying).toBe(true);
    expect(sync.audioSync.getSnapshot().totalBars).toBe(4);
  });
  it('keeps title and shop audio idle until a user starts playback', () => {
    audio.configureAudioHost({syncPage:false}); audio.stopMusic();
    expect(sync.audioSync.getSnapshot().isPlaying).toBe(false);
    expect(Context.instances).toHaveLength(0);
  });
  it('defers title/shop playback until a gesture and replaces queued tracks cleanly', () => {
    audio.configureAudioHost({syncPage:false,deferPlayback:true});
    audio.registerMusic({shop:{music_type:'8bit',tempo:92,lead:'A4:4 C5:4',loop_track:true}});
    audio.playMusic('march'); audio.stopMusic(); audio.playMusic('shop');
    expect(Context.instances).toHaveLength(0);
    expect(audio.getAudioContext()).toBeNull();
    audio.unlockAudio();
    expect(Context.instances).toHaveLength(1);
    expect(sync.audioSync.getSnapshot().track).toBe('shop');
    expect(vi.getTimerCount()).toBe(1);
    audio.unlockAudio();
    expect(vi.getTimerCount()).toBe(1);
  });
  it('routes music and effects through one mute bus', () => {
    audio.configureAudioHost({syncPage:false}); audio.playMusic('march'); audio.playSound('hit');
    const context = Context.instances[0];
    const outputs = context.gains.filter(node => node.connect.mock.calls.some(([target]) => target === context.destination));
    expect(outputs).toHaveLength(1);
    expect(outputs[0].gain.value).toBe(1);
    audio.setAudioMuted(true); expect(outputs[0].gain.value).toBe(0);
    const voices = context.oscillators.length;
    audio.playSound('hit'); expect(context.oscillators.length).toBe(voices);
    audio.setAudioMuted(false); expect(outputs[0].gain.value).toBe(1);
  });
  it('stops scheduling on pause and resumes with exactly one scheduler', () => {
    audio.configureAudioHost({syncPage:false}); audio.playMusic('march');
    expect(vi.getTimerCount()).toBe(1);
    const context = Context.instances[0]; context.currentTime = 0.2;
    for (let i=0;i<3;i++) {
      audio.pauseMusic(); expect(vi.getTimerCount()).toBe(0);
      expect(sync.audioSync.getSnapshot().isPaused).toBe(true);
      context.currentTime += 1;
      audio.resumeMusic(); expect(vi.getTimerCount()).toBe(1);
      expect(sync.audioSync.getSnapshot().isPaused).toBe(false);
    }
    audio.playMusic('march'); expect(vi.getTimerCount()).toBe(1);
    audio.stopMusic(); expect(vi.getTimerCount()).toBe(0);
  });
  it('updates the active instrument on the base voice and its polyphonic lanes', () => {
    audio.configureAudioHost({ syncPage: false });
    audio.registerMusic({ layers: {
      tempo: 120, lead: 'C4:4 D4:4', bass: 'C2:4 D2:4',
      tracks: { lead_studio_1: 'E4:4 F4:4' },
      instruments: { lead_studio_1: 'square' },
    } });
    audio.playMusic('layers');
    const context = Context.instances[0];
    const initial = context.oscillators.length;
    audio.setTrackInstrument('lead', 'sine', true);
    context.currentTime = 0.4;
    vi.advanceTimersByTime(25);
    expect(context.oscillators.slice(initial).map(oscillator => oscillator.type)).toEqual(['sine', 'triangle', 'sine']);
  });

  it('holds the audible beat in a later loop and resumes only the remainder of its note', () => {
    audio.configureAudioHost({ syncPage: false });
    audio.playMusic('march');
    const context = Context.instances[0];
    context.currentTime = 8.7;
    audio.pauseMusic();
    const parked = sync.audioSync.getSnapshot().currentBeat;
    expect(parked).toBeCloseTo(1.3);
    expect(context.gains[0].disconnect).toHaveBeenCalledOnce();
    context.currentTime = 12;
    expect(sync.audioSync.getSnapshot().currentBeat).toBe(parked);
    audio.resumeMusic();
    expect(sync.audioSync.getSnapshot().currentBeat).toBe(parked);
    const resumedNote = context.oscillators[context.oscillators.length - 1];
    expect(resumedNote.start.mock.calls[0][0]).toBeCloseTo(12.05);
    expect(resumedNote.stop.mock.calls[0][0]).toBeCloseTo(12.05 + 0.35 * 0.9 + 0.01);
  });

  it('changes tempo on a shared beat without recutting voices or resetting the playhead', () => {
    audio.configureAudioHost({ syncPage: false });
    audio.registerMusic({ pulse: {
      tempo: 120, lead: 'C4:4 D4:4 E4:4 F4:4', bass: 'C2:2 E2:2', loop_track: true,
    } });
    audio.playMusic('pulse');
    const context = Context.instances[0];
    const [lead, bass] = context.oscillators;
    context.currentTime = 0.12;
    audio.setMusicTempo(140);
    context.currentTime = 0.16;
    audio.setMusicTempo(150);
    expect(context.oscillators).toEqual([lead, bass]);
    expect(context.gains[0].disconnect).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    expect(sync.audioSync.getSnapshot()).toMatchObject({ tempo: 120, currentBar: 1 });

    context.currentTime = 0.35;
    vi.advanceTimersByTime(25);
    expect(context.oscillators[2].start.mock.calls[0][0]).toBeCloseTo(0.55);
    context.currentTime = 0.75;
    vi.advanceTimersByTime(25);
    expect(context.oscillators.slice(3).map(voice => voice.start.mock.calls[0][0]))
      .toEqual([expect.closeTo(0.95), expect.closeTo(0.95)]);
    expect(sync.audioSync.getSnapshot().tempo).toBe(150);
    expect(sync.audioSync.getSnapshot().currentBeat).toBeCloseTo(1.5);
    context.currentTime = 1.8;
    vi.advanceTimersByTime(25);
    expect(sync.audioSync.getSnapshot().currentBeat).toBeCloseTo(0.125);
    expect(context.gains[0].disconnect).not.toHaveBeenCalled();
  });

  it('keeps canvas-host music out of Rune-Web state and DOM updates', () => {
    const style = {setProperty:vi.fn()};
    vi.stubGlobal('document',{documentElement:{style},querySelectorAll:vi.fn(() => [])});
    audio.configureAudioHost({syncPage:false}); audio.playMusic('march');
    Context.instances[0].currentTime=0.2; frames[0](0);
    audio.pauseMusic(); audio.resumeMusic(); audio.stopMusic();
    expect(readHost).not.toHaveBeenCalled();
    expect(style.setProperty).not.toHaveBeenCalled();
    expect(host).toEqual({bars:4});
  });
  it('preserves playback state updates for regular Rune-Web hosts', () => {
    vi.stubGlobal('document',{documentElement:{style:{setProperty:vi.fn()}},querySelectorAll:vi.fn(() => []),getElementById:vi.fn(() => null)});
    audio.playMusic('march'); Context.instances[0].currentTime=0.2; frames[0](0);
    expect(host.playback_playing).toBe(true);
    audio.stopMusic(); expect(host.playback_playing).toBe(false);
  });

  it('instantiates and routes chip effects: reverb, delay, filter, crush, and chorus', () => {
    audio.configureAudioHost({ syncPage: false });
    const createDelaySpy = vi.spyOn(Context.prototype, 'createDelay');
    const createConvolverSpy = vi.spyOn(Context.prototype, 'createConvolver');
    const createFilterSpy = vi.spyOn(Context.prototype, 'createBiquadFilter');
    const createShaperSpy = vi.spyOn(Context.prototype, 'createWaveShaper');

    audio.registerMusic({
      fx_track: {
        tempo: 120,
        volume: 0.1,
        lead: 'E4:4 G4:4',
        bass: 'E2:4 B1:4',
        effects: {
          reverb: { decay: 2.0, wet: 0.3 },
          delay: { time: 0.25, feedback: 0.35, wet: 0.25, damping: 3000 },
          filter: { type: 'lowpass', cutoff: 5000, q: 1.5 },
          crush: { bits: 8, drive: 0.2 },
          chorus: { rate: 1.2, wet: 0.3 },
        },
      },
    });

    audio.playMusic('fx_track');
    expect(createDelaySpy).toHaveBeenCalled();
    expect(createConvolverSpy).toHaveBeenCalled();
    expect(createFilterSpy).toHaveBeenCalled();
    expect(createShaperSpy).toHaveBeenCalled();

    audio.stopMusic();
    createDelaySpy.mockRestore();
    createConvolverSpy.mockRestore();
    createFilterSpy.mockRestore();
    createShaperSpy.mockRestore();
  });

  it('honors top-level reverb and delay and per-track effects sends', () => {
    audio.configureAudioHost({ syncPage: false });
    const createDelaySpy = vi.spyOn(Context.prototype, 'createDelay');
    const createConvolverSpy = vi.spyOn(Context.prototype, 'createConvolver');

    audio.registerMusic({
      shorthand_fx: {
        tempo: 140,
        lead: 'A4:4 C5:4',
        bass: 'A2:4 E2:4',
        reverb: { decay: 1.5, wet: 0.25 },
        delay: { time: 0.3, feedback: 0.4, wet: 0.2 },
        track_effects: {
          lead: { reverb: 0.5, delay: 0.4 },
          bass: { reverb: 0, delay: 0 },
        },
      },
    });

    audio.playMusic('shorthand_fx');
    expect(createDelaySpy).toHaveBeenCalled();
    expect(createConvolverSpy).toHaveBeenCalled();

    audio.stopMusic();
    createDelaySpy.mockRestore();
    createConvolverSpy.mockRestore();
  });
});
