// Cross-cutting "Private" checks over a full session: the canary audit and
// network silence. See docs/TRUST.md.
import { test, expect, CANARY, containsCanary } from './support/fixtures.js';
import { waitForKeycaps } from './support/overlay.js';
import { MSG } from './support/contract.js';

async function fullSession(ext) {
  await ext.setSettings({ speed: 1 });

  const form = await ext.openPage('/recorder.html');
  await ext.enable(form);
  for (const sel of ['#email', '#password', '#notes']) {
    await form.locator(sel).click();
    await form.keyboard.type(CANARY);
  }
  await form.mouse.click(900, 300);

  const sensitive = await ext.openPage('/sensitive-fields.html');
  await ext.enable(sensitive);
  for (const sel of ['#email', '#password', '#cc-number', '#otp']) {
    await sensitive.locator(sel).click();
    await sensitive.keyboard.type(CANARY);
  }

  const pay = await ext.openPage('/payment-frame.html');
  await ext.enable(pay);
  await pay.locator('#email').click();
  await pay.keyboard.type(CANARY);
  await pay.frameLocator('#same').locator('#coupon').click();
  await pay.keyboard.type(CANARY);
  await pay.frameLocator('#other').locator('#card').click();
  await pay.keyboard.type(CANARY);
  await pay.frameLocator('#other').locator('#zip').click();
  await pay.keyboard.type(CANARY);

  await ext.send(form, { type: MSG.ENTER_MOVE_MODE });
  await form.keyboard.press('Escape');
  await ext.setSettings({ size: 1.2, spacing: 12 });
  await ext.disable(form);
  await ext.enable(form);
  await form.reload();
  await form.locator('#email').click();
  await form.keyboard.type(CANARY);
  await form.waitForTimeout(1200);

  return { form, sensitive, pay };
}

test.describe('Privacy: full-session audit', () => {
  test('the canary never reaches storage', async ({ ext }) => {
    await fullSession(ext);
    const s = await ext.storage();
    expect(containsCanary(s)).toBe(false);
  });

  test('the canary never reaches any console', async ({ ext, consoleLog }) => {
    await fullSession(ext);
    expect(consoleLog.filter(containsCanary)).toEqual([]);
  });

  test('the extension makes no network requests', async ({ ext, network }) => {
    await fullSession(ext);
    expect(network.violations()).toEqual([]);
    // The worker loading its own packaged modules is fine; anything else isn't.
    expect(network.requests.filter((r) => r.fromWorker && !r.url.startsWith('chrome-extension://'))).toEqual([]);
  });

  test('the canary never appears in any frame\'s DOM or messages', async ({ ext }) => {
    const { form, sensitive, pay } = await fullSession(ext);
    for (const page of [form, sensitive, pay]) {
      for (const frame of page.frames()) {
        const html = await frame.content();
        expect(containsCanary(html), frame.url()).toBe(false);
        const messages = await frame.evaluate(() => window.__snapshot?.().messages ?? []);
        expect(containsCanary(messages), frame.url()).toBe(false);
      }
    }
  });

  test('masked fields never put a real character on screen', async ({ ext }) => {
    await ext.setSettings({ speed: 4 });
    const page = await ext.openPage('/sensitive-fields.html');
    await ext.enable(page);
    await page.locator('#cc-number').click();
    await page.keyboard.type(CANARY);
    await waitForKeycaps(page, Array(CANARY.length).fill('•'));
  });
});
