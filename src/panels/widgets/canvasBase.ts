import { el } from '../../app/dom';

/** Live displays draw on a small canvas, never hundreds of SVG nodes. */
export class CanvasPane {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private ro: ResizeObserver;

  constructor(cls: string, private readonly maxDpr = 2) {
    this.root = el('div', cls);
    this.canvas = el('canvas') as HTMLCanvasElement;
    this.root.append(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: true })!;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.root);
  }

  get width(): number { return this.w }
  get height(): number { return this.h }

  resize(): void {
    const r = this.root.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.dpr = Math.min(this.maxDpr, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.canvas.style.width = `${r.width}px`;
    this.canvas.style.height = `${r.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  clear(): void { this.ctx.clearRect(0, 0, this.w, this.h); }
  destroy(): void { this.ro.disconnect(); }

  /** Resolve a CSS token to a usable colour string. */
  token(name: string, fallback = '#000'): string {
    const v = getComputedStyle(this.root).getPropertyValue(name).trim();
    return v || fallback;
  }
}
