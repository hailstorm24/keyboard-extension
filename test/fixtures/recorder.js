// Records everything the page can observe, for the off-vs-on comparison and
// the canary audit. Exposes window.__snapshot().
(() => {
  const HOST = 'KEY-OVERLAY-HOST';
  const log = [];
  const mutations = [];
  const messages = [];

  const describe = (el) => {
    if (!el || !el.tagName) return String(el && el.nodeName);
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    return s;
  };

  const EVENTS = [
    'keydown', 'keyup', 'keypress', 'beforeinput', 'input',
    'compositionstart', 'compositionupdate', 'compositionend',
    'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'auxclick',
    'dragstart', 'dragover', 'drop', 'selectstart', 'focusin', 'focusout', 'submit', 'change',
  ];

  for (const type of EVENTS) {
    for (const capture of [true, false]) {
      window.addEventListener(
        type,
        (e) => {
          log.push({
            phase: capture ? 'capture' : 'bubble',
            type,
            key: e.key,
            code: e.code,
            button: e.button,
            pointerType: e.pointerType,
            data: e.data,
            target: describe(e.target),
            defaultPrevented: e.defaultPrevented,
            cancelBubble: e.cancelBubble,
          });
        },
        { capture },
      );
    }
  }

  window.addEventListener('message', (e) => messages.push({ origin: e.origin, data: safeJson(e.data) }));

  function safeJson(v) {
    try {
      return JSON.parse(JSON.stringify(v));
    } catch {
      return String(v);
    }
  }

  const involvesHost = (m) =>
    m.target.nodeName === HOST ||
    [...m.addedNodes, ...m.removedNodes].some((n) => n.nodeName === HOST);

  new MutationObserver((list) => {
    for (const m of list) {
      if (involvesHost(m)) continue;
      mutations.push({
        type: m.type,
        target: describe(m.target),
        attribute: m.attributeName,
        added: [...m.addedNodes].map(describe),
        removed: [...m.removedNodes].map(describe),
      });
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });

  const STYLE_PROPS = ['display', 'position', 'font-family', 'font-size', 'color', 'background-color', 'margin', 'padding', 'overflow', 'cursor', 'user-select', 'pointer-events', 'transform', 'zoom'];

  window.__snapshot = () => {
    const styles = {};
    for (const el of document.querySelectorAll('html, body, [data-style-probe]')) {
      const cs = getComputedStyle(el);
      styles[describe(el)] = Object.fromEntries(STYLE_PROPS.map((p) => [p, cs.getPropertyValue(p)]));
    }
    const values = {};
    for (const el of document.querySelectorAll('input, textarea, select, [contenteditable]')) {
      values[describe(el)] = el.isContentEditable ? el.textContent : el.type === 'checkbox' ? el.checked : el.value;
    }
    return {
      log: structuredClone(log),
      mutations: structuredClone(mutations),
      messages: structuredClone(messages),
      styles,
      values,
      selection: String(getSelection()),
      activeElement: describe(document.activeElement),
      scroll: [scrollX, scrollY],
      page: structuredClone(window.__pageState ?? {}),
    };
  };
})();
