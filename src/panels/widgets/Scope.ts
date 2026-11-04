import type { Ticker } from '../../runtime/Ticker';
import { CanvasPane } from './canvasBase';
import { el } from '../../app/dom';

/** Output scope. Draws the engine's scope buffer, nothing invented here. */
export class Scope {
  readonly root: HTMLElement;
  private pane: CanvasPane;
  private unbind: () => void;
  private buf: Float32Array | null = null;

  constructor(moduleId: number, ticker: Ticker) {
    this.root = el('div', 'scope-pane');
    this.root.dataset.testid = `scope-${moduleId}`;
    const head = el('div', 'pane-head');
    head.append(el('span', '', 'SCOPE'));
    this.pane = new CanvasPane('scope-canvas');
    this.root.append(head, this.pane.root);
    this.unbind = ticker.bind(moduleId, t => {
      const b = t.scope[moduleId];
      if (b) this.buf = b;
      this.draw();
    });
  }

  private draw(): void {
    const { ctx } = this.pane;
    const w = this.pane.width, h = this.pane.height;
    if (!w || !h) { this.pane.resize(); return; }
    this.pane.clear();
    const mid = h / 2;
    ctx.strokeStyle = this.pane.token('--line', '#d9d8d2');
    ctx.setLineDash([2, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
    ctx.setLineDash([]);
    const b = this.buf;
    if (!b || !b.length) return;
    ctx.strokeStyle = this.pane.token('--ink', '#393b39');
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < b.length; i++) {
      const x = (i / (b.length - 1)) * w;
      const y = mid - b[i]! * (mid - 2);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  destroy(): void { this.unbind(); this.pane.destroy(); }
}
