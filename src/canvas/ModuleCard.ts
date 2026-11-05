import type { ModuleDescriptor, ModulePort, PortDirection } from '../modules/types';
import { inputs, outputs, hintColor, findPort, findParam, formatValue } from '../modules/registry';
import { HEADER_H, portMinPitch } from '../panels/layouts';
import { Panel, type PanelHost } from '../panels/PanelBuilder';
import type { PanelOverride } from '../panels/layouts';
import { attachModuleInfo } from '../panels/widgets/InfoBox';
import { el, motionOff } from '../app/dom';

export interface PortAnchor { x: number; y: number }

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

/** Short module code for the header: `VCF`, `LFO`, `MO` (DESIGN §7 header A). */
export function moduleCode(type: string, override?: string): string {
  if (override) return override;
  const last = type.split('.').pop() ?? type;
  const words = last.split('_').filter(Boolean);
  if (words.length > 1) return words.map(w => w[0]).join('').toUpperCase();
  return (last.length <= 4 ? last : last.slice(0, 3)).toUpperCase();
}

/**
 * A module card: header (code · name ……… id · i), the panel, and ports on
 * the side rails, spread evenly along the full height and straddling the
 * edge (DESIGN §7). The height comes from the content and is measured once
 * after the card is in the DOM (`measure()`); port anchors are derived from
 * that height arithmetically and never read again.
 */
export class ModuleCard {
  readonly root: HTMLElement;
  readonly panel: Panel | null = null;
  readonly width: number;
  height = 0;
  readonly missing: boolean;
  private readonly minHeight: number;
  private readonly body: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly ports: { dir: PortDirection; port: ModulePort; node: HTMLElement; index: number; count: number }[] = [];
  private readonly portEls = new Map<string, HTMLElement>();
  private readonly anchors = new Map<string, PortAnchor>();
  private readonly polyBadge: HTMLElement;
  private readonly info: { destroy(): void } | null = null;

  constructor(private readonly o: CardOptions) {
    const d = o.descriptor;
    this.missing = !d;

    this.root = el('section', `module${this.missing ? ' missing' : ''}`);
    this.root.dataset.id = String(o.moduleId);
    this.root.dataset.type = o.savedType;
    this.root.dataset.testid = `module-${o.moduleId}`;
    this.root.setAttribute('aria-label', `${d?.name ?? o.savedType} module`);

    // ---- header: CODE  Name ……… id  i --------------------------------
    const header = el('div', 'module-header');
    header.dataset.testid = `module-header-${o.moduleId}`;
    header.style.height = `${HEADER_H}px`;
    const code = el('span', 'module-code', this.missing ? '?' : moduleCode(d!.id, o.override?.code));
    code.title = this.missing ? o.savedType : d!.id;
    this.titleEl = el('span', 'module-title');
    this.polyBadge = el('span', 'poly-badge');
    this.polyBadge.dataset.testid = `poly-${o.moduleId}`;
    this.polyBadge.style.display = 'none';
    const idTag = el('span', 'module-inst', `#${o.moduleId}`);
    const slot = el('span', 'module-header-slot');
    header.append(code, this.titleEl, this.polyBadge, el('span', 'module-header-fill'), idTag, slot);
    header.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('.ib,.seg,.view-switch,button')) return;
      o.onHeaderPointerDown(e);
    });
    this.titleEl.addEventListener('dblclick', e => { e.stopPropagation(); o.onRenameRequest(); });
    this.root.append(header);

    // ---- body ----------------------------------------------------------
    this.body = el('div', 'module-body');
    const ins = d ? inputs(d) : this.reconstructPorts('input');
    const outs = d ? outputs(d) : this.reconstructPorts('output');

    let coreEl: HTMLElement;
    if (d) {
      this.panel = new Panel(o.host, o.moduleId, d, o.override);
      coreEl = this.panel.root;
      this.width = this.panel.layout.width;
      this.minHeight = this.panel.layout.minHeight;
      this.body.style.paddingLeft = `${this.panel.layout.gutterIn}px`;
      this.body.style.paddingRight = `${this.panel.layout.gutterOut}px`;
      for (const h of this.panel.headerEls) slot.before(h);
    } else {
      coreEl = this.buildMissingCore();
      this.width = 420;
      this.minHeight = HEADER_H + (Math.max(ins.length, outs.length) + 1) * portMinPitch;
      this.body.style.paddingLeft = '110px';
      this.body.style.paddingRight = '110px';
    }

    this.body.append(coreEl);
    this.buildPorts('input', ins);
    this.buildPorts('output', outs);
    this.root.append(this.body);
    this.root.style.width = `${this.width}px`;
    this.root.style.minHeight = `${this.minHeight}px`;

    if (d) {
      this.info = attachModuleInfo(this.root, slot, {
        connections: () => this.describeConnections(),
        modulated: () => this.describeModulated(),
      }, o.host.ticker, `module-info-${o.moduleId}`);
    }
    this.refreshHeader();
  }

  /**
   * Read the card's natural height once (call after it is in the DOM, and
   * batch calls for many cards), then place the ports from it.
   */
  measure(): void {
    if (!this.root.isConnected) return;
    this.root.style.height = '';
    this.height = Math.max(this.minHeight, Math.ceil(this.root.offsetHeight));
    this.root.style.height = `${this.height}px`;
    const bodyH = this.height - HEADER_H;
    for (const p of this.ports) {
      const y = ((p.index + 1) * bodyH) / (p.count + 1);
      p.node.style.top = `${y}px`;
      this.anchors.set(key(p.dir, p.port.id), { x: p.dir === 'input' ? 0 : this.width, y: HEADER_H + y });
    }
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
        const row = el('div', 'control-number static');
        row.append(el('div', 'control-label', k), el('div', 'control-readout', String(v)));
        list.append(row);
      }
      core.append(list);
    }
    return core;
  }

  private buildPorts(dir: PortDirection, list: ModulePort[]): void {
    list.forEach((p, index) => {
      const node = el('div', `port ${dir}`);
      node.dataset.module = String(this.o.moduleId);
      node.dataset.port = p.id;
      node.dataset.direction = dir;
      node.dataset.kind = p.kind;
      node.dataset.hint = String(p.hint);
      node.dataset.poly = String(p.poly);
      if (p.stereo_pair) node.dataset.stereo = p.stereo_pair;
      node.dataset.testid = `port-${this.o.moduleId}-${dir}-${p.id}`;
      node.title = `${dir === 'input' ? 'Input' : 'Output'}: ${p.name} · ${p.kind} / ${p.hint}`;

      const jack = el('span', 'port-jack');
      jack.style.setProperty('--hint', hintColor(String(p.hint)));
      jack.append(el('span', 'port-ring'), el('span', 'port-activity'));
      const label = el('span', 'port-label', p.name);
      if (dir === 'input') node.append(jack, label); else node.append(label, jack);
      this.body.append(node);
      this.portEls.set(key(dir, p.id), node);
      this.ports.push({ dir, port: p, node, index, count: list.length });
    });
  }

  anchor(dir: PortDirection, port: string): PortAnchor | undefined {
    return this.anchors.get(key(dir, port));
  }
  portEl(dir: PortDirection, port: string): HTMLElement | undefined {
    return this.portEls.get(key(dir, port));
  }
  allPorts(): HTMLElement[] { return [...this.portEls.values()] }

  /** One-shot port pulse (event, DESIGN §8: 380 ms, scale 1→2.4, opacity .9→0). */
  pulsePort(dir: PortDirection, port: string): void {
    const ring = this.portEls.get(key(dir, port))?.querySelector<HTMLElement>('.port-ring');
    if (!ring || motionOff()) return;
    ring.getAnimations().forEach(a => a.cancel());
    ring.animate([{ transform: 'scale(1)', opacity: 0.9 }, { transform: 'scale(2.4)', opacity: 0 }],
      { duration: 380, easing: 'cubic-bezier(.2,.7,.3,1)' });
  }

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
    this.polyBadge.textContent = `${n}v`;
    this.polyBadge.title = `Runs polyphonically, ${n} voices`;
  }

  /** Readouts for a missing module, kept in step with the saved values. */
  refreshMissing(): void {
    if (!this.missing) return;
    const m = this.o.host.doc.modules.get(this.o.moduleId);
    const rows = [...this.root.querySelectorAll<HTMLElement>('.missing-params .control-number')];
    const params = Object.entries(m?.parameters ?? {});
    rows.forEach((row, i) => {
      const v = params[i]?.[1];
      if (v !== undefined) row.querySelector('.control-readout')!.textContent = String(v);
    });
  }

  // ---- module info (i in the header) -----------------------------------

  private nameOf(id: number): string {
    const h = this.o.host;
    const m = h.doc.modules.get(id);
    return h.doc.label(id) ?? (m ? moduleCode(m.module) : '?') + ` ${id}`;
  }

  private describeConnections(): string[] {
    const h = this.o.host, id = this.o.moduleId, d = this.o.descriptor!;
    const out: string[] = [];
    for (const c of h.doc.connections) {
      if (c.kind === 'modulation') continue;
      if (c.to.module === id) {
        const src = h.doc.modules.get(c.from.module);
        const sd = src && h.registry.get(src.module);
        const sp = sd ? findPort(sd, 'output', c.from.port)?.name ?? c.from.port : c.from.port;
        out.push(`${(findPort(d, 'input', c.to.port)?.name ?? c.to.port).toUpperCase()} ← ${this.nameOf(c.from.module)} · ${sp}`);
      } else if (c.from.module === id) {
        const dst = h.doc.modules.get(c.to.module);
        const dd = dst && h.registry.get(dst.module);
        const dp = dd ? findPort(dd, 'input', c.to.port)?.name ?? c.to.port : c.to.port;
        out.push(`${(findPort(d, 'output', c.from.port)?.name ?? c.from.port).toUpperCase()} → ${this.nameOf(c.to.module)} · ${dp}`);
      }
    }
    return out.length ? out : ['no connections'];
  }

  private describeModulated(): { param: string; sources: string; live(): string }[] {
    const h = this.o.host, id = this.o.moduleId, d = this.o.descriptor!;
    const byParam = new Map<string, string[]>();
    for (const c of h.doc.connections) {
      if (c.kind !== 'modulation' || c.to.module !== id) continue;
      const list = byParam.get(c.to.port) ?? [];
      list.push(this.nameOf(c.from.module));
      byParam.set(c.to.port, list);
    }
    return [...byParam].map(([pid, srcs]) => {
      const p = findParam(d, pid);
      return {
        param: (p?.name ?? pid).toUpperCase(),
        sources: srcs.join(' + '),
        live: () => {
          const v = h.ticker.last?.effective[id]?.[pid] ?? h.doc.param(id, pid) ?? p?.default ?? 0;
          if (!p) return String(v);
          const f = formatValue(p, v);
          return `→ ${f.unit === '%' ? f.text + '%' : f.text + (f.unit ? ' ' + f.unit : '')}`;
        },
      };
    });
  }

  destroy(): void { this.info?.destroy(); this.panel?.destroy(); this.root.remove(); }

  static describeValue = formatValue;
}

const key = (dir: PortDirection, port: string) => `${dir}:${port}`;
