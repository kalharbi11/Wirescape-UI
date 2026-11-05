# Plan: from prototype to the real Wirescape Studio

Updated 2026-11-05 by the planner (Claude). Owner goal: move fast, transfer the new design, keep the
three contracts stable so the real engine can plug in.

## Where things are

| what | where | state |
|---|---|---|
| Phases 1–3 app (Vite + TypeScript, fake engine, 21 modules from data, every cable gesture, live values), reskinned to the design system (**phase 3.5, done**) | `main` once branch `phase/3.5-reskin` merges: `src/`, `tests/`, `public/`, `index.html`, `reference/`; 23 session + 12 kit-control Playwright tests | in the new look; the old look survives only on branch `claude/new-session-p817y1` |
| Design system (control-jam rounds 1–2) | `main`: `docs/DESIGN.md`, `ui/wirescape-ui-kit.html`, `ui/tokens.css`, `docs/DECISIONS.md` | decided and now implemented in `src/`; the kit stays the reference |
| Brief (phases, contracts, fake engine, Pi rules, done checklist) | branch: `reference/Wirescape_UI_prototype_brief.md`; Claude Doc linked in AGENTS.md | phases 4–6 not started |
| Engine, modules, patch v2, MIDI, Pi runner | `kalharbi11/wirescape` (paused) | Qt UI frozen; becomes the real engine behind `EngineClient` |

## The contracts (never break them)
1. **Module data:** every card is built from `wirescape_modules.json` plus optional `panels/<id>.json`. No module-specific code in the generic builder.
2. **`EngineClient`:** the only way the UI talks to an engine. `FakeEngine` is the only place values are invented.
3. **Patch v2:** IDs stable; unknown fields survive load → save.

## Phases

### Phase 3.5: merge and reskin (done on branch `phase/3.5-reskin`; conflicts listed in DECISIONS.md)
Bring the phase 1–3 app onto `main` and dress it in the new design system.
- **Merge:** take `src/`, `tests/`, `public/`, `index.html`, package/config files, `.gitignore` and `reference/` from the branch. Keep `main`'s `docs/` and `ui/`, and keep `AGENTS.md`. Fold the branch's root `DESIGN.md` into `docs/DESIGN.md` as new sections: contracts, card sizing, gestures, test hooks, frame figures. Where the two disagree, **`docs/DESIGN.md` and `DECISIONS.md` win**. List every conflict you resolve in `DECISIONS.md`.
- **Don't commit** `docs/shots/` or `docs/recordings/` (binaries). Attach screenshots to the PR instead.
- **Reskin to the kit:**
  - tokens from `ui/tokens.css`
  - knob tiers L/M/S, with the graphite cap and the wire S tier
  - one combined modulation range arc plus the `→ live value` readout
  - plain dotted-underline numbers
  - round-fill segmented controls
  - parameter and module **i** info boxes
  - jacks on side rails
  - cards `tall`/`wide` with r 14
  - **cables per DESIGN §9:** no meaning in colour, user-picked palette, dotted while carrying signal, the sag spring
  - motion per §8
  - LFO wave on a dot grid; ADSR with a baseline axis; VCF hero-led display with the KNOBS/GRAPH switch
  - white paper with the dot texture
- **Done when:**
  - all 21 modules render in the new look
  - all 23 existing tests pass, plus tests for the kit controls you added
  - the done-checklist session passes at 50/100/185% zoom
  - `loop ms/frame` with 20 modules and 40 cables is at or below the branch's figure
  - the PR shows before/after screenshots

### Owner checkpoint A (next, after 3.5, about 30 minutes)
Open it on the laptop **and on the Pi in Chromium**. Patch a synth by hand, then answer the open items
below in `DECISIONS.md` or the PR. This is the "more UI testing" step. Do it here, not later.

### Phase 4: editing
**Status (branch `phase/4-editing`, stacked on 3.5):** done: undo/redo to an empty canvas and back, copy/cut/paste/duplicate (also between patches), typed values everywhere (OPEN-8), with 8 tests in `tests/editing.spec.ts` (rapid undo, paste across zoom, reload mid-drag). Already in place from phases 1-3: multi-select (box + shift), select-all, save/open, autosave + restore on launch, six starter patches. **Not done:** porting the six starters from the Qt repo (#187), because that repo could not be attached to this session; the six built-in starters stay until it is.

Undo/redo (to an empty canvas and back), copy/paste, multi-select (box and shift), save/load, starter
patches (port the six from the Qt repo, #187), autosave and recovery, typed value entry (OPEN-8).
Tests: break it on purpose (rapid undo, paste across zoom, reload mid-drag).

### Phase 5: system
Audio, MIDI and OSC status and settings (fake), CPU, panic, preferences, the Pi performance profile
(automatic on slow devices), the dev panel's fault switches, and a "check for updates" stub.
**Owner checkpoint B:** record the Pi FPS figures in `DESIGN.md` (OPEN-5).

### Phase 6: signature panels and polish (CHAOS-lite deferred, owner's call)
Step Sequencer, Macro Oscillator, Mixer/Output custom panels (`panels/<id>.json` plus small widgets),
a polish pass, and the full done checklist from the brief. CHAOS-lite keeps the generic panel for now.

### Phase 7: the real engine (in `kalharbi11/wirescape`; can start after 3.5, in parallel)
- Spike first: a headless C++ host speaking a localhost-only, token-protected protocol that maps 1:1 onto `EngineClient`, plus `RealEngine.ts` that talks to it. Two modules, one cable, one knob, real sound.
- Then: the full `EngineClient` surface; Tauri packaging on Windows; Chromium kiosk on the Pi; move this app into `wirescape` as `apps/studio` with `git subtree` (keeps history); then retire the Qt UI.

## Open items to settle at checkpoint A
| id | question | default if unanswered |
|---|---|---|
| Q-A | Pi screen: resolution; touch or mouse? | 1920×1080, mouse plus the touch profile available |
| Q-B | several cables into one signal input: add (sum) or replace? | add (sum), as in the engine |
| OPEN-1 | toggle style | LED latch |
| OPEN-2 | jack rings keep hint colours while cables don't? | keep |
| OPEN-3 | cable palette ("replace purple with like…") | ochre `#c99a2e`, slate `#5d6a73` |
| OPEN-4 | active cable: static or crawling dots | static |
| OPEN-6 | which modules are `wide` | VCF offers both; others tall |
| OPEN-7 | Clock card review | as in round 1 |
| Q-C | dark theme now or later | later |

## How to work
- One chat per phase (Claude Code web on this repo). Each phase ends with: screenshots, a short recording attached to the PR (not committed), tests green, and `docs/DESIGN.md` / `DECISIONS.md` updated.
- A phase is a branch `phase/<n>-<slug>` with a PR to `main`; the owner merges after a look.
- Big inventions (new panel type, new gesture): propose in one sentence or a quick mock first.
- Follow `docs/PERFORMANCE.md`; check `loop ms/frame` after every change.
