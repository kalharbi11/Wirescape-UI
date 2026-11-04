import type { Ticker } from '../../runtime/Ticker';
import { CanvasPane } from './canvasBase';
import { el } from '../../app/dom';

export interface EnvelopeOptions {
  moduleId: number;
  ticker: Ticker;
  /** Current stage times in seconds; `sustain` is a level 0..1. */
  shape(): { attack: number; decay: number; sustain: number; release: number };
}

/** Envelope card: the curve, with a marker showing the live position. */
export class EnvelopeCurve {
  readonly root: HTMLElement;
  private pane: CanvasPane;
  private unbind: () => void;
  private level = 0;

  constructor(private readonly o: EnvelopeOptions) {
    this.root = el('div', 'env-pane');
    this.root.dataset.testid = `envelope-${o.moduleId}`;
    const head = el('div', 'pane-head');
    head.append(el('span', '', 'ENVELOPE'));
    this.pane = new CanvasPane('env-canvas');
    this.root.append(head, this.pane.root);
    this.unbind = o.ticker.bind(o.moduleId, t => {
      const v = t.envelope[o.moduleId];
      if (v !== undefined) this.level = v;
      this.draw();
    });
  }

  private draw(): void {
    const { ctx } = this.pane;
    const w = this.pane.width, h = this.pane.height;
    if (!w || !h) { this.pane.resize(); return; }
    this.pane.clear();
    const s = this.o.shape();
    const pad = 4;
    const top = pad, bottom = h - pad;
    const span = Math.max(0.05, s.attack + s.decay + 0.35 + s.release);
    const x = (t: number) => pad + (t / span) * (w - pad * 2);
    const y = (v: number) => bottom - v * (bottom - top);

    ctx.strokeStyle = this.pane.token('--hair', '#e9e7e1');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, bottom + 0.5); ctx.lineTo(w, bottom + 0.5); ctx.stroke();

    ctx.strokeStyle = this.pane.token('--ink', '#393b39');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x(0), y(0));
    ctx.lineTo(x(s.attack), y(1));
    ctx.lineTo(x(s.attack + s.decay), y(s.sustain));
    ctx.lineTo(x(s.attack + s.decay + 0.35), y(s.sustain));
    ctx.lineTo(x(span), y(0));
    ctx.stroke();

    // Live marker: height is the engine's envelope value.
    const my = y(this.level);
    ctx.fillStyle = this.pane.token('--accent', '#c5774c');
    ctx.beginPath(); ctx.arc(w - pad - 2, my, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = this.pane.token('--accent-soft', '#dec2ac');
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(pad, my); ctx.lineTo(w - pad - 6, my); ctx.stroke();
    ctx.setLineDash([]);
  }

  destroy(): void { this.unbind(); this.pane.destroy(); }
}
