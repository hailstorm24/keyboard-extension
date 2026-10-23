// Things a malicious page might try against the overlay. Each returns what the
// page managed to see, so tests can assert it saw nothing.
window.hostile = {
  host() {
    return document.querySelector('key-overlay-host');
  },

  removeHost() {
    const h = this.host();
    if (h) h.remove();
    return Boolean(h);
  },

  // Keep removing the host as fast as it comes back.
  keepRemovingHost(ms = 2000) {
    const obs = new MutationObserver(() => this.removeHost());
    obs.observe(document.documentElement, { childList: true, subtree: true });
    this.removeHost();
    return new Promise((r) => setTimeout(() => { obs.disconnect(); r(); }, ms));
  },

  readShadow() {
    const h = this.host();
    if (!h) return { found: false };
    return {
      found: true,
      shadowRoot: h.shadowRoot === null ? null : 'readable',
      innerText: h.innerText,
      textContent: h.textContent,
      childCount: h.childNodes.length,
      // Try re-attaching a shadow root to see if it's already taken.
      attachThrows: (() => { try { h.attachShadow({ mode: 'open' }); return false; } catch { return true; } })(),
    };
  },

  fakeKeys(keys = ['Z', 'X', 'Q']) {
    const target = document.getElementById('field');
    for (const key of keys) {
      for (const type of ['keydown', 'keyup']) {
        target.dispatchEvent(new KeyboardEvent(type, { key, code: `Key${key}`, bubbles: true }));
      }
    }
  },

  fakeClicks(points = [[50, 50], [200, 200]]) {
    for (const [x, y] of points) {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, pointerType: 'mouse' }));
    }
  },

  // Try every message shape the extension might plausibly listen for.
  fakeMessages() {
    const types = ['key-overlay:enter-move-mode', 'key-overlay:teardown', 'key-overlay:frame-key', 'enterMoveMode'];
    for (const type of types) {
      window.postMessage({ type }, '*');
      window.postMessage(type, '*');
      document.dispatchEvent(new CustomEvent(type, { detail: { type } }));
    }
  },

  // Look for our host by any means the page has.
  scan() {
    const all = [...document.querySelectorAll('*')].map((e) => e.tagName.toLowerCase());
    return {
      hostTags: all.filter((t) => t.includes('overlay')),
      bodyText: document.body.innerText,
      html: document.documentElement.outerHTML,
    };
  },
};
