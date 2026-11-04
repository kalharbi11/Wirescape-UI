import type { ModuleDescriptor, ModulePort, PortDirection } from '../modules/types';
import { inputs, outputs, hintColor } from '../modules/registry';
import { headerHeight, portPitch, portTop } from '../panels/layouts';
import { Panel, type PanelHost } from '../panels/PanelBuilder';
import type { PanelOverride } from '../panels/layouts';
import { el } from '../app/dom';
import { formatValue } from '../modules/registry';

export interface PortAnchor { x: number; y: number }

/** A port's position in card-local coordinates. Never measured — derived. */
export function anchorFor(dir: PortDirection, index: number, cardWidth: number): PortAnchor {
  return { x: dir === 'input' ? 0 : cardWidth, y: headerHeight + portTop + index * portPitch };
}

export interface CardOptions {
  host: PanelHost;
  moduleId: number;
  descriptor: ModuleDescriptor | null;
  override: PanelOverride | undefined;
  /** Used only for a missing module, to reconstruct its ports. */
  savedType: string;
  onHeaderPointerDown(e: PointerEvent): void;
  onRenameRequest(): void;
}

export class ModuleCard {
  readonly root: HTMLElement;
  readonly panel: Panel | null = null;
  readonly width: number;
  readonly height: number;
  readonly missing: boolean;
  private readonly titleEl: HTMLElement;
  private readonly portEls = new Map<string, HTMLElement>();
  private readonly anchors = new Map<string, PortAnchor>();
  private readonly polyBadge: HTMLElement;

  constructor(private readonly o: CardOptions) {
    const d = o.descriptor;
    this.missing = !d;

    this.root = el('section', `module${this.missing ? ' missing' : ''}`);
    this.root.dataset.id = String(o.moduleId);
    this.root.dataset.type = o.savedType;
    this.root.dataset.testid = `module-${o.moduleId}`;
    this.root.setAttribute('aria-label', `${d?.name ?? o.savedType} module`);

    // ---- header --------------------------------------------------------
    const header = el('div', 'module-header');
    header.dataset.testid = `module-header-${o.moduleId}`;
    const left = el('div', 'module-headline');
    const kind = el('div', 'module-kind', this.missing ? 'UNKNOWN MODULE' : `${d!.category.toUpperCase()}`);
    this.titleEl = el('div', 'module-title');
    const sub = el('div', 'module-sub', this.missing ? o.savedType : d!.id);
    left.append(kind, this.titleEl, sub);

    const right = el('div', 'module-topright');
    this.polyBadge = el('span', 'poly-badge');
    this.polyBadge.dataset.testid = `poly-${o.moduleId}`;
    this.polyBadge.style.display = 'none';
    const idTag = el('span', 'module-code', `#${o.moduleId}`);
    const grip = el('span', 'module-grip');
    for (let i = 0; i < 4; i++) grip.append(el('i'));
    right.append(this.polyBadge, idTag, grip);

    header.append(left, right);
    header.addEventListener('pointerdown', e => o.onHeaderPointerDown(e));
    this.titleEl.addEventListener('dblclick', e => { e.stopPropagation(); o.onRenameRequest(); });
    this.root.append(header);

    // ---- body ----------------------------------------------------------
    const body = el('div', 'module-body');
    const ins = d ? inputs(d) : this.reconstructPorts('input');
    const outs = d ? outputs(d) : this.reconstructPorts('output');

    let coreEl: HTMLElement;
    if (d) {
      this.panel = new Panel(o.host, o.moduleId, d, o.override);
      coreEl = this.panel.root;
      this.width = this.panel.layout.width;
      this.height = this.panel.layout.height;
      body.style.paddingLeft = `${this.panel.layout.gutterIn}px`;
      body.style.paddingRight = `${this.panel.layout.gutterOut}px`;
    } else {
      coreEl = this.buildMissingCore();
      const rows = Math.max(ins.length, outs.length);
      this.width = 480;
      this.height = headerHeight + 44 + Math.max(170, portTop + Math.max(0, rows - 1) * portPitch + 26);
      body.style.paddingLeft = '150px';
      body.style.paddingRight = '150px';
    }

    body.append(coreEl);
    this.buildPorts(body, 'input', ins);
    this.buildPorts(body, 'output', outs);
    this.root.append(body);

    this.root.style.width = `${this.width}px`;
    this.root.style.height = `${this.height}px`;
    this.refreshHeader();
  }

  /** Reconstruct a missing module's ports from the cables that reference it. */
  private reconstructPorts(dir: PortDirection): ModulePort[] {
    const id = this.o.moduleId;
    const names = new Set<string>();
    for (const c of this.o.host.doc.connections) {
      if (dir === 'input' && c.to.module === id && c.kind !== 'modulation') names.add(c.to.port);
      if (dir === 'output' && c.from.module === id) names.add(c.from.port);
    }
    return [...names].map(n => ({
      id: n, name: n, direction: dir, kind: 'signal' as const,
      hint: 'audio', poly: 'poly', stereo_pair: null,
    }));
  }

  private buildMissingCore(): HTMLElement {
    const core = el('div', 'panel-core missing-core');
    core.append(el('div', 'missing-note',
      'This module type is not in the catalogue. Its ports and values are kept exactly as saved.'));
    const m = this.o.host.doc.modules.get(this.o.moduleId);
    const params = Object.entries(m?.parameters ?? {});
    if (params.length) {
      const list = el('div', 'missing-params');
      for (const [k, v] of params) {
        const row = el('div', 'control-row');
        row.append(el('div', 'control-caption', k), el('div', 'control-readout', String(v)));
        list.append(row);
      }
      core.append(list);
    }
    return core;
  }

  private buildPorts(body: HTMLElement, dir: PortDirection, list: ModulePort[]): void {
    if (list.length) {
      const head = el('span', `port-head ${dir}`, dir === 'input' ? 'INPUTS' : 'OUTPUTS');
      body.append(head);
    }
    list.forEach((p, i) => {
      const anchor = anchorFor(dir, i, this.width);
      this.anchors.set(key(dir, p.id), anchor);

      const node = el('div', `port ${dir}`);
      node.dataset.module = String(this.o.moduleId);
      node.dataset.port = p.id;
      node.dataset.direction = dir;
      node.dataset.kind = p.kind;
      node.dataset.hint = String(p.hint);
      node.dataset.poly = String(p.poly);
      if (p.stereo_pair) node.dataset.stereo = p.stereo_pair;
      node.dataset.testid = `port-${this.o.moduleId}-${dir}-${p.id}`;
      node.style.top = `${anchor.y - headerHeight - 13}px`;
      node.title = `${dir === 'input' ? 'Input' : 'Output'}: ${p.name} · ${p.kind} / ${p.hint}`;

      const jack = el('span', 'port-jack');
      jack.style.setProperty('--hint', hintColor(String(p.hint)));
      const dot = el('span', 'port-activity');
      jack.append(dot);
      const label = el('span', 'port-label', p.name);
      node.append(jack, label);
      body.append(node);
      this.portEls.set(key(dir, p.id), node);
    });
  }

  anchor(dir: PortDirection, port: string): PortAnchor | undefined {
    return this.anchors.get(key(dir, port));
  }
  portEl(dir: PortDirection, port: string): HTMLElement | undefined {
    return this.portEls.get(key(dir, port));
  }
  allPorts(): HTMLElement[] { return [...this.portEls.values()] }

  refreshHeader(): void {
    const label = this.o.host.doc.label(this.o.moduleId);
    const base = this.o.descriptor?.name ?? this.o.savedType;
    this.titleEl.textContent = label ?? base;
    this.titleEl.title = label ? `${label} — ${base} · double-click to rename` : 'Double-click to rename';
    this.titleEl.dataset.testid = `module-title-${this.o.moduleId}`;
  }

  /** Poly badge shows the voice count when the module is polyphonic. */
  setPolyVoices(n: number | null): void {
    if (n === null || n <= 1) { this.polyBadge.style.display = 'none'; return; }
    this.polyBadge.style.display = '';
    this.polyBadge.textContent = `${n} VOICES`;
    this.polyBadge.title = 'This module runs polyphonically';
  }

  /** Readouts for a missing module, kept in step with the saved values. */
  refreshMissing(): void {
    if (!this.missing) return;
    const m = this.o.host.doc.modules.get(this.o.moduleId);
    const rows = [...this.root.querySelectorAll<HTMLElement>('.missing-params .control-row')];
    const params = Object.entries(m?.parameters ?? {});
    rows.forEach((row, i) => {
      const v = params[i]?.[1];
      if (v !== undefined) row.querySelector('.control-readout')!.textContent = String(v);
    });
  }

  destroy(): void { this.panel?.destroy(); this.root.remove(); }

  static describeValue = formatValue;
}

const key = (dir: PortDirection, port: string) => `${dir}:${port}`;
