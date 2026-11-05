import { test, expect } from '@playwright/test';
import { boot, settle } from './helpers';

test.use({ video: 'on' });
test('review recording, screenshots and frame samples', async ({ page, browser }, info) => {
  const piRun = info.project.metadata.piRun === true;
  test.setTimeout(piRun ? 180_000 : 90_000);
  const environment: Record<string, unknown> = { piRun, headed: info.project.use.headless === false, browser: browser.version() };
  try {
    const session = await browser.newBrowserCDPSession();
    environment.gpu = (await session.send('SystemInfo.getInfo')).gpu;
    await session.detach();
  } catch { environment.gpu = 'unavailable'; }
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await boot(page);
  environment.display = await page.evaluate(() => ({ width: screen.width, height: screen.height, dpr: devicePixelRatio, viewport: [innerWidth, innerHeight], userAgent: navigator.userAgent }));
  for (const id of ['sequence', 'macro', 'drone']) {
    await page.evaluate(id => {
      const a = window.__wirescapeTest;
      const s = a.starters.find((s: { id: string }) => s.id === id);
      a.load(s.patch(), s.name); a.fit(); a.noteOn(60);
    }, id);
    await settle(page, 20);
    await page.screenshot({ path: info.outputPath(`${id}.png`) });
    // Exercise each signature control in the recording.
    if (id === 'sequence') await page.getByTestId('step-gate-2-2').click();
    if (id === 'macro') {
      const bank = page.locator('.model-bank');
      await bank.getByRole('radio').nth(7).click();
    }
    if (id === 'drone') await page.getByTestId('fader-thumb-3-level_a').press('ArrowUp');
    await settle(page, 20);
  }
  // Reproducible 20-module / 40-cable stress fixture, including moving modulation.
  await page.evaluate(() => {
    const a = window.__wirescapeTest;
    const modules = [], connections = [], positions: Record<number, [number, number]> = {};
    for (let i = 0; i < 10; i++) {
      const lfo = i + 1, filter = i + 11;
      modules.push({ id: lfo, module: 'essentials.lfo', parameters: { rate: 0.4 + i / 10 } },
        { id: filter, module: 'essentials.vcf', parameters: { cutoff: 800, resonance: 0.3 } });
      positions[lfo] = [(i % 5) * 600, Math.floor(i / 5) * 1200];
      positions[filter] = [(i % 5) * 600, Math.floor(i / 5) * 1200 + 600];
      connections.push(
        { kind: 'signal', from: { module: filter, port: 'low12' }, to: { module: 11 + (i + 1) % 10, port: 'audio' } },
        { kind: 'modulation', from: { module: lfo, port: 'control' }, to: { module: filter, port: 'cutoff' }, amount: 0.3 },
        { kind: 'modulation', from: { module: lfo, port: 'control' }, to: { module: filter, port: 'resonance' }, amount: 0.1 },
        { kind: 'modulation', from: { module: 1 + (i + 1) % 10, port: 'control' }, to: { module: filter, port: 'cutoff' }, amount: 0.1 },
      );
    }
    a.load({ format: 'wirescape.native.patch', version: 2, modules, connections, ui: { positions } });
    a.noteOn(60);
  });
  const samples = [];
  for (const profile of ['normal', 'pi']) for (const zoom of ['fit', '100%']) {
    await page.evaluate(({ profile, zoom }) => {
      const a = window.__wirescapeTest;
      a.setPref({ profile, autoProfile: false });
      if (zoom === 'fit') a.fit(); else a.zoomTo(1);
    }, { profile, zoom });
    await settle(page, 30);
    const sample = await page.evaluate(async () => {
      const a = window.__wirescapeTest; let sum = 0; const intervals: number[] = [];
      let previous = performance.now(); const start = previous;
      for (let i = 0; i < 120; i++) {
        await new Promise(r => requestAnimationFrame(r));
        const now = performance.now(); intervals.push(now - previous); previous = now;
        sum += a.ticker.applyMs;
      }
      intervals.sort((a, b) => a - b);
      return { frameFps: 120000 / (previous - start), p95FrameMs: intervals[113], visible: document.visibilityState, focused: document.hasFocus(), applyMs: sum / 120, fps: a.fps(), modules: a.state().modules.length, cables: a.state().connections.length };
    });
    samples.push({ profile, zoom, ...sample });
  }
  await info.attach('frame-samples', { body: JSON.stringify({ environment, note: piRun ? 'Pi runner, headed Chromium; inspect display/GPU evidence' : 'Cloud Chromium; not Pi hardware measurements', samples }, null, 2), contentType: 'application/json' });
  console.log('FRAME_SAMPLES', JSON.stringify({ environment, samples }));
  if (piRun) {
    expect(environment.headed).toBe(true);
    expect(samples.every(s => s.visible === 'visible' && s.focused)).toBe(true);
    expect(samples.every(s => s.frameFps >= 30), 'Pi UI target: at least 30 displayed frames/second').toBe(true);
  }
  expect(samples.every(s => s.modules === 20 && s.cables === 40)).toBe(true);
  expect(errors).toEqual([]);
});
