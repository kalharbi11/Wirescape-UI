import type { Ticker } from '../../runtime/Ticker';
import { CanvasPane } from './canvasBase';
import { el } from '../../app/dom';

export interface WaveOptions {
  moduleId: number;
  ticker: Ticker;
  /** Called at draw time for the current shape parameters. */
  shape(): { depth: number; offset: number; rateLabel: string };
}

/**
 * LFO card: the waveform preview with a phase dot driven by the engine's
 * real phase value. No CSS animation is involved.
 */
export class WavePreview {
  readonly root: HTMLElement;
  private pane: CanvasPane;
  private rate: HTMLElement;
  private unbind: () => void;
  private phase = 0;

  constructor(private readonly o: WaveOptions) {
    this.root = el('div', 'wave-pane');
    this.root.dataset.testid = `wave-${o.moduleId}`;
    const head = el('div', 'pane-head');
    this.rate = el('span', 'pane-head-right', '');
    head.append(el('span', '', 'CONTROL SIGNAL'), this.rate);
    this.pane = new CanvasPane('wave-canvas');
    this.root.append(head, this.pane.root);
    this.unbind = o.ticker.bind(o.moduleId, t => {
      const p = t.phase[o.moduleId];
      if (p !== undefined) this.phase = p;
      this.draw();
    });
  }

  private draw(): void {
    const { ctx } = this.pane;
    const w = this.pane.width, h = this.pane.height;
    if (!w || !h) { this.pane.resize(); return; }
    const s = this.o.shape();
    this.rate.textContent = s.rateLabel;
    this.pane.clear();
    const mid = h / 2;
    const amp = (h / 2 - 6) * Math.max(0.02, Math.min(1, Math.abs(s.depth)));
    const offsetPx = -s.offset * (h / 2 - 6);

    ctx.strokeStyle = this.pane.token('--line', '#d9d8d2');
    ctx.setLineDash([2, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
    ctx.setLineDash([]);

    const cycles = 2;
    const at = (x: number) => mid + offsetPx - Math.sin(x * cycles * Math.PI * 2) * amp;
    ctx.strokeStyle = this.pane.token('--ink', '#393b39');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= w; i++) {
      const y = at(i / w);
      i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
    }
    ctx.stroke();

    // Phase dot — the engine's phase, mapped onto the first drawn cycle.
    const px = (this.phase % 1) * (w / cycles);
    const py = at(px / w);
    ctx.fillStyle = this.pane.token('--accent', '#c5774c');
    ctx.beginPath(); ctx.arc(px, py, 3.2, 0, Math.PI * 2); ctx.fill();
  }

  destroy(): void { this.unbind(); this.pane.destroy(); }
}
