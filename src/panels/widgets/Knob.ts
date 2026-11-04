import type { ModuleParam } from '../../modules/types';
import type { Connection } from '../../patch/types';
import { formatValue, formatRange, normToValue, valueToNorm, quantize } from '../../modules/registry';
import type { Ticker } from '../../runtime/Ticker';
import { el, svgEl } from '../../app/dom';

/** Knob sweep: -135deg (minimum) to +135deg (maximum). */
const SWEEP = 270;
const START = -135;
const R_VALUE = 43;   // value ring radius, in the 100x100 viewBox
const R_MOD = 48;     // first modulation arc sits outside the value ring
const R_STEP = 5;     // each further modulation arc steps outward

export interface KnobOptions {
  param: ModuleParam;
  moduleId: number;
  small?: boolean;
  getValue(): number;
  /** `commit` is false during a drag and true when the gesture ends. */
  setValue(v: number, commit: boolean): void;
  getMods(): Connection[];
  setModAmount(c: Connection, amount: number, commit: boolean): void;
  describeSource(c: Connection): string;
  ticker: Ticker;
}

export class Knob {
  readonly root: HTMLElement;
  private readonly dial: HTMLButtonElement;
  private readonly rotor: HTMLElement;
  private readonly readout: HTMLButtonElement;
  private readonly ringValue: SVGPathElement;
  private readonly modGroup: SVGGElement;
  private readonly marker: SVGGElement;
  private readonly labelEl: HTMLElement;
  private unbind: () => void;
  private live: number;

  constructor(private readonly o: KnobOptions) {
    const p = o.param;
    this.live = o.getValue();

    this.root = el('div', `knob-unit${o.small ? ' small' : ''}`);
    this.root.dataset.param = p.id;
    this.root.dataset.modulatable = String(p.modulatable);
    this.root.dataset.testid = `knob-${o.moduleId}-${p.id}`;

    const wrap = el('div', 'dial-wrap');
    const svg = svgEl('svg', { class: 'knob-rings', viewBox: '0 0 100 100', 'aria-hidden': 'true' });
    svg.append(svgEl('path', { class: 'ring-track', d: arc(R_VALUE, 0, 1) }));
    this.ringValue = svgEl('path', { class: 'ring-value', d: '' });
    this.modGroup = svgEl('g', { class: 'mod-arcs' });
    this.marker = svgEl('g', { class: 'live-marker' });
    this.marker.append(svgEl('circle', { cx: '50', cy: String(50 - R_MOD), r: '2.6' }));
    svg.append(this.ringValue, this.modGroup, this.marker);

    this.dial = el('button', 'knob') as HTMLButtonElement;
    this.dial.type = 'button';
    this.rotor = el('span', 'knob-rotor');
    this.rotor.append(el('span', 'knob-pointer'));
    this.dial.append(this.rotor);
    this.dial.setAttribute('role', 'slider');
    this.dial.setAttribute('aria-label', p.name);
    this.dial.setAttribute('aria-valuemin', String(p.minimum));
    this.dial.setAttribute('aria-valuemax', String(p.maximum));

    wrap.append(svg, this.dial);

    this.labelEl = el('div', 'control-label', p.name);
    this.readout = el('button', 'control-readout') as HTMLButtonElement;
    this.readout.type = 'button';
    this.readout.dataset.testid = `readout-${o.moduleId}-${p.id}`;
    this.readout.title = 'Click to type a value';

    const labels = el('div', 'knob-labels');
    labels.append(this.labelEl, this.readout);
    this.root.append(wrap, labels);

    this.attachDrag();
    this.attachKeys();
    this.attachWheel();
    this.dial.addEventListener('dblclick', e => {
      e.preventDefault();
      this.o.setValue(p.default, true);
      this.refresh();
    });
    this.readout.addEventListener('click', () => this.promptValue());

    this.refresh();
    this.unbind = o.ticker.bind(o.moduleId, t => {
      const v = t.effective[o.moduleId]?.[p.id];
      if (v === undefined || v === this.live) return;
      this.live = v;
      this.paintLive();
    });
  }

  destroy(): void { this.unbind(); }

  /** Re-read base value and modulation and repaint everything. */
  refresh(): void {
    const p = this.o.param;
    const base = this.o.getValue();
    const n = valueToNorm(p, base);

    // Value ring: from the parameter's natural origin to the set value.
    const origin = p.minimum < 0 && p.maximum > 0 ? valueToNorm(p, 0) : 0;
    this.ringValue.setAttribute('d', arc(R_VALUE, Math.min(origin, n), Math.max(origin, n)));

    const mods = this.o.getMods();
    this.root.classList.toggle('has-mod', mods.length > 0);
    this.modGroup.replaceChildren();
    let total = 0;
    mods.forEach((c, i) => {
      const amt = c.amount ?? 0;
      total += amt;
      const r = R_MOD + i * R_STEP;
      const to = clamp01(n + amt);
      const path = svgEl('path', {
        class: `mod-arc${amt < 0 ? ' negative' : ''}`,
        d: arc(r, Math.min(n, to), Math.max(n, to)),
      });
      const handle = svgEl('circle', {
        class: 'mod-handle', r: '3.4',
        ...pointAt(r, to), 'data-mod-index': String(i),
      });
      handle.setAttribute('tabindex', '0');
      this.attachModDrag(handle, c, n);
      this.modGroup.append(path, handle);
    });
    this.root.classList.toggle('mod-active', mods.length > 0);
    this.marker.style.display = mods.length ? '' : 'none';
    this.markerRadius = R_MOD + Math.max(0, mods.length - 1) * R_STEP;
    this.marker.querySelector('circle')!.setAttribute('cy', String(50 - this.markerRadius));
    this.modTotal = total;

    this.modCount = mods.length;
    this.live = base;
    this.paintBase(base);
    this.paintLive();
    this.updateTooltip(base, mods);
  }

  private markerRadius = R_MOD;
  private modTotal = 0;
  private modCount = 0;

  /**
   * Per-frame path. Transform writes only (Pi rule 1).
   *
   * The needle and the ring marker carry the live, post-modulation value;
   * the readout keeps showing the value the user set, so the number stays
   * readable and typing into it starts from what you chose.
   */
  private paintLive(): void {
    const p = this.o.param;
    const deg = START + valueToNorm(p, this.live) * SWEEP;
    this.rotor.style.transform = `rotate(${deg}deg)`;
    this.marker.style.transform = `rotate(${deg}deg)`;
    if (this.modCount) this.root.dataset.live = String(round(this.live));
  }

  /** Readout and ARIA: the set value, repainted only when it changes. */
  private paintBase(base: number): void {
    const p = this.o.param;
    const f = formatValue(p, base);
    this.readout.textContent = f.unit ? `${f.text} ${f.unit}` : f.text;
    this.dial.setAttribute('aria-valuenow', String(round(base)));
    this.dial.setAttribute('aria-valuetext', this.readout.textContent);
  }

  private updateTooltip(base: number, mods: Connection[]): void {
    const p = this.o.param;
    const f = formatValue(p, base);
    const lines = [
      `${p.name}  ${f.text}${f.unit ? ' ' + f.unit : ''}`,
      `Range ${formatRange(p)}`,
    ];
    if (mods.length) {
      lines.push(`Modulated by ${mods.map(c => `${this.o.describeSource(c)} (${signed(c.amount ?? 0)})`).join(', ')}`);
    } else if (p.modulatable) {
      lines.push('Drop a cable here to modulate');
    }
    lines.push('Drag to change · shift for fine · double-click resets');
    this.dial.title = lines.join('\n');
    this.root.dataset.modCount = String(mods.length);
    this.labelEl.classList.toggle('modulated', mods.length > 0);
    void this.modTotal;
  }

  // ---- gestures ---------------------------------------------------------

  private attachDrag(): void {
    const p = this.o.param;
    this.dial.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      this.dial.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startNorm = valueToNorm(p, this.o.getValue());
      this.root.classList.add('dragging');

      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        // 180px of travel covers the full range; shift makes it 5x finer.
        const scale = (ev.shiftKey ? 0.2 : 1) / 180;
        const n = clamp01(startNorm + (startY - ev.clientY) * scale);
        this.o.setValue(normToValue(p, n), false);
        this.refresh();
      };
      const up = () => {
        this.dial.removeEventListener('pointermove', move);
        this.dial.removeEventListener('pointerup', up);
        this.dial.removeEventListener('pointercancel', up);
        this.root.classList.remove('dragging');
        this.o.setValue(this.o.getValue(), true);
      };
      this.dial.addEventListener('pointermove', move);
      this.dial.addEventListener('pointerup', up);
      this.dial.addEventListener('pointercancel', up);
    });
  }

  private attachModDrag(handle: SVGCircleElement, c: Connection, baseNorm: number): void {
    handle.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const start = c.amount ?? 0;
      const move = (ev: PointerEvent) => {
        const scale = (ev.shiftKey ? 0.2 : 1) / 180;
        const amt = Math.max(-1, Math.min(1, start + (startY - ev.clientY) * scale));
        this.o.setModAmount(c, amt, false);
        this.refresh();
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        this.o.setModAmount(c, c.amount ?? 0, true);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
    void baseNorm;
  }

  private attachKeys(): void {
    const p = this.o.param;
    this.dial.addEventListener('keydown', e => {
      const keys = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Home', 'End', 'PageUp', 'PageDown'];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      const n = valueToNorm(p, this.o.getValue());
      const fine = e.shiftKey ? 0.002 : 0.01;
      const coarse = 0.1;
      let next = n;
      switch (e.key) {
        case 'ArrowUp': case 'ArrowRight': next = n + fine; break;
        case 'ArrowDown': case 'ArrowLeft': next = n - fine; break;
        case 'PageUp': next = n + coarse; break;
        case 'PageDown': next = n - coarse; break;
        case 'Home': next = 0; break;
        case 'End': next = 1; break;
      }
      this.o.setValue(normToValue(p, clamp01(next)), true);
      this.refresh();
    });
  }

  private attachWheel(): void {
    const p = this.o.param;
    this.dial.addEventListener('wheel', e => {
      e.preventDefault(); e.stopPropagation();
      const n = valueToNorm(p, this.o.getValue());
      const delta = (e.deltaY > 0 ? -1 : 1) * (e.shiftKey ? 0.004 : 0.02);
      this.o.setValue(normToValue(p, clamp01(n + delta)), true);
      this.refresh();
    }, { passive: false });
  }

  private promptValue(): void {
    const p = this.o.param;
    const input = el('input', 'readout-input') as HTMLInputElement;
    input.value = String(round(this.o.getValue()));
    input.dataset.testid = `readout-input-${this.o.moduleId}-${p.id}`;
    input.setAttribute('aria-label', `${p.name} value`);
    this.readout.replaceWith(input);
    input.focus(); input.select();
    const finish = (apply: boolean) => {
      if (apply) {
        const v = Number(input.value.replace(/[^0-9eE+\-.]/g, ''));
        if (Number.isFinite(v)) this.o.setValue(quantize(p, v), true);
      }
      input.replaceWith(this.readout);
      this.refresh();
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  }
}

/* ---- arc geometry ------------------------------------------------------ */

function pointAt(r: number, t: number): { cx: string; cy: string } {
  const a = ((START + t * SWEEP) * Math.PI) / 180;
  return { cx: (50 + r * Math.sin(a)).toFixed(2), cy: (50 - r * Math.cos(a)).toFixed(2) };
}

function arc(r: number, t0: number, t1: number): string {
  if (t1 - t0 < 0.0005) {
    const p = pointAt(r, t0);
    return `M${p.cx},${p.cy} L${p.cx},${p.cy}`;
  }
  const a = pointAt(r, t0), b = pointAt(r, t1);
  const large = (t1 - t0) * SWEEP > 180 ? 1 : 0;
  return `M${a.cx},${a.cy} A${r},${r} 0 ${large} 1 ${b.cx},${b.cy}`;
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const signed = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2);
