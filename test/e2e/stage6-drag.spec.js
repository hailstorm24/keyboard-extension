// Stage 6: dragging. Promises: "Doesn't interfere", "Can't be tampered with".
import { test, expect } from './support/fixtures.js';
import { readOverlay, boxOf, computedStyle, hostCount } from './support/overlay.js';
import { MSG } from './support/contract.js';

const inMoveMode = async (page) => (await readOverlay(page)).grip;

async function enterMoveMode(ext, page) {
  await ext.send(page, { type: MSG.ENTER_MOVE_MODE });
  await expect.poll(() => inMoveMode(page)).toBe(true);
}

test.describe('Stage 6: dragging', () => {
  test('not in move mode by default, and the overlay ignores the mouse', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    const o = await readOverlay(page);
    expect(o.grip).toBe(false);
    expect((await computedStyle(page, o.hostNodeId, ['pointer-events']))['pointer-events']).toBe('none');
    expect((await computedStyle(page, o.keyArea, ['pointer-events']))['pointer-events']).toBe('none');
  });

  test('the page cannot start move mode', async ({ ext }) => {
    const page = await ext.openPage('/hostile-js.html');
    await ext.enable(page);
    await page.evaluate(() => window.hostile.fakeMessages());
    await page.waitForTimeout(500);
    expect(await inMoveMode(page)).toBe(false);
  });

  test('only the grip takes the mouse in move mode', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await enterMoveMode(ext, page);
    const o = await readOverlay(page);
    expect((await computedStyle(page, o.gripNodeId, ['pointer-events']))['pointer-events']).toBe('auto');
    expect((await computedStyle(page, o.keyArea, ['pointer-events']))['pointer-events']).toBe('none');

    // Clicks outside the grip still reach the page.
    const before = (await page.evaluate(() => window.__snapshot())).log.filter((e) => e.type === 'click').length;
    await page.mouse.click(100, 700);
    await page.mouse.click(640, 400);
    const after = (await page.evaluate(() => window.__snapshot())).log.filter((e) => e.type === 'click').length;
    expect(after - before).toBe(4); // capture + bubble for each click
  });

  test('dragging the grip moves the overlay and saves the position', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await enterMoveMode(ext, page);
    const o = await readOverlay(page);
    const grip = await boxOf(page, o.gripNodeId);
    const areaBefore = await boxOf(page, o.keyArea);

    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(250, 200, { steps: 15 });
    await page.mouse.up();

    const areaAfter = await boxOf(page, (await readOverlay(page)).keyArea);
    expect(areaAfter.x).toBeLessThan(areaBefore.x - 200);
    expect(areaAfter.y).toBeLessThan(areaBefore.y - 100);

    await expect.poll(async () => (await ext.settings())?.position?.x ?? 1).toBeLessThan(0.5);
    const { position } = await ext.settings();
    expect(position.y).toBeLessThan(0.5);
    expect(position.x).toBeGreaterThanOrEqual(0);
    expect(position.y).toBeGreaterThanOrEqual(0);

    await page.keyboard.press('Escape');
    await page.reload();
    await expect.poll(() => hostCount(page)).toBe(1);
    const areaReloaded = await boxOf(page, (await readOverlay(page)).keyArea);
    expect(Math.abs(areaReloaded.x - areaAfter.x)).toBeLessThan(2);
    expect(Math.abs(areaReloaded.y - areaAfter.y)).toBeLessThan(2);
  });

  test('the drag does not leak to the page as a selection or drag', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await enterMoveMode(ext, page);
    const grip = await boxOf(page, (await readOverlay(page)).gripNodeId);
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(300, 300, { steps: 10 });
    await page.mouse.up();
    const snap = await page.evaluate(() => window.__snapshot());
    expect(snap.selection).toBe('');
    expect(snap.log.filter((e) => ['dragstart', 'selectstart'].includes(e.type))).toEqual([]);
  });

  test('Esc leaves move mode', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await enterMoveMode(ext, page);
    await page.keyboard.press('Escape');
    await expect.poll(() => inMoveMode(page)).toBe(false);
  });

  test('the exit message leaves move mode', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await enterMoveMode(ext, page);
    await ext.send(page, { type: MSG.EXIT_MOVE_MODE });
    await expect.poll(() => inMoveMode(page)).toBe(false);
  });

  test('switching tabs leaves move mode', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await enterMoveMode(ext, page);
    const other = await ext.openPage('/page2.html');
    await other.bringToFront();
    await expect.poll(() => inMoveMode(page)).toBe(false);
  });

  test('navigating leaves move mode', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await enterMoveMode(ext, page);
    await page.locator('#next').click({ position: { x: 2, y: 2 } });
    await page.waitForURL('**/page2.html');
    await expect.poll(() => hostCount(page)).toBe(1);
    expect(await inMoveMode(page)).toBe(false);
  });

  test('the overlay stays on screen after the window shrinks', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.setViewportSize({ width: 480, height: 360 });
    await expect
      .poll(async () => {
        const a = await boxOf(page, (await readOverlay(page)).keyArea);
        return a.x >= 0 && a.y >= 0 && a.x + a.width <= 480 && a.y + a.height <= 360;
      })
      .toBe(true);
  });
});
