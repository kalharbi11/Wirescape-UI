import type { Ticker } from '../../runtime/Ticker';
import { CanvasPane } from './canvasBase';
import { el } from '../../app/dom';

/** Stereo output meter with peak hold and a clip mark. */
export class Meter {
  readonly root: HTMLElement;
  private pane: CanvasPane;
  private unbind: () => void;
  private level: [number, number] = [0, 0];
  private peak: [number, number] = [0, 0];
  private clipped: [boolean, boolean] = [false, false];
  private clipUntil = 0;

  constructor(moduleId: number, ticker: Ticker) {
    this.root = el('div', 'meter-pane');
    this.root.dataset.testid = `meter-${moduleId}`;
    const head = el('div', 'pane-head');
    head.append(el('span', '', 'OUTPUT'), el('span', 'pane-head-right', 'L / R'));
    this.pane = new CanvasPane('meter-canvas');
    this.root.append(head, this.pane.root);

    this.unbind = ticker.bind(moduleId, t => {
      const m = t.meters[moduleId];
      if (m) {
        this.level = m;
        const decay = 0.94;
        this.peak = [Math.max(m[0], this.peak[0] * decay), Math.max(m[1], this.peak[1] * decay)];
        if (m[0] > 1 || m[1] > 1) { this.clipUntil = t.time + 1.5; }
        this.clipped = [m[0] > 1 || t.time < this.clipUntil, m[1] > 1 || t.time < this.clipUntil];
      }
      this.draw();
    });
  }

  private draw(): void {
    const { ctx } = this.pane;
    const w = this.pane.width, h = this.pane.height;
    if (!w || !h) { this.pane.resize(); return; }
    this.pane.clear();
    const gap = 7;
    const barH = Math.min(9, (h - gap) / 2);
    const top = (h - (barH * 2 + gap)) / 2;
    const track = this.pane.token('--surface-sunken', '#eceae4');
    const line = this.pane.token('--line', '#d9d8d2');
    const ink = this.pane.token('--ink', '#393b39');
    const danger = this.pane.token('--danger', '#b4523f');

    for (let i = 0; i < 2; i++) {
      const y = top + i * (barH + gap);
      ctx.fillStyle = track; ctx.fillRect(0, y, w, barH);
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      ctx.strokeRect(0.5, y + 0.5, w - 1, barH - 1);

      const lvl = Math.min(1, this.level[i]!);
      ctx.fillStyle = this.clipped[i] ? danger : ink;
      ctx.fillRect(1, y + 1, Math.max(0, (w - 2) * lvl), barH - 2);

      const pk = Math.min(1, this.peak[i]!);
      if (pk > 0.01) {
        ctx.fillStyle = ink;
        ctx.fillRect(Math.min(w - 2, 1 + (w - 2) * pk), y + 1, 1.5, barH - 2);
      }
      // Clip mark at the top of the scale.
      ctx.fillStyle = this.clipped[i] ? danger : line;
      ctx.fillRect(w - 2.5, y, 2.5, barH);
    }
  }

  destroy(): void { this.unbind(); this.pane.destroy(); }
}
