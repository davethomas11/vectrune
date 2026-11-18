"use strict";
var __RunePixel3DRuntime = (() => {
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

  // src/pixel3d/index.ts
  var index_exports = {};
  __export(index_exports, {
    boot: () => boot,
    configure: () => configure,
    mount: () => mount
  });

  // src/input/controller.ts
  var InputController = class {
    constructor(profile) {
      this.profile = profile;
      this.sources = /* @__PURE__ */ new Map();
    }
    event(event) {
      const source = event.source || `${event.device}:${event.code}`;
      const previous = this.sources.get(source);
      if (event.cancel) {
        this.sources.delete(source);
        return;
      }
      let binding;
      if (event.device === "virtual") binding = event.input ? { input: event.input, mode: event.mode } : void 0;
      else if (event.device === "keyboard") binding = this.profile.keys[event.code];
      else binding = this.profile[event.device][event.code];
      const command = (event.device === "keyboard" ? this.profile.commands[event.code] : void 0) || (binding && typeof binding !== "string" ? binding.command : void 0);
      if (command) {
        const def2 = binding && typeof binding !== "string" ? binding : void 0;
        const pressed = typeof event.value === "boolean" ? event.value : Number(event.value) * (def2?.invert ? -1 : 1) > (def2?.threshold ?? 0.5);
        this.sources.set(source, { input: "", mode: "button", value: pressed, pending: false });
        if (pressed && !previous?.value) return command;
        return;
      }
      if (!binding) {
        this.sources.delete(source);
        return;
      }
      const def = typeof binding === "string" ? { input: binding } : binding;
      if (!def.input) return;
      const isMouseDelta = event.device === "mouse" && /^(Move|Wheel)[XY]$/.test(event.code);
      const digitalAxis = event.device === "gamepad" && /[+-]$/.test(event.code);
      const mode = def.mode || (isMouseDelta ? "delta" : typeof event.value === "boolean" || /^Button/.test(event.code) || digitalAxis ? "button" : "value");
      let value = Number(event.value);
      if (def.invert) value = -value;
      if (event.device === "gamepad" && !/^Button/.test(event.code)) {
        const deadzone = def.deadzone ?? 0.18;
        value = Math.abs(value) <= deadzone ? 0 : Math.sign(value) * (Math.abs(value) - deadzone) / (1 - deadzone);
      }
      value *= def.scale ?? 1;
      if (mode === "button") {
        const down = value > (def.threshold ?? 0.5);
        this.sources.set(source, { input: def.input, mode, value: down, pending: Boolean(previous?.pending || down && !previous?.value) });
      } else {
        this.sources.set(source, { input: def.input, mode, value: mode === "delta" ? Number(previous?.value || 0) + value : value, pending: false });
      }
    }
    /** Queued presses survive a down/up between ticks; deltas drain exactly once. */
    sample(dt) {
      const buttons = /* @__PURE__ */ Object.create(null);
      const axes = /* @__PURE__ */ Object.create(null);
      const deltas = /* @__PURE__ */ Object.create(null);
      for (const entry of this.sources.values()) {
        if (!entry.input) continue;
        if (entry.mode === "button") buttons[entry.input] = Boolean(buttons[entry.input] || entry.value || entry.pending);
        else if (entry.mode === "value") {
          if (Math.abs(Number(entry.value)) >= Math.abs(axes[entry.input] || 0)) axes[entry.input] = Number(entry.value);
        } else {
          const scale = entry.mode === "rate" ? Math.max(0, Math.min(0.25, dt)) : 1;
          deltas[entry.input] = (deltas[entry.input] || 0) + Number(entry.value) * scale;
        }
        entry.pending = false;
        if (entry.mode === "delta") entry.value = 0;
      }
      const result = { ...buttons, ...axes };
      for (const [input, value] of Object.entries(deltas)) result[input] = Number(result[input] || 0) + value;
      return result;
    }
    /** Browser Gamepad API or a native adapter can supply the same normalized pads. */
    gamepads(pads) {
      const live = /* @__PURE__ */ new Set();
      const commands = [];
      for (const pad of pads) {
        if (!pad) continue;
        for (const code of Object.keys(this.profile.gamepad)) {
          const match = code.match(/^(Button|Axis)(\d+)([+-])?$/);
          if (!match) continue;
          const source = `pad:${pad.index}:${code}`;
          live.add(source);
          let value = match[1] === "Button" ? pad.buttons[Number(match[2])]?.value || 0 : pad.axes[Number(match[2])] || 0;
          if (match[3]) value = Math.max(0, value * (match[3] === "-" ? -1 : 1));
          const command = this.event({ device: "gamepad", code, value, source });
          if (command) commands.push(command);
        }
      }
      for (const source of this.sources.keys()) if (source.startsWith("pad:") && !live.has(source)) this.sources.delete(source);
      return commands;
    }
    clear(keepCommands = false) {
      if (!keepCommands) this.sources.clear();
      else for (const [key, source] of this.sources) if (source.input) this.sources.delete(key);
    }
  };

  // src/input/game.ts
  var isPausableStatus = (status) => ["playing", "intro", "landing", "departing", "ending", "credits"].includes(String(status));
  var GameControls = class {
    constructor(profile, game) {
      this.game = game;
      this.controller = new InputController(profile);
    }
    get profile() {
      return this.controller.profile;
    }
    event(event) {
      const command = this.controller.event(event);
      return command ? this.command(command) : void 0;
    }
    command(command) {
      if (command === "host.fullscreen") return command;
      if (command !== "host.mute") this.controller.clear(true);
      if (command === "host.pause") {
        const status = this.game.app.state.status;
        if (isPausableStatus(status)) this.game.paused = !this.game.paused;
        else if (["title", "won", "gameover"].includes(String(status))) this.game.start();
      } else if (command === "host.mute") this.game.muted = !this.game.muted;
      else if (command === "host.start") {
        if (!this.game.key?.("Enter")) this.game.start();
      } else if (command === "host.advance") {
        if (this.game.app.state.status !== "playing") this.game.invoke("advance");
      } else this.game.invoke(command);
    }
    gamepads(pads) {
      return this.controller.gamepads(pads).flatMap((command) => {
        const host = this.command(command);
        return host ? [host] : [];
      });
    }
    sample(dt) {
      return this.controller.sample(dt);
    }
    clear(keepCommands = false) {
      this.controller.clear(keepCommands);
    }
  };

  // src/input/touch.ts
  function mountControlTouch(canvas, controls, profile, options) {
    const surface = canvas.parentElement || canvas;
    const style = document.createElement("style");
    style.textContent = `.rune-control-touch{position:absolute;z-index:6;pointer-events:none;display:none;user-select:none;-webkit-user-select:none;touch-action:none}@media(pointer:coarse),(hover:none){.rune-control-touch{display:block}}.rune-control-touch.is-touch{display:block}.rune-control-touch[hidden]{display:none}.rune-control-touch button{position:absolute;pointer-events:auto;touch-action:none;color:#fff;background:#172c42bb;border:2px solid #efca6a99;border-radius:50%;font:bold 11px ui-monospace,monospace;padding:4px;box-sizing:border-box;min-width:44px;min-height:44px}.rune-control-touch button:focus-visible{outline:3px solid white}.rune-control-touch .control-thumb{position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;background:#efca6aaa;pointer-events:none}`;
    document.head.append(style);
    const overlay = document.createElement("div");
    overlay.className = "rune-control-touch";
    surface.append(overlay);
    const position = getComputedStyle(surface).position;
    if (position === "static") surface.style.position = "relative";
    const oldTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    const hint = document.createElement("span");
    hint.className = "rotate-hint";
    hint.textContent = "Rotate your device for landscape play";
    overlay.append(hint);
    const abort = new AbortController();
    function listen(target, name, fn) {
      target.addEventListener(name, fn, { signal: abort.signal, passive: false });
    }
    const pointers = /* @__PURE__ */ new Map();
    const occupied = /* @__PURE__ */ new Set();
    const visibility = /* @__PURE__ */ new Map();
    function visible(path) {
      if (path === void 0) return true;
      let value = options.state?.();
      for (const key of path.split(".")) {
        value = value && typeof value === "object" ? Reflect.get(value, key) : void 0;
      }
      if (typeof value !== "boolean") throw new Error(`Touch visible must reference boolean state: ${path}`);
      return value;
    }
    function activate(e) {
      e.preventDefault();
      e.stopPropagation();
      options.interact();
      overlay.classList.add("is-touch");
      canvas.focus({ preventScroll: true });
      if (!options.playing()) {
        if (options.tapToAdvance !== false) options.advance();
        return false;
      }
      if (options.paused()) {
        options.resume();
        return false;
      }
      return true;
    }
    function capture(target, e, pointer) {
      occupied.add(target);
      pointers.set(e.pointerId, pointer);
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
      }
    }
    function emit(id, input, value, mode, cancel = false) {
      controls.event({ device: "virtual", code: id, source: `touch:${id}`, input, value, mode, cancel });
    }
    function button(label, id, anchor, offset, size) {
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = label;
      element.dataset.controlTouch = id;
      element.setAttribute("aria-label", label);
      const [vertical, horizontal] = anchor.split("-");
      element.style[horizontal] = `max(${offset[0]}px,env(safe-area-inset-${horizontal}))`;
      element.style[vertical] = `max(${offset[1]}px,env(safe-area-inset-${vertical}))`;
      element.style.width = element.style.height = `${size}px`;
      overlay.append(element);
      return element;
    }
    if (profile.joystick) {
      let move2 = function(e, cancel = false) {
        const rect = stick.getBoundingClientRect(), radius = rect.width * 0.36;
        let x = e ? (e.clientX - rect.left - rect.width / 2) / radius : 0;
        let y = e ? -(e.clientY - rect.top - rect.height / 2) / radius : 0;
        const length = Math.hypot(x, y), deadzone = def.deadzone ?? 0.15;
        const strength = Math.min(1, Math.max(0, (length - deadzone) / (1 - deadzone)));
        x = length ? x / length * strength : 0;
        y = length ? y / length * strength : 0;
        thumb.style.transform = e ? `translate(${x * radius}px,${-y * radius}px)` : "";
        if (def.x) emit("stick:x", def.x, x, "value", cancel);
        if (def.y) emit("stick:y", def.y, y, "value", cancel);
        for (const [direction, amount] of [["left", -x], ["right", x], ["up", y], ["down", -y]]) {
          if (def[direction]) emit(`stick:${direction}`, def[direction], amount > 0.35, "button", cancel);
        }
      };
      var move = move2;
      const def = profile.joystick;
      const stick = button("MOVE", "joystick", def.anchor || "bottom-left", [12, 12], def.size || 96);
      if (def.visible !== void 0) visibility.set(stick, def.visible);
      stick.dataset.gameplay = "true";
      stick.setAttribute("aria-label", "Move joystick");
      const thumb = document.createElement("span");
      thumb.className = "control-thumb";
      stick.append(thumb);
      listen(stick, "pointerdown", (e) => {
        if (occupied.has(stick) || !activate(e)) return;
        capture(stick, e, { target: stick, move: move2, end: (cancel) => move2(void 0, cancel) });
        move2(e);
      });
    }
    for (const [index2, def] of (profile.buttons || []).entries()) {
      const target = button(def.label, def.id, def.anchor || "bottom-right", def.offset || [12 + index2 * 68, 12], def.size || 56);
      if (def.visible !== void 0) visibility.set(target, def.visible);
      target.classList.add("touch-" + def.id);
      if (def.aria_label) target.setAttribute("aria-label", def.aria_label);
      if (def.input) target.dataset.gameplay = "true";
      listen(target, "pointerdown", (e) => {
        if (def.command) {
          e.preventDefault();
          e.stopPropagation();
          options.interact();
          canvas.focus({ preventScroll: true });
          if (controls.command(def.command) === "host.fullscreen") options.fullscreen();
          return;
        }
        if (occupied.has(target) || !activate(e)) return;
        let lastX = e.clientX;
        emit(def.id, def.input, true, "button");
        capture(target, e, { target, move: (e2) => {
          if (def.drag_x) emit(`${def.id}:look`, def.drag_x, (e2.clientX - lastX) * 1200 / Math.max(1, canvas.getBoundingClientRect().width) * (profile.look?.sensitivity ?? 1), "delta");
          lastX = e2.clientX;
        }, end: (cancel) => emit(def.id, def.input, false, "button", cancel) });
      });
      target.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, { signal: abort.signal });
    }
    listen(canvas, "pointerdown", (e) => {
      if (!["touch", "pen"].includes(e.pointerType) || occupied.has(canvas)) return;
      if (!activate(e) || !profile.look) return;
      let lastX = e.clientX, lastY = e.clientY;
      capture(canvas, e, { target: canvas, move: (e2) => {
        emit("aim", profile.look.x, (e2.clientX - lastX) * 1200 / Math.max(1, canvas.getBoundingClientRect().width) * (profile.look.sensitivity ?? 1), "delta");
        lastX = e2.clientX;
        if (profile.look.y) emit("aim:y", profile.look.y, (e2.clientY - lastY) * 1200 / Math.max(1, canvas.getBoundingClientRect().height) * (profile.look.sensitivity ?? 1), "delta");
        lastY = e2.clientY;
      }, end: (cancel) => {
        if (cancel) {
          emit("aim", profile.look.x, 0, "delta", true);
          if (profile.look.y) emit("aim:y", profile.look.y, 0, "delta", true);
        }
      } });
    });
    listen(document, "pointermove", (e) => {
      const pointer = pointers.get(e.pointerId);
      if (pointer) {
        e.preventDefault();
        pointer.move?.(e);
      }
    });
    function end(e) {
      const pointer = pointers.get(e.pointerId);
      if (!pointer) return;
      pointers.delete(e.pointerId);
      occupied.delete(pointer.target);
      pointer.end(e.type !== "pointerup");
    }
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) listen(document, name, end);
    function reset() {
      const active2 = [...pointers];
      pointers.clear();
      occupied.clear();
      for (const [id, pointer] of active2) {
        pointer.end(true);
        try {
          pointer.target.releasePointerCapture(id);
        } catch {
        }
      }
    }
    function update() {
      const rect = canvas.getBoundingClientRect(), parent = surface.getBoundingClientRect();
      Object.assign(overlay.style, { left: `${rect.left - parent.left - surface.clientLeft}px`, top: `${rect.top - parent.top - surface.clientTop}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      overlay.hidden = !visible(profile.visible);
      for (const element of Array.from(overlay.querySelectorAll("button"))) {
        element.hidden = element.dataset.gameplay === "true" && !options.playing() || !visible(visibility.get(element));
      }
      for (const [id, pointer] of [...pointers]) {
        if (overlay.hidden || pointer.target.hidden) {
          pointers.delete(id);
          occupied.delete(pointer.target);
          pointer.end(true);
          try {
            pointer.target.releasePointerCapture(id);
          } catch {
          }
        }
      }
      const expanded = options.expanded?.() || false;
      hint.style.cssText = "position:absolute;left:25%;bottom:calc(100% + 12px);width:50%;text-align:center;color:white;background:#142432dd;font:12px monospace;padding:8px";
      hint.hidden = !expanded || innerWidth >= innerHeight;
      for (const def of profile.buttons || []) {
        const target = Array.from(overlay.querySelectorAll("button")).find((b) => b.dataset.controlTouch === def.id);
        if (def.command === "host.pause") {
          target.textContent = options.paused() ? "RESUME" : def.label;
          target.setAttribute("aria-label", options.paused() ? "Resume game" : def.aria_label || def.label);
        }
        if (def.command === "host.fullscreen") target.textContent = expanded ? "EXIT" : def.label;
      }
    }
    const resize = new ResizeObserver(update);
    resize.observe(canvas);
    resize.observe(surface);
    update();
    return { reset, update, dispose() {
      reset();
      abort.abort();
      resize.disconnect();
      overlay.remove();
      style.remove();
      canvas.style.touchAction = oldTouchAction;
      if (position === "static") surface.style.position = "";
    } };
  }

  // src/input/browser.ts
  function mountControls(canvas, controls, options) {
    const abort = new AbortController();
    let lastTouch = 0;
    const send = (event) => {
      if (controls.event(event) === "host.fullscreen") options.fullscreen();
    };
    function listen(target, name, handler) {
      target.addEventListener(name, handler, { signal: abort.signal });
    }
    listen(canvas, "keydown", (e) => {
      options.interact();
      if (Object.prototype.hasOwnProperty.call(controls.profile.keys, e.code) || Object.prototype.hasOwnProperty.call(controls.profile.commands, e.code)) e.preventDefault();
      if (!options.playing() && !controls.profile.commands[e.code]) {
        const binding = controls.profile.keys[e.code];
        const input = typeof binding === "string" ? binding : binding?.input;
        if (input && options.advanceInputs?.includes(input)) {
          if (!e.repeat) options.advance();
          return;
        }
        if (!e.repeat && options.menuKey?.(e.code)) return;
      }
      send({ device: "keyboard", code: e.code, value: true });
    });
    listen(document, "keyup", (e) => send({ device: "keyboard", code: e.code, value: false }));
    const mouseCode = (button) => ["Left", "Middle", "Right", "Back", "Forward"][button];
    listen(canvas, "mousedown", (e) => {
      if (Date.now() - lastTouch < 700 || !options.playing()) return;
      options.interact();
      canvas.focus();
      const code = mouseCode(e.button);
      if (code) send({ device: "mouse", code, value: true });
    });
    listen(document, "mouseup", (e) => {
      const code = mouseCode(e.button);
      if (code) send({ device: "mouse", code, value: false });
    });
    listen(canvas, "contextmenu", (e) => {
      if (controls.profile.mouse.Right) e.preventDefault();
    });
    listen(document, "mousemove", (e) => {
      if (!options.playing() || (options.lockedMouse ? document.pointerLockElement !== canvas : document.activeElement !== canvas)) return;
      send({ device: "mouse", code: "MoveX", value: e.movementX });
      send({ device: "mouse", code: "MoveY", value: e.movementY });
    });
    canvas.addEventListener("wheel", (e) => {
      if (document.activeElement !== canvas || !options.playing()) return;
      if (controls.profile.mouse.WheelX || controls.profile.mouse.WheelY) e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
      send({ device: "mouse", code: "WheelX", value: e.deltaX * unit });
      send({ device: "mouse", code: "WheelY", value: e.deltaY * unit });
    }, { signal: abort.signal, passive: false });
    const touch = controls.profile.touch && controls.profile.touch.enabled !== false ? mountControlTouch(canvas, controls, controls.profile.touch, {
      ...options,
      interact() {
        lastTouch = Date.now();
        options.interact();
      }
    }) : void 0;
    function clear(keepCommands = false) {
      touch?.reset();
      controls.clear(keepCommands);
    }
    listen(canvas, "blur", () => clear());
    listen(window, "blur", () => clear());
    listen(document, "visibilitychange", () => {
      if (document.hidden) clear();
    });
    return {
      clear,
      recentTouch: () => Date.now() - lastTouch < 700,
      update() {
        touch?.update();
      },
      sample(dt) {
        let pads = [];
        try {
          if (document.hasFocus() && document.activeElement === canvas) pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
        } catch {
        }
        for (const command of controls.gamepads(pads)) if (command === "host.fullscreen") options.fullscreen();
        return controls.sample(dt);
      },
      dispose() {
        clear();
        touch?.dispose();
        abort.abort();
      }
    };
  }

  // src/storage.ts
  var persistent = false;
  function storageIsPersistent() {
    return persistent;
  }
  var native = () => globalThis;
  var memoryStorage = {};
  function browserStorage() {
    try {
      return typeof window !== "undefined" ? window.localStorage : null;
    } catch {
      return null;
    }
  }
  function getStorageItem(key) {
    try {
      const store = browserStorage();
      const val = native().__runeStoreGet ? native().__runeStoreGet(key) : store?.getItem(key);
      persistent = !!native().__runeStoreGet || !!store;
      if (val != null) return val;
    } catch {
    }
    return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
  }
  function setStorageItem(key, val) {
    memoryStorage[key] = val;
    try {
      const store = browserStorage();
      if (native().__runeStoreSet) native().__runeStoreSet(key, val);
      else store?.setItem(key, val);
      persistent = !!native().__runeStoreSet || !!store;
    } catch {
      persistent = false;
    }
  }
  function removeStorageItem(key) {
    delete memoryStorage[key];
    try {
      if (native().__runeStoreRemove) native().__runeStoreRemove(key);
      else browserStorage()?.removeItem(key);
    } catch {
    }
  }
  function clearStorage() {
    for (const k of Object.keys(memoryStorage)) {
      delete memoryStorage[k];
    }
    try {
      browserStorage()?.clear();
    } catch {
    }
  }
  function hasStorageItem(key) {
    return getStorageItem(key) !== null;
  }

  // src/pixel/persistence.ts
  function restore(defaults, saved) {
    if (Array.isArray(defaults)) return Array.isArray(saved) && saved.length <= 128 && saved.every((v) => typeof v === typeof defaults[0]) ? saved.slice() : defaults.slice();
    if (defaults && typeof defaults === "object") return Object.fromEntries(Object.keys(defaults).map((key) => [key, restore(defaults[key], saved?.[key])]));
    return typeof defaults === typeof saved && (typeof saved !== "number" || Number.isSafeInteger(saved)) ? saved : defaults;
  }
  var GameSave = class {
    constructor(config) {
      this.config = config;
      this.status = "session";
      this.previous = "";
    }
    load(defaults) {
      const raw = getStorageItem("rune-pixel-" + this.config.key);
      if (!raw) return defaults;
      try {
        if (raw.length > 16384) throw new Error("Save too large");
        const data = JSON.parse(raw);
        if (data.version !== 1 || !data.data || typeof data.data !== "object") throw new Error("Unknown save format");
        return restore(defaults, data.data);
      } catch {
        this.status = "recovered";
        return defaults;
      }
    }
    flush(value) {
      const json = JSON.stringify({ version: 1, data: value });
      if (json === this.previous) return;
      setStorageItem("rune-pixel-" + this.config.key, json);
      this.previous = json;
      if (this.status !== "recovered") this.status = storageIsPersistent() ? "saved" : "session";
    }
  };

  // src/context.ts
  var _ctx = null;
  function ctx() {
    if (!_ctx) throw new Error("RuneWeb context not initialized \u2014 call boot() first");
    return _ctx;
  }
  function withContext(context, run) {
    const previous = _ctx;
    _ctx = context;
    try {
      return run();
    } finally {
      _ctx = previous;
    }
  }

  // src/ownership.ts
  var ownedValues = /* @__PURE__ */ new WeakSet();
  var reactiveTargets = /* @__PURE__ */ new WeakMap();
  function ownValue(value) {
    ownedValues.add(value);
    return value;
  }
  function rawValue(value) {
    if (value && typeof value === "object") return reactiveTargets.get(value) ?? value;
    return value;
  }

  // src/pixel3d/entities.ts
  var active;
  var groups = /* @__PURE__ */ new WeakMap();
  var ownedEntities = /* @__PURE__ */ new WeakSet();
  var movementSequence = 0;
  var movementLog = Array(4096);
  function ownEntity(value, importedEntities) {
    value = rawValue(value);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("entity_group expects entity objects");
    if (ownedEntities.has(value)) return value;
    const known = importedEntities.get(value);
    if (known) return known;
    const raw = { ...value };
    const proxy = new Proxy(raw, {
      set: (target, key, next) => {
        Reflect.set(target, key, next);
        if (["x", "y", "z", "visible", "scale"].includes(String(key))) entityMoved(proxy);
        return true;
      },
      deleteProperty: (target, key) => {
        Reflect.deleteProperty(target, key);
        entityMoved(proxy);
        return true;
      },
      defineProperty: () => {
        throw new Error("Entity descriptors cannot be redefined");
      }
    });
    ownValue(proxy);
    ownedEntities.add(proxy);
    importedEntities.set(value, proxy);
    return proxy;
  }
  function entityGroup(values = []) {
    values = rawValue(values);
    if (!Array.isArray(values) || values.length > 1e6) throw new Error("entity_group needs an array");
    if (groups.has(values)) return values;
    const importedEntities = /* @__PURE__ */ new WeakMap();
    const target = values.map((value) => ownEntity(value, importedEntities));
    const proxy = new Proxy(target, {
      set: (array, key, value) => {
        if (key === "length") {
          if (!Number.isInteger(value) || value < 0 || value > array.length) throw new Error("Grow entity groups with push or indexed writes");
          Reflect.set(array, key, value);
        } else if (typeof key === "string" && /^\d+$/.test(key)) {
          const i = Number(key);
          if (i > array.length || i >= 1e6) throw new Error("Entity group indices must be contiguous");
          Reflect.set(array, key, ownEntity(value, importedEntities));
        } else throw new Error("Invalid entity group property");
        entitiesChanged(proxy);
        return true;
      },
      deleteProperty: (array, key) => {
        Reflect.deleteProperty(array, key);
        entitiesChanged(proxy);
        return true;
      },
      defineProperty: () => {
        throw new Error("Entity group descriptors cannot be redefined");
      }
    });
    ownValue(proxy);
    groups.set(proxy, { version: 0, indices: /* @__PURE__ */ new Map() });
    return proxy;
  }
  var session = () => ({ indices: /* @__PURE__ */ new WeakMap(), members: /* @__PURE__ */ new WeakMap() });
  function withEntityQueries(run) {
    const previous = active;
    active = active ?? session();
    try {
      return run();
    } finally {
      active = previous;
    }
  }
  var EntityIndex = class {
    constructor(source, dimensions, owner) {
      this.source = source;
      this.dimensions = dimensions;
      this.owner = owner;
      this.buckets = /* @__PURE__ */ new Map();
      this.rows = /* @__PURE__ */ new Map();
      this.positions = /* @__PURE__ */ new Map();
      this.scales = /* @__PURE__ */ new Map();
      this.maxScale = 1;
      this.dirty = false;
      this.revision = 0;
      this.rebuild();
    }
    key(x, y, z) {
      return `${Math.floor(x / 16)},${Math.floor(y / 16)},${this.dimensions === 3 ? Math.floor(z / 16) : 0}`;
    }
    rebuild() {
      this.buckets.clear();
      this.rows.clear();
      this.positions.clear();
      this.scales.clear();
      this.maxScale = 1;
      this.dirty = false;
      this.source.forEach((entity, i) => {
        if (!entity || typeof entity !== "object") throw new Error("nearby expects entity objects");
        const positions = this.positions.get(entity) ?? [];
        positions.push(i);
        this.positions.set(entity, positions);
        if (this.owner) {
          const memberships = this.owner.members.get(entity) ?? /* @__PURE__ */ new Set();
          memberships.add(this);
          this.owner.members.set(entity, memberships);
        }
        this.place(i, entity);
      });
      this.revision = movementSequence;
    }
    place(i, entity) {
      if (entity.visible === false) return;
      const x = entity.x, y = entity.y, z = this.dimensions === 3 ? entity.z ?? 0 : 0;
      if (![x, y, z].every(Number.isFinite)) throw new Error("nearby entity coordinates must be finite");
      const key = this.key(x, y, z), bucket = this.buckets.get(key) ?? /* @__PURE__ */ new Set();
      bucket.add(i);
      this.buckets.set(key, bucket);
      const scale = Number.isFinite(entity.scale) && entity.scale > 0 ? entity.scale : 1;
      this.scales.set(scale, (this.scales.get(scale) ?? 0) + 1);
      this.maxScale = Math.max(this.maxScale, scale);
      this.rows.set(i, { entity, key, x, y, z, scale });
    }
    move(entity) {
      if (this.dirty) return;
      for (const i of this.positions.get(entity) ?? []) {
        const row = this.rows.get(i);
        if (row) {
          const bucket = this.buckets.get(row.key);
          bucket.delete(i);
          if (!bucket.size) this.buckets.delete(row.key);
          this.rows.delete(i);
          const count = this.scales.get(row.scale) - 1;
          if (count) this.scales.set(row.scale, count);
          else this.scales.delete(row.scale);
          if (row.scale === this.maxScale && !count) {
            this.maxScale = 1;
            for (const scale of this.scales.keys()) this.maxScale = Math.max(this.maxScale, scale);
          }
        }
        this.place(i, entity);
      }
    }
    query(origin, radius, padding = 0) {
      if (this.dirty) this.rebuild();
      if (!this.owner && this.revision !== movementSequence) {
        if (movementSequence - this.revision > movementLog.length) this.rebuild();
        else {
          const changed = /* @__PURE__ */ new Set();
          for (let version = this.revision + 1; version <= movementSequence; version++) changed.add(movementLog[version % movementLog.length].entity);
          for (const entity of changed) if (this.positions.has(entity)) this.move(entity);
          this.revision = movementSequence;
        }
      }
      radius += padding * this.maxScale;
      const minX = Math.floor((origin.x - radius) / 16), maxX = Math.floor((origin.x + radius) / 16);
      const minY = Math.floor((origin.y - radius) / 16), maxY = Math.floor((origin.y + radius) / 16);
      const minZ = this.dimensions === 3 ? Math.floor((origin.z - radius) / 16) : 0, maxZ = this.dimensions === 3 ? Math.floor((origin.z + radius) / 16) : 0;
      const matches = [];
      const inside = (row) => Math.hypot(row.x - origin.x, row.y - origin.y, this.dimensions === 3 ? row.z - origin.z : 0) <= radius;
      if ((maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1) > this.rows.size * 2) {
        for (const [i, row] of this.rows) if (inside(row)) matches.push(i);
      } else for (let z = minZ; z <= maxZ; z++) for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        for (const i of this.buckets.get(`${x},${y},${z}`) ?? []) if (inside(this.rows.get(i))) matches.push(i);
      }
      matches.sort((a, b) => a - b);
      return matches.map((i) => this.source[i]);
    }
  };
  function nearby(source, origin, radius) {
    return query(source, origin, radius);
  }
  function nearbyForRender(source, origin, radius, padding) {
    return query(source, origin, radius, padding);
  }
  function query(source, origin, radius, padding = 0) {
    source = rawValue(source);
    if (!Array.isArray(source) || source.length > 1e6 || !origin || typeof origin !== "object" || typeof radius !== "number" || !Number.isFinite(radius) || radius < 0) throw new Error("nearby needs a collection, position and finite nonnegative radius");
    const point = origin, dimensions = point.z === void 0 ? 2 : 3;
    if (![point.x, point.y, ...dimensions === 3 ? [point.z] : []].every(Number.isFinite)) throw new Error("nearby origin must have finite coordinates");
    const group = groups.get(source);
    if (group) {
      let indexed = group.indices.get(dimensions);
      if (!indexed || indexed.version !== group.version) {
        indexed = { version: group.version, index: new EntityIndex(source, dimensions) };
        group.indices.set(dimensions, indexed);
      }
      return indexed.index.query(point, radius, padding);
    }
    const owner = active ?? session(), indices = owner.indices.get(source) ?? /* @__PURE__ */ new Map();
    let index2 = indices.get(dimensions);
    if (!index2) {
      index2 = new EntityIndex(source, dimensions, owner);
      indices.set(dimensions, index2);
      owner.indices.set(source, indices);
    }
    return index2.query(point, radius, padding);
  }
  function entityMoved(value) {
    if (value && typeof value === "object" && ownedEntities.has(value)) {
      movementSequence++;
      movementLog[movementSequence % movementLog.length] = { version: movementSequence, entity: value };
    }
    if (value && typeof value === "object") for (const index2 of active?.members.get(value) ?? []) index2.move(value);
  }
  function entitiesChanged(value) {
    if (value && typeof value === "object") {
      const group = groups.get(value);
      if (group) group.version++;
    }
    if (Array.isArray(value)) for (const index2 of active?.indices.get(value)?.values() ?? []) index2.dirty = true;
  }

  // src/core_expression.ts
  var precedence = {
    "??": 1,
    or: 2,
    "||": 2,
    and: 3,
    "&&": 3,
    "==": 4,
    "!=": 4,
    contains: 4,
    "<": 5,
    ">": 5,
    "<=": 5,
    ">=": 5,
    "+": 6,
    "-": 6,
    "*": 7,
    "/": 7,
    "%": 7
  };
  var coreFunctions = {
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    min: Math.min,
    max: Math.max,
    sqrt: Math.sqrt,
    pow: Math.pow,
    sin: (x) => Math.sin(x * Math.PI / 180),
    cos: (x) => Math.cos(x * Math.PI / 180),
    clamp: (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
    range: (start, end, step = 1) => {
      if (end === void 0) {
        end = start;
        start = 0;
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step === 0)
        throw new Error("range requires finite bounds and a nonzero step");
      const n = Math.max(0, Math.ceil((end - start) / step));
      if (n > 1e6) throw new Error("range exceeds 1000000 items");
      return Array.from({ length: n }, (_, i) => start + i * step);
    },
    len: (x) => x.length,
    keys: Object.keys,
    values: Object.values,
    repeat: (value, n) => {
      if (!Number.isInteger(n) || n < 0 || n > 1e6) throw new Error("invalid repeat count");
      return Array.from({ length: n }, () => value);
    },
    hex: (n, width = 0) => Math.trunc(n).toString(16).padStart(width, "0"),
    "json.stringify": JSON.stringify,
    "json.parse": JSON.parse
  };
  var forbidden = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  function safeKey(key) {
    key = String(key);
    if (forbidden.has(key)) throw new Error(`Invalid member: ${key}`);
    return key;
  }
  function tokenize(source) {
    const out = [];
    let i = 0;
    while (i < source.length) {
      if (/\s/.test(source[i])) {
        i++;
        continue;
      }
      const tail = source.slice(i);
      const number = tail.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
      if (number) {
        out.push({ kind: "number", value: number[0] });
        i += number[0].length;
        continue;
      }
      if (source[i] === '"' || source[i] === "'") {
        const quote = source[i++];
        let value = "";
        let closed = false;
        while (i < source.length) {
          const c = source[i++];
          if (c === quote) {
            closed = true;
            break;
          }
          if (c === "\\") {
            const e = source[i++];
            const escapes = { n: "\n", r: "\r", t: "	", "\\": "\\", '"': '"', "'": "'" };
            if (!(e in escapes)) throw new Error("Invalid string escape");
            value += escapes[e];
          } else value += c;
        }
        if (!closed) throw new Error("Unclosed string");
        out.push({ kind: "string", value });
        continue;
      }
      const id = tail.match(/^[A-Za-z_$][\w$]*/);
      if (id) {
        out.push({ kind: "id", value: id[0] });
        i += id[0].length;
        continue;
      }
      const op = tail.match(/^(?:\?\?|&&|\|\||==|!=|<=|>=|=>|[+*/%<>()\[\]{},.:?!-])/);
      if (!op) throw new Error(`Unexpected token: ${tail.slice(0, 20)}`);
      out.push({ kind: "op", value: op[0] });
      i += op[0].length;
    }
    out.push({ kind: "eof", value: "" });
    return out;
  }
  function parseCoreExpression(source) {
    const tokens = tokenize(source);
    let pos = 0;
    const peek = () => tokens[pos].value;
    const take = () => tokens[pos++];
    const expect = (s) => {
      if (take().value !== s) throw new Error(`Expected ${s}`);
    };
    function expression(min = 0) {
      const t = take();
      let left;
      if (t.kind === "number") left = { kind: "literal", value: Number(t.value) };
      else if (t.kind === "string") left = { kind: "literal", value: t.value };
      else if (["true", "false", "null"].includes(t.value)) left = { kind: "literal", value: JSON.parse(t.value) };
      else if (["-", "+", "!", "not"].includes(t.value)) left = { kind: "unary", value: t.value, items: [expression(8)] };
      else if (t.value === "(") {
        left = expression();
        expect(")");
      } else if (t.value === "[") {
        const items = [];
        while (peek() !== "]") {
          items.push(expression());
          if (peek() !== ",") break;
          take();
        }
        expect("]");
        left = { kind: "array", items };
      } else if (t.value === "{") {
        const items = [];
        while (peek() !== "}") {
          const key = take();
          if (!["id", "string"].includes(key.kind)) throw new Error("Invalid object key");
          expect(":");
          items.push([safeKey(key.value), expression()]);
          if (peek() !== ",") break;
          take();
        }
        expect("}");
        left = { kind: "object", items };
      } else if (t.kind === "id") {
        if (peek() === "=>") {
          take();
          left = { kind: "lambda", value: t.value, items: [expression()] };
        } else left = { kind: "id", value: t.value };
      } else throw new Error(`Expected expression, got ${t.value || "end of input"}`);
      while (true) {
        if (peek() === ".") {
          take();
          const key = take();
          if (key.kind !== "id") throw new Error("Expected member name");
          left = { kind: "member", items: [left, { kind: "literal", value: safeKey(key.value) }] };
          continue;
        }
        if (peek() === "[") {
          take();
          const key = expression();
          expect("]");
          left = { kind: "member", items: [left, key] };
          continue;
        }
        if (peek() === "(") {
          take();
          const args = [];
          while (peek() !== ")") {
            args.push(expression());
            if (peek() !== ",") break;
            take();
          }
          expect(")");
          left = { kind: "call", items: [left, ...args] };
          continue;
        }
        const op = peek(), rank = precedence[op];
        if (rank === void 0 || rank < min) break;
        take();
        left = { kind: "binary", value: op, items: [left, expression(rank + 1)] };
      }
      if (min === 0 && peek() === "?") {
        take();
        const yes = expression();
        expect(":");
        left = { kind: "ternary", items: [left, yes, expression()] };
      }
      return left;
    }
    const ast = expression();
    if (tokens[pos].kind !== "eof") throw new Error(`Unexpected token: ${peek()}`);
    return ast;
  }
  function callName(e) {
    if (e.kind === "id") return e.value;
    if (e.kind === "member" && e.items[1].kind === "literal") {
      const parent = callName(e.items[0]);
      if (parent) return parent + "." + e.items[1].value;
    }
  }
  function evaluateCoreExpression(e, scope, functions = coreFunctions) {
    const ev = (n) => evaluateCoreExpression(n, scope, functions);
    switch (e.kind) {
      case "literal":
        return e.value;
      case "id":
        return scope[e.value];
      case "array":
        return e.items.map(ev);
      case "object":
        return Object.fromEntries(e.items.map(([k, v]) => [k, ev(v)]));
      case "member":
        return ev(e.items[0])?.[safeKey(ev(e.items[1]))];
      case "unary": {
        const v = ev(e.items[0]);
        return e.value === "-" ? -v : e.value === "+" ? +v : !v;
      }
      case "ternary":
        return ev(e.items[0]) ? ev(e.items[1]) : ev(e.items[2]);
      case "lambda":
        return (value) => evaluateCoreExpression(e.items[0], { ...scope, [e.value]: value }, functions);
      case "call": {
        const a = e.items[0];
        const name = callName(a);
        const args = e.items.slice(1).map(ev);
        if (name && Object.prototype.hasOwnProperty.call(functions, name)) return functions[name](...args);
        if (a.kind === "member") {
          const receiver = ev(a.items[0]), key = safeKey(ev(a.items[1]));
          const arrays = ["push", "pop", "join", "slice", "map", "filter", "find", "some", "every", "includes", "indexOf"];
          const strings = ["join", "slice", "includes", "indexOf", "split", "toLowerCase", "toUpperCase", "padStart"];
          if (Array.isArray(receiver) && arrays.includes(key) || typeof receiver === "string" && strings.includes(key)) {
            const result = receiver[key](...args);
            if (key === "push" || key === "pop") entitiesChanged(receiver);
            return result;
          }
        }
        throw new Error(`Unknown function: ${name || "expression"}`);
      }
      case "binary": {
        const [a, b] = e.items;
        const x = ev(a);
        if (e.value === "??") return x === null || x === void 0 || x === "" ? ev(b) : x;
        if (["and", "&&"].includes(e.value)) return Boolean(x) && Boolean(ev(b));
        if (["or", "||"].includes(e.value)) return Boolean(x) || Boolean(ev(b));
        const y = ev(b);
        switch (e.value) {
          case "+":
            return x + y;
          case "-":
            return x - y;
          case "*":
            return x * y;
          case "/":
            return x / y;
          case "%":
            return x % y;
          case "==":
            return String(x) === String(y);
          case "!=":
            return String(x) !== String(y);
          case "<":
            return x < y;
          case ">":
            return x > y;
          case "<=":
            return x <= y;
          case ">=":
            return x >= y;
          case "contains":
            return String(x).toLowerCase().includes(String(y).toLowerCase());
        }
      }
    }
    throw new Error("Unknown expression");
  }
  function compileCoreExpression(source) {
    try {
      let supported2 = function(e) {
        if (e.kind === "call" && !Object.prototype.hasOwnProperty.call(coreFunctions, callName(e.items[0]) || "")) {
          const callee = e.items[0];
          if (callee.kind !== "member" || callee.items[1].kind !== "literal") return false;
          const method = String(callee.items[1].value);
          if (!["join", "slice", "map", "filter", "find", "some", "every", "includes", "indexOf", "split", "toLowerCase", "toUpperCase", "padStart"].includes(method)) return false;
          if (["map", "filter", "find", "some", "every"].includes(method) && e.items[1]?.kind !== "lambda") return false;
        }
        if (e.kind === "object") return e.items.every(([, value]) => supported2(value));
        return !("items" in e) || e.items.every(supported2);
      };
      var supported = supported2;
      const ast = parseCoreExpression(source);
      if (!supported2(ast)) return null;
      return (scope) => evaluateCoreExpression(ast, scope);
    } catch {
      return null;
    }
  }

  // src/random.ts
  function seededRandom(seed) {
    if (!Number.isFinite(seed)) throw new Error("Random seed must be finite");
    let n = Math.trunc(seed) + 1831565813 | 0;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  }
  function randomInt(min, max, seed) {
    min = Math.ceil(min);
    max = Math.floor(max);
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) throw new Error("Invalid random integer range");
    return min + Math.floor((seed === void 0 ? Math.random() : seededRandom(seed)) * (max - min + 1));
  }
  function shuffled(values, seed) {
    const result = values.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = randomInt(0, i, seed + i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // src/globals.ts
  function getWindowProp(key) {
    return window[key];
  }

  // src/utils.ts
  var operatorCache = /* @__PURE__ */ new Map();
  function includesTopLevel(input, delimiter) {
    const key = delimiter + "\0" + input;
    if (operatorCache.has(key)) return operatorCache.get(key);
    const result = scanTopLevel(input, delimiter);
    if (input.length <= 2048) {
      if (operatorCache.size >= 8192) operatorCache.delete(operatorCache.keys().next().value);
      operatorCache.set(key, result);
    }
    return result;
  }
  function scanTopLevel(input, delimiter) {
    let depth = 0;
    let inQuotes = false;
    let quoteChar = "";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if ((ch === '"' || ch === "'") && input[i - 1] !== "\\") {
        if (inQuotes && ch === quoteChar) {
          inQuotes = false;
          quoteChar = "";
        } else if (!inQuotes) {
          inQuotes = true;
          quoteChar = ch;
        }
        continue;
      }
      if (!inQuotes) {
        if (ch === "(" || ch === "[" || ch === "{") depth += 1;
        if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
        if (depth === 0 && input.slice(i, i + delimiter.length) === delimiter) return true;
      }
    }
    return false;
  }
  function splitTopLevel(input, delimiter) {
    const parts = [];
    let current = "";
    let depth = 0;
    let inQuotes = false;
    let quoteChar = "";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if ((ch === '"' || ch === "'") && input[i - 1] !== "\\") {
        if (inQuotes && ch === quoteChar) {
          inQuotes = false;
          quoteChar = "";
        } else if (!inQuotes) {
          inQuotes = true;
          quoteChar = ch;
        }
        current += ch;
        continue;
      }
      if (!inQuotes) {
        if (ch === "[" || ch === "{" || ch === "(") depth += 1;
        if (ch === "]" || ch === "}" || ch === ")") depth -= 1;
        if (depth === 0 && input.slice(i, i + delimiter.length) === delimiter) {
          parts.push(current.trim());
          current = "";
          i += delimiter.length - 1;
          continue;
        }
      }
      current += ch;
    }
    if (current.trim().length > 0) {
      parts.push(current.trim());
    }
    return parts;
  }
  function normalizeLiteral(value) {
    const trimmed = String(value || "").trim();
    if (trimmed.length >= 2 && (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
  function valueToString(value) {
    if (value === null || value === void 0) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value);
    } catch (_err) {
      return "";
    }
  }
  function decodeEscapes(value) {
    const OPEN = "\uE000";
    const CLOSE = "\uE001";
    const input = String(value || "");
    let output = "";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (ch === "\\" && i + 1 < input.length) {
        i += 1;
        const next = input[i];
        if (next === "n") output += "\n";
        else if (next === "r") output += "\r";
        else if (next === "t") output += "	";
        else if (next === '"') output += '"';
        else if (next === "'") output += "'";
        else if (next === "\\") output += "\\";
        else if (next === "{") output += OPEN;
        else if (next === "}") output += CLOSE;
        else output += next;
        continue;
      }
      output += ch;
    }
    return output;
  }
  function expandPercentI18n(value) {
    const input = String(value || "");
    let output = "";
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (ch !== "%") {
        output += ch;
        continue;
      }
      let inner = "";
      let closed = false;
      for (i += 1; i < input.length; i += 1) {
        if (input[i] === "%") {
          closed = true;
          break;
        }
        inner += input[i];
      }
      if (closed && inner.startsWith("i18n.")) {
        output += `{${inner}}`;
      } else {
        output += `%${inner}`;
        if (closed) output += "%";
      }
    }
    return output;
  }

  // src/interpolation.ts
  function interpolate(template, scope) {
    const OPEN = "\uE000";
    const CLOSE = "\uE001";
    return expandPercentI18n(decodeEscapes(String(template || ""))).replace(/\{([^}]+)\}/g, function(_match, expr) {
      const resolved = valueToString(evaluateExpression(expr, scope));
      return resolved.includes("{") && resolved.includes("}") ? interpolate(resolved, scope) : resolved;
    }).replace(new RegExp(OPEN, "g"), "{").replace(new RegExp(CLOSE, "g"), "}");
  }

  // src/scope.ts
  function splitPathSegments(expr) {
    const str = String(expr || "").replace(/\[\]([a-zA-Z_$][\w$]*)/g, "[].(it.$1 == $1)");
    const segments = [];
    let current = "";
    let inBrackets = false;
    let inParens = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === "(") inParens++;
      if (ch === ")") inParens = Math.max(0, inParens - 1);
      if (inParens > 0 && !(ch === "(" && str.slice(i - 3, i + 1) === "[].(")) {
        current += ch;
        continue;
      }
      if (ch === "." && !inBrackets) {
        if (current.trim()) segments.push(current.trim());
        current = "";
        continue;
      }
      if (ch === "[") {
        if (str.slice(i, i + 4) === "[].(") {
          if (current.trim()) segments.push(current.trim());
          current = "[].(";
          i += 3;
          inParens++;
          continue;
        }
        if (current.trim()) segments.push(current.trim());
        current = "[";
        inBrackets = true;
        continue;
      }
      if (ch === "]") {
        if (inBrackets) {
          current += "]";
          segments.push(current.trim());
          current = "";
          inBrackets = false;
          continue;
        }
      }
      current += ch;
    }
    if (current.trim()) segments.push(current.trim());
    return segments;
  }
  var expressionNames = /* @__PURE__ */ new Map();
  function buildScope(locals, expression) {
    const c = ctx();
    if (c.compactScopes && expression !== void 0 && Object.keys(c.helperDefinitions).length === 0) {
      let names = expressionNames.get(expression);
      if (!names) {
        names = [...new Set(expression.match(/[A-Za-z_$][\w$]*/g) || [])];
        if (expressionNames.size >= 4096) expressionNames.clear();
        expressionNames.set(expression, names);
      }
      const scope = {};
      for (const name of names) {
        for (const source of [locals, c.app.derived, c.app.state]) {
          if (source && Object.prototype.propertyIsEnumerable.call(source, name)) {
            scope[name] = source[name];
            break;
          }
        }
      }
      return scope;
    }
    return Object.assign({}, c.app.state, c.app.derived, locals || {});
  }

  // src/pixel3d/math.ts
  var ANGLE_UNITS = 4096;
  var DEG_TO_INDEX = ANGLE_UNITS / 360;
  var RAD_TO_INDEX = ANGLE_UNITS / (Math.PI * 2);
  var SIN_TABLE = new Float64Array(ANGLE_UNITS);
  var COS_TABLE = new Float64Array(ANGLE_UNITS);
  for (let i = 0; i < ANGLE_UNITS; i++) {
    const rad = i * 2 * Math.PI / ANGLE_UNITS;
    SIN_TABLE[i] = Math.sin(rad);
    COS_TABLE[i] = Math.cos(rad);
  }
  function degToIndex(degrees) {
    const raw = Math.round(degrees * DEG_TO_INDEX) % ANGLE_UNITS;
    return raw < 0 ? raw + ANGLE_UNITS : raw;
  }
  function fastSin(degrees) {
    return SIN_TABLE[degToIndex(degrees)];
  }
  function fastCos(degrees) {
    return COS_TABLE[degToIndex(degrees)];
  }

  // src/pixel3d/spatial.ts
  var activeMap = null;
  function setActiveMap(map) {
    activeMap = map;
    if (typeof globalThis !== "undefined") {
      globalThis.__RuneSpatialMap = map;
    }
  }
  function getActiveMap() {
    return activeMap || (typeof globalThis !== "undefined" ? globalThis.__RuneSpatialMap : null) || null;
  }
  function isWallAt(x, y, map = getActiveMap()) {
    const m = map || getActiveMap();
    if (!m) return false;
    const mx = Math.floor(x);
    const my = Math.floor(y);
    if (mx < 0 || mx >= m.width || my < 0 || my >= m.height) return true;
    const cell = m.grid[my * m.width + mx];
    if (cell === 0) return false;
    if (m.doors && m.doors[cell]) {
      return m.doors[cell].open < 0.8;
    }
    return true;
  }
  function collidesWithWall(x, y, radius, map) {
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minY = Math.floor(y - radius);
    const maxY = Math.floor(y + radius);
    for (let my = minY; my <= maxY; my++) {
      for (let mx = minX; mx <= maxX; mx++) {
        if (mx < 0 || mx >= map.width || my < 0 || my >= map.height) {
          return true;
        }
        const cell = map.grid[my * map.width + mx];
        let isWall = cell !== 0;
        if (cell !== 0 && map.doors && map.doors[cell]) {
          isWall = map.doors[cell].open < 0.8;
        }
        if (isWall) {
          const cx = Math.max(mx, Math.min(mx + 1, x));
          const cy = Math.max(my, Math.min(my + 1, y));
          const distX = x - cx;
          const distY = y - cy;
          const r = radius - 1e-3;
          if (distX * distX + distY * distY < r * r) {
            return true;
          }
        }
      }
    }
    return false;
  }
  function slide(px, py, dx, dy, radius = 0.25, map = getActiveMap()) {
    if (Number.isNaN(px) || Number.isNaN(py) || Number.isNaN(dx) || Number.isNaN(dy)) {
      return { x: px, y: py };
    }
    const effectiveMap = map || getActiveMap();
    if (!effectiveMap) return { x: px + dx, y: py + dy };
    let newX = px;
    let newY = py;
    if (dx !== 0) {
      const tryX = px + dx;
      if (!collidesWithWall(tryX, py, radius, effectiveMap)) {
        newX = tryX;
      }
    }
    if (dy !== 0) {
      const tryY = py + dy;
      if (!collidesWithWall(newX, tryY, radius, effectiveMap)) {
        newY = tryY;
      } else if (newX !== px && !collidesWithWall(px, tryY, radius, effectiveMap)) {
        newY = tryY;
        newX = px;
      }
    }
    return { x: newX, y: newY };
  }
  function sees(ax, ay, bx, by, map = getActiveMap()) {
    const m = map || getActiveMap();
    if (!m) return true;
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-3) return true;
    const steps = Math.max(2, Math.ceil(dist * 8));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = ax + dx * t;
      const y = ay + dy * t;
      if (isWallAt(x, y, m)) return false;
    }
    return true;
  }
  function mapSpawn(name) {
    const map = globalThis.__RuneSpatialMaps?.[name];
    if (!map?.spawn) throw new Error(`Map ${name} has no spawn`);
    return { ...map.spawn };
  }

  // src/pixel3d/sky.ts
  function noise(x, y, seed) {
    let n = (x & 63) * 374761393 + y * 668265263 + seed >>> 0;
    n = Math.imul(n ^ n >>> 13, 1274126177) >>> 0;
    return ((n ^ n >>> 16) >>> 0) / 4294967295;
  }
  function mix(a, b, t) {
    let color = 4278190080;
    for (const shift of [0, 8, 16]) {
      color |= Math.floor((a >>> shift & 255) * (1 - t) + (b >>> shift & 255) * t) << shift;
    }
    return color >>> 0;
  }
  function skyPixel(sky, longitude, altitude, time) {
    if (altitude === 0) return (4278190080 | sky.horizon) >>> 0;
    const u = ((longitude / (2 * Math.PI) * 64 + time * sky.speed) % 64 + 64) % 64;
    const v = altitude * 12;
    const x = Math.floor(u), y = Math.floor(v);
    const fx = u - x, fy = v - y;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = noise(x, y, sky.seed) * (1 - sx) + noise(x + 1, y, sky.seed) * sx;
    const b = noise(x, y + 1, sky.seed) * (1 - sx) + noise(x + 1, y + 1, sky.seed) * sx;
    const density = Math.max(0, Math.min(1, (a * (1 - sy) + b * sy - 0.5) * 4));
    const band = Math.floor(altitude * 16) / 16;
    return mix(mix(sky.horizon, sky.zenith, band), sky.cloud, density * Math.min(1, altitude * 5));
  }

  // src/pixel3d/chunks.ts
  var MAX_WORLD_AXIS = 4096;
  var MAX_WORLD_DEPTH = 256;
  var MAX_RESIDENT_CHUNKS = 16384;
  var ChunkStore = class {
    constructor(world, imported = {}) {
      this.world = world;
      this.raw = /* @__PURE__ */ new Map();
      this.populations = /* @__PURE__ */ new Map();
      this.revision = 0;
      this.proxies = /* @__PURE__ */ new Map();
      this.dimensions = [world.width, world.height, world.depth];
      this.cw = Math.ceil(world.width / 4);
      this.ch = Math.ceil(world.height / 4);
      this.cd = Math.ceil(world.depth / 4);
      this.occupied = this.cw * this.ch * this.cd <= 65536 ? new Uint8Array(this.cw * this.ch * this.cd) : /* @__PURE__ */ Object.create(null);
      this.materialCount = world.materials.length;
      this.publicChunks = new Proxy(/* @__PURE__ */ Object.create(null), {
        get: (_t, key) => typeof key === "string" && /^\d+$/.test(key) ? this.proxies.get(Number(key)) : void 0,
        ownKeys: () => [...this.raw.keys()].map(String),
        getOwnPropertyDescriptor: (_t, key) => this.raw.has(Number(key)) ? { enumerable: true, configurable: true } : void 0,
        set: (_t, key, value) => {
          this.replace(Number(key), value);
          return true;
        },
        deleteProperty: (_t, key) => {
          this.remove(Number(key));
          return true;
        },
        defineProperty: () => {
          throw new Error("Chunk descriptors cannot be redefined");
        }
      });
      const volume = world.width * world.height * world.depth;
      const target = [];
      target.length = volume;
      this.cells = new Proxy(target, {
        get: (t, key, receiver) => key === "length" ? volume : typeof key === "string" && /^\d+$/.test(key) ? this.readFlat(Number(key)) : Reflect.get(t, key, receiver),
        set: (_t, key, value) => {
          if (typeof key !== "string" || !/^\d+$/.test(key)) throw new Error("Chunked cells have a fixed length; write a cell index");
          this.writeFlat(Number(key), value);
          return true;
        },
        has: (t, key) => typeof key === "string" && /^\d+$/.test(key) ? Number(key) < volume : Reflect.has(t, key),
        deleteProperty: (_t, key) => {
          this.writeFlat(Number(key), 0);
          return true;
        },
        defineProperty: () => {
          throw new Error("Chunked cells cannot be redefined");
        }
      });
      const entries = Object.entries(imported);
      if (entries.length > MAX_RESIDENT_CHUNKS) throw new Error("Chunked world exceeds resident chunk budget");
      for (const [key, values] of entries) this.replace(Number(key), values);
    }
    /** Bounded render accelerator; large worlds retain sparse lookup. */
    prepareRenderCells() {
      const volume = this.world.width * this.world.height * this.world.depth;
      if (this.renderCells || volume > 65536) return;
      this.renderCells = new Uint16Array(volume);
      for (const [id, values] of this.raw) this.mirror(id, values);
    }
    mirror(id, values) {
      if (!this.renderCells) return;
      const bx = id % this.cw * 4, by = Math.floor(id / this.cw) % this.ch * 4, bz = Math.floor(id / (this.cw * this.ch)) * 4;
      for (let i = 0; i < 64; i++) {
        const x = bx + (i & 3), y = by + (i >> 2 & 3), z = bz + (i >> 4);
        if (x < this.world.width && y < this.world.height && z < this.world.depth) this.renderCells[(z * this.world.height + y) * this.world.width + x] = values?.[i] ?? 0;
      }
    }
    id(value) {
      if (!Number.isInteger(value) || value < 0 || value >= this.cw * this.ch * this.cd) throw new Error("Invalid voxel chunk index");
    }
    block(value) {
      if (!Number.isInteger(value) || value < 0 || value > this.world.materials.length) throw new Error("Invalid voxel block ID");
    }
    cell(id, cell, value) {
      this.block(value);
      if (value && (id % this.cw * 4 + (cell & 3) >= this.world.width || Math.floor(id / this.cw) % this.ch * 4 + (cell >> 2 & 3) >= this.world.height || Math.floor(id / (this.cw * this.ch)) * 4 + (cell >> 4) >= this.world.depth)) throw new Error("Solid chunk cell outside world");
    }
    replace(id, values) {
      this.id(id);
      if (!Array.isArray(values) || values.length !== 64) throw new Error("Voxel chunks need exactly 64 block IDs");
      for (let cell = 0; cell < 64; cell++) this.cell(id, cell, values[cell]);
      const count = values.reduce((n, v) => n + (v !== 0 ? 1 : 0), 0);
      if (!count) {
        this.remove(id);
        return;
      }
      if (!this.raw.has(id) && this.raw.size >= MAX_RESIDENT_CHUNKS) throw new Error("Chunked world exceeds resident chunk budget");
      const raw = values.slice();
      this.raw.set(id, raw);
      this.populations.set(id, count);
      this.occupied[id] = 1;
      this.mirror(id, raw);
      this.proxies.set(id, new Proxy(raw, {
        get: (t, key, receiver) => typeof key === "string" && /^\d+$/.test(key) ? this.raw.get(id)?.[Number(key)] ?? 0 : Reflect.get(t, key, receiver),
        set: (_t, key, value) => {
          if (typeof key !== "string" || !/^\d+$/.test(key) || Number(key) >= 64) throw new Error("Voxel chunks have fixed length");
          this.writeChunk(id, Number(key), value);
          return true;
        },
        deleteProperty: (_t, key) => {
          const cell = Number(key);
          if (!Number.isInteger(cell) || cell < 0 || cell >= 64) throw new Error("Invalid chunk cell");
          this.writeChunk(id, cell, 0);
          return true;
        },
        defineProperty: () => {
          throw new Error("Chunk cells cannot be redefined");
        }
      }));
      this.revision++;
    }
    remove(id) {
      this.id(id);
      if (this.raw.delete(id)) {
        this.mirror(id);
        this.proxies.delete(id);
        this.populations.delete(id);
        if (this.occupied instanceof Uint8Array) this.occupied[id] = 0;
        else delete this.occupied[id];
        this.revision++;
      }
    }
    writeChunk(id, cell, value) {
      this.cell(id, cell, value);
      let raw = this.raw.get(id);
      if (!raw) {
        if (!value) return;
        this.replace(id, Array(64).fill(0).map((_, i) => i === cell ? value : 0));
        return;
      }
      const previous = raw[cell];
      if (previous === value) return;
      raw[cell] = value;
      if (this.renderCells) {
        const x = id % this.cw * 4 + (cell & 3), y = Math.floor(id / this.cw) % this.ch * 4 + (cell >> 2 & 3), z = Math.floor(id / (this.cw * this.ch)) * 4 + (cell >> 4);
        this.renderCells[(z * this.world.height + y) * this.world.width + x] = value;
      }
      const count = this.populations.get(id) + (value ? 1 : 0) - (previous ? 1 : 0);
      if (!count) this.remove(id);
      else {
        this.populations.set(id, count);
        this.revision++;
      }
    }
    /** Fill only intersecting chunks; preflight capacity before changing terrain. */
    fill(from, size, block) {
      const end = from.map((v, i) => v + size[i]), lo = from.map((v) => v >> 2), hi = end.map((v) => v - 1 >> 2);
      let ids;
      if (block === 0) ids = [...this.raw.keys()];
      else {
        if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) > MAX_RESIDENT_CHUNKS) throw new Error("Chunked world exceeds resident chunk budget");
        ids = [];
        let count = this.raw.size;
        for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) {
          const id = (z * this.ch + y) * this.cw + x;
          ids.push(id);
          if (!this.raw.has(id) && ++count > MAX_RESIDENT_CHUNKS) throw new Error("Chunked world exceeds resident chunk budget");
        }
      }
      for (const id of ids) {
        const bx = id % this.cw * 4, by = Math.floor(id / this.cw) % this.ch * 4, bz = Math.floor(id / (this.cw * this.ch)) * 4;
        for (let z = Math.max(from[2], bz); z < Math.min(end[2], bz + 4); z++)
          for (let y = Math.max(from[1], by); y < Math.min(end[1], by + 4); y++)
            for (let x = Math.max(from[0], bx); x < Math.min(end[0], bx + 4); x++) this.writeChunk(id, ((z & 3) * 4 + (y & 3)) * 4 + (x & 3), block);
      }
    }
    readFlat(i) {
      const { width, height, depth } = this.world;
      if (!Number.isInteger(i) || i < 0 || i >= width * height * depth) return void 0;
      const x = i % width, yz = Math.floor(i / width), y = yz % height, z = Math.floor(yz / height);
      return this.raw.get(((z >> 2) * this.ch + (y >> 2)) * this.cw + (x >> 2))?.[((z & 3) * 4 + (y & 3)) * 4 + (x & 3)] ?? 0;
    }
    writeFlat(i, value) {
      const { width, height, depth } = this.world;
      if (!Number.isInteger(i) || i < 0 || i >= width * height * depth) throw new Error("Voxel cell index outside world");
      const x = i % width, yz = Math.floor(i / width), y = yz % height, z = Math.floor(yz / height);
      this.writeChunk(((z >> 2) * this.ch + (y >> 2)) * this.cw + (x >> 2), ((z & 3) * 4 + (y & 3)) * 4 + (x & 3), value);
    }
    validate() {
      if (this.world.width !== this.dimensions[0] || this.world.height !== this.dimensions[1] || this.world.depth !== this.dimensions[2]) throw new Error("Recreate chunked worlds to resize them");
      if (this.materialCount !== this.world.materials.length) {
        for (const raw of this.raw.values()) for (const block of raw) this.block(block);
        this.materialCount = this.world.materials.length;
      }
      if (this.world.cells !== this.cells || this.world.chunks !== this.publicChunks) throw new Error("Use cell writes or recreate a chunked world to replace its storage");
    }
  };
  var stores = /* @__PURE__ */ new WeakMap();
  function chunkStore(world) {
    return stores.get(world) ?? stores.get(rawValue(world));
  }
  function ownChunks(world) {
    world = rawValue(world);
    let store = stores.get(world);
    if (store) return store;
    store = new ChunkStore(world, world.chunks);
    stores.set(world, store);
    ownValue(world);
    ownValue(store.publicChunks);
    ownValue(store.cells);
    world.chunks = store.publicChunks;
    Object.defineProperty(world, "cells", { value: store.cells, writable: true, configurable: true, enumerable: false });
    return store;
  }

  // src/pixel3d/voxel.ts
  var worldSnapshots = /* @__PURE__ */ new WeakMap();
  function inspectWorld(world) {
    let snapshot = worldSnapshots.get(world);
    const width = Math.ceil(world.width / 4), height = Math.ceil(world.height / 4);
    const length = width * height * Math.ceil(world.depth / 4);
    if (!snapshot || snapshot.width !== world.width || snapshot.height !== world.height || snapshot.depth !== world.depth) {
      snapshot = {
        width: world.width,
        height: world.height,
        depth: world.depth,
        materialCount: -1,
        cells: new Uint16Array(world.cells.length),
        populations: new Uint8Array(length),
        chunks: { width, height, depth: Math.ceil(world.depth / 4), occupied: new Uint8Array(length), count: 0 }
      };
      worldSnapshots.set(world, snapshot);
    }
    const { cells, populations, chunks } = snapshot, limit = world.materials.length;
    const validateAll = snapshot.materialCount !== limit;
    for (let i = 0; i < world.cells.length; i++) {
      const block = world.cells[i], previous = cells[i];
      if (block === previous && !validateAll) continue;
      if (!Number.isInteger(block) || block < 0 || block > limit) {
        worldSnapshots.delete(world);
        throw new Error("Voxel world needs material names and an exactly sized array of valid block IDs");
      }
      if (!!block !== !!previous) {
        const x = i % world.width, yz = Math.floor(i / world.width);
        const y = yz % world.height, z = Math.floor(yz / world.height);
        const chunk = ((z >> 2) * height + (y >> 2)) * width + (x >> 2);
        populations[chunk] += block ? 1 : -1;
        if (populations[chunk] === 1 && block) {
          chunks.occupied[chunk] = 1;
          chunks.count++;
        }
        if (populations[chunk] === 0 && !block) {
          chunks.occupied[chunk] = 0;
          chunks.count--;
        }
      }
      cells[i] = block;
    }
    snapshot.materialCount = limit;
    return chunks;
  }
  function prepareVoxelChunks(world) {
    if (world.storage === "chunked" && !chunkStore(world)) validateWorld(world);
    const store = chunkStore(world);
    if (store) return sparseMetadata(store);
    return inspectWorld(world);
  }
  var sparseChunks = /* @__PURE__ */ new WeakMap();
  function sparseMetadata(store) {
    let chunks = sparseChunks.get(store);
    if (!chunks) {
      chunks = { width: store.cw, height: store.ch, depth: store.cd, occupied: store.occupied, count: 0 };
      sparseChunks.set(store, chunks);
    }
    chunks.count = store.raw.size;
    return chunks;
  }
  function validatedVoxelChunks(world) {
    const store = chunkStore(world);
    return store ? sparseMetadata(store) : worldSnapshots.get(world)?.chunks;
  }
  function integer(value, min, max, label) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${label} must be an integer from ${min} to ${max}`);
    }
    return value;
  }
  function validateWorld(value) {
    if (!value || typeof value !== "object") throw new Error("Voxel world must be an object");
    const world = rawValue(value);
    if (chunkStore(world) && world.storage !== "chunked") throw new Error("Chunked world storage cannot be changed");
    integer(world.width, 1, MAX_WORLD_AXIS, "Voxel width");
    integer(world.height, 1, MAX_WORLD_AXIS, "Voxel height");
    integer(world.depth, 1, world.storage === "chunked" ? MAX_WORLD_DEPTH : 24, "Voxel depth");
    if (world.renderDistance !== void 0 && (!Number.isFinite(world.renderDistance) || world.renderDistance <= 0 || world.renderDistance > 4096)) throw new Error("Voxel renderDistance must be in (0, 4096]");
    if (world.storage !== "chunked" && world.width * world.height * world.depth > 48 * 48 * 24) {
      throw new Error("Voxel world must contain at most 55296 cells");
    }
    if (!Array.isArray(world.materials) || world.materials.length < 1 || world.materials.length > 256 || !world.materials.every((name) => typeof name === "string" && name.length > 0)) {
      throw new Error("Voxel world needs material names and an exactly sized array of valid block IDs");
    }
    if (world.storage === "chunked") {
      if (world.width * world.height * world.depth > 2147483647) throw new Error("Chunked world exceeds logical cell limit");
      if (world.chunks !== void 0 && (!world.chunks || typeof world.chunks !== "object" || Array.isArray(world.chunks))) throw new Error("Chunked world chunks must be a record");
      (chunkStore(world) ?? ownChunks(world)).validate();
      return world;
    }
    if (world.storage !== void 0) throw new Error("Unknown voxel storage");
    if (!Array.isArray(world.cells) || world.cells.length !== world.width * world.height * world.depth) throw new Error("Voxel world needs material names and an exactly sized array of valid block IDs");
    inspectWorld(world);
    return world;
  }
  function voxelWorld(width, height, depth, materials, options = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Voxel world options must be an object");
    const opts = options;
    if (Object.keys(opts).some((k) => !["seed", "biome", "spawn", "renderDistance"].includes(k))) throw new Error("Unknown voxel world option");
    const world = {
      width,
      height,
      depth,
      materials: Array.isArray(materials) ? materials.slice() : materials,
      seed: opts.seed ?? 0,
      biome: opts.biome ?? "meadow",
      spawn: opts.spawn ?? { x: 0.5, y: 0.5, z: 1, angle: 0, pitch: 0, vz: 0 },
      storage: "chunked",
      chunks: {},
      renderDistance: opts.renderDistance ?? 128
    };
    return validateWorld(world);
  }
  function index(world, x, y, z) {
    return (z * world.height + y) * world.width + x;
  }
  function voxelGet(world, x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= world.width || y >= world.height || z >= world.depth) return 0;
    const store = chunkStore(world);
    return store ? store.readFlat(index(world, x, y, z)) : world.cells[index(world, x, y, z)];
  }
  function voxelRead(worldValue, xValue, yValue, zValue) {
    const world = validateWorld(worldValue);
    const x = integer(xValue, 0, world.width - 1, "Voxel x");
    const y = integer(yValue, 0, world.height - 1, "Voxel y");
    const z = integer(zValue, 0, world.depth - 1, "Voxel z");
    return voxelGet(world, x, y, z);
  }
  function voxelFill(worldValue, fromValue, sizeValue, blockValue) {
    const world = validateWorld(worldValue);
    if (!Array.isArray(fromValue) || !Array.isArray(sizeValue) || fromValue.length !== 3 || sizeValue.length !== 3) {
      throw new Error("Voxel fill needs from and size arrays with three integers");
    }
    const limits = [world.width, world.height, world.depth];
    const from = fromValue.map((v, i) => integer(v, 0, limits[i] - 1, "Voxel fill origin"));
    const size = sizeValue.map((v, i) => integer(v, 1, limits[i] - from[i], "Voxel fill size"));
    const block = integer(blockValue, 0, world.materials.length, "Voxel fill block");
    const store = chunkStore(world);
    if (store) {
      store.fill(from, size, block);
      return world;
    }
    for (let z = from[2]; z < from[2] + size[2]; z++) for (let y = from[1]; y < from[1] + size[1]; y++) {
      for (let x = from[0]; x < from[0] + size[0]; x++) world.cells[index(world, x, y, z)] = block;
    }
    return world;
  }
  function noise2(x, y, seed) {
    let hash = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ seed;
    hash = Math.imul(hash ^ hash >>> 13, 1274126177);
    return (hash >>> 0) / 4294967296;
  }
  function voxelGenerate(seedValue, biomeValue = "meadow") {
    const seed = integer(seedValue, 0, 4294967295, "Voxel seed");
    if (biomeValue !== "meadow" && biomeValue !== "ember") throw new Error("Voxel biome must be meadow or ember");
    const world = {
      width: 20,
      height: 20,
      depth: 10,
      seed,
      biome: biomeValue,
      materials: [
        "miners/bedrock",
        "miners/stone",
        biomeValue === "ember" ? "miners/ash" : "miners/grass",
        "miners/wood",
        "miners/copper",
        biomeValue === "ember" ? "miners/ember" : "miners/leaves"
      ],
      cells: Array(4e3).fill(0),
      spawn: { x: 4.5, y: 4.5, z: 3, angle: 0, pitch: 0, vz: 0 }
    };
    const set = (x, y, z, block) => {
      world.cells[index(world, x, y, z)] = block;
    };
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const camp = x < 9 && y < 9;
      const top = camp ? 3 : 3 + Math.floor(noise2(Math.floor(x / 3), Math.floor(y / 3), seed + (biomeValue === "ember" ? 137 : 0)) * 3);
      for (let z = 0; z < top; z++) set(x, y, z, z === 0 ? 1 : z === top - 1 ? 3 : noise2(x + z * 13, y, seed) > 0.87 ? 5 : 2);
      if (!camp && x > 1 && y > 1 && x < 18 && y < 18 && noise2(x, y, seed + 1) > 0.94) {
        for (let z = top; z < top + 2; z++) set(x, y, z, 4);
        set(x, y, top + 2, 6);
      }
    }
    for (let x = 8; x < 19; x++) for (let y = 9; y <= 14; y++) {
      const floor = x < 10 ? 3 : x < 12 ? 2 : 1;
      for (let z = floor; z <= (x < 12 ? 8 : 3); z++) set(x, y, z, 0);
      if (x >= 12) set(x, y, 4, 2);
    }
    for (let x = 12; x < 19; x++) {
      set(x, 8, 2, noise2(x, 8, seed) > 0.4 ? 5 : 2);
      set(x, 15, 2, noise2(x, 15, seed) > 0.4 ? 5 : 2);
    }
    for (let y = 9; y <= 14; y++) for (let z = 1; z <= 4; z++) set(19, y, z, 2);
    for (let x = 3; x <= 5; x++) for (let y = 3; y <= 5; y++) set(x, y, 2, 1);
    for (const [x, y, z, block] of [
      [7, 4, 3, 4],
      [7, 4, 4, 4],
      [7, 5, 3, 4],
      [8, 6, 3, 2],
      [8, 6, 4, 2],
      [8, 7, 3, 2],
      [9, 6, 3, 5],
      [9, 7, 3, 5]
    ]) set(x, y, z, block);
    return world;
  }
  function chunkEntry(chunks, x, y, z, tx, ty, tz, dx, dy, dz, sx, sy, sz, maxDistance) {
    let ex = Number.isFinite(tx) ? tx + (sx > 0 ? 3 - (x & 3) : x & 3) * dx : Infinity;
    let ey = Number.isFinite(ty) ? ty + (sy > 0 ? 3 - (y & 3) : y & 3) * dy : Infinity;
    let ez = Number.isFinite(tz) ? tz + (sz > 0 ? 3 - (z & 3) : z & 3) * dz : Infinity;
    x >>= 2;
    y >>= 2;
    z >>= 2;
    const width = chunks.width, height = chunks.height, depth = chunks.depth;
    const stepX = dx * 4, stepY = dy * 4, stepZ = dz * 4;
    const exitX = sx > 0 ? width : -1, exitY = sy > 0 ? height : -1, exitZ = sz > 0 ? depth : -1;
    let cellIndex = (z * height + y) * width + x;
    let entry = 0;
    while (true) {
      if (chunks.occupied[cellIndex]) return entry;
      const axis = ex < ey && ex < ez ? 0 : ey < ez ? 1 : 2;
      const next = axis === 0 ? ex : axis === 1 ? ey : ez;
      if (!Number.isFinite(next) || next > maxDistance) return Infinity;
      const tolerance = 1e-9 * Math.max(1, next);
      if (axis === 0 ? ey - next <= tolerance || ez - next <= tolerance : axis === 1 ? ex - next <= tolerance || ez - next <= tolerance : ex - next <= tolerance || ey - next <= tolerance) return entry;
      entry = next;
      if (axis === 0) {
        x += sx;
        ex += stepX;
        cellIndex += sx;
        if (x === exitX) return Infinity;
      } else if (axis === 1) {
        y += sy;
        ey += stepY;
        cellIndex += sy * width;
        if (y === exitY) return Infinity;
      } else {
        z += sz;
        ez += stepZ;
        cellIndex += sz * width * height;
        if (z === exitZ) return Infinity;
      }
    }
  }
  function voxelRay(world, origin, ray, maxDistance, output, chunks) {
    return traceVoxelRay(
      world,
      origin,
      ray[0],
      ray[1],
      ray[2],
      Math.abs(1 / ray[0]),
      Math.abs(1 / ray[1]),
      Math.abs(1 / ray[2]),
      maxDistance,
      output,
      chunks
    );
  }
  function traceVoxelRay(world, origin, rx, ry, rz, dx, dy, dz, maxDistance, output, chunks, crossings, column = 0, row = 0) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const width = world.width, height = world.height, depth = world.depth;
    const sourceStore = chunkStore(world), cells = sourceStore?.renderCells ?? world.cells;
    const store = sourceStore?.renderCells ? void 0 : sourceStore;
    let lastChunk = -1, blocks;
    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return null;
    const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1, sz = rz < 0 ? -1 : 1;
    const stepY = sy * width, stepZ = sz * width * height;
    let cellIndex = (z * height + y) * width + x;
    let tx = rx === 0 ? Infinity : (sx < 0 ? origin.x - x : x + 1 - origin.x) * dx;
    let ty = ry === 0 ? Infinity : (sy < 0 ? origin.y - y : y + 1 - origin.y) * dy;
    let tz = rz === 0 ? Infinity : (sz < 0 ? origin.z - z : z + 1 - origin.z) * dz;
    if (chunks && (rx !== 0 || ry !== 0 || rz !== 0)) {
      const entry = chunkEntry(chunks, x, y, z, tx, ty, tz, dx, dy, dz, sx, sy, sz, maxDistance);
      if (!Number.isFinite(entry)) return null;
      const beforeEntry = entry - 1e-9 * Math.max(1, entry);
      if (crossings) {
        if (tx < beforeEntry) {
          const offset = column * crossings.strideX;
          const count = crossingBefore(crossings.x, offset, crossings.strideX, beforeEntry, dx);
          x += sx * count;
          tx = crossings.x[offset + count];
        }
        if (ty < beforeEntry) {
          const offset = column * crossings.strideY;
          const count = crossingBefore(crossings.y, offset, crossings.strideY, beforeEntry, dy);
          y += sy * count;
          ty = crossings.y[offset + count];
        }
        if (tz < beforeEntry) {
          const offset = row * crossings.strideZ;
          const count = crossingBefore(crossings.z, offset, crossings.strideZ, beforeEntry, dz);
          z += sz * count;
          tz = crossings.z[offset + count];
        }
      } else {
        while (tx < beforeEntry) {
          x += sx;
          tx += dx;
        }
        while (ty < beforeEntry) {
          y += sy;
          ty += dy;
        }
        while (tz < beforeEntry) {
          z += sz;
          tz += dz;
        }
      }
      cellIndex = (z * height + y) * width + x;
    }
    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return null;
    const exitX = sx > 0 ? width : -1, exitY = sy > 0 ? height : -1, exitZ = sz > 0 ? depth : -1;
    let distance = 0, face = 2;
    for (let iteration = 0; iteration < width + height + depth + 3 && distance <= maxDistance; iteration++) {
      let block;
      if (store) {
        const chunk = ((z >> 2) * store.ch + (y >> 2)) * store.cw + (x >> 2);
        if (chunk !== lastChunk) {
          blocks = store.raw.get(chunk);
          lastChunk = chunk;
        }
        block = blocks?.[((z & 3) * 4 + (y & 3)) * 4 + (x & 3)] ?? 0;
      } else block = cells[cellIndex];
      if (block) {
        if (!output) return { x, y, z, block, distance, face };
        output.x = x;
        output.y = y;
        output.z = z;
        output.block = block;
        output.distance = distance;
        output.face = face;
        return output;
      }
      if (tx < ty && tx < tz) {
        face = 0;
        distance = tx;
        tx += dx;
        x += sx;
        cellIndex += sx;
        if (x === exitX) break;
      } else if (ty < tz) {
        face = 1;
        distance = ty;
        ty += dy;
        y += sy;
        cellIndex += stepY;
        if (y === exitY) break;
      } else {
        face = 2;
        distance = tz;
        tz += dz;
        z += sz;
        cellIndex += stepZ;
        if (z === exitZ) break;
      }
    }
    return null;
  }
  function voxelTarget(worldValue, playerValue) {
    const world = validateWorld(worldValue), player = validatePlayer(playerValue, world);
    const a = player.angle * Math.PI / 180, p = player.pitch * Math.PI / 180;
    return voxelRay(
      world,
      { x: player.x, y: player.y, z: player.z + 1.25 },
      [Math.cos(a) * Math.cos(p), Math.sin(a) * Math.cos(p), Math.sin(p)],
      3
    );
  }
  function validatePlayer(value, world) {
    if (!value || typeof value !== "object") throw new Error("Voxel player must be an object");
    const player = value;
    if (![player.x, player.y, player.z, player.angle, player.pitch, player.vz].every(Number.isFinite)) {
      throw new Error("Voxel player needs finite x, y, z, angle, pitch and vz");
    }
    if (player.x < 0.25 || player.y < 0.25 || player.x > world.width - 0.25 || player.y > world.height - 0.25 || player.z < 1 || player.z + 1.6 > world.depth || Math.abs(player.vz) > 1 || Math.abs(player.pitch) > 90) {
      throw new Error("Voxel player must be inside movement bounds, with pitch within 90 degrees and vz within 1");
    }
    return player;
  }
  function voxelMine(worldValue, playerValue) {
    const world = validateWorld(worldValue);
    const hit = voxelTarget(world, playerValue);
    if (!hit || hit.block === 1) return { block: 0, hit };
    world.cells[index(world, hit.x, hit.y, hit.z)] = 0;
    return { block: hit.block, hit };
  }
  function clearBody(world, x, y, z) {
    if (x < 0.25 || y < 0.25 || x > world.width - 0.25 || y > world.height - 0.25 || z < 1 || z + 1.6 > world.depth) return false;
    for (const dx of [-0.24, 0.24]) for (const dy of [-0.24, 0.24]) {
      for (let bz = Math.floor(z + 1e-3); bz <= Math.floor(z + 1.599); bz++) {
        if (voxelGet(world, Math.floor(x + dx), Math.floor(y + dy), bz)) return false;
      }
    }
    return true;
  }
  function voxelMove(worldValue, playerValue, dxValue, dyValue, jumpValue = false, movementValue = {}) {
    const world = validateWorld(worldValue), p = { ...validatePlayer(playerValue, world) };
    if (!movementValue || typeof movementValue !== "object" || Array.isArray(movementValue) || Object.keys(movementValue).some((key) => !["jumpSpeed", "gravity", "autoStep"].includes(key))) {
      throw new Error("Voxel movement options accept jumpSpeed, gravity and autoStep");
    }
    const { jumpSpeed = 0.28, gravity = 0.035, autoStep = true } = movementValue;
    if (!Number.isFinite(jumpSpeed) || jumpSpeed <= 0 || jumpSpeed > 1 || !Number.isFinite(gravity) || gravity <= 0 || gravity > 0.3 || typeof autoStep !== "boolean") {
      throw new Error("Voxel movement needs jumpSpeed in (0, 1], gravity in (0, 0.3] and boolean autoStep");
    }
    if (typeof dxValue !== "number" || typeof dyValue !== "number" || !Number.isFinite(dxValue) || !Number.isFinite(dyValue) || Math.hypot(dxValue, dyValue) > 1 || typeof jumpValue !== "boolean") {
      throw new Error("Voxel movement needs finite deltas of at most one tile and a boolean jump");
    }
    const grounded = !clearBody(world, p.x, p.y, p.z - 0.05);
    if (jumpValue && grounded) p.vz = jumpSpeed;
    p.vz = Math.max(-0.3, p.vz - gravity);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dxValue), Math.abs(dyValue), Math.abs(p.vz)) / 0.05));
    for (let i = 0; i < steps; i++) {
      for (const [axis, delta] of [["x", dxValue / steps], ["y", dyValue / steps]]) {
        const x = p.x + (axis === "x" ? delta : 0), y = p.y + (axis === "y" ? delta : 0);
        if (clearBody(world, x, y, p.z)) p[axis] += delta;
        else if (autoStep && grounded && delta !== 0 && clearBody(world, x, y, Math.floor(p.z) + 1)) {
          p.z = Math.floor(p.z) + 1;
          p[axis] += delta;
          p.vz = 0;
        }
      }
      if (clearBody(world, p.x, p.y, p.z + p.vz / steps)) p.z += p.vz / steps;
      else {
        if (p.vz < 0) p.z = Math.round(p.z);
        p.vz = 0;
      }
    }
    return p;
  }
  var crossingScratch = /* @__PURE__ */ new WeakMap();
  function fillCrossings(values, offset, stride, position, component, delta) {
    const cell = Math.floor(position);
    let next = component === 0 ? Infinity : (component < 0 ? position - cell : cell + 1 - position) * delta;
    for (let i = 0; i < stride; i++) {
      values[offset + i] = next;
      next += delta;
    }
  }
  function crossingBefore(values, offset, stride, before, delta) {
    let count = Math.max(0, Math.min(stride - 1, Math.ceil((before - values[offset]) / delta)));
    while (count < stride - 1 && values[offset + count] < before) count++;
    while (count > 0 && values[offset + count - 1] >= before) count--;
    return count;
  }
  function rayCrossings(world, origin, rays, owner) {
    const previous = crossingScratch.get(owner);
    const strideX = world.width + 1, strideY = world.height + 1, strideZ = world.depth + 1;
    const sameRays = previous && previous.angle === rays.angle && previous.fov === rays.fov && previous.width === rays.width && previous.height === rays.height;
    const x = previous?.x.length === rays.width * strideX ? previous.x : new Float64Array(rays.width * strideX);
    const y = previous?.y.length === rays.width * strideY ? previous.y : new Float64Array(rays.width * strideY);
    const z = previous?.z.length === rays.height * strideZ ? previous.z : new Float64Array(rays.height * strideZ);
    if (!sameRays || previous.originX !== origin.x || previous.strideX !== strideX) {
      for (let column = 0; column < rays.width; column++)
        fillCrossings(x, column * strideX, strideX, origin.x, rays.columns[column * 4], rays.columns[column * 4 + 2]);
    }
    if (!sameRays || previous.originY !== origin.y || previous.strideY !== strideY) {
      for (let column = 0; column < rays.width; column++)
        fillCrossings(y, column * strideY, strideY, origin.y, rays.columns[column * 4 + 1], rays.columns[column * 4 + 3]);
    }
    if (!sameRays || previous.originZ !== origin.z || previous.strideZ !== strideZ) {
      for (let row = 0; row < rays.height; row++)
        fillCrossings(z, row * strideZ, strideZ, origin.z, rays.rows[row * 2], rays.rows[row * 2 + 1]);
    }
    const result = {
      originX: origin.x,
      originY: origin.y,
      originZ: origin.z,
      angle: rays.angle,
      fov: rays.fov,
      width: rays.width,
      height: rays.height,
      strideX,
      strideY,
      strideZ,
      x,
      y,
      z
    };
    crossingScratch.set(owner, result);
    return result;
  }
  var cameraRayScratch = /* @__PURE__ */ new WeakMap();
  function cameraRays(camera, fov, width, height, depth) {
    if ((camera.pitch ?? 0) !== 0) return null;
    const angle = camera.angle;
    let cached = cameraRayScratch.get(depth);
    if (cached && cached.width === width && cached.height === height && cached.angle === angle && cached.fov === fov) return cached;
    const a = angle * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const scale = Math.tan(fov * Math.PI / 360);
    const columns = cached?.columns.length === width * 4 ? cached.columns : new Float64Array(width * 4);
    const rows = cached?.rows.length === height * 2 ? cached.rows : new Float64Array(height * 2);
    for (let x = 0; x < width; x++) {
      const u = (2 * x / width - 1) * scale, i = x * 4;
      const rx = ca - sa * u, ry = sa + ca * u;
      columns[i] = rx;
      columns[i + 1] = ry;
      columns[i + 2] = Math.abs(1 / rx);
      columns[i + 3] = Math.abs(1 / ry);
    }
    for (let y = 0; y < height; y++) {
      const rz = (height / 2 - y - 0.5) / height;
      rows[y * 2] = rz;
      rows[y * 2 + 1] = Math.abs(1 / rz);
    }
    cached = { width, height, angle, fov, columns, rows };
    cameraRayScratch.set(depth, cached);
    return cached;
  }
  function renderVoxels(world, camera, textures, sky, fov, width, height, buffer, depth, time, preparedChunks) {
    const eye = (camera.z ?? 0) + 1.25, a = camera.angle * Math.PI / 180, p = (camera.pitch ?? 0) * Math.PI / 180;
    const ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(p), sp = Math.sin(p);
    const scale = Math.tan(fov * Math.PI / 360);
    const materialTextures = world.materials.map((name) => {
      const texture = textures[name];
      if (!texture) throw new Error(`Unknown voxel material texture: ${name}`);
      return texture;
    });
    if (![camera.x, camera.y, eye, camera.angle, camera.pitch ?? 0].every(Number.isFinite) || camera.x < 0 || camera.y < 0 || camera.x >= world.width || camera.y >= world.height || eye < 0 || eye >= world.depth || Math.abs(camera.pitch ?? 0) > 85) {
      throw new Error("Voxel camera must be finite, inside the world, with pitch between -85 and 85 degrees");
    }
    chunkStore(world)?.prepareRenderCells();
    const origin = { x: camera.x, y: camera.y, z: eye };
    const rays = cameraRays(camera, fov, width, height, depth);
    const hitOutput = { x: 0, y: 0, z: 0, block: 0, distance: 0, face: 0 };
    const maxDistance = Math.min(Math.hypot(world.width, world.height, world.depth), world.renderDistance ?? Infinity);
    const occupancy = preparedChunks ?? prepareVoxelChunks(world);
    const chunks = occupancy.count < occupancy.width * occupancy.height * occupancy.depth * 0.6 ? occupancy : void 0;
    const crossings = rays && chunks && world.width <= 256 && world.height <= 256 ? rayCrossings(world, origin, rays, depth) : void 0;
    const horizon = sky ? (4278190080 | sky.horizon) >>> 0 : 4281608224;
    for (let y = 0; y < height; y++) {
      const v = (height / 2 - y - 0.5) / height;
      const rz = rays ? rays.rows[y * 2] : sp + cp * v;
      const dz = rays ? rays.rows[y * 2 + 1] : Math.abs(1 / rz);
      for (let x = 0; x < width; x++) {
        const i = y * width + x, r = x * 4;
        const u = (2 * x / width - 1) * scale;
        const rx = rays ? rays.columns[r] : ca * cp - sa * u - ca * sp * v;
        const ry = rays ? rays.columns[r + 1] : sa * cp + ca * u - sa * sp * v;
        const dx = rays ? rays.columns[r + 2] : Math.abs(1 / rx);
        const dy = rays ? rays.columns[r + 3] : Math.abs(1 / ry);
        const hit = occupancy.count === 0 ? null : traceVoxelRay(
          world,
          origin,
          rx,
          ry,
          rz,
          dx,
          dy,
          dz,
          maxDistance,
          hitOutput,
          chunks,
          crossings,
          x,
          y
        );
        if (!hit) {
          depth[i] = Infinity;
          buffer[i] = sky && rz > 0 ? skyPixel(sky, Math.atan2(ry, rx), Math.min(1, rz), time) : horizon;
        } else {
          depth[i] = hit.distance;
          const texture = materialTextures[hit.block - 1];
          const pointU = hit.face === 0 ? camera.y + ry * hit.distance : camera.x + rx * hit.distance;
          const pointV = hit.face === 2 ? camera.y + ry * hit.distance : eye + rz * hit.distance;
          const tx = Math.floor((pointU % 1 + 1) % 1 * texture.width);
          const ty = Math.floor((pointV % 1 + 1) % 1 * texture.height);
          const color = texture.pixels[ty * texture.width + tx], factor = hit.face === 2 ? 1 : hit.face === 0 ? 0.8 : 0.65;
          buffer[i] = (4278190080 | Math.floor((color & 255) * factor) | Math.floor((color >>> 8 & 255) * factor) << 8 | Math.floor((color >>> 16 & 255) * factor) << 16) >>> 0;
        }
      }
    }
  }

  // src/expression.ts
  var MAX_DEPTH = 64;
  var voxelFunctions = {
    voxel_world: (width, height, depth, materials, options) => voxelWorld(width, height, depth, materials, options),
    nearby: (entities, position, radius) => nearby(entities, position, radius),
    entity_group: (entities) => entityGroup(entities),
    voxel_generate: (seed, biome) => voxelGenerate(seed, biome),
    voxel_move: (world, player, dx, dy, jump, movement) => voxelMove(world, player, dx, dy, jump, movement),
    voxel_target: (world, player) => voxelTarget(world, player),
    voxel_mine: (world, player) => voxelMine(world, player),
    voxel_get: (world, x, y, z) => voxelRead(world, x, y, z),
    voxel_fill: (world, from, size, block) => voxelFill(world, from, size, block)
  };
  var voxelArity = {
    voxel_world: [4, 5],
    nearby: [3, 3],
    entity_group: [0, 1],
    voxel_generate: [1, 2],
    voxel_move: [4, 6],
    voxel_target: [2, 2],
    voxel_mine: [2, 2],
    voxel_get: [4, 4],
    voxel_fill: [4, 4]
  };
  function tryParseLiteral(expr, scope) {
    const trimmed = String(expr || "").trim();
    if (trimmed === "") return void 0;
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    if (!Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed))
      return Number(trimmed);
    if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
      if (trimmed.startsWith('"')) {
        try {
          return JSON.parse(trimmed);
        } catch (_) {
        }
      }
      return normalizeLiteral(trimmed);
    }
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const keys = scope ? Object.keys(scope).filter(
          (k) => k !== "this" && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(k)
        ) : [];
        const vals = keys.map((k) => scope[k]);
        return new Function(...keys, `return (${trimmed});`)(...vals);
      } catch (_err) {
        return void 0;
      }
    }
    return void 0;
  }
  function resolvePath(expr, scope) {
    const segments = splitPathSegments(expr);
    if (!segments.length) return void 0;
    let current = scope[segments[0]];
    if (current === void 0) return void 0;
    for (let i = 1; i < segments.length; i += 1) {
      const segment = segments[i];
      if (current === null || current === void 0) return void 0;
      if (Array.isArray(current) && segment === "length") {
        current = current.length;
      } else if (Array.isArray(current) && segment.startsWith("[].(") && segment.endsWith(")")) {
        const condition = segment.slice(4, -1);
        const match = current.find((item) => {
          const innerScope = Object.assign({}, scope, { it: item });
          return Boolean(evaluateExpression(condition, innerScope, 0));
        });
        if (match !== void 0) current = match;
        else return void 0;
      } else if (segment.startsWith("[") && segment.endsWith("]")) {
        const innerExpr = segment.slice(1, -1);
        const lookup = evaluateExpression(innerExpr, scope, 0);
        current = current[valueToString(lookup)];
      } else {
        current = current[segment];
      }
    }
    return current;
  }
  function resolveValue(expr, scope) {
    const literal = tryParseLiteral(expr, scope);
    if (literal !== void 0) return literal;
    const pathValue = resolvePath(expr, scope);
    if (pathValue !== void 0) return pathValue;
    if (expr.includes(".") || expr.includes("[")) return void 0;
    return normalizeLiteral(expr);
  }
  function parseHelperCall(expr) {
    const trimmed = String(expr || "").trim();
    if (!trimmed) return null;
    const { helperDefinitions } = ctx();
    const parenMatch = trimmed.match(/^([A-Za-z_][\w-]*)\((.*)?\)$/);
    if (parenMatch && helperDefinitions[parenMatch[1]]) {
      return {
        name: parenMatch[1],
        args: parenMatch[2] ? splitTopLevel(parenMatch[2], ",") : []
      };
    }
    const firstSpace = trimmed.indexOf(" ");
    if (firstSpace > 0) {
      const name = trimmed.slice(0, firstSpace);
      if (helperDefinitions[name]) {
        return {
          name,
          args: trimmed.slice(firstSpace + 1).split(/\s+/).filter(Boolean)
        };
      }
    }
    if (helperDefinitions[trimmed]) {
      return { name: trimmed, args: [] };
    }
    return null;
  }
  function callHelper(name, args, scope, depth) {
    const { helperDefinitions } = ctx();
    const helper = helperDefinitions[name];
    if (!helper) return void 0;
    const helperLocals = Object.assign({}, scope || {});
    (helper.params || []).forEach((param, index2) => {
      helperLocals[param] = args[index2];
    });
    for (const line of helper.body || []) {
      const trimmed = String(line || "").trim();
      if (trimmed.startsWith("return ")) {
        return evaluateExpression(
          trimmed.slice(7),
          buildScope(helperLocals),
          depth
        );
      }
    }
    return void 0;
  }
  var exprCache = /* @__PURE__ */ new Map();
  var MAX_CACHE_SIZE = 8192;
  function compilePath(expr) {
    const segments = splitPathSegments(expr);
    if (!segments.length) return () => void 0;
    if (segments.length === 1 && !segments[0].includes("[")) {
      const key = segments[0];
      return (scope) => scope?.[key];
    }
    if (segments.length === 2 && !segments[0].includes("[") && !segments[1].includes("[")) {
      const k0 = segments[0];
      const k1 = segments[1];
      if (k1 === "length") {
        return (scope) => {
          const obj = scope?.[k0];
          return Array.isArray(obj) ? obj.length : obj?.length;
        };
      }
      return (scope) => {
        const obj = scope?.[k0];
        return obj?.[k1];
      };
    }
    if (segments.length === 3 && !segments[0].includes("[") && !segments[1].includes("[") && !segments[2].includes("[")) {
      const k0 = segments[0];
      const k1 = segments[1];
      const k2 = segments[2];
      if (k2 === "length") {
        return (scope) => {
          const o0 = scope?.[k0];
          const obj = o0?.[k1];
          return Array.isArray(obj) ? obj.length : obj?.length;
        };
      }
      return (scope) => {
        const o0 = scope?.[k0];
        const o1 = o0?.[k1];
        return o1?.[k2];
      };
    }
    const compiledSteps = segments.map((segment) => {
      if (segment === "length") {
        return (current) => Array.isArray(current) ? current.length : current?.length;
      }
      if (segment.startsWith("[].(") && segment.endsWith(")")) {
        const cond = compileExpression(segment.slice(4, -1));
        return (current, scope) => {
          if (!Array.isArray(current)) return void 0;
          return current.find((item) => {
            const innerScope = Object.assign({}, scope, { it: item });
            return Boolean(cond(innerScope));
          });
        };
      }
      if (segment.startsWith("[") && segment.endsWith("]")) {
        const inner = compileExpression(segment.slice(1, -1));
        return (current, scope) => {
          if (current === null || current === void 0) return void 0;
          const lookup = inner(scope);
          return current[valueToString(lookup)];
        };
      }
      return (current) => {
        if (current === null || current === void 0) return void 0;
        return current[segment];
      };
    });
    return (scope) => {
      let current = scope;
      for (let i = 0; i < compiledSteps.length; i++) {
        if (current === null || current === void 0) return void 0;
        current = compiledSteps[i](current, scope);
      }
      return current;
    };
  }
  function compileResolveValue(expr) {
    const trimmed = expr.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      return (scope) => resolveValue(trimmed, scope);
    }
    const literal = tryParseLiteral(trimmed);
    if (literal !== void 0) {
      return () => literal;
    }
    if (trimmed.includes(".") || trimmed.includes("[")) {
      const pathFn = compilePath(trimmed);
      return (scope) => pathFn(scope);
    }
    const fallback = normalizeLiteral(trimmed);
    return (scope) => {
      if (scope && scope[trimmed] !== void 0) {
        return scope[trimmed];
      }
      return fallback;
    };
  }
  function compileExpression(expr, depth = 0) {
    if (depth > MAX_DEPTH) return () => void 0;
    const nextDepth = depth + 1;
    let trimmed = String(expr || "").trim();
    if (!trimmed) return () => void 0;
    if (trimmed === "true") return () => true;
    if (trimmed === "false") return () => false;
    if (trimmed === "null") return () => null;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed);
      return () => n;
    }
    if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[\d+\])*$/.test(trimmed)) {
      const pathFn = compilePath(trimmed);
      if (!trimmed.includes(".") && !trimmed.includes("[")) {
        const fallback = normalizeLiteral(trimmed);
        return (scope) => {
          const val = pathFn(scope);
          return val !== void 0 ? val : fallback;
        };
      }
      return (scope) => pathFn(scope);
    }
    const core = compileCoreExpression(trimmed);
    if (core) return core;
    if (trimmed.startsWith('"')) {
      try {
        const literal = JSON.parse(trimmed);
        if (typeof literal === "string") return () => literal;
      } catch (_) {
      }
    }
    if (trimmed.startsWith("@")) {
      let selector = "";
      let rest = "";
      if (trimmed.startsWith("@[")) {
        const closeIdx = trimmed.indexOf("]");
        if (closeIdx > 1) {
          selector = trimmed.slice(2, closeIdx);
          rest = trimmed.slice(closeIdx + 1);
        }
      } else {
        const match = trimmed.match(/^@([\w-]+)(.*)$/);
        if (match) {
          selector = "." + match[1];
          rest = match[2];
        }
      }
      if (selector) {
        const cRest = rest ? compilePath(rest.startsWith(".") ? rest.slice(1) : rest) : null;
        return () => {
          if (typeof document !== "undefined") {
            const el = document.querySelector(selector);
            if (el) {
              if (!cRest) return el;
              return cRest(el);
            }
          }
          return void 0;
        };
      }
    }
    let parenStripped = false;
    while (trimmed.startsWith("(") && trimmed.endsWith(")")) {
      let d = 0;
      let matched = true;
      for (let i = 0; i < trimmed.length - 1; i += 1) {
        if (trimmed[i] === "(") d += 1;
        if (trimmed[i] === ")") d -= 1;
        if (d === 0) {
          matched = false;
          break;
        }
      }
      if (!matched) break;
      trimmed = trimmed.slice(1, -1).trim();
      parenStripped = true;
    }
    if (parenStripped) {
      return compileExpression(trimmed, nextDepth);
    }
    if (trimmed.startsWith("!")) {
      const inner = compileExpression(trimmed.slice(1).trim(), nextDepth);
      return (scope) => !Boolean(inner(scope));
    }
    for (const [name, fn] of Object.entries(voxelFunctions)) {
      if (trimmed.startsWith(name + "(") && trimmed.endsWith(")")) {
        const parts = splitTopLevel(trimmed.slice(name.length + 1, -1), ",");
        const [required, maximum] = voxelArity[name];
        if (parts.length < required || parts.length > maximum) throw new Error(`${name} needs ${required}-${maximum} arguments`);
        const args = parts.map((part) => compileExpression(part, nextDepth));
        return (scope) => fn(...args.map((arg) => arg(scope)));
      }
    }
    if (trimmed.startsWith("map_spawn(") && trimmed.endsWith(")")) {
      const name = compileExpression(trimmed.slice(10, -1), nextDepth);
      return (scope) => mapSpawn(String(name(scope)));
    }
    if (trimmed.startsWith("collide(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(8, -1), ",");
      if (parts.length >= 2) {
        const cA = compileExpression(parts[0], nextDepth);
        const cB = compileExpression(parts[1], nextDepth);
        const cW = parts.length >= 3 ? compileExpression(parts[2], nextDepth) : null;
        const cH = parts.length >= 4 ? compileExpression(parts[3], nextDepth) : null;
        return (scope) => {
          const a = cA(scope);
          const b = cB(scope);
          const w = cW ? Number(cW(scope)) : 20;
          const h = cH ? Number(cH(scope)) : w;
          if (a && b && typeof a === "object" && typeof b === "object" && a.x !== void 0 && a.y !== void 0 && b.x !== void 0 && b.y !== void 0) {
            return Math.abs(Number(a.x) - Number(b.x)) < w && Math.abs(Number(a.y) - Number(b.y)) < h;
          }
          return false;
        };
      }
    }
    if (trimmed.startsWith("clamp(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(6, -1), ",");
      if (parts.length === 3) {
        const cV = compileExpression(parts[0], nextDepth);
        const cMin = compileExpression(parts[1], nextDepth);
        const cMax = compileExpression(parts[2], nextDepth);
        return (scope) => {
          const v = Number(cV(scope));
          const min = Number(cMin(scope));
          const max = Number(cMax(scope));
          return Math.min(Math.max(v, min), max);
        };
      }
    }
    if (trimmed.startsWith("abs(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(4, -1), nextDepth);
      return (scope) => Math.abs(Number(cVal(scope)));
    }
    if (trimmed.startsWith("floor(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(6, -1), nextDepth);
      return (scope) => Math.floor(Number(cVal(scope)));
    }
    if (trimmed.startsWith("sqrt(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(5, -1), nextDepth);
      return (scope) => Math.sqrt(Number(cVal(scope)));
    }
    if (trimmed.startsWith("sin(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(4, -1), nextDepth);
      return (scope) => Math.sin(Number(cVal(scope)) * Math.PI / 180);
    }
    if (trimmed.startsWith("cos(") && trimmed.endsWith(")")) {
      const cVal = compileExpression(trimmed.slice(4, -1), nextDepth);
      return (scope) => Math.cos(Number(cVal(scope)) * Math.PI / 180);
    }
    if (trimmed.startsWith("atan2(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(6, -1), ",");
      if (parts.length === 2) {
        const cDy = compileExpression(parts[0], nextDepth);
        const cDx = compileExpression(parts[1], nextDepth);
        return (scope) => {
          const dy = Number(cDy(scope));
          const dx = Number(cDx(scope));
          let deg = Math.atan2(dy, dx) * 180 / Math.PI;
          if (deg < 0) deg += 360;
          return deg;
        };
      }
    }
    if (trimmed.startsWith("distance(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(9, -1), ",");
      if (parts.length === 2) {
        const cA = compileExpression(parts[0], nextDepth);
        const cB = compileExpression(parts[1], nextDepth);
        return (scope) => {
          const a = cA(scope);
          const b = cB(scope);
          if (a && b && typeof a === "object" && typeof b === "object" && a.x !== void 0 && a.y !== void 0 && b.x !== void 0 && b.y !== void 0) {
            const dx = Number(a.x) - Number(b.x);
            const dy = Number(a.y) - Number(b.y);
            return Math.sqrt(dx * dx + dy * dy);
          }
          return 0;
        };
      } else if (parts.length === 4) {
        const cAx = compileExpression(parts[0], nextDepth);
        const cAy = compileExpression(parts[1], nextDepth);
        const cBx = compileExpression(parts[2], nextDepth);
        const cBy = compileExpression(parts[3], nextDepth);
        return (scope) => {
          const dx = Number(cAx(scope)) - Number(cBx(scope));
          const dy = Number(cAy(scope)) - Number(cBy(scope));
          return Math.sqrt(dx * dx + dy * dy);
        };
      }
    }
    if (trimmed.startsWith("angle_to(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(9, -1), ",");
      if (parts.length === 2) {
        const cA = compileExpression(parts[0], nextDepth);
        const cB = compileExpression(parts[1], nextDepth);
        return (scope) => {
          const a = cA(scope);
          const b = cB(scope);
          if (a && b && typeof a === "object" && typeof b === "object" && a.x !== void 0 && a.y !== void 0 && b.x !== void 0 && b.y !== void 0) {
            let deg = Math.atan2(Number(b.y) - Number(a.y), Number(b.x) - Number(a.x)) * 180 / Math.PI;
            if (deg < 0) deg += 360;
            return deg;
          }
          return 0;
        };
      }
    }
    if (trimmed.startsWith("slide(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(6, -1), ",");
      if (parts.length >= 4) {
        const cPx = compileExpression(parts[0], nextDepth);
        const cPy = compileExpression(parts[1], nextDepth);
        const cDx = compileExpression(parts[2], nextDepth);
        const cDy = compileExpression(parts[3], nextDepth);
        const cR = parts.length >= 5 ? compileExpression(parts[4], nextDepth) : null;
        return (scope) => {
          const px = Number(cPx(scope));
          const py = Number(cPy(scope));
          const dx = Number(cDx(scope));
          const dy = Number(cDy(scope));
          const r = cR ? Number(cR(scope)) : 0.25;
          return slide(px, py, dx, dy, r);
        };
      }
    }
    if (trimmed.startsWith("sees(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(5, -1), ",");
      if (parts.length === 2) {
        const cA = compileExpression(parts[0], nextDepth);
        const cB = compileExpression(parts[1], nextDepth);
        return (scope) => {
          const a = cA(scope);
          const b = cB(scope);
          if (!a || !b) return false;
          return sees(Number(a.x), Number(a.y), Number(b.x), Number(b.y));
        };
      } else if (parts.length >= 4) {
        const cX1 = compileExpression(parts[0], nextDepth);
        const cY1 = compileExpression(parts[1], nextDepth);
        const cX2 = compileExpression(parts[2], nextDepth);
        const cY2 = compileExpression(parts[3], nextDepth);
        return (scope) => {
          return sees(
            Number(cX1(scope)),
            Number(cY1(scope)),
            Number(cX2(scope)),
            Number(cY2(scope))
          );
        };
      }
    }
    if (trimmed.startsWith("random(") && trimmed.endsWith(")")) {
      const parts = splitTopLevel(trimmed.slice(7, -1), ",");
      if (parts.length >= 2) {
        const cMin = compileExpression(parts[0], nextDepth);
        const cMax = compileExpression(parts[1], nextDepth);
        const cSeed = parts.length >= 3 ? compileExpression(parts[2], nextDepth) : null;
        return (scope) => {
          const min = Number(cMin(scope));
          const max = Number(cMax(scope));
          return randomInt(min, max, cSeed ? Number(cSeed(scope)) : void 0);
        };
      }
    }
    for (const name of ["shuffle", "pick"]) {
      if (trimmed.startsWith(name + "(") && trimmed.endsWith(")")) {
        const parts = splitTopLevel(trimmed.slice(name.length + 1, -1), ",");
        const cValues = compileExpression(parts[0], nextDepth);
        const cSeed = parts.length > 1 ? compileExpression(parts[1], nextDepth) : null;
        return (scope) => {
          const values = cValues(scope);
          if (!Array.isArray(values)) return void 0;
          const seed = cSeed ? Number(cSeed(scope)) : randomInt(0, 2147483647);
          return name === "shuffle" ? shuffled(values, seed) : values.length ? values[randomInt(0, values.length - 1, seed)] : null;
        };
      }
    }
    if (trimmed.startsWith("min(") && trimmed.endsWith(")")) {
      const cParts = splitTopLevel(trimmed.slice(4, -1), ",").map((p) => compileExpression(p, nextDepth));
      return (scope) => Math.min(...cParts.map((fn) => Number(fn(scope))));
    }
    if (trimmed.startsWith("max(") && trimmed.endsWith(")")) {
      const cParts = splitTopLevel(trimmed.slice(4, -1), ",").map((p) => compileExpression(p, nextDepth));
      return (scope) => Math.max(...cParts.map((fn) => Number(fn(scope))));
    }
    if (trimmed.startsWith("storage.get(") || trimmed.startsWith("local_storage.get(") || trimmed.startsWith("localStorage.get(")) {
      const callEnd = trimmed.lastIndexOf(")");
      const callPart = trimmed.slice(0, callEnd + 1);
      const trailingProp = trimmed.slice(callEnd + 1).trim();
      const inner = callPart.slice(callPart.indexOf("(") + 1, -1);
      const parts = splitTopLevel(inner, ",");
      const cKey = compileExpression(parts[0], nextDepth);
      const cDef = parts.length > 1 ? compileExpression(parts[1], nextDepth) : null;
      return (scope) => {
        const key = String(cKey(scope));
        const defVal = cDef ? cDef(scope) : null;
        const item = getStorageItem(key);
        let result = defVal;
        if (item !== null) {
          try {
            result = JSON.parse(item);
          } catch {
            result = item;
          }
        }
        if (trailingProp.startsWith(".") && result && typeof result === "object") {
          const prop = trailingProp.slice(1);
          return result[prop];
        }
        return result;
      };
    }
    if (trimmed.startsWith("storage.has(") || trimmed.startsWith("local_storage.has(") || trimmed.startsWith("localStorage.has(")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const cKey = compileExpression(inner, nextDepth);
      return (scope) => hasStorageItem(String(cKey(scope)));
    }
    const helperCall = parseHelperCall(trimmed);
    if (helperCall) {
      const cArgs = helperCall.args.map((arg) => compileExpression(arg, nextDepth));
      const name = helperCall.name;
      return (scope) => callHelper(name, cArgs.map((fn) => fn(scope)), scope, nextDepth);
    }
    const methodMatch = trimmed.match(
      /^(.+?)\.(any|mask|filter|find|max)(?:\((.*)\)|\s+(.+?))(?:\.(length))?$/
    );
    if (methodMatch) {
      const [, receiver, method, parenArgs, spaceArgs, trailingProp] = methodMatch;
      const argsStr = (parenArgs !== void 0 ? parenArgs : spaceArgs).trim();
      const cReceiver = compileExpression(receiver, nextDepth);
      if (method === "mask") {
        const cArg = compileExpression(argsStr, nextDepth);
        return (scope) => {
          const collection = cReceiver(scope);
          if (!Array.isArray(collection)) return void 0;
          const player = valueToString(cArg(scope));
          return collection.reduce(
            (acc, cell, i) => {
              return valueToString(cell) === player ? acc | 1 << i : acc;
            },
            0
          );
        };
      }
      const arrowMatch = argsStr.match(/^(\w+)\s*=>\s*(.+)$/);
      const [paramName, predExpr] = arrowMatch ? [arrowMatch[1], arrowMatch[2]] : ["it", argsStr];
      const cPred = compileExpression(predExpr, nextDepth);
      return (scope) => {
        const collection = cReceiver(scope);
        if (!Array.isArray(collection)) return void 0;
        let result = void 0;
        if (method === "any") {
          result = collection.some((item) => {
            const innerScope = Object.assign({}, scope, { [paramName]: item });
            return Boolean(cPred(innerScope));
          });
        } else if (method === "filter") {
          result = collection.filter((item) => {
            const innerScope = Object.assign({}, scope, { [paramName]: item });
            return Boolean(cPred(innerScope));
          });
        } else if (method === "find") {
          result = collection.find((item) => {
            const innerScope = Object.assign({}, scope, { [paramName]: item });
            return Boolean(cPred(innerScope));
          });
        } else if (method === "max") {
          result = collection.reduce(
            (max, item) => {
              const innerScope = Object.assign({}, scope, { [paramName]: item });
              const val = cPred(innerScope);
              return max === void 0 || val > max ? val : max;
            },
            void 0
          );
        }
        if (trailingProp === "length" && result !== void 0 && result.length !== void 0) {
          return result.length;
        }
        return result;
      };
    }
    if (includesTopLevel(trimmed, " ? ")) {
      const parts = splitTopLevel(trimmed, " ? ");
      const condition = parts[0];
      const rest = parts.slice(1).join(" ? ");
      if (includesTopLevel(rest, " : ")) {
        const colonParts = splitTopLevel(rest, " : ");
        const cCond = compileExpression(condition, nextDepth);
        const cTrue = compileExpression(colonParts[0], nextDepth);
        const cFalse = compileExpression(colonParts.slice(1).join(" : "), nextDepth);
        return (scope) => Boolean(cCond(scope)) ? cTrue(scope) : cFalse(scope);
      }
    }
    if (includesTopLevel(trimmed, " ?? ")) {
      const parts = splitTopLevel(trimmed, " ?? ");
      const leftRaw = parts[0].trim();
      const cLeft = compileExpression(leftRaw, nextDepth);
      const cRight = compileExpression(parts.slice(1).join(" ?? "), nextDepth);
      return (scope) => {
        let left = cLeft(scope);
        if (typeof left === "string" && left === leftRaw && resolvePath(leftRaw, scope) === void 0 && tryParseLiteral(leftRaw, scope) === void 0) {
          left = void 0;
        }
        if (left !== void 0 && left !== null && left !== "") {
          return left;
        }
        return cRight(scope);
      };
    }
    if (includesTopLevel(trimmed, " or ")) {
      const cParts = splitTopLevel(trimmed, " or ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.some((fn) => Boolean(fn(scope)));
    }
    if (includesTopLevel(trimmed, " || ")) {
      const cParts = splitTopLevel(trimmed, " || ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.some((fn) => Boolean(fn(scope)));
    }
    if (includesTopLevel(trimmed, " and ")) {
      const cParts = splitTopLevel(trimmed, " and ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.every((fn) => Boolean(fn(scope)));
    }
    if (includesTopLevel(trimmed, " && ")) {
      const cParts = splitTopLevel(trimmed, " && ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.every((fn) => Boolean(fn(scope)));
    }
    if (includesTopLevel(trimmed, " != ")) {
      const [left, right] = splitTopLevel(trimmed, " != ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => valueToString(cL(scope)) !== valueToString(cR(scope));
    }
    if (includesTopLevel(trimmed, " == ")) {
      const [left, right] = splitTopLevel(trimmed, " == ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => valueToString(cL(scope)) === valueToString(cR(scope));
    }
    if (includesTopLevel(trimmed, " >= ")) {
      const [left, right] = splitTopLevel(trimmed, " >= ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) >= cR(scope);
    }
    if (includesTopLevel(trimmed, " <= ")) {
      const [left, right] = splitTopLevel(trimmed, " <= ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) <= cR(scope);
    }
    if (includesTopLevel(trimmed, " > ")) {
      const [left, right] = splitTopLevel(trimmed, " > ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) > cR(scope);
    }
    if (includesTopLevel(trimmed, " < ")) {
      const [left, right] = splitTopLevel(trimmed, " < ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) < cR(scope);
    }
    if (includesTopLevel(trimmed, " + ")) {
      const cParts = splitTopLevel(trimmed, " + ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.reduce((acc, fn, index2) => {
        const value = fn(scope);
        if (index2 === 0) return value;
        if (typeof acc === "number" && typeof value === "number") return acc + value;
        return `${valueToString(acc)}${valueToString(value)}`;
      }, void 0);
    }
    if (includesTopLevel(trimmed, " - ")) {
      const parts = splitTopLevel(trimmed, " - ");
      const cFirst = compileExpression(parts[0], nextDepth);
      const cRest = parts.slice(1).map((p) => compileExpression(p, nextDepth));
      return (scope) => {
        const first = Number(cFirst(scope));
        return cRest.reduce((acc, fn) => acc - Number(fn(scope)), first);
      };
    }
    if (includesTopLevel(trimmed, " * ")) {
      const cParts = splitTopLevel(trimmed, " * ").map((p) => compileExpression(p, nextDepth));
      return (scope) => cParts.reduce((acc, fn, idx) => {
        const val = Number(fn(scope));
        return idx === 0 ? val : acc * val;
      }, 1);
    }
    if (includesTopLevel(trimmed, " / ")) {
      const parts = splitTopLevel(trimmed, " / ");
      const cFirst = compileExpression(parts[0], nextDepth);
      const cRest = parts.slice(1).map((p) => compileExpression(p, nextDepth));
      return (scope) => {
        const first = Number(cFirst(scope));
        return cRest.reduce((acc, fn) => acc / Number(fn(scope)), first);
      };
    }
    if (includesTopLevel(trimmed, " % ")) {
      const parts = splitTopLevel(trimmed, " % ");
      const cFirst = compileExpression(parts[0], nextDepth);
      const cRest = parts.slice(1).map((p) => compileExpression(p, nextDepth));
      return (scope) => {
        const first = Number(cFirst(scope));
        return cRest.reduce((acc, fn) => acc % Number(fn(scope)), first);
      };
    }
    if (trimmed.startsWith("swap ")) {
      const tokens = trimmed.split(/\s+/);
      const cCurr = compileExpression(tokens[1], nextDepth);
      const cL = compileExpression(tokens[2], nextDepth);
      const cR = compileExpression(tokens[3], nextDepth);
      return (scope) => {
        const current = valueToString(cCurr(scope));
        const left = valueToString(cL(scope));
        const right = valueToString(cR(scope));
        return current === left ? right : left;
      };
    }
    if (trimmed.startsWith("full ")) {
      const cColl = compileExpression(trimmed.slice(5), nextDepth);
      return (scope) => {
        const collection = cColl(scope);
        return Array.isArray(collection) && collection.every((item) => valueToString(item) !== "");
      };
    }
    if (includesTopLevel(trimmed, " & ")) {
      const [left, right] = splitTopLevel(trimmed, " & ");
      const cL = compileExpression(left, nextDepth);
      const cR = compileExpression(right, nextDepth);
      return (scope) => cL(scope) & cR(scope);
    }
    if (trimmed.startsWith("-") && !trimmed.startsWith("--")) {
      const operand = trimmed.slice(1).trim();
      if (operand) {
        const cOp = compileExpression(operand, nextDepth);
        return (scope) => {
          const val = cOp(scope);
          if (typeof val === "number") return -val;
          const num = Number(val);
          if (!Number.isNaN(num)) return -num;
          return void 0;
        };
      }
    }
    return compileResolveValue(trimmed);
  }
  function evaluateExpression(expr, scope, depth) {
    if ((depth || 0) > MAX_DEPTH) return void 0;
    const trimmed = String(expr || "").trim();
    if (!trimmed) return void 0;
    let compiled = exprCache.get(trimmed);
    if (!compiled) {
      compiled = compileExpression(trimmed, depth || 0);
      if (exprCache.size >= MAX_CACHE_SIZE) {
        exprCache.clear();
      }
      exprCache.set(trimmed, compiled);
    }
    return compiled(scope);
  }

  // src/effects.ts
  function downloadText(filename, content) {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function copyText(text) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {
      });
    }
  }

  // src/builtins/command.ts
  var STOP = "stop";
  var NO_ACTION = "do_not_action";

  // src/builtins/log.ts
  function handleLog(statement, locals) {
    if (!statement.startsWith("log ")) return void 0;
    const msg = interpolate(statement.slice(4), buildScope(locals));
    console.log(msg);
    return msg;
  }
  var logCommand = {
    prefix: ["log"],
    signature: "log <expression>",
    description: "Logs the interpolated expression to the console",
    handler: handleLog
  };

  // src/builtins/delete.ts
  function handleDelete(statement, locals) {
    if (!statement.startsWith("delete ")) return void 0;
    const path = statement.slice(7).trim();
    deletePath(path, locals);
    return true;
  }
  var deleteCommand = {
    prefix: ["delete", "del", "rm", "remove", "rmv", "destroy"],
    signature: "delete <path>",
    description: "Deletes a value at the given path from locals",
    handler: handleDelete
  };

  // src/builtins/invert.ts
  function handleInvert(statement, locals) {
    if (!statement.startsWith("invert ")) return void 0;
    const path = statement.slice(7).trim();
    const current = Boolean(evaluateExpression(path, buildScope(locals)));
    assignPath(path, !current, locals);
    return !current;
  }
  var invertCommand = {
    prefix: ["invert"],
    signature: "invert <path>",
    description: "Inverts a boolean value at the given path",
    handler: handleInvert
  };

  // src/builtins/increment.ts
  function handleIncrement(statement, locals) {
    if (statement.startsWith("increment") || statement.startsWith("inc")) {
      const trimmed = statement.replace("increment ", "").replace("inc ", "");
      const tokens = trimmed.split(" ");
      if (tokens.length != 3) return void 0;
      if (tokens[1] != "by") return void 0;
      const path2 = tokens[0];
      const valueExpression = tokens[2];
      const value = evaluateExpression(valueExpression, buildScope(locals));
      return incrementBy(path2, Number(value), locals);
    }
    if (!statement.endsWith("++")) return void 0;
    const path = statement.slice(0, -2).trim();
    return incrementBy(path, 1, locals);
  }
  function incrementBy(path, value, locals) {
    let evaled = evaluateExpression(path, buildScope(locals));
    if (evaled === path) evaled = 0;
    let current = Number(evaled);
    if (isNaN(current)) current = 0;
    const newValue = current + value;
    assignPath(path, newValue, locals);
    return newValue;
  }
  var incrementCommand = {
    prefix: ["increment", "inc"],
    postfix: ["++"],
    signature: "<path>++ | increment <path> by <number> | inc <path> by <number>",
    description: "Increments a numeric value at the given path",
    handler: handleIncrement
  };

  // src/builtins/decrement.ts
  function handleDecrement(statement, locals) {
    if (statement.startsWith("decrement") || statement.startsWith("dec")) {
      const trimmed = statement.replace("decrement ", "").replace("dec ", "");
      const tokens = trimmed.split(" ");
      if (tokens.length != 3) return void 0;
      if (tokens[1] != "by") return void 0;
      const path2 = tokens[0];
      const valueExpression = tokens[2];
      const value = evaluateExpression(valueExpression, buildScope(locals));
      return decrementBy(path2, Number(value), locals);
    }
    if (!statement.endsWith("--")) return void 0;
    const path = statement.slice(0, -2).trim();
    return decrementBy(path, 1, locals);
  }
  function decrementBy(path, value, locals) {
    let evaled = evaluateExpression(path, buildScope(locals));
    if (evaled === path) evaled = 0;
    let current = Number(evaled);
    if (isNaN(current)) current = 0;
    const newValue = current - value;
    assignPath(path, newValue, locals);
    return newValue;
  }
  var decrementCommand = {
    postfix: ["--"],
    prefix: ["decrement", "dec"],
    signature: "<path>-- or decrement <path> by <value> or dec <path> by <value>",
    description: "Decrements a numeric value at the given path",
    handler: handleDecrement
  };

  // src/builtins/swap.ts
  function handleSwap(statement, locals) {
    if (!statement.startsWith("swap ")) return void 0;
    const tokens = statement.split(/\s+/);
    if (tokens.length < 3) return void 0;
    const targetPath = tokens[1];
    if (tokens.length === 3) {
      const val = evaluateExpression(tokens[2], buildScope(locals));
      assignPath(targetPath, val, locals);
      return true;
    }
    const aExpr = tokens[2];
    const bExpr = tokens[3];
    const aValue = evaluateExpression(aExpr, buildScope(locals));
    const bValue = evaluateExpression(bExpr, buildScope(locals));
    const current = evaluateExpression(targetPath, buildScope(locals));
    if (current === aValue) {
      assignPath(targetPath, bValue, locals);
    } else {
      assignPath(targetPath, aValue, locals);
    }
    return true;
  }
  var swapCommand = {
    prefix: ["swap"],
    signature: "swap <path> <A> <B>",
    description: "Swaps the values of A and B at path",
    handler: handleSwap
  };

  // src/builtins/stop.ts
  function handleStop(statement, locals) {
    if (statement.trim() !== STOP) return void 0;
    return STOP;
  }
  var stopCommand = {
    prefix: [STOP],
    signature: STOP,
    description: "Stops execution of the current script",
    handler: handleStop
  };

  // src/builtins/push.ts
  function handlePush(statement, locals) {
    if (!statement.startsWith("push ")) return void 0;
    const tokens = statement.split(/\s+/);
    if (tokens.length < 3) return void 0;
    const targetPath = tokens[1];
    const valueExpr = tokens.slice(2).join(" ");
    const collection = evaluateExpression(targetPath, buildScope(locals));
    if (!Array.isArray(collection)) return void 0;
    const value = evaluateExpression(valueExpr, buildScope(locals));
    collection.push(value);
    assignPath(targetPath, collection, locals);
    return true;
  }
  var pushCommand = {
    prefix: ["push"],
    signature: "push <path> <valueExpression>",
    description: "Pushes a value onto the array at the given path",
    handler: handlePush
  };

  // src/builtins/max.ts
  function handleMax(statement, locals) {
    if (!statement.startsWith("max ")) return void 0;
    const rest = statement.slice(4).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr) || arr.length === 0) return void 0;
    const maxVal = Math.max(...arr.map((v) => Number(v)));
    if (varPart) {
      assignPath(varPart, maxVal, locals);
    }
    return maxVal;
  }
  var maxCommand = {
    prefix: ["max"],
    signature: "max <arrayPath> as <var>",
    description: "Finds maximum numeric value in an array",
    handler: handleMax
  };

  // src/builtins/min.ts
  function handleMin(statement, locals) {
    if (!statement.startsWith("min ")) return void 0;
    const rest = statement.slice(4).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr) || arr.length === 0) return void 0;
    const minVal = Math.min(...arr.map((v) => Number(v)));
    if (varPart) {
      assignPath(varPart, minVal, locals);
    }
    return minVal;
  }
  var minCommand = {
    prefix: ["min"],
    signature: "min <arrayPath> as <var>",
    description: "Finds minimum numeric value in an array",
    handler: handleMin
  };

  // src/builtins/delay.ts
  function handleDelay(statement, locals) {
    if (!statement.startsWith("delay ")) return void 0;
    const rest = statement.slice(6).trim();
    const msMatch = rest.match(/^([0-9]*\.?[0-9]+)\s*(ms|s)?$/i);
    if (!msMatch) return void 0;
    let ms = Number(msMatch[1]);
    const unit = msMatch[2] ? msMatch[2].toLowerCase() : "ms";
    if (unit === "s") ms *= 1e3;
    const start = Date.now();
    while (Date.now() - start < ms) {
    }
    return true;
  }
  var delayCommand = {
    prefix: ["delay"],
    signature: "delay <duration>ms",
    description: "Pauses execution for a given number of milliseconds",
    handler: handleDelay
  };

  // src/builtins/unique.ts
  function handleUnique(statement, locals) {
    if (!statement.startsWith("unique ")) return void 0;
    const rest = statement.slice(7).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr)) return void 0;
    const uniq = Array.from(new Set(arr));
    if (varPart) {
      assignPath(varPart, uniq, locals);
    }
    return uniq;
  }
  var uniqueCommand = {
    prefix: ["unique"],
    signature: "unique <arrayPath> as <var>",
    description: "Removes duplicate entries from an array",
    handler: handleUnique
  };

  // src/builtins/sum.ts
  function handleSum(statement, locals) {
    if (!statement.startsWith("sum ")) return void 0;
    const rest = statement.slice(4).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr)) return void 0;
    const total = arr.reduce((acc, cur) => acc + Number(cur), 0);
    if (varPart) {
      assignPath(varPart, total, locals);
    }
    return total;
  }
  var sumCommand = {
    prefix: ["sum"],
    signature: "sum <arrayPath> as <var>",
    description: "Sums numeric values in an array and stores the result",
    handler: handleSum
  };

  // src/builtins/randomize.ts
  function handleRandomize(statement, locals) {
    if (!statement.startsWith("randomize ")) return void 0;
    const rest = statement.slice(9).trim();
    const parts = rest.split(/\s+/);
    if (parts.length >= 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
      const min = Number(parts[0]);
      const max = Number(parts[1]);
      let varName;
      if (parts.length > 3 && parts[2] === "as") {
        varName = parts[3];
      }
      const rand = Math.floor(Math.random() * (max - min + 1)) + min;
      if (varName) {
        assignPath(varName, rand, locals);
      }
      return rand;
    }
    const asIndex = parts.indexOf("as");
    if (parts.length >= 1) {
      const pathExpr = parts.slice(0, asIndex).join(" ");
      const varName = parts[asIndex + 1];
      const arr = evaluateExpression(pathExpr, buildScope(locals));
      if (!Array.isArray(arr)) return void 0;
      const shuffled2 = arr.slice();
      for (let i = shuffled2.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled2[i], shuffled2[j]] = [shuffled2[j], shuffled2[i]];
      }
      if (varName) {
        assignPath(varName, shuffled2, locals);
      }
      return shuffled2;
    }
    return void 0;
  }
  var randomizeCommand = {
    prefix: ["randomize"],
    signature: "randomize <min> <max> as <var> | randomize <arrayPath> as <var>",
    description: "Generates a random number in a range or shuffles an array",
    handler: handleRandomize
  };

  // src/builtins/count.ts
  function handleCount(statement, locals) {
    if (!statement.startsWith("count ")) return void 0;
    const rest = statement.slice(6).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const value = evaluateExpression(pathPart, buildScope(locals));
    let count;
    if (Array.isArray(value)) {
      count = value.length;
    } else if (value && typeof value === "object") {
      count = Object.keys(value).length;
    } else {
      count = 0;
    }
    if (varPart) {
      assignPath(varPart, count, locals);
    }
    return count;
  }
  var countCommand = {
    prefix: ["count"],
    signature: "count <path> as <var>",
    description: "Stores the length of an array or object keys count into a variable",
    handler: handleCount
  };

  // src/builtins/flatten.ts
  function handleFlatten(statement, locals) {
    if (!statement.startsWith("flatten ")) return void 0;
    const rest = statement.slice(8).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const value = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(value)) return void 0;
    const flatten = (arr) => {
      const out = [];
      for (const item of arr) {
        if (Array.isArray(item)) {
          out.push(...flatten(item));
        } else {
          out.push(item);
        }
      }
      return out;
    };
    const flat = flatten(value);
    if (varPart) {
      assignPath(varPart, flat, locals);
    }
    return flat;
  }
  var flattenCommand = {
    prefix: ["flatten"],
    signature: "flatten <arrayPath> as <var>",
    description: "Flattens a nested array into a one\u2011dimensional array",
    handler: handleFlatten
  };

  // src/builtins/avg.ts
  function handleAvg(statement, locals) {
    if (!statement.startsWith("avg ")) return void 0;
    const rest = statement.slice(4).trim();
    const [pathPart, varPart] = rest.split(/\s+as\s+/);
    if (!pathPart) return void 0;
    const arr = evaluateExpression(pathPart, buildScope(locals));
    if (!Array.isArray(arr) || arr.length === 0) return void 0;
    const total = arr.reduce((acc, cur) => acc + Number(cur), 0);
    const avg = total / arr.length;
    if (varPart) {
      assignPath(varPart, avg, locals);
    }
    return avg;
  }
  var avgCommand = {
    prefix: ["avg"],
    signature: "avg <arrayPath> as <var>",
    description: "Computes average of numeric array values",
    handler: handleAvg
  };

  // src/builtins/clone.ts
  function handleClone(statement, locals) {
    if (!statement.startsWith("clone ")) return void 0;
    const rest = statement.slice(6).trim();
    const match = rest.match(/^(.*?)\s+to\s+(.*)$/);
    let src;
    let dest = null;
    if (!match) {
      src = rest;
    } else {
      src = match[1].trim();
      dest = match[2].trim();
    }
    if (!src) return void 0;
    const value = evaluateExpression(src, buildScope(locals));
    const copy = JSON.parse(JSON.stringify(value));
    if (dest) {
      assignPath(dest, copy, locals);
    }
    return copy;
  }
  var cloneCommand = {
    prefix: ["clone"],
    signature: "clone <srcPath> to <destPath>",
    description: "Deep\u2011copies a value from source to destination",
    handler: handleClone
  };

  // src/builtins/timer.ts
  function handleStartTimer(statement, _locals) {
    if (!statement.startsWith("start-timer ") && !statement.startsWith("interval ")) return void 0;
    const rest = statement.startsWith("start-timer ") ? statement.slice(12).trim() : statement.slice(9).trim();
    const match = rest.match(/^([A-Za-z_][\w-]*)\s*([0-9]*\.?[0-9]+)\s*(ms|s)?$/i);
    if (!match) return void 0;
    const action = match[1];
    let ms = Number(match[2]);
    if (match[3]?.toLowerCase() === "s") ms *= 1e3;
    const app = ctx().app;
    if (app.startTimer) {
      app.startTimer(action, ms);
    }
    return true;
  }
  function handleStopTimer(statement, _locals) {
    const trimmed = statement.trim();
    if (trimmed !== "stop-timer" && trimmed !== "clear-timer" && trimmed !== "clear-interval") return void 0;
    const app = ctx().app;
    if (app.stopTimer) {
      app.stopTimer();
    }
    return true;
  }
  var startTimerCommand = {
    prefix: ["start-timer", "interval"],
    signature: "start-timer <action> <duration>ms",
    description: "Starts a periodic timer calling the named action",
    handler: handleStartTimer
  };
  var stopTimerCommand = {
    prefix: ["stop-timer", "clear-timer", "clear-interval"],
    signature: "stop-timer",
    description: "Stops the active periodic timer",
    handler: handleStopTimer
  };

  // src/builtins/index.ts
  var postfixMap = {};
  var prefixMap = {};
  var infixMap = {};
  function registerCommand(cmd) {
    for (const name of cmd.prefix || []) {
      prefixMap[name] = cmd;
    }
    for (const name of cmd.postfix || []) {
      postfixMap[name] = cmd;
    }
    for (const name of cmd.infix || []) {
      infixMap[name] = cmd;
    }
  }
  registerCommand(logCommand);
  registerCommand(deleteCommand);
  registerCommand(invertCommand);
  registerCommand(incrementCommand);
  registerCommand(decrementCommand);
  registerCommand(swapCommand);
  registerCommand(stopCommand);
  registerCommand(pushCommand);
  registerCommand(maxCommand);
  registerCommand(minCommand);
  registerCommand(delayCommand);
  registerCommand(uniqueCommand);
  registerCommand(sumCommand);
  registerCommand(randomizeCommand);
  registerCommand(countCommand);
  registerCommand(flattenCommand);
  registerCommand(avgCommand);
  registerCommand(cloneCommand);
  registerCommand(startTimerCommand);
  registerCommand(stopTimerCommand);
  function handleWhen(statement, locals) {
    const whenIndex = statement.lastIndexOf(" when ");
    if (whenIndex === -1) return statement;
    const conditionExpr = statement.slice(whenIndex + 6).trim();
    const commandPart = statement.slice(0, whenIndex).trim();
    const condResult = Boolean(evaluateExpression(conditionExpr, buildScope(locals)));
    return condResult ? commandPart : null;
  }
  function handleBuiltin(statement, locals) {
    const cmd = getPrefixCmd(statement, locals) || getInfixCmd(statement, locals) || getPostfixCmd(statement, locals);
    if (!cmd) return void 0;
    const processed = handleWhen(statement, locals);
    if (processed === null) return NO_ACTION;
    const result = cmd.handler(processed, locals);
    return result !== void 0 ? result : false;
  }
  function getPrefixCmd(statement, locals) {
    const trimmed = statement.trim();
    const firstSpace = trimmed.indexOf(" ");
    const cmdName = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
    return prefixMap[cmdName];
  }
  function getInfixCmd(statement, locals) {
    const whenIdx = statement.lastIndexOf(" when ");
    const everythingBeforeWhen = whenIdx !== -1 ? statement.slice(0, whenIdx) : statement;
    const parts = everythingBeforeWhen.split(" ");
    for (const part of parts) {
      if (infixMap[part]) {
        return infixMap[part];
      }
    }
    return void 0;
  }
  function getPostfixCmd(statement, locals) {
    const whenIdx = statement.lastIndexOf(" when ");
    const everythingBeforeWhen = whenIdx !== -1 ? statement.slice(0, whenIdx).trim() : statement.trim();
    for (const cmd of Object.values(postfixMap)) {
      if (cmd.postfix?.some((cmd2) => everythingBeforeWhen.endsWith(cmd2))) {
        return cmd;
      }
    }
    return void 0;
  }

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
      this.musicStartTime = 0;
      this.syncPage = true;
      this.getAudioCtx = null;
      this.lastActiveStepId = -1;
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
      this.musicStartTime = params.startTime;
      this.scheduledNotes = [];
      this.lastActiveStepId = -1;
      this.lastActiveBar = -1;
      this.channelStepIds = {};
      this.startLoop();
    }
    /**
     * Notify sync engine that playback has paused.
     */
    onPause() {
      this.isPaused = true;
      this.stopLoop();
      this.broadcastSnapshot();
    }
    /**
     * Notify sync engine that playback has stopped.
     */
    onStop() {
      this.isPlaying = false;
      this.isPaused = false;
      this.activeTrackName = null;
      this.scheduledNotes = [];
      this.channelStepIds = {};
      this.lastActiveStepId = -1;
      this.lastActiveBar = -1;
      this.stopLoop();
      this.clearVisuals();
      this.broadcastSnapshot();
    }
    /**
     * Get current snapshot of the audio sync state.
     */
    getSnapshot() {
      const ctx2 = this.getAudioCtx ? this.getAudioCtx() : null;
      const outputLatency = ctx2 ? (ctx2.outputLatency || 0) + (ctx2.baseLatency || 0) : 0;
      const visualTime = ctx2 ? Math.max(0, ctx2.currentTime - outputLatency) : 0;
      const secondsPerBeat = 60 / Math.max(20, this.tempoBpm);
      const elapsedSec = this.isPlaying && !this.isPaused ? Math.max(0, visualTime - this.musicStartTime) : 0;
      const beatsPerBar = this.timeSignature.startsWith("3/") ? 3 : 4;
      const currentBeat = this.totalBeats > 0 ? elapsedSec / secondsPerBeat % this.totalBeats : 0;
      const currentBar = Math.min(this.totalBars, Math.floor(currentBeat / beatsPerBar) + 1);
      const progressPercent = this.totalBeats > 0 ? currentBeat / this.totalBeats * 100 : 0;
      return {
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        track: this.activeTrackName,
        tempo: this.tempoBpm,
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
      const ctx2 = this.getAudioCtx ? this.getAudioCtx() : null;
      if (!ctx2) return;
      const outputLatency = (ctx2.outputLatency || 0) + (ctx2.baseLatency || 0);
      const visualTime = ctx2.currentTime - outputLatency;
      this.scheduledNotes = this.scheduledNotes.filter((n) => n.endTime >= visualTime - 0.5);
      const activeVoice = this.getActiveVoice();
      let currentStepId = -1;
      this.channelStepIds = {};
      for (const note of this.scheduledNotes) {
        if (visualTime >= note.startTime && visualTime < note.endTime) {
          this.channelStepIds[note.channel] = note.stepId;
          if (note.channel === activeVoice) {
            currentStepId = note.stepId;
          }
        }
      }
      const secondsPerBeat = 60 / Math.max(20, this.tempoBpm);
      const elapsedSec = Math.max(0, visualTime - this.musicStartTime);
      const beatsPerBar = this.timeSignature.startsWith("3/") ? 3 : 4;
      const currentBeat = this.totalBeats > 0 ? elapsedSec / secondsPerBeat % this.totalBeats : elapsedSec / secondsPerBeat;
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
      if (this.syncPage) this.updateDeclarativeDom(currentBeat, progressPercent, currentBar, currentStepId);
      if (currentStepId !== this.lastActiveStepId || currentBar !== this.lastActiveBar) {
        this.lastActiveStepId = currentStepId;
        this.lastActiveBar = currentBar;
        try {
          const appState = this.syncPage ? window?.__RuneWeb?.ctx?.()?.app?.state : null;
          if (appState) {
            appState.playback_step_id = currentStepId;
            appState.playback_bar = currentBar;
            appState.playback_beat = currentBeat;
            appState.playback_progress = progressPercent;
            appState.playback_playing = this.isPlaying;
          }
        } catch (_) {
        }
        this.broadcastSnapshot();
      }
    }
    updateDeclarativeDom(currentBeat, progressPercent, currentBar, currentStepId) {
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
      const pxLeft = Math.round(currentBeat * 120);
      beatPlayheads.forEach((el) => {
        el.style.left = `${pxLeft}px`;
        el.style.display = "block";
      });
      const scrollContainers = document.querySelectorAll(
        '[data-sync-scroll="beat"], .matrix-timeline-scroll'
      );
      scrollContainers.forEach((container) => {
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
      if (currentStepId !== this.lastActiveStepId) {
        document.querySelectorAll(".playing-step-now, [data-sync-playing-step]").forEach((el) => {
          el.classList.remove("playing-step-now");
          el.removeAttribute("data-sync-playing-step");
        });
        if (currentStepId >= 0) {
          document.querySelectorAll(
            `[data-sync-step="${currentStepId}"], .step-chip[data-step-idx="${currentStepId}"], .matrix-note-block[data-step-idx="${currentStepId}"]`
          ).forEach((el) => {
            el.classList.add("playing-step-now");
            el.setAttribute("data-sync-playing-step", "true");
          });
        }
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
          result.tracks[channel].push(...events.map((e, index2) => ({ ...e, stepId: offset + index2 })));
          if (duration < beats) result.tracks[channel].push({ stepId: -1, pitch: 0, beats: beats - duration, isRest: true, isDrum: false });
        }
      }
    }
    return result;
  }

  // src/audio.ts
  var audioCtx = null;
  var stepIndex = 0;
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
  function unlockAudio() {
    playbackUnlocked = true;
    const context = getAudioContext();
    const track = pendingMusic;
    pendingMusic = null;
    if (track) playMusic(track);
    return context;
  }
  function setAudioMuted(muted) {
    audioMuted = muted;
    if (masterGain && audioCtx) masterGain.gain.setValueAtTime(muted ? 0 : 1, audioCtx.currentTime);
  }
  function audioOutput(ctx2) {
    if (!masterGain) {
      masterGain = ctx2.createGain();
      masterGain.gain.setValueAtTime(audioMuted ? 0 : 1, ctx2.currentTime);
      masterGain.connect(ctx2.destination);
    }
    return masterGain;
  }
  var registeredSounds = {};
  var registeredMusic = {};
  var arrangements = /* @__PURE__ */ new Map();
  function registerSounds(definitions) {
    if (!definitions) return;
    for (const [key, val] of Object.entries(definitions)) {
      registeredSounds[key.toLowerCase()] = val;
    }
  }
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
  function playSound(type, arg) {
    if (audioMuted) return;
    const ctx2 = getAudioContext();
    if (!ctx2) return;
    const now = ctx2.currentTime;
    const soundName = String(type || "").trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(registeredSounds, soundName)) {
      playCustomSound(ctx2, registeredSounds[soundName], now, arg);
      return;
    }
    switch (soundName) {
      case "laser":
      case "pew":
      case "fire": {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.connect(gain);
        gain.connect(audioOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.13);
        break;
      }
      case "hit":
      case "damage": {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.09);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
        osc.connect(gain);
        gain.connect(audioOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case "explosion":
      case "boom": {
        playNoiseBurst(ctx2, now, 0.35, 800, 60, 0.45);
        break;
      }
      case "step":
      case "move": {
        const steps = [110, 98, 87, 82];
        const freq = steps[stepIndex % steps.length];
        stepIndex += 1;
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(audioOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }
      case "coin":
      case "powerup": {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.connect(gain);
        gain.connect(audioOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.29);
        break;
      }
      case "gameover": {
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.linearRampToValueAtTime(293, now + 0.15);
        osc.frequency.linearRampToValueAtTime(261, now + 0.3);
        osc.frequency.linearRampToValueAtTime(196, now + 0.55);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.connect(gain);
        gain.connect(audioOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.62);
        break;
      }
      case "victory":
      case "win": {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const start = now + idx * 0.12;
          const osc = ctx2.createOscillator();
          const gain = ctx2.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.25, start);
          gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15);
          osc.connect(gain);
          gain.connect(audioOutput(ctx2));
          osc.start(start);
          osc.stop(start + 0.16);
        });
        break;
      }
      case "tone": {
        const freq = typeof arg === "number" ? arg : 440;
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(audioOutput(ctx2));
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }
      default:
        break;
    }
  }
  function playNoiseBurst(ctx2, now, duration, filterStart, filterEnd, volume, filterType = "lowpass") {
    const bufferSize = Math.max(1, Math.floor(ctx2.sampleRate * duration));
    const buffer = ctx2.createBuffer(1, bufferSize, ctx2.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise3 = ctx2.createBufferSource();
    noise3.buffer = buffer;
    const filter = ctx2.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(20, filterStart), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), now + duration);
    const gain = ctx2.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + duration);
    noise3.connect(filter);
    filter.connect(gain);
    gain.connect(audioOutput(ctx2));
    noise3.start(now);
    noise3.stop(now + duration + 0.01);
  }
  function playCustomSound(ctx2, def, now, arg) {
    const duration = def.duration || 0.12;
    const volume = def.volume !== void 0 ? def.volume : 0.25;
    const wave = (def.wave || "square").toLowerCase();
    if (wave === "noise") {
      const fStart = def.filter?.start_freq || 800;
      const fEnd = def.filter?.end_freq || 60;
      const fType = def.filter?.filter_type || "lowpass";
      playNoiseBurst(ctx2, now, duration, fStart, fEnd, volume, fType);
      return;
    }
    if (def.sequence && def.sequence.length > 0) {
      let offset = 0;
      for (const [freq, noteDur] of def.sequence) {
        const start = now + offset;
        const osc2 = ctx2.createOscillator();
        const gain2 = ctx2.createGain();
        osc2.type = wave || "square";
        osc2.frequency.setValueAtTime(freq, start);
        gain2.gain.setValueAtTime(volume, start);
        gain2.gain.exponentialRampToValueAtTime(0.01, start + noteDur);
        osc2.connect(gain2);
        gain2.connect(audioOutput(ctx2));
        osc2.start(start);
        osc2.stop(start + noteDur + 0.01);
        offset += noteDur;
      }
      return;
    }
    let startFreq = def.freq_start || 440;
    if (def.notes && def.notes.length > 0) {
      startFreq = def.notes[stepIndex % def.notes.length];
      stepIndex += 1;
    } else if (typeof arg === "number") {
      startFreq = arg;
    }
    const endFreq = def.freq_end !== null && def.freq_end !== void 0 ? def.freq_end : startFreq;
    const osc = ctx2.createOscillator();
    const gain = ctx2.createGain();
    osc.type = wave || "square";
    osc.frequency.setValueAtTime(Math.max(1, startFreq), now);
    if (endFreq !== startFreq) {
      if (def.curve === "linear") {
        osc.frequency.linearRampToValueAtTime(Math.max(1, endFreq), now + duration);
      } else {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
      }
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + duration);
    osc.connect(gain);
    gain.connect(audioOutput(ctx2));
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }
  var activeMusicTrackName = null;
  var musicSchedulerTimer = null;
  var musicMasterGain = null;
  var musicVolume = 0.2;
  var musicTempoBpm = 128;
  var musicLoop = true;
  var isMusicPaused = false;
  var musicStartTime = 0;
  var musicPauseTime = 0;
  var musicPausedElapsed = 0;
  var nextScheduleTime = 0;
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
  function playMusic(trackName) {
    if (!playbackUnlocked) {
      pendingMusic = trackName;
      return;
    }
    const ctx2 = getAudioContext();
    if (!ctx2) return;
    const key = String(trackName || "").trim().toLowerCase();
    const def = registeredMusic[key];
    if (!def) {
      return;
    }
    stopMusic();
    activeMusicTrackName = key;
    musicTempoBpm = def.tempo || 128;
    musicLoop = def.loop_track !== false;
    musicVolume = def.volume !== void 0 ? def.volume : 0.2;
    isMusicPaused = false;
    musicMasterGain = ctx2.createGain();
    musicMasterGain.gain.setValueAtTime(musicVolume, ctx2.currentTime);
    musicMasterGain.connect(audioOutput(ctx2));
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
    const beatsPerBar = def.time_signature?.startsWith("3/") ? 3 : 4;
    let maxTrackBeats = 0;
    for (const track of Object.values(tracksState)) {
      if (track && track.events && track.events.length > 0) {
        const trackBeats = track.events.reduce((sum, e) => sum + (e.beats || 0), 0);
        if (trackBeats > maxTrackBeats) maxTrackBeats = trackBeats;
      }
    }
    const appStateBars = syncPageAudio ? Number(window?.__RuneWeb?.ctx?.()?.app?.state?.bars) : 0;
    const totalBars = appStateBars > 0 ? appStateBars : def.bars || (maxTrackBeats > 0 ? Math.ceil(maxTrackBeats / beatsPerBar) : 4);
    const totalBeats = Math.max(maxTrackBeats, totalBars * beatsPerBar);
    musicStartTime = ctx2.currentTime + 0.05;
    nextScheduleTime = musicStartTime;
    musicPauseTime = 0;
    musicPausedElapsed = 0;
    audioSync.configure({ getAudioContext: () => audioCtx, syncPage: syncPageAudio });
    audioSync.onPlay({
      track: key,
      tempo: musicTempoBpm,
      timeSignature: def.time_signature || "4/4",
      totalBars,
      totalBeats,
      startTime: musicStartTime
    });
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
    musicPauseTime = 0;
    musicPausedElapsed = 0;
    isMusicPaused = false;
    tracksState = {};
    if (musicMasterGain) {
      try {
        musicMasterGain.disconnect();
      } catch {
      }
      musicMasterGain = null;
    }
  }
  function pauseMusic() {
    const ctx2 = getAudioContext();
    if (!ctx2 || isMusicPaused || !activeMusicTrackName) return;
    isMusicPaused = true;
    if (musicSchedulerTimer) {
      clearInterval(musicSchedulerTimer);
      musicSchedulerTimer = null;
    }
    musicPauseTime = ctx2.currentTime;
    musicPausedElapsed = Math.max(0, musicPauseTime - musicStartTime);
    if (musicMasterGain) {
      try {
        musicMasterGain.gain.setValueAtTime(0, ctx2.currentTime);
      } catch (_) {
      }
    }
    audioSync.onPause();
  }
  function resumeMusic() {
    const ctx2 = getAudioContext();
    if (!ctx2 || !isMusicPaused || !activeMusicTrackName) return;
    const pausedDuration = ctx2.currentTime - musicPauseTime;
    musicStartTime += pausedDuration;
    const secondsPerBeat = 60 / musicTempoBpm;
    const currentBeat = musicPausedElapsed / secondsPerBeat;
    for (const track of Object.values(tracksState)) {
      if (!track || !track.events.length) continue;
      let accum = 0;
      track.index = 0;
      track.nextBeat = 0;
      for (let i = 0; i < track.events.length; i++) {
        const ev = track.events[i];
        if (accum + ev.beats > currentBeat) {
          track.index = i;
          track.nextBeat = accum;
          break;
        }
        accum += ev.beats;
      }
    }
    if (musicMasterGain) {
      try {
        musicMasterGain.gain.setValueAtTime(musicVolume, ctx2.currentTime);
      } catch (_) {
      }
    }
    isMusicPaused = false;
    const def = registeredMusic[activeMusicTrackName];
    const beatsPerBar = def?.time_signature?.startsWith("3/") ? 3 : 4;
    let maxTrackBeats = 0;
    for (const track of Object.values(tracksState)) {
      if (track && track.events && track.events.length > 0) {
        const trackBeats = track.events.reduce((sum, e) => sum + (e.beats || 0), 0);
        if (trackBeats > maxTrackBeats) maxTrackBeats = trackBeats;
      }
    }
    const appStateBars = syncPageAudio ? Number(window?.__RuneWeb?.ctx?.()?.app?.state?.bars) : 0;
    const totalBars = appStateBars > 0 ? appStateBars : def?.bars || (maxTrackBeats > 0 ? Math.ceil(maxTrackBeats / beatsPerBar) : 4);
    const totalBeats = Math.max(maxTrackBeats, totalBars * beatsPerBar);
    audioSync.onPlay({
      track: activeMusicTrackName,
      tempo: musicTempoBpm,
      timeSignature: def?.time_signature || "4/4",
      totalBars,
      totalBeats,
      startTime: musicStartTime
    });
    scheduleMusicTicks();
    musicSchedulerTimer = setInterval(scheduleMusicTicks, 25);
  }
  function setMusicTempo(bpm) {
    if (bpm > 20 && bpm < 400) {
      musicTempoBpm = bpm;
    }
  }
  function setMusicVolume(vol) {
    musicVolume = Math.max(0, Math.min(1, vol));
    if (musicMasterGain && audioCtx) {
      musicMasterGain.gain.setValueAtTime(musicVolume, audioCtx.currentTime);
    }
  }
  function scheduleMusicTicks() {
    const ctx2 = getAudioContext();
    if (!ctx2 || !musicMasterGain || isMusicPaused || !activeMusicTrackName) return;
    const secondsPerBeat = 60 / musicTempoBpm;
    const lookaheadWindow = ctx2.currentTime + 0.25;
    const def = registeredMusic[activeMusicTrackName];
    const beatsPerBar = def?.time_signature?.startsWith("3/") ? 3 : 4;
    let maxTrackBeats = 0;
    for (const t of Object.values(tracksState)) {
      if (t && t.events && t.events.length > 0) {
        const tb = t.events.reduce((sum, e) => sum + (e.beats || 0), 0);
        if (tb > maxTrackBeats) maxTrackBeats = tb;
      }
    }
    const appStateBars = syncPageAudio ? Number(window?.__RuneWeb?.ctx?.()?.app?.state?.bars) : 0;
    const totalBars = appStateBars > 0 ? appStateBars : def?.bars || (maxTrackBeats > 0 ? Math.ceil(maxTrackBeats / beatsPerBar) : 4);
    const songTotalBeats = Math.max(maxTrackBeats, totalBars * beatsPerBar);
    let allFinished = true;
    for (const [trackKey, track] of Object.entries(tracksState)) {
      if (!track || !track.events.length || track.muted) continue;
      while (musicStartTime + track.nextBeat * secondsPerBeat < lookaheadWindow) {
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
        const event = track.events[track.index];
        const eventTime = musicStartTime + track.nextBeat * secondsPerBeat;
        const eventDurationSec = event.beats * secondsPerBeat;
        if (!event.isRest && eventTime >= ctx2.currentTime - 0.05) {
          scheduleTrackNote(ctx2, trackKey, event, eventTime, eventDurationSec, musicMasterGain, track.instrument);
        }
        track.nextBeat += event.beats;
        track.index += 1;
      }
      if (track.index < track.events.length || musicLoop) {
        allFinished = false;
      }
    }
    if (allFinished && !musicLoop && ctx2.currentTime >= musicStartTime + songTotalBeats * secondsPerBeat) {
      stopMusic();
    }
  }
  function scheduleTrackNote(ctx2, channel, event, time, durationSec, destination, instrumentOverride) {
    audioSync.enqueueNote({
      channel,
      stepId: event.stepId ?? -1,
      pitch: event.pitch,
      startTime: time,
      endTime: time + durationSec,
      beat: 0,
      bar: 1
    });
    const isDrumChannel = channel === "drums" || instrumentOverride === "drums" || event.isDrum;
    const pitchesToPlay = event.pitches && event.pitches.length > 0 ? event.pitches : [event.pitch];
    const chordGainMultiplier = 1 / Math.sqrt(Math.max(1, pitchesToPlay.length));
    for (const p of pitchesToPlay) {
      if (isDrumChannel || typeof p === "string") {
        const drumType = String(p).toLowerCase();
        if (drumType === "kick") {
          const osc2 = ctx2.createOscillator();
          const gain2 = ctx2.createGain();
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
          playNoiseBurstToDestination(ctx2, time, Math.min(durationSec, 0.09), 1600, 300, 0.3 * chordGainMultiplier, destination, "bandpass");
        } else if (drumType === "hihat") {
          playNoiseBurstToDestination(ctx2, time, Math.min(durationSec, 0.04), 7e3, 5e3, 0.15 * chordGainMultiplier, destination, "highpass");
        } else if (drumType === "crash") {
          playNoiseBurstToDestination(ctx2, time, Math.min(durationSec, 0.25), 5e3, 1e3, 0.2 * chordGainMultiplier, destination, "bandpass");
        } else if (drumType === "tom") {
          const osc2 = ctx2.createOscillator();
          const gain2 = ctx2.createGain();
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
      const osc = ctx2.createOscillator();
      const gain = ctx2.createGain();
      const inst = instrumentOverride || (channel === "bass" ? "triangle" : "square");
      if (inst === "brass" || inst === "strings" || inst === "bell") {
        const length = Math.max(0.06, durationSec * (inst === "bell" ? 1.25 : 0.94));
        const attack = Math.min(length * 0.25, inst === "strings" ? 0.09 : 0.018);
        osc.type = inst === "brass" ? "sawtooth" : inst === "strings" ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(1e-3, time);
        gain.gain.linearRampToValueAtTime((inst === "strings" ? 0.11 : 0.23) * chordGainMultiplier, time + attack);
        gain.gain.exponentialRampToValueAtTime(1e-3, time + length);
        const filter = ctx2.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(Math.min(9e3, freq * (inst === "brass" ? 5 : 3)), time);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + length + 0.015);
      } else if (inst === "sawtooth" || inst === "synth") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = Math.min(durationSec * 0.88, 0.4);
        gain.gain.setValueAtTime(0.18 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(5e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      } else if (inst === "triangle" || inst === "bass") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = Math.min(durationSec * 0.9, 0.45);
        gain.gain.setValueAtTime(0.28 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(5e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      } else if (inst === "sine") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = Math.min(durationSec * 0.9, 0.5);
        gain.gain.setValueAtTime(0.25 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(2e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      } else if (inst === "pluck") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = Math.min(durationSec * 0.6, 0.15);
        gain.gain.setValueAtTime(0.3 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(1e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      } else {
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, time);
        const noteSoundLen = Math.min(durationSec * 0.85, 0.35);
        gain.gain.setValueAtTime(0.2 * chordGainMultiplier, time);
        gain.gain.exponentialRampToValueAtTime(5e-3, time + noteSoundLen);
        osc.connect(gain);
        gain.connect(destination);
        osc.start(time);
        osc.stop(time + noteSoundLen + 0.01);
      }
    }
  }
  function playNoiseBurstToDestination(ctx2, now, duration, filterStart, filterEnd, volume, destination, filterType = "lowpass") {
    const bufferSize = Math.max(1, Math.floor(ctx2.sampleRate * duration));
    const buffer = ctx2.createBuffer(1, bufferSize, ctx2.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise3 = ctx2.createBufferSource();
    noise3.buffer = buffer;
    const filter = ctx2.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(Math.max(20, filterStart), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), now + duration);
    const gain = ctx2.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + duration);
    noise3.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise3.start(now);
    noise3.stop(now + duration + 0.01);
  }

  // src/statement.ts
  function assignPath(pathExpr, value, locals) {
    const segments = splitPathSegments(pathExpr);
    if (!segments.length) return;
    const baseKey = segments[0];
    let current;
    if (locals && Object.prototype.hasOwnProperty.call(locals, baseKey)) {
      current = locals[baseKey];
      if (segments.length === 1) {
        locals[baseKey] = value;
        entitiesChanged(value);
        return;
      }
    } else {
      current = ctx().app.state[baseKey];
      if (segments.length === 1) {
        ctx().app.state[baseKey] = value;
        entitiesChanged(value);
        return;
      }
    }
    for (let i = 1; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const scopeValue2 = buildScope(locals, pathExpr);
      if (Array.isArray(current) && segment.startsWith("[].(") && segment.endsWith(")")) {
        const condition = segment.slice(4, -1);
        const match = current.find((item) => {
          const innerScope = Object.assign({}, scopeValue2, { it: item });
          return Boolean(evaluateExpression(condition, innerScope, 0));
        });
        if (match !== void 0) {
          current = match;
          continue;
        } else return;
      } else if (segment.startsWith("[") && segment.endsWith("]")) {
        const innerExpr = segment.slice(1, -1);
        const lookup = evaluateExpression(innerExpr, scopeValue2, 0);
        const key = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
        if (current[key] === void 0) {
          current[key] = {};
        }
        current = current[key];
      } else {
        const key = segment;
        if (current[key] === void 0) {
          current[key] = {};
        }
        current = current[key];
      }
    }
    const finalRawKey = segments[segments.length - 1];
    const scopeValue = buildScope(locals, pathExpr);
    if (Array.isArray(current) && finalRawKey.startsWith("[].(") && finalRawKey.endsWith(")")) {
      const condition = finalRawKey.slice(4, -1);
      const index2 = current.findIndex((item) => {
        const innerScope = Object.assign({}, scopeValue, { it: item });
        return Boolean(evaluateExpression(condition, innerScope, 0));
      });
      if (index2 !== -1) {
        current[index2] = value;
        entitiesChanged(current);
      }
      return;
    } else if (finalRawKey.startsWith("[") && finalRawKey.endsWith("]")) {
      const innerExpr = finalRawKey.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scopeValue, 0);
      const finalKey = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
      current[finalKey] = value;
      entitiesChanged(current);
      entityMoved(current);
    } else {
      current[finalRawKey] = value;
      if (["x", "y", "z", "visible", "scale"].includes(finalRawKey)) entityMoved(current);
    }
  }
  function deletePath(pathExpr, locals) {
    const segments = splitPathSegments(pathExpr);
    if (!segments.length) return;
    const baseKey = segments[0];
    let current;
    if (locals && Object.prototype.hasOwnProperty.call(locals, baseKey)) {
      current = locals[baseKey];
      if (segments.length === 1) {
        delete locals[baseKey];
        return;
      }
    } else {
      current = ctx().app.state[baseKey];
      if (segments.length === 1) {
        delete ctx().app.state[baseKey];
        return;
      }
    }
    for (let i = 1; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const scopeValue2 = buildScope(locals);
      if (Array.isArray(current) && segment.startsWith("[].(") && segment.endsWith(")")) {
        const condition = segment.slice(4, -1);
        const match = current.find((item) => {
          const innerScope = Object.assign({}, scopeValue2, { it: item });
          return Boolean(evaluateExpression(condition, innerScope, 0));
        });
        if (match !== void 0) {
          current = match;
          continue;
        } else return;
      } else if (segment.startsWith("[") && segment.endsWith("]")) {
        const innerExpr = segment.slice(1, -1);
        const lookup = evaluateExpression(innerExpr, scopeValue2, 0);
        const key = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
        if (current[key] === void 0) return;
        current = current[key];
      } else {
        const key = segment;
        if (current[key] === void 0) return;
        current = current[key];
      }
    }
    const finalRawKey = segments[segments.length - 1];
    const scopeValue = buildScope(locals);
    if (Array.isArray(current) && finalRawKey.startsWith("[].(") && finalRawKey.endsWith(")")) {
      const condition = finalRawKey.slice(4, -1);
      const index2 = current.findIndex((item) => {
        const innerScope = Object.assign({}, scopeValue, { it: item });
        return Boolean(evaluateExpression(condition, innerScope, 0));
      });
      if (index2 !== -1) {
        current.splice(index2, 1);
        entitiesChanged(current);
      }
    } else if (finalRawKey.startsWith("[") && finalRawKey.endsWith("]")) {
      const innerExpr = finalRawKey.slice(1, -1);
      const lookup = evaluateExpression(innerExpr, scopeValue, 0);
      const finalKey = Array.isArray(current) ? Number(lookup) : valueToString(lookup);
      if (Array.isArray(current) && typeof finalKey === "number") {
        current.splice(finalKey, 1);
        entitiesChanged(current);
      } else {
        delete current[finalKey];
      }
    } else {
      if (Array.isArray(current) && !isNaN(Number(finalRawKey))) {
        current.splice(Number(finalRawKey), 1);
      } else {
        delete current[finalRawKey];
      }
    }
    entitiesChanged(current);
    entityMoved(current);
  }
  function executeStatement(statement, locals) {
    const trimmed = String(statement || "").trim();
    if (!trimmed) return true;
    if (trimmed.startsWith("call ")) {
      const rest = trimmed.slice(5).trim();
      const match = rest.match(/^([a-zA-Z_][\w]*)(?:\s+(.*))?$/);
      if (!match || !Object.prototype.hasOwnProperty.call(ctx().actionDefinitions, match[1])) {
        throw new Error(`Unknown Rune-Web action: ${rest}`);
      }
      const args = match[2] ? splitTopLevel(match[2], ",").map((arg) => evaluateExpression(arg, buildScope(locals, trimmed))) : [];
      ctx().app.invokeAction(match[1], args, locals);
      return true;
    }
    if (trimmed.startsWith("sound ") || trimmed.startsWith("sound.") || trimmed.startsWith("play_sound(")) {
      let soundName = "";
      let argVal = void 0;
      if (trimmed.startsWith("sound.play(") && trimmed.endsWith(")")) {
        const inner = trimmed.slice(11, -1);
        const parts = splitTopLevel(inner, ",");
        soundName = String(evaluateExpression(parts[0], buildScope(locals, trimmed)) || "");
        if (parts.length > 1) {
          argVal = evaluateExpression(parts[1], buildScope(locals, trimmed));
        }
      } else if (trimmed.startsWith("play_sound(") && trimmed.endsWith(")")) {
        const inner = trimmed.slice(11, -1);
        const parts = splitTopLevel(inner, ",");
        soundName = String(evaluateExpression(parts[0], buildScope(locals, trimmed)) || "");
        if (parts.length > 1) {
          argVal = evaluateExpression(parts[1], buildScope(locals, trimmed));
        }
      } else if (trimmed.startsWith("sound.play ")) {
        soundName = String(evaluateExpression(trimmed.slice(11), buildScope(locals, trimmed)) || "");
      } else if (trimmed.startsWith("sound.")) {
        soundName = trimmed.slice(6).trim();
      } else {
        soundName = String(evaluateExpression(trimmed.slice(6), buildScope(locals, trimmed)) || "");
      }
      soundName = normalizeLiteral(soundName);
      playSound(soundName, argVal);
      return true;
    }
    if (trimmed.startsWith("music ") || trimmed.startsWith("music.") || trimmed.startsWith("play_music(")) {
      if (trimmed === "music.stop" || trimmed === "music.stop()" || trimmed === "stop_music()") {
        stopMusic();
        return true;
      }
      if (trimmed === "music.pause" || trimmed === "music.pause()" || trimmed === "pause_music()") {
        pauseMusic();
        return true;
      }
      if (trimmed === "music.resume" || trimmed === "music.resume()" || trimmed === "resume_music()") {
        resumeMusic();
        return true;
      }
      if (trimmed.startsWith("music.tempo =") || trimmed.startsWith("music.tempo=")) {
        const expr = trimmed.slice(trimmed.indexOf("=") + 1).trim();
        const val = Number(evaluateExpression(expr, buildScope(locals, trimmed)));
        if (!isNaN(val)) setMusicTempo(val);
        return true;
      }
      if (trimmed.startsWith("music.volume =") || trimmed.startsWith("music.volume=")) {
        const expr = trimmed.slice(trimmed.indexOf("=") + 1).trim();
        const val = Number(evaluateExpression(expr, buildScope(locals, trimmed)));
        if (!isNaN(val)) setMusicVolume(val);
        return true;
      }
      if (trimmed.startsWith("music.compose(") || trimmed.startsWith("music.register(")) {
        const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
        const parts = splitTopLevel(inner, ",");
        if (parts.length >= 4) {
          const name = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
          const tempo = Number(evaluateExpression(parts[1], buildScope(locals, trimmed))) || 128;
          const lead = String(evaluateExpression(parts[2], buildScope(locals, trimmed)));
          const bass = String(evaluateExpression(parts[3], buildScope(locals, trimmed)));
          const drums = parts.length > 4 ? String(evaluateExpression(parts[4], buildScope(locals, trimmed))) : "";
          const timeSig = parts.length > 5 ? String(evaluateExpression(parts[5], buildScope(locals, trimmed))) : "4/4";
          const songBars = Number(ctx().app?.state?.bars) || 4;
          registerMusic({
            [name]: {
              music_type: "8bit",
              tempo,
              time_signature: timeSig,
              bars: songBars,
              loop_track: true,
              volume: 0.2,
              lead,
              bass,
              drums
            }
          });
        }
        return true;
      }
      if (trimmed.startsWith("music.compose_song(") || trimmed.startsWith("music.register_song(")) {
        const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
        const parts = splitTopLevel(inner, ",");
        if (parts.length >= 2) {
          const name = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
          const songConfig = evaluateExpression(parts[1], buildScope(locals, trimmed));
          if (songConfig && typeof songConfig === "object") {
            registerMusic({
              [name]: songConfig
            });
          }
        }
        return true;
      }
      if (trimmed === "music.play" || trimmed === "music.play()" || trimmed.startsWith("music.play(") || trimmed.startsWith("music.play ") || trimmed.startsWith("play_music(") || trimmed.startsWith("music ") && !trimmed.startsWith("music.tempo") && !trimmed.startsWith("music.volume")) {
        let trackName = "";
        if (trimmed.startsWith("music.play(") && trimmed.endsWith(")")) {
          trackName = String(evaluateExpression(trimmed.slice(11, -1), buildScope(locals, trimmed)) || "");
        } else if (trimmed.startsWith("play_music(") && trimmed.endsWith(")")) {
          trackName = String(evaluateExpression(trimmed.slice(11, -1), buildScope(locals, trimmed)) || "");
        } else if (trimmed.startsWith("music.play ")) {
          trackName = String(evaluateExpression(trimmed.slice(11), buildScope(locals, trimmed)) || "");
        } else if (trimmed.startsWith("music ")) {
          trackName = String(evaluateExpression(trimmed.slice(6), buildScope(locals, trimmed)) || "");
        }
        trackName = normalizeLiteral(trackName);
        if (trackName) playMusic(trackName);
        return true;
      }
    }
    if (trimmed === "music.sync_steps" || trimmed === "music.sync_steps()") {
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "");
        const selectedId = Number(state.selected_step_id ?? -1);
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        state.active_steps = parseTrackToSteps(score, selectedId, timeSig, selectedBar);
        if (typeof ctx().app.render === "function") {
          ctx().app.render();
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.select_step(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(18, -1);
      const id = Number(evaluateExpression(inner, buildScope(locals, trimmed)));
      const state = ctx().app?.state;
      if (state) {
        state.selected_step_id = id;
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "");
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        state.active_steps = parseTrackToSteps(score, id, timeSig, selectedBar);
        const step = state.active_steps.find((s) => s.id === id);
        if (step && !step.is_bar && !step.is_rest) {
          state.selected_note = step.note;
          if (step.is_chord && step.chord_notes && step.chord_notes.length > 0) {
            for (const cn of step.chord_notes) {
              if (voice === "drums" || ["kick", "snare", "hihat"].includes(cn)) {
                playSound("drum_" + cn);
              } else if (voice === "bass") {
                playSound("key_bass");
              } else {
                playSound("key_lead");
              }
            }
          } else {
            if (voice === "drums") {
              playSound("drum_" + step.note);
            } else if (voice === "bass") {
              playSound("key_bass");
            } else {
              playSound("key_lead");
            }
          }
        }
        if (typeof ctx().app.render === "function") {
          ctx().app.render();
        }
      }
      return true;
    }
    function syncMusicState(state) {
      if (!state || !state.selected_song) return;
      const name = String(state.selected_song);
      const tempo = Number(state.tempo) || 128;
      const timeSig = String(state.time_signature || "4/4");
      const bars = Number(state.bars) || 4;
      const lead = String(state.lead_track || "");
      const bass = String(state.bass_track || "");
      const drums = String(state.drums_track || "");
      registerMusic({
        [name]: {
          music_type: "8bit",
          tempo,
          time_signature: timeSig,
          bars,
          loop_track: true,
          volume: 0.2,
          lead,
          bass,
          drums
        }
      });
    }
    if (trimmed.startsWith("music.delete_step(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(18, -1);
      const id = Number(evaluateExpression(inner, buildScope(locals, trimmed)));
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "");
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const tokens = score.trim().split(/\s+/).filter(Boolean);
        if (id >= 0 && id < tokens.length) {
          tokens.splice(id, 1);
          state[voice + "_track"] = tokens.join(" ");
          state.selected_step_id = -1;
          state.active_steps = parseTrackToSteps(state[voice + "_track"], -1, timeSig, selectedBar);
          syncMusicState(state);
          if (typeof ctx().app.render === "function") {
            ctx().app.render();
          }
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.stretch_step(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(19, -1);
      const parts = splitTopLevel(inner, ",");
      const id = Number(evaluateExpression(parts[0], buildScope(locals, trimmed)));
      const delta = parts.length > 1 ? Number(evaluateExpression(parts[1], buildScope(locals, trimmed))) : 1;
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "");
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const tokens = score.trim().split(/\s+/).filter(Boolean);
        if (id >= 0 && id < tokens.length) {
          const raw = tokens[id];
          if (raw !== "|") {
            const DURS = [":16", ":8", ":4", ":2", ":1"];
            let currentDur = ":8";
            let prefix = raw;
            if (raw.startsWith("[") && raw.includes("]")) {
              const closeIdx = raw.indexOf("]");
              prefix = raw.slice(0, closeIdx + 1);
              currentDur = raw.slice(closeIdx + 1) || ":8";
            } else {
              const colonIdx = raw.indexOf(":");
              prefix = colonIdx !== -1 ? raw.slice(0, colonIdx) : raw;
              currentDur = colonIdx !== -1 ? raw.slice(colonIdx) : ":8";
            }
            let durIdx = DURS.indexOf(currentDur);
            if (durIdx === -1) durIdx = 1;
            const newDurIdx = Math.max(0, Math.min(DURS.length - 1, durIdx + delta));
            tokens[id] = `${prefix}${DURS[newDurIdx]}`;
            state[voice + "_track"] = tokens.join(" ");
            state.active_steps = parseTrackToSteps(state[voice + "_track"], id, timeSig, selectedBar);
            syncMusicState(state);
            if (typeof ctx().app.render === "function") {
              ctx().app.render();
            }
          }
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.stack_chord_note(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(23, -1);
      const parts = splitTopLevel(inner, ",");
      const note = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
      const dur = parts[1] ? String(evaluateExpression(parts[1], buildScope(locals, trimmed))) : ":8";
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "").trim();
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const tokens = score.length > 0 ? score.split(/\s+/).filter(Boolean) : [];
        if (tokens.length > 0) {
          const lastToken = tokens[tokens.length - 1];
          if (lastToken.startsWith("[") && lastToken.includes("]")) {
            const closeIdx = lastToken.indexOf("]");
            const currentNotes = lastToken.slice(1, closeIdx).split(/[,+]/).map((s) => s.trim()).filter(Boolean);
            const currentDur = lastToken.slice(closeIdx + 1) || dur;
            if (!currentNotes.includes(note)) {
              currentNotes.push(note);
              tokens[tokens.length - 1] = `[${currentNotes.join(",")}]${currentDur}`;
            }
          } else {
            tokens.push(`[${note}]${dur}`);
          }
        } else {
          tokens.push(`[${note}]${dur}`);
        }
        state[voice + "_track"] = tokens.join(" ");
        state.selected_note = note;
        state.active_steps = parseTrackToSteps(state[voice + "_track"], tokens.length - 1, timeSig, selectedBar);
        syncMusicState(state);
        if (typeof ctx().app.render === "function") {
          ctx().app.render();
        }
      }
      return true;
    }
    if (trimmed === "music.add_bar" || trimmed === "music.add_bar()") {
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "").trim();
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        state[voice + "_track"] = score.length > 0 ? `${score} |` : "|";
        state.active_steps = parseTrackToSteps(state[voice + "_track"], -1, timeSig, selectedBar);
        syncMusicState(state);
        if (typeof ctx().app.render === "function") {
          ctx().app.render();
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.duplicate_bar(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(20, -1);
      const barNum = Number(evaluateExpression(inner, buildScope(locals, trimmed))) || 1;
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "").trim();
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const bars = score.split("|").map((b) => b.trim());
        const barIdx = Math.max(0, Math.min(bars.length - 1, barNum - 1));
        if (bars[barIdx] !== void 0) {
          bars.push(bars[barIdx]);
          state[voice + "_track"] = bars.join(" | ");
          state.active_steps = parseTrackToSteps(state[voice + "_track"], -1, timeSig, selectedBar);
          syncMusicState(state);
          if (typeof ctx().app.render === "function") {
            ctx().app.render();
          }
        }
      }
      return true;
    }
    if (trimmed.startsWith("music.delete_bar(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(17, -1);
      const barNum = Number(evaluateExpression(inner, buildScope(locals, trimmed))) || 1;
      const state = ctx().app?.state;
      if (state) {
        const voice = String(state.active_voice || "lead");
        const score = String(state[voice + "_track"] || "").trim();
        const timeSig = String(state.time_signature || "4/4");
        const selectedBar = Number(state.selected_bar ?? 0);
        const bars = score.split("|").map((b) => b.trim());
        const barIdx = Math.max(0, Math.min(bars.length - 1, barNum - 1));
        if (bars.length > 1 && bars[barIdx] !== void 0) {
          bars.splice(barIdx, 1);
          state[voice + "_track"] = bars.join(" | ");
          state.active_steps = parseTrackToSteps(state[voice + "_track"], -1, timeSig, selectedBar);
          syncMusicState(state);
          if (typeof ctx().app.render === "function") {
            ctx().app.render();
          }
        }
      }
      return true;
    }
    if (trimmed.startsWith("storage.set(") || trimmed.startsWith("storage.save(") || trimmed.startsWith("local_storage.set(") || trimmed.startsWith("localStorage.set(")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const parts = splitTopLevel(inner, ",");
      if (parts.length >= 2) {
        const key = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
        const val = evaluateExpression(parts[1], buildScope(locals, trimmed));
        const serialized = typeof val === "string" ? val : JSON.stringify(val);
        setStorageItem(key, serialized);
      }
      return true;
    }
    if (trimmed.startsWith("storage.set ") || trimmed.startsWith("storage.save ")) {
      const rest = trimmed.slice(12).trim();
      const parts = splitTopLevel(rest, ",");
      if (parts.length >= 2) {
        const key = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
        const val = evaluateExpression(parts[1], buildScope(locals, trimmed));
        const serialized = typeof val === "string" ? val : JSON.stringify(val);
        setStorageItem(key, serialized);
      }
      return true;
    }
    if (trimmed.startsWith("storage.remove(") || trimmed.startsWith("storage.delete(") || trimmed.startsWith("local_storage.remove(")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const key = String(evaluateExpression(inner, buildScope(locals, trimmed)));
      removeStorageItem(key);
      return true;
    }
    if (trimmed === "storage.clear()" || trimmed === "storage.clear" || trimmed === "local_storage.clear()") {
      clearStorage();
      return true;
    }
    if (trimmed.startsWith("download(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(9, -1);
      const parts = splitTopLevel(inner, ",");
      if (parts.length >= 2) {
        const filename = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
        const content = String(evaluateExpression(parts[1], buildScope(locals, trimmed)));
        downloadText(filename, content);
      }
      return true;
    }
    if (trimmed.startsWith("download ")) {
      const rest = trimmed.slice(9).trim();
      const parts = splitTopLevel(rest, ",");
      if (parts.length >= 2) {
        const filename = String(evaluateExpression(parts[0], buildScope(locals, trimmed)));
        const content = String(evaluateExpression(parts[1], buildScope(locals, trimmed)));
        downloadText(filename, content);
      }
      return true;
    }
    if ((trimmed.startsWith("clipboard.copy(") || trimmed.startsWith("copy(")) && trimmed.endsWith(")")) {
      const inner = trimmed.slice(trimmed.indexOf("(") + 1, -1);
      const text = String(evaluateExpression(inner, buildScope(locals, trimmed)));
      copyText(text);
      return true;
    }
    if (trimmed === "fullscreen.toggle()" || trimmed === "fullscreen.toggle" || trimmed === "fullscreen()" || trimmed === "fullscreen" || trimmed === "toggle_fullscreen()" || trimmed === "fullscreen.enter()" || trimmed === "fullscreen.exit()") {
      if (typeof document !== "undefined") {
        const doc = document;
        const docEl = document.documentElement;
        const isFs = Boolean(
          doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement || doc.body.getAttribute("data-fullscreen") === "true" || doc.body.classList.contains("fullscreen")
        );
        const shouldEnter = trimmed === "fullscreen.enter()" ? true : trimmed === "fullscreen.exit()" ? false : !isFs;
        if (shouldEnter) {
          if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(() => {
            });
          } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
          } else if (docEl.msRequestFullscreen) {
            docEl.msRequestFullscreen();
          }
          doc.body.setAttribute("data-fullscreen", "true");
          doc.body.classList.add("fullscreen");
        } else {
          if (doc.exitFullscreen) {
            doc.exitFullscreen().catch(() => {
            });
          } else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
          } else if (doc.msExitFullscreen) {
            doc.msExitFullscreen();
          }
          doc.body.removeAttribute("data-fullscreen");
          doc.body.classList.remove("fullscreen");
        }
        if (typeof window !== "undefined" && window.parent && window.parent !== window) {
          try {
            window.parent.postMessage({ type: "toggle_fullscreen", is_fullscreen: shouldEnter }, "*");
          } catch (_) {
          }
        }
        const app = ctx().app;
        if (typeof app?.state !== "undefined") {
          app.state.is_fullscreen = shouldEnter;
          if (typeof app.render === "function") {
            app.render();
          }
        }
      }
      return true;
    }
    const emitterMatch = trimmed.match(/^([A-Za-z_][\w]*)\.(burst|step)\((.*)\)$/);
    if (emitterMatch && ctx().emitters && Object.prototype.hasOwnProperty.call(ctx().emitters, emitterMatch[1])) {
      const name = emitterMatch[1];
      const method = emitterMatch[2];
      const cfg = ctx().emitters[name] || {};
      const scope = buildScope(locals, trimmed);
      const existing = evaluateExpression(name, scope);
      const current = Array.isArray(existing) ? existing : [];
      if (method === "step") {
        if (current.length === 0) return true;
        const friction = cfg.friction ?? 0.92;
        const gravity = cfg.gravity ?? 0;
        const surviving = [];
        const rawCurrent2 = current.__raw || current;
        for (let i = 0; i < rawCurrent2.length; i += 1) {
          const item = rawCurrent2[i];
          if (!item || typeof item !== "object") continue;
          const p = item.__raw || item;
          const life2 = Number(p.life || 0) - 1;
          if (life2 <= 0) continue;
          const vx = Number(p.vx || 0) * friction;
          const vy = Number(p.vy || 0) * friction + gravity;
          p.x = Math.round((Number(p.x || 0) + Number(p.vx || 0)) * 10) / 10;
          p.y = Math.round((Number(p.y || 0) + Number(p.vy || 0)) * 10) / 10;
          p.vx = vx;
          p.vy = vy;
          p.life = life2;
          surviving.push(p);
        }
        assignPath(name, surviving, locals);
        return true;
      }
      const parts = emitterMatch[3].trim() ? splitTopLevel(emitterMatch[3], ",") : [];
      if (parts.length < 2) {
        console.warn(`[rune-web] ${name}.burst(x, y, [count, color, speed]) needs at least x and y`);
        return true;
      }
      const arg = (i) => parts.length > i ? evaluateExpression(parts[i], scope) : void 0;
      const xVal = Math.round(Number(arg(0) || 0) * 10) / 10;
      const yVal = Math.round(Number(arg(1) || 0) * 10) / 10;
      const countVal = Number(arg(2) ?? cfg.count ?? 8);
      const colorVal = arg(3) !== void 0 ? valueToString(arg(3)) : cfg.color ?? "#ffffff";
      const speedVal = Number(arg(4) ?? cfg.speed ?? 7);
      const life = cfg.life ?? 14;
      const maxParticles = cfg.max !== void 0 ? Number(cfg.max) : 36;
      const [minSize, maxSize] = Array.isArray(cfg.size) ? cfg.size : [cfg.size ?? 3, cfg.size ?? 5];
      const rawCurrent = current.__raw || current;
      const newParticles = [];
      for (let i = 0; i < countVal; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = (Math.random() * 0.7 + 0.3) * speedVal;
        newParticles.push({
          x: xVal,
          y: yVal,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          life,
          max_life: life,
          color: colorVal,
          size: minSize + Math.floor(Math.random() * (maxSize - minSize + 1))
        });
      }
      const combined = rawCurrent.concat(newParticles);
      const capped = combined.length > maxParticles ? combined.slice(combined.length - maxParticles) : combined;
      assignPath(name, capped, locals);
      return true;
    }
    const restoreMatch = trimmed.match(/^(?:restore|reset)\s+([a-zA-Z0-9_.[\]'"]+)$/) || trimmed.match(/^([a-zA-Z0-9_.[\]'"]+)\.(?:restore|reset)\(\)$/);
    if (restoreMatch) {
      const targetPath = restoreMatch[1].trim();
      const initial = ctx().initialState;
      if (initial && Object.prototype.hasOwnProperty.call(initial, targetPath)) {
        assignPath(targetPath, JSON.parse(JSON.stringify(initial[targetPath])), locals);
        return true;
      }
      const targetVal = evaluateExpression(targetPath, buildScope(locals, trimmed));
      if (Array.isArray(targetVal)) {
        for (const item of targetVal) {
          if (item && typeof item === "object") {
            for (const key of Object.keys(item)) {
              if (key.startsWith("start_")) {
                const baseProp = key.slice(6);
                item[baseProp] = item[key];
              }
            }
            if ("alive" in item) {
              item.alive = true;
            }
          }
        }
        assignPath(targetPath, targetVal, locals);
        return true;
      } else if (targetVal && typeof targetVal === "object") {
        const item = targetVal;
        for (const key of Object.keys(item)) {
          if (key.startsWith("start_")) {
            item[key.slice(6)] = item[key];
          }
        }
        if ("alive" in item) {
          item.alive = true;
        }
        assignPath(targetPath, item, locals);
        return true;
      }
      return true;
    }
    const compoundMatch = trimmed.match(/^([a-zA-Z0-9_.[\]'"]+)\s*(\+|\-|\*|\/)=\s*(.+)$/);
    if (compoundMatch) {
      const left = compoundMatch[1].trim();
      const op = compoundMatch[2];
      const right = compoundMatch[3].trim();
      const rightVal = evaluateExpression(right, buildScope(locals, trimmed));
      const leftVal = evaluateExpression(left, buildScope(locals, trimmed));
      let newVal;
      if (op === "+") {
        if (typeof leftVal === "number" && typeof rightVal === "number") {
          newVal = leftVal + rightVal;
        } else {
          newVal = `${valueToString(leftVal)}${valueToString(rightVal)}`;
        }
      } else if (op === "-") {
        newVal = Number(leftVal) - Number(rightVal);
      } else if (op === "*") {
        newVal = Number(leftVal) * Number(rightVal);
      } else if (op === "/") {
        newVal = Number(leftVal) / Number(rightVal);
      }
      assignPath(left, newVal, locals);
      return true;
    }
    if (trimmed.includes("=") && !trimmed.match(/^.+?\.push\(/)) {
      const assignmentMatch = trimmed.match(/^(.*?)(?<![!<>=])=(?!=)(.*)$/);
      if (assignmentMatch) {
        const left = assignmentMatch[1].trim();
        const right = assignmentMatch[2].trim();
        const builtinVal = handleBuiltin(right, locals);
        if (builtinVal == STOP) {
          return false;
        }
        if (builtinVal == NO_ACTION) {
          return true;
        }
        const value = builtinVal !== void 0 ? builtinVal : evaluateExpression(right, buildScope(locals, trimmed));
        assignPath(left, value, locals);
        return true;
      }
    }
    const cmdResult = handleBuiltin(trimmed, locals);
    if (cmdResult) {
      if (cmdResult == STOP) {
        return false;
      }
      return true;
    }
    const pushMatch = trimmed.match(/^(.+?)\.push\((.+)\)$/);
    if (pushMatch) {
      const path = pushMatch[1].trim();
      const arg = pushMatch[2].trim();
      const collection = evaluateExpression(path, buildScope(locals, trimmed));
      if (Array.isArray(collection)) {
        const val = evaluateExpression(arg, buildScope(locals, trimmed));
        collection.push(val);
        assignPath(path, collection, locals);
      }
      return true;
    }
    if (trimmed.includes("(") && trimmed.endsWith(")")) {
      const parenIndex = trimmed.indexOf("(");
      const funcName = trimmed.slice(0, parenIndex).trim();
      const argsStr = trimmed.slice(parenIndex + 1, -1);
      if (funcName === "window.__runeWebEmit") {
        const args = argsStr ? splitTopLevel(argsStr, ",").map(
          (arg) => evaluateExpression(arg, buildScope(locals, trimmed))
        ) : [];
        const emitFn = getWindowProp("__runeWebEmit");
        if (emitFn && typeof emitFn === "function") {
          emitFn.apply(null, args);
        }
        return true;
      }
    }
    return true;
  }
  function executeSteps(steps, locals) {
    for (const step of steps) {
      if (Object.prototype.hasOwnProperty.call(step, "Statement")) {
        if (!executeStatement(step.Statement, locals)) return false;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(step, "Conditional")) {
        const conditional = step.Conditional;
        if (Boolean(
          evaluateExpression(
            conditional.condition,
            buildScope(locals, conditional.condition)
          )
        )) {
          if (!executeSteps(conditional.steps || [], locals)) return false;
        }
      }
      if (Object.prototype.hasOwnProperty.call(step, "ForLoop")) {
        const loop = step.ForLoop;
        const collection = evaluateExpression(
          loop.collection,
          buildScope(locals, loop.collection)
        );
        if (Array.isArray(collection)) {
          for (let i = 0; i < collection.length; i++) {
            const item = collection[i];
            const childLocals = Object.assign(
              {},
              locals || {}
            );
            childLocals[loop.item_name] = item;
            if (loop.index_name) {
              childLocals[loop.index_name] = i;
            }
            if (!executeSteps(loop.steps || [], childLocals)) {
              break;
            }
          }
        }
      }
    }
    return true;
  }
  var PITCH_ROWS = {
    "C5": 0,
    "B4": 1,
    "A#4": 2,
    "BB4": 2,
    "A4": 3,
    "G#4": 4,
    "AB4": 4,
    "G4": 5,
    "F#4": 6,
    "GB4": 6,
    "F4": 7,
    "E4": 8,
    "D#4": 9,
    "EB4": 9,
    "D4": 10,
    "C#4": 11,
    "DB4": 11,
    "C4": 12,
    "B3": 13,
    "A#3": 14,
    "BB3": 14,
    "A3": 15,
    "G#3": 16,
    "AB3": 16,
    "G3": 17,
    "F#3": 18,
    "GB3": 18,
    "F3": 19,
    "E3": 20,
    "D#3": 21,
    "EB3": 21,
    "D3": 22,
    "C#3": 23,
    "DB3": 23,
    "C3": 24,
    "B2": 25,
    "A#2": 26,
    "BB2": 26,
    "A2": 27,
    "G#2": 28,
    "AB2": 28,
    "G2": 29,
    "F#2": 30,
    "GB2": 30,
    "F2": 31,
    "E2": 32,
    "D2": 33,
    "C2": 34,
    "A1": 35,
    // Drums
    "hihat": 0,
    "snare": 1,
    "kick": 2
  };
  function getPitchRow(pitch, isDrum) {
    if (isDrum) {
      const p = pitch.toLowerCase();
      if (p.includes("hihat") || p.includes("crash")) return 0;
      if (p.includes("snare") || p.includes("tom")) return 1;
      return 2;
    }
    const clean = pitch.toUpperCase().trim();
    if (clean in PITCH_ROWS) return PITCH_ROWS[clean];
    const match = clean.match(/^([A-G][#B]?)([0-8])$/);
    if (match) {
      const oct = parseInt(match[2], 10);
      if (oct >= 5) return 0;
      if (oct === 4) return 8;
      if (oct === 3) return 15;
      if (oct <= 2) return 27;
    }
    return 12;
  }
  function parseTrackToSteps(scoreStr, selectedIdx, timeSignature = "4/4", selectedBar = 0) {
    if (!scoreStr) return [];
    const tokens = String(scoreStr).trim().split(/\s+/).filter(Boolean);
    const steps = [];
    const beatsPerBar = timeSignature.startsWith("3/") ? 3 : 4;
    let barNum = 1;
    let currentBeatInBar = 0;
    let totalBeatOffset = 0;
    let stepInBar = 1;
    for (let i = 0; i < tokens.length; i++) {
      const raw = tokens[i];
      if (raw === "|") {
        const totalLeft2 = Math.round(totalBeatOffset * 120);
        const barLeft2 = Math.round(currentBeatInBar * 120);
        steps.push({
          id: i,
          raw,
          note: "|",
          duration: "",
          len_label: "BAR " + barNum,
          beats: 0,
          is_bar: true,
          is_chord: false,
          is_rest: false,
          is_selected: i === selectedIdx,
          bar_num: barNum,
          step_num: stepInBar,
          pitch_class: "step-bar",
          matrix_top: 0,
          matrix_left: selectedBar > 0 ? barLeft2 : totalLeft2,
          matrix_total_left: totalLeft2,
          matrix_bar_left: barLeft2,
          matrix_width: 8,
          strip_width: 54,
          can_stretch: false,
          can_shorten: false
        });
        barNum += 1;
        currentBeatInBar = 0;
        stepInBar = 1;
        continue;
      }
      let pitch = raw;
      let dur = ":8";
      let isChord = false;
      let chordNotes = [];
      if (raw.startsWith("[") && raw.includes("]")) {
        const closeIdx = raw.indexOf("]");
        pitch = raw.slice(1, closeIdx);
        const after = raw.slice(closeIdx + 1);
        dur = after.startsWith(":") ? after : ":8";
        isChord = true;
        chordNotes = pitch.split(/[,+]/).map((s) => s.trim()).filter(Boolean);
      } else {
        const colonIdx = raw.indexOf(":");
        pitch = colonIdx !== -1 ? raw.slice(0, colonIdx) : raw;
        dur = colonIdx !== -1 ? raw.slice(colonIdx) : ":8";
        if (pitch.includes("+")) {
          isChord = true;
          chordNotes = pitch.split("+").map((s) => s.trim()).filter(Boolean);
        }
      }
      const isRest = pitch === "-" || pitch.toLowerCase() === "rest";
      let lenLabel = "1/8";
      let beats = 0.5;
      if (dur === ":16") {
        lenLabel = "1/16";
        beats = 0.25;
      } else if (dur === ":8") {
        lenLabel = "1/8";
        beats = 0.5;
      } else if (dur === ":4") {
        lenLabel = "1/4";
        beats = 1;
      } else if (dur === ":2") {
        lenLabel = "1/2";
        beats = 2;
      } else if (dur === ":1") {
        lenLabel = "1/1";
        beats = beatsPerBar;
      }
      let pitchClass = "step-note";
      if (isRest) pitchClass = "step-rest";
      else if (isChord) pitchClass = "step-chord";
      else if (pitch.includes("2") || pitch.includes("1")) pitchClass = "step-bass";
      else if (pitch.includes("3")) pitchClass = "step-mid-low";
      else if (pitch.includes("4")) pitchClass = "step-mid";
      else if (pitch.includes("5")) pitchClass = "step-high";
      else if (pitch === "kick") pitchClass = "step-kick";
      else if (pitch === "snare") pitchClass = "step-snare";
      else if (pitch === "hihat") pitchClass = "step-hihat";
      const rootPitch = isChord && chordNotes.length > 0 ? chordNotes[0] : pitch;
      const isDrumPitch = ["kick", "snare", "hihat", "crash", "tom"].includes(rootPitch.toLowerCase());
      const row = getPitchRow(rootPitch, isDrumPitch);
      const rowHeight = isDrumPitch ? 48 : 28;
      const matrixTop = row * rowHeight + 2;
      const totalLeft = Math.round(totalBeatOffset * 120);
      const barLeft = Math.round(currentBeatInBar * 120);
      const matrixLeft = selectedBar > 0 ? barLeft : totalLeft;
      const matrixWidth = Math.max(34, Math.round(beats * 120) - 4);
      const stripWidth = Math.max(54, Math.round(beats * 140));
      const displayNote = isRest ? "REST" : isChord ? pitch.startsWith("[") ? pitch : `[${pitch}]` : pitch;
      steps.push({
        id: i,
        raw,
        note: displayNote,
        chord_notes: isChord ? chordNotes : [pitch],
        duration: dur,
        len_label: lenLabel,
        beats,
        is_bar: false,
        is_chord: isChord,
        is_rest: isRest,
        is_selected: i === selectedIdx,
        bar_num: barNum,
        step_num: stepInBar,
        pitch_class: pitchClass,
        pitch_row: row,
        matrix_top: matrixTop,
        matrix_left: matrixLeft,
        matrix_total_left: totalLeft,
        matrix_bar_left: barLeft,
        matrix_width: matrixWidth,
        strip_width: stripWidth,
        can_stretch: beats < 4,
        can_shorten: beats > 0.25
      });
      totalBeatOffset += beats;
      currentBeatInBar += beats;
      stepInBar += 1;
      if (currentBeatInBar >= beatsPerBar && !tokens.includes("|")) {
        barNum += 1;
        currentBeatInBar = 0;
        stepInBar = 1;
      }
    }
    return steps;
  }

  // src/logic.ts
  function createLogicApp(render) {
    return {
      state: {},
      derived: {},
      playSound,
      playMusic,
      stopMusic,
      pauseMusic,
      resumeMusic,
      computeDerived() {
        const context = ctx();
        const baseScope = buildScope({});
        for (const [name, def] of Object.entries(
          context.derivedDefinitions
        )) {
          const sourceValue = resolveValue(def.source, baseScope);
          const sourceKey = valueToString(sourceValue);
          let resolved = void 0;
          for (const currentCase of def.cases || []) {
            const matcher = normalizeLiteral(currentCase.matcher);
            if (matcher === "_" || matcher === sourceKey) {
              resolved = evaluateExpression(
                currentCase.value,
                buildScope({})
              );
              break;
            }
          }
          this.derived[name] = resolved;
        }
      },
      render,
      invokeAction(name, args, locals) {
        const context = ctx();
        const def = context.actionDefinitions[name];
        if (!def) {
          if (typeof window !== "undefined" && typeof window[name] === "function") {
            window[name](...args);
          }
          return;
        }
        const scopedLocals = Object.assign(
          {},
          locals || {}
        );
        (def.params || []).forEach((param, index2) => {
          scopedLocals[param] = args[index2];
        });
        executeSteps(def.steps || [], scopedLocals);
      }
    };
  }

  // src/pixel3d/grid.ts
  var shade = (c, f) => (4278190080 | Math.floor((c & 255) * f) | Math.floor((c >>> 8 & 255) * f) << 8 | Math.floor((c >>> 16 & 255) * f) << 16) >>> 0;
  var pack = (c) => (4278190080 | (c & 255) << 16 | c & 65280 | c >>> 16 & 255) >>> 0;
  function sample(surface, u, v) {
    if (typeof surface === "number") return (surface | 4278190080) >>> 0;
    const x = Math.floor(u * surface.width) & surface.width - 1;
    const y = Math.floor(v * surface.height) & surface.height - 1;
    return surface.pixels[y * surface.width + x];
  }
  function renderGrid(map, camera, textures, overrides, things, sprites, fov, width, height, buffer, depth, time) {
    const eye = camera.height ?? 0.5, pitch = (camera.pitch ?? 0) * Math.PI / 180;
    if (![camera.x, camera.y, camera.angle, eye, pitch].every(Number.isFinite) || eye <= 0 || Math.abs(pitch) > 85 * Math.PI / 180) {
      throw new Error("Grid camera must be finite, above the floor, with pitch between -85 and 85 degrees");
    }
    const angle = camera.angle * Math.PI / 180, dx = Math.cos(angle), dy = Math.sin(angle);
    const cp = Math.cos(pitch), sp = Math.sin(pitch), scale = Math.tan(fov * Math.PI / 360);
    const top = map.ceilingHeight ?? 1;
    const tiles = new Map(overrides.map((o) => [o.y * map.width + o.x, o.texture]));
    const billboards = things.filter((t) => t.sprite && !t.model && t.visible !== false);
    for (let y = 0; y < height; y++) {
      const v = ((height >> 1) - y - 0.5) / height;
      for (let x = 0; x < width; x++) {
        const u = (2 * x / width - 1) * scale;
        const rx = dx * (cp - sp * v) - dy * u, ry = dy * (cp - sp * v) + dx * u, rz = sp + cp * v;
        let hit = Infinity;
        let color = sample(map.ceiling, 0, 0);
        const plane = rz < -1e-10 ? -eye / rz : !map.sky && rz > 1e-10 ? (top - eye) / rz : Infinity;
        if (plane > 0 && Number.isFinite(plane)) {
          hit = plane;
          color = sample(rz < 0 ? map.floor : map.ceiling, camera.x + rx * hit, camera.y + ry * hit);
        }
        let mx = Math.floor(camera.x), my = Math.floor(camera.y), enter = 0, side = 2;
        const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
        const tx = Math.abs(1 / rx), ty = Math.abs(1 / ry);
        let nextX = rx === 0 ? Infinity : (rx < 0 ? camera.x - mx : mx + 1 - camera.x) * tx;
        let nextY = ry === 0 ? Infinity : (ry < 0 ? camera.y - my : my + 1 - camera.y) * ty;
        for (let steps = 0; steps < map.width + map.height + 4 && enter < hit; steps++) {
          if (mx < 0 || my < 0 || mx >= map.width || my >= map.height) break;
          const cell = my * map.width + mx, wall = map.grid[cell];
          const exit = Math.min(nextX, nextY);
          if (wall > 0) {
            const a = rz === 0 ? -Infinity : (0 - eye) / rz;
            const b = rz === 0 ? Infinity : (top - eye) / rz;
            const near = Math.max(enter, Math.min(a, b), 1e-4);
            const far = Math.min(exit, Math.max(a, b));
            if ((rz !== 0 || eye <= top) && near <= far && near < hit) {
              hit = near;
              const hx = camera.x + rx * hit, hy = camera.y + ry * hit, hz = eye + rz * hit;
              const face = near > enter + 1e-8 ? 2 : side;
              const tex = textures[tiles.get(cell) ?? wall - 1];
              color = tex ? shade(sample(tex, face === 0 ? hy : hx, face === 2 ? hy : 1 - hz), face === 2 ? 1 : face === 0 ? 1 : 0.75) : 4281545523;
              break;
            }
          }
          if (nextX < nextY) {
            enter = nextX;
            nextX += tx;
            mx += sx;
            side = 0;
          } else {
            enter = nextY;
            nextY += ty;
            my += sy;
            side = 1;
          }
        }
        if (!Number.isFinite(hit) && map.sky) {
          color = skyPixel(map.sky, Math.atan2(ry, rx), Math.max(0, Math.min(1, rz * 2)), time);
        }
        for (const thing of billboards) {
          const sprite = sprites[thing.sprite];
          if (!sprite) continue;
          const forward = (thing.x - camera.x) * dx + (thing.y - camera.y) * dy;
          const t = forward / (rx * dx + ry * dy);
          if (t <= 1e-3 || t >= hit) continue;
          const size = thing.scale ?? 1;
          const across = (camera.x + rx * t - thing.x) * -dy + (camera.y + ry * t - thing.y) * dx;
          const su = across / (size * sprite.width / sprite.height) + 0.5;
          const sv = 1 - (eye + rz * t - (thing.z ?? 0)) / size;
          if (su < 0 || su >= 1 || sv < 0 || sv >= 1) continue;
          const c = sprite.colors[sprite.pixels[Math.floor(sv * sprite.height) * sprite.width + Math.floor(su * sprite.width)]];
          if (c !== null && c !== void 0) {
            color = pack(c);
            hit = t;
          }
        }
        const index2 = y * width + x;
        buffer[index2] = color;
        depth[index2] = hit;
      }
    }
  }

  // src/pixel3d/model.ts
  function shade2(color, factor) {
    return (4278190080 | Math.floor((color & 255) * factor) | Math.floor((color >>> 8 & 255) * factor) << 8 | Math.floor((color >>> 16 & 255) * factor) << 16) >>> 0;
  }
  function fragmentNoise(x, y) {
    const hash = Math.imul(Math.floor(x / 2), 73856093) ^ Math.imul(Math.floor(y / 2), 19349663);
    return (Math.imul(hash ^ hash >>> 13, 1274126177) >>> 0) / 4294967296;
  }
  function renderModel(model, instance, camera, dirX, dirY, fovScale, width, height, buffer, depth) {
    const scale = instance.scale ?? 1;
    const dissolve = instance.dissolve ?? 0;
    if (!Number.isFinite(dissolve) || dissolve < 0 || dissolve > 1) throw new Error("Model dissolve must be between 0 and 1");
    if (!Number.isFinite(scale) || scale <= 0) throw new Error("Model scale must be finite and positive");
    if (![instance.x, instance.y, instance.z ?? 0, instance.angle ?? 0].every(Number.isFinite)) {
      throw new Error("Model position and angle must be finite");
    }
    if (dissolve === 1) return;
    const angle = (instance.angle ?? 0) * Math.PI / 180;
    const eye = camera.height ?? 0.5, pitch = (camera.pitch ?? 0) * Math.PI / 180;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const c = Math.cos(angle), s = Math.sin(angle);
    const ox = camera.x - instance.x, oy = camera.y - instance.y;
    const origin = [(ox * c + oy * s) / scale, (-ox * s + oy * c) / scale, (eye - (instance.z ?? 0)) / scale];
    for (const block of model.blocks) {
      const max = block.from.map((v, i) => v + block.size[i]);
      let left = width, right = 0, top = height, bottom = 0, clipped = false, frontCorners = 0;
      let outsideLeft = 0, outsideRight = 0, outsideTop = 0, outsideBottom = 0;
      for (let corner = 0; corner < 8; corner++) {
        const lx = (corner & 1 ? max[0] : block.from[0]) * scale;
        const ly = (corner & 2 ? max[1] : block.from[1]) * scale;
        const z = (corner & 4 ? max[2] : block.from[2]) * scale + (instance.z ?? 0);
        const x = instance.x + lx * c - ly * s - camera.x;
        const y = instance.y + lx * s + ly * c - camera.y;
        const forward = x * dirX + y * dirY;
        const d = forward * cp + (z - eye) * sp;
        const side = -x * dirY + y * dirX;
        const up = (z - eye) * cp - forward * sp;
        if (side < -d * fovScale - 1e-9) outsideLeft++;
        if (side > d * fovScale + 1e-9) outsideRight++;
        if (up > d * ((height >> 1) / height) + 1e-9) outsideTop++;
        if (up < -d * ((height - (height >> 1)) / height) - 1e-9) outsideBottom++;
        if (d <= 1e-3) {
          clipped = true;
          continue;
        }
        frontCorners++;
        const sx = width / 2 * (1 + side / (d * fovScale));
        const sy = (height >> 1) - up * height / d;
        left = Math.min(left, sx);
        right = Math.max(right, sx);
        top = Math.min(top, sy);
        bottom = Math.max(bottom, sy);
      }
      if (frontCorners === 0 || outsideLeft === 8 || outsideRight === 8 || outsideTop === 8 || outsideBottom === 8) continue;
      const colorX = shade2(block.color, 0.8), colorY = shade2(block.color, 0.65), colorZ = shade2(block.color, 1);
      const x0 = clipped ? 0 : Math.max(0, Math.floor(left));
      const x1 = clipped ? width : Math.min(width, Math.ceil(right));
      const y0 = clipped ? 0 : Math.max(0, Math.floor(top));
      const y1 = clipped ? height : Math.min(height, Math.ceil(bottom));
      for (let x = x0; x < x1; x++) {
        const cx = 2 * x / width - 1;
        for (let y = y0; y < y1; y++) {
          if (dissolve > 0 && fragmentNoise(x, y) < dissolve) continue;
          const v = ((height >> 1) - y - 0.5) / height;
          const rx = dirX * cp - dirY * fovScale * cx - dirX * sp * v;
          const ry = dirY * cp + dirX * fovScale * cx - dirY * sp * v;
          const rayX = (rx * c + ry * s) / scale;
          const rayY = (-rx * s + ry * c) / scale;
          const rayZ = (sp + cp * v) / scale;
          let near = -Infinity, far = Infinity, face = 0, exitFace = 0, valid = true;
          for (let axis = 0; axis < 3; axis++) {
            const component = axis === 0 ? rayX : axis === 1 ? rayY : rayZ;
            if (Math.abs(component) < 1e-12) {
              if (origin[axis] < block.from[axis] || origin[axis] > max[axis]) valid = false;
            } else {
              const a = (block.from[axis] - origin[axis]) / component;
              const b = (max[axis] - origin[axis]) / component;
              const entry = Math.min(a, b);
              if (entry > near) {
                near = entry;
                face = axis;
              }
              if (Math.max(a, b) < far) {
                far = Math.max(a, b);
                exitFace = axis;
              }
            }
          }
          const index2 = y * width + x;
          const hit = near > 1e-3 ? near : far;
          if (near <= 1e-3) face = exitFace;
          if (valid && far >= near && hit > 1e-3 && hit < depth[index2]) {
            depth[index2] = hit;
            buffer[index2] = face === 2 ? colorZ : face === 0 ? colorX : colorY;
          }
        }
      }
    }
  }

  // src/pixel3d/hud.ts
  function validateHud(value, sprites = {}) {
    if (!value || typeof value !== "object") throw new Error("Pixel-3d ui must be a HUD object");
    const hud = value;
    if (hud.cinema) {
      const c = hud.cinema;
      if (!Array.isArray(c.lines) || c.lines.length > 64 || !c.lines.every((line) => typeof line === "string" && line.length <= 80) || !Number.isFinite(c.offset) || Math.abs(c.offset) > 1e4 || ![1, 2].includes(c.scale ?? 2) || !Number.isFinite(c.top ?? 0.55) || !Number.isFinite(c.bottom ?? 0.94) || (c.top ?? 0.55) < 0 || (c.bottom ?? 0.94) > 1 || (c.top ?? 0.55) >= (c.bottom ?? 0.94) || !Number.isFinite(c.spacing ?? 18) || (c.spacing ?? 18) < 12 || (c.spacing ?? 18) > 48 || !Number.isFinite(c.fade ?? 0) || (c.fade ?? 0) < 0 || (c.fade ?? 0) > 1) throw new Error("HUD cinema needs bounded text, scroll offset, viewport, scale and fade");
    }
    if (hud.damageDirection !== void 0 && ![-1, 0, 1].includes(hud.damageDirection)) throw new Error("HUD damageDirection must be -1, 0 or 1");
    if (hud.map !== void 0) {
      const map = hud.map;
      if (!map || typeof map.current !== "string" || typeof map.expanded !== "boolean" || !Array.isArray(map.nodes) || map.nodes.length > 24 || !Array.isArray(map.links) || map.links.length > 48 || !map.nodes.every((n) => n && typeof n.id === "string" && typeof n.label === "string" && Number.isFinite(n.x) && n.x >= 0 && n.x <= 100 && Number.isFinite(n.y) && n.y >= 0 && n.y <= 100 && typeof n.visited === "boolean" && typeof n.locked === "boolean") || new Set(map.nodes.map((n) => n.id)).size !== map.nodes.length || !map.nodes.some((n) => n.id === map.current) || !map.links.every((l) => l && (l.shortcut === void 0 || typeof l.shortcut === "boolean") && map.nodes.some((n) => n.id === l.from) && map.nodes.some((n) => n.id === l.to))) throw new Error("HUD map needs unique positioned nodes, valid links and a current room");
    }
    if (hud.style !== void 0 && hud.style !== "floating") throw new Error("Pixel-3d ui style must be floating");
    if (hud.heading !== void 0 && typeof hud.heading !== "string") throw new Error("Pixel-3d ui heading must be a string");
    if (hud.textScale !== void 0 && hud.textScale !== 1 && hud.textScale !== 2) {
      throw new Error("Pixel-3d ui textScale must be 1 or 2");
    }
    if (!Array.isArray(hud.meters) || hud.meters.length > 3 || !hud.meters.every((m) => m && typeof m.label === "string" && Number.isFinite(m.value) && Number.isFinite(m.max) && m.max > 0 && Number.isInteger(m.color) && m.color >= 0 && m.color <= 16777215 && (m.display === void 0 || ["counter", "pips", "bar"].includes(m.display)) && (m.display !== "pips" || Number.isInteger(m.max) && m.max <= 16 && m.icon !== void 0 && m.emptyIcon !== void 0)) || !["objective", "detail", "prompt", "notice"].every((k) => typeof Reflect.get(hud, k) === "string")) {
      throw new Error("Pixel-3d ui needs up to three valid meters and objective/detail/prompt/notice strings");
    }
    for (const name of [hud.noticeIcon, ...hud.meters.flatMap((m) => [m.icon, m.emptyIcon])]) {
      if (name === void 0) continue;
      if (typeof name !== "string" || !name || !Object.prototype.hasOwnProperty.call(sprites, name)) {
        throw new Error(`Pixel-3d ui references unknown sprite: ${String(name)}`);
      }
    }
    if (hud.panel !== null) {
      const p = hud.panel;
      if (!p || !["title", "body", "footer"].every((k) => typeof Reflect.get(p, k) === "string") || !Array.isArray(p.choices) || p.choices.length > 3 || !p.choices.every((c) => typeof c === "string") || !Number.isInteger(p.selected) || p.selected < 0 || p.selected >= Math.max(1, p.choices.length)) {
        throw new Error("Pixel-3d ui panel needs title/body/footer, up to three choices, and a valid selected index");
      }
    }
    return hud;
  }
  function wrapText(text, columns) {
    if (!Number.isInteger(columns) || columns < 1) throw new Error("HUD wrap columns must be a positive integer");
    const lines = [];
    for (const paragraph of text.split("|")) {
      let line = "";
      for (const word of paragraph.trim().split(/\s+/)) {
        if (line && line.length + word.length + 1 > columns) {
          lines.push(line);
          line = "";
        }
        let rest = word;
        while (rest.length > columns) {
          if (line) {
            lines.push(line);
            line = "";
          }
          lines.push(rest.slice(0, columns));
          rest = rest.slice(columns);
        }
        line += (line ? " " : "") + rest;
      }
      if (line) lines.push(line);
    }
    return lines;
  }
  function renderFloatingHud(canvas, ui, status, paused, sprites) {
    const W = canvas.width, H = canvas.height, ink = 1518397, gold = 16767621;
    const text = (value, x, y, color = 16777215, scale = 1) => {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) canvas.text(value, x + dx, y + dy, ink, scale);
      canvas.text(value, x, y, color, scale);
    };
    const asset = (name) => {
      if (!Object.prototype.hasOwnProperty.call(sprites, name)) throw new Error(`Pixel-3d ui references unknown sprite: ${name}`);
      return sprites[name];
    };
    const icon = (name, x, y, scale = 2) => {
      const sprite = asset(name);
      for (let sy = 0; sy < sprite.height; sy++) for (let sx = 0; sx < sprite.width; sx++) {
        const color = sprite.colors[sprite.pixels[sy * sprite.width + sx]];
        if (color !== null && color !== void 0) canvas.rect(x + sx * scale, y + sy * scale, scale, scale, color);
      }
    };
    const slot = Math.floor((W - 16) / Math.max(1, ui.meters.length));
    let metersBottom = 32;
    ui.meters.forEach((meter, i) => {
      const x = 8 + i * slot, columns2 = Math.max(1, Math.floor((slot - 4) / 4));
      text(meter.label.slice(0, columns2), x, 6, gold);
      if (meter.display === "pips") {
        const full = asset(meter.icon), empty = asset(meter.emptyIcon);
        const count = Math.ceil(meter.max), pipWidth = Math.max(full.width, empty.width);
        const scale = slot >= count * (pipWidth * 2 + 3) ? 2 : 1;
        const perRow = Math.max(1, Math.floor((slot - 1) / (scale * pipWidth + 3)));
        const rowHeight = scale * Math.max(full.height, empty.height) + 3;
        for (let pip = 0; pip < count; pip++) icon(pip < Math.ceil(meter.value) ? meter.icon : meter.emptyIcon, x + pip % perRow * (scale * pipWidth + 3), 14 + Math.floor(pip / perRow) * rowHeight, scale);
        metersBottom = Math.max(metersBottom, 14 + Math.ceil(count / perRow) * rowHeight);
      } else {
        if (meter.icon) icon(meter.icon, x, 14);
        const number = `${Math.max(0, Math.ceil(meter.value))}/${Math.ceil(meter.max)}`;
        const left = x + (meter.icon ? asset(meter.icon).width * 2 + 7 : 0);
        const scale = number.length * 8 <= slot - (left - x) - 4 ? 2 : 1;
        text(number, left, 18, 16773839, scale);
        if (meter.display === "bar") {
          const barWidth = Math.max(0, slot - (left - x) - 4);
          canvas.rect(left, 30, barWidth, 2, ink);
          canvas.rect(left, 30, Math.floor(barWidth * Math.max(0, Math.min(1, meter.value / meter.max))), 2, meter.color);
        }
      }
    });
    const columns = Math.max(1, Math.floor((W - 16) / 4));
    const top = ui.meters.length ? Math.max(39, metersBottom + 5) : 8;
    text(ui.detail.slice(0, columns), 8, top, 12381148);
    if (ui.objective) text(ui.objective.slice(0, columns), 8, top + 10, gold);
    if (ui.heading && (status !== "playing" || paused)) {
      const heading = ui.heading.slice(0, Math.max(1, Math.floor((W - 32) / 8)));
      text(heading, Math.floor((W - heading.length * 8) / 2), top + 26, gold, 2);
    }
    if (ui.panel) {
      const p = ui.panel, panelColumns = Math.max(1, Math.floor((W - 48) / 4));
      const body = wrapText(p.body, panelColumns).slice(0, 4);
      const y = Math.max(top + 45, Math.floor((H - (48 + body.length * 9 + p.choices.length * 12)) / 2));
      text(p.title.slice(0, panelColumns), 24, y, gold);
      body.forEach((line, i) => text(line, 24, y + 14 + i * 9, 14937833));
      p.choices.forEach((choice, i) => text(`${i === p.selected ? ">" : " "} ${i + 1} ${choice}`.slice(0, panelColumns), 24, y + 19 + body.length * 9 + i * 12, i === p.selected ? gold : 14937833));
      text(p.footer.slice(0, panelColumns), 24, y + 25 + body.length * 9 + p.choices.length * 12, 9105871);
    } else if (ui.notice) {
      const lines = wrapText(ui.notice, columns - 5).slice(0, 2);
      const y = top + 25;
      if (ui.noticeIcon) icon(ui.noticeIcon, 8, y - 2, 1);
      const left = ui.noticeIcon ? 8 + asset(ui.noticeIcon).width + 6 : 8;
      lines.forEach((line, i) => text(line, left, y + i * 9, gold));
    }
    if (ui.prompt) text(ui.prompt.slice(0, columns), 8, H - 12, 14937833);
  }
  function renderHud(canvas, ui, status, paused, sprites = {}) {
    if (ui.cinema) {
      const c = ui.cinema, W2 = canvas.width, H2 = canvas.height, scale = c.scale ?? 2;
      canvas.rect(0, 0, W2, Math.floor(H2 * 0.1), 198419);
      canvas.rect(0, Math.floor(H2 * 0.96), W2, H2, 198419);
      const centered = (line, y, color, size = 1, clip2) => canvas.text(line, Math.floor((W2 - (line.length * 4 - 1) * size) / 2), y, color, size, clip2);
      if (ui.heading) centered(ui.heading, 10, 10283741);
      const clip = { top: Math.floor(H2 * (c.top ?? 0.55)), bottom: Math.floor(H2 * (c.bottom ?? 0.94)) };
      c.lines.forEach((line, i) => {
        const y = Math.floor(clip.bottom - c.offset + i * (c.spacing ?? 18));
        if (y + 5 * scale > clip.top && y < clip.bottom) centered(line, y, 15003369, scale, clip);
      });
      if (ui.prompt) centered(ui.prompt, H2 - 8, 9284536);
      return;
    }
    if (ui.damageDirection && status === "playing" && !paused) {
      const x = ui.damageDirection < 0 ? 4 : canvas.width - 8, y = Math.floor(canvas.height * 0.55);
      canvas.rect(x, y - 13, 4, 26, 15756162);
      canvas.rect(x + (ui.damageDirection < 0 ? 4 : -4), y - 7, 4, 14, 16761223);
    }
    if (ui.map) renderMap(canvas, ui.map);
    if (ui.style === "floating") {
      renderFloatingHud(canvas, ui, status, paused, sprites);
      return;
    }
    if (ui.textScale === 2) {
      renderLargeHud(canvas, ui, status, paused);
      return;
    }
    const W = canvas.width, H = canvas.height;
    const columns = Math.max(1, Math.floor((W - 12) / 4));
    const panelColumns = Math.max(1, Math.floor((W - 48) / 4));
    const width = Math.floor((W - 16) / Math.max(1, ui.meters.length));
    const topHeight = ui.detail ? 25 : ui.meters.length ? 18 : 0;
    if (topHeight) canvas.rect(0, 0, W, topHeight, 725275);
    ui.meters.forEach((m, i) => {
      const x = 6 + i * width;
      canvas.text(`${m.label} ${Math.ceil(m.value)}/${Math.ceil(m.max)}`, x, 3, m.color);
      canvas.rect(x, 11, width - 6, 5, 2569285);
      canvas.rect(x, 11, Math.floor((width - 6) * Math.max(0, Math.min(1, m.value / m.max))), 5, m.color);
    });
    canvas.text(ui.detail.slice(0, columns), 6, 19, 11913694);
    if (ui.objective) {
      canvas.rect(0, topHeight, W, 11, 1515827);
      canvas.text(ui.objective.slice(0, columns), 6, topHeight + 3, 15914378);
    }
    const heading = (status !== "playing" || paused) && ui.heading ? ui.heading.slice(0, Math.max(1, Math.floor((W - 32) / 12))) : "";
    if (heading) {
      canvas.rect(16, 40, W - 32, 26, 725275);
      canvas.text(heading, Math.floor((W - heading.length * 12) / 2), 44, 15914378, 3);
    }
    function renderLargeHud(canvas2, ui2, status2, paused2) {
      const W2 = canvas2.width, H2 = canvas2.height;
      const columns2 = Math.max(1, Math.floor((W2 - 12) / 8));
      const text = (value, x, y, color = 16777215) => canvas2.text(value, x, y, color, 2);
      let top = 0;
      if (ui2.meters.length) {
        const width2 = Math.floor((W2 - 12) / ui2.meters.length);
        canvas2.rect(0, 0, W2, 23, 725275);
        ui2.meters.forEach((meter, i) => {
          const x = 6 + i * width2;
          const label = `${meter.label} ${Math.ceil(meter.value)}/${Math.ceil(meter.max)}`;
          const available = Math.max(1, Math.floor((width2 - 6) / 8));
          const short = `${meter.label.slice(0, 1)} ${Math.ceil(meter.value)}/${Math.ceil(meter.max)}`;
          text((label.length <= available ? label : short).slice(0, available), x, 3, meter.color);
          canvas2.rect(x, 16, width2 - 6, 4, 2569285);
          canvas2.rect(x, 16, Math.floor((width2 - 6) * Math.max(0, Math.min(1, meter.value / meter.max))), 4, meter.color);
        });
        top = 23;
      }
      const strip = (value, color) => {
        if (!value) return;
        const lines = wrapText(value, columns2).slice(0, 2);
        canvas2.rect(0, top, W2, lines.length * 12 + 6, 1515827);
        lines.forEach((line, i) => text(line, 6, top + 3 + i * 12, color));
        top += lines.length * 12 + 6;
      };
      strip(ui2.objective, 15914378);
      if (ui2.heading && (status2 !== "playing" || paused2)) strip(ui2.heading, 15914378);
      if (ui2.meters.length < 3 && !ui2.panel) strip(ui2.detail, 11913694);
      const prompt2 = paused2 && !ui2.heading ? "PAUSED - P TO RESUME" : ui2.prompt;
      const promptLines = wrapText(prompt2, columns2).slice(0, 2);
      const bottom = H2 - promptLines.length * 12 - 6;
      if (ui2.panel) {
        const panel = ui2.panel;
        const rows = Math.max(0, Math.floor((bottom - top - 8) / 12));
        const title = wrapText(panel.title, columns2).slice(0, 1);
        const footer = wrapText(panel.footer, columns2).slice(0, 1);
        const choices = panel.choices.map((choice, i) => `${i === panel.selected ? ">" : " "} ${i + 1} ${choice}`.slice(0, columns2));
        const bodyRows = Math.max(0, rows - title.length - footer.length - choices.length);
        const lines = [...title, ...wrapText(panel.body, columns2).slice(0, bodyRows), ...choices, ...footer].slice(0, rows);
        canvas2.rect(0, top, W2, lines.length * 12 + 8, 725275);
        lines.forEach((line, i) => text(line, 6, top + 4 + i * 12, i === 0 ? 15914378 : 11913694));
      } else {
        const noticeRows = Math.max(0, Math.min(2, Math.floor((bottom - top - 40) / 12)));
        const lines = wrapText(ui2.notice, columns2).slice(0, noticeRows);
        if (lines.length) {
          canvas2.rect(0, top, W2, lines.length * 12 + 6, 1515827);
          lines.forEach((line, i) => text(line, 6, top + 3 + i * 12, 15914378));
        }
        if (status2 === "playing" && !paused2) {
          const x = W2 >> 1, y = H2 >> 1;
          canvas2.rect(x - 3, y, 7, 1, 16777215);
          canvas2.rect(x, y - 3, 1, 7, 16777215);
        }
      }
      canvas2.rect(0, bottom, W2, H2 - bottom, 725275);
      promptLines.forEach((line, i) => text(line, 6, bottom + 3 + i * 12));
    }
    if (ui.notice && !ui.panel) {
      const noticeY = heading ? 70 : 40;
      const lines = wrapText(ui.notice, Math.max(1, Math.floor((W - 32) / 4))).slice(0, 2);
      canvas.rect(12, noticeY, W - 24, lines.length * 8 + 8, 1515827);
      lines.forEach((line, i) => canvas.text(line, 16, noticeY + 4 + i * 8, 15914378));
    }
    if (ui.panel) {
      const p = ui.panel;
      const camp = status !== "playing" || paused;
      const body = wrapText(p.body, panelColumns).slice(0, camp ? 3 : 2);
      const bh = 35 + body.length * 8 + p.choices.length * 12;
      const by = camp ? heading ? 70 : 44 : H - bh - 18;
      canvas.rect(16, by, W - 32, bh, 725275);
      canvas.rect(16, by, W - 32, 2, 15914378);
      canvas.text(p.title.slice(0, panelColumns), 24, by + 7, 15914378);
      body.forEach((line, i) => canvas.text(line, 24, by + 18 + i * 8, 11913694));
      p.choices.forEach((choice, i) => {
        const y = by + 22 + body.length * 8 + i * 12;
        if (i === p.selected) canvas.rect(22, y - 2, W - 44, 10, 3163228);
        canvas.text(`${i === p.selected ? ">" : " "} ${i + 1} ${choice}`.slice(0, panelColumns), 24, y, i === p.selected ? 16777215 : 11913694);
      });
      canvas.text(p.footer.slice(0, panelColumns), 24, by + bh - 8, 8312492);
    } else if (!ui.map) {
      const x = W >> 1, y = H >> 1;
      canvas.rect(x - 3, y, 2, 1, 16777215);
      canvas.rect(x + 2, y, 2, 1, 16777215);
      canvas.rect(x, y - 3, 1, 2, 16777215);
      canvas.rect(x, y + 2, 1, 2, 16777215);
    }
    const prompt = paused && !ui.heading ? "PAUSED - P OR PAUSE BUTTON TO RESUME" : ui.prompt;
    if (prompt) {
      canvas.rect(0, H - 14, W, 14, 725275);
      canvas.text(prompt.slice(0, columns), 6, H - 9, 16777215);
    }
  }
  function renderMap(canvas, map) {
    const width = map.expanded ? canvas.width - 48 : 124, height = map.expanded ? canvas.height - 126 : 67;
    const x = map.expanded ? 24 : canvas.width - width - 8, y = map.expanded ? 91 : 90;
    canvas.rect(x - 3, y - 10, width + 6, height + 15, 726822);
    canvas.text("EXPLORATION MAP", x, y - 7, 10809296);
    const point = (n) => ({ x: x + 8 + n.x * (width - 24) / 100, y: y + 8 + n.y * (height - 24) / 100 });
    for (const link of map.links) {
      const from = map.nodes.find((n) => n.id === link.from), to = map.nodes.find((n) => n.id === link.to);
      if (!from.visited && !to.visited) continue;
      const a = point(from), b = point(to), color = link.shortcut ? 5828565 : from.locked || to.locked ? 9327208 : 4549237;
      if (link.shortcut) {
        for (let px = Math.min(a.x, b.x); px <= Math.max(a.x, b.x); px += 5) canvas.rect(px, a.y, 2, 1, color);
        for (let py = Math.min(a.y, b.y); py <= Math.max(a.y, b.y); py += 5) canvas.rect(b.x, py, 1, 2, color);
      } else {
        canvas.rect(Math.min(a.x, b.x), a.y, Math.abs(b.x - a.x) + 1, 1, color);
        canvas.rect(b.x, Math.min(a.y, b.y), 1, Math.abs(b.y - a.y) + 1, color);
      }
    }
    for (const node of map.nodes) {
      const p = point(node), current = node.id === map.current;
      const color = current ? 5828565 : node.locked ? 15756162 : node.visited ? 7196300 : 5465474;
      canvas.rect(p.x - 3, p.y - 2, 7, 5, color);
      if (current) canvas.rect(p.x - 1, p.y - 1, 3, 3, 16777215);
      if (map.expanded) canvas.text(node.visited || node.locked ? node.label : "???", p.x - 8, p.y + 5, color);
    }
  }

  // src/pixel3d/raycaster.ts
  var packed = (rgb) => (4278190080 | (rgb & 255) << 16 | rgb & 65280 | rgb >>> 16 & 255) >>> 0;
  var FONT = {
    A: "010101111101101",
    B: "110101110101110",
    C: "011100100100011",
    D: "110101101101110",
    E: "111100110100111",
    F: "111100110100100",
    G: "011100101101011",
    H: "101101111101101",
    I: "111010010010111",
    J: "001001001101010",
    K: "101101110101101",
    L: "100100100100111",
    M: "101111111101101",
    N: "101111111111101",
    O: "010101101101010",
    P: "110101110100100",
    Q: "010101101111011",
    R: "110101110101101",
    S: "011100010001110",
    T: "111010010010010",
    U: "101101101101111",
    V: "101101101101010",
    W: "101101111111101",
    X: "101101010101101",
    Y: "101101010010010",
    Z: "111001010100111",
    "0": "111101101101111",
    "1": "010110010010111",
    "2": "110001010100111",
    "3": "110001010001110",
    "4": "101101111001001",
    "5": "111100110001110",
    "6": "011100111101111",
    "7": "111001010010010",
    "8": "111101111101111",
    "9": "111101111001110",
    ":": "000010000010000",
    "-": "000000111000000",
    "!": "010010010000010",
    "%": "101001010100101",
    "[": "011010010010011",
    "]": "110010010010110",
    "/": "001010010010100",
    ".": "000000000000010",
    ",": "000000000010010",
    "?": "110001010000010",
    "|": "010010010010010",
    "+": "000010111010000",
    "_": "000000000000111",
    ">": "100010001010100",
    "<": "001010100010001",
    " ": "000000000000000"
  };
  var Raycaster3D = class {
    constructor(config) {
      this.config = config;
      this.width = config.width;
      this.height = config.height;
      this.fov = config.fov || 66;
      this.buffer = new Uint32Array(this.width * this.height);
      this.zBuffer = new Float64Array(this.width);
      this.pixelDepth = new Float64Array(this.width * this.height);
      this.setMap(config.map);
    }
    setMap(map) {
      const height = map.ceilingHeight ?? 1;
      if (!Number.isFinite(height) || height <= 0.5 || height > 16) {
        throw new Error("Map ceilingHeight must be greater than 0.5 and at most 16 tiles");
      }
      this.config.map = map;
    }
    render(camera, things = [], weapon, flash = 0, stats, wallOverrides = [], time = 0, preparedChunks) {
      const W = this.width;
      const H = this.height;
      const halfH = H >> 1;
      const map = this.config.map;
      const px = camera.x;
      const py = camera.y;
      const ang = camera.angle;
      const pitched = !this.config.world && ((camera.height ?? 0.5) !== 0.5 || (camera.pitch ?? 0) !== 0);
      const freeCamera = pitched || !!this.config.world;
      const dirX = freeCamera ? Math.cos(ang * Math.PI / 180) : fastCos(ang);
      const dirY = freeCamera ? Math.sin(ang * Math.PI / 180) : fastSin(ang);
      const fovScale = Math.tan(this.fov / 2 * Math.PI / 180);
      const planeX = -dirY * fovScale;
      const planeY = dirX * fovScale;
      this.pixelDepth.fill(Infinity);
      if (!this.config.world && things.some((t) => t.model && t.visible !== false)) {
        for (let y = 0; y < H; y++) {
          if (y < halfH && map.sky) continue;
          const planeHeight = y < halfH ? (map.ceilingHeight ?? 1) - 0.5 : 0.5;
          const distance = planeHeight * H / Math.abs(halfH - y - 0.5);
          this.pixelDepth.fill(distance, y * W, (y + 1) * W);
        }
      }
      if (this.config.world) {
        renderVoxels(
          this.config.world,
          camera,
          this.config.textures,
          map.sky,
          this.fov,
          W,
          H,
          this.buffer,
          this.pixelDepth,
          time,
          preparedChunks
        );
        this.zBuffer.fill(Infinity);
      } else if (pitched) {
        renderGrid(
          map,
          camera,
          Object.values(this.config.textures),
          wallOverrides,
          things,
          this.config.sprites,
          this.fov,
          W,
          H,
          this.buffer,
          this.pixelDepth,
          time
        );
        this.zBuffer.fill(Infinity);
      } else {
        this.renderFloorAndCeiling(px, py, dirX, dirY, planeX, planeY, time);
        this.renderWalls(px, py, dirX, dirY, planeX, planeY, wallOverrides);
      }
      for (const thing of things) {
        if (thing.visible === false || !thing.model) continue;
        const model = this.config.models?.[thing.model];
        if (!model) throw new Error(`Unknown pixel-3d model: ${thing.model}`);
        const modelCamera = this.config.world ? { ...camera, height: (camera.z ?? 0) + 1.25 } : camera;
        renderModel(model, thing, modelCamera, dirX, dirY, fovScale, W, H, this.buffer, this.pixelDepth);
      }
      if (!this.config.world && !pitched && things && things.length > 0) {
        this.renderThings(px, py, dirX, dirY, planeX, planeY, things);
      }
      this.renderWorldTitles(camera, things, dirX, dirY, fovScale);
      if (weapon && weapon.sprite) {
        this.renderWeapon(weapon);
      }
      if (flash > 0) {
        this.applyFlash(flash);
      }
      const fade = stats?.ui?.cinema?.fade ?? 0;
      if (fade > 0) {
        const light = 1 - Math.min(1, fade);
        for (let i = 0; i < this.buffer.length; i++) {
          const c = this.buffer[i];
          this.buffer[i] = (4278190080 | Math.floor((c & 255) * light) | Math.floor((c >>> 8 & 255) * light) << 8 | Math.floor((c >>> 16 & 255) * light) << 16) >>> 0;
        }
      }
      if (stats) {
        this.renderHUD(stats);
      }
      return this.buffer;
    }
    /** Pixel-font plaques anchored above actors, using the same projection/depth as models. */
    renderWorldTitles(camera, things, dirX, dirY, fov) {
      const eye = this.config.world ? (camera.z ?? 0) + 1.25 : camera.height ?? 0.5;
      const pitch = (camera.pitch ?? 0) * Math.PI / 180, cp = Math.cos(pitch), sp = Math.sin(pitch);
      const labels = [];
      for (const thing of things) {
        if (thing.visible === false || thing.title === void 0 || (thing.dissolve ?? 0) >= 1) continue;
        if (typeof thing.title !== "string" || !/^([\x20-\x7e]){1,48}$/.test(thing.title)) throw new Error("Thing title must contain 1-48 printable characters");
        if (thing.titleHeight !== void 0 && (!Number.isFinite(thing.titleHeight) || thing.titleHeight < 0 || thing.titleHeight > 64)) throw new Error("Thing titleHeight must be in [0, 64]");
        if (thing.titleColor !== void 0 && (!Number.isInteger(thing.titleColor) || thing.titleColor < 0 || thing.titleColor > 16777215)) throw new Error("Thing titleColor must be an RGB integer");
        if (![thing.x, thing.y, thing.z ?? 0, thing.scale ?? 1].every(Number.isFinite) || (thing.scale ?? 1) <= 0) throw new Error("Titled thing position and scale must be finite and scale positive");
        let height = 1;
        for (const block of this.config.models?.[thing.model ?? ""]?.blocks ?? []) height = Math.max(height, block.from[2] + block.size[2]);
        const z = (thing.z ?? 0) + (thing.titleHeight ?? height * (thing.scale ?? 1) + 0.4);
        const dx = thing.x - camera.x, dy = thing.y - camera.y, forward = dx * dirX + dy * dirY;
        const distance = forward * cp + (z - eye) * sp, side = -dx * dirY + dy * dirX, up = (z - eye) * cp - forward * sp;
        if (distance <= 0.1 || distance > 48) continue;
        const width = thing.title.length * 4 - 1, x = Math.round(this.width / 2 * (1 + side / (distance * fov)) - width / 2);
        const y = Math.round((this.height >> 1) - up * this.height / distance) - 5;
        if (x + width + 3 < 0 || x - 3 >= this.width || y + 7 < 0 || y - 2 >= this.height) continue;
        labels.push({ text: thing.title.toUpperCase(), x, y, distance, color: thing.titleColor ?? 10283741 });
      }
      labels.sort((a, b) => b.distance - a.distance);
      for (const label of labels) {
        const width = label.text.length * 4 - 1;
        const pixel = (x, y, color) => {
          if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
            const i = y * this.width + x;
            if (label.distance < this.pixelDepth[i]) this.buffer[i] = packed(color);
          }
        };
        for (let y = -2; y < 7; y++) for (let x = -3; x < width + 3; x++) pixel(label.x + x, label.y + y, y === 6 ? 2646380 : 727844);
        for (let c = 0; c < label.text.length; c++) {
          const glyph = FONT[label.text[c]];
          if (!glyph) continue;
          for (let i = 0; i < glyph.length; i++) if (glyph[i] === "1") pixel(label.x + c * 4 + i % 3, label.y + Math.floor(i / 3), label.color);
        }
      }
    }
    rect(x, y, width, height, color) {
      const c = packed(color);
      const left = Math.min(this.width, Math.max(0, Math.floor(x)));
      const top = Math.max(0, Math.floor(y));
      const right = Math.min(this.width, Math.floor(x + width));
      const bottom = Math.min(this.height, Math.floor(y + height));
      for (let row = top; row < bottom; row++) {
        this.buffer.fill(c, row * this.width + left, row * this.width + Math.max(left, right));
      }
    }
    text(str, x, y, color = 16116172, scale = 1, clip) {
      let curX = Math.floor(x);
      const curY = Math.floor(y);
      for (const char of str.toUpperCase()) {
        const glyph = FONT[char];
        if (glyph) {
          for (let p = 0; p < glyph.length; p++) {
            if (glyph[p] === "1") {
              const y2 = curY + Math.floor(p / 3) * scale, top = Math.max(y2, clip?.top ?? y2), bottom = Math.min(y2 + scale, clip?.bottom ?? y2 + scale);
              if (bottom > top) this.rect(curX + p % 3 * scale, top, scale, bottom - top, color);
            }
          }
        }
        curX += 4 * scale;
      }
    }
    renderHUD(stats) {
      const W = this.width;
      const H = this.height;
      if (stats.titleScene) {
        const title = stats.titleScene;
        const scale = Math.max(1, Math.min(4, Math.floor((W - 32) / (title.heading.length * 4))));
        const left = Math.floor((W - (title.heading.length * 4 - 1) * scale) / 2);
        const top = Math.floor(H * 0.18);
        const pulse = 0.6 + 0.4 * Math.sin((stats.presentationTime ?? 0) * 2);
        for (const [radius, color] of [[3, 1060157], [2, 1594219], [1, 3316907]]) {
          for (const [ox, oy] of [[-radius, 0], [radius, 0], [0, -radius], [0, radius]]) {
            this.text(title.heading, left + ox, top + oy, color, scale);
          }
        }
        const channel = Math.floor(205 + 50 * pulse);
        this.text(title.heading, left, top, channel << 16 | 65535, scale);
        const centered = (text, y, color) => this.text(
          text,
          Math.max(4, Math.floor((W - text.length * 4) / 2)),
          y,
          color
        );
        centered(title.subtitle, top + 5 * scale + 12, 10340050);
        this.rect(0, H - 23, W, 23, 528152);
        centered(title.prompt, H - 15, 10873068);
        return;
      }
      if (stats.ui) {
        renderHud(this, stats.ui, stats.status || "playing", stats.paused || false, this.config.sprites);
        return;
      }
      if (stats.presentation) {
        const p = stats.presentation;
        this.rect(0, 0, W, 10, 658446);
        this.text(stats.hudText || p.title, 6, 2, 16174148);
        if (stats.status !== "playing") {
          const bx = 18, by = 24;
          this.rect(bx, by, W - 36, H - 48, 1053212);
          this.rect(bx, by, W - 36, 2, 11703392);
          const title = stats.status === "won" ? p.victory : stats.status === "gameover" ? p.defeat : p.title;
          this.text(title, bx + 12, by + 14, 16174148, 2);
          this.text(p.subtitle, bx + 12, by + 34, 10532551);
          p.instructions.forEach((line, i) => this.text(line, bx + 12, by + 52 + i * 13, 14999764));
          this.text("ENTER / CLICK: BEGIN A NEW RUN", bx + 12, H - 44, 6728260);
        }
        const message = stats.message || p.objective;
        this.rect(0, H - 12, W, 12, 658446);
        this.text(message, 6, H - 9, 14999764);
        return;
      }
      if (stats.status === "title") {
        const bw = 280;
        const bh = 160;
        const bx = Math.floor((W - bw) / 2);
        const by = Math.floor((H - bh) / 2);
        this.rect(bx, by, bw, bh, 461842);
        this.rect(bx, by, bw, 2, 4029066);
        this.rect(bx, by + bh - 2, bw, 2, 4029066);
        this.rect(bx, by, 2, bh, 4029066);
        this.rect(bx + bw - 2, by, 2, bh, 4029066);
        this.text("VECT BREACH", bx + 36, by + 16, 16174148, 3);
        this.text("CYBERNETIC SECTOR INFILTRATION", bx + 28, by + 46, 8952234, 1);
        this.rect(bx + 20, by + 60, bw - 40, 1, 2241348);
        this.text("WASD: MOVE / STRAFE       MOUSE: AIM", bx + 22, by + 72, 13932834, 1);
        this.text("SPACE / L-CLICK: FIRE     E: USE SWITCH", bx + 22, by + 86, 13932834, 1);
        this.text("PURGE GUARDS - UNLOCK ELEVATORS - SURVIVE", bx + 16, by + 102, 5596791, 1);
        this.rect(bx + 20, by + 118, bw - 40, 1, 2241348);
        this.text("PRESS ENTER OR CLICK TO BEGIN MISSION", bx + 18, by + 132, 6728260, 1);
        return;
      }
      if (stats.status === "story") {
        const bw = 284;
        const bh = 164;
        const bx = Math.floor((W - bw) / 2);
        const by = Math.floor((H - bh) / 2);
        this.rect(bx, by, bw, bh, 397578);
        this.rect(bx, by, bw, 2, 4500019);
        this.rect(bx, by + bh - 2, bw, 2, 4500019);
        this.rect(bx, by, 2, bh, 4500019);
        this.rect(bx + bw - 2, by, 2, bh, 4500019);
        this.text("// HIGH COMMAND TRANSMISSION //", bx + 28, by + 12, 16174148, 1);
        this.text(stats.levelTitle || stats.storyTitle || "SECTOR BRIEFING", bx + 28, by + 26, 6728260, 1);
        this.rect(bx + 16, by + 38, bw - 32, 1, 1785893);
        const body = stats.storyBody || "";
        const lines = body.split("|");
        let textY = by + 48;
        for (const line of lines) {
          if (line.trim().length > 0) {
            this.text(line.trim(), bx + 20, textY, 14999764, 1);
            textY += 14;
          }
        }
        this.rect(bx + 16, by + 124, bw - 32, 1, 1785893);
        this.text("OBJECTIVE: LOCATE TERMINAL SWITCH & EXTRACT", bx + 18, by + 132, 13932834, 1);
        this.text("PRESS ENTER OR CLICK TO ENGAGE", bx + 42, by + 146, 6728260, 1);
        return;
      }
      this.rect(0, 0, W, 9, 658446);
      const hp = stats.health ?? 100;
      const hpColor = hp > 30 ? 6728260 : 14496546;
      this.text(`SEC 0${stats.level ?? 1}`, 6, 2, 8952234);
      this.text(`HP: ${hp}%`, 54, 2, hpColor);
      this.text(`AMMO: ${stats.ammo ?? 24}`, 114, 2, 16174148);
      this.text(`KILLS: ${stats.kills ?? 0}`, 174, 2, 8952234);
      this.text(`SCORE: ${stats.score ?? 0}`, 230, 2, 14999764);
      if (stats.switchActivated) {
        this.text("OVR", 296, 2, 6728260);
      }
      if (stats.heading !== void 0) {
        const directions = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
        const direction = directions[Math.floor(((stats.heading % 360 + 360) % 360 + 22.5) / 45) % 8];
        this.rect(W - 48, 11, 46, 9, 658446);
        this.text(`FACING ${direction}`, W - 45, 13, 16174148);
      }
      if (stats.message && stats.message.length > 0) {
        const msgW = Math.min(W - 20, stats.message.length * 4 + 16);
        const msgX = Math.floor((W - msgW) / 2);
        this.rect(msgX, H - 24, msgW, 12, 658446);
        this.rect(msgX, H - 24, msgW, 1, 13932834);
        this.text(stats.message, msgX + 8, H - 21, 16174148, 1);
      }
      if (stats.status === "won") {
        const bw = 250;
        const bh = 68;
        const bx = Math.floor((W - bw) / 2);
        const by = Math.floor((H - bh) / 2) - 10;
        this.rect(bx, by, bw, bh, 660493);
        this.rect(bx, by, bw, 2, 6728260);
        this.rect(bx, by + bh - 2, bw, 2, 6728260);
        this.rect(bx, by, 2, bh, 6728260);
        this.rect(bx + bw - 2, by, 2, bh, 6728260);
        this.text("MISSION ACCOMPLISHED", bx + 26, by + 10, 16174148, 2);
        this.text("ALL 3 SECTORS SECURED // SYSTEM PURGED", bx + 16, by + 28, 6728260, 1);
        this.text(`FINAL SCORE: ${stats.score ?? 0}  |  KILLS: ${stats.kills ?? 0}`, bx + 36, by + 40, 8952234, 1);
        this.text("PRESS FIRE, CLICK OR ENTER TO REPLAY", bx + 20, by + 54, 14999764, 1);
      }
      if (stats.status === "gameover") {
        const bw = 240;
        const bh = 60;
        const bx = Math.floor((W - bw) / 2);
        const by = Math.floor((H - bh) / 2) - 10;
        this.rect(bx, by, bw, bh, 2034186);
        this.rect(bx, by, bw, 2, 14496546);
        this.rect(bx, by + bh - 2, bw, 2, 14496546);
        this.rect(bx, by, 2, bh, 14496546);
        this.rect(bx + bw - 2, by, 2, bh, 14496546);
        this.text("AGENT TERMINATED", bx + 38, by + 10, 14496546, 2);
        this.text("CRITICAL VITALS LOST // SIGNAL LOST", bx + 30, by + 28, 14496546, 1);
        this.text("PRESS FIRE, CLICK OR ENTER TO RETRY", bx + 14, by + 44, 16174148, 1);
      }
    }
    renderFloorAndCeiling(px, py, dirX, dirY, planeX, planeY, time) {
      const W = this.width;
      const H = this.height;
      const halfH = H >> 1;
      const map = this.config.map;
      const floorIsTex = typeof map.floor === "object" && map.floor !== null;
      const ceilIsTex = typeof map.ceiling === "object" && map.ceiling !== null;
      const floorColor = !floorIsTex ? typeof map.floor === "number" ? (map.floor & 4278190080) === 0 ? (4278190080 | map.floor) >>> 0 : map.floor >>> 0 : 4281545523 : 0;
      const ceilColor = !ceilIsTex ? typeof map.ceiling === "number" ? (map.ceiling & 4278190080) === 0 ? (4278190080 | map.ceiling) >>> 0 : map.ceiling >>> 0 : 4279900698 : 0;
      if (!floorIsTex && !ceilIsTex && !map.sky) {
        for (let y = 0; y < halfH; y++) {
          this.buffer.fill(ceilColor, y * W, (y + 1) * W);
        }
        for (let y = halfH; y < H; y++) {
          this.buffer.fill(floorColor, y * W, (y + 1) * W);
        }
        return;
      }
      const floorTex = floorIsTex ? map.floor : null;
      const ceilTex = ceilIsTex ? map.ceiling : null;
      this.buffer.fill(ceilColor, 0, halfH * W);
      this.buffer.fill(floorColor, halfH * W);
      if (map.sky) {
        for (let x = 0; x < W; x++) {
          const cx = 2 * x / W - 1;
          const longitude = Math.atan2(dirY + planeY * cx, dirX + planeX * cx);
          for (let y = 0; y < halfH; y++) {
            this.buffer[y * W + x] = skyPixel(map.sky, longitude, (halfH - y) / halfH, time);
          }
        }
      }
      for (let y = halfH; y < H; y++) {
        const p = y - halfH + 0.5;
        const posZ = 0.5 * H;
        const rowDistance = posZ / p;
        const rowFloorIdx = y * W;
        const rowCeilIdx = (H - y - 1) * W;
        for (let x = 0; x < W; x++) {
          const cx = 2 * x / W - 1;
          const floorX = px + rowDistance * (dirX + planeX * cx);
          const floorY = py + rowDistance * (dirY + planeY * cx);
          if (floorTex) {
            const tx = Math.floor(floorX * floorTex.width) & floorTex.width - 1;
            const ty = Math.floor(floorY * floorTex.height) & floorTex.height - 1;
            this.buffer[rowFloorIdx + x] = floorTex.pixels[ty * floorTex.width + tx];
          } else {
            this.buffer[rowFloorIdx + x] = floorColor;
          }
          if (!map.sky && ceilTex) {
            const ceilingDistance = ((map.ceilingHeight ?? 1) - 0.5) * H / p;
            const ceilingX = px + ceilingDistance * (dirX + planeX * cx);
            const ceilingY = py + ceilingDistance * (dirY + planeY * cx);
            const tx = Math.floor(ceilingX * ceilTex.width) & ceilTex.width - 1;
            const ty = Math.floor(ceilingY * ceilTex.height) & ceilTex.height - 1;
            this.buffer[rowCeilIdx + x] = ceilTex.pixels[ty * ceilTex.width + tx];
          } else if (!map.sky) {
            this.buffer[rowCeilIdx + x] = ceilColor;
          }
        }
      }
    }
    renderWalls(px, py, dirX, dirY, planeX, planeY, wallOverrides) {
      const W = this.width;
      const H = this.height;
      const halfH = H >> 1;
      const map = this.config.map;
      const textureList = Object.values(this.config.textures);
      for (let x = 0; x < W; x++) {
        const cameraX = 2 * x / W - 1;
        const rayDirX = dirX + planeX * cameraX;
        const rayDirY = dirY + planeY * cameraX;
        let mapX = Math.floor(px);
        let mapY = Math.floor(py);
        const deltaDistX = Math.abs(1 / (rayDirX === 0 ? 1e-6 : rayDirX));
        const deltaDistY = Math.abs(1 / (rayDirY === 0 ? 1e-6 : rayDirY));
        let stepX;
        let stepY;
        let sideDistX;
        let sideDistY;
        if (rayDirX < 0) {
          stepX = -1;
          sideDistX = (px - mapX) * deltaDistX;
        } else {
          stepX = 1;
          sideDistX = (mapX + 1 - px) * deltaDistX;
        }
        if (rayDirY < 0) {
          stepY = -1;
          sideDistY = (py - mapY) * deltaDistY;
        } else {
          stepY = 1;
          sideDistY = (mapY + 1 - py) * deltaDistY;
        }
        let hit = 0;
        let side = 0;
        while (hit === 0) {
          if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
          } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
          }
          if (mapX < 0 || mapX >= map.width || mapY < 0 || mapY >= map.height) {
            hit = 1;
            break;
          }
          const cell = map.grid[mapY * map.width + mapX];
          if (cell > 0) {
            hit = cell;
          }
        }
        let perpWallDist;
        if (side === 0) {
          perpWallDist = sideDistX - deltaDistX;
        } else {
          perpWallDist = sideDistY - deltaDistY;
        }
        if (perpWallDist < 1e-3) perpWallDist = 1e-3;
        this.zBuffer[x] = perpWallDist;
        const lineHeight = Math.floor(H / perpWallDist);
        const drawStart = Math.max(0, Math.floor(-lineHeight * ((map.ceilingHeight ?? 1) - 0.5) + halfH));
        const drawEnd = Math.min(H - 1, Math.floor(lineHeight / 2 + halfH));
        const override = wallOverrides.find((tile) => tile.x === mapX && tile.y === mapY);
        const tex = (override ? textureList[override.texture] : void 0) || textureList[(hit - 1) % textureList.length] || textureList[0];
        if (!tex) continue;
        let wallX;
        if (side === 0) {
          wallX = py + perpWallDist * rayDirY;
        } else {
          wallX = px + perpWallDist * rayDirX;
        }
        wallX -= Math.floor(wallX);
        let texX = Math.floor(wallX * tex.width);
        if (side === 0 && rayDirX > 0) texX = tex.width - texX - 1;
        if (side === 1 && rayDirY < 0) texX = tex.width - texX - 1;
        texX = Math.max(0, Math.min(tex.width - 1, texX));
        const step = tex.height / lineHeight;
        const originalStart = Math.max(0, Math.floor(-lineHeight / 2 + halfH));
        let texPos = (drawStart - halfH + lineHeight / 2) * step;
        for (let y = drawStart; y <= drawEnd; y++) {
          if (y === originalStart) texPos = (originalStart - halfH + lineHeight / 2) * step;
          const texY = y < originalStart ? (Math.floor(texPos) % tex.height + tex.height) % tex.height : Math.min(tex.height - 1, Math.max(0, Math.floor(texPos)));
          texPos += step;
          let color = tex.pixels[texY * tex.width + texX] ?? 4278190080;
          if (side === 1) {
            const r = Math.floor((color & 255) * 0.75);
            const g = Math.floor((color >> 8 & 255) * 0.75);
            const b = Math.floor((color >> 16 & 255) * 0.75);
            color = (4278190080 | b << 16 | g << 8 | r) >>> 0;
          }
          this.buffer[y * W + x] = color;
          this.pixelDepth[y * W + x] = perpWallDist;
        }
      }
    }
    renderThings(px, py, dirX, dirY, planeX, planeY, things) {
      const W = this.width;
      const H = this.height;
      const halfH = H >> 1;
      const sorted = things.filter((t) => t.visible !== false).map((t) => ({
        ...t,
        dist: (px - t.x) * (px - t.x) + (py - t.y) * (py - t.y)
      })).sort((a, b) => b.dist - a.dist);
      const invDet = 1 / (planeX * dirY - dirX * planeY);
      for (const thing of sorted) {
        if (thing.model || !thing.sprite) continue;
        const sprite = this.config.sprites[thing.sprite];
        if (!sprite) continue;
        const spriteX = thing.x - px;
        const spriteY = thing.y - py;
        const transformX = invDet * (dirY * spriteX - dirX * spriteY);
        const transformY = invDet * (-planeY * spriteX + planeX * spriteY);
        if (transformY <= 0.1) continue;
        const spriteScreenX = Math.floor(W / 2 * (1 + transformX / transformY));
        const scale = thing.scale || 1;
        const spriteH = Math.abs(Math.floor(H / transformY * scale));
        const spriteW = Math.abs(Math.floor(H / transformY * scale * (sprite.width / sprite.height)));
        const drawStartY = Math.max(0, Math.floor(-spriteH / 2 + halfH));
        const drawEndY = Math.min(H - 1, Math.floor(spriteH / 2 + halfH));
        const drawStartX = Math.max(0, Math.floor(-spriteW / 2 + spriteScreenX));
        const drawEndX = Math.min(W - 1, Math.floor(spriteW / 2 + spriteScreenX));
        for (let stripe = drawStartX; stripe <= drawEndX; stripe++) {
          if (transformY < this.zBuffer[stripe]) {
            const texX = Math.floor((stripe - (-spriteW / 2 + spriteScreenX)) * sprite.width / spriteW);
            if (texX < 0 || texX >= sprite.width) continue;
            for (let y = drawStartY; y <= drawEndY; y++) {
              const d = y - halfH + spriteH / 2;
              const texY = Math.floor(d * sprite.height / spriteH);
              if (texY < 0 || texY >= sprite.height) continue;
              const colorIdx = sprite.pixels[texY * sprite.width + texX];
              const color = sprite.colors[colorIdx];
              if (color !== null && color !== void 0 && transformY < this.pixelDepth[y * W + stripe]) {
                this.buffer[y * W + stripe] = packed(color);
              }
            }
          }
        }
      }
    }
    renderWeapon(weapon) {
      const sprite = this.config.sprites[weapon.sprite];
      if (!sprite) return;
      const W = this.width;
      const H = this.height;
      const scale = 2.5;
      const renderW = Math.floor(sprite.width * scale);
      const renderH = Math.floor(sprite.height * scale);
      const bobOffset = weapon.bob ? Math.sin(weapon.bob) * 4 : 0;
      const startX = Math.floor(W / 2 - renderW / 2 + (weapon.x || 0));
      const startY = Math.floor(H - renderH + (weapon.y || 0) + bobOffset);
      for (let sy = 0; sy < renderH; sy++) {
        const destY = startY + sy;
        if (destY < 0 || destY >= H) continue;
        const texY = Math.floor(sy * sprite.height / renderH);
        for (let sx = 0; sx < renderW; sx++) {
          const destX = startX + sx;
          if (destX < 0 || destX >= W) continue;
          const texX = Math.floor(sx * sprite.width / renderW);
          const colorIdx = sprite.pixels[texY * sprite.width + texX];
          const color = sprite.colors[colorIdx];
          if (color !== null && color !== void 0) {
            this.buffer[destY * W + destX] = packed(color);
          }
        }
      }
    }
    applyFlash(amount) {
      const intensity = Math.min(1, amount * 0.12);
      const W = this.width;
      const H = this.height;
      for (let i = 0; i < W * H; i++) {
        const c = this.buffer[i];
        let r = c & 255;
        let g = c >> 8 & 255;
        let b = c >> 16 & 255;
        r = Math.min(255, r + Math.floor(180 * intensity));
        g = Math.max(0, g - Math.floor(50 * intensity));
        b = Math.max(0, b - Math.floor(50 * intensity));
        this.buffer[i] = (4278190080 | b << 16 | g << 8 | r) >>> 0;
      }
    }
  };

  // src/pixel3d/camera.ts
  function sampleCamera(track, seconds) {
    const points = track.points, n = points.length;
    const progress = track.loop ? (seconds / track.duration % 1 + 1) % 1 : Math.max(0, Math.min(1, seconds / track.duration));
    const at = progress * (track.loop ? n : n - 1);
    const segment = Math.min(Math.floor(at), track.loop ? n - 1 : n - 2), t = at - segment;
    const point = (i) => points[track.loop ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    const result = {};
    for (const key of ["x", "y", "height", "angle", "pitch"]) {
      const values = [-1, 0, 1, 2].map((i) => point(segment + i)[key] ?? (key === "height" ? 0.5 : 0));
      if (key === "angle") {
        for (let i = 1; i < 4; i++) values[i] = values[i - 1] + ((values[i] - values[i - 1] + 540) % 360 + 360) % 360 - 180;
      }
      const [a, b, c, d] = values;
      result[key] = 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    }
    result.height = Math.max(0.05, result.height);
    result.pitch = Math.max(-85, Math.min(85, result.pitch));
    return result;
  }

  // src/pixel3d/engine.ts
  var Pixel3DEngine = class {
    constructor(config, options) {
      this.config = config;
      this._paused = false;
      this._muted = false;
      this.frameRevision = 0;
      this.presentedRevision = -1;
      this.ticks = 0;
      this.presentationTicks = 0;
      this.wasTitle = false;
      this.currentMapName = "";
      this.modelRadius = 0;
      if (config.renderRadius !== void 0 && (!Number.isFinite(config.renderRadius) || config.renderRadius <= 0 || config.renderRadius > 4096)) throw new Error("renderRadius must be in (0, 4096]");
      for (const model of Object.values(config.models ?? {})) for (const block of model.blocks) {
        this.modelRadius = Math.max(this.modelRadius, Math.hypot(...block.from.map((v, i) => Math.max(Math.abs(v), Math.abs(v + block.size[i])))));
      }
      for (const sprite of Object.values(config.sprites)) this.modelRadius = Math.max(this.modelRadius, Math.hypot(sprite.width / sprite.height / 2, 0.5));
      if (typeof window === "undefined") {
        Object.assign(globalThis, { window: globalThis });
      }
      this.raycaster = new Raycaster3D({
        fov: config.fov,
        width: config.width,
        height: config.height,
        textures: config.textures,
        sprites: config.sprites,
        models: config.models,
        map: config.map
      });
      Object.assign(globalThis, { __RuneSpatialMaps: config.maps || {} });
      const spatialMap = {
        width: config.map.width,
        height: config.map.height,
        grid: config.map.grid
      };
      setActiveMap(spatialMap);
      this.app = createLogicApp(function() {
        this.computeDerived();
      });
      this.context = {
        ...options,
        app: this.app,
        isRendering: false,
        compactScopes: true,
        memorySubscriptions: {},
        initialState: JSON.parse(JSON.stringify(options.stateJson)),
        loadedChunks: {},
        loadingChunks: {},
        navigator: null
      };
      this.app.state = JSON.parse(JSON.stringify(options.stateJson));
      if (config.controls) this.controls = new GameControls(config.controls, this);
      configureAudioHost({
        syncPage: false,
        deferPlayback: typeof document !== "undefined"
      });
      registerSounds(options.sounds);
      registerMusic(options.music);
      if (config.persistence) {
        this.save = new GameSave(config.persistence);
        this.app.state[config.persistence.state] = this.save.load(
          this.app.state[config.persistence.state]
        );
      }
      withContext(this.context, () => {
        if (options.actionDefinitions.initialize) {
          this.app.invokeAction("initialize", []);
        }
        this.app.computeDerived();
      });
      this.syncScene();
      this.persist();
    }
    /** Hosts can reuse the last pixels between simulation ticks. */
    invalidateFrame() {
      this.frameRevision++;
    }
    frameIfChanged() {
      if (this.presentedRevision === this.frameRevision) return null;
      const pixels = this.frame();
      this.presentedRevision = this.frameRevision;
      return pixels;
    }
    get paused() {
      return this._paused;
    }
    set paused(value) {
      if (value === this._paused) return;
      this._paused = value;
      this.invalidateFrame();
      if (value) pauseMusic();
      setAudioMuted(this._muted || value);
      if (!value) resumeMusic();
    }
    get muted() {
      return this._muted;
    }
    set muted(value) {
      this._muted = value;
      setAudioMuted(value || this._paused);
    }
    get audioState() {
      return audioSync.getSnapshot();
    }
    /** The desktop host shares this renderer for features beyond its fixed-eye rasterizer. */
    get usesSharedRenderer() {
      if (this.config.ui && this.app.state[this.config.ui]?.map) return true;
      if (this.config.pauseUi && this.app.state[this.config.pauseUi]?.map) return true;
      if (this.config.world || this.config.cameraTrack || this.config.titleScene && this.app.state.status === "title" || this.config.fov !== void 0 && this.config.fov !== 66) return true;
      const camera = this.config.camera.split(".").reduce((v, key) => v?.[key], this.app.state);
      return !!camera && ((camera.height ?? 0.5) !== 0.5 || (camera.pitch ?? 0) !== 0);
    }
    get saveStatus() {
      return this.save?.status;
    }
    start() {
      this.invalidateFrame();
      stopMusic();
      this._paused = false;
      setAudioMuted(this._muted);
      this.ticks = 0;
      this.presentationTicks = 0;
      withContext(this.context, () => {
        this.app.invokeAction("start", []);
        this.app.computeDerived();
      });
      this.syncScene();
      this.persist();
    }
    step(input = {}) {
      if (input.start) {
        this.start();
        return;
      }
      if (this.paused) return;
      this.invalidateFrame();
      withContext(this.context, () => withEntityQueries(() => {
        this.app.invokeAction("tick", [input]);
        this.app.computeDerived();
      }));
      this.ticks++;
      this.syncScene();
      if (this.wasTitle) this.presentationTicks++;
      this.persist();
    }
    syncScene() {
      const state = this.app.state;
      const title = state.status === "title";
      if (title && !this.wasTitle) this.presentationTicks = 0;
      this.wasTitle = title;
      if (state.level_map && state.level_map !== this.currentMapName && this.config.maps?.[state.level_map]) {
        this.currentMapName = state.level_map;
        const newMap = this.config.maps[state.level_map];
        this.raycaster.setMap(newMap);
        setActiveMap({
          width: newMap.width,
          height: newMap.height,
          grid: newMap.grid
        });
      }
    }
    persist() {
      if (this.save) this.save.flush(this.app.state[this.save.config.state]);
    }
    invoke(action, args = []) {
      this.invalidateFrame();
      if (action === this.config.restartAction) {
        if (this.app.state.status === "playing" && !this.paused) return;
        this.paused = false;
        this.ticks = 0;
      }
      if (action === "start") {
        this.start();
        return;
      }
      setAudioMuted(this._muted || this._paused);
      withContext(this.context, () => {
        this.app.invokeAction(action, args);
        this.app.computeDerived();
      });
      if (this._paused) pauseMusic();
      this.syncScene();
      this.persist();
    }
    activate(action, args = []) {
      if (this.config.menuSounds?.confirm) {
        playSound(this.config.menuSounds.confirm);
      }
      this.invoke(action, args);
    }
    renderState() {
      const state = this.app.state;
      const titleScene = state.status === "title" ? this.config.titleScene : void 0;
      this.raycaster.config.world = !titleScene && this.config.world ? validateWorld(state[this.config.world]) : void 0;
      this.raycaster.setMap(titleScene?.map ?? (this.config.maps?.[this.currentMapName] || this.config.map));
      this.raycaster.fov = titleScene?.fov ?? this.config.fov ?? 66;
      const presentationTime = this.presentationTicks / this.config.tickRate;
      const camVal = this.config.camera.split(".").reduce((v, k) => v?.[k], state);
      const track = titleScene?.camera ?? this.config.cameraTrack;
      const camera = track ? sampleCamera(track, titleScene ? presentationTime : this.ticks / this.config.tickRate) : camVal || { x: 2.5, y: 2.5, angle: 0 };
      let things = [];
      const radius = this.config.renderRadius ?? this.raycaster.config.world?.renderDistance;
      const origin = { x: camera.x, y: camera.y, z: camera.z ?? camera.height ?? 0 };
      const thingPaths = titleScene?.things ?? this.config.things;
      if (thingPaths) {
        for (const path of thingPaths) {
          const val = path.split(".").reduce((v, k) => v?.[k], state);
          if (Array.isArray(val)) {
            const local = radius === void 0 ? val : nearbyForRender(val, origin, radius + 2, this.modelRadius);
            for (const thing of local) things.push(thing);
          } else if (val && typeof val === "object" && typeof val.x === "number" && typeof val.y === "number" && (typeof val.sprite === "string" || typeof val.model === "string")) {
            if (radius === void 0 || Math.hypot(val.x - origin.x, val.y - origin.y, (val.z ?? 0) - origin.z) <= radius + 2 + this.modelRadius * (val.scale ?? 1)) things.push(val);
          }
        }
      }
      for (const thing of things) {
        if (!titleScene && this.config.world && thing.sprite && thing.visible !== false) {
          throw new Error("Voxel world entities must use block models rather than billboard sprites");
        }
        if (!thing.model || thing.visible === false) continue;
        if (!this.config.models?.[thing.model]) throw new Error(`Unknown pixel-3d model: ${thing.model}`);
        if (thing.sprite) throw new Error("Pixel-3d things must use either model or sprite, not both");
        if (!Number.isFinite(thing.dissolve ?? 0) || (thing.dissolve ?? 0) < 0 || (thing.dissolve ?? 0) > 1) {
          throw new Error("Pixel-3d model dissolve must be between 0 and 1");
        }
        if (![thing.x, thing.y, thing.z ?? 0, thing.angle ?? 0, thing.scale ?? 1].every(Number.isFinite) || (thing.scale ?? 1) <= 0) throw new Error("Pixel-3d model position/angle must be finite and scale must be positive");
      }
      let weapon = void 0;
      if (this.config.weapon) {
        weapon = this.config.weapon.split(".").reduce((v, k) => v?.[k], state);
      }
      const flash = Number(state.flash || 0);
      const status = String(state.status || "ready");
      const health = Number(state.health ?? 100);
      const ammo = Number(state.ammo ?? 24);
      const score = Number(state.score ?? 0);
      const kills = Number(state.kills ?? 0);
      const level = Number(state.level ?? 1);
      const level_map = state.level_map ? String(state.level_map) : void 0;
      const level_title = state.level_title ? String(state.level_title) : void 0;
      const story_title = state.story_title ? String(state.story_title) : void 0;
      const story_body = state.story_body ? String(state.story_body) : void 0;
      const message = state.message ? String(state.message) : void 0;
      const switch_activated = Boolean(state.switch_activated);
      return {
        title_scene: titleScene,
        presentation_time: presentationTime,
        camera,
        things,
        weapon: titleScene ? void 0 : weapon,
        flash: titleScene ? 0 : flash,
        status,
        health,
        ammo,
        score,
        kills,
        level,
        level_map,
        level_title,
        story_title,
        story_body,
        message,
        switch_activated,
        ui: this.paused && this.config.pauseUi && status === "playing" ? validateHud(state[this.config.pauseUi], this.config.sprites) : this.config.ui ? validateHud(state[this.config.ui], this.config.sprites) : void 0,
        paused: this.paused,
        time: this.ticks / this.config.tickRate,
        presentation: this.config.presentation,
        hud_text: this.app.derived.hud_text !== void 0 ? String(this.app.derived.hud_text) : state.hud_text ? String(state.hud_text) : void 0,
        wall_overrides: Array.isArray(state.wall_overrides) ? state.wall_overrides.flatMap((tile) => {
          const texture = Object.keys(this.config.textures).indexOf(tile.texture);
          return texture >= 0 ? [{ x: tile.x, y: tile.y, texture }] : [];
        }) : []
      };
    }
    frame() {
      this.invalidateFrame();
      const stats = this.renderState();
      this.raycaster.render(
        stats.camera,
        stats.things,
        stats.weapon,
        stats.flash,
        {
          titleScene: stats.title_scene,
          presentationTime: stats.presentation_time,
          status: stats.status,
          heading: stats.camera.angle,
          health: stats.health,
          ammo: stats.ammo,
          score: stats.score,
          kills: stats.kills,
          level: stats.level,
          levelTitle: stats.level_title,
          storyTitle: stats.story_title,
          storyBody: stats.story_body,
          message: stats.message,
          switchActivated: stats.switch_activated,
          ui: stats.ui,
          paused: stats.paused,
          presentation: stats.presentation,
          hudText: stats.hud_text
        },
        stats.wall_overrides,
        stats.title_scene ? stats.presentation_time : stats.time,
        this.raycaster.config.world ? validatedVoxelChunks(this.raycaster.config.world) : void 0
      );
      return this.raycaster.buffer;
    }
  };

  // src/pixel3d/touch.ts
  var STYLE = `
.rune-pixel3d-surface{position:relative;touch-action:none;isolation:isolate}
.rune-pixel3d-touch{position:absolute;pointer-events:none;display:none;z-index:5;user-select:none;-webkit-user-select:none;touch-action:none}
@media (pointer:coarse),(hover:none){.rune-pixel3d-touch{display:block}}
.rune-pixel3d-touch.is-touch{display:block}
.rune-pixel3d-touch button{pointer-events:auto;touch-action:none;box-sizing:border-box;color:#fff1ce;background:#142432bb;border:2px solid #f6cc4488;font:bold 11px ui-monospace,monospace;min-height:44px;padding:8px;box-shadow:0 2px 12px #0008;user-select:none;-webkit-user-select:none}
.rune-pixel3d-touch button:focus-visible{outline:3px solid #fff;outline-offset:2px}
.rune-pixel3d-touch [data-touch-play]{display:none}
.rune-pixel3d-touch[data-playing=true] [data-touch-play]{display:block}
.rune-pixel3d-touch .move-stick{position:absolute;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));width:clamp(72px,24vmin,112px);height:clamp(72px,24vmin,112px);border-radius:50%;padding:0;background:radial-gradient(circle,#28465788,#0d172588);opacity:.85}
.move-stick:before{content:'MOVE';position:absolute;left:0;right:0;top:8px;font-size:9px;letter-spacing:1px;color:#d1dce5}
.move-stick .stick-thumb{position:absolute;left:30%;top:30%;width:40%;height:40%;border-radius:50%;background:#f6cc4499;border:2px solid #fff1b9;pointer-events:none;will-change:transform}
.rune-pixel3d-touch .touch-use{position:absolute;right:max(80px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));width:48px;height:48px;border-radius:50%;background:#455521bb}
.rune-pixel3d-touch .touch-fire{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));width:60px;height:60px;border-radius:50%;background:#8b302bbb;border-color:#ffa47c;font-size:12px}
.rune-pixel3d-touch .touch-top{position:absolute;right:max(8px,env(safe-area-inset-right));top:max(44px,env(safe-area-inset-top));display:flex;gap:6px;pointer-events:none}
.rune-pixel3d-touch .touch-top button{border-radius:6px;font-size:10px}
.rune-pixel3d-touch .rotate-hint{display:none;position:absolute;left:50%;bottom:calc(100% + 12px);transform:translateX(-50%);background:#0d1725dd;color:#fff1ce;border:1px solid #f6cc44;padding:10px;text-align:center;font:12px ui-monospace,monospace;max-width:70%}
.rune-pixel3d-expanded-page{overflow:hidden!important}
.rune-pixel3d-expanded{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;z-index:2147483646!important;margin:0!important;border:0!important}
.rune-pixel3d-surface:fullscreen,.rune-pixel3d-expanded{display:flex;align-items:center;justify-content:center;background:#060709}
.rune-pixel3d-surface:fullscreen canvas,.rune-pixel3d-expanded canvas{width:min(100vw,160dvh)!important;max-width:none!important;height:auto!important;max-height:100dvh!important;touch-action:none}
@media (orientation:portrait){.rune-pixel3d-touch[data-expanded=true] .rotate-hint{display:block}}
`;
  function mountTouch(canvas, surface, bindings) {
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);
    surface.classList.add("rune-pixel3d-surface");
    const overlay = document.createElement("div");
    overlay.className = "rune-pixel3d-touch";
    overlay.innerHTML = `<button class="move-stick" data-touch-play aria-label="Move joystick"><span class="stick-thumb"></span></button>
    <button class="touch-fire" data-touch-play aria-label="Fire weapon">FIRE</button>
    <button class="touch-use" data-touch-play aria-label="Use terminal or elevator">USE</button>
    <div class="touch-top"><button data-touch-play class="touch-pause" aria-label="Pause game">PAUSE</button><button class="touch-fullscreen" aria-label="Toggle fullscreen">FULL</button></div>
    <span class="rotate-hint">Rotate your device for landscape play</span>`;
    surface.appendChild(overlay);
    const stick = overlay.querySelector(".move-stick");
    const thumb = overlay.querySelector(".stick-thumb");
    const use = overlay.querySelector(".touch-use");
    const fire = overlay.querySelector(".touch-fire");
    const full = overlay.querySelector(".touch-fullscreen");
    const pause = overlay.querySelector(".touch-pause");
    const abort = new AbortController();
    function listen(target, name, handler) {
      target.addEventListener(name, handler, { signal: abort.signal, passive: false });
    }
    let moveId = null, aimId = null, useId = null, fireId = null;
    let aimX = 0, fireX = 0;
    function capture(target, id) {
      try {
        target.setPointerCapture(id);
      } catch {
      }
    }
    function release(target, id) {
      if (id !== null) try {
        target.releasePointerCapture(id);
      } catch {
      }
    }
    function touch(event) {
      return event.pointerType === "touch" || event.pointerType === "pen";
    }
    function activate(event) {
      event.preventDefault();
      event.stopPropagation();
      overlay.classList.add("is-touch");
      bindings.interact();
      canvas.focus({ preventScroll: true });
    }
    function moveStick(event) {
      const rect = stick.getBoundingClientRect(), radius = rect.width * 0.36;
      let x = (event.clientX - rect.left - rect.width / 2) / radius;
      let y = (event.clientY - rect.top - rect.height / 2) / radius;
      const length = Math.hypot(x, y);
      if (length < 0.15) {
        x = 0;
        y = 0;
      } else {
        const strength = Math.min(1, (length - 0.15) / 0.85);
        x = x / length * strength;
        y = y / length * strength;
      }
      bindings.move(x, -y);
      thumb.style.transform = `translate(${x * radius}px,${y * radius}px)`;
    }
    listen(stick, "pointerdown", (e) => {
      if (moveId !== null || !bindings.playing()) return;
      activate(e);
      moveId = e.pointerId;
      capture(stick, moveId);
      moveStick(e);
    });
    listen(use, "pointerdown", (e) => {
      if (useId !== null || !bindings.playing()) return;
      activate(e);
      useId = e.pointerId;
      capture(use, useId);
      bindings.use(true, true);
    });
    listen(fire, "pointerdown", (e) => {
      if (fireId !== null || !bindings.playing()) return;
      activate(e);
      if (bindings.paused()) {
        bindings.resume();
        return;
      }
      fireId = e.pointerId;
      fireX = e.clientX;
      capture(fire, fireId);
      bindings.fire(true, true);
    });
    listen(surface, "pointerdown", (e) => {
      if (!touch(e) || e.target.closest("button") || aimId !== null) return;
      activate(e);
      if (!bindings.playing()) {
        bindings.advance();
        return;
      }
      if (bindings.paused()) {
        bindings.resume();
        return;
      }
      aimId = e.pointerId;
      aimX = e.clientX;
      capture(surface, aimId);
    });
    listen(document, "pointermove", (e) => {
      if (e.pointerId === moveId) {
        e.preventDefault();
        moveStick(e);
      }
      if (e.pointerId === aimId) {
        e.preventDefault();
        bindings.look((e.clientX - aimX) * 1200 / Math.max(1, canvas.getBoundingClientRect().width));
        aimX = e.clientX;
      }
      if (e.pointerId === fireId) {
        e.preventDefault();
        bindings.look((e.clientX - fireX) * 1200 / Math.max(1, canvas.getBoundingClientRect().width));
        fireX = e.clientX;
      }
    });
    function end(e) {
      if (e.pointerId === moveId) {
        moveId = null;
        bindings.move(0, 0);
        thumb.style.transform = "";
      }
      if (e.pointerId === aimId) aimId = null;
      if (e.pointerId === fireId) {
        fireId = null;
        bindings.fire(false, false, e.type !== "pointerup");
      }
      if (e.pointerId === useId) {
        useId = null;
        bindings.use(false, false, e.type !== "pointerup");
      }
    }
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) listen(document, name, end);
    for (const [button, action] of [[full, bindings.fullscreen], [pause, bindings.pause]]) {
      listen(button, "pointerdown", (e) => {
        activate(e);
        action();
      });
      listen(button, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }
    function position() {
      const frame = canvas.getBoundingClientRect(), parent = surface.getBoundingClientRect();
      overlay.style.left = `${frame.left - parent.left - surface.clientLeft}px`;
      overlay.style.top = `${frame.top - parent.top - surface.clientTop}px`;
      overlay.style.width = `${frame.width}px`;
      overlay.style.height = `${frame.height}px`;
    }
    const resize = new ResizeObserver(position);
    resize.observe(canvas);
    resize.observe(surface);
    position();
    function reset() {
      const m = moveId, a = aimId, u = useId, f = fireId;
      moveId = aimId = useId = fireId = null;
      release(stick, m);
      release(surface, a);
      release(use, u);
      release(fire, f);
      thumb.style.transform = "";
      bindings.move(0, 0);
      bindings.fire(false);
      bindings.use(false);
    }
    return {
      reset,
      update() {
        overlay.dataset.playing = String(bindings.playing());
        overlay.dataset.expanded = String(bindings.expanded());
        const paused = bindings.paused();
        pause.textContent = paused ? "RESUME" : "PAUSE";
        pause.setAttribute("aria-label", paused ? "Resume game" : "Pause game");
        full.textContent = bindings.expanded() ? "EXIT" : "FULL";
      },
      dispose() {
        reset();
        abort.abort();
        resize.disconnect();
        overlay.remove();
        style.remove();
        surface.classList.remove("rune-pixel3d-surface");
      }
    };
  }

  // src/pixel3d/fullscreen.ts
  function createFullscreen(surface, changed) {
    const doc = surface.ownerDocument;
    const element = surface;
    const orientation = screen.orientation;
    let fallback = false, locked = false, busy = false, disposed = false, exitRequested = false;
    const expanded = () => fallback || doc.fullscreenElement === surface || doc.webkitFullscreenElement === surface;
    const notifyParent = (value) => {
      if (window.parent !== window) window.parent.postMessage({ type: "toggle_fullscreen", is_fullscreen: value }, "*");
    };
    const unlock = () => {
      if (locked) {
        try {
          orientation?.unlock?.();
        } catch {
        }
        locked = false;
      }
    };
    const fallbackMode = (value) => {
      fallback = value;
      surface.classList.toggle("rune-pixel3d-expanded", value);
      doc.documentElement.classList.toggle("rune-pixel3d-expanded-page", value);
      notifyParent(value);
    };
    const onChange = () => {
      if (!expanded()) unlock();
      changed();
    };
    doc.addEventListener("fullscreenchange", onChange);
    doc.addEventListener("webkitfullscreenchange", onChange);
    async function exit() {
      if (doc.pointerLockElement && surface.contains(doc.pointerLockElement)) doc.exitPointerLock?.();
      if (fallback) fallbackMode(false);
      if (doc.fullscreenElement === surface) await doc.exitFullscreen();
      else if (doc.webkitFullscreenElement === surface) await doc.webkitExitFullscreen?.();
      unlock();
      changed();
    }
    const onEscape = (event) => {
      if (event.code !== "Escape" || event.repeat || !expanded() && !busy) return;
      exitRequested = true;
      event.preventDefault();
      event.stopPropagation();
      void exit().catch(() => {
        unlock();
        changed();
      });
    };
    doc.addEventListener("keydown", onEscape, true);
    return {
      expanded,
      async toggle() {
        if (busy || disposed) return;
        busy = true;
        exitRequested = false;
        try {
          if (expanded()) {
            await exit();
            return;
          }
          try {
            if (element.requestFullscreen) await element.requestFullscreen({ navigationUI: "hide" });
            else if (element.webkitRequestFullscreen) await element.webkitRequestFullscreen();
            else fallbackMode(true);
          } catch {
            if (!disposed && !exitRequested) fallbackMode(true);
          }
          if (disposed || exitRequested) {
            await exit();
            return;
          }
          try {
            if (orientation?.lock) {
              await orientation.lock("landscape");
              locked = true;
            }
          } catch {
          }
          if (!expanded()) unlock();
          if (disposed) await exit();
          changed();
        } finally {
          busy = false;
        }
      },
      dispose() {
        disposed = true;
        doc.removeEventListener("fullscreenchange", onChange);
        doc.removeEventListener("webkitfullscreenchange", onChange);
        doc.removeEventListener("keydown", onEscape, true);
        void exit().catch(() => {
          unlock();
          fallbackMode(false);
        });
      }
    };
  }

  // src/pixel3d/index.ts
  var settings;
  function configure(config) {
    settings = config;
  }
  function boot(options) {
    const game = new Pixel3DEngine(settings, options);
    Object.assign(globalThis, { __RunePixel3D: game, __RunePixel: game });
    if (typeof document !== "undefined") {
      let active2 = null;
      let dispose;
      const attach = () => {
        const canvas = document.querySelector(
          "canvas[data-rune-pixel-3d], canvas[data-rune-pixel]"
        );
        if (canvas === active2) return;
        dispose?.();
        active2 = canvas;
        dispose = canvas ? mount(game, canvas) : void 0;
      };
      attach();
      const observer = new MutationObserver(attach);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
      window.addEventListener(
        "pagehide",
        () => {
          observer.disconnect();
          dispose?.();
        },
        { once: true }
      );
    }
    return game;
  }
  function mount(game, canvas) {
    const { width, height, tickRate } = game.config;
    const keys = game.config.keys || {
      KeyW: "forward",
      KeyS: "back",
      KeyA: "strafe_left",
      KeyD: "strafe_right",
      ArrowLeft: "turn_left",
      ArrowRight: "turn_right",
      Space: "fire",
      KeyE: "use"
    };
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This game needs Canvas 2D support");
    context.imageSmoothingEnabled = false;
    const image = new ImageData(
      new Uint8ClampedArray(game.raycaster.buffer.buffer),
      width,
      height
    );
    let input = {};
    let mouseFire = false;
    let pendingFire = false;
    let pendingUse = false;
    let touchFire = false, touchUse = false, moveX = 0, moveY = 0;
    let lastTouchAt = 0;
    let touch;
    let mapped;
    let lookAccumX = 0;
    let lookAccumY = 0;
    let previous = 0;
    let accumulator = 0;
    let stopped = false;
    let frameId = 0;
    let menuOpen = false;
    const abort = new AbortController();
    const listen = (element, name, callback) => element.addEventListener(name, callback, { signal: abort.signal });
    const clear = (keepCommands = false) => {
      input = {};
      mouseFire = false;
      pendingFire = false;
      pendingUse = false;
      lookAccumX = 0;
      lookAccumY = 0;
      touch?.reset();
      mapped?.clear(keepCommands);
    };
    const start = () => {
      unlockAudio();
      clear();
      game.activate("start");
      previous = 0;
      accumulator = 0;
      canvas.focus();
    };
    for (const button of Array.from(document.querySelectorAll("[data-pixel-start]"))) {
      listen(button, "click", () => {
        if (game.app.state.status === "playing" && button.dataset.pixelConfirm && !window.confirm(button.dataset.pixelConfirm)) return;
        start();
      });
    }
    for (const button of Array.from(document.querySelectorAll("[data-pixel-action]"))) {
      const args = JSON.parse(button.dataset.pixelArgs || "[]");
      if (!Array.isArray(args)) throw new Error("data-pixel-args must be a JSON array");
      listen(button, "click", () => {
        unlockAudio();
        const action = button.dataset.pixelAction;
        clear();
        if (action) game.activate(action, args);
        canvas.focus({ preventScroll: true });
      });
    }
    for (const button of Array.from(document.querySelectorAll("[data-pixel-pause]"))) {
      listen(button, "click", () => {
        canvas.focus();
        clear(true);
        game.paused = !game.paused;
      });
    }
    for (const button of Array.from(document.querySelectorAll("[data-pixel-restart]"))) {
      const action = game.config.restartAction;
      if (!action) throw new Error("data-pixel-restart needs Scene restart_action");
      listen(button, "click", () => {
        unlockAudio();
        clear();
        game.invoke(action);
        canvas.focus({ preventScroll: true });
      });
    }
    for (const button of Array.from(document.querySelectorAll("[data-pixel-mute]"))) {
      listen(button, "click", () => {
        game.muted = !game.muted;
      });
    }
    const surface = canvas.parentElement || canvas;
    const fullscreen = createFullscreen(surface, () => {
      clear(true);
      touch?.update();
    });
    for (const button of Array.from(document.querySelectorAll("[data-pixel-fullscreen]"))) {
      listen(button, "click", () => {
        void fullscreen.toggle().catch(() => {
        });
      });
    }
    mapped = game.controls ? mountControls(canvas, game.controls, {
      state: () => game.app.state,
      playing: () => game.app.state.status === "playing",
      paused: () => game.paused,
      resume: () => {
        clear(true);
        game.paused = false;
      },
      advance: () => {
        clear();
        if (["title", "story", "gameover", "won"].includes(String(game.app.state.status))) game.invoke("advance");
        else start();
      },
      fullscreen: () => {
        void fullscreen.toggle().catch(() => {
        });
      },
      interact: unlockAudio,
      lockedMouse: true,
      advanceInputs: ["fire", "use"],
      expanded: fullscreen.expanded,
      tapToAdvance: game.config.clickToStart
    }) : void 0;
    const mappedStyle = mapped ? document.createElement("style") : void 0;
    if (mappedStyle) {
      mappedStyle.textContent = STYLE;
      document.head.append(mappedStyle);
      surface.classList.add("rune-pixel3d-surface");
    }
    touch = mapped ? void 0 : mountTouch(canvas, surface, {
      playing: () => game.app.state.status === "playing",
      paused: () => game.paused,
      interact: () => {
        lastTouchAt = Date.now();
        unlockAudio();
      },
      advance: () => {
        if (game.config.clickToStart === false && game.app.state.status !== "playing") return;
        clear();
        if (["title", "story", "gameover", "won"].includes(String(game.app.state.status))) game.invoke("advance");
        else start();
      },
      resume: () => {
        clear(true);
        game.paused = false;
      },
      move: (x, y) => {
        moveX = x;
        moveY = y;
      },
      look: (delta) => {
        lookAccumX += delta;
      },
      fire: (held, pulse, cancel) => {
        touchFire = held;
        if (pulse) pendingFire = true;
        if (cancel) pendingFire = false;
      },
      use: (held, pulse, cancel) => {
        touchUse = held;
        if (pulse) pendingUse = true;
        if (cancel) pendingUse = false;
      },
      fullscreen: () => {
        void fullscreen.toggle().catch(() => {
        });
      },
      expanded: fullscreen.expanded,
      pause: () => {
        clear(true);
        game.paused = !game.paused;
      }
    });
    listen(canvas, "mousedown", ((event) => {
      if (mapped) return;
      if (Date.now() - lastTouchAt < 700 || event.button !== 0 || game.app.state.status !== "playing") return;
      unlockAudio();
      canvas.focus();
      mouseFire = true;
      pendingFire = true;
    }));
    listen(document, "mouseup", ((event) => {
      if (event.button === 0) mouseFire = false;
    }));
    listen(document, "pointerlockchange", () => {
      if (!game.paused && document.pointerLockElement !== canvas) {
        mouseFire = false;
        pendingFire = false;
        lookAccumX = 0;
        lookAccumY = 0;
      }
    });
    listen(canvas, "click", () => {
      if (Date.now() - lastTouchAt < 700 || mapped?.recentTouch()) return;
      unlockAudio();
      canvas.focus();
      if (game.app.state.status !== "playing") {
        if (game.config.clickToStart === false) return;
        if (game.app.state.status === "title" || game.app.state.status === "story") {
          game.invoke("advance");
          return;
        }
        start();
        return;
      }
      if (game.config.mouseLook !== false && document.pointerLockElement !== canvas) {
        const lock = canvas.requestPointerLock?.();
        lock?.catch(() => {
        });
      }
    });
    listen(document, "mousemove", ((event) => {
      if (mapped) return;
      if (document.pointerLockElement === canvas) {
        lookAccumX += event.movementX;
        lookAccumY += event.movementY;
      }
    }));
    listen(canvas, "keydown", ((event) => {
      if (mapped && event.code !== "Escape") return;
      if (event.code === "Escape" && !event.repeat) {
        const menu = document.querySelector("[data-pixel-menu]:not([hidden])");
        if (menu?.dataset.pixelMenuClose) {
          event.preventDefault();
          clear();
          game.activate(menu.dataset.pixelMenuClose);
          return;
        }
      }
      unlockAudio();
      if (keys[event.code] || ["Enter", "KeyP", "KeyM", "Space"].includes(event.code)) {
        event.preventDefault();
      }
      if (game.app.state.status !== "playing" && (event.code === "Enter" || keys[event.code] === "fire" || keys[event.code] === "use")) {
        if (!event.repeat) {
          clear();
          game.invoke("advance");
        }
        return;
      }
      if (keys[event.code]) input[keys[event.code]] = true;
      if (keys[event.code] === "use" && !event.repeat) pendingUse = true;
      if (!event.repeat && event.code === "Escape" && document.pointerLockElement === canvas) {
        document.exitPointerLock?.();
        clear();
      }
      if (!event.repeat && event.code === "KeyP") {
        game.paused = !game.paused;
      }
      if (!event.repeat && event.code === "KeyM") {
        game.muted = !game.muted;
      }
    }));
    listen(document, "keyup", ((event) => {
      if (mapped) return;
      if (keys[event.code]) {
        input[keys[event.code]] = false;
      }
    }));
    listen(window, "blur", () => {
      clear();
      game.paused = true;
    });
    listen(document, "visibilitychange", () => {
      if (document.hidden) {
        clear();
        game.paused = true;
      }
    });
    listen(window, "focus", () => {
      if (game.app.state.status !== "playing") game.paused = false;
    });
    const frame = (now) => {
      if (stopped) return;
      if (previous) accumulator += Math.min(now - previous, 1e3 / tickRate * 5);
      previous = now;
      while (accumulator >= 1e3 / tickRate) {
        const controls = {
          ...input,
          fire: Boolean(input.fire || mouseFire || touchFire || pendingFire),
          use: Boolean(input.use || touchUse || pendingUse),
          move_x: moveX,
          move_y: moveY
        };
        pendingFire = false;
        pendingUse = false;
        controls.look_x = lookAccumX;
        controls.look_y = lookAccumY;
        lookAccumX = 0;
        lookAccumY = 0;
        game.step(mapped ? mapped.sample(1 / tickRate) : controls);
        if (game.app.state.status !== "playing") clear(true);
        accumulator -= 1e3 / tickRate;
      }
      touch?.update();
      mapped?.update();
      if (game.frameIfChanged()) context.putImageData(image, 0, 0);
      const state = game.app.state;
      for (const element of Array.from(document.querySelectorAll("[data-pixel-paused]"))) {
        element.hidden = !game.paused || !isPausableStatus(state.status);
      }
      for (const button of Array.from(document.querySelectorAll("[data-pixel-pause]"))) {
        button.textContent = game.paused ? "Resume / P" : "Pause / P";
      }
      for (const element of Array.from(document.querySelectorAll("[data-pixel-text], [data-pixel-disabled], [data-pixel-selected], [data-pixel-hidden]"))) {
        const resolve = (path) => path.split(".").reduce((v, key) => v?.[key], state);
        if (element.dataset.pixelText) {
          const value = resolve(element.dataset.pixelText);
          if (value === void 0) throw new Error(`Unknown data-pixel-text state: ${element.dataset.pixelText}`);
          const text = String(value);
          if (element.textContent !== text) element.textContent = text;
        }
        if (element.dataset.pixelDisabled && element instanceof HTMLButtonElement) {
          const value = resolve(element.dataset.pixelDisabled);
          if (typeof value !== "boolean") throw new Error("data-pixel-disabled must reference boolean state");
          element.disabled = value;
        }
        if (element.dataset.pixelSelected) {
          const value = resolve(element.dataset.pixelSelected);
          if (typeof value !== "boolean") throw new Error("data-pixel-selected must reference boolean state");
          element.setAttribute("aria-pressed", String(value));
        }
        if (element.dataset.pixelHidden) {
          const value = resolve(element.dataset.pixelHidden);
          if (typeof value !== "boolean") throw new Error("data-pixel-hidden must reference boolean state");
          element.hidden = value;
        }
      }
      const nextMenuOpen = document.querySelector("[data-pixel-menu]:not([hidden])") !== null;
      if (nextMenuOpen !== menuOpen) {
        clear(true);
        menuOpen = nextMenuOpen;
        if (!menuOpen) canvas.focus({ preventScroll: true });
      }
      const announce = document.querySelector("[data-pixel-status]");
      if (announce) {
        const status = game.paused ? "Paused \u2014 tap Resume or press P" : game.config.presentation ? `${game.config.presentation.title} \u2014 ${game.config.ui ? state[game.config.ui].prompt : state.message || game.config.presentation.objective}${game.saveStatus ? ` \u2014 Progress: ${game.saveStatus}` : ""}` : state.status === "title" ? "Vect Breach \u2014 Tap/click the game or press Enter/Space to commence mission." : state.status === "story" ? "Incoming Transmission \u2014 Tap/click the game or press Enter/Space to engage." : state.status === "won" ? "Mission Accomplished! All Sectors Cleared. Tap the game, or press Space/Enter to replay." : state.status === "gameover" ? "Agent Terminated! Tap the game, or press Space/Enter to restart." : state.status === "ready" ? "Click canvas or press Enter to begin mission." : navigator.maxTouchPoints > 0 ? "Left stick: move. Drag the game: aim. FIRE: shoot. USE: terminal / elevator." : "Click canvas to lock mouse look. WASD to move, left click / Space to fire, E to use switch.";
        if (announce.textContent !== status) {
          announce.textContent = status;
        }
      }
      if ((state.status !== "playing" || game.paused || menuOpen) && document.pointerLockElement === canvas) {
        document.exitPointerLock?.();
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    const dispose = () => {
      stopped = true;
      game.paused = true;
      cancelAnimationFrame(frameId);
      fullscreen.dispose();
      touch?.dispose();
      mapped?.dispose();
      mappedStyle?.remove();
      if (mapped) surface.classList.remove("rune-pixel3d-surface");
      abort.abort();
      clear();
    };
    listen(window, "pagehide", dispose);
    return dispose;
  }
  return __toCommonJS(index_exports);
})();
