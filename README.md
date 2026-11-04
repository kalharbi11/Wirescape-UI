# Wirescape Studio — UI prototype

The complete Wirescape interface in the browser with a fake engine behind it.
Every button, gesture, animation and value display works; only the sound is
missing. The code team replaces `FakeEngine` with `RealEngine` behind the same
`EngineClient` interface, without redesigning anything.

This folder is intended to become `apps/studio` in the Wirescape repo.

## Running it

```bash
npm install
npm run dev         # http://localhost:5173
```

```bash
npm run typecheck   # tsc --noEmit
npm run build       # typecheck + production build
npm test            # Playwright: builds a patch, plays it, saves and reloads
```

The container's Chromium does not match the pinned Playwright build, so
`playwright.config.ts` points at `/opt/pw-browsers/chromium`. Override with
`WIRESCAPE_CHROMIUM=/path/to/chrome` elsewhere.

## What to read first

- **`DESIGN.md`** — every design decision, the tokens, the gesture rules, the
  frame figures and the open questions. Start here.
- **`src/engine/EngineClient.ts`** — the interface the real engine implements.
- **`src/patch/types.ts`** — the patch v2 file format.
- **`public/wirescape_modules.json`** — the module catalogue, unmodified.

## The rule that shapes everything

No module is hand-coded. Every card is built from a descriptor in
`wirescape_modules.json`; adding an entry to that file gets you a working
panel with no code change. `public/panels/<module-id>.json` can override the
layout, and a missing override falls back to the generic one.

## Reviewing it

`docs/shots/` has screenshots of the starter patches, the modulation
close-up, quick-add, settings, the debug panel, the empty canvas, an unknown
module and the touch profile. `docs/recordings/phase1-3-gestures.webm` is a
26-second walkthrough of searching the library, placing modules, patching,
dropping a cable onto a knob to modulate it, dragging the amount handle,
playing notes, and zooming.

Try, in this order: pick a starter patch from the top bar; drag a cable from
an output to an input; drag one from an LFO's output onto a filter's cutoff
knob and watch the needle move; drag the handle that appears on the knob's
ring; hold a letter key to play a note; press `?` for the shortcut sheet and
`` ` `` for the debug panel, where you can unplug the audio device or make the
engine refuse an edit.
