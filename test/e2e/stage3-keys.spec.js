// Stage 3: keys. Promises: "Private", "Doesn't interfere", "Can't be tampered with".
import { test, expect, offVsOn, CANARY } from './support/fixtures.js';
import { cdp, keycapTexts, waitForKeycaps, expectNoKeycaps, readOverlay } from './support/overlay.js';
import { MASK_CHAR } from './support/contract.js';
import { shortcutsSession, editorsSession } from './support/sessions.js';

const masked = (n) => Array(n).fill(MASK_CHAR);

test.describe('Stage 3: keys', () => {
  test.beforeEach(async ({ ext }) => {
    await ext.setSettings({ speed: 4 });
  });

  test('typed letters show in order', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.locator('#email').click();
    await page.keyboard.type('hey');
    await waitForKeycaps(page, ['H', 'E', 'Y']);
  });

  test('special keys show as symbols', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.locator('#notes').click();
    for (const k of ['Enter', 'Backspace', 'Tab', 'Escape', 'ArrowUp', 'Space']) await page.keyboard.press(k);
    await waitForKeycaps(page, ['↵', '⌫', '⇥', 'Esc', '↑', 'Space']);
  });

  test('shortcuts show as one keycap when grouping', async ({ ext }) => {
    const page = await ext.openPage('/shortcuts.html');
    await ext.enable(page);
    await page.locator('#editor').click();
    await page.keyboard.press('ControlOrMeta+k');
    await expect.poll(() => keycapTexts(page)).toHaveLength(1);
    expect(['⌘+K', '⌃+K']).toContain((await keycapTexts(page))[0]);
  });

  test('without grouping, the modifier and key show separately', async ({ ext }) => {
    await ext.setSettings({ groupCombos: false });
    const page = await ext.openPage('/shortcuts.html');
    await ext.enable(page);
    await page.locator('#editor').click();
    await page.keyboard.press('ControlOrMeta+k');
    await expect.poll(() => keycapTexts(page)).toHaveLength(2);
    const [mod, k] = await keycapTexts(page);
    expect(['⌘', '⌃']).toContain(mod);
    expect(k).toBe('K');
  });

  test('a modifier pressed alone shows when released', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.locator('#email').click();
    await page.keyboard.down('Shift');
    await page.keyboard.up('Shift');
    await waitForKeycaps(page, ['⇧']);
  });

  test('a held key shows once', async ({ ext }) => {
    const page = await ext.openPage('/recorder.html');
    await ext.enable(page);
    await page.locator('#email').click();
    for (let i = 0; i < 6; i++) await page.keyboard.down('a');
    await page.keyboard.up('a');
    await waitForKeycaps(page, ['A']);
    await page.waitForTimeout(300);
    expect(await keycapTexts(page)).toEqual(['A']);
  });

  test.describe('masking', () => {
    const fields = ['#password', '#cc-number', '#cc-csc', '#cc-exp', '#otp'];
    for (const sel of fields) {
      test(`${sel} shows only bullets`, async ({ ext }) => {
        const page = await ext.openPage('/sensitive-fields.html');
        await ext.enable(page);
        await page.locator(sel).click();
        await page.keyboard.type(CANARY);
        await waitForKeycaps(page, masked(CANARY.length));
      });
    }

    test('a non-sensitive field on the same page is not masked', async ({ ext }) => {
      const page = await ext.openPage('/sensitive-fields.html');
      await ext.enable(page);
      await page.locator('#email').click();
      await page.keyboard.type('ab');
      await waitForKeycaps(page, ['A', 'B']);
    });

    test('a password field stays masked after "show password"', async ({ ext }) => {
      const page = await ext.openPage('/sensitive-fields.html');
      await ext.enable(page);
      await page.locator('#toggle-password').click();
      await page.keyboard.type('ab');
      await page.locator('#show').click();
      expect(await page.locator('#toggle-password').getAttribute('type')).toBe('text');
      await page.locator('#toggle-password').click();
      await page.keyboard.type('cd');
      await waitForKeycaps(page, masked(4));
    });

    test('shortcuts and special keys in a masked field are masked too', async ({ ext }) => {
      const page = await ext.openPage('/sensitive-fields.html');
      await ext.enable(page);
      await page.locator('#password').click();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Enter');
      await waitForKeycaps(page, masked(3));
    });

    test('turning off sensitive masking shows password keys', async ({ ext }) => {
      await ext.setSettings({ maskSensitive: false });
      const page = await ext.openPage('/sensitive-fields.html');
      await ext.enable(page);
      await page.locator('#password').click();
      await page.keyboard.type('ab');
      await waitForKeycaps(page, ['A', 'B']);
    });
  });

  test('keys faked by the page do not show', async ({ ext }) => {
    const page = await ext.openPage('/hostile-js.html');
    await ext.enable(page);
    await page.evaluate(() => window.hostile.fakeKeys(['Z', 'X', 'Q']));
    await expectNoKeycaps(page);
  });

  test('composition text faked by the page does not show', async ({ ext }) => {
    const page = await ext.openPage('/hostile-js.html');
    await ext.enable(page);
    await page.evaluate(() => {
      const field = document.getElementById('field');
      field.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      field.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'FAKE', isComposing: true, inputType: 'insertCompositionText' }));
      field.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'FAKE' }));
    });
    await expectNoKeycaps(page);
  });

  test('IME composition shows the final text once', async ({ ext }) => {
    const page = await ext.openPage('/editors.html');
    await ext.enable(page);
    await page.locator('#plain').click();
    const s = await cdp(page);
    await s.send('Input.imeSetComposition', { text: 'に', selectionStart: 1, selectionEnd: 1 });
    await s.send('Input.imeSetComposition', { text: 'にほ', selectionStart: 2, selectionEnd: 2 });
    await s.send('Input.imeSetComposition', { text: 'にほん', selectionStart: 3, selectionEnd: 3 });
    await s.send('Input.insertText', { text: '日本' });
    await waitForKeycaps(page, ['日本']);
    expect(await page.locator('#plain').inputValue()).toBe('日本');
  });

  test('off vs on: page shortcuts behave identically', async ({ ext }) => {
    const { off, on } = await offVsOn(ext, '/shortcuts.html', shortcutsSession);
    expect(on.page.paletteOpens).toBe(1);
    expect(on.page.helpOpens).toBe(1);
    expect(on).toEqual(off);
  });

  test('off vs on: rich text, plain text, canvas, and drag-and-drop behave identically', async ({ ext }) => {
    const { off, on } = await offVsOn(ext, '/editors.html', editorsSession);
    expect(on.page.drops).toBe(1);
    expect(on.page.strokes).toBe(1);
    expect(on).toEqual(off);
  });

  test('10,000 keystrokes: capped keycaps, no lost input, flat memory', async ({ ext }) => {
    test.slow();
    const chunk = 'abcdefghijklmnopqrstuvwxyz'.repeat(20).slice(0, 500);

    // The fixture's recorder keeps every event, so compare heap growth with
    // the overlay on against the same run with it off.
    async function run(enabled) {
      const page = await ext.openPage('/editors.html');
      if (enabled) await ext.enable(page);
      await page.locator('#plain').click();
      const s = await cdp(page);
      const heap = async () => {
        await s.send('HeapProfiler.collectGarbage');
        return (await s.send('Runtime.getHeapUsage')).usedSize;
      };
      await page.keyboard.type('warmup');
      const before = await heap();
      let maxOnScreen = 0;
      for (let i = 0; i < 20; i++) {
        await page.keyboard.type(chunk);
        maxOnScreen = Math.max(maxOnScreen, (await readOverlay(page)).keycaps.length);
      }
      expect(await page.locator('#plain').inputValue()).toHaveLength(6 + 10_000);
      await page.waitForTimeout(4500);
      const keycapsLeft = (await readOverlay(page)).keycaps.length;
      const growth = (await heap()) - before;
      await page.close();
      return { maxOnScreen, keycapsLeft, growth };
    }

    const off = await run(false);
    const on = await run(true);
    expect(on.maxOnScreen).toBeLessThanOrEqual(30);
    expect(on.keycapsLeft).toBe(0);
    expect(on.growth - off.growth).toBeLessThan(2 * 1024 * 1024);
  });
});
