// Stage 2: Shadow DOM overlay. Promises: "Doesn't interfere", "Can't be tampered with".
import { test, expect, offVsOn } from './support/fixtures.js';
import {
  cdp, readOverlay, hostCount, waitForKeycaps, boxOf, computedStyle, watchHostLightDom,
} from './support/overlay.js';
import { formSession, selectionSession, gridPoints } from './support/sessions.js';

test.describe('Stage 2: Shadow DOM overlay', () => {
  test.beforeEach(async ({ ext }) => {
    await ext.setSettings({ speed: 4 });
  });

  test('the host is a single element under <html>, hidden from assistive tech', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    const o = await readOverlay(page);
    expect(o.count).toBe(1);
    expect(o.parent).toBe('html');
    expect(o.shadowMode).toBe('closed');
    expect(o.hostAttrs['aria-hidden']).toBe('true');
  });

  test('the page cannot read inside the overlay', async ({ ext }) => {
    const page = await ext.openPage('/hostile-js.html');
    await ext.enable(page);
    await page.locator('#field').click();
    await page.keyboard.type('secret');
    await waitForKeycaps(page, ['S', 'E', 'C', 'R', 'E', 'T']);

    const seen = await page.evaluate(() => window.hostile.readShadow());
    expect(seen).toEqual({
      found: true,
      shadowRoot: null,
      innerText: '',
      textContent: '',
      childCount: 0,
      attachThrows: true,
    });
    const scan = await page.evaluate(() => window.hostile.scan());
    expect(scan.bodyText).not.toMatch(/S\s*E\s*C\s*R\s*E\s*T/);
  });

  test('nothing from the overlay reaches the accessibility tree', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.locator('#email').click();
    await page.keyboard.press('F9');
    await waitForKeycaps(page, ['F9']);
    const s = await cdp(page);
    const { nodes } = await s.send('Accessibility.getFullAXTree');
    const names = nodes.map((n) => n.name?.value ?? '').filter(Boolean);
    expect(names.filter((n) => n.includes('F9'))).toEqual([]);
  });

  test('page CSS cannot hide, shrink, or restyle the overlay', async ({ ext }) => {
    const page = await ext.openPage('/hostile-css.html');
    await ext.enable(page);
    await page.locator('#field').click();
    await page.keyboard.type('abc');
    await waitForKeycaps(page, ['A', 'B', 'C']);

    const o = await readOverlay(page);
    const host = await computedStyle(page, o.hostNodeId, ['display', 'opacity', 'visibility']);
    expect(host.display).not.toBe('none');
    expect(host.opacity).toBe('1');
    expect(host.visibility).toBe('visible');

    const cap = await computedStyle(page, o.keycaps[0].nodeId, ['display', 'opacity', 'visibility', 'font-family']);
    expect(cap.display).not.toBe('none');
    expect(cap.visibility).toBe('visible');

    const box = await boxOf(page, o.keycaps[0].nodeId);
    expect(box.width).toBeGreaterThan(10);
    expect(box.height).toBeGreaterThan(10);
    const vp = page.viewportSize();
    expect(box.x + box.width).toBeGreaterThan(0);
    expect(box.x).toBeLessThan(vp.width);
    expect(box.y + box.height).toBeGreaterThan(0);
    expect(box.y).toBeLessThan(vp.height);
  });

  test('a removed overlay comes back and still works', async ({ ext }) => {
    const page = await ext.openPage('/hostile-js.html');
    await ext.enable(page);
    expect(await page.evaluate(() => window.hostile.removeHost())).toBe(true);
    await expect.poll(() => hostCount(page)).toBe(1);
    await page.locator('#field').click();
    await page.keyboard.type('ok');
    await waitForKeycaps(page, ['O', 'K']);
  });

  test('a page fighting removal causes no duplicates and no freeze', async ({ ext }) => {
    const page = await ext.openPage('/hostile-js.html');
    await ext.enable(page);
    await page.evaluate(() => window.hostile.keepRemovingHost(2000));
    const t0 = Date.now();
    await page.evaluate(() => 1);
    expect(Date.now() - t0).toBeLessThan(1000);
    await expect.poll(() => hostCount(page)).toBe(1);
    await page.locator('#field').click();
    await page.keyboard.type('ok');
    await waitForKeycaps(page, ['O', 'K']);
  });

  test('the host light DOM never changes while typing or clicking', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    const records = await watchHostLightDom(page);
    await page.locator('#notes').click();
    await page.keyboard.type('twenty characters!!!');
    await page.mouse.click(700, 300);
    await page.mouse.click(700, 320, { button: 'right' });
    await waitForKeycaps(page, [...'TWENTY'].concat('Space', ...'CHARACTERS!!!'));
    expect(await records()).toEqual([]);
  });

  test('every click under the overlay reaches the page', async ({ ext }) => {
    const probe = await ext.openPage('/recorder.html');
    await ext.enable(probe);
    await probe.locator('#email').click();
    await probe.keyboard.type('xyz');
    await waitForKeycaps(probe, ['X', 'Y', 'Z']);
    const area = await boxOf(probe, (await readOverlay(probe)).keyArea);
    const points = gridPoints(area);

    const { off, on, onPage } = await offVsOn(ext, '/recorder.html', async (page) => {
      for (const [x, y] of points) await page.mouse.click(x, y);
    });
    const clicks = (snap) => snap.log.filter((e) => e.type === 'click' && e.phase === 'bubble');
    expect(clicks(on).length).toBe(100);
    expect(clicks(on)).toEqual(clicks(off));
    expect((await readOverlay(onPage)).count).toBe(1);
  });

  test('off vs on: a form session is identical', async ({ ext }) => {
    const { off, on } = await offVsOn(ext, '/recorder.html', formSession);
    expect(on).toEqual(off);
  });

  test('off vs on: text selection is identical', async ({ ext }) => {
    const { off, on } = await offVsOn(ext, '/recorder.html', selectionSession);
    expect(on.selection.length).toBeGreaterThan(0);
    expect(on).toEqual(off);
  });

  test('off vs on: identical on the hostile CSS page', async ({ ext }) => {
    const { off, on } = await offVsOn(ext, '/hostile-css.html', async (page) => {
      await page.locator('#field').click();
      await page.keyboard.type('hostile');
      await page.mouse.click(1100, 650);
    });
    expect(on).toEqual(off);
  });
});
