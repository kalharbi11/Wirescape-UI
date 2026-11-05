import type { Ticker } from '../../runtime/Ticker';
import { el } from '../../app/dom';

const FALL = 0.9;      // fraction of the range per second
const HOLD = 1;        // seconds the peak line holds
const CLIP = 0.97;
const CLIP_HOLD = 1.2; // seconds the clip bar stays lit

interface Chan {
  col: HTMLElement; bar: HTMLElement; peak: HTMLElement; clip: HTMLElement;
  level: number; pk: number; pkAt: number; clipUntil: number;
  sBar: number; sPeak: number; sClip: boolean;
}

/**
 * Stereo output meter, kit style: 7 px black bars that rise instantly and fall
 * at ~0.9 of the range per second, a peak line held for 1 s, and a rust clip
 * bar. Motion is transform-only (scaleY / translateY); no layout properties.
 */
export class Meter {
  readonly root: HTMLElement;
  private chans: Chan[] = [];
  private unbind: () => void;
  private lastTime = -1;

  constructor(moduleId: number, ticker: Ticker) {
    this.root = el('div', 'meter-pane');
    this.root.dataset.testid = `meter-${moduleId}`;
    for (let i = 0; i < 2; i++) {
      const col = el('div', 'meter-col');
      const clip = el('i', 'meter-clip');
      const track = el('div', 'meter-track');
      const bar = el('i', 'meter-bar');
      const peak = el('i', 'meter-peak');
      track.append(bar, peak);
      col.append(clip, track, el('span', 'meter-lab', i ? 'R' : 'L'));
      this.root.append(col);
      this.chans.push({ col, bar, peak, clip, level: 0, pk: 0, pkAt: 0, clipUntil: 0, sBar: -1, sPeak: -1, sClip: false });
    }
    this.unbind = ticker.bind(moduleId, t => {
      const m = t.meters[moduleId];
      const dt = this.lastTime < 0 || t.time < this.lastTime ? 0 : t.time - this.lastTime;
      this.lastTime = t.time;
      this.chans.forEach((c, i) => this.step(c, m ? m[i] ?? 0 : 0, t.time, dt));
    });
  }

  private step(c: Chan, v: number, time: number, dt: number): void {
    c.level = v >= c.level ? v : Math.max(v, c.level - FALL * dt);
    if (v >= c.pk) { c.pk = v; c.pkAt = time; }
    else if (time - c.pkAt > HOLD) c.pk = Math.max(c.level, c.pk - FALL * dt);
    if (v > CLIP) c.clipUntil = time + CLIP_HOLD;
    const bar = Math.round(Math.min(1, c.level) * 1000) / 1000;
    const pk = Math.round(Math.min(1, c.pk) * 1000) / 1000;
    const clip = time < c.clipUntil;
    if (bar !== c.sBar) { c.sBar = bar; c.bar.style.transform = `scaleY(${bar})`; }
    if (pk !== c.sPeak) {
      c.sPeak = pk;
      c.peak.style.transform = `translateY(${-pk * 100}%)`;
      c.peak.style.opacity = pk > 0.01 ? '1' : '0';
    }
    if (clip !== c.sClip) { c.sClip = clip; c.clip.classList.toggle('on', clip); }
  }

  destroy(): void { this.unbind(); }
}
