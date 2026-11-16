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
  textScale?: 1 | 2;
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
  if (hud.textScale !== undefined && hud.textScale !== 1 && hud.textScale !== 2) {
    throw new Error('Pixel-3d ui textScale must be 1 or 2');
  }
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
  if (ui.textScale === 2) {
    renderLargeHud(canvas, ui, status, paused);
    return;
  }
  const W = canvas.width, H = canvas.height;
  const columns = Math.max(1, Math.floor((W - 12) / 4));
  const panelColumns = Math.max(1, Math.floor((W - 48) / 4));
  const width = Math.floor((W - 16) / Math.max(1, ui.meters.length));
  const topHeight = ui.detail ? 25 : (ui.meters.length ? 18 : 0);
  if (topHeight) canvas.rect(0, 0, W, topHeight, 0x0b111b);
  ui.meters.forEach((m, i) => {
    const x = 6 + i * width;
    canvas.text(`${m.label} ${Math.ceil(m.value)}/${Math.ceil(m.max)}`, x, 3, m.color);
    canvas.rect(x, 11, width - 6, 5, 0x273445);
    canvas.rect(x, 11, Math.floor((width - 6) * Math.max(0, Math.min(1, m.value / m.max))), 5, m.color);
  });
  canvas.text(ui.detail.slice(0, columns), 6, 19, 0xb5c9de);
  if (ui.objective) {
    canvas.rect(0, topHeight, W, 11, 0x172133);
    canvas.text(ui.objective.slice(0, columns), 6, topHeight + 3, 0xf2d58a);
  }
  const heading = (status !== 'playing' || paused) && ui.heading ? ui.heading.slice(0, Math.max(1, Math.floor((W - 32) / 12))) : '';
  if (heading) {
    canvas.rect(16, 40, W - 32, 26, 0x0b111b);
    canvas.text(heading, Math.floor((W - heading.length * 12) / 2), 44, 0xf2d58a, 3);
  }

  function renderLargeHud(canvas: CanvasHud, ui: GameHud, status: string, paused: boolean): void {
    const W = canvas.width, H = canvas.height;
    const columns = Math.max(1, Math.floor((W - 12) / 8));
    const text = (value: string, x: number, y: number, color = 0xffffff) =>
      canvas.text(value, x, y, color, 2);
    let top = 0;
    if (ui.meters.length) {
      const width = Math.floor((W - 12) / ui.meters.length);
      canvas.rect(0, 0, W, 23, 0x0b111b);
      ui.meters.forEach((meter, i) => {
        const x = 6 + i * width;
        const label = `${meter.label} ${Math.ceil(meter.value)}/${Math.ceil(meter.max)}`;
        const available = Math.max(1, Math.floor((width - 6) / 8));
        const short = `${meter.label.slice(0, 1)} ${Math.ceil(meter.value)}/${Math.ceil(meter.max)}`;
        text((label.length <= available ? label : short).slice(0, available), x, 3, meter.color);
        canvas.rect(x, 16, width - 6, 4, 0x273445);
        canvas.rect(x, 16, Math.floor((width - 6) * Math.max(0, Math.min(1, meter.value / meter.max))), 4, meter.color);
      });
      top = 23;
    }
    const strip = (value: string, color: number) => {
      if (!value) return;
      const lines = wrapText(value, columns).slice(0, 2);
      canvas.rect(0, top, W, lines.length * 12 + 6, 0x172133);
      lines.forEach((line, i) => text(line, 6, top + 3 + i * 12, color));
      top += lines.length * 12 + 6;
    };
    strip(ui.objective, 0xf2d58a);
    if (ui.heading && (status !== 'playing' || paused)) strip(ui.heading, 0xf2d58a);
    // Detail is secondary; leave the centre clear when combat has three meters.
    if (ui.meters.length < 3 && !ui.panel) strip(ui.detail, 0xb5c9de);
    const prompt = paused && !ui.heading ? 'PAUSED - P TO RESUME' : ui.prompt;
    const promptLines = wrapText(prompt, columns).slice(0, 2);
    const bottom = H - promptLines.length * 12 - 6;
    if (ui.panel) {
      const panel = ui.panel;
      const rows = Math.max(0, Math.floor((bottom - top - 8) / 12));
      const title = wrapText(panel.title, columns).slice(0, 1);
      const footer = wrapText(panel.footer, columns).slice(0, 1);
      const choices = panel.choices.map((choice, i) =>
        `${i === panel.selected ? '>' : ' '} ${i + 1} ${choice}`.slice(0, columns));
      const bodyRows = Math.max(0, rows - title.length - footer.length - choices.length);
      const lines = [...title, ...wrapText(panel.body, columns).slice(0, bodyRows), ...choices, ...footer].slice(0, rows);
      canvas.rect(0, top, W, lines.length * 12 + 8, 0x0b111b);
      lines.forEach((line, i) => text(line, 6, top + 4 + i * 12, i === 0 ? 0xf2d58a : 0xb5c9de));
    } else {
      const noticeRows = Math.max(0, Math.min(2, Math.floor((bottom - top - 40) / 12)));
      const lines = wrapText(ui.notice, columns).slice(0, noticeRows);
      if (lines.length) {
        canvas.rect(0, top, W, lines.length * 12 + 6, 0x172133);
        lines.forEach((line, i) => text(line, 6, top + 3 + i * 12, 0xf2d58a));
      }
      if (status === 'playing' && !paused) {
        const x = W >> 1, y = H >> 1;
        canvas.rect(x - 3, y, 7, 1, 0xffffff);
        canvas.rect(x, y - 3, 1, 7, 0xffffff);
      }
    }
    canvas.rect(0, bottom, W, H - bottom, 0x0b111b);
    promptLines.forEach((line, i) => text(line, 6, bottom + 3 + i * 12));
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
  if (prompt) {
    canvas.rect(0, H - 14, W, 14, 0x0b111b);
    canvas.text(prompt.slice(0, columns), 6, H - 9, 0xffffff);
  }
}
