import type { ModuleParam } from '../../modules/types';
import type { Ticker } from '../../runtime/Ticker';
import { el } from '../../app/dom';
import { formatValue } from '../../modules/registry';

export interface StepsOptions {
  moduleId: number;
  ticker: Ticker;
  steps: number;
  param(id: string): ModuleParam | undefined;
  getValue(id: string): number;
  setValue(id: string, v: number): void;
}

/**
 * A compact 8-step grid for the Step Sequencer. Deliberately plain: the
 * signature panel for this module is Phase 6 work. The playhead comes from
 * engine telemetry, not a timer.
 */
export class StepsPane {
  readonly root: HTMLElement;
  private cells: HTMLElement[] = [];
  private unbind: () => void;
  private current = -1;

  constructor(private readonly o: StepsOptions) {
    this.root = el('div', 'steps-pane');
    this.root.dataset.testid = `steps-${o.moduleId}`;
    const head = el('div', 'pane-head');
    head.append(el('span', '', 'SEQUENCE'));
    this.root.append(head);

    const grid = el('div', 'steps-grid');
    grid.style.gridTemplateColumns = `repeat(${o.steps}, minmax(0,1fr))`;
    for (let i = 1; i <= o.steps; i++) {
      const cell = el('div', 'step-cell');
      cell.dataset.step = String(i);

      const gate = el('button', 'step-gate') as HTMLButtonElement;
      gate.type = 'button';
      gate.dataset.testid = `step-gate-${o.moduleId}-${i}`;
      gate.addEventListener('click', () => {
        const p = o.param(`gate${i}`);
        if (!p) return;
        const next = (o.getValue(`gate${i}`) + 1) % ((p.maximum ?? 2) + 1);
        o.setValue(`gate${i}`, next);
        this.refresh();
      });

      const pitch = el('button', 'step-pitch') as HTMLButtonElement;
      pitch.type = 'button';
      pitch.dataset.testid = `step-pitch-${o.moduleId}-${i}`;
      let drag = 0;
      pitch.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        pitch.setPointerCapture(e.pointerId);
        drag = e.clientY;
        const start = o.getValue(`pitch${i}`);
        const p = o.param(`pitch${i}`);
        const move = (ev: PointerEvent) => {
          if (!p) return;
          const span = p.maximum - p.minimum;
          const v = Math.max(p.minimum, Math.min(p.maximum, start + ((drag - ev.clientY) / 140) * span));
          o.setValue(`pitch${i}`, v);
          this.refresh();
        };
        const up = () => {
          pitch.removeEventListener('pointermove', move);
          pitch.removeEventListener('pointerup', up);
        };
        pitch.addEventListener('pointermove', move);
        pitch.addEventListener('pointerup', up);
      });

      cell.append(el('div', 'step-index', String(i)), pitch, gate);
      grid.append(cell);
      this.cells.push(cell);
    }
    this.root.append(grid);
    this.refresh();

    this.unbind = o.ticker.bind(o.moduleId, t => {
      const ph = t.phase[o.moduleId];
      if (ph === undefined) return;
      const idx = Math.min(o.steps - 1, Math.floor(ph * o.steps + 1e-6));
      if (idx === this.current) return;
      this.cells[this.current]?.classList.remove('playing');
      this.current = idx;
      this.cells[idx]?.classList.add('playing');
    });
  }

  refresh(): void {
    for (let i = 1; i <= this.o.steps; i++) {
      const cell = this.cells[i - 1]!;
      const gp = this.o.param(`gate${i}`);
      const gv = this.o.getValue(`gate${i}`);
      const gateBtn = cell.querySelector<HTMLButtonElement>('.step-gate')!;
      const label = gp?.choices?.find(c => c.value === gv)?.label ?? String(gv);
      gateBtn.textContent = label;
      gateBtn.dataset.state = label.toLowerCase();
      gateBtn.title = `Step ${i} gate: ${label}`;
      const pp = this.o.param(`pitch${i}`);
      const pv = this.o.getValue(`pitch${i}`);
      const pitchBtn = cell.querySelector<HTMLButtonElement>('.step-pitch')!;
      pitchBtn.textContent = pp ? formatValue(pp, pv).text : String(pv);
      pitchBtn.title = `Step ${i} pitch · drag to change`;
    }
  }

  destroy(): void { this.unbind(); }
}
