import type { Binding, ControlEvent, ControlsProfile, InputBinding, PadState } from './types';
interface Source {
  input: string;
  mode: NonNullable<InputBinding['mode']>;
  value: number | boolean;
  pending: boolean;
}

/** One source ledger shared by native and browser adapters. No DOM or device APIs. */
export class InputController {
  private sources = new Map<string, Source>();
  constructor(readonly profile: ControlsProfile) {}

  event(event: ControlEvent): string | undefined {
    const source = event.source || `${event.device}:${event.code}`;
    const previous = this.sources.get(source);
    if (event.cancel) { this.sources.delete(source); return; }
    let binding: Binding | undefined;
    if (event.device === 'virtual') binding = event.input ? { input: event.input, mode: event.mode } : undefined;
    else if (event.device === 'keyboard') binding = this.profile.keys[event.code];
    else binding = this.profile[event.device][event.code];
    const command = (event.device === 'keyboard' ? this.profile.commands[event.code] : undefined) || (binding && typeof binding !== 'string' ? binding.command : undefined);
    if (command) {
      const def = binding && typeof binding !== 'string' ? binding : undefined;
      const pressed = typeof event.value === 'boolean' ? event.value : Number(event.value) * (def?.invert ? -1 : 1) > (def?.threshold ?? .5);
      this.sources.set(source, { input: '', mode: 'button', value: pressed, pending: false });
      if (pressed && !previous?.value) return command;
      return;
    }
    if (!binding) { this.sources.delete(source); return; }
    const def: InputBinding = typeof binding === 'string' ? { input: binding } : binding;
    if (!def.input) return;
    const isMouseDelta = event.device === 'mouse' && /^(Move|Wheel)[XY]$/.test(event.code);
    const digitalAxis = event.device === 'gamepad' && /[+-]$/.test(event.code);
    const mode = def.mode || (isMouseDelta ? 'delta' : typeof event.value === 'boolean' || /^Button/.test(event.code) || digitalAxis ? 'button' : 'value');
    let value = Number(event.value);
    if (def.invert) value = -value;
    if (event.device === 'gamepad' && !/^Button/.test(event.code)) {
      const deadzone = def.deadzone ?? .18;
      value = Math.abs(value) <= deadzone ? 0 : Math.sign(value) * (Math.abs(value) - deadzone) / (1 - deadzone);
    }
    value *= def.scale ?? 1;
    if (mode === 'button') {
      const down = value > (def.threshold ?? .5);
      this.sources.set(source, { input: def.input, mode, value: down, pending: Boolean(previous?.pending || down && !previous?.value) });
    } else {
      this.sources.set(source, { input: def.input, mode, value: mode === 'delta' ? Number(previous?.value || 0) + value : value, pending: false });
    }
  }

  /** Queued presses survive a down/up between ticks; deltas drain exactly once. */
  sample(dt: number): Record<string, boolean | number> {
    const buttons: Record<string, boolean> = Object.create(null);
    const axes: Record<string, number> = Object.create(null);
    const deltas: Record<string, number> = Object.create(null);
    for (const entry of this.sources.values()) {
      if (!entry.input) continue;
      if (entry.mode === 'button') buttons[entry.input] = Boolean(buttons[entry.input] || entry.value || entry.pending);
      else if (entry.mode === 'value') {
        if (Math.abs(Number(entry.value)) >= Math.abs(axes[entry.input] || 0)) axes[entry.input] = Number(entry.value);
      } else {
        const scale = entry.mode === 'rate' ? Math.max(0, Math.min(.25, dt)) : 1;
        deltas[entry.input] = (deltas[entry.input] || 0) + Number(entry.value) * scale;
      }
      entry.pending = false;
      if (entry.mode === 'delta') entry.value = 0;
    }
    const result: Record<string, number | boolean> = { ...buttons, ...axes };
    for (const [input, value] of Object.entries(deltas)) result[input] = Number(result[input] || 0) + value;
    return result;
  }

  /** Browser Gamepad API or a native adapter can supply the same normalized pads. */
  gamepads(pads: readonly (PadState | null)[]): string[] {
    const live = new Set<string>();
    const commands: string[] = [];
    for (const pad of pads) {
      if (!pad) continue;
      for (const code of Object.keys(this.profile.gamepad)) {
        const match = code.match(/^(Button|Axis)(\d+)([+-])?$/);
        if (!match) continue;
        const source = `pad:${pad.index}:${code}`;
        live.add(source);
        let value = match[1] === 'Button' ? pad.buttons[Number(match[2])]?.value || 0 : pad.axes[Number(match[2])] || 0;
        if (match[3]) value = Math.max(0, value * (match[3] === '-' ? -1 : 1));
        const command = this.event({ device: 'gamepad', code, value, source });
        if (command) commands.push(command);
      }
    }
    for (const source of this.sources.keys()) if (source.startsWith('pad:') && !live.has(source)) this.sources.delete(source);
    return commands;
  }
  clear(keepCommands = false): void {
    if (!keepCommands) this.sources.clear();
    else for (const [key, source] of this.sources) if (source.input) this.sources.delete(key);
  }
}
