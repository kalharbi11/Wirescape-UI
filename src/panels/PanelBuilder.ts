import type { ModuleDescriptor, ModuleParam } from '../modules/types';
import type { Connection } from '../patch/types';
import type { PatchDoc } from '../patch/PatchDoc';
import type { Ticker } from '../runtime/Ticker';
import type { ModuleRegistry } from '../modules/registry';
import { findParam, formatValue } from '../modules/registry';
import { resolveLayout, type PanelOverride, type ResolvedLayout } from './layouts';
import { el } from '../app/dom';
import { Knob } from './widgets/Knob';
import { Segmented } from './widgets/Segmented';
import { Selector } from './widgets/Selector';
import { Toggle } from './widgets/Toggle';
import { Meter } from './widgets/Meter';
import { Scope } from './widgets/Scope';
import { WavePreview } from './widgets/WavePreview';
import { EnvelopeCurve } from './widgets/EnvelopeCurve';
import { StepsPane } from './widgets/StepsPane';

export interface PanelHost {
  doc: PatchDoc;
  ticker: Ticker;
  registry: ModuleRegistry;
  /** Write a parameter through the engine; rolls back if it refuses. */
  commitParam(moduleId: number, paramId: string, value: number, commit: boolean): void;
  commitModAmount(c: Connection, amount: number, commit: boolean): void;
  describeSource(c: Connection): string;
}

interface Widget { root: HTMLElement; refresh(): void; destroy(): void }

/**
 * Builds a module's panel from its descriptor. No module-specific code
 * lives here: a new entry in the catalogue gets a working panel with no
 * change to this file.
 */
export class Panel {
  readonly root: HTMLElement;
  readonly layout: ResolvedLayout;
  private widgets = new Map<string, Widget>();
  private panes: { destroy(): void }[] = [];

  constructor(
    private readonly host: PanelHost,
    private readonly moduleId: number,
    private readonly d: ModuleDescriptor,
    ov: PanelOverride | undefined,
  ) {
    this.layout = resolveLayout(d, ov);
    this.root = el('div', 'panel-core');

    for (const pane of this.layout.panes) this.buildPane(pane);

    for (const s of this.layout.sections) {
      if (s.label) this.root.append(sectionLabel(s.label));
      const cols = s.columns ?? (s.hero ? 3 : 4);
      const allRows = s.params.every(id => this.layout.widgets[id] !== 'knob');
      const grid = el('div', `panel-grid${s.hero ? ' hero' : ''}${allRows ? ' rows' : ''}`);
      grid.style.gridTemplateColumns = allRows ? '1fr' : `repeat(${cols}, minmax(0,1fr))`;
      for (const id of s.params) {
        const p = findParam(d, id);
        if (!p) continue;
        const w = this.buildWidget(p, !s.hero);
        if (w) { this.widgets.set(id, w); grid.append(w.root); }
      }
      this.root.append(grid);
    }
  }

  /** Re-read every value from the document (after undo, load, or refusal). */
  refresh(): void { for (const w of this.widgets.values()) w.refresh(); }
  /** Repaint one parameter's widget, if it has one. */
  refreshParam(id: string): void { this.widgets.get(id)?.refresh(); }

  destroy(): void {
    for (const w of this.widgets.values()) w.destroy();
    for (const p of this.panes) p.destroy();
  }

  private value(p: ModuleParam): number {
    return this.host.doc.param(this.moduleId, p.id) ?? p.default;
  }

  private buildWidget(p: ModuleParam, small: boolean): Widget | null {
    const kind = this.layout.widgets[p.id] ?? 'knob';
    const label = this.layout.short[p.id] ?? p.name;
    const named: ModuleParam = { ...p, name: label };
    const get = () => this.value(p);
    const set = (v: number, commit = true) => this.host.commitParam(this.moduleId, p.id, v, commit);

    switch (kind) {
      case 'segmented':
        return new Segmented({ param: named, moduleId: this.moduleId, getValue: get, setValue: v => set(v) });
      case 'select':
        return new Selector({ param: named, moduleId: this.moduleId, getValue: get, setValue: v => set(v) });
      case 'toggle':
        return new Toggle({ param: named, moduleId: this.moduleId, getValue: get, setValue: v => set(v) });
      case 'readout': {
        const root = el('div', 'control-row');
        const val = el('div', 'control-readout');
        root.append(el('div', 'control-caption', label), val);
        const refresh = () => {
          const f = formatValue(p, get());
          val.textContent = f.unit ? `${f.text} ${f.unit}` : f.text;
        };
        refresh();
        return { root, refresh, destroy() { /* static */ } };
      }
      default:
        return new Knob({
          param: named,
          moduleId: this.moduleId,
          small,
          ticker: this.host.ticker,
          getValue: get,
          setValue: (v, commit) => set(v, commit),
          getMods: () => this.host.doc.modsInto(this.moduleId, p.id),
          setModAmount: (c, a, commit) => this.host.commitModAmount(c, a, commit),
          describeSource: c => this.host.describeSource(c),
        });
    }
  }

  private buildPane(kind: string): void {
    const id = this.moduleId, ticker = this.host.ticker;
    switch (kind) {
      case 'wave': {
        const w = new WavePreview({
          moduleId: id, ticker,
          shape: () => {
            const depth = this.host.doc.param(id, 'depth') ?? 1;
            const offset = this.host.doc.param(id, 'offset') ?? 0;
            const sync = (this.host.doc.param(id, 'sync') ?? 0) >= 0.5;
            const rate = this.host.doc.param(id, 'rate') ?? 1;
            const beats = this.host.doc.param(id, 'beats') ?? 1;
            return {
              depth, offset,
              rateLabel: sync ? `${trim(beats)} beats / cycle` : `${trim(rate)} Hz`,
            };
          },
        });
        this.panes.push(w); this.root.append(w.root); break;
      }
      case 'envelope': {
        const w = new EnvelopeCurve({
          moduleId: id, ticker,
          shape: () => ({
            attack: this.host.doc.param(id, 'attack') ?? this.host.doc.param(id, 'rise') ?? 0.01,
            decay: this.host.doc.param(id, 'decay') ?? this.host.doc.param(id, 'fall') ?? 0.1,
            sustain: this.host.doc.param(id, 'sustain') ?? 1,
            release: this.host.doc.param(id, 'release') ?? this.host.doc.param(id, 'fall') ?? 0.2,
          }),
        });
        this.panes.push(w); this.root.append(w.root); break;
      }
      case 'meter': {
        const w = new Meter(id, ticker); this.panes.push(w); this.root.append(w.root); break;
      }
      case 'scope': {
        const w = new Scope(id, ticker); this.panes.push(w); this.root.append(w.root); break;
      }
      case 'steps': {
        const w = new StepsPane({
          moduleId: id, ticker, steps: 8,
          param: pid => findParam(this.d, pid),
          getValue: pid => this.host.doc.param(id, pid) ?? findParam(this.d, pid)?.default ?? 0,
          setValue: (pid, v) => this.host.commitParam(id, pid, v, true),
        });
        this.panes.push(w); this.root.append(w.root); break;
      }
    }
  }
}

function sectionLabel(text: string): HTMLElement {
  const e = el('div', 'section-label');
  e.append(el('span', '', text));
  return e;
}

const trim = (n: number) => (Math.round(n * 100) / 100).toString();
