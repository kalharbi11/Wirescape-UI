# Wirescape Studio — design record

Every decision the prototype makes that is not already fixed by the brief is
written down here, so the code team does not have to rediscover it.

Status: **phases 1–3 complete** (rebuild, patching, live values).
Phases 4–6 (editing, system settings, signature panels) are not built; what
exists of them is noted below.

---

## 1. The three contracts

| Contract | Where | Notes |
| --- | --- | --- |
| Module data | `public/wirescape_modules.json`, typed in `src/modules/types.ts` | Loaded at boot. Nothing is hand-coded per module. |
| Engine interface | `src/engine/EngineClient.ts` | `FakeEngine` is the only implementation; `RealEngine` replaces it. |
| Patch file | `src/patch/types.ts` (patch v2) | `PatchDoc` is the in-memory document; unknown fields round-trip. |

### Port identity is (direction, id), not id

The real catalogue reuses a port `id` across directions on the same module:
`essentials.ladder`, `essentials.output`, `essentials.vca` all have an input
**and** an output called `audio`; `essentials.scale_offset` and
`essentials.slew` both use `control`. Every lookup in the UI keys on the pair.
Patch v2 endpoints stay `{module, port}` because the direction is implied by
which side of the connection they sit on.

### Modulation is summed in knob space, not unit space

`effective = normToValue(param, valueToNorm(param, base) + Σ amount × source)`,
clamped to 0–1 travel.

An `amount` of 0.4 therefore always means *four tenths of the knob's travel*,
whatever the unit, and it respects the parameter's taper. The alternative —
adding in the parameter's own units — makes one amount mean a 4 ms nudge on an
envelope and an 8 kHz leap on a cutoff. **Open question for the code team:
confirm the real engine does the same, or the saved `amount` values will not
mean the same thing.**

### Unknown fields

`PatchDoc` keeps the object each module and connection was parsed from and
spreads it back on save; unrecognised top-level and `ui` keys are held in
`extras`. Covered by a test.

---

## 2. Design tokens

All in `src/theme/tokens.css`. No component hard-codes a colour.

### Colour

| Token | Value | Use |
| --- | --- | --- |
| `--ground` | `#eeede9` | Canvas |
| `--rail` | `#f5f4f0` | Sidebar, top bar, status bar |
| `--surface` | `#faf9f6` | Module cards, popovers |
| `--surface-2` | `#f3f1ed` | Panes inside a card, segmented buttons |
| `--surface-sunken` | `#eceae4` | Meter track |
| `--ink` / `--ink-strong` | `#393b39` / `#262824` | Body text / titles |
| `--sub` / `--sub-light` | `#858681` / `#a7a8a1` | Captions / hints |
| `--line` / `--hair` | `#d9d8d2` / `#e9e7e1` | Borders / internal rules |
| `--accent` | `#c5774c` | Modulation, live markers, selection |
| `--accent-soft` | `#dec2ac` | Candidate highlights |
| `--danger` / `--good` | `#b4523f` / `#6d8a63` | Clip, refusals / audio running |
| `--dial` / `--dial-marker` | `#333634` / `#f3f1e8` | Knob body / needle |

### Cable and port colour by hint

| Hint | Token | Colour |
| --- | --- | --- |
| `audio` | `--hint-audio` | `#777e79` |
| `pitch` | `--hint-pitch` | `#6f7f93` |
| `cv_uni` | `--hint-cv_uni` | `#c17853` |
| `cv_bi` | `--hint-cv_bi` | `#c5774c` |
| `gate`, `trigger` | `--hint-gate` | `#9aa394` |
| `ev_notes`, `ev_midi` | `--hint-ev_notes` | `#8c7fa0` |

Hints set colour only. The sole refusal is signal ↔ event, enforced in both
the UI (`PatchCanvas.dropOnPort`) and the engine (`FakeEngine.validateConnection`).

Cable weight: 2 px normally, 3 px for a poly port, 1.6 px dashed for
modulation, 2.4 px finely dashed for events, 4.5 px when selected. All use
`vector-effect: non-scaling-stroke`, so weight is constant at every zoom.

### Geometry

`--radius` 13 px (cards), `--radius-sm` 7 px (panes), `--radius-xs` 5 px
(buttons). Card header 82 px. Port pitch 31 px, first port 70 px below the
header. Knob 70 px (small 51 px). Port jack 15 px with an invisible 30 px hit
ring.

### Type

`ABC Areal` with an Arial fallback. 9 / 10 / 11 / 12 / 26 px, scaled by
`--ui-scale`. Titles are set at `-0.055em` tracking, labels at `+0.02em`,
micro-labels at `+0.1em` — this tight-title / loose-label pairing is the main
thing that makes it read as the sketch.

### Motion

`--t-fast` 100 ms, `--t-base` 150 ms, `--t-slow` 240 ms, easing
`cubic-bezier(.22,.61,.36,1)`. These apply to *interface* transitions only
(hover, toggles, the sidebar). Nothing that represents a signal uses a CSS
transition or keyframe: signal motion is written as a `transform` once per
frame from telemetry.

### Profiles

- `:root[data-hit="touch"]` — `--hit-scale` 1.6, jack 19 px, knob 78 px. The
  *layout* follows: port pitch 31 → 40 px, first port 70 → 78 px, control cells
  ×1.14, card width ×1.06. Without that the cards keep their mouse-profile
  heights and their contents spill out. A test checks every module in both
  profiles. Changing the profile rebuilds every card, since the geometry the
  layout is derived from has changed.
- `:root[data-profile="pi"]` — no card shadows, fainter grid, telemetry
  drawing throttled to 30 Hz.
- `:root[data-theme="dark"]` — wired, **not designed**. A neutral inversion so
  the switch is never broken. See open questions.

---

## 3. Card sizing

Per your decision, each module type keeps its own size rather than snapping to
a grid, but the size still comes from data so rule 1 holds:

- **Width** comes from `panels/<module-id>.json` if there is an override,
  otherwise it is derived: input gutter + output gutter + the widest section's
  column count. Gutters are sized from the longest port label (104–196 px).
- **Height is always derived from content**, never hand-set. A new module in
  the catalogue can be clipped by nothing.

Measured widths × heights (all 21):

```
adsr            656×388    chaos_lite      980×858    clock           544×350
function_env    544×388    keyboard        398×350    ladder          544×278
lfo             474×512    macro_osc       820×626    cc_to_cv        440×439
midi.in         400×276    midi.to_cv      620×642    mixer           440×278
noise           370×278    output          440×302    scale_offset    440×278
slew            440×278    vca             440×278    vcf             440×278
vco             440×284    random_source   544×396    step_sequencer  900×442
```

### Widget chosen from the parameter's own shape

| Parameter shape | Widget |
| --- | --- |
| two choices labelled off/on or stop/run | toggle switch |
| 2–5 choices | segmented buttons |
| more than 5 choices | dropdown |
| exactly one choice | static readout |
| anything else | knob |

The dropdown rule exists because `channel_filter` has 17 choices; as segmented
buttons it was a seventeen-button wall. The single-choice rule exists because
`steal_policy` has `minimum = maximum = 0` and would otherwise be a knob with
no range.

Overrides may set `width`, `sections`, `short` labels, `widgets`, `panes` and
`hidden`. Any parameter an override forgets is still placed, in a trailing
"MORE" section — a panel can never silently drop a control.

---

## 4. Gesture rules

| Gesture | Behaviour |
| --- | --- |
| Drag a module header | Moves it; moves the whole selection if it is selected |
| Drag empty canvas | Pan |
| Shift-drag empty canvas, or middle-drag | Box-select (adds to the current selection) |
| Shift-click a module | Add to / remove from the selection |
| Wheel, or trackpad pinch | Zoom centred on the pointer, 25 %–185 % |
| Two-finger pinch | Zoom (touch) |
| Double-click empty canvas | Quick-add search at that point |
| Drag output → input | Patch a cable |
| Drag input → output | Patch a cable (same thing, either direction) |
| Drag from a *connected* input | Grabs that cable's end to move it or pull it off |
| Alt-drag from a connected input | Starts a new cable instead of grabbing |
| Drop a cable on empty canvas | Quick-add, filtered to modules with a matching port; picking one completes the cable |
| Drop a signal output on a knob | Modulation, starting at amount +0.30 |
| Shift-drop on a signal input | Adds alongside instead of replacing |
| Drag the handle on a knob's ring | Sets that modulation's amount, −1…+1 |
| Knob: drag | 180 px of travel covers the full range |
| Knob: shift-drag | Five times finer |
| Knob: wheel | ±0.02 travel (±0.004 with shift) |
| Knob: arrows | ±0.01 travel (±0.002 with shift); PageUp/Down ±0.1; Home/End to the ends |
| Knob: double-click | Reset to the parameter's default |
| Knob readout: click | Type a value |
| Click a cable | Select it; Delete removes it |
| Hover a cable | Title shows "from → to", and the amount for a modulation |

**Replace or add** (the brief's open question): a signal input takes one cable;
a second drop replaces the first; shift-drop adds alongside. Implemented as the
brief suggested, still to be confirmed with the code team.

**Stereo pairs**: when both ends belong to a two-port stereo group, a bar
offers to connect L and R together. Pairing is positional — the Nth stereo
output maps to the Nth stereo input. Declining connects only the one cable.

**Feedback cables**: a cable whose target can already reach its source gets a
small chevron at its midpoint.

### Live value vs set value

A modulated knob shows **three** things at once:

- the **needle** and the **marker on the outer ring** follow the live,
  post-modulation value — this is the cutoff knob visibly moving at the LFO's rate;
- the **value ring** on the border shows the value you set;
- the **modulation arc** outside it shows the range the modulation sweeps, one
  arc per modulation, each stepping 5 px further out, with a draggable handle
  at its end.

The **numeric readout shows the value you set, not the live one.** A readout
that jitters 30 times a second is unreadable, and clicking it to type would
prefill a moving number. The live value is in the needle, and in `data-live`
on the knob for tests.

---

## 5. Performance

The Pi rules are implemented as follows.

1. **Transform and opacity only.** Knob needles, ring markers and the sidebar
   are `transform`. Meters, scopes, waveforms and envelopes are canvas, so
   nothing animates a width.
2. **One loop.** `src/runtime/Ticker.ts` owns the single `requestAnimationFrame`
   loop. Widgets register a binding keyed by module id; there are no per-widget
   timers and no CSS keyframes for signal motion.
3. **Cables redraw only on movement.** The cable SVG lives *inside* the world
   transform, so pan and zoom cost one transform and recompute no paths. Paths
   are recomputed only when a module moves or the connection list changes.
   Port anchors are derived arithmetically from the card's position and the
   port's index — never measured — so this stays cheap.
4. **Canvas for live displays.** Meter, scope, LFO waveform, envelope curve.
5. **Off-screen modules are skipped.** The ticker only runs bindings for
   modules whose world box intersects the viewport.
6. **Pi profile.** Throttles telemetry drawing to 30 Hz, drops shadows, fades
   the grid. Chosen automatically when the device looks slow (≤4 cores, ≤4 GB,
   or an ARM user agent) and overridable in preferences.
7. **Measured.** Dev panel (`` ` `` key) shows fps and the mean ms per frame
   spent applying telemetry.

### Frame figures

20 modules, 40 cables, a note held, modulation moving, Chromium 1920×1080:

| Profile | Zoom | fps | ms/frame applying telemetry | cards drawn |
| --- | --- | --- | --- | --- |
| Normal | fit (33 %) | 60 | 0.65 | 20 |
| Normal | 100 % | 60 | 0.39 | 8 |
| Pi | fit (33 %) | 60 | 0.80 | 20 |
| Pi | 100 % | 60 | 0.67 | 8 |

**These are container numbers, not Pi numbers.** This prototype has not yet run
on Raspberry Pi hardware. The figures show the UI work is around half a
millisecond a frame and that culling is doing its job, but the Pi target
(≥30 fps) is unverified until someone opens it in Chromium on the device.
That measurement is the first thing to do in phase 5.

---

## 6. What is built, and what is not

**Built (phases 1–3)**

Canvas: pan, pointer-centred zoom 25–185 %, fit, box-select, shift-click,
empty-canvas state, shortcut overlay (`?`), one-finger pan and two-finger
pinch. Modules: library with search, add by click / drag-and-drop / quick-add,
move, delete, group move, instance labels, generic panel from data, poly
badge, missing-module card. Cables: both drag directions, candidate
highlighting, drop-on-empty quick-add, grab a cable end, select and delete,
hover description, colour and weight by hint, stereo-pair offer, feedback
marker, cable-onto-knob modulation with draggable amount. Controls: knob with
drag / shift / wheel / arrows / double-click / typed value, taper-correct
travel, stepped snapping, unit formatting, value ring, modulation arcs, live
marker, tooltips, segmented buttons, toggles, dropdowns. Live displays: LFO
waveform with a real phase dot, output meters with peak hold and clip mark,
output scope, envelope curve with a live marker, event-port activity dots.
Playing: computer keyboard over two octaves with Z/X, panic. System bar: audio
state, device, rate, buffer, latency, CPU, dropouts, MIDI devices with
activity, clock BPM and run/stop. Patches: new, open, save, rename, autosave
and restore, six starters, unknown-field preservation. Preferences: motion,
performance profile, hit areas, UI scale, theme, port labels. Dev panel: fps,
frame time, and five simulation switches.

**Not built**

- Phase 4: undo/redo, copy/paste, duplicate, select-all-to-clipboard, recent
  patches. (`Ctrl+A` selects all; there is no clipboard yet.)
- Phase 5: OSC panel, per-device MIDI toasts on plug/unplug, MIDI learn.
- Phase 6: signature panels. The Step Sequencer has a plain 8-step grid with a
  live playhead as a placeholder; CHAOS-lite and the Macro Oscillator use the
  generic layout with section overrides.
- Compact/collapsed cards, mini scope on port hover, cable activity, on-screen
  keyboard — all marked *(later)* in the brief.

---

## 7. Open questions

1. **Modulation maths.** Does the real engine sum modulation in normalised
   knob space, as this prototype does? If not, saved `amount` values will not
   transfer. *This is the one that matters most.*
2. **Pi hardware.** Resolution is assumed 2560×1440; the UI is built for mouse
   and keyboard with a touch profile ready. Frame rate on the device is
   unmeasured.
3. **Several cables into one signal input** — defaulting to replace,
   shift-drop adds. Confirm with the code team.
4. **Dark theme.** Tokens exist and the switch works, but nobody has designed
   it. The present values are a mechanical inversion and the knobs in
   particular look wrong.
5. **Stereo pairing is positional.** The catalogue marks ports
   `stereo_pair: "stereo"` but does not say which is left and which is right,
   or pair them explicitly. The prototype assumes declaration order. A real
   `stereo_pair` group id would be better.
6. **Poly cable weight.** Every port in the catalogue is `poly` except
   `essentials.output`'s input (`sum`) and the Step Sequencer's clock/reset
   (`first`), so nearly every cable draws thick. Is `poly` on a port a static
   property or the runtime voice count?
7. **Instance labels** live in `ui.labels`, keyed by instance id. Confirm the
   real format does the same, or name the field.
8. **Patch name** is stored in `ui.name` by the autosave wrapper, not in the
   patch. Should patch v2 carry a name?
9. **The readout shows the set value, not the live one** (section 4). Worth a
   look on the device — it may read differently in the room than on a desk.
10. **Backward cables** (target left of source) draw as a wide S through the
    canvas. Legible, but busy in a dense patch. A routing pass that bows them
    vertically might be worth it.
11. **`example.step_sequencer` gate parameters** are `0=Rest, 1=Note, 2=Tie`
    with `step: 1`, so the placeholder grid cycles through three states. The
    signature panel should probably show tie as a joining bar.
12. **CPU figure** is faked from module count. What does the real engine
    report — DSP load, or process CPU?

---

## 8. Layout of the source

```
src/
  modules/    the catalogue: types, registry, taper maths, value formatting
  patch/      PatchDoc and the patch v2 types. No DOM.
  engine/     EngineClient (the contract) and FakeEngine (the only invention)
  canvas/     Viewport, CableLayer, ModuleCard, PatchCanvas
  panels/     layout resolver, panel builder, widgets/
  runtime/    Ticker — the single animation loop
  system/     status bar, toasts
  theme/      tokens.css and preferences
  app/        App, Library, QuickAdd, Keyboard, DevPanel, Modal, starters
public/
  wirescape_modules.json    the real catalogue, unmodified
  panels/<module-id>.json   optional per-module layout overrides
```

## 9. Test hooks

Every interactive element carries a `data-testid`; a test asserts that none is
missing. `window.__wirescapeTest` exposes `state()`, `load()`, `save()`,
`autosaveNow()`, `zoomTo()`, `fit()`, `noteOn()`, `noteOff()`, `fps()` and the
live `doc`, `engine`, `ticker`, `canvas` and `registry`.

Naming: `module-<id>`, `module-header-<id>`, `port-<id>-<direction>-<port>`,
`knob-<id>-<param>`, `readout-<id>-<param>`, `seg-<id>-<param>-<value>`,
`toggle-<id>-<param>`, `select-<id>-<param>`, `meter-<id>`, `scope-<id>`,
`wave-<id>`, `envelope-<id>`, `steps-<id>`, `cable-<key>`,
`library-item-<module-id>`, `quick-add-<module-id>`, `debug-<switch>`.
