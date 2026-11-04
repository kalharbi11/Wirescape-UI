import { ModuleRegistry, findParam, findPort } from '../modules/registry';
import { PanelOverrides } from '../panels/layouts';
import { PatchDoc } from '../patch/PatchDoc';
import type { Connection, PatchV2 } from '../patch/types';
import { FakeEngine } from '../engine/FakeEngine';
import { EngineRefusal, type SystemStatus } from '../engine/EngineClient';
import { Ticker } from '../runtime/Ticker';
import { PatchCanvas, type Selection } from '../canvas/PatchCanvas';
import type { PortDirection } from '../modules/types';
import { Library } from './Library';
import { QuickAdd } from './QuickAdd';
import { Toasts } from '../system/Toasts';
import { StatusBar } from '../system/StatusBar';
import { ComputerKeyboard, isTyping } from './Keyboard';
import { DevPanel } from './DevPanel';
import { Modal, field, select, switchButton } from './Modal';
import { STARTERS, DEFAULT_STARTER } from './starters';
import { loadPrefs, savePrefs, applyPrefs, detectSlowDevice, type Preferences } from '../theme/theme';
import { el } from './dom';

const AUTOSAVE_KEY = 'wirescape.autosave.v2';

export class App {
  readonly root: HTMLElement;
  private doc = new PatchDoc();
  private ticker = new Ticker();
  private engine: FakeEngine;
  private canvas!: PatchCanvas;
  private library!: Library;
  private quick!: QuickAdd;
  private toasts = new Toasts();
  private statusBar!: StatusBar;
  private keyboard!: ComputerKeyboard;
  private devPanel!: DevPanel;
  private settings = new Modal('settings-modal');
  private shortcuts = new Modal('shortcuts-modal');
  private prefs: Preferences;
  private patchName = 'Untitled';
  private zoomLabel!: HTMLElement;
  private dirtyDot!: HTMLElement;
  private nameEl!: HTMLElement;
  private octaveEl!: HTMLElement;
  private lastStatus: SystemStatus | null = null;
  private fileInput!: HTMLInputElement;

  constructor(
    private readonly registry: ModuleRegistry,
    private readonly overrides: PanelOverrides,
  ) {
    this.prefs = loadPrefs();
    if (detectSlowDevice() && this.prefs.profile === 'normal') this.prefs.profile = 'pi';
    applyPrefs(this.prefs);
    this.engine = new FakeEngine(registry);
    this.root = el('div', 'app');
    this.root.dataset.testid = 'app';
  }

  static async boot(mount: HTMLElement): Promise<App> {
    const [registry, overrides] = await Promise.all([
      ModuleRegistry.load(),
      PanelOverrides.load(),
    ]);
    const app = new App(registry, overrides);
    app.build();
    mount.append(app.root);
    await app.startup();
    return app;
  }

  // ---- construction -----------------------------------------------------

  private build(): void {
    this.library = new Library(this.registry, {
      add: type => this.addModuleCentred(type),
      addAt: (type, x, y) => this.addModuleAt(type, x, y),
    });

    this.quick = new QuickAdd(this.registry);

    this.canvas = new PatchCanvas({
      doc: this.doc,
      ticker: this.ticker,
      registry: this.registry,
      overrides: this.overrides,
      commitParam: (m, p, v, c) => this.commitParam(m, p, v, c),
      commitModAmount: (c, a, commit) => this.commitModAmount(c, a, commit),
      describeSource: c => this.describeSource(c),
      toast: (m, tone) => this.toasts.show(m, tone),
      quickAdd: (world, need, then) => this.openQuickAdd(world, need, then),
      confirmStereo: msg => this.confirmStereo(msg),
      onSelectionChange: s => this.onSelectionChange(s),
      rename: id => this.renameModule(id),
      engineConnect: c => this.engine.connect(c),
      engineDisconnect: c => this.engine.disconnect(c),
    });
    this.canvas.bindActivity();

    this.statusBar = new StatusBar({
      onPanic: () => { this.engine.panic(); this.toasts.show('All notes stopped.'); },
      onOpenSettings: () => this.openSettings(),
      onClockToggle: running => this.toggleClock(running),
    });

    this.keyboard = new ComputerKeyboard(this.engine);
    this.keyboard.onOctaveChange = o => { this.octaveEl.textContent = `OCT ${o}`; };
    this.devPanel = new DevPanel(this.engine, this.ticker);

    const main = el('div', 'main');
    main.append(this.buildTopBar(), this.canvas.root, this.statusBar.root);

    this.fileInput = el('input') as HTMLInputElement;
    this.fileInput.type = 'file';
    this.fileInput.accept = '.json,application/json';
    this.fileInput.hidden = true;
    this.fileInput.dataset.testid = 'file-input';
    this.fileInput.addEventListener('change', () => void this.importFile());

    this.root.append(
      this.library.root, main, this.toasts.root, this.quick.root,
      this.devPanel.root, this.settings.root, this.shortcuts.root, this.fileInput,
    );

    this.attachDropTarget();
    this.attachShortcuts();
    this.buildShortcutSheet();
  }

  private buildTopBar(): HTMLElement {
    const bar = el('header', 'topbar');
    bar.dataset.testid = 'topbar';

    const left = el('div', 'topbar-left');
    const menuBtn = this.action('☰', () => this.root.classList.toggle('library-open'), 'menu-toggle');
    menuBtn.classList.add('icon-only', 'menu-btn');
    this.nameEl = el('span', 'patch-name', this.patchName);
    this.nameEl.dataset.testid = 'patch-name';
    this.nameEl.title = 'Click to rename the patch';
    this.nameEl.addEventListener('click', () => this.renamePatch());
    this.dirtyDot = el('span', 'dirty-dot');
    this.dirtyDot.dataset.testid = 'dirty-dot';
    this.dirtyDot.title = 'Unsaved changes';
    const path = el('div', 'patch-path');
    path.append(el('span', 'patch-prefix', 'PATCH /'), this.nameEl, this.dirtyDot);
    left.append(menuBtn, path);

    const right = el('div', 'topbar-right');

    const starters = el('select', 'input-select starter-select') as HTMLSelectElement;
    starters.dataset.testid = 'starter-select';
    starters.setAttribute('aria-label', 'Starter patches');
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = 'Starter patches…';
    starters.append(blank);
    for (const s of STARTERS) {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = s.name; o.title = s.note;
      starters.append(o);
    }
    starters.addEventListener('change', () => {
      const s = STARTERS.find(x => x.id === starters.value);
      if (s) { this.loadPatch(s.patch(), s.name); this.toasts.show(`${s.name} loaded.`); }
      starters.value = '';
    });

    this.octaveEl = el('span', 'octave-tag', 'OCT 4');
    this.octaveEl.dataset.testid = 'octave';
    this.octaveEl.title = 'Computer keyboard octave · Z and X shift it';

    const zoomGroup = el('div', 'zoom-group');
    zoomGroup.append(
      this.action('−', () => this.canvas.viewport.zoomBy(1 / 1.15), 'zoom-out'),
      (this.zoomLabel = (() => {
        const o = el('output', 'zoom-label', '100%');
        o.dataset.testid = 'zoom-label';
        return o;
      })()),
      this.action('+', () => this.canvas.viewport.zoomBy(1.15), 'zoom-in'),
      this.action('⌗', () => this.canvas.fit(), 'zoom-fit'),
    );
    this.canvas.viewport.on(v => { this.zoomLabel.textContent = `${Math.round(v.s * 100)}%`; });

    const tools = el('div', 'toolbar');
    tools.append(
      this.action('NEW', () => this.newPatch(), 'new-patch'),
      this.action('OPEN', () => this.fileInput.click(), 'open-patch'),
      this.action('SAVE', () => this.exportPatch(), 'save-patch'),
      this.action('?', () => this.shortcuts.open('Keyboard shortcuts'), 'shortcuts-btn'),
    );

    right.append(starters, this.octaveEl, zoomGroup, tools);
    bar.append(left, right);
    return bar;
  }

  private action(label: string, fn: () => void, testid: string): HTMLButtonElement {
    const b = el('button', 'action', label) as HTMLButtonElement;
    b.type = 'button';
    b.dataset.testid = testid;
    b.addEventListener('click', fn);
    return b;
  }

  // ---- startup ----------------------------------------------------------

  private async startup(): Promise<void> {
    this.ticker.throttleHz = this.prefs.profile === 'pi' ? 30 : 0;
    this.ticker.start();
    this.engine.onTelemetry(t => this.ticker.push(t));
    this.engine.onStatus(s => { this.lastStatus = s; this.statusBar.update(s); });
    this.engine.start();
    this.keyboard.attach();

    const restored = this.restoreAutosave();
    if (!restored) this.loadPatch(DEFAULT_STARTER.patch(), DEFAULT_STARTER.name);

    requestAnimationFrame(() => { this.canvas.fit(); this.canvas.invalidateAnchors(); });
    window.addEventListener('resize', () => this.canvas.updateVisibility());
    setInterval(() => this.autosave(), 4000);
    this.doc.on(() => this.refreshDirty());
  }

  private restoreAutosave(): boolean {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw) as { name?: string; patch: PatchV2 };
      if (!saved?.patch?.modules) return false;
      this.loadPatch(saved.patch, saved.name ?? 'Untitled');
      this.toasts.show('Restored your last patch.');
      return true;
    } catch { return false; }
  }

  private autosave(): void {
    if (!this.doc.dirty) return;
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ name: this.patchName, patch: this.doc.toJSON() }));
    } catch { /* storage full or unavailable */ }
  }

  // ---- patch lifecycle --------------------------------------------------

  loadPatch(patch: PatchV2, name = 'Untitled'): void {
    this.doc.replace(patch);
    this.patchName = name;
    this.nameEl.textContent = name;
    void this.engine.loadGraph(this.doc.toJSON());
    const v = patch.ui?.view;
    if (v && v.zoom) this.canvas.viewport.setView(v.x, v.y, v.zoom);
    else requestAnimationFrame(() => this.canvas.fit());
    requestAnimationFrame(() => this.canvas.invalidateAnchors());
    this.doc.markClean();
    this.refreshDirty();
  }

  private newPatch(): void {
    this.loadPatch({
      format: 'wirescape.native.patch', version: 2, modules: [], connections: [],
      ui: { positions: {}, labels: {}, view: { x: 0, y: 0, zoom: 1 } },
    }, 'Untitled');
    this.toasts.show('New patch.');
  }

  private exportPatch(): void {
    const json = JSON.stringify(this.doc.toJSON(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a') as HTMLAnchorElement;
    a.href = url;
    a.download = `${this.patchName.replace(/[^\w\-]+/g, '-').toLowerCase() || 'patch'}.wirescape.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.doc.markClean();
    this.refreshDirty();
    this.toasts.show('Patch saved.');
  }

  private async importFile(): Promise<void> {
    const f = this.fileInput.files?.[0];
    if (!f) return;
    try {
      const patch = JSON.parse(await f.text()) as PatchV2;
      if (!Array.isArray(patch.modules) || !Array.isArray(patch.connections)) {
        throw new Error('That file is not a Wirescape patch.');
      }
      this.loadPatch(patch, f.name.replace(/\.(wirescape\.)?json$/i, ''));
      const unknown = [...this.doc.modules.values()].filter(m => !this.registry.has(m.module));
      this.toasts.show(unknown.length
        ? `Patch opened. ${unknown.length} unknown module${unknown.length > 1 ? 's' : ''} kept as-is.`
        : 'Patch opened.');
    } catch (err) {
      this.toasts.show(err instanceof Error ? err.message : 'Could not open that file.', 'error');
    }
    this.fileInput.value = '';
  }

  private refreshDirty(): void {
    this.dirtyDot.classList.toggle('on', this.doc.dirty);
  }

  // ---- edits through the engine -----------------------------------------

  /**
   * The UI draws a change at once, sends it to the engine, and rolls back
   * with a message if the engine refuses.
   */
  private commitParam(moduleId: number, paramId: string, value: number, commit: boolean): void {
    const before = this.doc.param(moduleId, paramId);
    this.doc.setParam(moduleId, paramId, value);
    try {
      this.engine.setParam(moduleId, paramId, value);
    } catch (err) {
      if (before === undefined) {
        const m = this.doc.modules.get(moduleId);
        if (m?.parameters) delete m.parameters[paramId];
      } else {
        this.doc.setParam(moduleId, paramId, before);
      }
      this.canvas.cardFor(moduleId)?.panel?.refreshParam(paramId);
      this.toasts.show(err instanceof EngineRefusal ? err.message : 'The engine refused that change.', 'error');
    }
    if (commit && paramId === 'bpm' && this.lastStatus) this.statusBar.update(this.lastStatus);
  }

  private commitModAmount(c: Connection, amount: number, _commit: boolean): void {
    this.doc.setModAmount(c, amount);
    this.engine.setModAmount(c, amount);
  }

  private describeSource(c: Connection): string {
    const m = this.doc.modules.get(c.from.module);
    const d = m && this.registry.get(m.module);
    const label = this.doc.label(c.from.module) ?? d?.name ?? m?.module ?? `#${c.from.module}`;
    const port = d ? findPort(d, 'output', c.from.port)?.name ?? c.from.port : c.from.port;
    return `${label} ${port}`;
  }

  // ---- adding modules ---------------------------------------------------

  private addModuleCentred(type: string): number | null {
    const r = this.canvas.viewport.rect();
    return this.addModuleAt(type, r.left + r.width / 2, r.top + r.height / 2, true);
  }

  private addModuleAt(type: string, clientX: number, clientY: number, centre = false): number | null {
    const d = this.registry.get(type);
    if (!d) { this.toasts.show(`Unknown module "${type}".`, 'error'); return null; }
    const world = this.canvas.viewport.toWorld(clientX, clientY);
    const params: Record<string, number> = {};
    for (const p of d.parameters) params[p.id] = p.default;

    const id = this.doc.nextId();
    try {
      this.engine.addModule(id, type, params);
    } catch (err) {
      this.toasts.show(err instanceof EngineRefusal ? err.message : 'The engine refused that module.', 'error');
      return null;
    }
    // Rough centring: the real size is known once the card exists.
    const x = centre ? world.x - 300 : world.x - 40;
    const y = centre ? world.y - 180 : world.y - 30;
    this.doc.addModule(type, params, x, y, id);
    if (centre) {
      const card = this.canvas.cardFor(id);
      if (card) this.doc.setPosition(id, world.x - card.width / 2, world.y - card.height / 2);
    }
    this.canvas.selectModule(id, false);
    this.canvas.invalidateAnchors();
    this.root.classList.remove('library-open');
    this.toasts.show(`${d.name} added.`);
    return id;
  }

  private attachDropTarget(): void {
    const vp = this.canvas.root;
    vp.addEventListener('dragover', e => {
      if (e.dataTransfer?.types.includes('application/x-wirescape-module')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        vp.classList.add('drop-target');
      }
    });
    vp.addEventListener('dragleave', () => vp.classList.remove('drop-target'));
    vp.addEventListener('drop', e => {
      vp.classList.remove('drop-target');
      const type = e.dataTransfer?.getData('application/x-wirescape-module');
      if (!type) return;
      e.preventDefault();
      this.addModuleAt(type, e.clientX, e.clientY);
    });
  }

  private openQuickAdd(
    world: { x: number; y: number },
    need: { direction: PortDirection; kind: string } | null,
    then?: (id: number) => void,
  ): void {
    const client = this.canvas.viewport.toClient(world.x, world.y);
    this.quick.open({
      at: client,
      need,
      choose: type => {
        const id = this.addModuleAt(type, client.x, client.y);
        if (id !== null && then) {
          requestAnimationFrame(() => { then(id); this.canvas.invalidateAnchors(); });
        }
      },
      cancel: () => { /* nothing was added */ },
    });
  }

  private async confirmStereo(message: string): Promise<boolean> {
    return new Promise(resolve => {
      const bar = el('div', 'confirm-bar');
      bar.dataset.testid = 'stereo-confirm';
      bar.append(el('span', '', message));
      const yes = el('button', 'action strong', 'CONNECT BOTH') as HTMLButtonElement;
      yes.dataset.testid = 'stereo-yes';
      const no = el('button', 'action', 'JUST THIS ONE') as HTMLButtonElement;
      no.dataset.testid = 'stereo-no';
      const done = (v: boolean) => { bar.remove(); clearTimeout(timer); resolve(v); };
      yes.addEventListener('click', () => done(true));
      no.addEventListener('click', () => done(false));
      bar.append(no, yes);
      this.root.append(bar);
      const timer = window.setTimeout(() => done(false), 6000);
    });
  }

  // ---- selection & editing ----------------------------------------------

  private onSelectionChange(s: Selection): void {
    this.root.dataset.selection = s.kind;
  }

  private deleteSelection(): void {
    const s = this.canvas.currentSelection;
    if (s.kind === 'cable') {
      this.doc.disconnect(s.c);
      try { this.engine.disconnect(s.c); } catch { /* ignore */ }
      this.canvas.select({ kind: 'none' });
      this.toasts.show('Cable removed.');
    } else if (s.kind === 'modules') {
      for (const id of s.ids) { this.doc.removeModule(id); this.engine.removeModule(id); }
      this.canvas.select({ kind: 'none' });
      this.toasts.show(`${s.ids.length} module${s.ids.length > 1 ? 's' : ''} deleted.`);
    }
  }

  private renameModule(id: number): void {
    const current = this.doc.label(id) ?? '';
    const next = window.prompt('Instance label (empty clears it)', current);
    if (next === null) return;
    this.doc.setLabel(id, next);
  }

  private renamePatch(): void {
    const next = window.prompt('Patch name', this.patchName);
    if (next === null) return;
    this.patchName = next.trim() || 'Untitled';
    this.nameEl.textContent = this.patchName;
  }

  private toggleClock(running: boolean): void {
    for (const [id, m] of this.doc.modules) {
      if (m.module !== 'essentials.clock') continue;
      this.commitParam(id, 'run', running ? 1 : 0, true);
      this.canvas.cardFor(id)?.panel?.refreshParam('run');
    }
  }

  // ---- shortcuts --------------------------------------------------------

  private attachShortcuts(): void {
    window.addEventListener('keydown', e => {
      if (isTyping()) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); this.exportPatch(); return; }
      if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); this.fileInput.click(); return; }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); this.canvas.selectAll(); return; }
      if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); this.library.focusSearch(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.deleteSelection(); return; }
      if (e.key === 'Escape') { this.canvas.select({ kind: 'none' }); this.root.classList.remove('library-open'); return; }
      if (e.key === '?') { e.preventDefault(); this.shortcuts.open('Keyboard shortcuts'); return; }
      if (e.key === '`' || (e.shiftKey && e.key.toLowerCase() === 'd')) { e.preventDefault(); this.devPanel.toggle(); return; }
      if (e.key === '0' && mod) { e.preventDefault(); this.canvas.viewport.zoomTo(1); return; }
      if (e.key === '1' && mod) { e.preventDefault(); this.canvas.fit(); return; }
    });
  }

  private buildShortcutSheet(): void {
    const rows: [string, string][] = [
      ['Drag a module header', 'Move it (moves the whole selection)'],
      ['Drag an output to an input', 'Patch a cable'],
      ['Drag an output onto a knob', 'Modulate that parameter'],
      ['Shift-drop on an input', 'Add alongside instead of replacing'],
      ['Drag from a connected input', 'Grab that cable’s end'],
      ['Drag empty canvas', 'Pan'],
      ['Shift-drag empty canvas', 'Box-select'],
      ['Shift-click a module', 'Add to the selection'],
      ['Wheel / pinch', 'Zoom on the pointer'],
      ['Double-click canvas', 'Quick-add search'],
      ['Double-click a knob', 'Reset to default'],
      ['Click a knob readout', 'Type a value'],
      ['A–L, W, E, T, Y, U, O, P', 'Play notes'],
      ['Z / X', 'Octave down / up'],
      ['Delete', 'Remove the selection'],
      ['Ctrl/Cmd + A', 'Select all'],
      ['Ctrl/Cmd + S', 'Save the patch'],
      ['Ctrl/Cmd + O', 'Open a patch'],
      ['Ctrl/Cmd + F', 'Search the library'],
      ['Ctrl/Cmd + 0 / 1', 'Zoom 100% / fit'],
      ['?', 'This sheet'],
      ['`', 'Debug panel'],
    ];
    const list = el('div', 'shortcut-list');
    for (const [k, v] of rows) {
      const row = el('div', 'shortcut-row');
      row.append(el('kbd', '', k), el('span', '', v));
      list.append(row);
    }
    this.shortcuts.body.append(list);
  }

  // ---- settings ---------------------------------------------------------

  private openSettings(): void {
    this.settings.body.replaceChildren();
    const b = this.settings.body;

    b.append(el('h3', 'settings-group', 'Audio'));
    void this.engine.listAudioDevices().then(devices => {
      const sel = select(
        devices.map(d => ({ value: d.id, label: d.name })),
        this.lastStatus?.audio.deviceId ?? devices[0]!.id,
        v => this.engine.selectAudioDevice(v),
      );
      sel.dataset.testid = 'audio-device';
      const buffer = select(
        [64, 128, 256, 512, 1024].map(n => ({ value: String(n), label: `${n} frames` })),
        String(this.lastStatus?.audio.bufferFrames ?? 256),
        v => this.engine.setBuffer(Number(v)),
      );
      buffer.dataset.testid = 'audio-buffer';
      b.insertBefore(field('Output device', sel), b.children[1] ?? null);
      b.insertBefore(field('Buffer size', buffer, 'Lower is tighter, and more likely to drop out'), b.children[2] ?? null);
    });

    b.append(el('h3', 'settings-group', 'MIDI'));
    for (const d of this.lastStatus?.midi.devices ?? []) {
      b.append(field(d.name, switchButton(d.enabled !== false, on => this.engine.setMidiEnabled(d.id, on))));
    }

    b.append(el('h3', 'settings-group', 'Interface'));
    b.append(field('Motion', switchButton(this.prefs.motion, v => this.setPref({ motion: v })),
      'Pauses signal-driven animation'));
    b.append(field('Performance profile', select(
      [{ value: 'normal', label: 'Normal' }, { value: 'pi', label: 'Raspberry Pi' }],
      this.prefs.profile, v => this.setPref({ profile: v as Preferences['profile'] }),
    ), 'Pi lowers telemetry drawing to 30 Hz and drops shadows'));
    b.append(field('Hit areas', select(
      [{ value: 'mouse', label: 'Mouse and keyboard' }, { value: 'touch', label: 'Touch' }],
      this.prefs.hit, v => this.setPref({ hit: v as Preferences['hit'] }),
    ), 'Touch enlarges ports and knobs'));
    b.append(field('UI scale', select(
      [0.9, 1, 1.1, 1.25].map(n => ({ value: String(n), label: `${Math.round(n * 100)}%` })),
      String(this.prefs.uiScale), v => this.setPref({ uiScale: Number(v) }),
    )));
    b.append(field('Theme', select(
      [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark (unfinished)' }],
      this.prefs.theme, v => this.setPref({ theme: v as Preferences['theme'] }),
    ), 'Dark is wired but not designed yet'));
    b.append(field('Port labels', switchButton(this.prefs.showPortLabels, v => this.setPref({ showPortLabels: v }))));

    b.append(el('h3', 'settings-group', 'About'));
    const about = el('div', 'about');
    about.append(
      el('div', '', `Wirescape Studio prototype · ${__APP_VERSION__}`),
      el('div', 'muted', 'Visual prototype. No audio engine, no DSP, no MIDI.'),
    );
    b.append(about);

    const debug = el('button', 'action', 'Open the debug panel') as HTMLButtonElement;
    debug.type = 'button';
    debug.dataset.testid = 'open-debug';
    debug.addEventListener('click', () => { this.settings.close(); this.devPanel.toggle(true); });
    b.append(debug);

    this.settings.open('Settings');
  }

  private setPref(patch: Partial<Preferences>): void {
    const hitChanged = patch.hit !== undefined && patch.hit !== this.prefs.hit;
    this.prefs = { ...this.prefs, ...patch };
    applyPrefs(this.prefs);
    savePrefs(this.prefs);
    this.ticker.throttleHz = this.prefs.profile === 'pi' ? 30 : 0;
    // Hit areas change the geometry the layout is derived from, so every
    // card has to be rebuilt rather than just re-measured.
    if (hitChanged) this.canvas.rebuild();
    requestAnimationFrame(() => this.canvas.invalidateAnchors());
  }

  // ---- test hooks -------------------------------------------------------

  testApi() {
    return {
      state: () => this.doc.toJSON(),
      autosaveNow: () => {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ name: this.patchName, patch: this.doc.toJSON() }));
      },
      clearAutosave: () => localStorage.removeItem(AUTOSAVE_KEY),
      patchName: () => this.patchName,
      load: (p: PatchV2, name?: string) => this.loadPatch(p, name),
      save: () => this.doc.toJSON(),
      doc: this.doc,
      engine: this.engine,
      ticker: this.ticker,
      canvas: this.canvas,
      registry: this.registry,
      starters: STARTERS,
      setPref: (p: Partial<Preferences>) => this.setPref(p),
      zoomTo: (s: number) => this.canvas.viewport.zoomTo(s),
      fit: () => this.canvas.fit(),
      addModule: (type: string) => this.addModuleCentred(type),
      connect: (c: Connection) => {
        this.doc.connect(c);
        try { this.engine.connect(c); } catch (e) { this.doc.disconnect(c); throw e; }
      },
      deleteSelection: () => this.deleteSelection(),
      select: (s: Selection) => this.canvas.select(s),
      noteOn: (n: number, v = 0.8) => this.engine.noteOn(n, v),
      noteOff: (n: number) => this.engine.noteOff(n),
      effective: (moduleId: number, paramId: string) => {
        const d = this.registry.get(this.doc.modules.get(moduleId)?.module ?? '');
        const p = d && findParam(d, paramId);
        return p ? this.doc.param(moduleId, paramId) ?? p.default : undefined;
      },
      fps: () => this.ticker.fps,
    };
  }
}

declare const __APP_VERSION__: string;
