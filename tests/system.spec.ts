import { test, expect, type Page } from '@playwright/test';
import { boot } from './helpers';

/** Phase 5: system status and settings against the fake engine. */

const engine = (page: Page, fn: string, ...args: unknown[]) =>
  page.evaluate(({ fn, args }) => (window.__wirescapeTest as any).engine[fn](...args), { fn, args });
const debug = (page: Page, key: string, on: boolean) =>
  page.evaluate(({ key, on }) => { (window.__wirescapeTest as any).engine.debug[key] = on; }, { key, on });

test.describe('system', () => {
  test('a MIDI device plugged in and out is announced and shown', async ({ page }) => {
    await boot(page);
    await debug(page, 'extraMidiDevice', true);
    await expect(page.locator('.toast', { hasText: 'Keystation 49 connected' })).toBeVisible();
    await expect(page.getByTestId('midi-midi:2')).toBeVisible();
    await debug(page, 'extraMidiDevice', false);
    await expect(page.locator('.toast', { hasText: 'Keystation 49 disconnected' })).toBeVisible();
    await expect(page.getByTestId('midi-midi:2')).toHaveCount(0);
  });

  test('losing the audio device is announced, and so is its return', async ({ page }) => {
    await boot(page);
    await expect(page.getByTestId('status-audio')).toHaveText('RUNNING');
    await debug(page, 'unplugAudio', true);
    await expect(page.getByTestId('status-audio')).toHaveText('DEVICE LOST');
    await expect(page.locator('.toast', { hasText: 'Audio device lost' })).toBeVisible();
    await debug(page, 'unplugAudio', false);
    await expect(page.getByTestId('status-audio')).toHaveText('RUNNING', { timeout: 5000 });
    await expect(page.locator('.toast', { hasText: 'Audio is back' })).toBeVisible();
  });

  test('sample rate and buffer change the latency shown', async ({ page }) => {
    await boot(page);
    await page.getByTestId('open-settings').click();
    await expect(page.getByTestId('audio-rate')).toBeVisible();
    await page.getByTestId('audio-buffer').selectOption('512');
    await page.getByTestId('audio-rate').selectOption('44100');
    await expect(page.getByTestId('status-audio-detail')).toContainText('44.1 kHz · 512 frames · 23.2 ms');
  });

  test('OSC: off by default, local by default, refuses a bad port, shows messages', async ({ page }) => {
    await boot(page);
    await page.getByTestId('open-settings').click();
    await expect(page.getByTestId('status-osc')).toBeHidden();
    await page.getByTestId('osc-enabled').click();
    await expect(page.getByTestId('status-osc')).toHaveText('OSC 9000 · LOCAL');
    await page.getByTestId('osc-port').fill('80');
    await page.getByTestId('osc-port').dispatchEvent('change');
    await expect(page.locator('.toast', { hasText: '1024 to 65535' })).toBeVisible();
    await expect(page.getByTestId('osc-port')).toHaveValue('9000');
    await page.getByTestId('osc-port').fill('9100');
    await page.getByTestId('osc-port').dispatchEvent('change');
    await page.getByTestId('osc-network').click();
    await expect(page.getByTestId('status-osc')).toHaveText('OSC 9100 · NETWORK');
    await expect(page.getByTestId('osc-monitor').locator('.osc-line').first()).toContainText('/wirescape/', { timeout: 5000 });
  });

  test('slow frames switch the Pi profile on, once', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => (window.__wirescapeTest as any).setPref({ profile: 'normal', autoProfile: true }));
    await page.keyboard.press('`');
    await page.getByTestId('debug-slowFrames').click();
    await expect(page.locator('html')).toHaveAttribute('data-profile', 'pi', { timeout: 9000 });
    await expect(page.locator('.toast', { hasText: 'Pi profile is on' })).toBeVisible();
  });

  test('panic, about and the update check', async ({ page }) => {
    await boot(page);
    await engine(page, 'noteOn', 60, 0.8);
    await page.getByTestId('panic').click();
    await expect.poll(() => page.evaluate(() => (window.__wirescapeTest as any).ticker.last?.heldNotes?.length ?? 0)).toBe(0);
    await page.getByTestId('open-settings').click();
    await page.getByTestId('check-updates').click();
    await expect(page.getByTestId('update-status')).toContainText('Up to date', { timeout: 3000 });
  });
});
