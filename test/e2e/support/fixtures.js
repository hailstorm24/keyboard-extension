// Playwright fixtures: a Chromium with the built extension loaded, and an
// `ext` helper that drives it the way the popup does (chrome.runtime
// messages from an extension page), so tests exercise the real code paths.
import { test as base, expect, chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXTENSION_DIR } from './global-setup.js';
import { ORIGINS, MSG, STORAGE } from './contract.js';
import { hostCount } from './overlay.js';

export { expect };

export const CANARY = 'CANARY7Q2X';

export const test = base.extend({
  context: async ({ hasTouch }, use) => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'key-overlay-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      hasTouch,
      viewport: { width: 1280, height: 800 },
      args: [`--disable-extensions-except=${EXTENSION_DIR}`, `--load-extension=${EXTENSION_DIR}`],
    });
    await use(context);
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  },

  extensionId: async ({ context }, use) => {
    const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(new URL(sw.url()).host);
  },

  ext: async ({ context, extensionId }, use) => {
    await use(new Ext(context, extensionId));
  },

  // Collects console output from every page, frame, and extension worker.
  consoleLog: async ({ context }, use) => {
    const lines = [];
    const add = (where) => (msg) => lines.push(`${where}: ${msg.text()}`);
    context.on('console', add('page'));
    const watchWorker = (w) => w.on?.('console', add(`worker ${w.url()}`));
    context.serviceWorkers().forEach(watchWorker);
    context.on('serviceworker', watchWorker);
    await use(lines);
  },

  // Collects every network request, including from the extension's worker.
  network: async ({ context }, use) => {
    const requests = [];
    context.on('request', (r) => {
      let frameUrl = null;
      try {
        frameUrl = r.frame().url();
      } catch {
        // Service worker requests have no frame.
      }
      requests.push({ url: r.url(), method: r.method(), fromWorker: Boolean(r.serviceWorker?.()), frameUrl });
    });
    await use({
      requests,
      // Anything that isn't a fixture page loading its own files.
      violations() {
        const fixtureOrigins = new Set(Object.values(ORIGINS));
        return requests.filter((r) => {
          const u = new URL(r.url);
          // The extension's own packaged files, and browser-internal URLs.
          if (['chrome-extension:', 'data:', 'blob:', 'chrome:'].includes(u.protocol)) return false;
          if (r.fromWorker) return true;
          return !fixtureOrigins.has(u.origin);
        });
      },
    });
  },
});

class Ext {
  constructor(context, id) {
    this.context = context;
    this.id = id;
    this.tabIds = new WeakMap();
    this._control = null;
  }

  get popupUrl() {
    return `chrome-extension://${this.id}/src/popup/popup.html`;
  }

  // An extension page used to call chrome.* APIs, like the popup does.
  async control() {
    if (!this._control || this._control.isClosed()) {
      this._control = await this.context.newPage();
      await this._control.goto(`${this.popupUrl}?e2e-control`);
    }
    return this._control;
  }

  async call(fn, arg) {
    return (await this.control()).evaluate(fn, arg);
  }

  // Opens a fixture page with a unique URL so its tab id can be found.
  async openPage(path, { origin = ORIGINS.top } = {}) {
    const page = await this.context.newPage();
    const url = new URL(path, origin);
    url.searchParams.set('e2e', Math.random().toString(36).slice(2));
    await page.goto(url.href);
    const tabId = await this.call(async (href) => {
      const tabs = await chrome.tabs.query({});
      return tabs.find((t) => t.url === href)?.id;
    }, page.url());
    if (tabId === undefined) throw new Error(`no tab for ${page.url()}`);
    this.tabIds.set(page, tabId);
    return page;
  }

  async tabId(page) {
    if (this.tabIds.has(page)) return this.tabIds.get(page);
    let id = await this.call(async (href) => (await chrome.tabs.query({})).find((t) => t.url === href)?.id, page.url());
    if (id === undefined) {
      // chrome:// and other extensions' pages hide their URL without the
      // "tabs" permission, so find them as the active tab instead.
      await page.bringToFront();
      id = await this.call(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id);
    }
    this.tabIds.set(page, id);
    return id;
  }

  async setEnabled(page, enabled) {
    const tabId = await this.tabId(page);
    return this.call(
      ({ type, tabId, enabled }) => chrome.runtime.sendMessage({ type, tabId, enabled }),
      { type: MSG.SET_TAB_ENABLED, tabId, enabled },
    );
  }

  // Turns the overlay on and waits for it to appear.
  async enable(page) {
    const res = await this.setEnabled(page, true);
    if (res?.ok) await expect.poll(() => hostCount(page)).toBe(1);
    return res;
  }

  async disable(page) {
    return this.setEnabled(page, false);
  }

  async isEnabled(page) {
    const tabId = await this.tabId(page);
    return this.call(
      async ({ key, tabId }) => ((await chrome.storage.session.get(key))[key] ?? []).includes(tabId),
      { key: STORAGE.enabledTabsKey, tabId },
    );
  }

  async badge(page) {
    const tabId = await this.tabId(page);
    return this.call((tabId) => chrome.action.getBadgeText({ tabId }), tabId);
  }

  // Raw write, merged over what's stored. Deliberately not normalized, so
  // tests can store bad values.
  async setSettings(partial) {
    return this.call(
      async ({ key, partial }) => {
        const cur = (await chrome.storage.sync.get(key))[key] ?? {};
        await chrome.storage.sync.set({ [key]: { ...cur, ...partial } });
      },
      { key: STORAGE.settingsKey, partial },
    );
  }

  async settings() {
    return this.call(async (key) => (await chrome.storage.sync.get(key))[key], STORAGE.settingsKey);
  }

  async storage() {
    return this.call(async () => ({
      local: await chrome.storage.local.get(null),
      sync: await chrome.storage.sync.get(null),
      session: await chrome.storage.session.get(null),
    }));
  }

  async send(page, message) {
    const tabId = await this.tabId(page);
    return this.call(({ tabId, message }) => chrome.tabs.sendMessage(tabId, message), { tabId, message });
  }

  async stopServiceWorker() {
    // Playwright keeps listing a stopped worker, so watch its status over CDP.
    const control = await this.control();
    const s = await this.context.newCDPSession(control);
    let status = null;
    s.on('ServiceWorker.workerVersionUpdated', ({ versions }) => {
      const ours = versions.find((v) => v.scriptURL.startsWith(`chrome-extension://${this.id}/`));
      if (ours) status = ours.runningStatus;
    });
    await s.send('ServiceWorker.enable');
    await s.send('ServiceWorker.stopAllWorkers');
    await expect.poll(() => status, { message: 'service worker stopped' }).toBe('stopped');
    await s.detach();
  }
}

// Runs the same scripted session on a page with the overlay off and one with
// it on, and returns both recordings.
export async function offVsOn(ext, path, run, { origin } = {}) {
  const off = await ext.openPage(path, { origin });
  await off.bringToFront();
  await run(off);
  const offSnap = await off.evaluate(() => window.__snapshot());

  const on = await ext.openPage(path, { origin });
  await ext.enable(on);
  await on.bringToFront();
  await run(on);
  const onSnap = await on.evaluate(() => window.__snapshot());

  return { off: offSnap, on: onSnap, onPage: on, offPage: off };
}

export function containsCanary(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return /canary7q2x|7q2x/i.test(s);
}
