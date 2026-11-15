/** Host-neutral input profile emitted by the Rune @Controls compiler. */
export interface InputBinding {
  input?: string;
  command?: string;
  mode?: 'button' | 'value' | 'delta' | 'rate';
  scale?: number;
  invert?: boolean;
  deadzone?: number;
  threshold?: number;
}
export type Binding = string | InputBinding | null;
export interface TouchButton {
  id: string;
  input?: string;
  command?: string;
  label: string;
  aria_label?: string;
  anchor?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  offset?: [number, number];
  size?: number;
  drag_x?: string;
}
export interface TouchControls {
  enabled?: boolean;
  joystick?: { x?: string; y?: string; left?: string; right?: string; up?: string; down?: string; deadzone?: number; size?: number; anchor?: 'bottom-left' | 'bottom-right' };
  look?: { x: string; sensitivity?: number };
  buttons?: TouchButton[];
}
export interface ControlsProfile {
  version: 1;
  name: string;
  keys: Record<string, Binding>;
  commands: Record<string, string | null>;
  mouse: Record<string, Binding>;
  gamepad: Record<string, Binding>;
  touch?: TouchControls;
}
export interface ControlEvent {
  device: 'keyboard' | 'mouse' | 'gamepad' | 'virtual';
  code: string;
  value: number | boolean;
  source?: string;
  input?: string;
  mode?: InputBinding['mode'];
  cancel?: boolean;
}

export interface PadState {
  index: number;
  axes: readonly number[];
  buttons: readonly { value: number }[];
}
