// Loading the source folder instead of dist/ (an easy mistake: both have a
// manifest.json) must say so, not fail with a generic error.
import { test, expect, chromium } from '@playwright/test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGINS, MSG } from './support/contract.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('an extension loaded from the source folder says it needs building', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'key-overlay-src-'));
  const extDir = join(tmp, 'ext');
  for (const entry of ['manifest.json', 'src', 'icons']) await cp(join(root, entry), join(extDir, entry), { recursive: true });
  // Grant site access up front, as the other e2e tests do.
  const manifestPath = join(extDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.host_permissions = manifest.optional_host_permissions;
  await writeFile(manifestPath, JSON.stringify(manifest));

  const context = await chromium.launchPersistentContext(join(tmp, 'profile'), {
    channel: 'chromium',
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
  });
  try {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const id = new URL(sw.url()).host;
    const page = await context.newPage();
    await page.goto(`${ORIGINS.top}/recorder.html`);
    const control = await context.newPage();
    await control.goto(`chrome-extension://${id}/src/popup/popup.html`);
    const res = await control.evaluate(async ({ type, href }) => {
      const tab = (await chrome.tabs.query({})).find((t) => t.url === href);
      return chrome.runtime.sendMessage({ type, tabId: tab.id, enabled: true });
    }, { type: MSG.SET_TAB_ENABLED, href: page.url() });
    expect(res).toEqual({ ok: false, reason: 'not-built' });
  } finally {
    await context.close();
    await rm(tmp, { recursive: true, force: true });
  }
});
