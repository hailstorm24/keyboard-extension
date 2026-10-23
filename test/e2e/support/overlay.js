// Reads the overlay through the Chrome DevTools Protocol. The shadow root is
// closed, so page scripts (and Playwright locators) can't see inside it, but
// DOM.getDocument with pierce: true can. Nothing here needs a test hook in the
// extension itself.
import { expect } from '@playwright/test';
import { HOST_TAG, SEL } from './contract.js';

const sessions = new WeakMap();

export async function cdp(page) {
  let s = sessions.get(page);
  if (!s) {
    s = await page.context().newCDPSession(page);
    await s.send('DOM.enable');
    await s.send('CSS.enable');
    sessions.set(page, s);
  }
  return s;
}

const attrs = (node) => {
  const out = {};
  const a = node.attributes ?? [];
  for (let i = 0; i < a.length; i += 2) out[a[i]] = a[i + 1];
  return out;
};

const hasClass = (node, cls) => (attrs(node).class ?? '').split(/\s+/).includes(cls);

const textOf = (node) => {
  if (node.nodeType === 3) return node.nodeValue;
  return (node.children ?? []).map(textOf).join('');
};

function* descendants(node) {
  for (const c of node.children ?? []) {
    yield c;
    yield* descendants(c);
  }
  for (const r of node.shadowRoots ?? []) {
    yield r;
    yield* descendants(r);
  }
}

// Snapshot of the overlay in the page's top frame.
export async function readOverlay(page) {
  const s = await cdp(page);
  const { root } = await s.send('DOM.getDocument', { depth: -1, pierce: true });

  const hosts = [];
  (function walk(node, parent) {
    if (node.nodeName === HOST_TAG) hosts.push({ node, parent });
    for (const c of node.children ?? []) walk(c, node);
    for (const r of node.shadowRoots ?? []) walk(r, node);
    // Don't descend into iframes: the overlay must only be in the top frame.
  })(root, null);

  if (hosts.length === 0) return { count: 0, keycaps: [], ripples: [], grip: false };

  const { node: host, parent } = hosts[0];
  const shadow = host.shadowRoots?.[0];
  const inside = shadow ? [...descendants(shadow)] : [];
  const find = (cls) => inside.filter((n) => n.nodeType === 1 && hasClass(n, cls));

  return {
    count: hosts.length,
    hostNodeId: host.nodeId,
    hostAttrs: attrs(host),
    parent: parent ? `${parent.nodeName.toLowerCase()}${attrs(parent).id ? `#${attrs(parent).id}` : ''}` : null,
    shadowMode: shadow?.shadowRootType,
    keyArea: find(SEL.keyArea)[0]?.nodeId,
    keycaps: find(SEL.keycap).map((n) => ({ text: textOf(n), nodeId: n.nodeId })),
    ripples: find(SEL.ripple).map((n) => ({ kind: attrs(n)['data-kind'], nodeId: n.nodeId })),
    grip: find(SEL.grip).length > 0,
    gripNodeId: find(SEL.grip)[0]?.nodeId,
  };
}

export async function keycapTexts(page) {
  return (await readOverlay(page)).keycaps.map((k) => k.text);
}

export async function rippleKinds(page) {
  return (await readOverlay(page)).ripples.map((r) => r.kind);
}

export async function waitForKeycaps(page, expected) {
  await expect.poll(() => keycapTexts(page), { message: 'keycaps on screen' }).toEqual(expected);
}

// Waits long enough for a keycap to appear, then checks none did.
export async function expectNoKeycaps(page, ms = 600) {
  await page.waitForTimeout(ms);
  expect(await keycapTexts(page)).toEqual([]);
}

export async function expectNoRipples(page, ms = 600) {
  await page.waitForTimeout(ms);
  expect(await rippleKinds(page)).toEqual([]);
}

export async function boxOf(page, nodeId) {
  const s = await cdp(page);
  const { model } = await s.send('DOM.getBoxModel', { nodeId });
  const [x1, y1, x2, , , y3] = model.border;
  return { x: x1, y: y1, width: x2 - x1, height: y3 - y1 };
}

export async function computedStyle(page, nodeId, props) {
  const s = await cdp(page);
  const { computedStyle } = await s.send('CSS.getComputedStyleForNode', { nodeId });
  const map = Object.fromEntries(computedStyle.map(({ name, value }) => [name, value.trim()]));
  return props ? Object.fromEntries(props.map((p) => [p, map[p]])) : map;
}

// Host elements as the page's main world sees them, in every frame.
export async function hostCounts(page) {
  return Promise.all(
    page.frames().map(async (f) => ({
      url: f.url(),
      top: f === page.mainFrame(),
      count: await f.evaluate(() => document.querySelectorAll('key-overlay-host').length).catch(() => -1),
    })),
  );
}

export async function hostCount(page) {
  return page.evaluate(() => document.querySelectorAll('key-overlay-host').length);
}

// Records any change to the host's light DOM (attributes or children), which a
// page could use to learn when keys are pressed.
export async function watchHostLightDom(page) {
  await page.evaluate(() => {
    window.__hostRecords = [];
    const host = document.querySelector('key-overlay-host');
    new MutationObserver((list) => window.__hostRecords.push(...list.map((m) => m.type))).observe(host, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  return () => page.evaluate(() => window.__hostRecords);
}
