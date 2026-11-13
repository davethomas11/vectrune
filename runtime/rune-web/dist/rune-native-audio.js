"use strict";
var __RuneNativeAudio = (() => {
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

  // src/pixel/native_audio.ts
  var native_audio_exports = {};
  __export(native_audio_exports, {
    install: () => install,
    pending: () => pending,
    pump: () => pump
  });
  var nextNode = 1;
  var host = () => globalThis;
  var send = (command) => host().__runeAudioSend(JSON.stringify(command));
  var Param = class {
    constructor(initial, changed = () => {
    }) {
      this.initial = initial;
      this.changed = changed;
      this.events = [];
    }
    get value() {
      return this.events[this.events.length - 1]?.value ?? this.initial;
    }
    set value(value) {
      this.setValueAtTime(value, host().__runeAudioNow());
    }
    add(value, time, ramp) {
      this.events.push({ value, time, ramp });
      this.events.sort((a, b) => a.time - b.time);
      const now = host().__runeAudioNow();
      while (this.events.length > 1 && this.events[1].time <= now) this.initial = this.events.shift().value;
      this.changed();
      return this;
    }
    setValueAtTime(value, time) {
      return this.add(value, time, "set");
    }
    linearRampToValueAtTime(value, time) {
      return this.add(value, time, "linear");
    }
    exponentialRampToValueAtTime(value, time) {
      return this.add(value, time, "exponential");
    }
    snapshot() {
      return { initial: this.initial, events: this.events };
    }
  };
  var Node = class {
    constructor() {
      this.id = nextNode++;
      this.target = null;
      this.connected = true;
      this.published = false;
    }
    connect(target) {
      this.target = target;
      this.connected = true;
      return target;
    }
    disconnect() {
      this.connected = false;
      if (this instanceof Gain && this.published) this.publish();
    }
  };
  var Destination = class extends Node {
  };
  var Gain = class extends Node {
    constructor() {
      super(...arguments);
      this.gain = new Param(1, () => {
        if (this.published) this.publish();
      });
    }
    descriptor() {
      return { id: this.id, connected: this.connected, envelope: this.gain.snapshot() };
    }
    publish() {
      send({ kind: "gain", gain: this.descriptor() });
    }
  };
  var Filter = class extends Node {
    constructor() {
      super(...arguments);
      this.type = "lowpass";
      this.frequency = new Param(350);
      this.Q = new Param(1);
    }
  };
  var Source = class extends Node {
    constructor(noise = false) {
      super();
      this.noise = noise;
      this.type = "sine";
      this.frequency = new Param(440);
      this.startTime = 0;
    }
    start(time = host().__runeAudioNow()) {
      this.startTime = time;
    }
    stop(end) {
      const gains = [];
      const filters = [];
      let node = this.target, routed = this.connected, reachesOutput = false;
      const visited = /* @__PURE__ */ new Set();
      while (node) {
        if (visited.has(node)) throw new Error("Cyclic native audio graph");
        visited.add(node);
        routed && (routed = node.connected);
        if (node instanceof Destination) reachesOutput = true;
        if (node instanceof Gain) {
          node.published = true;
          gains.push(node.descriptor());
        }
        if (node instanceof Filter) filters.push({ kind: node.type, frequency: node.frequency.snapshot(), q: node.Q.value });
        node = node.target;
      }
      if (!routed || !reachesOutput) return;
      send({
        kind: "voice",
        wave: this.noise ? "noise" : this.type,
        start: this.startTime,
        end,
        frequency: this.frequency.snapshot(),
        routes: gains.map((g) => g.id),
        gains,
        filters,
        seed: this.id
      });
    }
  };
  var AudioContext = class {
    constructor() {
      this.state = "running";
      this.sampleRate = host().__runeAudioRate;
      this.destination = new Destination();
    }
    get currentTime() {
      return host().__runeAudioNow();
    }
    resume() {
      return Promise.resolve();
    }
    createGain() {
      return new Gain();
    }
    createOscillator() {
      return new Source();
    }
    createBufferSource() {
      return new Source(true);
    }
    createBiquadFilter() {
      return new Filter();
    }
    createBuffer(channels, length) {
      if (channels !== 1 || length < 1 || length > this.sampleRate * 60) throw new Error("Invalid native synth noise buffer");
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    }
  };
  var nextTimer = 1;
  var timers = /* @__PURE__ */ new Map();
  var frames = /* @__PURE__ */ new Map();
  function install() {
    if (typeof host().__runeAudioSend !== "function") throw new Error("Missing native audio bridge");
    Object.assign(globalThis, {
      window: globalThis,
      AudioContext,
      setInterval(callback, ms) {
        const id = nextTimer++;
        timers.set(id, { callback, at: host().__runeAudioNow() + Math.max(1, ms) / 1e3, interval: Math.max(1, ms) / 1e3 });
        return id;
      },
      clearInterval(id) {
        timers.delete(id);
      },
      requestAnimationFrame(callback) {
        const id = nextTimer++;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame(id) {
        frames.delete(id);
      }
    });
  }
  function pump() {
    const now = host().__runeAudioNow();
    for (const [id, timer] of Array.from(timers)) {
      if (!timers.has(id) || timer.at > now) continue;
      timer.at = now + timer.interval;
      timer.callback();
    }
    const current = frames;
    frames = /* @__PURE__ */ new Map();
    for (const callback of current.values()) callback(now * 1e3);
  }
  function pending() {
    return { timers: timers.size, frames: frames.size };
  }
  return __toCommonJS(native_audio_exports);
})();
