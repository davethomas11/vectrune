import { roundedRect, type CanvasHud, type HudTheme, type HudHitRegion } from './hud';

export interface OnScreenKeyboardConfig {
  title: string;
  value: string;
  maxLength: number;
  submitAction: string;
  cancelAction: string;
  changeAction?: string;
  width?: number;
  keyHeight?: number;
  gap?: number;
  textScale?: 1 | 2;
}

const rows = [
  [...'QWERTYUIOP'], [...'ASDFGHJKL'], [...'ZXCVBNM'],
  [...'1234567890', '-', "'"], ['SHIFT', 'SPACE', 'DELETE', 'CANCEL', 'SAVE'],
];
const keys = rows.flat();

export function validateKeyboard(value: OnScreenKeyboardConfig): void {
  if (!value || typeof value.title !== 'string' || typeof value.value !== 'string' ||
      !Number.isInteger(value.maxLength) || value.maxLength < 1 || value.maxLength > 128 ||
      value.value.length > value.maxLength ||
      !['submitAction', 'cancelAction'].every(k => typeof Reflect.get(value, k) === 'string' && Reflect.get(value, k).length > 0) ||
      (value.changeAction !== undefined && (typeof value.changeAction !== 'string' || !value.changeAction)) ||
      (value.width !== undefined && (!Number.isInteger(value.width) || value.width < 240 || value.width > 640)) ||
      (value.keyHeight !== undefined && (!Number.isInteger(value.keyHeight) || value.keyHeight < 18 || value.keyHeight > 48)) ||
      (value.gap !== undefined && (!Number.isInteger(value.gap) || value.gap < 1 || value.gap > 12)) ||
      (value.textScale !== undefined && value.textScale !== 1 && value.textScale !== 2)) {
    throw new Error('Pixel-3d keyboard needs text, bounded sizing, maxLength (1-128), and submit/cancel actions');
  }
}

export class OnScreenKeyboard {
  value = '';
  focus = 0;
  uppercase = false;
  pressed = new Set<string>();
  private config?: OnScreenKeyboardConfig;
  private previousValue?: string;
  private pads = new Set<string>();
  seedController(held: ReadonlySet<string>): void { this.pads = new Set(held); }

  sync(config: OnScreenKeyboardConfig | undefined): void {
    if (!config) {
      this.config = undefined; this.previousValue = undefined;
      this.pressed.clear(); this.pads.clear();
      return;
    }
    if (!this.config || this.previousValue !== config.value) {
      this.value = config.value;
      if (!this.config) { this.focus = 0; this.uppercase = false; this.pressed.clear(); }
    }
    this.config = config;
    this.previousValue = config.value;
  }

  move(dx: number, dy: number): void {
    let start = 0, row = 0;
    while (this.focus >= start + rows[row].length) { start += rows[row].length; row++; }
    const col = this.focus - start;
    if (dx) this.focus = start + (col + dx + rows[row].length) % rows[row].length;
    if (dy) {
      const next = (row + dy + rows.length) % rows.length;
      this.focus = rows.slice(0, next).reduce((n, r) => n + r.length, 0) +
        Math.min(rows[next].length - 1, Math.round(col * (rows[next].length - 1) / Math.max(1, rows[row].length - 1)));
    }
  }

  activate(key: string, invoke: (action: string, args: unknown[]) => void): void {
    const config = this.config;
    if (!config) return;
    if (!keys.includes(key)) throw new Error(`Unknown on-screen keyboard key: ${key}`);
    if (key === 'SAVE') { invoke(config.submitAction, [{ name: this.value }]); return; }
    if (key === 'CANCEL') { invoke(config.cancelAction, []); return; }
    if (key === 'SHIFT') { this.uppercase = !this.uppercase; return; }
    if (key === 'DELETE') this.value = Array.from(this.value).slice(0, -1).join('');
    else {
      const text = key === 'SPACE' ? ' ' : this.uppercase ? key.toUpperCase() : key.toLowerCase();
      if (this.value.length + text.length <= config.maxLength) this.value += text;
    }
    if (config.changeAction) invoke(config.changeAction, [{ name: this.value }]);
  }

  physical(key: string, down: boolean, repeat: boolean, invoke: (action: string, args: unknown[]) => void): boolean {
    if (!this.config) return false;
    const label = key === ' ' ? 'SPACE' : key === 'Backspace' || key === 'Delete' ? 'DELETE' :
      key === 'Enter' ? 'SAVE' : key === 'Escape' ? 'CANCEL' : key === 'Shift' ? 'SHIFT' : key.toUpperCase();
    if (!down) { this.pressed.delete(label); return true; }
    this.pressed.add(label);
    if (key.startsWith('Arrow')) {
      this.move(key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0, key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0);
    } else if (key === 'Enter') {
      if (!repeat) this.activate('SAVE', invoke);
    } else if (key === 'Escape') {
      if (!repeat) this.activate('CANCEL', invoke);
    } else if (key === 'Backspace' || key === 'Delete') this.activate('DELETE', invoke);
    else if (key.length === 1 && /^[a-zA-Z0-9 '\-]$/.test(key)) {
      if (this.value.length < this.config.maxLength) {
        this.value += key;
        if (this.config.changeAction) invoke(this.config.changeAction, [{ name: this.value }]);
      }
    }
    return true;
  }

  controller(pads: readonly ({ index: number; buttons: readonly { pressed?: boolean; value: number }[]; axes: readonly number[] } | null)[],
    invoke: (action: string, args: unknown[]) => void): void {
    const held = new Set<string>();
    for (const pad of pads) {
      if (!pad) continue;
      const buttons = [12, 13, 14, 15, 0, 1];
      for (const button of buttons) {
        if ((pad.buttons[button]?.value ?? 0) <= .5) continue;
        const id = `${pad.index}:${button}`;
        held.add(id);
        if (this.pads.has(id)) continue;
        if (button === 0) this.activate(keys[this.focus], invoke);
        else if (button === 1) this.activate('CANCEL', invoke);
        else this.move(button === 14 ? -1 : button === 15 ? 1 : 0, button === 12 ? -1 : button === 13 ? 1 : 0);
      }
      for (const [axis, negative, positive] of [[0, 'left', 'right'], [1, 'up', 'down']] as const) {
        const value = pad.axes[axis] ?? 0;
        if (Math.abs(value) < .6) continue;
        const id = `${pad.index}:${value < 0 ? negative : positive}`;
        held.add(id);
        if (!this.pads.has(id)) this.move(axis === 0 ? Math.sign(value) : 0, axis === 1 ? Math.sign(value) : 0);
      }
    }
    this.pads = held;
  }

  render(canvas: CanvasHud, theme: HudTheme | undefined): void {
    if (!this.config) return;
    const c = this.config, layout = keyboardLayout(c, canvas.width, canvas.height);
    const bg = theme?.background ?? 0x0d2233, ink = theme?.text ?? 0xf1fbf7;
    roundedRect(canvas, layout.x, layout.y, layout.width, layout.height, theme?.radius ?? 6, bg);
    canvas.rect(layout.x, layout.y, layout.width, 2, theme?.accent ?? 0x7ce4cc);
    canvas.text(c.title.slice(0, Math.floor((layout.width - 72) / 8)), layout.x + 10, layout.y + 10, ink, 2);
    canvas.text(`${this.value.length}/${c.maxLength}`, layout.x + layout.width - 48, layout.y + 12, theme?.muted ?? 0xa2bdc7);
    canvas.rect(layout.x + 10, layout.y + 28, layout.width - 20, 21, theme?.surface ?? 0x18394a);
    canvas.text((this.value || '_').slice(-Math.floor((layout.width - 32) / 8)), layout.x + 16, layout.y + 35, ink, 2);
    layout.cells.forEach(cell => {
      const focused = cell.index === this.focus, pressed = this.pressed.has(cell.key);
      roundedRect(canvas, cell.x, cell.y, cell.w, cell.h, theme?.radius ?? 6, focused ? theme?.focus ?? 0xc3ffe8 : theme?.border ?? 0x365568);
      roundedRect(canvas, cell.x + 2, cell.y + 2, cell.w - 4, cell.h - 4, Math.max(0, (theme?.radius ?? 6) - 2),
        pressed ? theme?.accent ?? 0x7ce4cc : focused ? theme?.selected ?? 0x265765 : theme?.surface ?? 0x18394a);
      const label = cell.key === "'" ? (cell.w >= 20 ? 'APOS' : 'AP') :
        cell.key.length === 1 && !this.uppercase && !this.pressed.has('SHIFT') ? cell.key.toLowerCase() : cell.key;
      const scale = Math.min(c.textScale ?? 1, Math.floor((cell.w - 4) / (label.length * 4)) >= 2 ? 2 : 1);
      canvas.text(label, cell.x + Math.floor((cell.w - label.length * 4 * scale) / 2),
        cell.y + Math.floor((cell.h - 5 * scale) / 2), pressed ? bg : ink, scale);
    });
    canvas.text('D-PAD MOVE / A SELECT / B CANCEL', layout.x + 10, layout.y + layout.height - 12, theme?.muted ?? 0xa2bdc7);
  }

  hits(width: number, height: number): HudHitRegion[] {
    return this.config ? keyboardLayout(this.config, width, height).cells.map(cell => ({
      x: cell.x, y: cell.y, w: cell.w, h: cell.h, action: 'host.keyboard', args: [cell.key],
    })) : [];
  }
}

function keyboardLayout(config: OnScreenKeyboardConfig, W: number, H: number) {
  const width = Math.min(config.width ?? 480, W - 16), gap = config.gap ?? 4;
  const keyHeight = Math.max(12, Math.min(config.keyHeight ?? 28, Math.floor((H - 90 - gap * 4) / 5)));
  const height = 76 + keyHeight * 5 + gap * 4;
  const x = Math.floor((W - width) / 2), y = Math.max(8, H - height - 8);
  let index = 0;
  const cells = rows.flatMap((row, r) => {
    const w = Math.floor((width - 20 - gap * (row.length - 1)) / row.length);
    return row.map(key => ({ key, index: index++, x: x + 10 + row.indexOf(key) * (w + gap), y: y + 56 + r * (keyHeight + gap), w, h: keyHeight }));
  });
  return { x, y, width, height, cells };
}
