# Pi UI test plan: phases 3.5–6

Prepared while the owner is commuting; no Pi access or test execution requested now.
Hardware confirmed by owner: Pi 5B rev1.0, BCM2712, 8GB, MicroSD; externally powered
14-inch 16:9 monitor described as 2K. Measure negotiated resolution and scaling;
do not assume that description means a specific pixel size.

## Quick audit of the main repository

Read-only reference: `kalharbi11/wirescape` local snapshot
`6e3c253550428f2bb964af4434bd429b5284cce2`. Recheck newer instructions before phase7.

| Existing resource | Reuse for this UI test | Keep separate |
|---|---|---|
| `docs/PI_RUNNER.md` | Exact source SHA, uploaded evidence, unavailable stages never reported green, no duplicate evidence runs | Main repo uses private `wirescape-pi` bridge; do not retarget its native workflows to the public UI runner |
| `tools/runner_health.py` | Collect load, available RAM/swap, disk space, temperature, throttling and power observations before/after measurements | No need to copy its network/service checks or install another daemon |
| `tools/pi_ui_probe.py` and its tests | Bounded execution, dedicated output directory, structured stage/error report, preserve useful failure tails | This builds Qt and runs offscreen/software-rendered tests; it cannot replace headed Chromium measurements |
| `docs/PI_KIOSK.md`, `tools/pi/wirescape-kiosk.desktop` | Logged-in graphical session and persistent launchers outside disposable runner workspaces | Do not install the native Qt launcher, change autologin or configure kiosk services for this test |
| Native loader soaks / benchmark baseline | Keep exact-head evidence and distinguish device-free tests from real sound | C++/DSP hashes, Qt UI tests, native benchmark units and audio buffer sweeps are phase7 evidence, not browser FPS baselines |

The main repo's long-running private poll/soak and this repo's runner may share
one Pi. GitHub concurrency groups do not serialize jobs across repositories.
The operator should ensure native builds/soaks are idle during the UI baseline;
no agent will disable or reconfigure the private bridge. Phase7 deliberately
adds real-engine contention later. Keep physical audio/MIDI devices unopened.

## Once the monitor and Pi are connected

1. Log into the desktop and verify the actual resolution, scale and refresh rate.
   Let the Pi settle; avoid concurrent native builds/soaks. No SSH from this agent.
2. Confirm runner `pi-ui` is online with all six documented labels. If GitHub
   assigns a job but reports zero setup steps, inspect the runner service/worker
   log first: that is not a browser failure. Two runner services should have
   separate installation/work directories; check rather than reinstalling them.
3. Ensure the runner user can access the existing X11/XWayland or Wayland desktop.
   Use the variables in PI_UI_RUNNER.md when a service does not inherit the
   session. Do not substitute Xvfb or grant broad display access to make it pass.
4. Resume the owner-only manual workflow on `main` once PR6 is merged. Pending
   earlier runs are not evidence; inspect/cancel duplicates before starting one.
   Autorun is acceptable to the owner, but is not required: current configuration
   remains manual so it cannot accidentally exercise an unavailable desktop.
   If enabling autorun later, retain owner/trusted-ref checks and one hardware job
   at a time; an offline queue is not a failure or a completed test.
5. The job checks ARM64, records OS/model/RAM/browser and desktop selection,
   installs locked Node dependencies plus the ffmpeg helper, builds/typechecks,
   and runs the browser regression suite using system Chromium. No sudo,
   system-package installation, native engine or real device access is required.

## Automated acceptance and evidence

- All existing regression tests: all21 modules, patching at50/100/185% zoom,
  undo/redo, autosave, unknown-field preservation, system fault handling, keyboard
  and dialog fixes, all12 starter layouts at mouse/touch density.
- Headed screenshots and a recording of Sequencer, Macro and Mixer/Output.
- Stress patch:20 modules,40 cables, moving modulation and a held fake-engine note.
  Measure Normal/Pi profiles at fit and100%; use native, un-emulated desktop
  dimensions and record viewport, screen, DPR and GPU/renderer information.
- Each frame sample records measured rAF FPS, p95 interval, smoothed telemetry
  application cost, focus/visibility and fixture counts. Pi profile drawing is
  capped at30Hz independently of loop FPS. Target at least30FPS; inspect interval
  variability as well as the average. Headless/cloud results cannot close OPEN-5.
- Collect read-only load/memory/disk/temperature/throttling observations alongside
  the artifact if performance is poor; missing optional tools are unavailable,
  not zero. Never infer a power fault solely from a historical throttling bit.

Download `pi-ui-<SHA>`: preflight report, JSON test/frame/GPU evidence, screenshots,
video and any failure traces. Record the exact tested revision, OS/Chromium,
resolution/DPR, power/thermal/load context, both profile/zoom results and run link
in PERFORMANCE.md; summarize in DESIGN.md before closing OPEN-5. Do not commit
binary artifacts. Missing desktop, wrong revision, background/focus loss or an
unrun stage stays explicitly blocked; do not weaken checks to call it passed.

## Short owner check on the display

Build a voice by hand; drag a module/cable, adjust a knob and fader, type a value,
map/unmap modulation, select a cable, undo/redo, save/reload and try a starter.
Check readable labels/hit targets at the monitor's actual scale. Exercise the
touch profile only as a layout/hit-area check unless a touchscreen is confirmed;
headless mouse automation does not prove physical touch operation.

## Phase7 boundary

A passing result closes the browser/Pi baseline only. Follow PHASE7_HANDOFF.md
for the native patch codec, asynchronous acknowledgements/refusals and render-safe
telemetry. Then repeat the same visual fixture with the real host and actual
audio contention, measuring dropouts/latency through the main repo's approved
user/device-confirmation workflow. No audible test is part of this UI plan.
