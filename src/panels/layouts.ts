import type { ModuleDescriptor } from '../modules/types';
import { inputs, outputs, isChoice, isToggle, hasChoices, SEGMENT_LIMIT } from '../modules/registry';

export type WidgetKind = 'knob' | 'segmented' | 'toggle' | 'readout' | 'select';
export type PaneKind = 'wave' | 'envelope' | 'meter' | 'scope' | 'steps';

export interface PanelSection {
  label?: string;
  /** Hero sections get full-size knobs; others get the small size. */
  hero?: boolean;
  /** Knobs per row. Defaults to 3 for hero sections, 4 otherwise. */
  columns?: number;
  params: string[];
}

/**
 * A `panels/<module-id>.json` override. Everything is optional: a module
 * with no override still gets a complete working panel.
 */
export interface PanelOverride {
  width?: number;
  sections?: PanelSection[];
  /** Shorter labels for cramped knobs. */
  short?: Record<string, string>;
  widgets?: Record<string, WidgetKind>;
  panes?: PaneKind[];
  /** Parameters to leave off the card (still saved, still modulatable). */
  hidden?: string[];
}

export interface ResolvedLayout {
  width: number;
  height: number;
  gutterIn: number;
  gutterOut: number;
  sections: PanelSection[];
  short: Record<string, string>;
  widgets: Record<string, WidgetKind>;
  panes: PaneKind[];
}

/* ---- geometry constants (recorded in DESIGN.md) ----------------------- */
const HEADER_H = 82;
const BODY_PAD_Y = 22;
const PORT_TOP_BASE = 70;
const PORT_PITCH_BASE = 31;
const PORT_BOTTOM_PAD = 26;
const HERO_CELL_H = 124;
const SMALL_CELL_H = 88;
const SECTION_LABEL_H = 28;
const PANE_H: Record<PaneKind, number> = { wave: 104, envelope: 96, meter: 56, scope: 92, steps: 150 };
const CORE_MIN_W = 232;
const KNOB_CELL_W = 112;
const SMALL_CELL_W = 92;

/**
 * Touch enlarges knobs and port jacks through CSS tokens, so the numbers the
 * layout reasons about have to grow with them or cards overflow their own
 * height. These are `let` so an ESM import of them stays live.
 */
export let portPitch = PORT_PITCH_BASE;
export let portTop = PORT_TOP_BASE;
let cellScale = 1;

export function setDensity(hit: 'mouse' | 'touch'): void {
  const touch = hit === 'touch';
  portPitch = touch ? 40 : PORT_PITCH_BASE;
  portTop = touch ? 78 : PORT_TOP_BASE;
  cellScale = touch ? 1.14 : 1;
}

/**
 * Pick a widget for a parameter from its own shape: a two-way on/off pair
 * is a switch, a short list of labels is segmented, a long one is a
 * dropdown, a single fixed label is just a readout, everything else is a
 * knob.
 */
function defaultWidget(p: import('../modules/types').ModuleParam): WidgetKind {
  if (isToggle(p)) return 'toggle';
  if (isChoice(p)) return p.choices!.length > SEGMENT_LIMIT ? 'select' : 'segmented';
  if (hasChoices(p)) return 'readout';
  return 'knob';
}

/** Width a port gutter needs for its longest label. */
function gutter(labels: string[]): number {
  const longest = labels.reduce((n, s) => Math.max(n, s.length), 0);
  return Math.round(Math.min(196, Math.max(104, 40 + longest * 6.4)));
}

/**
 * Resolve a module descriptor plus an optional override into a concrete
 * card layout. Width is per-type (from the override, else derived from the
 * module's own ports and controls); height is always derived from content,
 * so a new module in the catalogue can never be clipped.
 */
export function resolveLayout(d: ModuleDescriptor, ov: PanelOverride | undefined): ResolvedLayout {
  const hidden = new Set(ov?.hidden ?? []);
  const visible = d.parameters.filter(p => !hidden.has(p.id));

  const widgets: Record<string, WidgetKind> = {};
  for (const p of visible) {
    widgets[p.id] = ov?.widgets?.[p.id] ?? defaultWidget(p);
  }

  let sections: PanelSection[] = ov?.sections
    ? ov.sections.map(s => ({ ...s, params: s.params.filter(id => !hidden.has(id) && visible.some(p => p.id === id)) }))
        .filter(s => s.params.length)
    : autoSections(visible.map(p => p.id), widgets);

  // Any parameter the override forgot still gets a home, so the panel can
  // never silently drop a control.
  const placed = new Set(sections.flatMap(s => s.params));
  const orphans = visible.filter(p => !placed.has(p.id)).map(p => p.id);
  if (orphans.length) sections = [...sections, { label: 'MORE', params: orphans }];

  const panes = ov?.panes ?? [];
  const gutterIn = inputs(d).length ? gutter(inputs(d).map(p => p.name)) : 34;
  const gutterOut = outputs(d).length ? gutter(outputs(d).map(p => p.name)) : 34;

  // Core width: widest section's column count decides it.
  let coreW = CORE_MIN_W;
  for (const s of sections) {
    const cols = s.columns ?? (s.hero ? 3 : 4);
    const n = Math.min(cols, s.params.length);
    const knobLike = s.params.some(id => widgets[id] === 'knob');
    const cell = (s.hero ? KNOB_CELL_W : SMALL_CELL_W) * cellScale;
    coreW = Math.max(coreW, knobLike ? n * cell : 260);
  }
  const width = Math.round((ov?.width ?? gutterIn + gutterOut + coreW) * (cellScale > 1 ? 1.06 : 1));

  // Core height.
  let coreH = 0;
  for (const s of sections) {
    const cols = s.columns ?? (s.hero ? 3 : 4);
    const rows = Math.ceil(s.params.length / cols);
    const rowH = (s.hero ? HERO_CELL_H : SMALL_CELL_H) * cellScale;
    const allRows = s.params.every(id => widgets[id] !== 'knob');
    coreH += (s.label ? SECTION_LABEL_H : 0) + rows * (allRows ? 44 * cellScale : rowH);
  }
  for (const p of panes) coreH += PANE_H[p] + 14;

  const portRows = Math.max(inputs(d).length, outputs(d).length);
  const portsH = portRows ? portTop + (portRows - 1) * portPitch + PORT_BOTTOM_PAD : 0;
  const height = Math.round(HEADER_H + BODY_PAD_Y * 2 + Math.max(coreH, portsH, 150));

  return { width, height, gutterIn, gutterOut, sections, short: ov?.short ?? {}, widgets, panes };
}

/** Group parameters into sections when no override says how. */
function autoSections(ids: string[], widgets: Record<string, WidgetKind>): PanelSection[] {
  const knobs = ids.filter(id => widgets[id] === 'knob');
  const rest = ids.filter(id => widgets[id] !== 'knob');
  const out: PanelSection[] = [];
  if (knobs.length) {
    // First row of up to three becomes the hero row; the remainder goes small.
    out.push({ label: 'CONTROLS', hero: true, params: knobs.slice(0, 3) });
    if (knobs.length > 3) out.push({ label: 'MORE', params: knobs.slice(3), columns: 4 });
  }
  if (rest.length) out.push({ label: 'MODE', params: rest, columns: 1 });
  return out;
}

export const headerHeight = HEADER_H;

/* ---- override loading -------------------------------------------------- */

export class PanelOverrides {
  private map = new Map<string, PanelOverride>();

  static async load(base = 'panels'): Promise<PanelOverrides> {
    const o = new PanelOverrides();
    try {
      const res = await fetch(`${base}/index.json`);
      if (!res.ok) return o;
      const list = (await res.json()) as string[];
      await Promise.all(list.map(async id => {
        try {
          const r = await fetch(`${base}/${id}.json`);
          if (r.ok) o.map.set(id, (await r.json()) as PanelOverride);
        } catch { /* a missing override is not an error */ }
      }));
    } catch { /* no overrides at all is fine */ }
    return o;
  }

  get(id: string): PanelOverride | undefined { return this.map.get(id); }
}
