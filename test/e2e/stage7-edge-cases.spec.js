// Stage 7: iframes and other edge cases. Promises: "Private", "Doesn't interfere".
import { test, expect, CANARY, containsCanary } from './support/fixtures.js';
import {
  readOverlay, hostCount, hostCounts, waitForKeycaps, rippleKinds, expectNoRipples, computedStyle, watchHostLightDom,
} from './support/overlay.js';
import { MASK_CHAR, ANIMATION } from './support/contract.js';

const masked = (n) => Array(n).fill(MASK_CHAR);

test.describe('Stage 7: iframes', () => {
  test.beforeEach(async ({ ext }) => {
    await ext.setSettings({ speed: 4 });
  });

  test('only the top frame draws an overlay', async ({ ext }) => {
    const page = await ext.openPage('/payment-frame.html');
    await ext.enable(page);
    await page.frameLocator('#other').locator('#zip').click();
    await page.keyboard.type('1');
    await page.frameLocator('#same').locator('#coupon').click();
    await page.keyboard.type('2');
    const counts = await hostCounts(page);
    expect(counts.find((c) => c.top).count).toBe(1);
    expect(counts.filter((c) => !c.top).map((c) => c.count)).toEqual([0, 0]);
  });

  test('keys in another site\'s iframe are masked by default', async ({ ext }) => {
    const page = await ext.openPage('/payment-frame.html');
    await ext.enable(page);
    await page.frameLocator('#other').locator('#card').click();
    await page.keyboard.type(CANARY);
    await page.frameLocator('#other').locator('#zip').click();
    await page.keyboard.type('02912');
    await waitForKeycaps(page, masked(CANARY.length + 5));
  });

  test('turning off iframe masking shows ordinary fields, but card fields stay masked', async ({ ext }) => {
    await ext.setSettings({ maskCrossOriginFrames: false });
    const page = await ext.openPage('/payment-frame.html');
    await ext.enable(page);
    await page.frameLocator('#other').locator('#zip').click();
    await page.keyboard.type('029');
    await page.frameLocator('#other').locator('#card').click();
    await page.keyboard.type('4242');
    await waitForKeycaps(page, ['0', '2', '9', ...masked(4)]);
  });

  test('keys in a same-site iframe show normally', async ({ ext }) => {
    const page = await ext.openPage('/payment-frame.html');
    await ext.enable(page);
    await page.frameLocator('#same').locator('#coupon').click();
    await page.keyboard.type('save');
    await waitForKeycaps(page, ['S', 'A', 'V', 'E']);
  });

  for (const maskFrames of [true, false]) {
    test(`the top page cannot observe keys typed in another site's iframe (iframe masking ${maskFrames ? 'on' : 'off'})`, async ({ ext }) => {
      await ext.setSettings({ maskCrossOriginFrames: maskFrames });
      const page = await ext.openPage('/payment-frame.html');
      await ext.enable(page);
      const hostRecords = await watchHostLightDom(page);
      const before = await page.evaluate(() => window.__snapshot());

      await page.frameLocator('#other').locator('#zip').click();
      await page.keyboard.type(CANARY);
      await expect.poll(async () => (await readOverlay(page)).keycaps.length).toBe(CANARY.length);

      const after = await page.evaluate(() => window.__snapshot());
      expect(containsCanary(after)).toBe(false);
      expect(after.messages).toEqual(before.messages);
      expect(after.mutations).toEqual(before.mutations);
      expect(await hostRecords()).toEqual([]);
      expect(containsCanary(await page.content())).toBe(false);
    });
  }

  test('clicks in another site\'s iframe show no ripple while it is masked', async ({ ext }) => {
    const page = await ext.openPage('/payment-frame.html');
    await ext.enable(page);
    // Click an empty spot in each frame (below the short <body>, so on <html>).
    await page.frameLocator('#other').locator('html').click({ position: { x: 300, y: 100 } });
    await expectNoRipples(page);
    await page.frameLocator('#same').locator('html').click({ position: { x: 300, y: 100 } });
    await expect.poll(() => rippleKinds(page)).toEqual(['left']);
  });

  test('a click in a same-site iframe shows its ripple at the right spot on the page', async ({ ext }) => {
    const page = await ext.openPage('/payment-frame.html');
    await ext.enable(page);
    const frameBox = await page.locator('#same').boundingBox();
    await page.mouse.click(frameBox.x + 300, frameBox.y + 100);
    await expect.poll(() => rippleKinds(page)).toEqual(['left']);
  });
});

test.describe('Stage 7: other edge cases', () => {
  test.beforeEach(async ({ ext }) => {
    await ext.setSettings({ speed: 4 });
  });

  test('fullscreen: the overlay moves into the fullscreen element and back', async ({ ext }) => {
    const page = await ext.openPage('/fullscreen.html');
    await ext.enable(page);
    await page.locator('#fs').click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('player');
    await expect.poll(async () => (await readOverlay(page)).parent).toBe('div#player');

    await page.locator('#player-input').click();
    await page.keyboard.type('fs');
    await waitForKeycaps(page, ['F', 'S']);

    await page.evaluate(() => document.exitFullscreen());
    await expect.poll(async () => (await readOverlay(page)).parent).toBe('html');
    expect(await hostCount(page)).toBe(1);
  });

  test('single-page app replacing <body> keeps the overlay working', async ({ ext }) => {
    const page = await ext.openPage('/spa.html');
    await ext.enable(page);
    await page.locator('#go').click();
    await page.locator('#name').click();
    await page.keyboard.type('spa');
    await waitForKeycaps(page, ['S', 'P', 'A']);
    expect(await hostCount(page)).toBe(1);
  });

  test('single-page app replacing everything under <html> gets the overlay back', async ({ ext }) => {
    const page = await ext.openPage('/spa.html');
    await ext.enable(page);
    await page.evaluate(() => window.spa.replaceDocument());
    await expect.poll(() => hostCount(page)).toBe(1);
    await page.locator('#name').click();
    await page.keyboard.type('ok');
    await waitForKeycaps(page, ['O', 'K']);
  });

  test('strict Content Security Policy: works and causes no violations', async ({ ext, consoleLog }) => {
    const page = await ext.openPage('/strict-csp.html');
    const violations = [];
    page.on('console', (m) => /Content Security Policy|Refused to/i.test(m.text()) && violations.push(m.text()));
    await ext.enable(page);
    await page.locator('#field').click();
    await page.keyboard.type('csp');
    await waitForKeycaps(page, ['C', 'S', 'P']);
    const o = await readOverlay(page);
    const style = await computedStyle(page, o.keycaps[0].nodeId, ['animation-name']);
    expect(style['animation-name']).toBe(ANIMATION.float);
    expect(violations).toEqual([]);
    expect(consoleLog.filter((l) => /Refused to/i.test(l))).toEqual([]);
  });

  test('reduced motion: keycaps fade instead of floating', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ext.enable(page);
    await page.locator('#email').click();
    await page.keyboard.type('m');
    await waitForKeycaps(page, ['M']);
    const o = await readOverlay(page);
    expect((await computedStyle(page, o.keycaps[0].nodeId, ['animation-name']))['animation-name']).toBe(ANIMATION.fade);
  });

  test.fixme('manual: popup explains why chrome:// and Web Store pages can\'t be used', () => {});
  test.fixme('manual: real-site checklist in docs/TRUST.md (Gmail, Docs, YouTube fullscreen, React app, Stripe test checkout, GitHub)', () => {});
});
