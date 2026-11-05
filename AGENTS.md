# Wirescape UI: start here

Wirescape is a browser-based modular synth UI that targets a Raspberry Pi (Chromium) first and the laptop second. This repo holds the **design system and a working reference implementation** of its interface. The prototype brief (the app structure, fake engine, patch format, feature list) lives in the Claude Docs artifact "Wirescape UI prototype brief": https://claude.ai/artifact/XYQYjdRGwLHrUswEeSn5jx

## Read in this order

1. [`docs/DESIGN.md`](docs/DESIGN.md): the spec (tokens, formatting, controls, states, modulation, displays, modules, motion, cables, open items).
2. [`ui/wirescape-ui-kit.html`](ui/wirescape-ui-kit.html): the reference implementation. Open it and use it; when the spec and the kit disagree, ask.
3. [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md): rules plus measured costs. Read it before adding anything that moves.
4. [`docs/DECISIONS.md`](docs/DECISIONS.md): what the user chose and rejected. Don't revive rejected ideas.
5. [`docs/ARCHIVE.md`](docs/ARCHIVE.md): parked ideas (P1–P15). Don't build them unless asked.
6. [`docs/REFERENCES.md`](docs/REFERENCES.md): libraries, plugin precedents, visual references.

## Files

| path | what |
|---|---|
| `ui/wirescape-ui-kit.html` | self-contained reference page (no libraries, ~110 kB): tokens, control library, states + info boxes, displays, 9 stock module cards, motion, cables, archive index |
| `ui/tokens.css` | design tokens as CSS variables |
| `docs/*.md` | spec, performance, decisions, archive, references |
| `archive/sketches/control-jam-r1.html` | round 1 exploration (~60 ideas, incl. archived ones), published at https://claude.ai/artifact/G6WHy9jfYvcedE6b8E2P6d |
| `archive/sketches/control-jam-r2.html` | round 2 options page, published at https://claude.ai/artifact/QgS2XUea5qkom9bWimizmM |

Not in this repo (they are referenced by the brief): `WIRESCAPE_Studio_Final.html` (the first visual sketch) and `wirescape_modules.json` (the 21 real modules). Ask the user for them before building panels from data.

## How the kit's code is organised

One `<script>`, top to bottom:

1. **utilities**: `h()` / `s()` (HTML/SVG element builders), `arc()`, `pol()`, `canv()`, `fmt()` / `fmtS()` (value formatting, DESIGN §3), themes/tokens (`C`, `THEMES`).
2. **`Param`**: range, taper (lin/log), step, choices, `mods` (modulation list), `live()` (modulated value), subscriptions.
3. **globals + loop**: `G` (mod/motion/finish map/Pi switch), `S` (current value of each mod source), `SRC` (source names/colours), `tickers` + an `IntersectionObserver`, `sims`, and the single `requestAnimationFrame` `loop()`, which also feeds the perf readout.
4. **`knob()`**: tiers `TIERS`, finishes `drawFinish()`, combined modulation arc, live dot, interaction.
5. **controls**: `numBox`, `tape`, `fader`, `meter`, `slider`, `seg`, `detent`, `toggle`, `xy`.
6. **`jack()`, `card()`**: ports with event pulses; module cards with side rails.
7. **page scaffolding**: `section()`, `item()`.
8. **shared module params + sims**: `P.*` (filter, oscillator, LFO, envelope, mixer, clock), the LFO/clock/envelope simulations standing in for engine telemetry.
9. **displays**: `vcfResp` / `vcfDisplay`, `waveCanvas` / `dotGrid`, `adsrView`, `pathLUT`.
10. **info**: `attach2`, `sumInfo` (parameter i), `modInfo` (module i).
11. **sections 00–06**, each `item(sec,'ID',title,note,opts,build)`.

The sims (`sims`, `S`, `ENV`, `onStep`) stand in for the brief's `EngineClient.onTelemetry`. In the real app they become telemetry fields; the drawing code doesn't change.

## Mapping to the app structure in the brief

- `src/theme/` ← `ui/tokens.css`, `C`/`THEMES`
- `src/panels/` ← `knob`, `fader`, `meter`, `slider`, `seg`, `detent`, `toggle`, `numBox`, `tape`, `xy`, `vcfDisplay`, `waveCanvas`, `adsrView`, `attach2` / info boxes, plus the role → control rules (DESIGN §4.2)
- `src/canvas/` ← `card`, `jack`, cable styles (DESIGN §9), cable sag spring (kit A4)
- `src/engine/FakeEngine` ← the kit's `sims` and `S`

## Working rules

- Follow the brief's Pi rules and [PERFORMANCE.md](docs/PERFORMANCE.md). Check the top-bar `loop ms/frame` after any change.
- Rust is only for live values, modulation and events.
- Use the controls; don't restyle them per module.
- Record new design decisions in `docs/DECISIONS.md`, and update `docs/DESIGN.md` when the spec changes.

## Running and checking the kit

Open `ui/wirescape-ui-kit.html` directly in Chromium (it needs no server; fonts load from Google Fonts). For automated checks, Playwright:

```js
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:1000}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+process.cwd()+'/ui/wirescape-ui-kit.html');await p.waitForTimeout(1500);
await p.screenshot({path:'kit.png'});console.log(await p.textContent('#perf'));await b.close();})();
```

### Measuring

Per-widget cost, all widgets forced visible (paste into `page.evaluate`):

```js
new Promise(res=>{const st=new Map();for(const t of tickers){const f=t.fn;t.fn=(...a)=>{const t0=performance.now();f(...a);
 const id=(t.el.closest('.item')||{}).id||'?';st.set(id,(st.get(id)||0)+performance.now()-t0);};t.vis=true;}
 let n=0;const c=()=>{if(++n<120)requestAnimationFrame(c);else res([...st].sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+(v/120).toFixed(3)+' ms'));};requestAnimationFrame(c);})
```
