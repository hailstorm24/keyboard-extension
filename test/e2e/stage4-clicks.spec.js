// Stage 4: clicks. Promises: "Private", "Doesn't interfere".
import { test, expect, offVsOn } from './support/fixtures.js';
import { cdp, readOverlay, rippleKinds, expectNoRipples, boxOf } from './support/overlay.js';
import { editorsSession } from './support/sessions.js';

// An empty spot on recorder.html, away from the form.
const SPOT = { x: 900, y: 300 };

test.describe('Stage 4: clicks', () => {
  test.beforeEach(async ({ ext }) => {
    await ext.setSettings({ speed: 4 });
  });

  test('left, middle, and right clicks show different ripples', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.mouse.click(SPOT.x, SPOT.y);
    await page.mouse.click(SPOT.x, SPOT.y + 40, { button: 'middle' });
    await page.mouse.click(SPOT.x, SPOT.y + 80, { button: 'right' });
    await expect.poll(() => rippleKinds(page)).toEqual(['left', 'middle', 'right']);
  });

  test('the ripple is centered on the cursor', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.mouse.click(SPOT.x, SPOT.y);
    await expect.poll(() => rippleKinds(page)).toEqual(['left']);
    const box = await boxOf(page, (await readOverlay(page)).ripples[0].nodeId);
    expect(Math.abs(box.x + box.width / 2 - SPOT.x)).toBeLessThan(4);
    expect(Math.abs(box.y + box.height / 2 - SPOT.y)).toBeLessThan(4);
  });

  test('pen input shows a pen ripple', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    const s = await cdp(page);
    const base = { x: SPOT.x, y: SPOT.y, button: 'left', clickCount: 1, pointerType: 'pen' };
    await s.send('Input.dispatchMouseEvent', { ...base, type: 'mousePressed' });
    await s.send('Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' });
    await expect.poll(() => rippleKinds(page)).toEqual(['pen']);
  });

  test('clicks faked by the page do not show', async ({ ext }) => {
    const page = await ext.openPage('/hostile-js.html');
    await ext.enable(page);
    await page.evaluate(() => window.hostile.fakeClicks());
    await expectNoRipples(page);
  });

  test('turning clicks off shows no ripples', async ({ ext }) => {
    await ext.setSettings({ showClicks: false });
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.mouse.click(SPOT.x, SPOT.y);
    await expectNoRipples(page);
  });

  test('a PIN pad next to a masked field shows no ripples', async ({ ext }) => {
    const page = await ext.openPage('/sensitive-fields.html');
    await ext.enable(page);
    for (const d of ['1', '9', '0', '5']) await page.locator('#pinpad button', { hasText: d }).click();
    expect(await page.locator('#pin').inputValue()).toBe('1905');
    await expectNoRipples(page);

    await page.locator('#unrelated').click();
    await expect.poll(() => rippleKinds(page)).toEqual(['left']);
  });

  test('clicks on and right next to a password field show no ripples', async ({ ext }) => {
    const page = await ext.openPage('/sensitive-fields.html');
    await ext.enable(page);
    const box = await page.locator('#password').boundingBox();
    await page.mouse.click(box.x + 5, box.y + 5);
    await page.mouse.click(box.x + box.width + 20, box.y + box.height / 2);
    await expectNoRipples(page);
  });

  test('the submit button in a form with a password shows no ripple', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.locator('#submit').click();
    await expectNoRipples(page);
  });

  test('off vs on: selection, double-click, drawing, drag-and-drop, and context menus are identical', async ({ ext }) => {
    const { off, on } = await offVsOn(ext, '/editors.html', editorsSession);
    expect(on.page).toMatchObject({ strokes: 1, drops: 1, contextMenus: 1, dblclicks: 1 });
    expect(on).toEqual(off);
  });
});

test.describe('Stage 4: touch', () => {
  test.use({ hasTouch: true });

  test('a tap shows a touch ripple and reaches the page', async ({ ext }) => {
    await ext.setSettings({ speed: 4 });
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.touchscreen.tap(SPOT.x, SPOT.y);
    await expect.poll(() => rippleKinds(page)).toEqual(['touch']);
    const snap = await page.evaluate(() => window.__snapshot());
    expect(snap.log.some((e) => e.type === 'pointerdown' && e.pointerType === 'touch')).toBe(true);
  });
});
