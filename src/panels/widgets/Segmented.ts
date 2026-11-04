import type { ModuleParam } from '../../modules/types';
import { el } from '../../app/dom';

export interface SegmentedOptions {
  param: ModuleParam;
  moduleId: number;
  getValue(): number;
  setValue(v: number): void;
}

/** `choices` parameters render as segmented buttons. */
export class Segmented {
  readonly root: HTMLElement;
  private buttons: HTMLButtonElement[] = [];

  constructor(private readonly o: SegmentedOptions) {
    const p = o.param;
    this.root = el('div', 'control-row segmented-row');
    this.root.dataset.param = p.id;
    this.root.dataset.testid = `segmented-${o.moduleId}-${p.id}`;
    this.root.append(el('div', 'control-caption', p.name));

    const group = el('div', 'segmented');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', p.name);
    for (const c of p.choices ?? []) {
      const b = el('button', 'seg', c.label) as HTMLButtonElement;
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.value = String(c.value);
      b.dataset.testid = `seg-${o.moduleId}-${p.id}-${c.value}`;
      b.addEventListener('click', () => { o.setValue(c.value); this.refresh(); });
      group.append(b);
      this.buttons.push(b);
    }
    this.root.append(group);
    this.refresh();
  }

  refresh(): void {
    const v = this.o.getValue();
    for (const b of this.buttons) {
      const on = Math.abs(Number(b.dataset.value) - v) < 1e-6;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    }
  }
  destroy(): void { /* no subscriptions */ }
}
