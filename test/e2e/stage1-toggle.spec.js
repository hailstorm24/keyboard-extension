// Stage 1: per-tab switch. Promise: "Stays in its tab".
import { test, expect } from './support/fixtures.js';
import { hostCount, keycapTexts, waitForKeycaps, expectNoKeycaps, readOverlay } from './support/overlay.js';
import { ORIGINS, STORAGE } from './support/contract.js';

test.describe('Stage 1: per-tab switch', () => {
  test('a tab starts off', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    expect(await ext.isEnabled(page)).toBe(false);
    expect(await hostCount(page)).toBe(0);
    expect(await ext.badge(page)).toBe('');
  });

  test('turning on one tab leaves other tabs untouched', async ({ ext }) => {
    const a = await ext.openPage('/recorder.html');
    const b = await ext.openPage('/recorder.html');
    expect(await ext.enable(a)).toEqual({ ok: true });

    await b.bringToFront();
    await b.locator('#email').click();
    await b.keyboard.type('hello');
    await b.reload();
    await b.locator('#email').click();
    await b.keyboard.type('again');

    expect(await hostCount(b)).toBe(0);
    expect(await ext.isEnabled(b)).toBe(false);
    expect(await hostCount(a)).toBe(1);
  });

  test('badge shows ON only for tabs that are on', async ({ ext }) => {
    const a = await ext.openPage('/recorder.html');
    const b = await ext.openPage('/recorder.html');
    await ext.enable(a);
    expect(await ext.badge(a)).toBe('ON');
    expect(await ext.badge(b)).toBe('');
    await ext.disable(a);
    expect(await ext.badge(a)).toBe('');
  });

  test('stays on after reload', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.reload();
    await expect.poll(() => hostCount(page)).toBe(1);
    await page.locator('#email').click();
    await page.keyboard.type('ok');
    await waitForKeycaps(page, ['O', 'K']);
  });

  test('stays on after same-site navigation', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.locator('#next').click();
    await page.waitForURL('**/page2.html');
    await expect.poll(() => hostCount(page)).toBe(1);
    await page.locator('#search').click();
    await page.keyboard.type('hi');
    await waitForKeycaps(page, ['H', 'I']);
  });

  test('stays on after navigating to another site', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.locator('#cross').click();
    await page.waitForURL(`${ORIGINS.other}/page2.html`);
    await expect.poll(() => hostCount(page)).toBe(1);
    expect(await ext.isEnabled(page)).toBe(true);
  });

  test('turning off removes the overlay completely', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.locator('#email').click();
    await page.keyboard.type('abc');
    await ext.disable(page);

    await expect.poll(() => hostCount(page)).toBe(0);
    expect((await readOverlay(page)).count).toBe(0);
    await page.keyboard.type('def');
    await page.mouse.click(600, 400);
    expect(await hostCount(page)).toBe(0);
    expect(await ext.isEnabled(page)).toBe(false);
  });

  test('turning off stops listening: back on, each key shows exactly once', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    for (let i = 0; i < 10; i++) {
      await ext.enable(page);
      await ext.disable(page);
      await expect.poll(() => hostCount(page)).toBe(0);
    }
    await ext.enable(page);
    await ext.setSettings({ speed: 4 });
    await page.locator('#email').click();
    await page.keyboard.type('q');
    await waitForKeycaps(page, ['Q']);
    await page.waitForTimeout(300);
    expect(await keycapTexts(page)).toEqual(['Q']);
    expect(await hostCount(page)).toBe(1);
  });

  test('turning on twice does not inject twice', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await ext.enable(page);
    await ext.setSettings({ speed: 4 });
    await page.locator('#email').click();
    await page.keyboard.type('x');
    await waitForKeycaps(page, ['X']);
    expect(await hostCount(page)).toBe(1);
  });

  test('closing the tab forgets it', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    const tabId = await ext.tabId(page);
    await page.close();
    await expect
      .poll(async () => ((await ext.storage()).session[STORAGE.enabledTabsKey] ?? []).includes(tabId))
      .toBe(false);
  });

  test('stays on after Chrome stops the service worker', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await ext.stopServiceWorker();

    await page.reload();
    await expect.poll(() => hostCount(page)).toBe(1);
    expect(await ext.isEnabled(page)).toBe(true);
    await page.locator('#email').click();
    await page.keyboard.type('up');
    await waitForKeycaps(page, ['U', 'P']);
  });

  test('another tab stays off after the service worker restarts', async ({ ext }) => {
    const a = await ext.openPage('/recorder.html');
    const b = await ext.openPage('/recorder.html');
    await ext.enable(a);
    await ext.stopServiceWorker();
    await b.reload();
    await b.waitForTimeout(500);
    expect(await hostCount(b)).toBe(0);
  });

  test('restricted pages are refused with a reason', async ({ ext, context }) => {
    const page = await context.newPage();
    await page.goto('chrome://version/');
    expect(await ext.setEnabled(page, true)).toEqual({ ok: false, reason: 'restricted' });
    expect(await ext.isEnabled(page)).toBe(false);
  });

  test('extension pages are refused with a reason', async ({ ext, context }) => {
    const page = await context.newPage();
    await page.goto(ext.popupUrl);
    expect(await ext.setEnabled(page, true)).toEqual({ ok: false, reason: 'restricted' });
  });

  test('pages that never load the overlay show no keycaps', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await page.locator('#email').click();
    await page.keyboard.type('nothing');
    await expectNoKeycaps(page, 200);
  });

  // Not automatable: Playwright can't open incognito windows with an
  // unpacked extension, or press browser-level command shortcuts.
  test.fixme('manual: incognito windows stay off unless the user allows the extension there', () => {});
  test.fixme('manual: ⌥⇧K toggles the current tab only', () => {});
  test.fixme('manual: install warning text reviewed (no "read and change all your data" at install)', () => {});
});
