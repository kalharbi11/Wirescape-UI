import type { EngineClient } from '../engine/EngineClient';

/** Two octaves on the computer keyboard; Z and X shift the octave. */
const MAP: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
  KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14,
  KeyP: 15, Semicolon: 16, Quote: 17,
};

export class ComputerKeyboard {
  private octave = 4;
  private held = new Set<string>();
  onOctaveChange: (o: number) => void = () => {};

  constructor(private readonly engine: EngineClient) {}

  get currentOctave(): number { return this.octave }

  attach(): () => void {
    const down = (e: KeyboardEvent) => {
      if (isTyping()) return;
      if (e.code === 'KeyZ' && !e.metaKey && !e.ctrlKey) {
        this.octave = Math.max(0, this.octave - 1); this.onOctaveChange(this.octave); return;
      }
      if (e.code === 'KeyX' && !e.metaKey && !e.ctrlKey) {
        this.octave = Math.min(8, this.octave + 1); this.onOctaveChange(this.octave); return;
      }
      const semi = MAP[e.code];
      if (semi === undefined || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      this.held.add(e.code);
      this.engine.noteOn(this.octave * 12 + semi, 0.8);
    };
    const up = (e: KeyboardEvent) => {
      const semi = MAP[e.code];
      if (semi === undefined || !this.held.has(e.code)) return;
      this.held.delete(e.code);
      this.engine.noteOff(this.octave * 12 + semi);
    };
    const blur = () => {
      for (const code of this.held) this.engine.noteOff(this.octave * 12 + MAP[code]!);
      this.held.clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }
}

export function isTyping(): boolean {
  const a = document.activeElement;
  return !!a && (['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) || (a as HTMLElement).isContentEditable);
}
