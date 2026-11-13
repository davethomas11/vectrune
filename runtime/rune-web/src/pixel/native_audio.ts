// Native implementation of the small Web Audio surface used by Rune's synth.
// The existing audio.ts still parses music, sequences notes, and designs envelopes.
// Only scheduled voices/automation cross to the native output thread (never pixels/JS).
type Event = { time: number; value: number; ramp: 'set' | 'linear' | 'exponential' };
type Bridge = typeof globalThis & {
  __runeAudioNow: () => number;
  __runeAudioSend: (command: string) => void;
  __runeAudioRate: number;
};
let nextNode = 1;
const host = () => globalThis as Bridge;
const send = (command: unknown) => host().__runeAudioSend(JSON.stringify(command));

class Param {
  events: Event[] = [];
  constructor(private initial: number, private changed: () => void = () => {}) {}
  get value(): number { return this.events[this.events.length - 1]?.value ?? this.initial; }
  set value(value: number) { this.setValueAtTime(value,host().__runeAudioNow()); }
  private add(value: number,time: number,ramp: Event['ramp']): this {
    this.events.push({value,time,ramp});
    this.events.sort((a,b) => a.time-b.time);
    // Keep the last anchor before now and all future automation, not an entire session.
    const now = host().__runeAudioNow();
    while (this.events.length > 1 && this.events[1].time <= now) this.initial = this.events.shift()!.value;
    this.changed(); return this;
  }
  setValueAtTime(value: number,time: number): this { return this.add(value,time,'set'); }
  linearRampToValueAtTime(value: number,time: number): this { return this.add(value,time,'linear'); }
  exponentialRampToValueAtTime(value: number,time: number): this { return this.add(value,time,'exponential'); }
  snapshot() { return { initial:this.initial, events:this.events }; }
}
class Node {
  id = nextNode++;
  target: Node | null = null;
  connected = true;
  published = false;
  connect(target: Node): Node { this.target = target; this.connected = true; return target; }
  disconnect(): void {
    this.connected = false;
    if (this instanceof Gain && this.published) this.publish();
  }
}
class Destination extends Node {}
class Gain extends Node {
  gain = new Param(1,() => { if (this.published) this.publish(); });
  descriptor() { return { id:this.id, connected:this.connected, envelope:this.gain.snapshot() }; }
  publish(): void { send({kind:'gain',gain:this.descriptor()}); }
}
class Filter extends Node {
  type = 'lowpass'; frequency = new Param(350); Q = new Param(1);
}
class Source extends Node {
  type = 'sine'; frequency = new Param(440);
  buffer: unknown;
  private startTime = 0;
  constructor(private noise = false) { super(); }
  start(time = host().__runeAudioNow()): void { this.startTime = time; }
  stop(end: number): void {
    const gains: ReturnType<Gain['descriptor']>[] = [];
    const filters: { kind:string; frequency:ReturnType<Param['snapshot']>; q:number }[] = [];
    let node = this.target, routed = this.connected, reachesOutput = false;
    const visited = new Set<Node>();
    while (node) {
      if (visited.has(node)) throw new Error('Cyclic native audio graph');
      visited.add(node); routed &&= node.connected;
      if (node instanceof Destination) reachesOutput = true;
      if (node instanceof Gain) { node.published = true; gains.push(node.descriptor()); }
      if (node instanceof Filter) filters.push({kind:node.type,frequency:node.frequency.snapshot(),q:node.Q.value});
      node = node.target;
    }
    if (!routed || !reachesOutput) return;
    send({kind:'voice',wave:this.noise ? 'noise' : this.type,start:this.startTime,end,
      frequency:this.frequency.snapshot(),routes:gains.map(g => g.id),gains,filters,seed:this.id});
  }
}
class AudioContext {
  state = 'running'; sampleRate = host().__runeAudioRate;
  destination = new Destination();
  get currentTime(): number { return host().__runeAudioNow(); }
  resume(): Promise<void> { return Promise.resolve(); }
  createGain(): Gain { return new Gain(); }
  createOscillator(): Source { return new Source(); }
  createBufferSource(): Source { return new Source(true); }
  createBiquadFilter(): Filter { return new Filter(); }
  createBuffer(channels: number,length: number) {
    // Rune generates only white-noise buffers. The native mixer synthesizes those
    // samples, so large PCM buffers never need JSON serialization across the bridge.
    if (channels !== 1 || length < 1 || length > this.sampleRate * 60) throw new Error('Invalid native synth noise buffer');
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
}

let nextTimer = 1;
const timers = new Map<number,{callback:() => void; at:number; interval:number}>();
let frames = new Map<number,FrameRequestCallback>();
export function install(): void {
  if (typeof host().__runeAudioSend !== 'function') throw new Error('Missing native audio bridge');
  Object.assign(globalThis, { window:globalThis, AudioContext,
    setInterval(callback:() => void,ms:number) {
      const id = nextTimer++;
      timers.set(id,{callback,at:host().__runeAudioNow()+Math.max(1,ms)/1000,interval:Math.max(1,ms)/1000}); return id;
    },
    clearInterval(id:number) { timers.delete(id); },
    requestAnimationFrame(callback:FrameRequestCallback) { const id = nextTimer++; frames.set(id,callback); return id; },
    cancelAnimationFrame(id:number) { frames.delete(id); },
  });
}
/** Called from the window host. The sound device's sample cursor owns the clock. */
export function pump(): void {
  const now = host().__runeAudioNow();
  for (const [id,timer] of Array.from(timers)) {
    if (!timers.has(id) || timer.at > now) continue;
    timer.at = now + timer.interval;
    timer.callback();
  }
  const current = frames; frames = new Map();
  for (const callback of current.values()) callback(now*1000);
}

/** Diagnostics for native-host lifecycle tests; no device access is required. */
export function pending() { return { timers:timers.size, frames:frames.size }; }
