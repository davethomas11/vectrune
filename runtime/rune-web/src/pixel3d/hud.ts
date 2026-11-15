export interface HudMeter {
  label: string;
  value: number;
  max: number;
  color: number;
}
export interface HudPanel {
  title: string;
  body: string;
  choices: string[];
  selected: number;
  footer: string;
}
export interface GameHud {
  heading?: string;
  meters: HudMeter[];
  objective: string;
  detail: string;
  prompt: string;
  notice: string;
  panel: HudPanel | null;
}

export function validateHud(value: unknown): GameHud {
  if (!value || typeof value !== 'object') throw new Error('Pixel-3d ui must be a HUD object');
  const hud = value as GameHud;
  if (hud.heading !== undefined && typeof hud.heading !== 'string') throw new Error('Pixel-3d ui heading must be a string');
  if (!Array.isArray(hud.meters) || hud.meters.length > 3 ||
      !hud.meters.every(m => m && typeof m.label === 'string' && Number.isFinite(m.value) &&
        Number.isFinite(m.max) && m.max > 0 && Number.isInteger(m.color) && m.color >= 0 && m.color <= 0xffffff) ||
      !['objective', 'detail', 'prompt', 'notice'].every(k => typeof Reflect.get(hud, k) === 'string')) {
    throw new Error('Pixel-3d ui needs up to three valid meters and objective/detail/prompt/notice strings');
  }
  if (hud.panel !== null) {
    const p = hud.panel;
    if (!p || !['title', 'body', 'footer'].every(k => typeof Reflect.get(p, k) === 'string') ||
        !Array.isArray(p.choices) || p.choices.length > 3 || !p.choices.every(c => typeof c === 'string') ||
        !Number.isInteger(p.selected) || p.selected < 0 || p.selected >= Math.max(1, p.choices.length)) {
      throw new Error('Pixel-3d ui panel needs title/body/footer, up to three choices, and a valid selected index');
    }
  }
  return hud;
}

interface CanvasHud {
  width: number;
  height: number;
  rect(x: number, y: number, w: number, h: number, color: number): void;
  text(text: string, x: number, y: number, color?: number, scale?: number): void;
}

export function wrapText(text: string, columns: number): string[] {
  if (!Number.isInteger(columns) || columns < 1) throw new Error('HUD wrap columns must be a positive integer');
  const lines: string[] = [];
  for (const paragraph of text.split('|')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      if (line && line.length + word.length + 1 > columns) { lines.push(line); line = ''; }
      let rest = word;
      while (rest.length > columns) {
        if (line) { lines.push(line); line = ''; }
        lines.push(rest.slice(0, columns)); rest = rest.slice(columns);
      }
      line += (line ? ' ' : '') + rest;
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function renderHud(canvas: CanvasHud, ui: GameHud, status: string, paused: boolean): void {
  const W = canvas.width, H = canvas.height;
  const columns = Math.max(1, Math.floor((W - 12) / 4));
  const panelColumns = Math.max(1, Math.floor((W - 48) / 4));
  const width = Math.floor((W - 16) / Math.max(1, ui.meters.length));
  canvas.rect(0, 0, W, 25, 0x0b111b);
  ui.meters.forEach((m, i) => {
    const x = 6 + i * width;
    canvas.text(`${m.label} ${Math.ceil(m.value)}/${Math.ceil(m.max)}`, x, 3, m.color);
    canvas.rect(x, 11, width - 6, 5, 0x273445);
    canvas.rect(x, 11, Math.floor((width - 6) * Math.max(0, Math.min(1, m.value / m.max))), 5, m.color);
  });
  canvas.text(ui.detail.slice(0, columns), 6, 19, 0xb5c9de);
  canvas.rect(0, 25, W, 11, 0x172133);
  canvas.text(ui.objective.slice(0, columns), 6, 28, 0xf2d58a);
  const heading = (status !== 'playing' || paused) && ui.heading ? ui.heading.slice(0, Math.max(1, Math.floor((W - 32) / 12))) : '';
  if (heading) {
    canvas.rect(16, 40, W - 32, 26, 0x0b111b);
    canvas.text(heading, Math.floor((W - heading.length * 12) / 2), 44, 0xf2d58a, 3);
  }
  if (ui.notice && !ui.panel) {
    const noticeY = heading ? 70 : 40;
    const lines = wrapText(ui.notice, Math.max(1, Math.floor((W - 32) / 4))).slice(0, 2);
    canvas.rect(12, noticeY, W - 24, lines.length * 8 + 8, 0x172133);
    lines.forEach((line, i) => canvas.text(line, 16, noticeY + 4 + i * 8, 0xf2d58a));
  }
  if (ui.panel) {
    const p = ui.panel;
    const camp = status !== 'playing' || paused;
    const body = wrapText(p.body, panelColumns).slice(0, camp ? 3 : 2);
    const bh = 35 + body.length * 8 + p.choices.length * 12;
    const by = camp ? heading ? 70 : 44 : H - bh - 18;
    canvas.rect(16, by, W - 32, bh, 0x0b111b);
    canvas.rect(16, by, W - 32, 2, 0xf2d58a);
    canvas.text(p.title.slice(0, panelColumns), 24, by + 7, 0xf2d58a);
    body.forEach((line, i) => canvas.text(line, 24, by + 18 + i * 8, 0xb5c9de));
    p.choices.forEach((choice, i) => {
      const y = by + 22 + body.length * 8 + i * 12;
      if (i === p.selected) canvas.rect(22, y - 2, W - 44, 10, 0x30445c);
      canvas.text(`${i === p.selected ? '>' : ' '} ${i + 1} ${choice}`.slice(0, panelColumns), 24, y, i === p.selected ? 0xffffff : 0xb5c9de);
    });
    canvas.text(p.footer.slice(0, panelColumns), 24, by + bh - 8, 0x7ed6ac);
  } else {
    const x = W >> 1, y = H >> 1;
    canvas.rect(x - 3, y, 2, 1, 0xffffff);
    canvas.rect(x + 2, y, 2, 1, 0xffffff);
    canvas.rect(x, y - 3, 1, 2, 0xffffff);
    canvas.rect(x, y + 2, 1, 2, 0xffffff);
  }
  const prompt = paused && !ui.heading ? 'PAUSED - P OR PAUSE BUTTON TO RESUME' : ui.prompt;
  canvas.rect(0, H - 14, W, 14, 0x0b111b);
  canvas.text(prompt.slice(0, columns), 6, H - 9, 0xffffff);
}
