# Wirescape UI — design spec

Status: **current** (after control jam rounds 1 and 2, 2026-11-05).
Live reference: [`ui/wirescape-ui-kit.html`](../ui/wirescape-ui-kit.html). Open it in Chromium; every control works and the top bar shows the real per-frame cost.
Anything not in this file or the kit is either archived ([ARCHIVE.md](ARCHIVE.md)) or rejected ([DECISIONS.md](DECISIONS.md)).

## 1. Principles

1. **One drawing per control type.** Modules choose controls; they never restyle them. A fader looks the same in every module.
2. **Size follows use, and detail follows size.** The parameter a module is *played* with is big and carries a scale. Amounts and trims are small and carry only what stays legible.
3. **Rust means live.** The single accent (`--rust`) is reserved for live values, modulation and events. Static structure is ink, graphite and hairlines.
4. **No boxes behind displays.** Displays sit directly on the card. Waveforms get a fading dot grid; the filter curve keeps its frequency grid; the envelope sits on a baseline.
5. **Detail on demand.** Source breakdowns and connections live behind an **i**, not on the panel.
6. **Real values drive every animation** (from the prototype brief). Nothing fakes a signal with a CSS loop.
7. **Pi first.** See [PERFORMANCE.md](PERFORMANCE.md).

## 2. Tokens

Source: [`ui/tokens.css`](../ui/tokens.css). The kit sets these on `:root` at startup.

| token | value | use |
|---|---|---|
| `--paper` | `#ffffff` | page |
| `--card` | `#ffffff` | module cards, popovers |
| `--card2` | `#f4f4f2` | rare fills (tape mask, XY pad) |
| `--ink` | `#161616` | text, value arcs, meters, curves |
| `--graph` | `#2e2e2d` | card border, secondary ink |
| `--mute` | `#8c8c88` | labels, fader fill, ticks |
| `--hair` | `#c6c6c2` | tracks, grid lines |
| `--hair2` | `#e2e2df` | faint grid, dividers |
| `--rust` | `#c2501f` | live values, modulation range, events |
| `--blue` | `#2e5f80` | second source in info boxes, pitch hint |
| `--olive` | `#6d7a35` | cv hint |
| graphite cap | `#4a4a48` | knob caps (L and M) |
| page texture | dots, `rgba(0,0,0,.06)`, 16 px | page background |

**Cable palette** (user-picked colour, no meaning): ink `#161616`, rust `#c2501f`, blue `#2e5f80`, olive `#6d7a35`, ochre `#c99a2e`, slate `#5d6a73`.

**Jack ring colour follows the port hint** (brief): audio ink, pitch blue, cv olive, gate/trigger rust, events plum `#7b4a8c`. See OPEN-2.

**Type**

| role | font | size / weight |
|---|---|---|
| titles, module names | IBM Plex Sans | 500, 20 px (section) / 11 px (card name) |
| body, notes | IBM Plex Sans | 400, 13 px |
| values | IBM Plex Mono | 400, 11 px (M), 12.5 px (L), 9.5 px (S), tabular numbers |
| labels | IBM Plex Mono | 500, 8.5 px, caps, 0.09 em tracking, `--mute` |
| live value | IBM Plex Mono | 9 px, `--rust`, prefixed `→ ` |
| module code | IBM Plex Mono | 600, 10 px, 0.14 em tracking |

## 3. Value formatting

Round to what matters; never show digits that carry no meaning.

| unit | rule | examples |
|---|---|---|
| Hz | < 1 Hz: 2 dp · < 100: 1 dp · < 1 k: 0 dp · ≥ 1 k: kHz, 1 dp (≥ 10 k: 0 dp) | 0.35 Hz, 12.5 Hz, 440 Hz, 1.2 kHz, 12 kHz |
| ms | < 10: 1 dp · < 1000: 0 dp · ≥ 1 s: s, 1 dp | 4.5 ms, 375 ms, 1.2 s |
| % | 0 dp; bipolar shows a sign | 40%, +30%, −40% |
| dB | 1 dp, signed; ≤ −59.5 shows −∞ | −8.0 dB, +2.0 dB |
| st / ct | 1 dp semitones / 0 dp cents, signed | +7.0 st, +12 ct |
| ratio | stepped list, compressor-style | 1:1 1.1:1 1.25:1 1.5:1 2:1 3:1 4:1 6:1 8:1 10:1 20:1 ∞:1 |
| bpm | 1 dp | 118.5 bpm |
| pitch readout | note + cents, then Hz in small type | C4 +2¢ · 262 Hz |

Range bounds are written tidily ("20 Hz–20 kHz"). The full implementation is `fmt()` and `fmtS()` in the kit.

## 4. Control library

### 4.1 Knob, three tiers

Sweep is 270° (−135° to +135°). Travel follows the parameter taper (log for frequency/time).

| tier | size | track r | cap r | value arc | pressed arc | finish | carries |
|---|---|---|---|---|---|---|---|
| **L** hero | 144 px | 46 | 30 | 2.4 px | 3.6 px | graphite cap, white 2 px pointer | 50 minor + major ticks at the parameter's marks, scale labels, source chips, value, live value |
| **M** standard | 76 px | 26 | 17 | 2 px | 3.2 px | graphite cap, white 1.6 px pointer | end/centre (or mark) ticks, name, value, live value |
| **S** trim | 38 px | 14 | 9 | **2.4 px** | 2.8 px | wire (no cap mass), 0.9 px pointer to track | name, value (9.5 px), live dot |

- Use **L** for the one or two parameters a module is played with (cutoff, LFO rate, tune). Use **M** by default. Use **S** for amounts, depths, trims and offsets. Bipolar S/M knobs fill from 12 o'clock.
- **Hit area** ≥ 44 px for S on touch screens, even though it is drawn at 38 px.
- **Readout under the knob:** name (label style), value (mono), then live value `→ 2.6 kHz` in rust when modulated. On L only, source chips follow (neutral grey text in a hairline box).

**Interaction:** drag vertically (~180 px for the full range; shift ≈ 830 px). Wheel and arrow keys work once the knob is focused (1% steps, 0.2% with shift). Double-click resets to the default. Stepped parameters snap. Typing a value on click is in the brief; it is not in the kit yet.

### 4.2 Other controls

| control | when | spec |
|---|---|---|
| Fader + meter | levels compared down a row | dB scale on the left, 1 px hair track, **grey** 1.5 px fill, 16×8 thumb with a grey centre line, meter **7 px** black bar beside it |
| Meter | any level | rises instantly, falls 0.9 of the range per second, peak line holds 1 s then falls, clip bar above 0.97 for 1.2 s |
| Slider (h) | pan, mix, offsets, PW | needle thumb (2 px + cap); bipolar fills from the centre; rust tick = live |
| Segmented, **round fill** | 2–4 named modes | pill outline; the black indicator slides with an overshoot (`--bounce`, 340 ms) |
| Detent rotary | 5–8 ordered choices | glyphs (waves) or words around the dial; click or drag (16 px per step); pointer snaps with overshoot (360 ms) |
| Toggle | on/off | LED latch for now (**OPEN-1**) |
| Number, **plain dotted** | exact, rarely swept (BPM, ratio, voices) | label + value with a dotted underline, no box; drag sideways (0.004/px) |
| Tape ruler | time/frequency where neighbouring values matter | the scale moves under a fixed rust hairline; flick for inertia |
| XY pad | two parameters with a joint meaning | dotted grid; ring = set; rust dot + fading trail = live |
| Edit on the display | envelopes, filter curve | handles 3.2 px hollow; 1 px curve |

Parameter-to-control rule set (it can be inferred from the module data):

| the parameter is… | control |
|---|---|
| the thing you play the module with | knob L |
| continuous, swept sometimes | knob M |
| an amount of something else, or bipolar | knob S |
| a level compared across a row | fader |
| exact, rarely swept | number |
| 2–4 named states | segmented |
| 5–8 ordered states | detent |
| on/off | toggle |
| two parameters with a joint meaning | XY pad |
| a shape or a set of times | edit on the display |

**Proposed data extension** for `wirescape_modules.json`: an optional `role` per parameter (`hero | primary | secondary | trim | mode | toggle | fader`) and an optional `layout` per module (`tall | wide`). When `role` is missing it is inferred: choices → mode; stepped 0/1 → toggle; dB → fader; min < 0 → trim; first modulatable Hz/ms → hero; the next two → primary; the rest → secondary. Round 1 item S0 demonstrates the inference.

## 5. States and modulation

| state | look |
|---|---|
| idle | as drawn |
| hover | no change to the track; the **i** appears if the knob is modulated |
| pressed / dragging | value arc thickens (see 4.1); the track does not change |
| focus (keyboard) | as pressed |
| modulation target (while dragging a cable) | dashed rust ring outside the track, pulsing opacity 1.1 s |
| modulated | **one** rust arc inside the track shows the combined range `n ± Σ|amount|`, plus a rust live dot at `n + Σ amount·source` |

- Several sources are shown **only as their sum**, as a VCA would hear them; there is no per-source arc. The depth is edited on the cable or in the source; there is no depth handle on the knob.
- **Parameter info (i):** hover a modulated knob and a 13 px **i** appears at its top right. Hovering it opens the box; clicking pins it. Each source row (name in its colour, a 40-sample sparkline, its contribution `+6%`) sends a line into a **+** node, and the sum shows to the right: `+7% → 2.3 kHz`. 120 ms fade/rise.
- **Module info (i in the header):** shows the module's **connections** (`IN ← VCO 65 · out`, `OUT → MIX D6 · 1`) and its **modulated parameters** (`CUTOFF  LFO 1 → 1.3 kHz`).
- The global **Mod** switch hides all modulation drawing; the **Motion** switch (full / calm / off) slows or freezes it.

## 6. Displays

- No background box and no border.
- Waveforms (VCO, LFO): a fading dot grid (1 px dots every 8 px, alpha falling to 0 at the edges, pre-rendered once per size), a 1.1 px ink line with round joins, and **3–4 px horizontal inset** so strokes never clip at the canvas edge. The LFO adds a rust phase line, a dot and `φ 116° +0.90`.
- Filter curve: frequency grid (100 / 1 k / 10 k darker), dashed 0 dB line, dashed set-cutoff line, rust live-cutoff line, a light rust fill under the live curve; in graph mode, a hollow peak handle and `fc · Q` in rust.
- Envelope: baseline axis with segment ticks, 1 px curve, 3.2 px hollow handles, dotted sustain guide, A D S R letters (the active one in rust), rust voice dot. Number boxes below.

## 7. Modules

- **Card:** white, 0.5 px `--graph` border, **14 px radius**, a 1 px bottom shadow line `rgba(0,0,0,.1)`.
- **Proportions:** `tall` (default) or `wide` (a display beside the controls, for modules that need room). Each module picks one; they need not match.
- **Header (A):** `CODE  Name ……… id` in a 6×12 px padded row with a hairline under it. The **i** sits at the right end. View switches (knobs ⇄ graph) also sit in the header.
- **Ports: side rails.** Inputs on the left edge, outputs on the right, spread evenly along the full height, the 12 px jack straddling the card edge, label inside. Jack ring 1.5 px in the hint colour, graphite hole.
- **Layout inside:** hero first, primaries in a row, trims and selectors last. Use a display only where it explains something you can't hear on your own.
- **Filter graph mode** (multimode filters only): a header switch between `KNOBS` and `GRAPH`. *Note for the code team:* graph mode should add control you only get by seeing the curve, as EQ Eight does: drag the peak for cutoff + resonance, scroll on the peak for slope (12/24 dB), and a drive lift on the curve. Simple filters stay knob-only.

The stock set in the kit: VCF (hero-led), VCF multimode with the view switch, VCF wide, VCF slim strip (faders), VCO, LFO, ENV, MIX, CLK. CLK was not reviewed in round 2 (OPEN-7).

## 8. Motion

| kind | budget | examples (duration, easing) |
|---|---|---|
| signal | every frame, one rAF loop, transform/opacity or one canvas | live dots, meters, scopes, phase dots |
| event | one-shot, 150–400 ms, WAAPI on transform/opacity | port pulse (380 ms, scale 1→2.4, opacity .9→0), clock beat pop (220 ms), add module (240 ms, `--bounce`, from −10 px/0.96), **remove (120 ms fade)**, refused edit (280 ms shake ±5 px), connected (200 ms, scale 1.03 + port pulse) |
| interaction | follows the hand, never lags | segmented slide (340 ms bounce), detent snap (360 ms bounce), cable sag spring (k = 90, damping 0.02^dt; recomputed only while moving), tape inertia (velocity × 0.93 per frame) |

- `--bounce: linear(0,.18 5%,.6 13%,1.02 21%,1.13 27%,1.1 33%,1.01 43%,.97 52%,1.005 68%,1)`; `--ease: cubic-bezier(.2,.8,.2,1)`.
- Text readouts update at 10–15 Hz while motion runs at the frame rate.
- With `prefers-reduced-motion`, Motion starts at `off`.

## 9. Cables

- Colour carries no meaning; the user picks it from the palette (§2).
- **Idle:** solid 1.6 px. **Carrying signal:** dotted (round caps, dash 0.1/5, 2.4 px), static (OPEN-4). **Selected:** 2.6 px.
- Drag: sag spring as above. Hit area 12 px.

## 10. Open items

| id | question | current default |
|---|---|---|
| OPEN-1 | toggle style (round 2 Q6 got no pick): LED, switch, invert, square or words | LED latch |
| OPEN-2 | jack rings keep hint colours (brief) while cables have none — keep? | keep hint colours on jacks |
| OPEN-3 | cable palette: round 2 note was cut off at "replace purple with like…" | purple replaced by ochre `#c99a2e`; grey made slate `#5d6a73` |
| OPEN-4 | active cable: static dots vs slowly crawling dots | static dots |
| OPEN-5 | Pi measurements of the kit (FPS, ms per frame) | not measured yet; see PERFORMANCE.md |
| OPEN-6 | which stock modules are `wide` | VCF offers both; others tall |
| OPEN-7 | the Clock card was not reviewed in round 2 | as in round 1 |
| OPEN-8 | typed value entry on click (brief) | not built in the kit |
