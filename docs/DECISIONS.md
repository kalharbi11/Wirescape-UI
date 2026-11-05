# Decision log

What the user chose in each control-jam round, and why the spec looks the way it does. The current spec is [DESIGN.md](DESIGN.md).

## Round 1 (2026-11-05, 52 items)

| topic | decision |
|---|---|
| knob types | hero (L), standard (M), trim (S), fader, sliders, tape ruler, detent, XY: **keep** |
| hero knob | wire liked at first, but the pointer was too faint → hero ended up **black / graphite** (round 2) |
| small knobs | thin outer arcs vanish when small → thicker value arc |
| layers | **no** ghost needle, comet trail, histogram, value band or inner scope |
| pressed state | the track must not darken; the value arc thickens instead |
| several sources | show **only the combined result** (as into a VCA), one rust range; no second blue arc |
| depth handle | dropped in round 2 (it duplicates the range) |
| readouts | range ruler and inside-cap readouts dropped; readouts were too busy (musical meaning, ms period dropped) |
| info | wanted: a small, light info box behind an **i**, with leader lines per source |
| number boxes | no grey box; rounding to what matters; ratios like Ableton's compressor |
| segmented, toggle | wanted more variants (round 2) |
| displays | no grey box behind the VCO waveform or the ADSR; ADSR too thick/cartoonish |
| filter | the hero-led graphic is liked; graph mode for multimode filters, with a coders' note on extra control |
| slim strip | keep, as part of a library of controls styled the same everywhere |
| LFO | keep; its sync button should match the other controls |
| mixer | thicker meter bars; fader line dark grey so it is not confused with the meter; fix the right meter (now ballistic) |
| cables | colour difference too weak; no meaning in colour; the line should turn dotted (Grasshopper); user-picked colours |
| remove animation | a quick fade |
| chaos / signature | periodic-vs-chaotic knob demo dropped; the attractor drawing is kept aside (P4) |
| notation section | tri-spoke shape (P1), jog wheel (P2), patch map (P3) etc. archived; history mesh, pill pairs and serif type dropped |
| polar plot | archived, to be redrawn minimal (P9) |

## Round 2 (2026-11-05, 19 items)

| item | pick | applied as |
|---|---|---|
| Q1 hero pointer | **B** graphite cap, 2 px pointer | graphite `#4a4a48` for every solid cap (L and M) |
| Q2 small knobs | **C** wire, 2.4 px | S tier = wire, 2.4 px value arc |
| Q3 hierarchy | **C** graphite · graphite · (small from Q2) | L/M graphite, S wire |
| Q4 numbers | **C** plain, dotted underline | the default number style |
| Q5 segmented | **E** round fill | the default segmented style |
| Q6 toggle | — (no pick) | LED kept, OPEN-1 |
| Q7 info | **A + C** | parameter i: sources converge into a **+ sum node** (the sum in the middle, as asked); module i: connections + modulated params |
| Q8 readout | **A** `→ live value` | the default |
| Q9 waveform | **C** fading dot grid | plus an inset so the stroke is never cropped at the right edge |
| Q10 ADSR | **A** baseline axis | |
| Q11 filter view switch | keep | the multimode VCF has a KNOBS/GRAPH switch in its header |
| Q12 cables | dotted while active; more saturated grey; "replace purple with like…" (cut off) | slate grey `#5d6a73`, ochre `#c99a2e` instead of purple (OPEN-3) |
| K2 states | the depth handle is unnecessary | removed |
| K4 slim strip, K6 mixer | keep | |
| K5 LFO | wave view, no grey background | wave only, dot grid |
| E1 theme | white; the page background white too | `--paper: #ffffff`, dot texture |
| E2 shape | **B** (tall, r 14) and **D** (wide) as options | per module: `tall` or `wide`, 14 px radius |
| E3 ports | **A** side rails, spread | |
| E4 header | **A**; E archived | P14 |

Rejected outright (don't revive without asking): ghost needle, comet trail, histogram, value band, inner scope, range ruler, inside-cap readout, leader-line popups as value readouts, history mesh, pill pairs with contour labels, serif display type, periodic-vs-chaotic knob demo, colour-coded cables, the grey display box, the per-source modulation arcs.
