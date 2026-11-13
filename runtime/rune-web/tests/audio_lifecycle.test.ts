import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class Param {
  value = 0;
  setValueAtTime(value: number) { this.value = value; }
  exponentialRampToValueAtTime(_value: number) {}
  linearRampToValueAtTime(_value: number) {}
}
class Node {
  gain = new Param(); frequency = new Param(); Q = new Param();
  connect = vi.fn(); disconnect = vi.fn(); start = vi.fn(); stop = vi.fn();
  type = 'square'; buffer: unknown;
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
});
