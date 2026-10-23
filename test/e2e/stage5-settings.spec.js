// Stage 5: settings and popup. Promises: "Private", "Can't be tampered with".
import { test, expect } from './support/fixtures.js';
import { readOverlay, waitForKeycaps, computedStyle, boxOf } from './support/overlay.js';
import { VARS, POPUP, STORAGE, ANIMATION } from './support/contract.js';

const SCHEMA_KEYS = [
  'position', 'size', 'speed', 'spacing', 'maskSensitive', 'maskCrossOriginFrames', 'groupCombos', 'showClicks', 'clickColor',
].sort();

async function areaVars(page) {
  const o = await readOverlay(page);
  return computedStyle(page, o.keyArea, [VARS.size, VARS.speed, VARS.spacing]);
}

async function typeOne(page, ch = 'x') {
  await page.locator('#email').click();
  await page.keyboard.type(ch);
  await waitForKeycaps(page, [ch.toUpperCase()]);
  const o = await readOverlay(page);
  return computedStyle(page, o.keycaps.at(-1).nodeId, ['animation-name', 'animation-duration']);
}

test.describe('Stage 5: settings', () => {
  test('defaults apply when nothing is stored', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    expect(await areaVars(page)).toEqual({ [VARS.size]: '1', [VARS.speed]: '2.2s', [VARS.spacing]: '8px' });
    expect(await typeOne(page)).toEqual({ 'animation-name': ANIMATION.float, 'animation-duration': '2.2s' });
  });

  test('speed, size, and spacing update live without a reload', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await ext.setSettings({ speed: 1, size: 1.4, spacing: 20 });
    await expect.poll(() => areaVars(page)).toEqual({ [VARS.size]: '1.4', [VARS.speed]: '1s', [VARS.spacing]: '20px' });
    expect((await typeOne(page))['animation-duration']).toBe('1s');
  });

  test('bad stored values are clamped and the overlay keeps working', async ({ ext }) => {
    await ext.setSettings({
      speed: 999,
      size: 'huge',
      spacing: -4,
      clickColor: 'url(javascript:alert(1))',
      position: { x: 5, y: -1 },
      groupCombos: 'yes',
      maskSensitive: 'no',
      junk: { keystrokes: 'abc' },
    });
    const page = await ext.openPage('/sensitive-fields.html');
    await ext.enable(page);
    await expect.poll(() => areaVars(page)).toEqual({ [VARS.size]: '1', [VARS.speed]: '4s', [VARS.spacing]: '0px' });

    const area = await boxOf(page, (await readOverlay(page)).keyArea);
    const vp = page.viewportSize();
    expect(area.x).toBeGreaterThanOrEqual(0);
    expect(area.y).toBeGreaterThanOrEqual(0);
    expect(area.x + area.width).toBeLessThanOrEqual(vp.width);
    expect(area.y + area.height).toBeLessThanOrEqual(vp.height);

    // maskSensitive: 'no' is not a boolean, so masking stays on.
    await page.locator('#password').click();
    await page.keyboard.type('ab');
    await waitForKeycaps(page, ['•', '•']);
  });

  test('the page has no access to extension storage', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    expect(await page.evaluate(() => typeof chrome === 'undefined' || chrome.storage === undefined)).toBe(true);
    expect(await page.evaluate(() => typeof chrome === 'undefined' || chrome.runtime?.sendMessage === undefined)).toBe(true);
  });

  test('popup controls save normalized settings', async ({ ext, context }) => {
    const popup = await context.newPage();
    await popup.goto(ext.popupUrl);

    await popup.locator(POPUP.speed).fill('3');
    await popup.locator(POPUP.size).fill('1.2');
    await popup.locator(POPUP.spacing).fill('16');
    await popup.locator(POPUP.groupCombos).uncheck();
    await popup.locator(POPUP.showClicks).uncheck();
    await popup.locator(POPUP.corners.tl).click();

    await expect.poll(() => ext.settings()).toMatchObject({
      speed: 3, size: 1.2, spacing: 16, groupCombos: false, showClicks: false,
    });
    const { position } = await ext.settings();
    expect(position.x).toBeLessThan(0.5);
    expect(position.y).toBeLessThan(0.5);
    expect(Object.keys(await ext.settings()).sort()).toEqual(SCHEMA_KEYS);
  });

  test('popup shows both masking options on by default', async ({ ext, context }) => {
    const popup = await context.newPage();
    await popup.goto(ext.popupUrl);
    await expect(popup.locator(POPUP.maskSensitive)).toBeChecked();
    await expect(popup.locator(POPUP.maskFrames)).toBeChecked();
  });

  test('storage holds only settings and tab state', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.locator('#email').click();
    await page.keyboard.type('a whole bunch of typing');
    await page.mouse.click(900, 300);
    await ext.setSettings({ speed: 3 });

    const s = await ext.storage();
    expect(s.local).toEqual({});
    expect(Object.keys(s.sync)).toEqual([STORAGE.settingsKey]);
    expect(Object.keys(s.session)).toEqual([STORAGE.enabledTabsKey]);
    expect(s.session[STORAGE.enabledTabsKey].every(Number.isInteger)).toBe(true);
  });
});
