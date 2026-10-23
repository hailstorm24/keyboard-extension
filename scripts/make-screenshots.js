// Captures the Chrome Web Store images (docs/store/LISTING.md) with the real
// extension running in Playwright's Chromium, on the made-up demo pages in
// scripts/screenshots/. Run: npm run screenshots
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension } from './build.js';
import { createHandler } from '../test/server.js';
import { MSG } from '../src/shared/messages.js';
import { SETTINGS_KEY, DEFAULTS } from '../src/shared/settings.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'docs/store/screenshots');
const PORT = 3010;
const ORIGIN = `http://localhost:${PORT}`;
const SIZE = { width: 1280, height: 800 };

// The demo pages, served over http so the extension can run on them.
const server = createServer(createHandler(join(root, 'scripts/screenshots/')));
await new Promise((r) => server.listen(PORT, 'localhost', r));

// Build, and grant site access up front as the e2e tests do: automation
// can't click Chrome's permission prompt.
const tmp = await mkdtemp(join(tmpdir(), 'key-overlay-shots-'));
const extDir = await buildExtension(join(tmp, 'ext'));
const manifestPath = join(extDir, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.host_permissions = manifest.optional_host_permissions;
await writeFile(manifestPath, JSON.stringify(manifest));

const context = await chromium.launchPersistentContext(join(tmp, 'profile'), {
  channel: 'chromium',
  viewport: SIZE,
  deviceScaleFactor: 1,
  colorScheme: 'light',
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
});
const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
const popupUrl = `chrome-extension://${new URL(sw.url()).host}/src/popup/popup.html`;
const control = await context.newPage();
await control.goto(popupUrl);

const setSettings = (s) => control.evaluate(({ key, s }) => chrome.storage.sync.set({ [key]: s }), { key: SETTINGS_KEY, s });

let pageCount = 0;

async function openWithOverlay(path) {
  const page = await context.newPage();
  // A unique URL, so the tab lookup below finds this tab and not an earlier one.
  await page.goto(`${ORIGIN}${path}?n=${++pageCount}`);
  const res = await control.evaluate(async ({ type, href }) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === href);
    return chrome.runtime.sendMessage({ type, tabId: tab.id, enabled: true });
  }, { type: MSG.SET_TAB_ENABLED, href: page.url() });
  if (!res?.ok) throw new Error(`couldn't turn on the overlay: ${JSON.stringify(res)}`);
  await page.waitForFunction(() => document.querySelector('key-overlay-host'));
  await page.bringToFront();
  return page;
}

// Pauses every animation on the page (keycaps and ripples included), so the
// screenshot catches them mid-flight.
async function freeze(page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 });
}

await mkdir(outDir, { recursive: true });
const shot = (page, name) => page.screenshot({ path: join(outDir, name), type: 'png' });

// A little larger than the default, so keycaps read at store size. Typing is
// at a normal pace: faster typing stacks keycaps on top of each other.
await setSettings({ ...DEFAULTS, size: 1.3 });

// 1. A sign-up form mid-typing: letters from the email, bullets from the password.
const signup = await openWithOverlay('/signup.html');
await signup.locator('#name').fill('Maya Okafor');
// Keycaps fade after about two seconds, so fill most of the email and type
// only its end: letters, ⇥, and bullets are then on screen together.
await signup.locator('#email').fill('maya@fieldnote');
await signup.keyboard.type('.io', { delay: 220 });
await signup.keyboard.press('Tab');
await signup.waitForTimeout(220);
await signup.keyboard.type('hunt', { delay: 220 });
await freeze(signup);
await shot(signup, '1-masking.png');

// 3. A shortcut keycap and a click ripple, on an app with its own ⌘K palette.
const app = await openWithOverlay('/app.html');
await app.mouse.click(520, 330);
await app.waitForTimeout(250);
await app.keyboard.press('ControlOrMeta+k');
await app.waitForTimeout(200);
await app.keyboard.type('open', { delay: 260 });
await app.mouse.click(640, 690);
await app.waitForTimeout(80);
await freeze(app);
await shot(app, '3-shortcuts-and-clicks.png');

// 2. The popup next to a page. Chrome draws the real popup outside the page,
// so render the popup on its own and place it where the toolbar popup goes.
const page2 = await openWithOverlay('/signup.html');
await page2.locator('#name').click();
await page2.keyboard.type('Maya', { delay: 260 });
await freeze(page2);
const background = await page2.screenshot({ type: 'png' });

const popup = await context.newPage();
await popup.setViewportSize({ width: 268, height: 600 });
await popup.goto(popupUrl);
await popup.locator('body[data-ready="true"]').waitFor();
// Show the switch as it looks on a tab that's on. (Opened as a tab, the
// popup's "current tab" is itself.)
await popup.evaluate(() => { document.getElementById('enabled').checked = true; });
const popupBox = await popup.locator('body').boundingBox();
const popupImage = await popup.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 268, height: Math.ceil(popupBox.height) } });

const composer = await context.newPage();
await composer.setViewportSize(SIZE);
const dataUrl = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
await composer.setContent(`
  <style>
    body { margin: 0; width: 1280px; height: 800px; position: relative; overflow: hidden; }
    .bg { position: absolute; inset: 0; }
    .popup { position: absolute; top: 10px; right: 16px; border-radius: 10px; overflow: hidden;
             box-shadow: 0 2px 6px rgba(0,0,0,.18), 0 16px 40px rgba(0,0,0,.22); }
    .popup img { display: block; }
  </style>
  <img class="bg" src="${dataUrl(background)}">
  <div class="popup"><img src="${dataUrl(popupImage)}"></div>`);
await composer.waitForFunction(() => [...document.images].every((i) => i.complete));
await shot(composer, '2-settings.png');

// Small promo tile, 440×280.
const icon = await readFile(join(root, 'icons/icon.svg'), 'utf8');
await composer.setViewportSize({ width: 440, height: 280 });
await composer.setContent(`
  <style>
    body { margin: 0; width: 440px; height: 280px; display: flex; align-items: center; justify-content: center; gap: 22px;
           background: #14213d; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #fff; }
    svg { width: 96px; height: 96px; }
    h1 { margin: 0; font-size: 34px; font-weight: 600; }
    p { margin: 6px 0 0; font-size: 16px; color: #c7ccd8; }
  </style>
  ${icon}
  <div><h1>Key Overlay</h1><p>See every key and click.</p></div>`);
await composer.screenshot({ path: join(outDir, 'promo-small-440x280.png'), type: 'png' });

await context.close();
server.close();
await rm(tmp, { recursive: true, force: true });
process.stdout.write(`wrote screenshots to ${outDir}\n`);
