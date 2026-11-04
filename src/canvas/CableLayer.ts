import type { Connection } from '../patch/types';
import { connKey } from '../patch/types';
import { svgEl } from '../app/dom';

export interface Point { x: number; y: number }

export interface CableStyle {
  color: string;
  /** Poly cables are drawn thicker. */
  poly: boolean;
  kind: Connection['kind'];
  /** Signal kind from the port descriptor, for dash patterns. */
  hint: string;
  feedback: boolean;
  /** Set when this cable is one half of a stereo pair. */
  stereo: boolean;
}

export interface Resolved { from: Point; to: Point; style: CableStyle }

export type Resolver = (c: Connection) => Resolved | null;

interface Entry { group: SVGGElement; path: SVGPathElement; hit: SVGPathElement; marker?: SVGPathElement }

/**
 * The cable layer lives *inside* the world transform, so panning and
 * zooming never recompute a path — only a module move, or a change to the
 * connection list, does (Pi rule 3).
 */
export class CableLayer {
  readonly root: SVGSVGElement;
  private entries = new Map<string, Entry>();
  private ghost: SVGPathElement;
  private selected: string | null = null;

  constructor(
    private resolve: Resolver,
    private readonly onSelect: (c: Connection | null) => void,
    private readonly onGrabEnd: (c: Connection, e: PointerEvent) => void,
    private readonly describe: (c: Connection) => string,
  ) {
    this.root = svgEl('svg', { class: 'cable-layer', 'aria-label': 'Connections' });
    this.ghost = svgEl('path', { class: 'cable-ghost' });
    this.root.append(this.ghost);
  }

  setResolver(r: Resolver): void { this.resolve = r; }

  /** Add/remove paths so the DOM matches the connection list, then route. */
  sync(connections: Connection[], feedback: Set<string>): void {
    const live = new Set<string>();
    for (const c of connections) {
      const k = connKey(c);
      live.add(k);
      if (!this.entries.has(k)) this.create(k, c);
    }
    for (const [k, e] of this.entries) {
      if (!live.has(k)) { e.group.remove(); this.entries.delete(k); }
    }
    this.reroute(connections, feedback);
  }

  /** Recompute geometry. Call after a module moves or a cable changes. */
  reroute(connections: Connection[], feedback: Set<string>): void {
    for (const c of connections) {
      const k = connKey(c);
      const e = this.entries.get(k);
      if (!e) continue;
      const r = this.resolve(c);
      if (!r) { e.group.style.display = 'none'; continue; }
      e.group.style.display = '';
      const d = route(r.from, r.to, r.style.kind === 'modulation');
      e.path.setAttribute('d', d);
      e.hit.setAttribute('d', d);
      e.path.setAttribute('stroke', r.style.color);
      e.path.setAttribute('class', cableClass(r.style, feedback.has(k), this.selected === k));
      e.group.dataset.kind = r.style.kind;
      if (feedback.has(k)) {
        if (!e.marker) {
          e.marker = svgEl('path', { class: 'cable-feedback' });
          e.group.append(e.marker);
        }
        const mid = midpoint(r.from, r.to);
        e.marker.setAttribute('d', feedbackMark(mid));
        e.marker.setAttribute('stroke', r.style.color);
      } else if (e.marker) { e.marker.remove(); delete e.marker; }
      e.hit.setAttribute('aria-label', this.describe(c));
      const title = e.group.querySelector('title');
      if (title) title.textContent = this.describe(c);
    }
  }

  private create(k: string, c: Connection): void {
    const group = svgEl('g', { class: 'cable-group' });
    group.dataset.key = k;
    group.dataset.testid = `cable-${k}`;
    const path = svgEl('path', { class: 'cable' });
    const hit = svgEl('path', { class: 'cable-hit' });
    const title = svgEl('title');
    hit.append(title);
    hit.addEventListener('pointerdown', e => {
      e.stopPropagation();
      // Near the destination end, grab the cable instead of selecting it.
      const r = this.resolve(c);
      if (r && c.kind !== 'modulation') {
        const p = pointerWorld(e, this.root);
        if (p && dist(p, r.to) < 22) { this.onGrabEnd(c, e); return; }
      }
      this.onSelect(c);
    });
    group.append(path, hit);
    this.root.append(group);
    this.entries.set(k, { group, path, hit });
  }

  select(c: Connection | null, connections: Connection[], feedback: Set<string>): void {
    this.selected = c ? connKey(c) : null;
    this.reroute(connections, feedback);
  }

  setGhost(from: Point | null, to: Point | null, invalid = false): void {
    if (!from || !to) { this.ghost.setAttribute('d', ''); return; }
    this.ghost.setAttribute('d', route(from, to, false));
    this.ghost.classList.toggle('invalid', invalid);
  }

  clear(): void {
    for (const e of this.entries.values()) e.group.remove();
    this.entries.clear();
  }
}

/* ---- geometry ---------------------------------------------------------- */

export function route(a: Point, b: Point, toParam: boolean): string {
  const dx = b.x - a.x;
  const reach = Math.min(190, Math.max(44, Math.abs(dx) * 0.42));
  if (toParam) {
    // Modulation cables approach a knob from the left with a shorter tail.
    const r2 = Math.min(90, Math.max(28, Math.abs(dx) * 0.3));
    return `M${a.x},${a.y} C${a.x + reach},${a.y} ${b.x - r2},${b.y} ${b.x},${b.y}`;
  }
  return `M${a.x},${a.y} C${a.x + reach},${a.y} ${b.x - reach},${b.y} ${b.x},${b.y}`;
}

function cableClass(s: CableStyle, feedback: boolean, selected: boolean): string {
  return [
    'cable',
    `kind-${s.kind}`,
    `hint-${s.hint}`,
    s.poly ? 'poly' : '',
    s.stereo ? 'stereo' : '',
    feedback ? 'feedback' : '',
    selected ? 'selected' : '',
  ].filter(Boolean).join(' ');
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** A small chevron pointing back upstream. */
function feedbackMark(p: Point): string {
  const s = 5;
  return `M${p.x + s},${p.y - s} L${p.x - s},${p.y} L${p.x + s},${p.y + s}`;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function pointerWorld(e: PointerEvent, svg: SVGSVGElement): Point | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const w = pt.matrixTransform(ctm.inverse());
  return { x: w.x, y: w.y };
}
